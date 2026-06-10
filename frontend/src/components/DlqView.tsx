import { DlqItem, api } from '../api';

export function DlqView({ items }: { items: DlqItem[] }) {
  return (
    <section className="panel">
      <h2>
        Dead-Letter Queue <span className="dlq-count">{items.length}</span>
      </h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>DLQ ID</th>
              <th>Job ID</th>
              <th>Type</th>
              <th>Retries</th>
              <th>Error</th>
              <th>Failed at</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id}>
                <td>{d.id}</td>
                <td>{d.job_id}</td>
                <td>{d.job?.type}</td>
                <td>{d.retry_count}</td>
                <td className="error-cell">{d.error}</td>
                <td>{new Date(d.created_at).toLocaleString()}</td>
                <td>
                  <button className="btn-small" onClick={() => api.retryDlq(d.id)}>
                    Retry
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  Dead-letter queue is empty.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
