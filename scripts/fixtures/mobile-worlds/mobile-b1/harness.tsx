// Fictional source-component fixture adapted from the completed mobile review at bf33c87.
import { useDialog } from '/src/useDialog';
import { newSplitDraft, editSplitDraft } from '/src/core/splitDraft';
import '/src/styles.css';
import '/src/hearth-theme.css';
// @vitest-environment jsdom
import { createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

import { AddSlideshow, type AddFormFields, type AddMode } from "/src/AddSlideshow.tsx";
import { catalogHousehold, todayKey, JOINT, type Visibility } from "/src/core/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const params=new URLSearchParams(location.search);
const household = catalogHousehold("development");
if(params.has('long'))household.members=household.members.map((m,i)=>({...m,name:i?'Alexandra-Lee Beaulne':'Jean-Christophe Jonathan'}));
if(params.has('three'))household.members.push({...household.members[0],id:'THIRD',name:'Third person'});
window.evidenceActions=[];
const today = todayKey(new Date("2026-08-31T16:00:00.000Z"));

function emptyForm(): AddFormFields {
  return {
    date: today,
    amount: "",
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    note: "",
    place: "",
    who: JOINT,
    fromAccountId: "ACC-CHEQUING",
    toAccountId: "ACC-VISA",
    memberId: "MEM-002",
    sales: "0",
    cashTips: "0",
    ccTips: "0",
    hours: "",
    customersServed: "40",
    staffingCount: "4",
    eventTag: "regular",
    visibility: "household" as Visibility,
    occurredAt: "",
    useHouseholdFund: false,
    fundedAmount: "",
    fundDestinationAccountId: "ACC-VISA",
  };
}

const placePrefs = {
  displayTimeZone: "America/Toronto",
  locationAllowed: false,
  addPromptSeen: true,
  stampTime: true,
  stampCoords: true,
  shareCoordsWithModel: false,
  updatedAt: "2026-08-31T00:00:00.000Z",
};

function Harness({
  mode,
  onPost,
  splitProbe = false,
  roster = household,
  shares = { "MEM-001": 50, "MEM-002": 50 },
  scopeValid = true,
}: {
  mode: AddMode;
  onPost: () => void;
  splitProbe?: boolean;
  roster?: typeof household;
  shares?: Record<string, number>;
  scopeValid?: boolean;
}) {
  const [form, setForm] = useState<AddFormFields>(() => splitProbe ? { ...emptyForm(), amount: params.has("figures")?"12345678.91":"0.01", who: "split" } : emptyForm());
  const [draft,setDraft]=useState(()=>newSplitDraft(household,{memberId:'MEM-002',view:'household',generation:1}));
  const [open,setOpen]=useState(true);
  const sheetRef=useDialog(open,()=>{window.evidenceActions.push('close');setOpen(false);});
  const [slideIndex, setSlideIndex] = useState(splitProbe ? 4 : 0);
  const categories = household.categories.filter((category) => (
    category.recordType === "category"
    && category.active
    && category.transactionType === (mode === "income" ? "income" : "expense")
  ));
  if(!open)return <p data-closed>Add closed.</p>;
  return createElement(AddSlideshow, {
    sheetRef,
    mode,
    onSwitchMode: () => undefined,
    form,
    setForm,
    household: roster,
    booksHousehold: roster,
    pickerAccounts: household.accounts.filter((account) => account.active),
    categories,
    today,
    slideIndex,
    onSlideIndex: setSlideIndex,
    shiftGate: "choose",
    hasWorkJobs: false,
    shiftPreview: { netTipsCents: 0, wagesCents: 0 },
    onHoursDirty: () => undefined,
    hoursDirty: false,
    onClockIn: () => undefined,
    onAlreadyOff: () => undefined,
    onSignOut: () => undefined,
    onNeverMind: () => undefined,
    busy: false,
    error: "",
    onDismissError: () => undefined,
    onGoMore: () => undefined,
    confirm: null,
    confirmPanelRef: { current: null },
    onConfirmAnyway: () => undefined,
    postLabel: "Post $12.50",
    onPost,
    onClose: () => undefined,
    persistCategory: () => undefined,
    presetId: null,
    onPresetId: () => undefined,
    onSavePreset: () => undefined,
    onForgetPreset: () => undefined,
    categoryTouched: false,
    onCategoryTouched: () => undefined,
    codingHint: "",
    onCodingHint: () => undefined,
    splitPercents: draft.percents,
    splitScopeValid: scopeValid,
    onMemberPercent: (id,p)=>setDraft(editSplitDraft(draft,household.members.map(m=>m.id),id,p)),
    addDetails: false,
    onAddDetails: () => undefined,
    placePrefs,
    onPlacePrefs: () => undefined,
    environment: "development",
    showLocationPrompt: false,
    onShowLocationPrompt: () => undefined,
    locationBusy: false,
    applyConfiguredStamps: () => undefined,
    clearLocationStamp: () => undefined,
    displayZone: "America/Toronto",
    experienceLine: "",
  });
}


createRoot(document.getElementById('root')!).render(<MobileWorldFixture><Harness mode="expense" splitProbe onPost={()=>window.evidenceActions.push('post')} roster={household}/></MobileWorldFixture>);

import '/src/mobile-canon.css';

import {MobileWorldFixture} from '../world-fixture';
