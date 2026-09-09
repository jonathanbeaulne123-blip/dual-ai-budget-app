import type { Environment, LedgerView } from "../core/types.ts";

export type ThemeId = "classic" | "taylor" | "newfoundland";
export type SceneRoute = "home" | "calendar" | "plan" | "ledger" | "more" | "till" | "shift" | "entry";
export type ThemeAccessory = "hat" | "neck";
export type Appearance = { theme: ThemeId; atmosphere: boolean; hideThemeHat?: boolean; hideThemeNeck?: boolean };
export type AppearanceScope = { environment: Environment; userId: string | null };
export type ScenePalette = {
  paper: string; card: string; ink: string; muted: string; accent: string; second: string; line: string;
};
export type ThemeScene = {
  id: string; theme: ThemeId; title: string; caption: string; material: string;
  palette: ScenePalette; dark: boolean; motif: string;
};
export const DEFAULT_APPEARANCE: Appearance = { theme: "classic", atmosphere: true };
export const THEMES: { id: ThemeId; name: string; description: string }[] = [
  { id: "classic", name: "Classic Hearth", description: "Cream paper, pine, terracotta. A little more warmth at the kitchen table." },
  { id: "taylor", name: "Taylor’s Scrapbook", description: "Twelve eras, your keepsakes, and a page for every part of your life together." },
  { id: "newfoundland", name: "Newfoundland", description: "Colourful streets, wild Atlantic skies, and a familiar place to come home to." },
];
export function parseAppearance(value: unknown): Appearance {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    theme: row.theme === "taylor" || row.theme === "newfoundland" ? row.theme : "classic",
    atmosphere: typeof row.atmosphere === "boolean" ? row.atmosphere : true,
    ...(typeof row.hideThemeHat === "boolean" ? { hideThemeHat: row.hideThemeHat } : {}),
    ...(typeof row.hideThemeNeck === "boolean" ? { hideThemeNeck: row.hideThemeNeck } : {}),
  };
}
const palette = (paper: string, card: string, ink: string, muted: string, accent: string, second: string, line: string): ScenePalette => ({ paper, card, ink, muted, accent, second, line });
const classicPalette = palette("#f5eee2", "#fffaf1", "#30251f", "#635345", "#a94429", "#315c49", "#d7c5b1");
function scene(id: string, theme: ThemeId, title: string, caption: string, material: string, colors: ScenePalette, motif: string, dark = false): ThemeScene {
  return { id, theme, title, caption, material, palette: colors, motif, dark };
}
export const TAYLOR_SCENES = {
  lover: scene("lover", "taylor", "Lover", "Our little corner of the world", "vellum", palette("#f7e7ed", "#fff7f4", "#523349", "#6f5166", "#a63968", "#77629b", "#dbc0d2"), "hearts"),
  red: scene("red", "taylor", "Red", "The days we’ll remember", "cloth", palette("#f2e6dc", "#fff9ef", "#49252b", "#6b4c4e", "#963d43", "#976537", "#d7babb"), "leaves"),
  fearless: scene("fearless", "taylor", "Fearless", "A little courage for what comes next", "gold-thread", palette("#f7efda", "#fffbef", "#4c3b24", "#6c583b", "#946522", "#6d7250", "#ddc999"), "stars"),
  reputation: scene("reputation", "taylor", "reputation", "Every line tells the truth", "newsprint", palette("#191c20", "#24282d", "#f1ede5", "#bdbab4", "#d1dacd", "#aebcd0", "#596168"), "serpent", true),
  evermore: scene("evermore", "taylor", "evermore", "Collected and kept", "plaid", palette("#eee3d3", "#fbf4e8", "#4a352a", "#6b5546", "#965238", "#5c6a4a", "#cdb9a0"), "leaves"),
  "1989": scene("1989", "taylor", "1989", "A moment, captured", "instant-photo", palette("#deecf3", "#fbfcf6", "#304856", "#4e626e", "#3c6989", "#9b624d", "#bad0db"), "gulls"),
  showgirl: scene("showgirl", "taylor", "The Life of a Showgirl", "A little sparkle in the everyday", "satin", palette("#def4e8", "#fffbed", "#293f39", "#52665c", "#ab3d0d", "#387566", "#b8d6c7"), "crystals"),
  midnights: scene("midnights", "taylor", "Midnights", "Meet me in the quiet hours", "midnight-paper", palette("#dfe5f0", "#f8f6fc", "#293c59", "#475770", "#496799", "#79609b", "#b8c5db"), "constellation"),
  "speak-now": scene("speak-now", "taylor", "Speak Now", "Make room for your own story", "ribbon", palette("#eee4f3", "#fbf6ff", "#4d375c", "#695577", "#795092", "#916d3e", "#cfbada"), "ribbon"),
  poets: scene("poets", "taylor", "The Tortured Poets Department", "Notes from a life in progress", "manuscript", palette("#e9e5dd", "#f8f5ed", "#373731", "#5a5a51", "#5c5a50", "#717562", "#c8c3b6"), "manuscript"),
  debut: scene("debut", "taylor", "Taylor Swift", "Every good thing begins somewhere", "botanical", palette("#d9eeec", "#fcfbef", "#294b53", "#476570", "#287478", "#4f7795", "#b4d4d1"), "butterflies"),
  folklore: scene("folklore", "taylor", "folklore", "The things we choose to keep", "linen", palette("#e7e9e1", "#f7f8f0", "#38473c", "#536155", "#4e6b52", "#817254", "#c3ccbd"), "forest"),
} satisfies Record<string, ThemeScene>;
export const NEWFOUNDLAND_SCENES = {
  jellybean: scene("jellybean", "newfoundland", "Jellybean Row", "There’s a light on for you", "painted-wood", palette("#e9f3ef", "#fffdf0", "#283f50", "#50636b", "#a33751", "#26766f", "#bacecd"), "houses"),
  rain: scene("rain", "newfoundland", "Rainy St. John’s", "A bright spot in a rainy day", "raincoat", palette("#dfe7e6", "#f6f8f0", "#314b53", "#4b6267", "#816318", "#346c7c", "#b8cdce"), "rain"),
  trail: scene("trail", "newfoundland", "The coastal way up", "Two hours of coastline, then the sky", "trail-paper", palette("#e7eadc", "#faf9ed", "#384d47", "#45564d", "#536b40", "#326f80", "#c3ccb4"), "trail"),
  harbour: scene("harbour", "newfoundland", "St. John’s harbour", "A place for everything coming and going", "dock-ledger", palette("#dae6e9", "#f7f5e9", "#244955", "#3d5258", "#286577", "#95682f", "#b4cbd0"), "harbour"),
  "jag-lobby": scene("jag-lobby", "newfoundland", "Back at JAG", "Make yourself at home", "metallic", palette("#dedbda", "#fff7ed", "#382c30", "#68565b", "#9b3044", "#796572", "#bca9a6"), "jag"),
  "water-street": scene("water-street", "newfoundland", "Water Street", "A little stop along the way", "receipt", palette("#f0e4d6", "#fff8ed", "#4e392f", "#6d5649", "#a74736", "#43766e", "#d4bba5"), "shop"),
  "quidi-vidi": scene("quidi-vidi", "newfoundland", "Quidi Vidi", "The kettle’s on by the harbour", "kitchen", palette("#e4eee8", "#fcf8e9", "#354c43", "#54655b", "#387666", "#985062", "#c0d0c1"), "cottage"),
  "cape-spear": scene("cape-spear", "newfoundland", "Cape Spear", "A little closer to the morning", "horizon", palette("#eee5e3", "#fff8ef", "#485465", "#5c626e", "#756286", "#aa603e", "#cdc4d1"), "lighthouse"),
  "george-street": scene("george-street", "newfoundland", "George Street", "When the street lights come on", "venue", palette("#272c36", "#353b45", "#f8edd9", "#e0d4c1", "#efc16e", "#b8c7d2", "#6c6e73"), "street", true),
  battery: scene("battery", "newfoundland", "The Battery", "Little houses above the water", "clapboard", palette("#e3e9e6", "#fcf8ed", "#35535a", "#506468", "#346f77", "#a85240", "#c1d0c7"), "battery"),
  summit: scene("summit", "newfoundland", "At the summit", "Look how far you’ve come", "sky", palette("#e5edf0", "#fbf9ed", "#3a515c", "#51656b", "#436d73", "#8b7243", "#c3d3d7"), "tower"),
  "jag-music": scene("jag-music", "newfoundland", "JAG, after hours", "A familiar place to wind down", "gallery", palette("#d7e0e5", "#fff7e9", "#263d4b", "#4d6170", "#326079", "#806025", "#b5b4a3"), "music"),
} satisfies Record<string, ThemeScene>;
const ERA_ROUTES = {
  household: { home: "lover", calendar: "red", plan: "fearless", ledger: "reputation", more: "evermore", till: "1989", shift: "speak-now", entry: "lover" },
  personal: { home: "showgirl", calendar: "midnights", plan: "debut", ledger: "poets", more: "folklore", till: "showgirl", shift: "speak-now", entry: "showgirl" },
} as const;
const PLACE_ROUTES = {
  household: { home: "jellybean", calendar: "rain", plan: "trail", ledger: "harbour", more: "jag-lobby", till: "water-street", shift: "george-street", entry: "jellybean" },
  personal: { home: "quidi-vidi", calendar: "cape-spear", plan: "summit", ledger: "battery", more: "jag-music", till: "quidi-vidi", shift: "george-street", entry: "quidi-vidi" },
} as const;
export function resolveThemeScene(theme: ThemeId, route: SceneRoute, view: LedgerView): ThemeScene {
  if (theme === "taylor") return TAYLOR_SCENES[ERA_ROUTES[view][route]];
  if (theme === "newfoundland") return NEWFOUNDLAND_SCENES[PLACE_ROUTES[view][route]];
  const labels: Record<SceneRoute, [string, string, string]> = {
    home: ["The kitchen table", "A little space for life together", "kitchen"],
    calendar: ["The days ahead", "Make room for what matters", "calendar"],
    plan: ["Looking ahead", "Small plans, thoughtfully made", "pinboard"],
    ledger: ["The household ledger", "Every detail, in its place", "ledger"],
    more: ["Around the house", "Everything you need, close at hand", "shelf"],
    till: ["At the counter", "One little thing at a time", "counter"],
    shift: ["A day’s work", "A place to put the day down", "calendar"],
    entry: ["Welcome to Hearth", "A little space for life together", "kitchen"],
  };
  const [title, caption, motif] = labels[route];
  return scene(`classic-${route}`, "classic", title, caption, "paper", classicPalette, motif);
}

