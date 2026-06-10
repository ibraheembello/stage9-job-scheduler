export type JobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** 1 = High, 2 = Medium, 3 = Low */
export type Priority = 1 | 2 | 3;

export type RecurringInterval =
  | 'every_1_minute'
  | 'every_5_minutes'
  | 'every_1_hour';

export const RECURRING_INTERVAL_MS: Record<RecurringInterval, number> = {
  every_1_minute: 60_000,
  every_5_minutes: 5 * 60_000,
  every_1_hour: 60 * 60_000,
};

export interface Job {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  priority: Priority;
  status: JobStatus;
  scheduled_at: string;
  recurring_interval: RecurringInterval | null;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  cancel_requested: boolean;
  locked_by: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface CreateJobInput {
  type: string;
  payload?: Record<string, unknown>;
  priority?: Priority;
  scheduled_at?: string;
  recurring_interval?: RecurringInterval | null;
  /** IDs of jobs that must complete before this one runs (DAG edges). */
  depends_on?: string[];
}

export interface DlqEntry {
  id: string;
  job_id: string;
  error: string | null;
  retry_count: number;
  resolved: boolean;
  created_at: string;
}
