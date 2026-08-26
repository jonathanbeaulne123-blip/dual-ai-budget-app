import { describe, expect, it } from "vitest";
import { parseOfx } from "../src/core/index.ts";

const SGML = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>CAD
<BANKACCTFROM><BANKID>004<ACCTID>1234567890<ACCTTYPE>CHECKING</BANKACCTFROM>
<OPENBAL>1297.35
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260820120000.000[-5:EST]<TRNAMT>-47.23<FITID>FIT-001<NAME>No Frills<MEMO>Groceries</STMTTRN>
<STMTTRN><TRNTYPE>DIRECTDEP<DTPOSTED>20260822120000<TRNAMT>1200.00<FITID>FIT-002<NAME>Payroll</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>2450.12<DTASOF>20260823120000</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><CURDEF>CAD</CURDEF>
<CCACCTFROM><ACCTID>9999888877776666</ACCTID></CCACCTFROM><BANKTRANLIST>
<STMTTRN><TRNTYPE>POS</TRNTYPE><DTPOSTED>20260824</DTPOSTED><TRNAMT>-12.50</TRNAMT><FITID>CARD-1</FITID><NAME>Cafe</NAME></STMTTRN>
<STMTTRN><TRNTYPE>PAYMENT</TRNTYPE><DTPOSTED>20260825</DTPOSTED><TRNAMT>200.00</TRNAMT><FITID>CARD-2</FITID><NAME>PAYMENT RECEIVED</NAME></STMTTRN>
</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;

describe("QFX/OFX parser", () => {
  it("parses OFX 1.x SGML leaf tags, statement metadata, signs, and stable FITID provenance", () => {
    const parsed = parseOfx(SGML, "chequing.ofx");
    expect(parsed.accounts).toEqual([expect.objectContaining({
      accountRef: "004:1234567890",
      accountLast4: "7890",
      kind: "bank",
      currency: "CAD",
      openingBalanceCents: 129735,
      ledgerBalanceCents: 245012,
      ledgerBalanceDate: "2026-08-23",
    })]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toEqual(expect.objectContaining({
      date: "2026-08-20",
      amountCents: 4723,
      signedAmountCents: -4723,
      suggestedType: "expense",
      provenanceId: "ofx:004:1234567890:FIT-001",
      place: "No Frills",
    }));
    expect(parsed.rows[1]).toEqual(expect.objectContaining({ amountCents: 120000, suggestedType: "income" }));
    expect(parseOfx(SGML, "chequing.ofx").rows.map((row) => row.id)).toEqual(parsed.rows.map((row) => row.id));
  });

  it("parses OFX 2.x XML/QFX credit-card purchases and leaves payments as transfers", () => {
    const parsed = parseOfx(XML, "visa.qfx");
    expect(parsed.sourceKind).toBe("qfx");
    expect(parsed.accounts[0]).toEqual(expect.objectContaining({ kind: "credit-card", accountLast4: "6666" }));
    expect(parsed.rows.map((row) => [row.suggestedType, row.amountCents])).toEqual([
      ["expense", 1250],
      ["transfer", 20000],
    ]);
  });

  it("fails closed for empty, malformed, or transaction-free exports", () => {
    expect(() => parseOfx("", "empty.ofx")).toThrow(/empty/i);
    expect(() => parseOfx("not a bank file", "bad.ofx")).toThrow(/OFX data block/i);
    expect(() => parseOfx("<OFX><STMTRS><CURDEF>CAD</STMTRS></OFX>", "none.ofx")).toThrow(/no bank or credit-card|no usable/i);
  });

  it("stages a long bank history without a transaction-count ceiling", () => {
    const transactions = Array.from({ length: 1_500 }, (_, index) => (
      `<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260820<TRNAMT>-${(index + 1).toFixed(2)}<FITID>LONG-${index}<NAME>Merchant ${index}</STMTTRN>`
    )).join("");
    const source = `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>CAD<BANKACCTFROM><ACCTID>4821</BANKACCTFROM><BANKTRANLIST>${transactions}</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const parsed = parseOfx(source, "history.qfx");
    expect(parsed.rows).toHaveLength(1_500);
    expect(new Set(parsed.rows.map((row) => row.provenanceId)).size).toBe(1_500);
  });
});
