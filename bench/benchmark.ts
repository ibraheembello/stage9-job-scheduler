import { JobHeap } from '../src/queues/heap.js';
import { TimingWheel } from '../src/queues/timingWheel.js';
import { SchedulableJob } from '../src/queues/comparator.js';

/**
 * Benchmark: binary heap vs hashed timing wheel.
 *
 * Workload: N jobs with random priorities and due times spread over a window.
 *   - Heap:        push all N, then pop all N (full priority-ordered drain).
 *   - TimingWheel: add all N, then advance the wheel past the window to drain.
 *
 * We report total wall-clock and throughput (ops/sec) for insert and drain.
 */

const N = Number(process.argv[2] ?? 100_000);
const WINDOW_MS = 60_000;
const now = Date.now();

function makeJobs(): SchedulableJob[] {
  const jobs: SchedulableJob[] = [];
  for (let i = 0; i < N; i++) {
    // Deterministic-ish spread without Math.random dependency on order.
    const due = now + ((i * 7) % WINDOW_MS);
    jobs.push({
      id: String(i),
      priority: ((i % 3) + 1) as number,
      scheduled_at: due,
      created_at: now,
    });
  }
  return jobs;
}

function bench(label: string, fn: () => void): number {
  const start = process.hrtime.bigint();
  fn();
  const end = process.hrtime.bigint();
  const ms = Number(end - start) / 1e6;
  const opsPerSec = Math.round((N / ms) * 1000);
  console.log(
    `${label.padEnd(28)} ${ms.toFixed(2).padStart(10)} ms   ${opsPerSec
      .toLocaleString()
      .padStart(14)} ops/sec`,
  );
  return ms;
}

console.log(`\nBenchmark: N = ${N.toLocaleString()} jobs\n${'='.repeat(60)}`);

// ---- Heap ----
const heapJobs = makeJobs();
const heap = new JobHeap();
const heapInsert = bench('Heap   insert', () => {
  for (const j of heapJobs) heap.push(j, now);
});
const heapDrain = bench('Heap   drain (pop all)', () => {
  while (heap.size() > 0) heap.pop(now);
});

// ---- Timing wheel ----
const wheelJobs = makeJobs();
const wheel = new TimingWheel(1000, 64, now);
const wheelInsert = bench('Wheel  insert', () => {
  for (const j of wheelJobs) wheel.add(j, now);
});
const wheelDrain = bench('Wheel  drain (advance)', () => {
  // Advance past the whole window so every slot is visited.
  wheel.advance(now + WINDOW_MS + 2000);
});

console.log('='.repeat(60));
console.log(
  `Insert: timing wheel is ${(heapInsert / wheelInsert).toFixed(2)}x faster than the heap`,
);
console.log(
  `Drain:  timing wheel is ${(heapDrain / wheelDrain).toFixed(2)}x faster than the heap`,
);
console.log(
  '\nTradeoff: the heap yields an exact global priority order on every pop\n' +
    '(O(log n)); the timing wheel dispatches by time bucket in O(1) insert and\n' +
    'amortised O(1) per tick, but only orders within a slot — ideal for large\n' +
    'volumes of time-scheduled jobs where coarse priority ordering is acceptable.\n',
);
