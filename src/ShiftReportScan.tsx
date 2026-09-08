import { useEffect, useRef, useState } from "react";
import { DocumentCamera } from "./imports/DocumentCamera.tsx";
import { scoreDocumentClarityFromFile } from "./imports/documentClarity.ts";
import {
  DOCUMENT_VISION_PROVIDERS,
  loadDocumentVisionProvider,
  saveDocumentVisionProvider,
  type DocumentVisionProvider,
} from "./imports/documentScanProvider.ts";

export const SHIFT_REPORT_SCAN_COPY = {
  kicker: "Optional camera draft",
  take: "Take tip sheet photo",
  choose: "Choose tip sheet photo",
  scanning: "Scanning…",
  provider: "Vision provider",
  muted: "Same document camera as receipts — drafts Confirm only. Invents nothing and never posts money. Capture waits until the tip sheet looks clear.",
};

export function ShiftReportScanBar({
  busy,
  scanBusy,
  error,
  onFile,
  provider,
  onProviderChange,
}: {
  busy: boolean;
  scanBusy: boolean;
  error: string;
  onFile: (file: File | undefined) => void;
  /** Optional controlled provider; defaults to device preference. */
  provider?: DocumentVisionProvider;
  onProviderChange?: (provider: DocumentVisionProvider) => void;
}) {
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [localProvider, setLocalProvider] = useState<DocumentVisionProvider>(() => loadDocumentVisionProvider());
  const [clarityError, setClarityError] = useState("");
  const blocked = busy || scanBusy;
  const activeProvider = provider ?? localProvider;

  useEffect(() => {
    if (provider) setLocalProvider(provider);
  }, [provider]);

  function setProvider(next: DocumentVisionProvider) {
    const saved = saveDocumentVisionProvider(next);
    setLocalProvider(saved);
    onProviderChange?.(saved);
  }

  async function acceptFile(file: File | undefined) {
    setClarityError("");
    if (!file) {
      onFile(undefined);
      return;
    }
    try {
      const clarity = await scoreDocumentClarityFromFile(file);
      if (!clarity.ready) {
        setClarityError(
          clarity.issues[0]
            || "That photo is not clear enough to read. Retake with the tip sheet sharp and filling the frame."
        );
        return;
      }
    } catch {
      // If scoring fails, still allow Choose-photo (live camera remains gated).
    }
    onFile(file);
  }

  return (
    <div className="work-shift-scan">
      <p className="kicker">{SHIFT_REPORT_SCAN_COPY.kicker}</p>
      <div className="work-shift-scan-provider">
        <span className="muted tiny">{SHIFT_REPORT_SCAN_COPY.provider}</span>
        <div className="chips" role="radiogroup" aria-label={SHIFT_REPORT_SCAN_COPY.provider}>
          {DOCUMENT_VISION_PROVIDERS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={activeProvider === option.id}
              className={`chip${activeProvider === option.id ? " selected" : ""}`}
              disabled={blocked}
              title={option.hint}
              onClick={() => setProvider(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="muted tiny">
          {DOCUMENT_VISION_PROVIDERS.find((row) => row.id === activeProvider)?.hint}
        </p>
      </div>
      <div className="import-actions">
        <button
          type="button"
          className="chip"
          disabled={blocked}
          onClick={() => {
            setClarityError("");
            setCameraOpen(true);
          }}
        >
          {scanBusy ? SHIFT_REPORT_SCAN_COPY.scanning : SHIFT_REPORT_SCAN_COPY.take}
        </button>
        <button
          type="button"
          className="chip"
          disabled={blocked}
          onClick={() => uploadRef.current?.click()}
        >
          {SHIFT_REPORT_SCAN_COPY.choose}
        </button>
      </div>
      <input
        ref={uploadRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void acceptFile(file);
        }}
      />
      <DocumentCamera
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => {
          setClarityError("");
          onFile(file);
        }}
      />
      <p className="muted">{SHIFT_REPORT_SCAN_COPY.muted}</p>
      {clarityError ? <p className="error" role="alert">{clarityError}</p> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
    </div>
  );
}
