import { describe,expect,it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoomScene,roomObjectPosition,type RoomSceneObject,type RoomSceneRoom } from '../src/hearthside/RoomScene.tsx';
const object:RoomSceneObject={id:'actual-1',kind:'note',label:'A real shared note',onActivate:()=>{}};
describe('authored Hearthside rooms',()=>{
 it('bounds normalized placements and uses meaningful room/part defaults',()=>{expect(roomObjectPosition('common',{...object,x:-1,y:9})).toEqual([.08,.92]);expect(roomObjectPosition('studio',{...object,x:NaN,y:Infinity})).toEqual([.23,.29]);expect(roomObjectPosition('theatre',{...object,kind:'memory'})).toEqual([.44,.38]);});
 for(const theme of ['classic','taylor','newfoundland'] as const)it(`renders four distinct ${theme} rooms with six layers and no invented objects`,()=>{
  const rendered=(['common','studio','conservatory','theatre'] as RoomSceneRoom[]).map(room=>renderToStaticMarkup(createElement(RoomScene,{theme,room,objects:[]})));
  expect(new Set(rendered).size).toBe(4);for(const html of rendered){expect(html.match(/data-depth=/g)?.length).toBe(6);expect(html).not.toContain('data-object-id=');expect(html).not.toContain('Original room illustration');}
 });
 it('renders actual object labels safely and only draws explicit valid intention links',()=>{
  const objects=[{...object,label:'<script>private()</script>'},{...object,id:'actual-2',kind:'experience' as const}];
  const render=(intention?:{label:string;objectIds:string[]})=>renderToStaticMarkup(createElement(RoomScene,{theme:'classic',room:'common',objects,intention}));
  expect(render()).toContain('&lt;script&gt;');expect(render()).not.toContain('class="hsr-intention-thread"');expect(render({label:'Linked',objectIds:['actual-1','missing']})).not.toContain('class="hsr-intention-thread"');expect(render({label:'Linked',objectIds:['actual-1','actual-2']})).toContain('class="hsr-intention-thread"');
 });
 it('separates repeated default objects on the desktop while preserving explicit coordinates',()=>{const objects=Array.from({length:8},(_,i)=>({...object,id:`actual-${i}`}));const html=renderToStaticMarkup(createElement(RoomScene,{theme:'classic',room:'common',objects}));expect(html).toContain('--hsr-x:16%');expect(html).toContain('--hsr-y:72%');const placed=renderToStaticMarkup(createElement(RoomScene,{theme:'classic',room:'common',objects:[{...object,x:.08,y:.92},...objects.slice(1)]}));expect(placed).toContain('--hsr-x:8%');expect(placed).toContain('--hsr-y:92%');});
 it('retains a complete object index beyond the bounded eight scene objects',()=>{
  const html=renderToStaticMarkup(createElement(RoomScene,{theme:'taylor',room:'studio',objects:Array.from({length:12},(_,i)=>({...object,id:`actual-${i}`,label:`Chosen ${i}`}))}));expect(html.match(/data-object-id=/g)?.length).toBe(8);expect(html).toContain('Chosen 11');
 });
});
