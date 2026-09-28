/** Keep one frame or idle poll outstanding. Sleeping never advances simulation time. */
export function createHorizonFrameLoop(options:{
  active():boolean;
  request(callback:(now:number)=>void):number;
  cancel(id:number):void;
  frame(now:number,resumed:boolean):boolean;
  poll():boolean;
  delay(callback:()=>void):number;
  clearDelay(id:number):void;
}) {
  let frame=0,timer=0,disposed=false,sleeping=true;
  function idle(){
    if(disposed||!options.active()||timer||frame)return;
    timer=options.delay(()=>{timer=0;if(disposed||!options.active())return;if(options.poll())wake();else idle();});
  }
  function draw(now:number){
    frame=0;if(disposed||!options.active()){sleeping=true;return;}
    const resumed=sleeping;sleeping=false;
    const continuous=options.frame(now,resumed);
    // A render callback may synchronously suspend or dispose its owner.
    if(disposed||!options.active()||sleeping)return;
    if(continuous){if(!frame)frame=options.request(draw);}
    else {sleeping=true;idle();}
  }
  function wake(){
    if(timer){options.clearDelay(timer);timer=0;}
    if(!disposed&&options.active()&&!frame)frame=options.request(draw);
  }
  function suspend(){if(frame)options.cancel(frame);if(timer)options.clearDelay(timer);frame=timer=0;sleeping=true;}
  return {wake,suspend,dispose(){disposed=true;suspend();}};
}
