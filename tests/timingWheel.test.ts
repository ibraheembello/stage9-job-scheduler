import { describe, it, expect } from 'vitest';
import { TimingWheel } from '../src/queues/timingWheel.js';
import { SchedulableJob } from '../src/queues/comparator.js';

const now = 1_000_000_000_000;
const job = (id: string, dueInMs: number, priority = 2): SchedulableJob => ({
  id,
  priority,
  scheduled_at: now + dueInMs,
  created_at: now,
});

describe('TimingWheel', () => {
  it('does not dispatch a job before it is due', () => {
    const w = new TimingWheel(1000, 60, now);
    w.add(job('a', 5000), now);
    expect(w.advance(now + 2000)).toHaveLength(0);
  });

  it('dispatches a job once its due time passes', () => {
    const w = new TimingWheel(1000, 60, now);
    w.add(job('a', 3000), now);
    const due = w.advance(now + 4000);
    expect(due.map((j) => j.id)).toContain('a');
  });

  it('handles delays longer than one full rotation (rounds)', () => {
    const w = new TimingWheel(1000, 10, now); // 10s per rotation
    w.add(job('a', 25_000), now); // 2.5 rotations out
    expect(w.advance(now + 20_000)).toHaveLength(0);
    const due = w.advance(now + 26_000);
    expect(due.map((j) => j.id)).toContain('a');
  });

  it('returns due jobs ordered by the shared comparator', () => {
    const w = new TimingWheel(1000, 60, now);
    w.add(job('low', 1000, 3), now);
    w.add(job('high', 1000, 1), now);
    const due = w.advance(now + 2000);
    expect(due[0].id).toBe('high');
  });
});
