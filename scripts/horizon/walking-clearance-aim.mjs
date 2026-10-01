/** Audit driver only: ordinary steering within an authored walk's width. Never changes
 * the body, floor, source path, speed, collision or failure outcome. */
export function walkingClearanceAim({position,progress,pointAt,halfWidth,geography,maxSlope,bodyRadius=.3}){
  const available=halfWidth-bodyRadius-.05;
  if(!(available>0))return null;
  const here=pointAt(progress),nx=-Math.cos(here.heading),nz=Math.sin(here.heading);
  const current=(position[0]-here.x)*nx+(position[2]-here.z)*nz;
  // Do not claim a constrained recovery when the body already lies outside the walk.
  if(Math.abs(current)>available+.05)return null;
  const offsets=[0,available*.5,-available*.5,available*.9,-available*.9,available,-available];
  for(const offset of offsets){
    let previous={x:position[0],y:position[1],z:position[2]},target=null,clear=true;
    // Plan a short lateral approach, then remain on that walking line ahead of the post.
    for(let s=.2;s<=3.00001;s+=.2){
      const p=pointAt(progress+s),lateral=current+(offset-current)*Math.min(1,s/.8);
      const x=p.x-Math.cos(p.heading)*lateral,z=p.z+Math.sin(p.heading)*lateral;
      const floor=geography.surface(x,z,previous.y,.48),dx=x-previous.x,dz=z-previous.z;
      if(!floor||floor.slope>maxSlope||Math.abs(floor.y-previous.y)>.15||geography.blocker(x,z,floor.y,bodyRadius,[dx,dz])){clear=false;break;}
      const wet=geography.waterLevel(x,z,floor.y);
      if(wet!==null&&floor.y<=wet-.3){clear=false;break;}
      previous={x,y:floor.y,z};if(s<.800001)target=previous;
    }
    if(clear&&target)return {target,offset,halfWidth,bodyRadius};
  }
  return null;
}
