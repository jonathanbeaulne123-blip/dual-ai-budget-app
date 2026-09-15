import { describe, expect, it } from "vitest";
import { pathWords } from "../src/core/pathWords.ts";
import { pathLabel } from "../src/core/pathStones.ts";
import { bottleWords } from "../src/path/bottle.ts";
import { charterPurposeWords } from "../src/path/together.ts";

describe("Our Path words: people's own text, never an amount", () => {
  it("removes amounts and stray dollar signs and tidies the spaces", () => {
    expect(pathWords("Pay $1,450 rent", 60, "A task")).toBe("Pay rent");
    expect(pathWords("  Split   the $ 80.25 dinner ,  thanks ", 60, "A task")).toBe("Split the dinner, thanks");
    expect(pathWords("Groceries (about $120)", 60, "A task")).toBe("Groceries (about)");
    expect(pathWords("Rent ($1,450)", 60, "A task")).toBe("Rent");
  });

  it("falls back when nothing but a figure was written", () => {
    expect(pathWords("100$", 60, "A task")).toBe("A task");
    expect(pathWords("$ 42.50", 60, "An offer")).toBe("An offer");
    expect(pathWords("", 60, "A decision")).toBe("A decision");
    expect(pathWords(null, 60, "A decision")).toBe("A decision");
    expect(pathWords(undefined, 60, "")).toBe("");
  });

  it("drops every digit run, so a year goes too (documented and acceptable)", () => {
    expect(pathWords("Trip 2027", 60, "A task")).toBe("Trip");
    expect(pathWords("Paid $1,240.50 for 3 nights. Worth it.", 200, "")).toBe("Paid for nights. Worth it.");
  });

  it("caps on a word boundary with an ellipsis and never runs past the limit", () => {
    const long = "Pack the lantern, the blanket, the map of the islands and the little red kettle for the trip";
    const cut = pathWords(long, 60, "A task");
    expect(cut.length).toBeLessThanOrEqual(60);
    expect(cut.endsWith("…")).toBe(true);
    expect(long.startsWith(cut.slice(0, -1))).toBe(true);
    expect(cut.slice(0, -1).endsWith(" ")).toBe(false);
    // One unbroken word is cut hard.
    expect(pathWords("a".repeat(100), 20, "")).toBe(`${"a".repeat(19)}…`);
    expect(pathWords("short", 60, "A task")).toBe("short");
  });

  it("is what the island's labels, the bottle and the Charter use", () => {
    expect(pathLabel("Pay $1,450 rent")).toBe("Pay rent");
    expect(pathLabel("$99")).toBe("A task");
    expect(pathLabel("$99", "An offer")).toBe("An offer");
    expect(bottleWords("$5 and 7.25 and 1,000,000")).toBe("and and");
    expect(bottleWords("  $40  ")).toBe("");
    expect(charterPurposeWords("Keep $500 aside so rent is calm.")).toBe("Keep aside so rent is calm.");
    expect(charterPurposeWords("word ".repeat(40), 50).length).toBeLessThanOrEqual(50);
  });
});
