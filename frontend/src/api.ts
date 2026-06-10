export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

export type JobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface Job {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  priority: 1 | 2 | 3;
  status: JobStatus;
  scheduled_at: string;
  recurring_interval: string | null;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  created_at: string;
}

export interface DlqItem {
  id: string;
  job_id: string;
  error: string | null;
  retry_count: number;
  resolved: boolean;
  created_at: string;
  job: Job;
}

export type Stats = Record<JobStatus, number>;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `request failed: ${res.status}`);
  return data as T;
}

export const api = {
  stats: () => req<Stats>('/api/stats'),
  jobs: () => req<Job[]>('/api/jobs'),
  dlq: () => req<DlqItem[]>('/api/dlq'),
  createJob: (body: unknown) =>
    req<Job>('/api/jobs', { method: 'POST', body: JSON.stringify(body) }),
  cancelJob: (id: string) =>
    req<{ note: string }>(`/api/jobs/${id}/cancel`, { method: 'POST' }),
  retryDlq: (id: string) =>
    req<Job>(`/api/dlq/${id}/retry`, { method: 'POST' }),
};

/** Subscribe to live job updates over SSE. Returns an unsubscribe function. */
export function subscribe(onUpdate: () => void): () => void {
  const es = new EventSource(`${API_URL}/api/events`);
  es.addEventListener('job_update', onUpdate);
  return () => es.close();
}
