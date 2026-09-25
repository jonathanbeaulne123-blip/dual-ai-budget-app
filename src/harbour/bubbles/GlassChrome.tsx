import { useEffect, useLayoutEffect, useState, useSyncExternalStore, type ReactNode, type TouchEventHandler } from "react";
import { FabSpeedDial } from "../../FabSpeedDial.tsx";
import type { FabAction, FabAddMode } from "../../core/fabActions.ts";
import type { ThemeId } from "../../theme/scenes.ts";
import { editionUnavailableWords, useEditionAvailability } from "../nav/editionAvailability.ts";
import { MOTION_KEY, chooseMotionEdition, readMotionEdition, type MotionEdition } from "../nav/motionEdition.ts";
import { Bubble, type BubbleKind, type Writer } from "./Bubble.tsx";
import type { GlassEnvironment } from "./glassMode.ts";
import { IslandIcon, SimpleViewIcon, ToolsIcon } from "./icons.tsx";
import { useAnnounceFlip } from "./flipStanding.ts";
export { useFlipStanding } from "./flipStanding.ts";

/**
 * The three bubbles on the glass (brief §2.4 Surface, §4.1):
 *
 *   Simple view (top-right) · All tools (bottom-left) · Record (bottom-right)
 *
 * **Focus order (A5).** DOM order is the focus order, so GlassChrome renders
 * Simple view first, then `between` (the integrator passes the map's focus
 * stop, the strip and the camp card here — or renders them between this and
 * `GlassChromeBottom`), then All tools, then Record. The bubbles are
 * `position: fixed`, so DOM order never moves them on screen.
 *
 * Record is the App's own `FabSpeedDial` inside the accent bubble: every verb
 * opens an Add flow and nothing here posts. Simple view is a one-tap flip
 * through the one writer (`chooseMotionEdition` → `hearth:motion`), the same
 * mechanism the Desk and the backtick key use.
 */
export type GlassFab = {
  actions: readonly FabAction[];
  /** Ignored: the closed dial is always named "Record" on the glass. */
  closedLabel?: string;
  onPick: (mode: FabAddMode) => void;
  /** Bill paid (the fifth verb): absent, the dial shows four. */
  onBillPaid?: () => void;
  /** Mirrors App's `adding`: the dial shuts (and goes `inert`) while an Add sheet is open. */
  closed?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** @deprecated The dial no longer navigates; accepted and ignored. */
  onGo?: (tab: string) => void;
};
/** Which world the person is standing in: the island (flip says "Simple view") or the Desk (flip says "Island"). */
export type GlassEdition = "island" | "desk";

export type GlassLook = {
  member?: string | null;
  theme?: ThemeId;
  calm?: boolean;
  lite?: boolean;
  frameOverBudget?: boolean;
  cameraMoving?: boolean;
  night?: boolean;
  alwaysShowLabels?: boolean;
  /** Per-bubble use counts, when the integrator keeps them itself. */
  usedCounts?: Partial<Record<BubbleKind, number>>;
  storage?: Writer;
  environment?: GlassEnvironment;
};

export type GlassChromeProps = GlassLook & {
  onOpenTools?: () => void;
  /** The sheet is open: All tools reads as expanded. */
  toolsOpen?: boolean;
  fab?: GlassFab;
  onFlip?: (next: MotionEdition) => void;
  /** Defaults to the chosen edition (`hearth:motion`) and whether the island can be drawn here. */
  edition?: GlassEdition;
  /** Rendered between Simple view and All tools, for the focus order (the map, the strip, the card). */
  between?: ReactNode;
  /** `fixed` (default) anchors to the viewport; `inline` lays the three out in a bar. */
  placement?: "fixed" | "inline";
};

/** The words the flip wears. Its accessible name equals its label. */
export function flipWords(edition: GlassEdition): { label: string; next: MotionEdition } {
  return edition === "desk" ? { label: "Island", next: "illustrated" } : { label: "Simple view", next: "flat" };
}

/** The chosen edition, current across writers. */
export function useGlassEdition(explicit?: GlassEdition): GlassEdition {
  const availability = useEditionAvailability();
  const [chosen, setChosen] = useState<MotionEdition>(() => readMotionEdition());
  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      setChosen(detail === "flat" || detail === "illustrated" ? detail : readMotionEdition());
    };
    window.addEventListener(MOTION_KEY, sync);
    return () => window.removeEventListener(MOTION_KEY, sync);
  }, []);
  if (explicit) return explicit;
  return availability.flat || chosen === "flat" ? "desk" : "island";
}

export function SimpleViewBubble(props: GlassLook & { edition?: GlassEdition; onFlip?: (next: MotionEdition) => void; placement?: "fixed" | "inline" }) {
  useAnnounceFlip();
  const edition = useGlassEdition(props.edition);
  const availability = useEditionAvailability();
  const words = flipWords(edition);
  // Going back to the island needs a world that can be drawn here.
  const reason = words.next === "illustrated" && availability.reason ? editionUnavailableWords(availability.reason) : null;
  return (
    <Bubble
      kind="flip"
      label={words.label}
      icon={edition === "desk" ? <IslandIcon /> : <SimpleViewIcon />}
      placement={props.placement}
      memberId={props.member}
      usedCount={props.usedCounts?.flip}
      alwaysShowLabels={props.alwaysShowLabels}
      calm={props.calm}
      lite={props.lite}
      frameOverBudget={props.frameOverBudget}
      cameraMoving={props.cameraMoving}
      theme={props.theme}
      night={props.night}
      storage={props.storage}
      environment={props.environment}
      disabledReason={reason}
      data={{ "data-glass-flip": edition }}
      onActivate={() => { chooseMotionEdition(words.next); props.onFlip?.(words.next); }}
    />
  );
}

