import { CIRCUIT_BREAKER_BPS, classifyRatio, RatioZone } from './thresholds.js';

export interface CircuitBreakerState {
  tripped: boolean;
  trippedAt: number | null;
  reason: string | null;
  observedRatioBps: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = {
    tripped: false,
    trippedAt: null,
    reason: null,
    observedRatioBps: 0,
  };

  constructor(private readonly thresholdBps: number = CIRCUIT_BREAKER_BPS) {}

  checkRatio(ratioBps: number, nowSec: number): CircuitBreakerState {
    this.state.observedRatioBps = ratioBps;
    if (!this.state.tripped && ratioBps < this.thresholdBps) {
      this.trip(`Ratio ${ratioBps}bps fell below breaker ${this.thresholdBps}bps`, nowSec);
    }
    return { ...this.state };
  }

  trip(reason: string, nowSec: number): void {
    this.state.tripped = true;
    this.state.trippedAt = nowSec;
    this.state.reason = reason;
  }

  reset(nowSec: number): void {
    if (this.state.observedRatioBps < this.thresholdBps) {
      throw new Error(
        `Cannot reset breaker while ratio ${this.state.observedRatioBps}bps still below ${this.thresholdBps}`,
      );
    }
    this.state.tripped = false;
    this.state.trippedAt = null;
    this.state.reason = `Reset at ${nowSec}`;
  }

  snapshot(): CircuitBreakerState {
    return { ...this.state };
  }

  static zoneFor(ratioBps: number): RatioZone {
    return classifyRatio(ratioBps);
  }
}
