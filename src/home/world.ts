import type {QueenStyle} from '../house/queenStyle.ts';
import type {BloomEvidence} from '../house/world/bloom.ts';
import type {QueenPlace} from '../harbour/court/queenPlace.ts';
import * as THREE from 'three';
import type {HomeDisplayContent} from './displays.ts';
import type {Reserve} from '../harbour/horizon/world/definition.ts';
import {buildHomeArt,homeGeography,type HomeArt} from './geometry.ts';
import {homeSite,homeLocal,homeWorld} from './site.ts';
import {blueprint} from './catalogue.ts';
import {contains,roomRect,FLOOR_HEIGHT,type HomeLayout} from './model.ts';
/** A resident layer on the surveyed Terraces plot, under the existing camera, light and input system. */
export function createHomeWorld(scene:THREE.Scene,reserves:readonly Reserve[],plotId?:string){
 let site=homeSite(reserves,plotId),layout:HomeLayout|undefined,near:HomeArt|null=null,far:HomeArt|null=null,physics:ReturnType<typeof homeGeography>|null=null;
 let queen:QueenPlace|null=null,botanicalAbort:AbortController|null=null,botanical:{style:QueenStyle;evidence:BloomEvidence[]}|null=null;
 const clearBotanical=()=>{botanicalAbort?.abort();botanicalAbort=null;queen?.dispose();queen?.group.removeFromParent();queen=null;};
 function grow(){clearBotanical();const room=layout?.rooms.find(r=>r.blueprintId==='conservatory'&&!r.stored);if(!room||!near||!botanical)return;const owner=near.group,controller=new AbortController();botanicalAbort=controller;void import('../harbour/court/queenPlace.ts').then(m=>m.loadQueenPlace('full',botanical!.style,botanical!.evidence,controller.signal)).then(q=>{if(controller.signal.aborted){q.dispose();return;}queen=q;q.group.position.set(room.x-roomRect(room).width/2+1.5,room.floor*FLOOR_HEIGHT,room.z-roomRect(room).depth/2+1.5);q.group.userData.floor=room.floor;owner.add(q.group);}).catch(()=>{/* Existing botanical records and the original Mandevilla remain intact if the asset is unavailable. */});}
 let shownDisplays:HomeDisplayContent[]=[],season:NonNullable<Parameters<typeof buildHomeArt>[1]>['season']='summer';
 let book:THREE.Mesh|null=null,bookGeo:THREE.BoxGeometry|null=null,bookMat:THREE.MeshStandardMaterial|null=null;
 const clear=()=>{clearBotanical();near?.dispose();far?.dispose();bookGeo?.dispose();bookMat?.dispose();near=far=null;book=null;physics=null;};
 function set(next:HomeLayout|undefined,displays:HomeDisplayContent[]=[],nextPlotId=plotId){clear();plotId=nextPlotId;site=homeSite(reserves,plotId);layout=next;shownDisplays=displays;if(!site||!next)return;
  near=buildHomeArt(next,{detail:'full',displays,season});far=buildHomeArt(next,{detail:'map',season});physics=homeGeography(next,site);
  for(const art of [near,far]){art.group.position.set(site.x,site.y,site.z);art.group.rotation.y=site.yaw;scene.add(art.group);}far.group.visible=false;
  bookGeo=new THREE.BoxGeometry(1.8,.9,.85);bookMat=new THREE.MeshStandardMaterial({color:'#987451',roughness:.9});book=new THREE.Mesh(bookGeo,bookMat);book.position.set(-3,.45,12.5);book.name='Terraces drafting table';near.group.add(book);grow();
 }
 const collision={surface:(x:number,z:number,y?:number,step?:number)=>physics?.surface(x,z,y,step)??null,ceiling:(x:number,z:number,y:number)=>physics?.ceiling(x,z,y)??Infinity,contact:(x:number,z:number,y:number,radius?:number)=>physics?.contact(x,z,y,radius)??null};
 function roomAt(body:{x:number;y:number;z:number}){if(!site||!layout)return null;const p=homeLocal(site,body.x,body.z),floor=Math.round((body.y-site.y)/FLOOR_HEIGHT);return layout.rooms.find(r=>!r.stored&&r.floor===floor&&contains(roomRect(r),{...p,width:0,depth:0}))??null;}
 function actions(body:{x:number;y:number;z:number}){if(!site||!layout)return[];const p=homeLocal(site,body.x,body.z),r=roomAt(body),result:{id:string;label:string;target?:string}[]=[];
  if(Math.hypot(p.x+3,p.z-12.5)<3&&Math.abs(body.y-site.y)<1)result.push({id:'home-book',label:'Open the drafting table'});
  if(r){const target=blueprint(r.blueprintId).workspace;if(target)result.push({id:'home-workspace:'+r.id,label:'Open '+r.name+' workspace',target});}
  return result;
 }
 return{set,setBotanical(style:QueenStyle,evidence:BloomEvidence[]){botanical={style,evidence};grow();},collision,get site(){return site;},setSeason(next:typeof season){if(next===season)return;season=next;set(layout,shownDisplays);},roomAt,actions,visit:()=>site&&layout?{...homeWorld(site,0,15),yaw:site.yaw+Math.PI}:null,
 update(body:{x:number;y:number;z:number},mode:string,firstPerson=false){if(!site||!near||!far)return;const distance=Math.hypot(body.x-site.x,body.z-site.z),close=mode!=='journey'&&distance<120;near.group.visible=close;far.group.visible=!close;const r=roomAt(body);near.cutaway(r?r.floor:null,!firstPerson);},dispose:clear};
}
