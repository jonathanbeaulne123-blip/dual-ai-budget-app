import { SplitCut } from "./SplitCut.tsx";
import { splitReading } from "./core/splitDraft.ts";
import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type Ref, type SetStateAction } from "react";
import {
  JOINT,
  activePresets,
  centsDigitsFromDollars,
  dollarsFromCentsDigits,
  formatCad,
  formatPreviewHours,
  formatZoneDateTime,
  formatZoneTime,
  locationLabel,
  padToDollars,
  parseAmount,
  savePhonePlacePrefs,
  suggestCategory,
  suggestSplit,
  shouldPrefillCategory,
  type Account,
  type Category,
  type Environment,
  type Household,
  type NeedsConfirmationError,
  type PhonePlacePrefs,
  type TransactionLocation,
  type UndoToken,
  type Visibility,
} from "./core/index.ts";
import { ceremonyCopy, shiftFieldLabel, type ShiftGate } from "./core/shiftClock.ts";
import { CadPad } from "./CadPad.tsx";
import { AddAccountTiles } from "./AddAccountTiles.tsx";
import { AddCategoryForm } from "./AddCategoryForm.tsx";
import { KitchenNotice } from "./KitchenNotice.tsx";
import { ShiftElapsedHint } from "./ShiftElapsedHint.tsx";
import { PresetChip } from "./widgets/PresetChip.tsx";
import {
  ADD_MODES,
  addSlideCopy,
  addSlidesFor,
  canAdvanceAddSlide,
  clampAddSlide,
  type AddFormFields,
  type AddMode,
  type AddSlideId,
} from "./addSlideshow.ts";

import { MobileEntryChoices, entryRecommendations, useMobileEntry } from "./MobileEntryChoices.tsx";
import "./swipe.css";
import "./mobile-entry-sheet.css";

export type { AddFormFields, AddMode } from "./addSlideshow.ts";

