/** An opaque, per-tab identity lets image capture reject every other selected tab. */
const tabHandle = `hearth-inspector-${crypto.randomUUID()}`;
let ready = false;

type CaptureHandle = { handle: string; origin?: string } | null;
type HandleMediaDevices = MediaDevices & {
  setCaptureHandleConfig?: (config: { handle: string; exposeOrigin: boolean; permittedOrigins: string[] }) => void;
};
type HandleTrack = MediaStreamTrack & { getCaptureHandle?: () => CaptureHandle };

export function registerCaptureIdentity() {
  const media = navigator.mediaDevices as HandleMediaDevices | undefined;
  if (!media?.setCaptureHandleConfig || window.top !== window) return false;
  try {
    media.setCaptureHandleConfig({ handle: tabHandle, exposeOrigin: true, permittedOrigins: [location.origin] });
    ready = true;
    return true;
  } catch {
    return false;
  }
}

export function captureSourceMatches(surface: string | undefined, handle: CaptureHandle | undefined, expectedHandle: string, origin: string) {
  return surface === 'browser' && handle?.handle === expectedHandle && handle.origin === origin;
}

export function isCurrentHearthTab(track: MediaStreamTrack) {
  const candidate = track as HandleTrack;
  return ready && captureSourceMatches(track.getSettings().displaySurface, candidate.getCaptureHandle?.(), tabHandle, location.origin);
}

export function canVerifyCaptureTab() { return ready; }
