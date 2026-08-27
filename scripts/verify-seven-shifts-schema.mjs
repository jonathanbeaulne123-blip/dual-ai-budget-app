import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const EXPECTED_COLUMNS = [
  { name: "connection_id", type: "TEXT", notnull: 0, dflt_value: null, pk: 1 },
  { name: "environment", type: "TEXT", notnull: 1, dflt_value: null, pk: 0 },
  { name: "auth_user_id", type: "TEXT", notnull: 1, dflt_value: null, pk: 0 },
  { name: "household_id", type: "TEXT", notnull: 1, dflt_value: null, pk: 0 },
  { name: "member_id", type: "TEXT", notnull: 1, dflt_value: null, pk: 0 },
  { name: "job_id", type: "TEXT", notnull: 1, dflt_value: null, pk: 0 },
  { name: "state", type: "TEXT", notnull: 1, dflt_value: null, pk: 0 },
  { name: "state_version", type: "INTEGER", notnull: 1, dflt_value: "1", pk: 0 },
  { name: "sealed_private", type: "TEXT", notnull: 0, dflt_value: null, pk: 0 },
  { name: "key_version", type: "INTEGER", notnull: 1, dflt_value: "1", pk: 0 },
  { name: "company_label", type: "TEXT", notnull: 1, dflt_value: null, pk: 0 },
  { name: "created_at", type: "TEXT", notnull: 1, dflt_value: null, pk: 0 },
  { name: "updated_at", type: "TEXT", notnull: 1, dflt_value: null, pk: 0 },
  { name: "last_pull_at", type: "TEXT", notnull: 0, dflt_value: null, pk: 0 },
  { name: "revoked_at", type: "TEXT", notnull: 0, dflt_value: null, pk: 0 },
];

export function verifySevenShiftsSchema(payload) {
  const statements = (Array.isArray(payload) ? payload : [payload]).flatMap((entry) => Array.isArray(entry?.results) ? [entry.results] : []);
  if (statements.length !== 5) throw new Error("D1 schema verification returned an unexpected result shape.");

  const actualColumns = statements[0].map((row) => ({
    name: row.name,
    type: row.type,
    notnull: Number(row.notnull_value),
    dflt_value: row.dflt_value == null ? null : String(row.dflt_value),
    pk: Number(row.pk),
  }));
  if (JSON.stringify(actualColumns) !== JSON.stringify(EXPECTED_COLUMNS)) {
    throw new Error("D1 columns, order, nullability, defaults, or primary key do not match migration 0002.");
  }

  const tableSql = String(statements[1][0]?.table_sql || "").replace(/\s+/g, " ").toLowerCase();
  if (!tableSql.includes("check (environment = 'development')") || !tableSql.includes("check (state in ('ready', 'revoked'))")) {
    throw new Error("D1 Development/state CHECK constraints do not match migration 0002.");
  }

  const ownerIndex = statements[2][0];
  if (statements[2].length !== 1 || ownerIndex?.name !== "seven_shifts_connections_owner" || Number(ownerIndex?.is_unique) !== 0 || ownerIndex?.origin !== "c" || Number(ownerIndex?.partial) !== 0) {
    throw new Error("D1 owner index definition does not match migration 0002.");
  }
  const indexColumns = statements[3].map((row) => row.name);
  if (JSON.stringify(indexColumns) !== JSON.stringify(["environment", "auth_user_id", "household_id", "member_id", "updated_at"])) {
    throw new Error("D1 owner index columns do not match migration 0002.");
  }
  if (Number(statements[4][0]?.row_count) !== 0) {
    throw new Error("D1 first-time setup requires an empty seven_shifts_connections table.");
  }

  return "D1 schema verified exactly: 15 columns, Development/state constraints, owner index, and zero connection rows.";
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  const schemaPath = process.argv[2];
  if (!schemaPath) throw new Error("A Wrangler D1 schema JSON path is required.");
  const payload = JSON.parse(readFileSync(schemaPath, "utf8"));
  console.log(verifySevenShiftsSchema(payload));
}
