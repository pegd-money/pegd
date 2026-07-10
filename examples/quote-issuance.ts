import BN from 'bn.js';
import { quoteIssuance, CollateralMode } from '@pegd/issuance-core';

// Quote a 1,000,000 USD issuance backed by 1,500,000 USD of crypto collateral.
// The crypto-overcollateralized mode carries a 15000 bps minimum ratio, so this
// request sits exactly at the floor and clears with no spare headroom.
const collateralValueUsd = new BN(1_500_000);
const targetIssuanceUsd = new BN(1_000_000);

const quote = quoteIssuance({
  mode: CollateralMode.OvercollateralizedCrypto,
  collateralValueUsd,
  targetIssuanceUsd,
});

console.log('mode:', CollateralMode.OvercollateralizedCrypto);
console.log('collateral (USD):', collateralValueUsd.toString());
console.log('target issuance (USD):', targetIssuanceUsd.toString());
console.log('can issue:', quote.canIssue);
console.log('ratio (bps):', quote.ratioBps);
console.log('max issuance (USD):', quote.maxIssuanceUsd.toString());
console.log('headroom (USD):', quote.headroomUsd.toString());

if (!quote.canIssue) {
  console.error('requested issuance would breach the minimum ratio');
  process.exit(1);
}
