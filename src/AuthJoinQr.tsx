import { renderSVG } from "uqr";

/** Compact scannable QR for Auth join URLs (camera → browser → /join?invite=). */
export function AuthJoinQr({
  joinUrl,
  size = 192,
  label = "QR code to join this household",
}: {
  joinUrl: string;
  size?: number;
  label?: string;
}) {
  if (!joinUrl) return null;
  const svg = renderSVG(joinUrl, {
    ecc: "M",
    border: 2,
  });
  return (
    <div
      className="auth-invite-qr"
      role="img"
      aria-label={label}
      style={{ width: size, height: size, maxWidth: "100%" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
