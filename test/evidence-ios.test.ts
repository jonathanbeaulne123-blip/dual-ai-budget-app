import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const root = new URL("../apps/hearth-capture-ios/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, root), "utf8");

describe("Hearth iPhone capture scaffold", () => {
  it("uses selected-item sharing, scoped files, account binding, and nonce replay checks", () => {
    expect(read("HearthShare/Info.plist")).toContain("NSExtensionActivationSupportsFileWithMaxCount");
    expect(read("HearthShare/ShareViewController.swift")).toContain("inputItems.count == 1");
    const upload = read("HearthCapture/EvidenceUpload.swift");
    expect(upload).toContain("startAccessingSecurityScopedResource");
    expect(upload).toContain("usedNonces");
    expect(upload).toContain("changedAccount");
    expect(upload).toContain("10 * 1024 * 1024");
    expect(upload).toContain('X-Hearth-App-ID');
    expect(upload).toContain('X-Evidence-Capture-Kind');
    expect(upload).toContain('Content-Type');
    expect(upload).toContain('com.hearth.capture.dev');
  });

  it("declares no broad Photos, Contacts, Mail, or notification entitlement", () => {
    const files = [read("HearthCapture/HearthCapture.entitlements"), read("HearthShare/HearthShare.entitlements"), read("project.yml")].join("\n");
    expect(files).not.toMatch(/photos|contacts|mail|notification|keychain-access-groups/i);
  });
});
