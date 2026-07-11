import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Ed25519Program,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { createHash } from 'crypto';
import { assert } from 'chai';

const PEG_USD = Array.from(Buffer.from('USD'.padEnd(8, '\0')));
const MODE_CRYPTO = 0;
const POR_DOMAIN = Buffer.from('PEGD-POR-V1');

// A signature is stored verbatim by the program and is no longer content-checked;
// the real proof is the ed25519 verify instruction introspected from the sysvar.
const PLACEHOLDER_SIG = Array.from({ length: 64 }, () => 1);

describe('pegd_issuance', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PegdIssuance as Program<any>;
  const wallet = provider.wallet.publicKey;

  // Single registered attestor with a quorum threshold of one.
  const attestorKp = Keypair.generate();

  const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('pegd_config')],
    program.programId,
  );

  const [attestorSetPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from('attestor_set')],
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

  const attestationPda = (mint: PublicKey) =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('reserve_attestation'), mint.toBuffer()],
      program.programId,
    )[0];

  const u64 = (value: number) => new anchor.BN(value).toArrayLike(Buffer, 'le', 8);
  const i64 = (value: number) => new anchor.BN(value).toArrayLike(Buffer, 'le', 8);
  const u32 = (value: number) => {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(value >>> 0, 0);
    return b;
  };

  // Domain-separated SHA-256 digest the attestors sign, matching attest.rs.
  const attestationDigest = (
    mint: PublicKey,
    timestamp: number,
    totalSupply: number,
    reserveUsd: number,
    ratioBps: number,
  ): Buffer =>
    createHash('sha256')
      .update(
        Buffer.concat([
          POR_DOMAIN,
          mint.toBuffer(),
          i64(timestamp),
          u64(totalSupply),
          u64(reserveUsd),
          u32(ratioBps),
        ]),
      )
      .digest();

  // Register a fresh Token-2022 stable, deposit collateral, and commit a
  // quorum-backed reserve attestation. Returns the newly created mint.
  async function provisionStable(params: {
    minRatioBps: number;
    collateral: number;
    reportedSupply: number;
    reserveUsd: number;
    ratioBps: number;
  }): Promise<PublicKey> {
    const mintKp = Keypair.generate();
    const mint = mintKp.publicKey;

    await program.methods
      .registerStable(PEG_USD, MODE_CRYPTO, params.minRatioBps, 0, false)
      .accounts({
        config: configPda,
        stableMeta: metaPda(mint),
        stableMint: mint,
        issuer: wallet,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([mintKp])
      .rpc();

    await program.methods
      .depositCollateral(new anchor.BN(params.collateral))
      .accounts({
        stableMeta: metaPda(mint),
        vaultState: vaultPda(mint),
        stableMint: mint,
        issuer: wallet,
        collateralMint: Keypair.generate().publicKey,
        oracle: Keypair.generate().publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const timestamp = Math.floor(Date.now() / 1000) - 60;
    const digest = attestationDigest(
      mint,
      timestamp,
      params.reportedSupply,
      params.reserveUsd,
      params.ratioBps,
    );
    const ed25519Ix = Ed25519Program.createInstructionWithPrivateKey({
      privateKey: attestorKp.secretKey,
      message: digest,
    });

    await program.methods
      .commitAttestation(
        new anchor.BN(timestamp),
        new anchor.BN(params.reportedSupply),
        new anchor.BN(params.reserveUsd),
        params.ratioBps,
        PLACEHOLDER_SIG,
      )
      .accounts({
        config: configPda,
        attestorSet: attestorSetPda,
        stableMeta: metaPda(mint),
        attestation: attestationPda(mint),
        stableMint: mint,
        attestor: wallet,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([ed25519Ix])
      .rpc();

    return mint;
  }

  function mintStable(mint: PublicKey, amount: number) {
    const ata = getAssociatedTokenAddressSync(mint, wallet, false, TOKEN_2022_PROGRAM_ID);
    const createAtaIx = createAssociatedTokenAccountInstruction(
      wallet,
      ata,
      wallet,
      mint,
      TOKEN_2022_PROGRAM_ID,
    );
    return program.methods
      .mintStable(new anchor.BN(amount))
      .accounts({
        config: configPda,
        stableMeta: metaPda(mint),
        vaultState: vaultPda(mint),
        attestation: attestationPda(mint),
        stableMint: mint,
        destination: ata,
        issuer: wallet,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .preInstructions([createAtaIx]);
  }

  it('initializes the pegd config', async () => {
    const treasury = Keypair.generate();
    await program.methods
      .initializeConfig(15_000, 12_500, 11_000)
      .accounts({
        config: configPda,
        admin: wallet,
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

  it('configures the attestor set with a single-signer quorum', async () => {
    await program.methods
      .configureAttestors(1, [attestorKp.publicKey])
      .accounts({
        config: configPda,
        attestorSet: attestorSetPda,
        admin: wallet,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    const set = await (program.account as any).attestorSet.fetch(attestorSetPda);
    assert.equal(set.threshold, 1);
    assert.equal(set.count, 1);
    assert.equal(set.attestors[0].toBase58(), attestorKp.publicKey.toBase58());
  });

  it('mints at the minimum ratio against a fresh attestation', async () => {
    // 1,500,000 reserve reported against 1,000,000 supply is exactly 15000 bps.
    const mint = await provisionStable({
      minRatioBps: 15_000,
      collateral: 1_500_000,
      reportedSupply: 1_000_000,
      reserveUsd: 1_500_000,
      ratioBps: 15_000,
    });

    // mint_stable now reads the reserve value from the attestation account and
    // takes only the amount argument.
    await mintStable(mint, 1_000_000).rpc();

    const meta = await (program.account as any).stablecoinMeta.fetch(metaPda(mint));
    assert.equal(meta.issuedSupply.toString(), '1000000');
    assert.equal(meta.reservesValueUsd.toString(), '1500000');
  });

  it('rejects a mint whose attestation trips the circuit breaker', async () => {
    // 1,000,000 reserve against 1,000,000 supply is 10000 bps, below the 11000
    // breaker, so the attestation commit trips the breaker for this stable.
    const mint = await provisionStable({
      minRatioBps: 15_000,
      collateral: 1_000_000,
      reportedSupply: 1_000_000,
      reserveUsd: 1_000_000,
      ratioBps: 10_000,
    });

    const meta = await (program.account as any).stablecoinMeta.fetch(metaPda(mint));
    assert.equal(meta.breakerTripped, true);

    try {
      await mintStable(mint, 1_000_000).rpc();
      assert.fail('expected the circuit breaker to reject the mint');
    } catch (err: any) {
      const code = err?.error?.errorCode?.code ?? String(err);
      assert.include(code, 'CircuitBreakerTripped');
    }
  });

  it('rejects a mint below the minimum ratio', async () => {
    // 1,200,000 reserve against 1,000,000 supply is 12000 bps: above the breaker
    // but below the 15000 bps minimum for this stable.
    const mint = await provisionStable({
      minRatioBps: 15_000,
      collateral: 1_200_000,
      reportedSupply: 1_000_000,
      reserveUsd: 1_200_000,
      ratioBps: 12_000,
    });

    try {
      await mintStable(mint, 1_000_000).rpc();
      assert.fail('expected the minimum ratio guard to reject the mint');
    } catch (err: any) {
      const code = err?.error?.errorCode?.code ?? String(err);
      assert.include(code, 'RatioBelowMinimum');
    }
  });

  it('rejects an attestation with no attestor quorum', async () => {
    const mintKp = Keypair.generate();
    const mint = mintKp.publicKey;
    await program.methods
      .registerStable(PEG_USD, MODE_CRYPTO, 15_000, 0, false)
      .accounts({
        config: configPda,
        stableMeta: metaPda(mint),
        stableMint: mint,
        issuer: wallet,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([mintKp])
      .rpc();

    const timestamp = Math.floor(Date.now() / 1000) - 60;
    try {
      // No preceding ed25519 verify instruction, so zero attestors are counted
      // against a threshold of one.
      await program.methods
        .commitAttestation(
          new anchor.BN(timestamp),
          new anchor.BN(1_000_000),
          new anchor.BN(1_500_000),
          15_000,
          PLACEHOLDER_SIG,
        )
        .accounts({
          config: configPda,
          attestorSet: attestorSetPda,
          stableMeta: metaPda(mint),
          attestation: attestationPda(mint),
          stableMint: mint,
          attestor: wallet,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail('expected the quorum guard to reject the attestation');
    } catch (err: any) {
      const code = err?.error?.errorCode?.code ?? String(err);
      assert.include(code, 'QuorumNotMet');
    }
  });
});
