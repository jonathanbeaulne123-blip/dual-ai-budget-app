import { useEffect, useRef, useState } from 'react';
import type { KitchenCommand } from '../kitchenCommand.ts';
import { commitHearthside, type HearthsideIntent, type HearthsideOperation } from './commands.ts';

/** The pending identity is persisted before transport and retained on uncertain acknowledgement. */
export function useHearthsideCommands(scope: HearthsideIntent['scope'], identity: string, connected: boolean, onCommand: KitchenCommand) {
  const key = `hearth:hearthside:request:${identity}`;
  const read = (): HearthsideIntent | null => {
    try { const raw = localStorage.getItem(key); if (!raw || raw.length > 128 * 1024) return null;
      const value = JSON.parse(raw) as HearthsideIntent;
      return value?.version === 1 && value.scope?.householdId === scope.householdId && value.scope.environment === scope.environment && value.scope.memberId === scope.memberId ? value : null;
    } catch { return null; }
  };
  const [retry, setRetry] = useState<HearthsideIntent | null>(read), [pending, setPending] = useState(false), [message, setMessage] = useState('');
  const epoch = useRef(0), lock = useRef(false),alive=useRef(false);
  useEffect(() => {alive.current=true; epoch.current++; setRetry(read()); lock.current = false; setPending(false); return () => {alive.current=false;epoch.current++;}; }, [key]);
  async function submit(operation: HearthsideOperation, recoveredRequest?: HearthsideIntent) {
    if (!alive.current || lock.current || !connected || retry && !recoveredRequest) return false;
    const generation = epoch.current, intent: HearthsideIntent = recoveredRequest ?? {version:1,id:crypto.randomUUID(),scope,operation:structuredClone(operation)};
    try { localStorage.setItem(key, JSON.stringify(intent)); } catch { setMessage('This device cannot keep a recovery copy. Your draft is still open.'); return false; }
    lock.current = true; setPending(true); setRetry(intent); setMessage('Saving…');
    let recovered = false, rejected = false;
    try {
      const result = await onCommand(h => commitHearthside(h, intent), {confirmationId:intent.id,recoverConfirmation:Boolean(recoveredRequest),onRecoveredConfirmation:()=>{recovered=true;},onDefinitiveRejected:()=>{rejected=true;}});
      if (generation !== epoch.current) return false;
      if (recovered || result?.kind === 'synchronized' && result.ok || rejected) {
        localStorage.removeItem(key); setRetry(null);
        setMessage(rejected ? 'This changed elsewhere. Your draft is kept; review the current version.' : 'Kept in your shared home.');
        return !rejected;
      }
      setMessage('Not confirmed yet. Reconnect and retry this same save.'); return false;
    } catch (error) { if (generation === epoch.current) setMessage(error instanceof Error ? error.message : 'Not confirmed yet. Your draft is kept.'); return false;
    } finally { if (generation === epoch.current) {lock.current=false;setPending(false);} }
  }
  return {submit, pending, retry, message, canStart:connected&&!pending&&!retry, retryNow:()=>retry?submit(retry.operation,retry):Promise.resolve(false)};
}
