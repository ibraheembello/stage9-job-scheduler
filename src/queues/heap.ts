import { SchedulableJob, compareJobs } from './comparator.js';

/**
 * Binary min-heap priority queue (REQUIRED component).
 *
 * The heap is stored as a flat array where, for a node at index i:
 *   - parent(i)      = (i - 1) >> 1
 *   - leftChild(i)   = 2i + 1
 *   - rightChild(i)  = 2i + 2
 *
 * Ordering is defined by `compareJobs`:
 *   priority -> scheduled time -> creation time (with aging applied).
 *
 * push():  append at the end, then siftUp — O(log n).
 * pop():   take root (the most urgent job), move last element to root,
 *          then siftDown — O(log n).
 *
 * Because aging makes the comparison time-dependent, we capture `now` once
 * per mutating operation and reuse it across the whole sift so a single
 * operation sees a consistent ordering.
 */
export class JobHeap {
  private heap: SchedulableJob[] = [];

  size(): number {
    return this.heap.length;
  }

  peek(): SchedulableJob | undefined {
    return this.heap[0];
  }

  push(job: SchedulableJob, now: number = Date.now()): void {
    this.heap.push(job);
    this.siftUp(this.heap.length - 1, now);
  }

  pop(now: number = Date.now()): SchedulableJob | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0, now);
    }
    return top;
  }

  /** Snapshot of contents in heap-array order (not fully sorted). */
  toArray(): SchedulableJob[] {
    return [...this.heap];
  }

  private siftUp(index: number, now: number): void {
    let i = index;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (compareJobs(this.heap[i], this.heap[parent], now) < 0) {
        this.swap(i, parent);
        i = parent;
      } else {
        break;
      }
    }
  }

  private siftDown(index: number, now: number): void {
    const n = this.heap.length;
    let i = index;
    while (true) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let smallest = i;
      if (left < n && compareJobs(this.heap[left], this.heap[smallest], now) < 0) {
        smallest = left;
      }
      if (right < n && compareJobs(this.heap[right], this.heap[smallest], now) < 0) {
        smallest = right;
      }
      if (smallest === i) break;
      this.swap(i, smallest);
      i = smallest;
    }
  }

  private swap(a: number, b: number): void {
    [this.heap[a], this.heap[b]] = [this.heap[b], this.heap[a]];
  }
}
