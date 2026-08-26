/**
 * Scheme A — human labels for every user-visible chrome surface (D-144).
 *
 * Cat / kitchen metaphors belong only in Hercules AI talk and Hercules Pro.
 * When those surfaces use a metaphor, pair it with {@link gloss} so the human
 * money meaning is never left implied.
 */

export const UI = {
  groceries: "Groceries",
  coffee: "Coffee",
  goals: "Goals",
  startGoal: "Start this goal",
  markPurchased: "Mark purchased",
  completedGoals: "Completed goals",
  goalsSavings: "Goals savings",
  sitDown: "Sit-down",
  closeMonth: "Close month",
  closePack: "Close pack",
  health: "Health",
  shifts: "Shifts",
  jobs: "Jobs",
  pad: "Pad",
  notes: "Notes",
  herculesOutfits: "Hercules outfits",
  kitchenVsTakeout: "Kitchen vs takeout",
  leftover: "Leftover",
  taxSetAside: "Tax set-aside",
  post: "Post",
  due: "Due",
  add: "Add",
  confirm: "Confirm",
  books: "Books",
  askHercules: "Ask Hercules",
  howCanIHelp: "How can I help",
} as const;

export function postGroceriesLabel(money?: string): string {
  return money ? `Post groceries ${money}` : "Post groceries";
}

export function postCoffeeLabel(money?: string): string {
  return money ? `Post coffee ${money}` : "Post coffee";
}

/** Hercules-only: keep the cat voice, always name the human job. */
export function gloss(catPhrase: string, humanMeaning: string): string {
  const cat = catPhrase.trim();
  const human = humanMeaning.trim();
  if (!cat) return human;
  if (!human) return cat;
  if (cat.toLowerCase().includes(human.toLowerCase())) return cat;
  return `${cat} — ${human}`;
}
