export type DocumentVisionProvider = "auto" | "workers-ai" | "openai" | "anthropic";

export const DOCUMENT_VISION_PROVIDERS: Array<{ id: DocumentVisionProvider; label: string; hint: string }> = [
  { id: "auto", label: "Auto", hint: "Free Workers AI first; paid vision only if the slip is still unreadable" },
  { id: "workers-ai", label: "Workers AI", hint: "Free Cloudflare vision" },
  { id: "openai", label: "OpenAI", hint: "gpt-4o — costs ~$0.02–0.04 per scan; use when Auto is not enough" },
  { id: "anthropic", label: "Anthropic", hint: "Claude vision fallback (paid)" },
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
