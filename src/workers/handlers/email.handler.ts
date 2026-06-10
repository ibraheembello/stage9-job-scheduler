import { Job } from '../../models/job.model.js';
import { env } from '../../config/env.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email-simulation handler.
 *
 * This is a MOCK of an external email provider, but it runs REAL logic:
 *   1. validates the payload (recipient + subject required, recipient shape),
 *   2. renders the message body from a template,
 *   3. "sends" it — with a configurable failure rate so retries and the DLQ
 *      can be exercised.
 *
 * It throws on any problem; the worker treats a throw as a failed attempt.
 * Returning successfully (the equivalent of a real 200) is NOT enough on its
 * own — the validation/rendering above is the real work being performed.
 */
export async function emailHandler(job: Job): Promise<Record<string, unknown>> {
  const { to, subject, body } = job.payload as {
    to?: string;
    subject?: string;
    body?: string;
  };

  if (!to || !EMAIL_RE.test(to)) {
    throw new Error(`invalid recipient address: ${JSON.stringify(to)}`);
  }
  if (!subject || subject.trim() === '') {
    throw new Error('email subject is required');
  }

  const rendered =
    body ??
    `Hello,\n\nThis is the "${subject}" notification.\n\nRegards,\nDilamme`;

  // Simulated transient transport failure to exercise retry/backoff/DLQ.
  if (Math.random() < env.email.failureRate) {
    throw new Error('SMTP connection refused (simulated transient failure)');
  }

  return {
    delivered: true,
    to,
    subject,
    bytes: Buffer.byteLength(rendered, 'utf8'),
  };
}
