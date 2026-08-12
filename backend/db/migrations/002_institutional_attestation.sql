ALTER TABLE approvals
  ADD COLUMN IF NOT EXISTS institutional_attestation JSONB,
  ADD COLUMN IF NOT EXISTS reviewer_attestation JSONB;
