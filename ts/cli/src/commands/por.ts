import chalk from 'chalk';
import { PublicKey } from '@solana/web3.js';
import { loadConfig } from '../config.js';

export async function por(mintStr: string): Promise<void> {
  const cfg = loadConfig();
  let mint: PublicKey;
  try {
    mint = new PublicKey(mintStr);
  } catch {
    console.log(chalk.bold.cyan(`Proof-of-Reserve status for ${mintStr}`));
    console.log(chalk.yellow('  invalid mint address -- expected a base58 Solana public key.'));
    return;
  }
  console.log(chalk.bold.cyan(`Proof-of-Reserve status for ${mint.toBase58()}`));
  console.log(`  program id: ${cfg.programId ?? '(unregistered)'}`);
  console.log(`  cluster:    ${cfg.cluster}`);
  console.log(chalk.dim('  attestation lookup requires deployed program (Phase 9).'));
}
