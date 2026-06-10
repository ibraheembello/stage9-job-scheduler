import { withTransaction, query } from '../config/db.js';
import {
  CreateJobInput,
  Job,
  JobStatus,
  Priority,
  RecurringInterval,
  RECURRING_INTERVAL_MS,
} from '../models/job.model.js';
import { logger } from '../utils/logger.js';
import { publish } from '../events/notify.js';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const VALID_INTERVALS = Object.keys(RECURRING_INTERVAL_MS) as RecurringInterval[];

/** Validate and normalise raw request input into a CreateJobInput. */
function validate(input: CreateJobInput): Required<Omit<CreateJobInput, 'depends_on'>> & {
  depends_on: string[];
} {
  if (!input || typeof input.type !== 'string' || input.type.trim() === '') {
    throw new ValidationError('`type` is required and must be a non-empty string');
  }

  const priority = (input.priority ?? 2) as Priority;
  if (![1, 2, 3].includes(priority)) {
    throw new ValidationError('`priority` must be 1 (High), 2 (Medium), or 3 (Low)');
  }

  const payload = input.payload ?? {};
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ValidationError('`payload` must be an object');
  }

  let scheduled_at = new Date().toISOString();
  if (input.scheduled_at !== undefined) {
    const d = new Date(input.scheduled_at);
    if (Number.isNaN(d.getTime())) {
      throw new ValidationError('`scheduled_at` must be a valid ISO date string');
    }
    scheduled_at = d.toISOString();
  }

  let recurring_interval: RecurringInterval | null = null;
  if (input.recurring_interval !== undefined && input.recurring_interval !== null) {
    if (!VALID_INTERVALS.includes(input.recurring_interval)) {
      throw new ValidationError(
        `\`recurring_interval\` must be one of: ${VALID_INTERVALS.join(', ')}`,
      );
    }
    recurring_interval = input.recurring_interval;
  }

  const depends_on = input.depends_on ?? [];
  if (!Array.isArray(depends_on)) {
    throw new ValidationError('`depends_on` must be an array of job IDs');
  }

  return { type: input.type.trim(), payload, priority, scheduled_at, recurring_interval, depends_on };
}

export async function createJob(input: CreateJobInput): Promise<Job> {
  const v = validate(input);

  const job = await withTransaction(async (client) => {
    const { rows } = await client.query<Job>(
      `INSERT INTO jobs (type, payload, priority, scheduled_at, recurring_interval)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [v.type, JSON.stringify(v.payload), v.priority, v.scheduled_at, v.recurring_interval],
    );
    const created = rows[0];

    for (const depId of v.depends_on) {
      const dep = await client.query('SELECT 1 FROM jobs WHERE id = $1', [depId]);
      if (dep.rowCount === 0) {
        throw new ValidationError(`dependency job ${depId} does not exist`);
      }
      await client.query(
        `INSERT INTO job_dependencies (job_id, depends_on_id) VALUES ($1, $2)`,
        [created.id, depId],
      );
    }
    return created;
  });

  await logger.info('job.created', job.id, {
    type: job.type,
    priority: job.priority,
    scheduled_at: job.scheduled_at,
    recurring_interval: job.recurring_interval,
    depends_on: v.depends_on,
  });
  await publish({ event: 'job.created', jobId: job.id, status: job.status });
  return job;
}

export async function listJobs(): Promise<Job[]> {
  const { rows } = await query<Job>(`SELECT * FROM jobs ORDER BY created_at DESC`);
  return rows;
}

export async function getJob(id: string): Promise<Job | null> {
  const { rows } = await query<Job>(`SELECT * FROM jobs WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getCounts(): Promise<Record<JobStatus, number>> {
  const { rows } = await query<{ status: JobStatus; count: string }>(
    `SELECT status, count(*)::int AS count FROM jobs GROUP BY status`,
  );
  const counts: Record<JobStatus, number> = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  };
  for (const r of rows) counts[r.status] = Number(r.count);
  return counts;
}

/**
 * Cancellation.
 *
 * - pending   -> immediately set to `cancelled`; it will never be processed.
 * - processing-> we DO NOT kill the in-flight run (that risks partial side
 *                effects). Instead we set `cancel_requested = true`. The worker
 *                checks this flag after the handler finishes and will neither
 *                retry nor reschedule a recurrence; the job ends as `cancelled`.
 * - terminal  -> rejected (already completed/failed/cancelled).
 */
export async function cancelJob(id: string): Promise<{ job: Job; note: string }> {
  const existing = await getJob(id);
  if (!existing) throw new ValidationError(`job ${id} not found`);

  if (existing.status === 'pending') {
    const { rows } = await query<Job>(
      `UPDATE jobs SET status = 'cancelled', updated_at = now() WHERE id = $1 RETURNING *`,
      [id],
    );
    await logger.info('job.cancelled', id, { from: 'pending' });
    await publish({ event: 'job.cancelled', jobId: id, status: 'cancelled' });
    return { job: rows[0], note: 'Job was pending and is now cancelled.' };
  }

  if (existing.status === 'processing') {
    const { rows } = await query<Job>(
      `UPDATE jobs SET cancel_requested = true, updated_at = now() WHERE id = $1 RETURNING *`,
      [id],
    );
    await logger.info('job.cancelled', id, { from: 'processing', deferred: true });
    return {
      job: rows[0],
      note: 'Job is processing; cancellation requested. It will not retry or recur and will finish as cancelled.',
    };
  }

  throw new ValidationError(`job ${id} is ${existing.status} and cannot be cancelled`);
}
