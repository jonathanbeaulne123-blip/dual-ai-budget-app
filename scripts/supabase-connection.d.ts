export const PROJECT_REF: string;
export const POOLER_HOST: string;
export const DIRECT_HOST: string;
export const SQL_EDITOR: string;
export function decodePassword(raw: string | undefined): string;
export function isPlaceholderPassword(password: string | undefined): boolean;
export function placeholderError(): string;
export function resolveApplyUrl(env?: NodeJS.Dict<string>): string;
