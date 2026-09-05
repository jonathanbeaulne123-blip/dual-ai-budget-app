export type CommandConfirmationSelection = {
  confirmationId: string;
  pendingConfirmationId: string | null;
};

/**
 * Explicit command identities own their retry lifecycle. They must clear any
 * ambient retry id left by an earlier command before the next ordinary write.
 */
export function selectCommandConfirmationId(
  explicitConfirmationId: string | undefined,
  pendingConfirmationId: string | null,
  createConfirmationId: () => string,
): CommandConfirmationSelection {
  if (explicitConfirmationId) {
    return { confirmationId: explicitConfirmationId, pendingConfirmationId: null };
  }
  const confirmationId = pendingConfirmationId ?? createConfirmationId();
  return { confirmationId, pendingConfirmationId: confirmationId };
}
