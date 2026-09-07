import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../../src/App.tsx";
import { KitchenErrorBoundary } from "../../src/KitchenErrorBoundary.tsx";
import {
  catalogHousehold,
  type Household,
} from "../../src/core/index.ts";
import { saveSession } from "../../src/session.ts";
import { saveHousehold } from "../../src/storage.ts";
import { ledgerScaleFixture } from '../fixtures/ledger-scale.ts';
import "../../src/styles.css";
import "../../src/office.css";
import "../../src/office-phone.css";
import "../../src/office-wide.css";
import "../../src/ledger-story.css";
import "../../src/hearth-theme.css";
import "../../src/hercules.css";

const query = new URLSearchParams(location.search);
const memberId = query.get("member") === "MEM-002" ? "MEM-002" : "MEM-001";
if (!query.has('open')) {
const scaled = query.has('scale') ? ledgerScaleFixture(Number(query.get('scale'))) : null;
const household:Household=scaled
  ? {...scaled,householdId:query.get('household')??'HH-LEDGER-SYNC-BROWSER',linked:true}
  : {...catalogHousehold('development'),householdId:query.get('household')??'HH-LEDGER-SYNC-BROWSER',name:'Ledger sync proof',linked:true,revision:0,baseRevision:0,transactions:[],shifts:[],activity:[],commandReceipts:[]};
const imported=await fetch(`/ledger-sync/v2/development/${household.householdId}/import`,{method:'POST',headers:{Authorization:`Bearer local:${memberId}`,'Content-Type':'application/json'},body:JSON.stringify(household)});
if(!imported.ok)throw new Error(await imported.text());
saveSession("development", { memberId, view: "household", householdId: household.householdId });
await saveHousehold(household, {
  operatingEnvironment: "development",
  memberId,
  activate: true,
});

}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <KitchenErrorBoundary>
      <App />
    </KitchenErrorBoundary>
  </StrictMode>,
);
