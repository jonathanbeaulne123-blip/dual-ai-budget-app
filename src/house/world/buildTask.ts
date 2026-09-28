/** Cooperative visual work. A step is bounded by the builder, not preempted here. */
export function finishBuild<T>(steps:Generator<void,T,void>):T {
  let next=steps.next();while(!next.done)next=steps.next();return next.value;
}
export function createBuildTask<T>(steps:Generator<void,T,void>,budgetMs=3,clock=()=>performance.now()) {
  let done=false;
  return {
    advance():T|undefined {
      if(done)return undefined;
      const end=clock()+budgetMs;
      for(let count=0;count<128;count++){
        const next=steps.next();
        if(next.done){done=true;return next.value;}
        if(clock()>=end)break;
      }
      return undefined;
    },
    cancel(){if(done)return;done=true;steps.return(undefined as T);},
  };
}
