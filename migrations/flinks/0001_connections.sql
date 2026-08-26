-- Development-only Flinks Connect state (D-148). Encrypted provider secrets live in encrypted_blob.
CREATE TABLE IF NOT EXISTS flinks_connections (
  member_key TEXT PRIMARY KEY,
  encrypted_blob TEXT NOT NULL,
  institution TEXT,
  account_label TEXT,
  account_last4 TEXT,
  currency TEXT NOT NULL DEFAULT 'CAD',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS flinks_connect_sessions (
  session_id TEXT PRIMARY KEY,
  member_key TEXT NOT NULL,
  state_nonce TEXT NOT NULL,
  iframe_origin TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS flinks_connect_sessions_member_idx
  ON flinks_connect_sessions (member_key, expires_at);
