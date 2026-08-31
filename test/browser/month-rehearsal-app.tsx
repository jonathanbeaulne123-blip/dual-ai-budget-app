import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../../src/App.tsx";
import { KitchenErrorBoundary } from "../../src/KitchenErrorBoundary.tsx";
import {
  catalogHousehold,
  startMonthRehearsal,
  type Household,
} from "../../src/core/index.ts";
import { saveSession } from "../../src/session.ts";
import { saveHousehold } from "../../src/storage.ts";
import "../../src/styles.css";
import "../../src/office.css";
import "../../src/office-phone.css";
import "../../src/office-wide.css";
import "../../src/ledger-story.css";
import "../../src/hearth-theme.css";
import "../../src/hercules.css";

const query = new URLSearchParams(location.search);
const memberId = query.get("member") === "MEM-002" ? "MEM-002" : "MEM-001";
const active = query.get("active") === "1";

let household: Household = {
  ...catalogHousehold("development"),
  householdId: "HH-MONTH-REHEARSAL-BROWSER-PROOF",
  name: "Month rehearsal proof",
  linked: false,
  revision: 0,
  baseRevision: 0,
  lastCommittedAt: null,
  transactions: [],
  shifts: [],
  activity: [],
  commandReceipts: [],
  monthRehearsals: [],
};

if (active) {
  household = startMonthRehearsal(household, {
    monthKey: "2026-09",
    biancaParticipantId: "MEM-001",
    jonathanPartnerId: "MEM-002",
    startedByMemberId: memberId,
    now: "2026-08-30T16:00:00.000Z",
  }).household;
}

saveSession("development", { memberId, view: "household", householdId: household.householdId });
await saveHousehold(household, {
  operatingEnvironment: "development",
  memberId,
  activate: true,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <KitchenErrorBoundary>
      <App />
    </KitchenErrorBoundary>
  </StrictMode>,
);
