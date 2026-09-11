import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {Scene,HemisphereLight,PointLight,DirectionalLight} from 'three';
import {parseCssColour,roomPalette,mixHex,luminance,sameRoomPalette,ROOM_DEFAULTS} from '../src/wardrobe/roomPalette.ts';
import {createRoom} from '../src/wardrobe/room.ts';
import {roomCopy} from '../src/wardrobe/HerculesDressingRoom.tsx';
import {TAYLOR_SCENES,NEWFOUNDLAND_SCENES,resolveThemeScene,sceneTokens} from '../src/theme/scenes.ts';
const css=readFileSync('src/wardrobe/wardrobe.css','utf8');
describe('Dressing room theming',()=>{
 it('derives every colour, font and radius from the live scene tokens with no hex literals',()=>{
  expect(css.match(/#[0-9a-f]{3,8}\b/gi)).toBeNull();
  expect(css.match(/\brgba?\(/gi)).toBeNull();
  for(const token of ['var(--paper)','var(--card)','var(--line)','var(--muted)','var(--theme-accent','var(--theme-second','var(--desk','var(--brass','var(--ink)','var(--theme-radius','var(--display','var(--font'])expect(css,token).toContain(token);
  expect(css).not.toMatch(/font-family:\s*Georgia/);
  expect(css).toContain('[data-fitting-view=personal]');expect(css).toContain('[data-fitting-lighting=dark]');
  expect(css).toContain('@media(max-width:719px)');expect(css).toContain('.fitting-sheet');expect(css).toContain('prefers-reduced-motion');
 });
 it('parses hex and rgb tokens and falls back to the authored scene palette otherwise',()=>{
  expect(parseCssColour('#abc')).toBe('#aabbcc');expect(parseCssColour(' #A1B2C3 ')).toBe('#a1b2c3');expect(parseCssColour('#a1b2c3ff')).toBe('#a1b2c3');
  expect(parseCssColour('rgb(255, 0, 128)')).toBe('#ff0080');expect(parseCssColour('rgba(1 2 3 / 0.5)')).toBe('#010203');
  expect(parseCssColour('color-mix(in srgb, #fff 94%, #000)')).toBeNull();expect(parseCssColour('var(--paper)')).toBeNull();expect(parseCssColour('')).toBeNull();expect(parseCssColour(null)).toBeNull();
  const scene=resolveThemeScene('classic','home','household');
  const fallback=roomPalette({theme:'classic',personal:false,dark:false,palette:scene.palette},{paper:'color-mix(in srgb, red, blue)',accent:'not a colour'});
  expect(fallback.paper).toBe(scene.palette.paper);expect(fallback.accent).toBe(scene.palette.accent);
  const tokens=roomPalette({theme:'classic',personal:false,dark:false,palette:scene.palette},{paper:'rgb(10, 20, 30)',accent:'#123456'});
  expect(tokens.paper).toBe('#0a141e');expect(tokens.accent).toBe('#123456');
  const personal=roomPalette({theme:'classic',personal:true,dark:false,palette:scene.palette});
  expect(personal.second).not.toBe(fallback.second);expect(personal.paper).toBe(fallback.paper);
  expect(mixHex('#000000','#ffffff',.5)).toBe('#808080');expect(luminance('#ffffff')).toBeCloseTo(1,5);expect(luminance('#000000')).toBe(0);
  expect(sameRoomPalette(fallback,{...fallback})).toBe(true);expect(sameRoomPalette(fallback,personal)).toBe(false);
 });
 it('reads the real scene tokens for every dark scene and marks the room dark',()=>{
  for(const scene of [TAYLOR_SCENES.reputation,NEWFOUNDLAND_SCENES['george-street']]){
   expect(scene.dark).toBe(true);const tokens=sceneTokens(scene);
   const palette=roomPalette({theme:scene.theme,personal:false,dark:scene.dark,palette:scene.palette},{paper:tokens['--paper'],card:tokens['--card'],ink:tokens['--ink'],line:tokens['--line'],muted:tokens['--muted'],accent:tokens['--theme-accent'],second:tokens['--theme-second'],desk:tokens['--desk'],brass:tokens['--brass']});
   expect(palette.dark).toBe(true);expect(palette.paper).toBe(scene.palette.paper);expect(luminance(palette.paper)).toBeLessThan(.05);
   // The mirror frame and rails stay legible: brass is lifted, not sunk into the wall, on a dark scene.
   expect(luminance(palette.brass)).toBeGreaterThan(luminance(ROOM_DEFAULTS[scene.theme].brass));
  }
 });
 it('builds one authored room per theme, re-tints in place and lowers ambient light for dark scenes',()=>{
  for(const theme of ['classic','taylor','newfoundland'] as const){
   const scene=new Scene();const light=roomPalette({theme,personal:false,dark:false,palette:resolveThemeScene(theme,'home','household').palette});
   const room=createRoom(scene,light);const lights=<T extends object>(kind:new(...args:never[])=>T)=>{const found:T[]=[];scene.traverse(n=>{if(n instanceof kind)found.push(n);});return found;};
   const hemi=lights(HemisphereLight)[0]!,lamp=lights(PointLight)[0]!,sun=lights(DirectionalLight)[0]!;
   expect(hemi.intensity).toBe(1.5);expect(lamp.intensity).toBeLessThan(1);expect(sun.intensity).toBe(2);
   let meshes=0;scene.traverse(n=>{if((n as {isMesh?:boolean}).isMesh)meshes++;});expect(meshes,theme).toBeGreaterThan(theme==='classic'?18:15);
   const before=room.materials.wall.color.getHexString();
   const dark={...light,dark:true,paper:'#191c20',card:'#24282d',ink:'#f1ede5'};room.apply(dark);
   expect(room.materials.wall.color.getHexString()).not.toBe(before);expect(hemi.intensity).toBeLessThan(.5);expect(lamp.intensity).toBeGreaterThan(2);expect(sun.intensity).toBeLessThan(.5);
   expect(luminance('#'+room.materials.trim.color.getHexString())).toBeGreaterThan(.2);
   room.dispose();expect(scene.children).toHaveLength(0);
  }
 });
 it('names each theme, view and lighting distinctly without money or lyrics',()=>{
  const names=new Set<string>();
  for(const theme of ['classic','taylor','newfoundland'])for(const personal of [false,true])for(const dark of [false,true]){const copy=roomCopy(theme,personal,dark);expect(copy.name.length).toBeGreaterThan(5);expect(copy.caption).not.toMatch(/\$|CAD|budget|bill/i);names.add(`${theme}:${copy.name}`);}
  expect(names.size).toBe(12);
  expect(roomCopy('taylor',false,false).name).not.toBe(roomCopy('taylor',false,true).name);expect(roomCopy('newfoundland',true,false).name).not.toBe(roomCopy('newfoundland',false,false).name);
 });
});
