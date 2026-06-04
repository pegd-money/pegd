import BN from 'bn.js';
import { LIQUIDATION_BPS, MIN_RATIO_BPS } from './thresholds.js';

const BPS = new BN(10_000);
const MIN = new BN(MIN_RATIO_BPS);

export interface LiquidationInput {
  collateralValueUsd: BN;
  issuedSupplyUsd: BN;
  ratioBps: number;
}

export interface LiquidationPlan {
  shouldLiquidate: boolean;
  liquidateUsd: BN;
  targetRatioBps: number;
  postLiquidationRatioBps: number;
}

export function planPartialLiquidation(input: LiquidationInput): LiquidationPlan {
  if (input.ratioBps >= LIQUIDATION_BPS) {
    return {
      shouldLiquidate: false,
      liquidateUsd: new BN(0),
      targetRatioBps: input.ratioBps,
      postLiquidationRatioBps: input.ratioBps,
    };
  }

  const targetCollateralNeeded = input.issuedSupplyUsd.mul(MIN).div(BPS);
  const deficitUsd = targetCollateralNeeded.sub(input.collateralValueUsd);
  const liquidateUsd = BN.min(deficitUsd, input.issuedSupplyUsd);

  const postSupply = input.issuedSupplyUsd.sub(liquidateUsd);
  const postRatioBps = postSupply.isZero()
    ? 0
    : input.collateralValueUsd.mul(BPS).div(postSupply).toNumber();

  return {
    shouldLiquidate: true,
    liquidateUsd,
    targetRatioBps: MIN_RATIO_BPS,
    postLiquidationRatioBps: postRatioBps,
  };
}

export class LiquidationQueue {
  private items: LiquidationInput[] = [];

  enqueue(input: LiquidationInput): void {
    this.items.push(input);
    this.items.sort((a, b) => a.ratioBps - b.ratioBps);
  }

  next(): LiquidationPlan | null {
    const head = this.items.shift();
    if (!head) return null;
    return planPartialLiquidation(head);
  }

  size(): number {
    return this.items.length;
  }
}
