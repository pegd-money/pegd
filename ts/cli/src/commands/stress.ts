import chalk from 'chalk';
import BN from 'bn.js';
import { CollateralMode, calculateCollateralRatio } from '@pegd/issuance-core';
import { classifyRatio } from '@pegd/risk-module';

export interface StressOptions {
  mode: 'crypto' | 'attested' | 'rwa';
  collateral: string;
  issued: string;
  shock: string;
}

const MODE_MAP: Record<StressOptions['mode'], CollateralMode> = {
  crypto: CollateralMode.OvercollateralizedCrypto,
  attested: CollateralMode.AttestedFiat,
  rwa: CollateralMode.RwaBacked,
};

export async function stress(opts: StressOptions): Promise<void> {
  const mode = MODE_MAP[opts.mode];
  const collateral = new BN(opts.collateral);
  const issued = new BN(opts.issued);
  const shockPct = Number(opts.shock);
  const shocked = collateral.muln(Math.round((100 - shockPct) * 100)).divn(10_000);
  const preRatio = calculateCollateralRatio(collateral, issued);
  const postRatio = calculateCollateralRatio(shocked, issued);
  console.log(chalk.bold.cyan('Pegd peg stress simulation'));
  console.log(`  collateral mode: ${mode}`);
  console.log(`  shock:           -${shockPct}%`);
  console.log(`  pre  ratio:      ${preRatio}bps (${classifyRatio(preRatio)})`);
  console.log(`  post ratio:      ${postRatio}bps (${classifyRatio(postRatio)})`);
  if (postRatio < 11_000) {
    console.log(chalk.red('  circuit breaker WOULD TRIP under this shock.'));
  } else {
    console.log(chalk.green('  peg survives shock.'));
  }
}
