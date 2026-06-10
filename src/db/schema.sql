-- ============================================================
-- Stage 9 Background Job Scheduler — schema
-- ============================================================

CREATE TABLE IF NOT EXISTS jobs (
  id              BIGSERIAL PRIMARY KEY,
  type            TEXT        NOT NULL,
  payload         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- 1 = High, 2 = Medium, 3 = Low
  priority        SMALLINT    NOT NULL DEFAULT 2 CHECK (priority IN (1, 2, 3)),
  status          TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  -- when the job becomes eligible to run
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- recurring interval keyword: every_1_minute | every_5_minutes | every_1_hour
  recurring_interval TEXT,
  retry_count     INTEGER     NOT NULL DEFAULT 0,
  max_retries     INTEGER     NOT NULL DEFAULT 3,
  last_error      TEXT,
  -- set when a cancel is requested while the job is already processing
  cancel_requested BOOLEAN    NOT NULL DEFAULT false,
  -- worker that currently holds the job (for observability)
  locked_by       TEXT,
  locked_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_scheduled
  ON jobs (status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_jobs_pickup
  ON jobs (priority, scheduled_at, created_at);

-- DAG edges: a job depends on another job. `job_id` runs only after
-- every `depends_on_id` has reached status 'completed'.
CREATE TABLE IF NOT EXISTS job_dependencies (
  job_id        BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  depends_on_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  PRIMARY KEY (job_id, depends_on_id)
);

-- Dead-letter queue: jobs that exhausted all retries.
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id          BIGSERIAL PRIMARY KEY,
  job_id      BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  error       TEXT,
  retry_count INTEGER NOT NULL,
  -- false while sitting for inspection; true once an engineer retries it
  resolved    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dlq_unresolved ON dead_letter_queue (resolved);

-- Structured event log for every significant lifecycle event.
CREATE TABLE IF NOT EXISTS job_logs (
  id         BIGSERIAL PRIMARY KEY,
  job_id     BIGINT REFERENCES jobs(id) ON DELETE CASCADE,
  event      TEXT NOT NULL,
  level      TEXT NOT NULL DEFAULT 'info',
  details    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_logs_job ON job_logs (job_id, created_at);
