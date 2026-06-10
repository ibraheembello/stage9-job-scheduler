import { env } from '../config/env.js';

/**
 * Exponential backoff with jitter.
 *
 *   base * factor^(attempt - 1)   then +/- (jitter fraction)
 *
 * With defaults base=1s, factor=5, jitter=0.2:
 *   attempt 1 -> ~1s   (0.8s .. 1.2s)
 *   attempt 2 -> ~5s   (4s   .. 6s)
 *   attempt 3 -> ~25s  (20s  .. 30s)
 *
 * Jitter spreads retries so a batch of jobs that fail together do not all
 * retry at the exact same instant (the "thundering herd" problem).
 */
export function computeBackoffSeconds(attempt: number): number {
  const base = env.retry.backoffBaseSeconds;
  const factor = env.retry.backoffFactor;
  const jitter = env.retry.jitter;

  const raw = base * Math.pow(factor, Math.max(0, attempt - 1));
  const delta = raw * jitter * (Math.random() * 2 - 1);
  return Math.max(0, raw + delta);
}

export function nextScheduledAt(attempt: number, from: Date = new Date()): Date {
  const seconds = computeBackoffSeconds(attempt);
  return new Date(from.getTime() + seconds * 1000);
}
