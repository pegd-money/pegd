import chalk from 'chalk';
import BN from 'bn.js';
import { CollateralMode, requiredCollateralForIssuance } from '@pegd/issuance-core';
import { loadConfig } from '../config.js';

export interface IssueOptions {
  peg: string;
  collateral: 'crypto' | 'attested' | 'rwa';
  target?: string;
  yieldBps?: string;
  compliance?: boolean;
}

const MODE_MAP: Record<IssueOptions['collateral'], CollateralMode> = {
  crypto: CollateralMode.OvercollateralizedCrypto,
  attested: CollateralMode.AttestedFiat,
  rwa: CollateralMode.RwaBacked,
};

export async function issue(name: string, opts: IssueOptions): Promise<void> {
  const cfg = loadConfig();
  const mode = MODE_MAP[opts.collateral];
  const targetUsd = new BN(opts.target ?? '1000');
  const requiredCollateral = requiredCollateralForIssuance(mode, targetUsd);
  console.log(chalk.bold.cyan(`Pegd issuance plan for ${name}`));
  console.log(`  peg currency:        ${opts.peg}`);
  console.log(`  collateral mode:     ${mode}`);
  console.log(`  target issuance:     ${targetUsd.toString()} USD`);
  console.log(`  required collateral: ${requiredCollateral.toString()} USD`);
  console.log(`  yield (bps):         ${opts.yieldBps ?? '0'}`);
  console.log(`  compliance hook:     ${opts.compliance ? 'enabled' : 'off'}`);
  console.log(chalk.dim(`  cluster:             ${cfg.cluster}`));
  console.log(chalk.dim(`  program id:          ${cfg.programId ?? '(unregistered)'}`));
  if (!cfg.programId) {
    console.log(chalk.yellow('Program id not configured. Run `pegd config set --program-id <id>` first.'));
  }
}
