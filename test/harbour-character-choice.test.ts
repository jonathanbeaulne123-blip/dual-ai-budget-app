// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {VillageHUD} from '../src/harbour/village/VillageHUD.tsx';

describe('the playable character choice',()=>{
  let host:HTMLDivElement,root:Root;
  beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
  afterEach(()=>{act(()=>root.unmount());host.remove();vi.unstubAllGlobals();});

  it('offers both authored people in the scene before a member has chosen one',()=>{
    const choose=vi.fn();
    act(()=>root.render(createElement(VillageHUD,{place:'court',travelling:null,onVisit:()=>undefined,onView:()=>undefined,avatar:null,avatarStatus:'idle',onAvatar:choose})));
    const choices=host.querySelector('[aria-label="Choose your character"]');
    expect(choices).not.toBeNull();
    expect(host.querySelector('[aria-label="Village destinations"]')).toBeNull();
    const jonathan=[...host.querySelectorAll<HTMLButtonElement>('.village-character__options button')].find(button=>button.textContent==='Jonathan')!;
    act(()=>jonathan.click());
    expect(choose).toHaveBeenCalledWith('jonathan');
    expect(host.querySelector('.village-character__choices')).toBeNull();
  });
});
