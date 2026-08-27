import type {
  OnboardingChapter,
  OnboardingRegistry,
  OnboardingScene,
  SemanticDialogue,
} from "./types.ts";

export type RegistryValidationIssue = {
  code: string;
  message: string;
  id?: string;
};

/**
 * Foundation registry: representative Home/nav scenes only.
 * Full chapter storyboard content is Slice B+.
 */
export function buildFoundationRegistry(): OnboardingRegistry {
  const dialogue: SemanticDialogue[] = [
    {
      key: "welcome.home",
      meaning: "Welcome to the kitchen; Home is where we start.",
      tones: {
        gentle: "Welcome home. This is your kitchen table.",
        classic: "Home. Rain on the glass. We start here.",
        cheeky: "Bag's open. Wipe your paws — we start at Home.",
      },
    },
    {
      key: "nav.more",
      meaning: "More holds Replay and phone tools.",
      tones: {
        gentle: "More keeps Replay and the quieter tools.",
        classic: "More is the drawer. Replay lives there later.",
        cheeky: "More: the junk drawer with dignity. Replay hides here.",
      },
    },
    {
      key: "finale.ready",
      meaning: "Tutorial foundation complete; Ready for September.",
      tones: {
        gentle: "Foundation set. Ready for September when you are.",
        classic: "Paw trail complete. Ready for September.",
        cheeky: "Trail stamped. September won't know what hit it.",
      },
    },
  ];

  const scenes: OnboardingScene[] = [
    {
      id: "foundation.welcome",
      chapterId: "foundation",
      route: "home",
      targetId: "home.root",
      entrance: "bag",
      routePlan: [{ id: "bag-to-home", from: "bag", to: "target" }],
      dialogueKey: "welcome.home",
      dialoguePlacement: "auto-opposite-target",
      camera: "focus",
      expectedAction: { kind: "tap-target", targetId: "home.root" },
      safety: "no-write",
      resume: "same-step",
      successPose: "hop",
      mistakePose: "confused",
      safeCheckpoint: true,
    },
    {
      id: "foundation.nav-more",
      chapterId: "foundation",
      route: "home",
      targetId: "nav.more",
      entrance: "nav",
      routePlan: [
        { id: "to-nav", from: "current", to: "nav" },
        { id: "nav-to-more", from: "nav", to: "target" },
      ],
      dialogueKey: "nav.more",
      dialoguePlacement: "auto-opposite-target",
      camera: "focus",
      expectedAction: { kind: "nav-tab", tab: "more" },
      safety: "no-write",
      resume: "last-safe-step",
      successPose: "paw",
      mistakePose: "confused",
      safeCheckpoint: true,
    },
    {
      id: "foundation.ready",
      chapterId: "foundation",
      route: "home",
      entrance: "current",
      routePlan: [{ id: "celebrate", from: "current", to: "target" }],
      dialogueKey: "finale.ready",
      dialoguePlacement: "auto-opposite-target",
      camera: "celebration",
      expectedAction: { kind: "ready-for-september" },
      safety: "no-write",
      resume: "chapter-start",
      successPose: "celebrate",
      safeCheckpoint: true,
    },
  ];

  const chapters: OnboardingChapter[] = [
    {
      id: "foundation",
      title: "Foundation",
      sceneIds: scenes.map((s) => s.id),
      conceptShared: true,
    },
  ];

  return {
    version: "foundation-a.1",
    chapters,
    scenes,
    dialogue,
  };
}

