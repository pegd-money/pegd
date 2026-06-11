import BN from 'bn.js';
import { CollateralMode, MIN_COLLATERAL_RATIO_BPS } from './modes.js';

export interface QuoteRequest {
  mode: CollateralMode;
  collateralValueUsd: BN;
  targetIssuanceUsd: BN;
}

export interface QuoteResponse {
  canIssue: boolean;
  ratioBps: number;
  maxIssuanceUsd: BN;
  headroomUsd: BN;
}

const BPS_DENOMINATOR = new BN(10000);

export function quoteIssuance(req: QuoteRequest): QuoteResponse {
  const minBps = MIN_COLLATERAL_RATIO_BPS[req.mode];
  const minBpsBn = new BN(minBps);

  const maxIssuanceUsd = req.collateralValueUsd
    .mul(BPS_DENOMINATOR)
    .div(minBpsBn);

  const ratioBps = req.targetIssuanceUsd.isZero()
    ? 0
    : req.collateralValueUsd
        .mul(BPS_DENOMINATOR)
        .div(req.targetIssuanceUsd)
        .toNumber();

  const canIssue = req.targetIssuanceUsd.lte(maxIssuanceUsd);
  const headroomUsd = canIssue
    ? maxIssuanceUsd.sub(req.targetIssuanceUsd)
    : new BN(0);

  return { canIssue, ratioBps, maxIssuanceUsd, headroomUsd };
}

export function calculateCollateralRatio(collateralUsd: BN, issuedUsd: BN): number {
  if (issuedUsd.isZero()) return 0;
  return collateralUsd.mul(BPS_DENOMINATOR).div(issuedUsd).toNumber();
}

export function requiredCollateralForIssuance(
  mode: CollateralMode,
  issuanceUsd: BN,
): BN {
  const minBpsBn = new BN(MIN_COLLATERAL_RATIO_BPS[mode]);
  return issuanceUsd.mul(minBpsBn).div(BPS_DENOMINATOR);
}
