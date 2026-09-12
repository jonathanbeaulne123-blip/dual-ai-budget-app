import { nestMotif, type NestOrnament } from "./nestAppearance.ts";
export function NestProp({ ornament }: { ornament: NestOrnament }) {
  const motif = nestMotif(ornament);
  if (motif === "none") return null;
  const star = "M50 7L60 34L89 35L66 54L73 82L50 66L26 82L34 54L11 35L40 34Z";
  return <svg className={`nest-prop nest-prop--${motif}`} viewBox="0 0 100 100" aria-hidden="true" data-motif={motif} fill="currentColor" stroke="currentColor" strokeWidth="5" strokeLinejoin="round">
    {motif === "crown" ? <path d="M15 76L8 27L32 43L50 13L69 43L91 27L84 76ZM16 85H83" />
      : motif === "shield" ? <path d="M16 20L50 9L85 20V50Q79 75 50 91Q20 75 16 50ZM31 47L45 62L71 33" />
      : motif === "cup" ? <><path d="M15 30H66V72Q41 88 15 72Z"/><path d="M68 39Q96 35 92 54Q90 72 68 65" fill="none"/></>
      : motif === "sprout" ? <><path d="M49 86V35" fill="none"/><path d="M49 53Q13 62 10 26Q46 25 49 53ZM50 41Q54 8 88 14Q85 50 50 41Z"/></>
      : motif === "clock" || motif === "sun" ? <><circle cx="50" cy="50" r="33" fill="none"/>{motif === "clock" ? <path d="M50 25V51L70 64" fill="none"/> : <path d="M50 1V10M50 90V99M1 50H10M90 50H99M15 15L22 22M78 78L85 85M15 85L22 78M78 22L85 15" fill="none"/>}</>
      : motif === "star" ? <path d={star}/>
      : motif === "flower" ? <>{[0,72,144,216,288].map(a=><ellipse key={a} cx="50" cy="27" rx="14" ry="23" transform={`rotate(${a} 50 50)`}/>)}<circle cx="50" cy="50" r="12" fill="#eed299"/></>
      : motif === "guitar" ? <><path d="M34 45Q11 40 15 68Q9 91 38 88Q67 80 51 56L77 14L66 8L41 48Z"/><circle cx="36" cy="65" r="8" fill="#40301c"/></>
      : motif === "lighthouse" ? <><path d="M30 87L36 30H65L72 87ZM30 22L50 6L70 22Z"/><path d="M37 47H64M34 65H69" stroke="#faf4dc"/></>
      : motif === "rowhouse" ? <><path d="M12 40L50 9L87 40V89H12Z"/><path d="M27 49H39V61H27ZM61 49H73V61H61ZM45 69H57V89H45Z" fill="#fff3d8"/></>
      : motif === "sailboat" ? <><path d="M13 71H89L75 89H29ZM51 10V64H17ZM58 25V63H83Z"/></>
      : <><circle cx="50" cy="50" r="33" fill="none" strokeWidth="18"/><path d="M25 25L33 33M67 67L75 75M25 75L33 67M67 33L75 25" stroke="#fff3d8" strokeWidth="16"/></>}
  </svg>;
}
