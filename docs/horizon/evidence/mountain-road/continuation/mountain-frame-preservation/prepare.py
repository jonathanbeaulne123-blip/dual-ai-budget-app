from pathlib import Path
import difflib,json
R=Path('/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book');D=Path('/tmp/mountain-frame-preservation')
# Candidate overlay includes the original approval-only fairing proposal. This
# script edits only /tmp source copies, never the checkout.
paths={};before={}
def add(f,s):
 before[f]=(R/f).read_text() if (R/f).exists() else ''
 paths[f]=s;p=D/f;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s)
f='src/harbour/mountain/roads.ts';s=(R/f).read_text();s="import {fairMountainRoadFrames} from './roadFrameFairing.ts';\n"+s
old="export const MOUNTAIN_ROAD_LINE:RoadLine=openDepartures(classify(ROAD_CENTRE,'mountain-road',i=>mix(TOWN_HALF_WIDTH,ROAD_HALF_WIDTH,Math.min(1,i/18)),roadBridge));"
new="export const MOUNTAIN_ROAD_LINE:RoadLine=openDepartures(fairMountainRoadFrames(classify(ROAD_CENTRE,'mountain-road',i=>mix(TOWN_HALF_WIDTH,ROAD_HALF_WIDTH,Math.min(1,i/18)),roadBridge)));"
assert old in s;s=s.replace(old,new)
s=s.replace('normal:Point3;halfWidth:number;grade:number;',"normal:Point3;/** Authored unit frame for scenery; absent when draw and placement frames agree. */placementNormal?:Point3;halfWidth:number;grade:number;",1)
s=s.replace('normal:m3(a.normal,b.normal),halfWidth:', 'normal:m3(a.normal,b.normal),...((a.placementNormal||b.placementNormal)?{placementNormal:m3(a.placementNormal??a.normal,b.placementNormal??b.normal)}:{}),halfWidth:',1)
add(f,s)
f='src/harbour/mountain/roadFrameFairing.ts';patch=Path('/tmp/PROPOSAL-native-road-frame-fairing.patch').read_text();s='\n'.join(line[1:]for line in patch.split('+++ b/'+f+'\n',1)[1].splitlines() if line.startswith('+'))+'\n'
s=s.replace('return {...s,normal:[nx/perpendicular,0,nz/perpendicular]};','return {...s,placementNormal:s.placementNormal??s.normal,normal:[nx/perpendicular,0,nz/perpendicular]};')
s=s.replace('perpendicular width, bridge frames and every branch/rail point stay authored.', 'perpendicular width and bridge frames stay authored. Branch centrelines and skill-rail\n * points stay authored; road edge rails follow repaired frames.\n * Keep the original unit normal for seeded plants and free-standing props: changing\n * a planting acceptance branch can otherwise consume different random numbers and\n * relocate later scenery across the whole mountain.')
add(f,s)
f='src/harbour/mountain/roadPlacement.ts';s="""import type {Point3} from './math.ts';
/** A repaired transverse draw frame may be mitred or displaced. Non-road scenery
 * keeps its authored placement frame, including seeded planting decisions. Road
 * decks, edge rails, bridge frames and physical collision keep reading `normal`. */
export function placementRoadNormal(sample:{normal:Point3;placementNormal?:Point3}):Point3{
  return sample.placementNormal??sample.normal;
}
""";add(f,s)
f='src/harbour/mountain/planting.ts';s=(R/f).read_text();s="import {placementRoadNormal} from './roadPlacement.ts';\n"+s;s=s.replace('s.normal[0]','placementRoadNormal(s)[0]').replace('s.normal[2]','placementRoadNormal(s)[2]');add(f,s)
f='src/harbour/mountain/art/placements.ts';s=(R/f).read_text();s="import {placementRoadNormal} from '../roadPlacement.ts';\n"+s;s=s.replace('normal:Point3;halfWidth:number;tangent:Point3','normal:Point3;placementNormal?:Point3;halfWidth:number;tangent:Point3');s=s.replace('s.normal[0]','placementRoadNormal(s)[0]').replace('s.normal[2]','placementRoadNormal(s)[2]');add(f,s)
f='src/harbour/mountain/art/townArt.ts';s=(R/f).read_text();s="import {placementRoadNormal} from '../roadPlacement.ts';\n"+s;s=s.replace('g.normal[0]','placementRoadNormal(g)[0]').replace('g.normal[2]','placementRoadNormal(g)[2]');add(f,s)
f='src/harbour/mountain/course.ts';s=(R/f).read_text()
s=s.replace('// Road and shortcut geometry participate even when a gate itself did not move.', '// Road footprints and shortcut geometry participate even when no gate moves. A\n// transverse-frame repair changes physical driving and must invalidate saved race times.')
s=s.replace('MOUNTAIN_COURSE_POINTS,SKILL_BRANCHES.map', 'MOUNTAIN_COURSE_POINTS,MOUNTAIN_ROAD_LINE.samples.map(s=>[s.at,s.normal,s.halfWidth]),SKILL_BRANCHES.map')
add(f,s)
(D/'overlay-files.json').write_text(json.dumps(list(paths),indent=2)+'\n')
patch=''
for f,s in paths.items():patch+=''.join(difflib.unified_diff(before[f].splitlines(True),s.splitlines(True),fromfile='a/'+f if before[f] else '/dev/null',tofile='b/'+f))
Path('/tmp/PROPOSAL-native-road-frame-fairing-preserving-scenery.patch').write_text(patch)
# Delta for readers who already reviewed the original proposal; do not apply both.
original=dict(before)
f='src/harbour/mountain/roads.ts';original[f]="import {fairMountainRoadFrames} from './roadFrameFairing.ts';\n"+before[f].replace(old,new)
f='src/harbour/mountain/roadFrameFairing.ts';raw=Path('/tmp/PROPOSAL-native-road-frame-fairing.patch').read_text();original[f]='\n'.join(line[1:]for line in raw.split('+++ b/'+f+'\n',1)[1].splitlines() if line.startswith('+'))+'\n'
delta=''
for f,s in paths.items():
 base=original.get(f,'');delta+=''.join(difflib.unified_diff(base.splitlines(True),s.splitlines(True),fromfile='a/'+f if base else '/dev/null',tofile='b/'+f))
Path('/tmp/native-road-frame-scenery-amendment.patch').write_text(delta)