export function AllToolsBubble(props: GlassLook & { onOpenTools?: () => void; toolsOpen?: boolean; placement?: "fixed" | "inline" }) {
  if (!props.onOpenTools) return null;
  return (
    <Bubble
      kind="tools"
      label="All tools"
      icon={<ToolsIcon />}
      placement={props.placement}
      memberId={props.member}
      usedCount={props.usedCounts?.tools}
      alwaysShowLabels={props.alwaysShowLabels}
      calm={props.calm}
      lite={props.lite}
      frameOverBudget={props.frameOverBudget}
      cameraMoving={props.cameraMoving}
      theme={props.theme}
      night={props.night}
      storage={props.storage}
      environment={props.environment}
      haspopup="dialog"
      expanded={props.toolsOpen}
      data={{ "data-glass-tools": "", "aria-label": "All tools and search" }}
      onActivate={props.onOpenTools}
    />
  );
}

export function RecordBubble(props: GlassLook & { fab?: GlassFab; placement?: "fixed" | "inline" }) {
  if (!props.fab) return null;
  return (
    <Bubble
      kind="record"
      label="Record"
      icon={null}
      accent
      placement={props.placement}
      memberId={props.member}
      usedCount={props.usedCounts?.record}
      alwaysShowLabels={props.alwaysShowLabels}
      calm={props.calm}
      lite={props.lite}
      frameOverBudget={props.frameOverBudget}
      cameraMoving={props.cameraMoving}
      theme={props.theme}
      night={props.night}
      storage={props.storage}
      environment={props.environment}
    >
      <FabSpeedDial actions={props.fab.actions} closedLabel="Record" onPick={props.fab.onPick} onBillPaid={props.fab.onBillPaid} closed={props.fab.closed} onOpenChange={props.fab.onOpenChange} />
    </Bubble>
  );
}

/** Newfoundland's wavy glass: one static ripple, referenced by `bubbles.css`. Rendered once however many chromes stand. */
let rippleOwners: object[] = [];
const rippleListeners = new Set<() => void>();
const subscribeRipple = (listener: () => void) => { rippleListeners.add(listener); return () => { rippleListeners.delete(listener); }; };
export function GlassRippleDefs() {
  const [me] = useState(() => ({}));
  useLayoutEffect(() => {
    rippleOwners = [...rippleOwners, me];
    for (const listener of rippleListeners) listener();
    return () => { rippleOwners = rippleOwners.filter((owner) => owner !== me); for (const listener of rippleListeners) listener(); };
  }, [me]);
  const first = useSyncExternalStore(subscribeRipple, () => rippleOwners[0] === me, () => false);
  if (!first) return null;
  return (
    <svg className="glass-ripple-defs" aria-hidden="true" focusable="false" width="0" height="0">
      <filter id="hearth-glass-ripple" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.02 0.18" numOctaves="1" seed="7" result="waves" />
        <feDisplacementMap in="SourceGraphic" in2="waves" scale="2" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}

/** The three, in focus order. */
export function GlassChrome(props: GlassChromeProps) {
  const { between, onOpenTools, toolsOpen, fab, onFlip, edition, placement, ...look } = props;
  return (
    <div className="glass-chrome" data-glass-chrome="" data-glass-theme={look.theme}>
      <GlassRippleDefs />
      <SimpleViewBubble {...look} edition={edition} onFlip={onFlip} placement={placement} />
      {between}
      <AllToolsBubble {...look} onOpenTools={onOpenTools} toolsOpen={toolsOpen} placement={placement} />
      <RecordBubble {...look} fab={fab} placement={placement} />
    </div>
  );
}

/**
 * The bar form (brief §3.5 flat edition, §6): `[Island | Simple view] [Record] [All tools]`,
 * Record in the centre. The Reading edition's bar and the door edition use it.
 */
export function GlassBar(props: Omit<GlassChromeProps, "between" | "placement"> & { className?: string; barKind?: "island" | "door"; onTouchStart?: TouchEventHandler; onTouchEnd?: TouchEventHandler }) {
  const { onOpenTools, toolsOpen, fab, onFlip, edition, className, barKind = "island", onTouchStart, onTouchEnd, ...look } = props;
  return (
    <nav className={`glass-bar harbour-bar${className ? ` ${className}` : ""}`} data-harbour-bar={barKind} aria-label="Harbour bar" data-glass-theme={look.theme} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <GlassRippleDefs />
      <SimpleViewBubble {...look} edition={edition} onFlip={onFlip} placement="inline" />
      <RecordBubble {...look} fab={fab} placement="inline" />
      <AllToolsBubble {...look} onOpenTools={onOpenTools} toolsOpen={toolsOpen} placement="inline" />
    </nav>
  );
}
