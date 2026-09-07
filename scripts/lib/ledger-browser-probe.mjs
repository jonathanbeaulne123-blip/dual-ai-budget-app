/** Observational probe for the ordinary App. Paint times are conservative two-frame bounds. */
export function installLedgerBrowserProbe({ prefix } = {}) {
  const now = () => performance.timeOrigin + performance.now();
  const probe = window.__ledgerAcceptance = {
    openedAt: performance.timeOrigin, interactiveAt: null, currentReady: false, transactionCount: null,
    commands: {}, rows: {}, canonicalTrialRows: {}, errors: [], conflictDialogs: 0, privacyLeaks: 0, bytes: { sent: 0, received: 0 },
    frames: [], coldOpenMs: null, clicks: [], paintMethod: 'visible-row-two-animation-frame-upper-bound',
  };
  const transfers = new Map(), seenConflicts = new WeakSet();
  let scanPending = false, nextClick = 0;
  const visible = element => {
    if (!element || !element.getClientRects().length || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0
      || rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) return false;
    const x = (Math.max(0,rect.left)+Math.min(innerWidth-1,rect.right))/2;
    const y = (Math.max(0,rect.top)+Math.min(innerHeight-1,rect.bottom))/2;
    const top = document.elementFromPoint(x,y);
    return top === element || element.contains(top);
  };
  const afterPaint = (node, callback) => requestAnimationFrame(() => requestAnimationFrame(() => {
    if (visible(node)) callback(now());
  }));
  const scan = () => {
    scanPending = false;
    const app = document.querySelector('[data-books-readiness="ready"][data-ledger-live="true"]');
    const add = document.querySelector('button[aria-label="Add money"]');
    probe.currentReady = Boolean(app && add && !add.disabled && visible(add));
    if (app) probe.transactionCount ??= Number(app.dataset.ledgerTransactionCount);
    if (!probe.interactiveAt && probe.currentReady) {
      afterPaint(add, at => { if (document.querySelector('[data-books-readiness="ready"][data-ledger-live="true"]')) {
        probe.interactiveAt ??= at; probe.coldOpenMs ??= at-probe.openedAt;
      }});
    }
    for (const node of document.querySelectorAll('[data-ledger-row-id]')) {
      if (!visible(node)) continue;
      const id = node.dataset.ledgerRowId;
      if (!prefix || !node.textContent.includes(prefix)) continue;
      const row = probe.rows[id] ??= {paintAt:null};
      if (row.paintAt || row.scheduled) continue;
      row.domAt = now(); row.scheduled = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        row.scheduled = false;
        if (visible(node)) { row.paintAt = now(); row.text = node.textContent; }
        else schedule(); // React may replace the scheduled node before paint.
      }));
    }
    for (const node of document.querySelectorAll('[data-command-id]')) {
      const command = probe.commands[node.dataset.commandId];
      if (!command || !command.ackAt || command.savedPaintAt || command.savedScheduled
        || node.dataset.commandPhase !== 'cloud-ack' || !visible(node)) continue;
      command.savedScheduled = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        command.savedScheduled = false;
        if (visible(node) && node.dataset.commandPhase === 'cloud-ack' && node.dataset.commandId === command.id) command.savedPaintAt = now();
      }));
    }
    for (const node of document.querySelectorAll('[role="alert"], [role="dialog"]')) {
      if (visible(node) && /conflict|another device|saved first|BUSINESS_PRECONDITION_CHANGED/i.test(node.textContent ?? '') && !seenConflicts.has(node)) {
        seenConflicts.add(node); probe.conflictDialogs++;
      }
    }
  };
  const schedule = () => { if (!scanPending) { scanPending = true; queueMicrotask(scan); } };
  document.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('[data-add-confirm]')) probe.clicks.push(now());
  }, true);
  document.addEventListener('DOMContentLoaded', () => {
    new MutationObserver(schedule).observe(document.documentElement, {subtree:true,childList:true,attributes:true,characterData:true});
    document.addEventListener('scroll',schedule,true); schedule();
  }, {once:true});
  for (const method of ['alert','confirm']) {
    const original = window[method];
    window[method] = function(message) { if (/conflict|another device|saved first/i.test(String(message))) probe.conflictDialogs++; return original.call(this,message); };
  }
  const record = (message, direction, at, bytes) => {
    if (direction === 'sent' && message.type === 'command') {
      const id = message.command.id;
      // One visible Confirm may retry the same UUID. Never consume another click.
      // Background commands cannot consume an Add click: only this trial's note
      // in the submitted intent is eligible for correlation.
      if (prefix && JSON.stringify(message.command.steps).includes(prefix)) {
        probe.commands[id] ??= {id,confirmAt:probe.clicks[nextClick++] ?? null,sentAt:at,bytes:0};
        probe.commands[id].bytes += bytes;
      }
    }
    if (direction === 'received') {
      const shared = message.replica?.shared ?? message.event?.shared;
      const inspect = value => {
        if (!value || typeof value !== 'object') return;
        if (value.visibility === 'personal' || value.scope === 'personal') probe.privacyLeaks++;
        for (const child of Object.values(value)) inspect(child);
      };
      inspect(shared);
      const memberId = JSON.parse(localStorage.getItem('hearth:session:v1:development') ?? 'null')?.memberId;
      if (message.replica?.personal && message.replica.personal.memberId !== memberId) probe.privacyLeaks++;
      if (message.event?.personal && message.event.memberId !== memberId) probe.privacyLeaks++;
      const retain = rows => { for (const row of rows ?? []) {
        if (prefix && typeof row.note === 'string' && row.note.startsWith(`${prefix}-`))
          probe.canonicalTrialRows[row.id] = { id:row.id, note:row.note, amountCents:row.amountCents };
      }};
      if (message.type === 'snapshot') {
        probe.canonicalTrialRows = {};
        retain(message.replica.shared.transactions); retain(message.replica.personal.transactions);
      }
      for (const patch of [message.event?.shared, message.event?.personal]) if (patch) {
        for (const id of patch.rows?.transactions?.remove ?? []) delete probe.canonicalTrialRows[id];
        retain(patch.rows?.transactions?.put); retain(patch.set?.transactions);
      }
    }
    if (direction === 'received' && message.type === 'snapshot') probe.transactionCount ??= (message.replica?.shared?.transactions?.length ?? 0) + (message.replica?.personal?.transactions?.length ?? 0);
    if (direction === 'received' && message.type === 'ack') {
      const receipt = message.receipt, command = probe.commands[receipt.id];
      if (command) {
        const identity = JSON.stringify([receipt.id,receipt.sequence,receipt.digest,receipt.actor,receipt.postedIds]);
        if (command.receiptIdentity && command.receiptIdentity !== identity) probe.errors.push('RECEIPT_IDENTITY_CHANGED');
        Object.assign(command,{ackAt:command.ackAt??at,postedIds:receipt.postedIds,sequence:receipt.sequence,
          receiptIdentity:identity,receiptValid:receipt.actor===JSON.parse(localStorage.getItem('hearth:session:v1:development')??'null')?.memberId
            && Number.isSafeInteger(receipt.sequence) && receipt.sequence>0 && /^[a-f0-9]{64}$/.test(receipt.digest)});
      }
    }
    if (direction === 'received' && message.type === 'error') probe.errors.push(message.code);
    probe.frames.push({type:message.type,direction,bytes,at,id:message.command?.id??message.receipt?.id,sequence:message.event?.sequence??message.receipt?.sequence});
    if (probe.frames.length > 5000) { probe.errors.push('PROBE_FRAME_LIMIT'); probe.frames.shift(); }
    schedule();
  };
  const observe = (data,direction) => {
    const at=now();
    if (typeof data === 'string') return; // Never retain auth/tickets.
    if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) return;
    const bytes=data instanceof ArrayBuffer?new Uint8Array(data):new Uint8Array(data.buffer,data.byteOffset,data.byteLength);
    probe.bytes[direction]+=bytes.byteLength;
    if(bytes.length<78||bytes[0]!==2||bytes[1]!==1)return;
    try {
      const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
      const key=`${direction}/${new TextDecoder().decode(bytes.subarray(2,38))}`;
      const part=view.getUint32(38),size=view.getUint32(42);
      if(size>32*1024*1024)throw new Error('PROBE_OVERSIZE');
      if(part===0)transfers.set(key,{parts:[],next:0,size,bytes:0,payload:0});
      const transfer=transfers.get(key);
      if(!transfer||transfer.next!==part||transfer.size!==size)throw new Error('PROBE_FRAME_ORDER');
      transfer.next++;transfer.bytes+=bytes.byteLength;transfer.parts.push(bytes.slice(78));transfer.payload+=bytes.length-78;
      if(transfer.payload>size)throw new Error('PROBE_OVERSIZE');
      if(transfer.payload===size){
        const body=new Uint8Array(size);let offset=0;
        for(const value of transfer.parts){body.set(value,offset);offset+=value.length;}
        transfers.delete(key);record(JSON.parse(new TextDecoder().decode(body)),direction,at,transfer.bytes);
      }
      if(transfers.size>8)throw new Error('PROBE_TRANSFER_LIMIT');
    }catch(error){probe.errors.push(error.message);transfers.clear();}
  };
  const NativeWebSocket=window.WebSocket;
  window.WebSocket=class extends NativeWebSocket {
    constructor(url,protocols){super(url,protocols);this.observed=String(url).includes('/ledger-sync/')&&!String(url).includes('lane=presence');if(this.observed)this.addEventListener('message',event=>observe(event.data,'received'));}
    send(data){if(this.observed)observe(data,'sent');return super.send(data);}
  };
}
