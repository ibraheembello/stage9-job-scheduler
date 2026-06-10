import { Job, api } from '../api';

const PRIORITY_LABEL: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' };

function fmt(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

export function JobsTable({ jobs }: { jobs: Job[] }) {
  const cancellable = (s: string) => s === 'pending' || s === 'processing';

  return (
    <section className="panel">
      <h2>Jobs</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Retries</th>
              <th>Scheduled</th>
              <th>Interval</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td>{j.id}</td>
                <td>{j.type}</td>
                <td>
                  <span className={`prio prio-${j.priority}`}>
                    {PRIORITY_LABEL[j.priority]}
                  </span>
                </td>
                <td>
                  <span className={`badge status-${j.status}`}>{j.status}</span>
                </td>
                <td>
                  {j.retry_count}/{j.max_retries}
                </td>
                <td>{fmt(j.scheduled_at)}</td>
                <td>{j.recurring_interval ?? '—'}</td>
                <td>{fmt(j.created_at)}</td>
                <td>
                  {cancellable(j.status) && (
                    <button className="link-danger" onClick={() => api.cancelJob(j.id)}>
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={9} className="empty">
                  No jobs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
