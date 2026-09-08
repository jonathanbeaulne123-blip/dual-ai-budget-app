import type { Household } from "./core/types.ts";
import type { LedgerCommand } from "./ledgerSync/protocol.ts";
import type { SharedBoard } from "./core/sharedBoardIntent.ts";
import "./board-retained-draft.css";

const destinations: Record<string, { board: SharedBoard; label: string }> = {
  saveBoardTask: { board: "tasks", label: "To-do" }, removeBoardTask: { board: "tasks", label: "To-do" },
  saveBoardMilestone: { board: "goals", label: "Goals" }, removeBoardMilestone: { board: "goals", label: "Goals" },
  setBoardPhoto: { board: "photos", label: "Photos" },
};
export function isBoardDraft(command: LedgerCommand) {
  return command.steps.length > 0 && command.steps.every(step => Object.hasOwn(destinations, step.kind));
}
/** Show only authored fields, never raw command/auth envelopes or automatic stale replay. */
export function BoardRejectedDraft({ command, household, onOpen }: {
  command: LedgerCommand; household: Household; onOpen: (board: SharedBoard) => void;
}) {
  if (!isBoardDraft(command) || command.householdId !== household.householdId || command.environment !== household.environment) return null;
  return <div className="board-retained-draft">
    <h3>Shared board change not saved</h3>
    <p>Your draft is kept here. Open the board to review its current details before making the change again.</p>
    {command.steps.map((step, index) => {
      const destination = destinations[step.kind]!;
      const input = step.args[0] && typeof step.args[0] === "object" ? step.args[0] as Record<string, unknown> : {};
      const text = (key: string) => typeof input[key] === "string" ? (input[key] as string).slice(0, 240) : "";
      const rows = [destination.label];
      if (step.kind.startsWith("remove")) {
        const collection = step.kind === "removeBoardTask" ? household.kitchen.boards?.tasks : household.kitchen.boards?.milestones;
        rows.push(`Remove: ${collection?.find(row => row.id === input.id)?.title ?? "Item no longer on this board"}`);
      } else if (step.kind === "setBoardPhoto") {
        rows.push(`Photo space ${[1, 2, 3].includes(Number(input.slot)) ? input.slot : ""}`);
        rows.push(input.mediaId === null ? "Remove photo" : "Save photo");
        if (text("caption")) rows.push(`Caption: ${text("caption")}`);
        rows.push("Any pending upload is kept in Photos for retry.");
      } else {
        rows.push(text("title"));
        if (text("dueDate")) rows.push(`Date: ${text("dueDate")}`);
        if (text("assigneeId")) rows.push(`Assigned to: ${household.members.find(row => row.id === input.assigneeId)?.name ?? "Former member"}`);
        rows.push(input.completed ? "Completed" : "Still to do");
      }
      return <div key={index}>
        <label>Retained {destination.label} draft<textarea readOnly rows={Math.max(3, rows.length)} aria-label={`Retained ${destination.label} draft`} value={rows.filter(Boolean).join("\n")} /></label>
        <button type="button" className="chip" onClick={() => onOpen(destination.board)}>Open {destination.label}</button>
      </div>;
    })}
  </div>;
}
