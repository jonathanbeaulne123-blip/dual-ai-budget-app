export type KitchenNoticeTone = "warning" | "danger";
export type KitchenNoticeActionKind = "more" | "reload";

export type KitchenNoticeCopy = {
  id: string;
  primary: string;
  steps: string;
  tone: KitchenNoticeTone;
  action?: { kind: KitchenNoticeActionKind; label: string };
};

function match(raw: string, pattern: RegExp): boolean {
  return pattern.test(raw);
}

/** Map engine/worker strings to a short problem plus 1–2 fix steps. */
export function humanizeKitchenNotice(raw: string): KitchenNoticeCopy {
  const text = raw.trim();
  if (match(text, /google account is not linked to that hearth member/i)) {
    return {
      id: "google-member-mismatch",
      primary: "This Google is not linked to the person on this kitchen.",
      steps: "More → Google household bridge → Link next to your name. Then try again.",
      tone: "warning",
      action: { kind: "more", label: "Open More" },
    };
  }
  if (match(text, /continue with google before connecting/i)) {
    const bank = /bank/i.test(text);
    return {
      id: bank ? "google-before-bank" : "google-before-7shifts",
      primary: bank
        ? "Sign in with Google before connecting a bank."
        : "Sign in with Google before connecting 7shifts.",
      steps: "More → Continue with Google. Then try again.",
      tone: "warning",
      action: { kind: "more", label: "Open More" },
    };
  }
  if (match(text, /sign in with google before retrying share/i)) {
    return {
      id: "google-before-share",
      primary: "Sign in with Google before retrying share.",
      steps: "More → Continue with Google. Then tap Retry on the sync chip.",
      tone: "warning",
      action: { kind: "more", label: "Open More" },
    };
  }
  if (match(text, /could not verify this google session/i)) {
    return {
      id: "google-session",
      primary: "Google sign-in expired.",
      steps: "More → Sign out. Then Continue with Google and try again.",
      tone: "warning",
      action: { kind: "more", label: "Open More" },
    };
  }
  if (match(text, /hearth auth is not configured/i)) {
    return {
      id: "auth-unconfigured",
      primary: "Bank connect needs Hearth Auth on this kitchen.",
      steps: "Stay on Development. Use Import QFX / OFX until Auth is on.",
      tone: "warning",
    };
  }
  if (match(text, /no acceptance receipt for this snapshot revision/i)) {
    return {
      id: "pglite-receipt",
      primary: "This phone’s books copy is a step behind. Nothing was discarded.",
      steps: "Reload Hearth. If it stays, More → Sign out, then Continue with Google.",
      tone: "warning",
      action: { kind: "reload", label: "Reload" },
    };
  }
  if (match(text, /snapshot has journal facts that pglite does not/i)) {
    return {
      id: "pglite-behind",
      primary: "The snapshot has journal rows this phone has not accepted yet. Nothing was discarded.",
      steps: "Reload Hearth. If it stays, More → Sign out, then Continue with Google.",
      tone: "warning",
      action: { kind: "reload", label: "Reload" },
    };
  }
  if (match(text, /pglite holds an unbalanced journal/i)) {
    return {
      id: "pglite-unbalanced",
      primary: "The books copy on this phone is unbalanced. The last valid snapshot is still here.",
      steps: "Do not Confirm again. More → Health, then reload Hearth.",
      tone: "danger",
      action: { kind: "more", label: "Open More" },
    };
  }
  if (match(text, /pglite is missing a books migration|sql books did not verify/i)) {
    return {
      id: "pglite-migration",
      primary: "This phone’s books engine needs a refresh. Nothing was discarded.",
      steps: "Reload Hearth. If it stays, More → Sign out, then Continue with Google.",
      tone: "warning",
      action: { kind: "reload", label: "Reload" },
    };
  }
  if (match(text, /that (cloud )?household is not linked to this google account/i)) {
    return {
      id: "google-household-mismatch",
      primary: "This Google account does not belong to that household.",
      steps: "Continue with Google as the member who belongs here. Then open the household again.",
      tone: "warning",
      action: { kind: "more", label: "Open More" },
    };
  }
  if (match(text, /hosted tables are not in the api/i)) {
    return {
      id: "hosted-schema",
      primary: "Cloud books tables are not ready on this kitchen yet.",
      steps: "Stay on this phone. Reload later. Nothing was discarded.",
      tone: "warning",
      action: { kind: "reload", label: "Reload" },
    };
  }
  if (match(text, /another phone posted a newer household snapshot/i)) {
    return {
      id: "stale-revision",
      primary: "Another device saved newer work.",
      steps: "Hearth will combine the latest accepted entries automatically. You can keep working or tap Retry now.",
      tone: "warning",
      action: { kind: "more", label: "Open More" },
    };
  }
  if (match(text, /browser storage is full|could not keep a share queue copy/i)) {
    return {
      id: "storage-quota",
      primary: "This phone’s browser storage is full.",
      steps: "Tap Retry on the sync chip. If it stays, free space, then Reload.",
      tone: "warning",
      action: { kind: "reload", label: "Reload" },
    };
  }
  if (match(text, /turn on location services/i)) {
    return {
      id: "location-off",
      primary: "Location is off on this phone.",
      steps: "More → Clock & place → turn location on. Then try again.",
      tone: "warning",
      action: { kind: "more", label: "Open More" },
    };
  }
  if (match(text, /over-allocated by/i)) {
    return {
      id: "over-allocated",
      primary: text,
      steps: "Lower a slice until leftover covers it. Then continue.",
      tone: "warning",
    };
  }
  if (match(text, /cannot be more than hearth currently records as waiting/i)) {
    return {
      id: "settle-over",
      primary: "That amount is more than Hearth currently records as waiting.",
      steps: "Lower the amount, then Confirm.",
      tone: "warning",
    };
  }
  if (text.length <= 140 && !match(text, /pglite|google|auth|snapshot|flinks|supabase|quota|hosted|revision|migration|unbalanced/i)) {
    return {
      id: "field",
      primary: text,
      steps: "Fix that, then try again.",
      tone: "warning",
    };
  }
  return {
    id: "generic",
    primary: text.slice(0, 160),
    steps: "Dismiss this note, then try the last step again.",
    tone: "warning",
  };
}
