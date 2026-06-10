import { useState } from 'react';
import { api } from '../api';

const INTERVALS = ['', 'every_1_minute', 'every_5_minutes', 'every_1_hour'];

export function CreateJobForm() {
  const [type, setType] = useState('send_email');
  const [priority, setPriority] = useState(2);
  const [payload, setPayload] = useState('{\n  "to": "test@gmail.com",\n  "subject": "Welcome"\n}');
  const [scheduledAt, setScheduledAt] = useState('');
  const [interval, setInterval] = useState('');
  const [dependsOn, setDependsOn] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    let parsedPayload: unknown = {};
    try {
      parsedPayload = payload.trim() ? JSON.parse(payload) : {};
    } catch {
      setMsg({ kind: 'err', text: 'Payload is not valid JSON' });
      return;
    }
    const body: Record<string, unknown> = { type, priority, payload: parsedPayload };
    if (scheduledAt) body.scheduled_at = new Date(scheduledAt).toISOString();
    if (interval) body.recurring_interval = interval;
    if (dependsOn.trim()) {
      body.depends_on = dependsOn.split(',').map((s) => s.trim()).filter(Boolean);
    }
    try {
      const job = await api.createJob(body);
      setMsg({ kind: 'ok', text: `Created job #${job.id}` });
    } catch (err) {
      setMsg({ kind: 'err', text: (err as Error).message });
    }
  }

  return (
    <section className="panel">
      <h2>Create Job</h2>
      <form className="create-form" onSubmit={submit}>
        <label>
          Type
          <input value={type} onChange={(e) => setType(e.target.value)} required />
        </label>

        <label>
          Priority
          <select value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
            <option value={1}>1 — High</option>
            <option value={2}>2 — Medium</option>
            <option value={3}>3 — Low</option>
          </select>
        </label>

        <label>
          Scheduled at (optional)
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </label>

        <label>
          Recurring interval (optional)
          <select value={interval} onChange={(e) => setInterval(e.target.value)}>
            {INTERVALS.map((i) => (
              <option key={i} value={i}>
                {i === '' ? 'none' : i}
              </option>
            ))}
          </select>
        </label>

        <label>
          Depends on (job IDs, comma-separated — optional)
          <input
            value={dependsOn}
            onChange={(e) => setDependsOn(e.target.value)}
            placeholder="e.g. 12, 13"
          />
        </label>

        <label className="full">
          Payload (JSON)
          <textarea rows={5} value={payload} onChange={(e) => setPayload(e.target.value)} />
        </label>

        <div className="full form-actions">
          <button type="submit" className="btn-primary">
            Create Job
          </button>
          {msg && <span className={msg.kind === 'ok' ? 'msg-ok' : 'msg-err'}>{msg.text}</span>}
        </div>
      </form>
    </section>
  );
}
