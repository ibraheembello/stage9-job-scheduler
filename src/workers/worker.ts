import { randomUUID } from 'node:crypto';
import { pool, query, withTransaction } from '../config/db.js';
import { env } from '../config/env.js';
import { Job, RECURRING_INTERVAL_MS, RecurringInterval } from '../models/job.model.js';
import { claimNext } from '../services/scheduler.service.js';
import { nextScheduledAt } from '../services/retry.service.js';
import { addToDlq } from '../services/dlq.service.js';
import { checkDlqThreshold } from '../services/alert.service.js';
import { getHandler } from './handlers/index.js';
import { logger } from '../utils/logger.js';
import { publish } from '../events/notify.js';

const workerId = `worker-${process.pid}-${randomUUID().slice(0, 8)}`;
let running = true;

/** Has a cancel been requested for this job while it was processing? */
async function isCancelRequested(jobId: string): Promise<boolean> {
  const { rows } = await query<{ cancel_requested: boolean }>(
    `SELECT cancel_requested FROM jobs WHERE id = $1`,
    [jobId],
  );
  return rows[0]?.cancel_requested ?? false;
}

/** A recurring job re-enters the queue as a fresh pending job after completion. */
async function scheduleRecurrence(job: Job): Promise<void> {
  const intervalMs = RECURRING_INTERVAL_MS[job.recurring_interval as RecurringInterval];
  const next = new Date(Date.now() + intervalMs).toISOString();
  const { rows } = await query<Job>(
    `INSERT INTO jobs (type, payload, priority, scheduled_at, recurring_interval)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [job.type, JSON.stringify(job.payload), job.priority, next, job.recurring_interval],
  );
  await logger.info('job.recurring_scheduled', rows[0].id, {
    parent: job.id,
    next_run: next,
    interval: job.recurring_interval,
  });
  await publish({ event: 'job.created', jobId: rows[0].id, status: 'pending' });
}

async function markCompleted(job: Job): Promise<void> {
  await query(
    `UPDATE jobs
        SET status = 'completed', completed_at = now(), updated_at = now(),
            locked_by = NULL, locked_at = NULL
      WHERE id = $1`,
    [job.id],
  );
  await logger.info('job.completed', job.id, { type: job.type });
  await publish({ event: 'job.completed', jobId: job.id, status: 'completed' });

  if (job.recurring_interval) {
    await scheduleRecurrence(job);
  }
}

async function markCancelled(job: Job, phase: string): Promise<void> {
  await query(
    `UPDATE jobs
        SET status = 'cancelled', updated_at = now(), locked_by = NULL, locked_at = NULL
      WHERE id = $1`,
    [job.id],
  );
  await logger.info('job.cancelled', job.id, { phase, reason: 'cancel_requested_during_processing' });
  await publish({ event: 'job.cancelled', jobId: job.id, status: 'cancelled' });
}

async function handleFailure(job: Job, error: Error): Promise<void> {
  // `retry_count` counts retries already performed (0 on the initial run).
  if (job.retry_count < env.retry.maxRetries) {
    const attempt = job.retry_count + 1; // 1..maxRetries
    // Still have retries left — reschedule with exponential backoff + jitter.
    const runAt = nextScheduledAt(attempt);
    await query(
      `UPDATE jobs
          SET status = 'pending', retry_count = $2, last_error = $3,
              scheduled_at = $4, locked_by = NULL, locked_at = NULL, updated_at = now()
        WHERE id = $1`,
      [job.id, attempt, error.message, runAt.toISOString()],
    );
    await logger.warn('job.retry', job.id, {
      attempt,
      max: env.retry.maxRetries,
      next_run: runAt.toISOString(),
      error: error.message,
    });
    await publish({ event: 'job.retry', jobId: job.id, status: 'pending' });
    return;
  }

  // Retries exhausted -> mark failed and move to the dead-letter queue atomically.
  const finalCount = env.retry.maxRetries;
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE jobs
          SET status = 'failed', retry_count = $2, last_error = $3,
              locked_by = NULL, locked_at = NULL, updated_at = now()
        WHERE id = $1`,
      [job.id, finalCount, error.message],
    );
    await addToDlq(client, job.id, error.message, finalCount);
  });
  await logger.error('job.failed', job.id, {
    retry_count: finalCount,
    error: error.message,
  });
  await logger.error('job.dead_lettered', job.id, { error: error.message });
  await publish({ event: 'job.failed', jobId: job.id, status: 'failed' });
  await checkDlqThreshold();
}

async function processJob(job: Job): Promise<void> {
  const handler = getHandler(job.type);
  try {
    await handler(job);

    // A cancel requested mid-flight wins: finish as cancelled, no recurrence.
    if (await isCancelRequested(job.id)) {
      await markCancelled(job, 'post_success');
      return;
    }
    await markCompleted(job);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (await isCancelRequested(job.id)) {
      // Cancelled while processing -> do not retry or recur.
      await markCancelled(job, 'post_failure');
      return;
    }
    await handleFailure(job, error);
  }
}

async function loop(): Promise<void> {
  await logger.info('worker.started', null, { workerId, poll_ms: env.worker.pollIntervalMs });
  while (running) {
    try {
      const job = await claimNext(workerId);
      if (job) {
        await processJob(job);
        continue; // immediately try for the next job
      }
    } catch (err) {
      process.stderr.write(
        JSON.stringify({ level: 'error', event: 'worker.loop_error', error: String(err) }) + '\n',
      );
    }
    await new Promise((r) => setTimeout(r, env.worker.pollIntervalMs));
  }
}

function shutdown(): void {
  running = false;
  pool.end().finally(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

loop();
