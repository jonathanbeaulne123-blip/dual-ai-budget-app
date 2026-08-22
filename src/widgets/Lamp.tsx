import { lampIsDark } from "../core/officeFacts.ts";
import type { Finding } from "../core/health.ts";

export function LampGlance({ findings }: { findings: Finding[] }) {
  return <span className="lamp-shade" data-count={findings.length} aria-hidden="true" />;
}

export function LampBody({
  findings,
  onMore,
}: {
  findings: Finding[];
  onMore: () => void;
}) {
  if (lampIsDark(findings)) {
    return (
      <>
        <p className="muted">The lamp is dark. The books agree with themselves.</p>
        <button type="button" className="cabinet-handle" onClick={onMore}>More</button>
      </>
    );
  }
  return (
    <>
      {findings.map((finding) => (
        <button
          key={finding.section + finding.message}
          type="button"
          className="row"
          style={{ width: "100%", border: 0, background: "transparent", textAlign: "left", minHeight: 44 }}
          onClick={onMore}
        >
          <span><strong>{finding.section}.</strong> {finding.message}</span>
        </button>
      ))}
      <button type="button" className="cabinet-handle" onClick={onMore}>More</button>
    </>
  );
}

export function lampAria(findings: Finding[]): string {
  return lampIsDark(findings) ? "Health lamp. Clean." : `Health lamp. ${findings.length} findings.`;
}
