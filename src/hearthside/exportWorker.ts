import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { finishKittyExport, prepareKittyExport, type PreparedKittyExport } from './exportKitty.ts';
import type { ExportCapture, ExportSelection } from './exportTypes.ts';

export type ExportWorkerRequest =
  | { type: 'prepare'; requestId: string; selection: ExportSelection; capture: ExportCapture }
  | { type: 'finish'; requestId: string; token: string; approvedRepairDigest?: string };

/** One job per worker. Terminate it on cancellation, sign-out, or scope change. No stored authority. */
const worker = self as unknown as { onmessage: ((event: MessageEvent<ExportWorkerRequest>) => void) | null; postMessage: (message: unknown, transfer?: Transferable[]) => void };
let prepared: PreparedKittyExport | null = null, busy = false;
worker.onmessage = async event => {
  const message = event.data;
  if (!message || typeof message.requestId !== 'string' || !/^[A-Za-z0-9_.:-]{1,160}$/.test(message.requestId)) return;
  const requestId = message.requestId;
  if (busy) { worker.postMessage({ type: 'error', requestId, code: 'EXPORT_BUSY' }); return; }
  busy = true;
  try {
    if (message.type === 'prepare') {
      prepared = null;
      prepared = await prepareKittyExport(message.selection, message.capture);
      worker.postMessage({ type: 'prepared', requestId, token: prepared.proposal.digest, selection: prepared.selection, proposal: prepared.proposal, report: prepared.report });
    } else if (message.type === 'finish') {
      if (!prepared || message.token !== prepared.proposal.digest) throw Error('EXPORT_JOB_CHANGED');
      const output = await finishKittyExport(prepared, { approvedRepairDigest: message.approvedRepairDigest, wasmUrl });
      prepared = null;
      const files = [...output.files];
      worker.postMessage({ type: 'complete', requestId, manifest: output.manifest, files }, files.map(([, bytes]) => bytes.buffer as ArrayBuffer));
    } else throw Error('EXPORT_UNKNOWN_REQUEST');
  } catch (error) {
    const code = error instanceof Error ? error.message.split(':')[0] : 'EXPORT_FAILED';
    worker.postMessage({ type: 'error', requestId, code });
  } finally { busy = false; }
};
