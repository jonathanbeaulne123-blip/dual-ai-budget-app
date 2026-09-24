import type { DeskPageProps } from "./types.ts";

/**
 * A page whose instruments arrive later in this build (S3/S4). It is a real
 * page, not a dead chip: it says so plainly and keeps the page's own door.
 * A later slice replaces the registry entry, not this component.
 */
export function deskComing(title: string, door: { target: string; words: string }) {
  function DeskComing({ onOpen }: DeskPageProps) {
    return <div className="desk-card desk-coming" data-desk-coming="">
      <p className="desk-card__kicker">{title}</p>
      <p className="desk-card__line">This page is coming in this build. Until then its door is right here.</p>
      <button type="button" className="desk-door" onClick={() => onOpen(door.target)}>{door.words}</button>
    </div>;
  }
  DeskComing.displayName = `DeskComing(${title})`;
  return DeskComing;
}
