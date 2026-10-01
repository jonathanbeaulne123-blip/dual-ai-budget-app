from pathlib import Path
import json, math, hashlib, sys
ROOT=Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve()
OUTPUT=Path(sys.argv[2] if len(sys.argv)>2 else '/tmp/mountain-native-grade-proof.json')
source_path=ROOT/'src/harbour/horizon/land/mountainV2/v2-data.json'
audit_path=ROOT/'docs/horizon/evidence/mountain-road/after/attempts/joined-ground-cruiser/audit.json'
v=json.loads(source_path.read_text());audit=json.loads(audit_path.read_text());S=v['road']['samples'];N=len(S);G=.12
arc=[0.]
for a,b in zip(S,S[1:]):arc.append(arc[-1]+math.hypot(b['at'][0]-a['at'][0],b['at'][2]-a['at'][2]))
offset=audit['chainReaches']['mountainStart']
def at(i):return {'row':i,'H':S[i]['at'],'nativeSpatialS':S[i]['s'],'nativePlanS':arc[i],'chainPlanS':offset+arc[i]}
def pair(i,j):
 rise=abs(S[j]['at'][1]-S[i]['at'][1]);run=arc[j]-arc[i]
 return {'a':at(i),'b':at(j),'riseM':rise,'planLengthM':run,'requiredGrade':rise/run,'allowedRiseAt12M':G*run,'excessRiseM':rise-G*run,'minimumLengthAt12M':rise/G,'extraPlanLengthAt12M':rise/G-run}
def row(i):
 p=S[i];return [[p['at'][0]+p['normal'][0]*w,p['at'][1],p['at'][2]+p['normal'][2]*w] for w in [-p['hw'],-p['hw']+.55,-.45,.45,p['hw']-.55,p['hw']]]
def facet(i):
 A,B=row(i),row(i+1);values=[]
 for k in range(1,len(A)):
  for t in [(A[k-1],B[k-1],B[k]),(A[k-1],B[k],A[k])]:
   a,b,c=t;u=[b[j]-a[j] for j in range(3)];w=[c[j]-a[j] for j in range(3)]
   normal=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]]
   values.append({'grade':math.hypot(normal[0],normal[2])/abs(normal[1]),'band':k-1,'triangle':t})
 return max(values,key=lambda x:x['grade'])
bridges=[];fixed={0:'Foot',N-1:'Summit'};extended=dict(fixed)
for b in v['road']['bridges']:
 ids=[min(range(N),key=lambda i: math.dist(S[i]['at'],p)) for p in b['axis']]
 assert max(math.dist(S[i]['at'],p) for i,p in zip(ids,b['axis']))<1e-8
 assert ids==list(range(ids[0],ids[-1]+1))
 for i in ids:fixed[i]=b['id']
 for i in range(ids[0]-1,ids[-1]+2):extended[i]=b['id']+' rendered apron'
 centre=[(pair(i,i+1),i) for i in ids[:-1]]
 faces=[(facet(i),i) for i in ids[:-1]]
 bridge={'id':b['id'],'name':b['name'],'rows':[ids[0],ids[-1]],'taggedAxisBounds':[at(ids[0]),at(ids[-1])],'renderedRows':[ids[0]-1,ids[-1]+1],'renderedBounds':[at(ids[0]-1),at(ids[-1]+1)],'width':b['width'],'maxCentreline':max(centre,key=lambda r:r[0]['requiredGrade'])[0]}
 face,i=max(faces,key=lambda r:r[0]['grade']);bridge['maxFixedFace']={'fromRow':i,'toRow':i+1,**face};bridges.append(bridge)
def constraints(fixed):
 ids=sorted(fixed);viol=[];allpairs=[]
 for n,i in enumerate(ids):
  for j in ids[n+1:]:
   p=pair(i,j);p['owners']=[fixed[i],fixed[j]];allpairs.append(p)
 for i,j in zip(ids,ids[1:]):
  p=pair(i,j)
  if p['excessRiseM']>1e-8:p['owners']=[fixed[i],fixed[j]];viol.append(p)
 worst=max(allpairs,key=lambda p:p['excessRiseM'])
 # At each native sample, immutable-anchor cones must have nonempty intersection.
 envelope=[]
 for k in range(N):
  lo=max((S[i]['at'][1]-G*abs(arc[k]-arc[i]),i) for i in ids)
  hi=min((S[i]['at'][1]+G*abs(arc[k]-arc[i]),i) for i in ids)
  envelope.append({'row':k,'lower':lo[0],'lowerOwnerRow':lo[1],'upper':hi[0],'upperOwnerRow':hi[1],'incompatibilityM':lo[0]-hi[0]})
 return {'fixedRows':len(ids),'feasible':not viol,'consecutiveAnchorViolations':viol,'worstAllPairs':worst,'maxConeConflict':max(envelope,key=lambda e:e['incompatibilityM'])}
