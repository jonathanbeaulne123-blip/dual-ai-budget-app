import type { HerculesRigCommand } from "./types.ts";
import { registerRigClip } from "./registry.ts";
import { dispatchHerculesRig } from "./controller.ts";

export type ChatRigTriggerCategory = "budget" | "cat";

export type ChatRigTrigger = {
  word: string;
  category: ChatRigTriggerCategory;
  label: string;
  commands: HerculesRigCommand[];
};

/** Ten budget words — each maps to a distinct rig reaction. */
export const BUDGET_CHAT_TRIGGERS: readonly ChatRigTrigger[] = [
  {
    word: "budget",
    category: "budget",
    label: "Budget watch",
    commands: [
      { type: "playClip", clipId: "chat-budget-watch", loop: false },
    ],
  },
  {
    word: "groceries",
    category: "budget",
    label: "Grocery hunt",
    commands: [{ type: "playPose", pose: "pounce" }],
  },
  {
    word: "rent",
    category: "budget",
    label: "Rent stretch",
    commands: [{ type: "playPose", pose: "stretch" }],
  },
  {
    word: "savings",
    category: "budget",
    label: "Savings beg",
    commands: [{ type: "playPose", pose: "beg" }],
  },
  {
    word: "paycheck",
    category: "budget",
    label: "Payday bounce",
    commands: [{ type: "playPose", pose: "celebrate" }],
  },
  {
    word: "bill",
    category: "budget",
    label: "Bill pace",
    commands: [{ type: "playPose", pose: "pace" }],
  },
  {
    word: "visa",
    category: "budget",
    label: "Card perch",
    commands: [
      { type: "playPose", pose: "perch" },
      { type: "setPart", part: "bag", transform: { rotate: 6, translateY: -2 }, holdMs: 900 },
    ],
  },
  {
    word: "confirm",
    category: "budget",
    label: "Confirm strike",
    commands: [{ type: "playPose", pose: "attack" }],
  },
  {
    word: "balance",
    category: "budget",
    label: "Balance perch",
    commands: [
      { type: "playClip", clipId: "chat-balance-perch", loop: false },
    ],
  },
  {
    word: "expense",
    category: "budget",
    label: "Expense pounce",
    commands: [{ type: "playPose", pose: "pounce" }],
  },
];

/** Ten cat words — each maps to a distinct rig reaction. */
export const CAT_CHAT_TRIGGERS: readonly ChatRigTrigger[] = [
  {
    word: "mrrp",
    category: "cat",
    label: "Mrrp chirp",
    commands: [
      { type: "playClip", clipId: "chat-mrrp-chirp", loop: false },
    ],
  },
  {
    word: "purr",
    category: "cat",
    label: "Purr loaf",
    commands: [
      { type: "playClip", clipId: "chat-purr-loaf", loop: false },
    ],
  },
  {
    word: "treat",
    category: "cat",
    label: "Treat beg",
    commands: [{ type: "playPose", pose: "beg" }],
  },
  {
    word: "fly",
    category: "cat",
    label: "Fly hunt",
    commands: [
      { type: "playClip", clipId: "chat-fly-hunt", loop: false },
    ],
  },
  {
    word: "nap",
    category: "cat",
    label: "Nap curl",
    commands: [{ type: "playPose", pose: "sleep" }],
  },
  {
    word: "tail",
    category: "cat",
    label: "Tail flick",
    commands: [
      { type: "playClip", clipId: "chat-tail-flick", loop: false },
    ],
  },
  {
    word: "pounce",
    category: "cat",
    label: "Pounce",
    commands: [{ type: "playPose", pose: "pounce" }],
  },
  {
    word: "loaf",
    category: "cat",
    label: "Loaf",
    commands: [{ type: "playPose", pose: "loaf" }],
  },
  {
    word: "whiskers",
    category: "cat",
    label: "Whisker twitch",
    commands: [
      { type: "playClip", clipId: "chat-whisker-twitch", loop: false },
    ],
  },
  {
    word: "meow",
    category: "cat",
    label: "Meow call",
    commands: [
      { type: "playClip", clipId: "chat-meow-call", loop: false },
    ],
  },
];

const ALL_CHAT_TRIGGERS: readonly ChatRigTrigger[] = [...BUDGET_CHAT_TRIGGERS, ...CAT_CHAT_TRIGGERS];

function wordPattern(word: string): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

/** Return triggers matched in message order (budget list first, then cat). */
export function matchChatRigTriggers(text: string): ChatRigTrigger[] {
  const haystack = text.trim();
  if (!haystack) return [];
  const matched: ChatRigTrigger[] = [];
  for (const trigger of ALL_CHAT_TRIGGERS) {
    if (wordPattern(trigger.word).test(haystack)) matched.push(trigger);
  }
  return matched;
}

/** Flatten matched triggers into rig commands; at most one budget + one cat per message. */
export function rigCommandsForChatText(text: string): HerculesRigCommand[] {
  const matched = matchChatRigTriggers(text);
  if (!matched.length) return [];
  const budget = matched.find((row) => row.category === "budget");
  const cat = matched.find((row) => row.category === "cat");
  const picks = [budget, cat].filter(Boolean) as ChatRigTrigger[];
  const flat = picks.flatMap((row) => row.commands);
  if (flat.length <= 1) return flat;
  return [{ type: "queue", commands: flat }];
}

