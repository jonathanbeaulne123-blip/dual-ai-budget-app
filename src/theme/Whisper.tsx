import { useCallback, useState, type ReactNode } from "react";

/**
 * Supporting text, one way. Hearth's explanations used to be paragraphs under
 * every heading (feedback row 6: "over-explaining … taking valuable real
 * estate"). A Whisper keeps the words but decides how much screen they get:
 *
 * - `line`      one short sentence, always visible (≤ 90 characters by test).
 * - `aside`     a "Why" toggle beside the heading reveals the paragraph; the
 *               open state is remembered per device under `id`.
 * - `described` painted for nobody, read by assistive tech in flow.
 *
 * Copy that carries money outcome, host-vs-peer, or Development openness must
 * stay a `line` — the design laws in docs/CLAUDE_COMMAND_STATES_UX.md win.
 * Nothing here posts, decides, or stores account data; the remembered open
 * state is a device convenience, never shared truth.
 */
export type WhisperMode = "line" | "aside" | "described";

export const WHISPER_LINE_MAX = 90;

export function whisperKey(id: string): string {
  return `hearth:whisper:v1:${id}`;
}

function readOpen(id: string): boolean {
  try { return localStorage.getItem(whisperKey(id)) === "open"; } catch { return false; }
}
function writeOpen(id: string, open: boolean): void {
  try { if (open) localStorage.setItem(whisperKey(id), "open"); else localStorage.removeItem(whisperKey(id)); } catch { /* A private window still reads; it just forgets. */ }
}

export function Whisper({ mode = "aside", id, label = "Why", children, className, role }: {
  mode?: WhisperMode;
  /** For `aside`, names the remembered open state; for `line` and `described`, the DOM id (so `aria-describedby` can point at it). */
  id?: string;
  /** The toggle's word. Keep it to one: Why · How · What counts. */
  label?: string;
  children: ReactNode;
  className?: string;
  role?: string;
}) {
  const [open, setOpen] = useState(() => (mode === "aside" && id ? readOpen(id) : false));
  const onToggle = useCallback((event: React.SyntheticEvent<HTMLDetailsElement>) => {
    const next = event.currentTarget.open;
    setOpen(next);
    if (id) writeOpen(id, next);
  }, [id]);
  if (mode === "line") return <p id={id} className={["whisper", "whisper-line", className].filter(Boolean).join(" ")} role={role}>{children}</p>;
  if (mode === "described") return <p id={id} className={["whisper", "whisper-described", className].filter(Boolean).join(" ")}>{children}</p>;
  return (
    <details className={["whisper", "whisper-aside", className].filter(Boolean).join(" ")} open={open} onToggle={onToggle} data-whisper={id}>
      <summary aria-label={`${label} — more about this`}>{label}</summary>
      <div className="whisper-body">{children}</div>
    </details>
  );
}
