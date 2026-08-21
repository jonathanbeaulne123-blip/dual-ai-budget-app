const WRITE_WORDS = /\b(insert|update|delete|drop|alter|truncate|grant|revoke|copy|call|do|create|comment|security|vacuum|reindex|cluster|lock|notify|listen|load|reset|set|prepare|execute|deallocate|discard|declare|fetch|move|close|checkpoint|reassign|refresh|import|attach|detach)\b/i;

function stripLiterals(sql: string): string {
  return sql
    .replace(/--.*$/gm, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/"(?:""|[^"])*"/g, "\"\"");
}

export function assertReadOnlySelect(sql: string): string {
  const stripped = stripLiterals(sql);
  const trimmed = stripped.trim().replace(/;+\s*$/, "");
  if (!trimmed) throw new Error("Type a SELECT to read the books.");
  if (trimmed.includes(";")) throw new Error("One statement at a time.");
  if (!/^(with|select|explain|values|show|table)\b/i.test(trimmed)) {
    throw new Error("Read-only: start with SELECT, WITH, EXPLAIN, SHOW, or TABLE.");
  }
  if (WRITE_WORDS.test(trimmed)) {
    throw new Error("That statement would change the books. Only reads are allowed here.");
  }
  return sql.replace(/--.*$/gm, " ").replace(/\/\*[\s\S]*?\*\//g, " ").trim().replace(/;+\s*$/, "");
}
