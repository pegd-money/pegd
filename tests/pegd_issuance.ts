import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Keypair, SystemProgram } from '@solana/web3.js';
import { assert } from 'chai';

describe('pegd_issuance', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PegdIssuance as Program<any>;

  it('initializes the pegd config', async () => {
    const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('pegd_config')],
      program.programId,
    );
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
});
