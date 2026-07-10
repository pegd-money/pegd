import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { Wallet } from '@coral-xyz/anchor';
import { PegdIssuer } from '@pegd/sdk';
import { CollateralMode } from '@pegd/issuance-core';

async function main(): Promise<void> {
  const connection = new Connection(
    process.env.PEGD_RPC ?? 'https://api.devnet.solana.com',
    'confirmed',
  );

  // Replace with a funded issuer keypair to actually broadcast the transaction.
  const issuerKeypair = Keypair.generate();
  const wallet = new Wallet(issuerKeypair);

  // The stable mint must already exist as a Token-2022 mint on the target cluster.
  const stableMint = new PublicKey(
    process.env.PEGD_STABLE_MINT ?? '11111111111111111111111111111111',
  );

  const issuer = new PegdIssuer(connection, wallet, {
    programId: new PublicKey(
      process.env.PEGD_PROGRAM_ID ?? '11111111111111111111111111111111',
    ),
    cluster: 'devnet',
  });

  const registerIx = issuer.buildRegisterStableIx(stableMint, issuerKeypair.publicKey, {
    name: 'Example USD',
    symbol: 'exUSD',
    pegCurrency: 'USD',
    collateralMode: CollateralMode.OvercollateralizedCrypto,
    minRatioBps: 15_000,
    yieldRateBps: 0,
    enableComplianceHook: false,
  });

  const tx = new Transaction().add(registerIx);
  tx.feePayer = issuerKeypair.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  console.log('program id:', issuer.programId.toBase58());
  console.log('config PDA:', issuer.configPda()[0].toBase58());
  console.log('stable meta PDA:', issuer.stableMetaPda(stableMint)[0].toBase58());
  console.log('accounts in register instruction:', registerIx.keys.length);

  // Simulate first. The config PDA must already be initialized for this to succeed.
  const sim = await connection.simulateTransaction(tx, [issuerKeypair]);
  console.log('simulation err:', sim.value.err);
  console.log('simulation logs:', sim.value.logs);

  // To execute, fund the issuer keypair and broadcast:
  // tx.sign(issuerKeypair);
  // const signature = await connection.sendRawTransaction(tx.serialize());
  // await connection.confirmTransaction(signature, 'confirmed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