export function AddSlideshow({
  sheetRef,
  open = true,
  recommendationHousehold,
  mode,
  onSwitchMode,
  form,
  setForm,
  household,
  booksHousehold,
  pickerAccounts,
  categories,
  today,
  slideIndex,
  onSlideIndex,
  shiftGate,
  hasWorkJobs,
  shiftJobsPanel,
  shiftPreview,
  onHoursDirty,
  hoursDirty,
  onClockIn,
  onAlreadyOff,
  onSignOut,
  onNeverMind,
  punchStartedAt,
  busy,
  error,
  onDismissError,
  onGoMore,
  confirm,
  confirmPanelRef,
  onConfirmAnyway,
  postLabel,
  onPost,
  onClose,
  persistCategory,
  presetId,
  onPresetId,
  onSavePreset,
  onForgetPreset,
  categoryTouched,
  onCategoryTouched,
  codingHint,
  onCodingHint,
  splitPercents,
  splitScopeValid = true,
  onReviewSplit,
  onMemberPercent,
  addDetails,
  onAddDetails,
  placePrefs,
  onPlacePrefs,
  environment,
  showLocationPrompt,
  onShowLocationPrompt,
  locationBusy,
  applyConfiguredStamps,
  clearLocationStamp,
  draftLocation,
  displayZone,
  experienceLine,
}: {
  sheetRef: Ref<HTMLDivElement>;
  open?: boolean;
  recommendationHousehold?: Household;
  mode: AddMode;
  onSwitchMode: (mode: AddMode) => void;
  form: AddFormFields;
  setForm: Dispatch<SetStateAction<AddFormFields>>;
  household: Household;
  booksHousehold: Household;
  pickerAccounts: Account[];
  categories: Category[];
  today: string;
  slideIndex: number;
  onSlideIndex: (index: number) => void;
  shiftGate: ShiftGate;
  hasWorkJobs: boolean;
  shiftJobsPanel?: ReactNode;
  shiftPreview: { netTipsCents: number; wagesCents: number };
  onHoursDirty: () => void;
  hoursDirty: boolean;
  onClockIn: () => void;
  onAlreadyOff: () => void;
  onSignOut: () => void;
  onNeverMind: () => void;
  punchStartedAt?: string;
  busy: boolean;
  error: string;
  onDismissError: () => void;
  onGoMore: () => void;
  confirm: NeedsConfirmationError | null;
  confirmPanelRef: Ref<HTMLDivElement>;
  onConfirmAnyway: () => void;
  postLabel: string;
  onPost: () => void;
  onClose: () => void;
  persistCategory: (household: Household, undo?: UndoToken) => void;
  presetId: string | null;
  onPresetId: (id: string | null) => void;
  onSavePreset: () => void;
  onForgetPreset: () => void;
  categoryTouched: boolean;
  onCategoryTouched: () => void;
  codingHint: string;
  onCodingHint: (hint: string) => void;
  splitPercents: Record<string, number>;
  splitScopeValid?: boolean;
  onReviewSplit?: () => void;
  onMemberPercent: (memberId: string, percent: number) => void;
  addDetails: boolean;
  onAddDetails: (open: boolean) => void;
  placePrefs: PhonePlacePrefs;
  onPlacePrefs: (prefs: PhonePlacePrefs) => void;
  environment: Environment;
  showLocationPrompt: boolean;
  onShowLocationPrompt: (show: boolean) => void;
  locationBusy: boolean;
  applyConfiguredStamps: () => void;
  clearLocationStamp: () => void;
  draftLocation?: TransactionLocation;
  displayZone: string;
  experienceLine: string;
}) {
  const mobile = useMobileEntry();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [fullForm, setFullForm] = useState(false);
  const expanded = mobile && fullForm;
  const suggestions = recommendationHousehold;
  const slides = useMemo(
    () => addSlidesFor({ mode, shiftGate, hasWorkJobs }),
    [mode, shiftGate, hasWorkJobs],
  );
  const index = clampAddSlide(slideIndex, slides);
  const slide: AddSlideId = slides[index] ?? "amount";
  const copy = addSlideCopy(mode, slide, shiftGate);
  const canAdvance = canAdvanceAddSlide(slide, form);
  const [cutPreviewActive, setCutPreviewActive] = useState(false);
  const [pictureName, setPictureName] = useState("");
  const [pictureUrl, setPictureUrl] = useState("");

  useEffect(() => {
    if (index !== slideIndex) onSlideIndex(index);
  }, [index, slideIndex, onSlideIndex]);

  useEffect(() => {
    setPictureName("");
    setPictureUrl("");
    setFullForm(false);
  }, [mode]);

  useEffect(() => {
    if (mobile && open) headingRef.current?.focus();
  }, [mobile, open, index, expanded]);

  function goNext() {
    if (index >= slides.length - 1) return;
    if (!canAdvance) return;
    onSlideIndex(index + 1);
  }

  function goBack() {
    if (expanded) { setFullForm(false); return; }
    if (index <= 0) return;
    onSlideIndex(index - 1);
  }

  function pickAccount(accountId: string) {
    setForm((current) => ({ ...current, accountId }));
    if (!expanded) onSlideIndex(Math.min(index + 1, slides.length - 1));
  }

  function pickFrom(accountId: string) {
    setForm((current) => ({ ...current, fromAccountId: accountId }));
    if (!expanded) onSlideIndex(Math.min(index + 1, slides.length - 1));
  }

  function pickTo(accountId: string) {
    setForm((current) => ({ ...current, toAccountId: accountId }));
    if (!expanded) onSlideIndex(Math.min(index + 1, slides.length - 1));
  }

  function pickCategory(subcategoryId: string) {
    onCategoryTouched();
    setForm((current) => ({ ...current, subcategoryId }));
    if (!expanded) onSlideIndex(Math.min(index + 1, slides.length - 1));
  }

  const hidePost = mode === "shift" && (slide === "shift-choose" || slide === "shift-clocked" || slide === "shift-jobs");
  const last = index === slides.length - 1;
  const choiceSlide = ["category", "account", "from", "to"].includes(slide);
  let enteredAmount = "";
  if (mode !== "shift") { try { enteredAmount = formatCad(parseAmount(form.amount)); } catch { /* Keep invalid drafts editable in More. */ } }
  let splitError = "";
  if (form.who === "split" && mode !== "shift" && mode !== "transfer") {
    if (!splitScopeValid) splitError = "The members or desk changed. Review the split again.";
    else try { splitReading(household.members.filter(member => member.active).map(member => member.id), splitPercents, parseAmount(form.amount)); }
    catch (caught) { splitError = caught instanceof Error ? caught.message : "Review the split before Confirm."; }
  }

  let mobileInvalid = false;
  if (mobile && !hidePost) {
    const hasAccount = (id: string) => pickerAccounts.some(account => account.active && account.id === id);
    mobileInvalid = mode === "transfer"
      ? !hasAccount(form.fromAccountId) || !hasAccount(form.toAccountId) || form.fromAccountId === form.toAccountId
      : !hasAccount(form.accountId) || (mode !== "shift" && !categories.some(category => category.active && category.id === form.subcategoryId));
    if (mode !== "shift") {
      try { mobileInvalid ||= parseAmount(form.amount) <= 0; } catch { mobileInvalid = true; }
    }
  }

  return (
    <div
      className={`sheet add-slideshow${mobile ? " mobile-entry-sheet" : ""}`}
      hidden={!open}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-sheet-title"
      ref={sheetRef}
      data-add-slideshow={mode}
      data-add-slide={expanded ? "full-form" : slide}
    >
      <div className="sheet-inner add-slideshow-inner">
        <div className="topbar">
          {index > 0 || expanded ? (
            <button className="ghost" type="button" disabled={busy || !open} onClick={goBack}>Back</button>
          ) : (
            <p className="muted add-slideshow-mode">{mode === "expense" ? "Expense" : mode === "income" ? "Income" : mode === "shift" ? "Shift" : "Transfer"}</p>
          )}
          <button className="ghost" type="button" data-autofocus disabled={busy} onClick={onClose}>Close</button>
        </div>
        <h1 id="add-sheet-title" ref={headingRef} tabIndex={mobile ? -1 : undefined} className="add-slideshow-title">{expanded ? `Review ${mode}` : copy.title}</h1>
        <p className="muted add-slideshow-hint">{expanded ? "Your whole draft. Only Confirm posts." : copy.hint}</p>
        {!expanded && <p className="muted add-slideshow-progress" aria-live="polite">{index + 1} of {slides.length}</p>}
        {mobile && !expanded && !hidePost && !choiceSlide && <button type="button" className="ghost" disabled={busy} onClick={() => setFullForm(true)}>More</button>}
        {slide !== "confirm" && (
          <details className="add-slideshow-switch">
            <summary>Switch kind</summary>
            <div className="tabs">
              {ADD_MODES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={mode === item ? "active" : ""}
                  disabled={busy || !open}
                  onClick={() => onSwitchMode(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </details>
        )}

        {mobile && !expanded && choiceSlide && enteredAmount && <p className="swipe-amount">{enteredAmount}</p>}
        <fieldset className="entry-sheet-fields" disabled={busy || !open}>
        {(expanded ? slides : [slide]).map((slide) => {
          const copy = addSlideCopy(mode, slide, shiftGate);
          const canAdvance = canAdvanceAddSlide(slide, form);
          return <section key={slide} className={expanded ? "entry-full-section" : undefined} data-entry-section={slide}>
            {expanded && <h2>{copy.title}</h2>}
        {slide === "amount" && (
          <>
            {expanded ? <label>Amount (CAD)<input inputMode="decimal" value={form.amount} onChange={event => setForm(current => ({ ...current, amount: event.target.value }))} /></label> : <CadPad
              giant
              digits={centsDigitsFromDollars(form.amount)}
              onDigits={(digits) => setForm((current) => ({ ...current, amount: padToDollars(digits) }))}
              label={mode === "transfer" ? "Move" : "Amount"}
              onEnter={open ? goNext : undefined}
              enterLabel={copy.enterLabel}
              enterDisabled={!canAdvance || busy}
            />}
            {mode === "expense" && (!mobile || expanded) && (
              <div className="chips">
                {activePresets(household).filter(preset => !mobile || (pickerAccounts.some(account => account.id === preset.accountId) && categories.some(category => category.id === preset.subcategoryId))).map((preset) => (
                  <PresetChip
                    key={preset.id}
                    note={preset.note}
                    subcategoryId={preset.subcategoryId}
                    categories={household.categories}
                    selected={presetId === preset.id}
                    onClick={() => {
                      onPresetId(preset.id);
                      setForm((current) => ({
                        ...current,
                        note: preset.note,
                        place: preset.place,
                        subcategoryId: preset.subcategoryId,
                        accountId: preset.accountId,
                        amount: preset.amountCents > 0 ? (preset.amountCents / 100).toFixed(2) : current.amount,
                        visibility: preset.visibility,
                      }));
                    }}
                  />
                ))}
                <button
                  type="button"
                  className={`chip ${form.note === "Groceries" && presetId == null ? "selected" : ""}`}
                  onClick={() => {
                    onPresetId(null);
                    onCategoryTouched();
                    setForm((current) => ({ ...current, note: "Groceries", subcategoryId: "SUB-FOOD-GROCERIES" }));
                  }}
                >
                  Groceries
                </button>
                <button
                  type="button"
                  className={`chip ${form.note === "Coffee" && presetId == null ? "selected" : ""}`}
                  onClick={() => {
                    onPresetId(null);
                    onCategoryTouched();
                    setForm((current) => ({ ...current, note: "Coffee", subcategoryId: "SUB-FOOD-COFFEE" }));
                  }}
                >
                  Coffee
                </button>
                <button type="button" className="chip" onClick={onSavePreset}>Save as preset</button>
                {presetId && (
                  <button type="button" className="chip" onClick={onForgetPreset}>Forget preset</button>
                )}
              </div>
            )}
          </>
        )}

        {slide === "category" && (
          <>
            {mobile && !expanded ? <MobileEntryChoices
              choices={suggestions ? entryRecommendations(categories.filter(category => suggestions.categories.some(item => item.id === category.id)), suggestions, mode, "subcategoryId", today) : []}
              label="Suggested categories" selectedId={form.subcategoryId} busy={busy} onPick={pickCategory} onMore={() => setFullForm(true)}
            /> : <>
            <div className="chips add-slideshow-categories">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={`chip ${form.subcategoryId === category.id ? "selected" : ""}`}
                  onClick={() => pickCategory(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>
            <AddCategoryForm
              household={household}
              onSave={persistCategory}
              inline
              transactionType={mode === "income" ? "income" : "expense"}
            />
            </>}
            <button type="button" className={`primary post-big${mobile ? " entry-step-continue" : ""}`} disabled={!canAdvance} onClick={goNext}>
              {copy.enterLabel}
            </button>
          </>
        )}

        {slide === "account" && (
          <>
            {mobile && !expanded ? <MobileEntryChoices
              choices={suggestions ? entryRecommendations(pickerAccounts.filter(account => suggestions.accounts.some(item => item.id === account.id)), suggestions, mode, "accountId", today) : []}
              label="Suggested accounts" selectedId={form.accountId} busy={busy} onPick={pickAccount} onMore={() => setFullForm(true)}

            /> : <AddAccountTiles
              booksHousehold={booksHousehold}
              accounts={pickerAccounts}
              today={today}
              selectedId={form.accountId}
              onSelect={pickAccount}
            />}
            <button type="button" className={`primary post-big${mobile ? " entry-step-continue" : ""}`} disabled={!canAdvance} onClick={goNext}>
              {copy.enterLabel}
            </button>
          </>
        )}

        {slide === "from" && (
          <>
            {mobile && !expanded ? <MobileEntryChoices
              choices={suggestions ? entryRecommendations(pickerAccounts.filter(account => suggestions.accounts.some(item => item.id === account.id)), suggestions, mode, "accountId", today) : []}
              label="Source accounts" selectedId={form.fromAccountId} busy={busy} onPick={pickFrom} onMore={() => setFullForm(true)}

            /> : <AddAccountTiles
              booksHousehold={booksHousehold}
              accounts={pickerAccounts}
              today={today}
              selectedId={form.fromAccountId}
              onSelect={pickFrom}
            />}
            <button type="button" className={`primary post-big${mobile ? " entry-step-continue" : ""}`} disabled={!canAdvance} onClick={goNext}>
              {copy.enterLabel}
            </button>
          </>
        )}

        {slide === "to" && (
          <>
            {mobile && !expanded ? <MobileEntryChoices
              choices={suggestions ? entryRecommendations(pickerAccounts.filter(account => suggestions.accounts.some(item => item.id === account.id)), suggestions, mode, "accountId", today) : []}
              label="Destination accounts" selectedId={form.toAccountId} busy={busy} onPick={pickTo} onMore={() => setFullForm(true)}
              excludeId={form.fromAccountId}
            /> : <AddAccountTiles
              booksHousehold={booksHousehold}
              accounts={pickerAccounts}
              today={today}
              selectedId={form.toAccountId}
              excludeId={form.fromAccountId}
              onSelect={pickTo}
            />}
            {form.toAccountId === form.fromAccountId && (
              <p className="muted">Pick a different room than From.</p>
            )}
            <button type="button" className={`primary post-big${mobile ? " entry-step-continue" : ""}`} disabled={!canAdvance} onClick={goNext}>
              {copy.enterLabel}
            </button>
          </>
        )}

        {slide === "note" && (
          <NoteSlide
            form={form}
            setForm={setForm}
            mode={mode}
            categoryTouched={categoryTouched}
            household={mobile && suggestions ? suggestions : household}
            codingHint={codingHint}
            onCodingHint={onCodingHint}
            pictureName={pictureName}
            pictureUrl={pictureUrl}
            onPicture={(name, url) => {
              setPictureName(name);
              setPictureUrl(url);
            }}
            enterLabel={copy.enterLabel}
            onContinue={expanded ? undefined : goNext}
          />
        )}

        {slide === "shift-choose" && (
          <>
            <label htmlFor="add-shift-member">Who is working</label>
            <select id="add-shift-member" value={form.memberId} onChange={(event) => setForm((current) => ({ ...current, memberId: event.target.value }))}>
              {household.members.filter((member) => member.active).map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
            <button type="button" className="primary post-big" disabled={busy} onClick={onClockIn}>Clock in</button>
            <button type="button" className="chip" onClick={onAlreadyOff}>Already off? Post a finished shift</button>
          </>
        )}

        {slide === "shift-clocked" && (
          <>
            <p>{ceremonyCopy("clocked").title}</p>
            {punchStartedAt ? <ShiftElapsedHint startedAt={punchStartedAt} /> : <p className="muted">{ceremonyCopy("clocked").hint}</p>}
            <button type="button" className="primary post-big" onClick={onSignOut}>Sign out</button>
            <button type="button" className="chip" disabled={busy} onClick={onNeverMind}>Never mind</button>
          </>
        )}

        {slide === "shift-jobs" && shiftJobsPanel}

        {(slide === "shift-hours" || slide === "shift-sales" || slide === "shift-cashTips" || slide === "shift-ccTips") && (
          <ShiftPadSlide
            slide={slide}
            fullForm={expanded}
            open={open && !busy}
            form={form}
            setForm={setForm}
            shiftGate={shiftGate}
            punchStartedAt={punchStartedAt}
            onHoursDirty={onHoursDirty}
            hoursDirty={hoursDirty}
            shiftPreview={shiftPreview}
            copy={copy}
            canAdvance={canAdvance}
            onEnter={goNext}
          />
        )}

        {slide === "confirm" && (
          <ConfirmSlide
            mode={mode}
            form={form}
            setForm={setForm}
            household={household}
            pickerAccounts={pickerAccounts}
            categories={categories}
            splitPercents={splitPercents}
            onCutPreview={setCutPreviewActive}
            splitError={splitError}
            splitScopeValid={splitScopeValid}
            onReviewSplit={onReviewSplit}
            onMemberPercent={onMemberPercent}
            addDetails={expanded || addDetails}
            fullForm={expanded}
            onAddDetails={onAddDetails}
            placePrefs={placePrefs}
            onPlacePrefs={onPlacePrefs}
            environment={environment}
            showLocationPrompt={showLocationPrompt}
            onShowLocationPrompt={onShowLocationPrompt}
            locationBusy={locationBusy}
            applyConfiguredStamps={applyConfiguredStamps}
            clearLocationStamp={clearLocationStamp}
            draftLocation={draftLocation}
            displayZone={displayZone}
            pictureName={pictureName}
          />
        )}

          </section>;
        })}
        </fieldset>

        <KitchenNotice message={error} onGoMore={onGoMore} onDismiss={onDismissError} />
        {confirm && (
          <div className="preview warn" role="alert" tabIndex={-1} ref={confirmPanelRef}>
            <p>{confirm.message}</p>
            {confirm.matches.map((tx) => (
              <div className="row" key={tx.id}>
                <span>{tx.date} · {tx.place || tx.note || tx.type}</span>
                <span>{formatCad(tx.amountCents)}</span>
              </div>
            ))}
            <button className="primary" type="button" disabled={busy || !open || mobileInvalid || !!splitError || cutPreviewActive} onClick={onConfirmAnyway}>Add anyway</button>
          </div>
        )}
        {!hidePost && (last || expanded) && (
          <>
            <p className="muted" data-ledger-confirm-purpose>
              {experienceLine}
              {mode === "expense" ? " Fund funding stays separate from Shared or Personal visibility." : ""}
            </p>
            <button className="primary post-big" type="button" disabled={busy || !open || mobileInvalid || !!splitError || cutPreviewActive} onClick={onPost} data-add-confirm>
              {postLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function NoteSlide({
  form,
  setForm,
  mode,
  categoryTouched,
  household,
  codingHint,
  onCodingHint,
  pictureName,
  pictureUrl,
  onPicture,
  enterLabel,
  onContinue,
}: {
  form: AddFormFields;
  setForm: Dispatch<SetStateAction<AddFormFields>>;
  mode: AddMode;
  categoryTouched: boolean;
  household: Household;
  codingHint: string;
  onCodingHint: (hint: string) => void;
  pictureName: string;
  pictureUrl: string;
  onPicture: (name: string, url: string) => void;
  enterLabel: string;
  onContinue?: () => void;
}) {
  return (
    <>
      <label htmlFor="add-note">Note</label>
      <input
        id="add-note"
        value={form.note}
        onChange={(event) => {
          const note = event.target.value;
          const next = { ...form, note };
          if (!categoryTouched && (mode === "expense" || mode === "income")) {
            const guess = suggestCategory(household, note, form.place);
            if (shouldPrefillCategory(guess) && guess) {
              next.subcategoryId = guess.subcategoryId;
              let hint = `Guessed ${guess.name}. Confirm still writes.`;
              try {
                if (form.amount) {
                  const split = suggestSplit(household, note, form.place, parseAmount(form.amount));
                  if (split && split.confidence >= 0.55) hint += ` Usually ${split.label}.`;
                }
              } catch {
                // Pad empty until they type an amount.
              }
              onCodingHint(hint);
            }
          }
          setForm(next);
        }}
        placeholder={mode === "income" ? "Paycheque, tips…" : mode === "transfer" ? "Card payment…" : "Groceries, rent…"}
      />
      {codingHint && <p className="muted">{codingHint}</p>}
      <label className="add-picture-label">
        Picture
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = "";
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              onPicture(file.name, typeof reader.result === "string" ? reader.result : "");
            };
            reader.readAsDataURL(file);
          }}
        />
      </label>
      {pictureUrl ? (
        <img className="add-picture-preview" src={pictureUrl} alt={pictureName || "Receipt preview"} />
      ) : null}
      <p className="muted">Pictures stay on this phone. Confirm posts the CAD and note, not the file. Receipt inbox remains Books → Import.</p>
      {onContinue && <button type="button" className="primary post-big" onClick={onContinue}>{pictureName || form.note.trim() ? enterLabel : "Skip"}</button>}
    </>
  );
}

function ShiftPadSlide({
  slide,
  fullForm,
  open,
  form,
  setForm,
  shiftGate,
  punchStartedAt,
  onHoursDirty,
  hoursDirty,
  shiftPreview,
  copy,
  canAdvance,
  onEnter,
}: {
  slide: AddSlideId;
  fullForm: boolean;
  open: boolean;
  form: AddFormFields;
  setForm: Dispatch<SetStateAction<AddFormFields>>;
  shiftGate: ShiftGate;
  punchStartedAt?: string;
  onHoursDirty: () => void;
  hoursDirty: boolean;
  shiftPreview: { netTipsCents: number; wagesCents: number };
  copy: { enterLabel: string };
  canAdvance: boolean;
  onEnter: () => void;
}) {
  const field = slide.replace("shift-", "") as "hours" | "sales" | "cashTips" | "ccTips";
  return (
    <>
      {shiftGate === "signOut" && field === "hours" && punchStartedAt && (
        <ShiftElapsedHint
          startedAt={punchStartedAt}
          prefix="Live preview: "
          onQuarterHours={(hours) => {
            if (hoursDirty) return;
            const formatted = formatPreviewHours(hours);
            setForm((current) => current.hours === formatted ? current : { ...current, hours: formatted });
          }}
        />
      )}
      {fullForm ? <label>{shiftFieldLabel(field)}<input inputMode="decimal" value={form[field]} onChange={event => {
        if (field === "hours") onHoursDirty();
        setForm(current => ({ ...current, [field]: event.target.value }));
      }} /></label> : <CadPad
        giant
        digits={centsDigitsFromDollars(form[field])}
        onDigits={(digits) => {
          if (field === "hours") onHoursDirty();
          setForm((current) => ({ ...current, [field]: dollarsFromCentsDigits(digits) }));
        }}
        label={shiftFieldLabel(field)}
        unit={field === "hours" ? "hours" : "cad"}
        onEnter={open ? onEnter : undefined}
        enterLabel={copy.enterLabel}
        enterDisabled={!canAdvance}
        emptyDisplay={field === "hours" ? "Not entered" : undefined}
      />}
      {field === "sales" && (
        <div className="work-shift-grid two">
          <label>
            Customers served
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={5000}
              value={form.customersServed}
              onChange={(event) => setForm((current) => ({ ...current, customersServed: event.target.value }))}
            />
          </label>
          <label>
            People on floor
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={200}
              value={form.staffingCount}
              onChange={(event) => setForm((current) => ({ ...current, staffingCount: event.target.value }))}
            />
          </label>
          <label>
            Event tag
            <select value={form.eventTag} onChange={(event) => setForm((current) => ({ ...current, eventTag: event.target.value }))}>
              <option value="regular">Regular</option>
              <option value="holiday">Holiday</option>
              <option value="sports">Sports</option>
              <option value="festival">Festival</option>
              <option value="private_party">Private party</option>
              <option value="short_staffed">Short-staffed</option>
              <option value="vacation_cover">Vacation cover</option>
              <option value="illness_cover">Illness cover</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>
      )}
      {field !== "hours" && (
        <div className={`preview ${shiftPreview.netTipsCents < 0 ? "warn" : ""}`}>
          <div className="row"><span>Net tips</span><span>{formatCad(shiftPreview.netTipsCents)}</span></div>
          <div className="row"><span>Wages</span><span>{Number(form.hours) > 0 ? formatCad(shiftPreview.wagesCents) : "wait for hours"}</span></div>
          <p className="muted">Same math that posts. Hours are a preview until Confirm.</p>
        </div>
      )}
    </>
  );
}

function ConfirmSlide({
  fullForm = false,
  mode,
  form,
  setForm,
  household,
  pickerAccounts,
  categories,
  splitPercents,
  onCutPreview,
  splitError,
  splitScopeValid,
  onReviewSplit,
  onMemberPercent,
  addDetails,
  onAddDetails,
  placePrefs,
  onPlacePrefs,
  environment,
  showLocationPrompt,
  onShowLocationPrompt,
  locationBusy,
  applyConfiguredStamps,
  clearLocationStamp,
  draftLocation,
  displayZone,
  pictureName,
}: {
  fullForm?: boolean;
  mode: AddMode;
  form: AddFormFields;
  setForm: Dispatch<SetStateAction<AddFormFields>>;
  household: Household;
  pickerAccounts: Account[];
  categories: Category[];
  splitPercents: Record<string, number>;
  onCutPreview: (active: boolean) => void;
  splitError: string;
  splitScopeValid: boolean;
  onReviewSplit?: () => void;
  onMemberPercent: (memberId: string, percent: number) => void;
  addDetails: boolean;
  onAddDetails: (open: boolean) => void;
  placePrefs: PhonePlacePrefs;
  onPlacePrefs: (prefs: PhonePlacePrefs) => void;
  environment: Environment;
  showLocationPrompt: boolean;
  onShowLocationPrompt: (show: boolean) => void;
  locationBusy: boolean;
  applyConfiguredStamps: () => void;
  clearLocationStamp: () => void;
  draftLocation?: TransactionLocation;
  displayZone: string;
  pictureName: string;
}) {
  const categoryName = categories.find((category) => category.id === form.subcategoryId)?.name
    ?? household.categories.find((category) => category.id === form.subcategoryId)?.name
    ?? "";
  const accountName = pickerAccounts.find((account) => account.id === form.accountId)?.name ?? form.accountId;
  const fromName = pickerAccounts.find((account) => account.id === form.fromAccountId)?.name ?? form.fromAccountId;
  const toName = pickerAccounts.find((account) => account.id === form.toAccountId)?.name ?? form.toAccountId;
  let money = "";
  try {
    if (form.amount) money = formatCad(parseAmount(form.amount));
  } catch {
    money = form.amount;
  }
  return (
    <>
      <section className="preview add-confirm-summary" aria-label="Confirm summary">
        {mode === "transfer" ? (
          <>
            <div className="row"><span>Move</span><span>{money || "$0.00"}</span></div>
            <div className="row"><span>From</span><span>{fromName}</span></div>
            <div className="row"><span>To</span><span>{toName}</span></div>
            <p className="muted">Not income. Not spend.</p>
          </>
        ) : mode === "shift" ? (
          <>
            <div className="row"><span>Hours</span><span>{form.hours || "—"}</span></div>
            <div className="row"><span>Sales</span><span>{form.sales}</span></div>
            <div className="row"><span>Cash tips</span><span>{form.cashTips}</span></div>
            <div className="row"><span>Card tips</span><span>{form.ccTips}</span></div>
            <div className="row"><span>Account</span><span>{accountName}</span></div>
          </>
        ) : (
          <>
            <div className="row"><span>Amount</span><span>{money || "$0.00"}</span></div>
            <div className="row"><span>Category</span><span>{categoryName || "—"}</span></div>
            <div className="row"><span>Account</span><span>{accountName}</span></div>
            <div className="row"><span>Note</span><span>{form.note || "—"}</span></div>
          </>
        )}
        {pictureName ? <p className="muted">Picture on this phone: {pictureName}. Not posted.</p> : null}
      </section>
      {mode !== "shift" && mode !== "transfer" && (
        <>
          <label>Who</label>
          <div className="chips">
            {[
              { id: JOINT, name: "Joint" },
              ...household.members.filter((member) => member.active).map((member) => ({ id: member.id, name: member.name })),
              { id: "split", name: "Split %" },
            ].map((who) => (
              <button key={who.id} type="button" className={`chip ${form.who === who.id ? "selected" : ""}`} onClick={() => setForm((current) => ({ ...current, who: who.id }))}>{who.name}</button>
            ))}
          </div>
          {form.who === "split" && <SplitEditor household={household} percents={splitPercents} amount={form.amount}
            onPreviewChange={onCutPreview} error={splitError} scopeValid={splitScopeValid} onReview={onReviewSplit} onChange={onMemberPercent} />}

        </>
      )}
      {!fullForm && <button type="button" className="chip" onClick={() => onAddDetails(!addDetails)}>
        {addDetails ? "Hide details" : "Date & place"}
      </button>}
      {addDetails && (
        <>
          <label>Date</label>
          <input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
          <label>Save to</label>
          <div className="chips">
            {([
              { id: "household" as Visibility, name: "Shared" },
              { id: "personal" as Visibility, name: "Personal" },
              { id: "both" as Visibility, name: "Both" },
            ]).map((item) => (
              <button
                key={item.id}
                type="button"
                className={`chip ${form.visibility === item.id ? "selected" : ""}`}
                onClick={() => setForm((current) => ({ ...current, visibility: item.id }))}
              >
                {item.name}
              </button>
            ))}
          </div>
          {mode === "expense" && household.householdFund && (
            <section className="preview" aria-label="Household Fund allocation">
              <div className="row">
                <div>
                  <strong>Use Household Fund</strong>
                  <p className="muted">Separate from Shared or Personal visibility.</p>
                </div>
                <button
                  type="button"
                  className={`chip ${form.useHouseholdFund ? "selected" : ""}`}
                  aria-pressed={form.useHouseholdFund}
                  onClick={() => setForm((current) => ({
                    ...current,
                    useHouseholdFund: !current.useHouseholdFund,
                    fundedAmount: current.fundedAmount || current.amount,
                    fundDestinationAccountId: !current.useHouseholdFund
                      && pickerAccounts.some((account) => account.id === current.accountId && account.scope !== "personal")
                      ? current.accountId
                      : current.fundDestinationAccountId || "ACC-VISA",
                  }))}
                >
                  {form.useHouseholdFund ? "Using Fund" : "Use Fund"}
                </button>
              </div>
              {form.useHouseholdFund && (
                <>
                  <label htmlFor="add-fund-amount">Funded amount (CAD)</label>
                  <input id="add-fund-amount" inputMode="decimal" value={form.fundedAmount} onChange={(event) => setForm((current) => ({ ...current, fundedAmount: event.target.value }))} placeholder={form.amount || "0.00"} />
                  <label htmlFor="add-fund-destination">Settlement destination</label>
                  <select id="add-fund-destination" value={form.fundDestinationAccountId} onChange={(event) => setForm((current) => ({ ...current, fundDestinationAccountId: event.target.value }))}>
                    {pickerAccounts.filter((account) => account.active && account.scope !== "personal").map((account) => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </select>
                  <p className="muted">Jonathan’s card purchases default to the selected card. Bianca can transfer a partial or full amount later.</p>
                </>
              )}
            </section>
          )}
          {mode !== "shift" && mode !== "transfer" && (
            <>
              <label>Place</label>
              <input
                value={form.place}
                onChange={(event) => {
                  const place = event.target.value;
                  setForm((current) => ({ ...current, place }));
                }}
                placeholder="No Frills…"
              />
              {showLocationPrompt && !placePrefs.locationAllowed && (
                <div className="preview" style={{ marginTop: 8 }} role="dialog" aria-label="Location services">
                  <p>Allow location on this phone so Add can stamp real time and place?</p>
                  <div className="chips">
                    <button
                      type="button"
                      className="chip selected"
                      onClick={() => {
                        onPlacePrefs(savePhonePlacePrefs(environment, { locationAllowed: true, addPromptSeen: true }));
                        onShowLocationPrompt(false);
                      }}
                    >
                      Allow
                    </button>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => {
                        onPlacePrefs(savePhonePlacePrefs(environment, { addPromptSeen: true }));
                        onShowLocationPrompt(false);
                      }}
                    >
                      Not now
                    </button>
                  </div>
                </div>
              )}
              <div className="chips" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className={`chip ${placePrefs.stampTime ? "selected" : ""}`}
                  disabled={locationBusy || !placePrefs.locationAllowed}
                  onClick={() => onPlacePrefs(savePhonePlacePrefs(environment, { stampTime: !placePrefs.stampTime }))}
                >
                  Stamp time
                </button>
                <button
                  type="button"
                  className={`chip ${placePrefs.stampCoords ? "selected" : ""}`}
                  disabled={locationBusy || !placePrefs.locationAllowed}
                  onClick={() => onPlacePrefs(savePhonePlacePrefs(environment, { stampCoords: !placePrefs.stampCoords }))}
                >
                  Stamp place
                </button>
                <button
                  type="button"
                  className="chip"
                  disabled={locationBusy || !placePrefs.locationAllowed || (!placePrefs.stampTime && !placePrefs.stampCoords)}
                  onClick={applyConfiguredStamps}
                >
                  {locationBusy ? "Locating…" : "Use now"}
                </button>
                {(draftLocation || form.occurredAt) && (
                  <button type="button" className="chip" disabled={locationBusy} onClick={clearLocationStamp}>
                    Clear stamp
                  </button>
                )}
              </div>
              {(form.occurredAt || draftLocation) && (
                <p className="muted" style={{ marginTop: 8 }}>
                  {form.occurredAt ? formatZoneDateTime(form.occurredAt, displayZone) : formatZoneTime(new Date(), displayZone)}
                  {draftLocation ? ` · ${locationLabel(draftLocation)}` : ""}
                  {" · Confirm still posts"}
                </p>
              )}
              {!placePrefs.locationAllowed && !showLocationPrompt && (
                <p className="muted" style={{ marginTop: 8 }}>
                  Location is off. Enable it in More → Clock &amp; place.
                </p>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

function SplitEditor({ household, percents, amount, error, scopeValid, onReview, onChange, onPreviewChange }: {
  household: Household; percents: Record<string, number>; amount: string; error: string; scopeValid: boolean;
  onPreviewChange: (active: boolean) => void;
  onReview?: () => void; onChange: (memberId: string, percent: number) => void;
}) {
  const members = household.members.filter(member => member.active);
  let cents: Record<string, number> = {}, amountCents = 0;
  try { amountCents = parseAmount(amount); cents = splitReading(members.map(member => member.id), percents, amountCents).cents; } catch { /* The shared error blocks Confirm. */ }
  return <div className={`split-card ${scopeValid && members.length === 2 && !error ? "is-cut" : ""}`}>
    {error ? <p role="status">{error}</p> : null}
    {!scopeValid ? <button type="button" onClick={onReview}>Review current members</button>
      : members.length === 2 && !error ? <SplitCut key={members.map(member => member.id).join(":")} members={[members[0]!, members[1]!]} percents={percents} amountCents={amountCents} onChange={onChange} onPreviewChange={onPreviewChange} />
      : <>{members.map(member => <label className="row" key={member.id}>
        <span>{member.name}</span><span><input aria-label={`${member.name}'s share`} type="number" min={0} max={100} step={1} value={percents[member.id] ?? 0} onChange={event => { if (event.currentTarget.value !== "") onChange(member.id, event.currentTarget.valueAsNumber); }} /> % <span>{cents[member.id] === undefined ? "" : formatCad(cents[member.id]!)}</span></span>
      </label>)}{members.length ? <p className="cut-remainder">{members.at(-1)!.name} fills the remaining cents after rounding.</p> : null}</>}
  </div>;
}
