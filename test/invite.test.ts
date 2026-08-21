import { describe, expect, it } from "vitest";
import {
  formatInvitePhrase,
  inviteFromLocation,
  inviteFromText,
  isValidInviteToken,
  joinUrlFor,
  randomInvitePhrase,
} from "../src/core/invite.ts";
import { applyHearthPass, makeHearthPass, parseHearthPass } from "../src/core/pass.ts";
import { catalogHousehold } from "../src/core/seed.ts";
import { postEntry } from "../src/core/commands.ts";

describe("household invite phrases", () => {
  it("creates a three-word kitchen phrase instead of a six-character code", () => {
    const phrase = randomInvitePhrase();
    expect(isValidInviteToken(phrase)).toBe(true);
    expect(phrase.split("-")).toHaveLength(3);
    expect(formatInvitePhrase(phrase)).toMatch(/ · /);
  });

  it("accepts spoken spacing, a join URL, and a leftover six-character code", () => {
    const phrase = "cedar lantern maple";
    expect(inviteFromText(phrase)).toBe("cedar-lantern-maple");
    expect(inviteFromText("Cedar, lantern, maple!")).toBe("cedar-lantern-maple");
    expect(inviteFromText("https://hearth.example/?join=cedar-lantern-maple")).toBe("cedar-lantern-maple");
    expect(inviteFromText("https://hearth.example/join/maple-hearth-linen")).toBe("maple-hearth-linen");
    expect(isValidInviteToken("K7M2PS")).toBe(true);
    expect(inviteFromText("k7m-2ps")).toBe("K7M2PS");
    expect(isValidInviteToken("cedar lantern maple")).toBe(true);
    expect(isValidInviteToken("not a household")).toBe(false);
  });

  it("reads a join token from the page location", () => {
    expect(inviteFromLocation("https://hearth-books.jonathan-beaulne123.workers.dev/?join=cedar-lantern-maple")).toBe("cedar-lantern-maple");
    expect(inviteFromLocation("https://hearth-books.pages.dev/?join=cedar-lantern-maple")).toBe("cedar-lantern-maple");
    expect(inviteFromLocation("https://hearth-books.example.workers.dev/?join=cedar-lantern-maple")).toBe("cedar-lantern-maple");
    expect(joinUrlFor("cedar lantern maple", "https://hearth.example")).toBe("https://hearth.example/?join=cedar-lantern-maple");
  });
});

describe("Hearth Pass", () => {
  it("shares household rows and keeps personal rows off the pass", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: "2026-08-18",
      type: "expense",
      amount: "12.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Shared milk",
      createdBy: "MEM-002",
      visibility: "household",
      confirmDuplicate: true,
    }).household;
    household = postEntry(household, {
      date: "2026-08-18",
      type: "expense",
      amount: "9.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-LIFE-FUN",
      note: "Jonathan only",
      createdBy: "MEM-002",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;

    const pass = makeHearthPass(household);
    expect(pass.kind).toBe("hearth-pass");
    expect(pass.shared.transactions.map((tx) => tx.note)).toEqual(["Shared milk"]);
    const parsed = parseHearthPass(JSON.stringify(pass));
    const joined = applyHearthPass(null, parsed, "MEM-001");
    expect(joined.transactions.map((tx) => tx.note)).toEqual(["Shared milk"]);
    expect(joined.transactions.some((tx) => tx.note === "Jonathan only")).toBe(false);
    expect(joined.members.map((member) => member.name).sort()).toEqual(["Bianca", "Jonathan"]);
  });
});
