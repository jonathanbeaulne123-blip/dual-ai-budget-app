import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { KitchenNotice } from "./KitchenNotice.tsx";

type DetectedBarcode = { rawValue?: string };
type QrDetector = { detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> };
type QrDetectorConstructor = new (options?: { formats?: string[] }) => QrDetector;

function detectorConstructor(): QrDetectorConstructor | null {
  const candidate = (globalThis as typeof globalThis & { BarcodeDetector?: QrDetectorConstructor }).BarcodeDetector;
  return candidate ?? null;
}

/** Mobile-only join camera. QR content remains an ordinary invite URL/token. */
export function WelcomeQrScanner({
  busy,
  error,
  onDetected,
  onError,
  onBack,
}: {
  busy: boolean;
  error: string;
  onDetected: (value: string) => Promise<void>;
  onError: (message: string) => void;
  onBack: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const scanningRef = useRef(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [status, setStatus] = useState("Point the camera at a Hearth household QR code.");

  function stopCamera() {
    scanningRef.current = false;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
  }

  useEffect(() => stopCamera, []);

  async function openCamera() {
    onError("");
    const Detector = detectorConstructor();
    if (!navigator.mediaDevices?.getUserMedia) {
      onError("This browser cannot open the camera. Open your phone's Camera app, or open the invite link you received.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      setCameraOpen(true);
      setStatus("Looking for the household QR…");
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const video = videoRef.current;
      if (!video) throw new Error("The camera preview did not open.");
      video.srcObject = stream;
      await video.play();
      const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;
      const canvas = detector ? null : document.createElement("canvas");
      const context = canvas?.getContext("2d", { willReadFrequently: true }) ?? null;
      scanningRef.current = true;

      const scan = async () => {
        if (!scanningRef.current || !videoRef.current) return;
        try {
          let value = "";
          if (detector) {
            const codes = await detector.detect(videoRef.current);
            value = codes.find((code) => code.rawValue?.trim())?.rawValue?.trim() ?? "";
          } else if (canvas && context && videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const sourceWidth = videoRef.current.videoWidth;
            const sourceHeight = videoRef.current.videoHeight;
            if (sourceWidth > 0 && sourceHeight > 0) {
              const scale = Math.min(1, 960 / sourceWidth);
              canvas.width = Math.max(1, Math.round(sourceWidth * scale));
              canvas.height = Math.max(1, Math.round(sourceHeight * scale));
              context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
              value = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: "attemptBoth" })?.data.trim() ?? "";
            }
          }
          if (value) {
            setStatus("Household code found. Opening it…");
            stopCamera();
            await onDetected(value);
            return;
          }
        } catch {
          // A frame can be unreadable while the camera is settling. Keep scanning.
        }
        if (scanningRef.current) frameRef.current = requestAnimationFrame(() => void scan());
      };
      await scan();
    } catch (caught) {
      stopCamera();
      onError(caught instanceof Error
        ? `The camera could not open: ${caught.message}`
        : "The camera could not open. Check camera permission and try again.");
    }
  }

  return (
    <section className="welcome-qr">
      <h2>Join with QR code</h2>
      <p className="mobile-qr-action">{status}</p>
      <div className="mobile-qr-action">
        {cameraOpen && (
          <video
            ref={videoRef}
            className="welcome-qr__video"
            playsInline
            muted
            aria-label="Camera preview for household QR code"
          />
        )}
        {!cameraOpen ? (
          <button className="primary" type="button" disabled={busy} onClick={() => void openCamera()}>
            Open camera
          </button>
        ) : (
          <button className="ghost" type="button" disabled={busy} onClick={stopCamera}>
            Close camera
          </button>
        )}
      </div>
      <p className="desktop-qr-note">
        Camera joining is available on the mobile view. On your phone, open Hearth and choose
        <strong> Join with QR code</strong>. You can also scan with the phone's Camera app.
      </p>
      <KitchenNotice message={error} />
      <button className="ghost" type="button" disabled={busy} onClick={() => { stopCamera(); onBack(); }}>
        Back
      </button>
    </section>
  );
}
