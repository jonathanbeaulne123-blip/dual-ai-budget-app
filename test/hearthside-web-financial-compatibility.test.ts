import { describe, expect, it } from 'vitest';
import { financialAuditHash, splitForSync, assembleHousehold, catalogHousehold } from '../src/core/index.ts';
import { fundSnapshot, proposedDivision } from '../src/core/fundModel.ts';
import { projectKittyNest } from '../src/core/kittyNest.ts';
import { cellarJars, cellarGateWords, cellarJarFacts } from '../src/core/queenCellar.ts';
import { fundModelSnapshot } from '../src/plan-v3/model.ts';
import { chapterClosureRevision, closeChapter, closeChapterAtSitdown, openChapter, openChapterFor, pendingChapterClosure, reviewChapterClosureAtSitdown } from '../src/core/chapters.ts';
import { planLifeFixture } from './fixtures/plan-life.ts';
import { migrated, ALEX, SAM, TODAY } from './fixtures/fund-model.ts';

describe('Hearthside compatibility with current main financial views', () => {
  it('preserves unreadable backing in both money models without fabricating allocation or coverage', async () => {
    for (const mode of [1, 2]) {
      const h = mode === 2 ? migrated(planLifeFixture('household', { fundModel: 2 })) : planLifeFixture('household');
      const event = h.fundEvents!.find(row => row.kind === 'kitty-allocated')!;
      h.fundEvents!.push({ ...event, id: 'FUND-unresolved-release', kind: 'kitty-released', goalId: undefined, amountCents: 1, date: '2026-09-12' });
      const before = await financialAuditHash(h), nest = projectKittyNest(h, ALEX, 'household', TODAY);
      expect(nest.categories.every(row => row.amountCents === null)).toBe(true);
      expect(nest.categories.flatMap(row => row.children).filter(row => row.goal).every(row => row.amountCents === null)).toBe(true);
      expect(nest.allocation).toBeUndefined();
      expect(Number.isSafeInteger(nest.king.amountCents)).toBe(true);
      const snap = fundSnapshot(h, { memberId: ALEX, view: 'household', today: TODAY });
      expect(snap.now).toBeNull(); expect(snap.prepare.coveredThrough).toBeNull(); expect(snap.prepare.shortOn).toBeUndefined();
      expect(proposedDivision(h, event.id, { memberId: ALEX, today: TODAY })).toBeNull();
      if (mode === 2) expect(fundModelSnapshot(h, { memberId: ALEX, view: 'household', today: TODAY }).prepare.line).toMatch(/unavailable/);
      for (const jar of cellarJars(nest, h, TODAY).filter(row => !row.paid)) {
        expect(jar.savedCents).toBeNull(); expect(jar.leftCents).toBeNull(); expect(jar.strike).toBe('none');
        expect(cellarGateWords(jar, null, String)).toContain('backing unavailable');
        expect(cellarJarFacts(jar, null, h, String).find(row => row.label === 'The jar holds')!.value).toBe('Backing unavailable');
      }
      expect(await financialAuditHash(h)).toBe(before);
    }
  });
  it('binds the next Chapter month, wording and owner to both exact approvals', async () => {
    const h = openChapter(catalogHousehold(), { memberId: ALEX, foundationId: 'see-our-shared-life', at: '2026-08-02T12:00:00Z' }).household;
    const input = { memberId: ALEX, chapterId: openChapterFor(h)!.id, outcome: 'closed' as const, today: '2026-09-21', next: { custom: { title: 'Our new habit', meaning: 'Make room to rest' } } };
    const before = await financialAuditHash(h), review = reviewChapterClosureAtSitdown(h, input);
    const proposed = closeChapterAtSitdown(h, { ...input, expectedRevision: review.expectedRevision, reviewDigest: review.reviewDigest }).household;
    expect(openChapterFor(proposed)!.id).toBe(input.chapterId); expect(proposed.chapters).toHaveLength(1);
    const p = pendingChapterClosure(openChapterFor(proposed)!)!;
    expect(p.terms.nextChapter).toMatchObject({ month: '2026-09', ownerMemberId: ALEX, custom: input.next.custom });
    const approval = { ...input, memberId: SAM, expectedRevision: chapterClosureRevision(openChapterFor(proposed)!), proposalId: p.id, digest: p.digest };
    expect(() => closeChapterAtSitdown(proposed, { ...approval, today: '2026-10-01' })).toThrow(/next Chapter changed/);
    expect(() => closeChapterAtSitdown(proposed, { ...approval, next: { custom: { title: 'A different plan', meaning: 'Not reviewed' } } })).toThrow(/next Chapter changed/);
    expect(() => closeChapter(proposed, approval)).toThrow(/displayed closure changed/);
    const back = assembleHousehold(splitForSync(proposed, ALEX).shared, splitForSync(proposed, ALEX).personal, { linked: true });
    const done = closeChapterAtSitdown(back, approval).household;
    expect(openChapterFor(done)).toMatchObject({ title: 'Our new habit', intendedMonth: '2026-09', openedByMemberId: ALEX });
    expect(done.chapters).toHaveLength(2); expect(await financialAuditHash(done)).toBe(before);
    expect(() => closeChapterAtSitdown(done, approval)).toThrow();
  });
});
