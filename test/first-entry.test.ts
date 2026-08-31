import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inviteFromText, isValidInviteToken } from "../src/core/invite.ts";
import { legacyRecoveryInputFromInvite } from "../src/Pairing.tsx";

describe("first-time entry surface", () => {
  const app = readFileSync("src/App.tsx", "utf8");
  const join = readFileSync("src/Pairing.tsx", "utf8");
  const scanner = readFileSync("src/WelcomeQrScanner.tsx", "utf8");

  it("uses one Google-first account door before create and join choices", () => {
    expect(app).toContain("Continue with Google");
    expect(app).not.toContain("Login with Google");
    expect(app).toContain("Create household");
    expect(app).toContain("Join household");
    expect(app).toContain('continueWithGoogle("login")');
    expect(app).toContain("Choose your household");
    expect(app).not.toMatch(/found\.length === 1[\s\S]*openDiscoveredLedger/);
  });

  it("makes QR entry choose Google, auto-open only the redeemed target, and exit a full house safely", () => {
    expect(app).toContain("startQrInviteGoogleSignIn(authInvite.token, env)");
    expect(app).toContain("{ selectAccount: true }");
    expect(app).toMatch(/discoveredHouseholdForTarget\(found, \{[\s\S]*householdId: redeemed\.householdId,[\s\S]*memberId: redeemed\.memberId \?\? null/);
    expect(app).toMatch(/await openDiscoveredLedger\(\{[\s\S]*householdId: match\.household\.householdId,[\s\S]*memberId: match\.memberId,[\s\S]*\}, found\)/);
    expect(app).toContain("This house is full");
    expect(app).toContain("Back to Google sign-in");
    expect(app).toContain("await deactivateHouseholdSelection(environment)");
    expect(app).not.toContain("await clearHousehold(environment, fullHouseInvite");
  });

  it("keeps destructive Development reset controls separate from opening households", () => {
    expect(app).toContain("Start from scratch");
    expect(app).toContain("Development reset tools");
    expect(app).toMatch(/tab === "more"[\s\S]*Start from scratch[\s\S]*Account/);
    expect(app).toContain('aria-describedby="start-from-scratch-home"');
  });

  it("makes Google links and QR normal while moving legacy entry under Advanced recovery", () => {
    expect(join).toContain("Google invitation");
    expect(join).toContain("Scan invitation QR code");
    expect(join).toContain("Advanced recovery");
    expect(join).toContain("Three-word code or recovery secret");
    expect(join).toContain("Import Hearth Pass");
  });

  it("uses the existing code/link parser instead of inventing auth semantics", () => {
    expect(inviteFromText("https://hearth.example/?join=cedar-lantern-maple")).toBe("cedar-lantern-maple");
    expect(isValidInviteToken("cedar lantern maple")).toBe(true);
    expect(isValidInviteToken("ABC")).toBe(false);
  });

  it("routes scanned legacy QR values into Advanced recovery without stealing Google invites", () => {
    expect(legacyRecoveryInputFromInvite("cedar lantern maple")).toBe("cedar lantern maple");
    expect(legacyRecoveryInputFromInvite("https://hearth.example/?join=cedar-lantern-maple"))
      .toBe("https://hearth.example/?join=cedar-lantern-maple");
    expect(legacyRecoveryInputFromInvite('{"version":1,"household":{}}'))
      .toBe('{"version":1,"household":{}}');
    expect(legacyRecoveryInputFromInvite("a".repeat(64))).toBe("");
    expect(join).toContain("setRecoveryInput(legacyRecoveryInputFromInvite(inviteInput))");
  });

  it("opens a rear-facing mobile camera and scans QR values", () => {
    expect(scanner).toContain("getUserMedia");
    expect(scanner).toContain('facingMode: { ideal: "environment" }');
    expect(scanner).toContain('formats: ["qr_code"]');
    expect(scanner).toContain("await onDetected(value)");
    expect(scanner).toMatch(/mobile-only/i);
  });

  it("keeps the education quest as explicit future roadmap work", () => {
    const roadmap = readFileSync("docs/HEARTH_ROADMAP.md", "utf8");
    expect(roadmap).toMatch(/Future financial-education academy \(not implemented\)/);
    expect(roadmap).toMatch(/age-five concepts/);
    expect(roadmap).toMatch(/CPA-level topics/);
  });
});
