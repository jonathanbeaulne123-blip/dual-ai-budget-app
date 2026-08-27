import type { SoftPresenceDisplay } from "./softPresence.ts";

type Props = {
  display: SoftPresenceDisplay;
};

export function SoftPresenceStatus({ display }: Props) {
  if (!display.visible) return null;

  return (
    <p
      className="soft-presence"
      role="status"
      aria-live="polite"
    >
      {display.line}
    </p>
  );
}
