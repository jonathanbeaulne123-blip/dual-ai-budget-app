/** Original vector catalogue illustrations; shared item IDs with the GLB and 2D layers. */
import {writeFile} from 'node:fs/promises';
const output=new URL('../../public/hercules-wardrobe/',import.meta.url);
const pieces={
 'cozy-toque':`<path d="M28 66Q30 27 64 25Q98 27 100 66Z" fill="#7c8d72"/><path d="M38 61Q38 36 56 29M51 61L60 29M65 61V29M78 61L70 29M90 61Q90 38 75 29" fill="none" opacity=".4"/><rect x="25" y="62" width="78" height="13" rx="4" fill="#7c8d72"/><circle cx="64" cy="20" r="10" fill="#7c8d72"/>`,
 'cozy-sweater':`<path d="M42 22L28 28L13 46L28 62L36 53L36 90H92V53L100 62L115 46L100 28L86 22Q65 37 42 22Z" fill="#d4cbb7"/><path d="M42 23Q64 43 86 23M37 83H91M24 51L33 59M95 59L104 51" fill="none" stroke-width="4"/><path d="M49 38q-8 8 0 16t0 16t0 13M49 38q8 8 0 16t0 16t0 13M65 38v45M81 38q-8 8 0 16t0 16t0 13M81 38q8 8 0 16t0 16t0 13" fill="none" opacity=".6"/>`,
 'cozy-glasses':`<g fill="none" stroke="#b89a53" stroke-width="4"><circle cx="36" cy="54" r="23"/><circle cx="92" cy="54" r="23"/><path d="M59 52Q64 44 69 52M13 50L8 36M115 50L120 36"/></g>`,
};
for(const [id,body] of Object.entries(pieces))await writeFile(new URL(`${id}.svg`,output),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 108"><g stroke="#665b49" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>\n`);
