import type { KittyStrokeV1 } from '../core/types.ts';
import { decodeKittyDesignOperation, designId, designRecord } from './designContracts.ts';
import type { HearthsideRoom } from './contracts.ts';

export type CreativeTarget={designId:string;pieceId:string;room:HearthsideRoom;deviceId:string};
export type CreativePresenceMessage={type:'creative-join';version:1;target:CreativeTarget}|{type:'creative-preview';version:1;gestureId:string;stroke:KittyStrokeV1|null}|{type:'creative-leave';version:1};
export type CreativePeer={memberId:string;deviceId:string;seenAt:number;target:CreativeTarget;gestureId?:string;stroke?:KittyStrokeV1|null};
export function decodeCreativePresence(value:unknown):CreativePresenceMessage {
  designRecord(value,['type','version','target','gestureId','stroke'],['type','version']);if(value.version!==1)throw Error('CREATIVE_PRESENCE_VERSION');
  if(value.type==='creative-leave'){designRecord(value,['type','version']);return {type:value.type,version:1};}
  if(value.type==='creative-join'){
    designRecord(value,['type','version','target']);designRecord(value.target,['designId','pieceId','room','deviceId']);
    for(const key of ['designId','pieceId','deviceId'])designId(value.target[key]);if(!['common','studio','conservatory','theatre'].includes(String(value.target.room)))throw Error('CREATIVE_ROOM_INVALID');
    return {type:value.type,version:1,target:value.target as CreativeTarget};
  }
  designRecord(value,['type','version','gestureId','stroke']);if(value.type!=='creative-preview')throw Error('CREATIVE_PRESENCE_KIND');designId(value.gestureId);
  let stroke:KittyStrokeV1|null=null;
  if(value.stroke!==null){const op=decodeKittyDesignOperation({version:1,id:'preview',designId:'preview',pieceId:'preview',gestureId:value.gestureId,kind:'append-stroke',expectedEditEpoch:0,surfaceRevision:0,stroke:value.stroke});if(op.kind!=='append-stroke'||op.stroke.pts.length>256)throw Error('CREATIVE_PREVIEW_LIMIT');stroke=op.stroke;}
  return {type:value.type,version:1,gestureId:value.gestureId,stroke};
}
/** Separate authenticated presence socket. Only explicit participation opens this lane. */
export function attachCreativePresence(input:{environment:string;householdId:string;target:CreativeTarget;token:()=>Promise<string>;onPeers:(peers:CreativePeer[])=>void;onState?:(state:'joining'|'present'|'offline')=>void}) {
  let stopped=false,ws:WebSocket|undefined,retry:ReturnType<typeof setTimeout>|undefined,renew:ReturnType<typeof setTimeout>|undefined,heartbeat:ReturnType<typeof setInterval>|undefined;
  const peers=new Map<string,CreativePeer>(),path=`/ledger-sync/v2/${input.environment}/${input.householdId}`;
  const publish=()=>{const now=Date.now();for(const [key,peer]of peers)if(now-peer.seenAt>12000)peers.delete(key);input.onPeers([...peers.values()]);};
  async function ticket(){const response=await fetch(path+'/ticket',{method:'POST',headers:{Authorization:`Bearer ${await input.token()}`}});if(!response.ok)throw Error('CREATIVE_PRESENCE_AUTH');return (await response.json() as {ticket:string}).ticket;}
  const join=()=>{publish();if(ws?.readyState===WebSocket.OPEN&&document.visibilityState==='visible')ws.send(JSON.stringify({type:'creative-join',version:1,target:input.target}));};
  async function connect(){
    try{
      input.onState?.('joining');const key=await ticket();if(stopped)return;
      const socket=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}${path}/socket?lane=presence`);ws=socket;
      socket.onopen=()=>socket.send(JSON.stringify({type:'auth',ticket:key}));
      socket.onmessage=event=>{try{const value=JSON.parse(event.data as string);if(value.type==='authenticated'){join();input.onState?.('present');}if(value.type==='creative-peer'&&value.target?.designId===input.target.designId&&value.target?.pieceId===input.target.pieceId){peers.set(value.deviceId,value as CreativePeer);publish();}if(value.type==='creative-left'){peers.delete(value.deviceId);publish();}}catch{socket.close();}};
      socket.onclose=()=>{clearInterval(heartbeat);clearTimeout(renew);peers.clear();publish();input.onState?.('offline');if(!stopped)retry=setTimeout(()=>void connect(),2000);};socket.onerror=()=>socket.close();
      heartbeat=setInterval(join,4000);
      const refresh=async()=>{try{const key=await ticket();if(stopped||ws!==socket)return;socket.send(JSON.stringify({type:'auth',ticket:key}));renew=setTimeout(()=>void refresh(),40000);}catch{socket.close();}};
      renew=setTimeout(()=>void refresh(),40000);
    }catch{input.onState?.('offline');if(!stopped)retry=setTimeout(()=>void connect(),2000);}
  }
  void connect();
  return {preview(gestureId:string,stroke:KittyStrokeV1|null){if(!stopped&&ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(decodeCreativePresence({type:'creative-preview',version:1,gestureId,stroke:stroke?{...stroke,pts:stroke.pts.slice(-256)}:null})));},close(){stopped=true;clearTimeout(retry);clearTimeout(renew);clearInterval(heartbeat);if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'creative-leave',version:1}));ws?.close();peers.clear();input.onPeers([]);}};
}