groups=[]
for e in audit['events']:
 if e['type']!='grade' or e['severity']!='MAJOR':continue
 lo,hi=e['station'];overlap=[]
 for b in bridges:
  for kind,key in [('tagged-axis','taggedAxisBounds'),('rendered-native-deck','renderedBounds')]:
   l=max(lo,b[key][0]['chainPlanS']);h=min(hi,b[key][1]['chainPlanS'])
   if h>=l:overlap.append({'bridge':b['name'],'kind':kind,'chainPlanRange':[l,h],'lengthM':h-l})
 rows=audit['stations']['mountain-chain'];closest=min(rows,key=lambda r:math.dist(r['at'],e['at']))
 groups.append({'eventId':e['id'],'chainPlanRange':e['station'],'reportedMax10mPercent':e['value'],'worstStartStationApprox':closest['s'],'worstStartH':e['at'],'worst10mWindowApprox':[closest['s'],closest['s']+10],'bridgeOverlap':overlap})
out={'method':'pure JSON arithmetic; no source module import/world generation; consecutive |dy|<=0.12*horizontal ds is required for any continuous height-only profile on fixed XY. All immutable anchor pairs must satisfy it. Triangle grades use six actual road transverse bands, same constant top paint lift on all vertices omitted.','source':{'path':str(source_path),'sha256':hashlib.sha256(source_path.read_bytes()).hexdigest(),'samples':N,'framePlanMaxDifferenceM':max(abs(arc[i]-v['road']['frames'][i]['s']) for i in range(N))},'audit':{'path':str(audit_path),'sha256':hashlib.sha256(audit_path.read_bytes()).hexdigest(),'bake':audit['meta']['bake'],'chainLengthDifferenceM':arc[-1]-(audit['chainReaches']['parts'][-1]['to']-offset)},'endpoints':[at(0),at(N-1)],'bridges':bridges,'gradeGroups':groups,'taggedBridgeConstraints':constraints(fixed),'renderedBridgeConstraints':constraints(extended)}
OUTPUT.write_text(json.dumps(out,indent=2))
print(json.dumps({'groups':groups,'bridges':[{'name':b['name'],'taggedRows':b['rows'],'renderedRows':b['renderedRows'],'maxCentrelineGrade':b['maxCentreline']['requiredGrade'],'maxFixedFaceGrade':b['maxFixedFace']['grade'],'maxFaceRows':[b['maxFixedFace']['fromRow'],b['maxFixedFace']['toRow']]} for b in bridges],'taggedWorst':out['taggedBridgeConstraints']['worstAllPairs'],'renderedWorst':out['renderedBridgeConstraints']['worstAllPairs'],'source':out['source'],'audit':out['audit']},indent=2))
# Exact ten-metre tests, separate from the stronger pointwise Lipschitz question.
import bisect
def interpolated(s):
 i=max(0,min(N-2,bisect.bisect_right(arc,s)-1));t=(s-arc[i])/(arc[i+1]-arc[i]);return {'planS':s,'chainS':s+offset,'rows':[i,i+1],'t':t,'H':[S[i]['at'][k]+t*(S[i+1]['at'][k]-S[i]['at'][k]) for k in range(3)]}
def interval(s,length=10):
 a,b=interpolated(s),interpolated(s+length);rise=b['H'][1]-a['H'][1]
 return {'a':a,'b':b,'lengthM':length,'riseM':rise,'grade':rise/length,'excessRiseM':abs(rise)-G*length}
def max10(i,j,grid=False):
 lo,hi=arc[i],arc[j]
 starts=([k*2-offset for k in range(math.ceil((lo+offset)/2),math.floor((hi-10+offset)/2)+1)] if grid else sorted(set([lo,hi-10]+[s for s in arc[i:j+1] if s<=hi-10]+[s-10 for s in arc[i:j+1] if s-10>=lo])))
 return max((interval(s) for s in starts),key=lambda p:abs(p['grade']))
for b in out['bridges']:
 b['taggedMax10m']=max10(*b['rows']);b['renderedMax10m']=max10(*b['renderedRows']);b['auditGridTaggedMax10m']=max10(*b['rows'],grid=True);b['auditGridRenderedMax10m']=max10(*b['renderedRows'],grid=True)
for key in ['taggedBridgeConstraints','renderedBridgeConstraints']:
 w=out[key]['worstAllPairs'];i=w['a']['row'];j=w['b']['row'];n=math.ceil((arc[j]-arc[i])/10);p=interval(arc[j]-10*n,10*n);p['tenMetreIntervals']=n;p['note']='Starting witness moves backwards within fixed High woodland bridge; the interval is an exact multiple of10m, leaving no unconstrained remainder.';out[key]['tenMetreTelescopingWitness']=p
# An exact2m-audit-grid-aligned pair: each of its18 ten-metre steps is itself an audited window.
out['auditGridTelescopingWitness']=interval(788-offset,180);out['auditGridTelescopingWitness']['tenMetreIntervals']=18
OUTPUT.write_text(json.dumps(out,indent=2))
print(json.dumps({'fixedBridgeAuditGrid10m':[{'name':b['name'],'tagged':b['auditGridTaggedMax10m'],'rendered':b['auditGridRenderedMax10m']} for b in bridges],'gridTelescope':out['auditGridTelescopingWitness']},indent=2))
