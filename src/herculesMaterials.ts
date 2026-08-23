/**
 * Material palette from models/hercules.mtl (three-d-stage / THREE.GLTFExporter).
 * Canonical for the 3D source. The live 96px SVG stays on --herc-coat / --herc-spot
 * so he sits on --paper. This module does not import core and cannot post money.
 */
export const HERC_MTL = {
  furWhite: { kd: [0.8879, 0.8388, 0.7529] as const, hex: "#e2d6c0" },
  furTan: { kd: [0.5841, 0.3613, 0.1746] as const, hex: "#95582c" },
  nosePink: { kd: [0.6795, 0.3231, 0.2874] as const, hex: "#ad5249" },
  whisker: { kd: [0.8070, 0.7529, 0.6445] as const, hex: "#cec0a4" },
  eyeGold: { kd: [0.3372, 0.3231, 0.0685] as const, hex: "#565211" },
  pupilInk: { kd: [0.0116, 0.0103, 0.0080] as const, hex: "#030302" },
  earInner: { kd: [0.7157, 0.4735, 0.4233] as const, hex: "#b6796c" },
} as const;

export const HERC_SOURCE_GLB = "models/hercules.source.glb";
export const HERC_SOURCE_MTL = "models/hercules.mtl";
