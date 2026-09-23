import {HARBOUR_LAND} from '../village/world.ts';

/** Extra zoom beyond the island overview is intentional; arriving at the limit alone never exits. */
export function harbourZoomExit(radius:number,delta:number,overscroll:number):{overscroll:number;exit:boolean}{
  if(!Number.isFinite(radius)||!Number.isFinite(delta)||delta<=0||radius<HARBOUR_LAND.overview-.5)return {overscroll:0,exit:false};
  const next=overscroll+Math.min(.5,delta);
  return {overscroll:next,exit:next>=.34};
}
