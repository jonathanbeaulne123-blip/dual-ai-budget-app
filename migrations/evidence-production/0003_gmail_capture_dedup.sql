-- Production remains disabled. Keep schema parity for a later explicit gate.
CREATE UNIQUE INDEX IF NOT EXISTS evidence_items_gmail_digest
  ON evidence_items (environment, auth_user_id, household_id, member_id, capture_kind, plaintext_sha256)
  WHERE capture_kind = 'gmail-7shifts-email' AND state != 'deleted';
