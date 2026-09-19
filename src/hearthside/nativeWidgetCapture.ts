import {decodeNestAppearance,type NestAppearance} from './nestDesignBinding.ts';
import type {KittyPieceV1} from '../core/types.ts';
import {shapeKittyPiece} from '../core/kittyStudio.ts';
import type {NativeWidgetSelection} from './nativeWidget.ts';
/** Render the immutable authored piece once. No backing, target, animation, or household fields enter this API. */
export async function captureNativeWidget(selection:{designId:string;revision:number;piece:KittyPieceV1;appearance?:NestAppearance},signal:AbortSignal):Promise<NativeWidgetSelection>{
 const piece=shapeKittyPiece(structuredClone(selection.piece)),identity={designId:selection.designId,revision:selection.revision,pieceId:selection.piece.id};
 if(!identity.designId||!Number.isSafeInteger(identity.revision)||identity.revision<0||piece.id!==identity.pieceId)throw new Error('Choose an immutable sculpture revision.');
 const [T,{createKittySculpture}]=await Promise.all([import('three'),import('../kitty/sculpture.ts')]);signal.throwIfAborted();
 const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
 let sculpture:ReturnType<typeof createKittySculpture>|undefined;
 try{
  renderer.setPixelRatio(1);renderer.setSize(384,384);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
  sculpture=createKittySculpture(piece,{brass:'#bda375',wood:'#62412b',fired:Boolean(piece.firedAt),reducedMotion:true,ornament:selection.appearance?decodeNestAppearance(selection.appearance):undefined});
  sculpture.group.rotation.y=-0.22;sculpture.group.updateMatrixWorld(true);
  const scene=new T.Scene();scene.add(sculpture.group);scene.add(new T.HemisphereLight('#fff1d9','#77767c',2));const light=new T.DirectionalLight('#fff1d9',3);light.position.set(-3,5,4);scene.add(light);
  const box=new T.Box3().setFromObject(sculpture.group),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3()),extent=Math.max(size.x,size.y,size.z)*0.7;
  const camera=new T.OrthographicCamera(-extent,extent,extent,-extent,0.01,100);camera.position.copy(center).add(new T.Vector3(0.2,0.5,8));camera.lookAt(center);
  signal.throwIfAborted();renderer.render(scene,camera);const pngBase64=renderer.domElement.toDataURL('image/png').split(',')[1];if(!pngBase64)throw new Error('The sculpture image could not be captured.');signal.throwIfAborted();
  return{version:1,...identity,pngBase64};
 }finally{sculpture?.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}
}
