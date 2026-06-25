const SECONDS_PER_YEAR = 31_557_600;
const BPS_DENOMINATOR = 10_000;

export interface AccrualState {
  initializationTimestamp: number;
  lastUpdateTimestamp: number;
  preUpdateAverageRateBps: number;
  currentRateBps: number;
}

export function totalScale(state: AccrualState, atTimestamp: number): number {
  const preElapsed = state.lastUpdateTimestamp - state.initializationTimestamp;
  const postElapsed = Math.max(0, atTimestamp - state.lastUpdateTimestamp);

  const preExponent =
    (state.preUpdateAverageRateBps * preElapsed) / (BPS_DENOMINATOR * SECONDS_PER_YEAR);
  const postExponent =
    (state.currentRateBps * postElapsed) / (BPS_DENOMINATOR * SECONDS_PER_YEAR);

  return Math.exp(preExponent) * Math.exp(postExponent);
}

export function amountToUiAmount(
  amountRaw: bigint,
  decimals: number,
  state: AccrualState,
  atTimestamp: number,
): number {
  const scale = totalScale(state, atTimestamp);
  const raw = Number(amountRaw) / 10 ** decimals;
  return raw * scale;
}

export function uiAmountToAmount(
  uiAmount: number,
  decimals: number,
  state: AccrualState,
  atTimestamp: number,
): bigint {
  const scale = totalScale(state, atTimestamp);
  const raw = (uiAmount / scale) * 10 ** decimals;
  return BigInt(Math.floor(raw));
}
