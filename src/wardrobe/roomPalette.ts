/**
 * The dressing room derives its physical colours from the live Hearth scene tokens.
 * Everything here is allowlisted design data read from CSS custom properties; never a financial fact.
 */
import type { ScenePalette } from '../theme/scenes.ts';
export type RoomTheme = 'classic' | 'taylor' | 'newfoundland';
export type RoomPalette = {
  theme: RoomTheme; personal: boolean; dark: boolean;
  paper: string; card: string; ink: string; muted: string; line: string;
  accent: string; second: string; wood: string; brass: string;
};
const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const hex2 = (v: number) => clamp(v).toString(16).padStart(2, '0');
export const rgbToHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
export function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value.slice(0, 6);
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}
/** Accepts #rgb, #rrggbb, #rrggbbaa, rgb()/rgba() with commas or spaces. Anything else (color-mix, var, names) returns null. */
export function parseCssColour(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text);
  if (hex) {
    const raw = hex[1]!;
    if (raw.length === 3) return `#${raw.split('').map(c => c + c).join('')}`.toLowerCase();
    return `#${raw.slice(0, 6)}`.toLowerCase();
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*[\d.%]+\s*)?\)$/i.exec(text);
  if (rgb) {
    const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map(Number);
    if ([r, g, b].every(n => Number.isFinite(n))) return rgbToHex(r!, g!, b!);
  }
  return null;
}
/** Relative luminance on 0..1, for choosing legible trim on a dark or light wall. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(c => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
export function mixHex(a: string, b: string, amount: number): string {
  const [ar, ag, ab] = hexToRgb(a), [br, bg, bb] = hexToRgb(b), t = Math.max(0, Math.min(1, amount));
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}
/** Authored defaults per theme; the exact fallback the room uses when a token cannot be parsed. */
export const ROOM_DEFAULTS: Record<RoomTheme, { wood: string; brass: string }> = {
  classic: { wood: '#6b503c', brass: '#b89a53' },
  taylor: { wood: '#755b49', brass: '#a78e60' },
  newfoundland: { wood: '#394a51', brass: '#b99a57' },
};
type Tokens = Partial<Record<'paper' | 'card' | 'ink' | 'muted' | 'line' | 'accent' | 'second' | 'desk' | 'brass', string | null>>;
export function readSceneTokens(root: Element | null | undefined): Tokens {
  if (!root || typeof getComputedStyle !== 'function') return {};
  try {
    const style = getComputedStyle(root);
    const read = (name: string) => style.getPropertyValue(name) || null;
    return { paper: read('--paper'), card: read('--card'), ink: read('--ink'), muted: read('--muted'), line: read('--line'), accent: read('--theme-accent'), second: read('--theme-second'), desk: read('--desk'), brass: read('--brass') };
  } catch { return {}; }
}
/**
 * Build the room palette: computed tokens first, authored scene palette second, theme defaults last.
 * `dark` follows the scene's authored lighting, matching `data-scene-lighting` written by ThemeProvider.
 */
export function roomPalette(input: { theme: RoomTheme; personal: boolean; dark: boolean; palette: ScenePalette }, tokens: Tokens = {}): RoomPalette {
  const pick = (token: string | null | undefined, fallback: string) => parseCssColour(token) ?? parseCssColour(fallback) ?? fallback;
  const p = input.palette;
  const paper = pick(tokens.paper, p.paper), accent = pick(tokens.accent, p.accent), second = pick(tokens.second, p.second), ink = pick(tokens.ink, p.ink);
  const defaults = ROOM_DEFAULTS[input.theme];
  // Wood: the desk token is the scene paper, so the room warms it toward the authored wood so furniture stays furniture.
  const desk = pick(tokens.desk, p.paper);
  const wood = input.dark ? mixHex(defaults.wood, ink, 0.35) : mixHex(defaults.wood, desk, 0.22);
  const brassToken = pick(tokens.brass, p.accent);
  const brass = input.dark ? mixHex(defaults.brass, '#f2dfa4', 0.35) : mixHex(defaults.brass, brassToken, 0.3);
  return {
    theme: input.theme, personal: input.personal, dark: input.dark,
    paper, card: pick(tokens.card, p.card), ink, muted: pick(tokens.muted, p.muted), line: pick(tokens.line, p.line),
    accent, second: input.personal ? mixHex(second, accent, 0.25) : second, wood, brass,
  };
}
export function sameRoomPalette(a: RoomPalette | null | undefined, b: RoomPalette | null | undefined): boolean {
  if (!a || !b) return a === b;
  return (Object.keys(a) as (keyof RoomPalette)[]).every(key => a[key] === b[key]);
}
