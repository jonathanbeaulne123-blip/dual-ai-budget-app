import { useEffect, useState } from "react";
import { humanizeKitchenNotice, type KitchenNoticeActionKind, type KitchenNoticeCopy } from "./kitchenNotice.ts";

type Props = {
  message: string;
  onGoMore?: () => void;
  onReload?: () => void;
  onDismiss?: () => void;
};

export function KitchenNotice({ message, onGoMore, onReload, onDismiss }: Props) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setDismissed(false);
  }, [message]);

  if (!message.trim() || dismissed) return null;

  const copy: KitchenNoticeCopy = humanizeKitchenNotice(message);
  const showMore = copy.action?.kind === "more" && Boolean(onGoMore);
  const showReload = copy.action?.kind === "reload";
  const showAction = showMore || showReload;

  function runAction(kind: KitchenNoticeActionKind) {
    if (kind === "more") onGoMore?.();
    if (kind === "reload") {
      if (onReload) onReload();
      else window.location.reload();
    }
  }

  function dismiss() {
    setDismissed(true);
    onDismiss?.();
  }

  return (
    <div
      className={`kitchen-notice kitchen-notice--${copy.tone}`}
      data-notice-id={copy.id}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="kitchen-notice__content">
        <span className="kitchen-notice__primary">{copy.primary}</span>
        <span className="kitchen-notice__steps">{copy.steps}</span>
      </div>
      {showAction && copy.action && (
        <button
          type="button"
          className="kitchen-notice__action"
          onClick={() => runAction(copy.action!.kind)}
        >
          {copy.action.label}
        </button>
      )}
      <button type="button" className="kitchen-notice__close" aria-label="Dismiss" onClick={dismiss}>
        ×
      </button>
    </div>
  );
}
