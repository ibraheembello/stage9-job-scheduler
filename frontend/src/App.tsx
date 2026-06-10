import { useCallback, useEffect, useState } from 'react';
import { api, subscribe, Job, DlqItem, Stats } from './api';
import { Dashboard } from './components/Dashboard';
import { JobsTable } from './components/JobsTable';
import { CreateJobForm } from './components/CreateJobForm';
import { DlqView } from './components/DlqView';

export default function App() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dlq, setDlq] = useState<DlqItem[]>([]);
  const [live, setLive] = useState(false);

  const refresh = useCallback(async () => {
    const [s, j, d] = await Promise.all([api.stats(), api.jobs(), api.dlq()]);
    setStats(s);
    setJobs(j);
    setDlq(d);
  }, []);

  useEffect(() => {
    refresh().catch(console.error);
    // Live updates over SSE: every job change triggers a refresh.
    const unsubscribe = subscribe(() => {
      setLive(true);
      refresh().catch(console.error);
    });
    return unsubscribe;
  }, [refresh]);

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          Dilamme <span className="muted">· Background Job Scheduler</span>
        </h1>
        <span className={`live-dot ${live ? 'on' : ''}`}>{live ? 'live' : 'connecting…'}</span>
      </header>

      <main>
        <Dashboard stats={stats} />
        <CreateJobForm />
        <JobsTable jobs={jobs} />
        <DlqView items={dlq} />
      </main>
    </div>
  );
}
