export enum CollateralMode {
  OvercollateralizedCrypto = 'OVERCOLLATERALIZED_CRYPTO',
  AttestedFiat = 'ATTESTED_FIAT',
  RwaBacked = 'RWA_BACKED',
}

export const MIN_COLLATERAL_RATIO_BPS: Record<CollateralMode, number> = {
  [CollateralMode.OvercollateralizedCrypto]: 15000,
  [CollateralMode.AttestedFiat]: 10100,
  [CollateralMode.RwaBacked]: 10500,
};

export const MODE_LABELS: Record<CollateralMode, string> = {
  [CollateralMode.OvercollateralizedCrypto]: 'Crypto Overcollateralized',
  [CollateralMode.AttestedFiat]: 'Attested Fiat Reserves',
  [CollateralMode.RwaBacked]: 'RWA Backed',
};

export function requiredMinRatioBps(mode: CollateralMode): number {
  return MIN_COLLATERAL_RATIO_BPS[mode];
}
