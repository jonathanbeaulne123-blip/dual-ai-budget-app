import { describe, expect, it } from "vitest";
import {
  addPracticeDraft,
  buildFoundationRegistry,
  buildProgressIdentity,
  chooseDialogueZone,
  computeFocusGeometry,
  copyPracticeToRealDraftStub,
  createEmptyProgress,
  createMemoryProgressStore,
  createPracticeSession,
  destroyPracticeSession,
  firstSceneId,
  getScene,
  initialCoordinatorState,
  isEligibleForAutoStart,
  isNonsemanticNoise,
  isOnboardingFoundationEnabled,
  makeDiagnostic,
  assertDiagnosticSafe,
  markCompleted,
  markSceneComplete,
  markSkipped,
  nextSceneId,
  practiceAffectsAcceptedMoney,
  practiceMayTouchContinuity,
  practiceMayTouchHousehold,
  practiceMayTouchPglite,
  progressStorageKey,
  reduceOnboarding,
  requireValidRegistry,
  resolveNextAfterScene,
  resumeSceneId,
  advanceRouteToFocus,
  validateOnboardingRegistry,
  type OnboardingRegistry,
} from "../src/core/onboarding/index.ts";

describe("onboarding registry", () => {
  it("accepts the foundation registry", () => {
    const registry = buildFoundationRegistry();
    expect(validateOnboardingRegistry(registry)).toEqual([]);
    expect(() => requireValidRegistry(registry)).not.toThrow();
    expect(firstSceneId(registry)).toBe("foundation.welcome");
  });

  it("rejects duplicate scene ids and unsafe real-confirm resume", () => {
    const base = buildFoundationRegistry();
    const dup: OnboardingRegistry = {
      ...base,
      scenes: [...base.scenes, { ...base.scenes[0]!, id: base.scenes[0]!.id }],
    };
    expect(validateOnboardingRegistry(dup).some((i) => i.code === "duplicate-scene")).toBe(true);

    const unsafe: OnboardingRegistry = {
      ...base,
      scenes: base.scenes.map((s, i) =>
        i === 0
          ? { ...s, safety: "real-confirm", resume: "same-step" }
          : s,
      ),
    };
    expect(validateOnboardingRegistry(unsafe).some((i) => i.code === "unsafe-resume")).toBe(true);
  });
});

