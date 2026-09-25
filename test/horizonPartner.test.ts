import {expect,it} from 'vitest';
import {horizonPartnerPose} from '../src/harbour/horizon/runtime/partner.ts';
import {createWorldTrack} from '../src/ledgerSync/worldMotion.ts';
it('interpolates using the presence clock and hides an expired partner',()=>{
 const at=1_790_000_000_000,track=createWorldTrack();
 track.push({x:1000,z:1000,yaw:0,moving:true,at});
 track.push({x:1001,z:1000,yaw:0,moving:true,at:at+100});
 const source={pose:(now:number)=>track.pose(now)};
 expect(horizonPartnerPose(source,at+220)?.x).toBeGreaterThan(1000);
 expect(horizonPartnerPose(source,at+20000)).toBeNull();
});
