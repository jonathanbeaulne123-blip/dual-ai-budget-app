import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { catalogHousehold } from "../src/core/index.ts";
import { markPendingTransport, markSynchronized } from "../src/core/sharing.ts";
import type { ContinuitySyncSource } from "../src/continuityCoordinator.ts";
import {
  buildSyncFreshness,
  continuityTransportLabel,
  inferLastSharedActor,
  sharedHouseholdFreshnessCopy,
  suppressesCommandSyncChrome,
} from "../src/syncFreshness.ts";
import { hearthArtifactDir } from "./artifact-dir.ts";

const NOW = new Date("2026-08-26T18:00:00.000Z");
const TWO_MIN_AGO = "2026-08-26T17:58:00.000Z";

function baseHousehold() {
  return markSynchronized({
    ...catalogHousehold(),
    revision: 12,
    lastCommittedAt: TWO_MIN_AGO,
    linked: true,
  });
}

describe("continuityTransportLabel", () => {
  it("shows Live when Realtime is subscribed", () => {
    expect(continuityTransportLabel({
      realtimeEnabled: true,
      realtimeStatus: "SUBSCRIBED",
      offline: false,
    })).toEqual({ primary: "Live", mode: "live" });
  });

  it("shows poll fallback when Realtime is disconnected", () => {
    expect(continuityTransportLabel({
      realtimeEnabled: true,
      realtimeStatus: "CLOSED",
      offline: false,
    }).primary).toMatch(/Checking every 4 s/);
  });

  it("shows poll when Realtime feature is off", () => {
    expect(continuityTransportLabel({
      realtimeEnabled: false,
      realtimeStatus: null,
      offline: false,
    }).mode).toBe("poll");
  });

  it("prefers offline over transport state", () => {
    expect(continuityTransportLabel({
      realtimeEnabled: true,
      realtimeStatus: "SUBSCRIBED",
      offline: true,
    })).toEqual({ primary: "Offline · will sync when you're back", mode: "offline" });
  });

  it("shows Connecting when Realtime is joining", () => {
    expect(continuityTransportLabel({
      realtimeEnabled: true,
      realtimeStatus: "JOINING",
      offline: false,
    })).toEqual({ primary: "Connecting…", mode: "connecting" });
  });
});

describe("inferLastSharedActor", () => {
  it("maps the latest shared transaction author", () => {
    const household = baseHousehold();
    const viewer = household.members[0]!.id;
    const partner = household.members[1]!.id;
    const sample = household.transactions[0]!;
    household.transactions = [
      ...household.transactions,
      {
        ...sample,
        id: "TX-SHARED",
        visibility: "household",
        createdBy: partner,
        createdAt: "2026-08-26T17:59:00.000Z",
        updatedAt: "2026-08-26T17:59:00.000Z",
      },
    ];

    expect(inferLastSharedActor(household, viewer).label).toBe(household.members[1]!.name);
    expect(inferLastSharedActor(household, partner).label).toBe("You");
  });

  it("ignores personal transactions", () => {
    const household = baseHousehold();
    const viewer = household.members[0]!.id;
    const partner = household.members[1]!.id;
    const sample = household.transactions[0]!;
    household.transactions = [
      ...household.transactions,
      {
        ...sample,
        id: "TX-PERSONAL",
        visibility: "personal",
        createdBy: partner,
        createdAt: "2026-08-26T17:59:00.000Z",
        updatedAt: "2026-08-26T17:59:00.000Z",
      },
    ];

    expect(inferLastSharedActor(household, viewer).label).not.toBe(household.members[1]!.name);
  });
});

