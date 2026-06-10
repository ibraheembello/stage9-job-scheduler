import { query } from '../config/db.js';
import { Job } from '../models/job.model.js';
import { JobHeap } from '../queues/heap.js';
import { SchedulableJob } from '../queues/comparator.js';
import { logger } from '../utils/logger.js';
import { publish } from '../events/notify.js';

/**
 * Load the jobs that are *eligible* to run right now:
 *   - status = 'pending'
 *   - scheduled_at <= now            (scheduled jobs not yet due are excluded)
 *   - not cancel_requested
 *   - every dependency (DAG edge) has reached status 'completed'
 *
 * The DAG gate is the NOT EXISTS clause: a job is withheld while it has any
 * dependency that is not yet completed.
 */
async function loadEligible(limit = 200): Promise<Job[]> {
  const { rows } = await query<Job>(
    `SELECT j.*
       FROM jobs j
      WHERE j.status = 'pending'
        AND j.scheduled_at <= now()
        AND j.cancel_requested = false
        AND NOT EXISTS (
          SELECT 1
            FROM job_dependencies d
            JOIN jobs dep ON dep.id = d.depends_on_id
           WHERE d.job_id = j.id
             AND dep.status <> 'completed'
        )
      ORDER BY j.priority, j.scheduled_at, j.created_at
      LIMIT $1`,
    [limit],
  );
  return rows;
}

function toSchedulable(job: Job): SchedulableJob {
  return {
    id: job.id,
    priority: job.priority,
    scheduled_at: Date.parse(job.scheduled_at),
    created_at: Date.parse(job.created_at),
  };
}

/**
 * Claim the next job for a worker, using the HEAP to decide ordering.
 *
 * Flow:
 *   1. Load eligible jobs and push them into the binary heap. Scheduled jobs
 *      only reach here once due, satisfying "jobs enter the heap when due".
 *   2. Pop the most urgent job from the heap (priority -> scheduled -> created,
 *      with aging applied for starvation prevention).
 *   3. Atomically claim it: UPDATE ... WHERE id = $1 AND status = 'pending'.
 *      Postgres row-locks the update, so if two workers pop the same candidate
 *      only one UPDATE matches a still-'pending' row — the other gets 0 rows
 *      and pops the next candidate. This is the duplicate-protection guarantee,
 *      and it holds even with a single worker.
 *
 * Returns the claimed (now 'processing') job, or null if nothing could be
 * claimed this tick.
 */
export async function claimNext(workerId: string): Promise<Job | null> {
  const eligible = await loadEligible();
  if (eligible.length === 0) return null;

  const heap = new JobHeap();
  const now = Date.now();
  const byId = new Map<string, Job>();
  for (const job of eligible) {
    heap.push(toSchedulable(job), now);
    byId.set(job.id, job);
  }

  let candidate = heap.pop(now);
  while (candidate) {
    const claimed = await query<Job>(
      `UPDATE jobs
          SET status = 'processing',
              locked_by = $2,
              locked_at = now(),
              started_at = now(),
              updated_at = now()
        WHERE id = $1 AND status = 'pending'
        RETURNING *`,
      [candidate.id, workerId],
    );

    if (claimed.rowCount && claimed.rowCount > 0) {
      const job = claimed.rows[0];
      await logger.info('job.started', job.id, { worker: workerId, type: job.type });
      await publish({ event: 'job.started', jobId: job.id, status: 'processing' });
      return job;
    }
    // Lost the race (another worker claimed it) — try the next candidate.
    candidate = heap.pop(now);
  }

  return null;
}
