import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { createMint, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { assert } from 'chai';

const PEG_USD = Array.from(Buffer.from('USD'.padEnd(8, '\0')));
const MODE_CRYPTO = 0;

describe('pegd_issuance', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PegdIssuance as Program<any>;
  const payer = (provider.wallet as any).payer as Keypair;

  const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('pegd_config')],
    program.programId,
  );

  const metaPda = (mint: PublicKey) =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('stable_meta'), mint.toBuffer()],
      program.programId,
    )[0];

  const vaultPda = (mint: PublicKey) =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('vault_state'), mint.toBuffer()],
      program.programId,
    )[0];

  async function newStableMint(): Promise<PublicKey> {
    return createMint(
      provider.connection,
      payer,
      provider.wallet.publicKey,
      null,
      6,
      Keypair.generate(),
      undefined,
      TOKEN_2022_PROGRAM_ID,
    );
  }

  // Shared crypto-overcollateralized stable for the happy-path flow.
  let stableMint: PublicKey;

  it('initializes the pegd config', async () => {
    const treasury = Keypair.generate();
    await program.methods
      .initializeConfig(15_000, 12_500, 11_000)
      .accounts({
        config: configPda,
        admin: provider.wallet.publicKey,
        treasury: treasury.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    const configAccount = await (program.account as any).config.fetch(configPda);
    assert.equal(configAccount.minRatioBps, 15_000);
    assert.equal(configAccount.liquidationBps, 12_500);
    assert.equal(configAccount.circuitBps, 11_000);
    assert.equal(configAccount.paused, false);
  });

  it('registers a crypto-overcollateralized stable', async () => {
    stableMint = await newStableMint();
    await program.methods
      .registerStable(PEG_USD, MODE_CRYPTO, 15_000, 0, false)
      .accounts({
        config: configPda,
        stableMeta: metaPda(stableMint),
        stableMint,
        issuer: provider.wallet.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const meta = await (program.account as any).stablecoinMeta.fetch(metaPda(stableMint));
    assert.equal(meta.issuer.toBase58(), provider.wallet.publicKey.toBase58());
    assert.equal(meta.mint.toBase58(), stableMint.toBase58());
    assert.equal(meta.minRatioBps, 15_000);
    assert.equal(meta.collateralMode, MODE_CRYPTO);
    assert.equal(meta.issuedSupply.toString(), '0');
  });

  it('deposits collateral and mints at the minimum ratio', async () => {
    await program.methods
      .depositCollateral(new anchor.BN(1_500_000))
      .accounts({
        stableMeta: metaPda(stableMint),
        vaultState: vaultPda(stableMint),
        stableMint,
        issuer: provider.wallet.publicKey,
        collateralMint: Keypair.generate().publicKey,
        oracle: Keypair.generate().publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const vault = await (program.account as any).vaultState.fetch(vaultPda(stableMint));
    assert.equal(vault.collateralAmount.toString(), '1500000');

    // 1,500,000 reserve against 1,000,000 supply is exactly 15000 bps.
    await program.methods
      .mintStable(new anchor.BN(1_000_000), new anchor.BN(1_500_000))
      .accounts({
        config: configPda,
        stableMeta: metaPda(stableMint),
        vaultState: vaultPda(stableMint),
        stableMint,
        issuer: provider.wallet.publicKey,
      })
      .rpc();

    const meta = await (program.account as any).stablecoinMeta.fetch(metaPda(stableMint));
    assert.equal(meta.issuedSupply.toString(), '1000000');
    assert.equal(meta.reservesValueUsd.toString(), '1500000');
  });

  it('rejects a mint that trips the circuit breaker', async () => {
    // Adding 1 unit against a 1,000,000 reserve drops the ratio to 9999 bps,
    // below the 11000 bps breaker.
    try {
      await program.methods
        .mintStable(new anchor.BN(1), new anchor.BN(1_000_000))
        .accounts({
          config: configPda,
          stableMeta: metaPda(stableMint),
          vaultState: vaultPda(stableMint),
          stableMint,
          issuer: provider.wallet.publicKey,
        })
        .rpc();
      assert.fail('expected the circuit breaker to reject the mint');
    } catch (err: any) {
      const code = err?.error?.errorCode?.code ?? String(err);
      assert.include(code, 'CircuitBreakerTripped');
    }

    // Supply is unchanged after the rejection.
    const meta = await (program.account as any).stablecoinMeta.fetch(metaPda(stableMint));
    assert.equal(meta.issuedSupply.toString(), '1000000');
  });

  it('rejects a mint below the minimum ratio', async () => {
    const otherMint = await newStableMint();
    await program.methods
      .registerStable(PEG_USD, MODE_CRYPTO, 15_000, 0, false)
      .accounts({
        config: configPda,
        stableMeta: metaPda(otherMint),
        stableMint: otherMint,
        issuer: provider.wallet.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .depositCollateral(new anchor.BN(1_200_000))
      .accounts({
        stableMeta: metaPda(otherMint),
        vaultState: vaultPda(otherMint),
        stableMint: otherMint,
        issuer: provider.wallet.publicKey,
        collateralMint: Keypair.generate().publicKey,
        oracle: Keypair.generate().publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // 1,200,000 reserve against 1,000,000 supply is 12000 bps: above the breaker
    // but below the 15000 bps minimum for this stable.
    try {
      await program.methods
        .mintStable(new anchor.BN(1_000_000), new anchor.BN(1_200_000))
        .accounts({
          config: configPda,
          stableMeta: metaPda(otherMint),
          vaultState: vaultPda(otherMint),
          stableMint: otherMint,
          issuer: provider.wallet.publicKey,
        })
        .rpc();
      assert.fail('expected the minimum ratio guard to reject the mint');
    } catch (err: any) {
      const code = err?.error?.errorCode?.code ?? String(err);
      assert.include(code, 'RatioBelowMinimum');
    }
  });
});
