import { formatCad, COOK_EMPTY, cookOffEmpty } from "../core/index.ts";
import type { CookOffScore } from "../core/hercules.ts";

export function CookOffGlance({ score }: { score: CookOffScore }) {
  if (cookOffEmpty(score)) return <span>cold kettle</span>;
  return <span>{score.winner === "kitchen" ? "kettle" : score.winner === "takeout" ? "cup" : "tie"}</span>;
}

export function CookOffBody({ score }: { score: CookOffScore }) {
  if (cookOffEmpty(score)) return <p className="muted">{COOK_EMPTY}</p>;
  const total = Math.max(1, score.groceryCents + score.coffeeCents);
  return (
    <>
      <p>{score.sentence}</p>
      <p className="muted">Groceries {formatCad(score.groceryCents)}</p>
      <div className="cook-bar"><i style={{ width: `${(score.groceryCents / total) * 100}%` }} /></div>
      <p className="muted">Coffee & lunches {formatCad(score.coffeeCents)}</p>
      <div className="cook-bar"><i style={{ width: `${(score.coffeeCents / total) * 100}%` }} /></div>
    </>
  );
}
