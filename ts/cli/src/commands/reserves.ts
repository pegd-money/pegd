import chalk from 'chalk';
import { Connection, PublicKey } from '@solana/web3.js';
import { loadConfig } from '../config.js';

export async function reserves(mintStr: string): Promise<void> {
  const cfg = loadConfig();
  console.log(chalk.bold.cyan(`Reserves report for ${mintStr}`));
  let mint: PublicKey;
  try {
    mint = new PublicKey(mintStr);
  } catch {
    console.log(chalk.yellow('  invalid mint address -- expected a base58 Solana public key.'));
    return;
  }
  const conn = new Connection(cfg.rpcUrl, 'confirmed');
  const supply = await conn.getTokenSupply(mint, 'confirmed').catch(() => null);
  if (!supply) {
    console.log(chalk.yellow('  supply unavailable -- mint not found on this cluster.'));
    return;
  }
  console.log(`  total supply: ${supply.value.uiAmountString}`);
  console.log(`  decimals:     ${supply.value.decimals}`);
  console.log(chalk.dim(`  rpc:          ${cfg.rpcUrl}`));
}