export function dispatchChatRigTriggers(
  text: string,
  dispatch: (command: HerculesRigCommand) => void = dispatchHerculesRig,
): boolean {
  const commands = rigCommandsForChatText(text);
  if (!commands.length) return false;
  for (const command of commands) dispatch(command);
  return true;
}

export function installChatTriggerClips(): void {
  registerRigClip({
    id: "chat-budget-watch",
    label: "Budget watch",
    durationMs: 900,
    keyframes: [
      { t: 0, parts: { head: { rotate: 0, translateY: 0 }, ears: { rotate: 0 }, tail: { rotate: 18 } } },
      { t: 0.45, parts: { head: { rotate: -12, translateY: -5 }, ears: { rotate: 10, scaleY: 0.88 }, tail: { rotate: 28 } } },
      { t: 1, parts: { head: { rotate: -8, translateY: -3 }, ears: { rotate: 6 }, tail: { rotate: 22 } } },
    ],
  });
  registerRigClip({
    id: "chat-balance-perch",
    label: "Balance perch",
    durationMs: 1100,
    keyframes: [
      { t: 0, parts: { legs: { translateY: 7, scaleY: 0.5 }, head: { rotate: -4 }, tail: { rotate: 20 } } },
      { t: 0.5, parts: { legs: { translateY: 7, scaleY: 0.5 }, head: { rotate: -6, translateY: -2 }, tail: { rotate: 32 } } },
      { t: 1, parts: { legs: { translateY: 7, scaleY: 0.5 }, head: { rotate: -4 }, tail: { rotate: 24 } } },
    ],
  });
  registerRigClip({
    id: "chat-mrrp-chirp",
    label: "Mrrp chirp",
    durationMs: 480,
    keyframes: [
      { t: 0, parts: { head: { rotate: 0, translateY: 0 }, ears: { rotate: 0, scaleY: 1 } } },
      { t: 0.25, parts: { head: { rotate: -6, translateY: -3 }, ears: { rotate: -16, scaleY: 0.76 } } },
      { t: 0.55, parts: { head: { rotate: 4, translateY: -1 }, ears: { rotate: 12, scaleY: 0.92 } } },
      { t: 1, parts: { head: { rotate: 0, translateY: 0 }, ears: { rotate: 0, scaleY: 1 } } },
    ],
  });
  registerRigClip({
    id: "chat-purr-loaf",
    label: "Purr loaf",
    durationMs: 1400,
    keyframes: [
      { t: 0, parts: { legs: { translateY: 9, scaleY: 0.34 }, tail: { rotate: -8 }, body: { scaleY: 0.96 } } },
      { t: 0.5, parts: { legs: { translateY: 9, scaleY: 0.34 }, tail: { rotate: 6 }, body: { scaleY: 1 } } },
      { t: 1, parts: { legs: { translateY: 9, scaleY: 0.34 }, tail: { rotate: -4 }, body: { scaleY: 0.98 } } },
    ],
  });
  registerRigClip({
    id: "chat-fly-hunt",
    label: "Fly hunt",
    durationMs: 720,
    keyframes: [
      { t: 0, parts: { root: { translateY: 0 }, head: { rotate: -8 }, tail: { rotate: -40 } } },
      { t: 0.35, parts: { root: { translateY: -18, scaleY: 1.06 }, head: { rotate: -12 }, tail: { rotate: -52 } } },
      { t: 0.7, parts: { root: { translateY: 2, scaleY: 0.94 }, legFront: { rotate: -40 }, tail: { rotate: -46 } } },
      { t: 1, parts: { root: { translateY: 0 }, head: { rotate: -6 }, tail: { rotate: -34 } } },
    ],
  });
  registerRigClip({
    id: "chat-tail-flick",
    label: "Tail flick",
    durationMs: 560,
    keyframes: [
      { t: 0, parts: { tail: { rotate: 8 } } },
      { t: 0.3, parts: { tail: { rotate: -38 } } },
      { t: 0.6, parts: { tail: { rotate: 22 } } },
      { t: 1, parts: { tail: { rotate: 4 } } },
    ],
  });
  registerRigClip({
    id: "chat-whisker-twitch",
    label: "Whisker twitch",
    durationMs: 640,
    keyframes: [
      { t: 0, parts: { whiskers: { opacity: 1 }, head: { rotate: 0 } } },
      { t: 0.35, parts: { whiskers: { opacity: 0.45 }, head: { rotate: 3 } } },
      { t: 0.7, parts: { whiskers: { opacity: 0.85 }, head: { rotate: -2 } } },
      { t: 1, parts: { whiskers: { opacity: 1 }, head: { rotate: 0 } } },
    ],
  });
  registerRigClip({
    id: "chat-meow-call",
    label: "Meow call",
    durationMs: 700,
    keyframes: [
      { t: 0, parts: { head: { rotate: 0, translateY: 0 }, ears: { rotate: 0 } } },
      { t: 0.4, parts: { head: { rotate: -14, translateY: -6 }, ears: { rotate: -8, scaleY: 0.9 } } },
      { t: 1, parts: { head: { rotate: -6, translateY: -2 }, ears: { rotate: 0 } } },
    ],
  });
}

installChatTriggerClips();
