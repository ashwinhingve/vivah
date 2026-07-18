/**
 * Smart Shaadi — Circuit Breaker for External Dependencies
 *
 * Implements the circuit breaker pattern (closed → open → half-open → closed)
 * to gracefully degrade when outbound services (Razorpay, MSG91, Daily.co) fail.
 *
 * State machine:
 *  - CLOSED (default): all requests pass through; failures counted.
 *  - OPEN (after threshold): requests fast-fail immediately; after cooldown → HALF_OPEN.
 *  - HALF_OPEN (probe phase): allow a limited number of requests to test recovery.
 *    Success → CLOSED; failure → OPEN (reset cooldown).
 *
 * Completely disabled (no-op) when USE_MOCK_SERVICES=true, so dev/test is unaffected.
 * Breaker state is exposed as a gauge in /metrics for monitoring.
 */

import { env } from './env.js';

/**
 * Configuration per service. Tuned to catch cascading failures without
 * over-triggering on temporary blips.
 */
export interface CircuitBreakerConfig {
  /** How many consecutive failures before opening the circuit. */
  failureThreshold: number;
  /** How long (ms) to wait in OPEN state before attempting HALF_OPEN. */
  cooldownMs: number;
  /**
   * How many consecutive successes in HALF_OPEN are required to close the circuit.
   *
   * Note this does NOT cap how many requests are admitted while HALF_OPEN — a burst
   * of concurrent callers can all probe at once. The first failure reopens the
   * circuit, so the blast radius is bounded by in-flight concurrency rather than by
   * this number. Tighten to a true admission gate if that ever proves too permissive.
   */
  halfOpenRequests: number;
  /** Service name (for logging + metrics). */
  name: string;
}

export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

export class CircuitBreaker {
  private state = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Wrap an async function call. If the breaker is open, throws immediately.
   * Otherwise calls the function and updates breaker state based on success/failure.
   *
   * When USE_MOCK_SERVICES=true, this is a complete no-op — always succeeds.
   */
  async call<T>(fn: () => Promise<T>): Promise<T> {
    // No-op when mock services are enabled — let all calls through unmodified.
    if (env.USE_MOCK_SERVICES) {
      return fn();
    }

    if (this.state === CircuitBreakerState.OPEN) {
      const now = Date.now();
      const timeSinceLastFailure = now - this.lastFailureTime;

      if (timeSinceLastFailure >= this.config.cooldownMs) {
        // Transition to HALF_OPEN: try again
        this.state = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
        console.info(
          `[circuit-breaker:${this.config.name}] cooldown expired, entering HALF_OPEN`,
        );
      } else {
        // Still in cooldown — fast-fail
        throw new CircuitBreakerOpenError(
          `${this.config.name} circuit breaker is OPEN (will retry in ${Math.ceil((this.config.cooldownMs - timeSinceLastFailure) / 1000)}s)`,
        );
      }
    }

    try {
      const result = await fn();

      // Call succeeded
      if (this.state === CircuitBreakerState.HALF_OPEN) {
        this.successCount += 1;
        if (this.successCount >= this.config.halfOpenRequests) {
          // Recovered — back to CLOSED
          this.state = CircuitBreakerState.CLOSED;
          this.failureCount = 0;
          console.info(`[circuit-breaker:${this.config.name}] recovered, entering CLOSED`);
        }
      } else if (this.state === CircuitBreakerState.CLOSED) {
        this.failureCount = 0;
      }

      return result;
    } catch (err) {
      // Call failed
      this.lastFailureTime = Date.now();

      if (this.state === CircuitBreakerState.HALF_OPEN) {
        // Failure in HALF_OPEN → reopen and wait
        this.state = CircuitBreakerState.OPEN;
        console.warn(
          `[circuit-breaker:${this.config.name}] failure in HALF_OPEN, reopening circuit`,
        );
      } else if (this.state === CircuitBreakerState.CLOSED) {
        this.failureCount += 1;
        if (this.failureCount >= this.config.failureThreshold) {
          this.state = CircuitBreakerState.OPEN;
          console.warn(
            `[circuit-breaker:${this.config.name}] failure threshold reached (${this.failureCount}/${this.config.failureThreshold}), opening circuit`,
          );
        }
      }

      throw err;
    }
  }

  /** Reset the breaker to CLOSED state (for testing or manual recovery). */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

export class CircuitBreakerOpenError extends Error {
  override name = 'CircuitBreakerOpenError';
  constructor(message: string) {
    super(message);
  }
}

/**
 * Global breaker instances, one per external service.
 * Tuning notes:
 *  - Razorpay: 5 failures (quick reaction to API degradation) + 30s cooldown
 *  - MSG91: 3 failures (SMS is retry-heavy, fail fast) + 20s cooldown
 *  - Daily.co: 4 failures (video is real-time, moderate threshold) + 25s cooldown
 */
export const razorpayBreaker = new CircuitBreaker({
  name: 'razorpay',
  failureThreshold: 5,
  cooldownMs: 30_000,
  halfOpenRequests: 3,
});

export const msg91Breaker = new CircuitBreaker({
  name: 'msg91',
  failureThreshold: 3,
  cooldownMs: 20_000,
  halfOpenRequests: 2,
});

export const dailycoBreaker = new CircuitBreaker({
  name: 'daily.co',
  failureThreshold: 4,
  cooldownMs: 25_000,
  halfOpenRequests: 2,
});

/**
 * Get current state of all breakers for metrics/monitoring.
 * Returns a map of breaker name → numeric state (0=closed, 1=half-open, 2=open).
 */
export function getAllBreakerStates(): Record<string, number> {
  return {
    razorpay: stateToNumber(razorpayBreaker.getState()),
    msg91: stateToNumber(msg91Breaker.getState()),
    dailyco: stateToNumber(dailycoBreaker.getState()),
  };
}

function stateToNumber(state: CircuitBreakerState): number {
  switch (state) {
    case CircuitBreakerState.CLOSED:
      return 0;
    case CircuitBreakerState.HALF_OPEN:
      return 1;
    case CircuitBreakerState.OPEN:
      return 2;
  }
}
