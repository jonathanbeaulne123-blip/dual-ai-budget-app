import { stableImportHash, type VisionDocumentResult } from "../core/index.ts";
import type { DocumentVisionProvider } from "./documentScanProvider.ts";
import { prepareTipSheetImage } from "./tipSheetImagePrep.ts";

export const DOCUMENT_SCAN_PATH = "/documents/scan";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** Phone camera originals routinely exceed what Workers AI accepts reliably. */
const MAX_SCAN_EDGE_PX = 2000;
const SCAN_JPEG_QUALITY = 0.88;

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

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("Could not compress that photo."));
      else resolve(blob);
    }, "image/jpeg", quality);
  });
}

/**
 * Downscale/re-encode camera photos before /documents/scan.
 * Keeps text readable while staying under Workers AI payload limits.
 */
export async function compressDocumentImage(file: File): Promise<{ bytes: Uint8Array; mimeType: string; fileName: string }> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return { bytes, mimeType: file.type, fileName: file.name.slice(0, 160) };
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return { bytes, mimeType: file.type, fileName: file.name.slice(0, 160) };
  }
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > MAX_SCAN_EDGE_PX ? MAX_SCAN_EDGE_PX / longest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      return { bytes, mimeType: file.type, fileName: file.name.slice(0, 160) };
    }
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvasToJpegBlob(canvas, SCAN_JPEG_QUALITY);
    if (blob.size <= 0 || blob.size >= file.size && scale === 1 && file.type === "image/jpeg") {
      const bytes = new Uint8Array(await file.arrayBuffer());
      return { bytes, mimeType: file.type, fileName: file.name.slice(0, 160) };
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const base = file.name.replace(/\.[^.]+$/, "") || "document";
    return { bytes, mimeType: "image/jpeg", fileName: `${base.slice(0, 140)}.jpg` };
  } finally {
    bitmap.close();
  }
}

export async function scanFinancialDocument(
  file: File,
  fetcher: typeof fetch = fetch,
  options?: {
    documentHint?: "shift-report" | "receipt" | "bill" | "bank-statement" | "credit-card-statement";
    /** `auto` omits the field so the Worker keeps its default attempt order. */
    provider?: DocumentVisionProvider;
    signal?: AbortSignal;
  },
): Promise<{ result: VisionDocumentResult; sourceHash: string; provider?: string }> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error("Use a JPEG, PNG, or WebP photo.");
  if (file.size <= 0) throw new Error("That image is empty.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("That image is larger than 10 MB. Crop it to the document and try again.");
  // Tip sheets: contrast + higher-quality JPEG. Receipts keep the smaller compress path.
  // PDF wrappers are not used — vision providers here only accept image data URLs.
  const compressed = options?.documentHint === "shift-report"
    ? await prepareTipSheetImage(file)
    : await compressDocumentImage(file);
  if (compressed.bytes.byteLength <= 0) throw new Error("That image is empty.");
  if (compressed.bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("That image is still larger than 10 MB after compression. Crop closer to the tip sheet and try again.");
  }
  const base64 = bytesToBase64(compressed.bytes);
  const sourceHash = await sourceDigest(compressed.mimeType, compressed.bytes, base64);
  const forcedProvider =
    options?.provider && options.provider !== "auto" ? options.provider : undefined;
  const payload = JSON.stringify({
    fileName: compressed.fileName,
    mimeType: compressed.mimeType,
    imageDataUrl: `data:${compressed.mimeType};base64,${base64}`,
    ...(options?.documentHint ? { documentHint: options.documentHint } : {}),
    ...(forcedProvider ? { provider: forcedProvider } : {}),
  });
  let response: Response;
  try {
    response = await fetcher(DOCUMENT_SCAN_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      signal: options?.signal,
    });
  } catch (caught) {
    throw new Error(caught instanceof Error ? caught.message : String(caught));
  }
  const type = response.headers.get("content-type") || "";
  if (!type.includes("json")) throw new Error(`Document detection returned ${response.status}.`);
  const data = await response.json() as { ok?: boolean; result?: VisionDocumentResult; provider?: string; error?: string };
  if (response.ok && data.ok && data.result) {
    return { result: data.result, sourceHash, provider: data.provider };
  }
  throw new Error(data.error || `Document detection returned ${response.status}.`);
}
