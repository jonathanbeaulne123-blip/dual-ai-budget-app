import { useId, useState } from "react";
import { EraBracelet } from "./PageWorld.tsx";
import { FriendshipBracelets } from "./SceneArtwork.tsx";

const PAGES = [
  { title: "The nights we’ll remember", caption: "A place for Bianca’s favourite concert photographs.", tone: "concert" },
  { title: "The little things", caption: "The bracelets, the sparkle, the things worth keeping.", tone: "keepsakes" },
  { title: "A life, collected", caption: "Room for the everyday moments, too.", tone: "everyday" },
] as const;

/** A local, manual album. Illustrations are labelled; no photos or album data are uploaded. */
export function Memorabilia({ scene }: { scene: string }) {
  const [page,setPage]=useState(0);
  const id=useId();
  if(scene!=="lover"&&scene!=="showgirl") return null;
  const spread=PAGES[page] ?? PAGES[0];
  return <section className="home-scrapbook" aria-label="Our scrapbook" aria-roledescription="carousel" data-scrapbook-scene={scene}>
    <header className="scrapbook-heading"><div><span className="scrapbook-eyebrow">Collected, with love</span><h2>Our scrapbook</h2></div><p>Illustrated placeholders · Bianca will choose the photographs</p></header>
    <div id={id} className="scrapbook-spread" data-spread={spread.tone} role="group" aria-roledescription="slide" aria-label={(page+1)+" of "+PAGES.length+": "+spread.title}>
      <div className="scrapbook-photo-page"><figure className="scrapbook-photo"><svg viewBox="0 0 440 310" role="img" aria-label="Illustrated photo placeholder, not a personal photograph">
        <rect width="440" height="310" fill={spread.tone==="everyday"?"#c7e1df":"#d9cde6"}/><circle cx="320" cy="77" r="46" fill="#fff0c0"/>
        {spread.tone==="concert"?<><path d="M65 255L167 62 211 255M233 255L279 62 392 255" fill="#fff1cf" opacity=".65"/><path d="M22 262Q120 214 220 254T439 241V310H0Z" fill="#88799d"/><path d="M196 249V194H259V249" fill="#fbdae7"/>{[58,99,145,287,335,388].map(x=><path key={x} d={"M"+x+" 281v-23m-8 11h16"} stroke="#fbdbe9" strokeWidth="4"/>)}</>:<><path d="M0 227Q91 151 217 230T440 215V310H0Z" fill="#8fb2a1"/><path d="M0 265Q180 215 440 270V310H0Z" fill="#abc8b7"/><path d="M161 231V151H268V231" fill="#fff5dd"/><path d="M147 154L214 100 282 154Z" fill="#c97683"/><rect x="201" y="189" width="26" height="42" fill="#7e9a9c"/></>}
      </svg><figcaption>Illustrated photo placeholder</figcaption></figure><span className="scrapbook-pencil">a favourite moment goes here</span></div>
      <div className="scrapbook-keepsake-page"><h3>{spread.title}</h3><p>{spread.caption}</p>
        {spread.tone==="keepsakes"?<><div className="scrapbook-sequins" role="img" aria-label="Original rose-pink sequin illustration inspired by Bianca’s dress"/><span className="scrapbook-pencil">a little of that sparkle</span><EraBracelet/></>:<><FriendshipBracelets/><div className="scrapbook-mini-photo" aria-label="Illustrated placeholder for another photograph"><span aria-hidden="true">♡</span><small>Photo to come</small></div></>}
      </div>
    </div>
    <nav className="scrapbook-navigation" aria-label="Scrapbook pages">
      <button type="button" aria-controls={id} aria-label="Previous scrapbook page" disabled={page===0} onClick={()=>setPage(p=>p-1)}>← <span>Previous</span></button>
      <span aria-live="polite" aria-atomic="true">Page {page+1} of {PAGES.length}</span>
      <button type="button" aria-controls={id} aria-label="Next scrapbook page" disabled={page===PAGES.length-1} onClick={()=>setPage(p=>p+1)}><span>Next</span> →</button>
    </nav>
  </section>;
}
