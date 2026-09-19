import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ensureSupabaseSession, loadSupabaseSession, SUPABASE_SESSION_CHANGED_EVENT } from "../auth/supabaseSession.ts";
import type { Household } from "../core/types.ts";
import { createBoardMediaClient, type BoardMediaClient } from "./index.ts";

/**
 * A read-mostly board media client for surfaces that only *show* the household
 * board photos (the Our Path memory flags). Built exactly the way
 * `widgets/BoardPhotos.tsx` builds its client: scoped to this environment,
 * household, member and signed-in identity, retired when any of those change.
 * Signed out (or a demo/local household) means no client and no requests.
 */
function authKey(household: Pick<Household, "environment">): string {
  const session = loadSupabaseSession(household.environment);
  return session ? JSON.stringify([session.userId, session.sessionId]) : "signed-out";
}

export function HouseholdBoardMedia({ household, memberId, children }: { household: Household; memberId: string; children: (client: BoardMediaClient | null) => ReactNode }) {
  const [identity, setIdentity] = useState(() => authKey(household));
  const [client, setClient] = useState<BoardMediaClient | null>(null);
  const latest = useRef(household);
  latest.current = household;
  useEffect(() => {
    const refresh = () => setIdentity(authKey(latest.current));
    refresh();
    window.addEventListener(SUPABASE_SESSION_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(SUPABASE_SESSION_CHANGED_EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, [household.environment]);
  useLayoutEffect(() => {
    let retired = false;
    const { environment, householdId } = household;
    const session = loadSupabaseSession(environment);
    if (!session || authKey(household) !== identity) { setClient(null); return () => { retired = true; }; }
    const stillHere = () => !retired && authKey(latest.current) === identity && latest.current.householdId === householdId
      && latest.current.members.some((member) => member.id === memberId && member.active);
    let media: BoardMediaClient;
    try {
      media = createBoardMediaClient({
        scope: { environment, householdId, actorId: memberId, authIdentity: session.userId },
        isCurrent: stillHere,
        getSession: async () => {
          if (!stillHere()) return null;
          const current = navigator.onLine === false ? loadSupabaseSession(environment) : await ensureSupabaseSession(environment);
          return current && stillHere() ? { accessToken: current.accessToken, actorId: memberId, authIdentity: current.userId } : null;
        },
      });
    } catch {
      setClient(null);
      return () => { retired = true; };
    }
    setClient(media);
    return () => { retired = true; media.dispose(); setClient(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, household.environment, household.householdId, memberId]);
  return <>{children(client)}</>;
}

/**
 * Object URLs for a set of board photos, fetched through the client (the same
 * pattern as `usePhotoUrl` in `BoardPhotos.tsx`). A failure simply leaves that
 * photo out. Every URL is revoked when the set, the client, or the page goes away.
 */
export function useBoardPhotoUrls(client: BoardMediaClient | null | undefined, mediaIds: readonly string[]): Record<string, string> {
  const key = [...new Set(mediaIds)].sort().join("|");
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    const made: string[] = [];
    setUrls({});
    if (client && key) {
      for (const mediaId of key.split("|")) {
        void client.getBoardPhoto(mediaId).then((blob) => {
          if (!active) return;
          const url = URL.createObjectURL(blob);
          made.push(url);
          setUrls((current) => ({ ...current, [mediaId]: url }));
        }).catch(() => { /* the flag keeps its plain card */ });
      }
    }
    return () => { active = false; for (const url of made) URL.revokeObjectURL(url); };
  }, [client, key]);
  return urls;
}
