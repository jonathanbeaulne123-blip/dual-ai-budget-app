import {groundHeightAt} from '../scene/ground.ts';
import {SKATE_ROUTES,SKATE_SPOTS,SKATE_DECKS,skateSurface,type SkateDeckId,type SkateRouteId,type SkateSpotId} from './park.ts';
import {createSkateState,stepSkate,SKATE_IDLE,requestSkateTrick,resetSkate,setSkateMarker,stopSkate,type SkateAction,type SkateInput,type SkateState,type SkateWorld} from './skateModel.ts';
import {createSkateSession,skateSnapshot,startSkateRoute,stepSkateSession,type SkateProgress,type SkateSnapshot,type SkateSession} from './session.ts';
import type {BodyInput,BodyWorld} from '../body/bodyModel.ts';

export type SkateCheckpoint={state:SkateState;session:SkateSession};
export type SkateControls={
  active():boolean;heading():number|null;enable(on:boolean,progress?:SkateProgress):boolean;
  action(action:SkateAction):void;hold(input:Partial<SkateInput>):void;
  pause(on:boolean):void;paused():boolean;snapshot():SkateSnapshot|null;
  route(id:SkateRouteId|null):void;spot(id:SkateSpotId):void;deck(id:SkateDeckId):void;
  checkpoint():SkateCheckpoint|null;restore(checkpoint:SkateCheckpoint):void;
};

/** No frame or storage ownership. The existing walker drives this once per frame. */
export function createSkateDriver(bodyWorld:BodyWorld){
  const world:SkateWorld={ground:groundHeightAt,surface:(x,z)=>skateSurface(x,z,groundHeightAt),get obstacles(){return bodyWorld.obstacles;}};
  let state:SkateState|null=null,session=createSkateSession(),held={...SKATE_IDLE},paused=false;
  function restartAt(x:number,z:number,yaw:number){
    const old=state;state=createSkateState(x,z,yaw,world);if(old){state.score=old.score;state.best=old.best;state.event.id=old.event.id+1;}
    held={...SKATE_IDLE};session.lineTags=[];
  }
  const api={
    active:()=>state!==null,heading:()=>state?(state.mode==='air'?state.takeoffYaw:state.yaw+(state.fakie?Math.PI:0)):null,paused:()=>paused,state:()=>state,deckId:()=>session.progress.deck,world,
    mount(x:number,z:number,yaw:number,progress?:SkateProgress){session=createSkateSession(progress);restartAt(x,z,yaw);paused=false;},
    unmount(){const old=state;state=null;held={...SKATE_IDLE};session.run=null;return old;},
    stop(){if(state)stopSkate(state,world);held={...SKATE_IDLE};},
    action(action:SkateAction){if(!state)return;
      if(action==='respawn'){state=resetSkate(state,world);session.run=null;session.lineTags=[];held={...SKATE_IDLE};}
      else if(action==='marker'){if(!setSkateMarker(state))session.message='Stop on the ground to set your marker';}
      else if(action==='manual')held.manual=!held.manual;
      else if(action==='grind')held.grind=!held.grind;
      else if(action==='brake')held.brake=!held.brake;
      else if(!paused)requestSkateTrick(state,action);
    },
    hold(input:Partial<SkateInput>){held={...held,...input};},
    pause(on:boolean){paused=on;held={...SKATE_IDLE};if(state)state.pending=null;},
    snapshot:()=>state?skateSnapshot(state,session,paused):null,
    checkpoint:():SkateCheckpoint|null=>state?structuredClone({state,session}):null,
    restore(checkpoint:SkateCheckpoint){const copy=structuredClone(checkpoint);state=copy.state;session=copy.session;paused=true;held={...SKATE_IDLE};state.pending=null;},
    route(id:SkateRouteId|null){if(!state)return;if(!id){session.run=null;return;}const route=SKATE_ROUTES.find(r=>r.id===id)!;
      const a=route.points[0],b=route.points[1];restartAt(a[0],a[1],Math.atan2(b[0]-a[0],b[1]-a[1]));startSkateRoute(session,id);paused=false;
    },
    spot(id:SkateSpotId){if(!state)return;const spot=SKATE_SPOTS.find(s=>s.id===id);if(!spot||(id!=='tideline'&&!session.progress.discovered.includes(id)))return;
      restartAt(spot.start[0],spot.start[1],spot.yaw);session.run=null;paused=false;
    },
    deck(id:SkateDeckId){const deck=SKATE_DECKS.find(d=>d.id===id);if(deck&&deck.discoveries<=session.progress.discovered.length){session.progress={...session.progress,deck:id};session.revision++;}},
    step(input:BodyInput,dt:number){
      if(!state||paused)return false;
      const waiting=(session.run?.countdown??0)>0;
      if(!waiting){
        const drive={...held,push:Math.max(held.push,Math.max(0,input.forward)),steer:input.strafe||held.steer,brake:held.brake||input.forward<0,pump:held.pump||input.run===true};
        state=stepSkate(state,drive,dt,world);
      }
      stepSkateSession(session,state,dt);
      return waiting||Boolean(session.run&&!session.run.finished)||state.speed>.01||state.mode!=='ride'||state.combo>0||state.pending!==null;
    },
  };return api;
}
