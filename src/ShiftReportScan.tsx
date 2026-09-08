import { useEffect, useRef, useState } from "react";
import {captureQualityWarnings,type CaptureQuality} from "./imports/captureQuality.ts";
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
  muted: "Same document camera as receipts — drafts Confirm only. Invents nothing and never posts money. Image quality is checked before capture; an explicit override keeps its warnings.",
};

export function ShiftReportScanBar({
  busy,
  scanBusy,
  error,
  warnings=[],
  onFile,
  provider,
  onProviderChange,
}: {
  busy: boolean;
  scanBusy: boolean;
  error: string;
  warnings?:string[];
  onFile: (file: File | undefined, quality?:CaptureQuality) => void;
  /** Optional controlled provider; defaults to device preference. */
  provider?: DocumentVisionProvider;
  onProviderChange?: (provider: DocumentVisionProvider) => void;
}) {
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [localProvider, setLocalProvider] = useState<DocumentVisionProvider>(() => loadDocumentVisionProvider());
  const [clarityError, setClarityError] = useState("");
  const blocked = busy || scanBusy;
  const fileGeneration=useRef(0),mounted=useRef(true),blockedRef=useRef(blocked);blockedRef.current=blocked;
  const [rejectedFile,setRejectedFile]=useState<{file:File;quality:CaptureQuality}|null>(null),[fileRejections,setFileRejections]=useState(0);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;fileGeneration.current++;};},[]);
  const activeProvider = provider ?? localProvider;

  useEffect(() => {
    if (provider) setLocalProvider(provider);
  }, [provider]);

  function setProvider(next: DocumentVisionProvider) {
    fileGeneration.current++;setRejectedFile(null);setFileRejections(0);
    const saved = saveDocumentVisionProvider(next);
    setLocalProvider(saved);
    onProviderChange?.(saved);
  }

  async function acceptFile(file: File | undefined) {
    const generation=++fileGeneration.current;setClarityError("");setRejectedFile(null);
    if(!file||blockedRef.current)return;
    const current=()=>mounted.current&&generation===fileGeneration.current&&!blockedRef.current;
    try {const clarity=await scoreDocumentClarityFromFile(file);if(!current())return;
      if(!clarity.ready){const quality={overridden:true,issues:clarity.issues.length?[...clarity.issues]:['The photo could not be checked for clarity.']};setFileRejections(n=>n+1);setRejectedFile({file,quality});setClarityError(quality.issues.join(' '));return;}
    } catch {if(current()){onFile(file,{overridden:false,issues:['The photo quality could not be checked.']});return;}}
    if(current()){setFileRejections(0);onFile(file);}
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
            fileGeneration.current++;setRejectedFile(null);setFileRejections(0);setClarityError("");
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
        onCapture={(file,quality) => {
          if(!mounted.current||blockedRef.current)return;
          fileGeneration.current++;setRejectedFile(null);setFileRejections(0);setClarityError("");
          onFile(file,quality);
        }}
      />
      <p className="muted">{SHIFT_REPORT_SCAN_COPY.muted}</p>
      {fileRejections>=2&&rejectedFile&&<button type="button" className="chip" disabled={blocked} onClick={()=>{if(!mounted.current||blockedRef.current)return;const saved=rejectedFile;fileGeneration.current++;setRejectedFile(null);setFileRejections(0);setClarityError(captureQualityWarnings(saved.quality).join(' '));onFile(saved.file,saved.quality);}}>Use this photo anyway</button>}
      {clarityError ? <p className="error" role="alert">{clarityError}</p> : null}
      {error ? <div role="alert"><p className="error">{error}</p>{warnings.length>0&&<ul className="doc-camera-issues">{warnings.map((warning,index)=><li key={`${index}:${warning}`}>{warning}</li>)}</ul>}</div> : null}
    </div>
  );
}
