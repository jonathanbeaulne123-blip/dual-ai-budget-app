export function parseCollectorArgs(args: string[]): {
  origin?: string;
  featureId: string;
  manifestPath: string;
  outputPath?: string;
  sourceSha?: string;
  headed: boolean;
};
export function seriousAxeViolations(violations: Array<{ impact?: string | null }>): Array<{ impact?: string | null }>;
export function resolveCollectorOutput(outputPath: string | undefined, fallbackName: string): string;
export function redactDiagnosticText(value: unknown): string;
export function reducedMotionBehaviorPass(
  normal: { maxSeconds: number; activeElements: number },
  reduced: { maxSeconds: number; activeElements: number },
  mediaMatches: boolean,
): boolean;
export function validatePublicFeature(feature: {
  id: string;
  dataClass?: string;
  journeys?: Array<{ id: string; route: string }>;
}, origin: string): void;
export function collectBrowserEvidence(options: ReturnType<typeof parseCollectorArgs>): Promise<{
  report: any;
  reportPath: string;
}>;
