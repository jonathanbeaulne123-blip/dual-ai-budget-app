export type DocumentVisionProvider = "auto" | "workers-ai" | "openai" | "anthropic";

export const DOCUMENT_VISION_PROVIDERS: Array<{ id: DocumentVisionProvider; label: string; hint: string }> = [
  { id: "auto", label: "Auto", hint: "Best available for tip sheets" },
  { id: "workers-ai", label: "Workers AI", hint: "Free Cloudflare vision" },
  { id: "openai", label: "OpenAI", hint: "gpt-4o — strongest for dense slips" },
  { id: "anthropic", label: "Anthropic", hint: "Claude vision fallback" },
];

const STORAGE_KEY = "hearth.documentVisionProvider.v1";

export function isDocumentVisionProvider(value: unknown): value is DocumentVisionProvider {
  return value === "auto" || value === "workers-ai" || value === "openai" || value === "anthropic";
}

export function loadDocumentVisionProvider(): DocumentVisionProvider {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (isDocumentVisionProvider(raw)) return raw;
  } catch {
    // ignore
  }
  return "auto";
}

export function saveDocumentVisionProvider(provider: DocumentVisionProvider): DocumentVisionProvider {
  const next = isDocumentVisionProvider(provider) ? provider : "auto";
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore
  }
  return next;
}
