import { describe, it, expect } from 'vitest';
import { computeBackoffSeconds } from '../src/services/retry.service.js';

/**
 * Defaults: base=1, factor=5, jitter=0.2.
 * Expected centres: attempt 1 -> 1s, 2 -> 5s, 3 -> 25s, each +/-20%.
 */
describe('exponential backoff with jitter', () => {
  const cases: Array<[number, number]> = [
    [1, 1],
    [2, 5],
    [3, 25],
  ];

  for (const [attempt, centre] of cases) {
    it(`attempt ${attempt} stays within +/-20% of ${centre}s`, () => {
      for (let i = 0; i < 200; i++) {
        const d = computeBackoffSeconds(attempt);
        expect(d).toBeGreaterThanOrEqual(centre * 0.8 - 1e-9);
        expect(d).toBeLessThanOrEqual(centre * 1.2 + 1e-9);
      }
    });
  }

  it('grows geometrically on average', () => {
    expect(computeBackoffSeconds(3)).toBeGreaterThan(computeBackoffSeconds(1));
  });
});
