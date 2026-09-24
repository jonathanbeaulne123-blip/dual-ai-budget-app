/** Detail ownership is separate from the permanent land, collision and silhouettes. */
export type DetailResource={dispose():void};
export type DetailSite={id:string;at:readonly[number,number];radius:number};
export function createDetailStream<T extends DetailResource>(sites:readonly DetailSite[],build:(site:DetailSite)=>T){
  const live=new Map<string,T>();let dead=false;
  return {
    live,
    update(x:number,z:number,pinned=false):boolean{
      if(dead)return false;let changed=false;
      for(const site of sites){
        const distance=Math.hypot(x-site.at[0],z-site.at[1]),resident=live.get(site.id);
        // A 24-unit release band prevents rebuilding while crossing a district edge.
        if(!resident&&(pinned||distance<=site.radius)){live.set(site.id,build(site));changed=true;}
        else if(resident&&!pinned&&distance>site.radius+24){resident.dispose();live.delete(site.id);changed=true;}
      }
      return changed;
    },
    dispose(){if(dead)return;dead=true;for(const item of live.values())item.dispose();live.clear();},
  };
}
