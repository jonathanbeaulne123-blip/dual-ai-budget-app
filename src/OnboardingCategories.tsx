import { useMemo, useState } from "react";
import {
  copy,
  currentSubmission,
  mergeOnboardingCategories,
  onboardingCategoryState,
  submitOnboardingCategories,
  type CommitResult,
  type Household,
} from "./core/index.ts";
import { KitchenNotice } from "./KitchenNotice.tsx";
import "./onboarding.css";

type DraftIdea = { localId: string; name: string; parentId: string };

export function OnboardingCategories({
  household,
  memberId,
  busy,
  onCommit,
}: {
  household: Household;
  memberId: string;
  busy?: boolean;
  onCommit: (fn: (current: Household) => CommitResult) => void;
}) {
  const state = onboardingCategoryState(household);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ideas, setIdeas] = useState<DraftIdea[]>([]);
  const [ideaName, setIdeaName] = useState("");
  const groups = useMemo(() => household.categories
    .filter((row) => row.active && row.recordType === "group" && row.transactionType === "expense")
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)), [household.categories]);
  const [ideaParentId, setIdeaParentId] = useState(groups[0]?.id ?? "");
  const [conflictSelections, setConflictSelections] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const selfSubmission = currentSubmission(household, memberId, "categories");
  const other = household.members.find((member) => member.active && member.id !== memberId);
  const categories = household.categories
    .filter((row) => row.active && row.recordType === "category" && row.transactionType === "expense")
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
  const categoriesByGroup = groups.map((group) => ({
    group,
    categories: categories.filter((row) => row.parentId === group.id),
  })).filter((row) => row.categories.length > 0);
  const groupName = new Map(groups.map((group) => [group.id, group.name]));
  const reveal = state.kind === "review" || state.kind === "complete";

  function addIdea() {
    const name = ideaName.trim().replace(/\s+/g, " ");
    if (!name || !ideaParentId) return;
    setIdeas((current) => [...current, { localId: `draft-${current.length + 1}`, name, parentId: ideaParentId }]);
    setIdeaName("");
    setError("");
  }

  function submit() {
    try {
      onCommit((current) => submitOnboardingCategories(current, {
        memberId,
        createdBy: memberId,
        categoryIds: selectedIds,
        proposals: ideas.map(({ name, parentId }) => ({ name, parentId })),
      }));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  function acceptMerge() {
    try {
      onCommit((current) => mergeOnboardingCategories(current, {
        memberId,
        createdBy: memberId,
        conflictSelections: Object.values(conflictSelections),
      }));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <section className="card onboarding-category-card" data-testid="onboarding-categories">
      <header className="onboarding-category-header">
        <div>
          <p className="kicker">{copy("categories.together")}</p>
          <h2>{copy("categories.title")}</h2>
        </div>
      </header>

      {!selfSubmission ? (
        <>
          <p className="onboarding-category-guide">{copy("categories.solo", { name: other?.name ?? "your partner" })}</p>
          <fieldset className="onboarding-category-picker">
            <legend>{copy("categories.existing")}</legend>
            {categoriesByGroup.map(({ group, categories: rows }) => (
              <div className="onboarding-category-group" key={group.id}>
                <h3>{group.name}</h3>
                <div className="onboarding-category-options">
                  {rows.map((category) => {
                    const checked = selectedIds.includes(category.id);
                    return (
                      <label className={`onboarding-category-option ${checked ? "is-selected" : ""}`} key={category.id}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={busy}
                          onChange={() => setSelectedIds((current) => checked
                            ? current.filter((id) => id !== category.id)
                            : [...current, category.id].sort())}
                        />
                        <span>{category.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </fieldset>

          <div className="onboarding-category-idea">
            <h3>{copy("categories.suggest")}</h3>
            <p>{copy("categories.suggest-help")}</p>
            <div className="onboarding-category-idea-fields">
              <label>
                <span>{copy("categories.name")}</span>
                <input
                  value={ideaName}
                  disabled={busy}
                  onChange={(event) => setIdeaName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addIdea();
                    }
                  }}
                />
              </label>
              <label>
                <span>{copy("categories.group")}</span>
                <select value={ideaParentId} disabled={busy} onChange={(event) => setIdeaParentId(event.target.value)}>
                  {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
              </label>
              <button type="button" className="ghost" disabled={busy || !ideaName.trim()} onClick={addIdea}>
                {copy("categories.add-idea")}
              </button>
            </div>
            {ideas.length ? (
              <ul className="onboarding-category-ideas">
                {ideas.map((idea) => (
                  <li key={idea.localId}>
                    <span><strong>{idea.name}</strong><small>{groupName.get(idea.parentId)}</small></span>
                    <button type="button" className="quiet" disabled={busy} onClick={() => setIdeas((current) => current.filter((row) => row.localId !== idea.localId))}>
                      {copy("categories.remove-idea")}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <KitchenNotice message={error} />
          <button type="button" className="primary onboarding-category-primary" disabled={busy || (selectedIds.length === 0 && ideas.length === 0)} onClick={submit}>
            {copy("categories.submit")}
          </button>
        </>
      ) : !reveal ? (
        <div className="onboarding-category-wait" role="status" aria-live="polite">
          <span aria-hidden="true">✓</span>
          <p>{copy("categories.waiting", { name: other?.name ?? "your partner" })}</p>
        </div>
      ) : (
        <>
          <div className="onboarding-category-reveal" aria-live="polite">
            <div className="onboarding-category-union">
              <h3>{copy("categories.together")}</h3>
              <div className="chips">
                {state.unionLabels.map((label) => <span className="chip" key={label}>{label}</span>)}
              </div>
            </div>
            <div className="onboarding-category-member-sets">
              {state.currentMemberIds.map((id) => {
                const name = household.members.find((member) => member.id === id)?.name ?? id;
                return (
                  <div key={id}>
                    <h3>{copy("categories.member-set", { name })}</h3>
                    <p>{(state.labelsBySubmitter[id] ?? []).join(" · ")}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {state.kind === "review" ? (
            <div className="onboarding-category-review">
              <p>{copy(state.conflicts.length ? "categories.conflict" : "categories.review")}</p>
              {state.conflicts.map((conflict) => (
                <fieldset key={conflict.name}>
                  <legend>{conflict.name}</legend>
                  {conflict.options.map((option) => (
                    <label key={option.id} className={conflictSelections[conflict.name] === option.id ? "is-selected" : ""}>
                      <input
                        type="radio"
                        name={`category-conflict-${conflict.name}`}
                        value={option.id}
                        checked={conflictSelections[conflict.name] === option.id}
                        disabled={busy}
                        onChange={() => setConflictSelections((current) => ({ ...current, [conflict.name]: option.id }))}
                      />
                      <span><strong>{option.name}</strong><small>{groupName.get(option.parentId)}</small></span>
                    </label>
                  ))}
                </fieldset>
              ))}
              <KitchenNotice message={error} />
              <button
                type="button"
                className="primary onboarding-category-primary"
                disabled={busy || state.conflicts.some((conflict) => !conflictSelections[conflict.name])}
                onClick={acceptMerge}
              >
                {copy("categories.accept")}
              </button>
            </div>
          ) : (
            <p className="onboarding-category-done" role="status">{copy("categories.done")}</p>
          )}
        </>
      )}
    </section>
  );
}
