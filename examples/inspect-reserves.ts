import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Wallet } from '@coral-xyz/anchor';
import { PegdIssuer } from '@pegd/sdk';
import { classifyRatio } from '@pegd/risk-module';

async function main(): Promise<void> {
  const mintArg = process.argv[2];
  if (!mintArg) {
    console.error('usage: inspect-reserves <stable-mint-pubkey>');
    process.exit(1);
    return;
  }

  const stableMint = new PublicKey(mintArg);
  const connection = new Connection(
    process.env.PEGD_RPC ?? 'https://api.mainnet-beta.solana.com',
    'confirmed',
  );

  // Reading reserves is a pure account fetch, so a throwaway wallet is enough to
  // construct the client and derive the attestation PDA.
  const wallet = new Wallet(Keypair.generate());
  const issuer = new PegdIssuer(connection, wallet, {
    programId: new PublicKey(
      process.env.PEGD_PROGRAM_ID ?? '11111111111111111111111111111111',
    ),
    cluster: 'mainnet-beta',
  });

  const snapshot = await issuer.fetchReserveSnapshot(stableMint);
  if (!snapshot) {
    console.log('no reserve attestation found for', stableMint.toBase58());
    return;
  }

  console.log('stable mint:', snapshot.stableMint.toBase58());
  console.log('total supply (raw):', snapshot.totalSupplyRaw.toString());
  console.log('reserve value (USD, 6 decimals):', snapshot.reserveValueUsdE6.toString());
  console.log('ratio (bps):', snapshot.ratioBps);
  console.log('updated slot:', snapshot.updatedSlot);
  console.log('risk zone:', classifyRatio(snapshot.ratioBps));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
