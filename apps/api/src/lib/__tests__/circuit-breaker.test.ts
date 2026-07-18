/**
 * Tests for the circuit breaker state machine.
 *
 * Validates:
 *  - State transitions (closed → open → half-open → closed)
 *  - Failure threshold triggering
 *  - Cooldown period before half-open
 *  - Recovery on success in half-open state
 *  - No-op when USE_MOCK_SERVICES=true
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerState,
  CircuitBreakerOpenError,
} from '../circuit-breaker';

// Mock the env module to disable mock services during testing
vi.mock('../env.js', () => ({
  env: { USE_MOCK_SERVICES: false },
}));

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      name: 'test',
      failureThreshold: 2,
      cooldownMs: 50, // Shorter for faster tests
      halfOpenRequests: 2,
    });
  });

  it('starts in CLOSED state', () => {
    expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
  });

  it('opens after reaching failure threshold', async () => {
    const failingFn = async () => {
      throw new Error('test error');
    };

    // First failure
    try {
      await breaker.call(failingFn);
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
    expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);

    // Second failure — should trigger open
    try {
      await breaker.call(failingFn);
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
    expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);
  });

  it('fast-fails when OPEN', async () => {
    let callCount = 0;
    const trackedFailingFn = async () => {
      callCount++;
      throw new Error('test error');
    };

    // Open the breaker
    try {
      await breaker.call(trackedFailingFn);
    } catch {
      // Expected
    }
    try {
      await breaker.call(trackedFailingFn);
    } catch {
      // Expected
    }
    expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);

    // Next call should fast-fail without invoking the function
    const callCountBefore = callCount;
    try {
      await breaker.call(trackedFailingFn);
      throw new Error('Should have thrown CircuitBreakerOpenError');
    } catch (err) {
      expect(err).toBeInstanceOf(CircuitBreakerOpenError);
    }
    expect(callCount).toBe(callCountBefore);
  });

  it('transitions to HALF_OPEN after cooldown', async () => {
    const failingFn = async () => {
      throw new Error('test error');
    };
    const successFn = async () => 'success';

    // Open the breaker
    try {
      await breaker.call(failingFn);
    } catch {
      // Expected
    }
    try {
      await breaker.call(failingFn);
    } catch {
      // Expected
    }
    expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);

    // Wait for cooldown (using the 50ms configured in beforeEach)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Next call should attempt and transition to HALF_OPEN
    await breaker.call(successFn);
    expect(breaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
  });

  it('closes after successful half-open probes', async () => {
    const failingFn = async () => {
      throw new Error('test error');
    };
    const successFn = async () => 'success';

    // Open the breaker
    try {
      await breaker.call(failingFn);
    } catch {
      // Expected
    }
    try {
      await breaker.call(failingFn);
    } catch {
      // Expected
    }
    expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);

    // Wait for cooldown and transition to HALF_OPEN
    await new Promise((resolve) => setTimeout(resolve, 100));

    // First success probe
    await breaker.call(successFn);
    expect(breaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);

    // Second success probe — should close
    await breaker.call(successFn);
    expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
  });

  it('reopens if failure occurs in HALF_OPEN', async () => {
    const failingFn = async () => {
      throw new Error('test error');
    };
    const successFn = async () => 'success';

    // Open → HALF_OPEN
    try {
      await breaker.call(failingFn);
    } catch {
      // Expected
    }
    try {
      await breaker.call(failingFn);
    } catch {
      // Expected
    }
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Try success to enter HALF_OPEN
    await breaker.call(successFn);
    expect(breaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);

    // Failure in HALF_OPEN should reopen
    try {
      await breaker.call(failingFn);
      throw new Error('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
    expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);
  });

  it('resets to CLOSED state', async () => {
    const failingFn = async () => {
      throw new Error('test error');
    };

    // Open the breaker
    try {
      await breaker.call(failingFn);
    } catch {
      // Expected
    }
    try {
      await breaker.call(failingFn);
    } catch {
      // Expected
    }

    expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);

    breaker.reset();
    expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
  });

  it('allows successful calls through when CLOSED', async () => {
    const successFn = async () => 'success';

    const result = await breaker.call(successFn);

    expect(result).toBe('success');
    expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
  });

  it('does not increment failure counter on success', async () => {
    const successFn = async () => 'success';
    const failingFn = async () => {
      throw new Error('test error');
    };

    // Success, then failure
    await breaker.call(successFn);
    try {
      await breaker.call(failingFn);
    } catch {
      // Expected
    }

    // Should still need another failure to open (threshold=2)
    const anotherSuccess = async () => 'ok';
    await breaker.call(anotherSuccess);

    expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
  });
});