/** Every value here is allowlisted design data, never a financial fact. */
export function sceneTokens(value: ThemeScene): Record<string, string> {
  const p = value.palette;
  return {
    "--paper": p.paper, "--paper-2": `color-mix(in srgb, ${p.paper} 94%, ${p.accent})`, "--card": p.card,
    "--ink": p.ink, "--muted": p.muted, "--line": p.line, "--pine": value.dark ? "#9fd7bf" : "#356c55", "--pine-2": value.dark ? "#9fd7bf" : "#356c55",
    "--copper": value.dark ? "#f3aea3" : "#9d452f", "--gold": value.dark ? "#e2c68e" : "#927029",
    "--good": value.dark ? "#a3dfbc" : "#2c6a4e", "--danger": value.dark ? "#ffb6ab" : "#9b2c2c",
    "--theme-chalk-ink": "#f4f1e6", "--theme-chalk-board": value.dark ? "#1b2828" : "#29433b",
    "--theme-accent": p.accent, "--theme-second": p.second, "--theme-on-accent": value.dark ? "#232a2d" : "#fffaf2",
    "--theme-on-second": value.dark ? "#232a2d" : "#ffffff",
    "--theme-on-gold": value.dark ? "#232a2d" : "#ffffff",
    "--theme-calendar-heat": p.accent,
    "--theme-decor": p.second, "--theme-glow": value.dark ? "#ddbd7966" : "#f4bf7266",
    "--theme-radius": value.material === "newsprint" || value.material === "manuscript" ? "5px" : value.theme === "classic" ? "18px" : "14px",
    "--theme-display": value.material === "newsprint" || value.material === "instant-photo" ? '"Figtree", sans-serif' : value.material === "manuscript" ? '"IBM Plex Mono", monospace' : '"Fraunces", Georgia, serif',
    "--theme-hand": '"Caveat", cursive',
    "--font": '"Figtree", sans-serif', "--display": '"Fraunces", Georgia, serif',
    "--shadow": `0 12px 30px color-mix(in srgb, ${p.ink} 10%, transparent)`,
    "--desk": p.paper, "--brass": p.accent, "--felt": p.second,
    "--theme-chart-positive": value.dark ? "#9fd7bf" : "#356c55",
    "--theme-chart-negative": value.dark ? "#f3aea3" : "#a54d42",
    "--theme-chart-neutral": value.dark ? "#b1c9ec" : "#526d8a",
    "--theme-chart-plan": value.dark ? "#e9cc8b" : "#8d702c",
  };
}
