/** New conversational writes are authorized only for the Development release. */
export function herculesActionsEnabled(environment: string, flag: unknown): boolean {
  return environment === 'development' && flag === 'true';
}
