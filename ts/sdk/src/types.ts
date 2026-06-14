import { PublicKey } from '@solana/web3.js';
import { CollateralMode } from '@pegd/issuance-core';

export interface PegdIssuerConfig {
  programId: PublicKey;
  cluster: 'mainnet-beta' | 'devnet' | 'localnet';
}

export interface RegisterStableParams {
  name: string;
  symbol: string;
  pegCurrency: string;
  collateralMode: CollateralMode;
  minRatioBps: number;
  yieldRateBps: number;
  enableComplianceHook: boolean;
}

export interface ReserveSnapshot {
  stableMint: PublicKey;
  totalSupplyRaw: bigint;
  reserveValueUsdE6: bigint;
  ratioBps: number;
  updatedSlot: number;
}

export interface StableRegistryEntry {
  mint: PublicKey;
  issuer: PublicKey;
  pegCurrency: string;
  collateralMode: CollateralMode;
  yieldRateBps: number;
  hasComplianceHook: boolean;
}
