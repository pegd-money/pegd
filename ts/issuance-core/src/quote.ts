import BN from 'bn.js';
import { CollateralMode } from './modes.js';
import { calculateCollateralRatio, quoteIssuance, QuoteResponse } from './vault.js';

export { quoteIssuance, calculateCollateralRatio };
export type { QuoteResponse };

export interface BurnQuoteRequest {
  mode: CollateralMode;
  collateralValueUsd: BN;
  issuedSupplyUsd: BN;
  burnAmountUsd: BN;
}

export interface BurnQuoteResponse {
  canBurn: boolean;
  releasedCollateralUsd: BN;
  postBurnRatioBps: number;
}

export function quoteBurn(req: BurnQuoteRequest): BurnQuoteResponse {
  if (req.burnAmountUsd.gt(req.issuedSupplyUsd)) {
    return {
      canBurn: false,
      releasedCollateralUsd: new BN(0),
      postBurnRatioBps: calculateCollateralRatio(req.collateralValueUsd, req.issuedSupplyUsd),
    };
  }
  const remainingSupply = req.issuedSupplyUsd.sub(req.burnAmountUsd);
  const releasedCollateralUsd = req.issuedSupplyUsd.isZero()
    ? new BN(0)
    : req.collateralValueUsd.mul(req.burnAmountUsd).div(req.issuedSupplyUsd);
  const postCollateral = req.collateralValueUsd.sub(releasedCollateralUsd);
  return {
    canBurn: true,
    releasedCollateralUsd,
    postBurnRatioBps: calculateCollateralRatio(postCollateral, remainingSupply),
  };
}
