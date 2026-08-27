import { useRef } from "react";

export const SHIFT_REPORT_SCAN_COPY = {
  kicker: "Optional camera draft",
  take: "Take shift-report photo",
  choose: "Choose tip sheet photo",
  scanning: "Scanning…",
  muted: "Same document camera as receipts — drafts Confirm only. Invents nothing and never posts money.",
};

export function ShiftReportScanBar({
  busy,
  scanBusy,
  error,
  onFile,
}: {
  busy: boolean;
  scanBusy: boolean;
  error: string;
  onFile: (file: File | undefined) => void;
}) {
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const blocked = busy || scanBusy;

  return (
    <div className="work-shift-scan">
      <p className="kicker">{SHIFT_REPORT_SCAN_COPY.kicker}</p>
      <div className="import-actions">
        <button
          type="button"
          className="chip"
          disabled={blocked}
          onClick={() => cameraRef.current?.click()}
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
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          onFile(file);
        }}
      />
      <input
        ref={uploadRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          onFile(file);
        }}
      />
      <p className="muted">{SHIFT_REPORT_SCAN_COPY.muted}</p>
      {error ? <p className="error" role="alert">{error}</p> : null}
    </div>
  );
}
