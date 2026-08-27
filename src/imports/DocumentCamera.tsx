import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CLARITY_READY_SCORE,
  scoreDocumentFrame,
  type DocumentClarityScore,
} from "./documentClarity.ts";

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void | Promise<void>;
  title?: string;
};

function readinessLabel(score: DocumentClarityScore | null): string {
  if (!score) return "Hold tip sheet in frame";
  if (score.ready) return "Looks clear — tap Capture";
  if (score.issues[0]) return score.issues[0];
  return "Keep steady until the tip sheet is sharp";
}

export function DocumentCamera({
  open,
  onClose,
  onCapture,
  title = "Scan tip sheet",
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [score, setScore] = useState<DocumentClarityScore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const stopCamera = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) video.srcObject = null;
    setCameraReady(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setScore(null);
      setError(null);
      setCapturing(false);
      return;
    }

    let cancelled = false;
    async function start() {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser cannot open the camera. Use Choose tip sheet photo instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1600 },
            height: { ideal: 1200 },
          },
        });
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          setCameraReady(true);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not open camera.";
        setError(
          /permission|notallowed|denied/i.test(message)
            ? "Camera permission denied. Allow camera access, or use Choose tip sheet photo."
            : "Could not open camera. Use Choose tip sheet photo instead."
        );
      }
    }
    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, stopCamera]);

  useEffect(() => {
    if (!open || !cameraReady) return;
    let cancelled = false;
    let timer: number | null = null;

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        timer = window.setTimeout(tick, 350);
        return;
      }
      try {
        const next = scoreDocumentFrame(video, canvas, { sampleWidth: 320 });
        if (!cancelled) setScore(next);
      } catch {
        if (!cancelled) setScore(null);
      }
      if (!cancelled) {
        timer = window.setTimeout(tick, 320);
      }
    }

    timer = window.setTimeout(tick, 200);
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [open, cameraReady]);

  const canCapture = Boolean(score?.ready) && !capturing && cameraReady && !error;

  const handleCapture = useCallback(async () => {
    if (!canCapture) return;
    const video = videoRef.current;
    if (!video || video.videoWidth < 8 || video.videoHeight < 8) return;
    setCapturing(true);
    try {
      const canvas = document.createElement("canvas");
      const maxEdge = 1600;
      const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not capture frame.");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Could not encode photo."))),
          "image/jpeg",
          0.88
        );
      });
      const file = new File([blob], `tip-sheet-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      await onCapture(file);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Capture failed.");
    } finally {
      setCapturing(false);
    }
  }, [canCapture, onCapture, onClose]);

  const meterPct = useMemo(() => {
    if (!score) return 0;
    return Math.max(0, Math.min(100, Math.round((score.score / CLARITY_READY_SCORE) * 100)));
  }, [score]);

  if (!open) return null;

  return (
    <div className="doc-camera-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="doc-camera-sheet">
        <div className="doc-camera-top">
          <strong>{title}</strong>
          <button type="button" className="ghost" onClick={onClose} disabled={capturing}>
            Close
          </button>
        </div>
        <div className="doc-camera-stage">
          <video
            ref={videoRef}
            className="doc-camera-video"
            playsInline
            muted
            autoPlay
          />
          <canvas ref={canvasRef} className="doc-camera-sample" aria-hidden="true" />
          <div className={`doc-camera-frame${score?.ready ? " is-ready" : ""}`} />
        </div>
        <div className="doc-camera-meter" aria-hidden="true">
          <div
            className={`doc-camera-meter-fill${score?.ready ? " is-ready" : ""}`}
            style={{ width: `${meterPct}%` }}
          />
        </div>
        <p className={`doc-camera-hint${score?.ready ? " is-ready" : ""}`}>
          {error || readinessLabel(score)}
        </p>
        <div className="doc-camera-actions">
          <button
            type="button"
            className="primary"
            disabled={!canCapture}
            onClick={() => void handleCapture()}
          >
            {capturing ? "Capturing…" : score?.ready ? "Capture tip sheet" : "Waiting for clear tip sheet"}
          </button>
        </div>
        <p className="muted tiny">
          Capture stays locked until the tip sheet looks sharp and readable — like a QR scanner waiting for a clean code.
        </p>
      </div>
    </div>
  );
}
