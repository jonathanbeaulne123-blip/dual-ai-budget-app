-- D-157 Evidence Mesh — dedicated Development D1 metadata.
-- Raw bytes live only in the private EVIDENCE_RAW R2 bucket and are encrypted
-- before storage. This migration is local/review-only until a separate apply gate.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS evidence_items (
  evidence_id TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment = 'development'),
  auth_user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  capture_kind TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('uploading','ready','deriving','ready_to_review','quarantined','failed','deleted')),
  content_type TEXT NOT NULL,
  byte_length INTEGER NOT NULL CHECK (byte_length >= 0 AND byte_length <= 10485760),
  plaintext_sha256 TEXT NOT NULL,
  cipher_version INTEGER NOT NULL DEFAULT 1 CHECK (cipher_version = 1),
  kek_version INTEGER NOT NULL DEFAULT 1 CHECK (kek_version >= 1),
  wrapped_dek TEXT,
  nonce_manifest TEXT,
  object_key TEXT,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS evidence_items_owner_updated
  ON evidence_items (environment, auth_user_id, household_id, member_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS evidence_provider_identities (
  identity_id TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment = 'development'),
  auth_user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_tenant_key TEXT NOT NULL,
  provider_subject_key TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('active','disconnected','revoked')),
  bound_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (environment, provider, provider_tenant_key, provider_subject_key)
);

CREATE TABLE IF NOT EXISTS evidence_job_mappings (
  mapping_id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES evidence_provider_identities(identity_id),
  provider_location_key TEXT,
  provider_role_key TEXT,
  hearth_job_id TEXT NOT NULL,
  hearth_role_id TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  mapping_version INTEGER NOT NULL CHECK (mapping_version >= 1),
  created_at TEXT NOT NULL,
  UNIQUE (identity_id, provider_location_key, provider_role_key, effective_from, mapping_version)
);

CREATE TABLE IF NOT EXISTS evidence_derivatives (
  evidence_id TEXT NOT NULL REFERENCES evidence_items(evidence_id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  canonical_shift_key TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  schema_fingerprint TEXT NOT NULL,
  sanitized_json TEXT NOT NULL CHECK (length(sanitized_json) <= 262144),
  created_at TEXT NOT NULL,
  PRIMARY KEY (evidence_id, revision, canonical_shift_key)
);

CREATE TABLE IF NOT EXISTS evidence_observations (
  observation_id TEXT PRIMARY KEY,
  evidence_id TEXT NOT NULL REFERENCES evidence_items(evidence_id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  canonical_shift_key TEXT NOT NULL,
  field_key TEXT NOT NULL,
  value_json TEXT NOT NULL CHECK (length(value_json) <= 8192),
  unit TEXT NOT NULL,
  source_location TEXT NOT NULL,
  confidence_bps INTEGER NOT NULL CHECK (confidence_bps BETWEEN 0 AND 10000),
  finality TEXT NOT NULL CHECK (finality IN ('outlook','provisional','approved','final')),
  extraction_method TEXT NOT NULL,
  conflict_state TEXT NOT NULL CHECK (conflict_state IN ('clear','corroborated','conflicted','unknown')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS evidence_observations_item_field
  ON evidence_observations (evidence_id, revision, canonical_shift_key, field_key);

-- Unknown provider fields stay member-owned and queryable for schema-drift review,
-- but remain separate from authority observations so they cannot ride an eligible
-- bundle into household command, PGlite, Hercules, or generic model facts.
CREATE TABLE IF NOT EXISTS evidence_schema_drift (
  drift_id TEXT PRIMARY KEY,
  evidence_id TEXT NOT NULL REFERENCES evidence_items(evidence_id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  canonical_shift_key TEXT,
  field_path TEXT NOT NULL,
  value_json TEXT NOT NULL CHECK (length(value_json) <= 8192),
  value_type TEXT NOT NULL,
  value_digest TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS evidence_schema_drift_item
  ON evidence_schema_drift (evidence_id, revision, canonical_shift_key, field_path);

CREATE TABLE IF NOT EXISTS evidence_conflicts (
  conflict_id TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment = 'development'),
  auth_user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  canonical_shift_key TEXT,
  field_key TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('open','resolved','superseded')),
  observation_ids_json TEXT NOT NULL CHECK (length(observation_ids_json) <= 32768),
  resolution_json TEXT CHECK (length(resolution_json) <= 32768),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence_bundles (
  bundle_id TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment = 'development'),
  auth_user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  canonical_shift_key TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  state TEXT NOT NULL CHECK (state IN ('quarantined','eligible','claimed','posted','superseded','correction_required','deleted')),
  material_hash TEXT NOT NULL,
  sanitized_json TEXT NOT NULL CHECK (length(sanitized_json) <= 262144),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (environment, auth_user_id, household_id, member_id, canonical_shift_key, revision)
);

CREATE INDEX IF NOT EXISTS evidence_bundles_owner_state
  ON evidence_bundles (environment, auth_user_id, household_id, member_id, state, updated_at DESC);

CREATE TABLE IF NOT EXISTS evidence_automation_policies (
  environment TEXT NOT NULL CHECK (environment = 'development'),
  auth_user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  policy_version INTEGER NOT NULL DEFAULT 1 CHECK (policy_version >= 1),
  policy_json TEXT NOT NULL CHECK (length(policy_json) <= 32768),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (environment, auth_user_id, household_id, member_id, job_id)
);

CREATE TABLE IF NOT EXISTS evidence_automation_jobs (
  job_key TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment = 'development'),
  auth_user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  hearth_job_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL REFERENCES evidence_bundles(bundle_id),
  bundle_revision INTEGER NOT NULL,
  action_kind TEXT NOT NULL CHECK (action_kind IN ('post','reconcile_week','variance')),
  state TEXT NOT NULL CHECK (state IN ('pending','claimed','acknowledged','failed','quarantined')),
  lease_id TEXT,
  lease_expires_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS evidence_automation_jobs_claim
  ON evidence_automation_jobs (environment, auth_user_id, household_id, member_id, state, updated_at);

CREATE TABLE IF NOT EXISTS evidence_automation_receipts (
  job_key TEXT PRIMARY KEY REFERENCES evidence_automation_jobs(job_key),
  command_event_id TEXT NOT NULL,
  confirmation_id TEXT NOT NULL,
  result_revision INTEGER NOT NULL,
  identity_hash TEXT NOT NULL,
  audit_hash TEXT NOT NULL,
  acknowledged_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence_capture_capabilities (
  capability_hash TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment = 'development'),
  auth_user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  origin TEXT NOT NULL,
  byte_limit INTEGER NOT NULL CHECK (byte_limit > 0 AND byte_limit <= 10485760),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence_mailboxes (
  mailbox_hash TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK (environment = 'development'),
  auth_user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS evidence_mailboxes_owner_active
  ON evidence_mailboxes (environment, auth_user_id, household_id, member_id)
  WHERE active = 1;

CREATE TABLE IF NOT EXISTS evidence_access_audit (
  audit_id TEXT PRIMARY KEY,
  evidence_id TEXT,
  environment TEXT NOT NULL CHECK (environment = 'development'),
  auth_user_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  action TEXT NOT NULL,
  outcome TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS evidence_access_audit_owner_time
  ON evidence_access_audit (environment, auth_user_id, household_id, member_id, created_at DESC);
