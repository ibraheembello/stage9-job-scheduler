import { query } from '../config/db.js';

export const JOB_EVENTS_CHANNEL = 'job_events';

export interface JobEvent {
  event: string;
  jobId?: string;
  status?: string;
}

/**
 * Publish a change across processes using Postgres LISTEN/NOTIFY.
 *
 * The worker runs in a separate process from the API, so an in-memory event
 * emitter cannot reach the API's SSE clients. Instead every status change is
 * broadcast through Postgres; the API holds a dedicated LISTEN connection and
 * relays each notification to connected browsers over SSE.
 */
export async function publish(payload: JobEvent): Promise<void> {
  try {
    await query(`SELECT pg_notify($1, $2)`, [
      JOB_EVENTS_CHANNEL,
      JSON.stringify(payload),
    ]);
  } catch {
    // Notifications are best-effort; never block the pipeline on them.
  }
}
