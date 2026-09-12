import { sha256String } from '../core/synchronousHash.ts';
import { canonical } from '../ledgerSync/patch.ts';
import { workspaceText, type ArtifactFormat } from './contracts.ts';
export type ArtifactDisclosureReview = { id: string; projectId: string; artifactVersionId: string; title: string; format: ArtifactFormat; content: string };
export function disclosureDigest(review: ArtifactDisclosureReview): string {
  return sha256String(canonical({ ...review, title: workspaceText(review.title, 180), content: workspaceText(review.content, 500000) }));
}
