import { MEMORABILIA, MEMORABILIA_PLACEHOLDERS } from "./memorabilia.ts";

/** Public artwork only. Fictional stand-ins never imply an actual ticket, outfit or attended show. */
export function Memorabilia({ scene, location = "page" }: { scene: string; location?: "page" | "phone-desk" }) {
  const assets = MEMORABILIA.filter(asset => asset.scenes.includes(scene) && (asset.placement === "keepsake" || asset.id === "concert-dress")).sort((a,b) => Number(b.id === "concert-ticket") - Number(a.id === "concert-ticket"));
  if (!assets.length) return null;
  return <aside className={`theme-memorabilia theme-memorabilia--${location}`} data-memorabilia-scene={scene} aria-label="Concert keepsake placements">
    <header className="keepsake-heading"><span>A little place for the memories</span>{assets.some(asset => asset.status !== "prepared" || !asset.src) && <small>Illustrated samples · your keepsakes will go here</small>}</header>
    <div className="keepsake-mounts">{assets.map(asset => {
      const prepared = asset.status === "prepared" && Boolean(asset.src);
      return <figure key={asset.id} data-keepsake={asset.id === "concert-ticket" ? "ticket" : asset.id === "concert-dress" ? "fabric" : "portrait"} data-asset={asset.id} data-placeholder={!prepared || undefined}>
        <img src={prepared ? asset.src! : MEMORABILIA_PLACEHOLDERS[asset.id]} alt={prepared ? asset.alt : `Illustrated placeholder for ${asset.id === "concert-ticket" ? "your concert ticket" : asset.id === "concert-dress" ? "the sparkle of your dress" : "your concert photograph"}`} width={asset.width} height={asset.height} loading="lazy" decoding="async" />
        <figcaption>{asset.id === "concert-ticket" ? "The ticket you kept" : asset.id === "concert-dress" ? "A little of that sparkle" : "That favourite moment"}</figcaption>
      </figure>;
    })}</div>
  </aside>;
}
