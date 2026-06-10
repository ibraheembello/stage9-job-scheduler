import { describe, it, expect } from 'vitest';
import { JobHeap } from '../src/queues/heap.js';
import { SchedulableJob } from '../src/queues/comparator.js';

const now = 1_000_000_000_000;
const job = (id: string, priority: number, scheduled = now, created = now): SchedulableJob => ({
  id,
  priority,
  scheduled_at: scheduled,
  created_at: created,
});

describe('JobHeap', () => {
  it('pops jobs in priority order (1 = High first)', () => {
    const h = new JobHeap();
    h.push(job('low', 3), now);
    h.push(job('high', 1), now);
    h.push(job('med', 2), now);
    expect(h.pop(now)?.id).toBe('high');
    expect(h.pop(now)?.id).toBe('med');
    expect(h.pop(now)?.id).toBe('low');
  });

  it('breaks priority ties by scheduled time, then creation time', () => {
    const h = new JobHeap();
    h.push(job('later', 1, now + 1000, now), now);
    h.push(job('earlier', 1, now, now + 5), now);
    h.push(job('earliest-created', 1, now, now), now);
    expect(h.pop(now)?.id).toBe('earliest-created');
    expect(h.pop(now)?.id).toBe('earlier');
    expect(h.pop(now)?.id).toBe('later');
  });

  it('maintains the heap property across many random pushes', () => {
    const h = new JobHeap();
    for (let i = 0; i < 500; i++) {
      h.push(job(`j${i}`, ((i * 13) % 3) + 1, now + (i % 50), now + i), now);
    }
    let prevPriority = 0;
    let count = 0;
    let last = h.pop(now);
    while (last) {
      expect(last.priority).toBeGreaterThanOrEqual(prevPriority);
      prevPriority = last.priority;
      count++;
      last = h.pop(now);
    }
    expect(count).toBe(500);
  });

  it('returns undefined when empty', () => {
    expect(new JobHeap().pop(now)).toBeUndefined();
  });
});
