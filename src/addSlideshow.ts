import { ceremonyFields, ceremonyCopy, type ShiftGate } from "./core/shiftClock.ts";
import type { Visibility } from "./core/types.ts";

export const ADD_MODES = ["expense", "income", "shift", "transfer"] as const;
export type AddMode = (typeof ADD_MODES)[number];

export type AddFormFields = {
  date: string;
  amount: string;
  accountId: string;
  subcategoryId: string;
  note: string;
  place: string;
  who: string;
  fromAccountId: string;
  toAccountId: string;
  memberId: string;
  sales: string;
  cashTips: string;
  ccTips: string;
  hours: string;
  customersServed: string;
  staffingCount: string;
  eventTag: string;
  visibility: Visibility;
  occurredAt: string;
  useHouseholdFund: boolean;
  fundedAmount: string;
  fundDestinationAccountId: string;
};

export type AddSlideId =
  | "amount"
  | "category"
  | "account"
  | "from"
  | "to"
  | "note"
  | "confirm"
  | "shift-choose"
  | "shift-clocked"
  | "shift-jobs"
  | "shift-hours"
  | "shift-sales"
  | "shift-cashTips"
  | "shift-ccTips";

export type AddSlideCopy = {
  title: string;
  hint: string;
  enterLabel: string;
};

const SHIFT_FIELD_SLIDES = ["shift-hours", "shift-sales", "shift-cashTips", "shift-ccTips"] as const;
type ShiftFieldSlide = (typeof SHIFT_FIELD_SLIDES)[number];

export function addSlidesFor(input: {
  mode: AddMode;
  shiftGate?: ShiftGate;
  hasWorkJobs?: boolean;
}): AddSlideId[] {
  if (input.mode === "expense" || input.mode === "income") {
    return ["amount", "category", "account", "note", "confirm"];
  }
  if (input.mode === "transfer") {
    return ["amount", "from", "to", "note", "confirm"];
  }
  const gate = input.shiftGate ?? "choose";
  if (gate === "choose") return ["shift-choose"];
  if (gate === "clocked") return ["shift-clocked"];
  if (input.hasWorkJobs) return ["shift-jobs"];
  const fields = ceremonyFields(gate);
  const ceremony: AddSlideId[] = fields.map((field) => `shift-${field}` as ShiftFieldSlide);
  return [...ceremony, "account", "note", "confirm"];
}

