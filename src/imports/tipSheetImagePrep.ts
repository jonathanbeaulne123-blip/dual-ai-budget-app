/**
 * Tip-sheet image prep for Shift camera drafts.
 * Vision providers here accept JPEG/PNG/WebP only — wrapping as PDF does not help.
 * Mild contrast stretch + higher-quality JPEG preserves dense Toast columns better
 * than a second aggressive downscale.
 */

export const TIP_SHEET_MAX_EDGE_PX = 2200;
export const TIP_SHEET_JPEG_QUALITY = 0.92;

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("Could not prepare that tip sheet photo."));
      else resolve(blob);
    }, "image/jpeg", quality);
  });
}

/** Stretch luminance toward fuller black/white without inventing text. */
export function contrastStretchImageData(image: ImageData, percentile = 0.02): ImageData {
  const { data, width, height } = image;
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    const y = Math.round(0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0));
    hist[Math.max(0, Math.min(255, y))]! += 1;
  }
  const total = width * height;
  const lowCount = Math.max(1, Math.floor(total * percentile));
  const highCount = Math.max(1, Math.floor(total * percentile));
  let seen = 0;
  let low = 0;
  for (let i = 0; i < 256; i += 1) {
    seen += hist[i]!;
    if (seen >= lowCount) {
      low = i;
      break;
    }
  }
  seen = 0;
  let high = 255;
  for (let i = 255; i >= 0; i -= 1) {
    seen += hist[i]!;
    if (seen >= highCount) {
      high = i;
      break;
    }
  }
  if (high <= low + 8) return image;
  const scale = 255 / (high - low);
  const outData = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const stretch = (channel: number) => Math.max(0, Math.min(255, Math.round((channel - low) * scale)));
    outData[i] = stretch(data[i] ?? 0);
    outData[i + 1] = stretch(data[i + 1] ?? 0);
    outData[i + 2] = stretch(data[i + 2] ?? 0);
    outData[i + 3] = data[i + 3] ?? 255;
  }
  if (typeof ImageData === "function") {
    try {
      return new ImageData(outData, width, height);
    } catch {
      // fall through
    }
  }
  return { data: outData, width, height, colorSpace: image.colorSpace ?? "srgb" } as ImageData;
}

/**
 * Reformat a tip-sheet photo for vision OCR: keep resolution high, stretch contrast,
 * encode once as JPEG. Returns original bytes when canvas APIs are unavailable.
 */
export async function prepareTipSheetImage(file: File): Promise<{ bytes: Uint8Array; mimeType: string; fileName: string }> {
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
    const scale = longest > TIP_SHEET_MAX_EDGE_PX ? TIP_SHEET_MAX_EDGE_PX / longest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      return { bytes, mimeType: file.type, fileName: file.name.slice(0, 160) };
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    try {
      const raw = context.getImageData(0, 0, width, height);
      context.putImageData(contrastStretchImageData(raw), 0, 0);
    } catch {
      // Cross-origin or memory limits — keep the drawn frame.
    }
    const blob = await canvasToJpegBlob(canvas, TIP_SHEET_JPEG_QUALITY);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const base = file.name.replace(/\.[^.]+$/, "") || "tip-sheet";
    return { bytes, mimeType: "image/jpeg", fileName: `${base.slice(0, 140)}.jpg` };
  } finally {
    bitmap.close();
  }
}
