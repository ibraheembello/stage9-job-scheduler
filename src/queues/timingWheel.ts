import { SchedulableJob, compareJobs } from './comparator.js';

interface WheelEntry {
  job: SchedulableJob;
  /** full rotations remaining before this entry is due */
  rounds: number;
}

/**
 * Hashed Timing Wheel (REQUIRED alternative scheduling algorithm).
 *
 * A timing wheel is a circular array of `slots`, each representing one
 * `tickMs` window of time. A job due in `d` ms is placed in slot
 *   (currentSlot + ceil(d / tickMs)) % slots
 * with a `rounds` counter for delays longer than one full rotation.
 *
 * advance(now) moves the cursor forward by the number of elapsed ticks; any
 * entry in a visited slot whose `rounds` has reached 0 is "due" and returned.
 *
 * Cost model vs the heap:
 *   - insert: O(1)  (hash into a slot)            vs heap O(log n)
 *   - per-tick drain: O(jobs in that slot)        vs heap O(log n) per pop
 * The wheel wins on time-based scheduling at scale; the heap gives an exact
 * global priority ordering that the wheel only approximates per slot.
 */
export class TimingWheel {
  private readonly slots: WheelEntry[][];
  private readonly tickMs: number;
  private readonly slotCount: number;
  private cursor = 0;
  private lastAdvance: number;
  private count = 0;

  constructor(tickMs = 1000, slotCount = 60, startNow: number = Date.now()) {
    this.tickMs = tickMs;
    this.slotCount = slotCount;
    this.slots = Array.from({ length: slotCount }, () => []);
    this.lastAdvance = startNow;
  }

  size(): number {
    return this.count;
  }

  /** Schedule a job by its `scheduled_at` (epoch ms). */
  add(job: SchedulableJob, now: number = Date.now()): void {
    const delayMs = Math.max(0, job.scheduled_at - now);
    const ticks = Math.ceil(delayMs / this.tickMs);
    const slot = (this.cursor + ticks) % this.slotCount;
    const rounds = Math.floor(ticks / this.slotCount);
    this.slots[slot].push({ job, rounds });
    this.count++;
  }

  /**
   * Advance the wheel to `now`, returning every job that has become due,
   * sorted by the shared priority comparator so the caller drains the most
   * urgent first.
   */
  advance(now: number = Date.now()): SchedulableJob[] {
    const elapsedTicks = Math.floor((now - this.lastAdvance) / this.tickMs);
    const due: SchedulableJob[] = [];

    for (let t = 0; t < elapsedTicks; t++) {
      this.cursor = (this.cursor + 1) % this.slotCount;
      const bucket = this.slots[this.cursor];
      const remaining: WheelEntry[] = [];
      for (const entry of bucket) {
        if (entry.rounds <= 0) {
          due.push(entry.job);
          this.count--;
        } else {
          entry.rounds--;
          remaining.push(entry);
        }
      }
      this.slots[this.cursor] = remaining;
    }

    if (elapsedTicks > 0) {
      this.lastAdvance += elapsedTicks * this.tickMs;
    }
    due.sort((a, b) => compareJobs(a, b, now));
    return due;
  }
}
