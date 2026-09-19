/** Fixture assertions must fail on unavailable money rather than treating it as zero. */
export function knownCents(value: number | null): number {
  if (value === null) throw new Error("This fixture expected readable backing.");
  return value;
}
