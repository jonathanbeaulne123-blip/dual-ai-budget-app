import type { ReactNode } from "react";

/**
 * One stroke set for the glass (brief §4.2): a 24 grid, 2 px stroke, round
 * caps, `currentColor` so forced colours paint it. Each carries a `<title>`
 * for pointer hover; the button it sits in is named by its visible label, so
 * the drawing itself is hidden from the accessibility tree.
 */
function Stroke({ title, children, size = 24 }: { title: string; children: ReactNode; size?: number }) {
  return (
    <svg className="glass-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <title>{title}</title>
      {children}
    </svg>
  );
}

/** Record: a plus inside the accent disc. */
export const RecordIcon = ({ size }: { size?: number }) => <Stroke title="Record" size={size}><path d="M12 5v14M5 12h14" /></Stroke>;

/** All tools: three rows and a magnifying glass — the list and its search. */
export const ToolsIcon = ({ size }: { size?: number }) => (
  <Stroke title="All tools and search" size={size}>
    <path d="M4 6h10M4 12h6M4 18h6" /><circle cx="16.5" cy="15.5" r="3.5" /><path d="M19 18l2 2" />
  </Stroke>
);

/** Simple view: an open page. */
export const SimpleViewIcon = ({ size }: { size?: number }) => (
  <Stroke title="Simple view" size={size}>
    <path d="M3 5.5C5.5 4.5 8.5 4.5 12 6.5c3.5-2 6.5-2 9-1V19c-2.5-1-5.5-1-9 1-3.5-2-6.5-2-9-1Z" /><path d="M12 6.5V20" />
  </Stroke>
);

/** Island: a hill standing in water. */
export const IslandIcon = ({ size }: { size?: number }) => (
  <Stroke title="Island" size={size}>
    <path d="M5 15c1.5-4 4-7 7-7s5.5 3 7 7" /><path d="M3 18c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0" />
  </Stroke>
);

/** Put it back: a close mark for sheets and panels. */
export const CloseIcon = ({ size = 20 }: { size?: number }) => <Stroke title="Put it back" size={size}><path d="M6 6l12 12M18 6L6 18" /></Stroke>;
