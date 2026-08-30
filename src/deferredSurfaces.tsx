import { Component, lazy, Suspense, type ReactNode } from "react";

export const loadOfficeSurface = () => import("./Office.tsx");
export const loadBooksSurface = () => import("./Books.tsx");
export const loadCalendarSurface = () => import("./Calendar.tsx");
export const loadWorkShiftSurface = () => import("./WorkShiftPage.tsx");
export const loadPairingSurface = () => import("./Pairing.tsx");
export const loadQrSurface = () => import("./WelcomeQrScanner.tsx");
export const loadShiftReportSurface = () => import("./ShiftReportScan.tsx");
export const loadSevenShiftsSurface = () => import("./WorkShiftWithSevenShifts.tsx");

export const DeferredOffice = lazy(() => loadOfficeSurface().then((module) => ({ default: module.Office })));
export const DeferredBooksPage = lazy(() => loadBooksSurface().then((module) => ({ default: module.BooksPage })));
export const DeferredCalendarPage = lazy(() => loadCalendarSurface().then((module) => ({ default: module.CalendarPage })));
export const DeferredWorkShiftPage = lazy(() => loadWorkShiftSurface().then((module) => ({ default: module.WorkShiftPage })));
export const DeferredPairingCard = lazy(() => loadPairingSurface().then((module) => ({ default: module.PairingCard })));
export const DeferredWelcomeJoin = lazy(() => loadPairingSurface().then((module) => ({ default: module.WelcomeJoin })));
export const DeferredWelcomeQrScanner = lazy(() => loadQrSurface().then((module) => ({ default: module.WelcomeQrScanner })));
export const DeferredShiftReportScanBar = lazy(() => loadShiftReportSurface().then((module) => ({ default: module.ShiftReportScanBar })));
export const DeferredWorkShiftWithSevenShifts = lazy(() => loadSevenShiftsSurface().then((module) => ({ default: module.WorkShiftWithSevenShifts })));

class DeferredErrorBoundary extends Component<{
  label: string;
  children: ReactNode;
}, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="card deferred-surface" role="alert">
        <strong>{this.props.label} could not finish loading.</strong>
        <p className="muted">Your books were not changed. Reload Hearth to try this surface again.</p>
        <button type="button" className="ghost" onClick={() => window.location.reload()}>Reload Hearth</button>
      </section>
    );
  }
}

export function DeferredSurface({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DeferredErrorBoundary label={label}>
      <Suspense fallback={(
        <section className="card deferred-surface" role="status" aria-live="polite" aria-busy="true">
          <strong>Opening {label}…</strong>
          <p className="muted">The cached kitchen stays available while this room arrives.</p>
        </section>
      )}>
        {children}
      </Suspense>
    </DeferredErrorBoundary>
  );
}
