import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inviteFromText, isValidInviteToken } from "../src/core/invite.ts";

describe("first-time entry surface", () => {
  const app = readFileSync("src/App.tsx", "utf8");
  const scanner = readFileSync("src/WelcomeQrScanner.tsx", "utf8");

  it("offers the three focused real-account paths", () => {
    expect(app).toContain("Create household with Google");
    expect(app).toContain("Login with Google");
    expect(app).toContain("Join with QR code");
    expect(app).not.toContain("Join with Code/Link");
    expect(app).toContain('continueWithGoogle("create")');
    expect(app).toContain('continueWithGoogle("login")');
  });

  it("puts Start from scratch on the Development welcome home, not only after Google discovery", () => {
    expect(app).toContain("Start from scratch");
    expect(app).toMatch(/discoveredLedgers\.length === 0[\s\S]*Wipe leftover test households[\s\S]*Start from scratch/);
    expect(app).toMatch(/tab === "more"[\s\S]*Start from scratch[\s\S]*Account/);
    expect(app).toContain('aria-describedby="start-from-scratch-home"');
  });

  it("uses the existing code/link parser instead of inventing auth semantics", () => {
    expect(inviteFromText("https://hearth.example/?join=cedar-lantern-maple")).toBe("cedar-lantern-maple");
    expect(isValidInviteToken("cedar lantern maple")).toBe(true);
    expect(isValidInviteToken("ABC")).toBe(false);
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
