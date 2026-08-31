export const BOOKS_SCHEMA_VERSION = 5;

export const BOOKS_SCHEMA = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL CHECK (char_length(timezone) > 0),
  currency TEXT NOT NULL CHECK (currency = 'CAD'),
  environment TEXT NOT NULL CHECK (environment IN ('development', 'production')),
  invite_phrase TEXT NOT NULL,
  linked BOOLEAN NOT NULL DEFAULT FALSE,
  revision INTEGER NOT NULL DEFAULT 0,
  last_committed_at TEXT
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  parent_id TEXT,
  record_type TEXT NOT NULL CHECK (record_type IN ('group', 'category')),
  name TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('expense', 'income')),
  essential BOOLEAN NOT NULL DEFAULT FALSE,
  income_stability TEXT CHECK (income_stability IN ('fixed', 'variable') OR income_stability IS NULL),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chart_accounts (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
  source TEXT NOT NULL CHECK (source IN ('bank', 'category', 'equity')),
  bank_account_id TEXT,
  category_id TEXT,
  owner_member_id TEXT,
  scope TEXT NOT NULL DEFAULT 'shared' CHECK (scope IN ('shared', 'personal')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (household_id, code)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  date_key TEXT NOT NULL CHECK (date_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  memo TEXT NOT NULL DEFAULT '',
  place TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  source_id TEXT,
  visibility TEXT NOT NULL CHECK (visibility IN ('household', 'personal', 'both')),
  created_by TEXT NOT NULL,
  recognized BOOLEAN NOT NULL DEFAULT TRUE,
  duplicate_key TEXT NOT NULL DEFAULT '',
  origin_ids TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL CHECK (line_no > 0),
  account_id TEXT NOT NULL REFERENCES chart_accounts(id),
  debit_cents INTEGER NOT NULL DEFAULT 0 CHECK (debit_cents >= 0),
  credit_cents INTEGER NOT NULL DEFAULT 0 CHECK (credit_cents >= 0),
  party_id TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  CHECK (debit_cents = 0 OR credit_cents = 0),
  CHECK (debit_cents + credit_cents > 0),
  UNIQUE (entry_id, line_no)
);

CREATE TABLE IF NOT EXISTS source_transactions (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  date_key TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer', 'refund', 'opening')),
  amount_cents INTEGER NOT NULL,
  account_id TEXT NOT NULL,
  subcategory_id TEXT,
  note TEXT NOT NULL DEFAULT '',
  place TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL,
  created_by TEXT NOT NULL,
  is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  date_key TEXT NOT NULL,
  member_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  sales_cents INTEGER NOT NULL,
  cash_tips_cents INTEGER NOT NULL,
  cc_tips_cents INTEGER NOT NULL,
  hours DOUBLE PRECISION NOT NULL,
  net_tips_cents INTEGER NOT NULL,
  wages_cents INTEGER NOT NULL,
  visibility TEXT NOT NULL,
  created_by TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_cents INTEGER NOT NULL,
  saved_cents INTEGER NOT NULL,
  deadline TEXT,
  shared BOOLEAN NOT NULL,
  owner_member_id TEXT,
  subcategory_id TEXT
);

CREATE TABLE IF NOT EXISTS budget_plans (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  subcategory_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  essential BOOLEAN NOT NULL DEFAULT FALSE,
  income_stability TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS recurrences (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  cadence TEXT NOT NULL,
  next_date TEXT NOT NULL,
  type TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  account_id TEXT NOT NULL,
  subcategory_id TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL,
  auto_post BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  at TEXT NOT NULL,
  action TEXT NOT NULL,
  summary TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_revisions (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  at TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  projection_hash TEXT,
  entry_count INTEGER NOT NULL,
  debit_cents INTEGER NOT NULL,
  credit_cents INTEGER NOT NULL,
  in_balance BOOLEAN NOT NULL
);

ALTER TABLE audit_revisions
  ADD COLUMN IF NOT EXISTS projection_hash TEXT;

CREATE TABLE IF NOT EXISTS household_snapshots (
  household_id TEXT PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
  invite_phrase TEXT NOT NULL,
  environment TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

ALTER TABLE chart_accounts
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'shared' CHECK (scope IN ('shared', 'personal'));

CREATE TABLE IF NOT EXISTS household_funds (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  custodian_member_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('practice', 'connected')),
  opened_on TEXT NOT NULL CHECK (opened_on ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fund_month_plans (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  fund_id TEXT NOT NULL REFERENCES household_funds(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL CHECK (month_key ~ '^[0-9]{4}-[0-9]{2}$'),
  target_cents INTEGER NOT NULL CHECK (target_cents >= 0),
  buffer_cents INTEGER NOT NULL CHECK (buffer_cents >= 0),
  agreed_by_member_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (fund_id, month_key)
);

CREATE TABLE IF NOT EXISTS fund_events (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  fund_id TEXT NOT NULL REFERENCES household_funds(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('contribution-proposed','contribution-confirmed','purchase-funded','refund-funded','settlement-confirmed','kitty-allocated','kitty-released','reconciliation-recorded','bank-verified','reversal')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  date_key TEXT NOT NULL CHECK (date_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  created_by TEXT NOT NULL,
  confirmed_by_member_id TEXT,
  contributor_member_id TEXT,
  destination_account_id TEXT,
  related_event_id TEXT,
  related_transaction_ids TEXT NOT NULL DEFAULT '[]',
  evidence_digests TEXT NOT NULL DEFAULT '[]',
  reconciliation_tied BOOLEAN,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fund_settlement_allocations (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  fund_id TEXT NOT NULL REFERENCES household_funds(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES fund_events(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (event_id, transaction_id)
);

CREATE TABLE IF NOT EXISTS fund_kitty_allocations (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  fund_id TEXT NOT NULL REFERENCES household_funds(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES fund_events(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (event_id, goal_id)
);

CREATE TABLE IF NOT EXISTS fund_bank_bindings (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  fund_id TEXT NOT NULL REFERENCES household_funds(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('manual', 'flinks')),
  status TEXT NOT NULL CHECK (status IN ('manual', 'connected', 'revoked')),
  account_digest TEXT,
  institution_label TEXT NOT NULL DEFAULT '',
  account_label TEXT NOT NULL DEFAULT '',
  last4 TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fund_private_reconciliations (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  fund_id TEXT NOT NULL REFERENCES household_funds(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  date_key TEXT NOT NULL CHECK (date_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  bank_total_cents INTEGER NOT NULL CHECK (bank_total_cents >= 0),
  operating_fund_cents INTEGER NOT NULL CHECK (operating_fund_cents >= 0),
  kitty_cents INTEGER NOT NULL CHECK (kitty_cents >= 0),
  personal_remainder_cents INTEGER NOT NULL,
  difference_cents INTEGER NOT NULL,
  tied BOOLEAN NOT NULL,
  shared_event_id TEXT NOT NULL REFERENCES fund_events(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS journal_entries_household_date ON journal_entries (household_id, date_key);
CREATE INDEX IF NOT EXISTS journal_lines_account ON journal_lines (household_id, account_id);
CREATE INDEX IF NOT EXISTS journal_lines_entry ON journal_lines (entry_id);
CREATE INDEX IF NOT EXISTS journal_lines_account_fk ON journal_lines (account_id);
CREATE INDEX IF NOT EXISTS members_household ON members (household_id);
CREATE INDEX IF NOT EXISTS categories_household ON categories (household_id);
CREATE INDEX IF NOT EXISTS source_transactions_household_date ON source_transactions (household_id, date_key);
CREATE INDEX IF NOT EXISTS shifts_household_date ON shifts (household_id, date_key);
CREATE INDEX IF NOT EXISTS goals_household ON goals (household_id);
CREATE INDEX IF NOT EXISTS budget_plans_household_month ON budget_plans (household_id, month_key);
CREATE INDEX IF NOT EXISTS recurrences_household ON recurrences (household_id);
CREATE INDEX IF NOT EXISTS activity_household ON activity (household_id);
CREATE INDEX IF NOT EXISTS audit_revisions_household ON audit_revisions (household_id);
CREATE UNIQUE INDEX IF NOT EXISTS household_snapshots_invite ON household_snapshots (invite_phrase, environment);
CREATE INDEX IF NOT EXISTS household_funds_household ON household_funds (household_id);
CREATE INDEX IF NOT EXISTS fund_month_plans_household_month ON fund_month_plans (household_id, month_key);
CREATE INDEX IF NOT EXISTS fund_events_household_date ON fund_events (household_id, date_key);
CREATE INDEX IF NOT EXISTS fund_events_fund_kind ON fund_events (fund_id, kind);
CREATE INDEX IF NOT EXISTS fund_events_related_event ON fund_events (related_event_id);
CREATE INDEX IF NOT EXISTS fund_settlement_event ON fund_settlement_allocations (event_id);
CREATE INDEX IF NOT EXISTS fund_settlement_transaction ON fund_settlement_allocations (household_id, transaction_id);
CREATE INDEX IF NOT EXISTS fund_kitty_event ON fund_kitty_allocations (event_id);
CREATE INDEX IF NOT EXISTS fund_kitty_goal ON fund_kitty_allocations (household_id, goal_id);
CREATE INDEX IF NOT EXISTS fund_bindings_member ON fund_bank_bindings (household_id, member_id);
CREATE INDEX IF NOT EXISTS fund_reconciliations_member_date ON fund_private_reconciliations (household_id, member_id, date_key);

CREATE OR REPLACE VIEW v_unbalanced_entries AS
SELECT
  entry_id,
  household_id,
  SUM(debit_cents) AS debit_cents,
  SUM(credit_cents) AS credit_cents,
  SUM(debit_cents) - SUM(credit_cents) AS off_by_cents
FROM journal_lines
GROUP BY entry_id, household_id
HAVING SUM(debit_cents) <> SUM(credit_cents);

CREATE OR REPLACE VIEW v_journal AS
SELECT
  e.household_id,
  e.id AS entry_id,
  e.date_key,
  e.memo,
  e.place,
  e.source,
  e.visibility,
  e.created_by,
  e.recognized,
  l.line_no,
  a.code AS account_code,
  a.name AS account_name,
  a.account_type,
  l.debit_cents,
  l.credit_cents,
  l.party_id
FROM journal_entries e
JOIN journal_lines l ON l.entry_id = e.id
JOIN chart_accounts a ON a.id = l.account_id AND a.household_id = e.household_id;

CREATE OR REPLACE VIEW v_trial_balance AS
SELECT
  a.household_id,
  a.id AS account_id,
  a.code,
  a.name,
  a.account_type,
  a.normal_balance,
  COALESCE(SUM(posted.debit_cents), 0) AS debit_cents,
  COALESCE(SUM(posted.credit_cents), 0) AS credit_cents,
  COALESCE(SUM(posted.debit_cents), 0) - COALESCE(SUM(posted.credit_cents), 0) AS net_cents
FROM chart_accounts a
LEFT JOIN (
  SELECT l.household_id, l.account_id, l.debit_cents, l.credit_cents
  FROM journal_lines l
  JOIN journal_entries e ON e.id = l.entry_id
  WHERE e.recognized
) posted ON posted.account_id = a.id AND posted.household_id = a.household_id
GROUP BY a.household_id, a.id, a.code, a.name, a.account_type, a.normal_balance;

CREATE OR REPLACE VIEW v_income_statement AS
SELECT
  e.household_id,
  substr(e.date_key, 1, 7) AS month_key,
  a.account_type,
  a.code,
  a.name,
  CASE a.account_type
    WHEN 'income' THEN SUM(l.credit_cents) - SUM(l.debit_cents)
    WHEN 'expense' THEN SUM(l.debit_cents) - SUM(l.credit_cents)
    ELSE 0
  END AS amount_cents
FROM journal_entries e
JOIN journal_lines l ON l.entry_id = e.id
JOIN chart_accounts a ON a.id = l.account_id AND a.household_id = e.household_id
WHERE e.recognized AND a.account_type IN ('income', 'expense')
GROUP BY e.household_id, substr(e.date_key, 1, 7), a.account_type, a.code, a.name;

CREATE OR REPLACE VIEW v_net_worth AS
SELECT
  household_id,
  SUM(CASE WHEN account_type = 'asset' THEN net_cents ELSE 0 END) AS asset_cents,
  SUM(CASE WHEN account_type = 'liability' THEN -net_cents ELSE 0 END) AS liability_cents,
  SUM(CASE WHEN account_type = 'income' THEN -net_cents ELSE 0 END) AS income_cents,
  SUM(CASE WHEN account_type = 'expense' THEN net_cents ELSE 0 END) AS expense_cents,
  SUM(CASE WHEN account_type = 'asset' THEN net_cents WHEN account_type = 'liability' THEN net_cents ELSE 0 END) AS net_worth_cents,
  SUM(CASE WHEN account_type = 'income' THEN -net_cents WHEN account_type = 'expense' THEN -net_cents ELSE 0 END) AS net_income_cents,
  SUM(CASE WHEN account_type = 'equity' THEN -net_cents ELSE 0 END) AS equity_cents
FROM v_trial_balance
GROUP BY household_id;

CREATE OR REPLACE VIEW v_catalog AS
SELECT 'member' AS kind, id, household_id, name FROM members
UNION ALL
SELECT 'chart', id, household_id, name FROM chart_accounts
UNION ALL
SELECT 'category', id, household_id, name FROM categories;
`;
