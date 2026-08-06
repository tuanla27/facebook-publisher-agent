-- PostgreSQL schema for trusted workflow state. Apply through a migration tool.
-- Page tokens and provider secrets must live in a secret manager; this schema
-- stores only a reference to them.

CREATE TABLE IF NOT EXISTS jobs (
  post_job_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN (
    'CONVERSATIONAL_INTAKE', 'INPUT_RECEIVED', 'IMAGE_ANALYZED', 'BRIEF_READY',
    'DRAFT_GENERATED', 'POLICY_REVIEWED', 'NEEDS_HUMAN_APPROVAL', 'APPROVED',
    'CHANGES_REQUESTED', 'REJECTED', 'PUBLISHING', 'PUBLISHED', 'FAILED'
  )),
  current_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_versions (
  post_job_id TEXT NOT NULL REFERENCES jobs(post_job_id),
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DRAFT_GENERATED', 'POLICY_REVIEWED', 'NEEDS_HUMAN_APPROVAL', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED')),
  document JSONB NOT NULL,
  content_hash TEXT NOT NULL,
  asset_manifest_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_job_id, version)
);

CREATE TABLE IF NOT EXISTS assets (
  asset_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  storage_ref TEXT NOT NULL UNIQUE,
  sha256 CHAR(64) NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL,
  scan_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approvals (
  approval_id TEXT PRIMARY KEY,
  post_job_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  decision TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  reviewer_role TEXT NOT NULL,
  reviewer_authenticated BOOLEAN NOT NULL,
  reviewed_content_hash TEXT NOT NULL,
  reviewed_asset_ids JSONB NOT NULL,
  reviewed_asset_hash TEXT NOT NULL,
  reviewed_page_id TEXT NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  review_id TEXT,
  FOREIGN KEY (post_job_id, version) REFERENCES post_versions(post_job_id, version)
);

CREATE TABLE IF NOT EXISTS review_tasks (
  review_id TEXT PRIMARY KEY,
  post_job_id TEXT NOT NULL REFERENCES jobs(post_job_id),
  version INTEGER NOT NULL,
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('NEEDS_HUMAN_APPROVAL', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED')),
  review_url TEXT NOT NULL,
  created_by TEXT NOT NULL,
  review_feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_job_id, version, review_id),
  FOREIGN KEY (post_job_id, version) REFERENCES post_versions(post_job_id, version)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'approvals_review_fk'
  ) THEN
    ALTER TABLE approvals
      ADD CONSTRAINT approvals_review_fk FOREIGN KEY (review_id) REFERENCES review_tasks(review_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS page_connections (
  page_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  page_name TEXT NOT NULL,
  allowlisted BOOLEAN NOT NULL,
  secret_ref TEXT NOT NULL,
  graph_api_version TEXT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS publish_attempts (
  attempt_id TEXT PRIMARY KEY,
  post_job_id TEXT NOT NULL REFERENCES jobs(post_job_id),
  version INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  retryable BOOLEAN NOT NULL DEFAULT false,
  next_retry_at TIMESTAMPTZ,
  provider_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_job_id, idempotency_key, attempt_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS publish_attempt_success_key
  ON publish_attempts (post_job_id, idempotency_key)
  WHERE status = 'SUCCEEDED';

CREATE TABLE IF NOT EXISTS audit_events (
  event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_job_id TEXT REFERENCES jobs(post_job_id),
  tenant_id TEXT NOT NULL,
  actor_id TEXT,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS publish_attempts_due_idx
  ON publish_attempts (status, next_retry_at)
  WHERE status = 'RETRY_SCHEDULED';
