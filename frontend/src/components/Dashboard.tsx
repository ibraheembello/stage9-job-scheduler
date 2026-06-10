import { Stats } from '../api';

const ORDER: Array<keyof Stats> = [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
];

export function Dashboard({ stats }: { stats: Stats | null }) {
  return (
    <section className="dashboard">
      {ORDER.map((key) => (
        <div key={key} className={`stat-card status-${key}`}>
          <span className="stat-count">{stats ? stats[key] : '—'}</span>
          <span className="stat-label">{key}</span>
        </div>
      ))}
    </section>
  );
}
