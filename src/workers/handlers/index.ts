import { Job } from '../../models/job.model.js';
import { emailHandler } from './email.handler.js';

export type JobHandler = (job: Job) => Promise<Record<string, unknown>>;

/**
 * Registry of job-type handlers. The required working handler is `send_email`.
 * Other job types in the DAG demo (generate_report, upload_file) reuse a
 * generic no-op success so the dependency chain can be demonstrated.
 */
const generic: JobHandler = async (job) => ({ ok: true, type: job.type });

export const handlers: Record<string, JobHandler> = {
  send_email: emailHandler,
  generate_report: generic,
  upload_file: generic,
};

export function getHandler(type: string): JobHandler {
  return handlers[type] ?? generic;
}
