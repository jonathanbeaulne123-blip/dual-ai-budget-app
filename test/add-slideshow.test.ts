import { describe, expect, it } from "vitest";
import {
  addSlideCopy,
  addSlidesFor,
  canAdvanceAddSlide,
  clampAddSlide,
  defaultSubcategoryForMode,
} from "../src/addSlideshow.ts";

const blank = {
  amount: "",
  subcategoryId: "SUB-FOOD-GROCERIES",
  accountId: "ACC-VISA",
  fromAccountId: "ACC-CHEQUING",
  toAccountId: "ACC-VISA",
  hours: "",
  sales: "0",
  cashTips: "0",
  ccTips: "0",
};

describe("add slideshow prompts", () => {
  it("gives expense, income, and transfer unique prompt sequences that end in Confirm", () => {
    expect(addSlidesFor({ mode: "expense" })).toEqual(["amount", "category", "account", "note", "confirm"]);
    expect(addSlidesFor({ mode: "income" })).toEqual(["amount", "category", "account", "note", "confirm"]);
    expect(addSlidesFor({ mode: "transfer" })).toEqual(["amount", "from", "to", "note", "confirm"]);
    expect(addSlideCopy("expense", "amount").title).toBe("How much did you spend?");
    expect(addSlideCopy("income", "amount").title).toBe("How much came in?");
    expect(addSlideCopy("transfer", "amount").title).toBe("How much are you moving?");
    expect(addSlideCopy("expense", "category").title).toBe("In which category?");
    expect(addSlideCopy("income", "category").title).toBe("What kind of income?");
    expect(addSlideCopy("expense", "account").title).toBe("Which account paid?");
    expect(addSlideCopy("income", "account").title).toBe("Which account received it?");
    expect(addSlideCopy("transfer", "from").title).toBe("From which account?");
    expect(addSlideCopy("transfer", "to").title).toBe("To which account?");
    expect(addSlideCopy("expense", "note").title).toBe("Add a picture or a note?");
    expect(addSlideCopy("expense", "confirm").title).toBe("Post this expense?");
    expect(addSlideCopy("income", "confirm").title).toBe("Post this income?");
    expect(addSlideCopy("transfer", "confirm").title).toBe("Move this money?");
    expect(addSlideCopy("transfer", "confirm").hint).toContain("Not income");
  });

  it("keeps shift clock-in, jobs Confirm, and pad ceremony as unique slideshows", () => {
    expect(addSlidesFor({ mode: "shift", shiftGate: "choose" })).toEqual(["shift-choose"]);
    expect(addSlidesFor({ mode: "shift", shiftGate: "clocked" })).toEqual(["shift-clocked"]);
    expect(addSlidesFor({ mode: "shift", shiftGate: "signOut", hasWorkJobs: true })).toEqual(["shift-jobs"]);
    expect(addSlidesFor({ mode: "shift", shiftGate: "signOut", hasWorkJobs: false })).toEqual([
      "shift-hours",
      "shift-sales",
      "shift-cashTips",
      "shift-ccTips",
      "account",
      "note",
      "confirm",
    ]);
    expect(addSlideCopy("shift", "shift-choose").title).toBe("Who is working?");
    expect(addSlideCopy("shift", "shift-hours", "signOut").title).toBe("How many hours?");
    expect(addSlideCopy("shift", "confirm").title).toBe("Post this shift?");
  });

  it("refuses to leave the amount pad empty and requires a different transfer destination", () => {
    expect(canAdvanceAddSlide("amount", blank)).toBe(false);
    expect(canAdvanceAddSlide("amount", { ...blank, amount: "12.50" })).toBe(true);
    expect(canAdvanceAddSlide("to", { ...blank, fromAccountId: "ACC-VISA", toAccountId: "ACC-VISA" })).toBe(false);
    expect(canAdvanceAddSlide("to", { ...blank, fromAccountId: "ACC-CHEQUING", toAccountId: "ACC-VISA" })).toBe(true);
    expect(clampAddSlide(9, ["amount", "confirm"])).toBe(1);
    expect(defaultSubcategoryForMode("income")).toBe("SUB-INCOME-WAGES");
    expect(defaultSubcategoryForMode("expense")).toBe("SUB-FOOD-GROCERIES");
  });
});
