-- Core local workflow does not require PostgreSQL. Apply only when the
-- optional PostgreSQL extension is enabled.
--
-- Adds ATTACHMENTS_RECEIVED and ASSETS_MATERIALIZED to the jobs.state CHECK
-- so jobs in the early attachment phase no longer violate the constraint.
-- Matches workflow/state-machine.mjs.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_state_check'
  ) THEN
    ALTER TABLE jobs DROP CONSTRAINT jobs_state_check;
  END IF;
END $$;

ALTER TABLE jobs
  ADD CONSTRAINT jobs_state_check CHECK (state IN (
    'CONVERSATIONAL_INTAKE', 'ATTACHMENTS_RECEIVED', 'ASSETS_MATERIALIZED',
    'INPUT_RECEIVED', 'IMAGE_ANALYZED', 'BRIEF_READY',
    'DRAFT_GENERATED', 'POLICY_REVIEWED', 'NEEDS_HUMAN_APPROVAL', 'APPROVED',
    'CHANGES_REQUESTED', 'REJECTED', 'PUBLISHING', 'PUBLISHED', 'FAILED'
  ));
