import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Evidence email ingress", () => {
  const worker = readFileSync(new URL("../workers/evidence.js", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../migrations/evidence/0001_evidence_mesh.sql", import.meta.url), "utf8");

  it("is independently disabled, uses high-entropy hashed aliases, and quarantines complete RFC822", () => {
    expect(worker).toContain("EVIDENCE_EMAIL_ENABLED");
    expect(worker).toContain("new Uint8Array(24)");
    expect(worker).toContain("await sha256(new TextEncoder().encode(match[1]))");
    expect(worker).toContain('"message/rfc822", bytes, "quarantined"');
    expect(migration).toContain("mailbox_hash TEXT PRIMARY KEY");
    expect(migration).not.toContain("sender_email");
    expect(migration).not.toContain("subject TEXT");
  });

  it("bounds raw MIME and contains no remote-content fetch path", () => {
    const emailFunction = worker.slice(worker.indexOf("export async function handleEvidenceEmail"), worker.indexOf("async function listEvidence"));
    expect(emailFunction).toContain("readStreamBytes(message.raw, MAX_BYTES)");
    expect(emailFunction).not.toContain("fetch(");
    expect(emailFunction).not.toContain("message.from");
  });
});
