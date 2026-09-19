/** Roll out compatible readers first. Each external capability has its own activation. */
export const HEARTHSIDE_FLAGS = {
  presentation: import.meta.env?.VITE_HEARTHSIDE === '1',
  collaborativeDesign: import.meta.env?.VITE_HEARTHSIDE_DESIGN === '1',
  vaultPublication: import.meta.env?.VITE_HEARTHSIDE_VAULT === '1',
  workspaceExecution: import.meta.env?.VITE_HEARTHSIDE_WORKSPACE === '1',
  guestPublication: import.meta.env?.VITE_HEARTHSIDE_GUESTS === '1',
  nativeAR: import.meta.env?.VITE_HEARTHSIDE_AR === '1',
  exports: import.meta.env?.VITE_HEARTHSIDE_EXPORTS === '1',
} as const;