export function addSlideCopy(mode: AddMode, slide: AddSlideId, shiftGate: ShiftGate = "choose"): AddSlideCopy {
  if (slide === "amount") {
    if (mode === "income") {
      return { title: "How much came in?", hint: "Type the CAD, then Enter. Confirm still posts.", enterLabel: "Enter" };
    }
    if (mode === "transfer") {
      return { title: "How much are you moving?", hint: "Not income. Not spend. Enter, then pick the two rooms.", enterLabel: "Enter" };
    }
    return { title: "How much did you spend?", hint: "Giant cashpad. Enter opens the next prompt. Confirm still posts.", enterLabel: "Enter" };
  }
  if (slide === "category") {
    if (mode === "income") {
      return { title: "What kind of income?", hint: "Wages, tips, or a new income category. Tap one to continue.", enterLabel: "Continue" };
    }
    return { title: "In which category?", hint: "Tap a category to continue. Add a new one here if it is missing.", enterLabel: "Continue" };
  }
  if (slide === "account") {
    if (mode === "income") {
      return { title: "Which account received it?", hint: "Paper rooms, same as Books. Tap the tile that took the money.", enterLabel: "Continue" };
    }
    if (mode === "shift") {
      return { title: "Which account should hold this?", hint: "Tips and wages land here when Confirm posts.", enterLabel: "Continue" };
    }
    return { title: "Which account paid?", hint: "Paper rooms, same as Books. Tap the card or cash that paid.", enterLabel: "Continue" };
  }
  if (slide === "from") {
    return { title: "From which account?", hint: "The room money leaves. Not income. Not spend.", enterLabel: "Continue" };
  }
  if (slide === "to") {
    return { title: "To which account?", hint: "The room money arrives. Pick a different room than From.", enterLabel: "Continue" };
  }
  if (slide === "note") {
    if (mode === "transfer") {
      return { title: "Want a note?", hint: "Optional. Skip is fine. Pictures stay on this phone.", enterLabel: "Continue" };
    }
    if (mode === "shift") {
      return { title: "Add a picture or a note?", hint: "Optional. A tip-sheet photo still drafts — it never posts.", enterLabel: "Continue" };
    }
    return { title: "Add a picture or a note?", hint: "Optional. Pictures stay on this phone. Confirm posts the CAD and note.", enterLabel: "Continue" };
  }
  if (slide === "confirm") {
    if (mode === "income") {
      return { title: "Post this income?", hint: "Read it once. Confirm writes. Back changes a prompt.", enterLabel: "Post income" };
    }
    if (mode === "transfer") {
      return { title: "Move this money?", hint: "Not income. Not spend. Confirm writes the paired movement.", enterLabel: "Move money" };
    }
    if (mode === "shift") {
      return { title: "Post this shift?", hint: "Same math that posts. Confirm writes wages and tips.", enterLabel: "Post shift" };
    }
    return { title: "Post this expense?", hint: "Who, date, and Fund stay here. Confirm writes.", enterLabel: "Post" };
  }
  if (slide === "shift-choose") {
    const copy = ceremonyCopy("choose");
    return { title: "Who is working?", hint: copy.hint, enterLabel: "Clock in" };
  }
  if (slide === "shift-clocked") {
    const copy = ceremonyCopy("clocked");
    return { title: copy.title, hint: copy.hint, enterLabel: "Sign out" };
  }
  if (slide === "shift-jobs") {
    return { title: "Finish this shift", hint: "Jobs Confirm still posts. The slideshow never writes money.", enterLabel: "Next" };
  }
  const field = slide.replace("shift-", "") as "hours" | "sales" | "cashTips" | "ccTips";
  const copy = ceremonyCopy(shiftGate, field);
  if (field === "hours") {
    return { title: "How many hours?", hint: copy.hint, enterLabel: "Enter" };
  }
  if (field === "sales") {
    return { title: "How much in sales?", hint: copy.hint, enterLabel: "Enter" };
  }
  if (field === "cashTips") {
    return { title: "How much cash tips?", hint: copy.hint, enterLabel: "Enter" };
  }
  return { title: "How much card tips?", hint: copy.hint, enterLabel: "Enter" };
}

export function addSlideNeedsAmount(slide: AddSlideId): boolean {
  return slide === "amount" || slide === "shift-hours" || slide === "shift-sales" || slide === "shift-cashTips" || slide === "shift-ccTips";
}

export function canAdvanceAddSlide(slide: AddSlideId, form: {
  amount: string;
  subcategoryId: string;
  accountId: string;
  fromAccountId: string;
  toAccountId: string;
  hours: string;
  sales: string;
  cashTips: string;
  ccTips: string;
}): boolean {
  if (slide === "amount") return Boolean(form.amount.trim());
  if (slide === "category") return Boolean(form.subcategoryId);
  if (slide === "account") return Boolean(form.accountId);
  if (slide === "from") return Boolean(form.fromAccountId);
  if (slide === "to") return Boolean(form.toAccountId) && form.toAccountId !== form.fromAccountId;
  if (slide === "shift-hours") return Boolean(form.hours.trim());
  if (slide === "shift-sales") return true;
  if (slide === "shift-cashTips" || slide === "shift-ccTips") return true;
  return true;
}

export function clampAddSlide(index: number, slides: readonly AddSlideId[]): number {
  if (slides.length === 0) return 0;
  return Math.max(0, Math.min(index, slides.length - 1));
}

export function defaultSubcategoryForMode(mode: AddMode): string {
  if (mode === "income") return "SUB-INCOME-WAGES";
  return "SUB-FOOD-GROCERIES";
}
