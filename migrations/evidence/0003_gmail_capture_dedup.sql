-- Direct Gmail import keeps raw RFC822 in the same encrypted member vault.
-- The digest is server-computed; this unique index makes repeated Gmail scrubs
-- idempotent without retaining a Gmail message id or subject.
CREATE UNIQUE INDEX IF NOT EXISTS evidence_items_gmail_digest
  ON evidence_items (environment, auth_user_id, household_id, member_id, capture_kind, plaintext_sha256)
  WHERE capture_kind = 'gmail-7shifts-email' AND state != 'deleted';
