// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Letters, publishLettersReview, type LettersClient, type LettersProps } from '../src/hearthside/Letters.tsx';
import type { LettersDraft, LettersDraftStorage } from '../src/hearthside/LettersState.tsx';
import { HearthsideVaultStore, type VaultStorage } from '../workers/hearthsideVaultStore.ts';
import { vaultAuthorReview, type VaultPublication, type VaultScope } from '../src/hearthside/vaultContracts.ts';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const alice: VaultScope = { environment: 'development', householdId: 'HH-LETTERS', memberId: 'MEM-A', subject: 'alice', expires: 9e15 };
const bob: VaultScope = { ...alice, memberId: 'MEM-B', subject: 'bob' };
let host: HTMLDivElement, root: Root, props: LettersProps, store: HearthsideVaultStore;
let local: Map<string, LettersDraft>, client: LettersClient, lostAck: boolean, calls: { operation: string; id?: string }[];
const button = (text: string) => [...host.querySelectorAll('button')].find(el => el.textContent === text)!;
const input = (name: string) => [...host.querySelectorAll('label')].find(label => label.textContent?.trim().startsWith(name))?.querySelector('input,textarea,select') as HTMLInputElement;
async function click(text: string) { await act(async () => button(text).click()); }
async function type(name: string, value: string) {
  await act(async () => { const el = input(name); const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value); el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); });
}
async function render() { await act(async () => root.render(createElement(Letters, props))); }
beforeEach(async () => {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host); local = new Map(); calls = []; lostAck = false;
  const records = new Map<string, unknown>();
  const storage: VaultStorage = { get: <T>(key: string) => structuredClone(records.get(key)) as T | undefined, put: (key, value) => { records.set(key, structuredClone(value)); },
    list: <T>(prefix: string) => [...records].filter(([key]) => key.startsWith(prefix)).map(([, value]) => structuredClone(value) as T), transaction: action => action() };
  store = new HearthsideVaultStore(storage);
  const cache: LettersDraftStorage = { list: async () => [...local.values()], put: async (_scope, draft) => { local.set(draft.id, draft); }, remove: async (_scope, id) => { local.delete(id); } };
  client = {
    snapshot: async () => ({ version: 1, drafts: store.listDrafts(props.scope as VaultScope), publications: store.listReceipts(props.scope as VaultScope), mail: store.listMail(props.scope as VaultScope), serverTime: Date.now() }),
    command: async (body: unknown) => {
      const value = body as { operation: string; input: unknown; id: string; digest: string }; calls.push(value);
      const s = props.scope as VaultScope;
      switch (value.operation) {
        case 'save-draft': return store.saveDraft(s, value.input);
        case 'delete-draft': return store.deleteDraft(s, value.input);
        case 'prepare-publication': return vaultAuthorReview(await store.preparePublication(s, value.input, { recipients: [{ memberId: bob.memberId, subject: bob.subject }], approvers: [{ memberId: alice.memberId, subject: alice.subject }] }));
        case 'approve': return store.approve(s, value.id, value.digest);
        case 'activate': { const p = store.readyForAcceptance(s, value.id); if (!p.acceptance) store.markAccepted(s, value.id, { ...store.reference(s, p), receiptId: 'receipt', acceptedAt: Date.now() }); const r = store.activate(s, value.id); if (lostAck) { lostAck = false; throw new Error('Connection lost'); } return r; }
        case 'withdraw': return store.withdraw(s, value.id);
        case 'read-publication': return store.readPublication(s, value.id);
        case 'resume-publication': return vaultAuthorReview(store.resumeReview(s, value.id));
        default: throw new Error(value.operation);
      }
    }, media: vi.fn(), queueMedia: vi.fn(), resumeUploads: async () => [], removeQueuedMedia: vi.fn(),
  };
  props = { client, storage: cache, scope: alice, roster: [{ memberId: alice.memberId, name: 'Alex' }, { memberId: bob.memberId, name: 'Sam' }], theme: 'classic', onClose: vi.fn(), publishReviewed: review => publishLettersReview(client, review), recordVoice: async () => { throw new DOMException('Denied', 'NotAllowedError'); } };
  await render();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
async function compose() { await type('Letter title', 'A quiet evening'); await type('Your words', 'Thank you for the ordinary lovely things.'); await act(async () => input('Sam').click()); }
it('keeps private writing local until explicit save, then publishes only the exact reviewed copy', async () => {
  await compose(); expect(calls).toEqual([]); expect(local.size).toBe(1);
  await click('Save private draft'); expect(store.listDrafts(alice)[0]?.content.text).toContain('ordinary lovely'); expect(store.listDrafts(bob)).toEqual([]);
  await click('Review sharing'); expect(host.textContent).toContain('Review before sharing'); expect(store.listMail(bob)).toEqual([]);
  await click('Publish this exact letter'); expect(store.listMail(bob)).toHaveLength(1); expect(host.textContent).toContain('This copy has been published');
});
it('preserves the publication identity through lost acknowledgement and UI remount', async () => {
  await compose(); await click('Review sharing'); lostAck = true; await click('Publish this exact letter');
  const first = calls.find(call => call.operation === 'activate')?.id;
  expect(button('Retry this publication')).toBeDefined();
  await act(async () => root.unmount()); root = createRoot(host); await render();
  const resume = [...host.querySelectorAll('.letters-cabinet button')].find(button => button.textContent?.includes('Publication needs recovery')) as HTMLButtonElement;
  await act(async () => resume.click()); await click('Retry this publication');
  expect(calls.filter(call => call.operation === 'activate').map(call => call.id)).toEqual([first, first]); expect(store.listMail(bob)).toHaveLength(1);
});
it('theme changes preserve text, chosen recipient and the exact reviewed state', async () => {
  await compose(); props = { ...props, theme: 'taylor' }; await render(); expect(input('Your words').value).toContain('ordinary lovely'); expect(input('Sam').checked).toBe(true);
  await click('Review sharing'); const digest = [...local.values()][0]!.publication!.review!.digest;
  props = { ...props, theme: 'newfoundland' }; await render(); expect([...local.values()][0]!.publication!.review!.digest).toBe(digest); expect(host.textContent).toContain('Review before sharing');
});
it('resumes an unpublished exact review on another device without creating a new publication', async () => {
  await compose(); await click('Review sharing'); const publicationId = [...local.values()][0]!.publication!.input.id;
  local.clear(); await act(async () => root.unmount()); root = createRoot(host); await render();
  const card = [...host.querySelectorAll('.letters-cabinet button')].find(button => button.textContent?.includes('Not yet published')) as HTMLButtonElement;
  await act(async () => card.click()); expect(host.textContent).toContain('Review before sharing'); await click('Publish this exact letter');
  expect(calls.find(call => call.operation === 'activate')?.id).toBe(publicationId); expect(store.listMail(bob)).toHaveLength(1);
});
it('recovers microphone permission denial without losing written content or publishing anything', async () => {
  await compose(); await click('Record a voice note'); expect(host.textContent).toContain('Microphone access was not allowed'); expect(input('Your words').value).toContain('ordinary lovely'); expect(calls).toEqual([]);
});
it('stops showing an active recording after microphone failure and preserves the letter', async () => {
  let fail!: (error: Error) => void;
  props = { ...props, recordVoice: async () => ({ stop: async () => new Blob(), cancel: vi.fn(), finished: new Promise((_resolve, reject) => { fail = reject; }) }) };
  await render(); await compose(); await click('Record a voice note'); expect(button('Stop and keep voice note')).toBeDefined();
  await act(async () => fail(new Error('RECORDING_FAILED')));
  expect(host.textContent).toContain('Recording is unavailable'); expect(button('Stop and keep voice note')).toBeUndefined(); expect(input('Your words').value).toContain('ordinary lovely');
});
it('refuses network save or sharing when device draft persistence fails', async () => {
  props = { ...props, storage: { list: async () => [], put: async () => { throw new Error('PRIVATE_STORAGE_UNAVAILABLE'); }, remove: async () => {} } }; await render();
  await compose(); await click('Save private draft'); expect(host.textContent).toContain('This device could not keep the draft'); expect(calls).toEqual([]);
});
it('requires an explicit withdrawal before editing a reviewed composition', async () => {
  await compose(); await click('Review sharing'); expect(input('Your words').closest('fieldset')?.disabled).toBe(true);
  const publication = [...local.values()][0]!.publication!;
  await click('Withdraw review and edit'); expect(store.listReceipts(alice).find(p => p.publicationId === publication.input.id)?.state).toBe('revoked');
  expect(input('Your words').closest('fieldset')?.disabled).toBe(false); await type('Your words', 'A changed version'); await click('Review sharing');
  expect([...local.values()][0]!.publication!.input.id).not.toBe(publication.input.id);
});
it('deleting a private draft leaves its deliberate published copy available', async () => {
  await compose(); await click('Review sharing'); await click('Publish this exact letter'); await click('Delete private draft'); await click('Delete this draft');
  expect(local.size).toBe(0); expect(store.listDrafts(alice)).toEqual([]); expect(store.listMail(bob)).toHaveLength(1);
});
it('shows a recipient a sealed capsule and opening time without returning its secret content', async () => {
  store.saveDraft(alice, { id: 'capsule-draft', expectedRevision: 0, content: { title: 'Secret title', text: 'Secret capsule words', mediaIds: [] } });
  const publication: VaultPublication = await store.preparePublication(alice, { id: 'capsule', draftId: 'capsule-draft', draftRevision: 1, kind: 'capsule', recipientMemberIds: [bob.memberId], releaseAt: Date.now() + 86400000 }, { recipients: [{ memberId: bob.memberId, subject: bob.subject }], approvers: [{ memberId: alice.memberId, subject: alice.subject }] });
  store.approve(alice, publication.id, publication.digest); store.markAccepted(alice, publication.id, { ...store.reference(alice, publication), receiptId: 'receipt', acceptedAt: Date.now() }); store.activate(alice, publication.id);
  props = { ...props, scope: bob }; await render();
  const card = [...host.querySelectorAll('.letters-cabinet button')].find(button => button.textContent?.includes('A sealed time capsule')) as HTMLButtonElement;
  await act(async () => card.click()); expect(host.textContent).toContain('This capsule opens'); expect(host.textContent).not.toContain('Secret capsule words'); expect(host.textContent).not.toContain('Secret title');
});
