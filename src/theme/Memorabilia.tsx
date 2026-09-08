import { MEMORABILIA } from "./memorabilia.ts";

/** Prepared public artwork only: no upload, management UI, or household data access. */
export function Memorabilia({ scene }: { scene: string }) {
  const assets = MEMORABILIA.filter(asset => asset.scenes.includes(scene) && asset.placement === "keepsake" && asset.status === "prepared" && asset.src);
  if (!assets.length) return null;
  return <aside className="theme-memorabilia" aria-label="Our concert keepsakes">{assets.map(asset => <figure key={asset.id} data-keepsake={asset.id === "concert-ticket" ? "ticket" : "portrait"} data-asset={asset.id}><img src={asset.src!} alt={asset.alt} width={asset.width} height={asset.height} loading="lazy" decoding="async" /></figure>)}</aside>;
}