describe("onboarding coordinator", () => {
  const registry = requireValidRegistry(buildFoundationRegistry());

  function ctx(_sceneId = "foundation.welcome") {
    return {
      registry,
      state: initialCoordinatorState(),
      activeSceneId: null as string | null,
    };
  }

  it("advances only on matching semantic actions", () => {
    let c = ctx();
    c = reduceOnboarding(c, { type: "START", sceneId: "foundation.welcome" });
    c = advanceRouteToFocus(c);
    c = reduceOnboarding(c, { type: "FOCUS_DONE" });
    c = reduceOnboarding(c, { type: "TYPE_DONE" });
    expect(c.state.kind).toBe("waiting-action");

    c = reduceOnboarding(c, {
      type: "SEMANTIC_ACTION",
      action: { kind: "nav-tab", tab: "more" },
      sceneId: "foundation.welcome",
      memberKey: "m1",
      householdId: "h1",
      environment: "development",
    });
    expect(c.state.kind).toBe("reacting");
    if (c.state.kind === "reacting") expect(c.state.outcome).toBe("mistake");

    c = reduceOnboarding(c, { type: "REACTION_DONE" });
    expect(c.state.kind).toBe("waiting-action");

    c = reduceOnboarding(c, {
      type: "SEMANTIC_ACTION",
      action: { kind: "tap-target", targetId: "home.root" },
      sceneId: "foundation.welcome",
      memberKey: "m1",
      householdId: "h1",
      environment: "development",
    });
    expect(c.state.kind).toBe("reacting");
    if (c.state.kind === "reacting") expect(c.state.outcome).toBe("success");
  });

  it("ignores stale scene semantic events and nonsemantic noise kinds", () => {
    expect(isNonsemanticNoise("timer")).toBe(true);
    expect(isNonsemanticNoise("toast")).toBe(true);
    expect(isNonsemanticNoise("model-reply")).toBe(true);

    let c = ctx();
    c = reduceOnboarding(c, { type: "START", sceneId: "foundation.welcome" });
    c = advanceRouteToFocus(c);
    c = reduceOnboarding(c, { type: "FOCUS_DONE" });
    c = reduceOnboarding(c, { type: "TYPE_DONE" });
    const before = c.state;
    c = reduceOnboarding(c, {
      type: "SEMANTIC_ACTION",
      action: { kind: "tap-target", targetId: "home.root" },
      sceneId: "foundation.nav-more",
      memberKey: "m1",
      householdId: "h1",
      environment: "development",
    });
    expect(c.state).toEqual(before);
  });

  it("skips to skipped and replays from first scene", () => {
    let c = ctx();
    c = reduceOnboarding(c, { type: "START", sceneId: "foundation.welcome" });
    c = reduceOnboarding(c, { type: "SKIP" });
    expect(c.state.kind).toBe("skipped");
    c = reduceOnboarding(c, { type: "REPLAY" });
    expect(c.state.kind).toBe("entering");
    if (c.state.kind === "entering") expect(c.state.sceneId).toBe("foundation.welcome");
  });

  it("reports target-missing and recovers", () => {
    let c = ctx();
    c = reduceOnboarding(c, { type: "START", sceneId: "foundation.welcome" });
    c = reduceOnboarding(c, { type: "TARGET_MISSING", targetId: "home.root" });
    expect(c.state.kind).toBe("target-missing");
    c = reduceOnboarding(c, { type: "TARGET_RECOVERED" });
    expect(c.state.kind).toBe("entering");
  });
});

describe("onboarding progress identity", () => {
  it("keys progress by env+household+member+version+shell", () => {
    const identity = buildProgressIdentity({
      environment: "development",
      householdId: "HH-1",
      memberKey: "google-sub",
      registryVersion: "foundation-a.1",
      shell: "phone",
    });
    expect(progressStorageKey(identity)).toContain("development");
    expect(progressStorageKey(identity)).toContain(encodeURIComponent("HH-1"));
    expect(progressStorageKey(identity)).toContain("phone");
  });

  it("eligibility, skip, resume, and completion", async () => {
    const store = createMemoryProgressStore();
    const identity = buildProgressIdentity({
      environment: "development",
      householdId: "HH-1",
      memberKey: "m1",
      registryVersion: "foundation-a.1",
      shell: "phone",
    });
    expect(isEligibleForAutoStart(null).eligible).toBe(true);

    let record = createEmptyProgress(identity, "2026-08-27T12:00:00.000Z");
    record = markSceneComplete(record, {
      sceneId: "foundation.welcome",
      chapterId: "foundation",
      chapterComplete: false,
      safeCheckpoint: true,
      nowIso: "2026-08-27T12:01:00.000Z",
    });
    await store.save(record);
    const loaded = await store.load(identity);
    expect(resumeSceneId(loaded, "foundation.welcome")).toBe("foundation.welcome");
    expect(isEligibleForAutoStart(loaded).eligible).toBe(true);

    await store.save(markSkipped(identity, "2026-08-27T12:02:00.000Z", loaded));
    expect(isEligibleForAutoStart(await store.load(identity))).toEqual({
      eligible: false,
      reason: "skipped",
    });

    await store.save(markCompleted(identity, "2026-08-27T12:03:00.000Z", await store.load(identity)));
    expect(isEligibleForAutoStart(await store.load(identity)).reason).toBe("completed");
  });
});

