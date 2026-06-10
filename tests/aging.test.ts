import { describe, it, expect } from 'vitest';
import { effectivePriority, compareJobs, SchedulableJob } from '../src/queues/comparator.js';

const now = 1_000_000_000_000;
const job = (id: string, priority: number, created: number): SchedulableJob => ({
  id,
  priority,
  scheduled_at: created,
  created_at: created,
});

describe('aging / starvation prevention', () => {
  it('keeps base priority when the job has not aged', () => {
    expect(effectivePriority(job('a', 3, now), now, 30)).toBe(3);
  });

  it('improves effective priority by one level per threshold of waiting', () => {
    // bump every 30s; a Low (3) job that waited 60s -> effective 1
    const created = now - 60_000;
    expect(effectivePriority(job('a', 3, created), now, 30)).toBe(1);
  });

  it('never improves past High (1)', () => {
    const created = now - 600_000; // 10 minutes
    expect(effectivePriority(job('a', 3, created), now, 30)).toBe(1);
  });

  it('lets a long-waiting Low job out-rank a fresh High job', () => {
    const agedLow = job('aged-low', 3, now - 120_000); // effective 1
    const freshHigh = job('fresh-high', 1, now);
    expect(compareJobs(agedLow, freshHigh, now)).toBeLessThan(0);
  });
});
