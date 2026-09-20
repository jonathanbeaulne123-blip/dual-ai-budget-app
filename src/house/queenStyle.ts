export type QueenStyle = { crown:"garden"|"brass"|"none"; flowers:"mandevilla"|"ivory"|"rose"; pot:"terracotta"|"porcelain"|"sea-glass"; trellis:"arch"|"fan"|"none"; light:"morning"|"amber"|"moon"; minions:"crescent"|"pairs"|"garden" };
export const DEFAULT_QUEEN_STYLE: QueenStyle = {crown:"garden", flowers:"mandevilla", pot:"terracotta", trellis:"arch", light:"morning", minions:"crescent"};
export const QUEEN_STYLE_OPTIONS = {crown:["garden","brass","none"],flowers:["mandevilla","ivory","rose"],pot:["terracotta","porcelain","sea-glass"],trellis:["arch","fan","none"],light:["morning","amber","moon"],minions:["crescent","pairs","garden"]} as const;
export function parseQueenStyle(value: unknown): QueenStyle {
  const row = value && typeof value === "object" ? value as Record<string,unknown> : {};
  return Object.fromEntries(Object.entries(QUEEN_STYLE_OPTIONS).map(([key, values]) => [key, (values as readonly unknown[]).includes(row[key]) ? row[key] : DEFAULT_QUEEN_STYLE[key as keyof QueenStyle]])) as QueenStyle;
}
