import {NestProp} from '../kitty/NestProp.tsx';
import {decodeNestAppearance,type NestAppearance} from './nestDesignBinding.ts';
import {nestMotif} from '../kitty/nestAppearance.ts';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {KittyPieceV1} from '../core/types.ts';
import {KittyFlat} from '../kitty/studio/flat.tsx';
import {awaitProjector} from './projectorComposition.ts';

/** Rasterizes the shared flat renderer at an immutable authored shape; no backing scale enters. */
export async function paintedSnapshot(piece:KittyPieceV1,signal:AbortSignal,appearance?:NestAppearance):Promise<Blob>{
  const ornament=appearance?decodeNestAppearance(appearance):undefined,motif=ornament?nestMotif(ornament):'none',crown=motif==='crown';
  const cat=createElement(KittyFlat,{piece,step:0,title:'Our saved piece'});
  const markup=renderToStaticMarkup(!ornament||motif==='none'?cat:createElement('svg',{xmlns:'http://www.w3.org/2000/svg',viewBox:'0 0 300 390'},createElement('svg',{x:0,y:30,width:300,height:360},cat),createElement('svg',{x:crown?105:114,y:crown?8:199,width:crown?90:75,height:90,color:['lighthouse','rowhouse','sailboat','lifering'].includes(motif)?'#37717a':['shield','sprout'].includes(motif)?'#60734e':'#b18a42'},createElement(NestProp,{ornament}))));
  const svg=markup.includes('xmlns=')?markup:markup.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ');
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),image=new Image(),canvas=document.createElement('canvas');
  canvas.width=1024;canvas.height=1024;
  try{
    image.src=url;await awaitProjector(image.decode(),signal);if(signal.aborted)throw new DOMException('Cancelled','AbortError');
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('ARTWORK_RENDER_UNAVAILABLE');
    ctx.fillStyle='#f7efdf';ctx.fillRect(0,0,1024,1024);ctx.drawImage(image,0,0,1024,1024);
    return await awaitProjector(new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('ARTWORK_RENDER_UNAVAILABLE')),'image/png')),signal);
  }finally{image.src='';URL.revokeObjectURL(url);canvas.width=0;canvas.height=0;}
}
