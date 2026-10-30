import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * Unit tests for the per-user AI request limit: 30 per hour (PRD NFR-7, risk R-13).
 * Each test uses a fresh user id, because the limiter keeps state in memory.
 */

describe('checkRateLimit', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows the first 30 requests in an hour', () => {
    const userId = randomUUID();

    const results = Array.from({ length: 30 }, () => checkRateLimit(userId));

    expect(results.every((result) => result === null)).toBe(true);
  });

  it('rejects the 31st request with 429 and a friendly message', async () => {
    const userId = randomUUID();
    for (let i = 0; i < 30; i++) checkRateLimit(userId);

    const limited = checkRateLimit(userId);

    expect(limited?.status).toBe(429);
    expect(await limited?.json()).toEqual({ error: 'Too many requests. Please try again later.' });
  });

  it('keeps each user’s limit separate', () => {
    const busyUser = randomUUID();
    for (let i = 0; i < 30; i++) checkRateLimit(busyUser);

    expect(checkRateLimit(randomUUID())).toBeNull();
  });

  it('allows requests again once the hour has passed', () => {
    vi.useFakeTimers();
    const userId = randomUUID();
    for (let i = 0; i < 30; i++) checkRateLimit(userId);

    vi.advanceTimersByTime(60 * 60 * 1000 + 1);

    expect(checkRateLimit(userId)).toBeNull();
  });
});