describe("buildSyncFreshness", () => {
  it("shows revision, relative time, and live transport when synchronized", () => {
    const household = baseHousehold();
    const display = buildSyncFreshness({
      household,
      viewerMemberId: household.members[0]!.id,
      realtimeEnabled: true,
      realtimeStatus: "SUBSCRIBED",
      offline: false,
      pendingOutboxCount: 0,
      hasOpenConflict: false,
      lastReconcileAt: TWO_MIN_AGO,
      lastReconcileSource: "realtime" as ContinuitySyncSource,
      now: NOW,
    });

    expect(display.visible).toBe(true);
    expect(display.transportPrimary).toBe("Live");
    expect(display.revisionLine).toBe("rev 12");
    expect(display.updatedLine).toBe("Updated 2 mins ago");
    expect(display.sourceLine).toBe("via live update");
    expect(display.blocksSyncedLabel).toBe(false);
  });

  it("never blocks synced label on healthy pending alone when mode is still synchronized", () => {
    const household = baseHousehold();
    const display = buildSyncFreshness({
      household,
      viewerMemberId: household.members[0]!.id,
      realtimeEnabled: true,
      realtimeStatus: "SUBSCRIBED",
      offline: false,
      pendingOutboxCount: 1,
      hasOpenConflict: false,
      lastReconcileAt: null,
      lastReconcileSource: null,
      now: NOW,
    });

    expect(display.transportPrimary).toBe("Sharing…");
    expect(display.blocksSyncedLabel).toBe(true);
    expect(display.showPendingHint).toBe(true);
  });

  it("shows poll fallback copy when Realtime is not subscribed", () => {
    const household = baseHousehold();
    const display = buildSyncFreshness({
      household,
      viewerMemberId: household.members[0]!.id,
      realtimeEnabled: true,
      realtimeStatus: "CHANNEL_ERROR",
      offline: false,
      pendingOutboxCount: 0,
      hasOpenConflict: false,
      lastReconcileAt: null,
      lastReconcileSource: "poll",
      now: NOW,
    });

    expect(display.transportPrimary).toMatch(/Checking every 4 s/);
    expect(display.transportMode).toBe("poll");
  });

  it("hides for local-only households", () => {
    const household = catalogHousehold();
    const display = buildSyncFreshness({
      household,
      viewerMemberId: household.members[0]!.id,
      realtimeEnabled: false,
      realtimeStatus: null,
      offline: false,
      pendingOutboxCount: 0,
      hasOpenConflict: false,
      lastReconcileAt: null,
      lastReconcileSource: null,
      now: NOW,
    });

    expect(display.visible).toBe(false);
  });

  it("marks conflict as blocking synced label", () => {
    const household = markPendingTransport(baseHousehold(), "conflict");
    const display = buildSyncFreshness({
      household: { ...household, sharing: { ...household.sharing, mode: "conflicted" } },
      viewerMemberId: household.members[0]!.id,
      realtimeEnabled: true,
      realtimeStatus: "SUBSCRIBED",
      offline: false,
      pendingOutboxCount: 0,
      hasOpenConflict: true,
      lastReconcileAt: null,
      lastReconcileSource: null,
      now: NOW,
    });

    expect(display.transportPrimary).toBe("Needs attention");
    expect(display.blocksSyncedLabel).toBe(true);
    expect(display.tone).toBe("warning");
    expect(display.actionKind).toBe("retry");
    expect(display.actionLabel).toBe("Retry now");
  });

  it("offers retry on unhealthy pending transport", () => {
    const household = markPendingTransport(baseHousehold(), "offline");
    const display = buildSyncFreshness({
      household,
      viewerMemberId: household.members[0]!.id,
      realtimeEnabled: true,
      realtimeStatus: "SUBSCRIBED",
      offline: true,
      pendingOutboxCount: 1,
      hasOpenConflict: false,
      lastReconcileAt: null,
      lastReconcileSource: null,
      now: NOW,
    });

    expect(display.transportPrimary).toBe("Offline · waiting to share");
    expect(display.actionKind).toBe("retry");
    expect(display.actionLabel).toBe("Retry now");
  });

  it("suppresses duplicate command chip and banner when freshness is visible", () => {
    const household = markPendingTransport(baseHousehold(), "offline");
    const display = buildSyncFreshness({
      household,
      viewerMemberId: household.members[0]!.id,
      realtimeEnabled: true,
      realtimeStatus: "SUBSCRIBED",
      offline: true,
      pendingOutboxCount: 1,
      hasOpenConflict: false,
      lastReconcileAt: null,
      lastReconcileSource: null,
      now: NOW,
    });

    const suppressed = suppressesCommandSyncChrome(
      display,
      "Waiting to share",
      "Saved here. Not shared yet.",
    );
    expect(suppressed.hideChip).toBe(true);
    expect(suppressed.hideBanner).toBe(true);
    expect(suppressesCommandSyncChrome(display, "Recovery needed", null).hideChip).toBe(false);
  });
});

describe("sharedHouseholdFreshnessCopy", () => {
  it("does not claim synced when outbox is pending", () => {
    const household = markSynchronized(baseHousehold());
    const display = buildSyncFreshness({
      household,
      viewerMemberId: household.members[0]!.id,
      realtimeEnabled: true,
      realtimeStatus: "SUBSCRIBED",
      offline: false,
      pendingOutboxCount: 2,
      hasOpenConflict: false,
      lastReconcileAt: null,
      lastReconcileSource: null,
      now: NOW,
    });

    const copy = sharedHouseholdFreshnessCopy(display, "synced");
    expect(copy).not.toMatch(/up to date/i);
    expect(copy).toMatch(/sharing/i);
  });

  it("allows current copy when synchronized and no blockers", () => {
    const household = baseHousehold();
    const display = buildSyncFreshness({
      household,
      viewerMemberId: household.members[0]!.id,
      realtimeEnabled: true,
      realtimeStatus: "SUBSCRIBED",
      offline: false,
      pendingOutboxCount: 0,
      hasOpenConflict: false,
      lastReconcileAt: TWO_MIN_AGO,
      lastReconcileSource: "realtime",
      now: NOW,
    });

    expect(sharedHouseholdFreshnessCopy(display, "synced")).toMatch(/Updated 2 mins ago/);
    expect(sharedHouseholdFreshnessCopy(display, "synced")).toMatch(/Live/);
  });
});

