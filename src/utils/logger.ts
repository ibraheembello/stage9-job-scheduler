import { query } from '../config/db.js';

export type LogEvent =
  | 'job.created'
  | 'job.started'
  | 'job.retry'
  | 'job.failed'
  | 'job.cancelled'
  | 'job.completed'
  | 'job.dead_lettered'
  | 'job.recurring_scheduled'
  | 'dlq.alert'
  | 'worker.started';

type Level = 'info' | 'warn' | 'error';

/**
 * Structured logger. Every call emits a single JSON line to stdout AND
 * (for job-scoped events) persists a row to `job_logs` so the history is
 * queryable. This is the "structured format only" requirement — there is
 * no bare console.log anywhere in the lifecycle code.
 */
async function emit(
  level: Level,
  event: LogEvent,
  jobId: string | null,
  details: Record<string, unknown>,
): Promise<void> {
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    jobId,
    ...details,
  };
  // One structured JSON line per event.
  process.stdout.write(JSON.stringify(line) + '\n');

  try {
    await query(
      `INSERT INTO job_logs (job_id, event, level, details) VALUES ($1, $2, $3, $4)`,
      [jobId, event, level, JSON.stringify(details)],
    );
  } catch {
    // Never let logging failure break the job pipeline.
  }
}

export const logger = {
  info: (event: LogEvent, jobId: string | null, details: Record<string, unknown> = {}) =>
    emit('info', event, jobId, details),
  warn: (event: LogEvent, jobId: string | null, details: Record<string, unknown> = {}) =>
    emit('warn', event, jobId, details),
  error: (event: LogEvent, jobId: string | null, details: Record<string, unknown> = {}) =>
    emit('error', event, jobId, details),
};
