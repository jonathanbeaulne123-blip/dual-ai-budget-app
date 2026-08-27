export type DocumentClarityScore = {
  sharp: number;
  contrast: number;
  brightness: number;
  textiness: number;
  /** Composite 0–100 used by the live meter. */
  score: number;
  ready: boolean;
  reason: string;
  issues: string[];
};

/** Capture is unlocked at or above this composite score. */
export const CLARITY_READY_SCORE = 72;

/** Laplacian-ish variance of grayscale luminance — higher means sharper. */
export function sharpnessFromGray(gray: Float32Array, width: number, height: number): number {
  if (width < 3 || height < 3 || gray.length < width * height) return 0;
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const lap =
        gray[i - width]! + gray[i - 1]! + gray[i + 1]! + gray[i + width]! - 4 * gray[i]!;
      sum += lap;
      sumSq += lap * lap;
      count += 1;
    }
  }
  if (!count) return 0;
  const mean = sum / count;
  return Math.max(0, sumSq / count - mean * mean);
}

export function statsFromGray(gray: Float32Array): { mean: number; std: number; textiness: number } {
  if (!gray.length) return { mean: 0, std: 0, textiness: 0 };
  let sum = 0;
  for (let i = 0; i < gray.length; i += 1) sum += gray[i]!;
  const mean = sum / gray.length;
  let sumSq = 0;
  let edges = 0;
  for (let i = 0; i < gray.length; i += 1) {
    const d = gray[i]! - mean;
    sumSq += d * d;
    if (i > 0 && Math.abs(gray[i]! - gray[i - 1]!) > 28) edges += 1;
  }
  const std = Math.sqrt(sumSq / gray.length);
  const textiness = edges / gray.length;
  return { mean, std, textiness };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** Map raw metrics into a 0–100 readiness meter (QR-scanner style). */
export function compositeClarityScore(input: {
  sharp: number;
  contrast: number;
  brightness: number;
  textiness: number;
}): number {
  const sharpPart = clamp01(input.sharp / 90);
  const contrastPart = clamp01(input.contrast / 55);
  const textPart = clamp01(input.textiness / 0.08);
  const brightPenalty =
    input.brightness < 45
      ? clamp01((45 - input.brightness) / 45)
      : input.brightness > 230
        ? clamp01((input.brightness - 230) / 25)
        : 0;
  const raw = 0.42 * sharpPart + 0.28 * contrastPart + 0.3 * textPart;
  return Math.round(Math.max(0, Math.min(100, (raw * (1 - 0.55 * brightPenalty)) * 100)));
}

export function scoreDocumentClarity(input: {
  sharp: number;
  contrast: number;
  brightness: number;
  textiness: number;
}): DocumentClarityScore {
  const { sharp, contrast, brightness, textiness } = input;
  const issues: string[] = [];
  if (brightness < 45) issues.push("Too dark — add light or move nearer a lamp.");
  if (brightness > 230) issues.push("Too bright — tilt away from glare.");
  if (contrast < 22) issues.push("Low contrast — flatten the slip and avoid shadows.");
  if (sharp < 28) issues.push("Blurry — hold still until the print looks crisp.");
  if (textiness < 0.035) issues.push("Can't read print yet — fill more of the frame with the tip sheet.");

  const score = compositeClarityScore(input);
  const ready = issues.length === 0 && score >= CLARITY_READY_SCORE;
  const reason = ready
    ? "Clear enough — tap Capture."
    : issues[0] || "Hold the tip sheet steady in the frame.";

  return { sharp, contrast, brightness, textiness, score, ready, reason, issues };
}

/** Sample ImageData (already RGBA) into a downscaled grayscale buffer for scoring. */
export function grayFromImageData(image: ImageData, maxEdge = 320): {
  gray: Float32Array;
  width: number;
  height: number;
} {
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const gray = new Float32Array(width * height);
  const { data } = image;
  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(image.height - 1, Math.floor(y / scale));
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(image.width - 1, Math.floor(x / scale));
      const i = (sy * image.width + sx) * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      gray[y * width + x] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }
  return { gray, width, height };
}

export function scoreImageData(image: ImageData): DocumentClarityScore {
  const { gray, width, height } = grayFromImageData(image);
  const sharp = sharpnessFromGray(gray, width, height);
  const { mean, std, textiness } = statsFromGray(gray);
  return scoreDocumentClarity({
    sharp,
    contrast: std,
    brightness: mean,
    textiness,
  });
}

/**
 * Draw a live video frame (or still) onto `canvas`, then score legibility.
 * Capture stays locked until `ready` — same idea as a QR scanner waiting for focus.
 */
export function scoreDocumentFrame(
  source: CanvasImageSource,
  canvas: HTMLCanvasElement,
  options?: { sampleWidth?: number },
): DocumentClarityScore {
  const sampleWidth = Math.max(160, Math.min(480, options?.sampleWidth ?? 320));
  let sourceWidth = sampleWidth;
  let sourceHeight = Math.round(sampleWidth * 0.75);
  if (source instanceof HTMLVideoElement) {
    sourceWidth = source.videoWidth || sourceWidth;
    sourceHeight = source.videoHeight || sourceHeight;
  } else if (source instanceof HTMLImageElement) {
    sourceWidth = source.naturalWidth || source.width || sourceWidth;
    sourceHeight = source.naturalHeight || source.height || sourceHeight;
  } else if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
    sourceWidth = source.width;
    sourceHeight = source.height;
  }
  if (sourceWidth < 8 || sourceHeight < 8) {
    return scoreDocumentClarity({ sharp: 0, contrast: 0, brightness: 0, textiness: 0 });
  }
  const scale = sampleWidth / sourceWidth;
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return scoreDocumentClarity({ sharp: 0, contrast: 0, brightness: 0, textiness: 0 });
  }
  ctx.drawImage(source, 0, 0, width, height);
  return scoreImageData(ctx.getImageData(0, 0, width, height));
}

export async function scoreDocumentClarityFromFile(file: File): Promise<DocumentClarityScore> {
  if (typeof createImageBitmap !== "function") {
    // Without bitmap APIs, do not block Choose-photo — live camera still gates.
    return scoreDocumentClarity({ sharp: 80, contrast: 40, brightness: 120, textiness: 0.08 });
  }
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    return scoreDocumentFrame(bitmap, canvas, { sampleWidth: 320 });
  } finally {
    bitmap.close();
  }
}