describe("sync freshness preview artifact", () => {
  it("writes linked-household preview HTML for visual review", () => {
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
    const household = markSynchronized({
      ...catalogHousehold(),
      linked: true,
      revision: 42,
      lastCommittedAt: new Date(Date.now() - 120_000).toISOString(),
    });
    const memberId = household.members[0]?.id ?? "";

    const renderRow = (display: ReturnType<typeof buildSyncFreshness>) => {
      if (!display.visible) return "";
      const action = display.actionLabel
        ? `<button type="button" class="sync-freshness__action" aria-label="${display.actionLabel}">↻</button>`
        : "";
      return `<div class="sync-freshness sync-freshness--${display.tone} sync-freshness--${display.transportMode}" role="status">
        <div class="sync-freshness__content">
          <span class="sync-freshness__transport">${display.transportPrimary}</span>
          <span class="sync-freshness__revision">${display.revisionLine ?? ""}</span>
          <span class="sync-freshness__updated">${display.updatedLine ?? ""}</span>
          ${display.actorLine ? `<span class="sync-freshness__actor">${display.actorLine}</span>` : ""}
          ${display.sourceLine ? `<span class="sync-freshness__source muted">${display.sourceLine}</span>` : ""}
        </div>
        ${action}
      </div>`;
    };

    const pendingHousehold = markPendingTransport(baseHousehold(), "offline");
    const conflictHousehold = {
      ...markPendingTransport(baseHousehold(), "conflict"),
      sharing: { ...markPendingTransport(baseHousehold(), "conflict").sharing, mode: "conflicted" as const },
    };

    const states: Array<[string, ReturnType<typeof buildSyncFreshness>]> = [
      ["waiting-to-share", buildSyncFreshness({
        household: pendingHousehold,
        viewerMemberId: memberId,
        realtimeEnabled: true,
        realtimeStatus: "SUBSCRIBED",
        offline: true,
        pendingOutboxCount: 2,
        hasOpenConflict: false,
        lastReconcileAt: pendingHousehold.lastCommittedAt,
        lastReconcileSource: "focus",
        now: NOW,
      })],
      ["needs-attention", buildSyncFreshness({
        household: conflictHousehold,
        viewerMemberId: memberId,
        realtimeEnabled: true,
        realtimeStatus: "SUBSCRIBED",
        offline: false,
        pendingOutboxCount: 0,
        hasOpenConflict: true,
        lastReconcileAt: conflictHousehold.lastCommittedAt,
        lastReconcileSource: "realtime",
        now: NOW,
      })],
      ["live", buildSyncFreshness({
        household, viewerMemberId: memberId, realtimeEnabled: true, realtimeStatus: "SUBSCRIBED",
        offline: false, pendingOutboxCount: 0, hasOpenConflict: false,
        lastReconcileAt: household.lastCommittedAt, lastReconcileSource: "realtime",
      })],
      ["poll-fallback", buildSyncFreshness({
        household, viewerMemberId: memberId, realtimeEnabled: true, realtimeStatus: "CLOSED",
        offline: false, pendingOutboxCount: 0, hasOpenConflict: false,
        lastReconcileAt: household.lastCommittedAt, lastReconcileSource: "poll",
      })],
      ["quiet-pending", buildSyncFreshness({
        household, viewerMemberId: memberId, realtimeEnabled: true, realtimeStatus: "SUBSCRIBED",
        offline: false, pendingOutboxCount: 2, hasOpenConflict: false,
        lastReconcileAt: null, lastReconcileSource: null,
      })],
    ];

    const body = states.map(([label, display]) => `<section><h2>${label}</h2>${renderRow(display)}</section>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>T1-S6 freshness</title><style>${css}body{max-width:390px;margin:0 auto;padding:18px;font-family:system-ui,sans-serif}@media(min-width:720px){body{max-width:900px}}h2{font-size:12px;text-transform:uppercase;color:#666}</style></head><body>${body}</body></html>`;
    const outDir = hearthArtifactDir();
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "t1-s6-freshness-preview.html"), html);
    expect(html).toContain("sync-freshness--live");
    expect(html).toContain("Checking every 4 s");
    expect(html).toContain("Sharing…");
    expect(html).toContain("Offline · waiting to share");
    expect(html).toContain("Needs attention");
    expect(html).toContain("sync-freshness__action");
  });
});
