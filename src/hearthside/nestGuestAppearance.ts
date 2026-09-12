import {designAssert,designRecord} from './designContracts.ts';
import {nestMotif,type NestOrnament} from '../kitty/nestAppearance.ts';
import {decodeNestAppearance,type NestAppearance} from './nestDesignBinding.ts';
/** Published decoration contains a visual motif only. No bank tier, category, scope or source identity. */
export const GUEST_NEST_MOTIFS=['crown','shield','cup','sprout','clock','star','flower','guitar','sun','lighthouse','rowhouse','sailboat','lifering','none'] as const;
export type GuestNestOrnament={version:1;motif:typeof GUEST_NEST_MOTIFS[number]};
export function decodeGuestNestOrnament(raw:unknown):GuestNestOrnament{
 designRecord(raw,['version','motif']);designAssert(raw.version===1&&GUEST_NEST_MOTIFS.includes(raw.motif as GuestNestOrnament['motif']),'GUEST_INVALID','Choose an approved decorative motif.');return {version:1,motif:raw.motif as GuestNestOrnament['motif']};
}
export function guestNestOrnament(appearance:NestAppearance):GuestNestOrnament{return decodeGuestNestOrnament({version:1,motif:nestMotif(decodeNestAppearance(appearance))});}
/** This adapter is a local rendering recipe, never a source catalogue or published bank relation. */
export function guestMotifRenderRecipe(raw:GuestNestOrnament):NestOrnament{
 const {motif}=decodeGuestNestOrnament(raw);if(motif==='crown')return {tier:'king',category:null,theme:'classic'};if(motif==='none')return {tier:'bill',category:null,theme:'classic'};
 const themes=['classic','taylor','newfoundland'],categories=['protect','everyday','build','prepare'] as const;
 for(const theme of themes)for(const category of categories){const recipe={tier:'plan' as const,category,theme};if(nestMotif(recipe)===motif)return recipe;}
 throw Error('GUEST_INVALID');
}
