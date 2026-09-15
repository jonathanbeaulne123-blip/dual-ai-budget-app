import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QueenBankFlat } from "../src/queen/QueenBankFlat.tsx";
import { BANK_DRESS, BANK_DRESS_WORDS, bankDressPieces } from "../src/queen/world/queenBankDress.ts";
import { BANK_SCULPT, bankGeometry, type BankForm } from "../src/queen/world/queenBankSculpture.ts";
import { cellarPurposeWords } from "../src/queen/QueenCellarRail.tsx";
import { CELLAR_ZOOM, CELLAR_ZOOM_KEY, cellarCellPx, clampCellarZoom, readCellarZoom, stepCellarZoom, storeCellarZoom } from "../src/queen/cellarZoom.ts";

const FORMS = Object.keys(BANK_SCULPT) as BankForm[];

describe("the kitty banks' dressing — a purpose you can read from across the room", () => {
  it("dresses every purpose differently, and leaves the month on the ribbon bare", () => {
    const seen = new Map<string, BankForm>();
    for (const form of FORMS) {
      const key = bankDressPieces(form).join("+") || "bare";
      if (form === "jar") { expect(key).toBe("bare"); expect(BANK_DRESS_WORDS.jar).toBe(""); continue; }
      expect(seen.has(key), `${form} wears what ${seen.get(key)} wears (${key})`).toBe(false);
      seen.set(key, form);
      expect(BANK_DRESS_WORDS[form].length).toBeGreaterThan(8);
    }
    expect(BANK_DRESS.bill).toEqual({ hat: "cap", back: "none", collar: "none", foot: "envelope" });
    expect(BANK_DRESS.recurring.back).toBe("key");
    expect(BANK_DRESS.subscription.collar).toBe("bell");
    expect(BANK_DRESS.appointment.hat).toBe("calendar");
    expect(BANK_DRESS.planned.hat).toBe("paper");
    expect(BANK_DRESS.goal.foot).toBe("flag");
  });

  it("draws the same dressing in the flat twin, with the crown still in front of any hat", () => {
    for (const form of FORMS) {
      const html = renderToStaticMarkup(createElement(QueenBankFlat, { form, fill: 0.5 }));
      const pieces = bankDressPieces(form);
      expect(html).toContain(`data-dress="${pieces.join(" ") || "bare"}"`);
      for (const piece of pieces) expect(html, `${form} should draw its ${piece}`).toContain(`queen-bank-flat__dress--${piece === "envelope" ? "envelope" : piece === "flag" ? "flag" : piece === "key" ? "key" : piece === "bell" ? "bell" : piece}`);
      if (form === "jar") expect(html).not.toContain("queen-bank-flat__dress");
      // The slot (or the lid) is drawn after every hat, so it stays readable: accepts, or refuses.
      const hat = html.indexOf("queen-bank-flat__dress--");
      const crown = Math.max(html.lastIndexOf("queen-bank-flat__slot"), html.lastIndexOf("queen-bank-flat__lid\""));
      if (BANK_DRESS[form].hat !== "none") expect(crown).toBeGreaterThan(hat);
    }
  });

  it("builds only the pieces a form wears in the sculpture's geometry, in the cat's own units", () => {
    const kept: string[] = [];
    const keep = <G extends { type: string }>(g: G): G => { kept.push(g.type); return g; };
    const bill = bankGeometry("bill", keep as never);
    expect(bill.dress.capCrown && bill.dress.envelope).toBeTruthy();
    expect(bill.dress.keyBow ?? bill.dress.bell ?? bill.dress.leaf ?? bill.dress.paperHat ?? bill.dress.flag).toBeNull();
    const jar = bankGeometry("jar", keep as never);
    expect(Object.values(jar.dress).every((piece) => piece === null)).toBe(true);
    const recurring = bankGeometry("recurring", keep as never);
    expect(recurring.dress.keyBow?.type).toBe("TorusGeometry");
    expect(bankGeometry("goal", keep as never).dress.flag?.getAttribute("normal")).toBeTruthy();
  });

  it("names the dressing in the rail's words", () => {
    expect(cellarPurposeWords("house")).toBe("house bill, wearing a postman's cap and an envelope");
    expect(cellarPurposeWords("subscription")).toContain("a collar with a bell");
    expect(cellarPurposeWords("potential")).toBe("planned, not posted, wearing a folded paper hat");
  });
});

describe("the size of the banks on the rail", () => {
  it("stands larger by default, clamps to its range, and steps by a quarter", () => {
    expect(CELLAR_ZOOM.default).toBeGreaterThan(1);
    expect(clampCellarZoom(9)).toBe(CELLAR_ZOOM.max);
    expect(clampCellarZoom(0)).toBe(CELLAR_ZOOM.min);
    expect(clampCellarZoom(Number.NaN)).toBe(CELLAR_ZOOM.default);
    expect(stepCellarZoom(1.4, 1)).toBe(1.5);
    expect(stepCellarZoom(1.5, -1)).toBe(1.25);
    expect(stepCellarZoom(CELLAR_ZOOM.max, 1)).toBe(CELLAR_ZOOM.max);
    expect(cellarCellPx(1)).toBe(44);
    expect(cellarCellPx(1.5)).toBe(66);
  });

  it("is remembered on the device, and forgotten gracefully where storage refuses", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
    expect(readCellarZoom(storage)).toBe(CELLAR_ZOOM.default);
    storeCellarZoom(1.75, storage);
    expect(store.get(CELLAR_ZOOM_KEY)).toBe("1.75");
    expect(readCellarZoom(storage)).toBe(1.75);
    store.set(CELLAR_ZOOM_KEY, "garbage");
    expect(readCellarZoom(storage)).toBe(CELLAR_ZOOM.default);
    const refusing = { getItem: () => { throw new Error("private"); }, setItem: () => { throw new Error("private"); } };
    expect(readCellarZoom(refusing)).toBe(CELLAR_ZOOM.default);
    expect(() => storeCellarZoom(2, refusing)).not.toThrow();
    expect(readCellarZoom(null)).toBe(CELLAR_ZOOM.default);
  });
});
