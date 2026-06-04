export const MIN_RATIO_BPS = 15_000;
export const LIQUIDATION_BPS = 12_500;
export const CIRCUIT_BREAKER_BPS = 11_000;
export const HARD_FLOOR_BPS = 10_000;

export enum RatioZone {
  Healthy = 'HEALTHY',
  Warning = 'WARNING',
  Liquidation = 'LIQUIDATION',
  CircuitTripped = 'CIRCUIT_TRIPPED',
  UnderPeg = 'UNDER_PEG',
}

export function classifyRatio(ratioBps: number): RatioZone {
  if (ratioBps < HARD_FLOOR_BPS) return RatioZone.UnderPeg;
  if (ratioBps < CIRCUIT_BREAKER_BPS) return RatioZone.CircuitTripped;
  if (ratioBps < LIQUIDATION_BPS) return RatioZone.Liquidation;
  if (ratioBps < MIN_RATIO_BPS) return RatioZone.Warning;
  return RatioZone.Healthy;
}
