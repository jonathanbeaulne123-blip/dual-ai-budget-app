export const FIVE_DIMENSIONS: readonly string[];
export const REQUIRED_VIEWPORTS: readonly number[];
export function createClaimDigest(evidence: any): string;
export function validateJourneyManifest(manifest: unknown): Array<{ code: string; message: string; dimensions: string[] }>;
export function evaluateFeatureEvidence(options: {
  manifest: any;
  evidence: any;
  evidenceRoot: string;
  expectedSha: string;
  expectedEnvironmentId: string;
  worktreeClean: boolean;
  evidencePath?: string;
  now?: Date;
  allowFixture?: boolean;
}): Promise<{
  ok: boolean;
  fixturePassed: boolean;
  canDisplayFiveOfFive: boolean;
  displayLabel: "5/5" | null;
  earnedDimensions: number;
  dimensionPass: Record<string, boolean>;
  issues: Array<{ code: string; message: string; dimensions: string[] }>;
}>;
