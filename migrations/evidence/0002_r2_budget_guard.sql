-- D-157 Development R2 budget guard.
-- These counters are intentionally far below Cloudflare's included R2 usage.

CREATE TABLE IF NOT EXISTS evidence_r2_budget (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  stored_bytes INTEGER NOT NULL DEFAULT 0 CHECK (stored_bytes >= 0),
  object_count INTEGER NOT NULL DEFAULT 0 CHECK (object_count >= 0),
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO evidence_r2_budget (singleton, stored_bytes, object_count, updated_at)
VALUES (1, 0, 0, '1970-01-01T00:00:00.000Z');

CREATE TABLE IF NOT EXISTS evidence_r2_monthly_usage (
  month_key TEXT PRIMARY KEY CHECK (month_key GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  class_a_puts INTEGER NOT NULL DEFAULT 0 CHECK (class_a_puts >= 0),
  class_b_gets INTEGER NOT NULL DEFAULT 0 CHECK (class_b_gets >= 0),
  updated_at TEXT NOT NULL
);