describe("onboarding geometry", () => {
  it("places phone dialogue opposite the target", () => {
    const viewport = { x: 0, y: 0, width: 390, height: 844 };
    const lower = chooseDialogueZone({
      viewport,
      target: { x: 40, y: 600, width: 100, height: 40 },
      insets: { top: 0, right: 0, bottom: 0, left: 0, header: 48, nav: 64, keyboard: 0, hercules: 80 },
      shell: "phone",
    });
    expect(lower.zone).toBe("top");

    const upper = chooseDialogueZone({
      viewport,
      target: { x: 40, y: 120, width: 100, height: 40 },
      insets: { top: 0, right: 0, bottom: 0, left: 0, header: 48, nav: 64, keyboard: 0, hercules: 80 },
      shell: "phone",
    });
    expect(upper.zone).toBe("bottom");
  });

  it("computes desktop quadrant away from target", () => {
    const result = computeFocusGeometry({
      viewport: { x: 0, y: 0, width: 1100, height: 800 },
      target: { x: 800, y: 500, width: 120, height: 48 },
      shell: "desktop",
    });
    expect(result.ok).toBe(true);
    expect(result.dialogueZone.startsWith("desktop-")).toBe(true);
  });

  it("covers phone and desktop widths used in proofs", () => {
    for (const width of [320, 390, 430, 720, 1024, 1280]) {
      const geometry = computeFocusGeometry({
        viewport: { x: 0, y: 0, width, height: width < 720 ? 700 : 900 },
        target: { x: 24, y: 200, width: 80, height: 40 },
        shell: width < 720 ? "phone" : "desktop",
        insets: { keyboard: width < 720 ? 280 : 0 },
      });
      expect(geometry.ok).toBe(true);
    }
  });
});

describe("practice session D-128", () => {
  it("destroys without claiming household/pglite/continuity/money effects", () => {
    let session = createPracticeSession({
      environment: "development",
      householdId: "HH-1",
      memberKey: "m1",
      chapterId: "foundation",
    });
    session = addPracticeDraft(session, {
      kind: "transaction",
      amountCents: 1250,
      label: "Practice coffee",
    });
    expect(practiceAffectsAcceptedMoney(session)).toBe(false);
    expect(practiceMayTouchHousehold()).toBe(false);
    expect(practiceMayTouchPglite()).toBe(false);
    expect(practiceMayTouchContinuity()).toBe(false);

    const copy = copyPracticeToRealDraftStub(session, session.drafts[0]!.id);
    expect(copy.ok).toBe(true);
    if (copy.ok) expect(copy.note).toMatch(/Confirm/);

    session = destroyPracticeSession(session);
    expect(session.destroyed).toBe(true);
    expect(session.drafts).toEqual([]);
    expect(copyPracticeToRealDraftStub(session, "pd-1").ok).toBe(false);
  });
});

describe("diagnostics and feature flag", () => {
  it("records only safe diagnostic fields", () => {
    const diag = makeDiagnostic({
      code: "focus-ok",
      state: { kind: "focusing", sceneId: "foundation.welcome" },
      sceneId: "foundation.welcome",
      targetId: "home.root",
      geometryReason: "target-lower-half",
    });
    expect(() => assertDiagnosticSafe(diag)).not.toThrow();
  });

  it("gates foundation on VITE_ONBOARDING_FOUNDATION=1", () => {
    expect(isOnboardingFoundationEnabled({ VITE_ONBOARDING_FOUNDATION: "1" })).toBe(true);
    expect(isOnboardingFoundationEnabled({ VITE_ONBOARDING_FOUNDATION: "" })).toBe(false);
  });
});

describe("scene sequencing", () => {
  it("walks foundation scenes then completes", () => {
    const registry = buildFoundationRegistry();
    const a = firstSceneId(registry)!;
    const b = nextSceneId(registry, a)!;
    const c = nextSceneId(registry, b)!;
    expect(getScene(registry, a)?.id).toBe("foundation.welcome");
    expect(b).toBe("foundation.nav-more");
    expect(c).toBe("foundation.ready");
    expect(resolveNextAfterScene(registry, c)).toBeNull();
  });
});
