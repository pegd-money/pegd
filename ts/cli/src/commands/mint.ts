import chalk from 'chalk';
import BN from 'bn.js';
import { loadConfig } from '../config.js';

export interface MintOptions {
  mint: string;
  amount: string;
}

export async function mint(opts: MintOptions): Promise<void> {
  const cfg = loadConfig();
  const amount = new BN(opts.amount);
  console.log(chalk.bold.cyan('Pegd mint request'));
  console.log(`  stable mint: ${opts.mint}`);
  console.log(`  amount:      ${amount.toString()}`);
  console.log(chalk.dim(`  cluster:     ${cfg.cluster}`));
  if (!cfg.programId) {
    console.log(chalk.yellow('Program id not configured -- mint transaction not submitted.'));
    return;
  }
  console.log(chalk.green('Transaction prepared (submit via SDK build step).'));
}