export function validateOnboardingRegistry(registry: OnboardingRegistry): RegistryValidationIssue[] {
  const issues: RegistryValidationIssue[] = [];
  const chapterIds = new Set<string>();
  const sceneIds = new Set<string>();
  const dialogueKeys = new Set<string>();

  if (!registry.version.trim()) {
    issues.push({ code: "missing-version", message: "Registry version is required." });
  }

  for (const dialogue of registry.dialogue) {
    if (dialogueKeys.has(dialogue.key)) {
      issues.push({ code: "duplicate-dialogue", message: "Duplicate dialogue key.", id: dialogue.key });
    }
    dialogueKeys.add(dialogue.key);
  }

  for (const chapter of registry.chapters) {
    if (chapterIds.has(chapter.id)) {
      issues.push({ code: "duplicate-chapter", message: "Duplicate chapter id.", id: chapter.id });
    }
    chapterIds.add(chapter.id);
    if (!chapter.sceneIds.length) {
      issues.push({ code: "empty-chapter", message: "Chapter has no scenes.", id: chapter.id });
    }
  }

  for (const scene of registry.scenes) {
    if (sceneIds.has(scene.id)) {
      issues.push({ code: "duplicate-scene", message: "Duplicate scene id.", id: scene.id });
    }
    sceneIds.add(scene.id);

    if (!chapterIds.has(scene.chapterId)) {
      issues.push({
        code: "orphan-scene",
        message: `Scene chapter ${scene.chapterId} is not registered.`,
        id: scene.id,
      });
    }

    if (!dialogueKeys.has(scene.dialogueKey)) {
      issues.push({
        code: "missing-dialogue",
        message: `Dialogue key ${scene.dialogueKey} is missing.`,
        id: scene.id,
      });
    }

    if (scene.safety === "real-confirm" && scene.resume === "same-step") {
      issues.push({
        code: "unsafe-resume",
        message: "real-confirm scenes must not resume same-step (would replay Confirm).",
        id: scene.id,
      });
    }

    if (
      (scene.expectedAction.kind === "tap-target" || scene.camera === "focus") &&
      scene.expectedAction.kind !== "ready-for-september" &&
      scene.expectedAction.kind !== "reveal-only" &&
      !scene.targetId &&
      scene.expectedAction.kind === "tap-target"
    ) {
      issues.push({
        code: "missing-target",
        message: "tap-target scenes require targetId.",
        id: scene.id,
      });
    }

    if (scene.expectedAction.kind === "tap-target" && scene.targetId !== scene.expectedAction.targetId) {
      issues.push({
        code: "target-mismatch",
        message: "Scene targetId must match expectedAction.targetId.",
        id: scene.id,
      });
    }
  }

  for (const chapter of registry.chapters) {
    for (const sceneId of chapter.sceneIds) {
      if (!sceneIds.has(sceneId)) {
        issues.push({
          code: "missing-scene",
          message: `Chapter lists unknown scene ${sceneId}.`,
          id: chapter.id,
        });
      }
    }
  }

  const targetIds = registry.scenes.map((s) => s.targetId).filter(Boolean) as string[];
  const seenTargets = new Set<string>();
  for (const targetId of targetIds) {
    // Duplicate targets across scenes are allowed (same control, different lessons).
    seenTargets.add(targetId);
  }
  void seenTargets;

  return issues;
}

export function requireValidRegistry(registry: OnboardingRegistry): OnboardingRegistry {
  const issues = validateOnboardingRegistry(registry);
  if (issues.length) {
    throw new Error(`Invalid onboarding registry: ${issues.map((i) => i.code).join(", ")}`);
  }
  return registry;
}

export function getScene(registry: OnboardingRegistry, sceneId: string): OnboardingScene | null {
  return registry.scenes.find((s) => s.id === sceneId) ?? null;
}

export function getDialogue(registry: OnboardingRegistry, key: string): SemanticDialogue | null {
  return registry.dialogue.find((d) => d.key === key) ?? null;
}

export function firstSceneId(registry: OnboardingRegistry): string | null {
  const chapter = registry.chapters[0];
  return chapter?.sceneIds[0] ?? null;
}

export function nextSceneId(registry: OnboardingRegistry, currentSceneId: string): string | null {
  const ordered = registry.chapters.flatMap((c) => c.sceneIds);
  const index = ordered.indexOf(currentSceneId);
  if (index < 0) return null;
  return ordered[index + 1] ?? null;
}
