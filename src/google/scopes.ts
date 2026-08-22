import { GOOGLE_SERVICES, uniqueGoogleServices, type GoogleService } from "../core/google.ts";

export type { GoogleService };

export const IDENTITY_GOOGLE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export const CALENDAR_GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];

export const GOOGLE_SERVICE_SCOPES: Record<GoogleService, string[]> = {
  identity: IDENTITY_GOOGLE_SCOPES,
  calendar: CALENDAR_GOOGLE_SCOPES,
  drive: [
    "https://www.googleapis.com/auth/drive.file",
  ],
  contacts: [
    "https://www.googleapis.com/auth/contacts.readonly",
  ],
  gmail: [
    "https://www.googleapis.com/auth/gmail.readonly",
  ],
  sheets: [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
  ],
};

function scopesForService(service: GoogleService): string[] {
  return GOOGLE_SERVICE_SCOPES[service] ?? [];
}

export function scopesForServices(services: Iterable<string>): string[] {
  const unique = uniqueGoogleServices(services);
  const scopes = new Set<string>();
  for (const service of unique) {
    for (const scope of scopesForService(service)) scopes.add(scope);
  }
  return [...scopes];
}

export function scopeString(services: Iterable<string>): string {
  return scopesForServices(services).join(" ");
}

export function parseGrantedScopes(value: string | undefined, requested: string[]): string[] {
  const granted = (value ?? "")
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  if (granted.length) return [...new Set(granted)];
  return [...requested];
}

export function servicesFromScopes(granted: Iterable<string>): GoogleService[] {
  const have = new Set([...granted]);
  return GOOGLE_SERVICES.filter((service) => scopesForService(service).every((scope) => have.has(scope)));
}
