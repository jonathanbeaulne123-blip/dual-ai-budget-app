import type { PlanStudioSection } from "../PlanStudio.tsx";

export type ToolId = "past" | "tracing" | "letter" | "chairs" | "recipe" | "kitty" | "lamp";
export type ToolTab = { label: string; section: PlanStudioSection };
export type ToolDef = { id: ToolId; name: string; purpose: string; tabs: ToolTab[]; householdOnly?: boolean };

/**
 * The drawer (Round 1D) in its fixed order. At first every object opens the
 * studio section that already does the job (Phase 1), so nothing is lost.
 */
export const TOOLS: readonly ToolDef[] = [
  { id: "past", name: "Past sheets", purpose: "history · reflection", tabs: [{ label: "Past versions", section: "history" }, { label: "The back of the sheet", section: "reflection" }] },
  { id: "tracing", name: "Tracing paper", purpose: "try a what-if", tabs: [{ label: "What-ifs", section: "scenarios" }, { label: "Can we afford…?", section: "everyday" }, { label: "A pay runs late", section: "protect" }, { label: "Where these come from", section: "assumptions" }] },
  { id: "letter", name: "Letter tray", purpose: "between yours and ours", tabs: [{ label: "Offers", section: "bridge" }], householdOnly: true },
  { id: "chairs", name: "Two chairs", purpose: "start our check-in together", tabs: [{ label: "The Sitdown", section: "sitdown" }, { label: "Read it together", section: "review" }] },
  { id: "recipe", name: "Recipe box", purpose: "one useful idea", tabs: [{ label: "One idea", section: "learn" }] },
  { id: "kitty", name: "Kitty bank", purpose: "goals & reserves", tabs: [{ label: "Goals & reserves", section: "goals" }] },
  { id: "lamp", name: "Desk lamp", purpose: "coaching & memory", tabs: [{ label: "Coaching & memory", section: "settings" }] },
];

export function toolById(id: ToolId): ToolDef {
  return TOOLS.find(row => row.id === id)!;
}

/** A look-closer chip: the same tool sheet, opened already on the right section. */
export type LookCloser = { label: string; tool: ToolId; section: PlanStudioSection };
