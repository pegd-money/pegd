import chalk from 'chalk';
import BN from 'bn.js';
import { loadConfig } from '../config.js';

export interface BurnOptions {
  mint: string;
  amount: string;
}

export async function burn(opts: BurnOptions): Promise<void> {
  const cfg = loadConfig();
  const amount = new BN(opts.amount);
  console.log(chalk.bold.cyan('Pegd burn request'));
  console.log(`  stable mint: ${opts.mint}`);
  console.log(`  amount:      ${amount.toString()}`);
  console.log(chalk.dim(`  cluster:     ${cfg.cluster}`));
  if (!cfg.programId) {
    console.log(chalk.yellow('Program id not configured -- burn transaction not submitted.'));
    return;
  }
  console.log(chalk.green('Burn transaction prepared.'));
}
