import type {CSSProperties} from 'react';
import {FITTING_ITEMS,fittingColour} from './catalogue.ts';
import {pieceDrawing} from './glyphs.ts';
export function PieceGlyph({itemId,variantId,size=80}:{itemId:string;variantId?:string;size?:number}){
 const item=FITTING_ITEMS.find(p=>p.id===itemId);if(!item)return <span>Unavailable piece</span>;
 return <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{'--piece':fittingColour(variantId??item.variants[0]!,itemId)} as CSSProperties}><g fill="var(--piece)" stroke="#514537" strokeWidth="1.8" strokeLinejoin="round" dangerouslySetInnerHTML={{__html:pieceDrawing(item.shape)}}/></svg>;
}
