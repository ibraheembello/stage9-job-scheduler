import { query } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Mocked email transport. In a real system this would call an SMTP/provider
 * API; here it executes real logic (builds the message, "sends" it) and logs
 * a structured event instead of hitting an external service.
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const message = { to, subject, body, sentAt: new Date().toISOString() };
  // Simulated delivery — structured, not a bare console.log.
  process.stdout.write(JSON.stringify({ event: 'email.sent', ...message }) + '\n');
}

/**
 * DLQ threshold alerting.
 *
 * Threshold = env.dlq.alertThreshold (default 5, documented in README/.env).
 * Whenever a job lands in the DLQ we count the *unresolved* entries; if that
 * count has reached the threshold we fire a single email alert to ops.
 */
export async function checkDlqThreshold(): Promise<void> {
  const { rows } = await query<{ count: string }>(
    `SELECT count(*)::int AS count FROM dead_letter_queue WHERE resolved = false`,
  );
  const unresolved = Number(rows[0]?.count ?? 0);

  if (unresolved >= env.dlq.alertThreshold) {
    await sendEmail(
      env.dlq.alertEmailTo,
      `[ALERT] Dead-letter queue threshold reached (${unresolved})`,
      `The dead-letter queue holds ${unresolved} unresolved jobs ` +
        `(threshold = ${env.dlq.alertThreshold}). Please investigate.`,
    );
    await logger.warn('dlq.alert', null, {
      unresolved,
      threshold: env.dlq.alertThreshold,
    });
  }
}
