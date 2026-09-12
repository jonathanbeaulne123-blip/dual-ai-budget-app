import {NestProp} from '../kitty/NestProp.tsx';
import {guestMotifRenderRecipe,type GuestNestOrnament} from './nestGuestAppearance.ts';
export function NestGuestOrnament({ornament}:{ornament:GuestNestOrnament}){return <NestProp ornament={guestMotifRenderRecipe(ornament)}/>;}
