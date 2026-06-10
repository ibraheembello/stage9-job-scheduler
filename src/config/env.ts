import dotenv from 'dotenv';

dotenv.config();

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function str(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw === undefined || raw === '' ? fallback : raw;
}

export const env = {
  port: num('PORT', 4000),
  nodeEnv: str('NODE_ENV', 'development'),

  db: {
    host: str('DATABASE_HOST', 'localhost'),
    port: num('DATABASE_PORT', 5432),
    user: str('DATABASE_USER', 'postgres'),
    password: str('DATABASE_PASSWORD', ''),
    database: str('DATABASE_NAME', 'job_scheduler'),
  },

  worker: {
    pollIntervalMs: num('WORKER_POLL_INTERVAL_MS', 1000),
    batchSize: num('WORKER_BATCH_SIZE', 1),
  },

  retry: {
    maxRetries: num('MAX_RETRIES', 3),
    backoffBaseSeconds: num('BACKOFF_BASE_SECONDS', 1),
    backoffFactor: num('BACKOFF_FACTOR', 5),
    jitter: num('BACKOFF_JITTER', 0.2),
  },

  dlq: {
    alertThreshold: num('DLQ_ALERT_THRESHOLD', 5),
    alertEmailTo: str('ALERT_EMAIL_TO', 'ops@dilamme.test'),
  },

  aging: {
    bumpSeconds: num('AGING_BUMP_SECONDS', 30),
  },

  email: {
    failureRate: num('EMAIL_FAILURE_RATE', 0),
  },
};
