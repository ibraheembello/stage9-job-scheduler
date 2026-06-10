import { env } from '../config/env.js';

/** Minimal shape the schedulers need to order a job. */
export interface SchedulableJob {
  id: string;
  /** base priority: 1 = High, 2 = Medium, 3 = Low */
  priority: number;
  /** epoch ms when the job becomes eligible */
  scheduled_at: number;
  /** epoch ms when the job row was created */
  created_at: number;
}

/**
 * Starvation prevention (aging).
 *
 * A job's *effective* priority improves by one level for every
 * AGING_BUMP_SECONDS it has waited since creation. So a Low job (3) that has
 * waited 2 * threshold becomes effectively High (1) and stops being starved
 * by a steady stream of fresh High jobs. Clamped so it never goes below 1.
 */
export function effectivePriority(
  job: SchedulableJob,
  nowMs: number,
  agingBumpSeconds = env.aging.bumpSeconds,
): number {
  const waitSeconds = Math.max(0, (nowMs - job.created_at) / 1000);
  const bumps = Math.floor(waitSeconds / agingBumpSeconds);
  return Math.max(1, job.priority - bumps);
}

/**
 * Total ordering used by both the heap and the timing wheel:
 *   1. effective priority (lower number = higher priority, runs first)
 *   2. scheduled time (earlier first)
 *   3. creation time (earlier first — FIFO tie-break)
 *
 * Returns a negative number when `a` should run before `b`.
 */
export function compareJobs(
  a: SchedulableJob,
  b: SchedulableJob,
  nowMs: number,
): number {
  const pa = effectivePriority(a, nowMs);
  const pb = effectivePriority(b, nowMs);
  if (pa !== pb) return pa - pb;
  if (a.scheduled_at !== b.scheduled_at) return a.scheduled_at - b.scheduled_at;
  return a.created_at - b.created_at;
}
