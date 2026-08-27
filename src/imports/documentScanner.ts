import { stableImportHash, type VisionDocumentResult } from "../core/index.ts";

export const DOCUMENT_SCAN_PATH = "/documents/scan";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

async function sourceDigest(fileType: string, bytes: Uint8Array, base64: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const copy = new Uint8Array(bytes);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", copy);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return stableImportHash(`${fileType}|${base64}`);
}

export async function scanFinancialDocument(
  file: File,
  fetcher: typeof fetch = fetch,
  options?: { documentHint?: "shift-report" | "receipt" | "bill" | "bank-statement" | "credit-card-statement" },
): Promise<{ result: VisionDocumentResult; sourceHash: string }> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error("Use a JPEG, PNG, or WebP photo.");
  if (file.size <= 0) throw new Error("That image is empty.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("That image is larger than 10 MB. Crop it to the document and try again.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const base64 = bytesToBase64(bytes);
  const sourceHash = await sourceDigest(file.type, bytes, base64);
  const payload = JSON.stringify({
    fileName: file.name.slice(0, 160),
    mimeType: file.type,
    imageDataUrl: `data:${file.type};base64,${base64}`,
    ...(options?.documentHint ? { documentHint: options.documentHint } : {}),
  });
  let response: Response;
  try {
    response = await fetcher(DOCUMENT_SCAN_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
  } catch (caught) {
    throw new Error(caught instanceof Error ? caught.message : String(caught));
  }
  const type = response.headers.get("content-type") || "";
  if (!type.includes("json")) throw new Error(`Document detection returned ${response.status}.`);
  const data = await response.json() as { ok?: boolean; result?: VisionDocumentResult; error?: string };
  if (response.ok && data.ok && data.result) return { result: data.result, sourceHash };
  throw new Error(data.error || `Document detection returned ${response.status}.`);
}
