import { lazy, type ComponentProps } from "react";
import { DeferredBooksPage, DeferredSurface } from "../deferredSurfaces.tsx";
import { OnboardingReady } from "../OnboardingReady.tsx";
import { CampfireDoor } from "../campfire/CampfireDoor.tsx";
import { formatCad } from "../core/index.ts";
import { canonical } from "../ledgerSync/patch.ts";

const AccountHistorySetup = lazy(() => import("../AccountHistorySetup.tsx").then(module => ({ default: module.AccountHistorySetup })));

type BooksPageProps = ComponentProps<typeof DeferredBooksPage>;
type OnboardingReadyProps = ComponentProps<typeof OnboardingReady>;

/** One reversing entry, handed back to App()'s own Confirm sheet. */
export type BooksRemovalRequest = {
  transactionId: string;
  summary: string;
  reviewedSummaryBasis: string;
};

export type BooksTabProps =
  & Omit<BooksPageProps, "accountHistorySetup" | "onRemove">
  & {
    today: string;
    busy: boolean;
    authUserId: string;
    readyIdentity: string;
    onboardingBooksOpen: boolean;
    onboardingReadyOnly: boolean;
    onCloseOnboardingBooks: () => void;
    onReadyCommit: OnboardingReadyProps["onCommit"];
    onReadyDismiss: OnboardingReadyProps["onDismiss"];
    onAskRemove: (request: BooksRemovalRequest) => void;
    /**
     * The month's books close at the Campfire's Settle now (Tool Atlas K3, D3).
     * Present when the household door belongs on this surface; App() decides.
     * `onOpenCampfire` opens the ritual sheet; the leftover guide lives there.
     */
    campfireDoor?: { onOpenCampfire?: () => void } | null;
  };

/**
 * The Books tab, lifted out of `App()`'s one 2,300-line return (P3). Props in,
 * JSX out: every value and every handler is still built by the `App()` render
 * that shows this tab, so the Hearth commands keep the scope they were issued
 * with and nothing about what this surface does changes.
 */
export function BooksTab({
  today,
  busy,
  authUserId,
  readyIdentity,
  onboardingBooksOpen,
  onboardingReadyOnly,
  onCloseOnboardingBooks,
  onReadyCommit,
  onReadyDismiss,
  onAskRemove,
  campfireDoor,
  ...books
}: BooksTabProps) {
  return (
    <DeferredSurface label="Books">
    {onboardingBooksOpen && onboardingReadyOnly && <button className="ghost" type="button" onClick={onCloseOnboardingBooks}>Back to Ready together</button>}
    {onboardingReadyOnly && !onboardingBooksOpen ? (
      <OnboardingReady
        key={readyIdentity}
        household={books.booksHousehold}
        memberId={books.memberId}
        today={today}
        busy={busy}
        onCommit={onReadyCommit}
        onDismiss={onReadyDismiss}
      />
    ) : <DeferredBooksPage
      {...books}
      accountHistorySetup={<AccountHistorySetup household={books.booksHousehold} memberId={books.memberId} authUserId={authUserId} view={books.view} today={today} busy={busy} onCommand={books.onCommand} />}
      onRemove={(transaction) => {
        const dollars = formatCad(transaction.amountCents);
        const summary = transaction.source === "shift"
          ? `This posts reversing income for the whole shift (${dollars} wages and tips). The shift row stays.`
          : transaction.type === "transfer"
            ? `This posts a reversing transfer for ${dollars}. Both original legs stay.`
            : `This posts a reversing entry for ${dollars}${transaction.note ? ` (${transaction.note})` : ""}. The original row stays.`;
        onAskRemove({ transactionId: transaction.id, summary, reviewedSummaryBasis: canonical([transaction.id, transaction.amountCents, transaction.type, transaction.source, transaction.note]) });
      }}
    />}
    {campfireDoor && (
      <CampfireDoor household={books.booksHousehold} memberId={books.memberId} today={today} onOpenCampfire={campfireDoor?.onOpenCampfire}
        why="Where leftover goes, and closing the books, are at the Campfire's Settle." />
    )}
    </DeferredSurface>
  );
}
