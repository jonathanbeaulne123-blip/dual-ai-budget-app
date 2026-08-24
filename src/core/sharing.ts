import type { Household, SharingMode, SharingRecord } from "./types.ts";

export const LOCAL_SHARING: SharingRecord = {
  mode: "local",
  linked: false,
  lastTransportAt: null,
  lastError: null,
  pending: false,
};

export function hostedTransportAllowed(household: { linked?: boolean } | null | undefined): boolean {
  return household?.linked === true;
}

export function shapeSharing(household: Partial<Household> & { linked?: boolean; sharing?: SharingRecord }): SharingRecord {
  const linked = household.linked === true;
  const existing = household.sharing;
  if (!linked) {
    const mode: SharingMode =
      existing?.mode === "invite-draft" || existing?.mode === "publish-confirming" ? existing.mode : "local";
    return {
      mode,
      linked: false,
      lastTransportAt: existing?.lastTransportAt ?? null,
      lastError: existing?.lastError ?? null,
      pending: false,
    };
  }
  if (existing?.mode === "conflicted") return { ...existing, linked: true };
  if (existing?.pending || existing?.mode === "pending-transport") {
    return {
      mode: "pending-transport",
      linked: true,
      lastTransportAt: existing.lastTransportAt ?? null,
      lastError: existing.lastError ?? null,
      pending: true,
    };
  }
  if (existing?.mode === "transport-error" || existing?.mode === "disconnected") {
    return { ...existing, linked: true };
  }
  if (existing?.mode === "synchronized" || existing?.mode === "linked" || existing?.mode === "publish-confirming") {
    return { ...existing, linked: true, pending: false };
  }
  return {
    mode: "linked",
    linked: true,
    lastTransportAt: existing?.lastTransportAt ?? null,
    lastError: existing?.lastError ?? null,
    pending: false,
  };
}

export function deriveSharing(household: Household): SharingRecord {
  return shapeSharing(household);
}

export function markInviteDraft(household: Household): Household {
  return {
    ...household,
    linked: false,
    sharing: {
      mode: "invite-draft",
      linked: false,
      lastTransportAt: household.sharing?.lastTransportAt ?? null,
      lastError: null,
      pending: false,
    },
  };
}

export function markPublishConfirming(household: Household): Household {
  return {
    ...household,
    sharing: {
      mode: "publish-confirming",
      linked: household.linked,
      lastTransportAt: household.sharing?.lastTransportAt ?? null,
      lastError: null,
      pending: false,
    },
  };
}

export function markLinked(household: Household): Household {
  return {
    ...household,
    linked: true,
    sharing: {
      mode: "linked",
      linked: true,
      lastTransportAt: household.sharing?.lastTransportAt ?? null,
      lastError: null,
      pending: false,
    },
  };
}

export function markSynchronized(household: Household, at = new Date().toISOString()): Household {
  return {
    ...household,
    linked: true,
    baseRevision: household.revision,
    sharing: {
      mode: "synchronized",
      linked: true,
      lastTransportAt: at,
      lastError: null,
      pending: false,
    },
  };
}

export function markPendingTransport(household: Household, error?: string): Household {
  return {
    ...household,
    linked: true,
    sharing: {
      mode: "pending-transport",
      linked: true,
      lastTransportAt: household.sharing?.lastTransportAt ?? null,
      lastError: error ?? household.sharing?.lastError ?? null,
      pending: true,
    },
  };
}

export function markTransportError(household: Household, error: string, disconnected = false): Household {
  return {
    ...household,
    linked: true,
    sharing: {
      mode: disconnected ? "disconnected" : "transport-error",
      linked: true,
      lastTransportAt: household.sharing?.lastTransportAt ?? null,
      lastError: error,
      pending: true,
    },
  };
}

export function markConflicted(household: Household, error = "Another phone posted a newer household snapshot."): Household {
  return {
    ...household,
    linked: true,
    sharing: {
      mode: "conflicted",
      linked: true,
      lastTransportAt: household.sharing?.lastTransportAt ?? null,
      lastError: error,
      pending: false,
    },
  };
}

/** Stop future household REST without deleting local books or PGlite. */
export function unlinkHousehold(household: Household): Household {
  return {
    ...household,
    linked: false,
    sharing: {
      mode: "local",
      linked: false,
      lastTransportAt: household.sharing?.lastTransportAt ?? null,
      lastError: null,
      pending: false,
    },
  };
}
