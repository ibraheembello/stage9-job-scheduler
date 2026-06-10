import pg from 'pg';
import { query } from '../config/db.js';
import { DlqEntry, Job } from '../models/job.model.js';
import { logger } from '../utils/logger.js';
import { publish } from '../events/notify.js';
import { checkDlqThreshold } from './alert.service.js';

/**
 * Move a job into the dead-letter queue. Called by the worker after a job has
 * exhausted all retries. Runs inside the worker's transaction (client passed
 * in) so the job's `failed` status and the DLQ row commit atomically.
 */
export async function addToDlq(
  client: pg.PoolClient,
  jobId: string,
  error: string,
  retryCount: number,
): Promise<void> {
  await client.query(
    `INSERT INTO dead_letter_queue (job_id, error, retry_count) VALUES ($1, $2, $3)`,
    [jobId, error, retryCount],
  );
}

/** List DLQ entries with their job details for the inspection UI. */
export async function listDlq(): Promise<Array<DlqEntry & { job: Job }>> {
  const { rows } = await query<DlqEntry & { job: Job }>(
    `SELECT d.id, d.job_id, d.error, d.retry_count, d.resolved, d.created_at,
            to_jsonb(j.*) AS job
       FROM dead_letter_queue d
       JOIN jobs j ON j.id = d.job_id
      WHERE d.resolved = false
      ORDER BY d.created_at DESC`,
  );
  return rows;
}

/**
 * Manually retry a dead-lettered job. Resets the job to `pending` with a fresh
 * retry budget and marks the DLQ entry resolved. If it fails again the worker
 * will exhaust retries and re-insert it into the DLQ.
 */
export async function retryFromDlq(dlqId: string): Promise<Job | null> {
  const { rows } = await query<{ job_id: string }>(
    `SELECT job_id FROM dead_letter_queue WHERE id = $1 AND resolved = false`,
    [dlqId],
  );
  if (rows.length === 0) return null;
  const jobId = rows[0].job_id;

  const updated = await query<Job>(
    `UPDATE jobs
        SET status = 'pending',
            retry_count = 0,
            last_error = NULL,
            cancel_requested = false,
            locked_by = NULL,
            locked_at = NULL,
            scheduled_at = now(),
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [jobId],
  );

  await query(`UPDATE dead_letter_queue SET resolved = true WHERE id = $1`, [dlqId]);

  await logger.info('job.retry', jobId, { source: 'dlq_manual_retry' });
  await publish({ event: 'dlq.retry', jobId, status: 'pending' });

  // The count dropped, but re-check so the alert state stays accurate.
  await checkDlqThreshold();

  return updated.rows[0] ?? null;
}
