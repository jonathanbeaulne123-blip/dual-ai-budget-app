import { it } from "vitest";
import { relative } from "node:path";
import { listComponentFiles } from "../scripts/copy-budget.mjs";
import { COPY_TABLE_FILES, RETIRED_WORDS } from "../src/core/terms.ts";
import { renderedStrings } from "./rendered-strings.ts";
it("prints", () => {
  const out: string[] = [];
  for (const file of [...listComponentFiles("src"), ...COPY_TABLE_FILES]) {
    const rel = relative(process.cwd(), file).replace(/\\/g, "/");
    if (rel === "src/core/toolAtlas.ts") continue;
    for (const s of renderedStrings(file) as { text: string; line?: number }[]) {
      for (const rule of RETIRED_WORDS) if (rule.pattern.test(s.text)) out.push(`${rel}:${(s as any).line ?? "?"} [${rule.word}] ${JSON.stringify(s.text).slice(0, 160)}`);
    }
  }
  console.log("HITS\n" + out.join("\n"));
});
