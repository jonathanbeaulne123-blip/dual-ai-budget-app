import { useEffect, useRef, useState } from "react";
import type { KitchenCommandOptions, KitchenCommandResult } from "../kitchenCommand.ts";

type Submission<T> = { payload: T; status: "waiting" | "retryable" | "review" };

/** A local latch for one note intent. Acceptance comes from the rendered board.
 * Unknown transport results stay latched for the original receipt's recovery. */
export function useNoteSubmission<T>() {
  const pending = useRef<Submission<T> | null>(null);
  const live = useRef(false);
  const [, redraw] = useState(0);
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; pending.current = null; };
  }, []);
  function finish() { pending.current = null; redraw(n => n + 1); }
  function submit(payload: T, send: (options: KitchenCommandOptions) => KitchenCommandResult | Promise<KitchenCommandResult>) {
    if (!live.current || pending.current?.status === "waiting") return;
    const packet: Submission<T> = { payload, status: "waiting" };
    pending.current = packet; // Before invoking a callback, including synchronous/reentrant callers.
    redraw(n => n + 1);
    const isCurrent = () => live.current && pending.current === packet;
    const reject = (retryable: boolean) => {
      if (!isCurrent()) return;
      packet.status = retryable ? "retryable" : "review";
      redraw(n => n + 1);
    };
    try {
      const result = send({ onDefinitiveRejected: rejection => reject(rejection?.retryable === true) });
      void Promise.resolve(result).then(outcome => {
        if (outcome && outcome.ok === false && outcome.postedNothing === true && outcome.postedExactlyOnce === false) {
          reject(outcome.retryable === true);
        }
      }, () => { /* A lost response is not proof of no write. */ });
    } catch { /* The callback may have submitted before throwing. Keep its receipt locked. */ }
  }
  return { pending, submit, finish };
}
