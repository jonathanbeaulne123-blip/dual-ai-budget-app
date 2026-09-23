var Sh=0,bc=1,wh=2;var cs=1,Ah=2,gi=3,pn=0,Bt=1,rn=2,In=0,wa=1,mc=2,gc=3,xc=4,Eh=5;var ra=100,Th=101,Rh=102,Ih=103,Ch=104,kh=200,Ph=201,Nh=202,Dh=203,Qs=204,$s=205,Fh=206,Uh=207,Lh=208,Oh=209,Bh=210,zh=211,jh=212,Hh=213,Gh=214,er=0,tr=1,nr=2,Aa=3,ar=4,ir=5,sr=6,rr=7,yc=0,Vh=1,Wh=2,mn=0,vc=1,_c=2,Mc=3,Sc=4,wc=5,Ac=6,Ec=7,nc="attached",Xh="detached",Tc=300,fa=301,Na=302,Er=303,Tr=304,ls=306,oa=1e3,an=1001,ni=1002,bt=1003,Rr=1004;var Da=1005;var mt=1006,xi=1007;var gn=1008;var Wt=1009,Rc=1010,Ic=1011,yi=1012,Ir=1013,xn=1014,$t=1015,Cn=1016,Cr=1017,kr=1018,vi=1020,Cc=35902,kc=35899,Pc=1021,Nc=1022,en=1023,An=1026,ua=1027,Pr=1028,Nr=1029,pa=1030,Dr=1031;var Fr=1033,hs=33776,ds=33777,fs=33778,us=33779,Ur=35840,Lr=35841,Or=35842,Br=35843,zr=36196,jr=37492,Hr=37496,Gr=37488,Vr=37489,ps=37490,Wr=37491,Xr=37808,qr=37809,Kr=37810,Jr=37811,Yr=37812,Zr=37813,Qr=37814,$r=37815,eo=37816,to=37817,no=37818,ao=37819,io=37820,so=37821,ro=36492,oo=36494,co=36495,lo=36283,ho=36284,bs=36285,fo=36286;var Ea=2300,Ta=2301,Zs=2302,ac=2303,ic=2400,sc=2401,rc=2402,qh=2500;var Dc=0,ms=1,_i=2,Kh=3200;var uo=0,Jh=1,Kn="",wt="srgb",Ot="srgb-linear",Ui="linear",Je="srgb";var Ma=7680;var oc=519,Yh=512,Zh=513,Qh=514,po=515,$h=516,ed=517,bo=518,td=519,or=35044;var Fc="300 es",fn=2e3,ai=2001;function of(a){for(let e=a.length-1;e>=0;--e)if(a[e]>=65535)return!0;return!1}function cf(a){return ArrayBuffer.isView(a)&&!(a instanceof DataView)}function ii(a){return document.createElementNS("http://www.w3.org/1999/xhtml",a)}function nd(){let a=ii("canvas");return a.style.display="block",a}var jl={},si=null;function Li(...a){let e="THREE."+a.shift();si?si("log",e,...a):console.log(e,...a)}function ad(a){let e=a[0];if(typeof e=="string"&&e.startsWith("TSL:")){let t=a[1];t&&t.isStackTrace?a[0]+=" "+t.getLocation():a[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return a}function ve(...a){a=ad(a);let e="THREE."+a.shift();if(si)si("warn",e,...a);else{let t=a[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...a)}}function Ie(...a){a=ad(a);let e="THREE."+a.shift();if(si)si("error",e,...a);else{let t=a[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...a)}}function Sa(...a){let e=a.join(" ");e in jl||(jl[e]=!0,ve(...a))}function id(a,e,t){return new Promise(function(n,i){function s(){switch(a.clientWaitSync(e,a.SYNC_FLUSH_COMMANDS_BIT,0)){case a.WAIT_FAILED:i();break;case a.TIMEOUT_EXPIRED:setTimeout(s,t);break;default:n()}}setTimeout(s,t)})}var sd={[er]:tr,[nr]:sr,[ar]:rr,[Aa]:ir,[tr]:er,[sr]:nr,[rr]:ar,[ir]:Aa},En=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){let n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){let n=this._listeners;if(n===void 0)return;let i=n[e];if(i!==void 0){let s=i.indexOf(t);s!==-1&&i.splice(s,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let n=t[e.type];if(n!==void 0){e.target=this;let i=n.slice(0);for(let s=0,r=i.length;s<r;s++)i[s].call(this,e);e.target=null}}},Nt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],Hl=1234567,Di=Math.PI/180,Ra=180/Math.PI;function un(){let a=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Nt[a&255]+Nt[a>>8&255]+Nt[a>>16&255]+Nt[a>>24&255]+"-"+Nt[e&255]+Nt[e>>8&255]+"-"+Nt[e>>16&15|64]+Nt[e>>24&255]+"-"+Nt[t&63|128]+Nt[t>>8&255]+"-"+Nt[t>>16&255]+Nt[t>>24&255]+Nt[n&255]+Nt[n>>8&255]+Nt[n>>16&255]+Nt[n>>24&255]).toLowerCase()}function He(a,e,t){return Math.max(e,Math.min(t,a))}function Uc(a,e){return(a%e+e)%e}function lf(a,e,t,n,i){return n+(a-e)*(i-n)/(t-e)}function hf(a,e,t){return a!==e?(t-a)/(e-a):0}function Fi(a,e,t){return(1-t)*a+t*e}function df(a,e,t,n){return Fi(a,e,1-Math.exp(-t*n))}function ff(a,e=1){return e-Math.abs(Uc(a,e*2)-e)}function uf(a,e,t){return a<=e?0:a>=t?1:(a=(a-e)/(t-e),a*a*(3-2*a))}function pf(a,e,t){return a<=e?0:a>=t?1:(a=(a-e)/(t-e),a*a*a*(a*(a*6-15)+10))}function bf(a,e){return a+Math.floor(Math.random()*(e-a+1))}function mf(a,e){return a+Math.random()*(e-a)}function gf(a){return a*(.5-Math.random())}function xf(a){a!==void 0&&(Hl=a);let e=Hl+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function yf(a){return a*Di}function vf(a){return a*Ra}function _f(a){return(a&a-1)===0&&a!==0}function Mf(a){return Math.pow(2,Math.ceil(Math.log(a)/Math.LN2))}function Sf(a){return Math.pow(2,Math.floor(Math.log(a)/Math.LN2))}function wf(a,e,t,n,i){let s=Math.cos,r=Math.sin,o=s(t/2),l=r(t/2),c=s((e+n)/2),h=r((e+n)/2),d=s((e-n)/2),f=r((e-n)/2),b=s((n-e)/2),g=r((n-e)/2);switch(i){case"XYX":a.set(o*h,l*d,l*f,o*c);break;case"YZY":a.set(l*f,o*h,l*d,o*c);break;case"ZXZ":a.set(l*d,l*f,o*h,o*c);break;case"XZX":a.set(o*h,l*g,l*b,o*c);break;case"YXY":a.set(l*b,o*h,l*g,o*c);break;case"ZYZ":a.set(l*g,l*b,o*h,o*c);break;default:ve("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+i)}}function dn(a,e){switch(e.constructor){case Float32Array:return a;case Uint32Array:return a/4294967295;case Uint16Array:return a/65535;case Uint8Array:return a/255;case Int32Array:return Math.max(a/2147483647,-1);case Int16Array:return Math.max(a/32767,-1);case Int8Array:return Math.max(a/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function Ze(a,e){switch(e.constructor){case Float32Array:return a;case Uint32Array:return Math.round(a*4294967295);case Uint16Array:return Math.round(a*65535);case Uint8Array:return Math.round(a*255);case Int32Array:return Math.round(a*2147483647);case Int16Array:return Math.round(a*32767);case Int8Array:return Math.round(a*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var Lc={DEG2RAD:Di,RAD2DEG:Ra,generateUUID:un,clamp:He,euclideanModulo:Uc,mapLinear:lf,inverseLerp:hf,lerp:Fi,damp:df,pingpong:ff,smoothstep:uf,smootherstep:pf,randInt:bf,randFloat:mf,randFloatSpread:gf,seededRandom:xf,degToRad:yf,radToDeg:vf,isPowerOfTwo:_f,ceilPowerOfTwo:Mf,floorPowerOfTwo:Sf,setQuaternionFromProperEuler:wf,normalize:Ze,denormalize:dn},Le=class a{static{a.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,i=e.elements;return this.x=i[0]*t+i[3]*n+i[6],this.y=i[1]*t+i[4]*n+i[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=He(this.x,e.x,t.x),this.y=He(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=He(this.x,e,t),this.y=He(this.y,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(He(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(He(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),i=Math.sin(t),s=this.x-e.x,r=this.y-e.y;return this.x=s*n-r*i+e.x,this.y=s*i+r*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},Jt=class{constructor(e=0,t=0,n=0,i=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=i}static slerpFlat(e,t,n,i,s,r,o){let l=n[i+0],c=n[i+1],h=n[i+2],d=n[i+3],f=s[r+0],b=s[r+1],g=s[r+2],y=s[r+3];if(d!==y||l!==f||c!==b||h!==g){let p=l*f+c*b+h*g+d*y;p<0&&(f=-f,b=-b,g=-g,y=-y,p=-p);let u=1-o;if(p<.9995){let m=Math.acos(p),M=Math.sin(m);u=Math.sin(u*m)/M,o=Math.sin(o*m)/M,l=l*u+f*o,c=c*u+b*o,h=h*u+g*o,d=d*u+y*o}else{l=l*u+f*o,c=c*u+b*o,h=h*u+g*o,d=d*u+y*o;let m=1/Math.sqrt(l*l+c*c+h*h+d*d);l*=m,c*=m,h*=m,d*=m}}e[t]=l,e[t+1]=c,e[t+2]=h,e[t+3]=d}static multiplyQuaternionsFlat(e,t,n,i,s,r){let o=n[i],l=n[i+1],c=n[i+2],h=n[i+3],d=s[r],f=s[r+1],b=s[r+2],g=s[r+3];return e[t]=o*g+h*d+l*b-c*f,e[t+1]=l*g+h*f+c*d-o*b,e[t+2]=c*g+h*b+o*f-l*d,e[t+3]=h*g-o*d-l*f-c*b,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,i){return this._x=e,this._y=t,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let n=e._x,i=e._y,s=e._z,r=e._order,o=Math.cos,l=Math.sin,c=o(n/2),h=o(i/2),d=o(s/2),f=l(n/2),b=l(i/2),g=l(s/2);switch(r){case"XYZ":this._x=f*h*d+c*b*g,this._y=c*b*d-f*h*g,this._z=c*h*g+f*b*d,this._w=c*h*d-f*b*g;break;case"YXZ":this._x=f*h*d+c*b*g,this._y=c*b*d-f*h*g,this._z=c*h*g-f*b*d,this._w=c*h*d+f*b*g;break;case"ZXY":this._x=f*h*d-c*b*g,this._y=c*b*d+f*h*g,this._z=c*h*g+f*b*d,this._w=c*h*d-f*b*g;break;case"ZYX":this._x=f*h*d-c*b*g,this._y=c*b*d+f*h*g,this._z=c*h*g-f*b*d,this._w=c*h*d+f*b*g;break;case"YZX":this._x=f*h*d+c*b*g,this._y=c*b*d+f*h*g,this._z=c*h*g-f*b*d,this._w=c*h*d-f*b*g;break;case"XZY":this._x=f*h*d-c*b*g,this._y=c*b*d-f*h*g,this._z=c*h*g+f*b*d,this._w=c*h*d+f*b*g;break;default:ve("Quaternion: .setFromEuler() encountered an unknown order: "+r)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let n=t/2,i=Math.sin(n);return this._x=e.x*i,this._y=e.y*i,this._z=e.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],i=t[4],s=t[8],r=t[1],o=t[5],l=t[9],c=t[2],h=t[6],d=t[10],f=n+o+d;if(f>0){let b=.5/Math.sqrt(f+1);this._w=.25/b,this._x=(h-l)*b,this._y=(s-c)*b,this._z=(r-i)*b}else if(n>o&&n>d){let b=2*Math.sqrt(1+n-o-d);this._w=(h-l)/b,this._x=.25*b,this._y=(i+r)/b,this._z=(s+c)/b}else if(o>d){let b=2*Math.sqrt(1+o-n-d);this._w=(s-c)/b,this._x=(i+r)/b,this._y=.25*b,this._z=(l+h)/b}else{let b=2*Math.sqrt(1+d-n-o);this._w=(r-i)/b,this._x=(s+c)/b,this._y=(l+h)/b,this._z=.25*b}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(He(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let i=Math.min(1,t/n);return this.slerp(e,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let n=e._x,i=e._y,s=e._z,r=e._w,o=t._x,l=t._y,c=t._z,h=t._w;return this._x=n*h+r*o+i*c-s*l,this._y=i*h+r*l+s*o-n*c,this._z=s*h+r*c+n*l-i*o,this._w=r*h-n*o-i*l-s*c,this._onChangeCallback(),this}slerp(e,t){let n=e._x,i=e._y,s=e._z,r=e._w,o=this.dot(e);o<0&&(n=-n,i=-i,s=-s,r=-r,o=-o);let l=1-t;if(o<.9995){let c=Math.acos(o),h=Math.sin(c);l=Math.sin(l*c)/h,t=Math.sin(t*c)/h,this._x=this._x*l+n*t,this._y=this._y*l+i*t,this._z=this._z*l+s*t,this._w=this._w*l+r*t,this._onChangeCallback()}else this._x=this._x*l+n*t,this._y=this._y*l+i*t,this._z=this._z*l+s*t,this._w=this._w*l+r*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),i=Math.sqrt(1-n),s=Math.sqrt(n);return this.set(i*Math.sin(e),i*Math.cos(e),s*Math.sin(t),s*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},U=class a{static{a.prototype.isVector3=!0}constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Gl.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Gl.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,i=this.z,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6]*i,this.y=s[1]*t+s[4]*n+s[7]*i,this.z=s[2]*t+s[5]*n+s[8]*i,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,s=e.elements,r=1/(s[3]*t+s[7]*n+s[11]*i+s[15]);return this.x=(s[0]*t+s[4]*n+s[8]*i+s[12])*r,this.y=(s[1]*t+s[5]*n+s[9]*i+s[13])*r,this.z=(s[2]*t+s[6]*n+s[10]*i+s[14])*r,this}applyQuaternion(e){let t=this.x,n=this.y,i=this.z,s=e.x,r=e.y,o=e.z,l=e.w,c=2*(r*i-o*n),h=2*(o*t-s*i),d=2*(s*n-r*t);return this.x=t+l*c+r*d-o*h,this.y=n+l*h+o*c-s*d,this.z=i+l*d+s*h-r*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,i=this.z,s=e.elements;return this.x=s[0]*t+s[4]*n+s[8]*i,this.y=s[1]*t+s[5]*n+s[9]*i,this.z=s[2]*t+s[6]*n+s[10]*i,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=He(this.x,e.x,t.x),this.y=He(this.y,e.y,t.y),this.z=He(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=He(this.x,e,t),this.y=He(this.y,e,t),this.z=He(this.z,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(He(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let n=e.x,i=e.y,s=e.z,r=t.x,o=t.y,l=t.z;return this.x=i*l-s*o,this.y=s*r-n*l,this.z=n*o-i*r,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return Co.copy(this).projectOnVector(e),this.sub(Co)}reflect(e){return this.sub(Co.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(He(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,i=this.z-e.z;return t*t+n*n+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let i=Math.sin(t)*e;return this.x=i*Math.sin(n),this.y=Math.cos(t)*e,this.z=i*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),i=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=i,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},Co=new U,Gl=new Jt,Pe=class a{static{a.prototype.isMatrix3=!0}constructor(e,t,n,i,s,r,o,l,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,i,s,r,o,l,c)}set(e,t,n,i,s,r,o,l,c){let h=this.elements;return h[0]=e,h[1]=i,h[2]=o,h[3]=t,h[4]=s,h[5]=l,h[6]=n,h[7]=r,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,s=this.elements,r=n[0],o=n[3],l=n[6],c=n[1],h=n[4],d=n[7],f=n[2],b=n[5],g=n[8],y=i[0],p=i[3],u=i[6],m=i[1],M=i[4],x=i[7],S=i[2],w=i[5],T=i[8];return s[0]=r*y+o*m+l*S,s[3]=r*p+o*M+l*w,s[6]=r*u+o*x+l*T,s[1]=c*y+h*m+d*S,s[4]=c*p+h*M+d*w,s[7]=c*u+h*x+d*T,s[2]=f*y+b*m+g*S,s[5]=f*p+b*M+g*w,s[8]=f*u+b*x+g*T,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],i=e[2],s=e[3],r=e[4],o=e[5],l=e[6],c=e[7],h=e[8];return t*r*h-t*o*c-n*s*h+n*o*l+i*s*c-i*r*l}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],s=e[3],r=e[4],o=e[5],l=e[6],c=e[7],h=e[8],d=h*r-o*c,f=o*l-h*s,b=c*s-r*l,g=t*d+n*f+i*b;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);let y=1/g;return e[0]=d*y,e[1]=(i*c-h*n)*y,e[2]=(o*n-i*r)*y,e[3]=f*y,e[4]=(h*t-i*l)*y,e[5]=(i*s-o*t)*y,e[6]=b*y,e[7]=(n*l-c*t)*y,e[8]=(r*t-n*s)*y,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,i,s,r,o){let l=Math.cos(s),c=Math.sin(s);return this.set(n*l,n*c,-n*(l*r+c*o)+r+e,-i*c,i*l,-i*(-c*r+l*o)+o+t,0,0,1),this}scale(e,t){return Sa("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(ko.makeScale(e,t)),this}rotate(e){return Sa("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(ko.makeRotation(-e)),this}translate(e,t){return Sa("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(ko.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<9;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}},ko=new Pe,Vl=new Pe().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Wl=new Pe().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Af(){let a={enabled:!0,workingColorSpace:Ot,spaces:{},convert:function(i,s,r){return this.enabled===!1||s===r||!s||!r||(this.spaces[s].transfer===Je&&(i.r=zn(i.r),i.g=zn(i.g),i.b=zn(i.b)),this.spaces[s].primaries!==this.spaces[r].primaries&&(i.applyMatrix3(this.spaces[s].toXYZ),i.applyMatrix3(this.spaces[r].fromXYZ)),this.spaces[r].transfer===Je&&(i.r=ti(i.r),i.g=ti(i.g),i.b=ti(i.b))),i},workingToColorSpace:function(i,s){return this.convert(i,this.workingColorSpace,s)},colorSpaceToWorking:function(i,s){return this.convert(i,s,this.workingColorSpace)},getPrimaries:function(i){return this.spaces[i].primaries},getTransfer:function(i){return i===Kn?Ui:this.spaces[i].transfer},getToneMappingMode:function(i){return this.spaces[i].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(i,s=this.workingColorSpace){return i.fromArray(this.spaces[s].luminanceCoefficients)},define:function(i){Object.assign(this.spaces,i)},_getMatrix:function(i,s,r){return i.copy(this.spaces[s].toXYZ).multiply(this.spaces[r].fromXYZ)},_getDrawingBufferColorSpace:function(i){return this.spaces[i].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(i=this.workingColorSpace){return this.spaces[i].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(i,s){return Sa("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),a.workingToColorSpace(i,s)},toWorkingColorSpace:function(i,s){return Sa("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),a.colorSpaceToWorking(i,s)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],n=[.3127,.329];return a.define({[Ot]:{primaries:e,whitePoint:n,transfer:Ui,toXYZ:Vl,fromXYZ:Wl,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:wt},outputColorSpaceConfig:{drawingBufferColorSpace:wt}},[wt]:{primaries:e,whitePoint:n,transfer:Je,toXYZ:Vl,fromXYZ:Wl,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:wt}}}),a}var ze=Af();function zn(a){return a<.04045?a*.0773993808:Math.pow(a*.9478672986+.0521327014,2.4)}function ti(a){return a<.0031308?a*12.92:1.055*Math.pow(a,.41666)-.055}var ja,cr=class{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{ja===void 0&&(ja=ii("canvas")),ja.width=e.width,ja.height=e.height;let i=ja.getContext("2d");e instanceof ImageData?i.putImageData(e,0,0):i.drawImage(e,0,0,e.width,e.height),n=ja}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=ii("canvas");t.width=e.width,t.height=e.height;let n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);let i=n.getImageData(0,0,e.width,e.height),s=i.data;for(let r=0;r<s.length;r++)s[r]=zn(s[r]/255)*255;return n.putImageData(i,0,0),t}else if(e.data){let t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(zn(t[n]/255)*255):t[n]=zn(t[n]);return{data:t,width:e.width,height:e.height}}else return ve("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},Ef=0,ri=class{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Ef++}),this.uuid=un(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let s;if(Array.isArray(i)){s=[];for(let r=0,o=i.length;r<o;r++)i[r].isDataTexture?s.push(Po(i[r].image)):s.push(Po(i[r]))}else s=Po(i);n.url=s}return t||(e.images[this.uuid]=n),n}};function Po(a){return typeof HTMLImageElement<"u"&&a instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&a instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&a instanceof ImageBitmap?cr.getDataURL(a):a.data?{data:Array.from(a.data),width:a.width,height:a.height,type:a.data.constructor.name}:(ve("Texture: Unable to serialize Texture."),{})}var Tf=0,No=new U,It=class a extends En{constructor(e=a.DEFAULT_IMAGE,t=a.DEFAULT_MAPPING,n=an,i=an,s=mt,r=gn,o=en,l=Wt,c=a.DEFAULT_ANISOTROPY,h=Kn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Tf++}),this.uuid=un(),this.name="",this.source=new ri(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=i,this.magFilter=s,this.minFilter=r,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new Le(0,0),this.repeat=new Le(1,1),this.center=new Le(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Pe,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(No).x}get height(){return this.source.getSize(No).y}get depth(){return this.source.getSize(No).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let n=e[t];if(n===void 0){ve(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let i=this[t];if(i===void 0){ve(`Texture.setValues(): property '${t}' does not exist.`);continue}i&&n&&i.isVector2&&n.isVector2||i&&n&&i.isVector3&&n.isVector3||i&&n&&i.isMatrix3&&n.isMatrix3?i.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==Tc)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case oa:e.x=e.x-Math.floor(e.x);break;case an:e.x=e.x<0?0:1;break;case ni:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case oa:e.y=e.y-Math.floor(e.y);break;case an:e.y=e.y<0?0:1;break;case ni:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};It.DEFAULT_IMAGE=null;It.DEFAULT_MAPPING=Tc;It.DEFAULT_ANISOTROPY=1;var Qe=class a{static{a.prototype.isVector4=!0}constructor(e=0,t=0,n=0,i=1){this.x=e,this.y=t,this.z=n,this.w=i}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,i){return this.x=e,this.y=t,this.z=n,this.w=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,s=this.w,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*i+r[12]*s,this.y=r[1]*t+r[5]*n+r[9]*i+r[13]*s,this.z=r[2]*t+r[6]*n+r[10]*i+r[14]*s,this.w=r[3]*t+r[7]*n+r[11]*i+r[15]*s,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,i,s,l=e.elements,c=l[0],h=l[4],d=l[8],f=l[1],b=l[5],g=l[9],y=l[2],p=l[6],u=l[10];if(Math.abs(h-f)<.01&&Math.abs(d-y)<.01&&Math.abs(g-p)<.01){if(Math.abs(h+f)<.1&&Math.abs(d+y)<.1&&Math.abs(g+p)<.1&&Math.abs(c+b+u-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let M=(c+1)/2,x=(b+1)/2,S=(u+1)/2,w=(h+f)/4,T=(d+y)/4,v=(g+p)/4;return M>x&&M>S?M<.01?(n=0,i=.707106781,s=.707106781):(n=Math.sqrt(M),i=w/n,s=T/n):x>S?x<.01?(n=.707106781,i=0,s=.707106781):(i=Math.sqrt(x),n=w/i,s=v/i):S<.01?(n=.707106781,i=.707106781,s=0):(s=Math.sqrt(S),n=T/s,i=v/s),this.set(n,i,s,t),this}let m=Math.sqrt((p-g)*(p-g)+(d-y)*(d-y)+(f-h)*(f-h));return Math.abs(m)<.001&&(m=1),this.x=(p-g)/m,this.y=(d-y)/m,this.z=(f-h)/m,this.w=Math.acos((c+b+u-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=He(this.x,e.x,t.x),this.y=He(this.y,e.y,t.y),this.z=He(this.z,e.z,t.z),this.w=He(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=He(this.x,e,t),this.y=He(this.y,e,t),this.z=He(this.z,e,t),this.w=He(this.w,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(He(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},lr=class extends En{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:mt,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new Qe(0,0,e,t),this.scissorTest=!1,this.viewport=new Qe(0,0,e,t),this.textures=[];let i={width:e,height:t,depth:n.depth},s=new It(i),r=n.count;for(let o=0;o<r;o++)this.textures[o]=s.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:mt,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let i=0,s=this.textures.length;i<s;i++)this.textures[i].image.width=e,this.textures[i].image.height=t,this.textures[i].image.depth=n,this.textures[i].isData3DTexture!==!0&&(this.textures[i].isArrayTexture=this.textures[i].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let i=Object.assign({},e.textures[t].image);this.textures[t].source=new ri(i)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},Yt=class extends lr{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}},Oi=class extends It{constructor(e=null,t=1,n=1,i=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=bt,this.minFilter=bt,this.wrapR=an,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}};var hr=class extends It{constructor(e=null,t=1,n=1,i=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=bt,this.minFilter=bt,this.wrapR=an,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Ue=class a{static{a.prototype.isMatrix4=!0}constructor(e,t,n,i,s,r,o,l,c,h,d,f,b,g,y,p){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,i,s,r,o,l,c,h,d,f,b,g,y,p)}set(e,t,n,i,s,r,o,l,c,h,d,f,b,g,y,p){let u=this.elements;return u[0]=e,u[4]=t,u[8]=n,u[12]=i,u[1]=s,u[5]=r,u[9]=o,u[13]=l,u[2]=c,u[6]=h,u[10]=d,u[14]=f,u[3]=b,u[7]=g,u[11]=y,u[15]=p,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new a().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,n=e.elements,i=1/Ha.setFromMatrixColumn(e,0).length(),s=1/Ha.setFromMatrixColumn(e,1).length(),r=1/Ha.setFromMatrixColumn(e,2).length();return t[0]=n[0]*i,t[1]=n[1]*i,t[2]=n[2]*i,t[3]=0,t[4]=n[4]*s,t[5]=n[5]*s,t[6]=n[6]*s,t[7]=0,t[8]=n[8]*r,t[9]=n[9]*r,t[10]=n[10]*r,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,n=e.x,i=e.y,s=e.z,r=Math.cos(n),o=Math.sin(n),l=Math.cos(i),c=Math.sin(i),h=Math.cos(s),d=Math.sin(s);if(e.order==="XYZ"){let f=r*h,b=r*d,g=o*h,y=o*d;t[0]=l*h,t[4]=-l*d,t[8]=c,t[1]=b+g*c,t[5]=f-y*c,t[9]=-o*l,t[2]=y-f*c,t[6]=g+b*c,t[10]=r*l}else if(e.order==="YXZ"){let f=l*h,b=l*d,g=c*h,y=c*d;t[0]=f+y*o,t[4]=g*o-b,t[8]=r*c,t[1]=r*d,t[5]=r*h,t[9]=-o,t[2]=b*o-g,t[6]=y+f*o,t[10]=r*l}else if(e.order==="ZXY"){let f=l*h,b=l*d,g=c*h,y=c*d;t[0]=f-y*o,t[4]=-r*d,t[8]=g+b*o,t[1]=b+g*o,t[5]=r*h,t[9]=y-f*o,t[2]=-r*c,t[6]=o,t[10]=r*l}else if(e.order==="ZYX"){let f=r*h,b=r*d,g=o*h,y=o*d;t[0]=l*h,t[4]=g*c-b,t[8]=f*c+y,t[1]=l*d,t[5]=y*c+f,t[9]=b*c-g,t[2]=-c,t[6]=o*l,t[10]=r*l}else if(e.order==="YZX"){let f=r*l,b=r*c,g=o*l,y=o*c;t[0]=l*h,t[4]=y-f*d,t[8]=g*d+b,t[1]=d,t[5]=r*h,t[9]=-o*h,t[2]=-c*h,t[6]=b*d+g,t[10]=f-y*d}else if(e.order==="XZY"){let f=r*l,b=r*c,g=o*l,y=o*c;t[0]=l*h,t[4]=-d,t[8]=c*h,t[1]=f*d+y,t[5]=r*h,t[9]=b*d-g,t[2]=g*d-b,t[6]=o*h,t[10]=y*d+f}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Rf,e,If)}lookAt(e,t,n){let i=this.elements;return qt.subVectors(e,t),qt.lengthSq()===0&&(qt.z=1),qt.normalize(),$n.crossVectors(n,qt),$n.lengthSq()===0&&(Math.abs(n.z)===1?qt.x+=1e-4:qt.z+=1e-4,qt.normalize(),$n.crossVectors(n,qt)),$n.normalize(),As.crossVectors(qt,$n),i[0]=$n.x,i[4]=As.x,i[8]=qt.x,i[1]=$n.y,i[5]=As.y,i[9]=qt.y,i[2]=$n.z,i[6]=As.z,i[10]=qt.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,s=this.elements,r=n[0],o=n[4],l=n[8],c=n[12],h=n[1],d=n[5],f=n[9],b=n[13],g=n[2],y=n[6],p=n[10],u=n[14],m=n[3],M=n[7],x=n[11],S=n[15],w=i[0],T=i[4],v=i[8],E=i[12],C=i[1],I=i[5],k=i[9],O=i[13],V=i[2],P=i[6],j=i[10],B=i[14],K=i[3],Q=i[7],ee=i[11],ae=i[15];return s[0]=r*w+o*C+l*V+c*K,s[4]=r*T+o*I+l*P+c*Q,s[8]=r*v+o*k+l*j+c*ee,s[12]=r*E+o*O+l*B+c*ae,s[1]=h*w+d*C+f*V+b*K,s[5]=h*T+d*I+f*P+b*Q,s[9]=h*v+d*k+f*j+b*ee,s[13]=h*E+d*O+f*B+b*ae,s[2]=g*w+y*C+p*V+u*K,s[6]=g*T+y*I+p*P+u*Q,s[10]=g*v+y*k+p*j+u*ee,s[14]=g*E+y*O+p*B+u*ae,s[3]=m*w+M*C+x*V+S*K,s[7]=m*T+M*I+x*P+S*Q,s[11]=m*v+M*k+x*j+S*ee,s[15]=m*E+M*O+x*B+S*ae,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],i=e[8],s=e[12],r=e[1],o=e[5],l=e[9],c=e[13],h=e[2],d=e[6],f=e[10],b=e[14],g=e[3],y=e[7],p=e[11],u=e[15],m=l*b-c*f,M=o*b-c*d,x=o*f-l*d,S=r*b-c*h,w=r*f-l*h,T=r*d-o*h;return t*(y*m-p*M+u*x)-n*(g*m-p*S+u*w)+i*(g*M-y*S+u*T)-s*(g*x-y*w+p*T)}determinantAffine(){let e=this.elements,t=e[0],n=e[4],i=e[8],s=e[1],r=e[5],o=e[9],l=e[2],c=e[6],h=e[10];return t*(r*h-o*c)-n*(s*h-o*l)+i*(s*c-r*l)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let i=this.elements;return e.isVector3?(i[12]=e.x,i[13]=e.y,i[14]=e.z):(i[12]=e,i[13]=t,i[14]=n),this}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],s=e[3],r=e[4],o=e[5],l=e[6],c=e[7],h=e[8],d=e[9],f=e[10],b=e[11],g=e[12],y=e[13],p=e[14],u=e[15],m=t*o-n*r,M=t*l-i*r,x=t*c-s*r,S=n*l-i*o,w=n*c-s*o,T=i*c-s*l,v=h*y-d*g,E=h*p-f*g,C=h*u-b*g,I=d*p-f*y,k=d*u-b*y,O=f*u-b*p,V=m*O-M*k+x*I+S*C-w*E+T*v;if(V===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let P=1/V;return e[0]=(o*O-l*k+c*I)*P,e[1]=(i*k-n*O-s*I)*P,e[2]=(y*T-p*w+u*S)*P,e[3]=(f*w-d*T-b*S)*P,e[4]=(l*C-r*O-c*E)*P,e[5]=(t*O-i*C+s*E)*P,e[6]=(p*x-g*T-u*M)*P,e[7]=(h*T-f*x+b*M)*P,e[8]=(r*k-o*C+c*v)*P,e[9]=(n*C-t*k-s*v)*P,e[10]=(g*w-y*x+u*m)*P,e[11]=(d*x-h*w-b*m)*P,e[12]=(o*E-r*I-l*v)*P,e[13]=(t*I-n*E+i*v)*P,e[14]=(y*M-g*S-p*m)*P,e[15]=(h*S-d*M+f*m)*P,this}scale(e){let t=this.elements,n=e.x,i=e.y,s=e.z;return t[0]*=n,t[4]*=i,t[8]*=s,t[1]*=n,t[5]*=i,t[9]*=s,t[2]*=n,t[6]*=i,t[10]*=s,t[3]*=n,t[7]*=i,t[11]*=s,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],i=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,i))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),i=Math.sin(t),s=1-n,r=e.x,o=e.y,l=e.z,c=s*r,h=s*o;return this.set(c*r+n,c*o-i*l,c*l+i*o,0,c*o+i*l,h*o+n,h*l-i*r,0,c*l-i*o,h*l+i*r,s*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,i,s,r){return this.set(1,n,s,0,e,1,r,0,t,i,1,0,0,0,0,1),this}compose(e,t,n){let i=this.elements,s=t._x,r=t._y,o=t._z,l=t._w,c=s+s,h=r+r,d=o+o,f=s*c,b=s*h,g=s*d,y=r*h,p=r*d,u=o*d,m=l*c,M=l*h,x=l*d,S=n.x,w=n.y,T=n.z;return i[0]=(1-(y+u))*S,i[1]=(b+x)*S,i[2]=(g-M)*S,i[3]=0,i[4]=(b-x)*w,i[5]=(1-(f+u))*w,i[6]=(p+m)*w,i[7]=0,i[8]=(g+M)*T,i[9]=(p-m)*T,i[10]=(1-(f+y))*T,i[11]=0,i[12]=e.x,i[13]=e.y,i[14]=e.z,i[15]=1,this}decompose(e,t,n){let i=this.elements;e.x=i[12],e.y=i[13],e.z=i[14];let s=this.determinantAffine();if(s===0)return n.set(1,1,1),t.identity(),this;let r=Ha.set(i[0],i[1],i[2]).length(),o=Ha.set(i[4],i[5],i[6]).length(),l=Ha.set(i[8],i[9],i[10]).length();s<0&&(r=-r),cn.copy(this);let c=1/r,h=1/o,d=1/l;return cn.elements[0]*=c,cn.elements[1]*=c,cn.elements[2]*=c,cn.elements[4]*=h,cn.elements[5]*=h,cn.elements[6]*=h,cn.elements[8]*=d,cn.elements[9]*=d,cn.elements[10]*=d,t.setFromRotationMatrix(cn),n.x=r,n.y=o,n.z=l,this}makePerspective(e,t,n,i,s,r,o=fn,l=!1){let c=this.elements,h=2*s/(t-e),d=2*s/(n-i),f=(t+e)/(t-e),b=(n+i)/(n-i),g,y;if(l)g=s/(r-s),y=r*s/(r-s);else if(o===fn)g=-(r+s)/(r-s),y=-2*r*s/(r-s);else if(o===ai)g=-r/(r-s),y=-r*s/(r-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=f,c[12]=0,c[1]=0,c[5]=d,c[9]=b,c[13]=0,c[2]=0,c[6]=0,c[10]=g,c[14]=y,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,i,s,r,o=fn,l=!1){let c=this.elements,h=2/(t-e),d=2/(n-i),f=-(t+e)/(t-e),b=-(n+i)/(n-i),g,y;if(l)g=1/(r-s),y=r/(r-s);else if(o===fn)g=-2/(r-s),y=-(r+s)/(r-s);else if(o===ai)g=-1/(r-s),y=-s/(r-s);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=0,c[12]=f,c[1]=0,c[5]=d,c[9]=0,c[13]=b,c[2]=0,c[6]=0,c[10]=g,c[14]=y,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<16;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}},Ha=new U,cn=new Ue,Rf=new U(0,0,0),If=new U(1,1,1),$n=new U,As=new U,qt=new U,Xl=new Ue,ql=new Jt,jn=class a{constructor(e=0,t=0,n=0,i=a.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=i}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,i=this._order){return this._x=e,this._y=t,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let i=e.elements,s=i[0],r=i[4],o=i[8],l=i[1],c=i[5],h=i[9],d=i[2],f=i[6],b=i[10];switch(t){case"XYZ":this._y=Math.asin(He(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,b),this._z=Math.atan2(-r,s)):(this._x=Math.atan2(f,c),this._z=0);break;case"YXZ":this._x=Math.asin(-He(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,b),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-d,s),this._z=0);break;case"ZXY":this._x=Math.asin(He(f,-1,1)),Math.abs(f)<.9999999?(this._y=Math.atan2(-d,b),this._z=Math.atan2(-r,c)):(this._y=0,this._z=Math.atan2(l,s));break;case"ZYX":this._y=Math.asin(-He(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(f,b),this._z=Math.atan2(l,s)):(this._x=0,this._z=Math.atan2(-r,c));break;case"YZX":this._z=Math.asin(He(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-d,s)):(this._x=0,this._y=Math.atan2(o,b));break;case"XZY":this._z=Math.asin(-He(r,-1,1)),Math.abs(r)<.9999999?(this._x=Math.atan2(f,c),this._y=Math.atan2(o,s)):(this._x=Math.atan2(-h,b),this._y=0);break;default:ve("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return Xl.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Xl,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return ql.setFromEuler(this),this.setFromQuaternion(ql,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};jn.DEFAULT_ORDER="XYZ";var Bi=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},Cf=0,Kl=new U,Ga=new Jt,Dn=new Ue,Es=new U,Ei=new U,kf=new U,Pf=new Jt,Jl=new U(1,0,0),Yl=new U(0,1,0),Zl=new U(0,0,1),Ql={type:"added"},Nf={type:"removed"},Va={type:"childadded",child:null},Do={type:"childremoved",child:null},rt=class a extends En{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Cf++}),this.uuid=un(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=a.DEFAULT_UP.clone();let e=new U,t=new jn,n=new Jt,i=new U(1,1,1);function s(){n.setFromEuler(t,!1)}function r(){t.setFromQuaternion(n,void 0,!1)}t._onChange(s),n._onChange(r),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new Ue},normalMatrix:{value:new Pe}}),this.matrix=new Ue,this.matrixWorld=new Ue,this.matrixAutoUpdate=a.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=a.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Bi,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return Ga.setFromAxisAngle(e,t),this.quaternion.multiply(Ga),this}rotateOnWorldAxis(e,t){return Ga.setFromAxisAngle(e,t),this.quaternion.premultiply(Ga),this}rotateX(e){return this.rotateOnAxis(Jl,e)}rotateY(e){return this.rotateOnAxis(Yl,e)}rotateZ(e){return this.rotateOnAxis(Zl,e)}translateOnAxis(e,t){return Kl.copy(e).applyQuaternion(this.quaternion),this.position.add(Kl.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Jl,e)}translateY(e){return this.translateOnAxis(Yl,e)}translateZ(e){return this.translateOnAxis(Zl,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Dn.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?Es.copy(e):Es.set(e,t,n);let i=this.parent;this.updateWorldMatrix(!0,!1),Ei.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Dn.lookAt(Ei,Es,this.up):Dn.lookAt(Es,Ei,this.up),this.quaternion.setFromRotationMatrix(Dn),i&&(Dn.extractRotation(i.matrixWorld),Ga.setFromRotationMatrix(Dn),this.quaternion.premultiply(Ga.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(Ie("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Ql),Va.child=e,this.dispatchEvent(Va),Va.child=null):Ie("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Nf),Do.child=e,this.dispatchEvent(Do),Do.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),Dn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Dn.multiply(e.parent.matrixWorld)),e.applyMatrix4(Dn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Ql),Va.child=e,this.dispatchEvent(Va),Va.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,i=this.children.length;n<i;n++){let r=this.children[n].getObjectByProperty(e,t);if(r!==void 0)return r}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);let i=this.children;for(let s=0,r=i.length;s<r;s++)i[s].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ei,e,kf),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ei,Pf,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,n=e.y,i=e.z,s=this.matrix.elements;s[12]+=t-s[0]*t-s[4]*n-s[8]*i,s[13]+=n-s[1]*t-s[5]*n-s[9]*i,s[14]+=i-s[2]*t-s[6]*n-s[10]*i}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t,n=!1){let i=this.parent;if(e===!0&&i!==null&&i.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),t===!0){let s=this.children;for(let r=0,o=s.length;r<o;r++)s[r].updateWorldMatrix(!1,!0,n)}}toJSON(e){let t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let i={};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.castShadow===!0&&(i.castShadow=!0),this.receiveShadow===!0&&(i.receiveShadow=!0),this.visible===!1&&(i.visible=!1),this.frustumCulled===!1&&(i.frustumCulled=!1),this.renderOrder!==0&&(i.renderOrder=this.renderOrder),this.static!==!1&&(i.static=this.static),Object.keys(this.userData).length>0&&(i.userData=this.userData),i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),i.up=this.up.toArray(),this.pivot!==null&&(i.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(i.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(i.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(i.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(i.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(i.type="BatchedMesh",i.perObjectFrustumCulled=this.perObjectFrustumCulled,i.sortObjects=this.sortObjects,i.drawRanges=this._drawRanges,i.reservedRanges=this._reservedRanges,i.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),i.instanceInfo=this._instanceInfo.map(o=>({...o})),i.availableInstanceIds=this._availableInstanceIds.slice(),i.availableGeometryIds=this._availableGeometryIds.slice(),i.nextIndexStart=this._nextIndexStart,i.nextVertexStart=this._nextVertexStart,i.geometryCount=this._geometryCount,i.maxInstanceCount=this._maxInstanceCount,i.maxVertexCount=this._maxVertexCount,i.maxIndexCount=this._maxIndexCount,i.geometryInitialized=this._geometryInitialized,i.matricesTexture=this._matricesTexture.toJSON(e),i.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(i.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(i.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(i.boundingBox=this.boundingBox.toJSON()));function s(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?i.background=this.background.toJSON():this.background.isTexture&&(i.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(i.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){i.geometry=s(e.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let d=l[c];s(e.shapes,d)}else s(e.shapes,l)}}if(this.isSkinnedMesh&&(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(e.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(s(e.materials,this.material[l]));i.material=o}else i.material=s(e.materials,this.material);if(this.children.length>0){i.children=[];for(let o=0;o<this.children.length;o++)i.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){i.animations=[];for(let o=0;o<this.animations.length;o++){let l=this.animations[o];i.animations.push(s(e.animations,l))}}if(t){let o=r(e.geometries),l=r(e.materials),c=r(e.textures),h=r(e.images),d=r(e.shapes),f=r(e.skeletons),b=r(e.animations),g=r(e.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),d.length>0&&(n.shapes=d),f.length>0&&(n.skeletons=f),b.length>0&&(n.animations=b),g.length>0&&(n.nodes=g)}return n.object=i,n;function r(o){let l=[];for(let c in o){let h=o[c];delete h.metadata,l.push(h)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){let i=e.children[n];this.add(i.clone())}return this}};rt.DEFAULT_UP=new U(0,1,0);rt.DEFAULT_MATRIX_AUTO_UPDATE=!0;rt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var Ft=class extends rt{constructor(){super(),this.isGroup=!0,this.type="Group"}},Df={type:"move"},oi=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Ft,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Ft,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new U,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new U),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Ft,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new U,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new U,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let i=null,s=null,r=null,o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){r=!0;for(let y of e.hand.values()){let p=t.getJointPose(y,n),u=this._getHandJoint(c,y);p!==null&&(u.matrix.fromArray(p.transform.matrix),u.matrix.decompose(u.position,u.rotation,u.scale),u.matrixWorldNeedsUpdate=!0,u.jointRadius=p.radius),u.visible=p!==null}let h=c.joints["index-finger-tip"],d=c.joints["thumb-tip"],f=h.position.distanceTo(d.position),b=.02,g=.005;c.inputState.pinching&&f>b+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&f<=b-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(s=t.getPose(e.gripSpace,n),s!==null&&(l.matrix.fromArray(s.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,s.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(s.linearVelocity)):l.hasLinearVelocity=!1,s.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(s.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:e,target:this})));o!==null&&(i=t.getPose(e.targetRaySpace,n),i===null&&s!==null&&(i=s),i!==null&&(o.matrix.fromArray(i.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,i.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(i.linearVelocity)):o.hasLinearVelocity=!1,i.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(i.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(Df)))}return o!==null&&(o.visible=i!==null),l!==null&&(l.visible=s!==null),c!==null&&(c.visible=r!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new Ft;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}},rd={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},ea={h:0,s:0,l:0},Ts={h:0,s:0,l:0};function Fo(a,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?a+(e-a)*6*t:t<1/2?e:t<2/3?a+(e-a)*6*(2/3-t):a}var Re=class{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let i=e;i&&i.isColor?this.copy(i):typeof i=="number"?this.setHex(i):typeof i=="string"&&this.setStyle(i)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=wt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,ze.colorSpaceToWorking(this,t),this}setRGB(e,t,n,i=ze.workingColorSpace){return this.r=e,this.g=t,this.b=n,ze.colorSpaceToWorking(this,i),this}setHSL(e,t,n,i=ze.workingColorSpace){if(e=Uc(e,1),t=He(t,0,1),n=He(n,0,1),t===0)this.r=this.g=this.b=n;else{let s=n<=.5?n*(1+t):n+t-n*t,r=2*n-s;this.r=Fo(r,s,e+1/3),this.g=Fo(r,s,e),this.b=Fo(r,s,e-1/3)}return ze.colorSpaceToWorking(this,i),this}setStyle(e,t=wt){function n(s){s!==void 0&&parseFloat(s)<1&&ve("Color: Alpha component of "+e+" will be ignored.")}let i;if(i=/^(\w+)\(([^\)]*)\)/.exec(e)){let s,r=i[1],o=i[2];switch(r){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,t);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,t);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,t);break;default:ve("Color: Unknown color model "+e)}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(e)){let s=i[1],r=s.length;if(r===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,t);if(r===6)return this.setHex(parseInt(s,16),t);ve("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=wt){let n=rd[e.toLowerCase()];return n!==void 0?this.setHex(n,t):ve("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=zn(e.r),this.g=zn(e.g),this.b=zn(e.b),this}copyLinearToSRGB(e){return this.r=ti(e.r),this.g=ti(e.g),this.b=ti(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=wt){return ze.workingToColorSpace(Dt.copy(this),e),Math.round(He(Dt.r*255,0,255))*65536+Math.round(He(Dt.g*255,0,255))*256+Math.round(He(Dt.b*255,0,255))}getHexString(e=wt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=ze.workingColorSpace){ze.workingToColorSpace(Dt.copy(this),t);let n=Dt.r,i=Dt.g,s=Dt.b,r=Math.max(n,i,s),o=Math.min(n,i,s),l,c,h=(o+r)/2;if(o===r)l=0,c=0;else{let d=r-o;switch(c=h<=.5?d/(r+o):d/(2-r-o),r){case n:l=(i-s)/d+(i<s?6:0);break;case i:l=(s-n)/d+2;break;case s:l=(n-i)/d+4;break}l/=6}return e.h=l,e.s=c,e.l=h,e}getRGB(e,t=ze.workingColorSpace){return ze.workingToColorSpace(Dt.copy(this),t),e.r=Dt.r,e.g=Dt.g,e.b=Dt.b,e}getStyle(e=wt){ze.workingToColorSpace(Dt.copy(this),e);let t=Dt.r,n=Dt.g,i=Dt.b;return e!==wt?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${i.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(i*255)})`}offsetHSL(e,t,n){return this.getHSL(ea),this.setHSL(ea.h+e,ea.s+t,ea.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(ea),e.getHSL(Ts);let n=Fi(ea.h,Ts.h,t),i=Fi(ea.s,Ts.s,t),s=Fi(ea.l,Ts.l,t);return this.setHSL(n,i,s),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,i=this.b,s=e.elements;return this.r=s[0]*t+s[3]*n+s[6]*i,this.g=s[1]*t+s[4]*n+s[7]*i,this.b=s[2]*t+s[5]*n+s[8]*i,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Dt=new Re;Re.NAMES=rd;var zi=class extends rt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new jn,this.environmentIntensity=1,this.environmentRotation=new jn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}},ln=new U,Fn=new U,Uo=new U,Un=new U,Wa=new U,Xa=new U,$l=new U,Lo=new U,Oo=new U,Bo=new U,zo=new Qe,jo=new Qe,Ho=new Qe,sa=class a{constructor(e=new U,t=new U,n=new U){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,i){i.subVectors(n,t),ln.subVectors(e,t),i.cross(ln);let s=i.lengthSq();return s>0?i.multiplyScalar(1/Math.sqrt(s)):i.set(0,0,0)}static getBarycoord(e,t,n,i,s){ln.subVectors(i,t),Fn.subVectors(n,t),Uo.subVectors(e,t);let r=ln.dot(ln),o=ln.dot(Fn),l=ln.dot(Uo),c=Fn.dot(Fn),h=Fn.dot(Uo),d=r*c-o*o;if(d===0)return s.set(0,0,0),null;let f=1/d,b=(c*l-o*h)*f,g=(r*h-o*l)*f;return s.set(1-b-g,g,b)}static containsPoint(e,t,n,i){return this.getBarycoord(e,t,n,i,Un)===null?!1:Un.x>=0&&Un.y>=0&&Un.x+Un.y<=1}static getInterpolation(e,t,n,i,s,r,o,l){return this.getBarycoord(e,t,n,i,Un)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(s,Un.x),l.addScaledVector(r,Un.y),l.addScaledVector(o,Un.z),l)}static getInterpolatedAttribute(e,t,n,i,s,r){return zo.setScalar(0),jo.setScalar(0),Ho.setScalar(0),zo.fromBufferAttribute(e,t),jo.fromBufferAttribute(e,n),Ho.fromBufferAttribute(e,i),r.setScalar(0),r.addScaledVector(zo,s.x),r.addScaledVector(jo,s.y),r.addScaledVector(Ho,s.z),r}static isFrontFacing(e,t,n,i){return ln.subVectors(n,t),Fn.subVectors(e,t),ln.cross(Fn).dot(i)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,i){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[i]),this}setFromAttributeAndIndices(e,t,n,i){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,i),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return ln.subVectors(this.c,this.b),Fn.subVectors(this.a,this.b),ln.cross(Fn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return a.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return a.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,i,s){return a.getInterpolation(e,this.a,this.b,this.c,t,n,i,s)}containsPoint(e){return a.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return a.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,i=this.b,s=this.c,r,o;Wa.subVectors(i,n),Xa.subVectors(s,n),Lo.subVectors(e,n);let l=Wa.dot(Lo),c=Xa.dot(Lo);if(l<=0&&c<=0)return t.copy(n);Oo.subVectors(e,i);let h=Wa.dot(Oo),d=Xa.dot(Oo);if(h>=0&&d<=h)return t.copy(i);let f=l*d-h*c;if(f<=0&&l>=0&&h<=0)return r=l/(l-h),t.copy(n).addScaledVector(Wa,r);Bo.subVectors(e,s);let b=Wa.dot(Bo),g=Xa.dot(Bo);if(g>=0&&b<=g)return t.copy(s);let y=b*c-l*g;if(y<=0&&c>=0&&g<=0)return o=c/(c-g),t.copy(n).addScaledVector(Xa,o);let p=h*g-b*d;if(p<=0&&d-h>=0&&b-g>=0)return $l.subVectors(s,i),o=(d-h)/(d-h+(b-g)),t.copy(i).addScaledVector($l,o);let u=1/(p+y+f);return r=y*u,o=f*u,t.copy(n).addScaledVector(Wa,r).addScaledVector(Xa,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},Zt=class{constructor(e=new U(1/0,1/0,1/0),t=new U(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(hn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(hn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=hn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let s=n.getAttribute("position");if(t===!0&&s!==void 0&&e.isInstancedMesh!==!0)for(let r=0,o=s.count;r<o;r++)e.isMesh===!0?e.getVertexPosition(r,hn):hn.fromBufferAttribute(s,r),hn.applyMatrix4(e.matrixWorld),this.expandByPoint(hn);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),Rs.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Rs.copy(n.boundingBox)),Rs.applyMatrix4(e.matrixWorld),this.union(Rs)}let i=e.children;for(let s=0,r=i.length;s<r;s++)this.expandByObject(i[s],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,hn),hn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Ti),Is.subVectors(this.max,Ti),qa.subVectors(e.a,Ti),Ka.subVectors(e.b,Ti),Ja.subVectors(e.c,Ti),ta.subVectors(Ka,qa),na.subVectors(Ja,Ka),xa.subVectors(qa,Ja);let t=[0,-ta.z,ta.y,0,-na.z,na.y,0,-xa.z,xa.y,ta.z,0,-ta.x,na.z,0,-na.x,xa.z,0,-xa.x,-ta.y,ta.x,0,-na.y,na.x,0,-xa.y,xa.x,0];return!Go(t,qa,Ka,Ja,Is)||(t=[1,0,0,0,1,0,0,0,1],!Go(t,qa,Ka,Ja,Is))?!1:(Cs.crossVectors(ta,na),t=[Cs.x,Cs.y,Cs.z],Go(t,qa,Ka,Ja,Is))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,hn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(hn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Ln[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Ln[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Ln[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Ln[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Ln[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Ln[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Ln[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Ln[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Ln),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},Ln=[new U,new U,new U,new U,new U,new U,new U,new U],hn=new U,Rs=new Zt,qa=new U,Ka=new U,Ja=new U,ta=new U,na=new U,xa=new U,Ti=new U,Is=new U,Cs=new U,ya=new U;function Go(a,e,t,n,i){for(let s=0,r=a.length-3;s<=r;s+=3){ya.fromArray(a,s);let o=i.x*Math.abs(ya.x)+i.y*Math.abs(ya.y)+i.z*Math.abs(ya.z),l=e.dot(ya),c=t.dot(ya),h=n.dot(ya);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}var vt=new U,ks=new Le,Ff=0,Mt=class extends En{constructor(e,t,n=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Ff++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=or,this.updateRanges=[],this.gpuType=$t,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let i=0,s=this.itemSize;i<s;i++)this.array[e+i]=t.array[n+i];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)ks.fromBufferAttribute(this,t),ks.applyMatrix3(e),this.setXY(t,ks.x,ks.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)vt.fromBufferAttribute(this,t),vt.applyMatrix3(e),this.setXYZ(t,vt.x,vt.y,vt.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)vt.fromBufferAttribute(this,t),vt.applyMatrix4(e),this.setXYZ(t,vt.x,vt.y,vt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)vt.fromBufferAttribute(this,t),vt.applyNormalMatrix(e),this.setXYZ(t,vt.x,vt.y,vt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)vt.fromBufferAttribute(this,t),vt.transformDirection(e),this.setXYZ(t,vt.x,vt.y,vt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=dn(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=Ze(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=dn(t,this.array)),t}setX(e,t){return this.normalized&&(t=Ze(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=dn(t,this.array)),t}setY(e,t){return this.normalized&&(t=Ze(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=dn(t,this.array)),t}setZ(e,t){return this.normalized&&(t=Ze(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=dn(t,this.array)),t}setW(e,t){return this.normalized&&(t=Ze(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=Ze(t,this.array),n=Ze(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,i){return e*=this.itemSize,this.normalized&&(t=Ze(t,this.array),n=Ze(n,this.array),i=Ze(i,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this}setXYZW(e,t,n,i,s){return e*=this.itemSize,this.normalized&&(t=Ze(t,this.array),n=Ze(n,this.array),i=Ze(i,this.array),s=Ze(s,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this.array[e+3]=s,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==or&&(e.usage=this.usage),e}dispose(){this.dispatchEvent({type:"dispose"})}};var ji=class extends Mt{constructor(e,t,n){super(new Uint16Array(e),t,n)}};var Hi=class extends Mt{constructor(e,t,n){super(new Uint32Array(e),t,n)}};var pt=class extends Mt{constructor(e,t,n){super(new Float32Array(e),t,n)}},Uf=new Zt,Ri=new U,Vo=new U,jt=class{constructor(e=new U,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;t!==void 0?n.copy(t):Uf.setFromPoints(e).getCenter(n);let i=0;for(let s=0,r=e.length;s<r;s++)i=Math.max(i,n.distanceToSquared(e[s]));return this.radius=Math.sqrt(i),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Ri.subVectors(e,this.center);let t=Ri.lengthSq();if(t>this.radius*this.radius){let n=Math.sqrt(t),i=(n-this.radius)*.5;this.center.addScaledVector(Ri,i/n),this.radius+=i}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Vo.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Ri.copy(e.center).add(Vo)),this.expandByPoint(Ri.copy(e.center).sub(Vo))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},Lf=0,nn=new Ue,Wo=new rt,Ya=new U,Kt=new Zt,Ii=new Zt,Rt=new U,kt=class a extends En{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Lf++}),this.uuid=un(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(of(e)?Hi:ji)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let s=new Pe().getNormalMatrix(e);n.applyNormalMatrix(s),n.needsUpdate=!0}let i=this.attributes.tangent;return i!==void 0&&(i.transformDirection(e),i.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return nn.makeRotationFromQuaternion(e),this.applyMatrix4(nn),this}rotateX(e){return nn.makeRotationX(e),this.applyMatrix4(nn),this}rotateY(e){return nn.makeRotationY(e),this.applyMatrix4(nn),this}rotateZ(e){return nn.makeRotationZ(e),this.applyMatrix4(nn),this}translate(e,t,n){return nn.makeTranslation(e,t,n),this.applyMatrix4(nn),this}scale(e,t,n){return nn.makeScale(e,t,n),this.applyMatrix4(nn),this}lookAt(e){return Wo.lookAt(e),Wo.updateMatrix(),this.applyMatrix4(Wo.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Ya).negate(),this.translate(Ya.x,Ya.y,Ya.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let n=[];for(let i=0,s=e.length;i<s;i++){let r=e[i];n.push(r.x,r.y,r.z||0)}this.setAttribute("position",new pt(n,3))}else{let n=Math.min(e.length,t.count);for(let i=0;i<n;i++){let s=e[i];t.setXYZ(i,s.x,s.y,s.z||0)}e.length>t.count&&ve("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Zt);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ie("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new U(-1/0,-1/0,-1/0),new U(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,i=t.length;n<i;n++){let s=t[n];Kt.setFromBufferAttribute(s),this.morphTargetsRelative?(Rt.addVectors(this.boundingBox.min,Kt.min),this.boundingBox.expandByPoint(Rt),Rt.addVectors(this.boundingBox.max,Kt.max),this.boundingBox.expandByPoint(Rt)):(this.boundingBox.expandByPoint(Kt.min),this.boundingBox.expandByPoint(Kt.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Ie('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new jt);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ie("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new U,1/0);return}if(e){let n=this.boundingSphere.center;if(Kt.setFromBufferAttribute(e),t)for(let s=0,r=t.length;s<r;s++){let o=t[s];Ii.setFromBufferAttribute(o),this.morphTargetsRelative?(Rt.addVectors(Kt.min,Ii.min),Kt.expandByPoint(Rt),Rt.addVectors(Kt.max,Ii.max),Kt.expandByPoint(Rt)):(Kt.expandByPoint(Ii.min),Kt.expandByPoint(Ii.max))}Kt.getCenter(n);let i=0;for(let s=0,r=e.count;s<r;s++)Rt.fromBufferAttribute(e,s),i=Math.max(i,n.distanceToSquared(Rt));if(t)for(let s=0,r=t.length;s<r;s++){let o=t[s],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)Rt.fromBufferAttribute(o,c),l&&(Ya.fromBufferAttribute(e,c),Rt.add(Ya)),i=Math.max(i,n.distanceToSquared(Rt))}this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)&&Ie('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){Ie("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=t.position,i=t.normal,s=t.uv,r=this.getAttribute("tangent");(r===void 0||r.count!==n.count)&&(r=new Mt(new Float32Array(4*n.count),4),this.setAttribute("tangent",r));let o=[],l=[];for(let v=0;v<n.count;v++)o[v]=new U,l[v]=new U;let c=new U,h=new U,d=new U,f=new Le,b=new Le,g=new Le,y=new U,p=new U;function u(v,E,C){c.fromBufferAttribute(n,v),h.fromBufferAttribute(n,E),d.fromBufferAttribute(n,C),f.fromBufferAttribute(s,v),b.fromBufferAttribute(s,E),g.fromBufferAttribute(s,C),h.sub(c),d.sub(c),b.sub(f),g.sub(f);let I=1/(b.x*g.y-g.x*b.y);isFinite(I)&&(y.copy(h).multiplyScalar(g.y).addScaledVector(d,-b.y).multiplyScalar(I),p.copy(d).multiplyScalar(b.x).addScaledVector(h,-g.x).multiplyScalar(I),o[v].add(y),o[E].add(y),o[C].add(y),l[v].add(p),l[E].add(p),l[C].add(p))}let m=this.groups;m.length===0&&(m=[{start:0,count:e.count}]);for(let v=0,E=m.length;v<E;++v){let C=m[v],I=C.start,k=C.count;for(let O=I,V=I+k;O<V;O+=3)u(e.getX(O+0),e.getX(O+1),e.getX(O+2))}let M=new U,x=new U,S=new U,w=new U;function T(v){S.fromBufferAttribute(i,v),w.copy(S);let E=o[v];M.copy(E),M.sub(S.multiplyScalar(S.dot(E))).normalize(),x.crossVectors(w,E);let I=x.dot(l[v])<0?-1:1;r.setXYZW(v,M.x,M.y,M.z,I)}for(let v=0,E=m.length;v<E;++v){let C=m[v],I=C.start,k=C.count;for(let O=I,V=I+k;O<V;O+=3)T(e.getX(O+0)),T(e.getX(O+1)),T(e.getX(O+2))}this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==t.count)n=new Mt(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let f=0,b=n.count;f<b;f++)n.setXYZ(f,0,0,0);let i=new U,s=new U,r=new U,o=new U,l=new U,c=new U,h=new U,d=new U;if(e)for(let f=0,b=e.count;f<b;f+=3){let g=e.getX(f+0),y=e.getX(f+1),p=e.getX(f+2);i.fromBufferAttribute(t,g),s.fromBufferAttribute(t,y),r.fromBufferAttribute(t,p),h.subVectors(r,s),d.subVectors(i,s),h.cross(d),o.fromBufferAttribute(n,g),l.fromBufferAttribute(n,y),c.fromBufferAttribute(n,p),o.add(h),l.add(h),c.add(h),n.setXYZ(g,o.x,o.y,o.z),n.setXYZ(y,l.x,l.y,l.z),n.setXYZ(p,c.x,c.y,c.z)}else for(let f=0,b=t.count;f<b;f+=3)i.fromBufferAttribute(t,f+0),s.fromBufferAttribute(t,f+1),r.fromBufferAttribute(t,f+2),h.subVectors(r,s),d.subVectors(i,s),h.cross(d),n.setXYZ(f+0,h.x,h.y,h.z),n.setXYZ(f+1,h.x,h.y,h.z),n.setXYZ(f+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)Rt.fromBufferAttribute(e,t),Rt.normalize(),e.setXYZ(t,Rt.x,Rt.y,Rt.z)}toNonIndexed(){function e(o,l){let c=o.array,h=o.itemSize,d=o.normalized,f=new c.constructor(l.length*h),b=0,g=0;for(let y=0,p=l.length;y<p;y++){o.isInterleavedBufferAttribute?b=l[y]*o.data.stride+o.offset:b=l[y]*h;for(let u=0;u<h;u++)f[g++]=c[b++]}return new Mt(f,h,d)}if(this.index===null)return ve("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new a,n=this.index.array,i=this.attributes;for(let o in i){let l=i[o],c=e(l,n);t.setAttribute(o,c)}let s=this.morphAttributes;for(let o in s){let l=[],c=s[o];for(let h=0,d=c.length;h<d;h++){let f=c[h],b=e(f,n);l.push(b)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;let r=this.groups;for(let o=0,l=r.length;o<l;o++){let c=r[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){let e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let n=this.attributes;for(let l in n){let c=n[l];e.data.attributes[l]=c.toJSON(e.data)}let i={},s=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let d=0,f=c.length;d<f;d++){let b=c[d];h.push(b.toJSON(e.data))}h.length>0&&(i[l]=h,s=!0)}s&&(e.data.morphAttributes=i,e.data.morphTargetsRelative=this.morphTargetsRelative);let r=this.groups;r.length>0&&(e.data.groups=JSON.parse(JSON.stringify(r)));let o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;n!==null&&this.setIndex(n.clone());let i=e.attributes;for(let c in i){let h=i[c];this.setAttribute(c,h.clone(t))}let s=e.morphAttributes;for(let c in s){let h=[],d=s[c];for(let f=0,b=d.length;f<b;f++)h.push(d[f].clone(t));this.morphAttributes[c]=h}this.morphTargetsRelative=e.morphTargetsRelative;let r=e.groups;for(let c=0,h=r.length;c<h;c++){let d=r[c];this.addGroup(d.start,d.count,d.materialIndex)}let o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());let l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}},ci=class{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=or,this.updateRanges=[],this.version=0,this.uuid=un()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,n){e*=this.stride,n*=t.stride;for(let i=0,s=this.stride;i<s;i++)this.array[e+i]=t.array[n+i];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=un()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);let t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(t,this.stride);return n.setUsage(this.usage),n}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){return e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=un()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}},Lt=new U,li=class a{constructor(e,t,n,i=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=n,this.normalized=i}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,n=this.data.count;t<n;t++)Lt.fromBufferAttribute(this,t),Lt.applyMatrix4(e),this.setXYZ(t,Lt.x,Lt.y,Lt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Lt.fromBufferAttribute(this,t),Lt.applyNormalMatrix(e),this.setXYZ(t,Lt.x,Lt.y,Lt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Lt.fromBufferAttribute(this,t),Lt.transformDirection(e),this.setXYZ(t,Lt.x,Lt.y,Lt.z);return this}getComponent(e,t){let n=this.array[e*this.data.stride+this.offset+t];return this.normalized&&(n=dn(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=Ze(n,this.array)),this.data.array[e*this.data.stride+this.offset+t]=n,this}setX(e,t){return this.normalized&&(t=Ze(t,this.array)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=Ze(t,this.array)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=Ze(t,this.array)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=Ze(t,this.array)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=dn(t,this.array)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=dn(t,this.array)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=dn(t,this.array)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=dn(t,this.array)),t}setXY(e,t,n){return e=e*this.data.stride+this.offset,this.normalized&&(t=Ze(t,this.array),n=Ze(n,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this}setXYZ(e,t,n,i){return e=e*this.data.stride+this.offset,this.normalized&&(t=Ze(t,this.array),n=Ze(n,this.array),i=Ze(i,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this}setXYZW(e,t,n,i,s){return e=e*this.data.stride+this.offset,this.normalized&&(t=Ze(t,this.array),n=Ze(n,this.array),i=Ze(i,this.array),s=Ze(s,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this.data.array[e+3]=s,this}clone(e){if(e===void 0){Li("InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let i=n*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[i+s])}return new Mt(new this.array.constructor(t),this.itemSize,this.normalized)}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new a(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){Li("InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let i=n*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[i+s])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}},Of=0,Ht=class extends En{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Of++}),this.uuid=un(),this.name="",this.type="Material",this.blending=wa,this.side=pn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Qs,this.blendDst=$s,this.blendEquation=ra,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Re(0,0,0),this.blendAlpha=0,this.depthFunc=Aa,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=oc,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Ma,this.stencilZFail=Ma,this.stencilZPass=Ma,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let n=e[t];if(n===void 0){ve(`Material: parameter '${t}' has value of undefined.`);continue}let i=this[t];if(i===void 0){ve(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}i&&i.isColor?i.set(n):i&&i.isVector2&&n&&n.isVector2||i&&i.isEuler&&n&&n.isEuler||i&&i.isVector3&&n&&n.isVector3?i.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==wa&&(n.blending=this.blending),this.side!==pn&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==Qs&&(n.blendSrc=this.blendSrc),this.blendDst!==$s&&(n.blendDst=this.blendDst),this.blendEquation!==ra&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Aa&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==oc&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Ma&&(n.stencilFail=this.stencilFail),this.stencilZFail!==Ma&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==Ma&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.allowOverride===!1&&(n.allowOverride=!1),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function i(s){let r=[];for(let o in s){let l=s[o];delete l.metadata,r.push(l)}return r}if(t){let s=i(e.textures),r=i(e.images);s.length>0&&(n.textures=s),r.length>0&&(n.images=r)}return n}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new Re().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let n=e.normalScale;Array.isArray(n)===!1&&(n=[n,n]),this.normalScale=new Le().fromArray(n)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new Le().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let i=t.length;n=new Array(i);for(let s=0;s!==i;++s)n[s]=t[s].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}};var On=new U,Xo=new U,Ps=new U,aa=new U,qo=new U,Ns=new U,Ko=new U,Ia=class{constructor(e=new U,t=new U(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,On)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=On.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(On.copy(this.origin).addScaledVector(this.direction,t),On.distanceToSquared(e))}distanceSqToSegment(e,t,n,i){Xo.copy(e).add(t).multiplyScalar(.5),Ps.copy(t).sub(e).normalize(),aa.copy(this.origin).sub(Xo);let s=e.distanceTo(t)*.5,r=-this.direction.dot(Ps),o=aa.dot(this.direction),l=-aa.dot(Ps),c=aa.lengthSq(),h=Math.abs(1-r*r),d,f,b,g;if(h>0)if(d=r*l-o,f=r*o-l,g=s*h,d>=0)if(f>=-g)if(f<=g){let y=1/h;d*=y,f*=y,b=d*(d+r*f+2*o)+f*(r*d+f+2*l)+c}else f=s,d=Math.max(0,-(r*f+o)),b=-d*d+f*(f+2*l)+c;else f=-s,d=Math.max(0,-(r*f+o)),b=-d*d+f*(f+2*l)+c;else f<=-g?(d=Math.max(0,-(-r*s+o)),f=d>0?-s:Math.min(Math.max(-s,-l),s),b=-d*d+f*(f+2*l)+c):f<=g?(d=0,f=Math.min(Math.max(-s,-l),s),b=f*(f+2*l)+c):(d=Math.max(0,-(r*s+o)),f=d>0?s:Math.min(Math.max(-s,-l),s),b=-d*d+f*(f+2*l)+c);else f=r>0?-s:s,d=Math.max(0,-(r*f+o)),b=-d*d+f*(f+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,d),i&&i.copy(Xo).addScaledVector(Ps,f),b}intersectSphere(e,t){On.subVectors(e.center,this.origin);let n=On.dot(this.direction),i=On.dot(On)-n*n,s=e.radius*e.radius;if(i>s)return null;let r=Math.sqrt(s-i),o=n-r,l=n+r;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,i,s,r,o,l,c=1/this.direction.x,h=1/this.direction.y,d=1/this.direction.z,f=this.origin;return c>=0?(n=(e.min.x-f.x)*c,i=(e.max.x-f.x)*c):(n=(e.max.x-f.x)*c,i=(e.min.x-f.x)*c),h>=0?(s=(e.min.y-f.y)*h,r=(e.max.y-f.y)*h):(s=(e.max.y-f.y)*h,r=(e.min.y-f.y)*h),n>r||s>i||((s>n||isNaN(n))&&(n=s),(r<i||isNaN(i))&&(i=r),d>=0?(o=(e.min.z-f.z)*d,l=(e.max.z-f.z)*d):(o=(e.max.z-f.z)*d,l=(e.min.z-f.z)*d),n>l||o>i)||((o>n||n!==n)&&(n=o),(l<i||i!==i)&&(i=l),i<0)?null:this.at(n>=0?n:i,t)}intersectsBox(e){return this.intersectBox(e,On)!==null}intersectTriangle(e,t,n,i,s){qo.subVectors(t,e),Ns.subVectors(n,e),Ko.crossVectors(qo,Ns);let r=this.direction.dot(Ko),o;if(r>0){if(i)return null;o=1}else if(r<0)o=-1,r=-r;else return null;aa.subVectors(this.origin,e);let l=o*this.direction.dot(Ns.crossVectors(aa,Ns));if(l<0)return null;let c=o*this.direction.dot(qo.cross(aa));if(c<0||l+c>r)return null;let h=-o*aa.dot(Ko);return h<0?null:this.at(h/r,s)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},bn=class extends Ht{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Re(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new jn,this.combine=yc,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},eh=new Ue,va=new Ia,Ds=new jt,th=new U,Fs=new U,Us=new U,Ls=new U,Jo=new U,Os=new U,nh=new U,Bs=new U,ht=class extends rt{constructor(e=new kt,t=new bn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,r=i.length;s<r;s++){let o=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}getVertexPosition(e,t){let n=this.geometry,i=n.attributes.position,s=n.morphAttributes.position,r=n.morphTargetsRelative;t.fromBufferAttribute(i,e);let o=this.morphTargetInfluences;if(s&&o){Os.set(0,0,0);for(let l=0,c=s.length;l<c;l++){let h=o[l],d=s[l];h!==0&&(Jo.fromBufferAttribute(d,e),r?Os.addScaledVector(Jo,h):Os.addScaledVector(Jo.sub(t),h))}t.add(Os)}return t}raycast(e,t){let n=this.geometry,i=this.material,s=this.matrixWorld;i!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Ds.copy(n.boundingSphere),Ds.applyMatrix4(s),va.copy(e.ray).recast(e.near),!(Ds.containsPoint(va.origin)===!1&&(va.intersectSphere(Ds,th)===null||va.origin.distanceToSquared(th)>(e.far-e.near)**2))&&(eh.copy(s).invert(),va.copy(e.ray).applyMatrix4(eh),!(n.boundingBox!==null&&va.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,va)))}_computeIntersections(e,t,n){let i,s=this.geometry,r=this.material,o=s.index,l=s.attributes.position,c=s.attributes.uv,h=s.attributes.uv1,d=s.attributes.normal,f=s.groups,b=s.drawRange;if(o!==null)if(Array.isArray(r))for(let g=0,y=f.length;g<y;g++){let p=f[g],u=r[p.materialIndex],m=Math.max(p.start,b.start),M=Math.min(o.count,Math.min(p.start+p.count,b.start+b.count));for(let x=m,S=M;x<S;x+=3){let w=o.getX(x),T=o.getX(x+1),v=o.getX(x+2);i=zs(this,u,e,n,c,h,d,w,T,v),i&&(i.faceIndex=Math.floor(x/3),i.face.materialIndex=p.materialIndex,t.push(i))}}else{let g=Math.max(0,b.start),y=Math.min(o.count,b.start+b.count);for(let p=g,u=y;p<u;p+=3){let m=o.getX(p),M=o.getX(p+1),x=o.getX(p+2);i=zs(this,r,e,n,c,h,d,m,M,x),i&&(i.faceIndex=Math.floor(p/3),t.push(i))}}else if(l!==void 0)if(Array.isArray(r))for(let g=0,y=f.length;g<y;g++){let p=f[g],u=r[p.materialIndex],m=Math.max(p.start,b.start),M=Math.min(l.count,Math.min(p.start+p.count,b.start+b.count));for(let x=m,S=M;x<S;x+=3){let w=x,T=x+1,v=x+2;i=zs(this,u,e,n,c,h,d,w,T,v),i&&(i.faceIndex=Math.floor(x/3),i.face.materialIndex=p.materialIndex,t.push(i))}}else{let g=Math.max(0,b.start),y=Math.min(l.count,b.start+b.count);for(let p=g,u=y;p<u;p+=3){let m=p,M=p+1,x=p+2;i=zs(this,r,e,n,c,h,d,m,M,x),i&&(i.faceIndex=Math.floor(p/3),t.push(i))}}}};function Bf(a,e,t,n,i,s,r,o){let l;if(e.side===Bt?l=n.intersectTriangle(r,s,i,!0,o):l=n.intersectTriangle(i,s,r,e.side===pn,o),l===null)return null;Bs.copy(o),Bs.applyMatrix4(a.matrixWorld);let c=t.ray.origin.distanceTo(Bs);return c<t.near||c>t.far?null:{distance:c,point:Bs.clone(),object:a}}function zs(a,e,t,n,i,s,r,o,l,c){a.getVertexPosition(o,Fs),a.getVertexPosition(l,Us),a.getVertexPosition(c,Ls);let h=Bf(a,e,t,n,Fs,Us,Ls,nh);if(h){let d=new U;sa.getBarycoord(nh,Fs,Us,Ls,d),i&&(h.uv=sa.getInterpolatedAttribute(i,o,l,c,d,new Le)),s&&(h.uv1=sa.getInterpolatedAttribute(s,o,l,c,d,new Le)),r&&(h.normal=sa.getInterpolatedAttribute(r,o,l,c,d,new U),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));let f={a:o,b:l,c,normal:new U,materialIndex:0};sa.getNormal(Fs,Us,Ls,f.normal),h.face=f,h.barycoord=d}return h}var Ci=new Qe,ah=new Qe,ih=new Qe,zf=new Qe,sh=new Ue,js=new U,Yo=new jt,rh=new Ue,Zo=new Ia,Gi=class extends ht{constructor(e,t){super(e,t),this.isSkinnedMesh=!0,this.type="SkinnedMesh",this.bindMode=nc,this.bindMatrix=new Ue,this.bindMatrixInverse=new Ue,this.boundingBox=null,this.boundingSphere=null}computeBoundingBox(){let e=this.geometry;this.boundingBox===null&&(this.boundingBox=new Zt),this.boundingBox.makeEmpty();let t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,js),this.boundingBox.expandByPoint(js)}computeBoundingSphere(){let e=this.geometry;this.boundingSphere===null&&(this.boundingSphere=new jt),this.boundingSphere.makeEmpty();let t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,js),this.boundingSphere.expandByPoint(js)}copy(e,t){return super.copy(e,t),this.bindMode=e.bindMode,this.bindMatrix.copy(e.bindMatrix),this.bindMatrixInverse.copy(e.bindMatrixInverse),this.skeleton=e.skeleton,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}raycast(e,t){let n=this.material,i=this.matrixWorld;n!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Yo.copy(this.boundingSphere),Yo.applyMatrix4(i),e.ray.intersectsSphere(Yo)!==!1&&(rh.copy(i).invert(),Zo.copy(e.ray).applyMatrix4(rh),!(this.boundingBox!==null&&Zo.intersectsBox(this.boundingBox)===!1)&&this._computeIntersections(e,t,Zo)))}getVertexPosition(e,t){return super.getVertexPosition(e,t),this.applyBoneTransform(e,t),t}bind(e,t){this.skeleton=e,t===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.copy(t).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){let e=new Qe,t=this.geometry.attributes.skinWeight;for(let n=0,i=t.count;n<i;n++){e.fromBufferAttribute(t,n);let s=1/e.manhattanLength();s!==1/0?e.multiplyScalar(s):e.set(1,0,0,0),t.setXYZW(n,e.x,e.y,e.z,e.w)}}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMode===nc?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode===Xh?this.bindMatrixInverse.copy(this.bindMatrix).invert():ve("SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}applyBoneTransform(e,t){let n=this.skeleton,i=this.geometry;ah.fromBufferAttribute(i.attributes.skinIndex,e),ih.fromBufferAttribute(i.attributes.skinWeight,e),t.isVector4?(Ci.copy(t),t.set(0,0,0,0)):(Ci.set(...t,1),t.set(0,0,0)),Ci.applyMatrix4(this.bindMatrix);for(let s=0;s<4;s++){let r=ih.getComponent(s);if(r!==0){let o=ah.getComponent(s);sh.multiplyMatrices(n.bones[o].matrixWorld,n.boneInverses[o]),t.addScaledVector(zf.copy(Ci).applyMatrix4(sh),r)}}return t.isVector4&&(t.w=Ci.w),t.applyMatrix4(this.bindMatrixInverse)}},hi=class extends rt{constructor(){super(),this.isBone=!0,this.type="Bone"}},di=class extends It{constructor(e=null,t=1,n=1,i,s,r,o,l,c=bt,h=bt,d,f){super(null,r,o,l,c,h,i,s,d,f),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},oh=new Ue,jf=new Ue,Vi=class a{constructor(e=[],t=[]){this.uuid=un(),this.bones=e.slice(0),this.boneInverses=t,this.boneMatrices=null,this.boneTexture=null,this.init()}init(){let e=this.bones,t=this.boneInverses;if(this.boneMatrices=new Float32Array(e.length*16),t.length===0)this.calculateInverses();else if(e.length!==t.length){ve("Skeleton: Number of inverse bone matrices does not match amount of bones."),this.boneInverses=[];for(let n=0,i=this.bones.length;n<i;n++)this.boneInverses.push(new Ue)}}calculateInverses(){this.boneInverses.length=0;for(let e=0,t=this.bones.length;e<t;e++){let n=new Ue;this.bones[e]&&n.copy(this.bones[e].matrixWorld).invert(),this.boneInverses.push(n)}}pose(){for(let e=0,t=this.bones.length;e<t;e++){let n=this.bones[e];n&&n.matrixWorld.copy(this.boneInverses[e]).invert()}for(let e=0,t=this.bones.length;e<t;e++){let n=this.bones[e];n&&(n.parent&&n.parent.isBone?(n.matrix.copy(n.parent.matrixWorld).invert(),n.matrix.multiply(n.matrixWorld)):n.matrix.copy(n.matrixWorld),n.matrix.decompose(n.position,n.quaternion,n.scale))}}update(){let e=this.bones,t=this.boneInverses,n=this.boneMatrices,i=this.boneTexture;for(let s=0,r=e.length;s<r;s++){let o=e[s]?e[s].matrixWorld:jf;oh.multiplyMatrices(o,t[s]),oh.toArray(n,s*16)}i!==null&&(i.needsUpdate=!0)}clone(){return new a(this.bones,this.boneInverses)}computeBoneTexture(){let e=Math.sqrt(this.bones.length*4);e=Math.ceil(e/4)*4,e=Math.max(e,4);let t=new Float32Array(e*e*4);t.set(this.boneMatrices);let n=new di(t,e,e,en,$t);return n.needsUpdate=!0,this.boneMatrices=t,this.boneTexture=n,this}getBoneByName(e){for(let t=0,n=this.bones.length;t<n;t++){let i=this.bones[t];if(i.name===e)return i}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null)}fromJSON(e,t){this.uuid=e.uuid;for(let n=0,i=e.bones.length;n<i;n++){let s=e.bones[n],r=t[s];r===void 0&&(ve("Skeleton: No bone found with UUID:",s),r=new hi),this.bones.push(r),this.boneInverses.push(new Ue().fromArray(e.boneInverses[n]))}return this.init(),this}toJSON(){let e={metadata:{version:4.7,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};e.uuid=this.uuid;let t=this.bones,n=this.boneInverses;for(let i=0,s=t.length;i<s;i++){let r=t[i];e.bones.push(r.uuid);let o=n[i];e.boneInverses.push(o.toArray())}return e}},ca=class extends Mt{constructor(e,t,n,i=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=i}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},Za=new Ue,ch=new Ue,Hs=[],lh=new Zt,Hf=new Ue,ki=new ht,Pi=new jt,Wi=class extends ht{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new ca(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let i=0;i<n;i++)this.setMatrixAt(i,Hf)}computeBoundingBox(){let e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new Zt),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Za),lh.copy(e.boundingBox).applyMatrix4(Za),this.boundingBox.union(lh)}computeBoundingSphere(){let e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new jt),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Za),Pi.copy(e.boundingSphere).applyMatrix4(Za),this.boundingSphere.union(Pi)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){return this.instanceColor===null?t.setRGB(1,1,1):t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){return t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){let n=t.morphTargetInfluences,i=this.morphTexture.source.data.data,s=n.length+1,r=e*s+1;for(let o=0;o<n.length;o++)n[o]=i[r+o]}raycast(e,t){let n=this.matrixWorld,i=this.count;if(ki.geometry=this.geometry,ki.material=this.material,ki.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Pi.copy(this.boundingSphere),Pi.applyMatrix4(n),e.ray.intersectsSphere(Pi)!==!1))for(let s=0;s<i;s++){this.getMatrixAt(s,Za),ch.multiplyMatrices(n,Za),ki.matrixWorld=ch,ki.raycast(e,Hs);for(let r=0,o=Hs.length;r<o;r++){let l=Hs[r];l.instanceId=s,l.object=this,t.push(l)}Hs.length=0}}setColorAt(e,t){return this.instanceColor===null&&(this.instanceColor=new ca(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3),this}setMatrixAt(e,t){return t.toArray(this.instanceMatrix.array,e*16),this}setMorphAt(e,t){let n=t.morphTargetInfluences,i=n.length+1;this.morphTexture===null&&(this.morphTexture=new di(new Float32Array(i*this.count),i,this.count,Pr,$t));let s=this.morphTexture.source.data.data,r=0;for(let c=0;c<n.length;c++)r+=n[c];let o=this.geometry.morphTargetsRelative?1:1-r,l=i*e;return s[l]=o,s.set(n,l+1),this}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},Qo=new U,Gf=new U,Vf=new Pe,Sn=class{constructor(e=new U(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,i){return this.normal.set(e,t,n),this.constant=i,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let i=Qo.subVectors(n,t).cross(Gf.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(i,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){let i=e.delta(Qo),s=this.normal.dot(i);if(s===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let r=-(e.start.dot(this.normal)+this.constant)/s;return n===!0&&(r<0||r>1)?null:t.copy(e.start).addScaledVector(i,r)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||Vf.getNormalMatrix(e),i=this.coplanarPoint(Qo).applyMatrix4(e),s=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(s),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}},_a=new jt,Wf=new Le(.5,.5),Gs=new U,fi=class{constructor(e=new Sn,t=new Sn,n=new Sn,i=new Sn,s=new Sn,r=new Sn){this.planes=[e,t,n,i,s,r]}set(e,t,n,i,s,r){let o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(i),o[4].copy(s),o[5].copy(r),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=fn,n=!1){let i=this.planes,s=e.elements,r=s[0],o=s[1],l=s[2],c=s[3],h=s[4],d=s[5],f=s[6],b=s[7],g=s[8],y=s[9],p=s[10],u=s[11],m=s[12],M=s[13],x=s[14],S=s[15];if(i[0].setComponents(c-r,b-h,u-g,S-m).normalize(),i[1].setComponents(c+r,b+h,u+g,S+m).normalize(),i[2].setComponents(c+o,b+d,u+y,S+M).normalize(),i[3].setComponents(c-o,b-d,u-y,S-M).normalize(),n)i[4].setComponents(l,f,p,x).normalize(),i[5].setComponents(c-l,b-f,u-p,S-x).normalize();else if(i[4].setComponents(c-l,b-f,u-p,S-x).normalize(),t===fn)i[5].setComponents(c+l,b+f,u+p,S+x).normalize();else if(t===ai)i[5].setComponents(l,f,p,x).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),_a.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),_a.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(_a)}intersectsSprite(e){_a.center.set(0,0,0);let t=Wf.distanceTo(e.center);return _a.radius=.7071067811865476+t,_a.applyMatrix4(e.matrixWorld),this.intersectsSphere(_a)}intersectsSphere(e){let t=this.planes,n=e.center,i=-e.radius;for(let s=0;s<6;s++)if(t[s].distanceToPoint(n)<i)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let i=t[n];if(Gs.x=i.normal.x>0?e.max.x:e.min.x,Gs.y=i.normal.y>0?e.max.y:e.min.y,Gs.z=i.normal.z>0?e.max.z:e.min.z,i.distanceToPoint(Gs)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var ui=class extends Ht{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new Re(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}},dr=new U,fr=new U,hh=new Ue,Ni=new Ia,Vs=new jt,$o=new U,dh=new U,Ca=class extends rt{constructor(e=new kt,t=new ui){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[0];for(let i=1,s=t.count;i<s;i++)dr.fromBufferAttribute(t,i-1),fr.fromBufferAttribute(t,i),n[i]=n[i-1],n[i]+=dr.distanceTo(fr);e.setAttribute("lineDistance",new pt(n,1))}else ve("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(e,t){let n=this.geometry,i=this.matrixWorld,s=e.params.Line.threshold,r=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Vs.copy(n.boundingSphere),Vs.applyMatrix4(i),Vs.radius+=s,e.ray.intersectsSphere(Vs)===!1)return;hh.copy(i).invert(),Ni.copy(e.ray).applyMatrix4(hh);let o=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=this.isLineSegments?2:1,h=n.index,f=n.attributes.position;if(h!==null){let b=Math.max(0,r.start),g=Math.min(h.count,r.start+r.count);for(let y=b,p=g-1;y<p;y+=c){let u=h.getX(y),m=h.getX(y+1),M=Ws(this,e,Ni,l,u,m,y);M&&t.push(M)}if(this.isLineLoop){let y=h.getX(g-1),p=h.getX(b),u=Ws(this,e,Ni,l,y,p,g-1);u&&t.push(u)}}else{let b=Math.max(0,r.start),g=Math.min(f.count,r.start+r.count);for(let y=b,p=g-1;y<p;y+=c){let u=Ws(this,e,Ni,l,y,y+1,y);u&&t.push(u)}if(this.isLineLoop){let y=Ws(this,e,Ni,l,g-1,b,g-1);y&&t.push(y)}}}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,r=i.length;s<r;s++){let o=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}};function Ws(a,e,t,n,i,s,r){let o=a.geometry.attributes.position;if(dr.fromBufferAttribute(o,i),fr.fromBufferAttribute(o,s),t.distanceSqToSegment(dr,fr,$o,dh)>n)return;$o.applyMatrix4(a.matrixWorld);let c=e.ray.origin.distanceTo($o);if(!(c<e.near||c>e.far))return{distance:c,point:dh.clone().applyMatrix4(a.matrixWorld),index:r,face:null,faceIndex:null,barycoord:null,object:a}}var fh=new U,uh=new U,Xi=class extends Ca{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[];for(let i=0,s=t.count;i<s;i+=2)fh.fromBufferAttribute(t,i),uh.fromBufferAttribute(t,i+1),n[i]=i===0?0:n[i-1],n[i+1]=n[i]+fh.distanceTo(uh);e.setAttribute("lineDistance",new pt(n,1))}else ve("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}},qi=class extends Ca{constructor(e,t){super(e,t),this.isLineLoop=!0,this.type="LineLoop"}},pi=class extends Ht{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new Re(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},ph=new Ue,cc=new Ia,Xs=new jt,qs=new U,Ki=class extends rt{constructor(e=new kt,t=new pi){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,t){let n=this.geometry,i=this.matrixWorld,s=e.params.Points.threshold,r=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Xs.copy(n.boundingSphere),Xs.applyMatrix4(i),Xs.radius+=s,e.ray.intersectsSphere(Xs)===!1)return;ph.copy(i).invert(),cc.copy(e.ray).applyMatrix4(ph);let o=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=n.index,d=n.attributes.position;if(c!==null){let f=Math.max(0,r.start),b=Math.min(c.count,r.start+r.count);for(let g=f,y=b;g<y;g++){let p=c.getX(g);qs.fromBufferAttribute(d,p),bh(qs,p,l,i,e,t,this)}}else{let f=Math.max(0,r.start),b=Math.min(d.count,r.start+r.count);for(let g=f,y=b;g<y;g++)qs.fromBufferAttribute(d,g),bh(qs,g,l,i,e,t,this)}}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,r=i.length;s<r;s++){let o=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}};function bh(a,e,t,n,i,s,r){let o=cc.distanceSqToPoint(a);if(o<t){let l=new U;cc.closestPointToPoint(a,l),l.applyMatrix4(n);let c=i.ray.origin.distanceTo(l);if(c<i.near||c>i.far)return;s.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:r})}}var Ji=class extends It{constructor(e=[],t=fa,n,i,s,r,o,l,c,h){super(e,t,n,i,s,r,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}};var Hn=class extends It{constructor(e,t,n=xn,i,s,r,o=bt,l=bt,c,h=An,d=1){if(h!==An&&h!==ua)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let f={width:e,height:t,depth:d};super(f,i,s,r,o,l,h,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new ri(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}},ur=class extends Hn{constructor(e,t=xn,n=fa,i,s,r=bt,o=bt,l,c=An){let h={width:e,height:e,depth:1},d=[h,h,h,h,h,h];super(e,e,t,n,i,s,r,o,l,c),this.image=d,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},Yi=class extends It{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},la=class a extends kt{constructor(e=1,t=1,n=1,i=1,s=1,r=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:i,heightSegments:s,depthSegments:r};let o=this;i=Math.floor(i),s=Math.floor(s),r=Math.floor(r);let l=[],c=[],h=[],d=[],f=0,b=0;g("z","y","x",-1,-1,n,t,e,r,s,0),g("z","y","x",1,-1,n,t,-e,r,s,1),g("x","z","y",1,1,e,n,t,i,r,2),g("x","z","y",1,-1,e,n,-t,i,r,3),g("x","y","z",1,-1,e,t,n,i,s,4),g("x","y","z",-1,-1,e,t,-n,i,s,5),this.setIndex(l),this.setAttribute("position",new pt(c,3)),this.setAttribute("normal",new pt(h,3)),this.setAttribute("uv",new pt(d,2));function g(y,p,u,m,M,x,S,w,T,v,E){let C=x/T,I=S/v,k=x/2,O=S/2,V=w/2,P=T+1,j=v+1,B=0,K=0,Q=new U;for(let ee=0;ee<j;ee++){let ae=ee*I-O;for(let ie=0;ie<P;ie++){let ke=ie*C-k;Q[y]=ke*m,Q[p]=ae*M,Q[u]=V,c.push(Q.x,Q.y,Q.z),Q[y]=0,Q[p]=0,Q[u]=w>0?1:-1,h.push(Q.x,Q.y,Q.z),d.push(ie/T),d.push(1-ee/v),B+=1}}for(let ee=0;ee<v;ee++)for(let ae=0;ae<T;ae++){let ie=f+ae+P*ee,ke=f+ae+P*(ee+1),Ke=f+(ae+1)+P*(ee+1),Ge=f+(ae+1)+P*ee;l.push(ie,ke,Ge),l.push(ke,Ke,Ge),K+=6}o.addGroup(b,K,E),b+=K,f+=B}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new a(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}},bi=class a extends kt{constructor(e=1,t=1,n=4,i=8,s=1){super(),this.type="CapsuleGeometry",this.parameters={radius:e,height:t,capSegments:n,radialSegments:i,heightSegments:s},t=Math.max(0,t),n=Math.max(1,Math.floor(n)),i=Math.max(3,Math.floor(i)),s=Math.max(1,Math.floor(s));let r=[],o=[],l=[],c=[],h=t/2,d=Math.PI/2*e,f=t,b=2*d+f,g=n*2+s,y=i+1,p=new U,u=new U;for(let m=0;m<=g;m++){let M=0,x=0,S=0,w=0;if(m<=n){let E=m/n,C=E*Math.PI/2;x=-h-e*Math.cos(C),S=e*Math.sin(C),w=-e*Math.cos(C),M=E*d}else if(m<=n+s){let E=(m-n)/s;x=-h+E*t,S=e,w=0,M=d+E*f}else{let E=(m-n-s)/n,C=E*Math.PI/2;x=h+e*Math.sin(C),S=e*Math.cos(C),w=e*Math.sin(C),M=d+f+E*d}let T=Math.max(0,Math.min(1,M/b)),v=0;m===0?v=.5/i:m===g&&(v=-.5/i);for(let E=0;E<=i;E++){let C=E/i,I=C*Math.PI*2,k=Math.sin(I),O=Math.cos(I);u.x=-S*O,u.y=x,u.z=S*k,o.push(u.x,u.y,u.z),p.set(-S*O,w,S*k),p.normalize(),l.push(p.x,p.y,p.z),c.push(C+v,T)}if(m>0){let E=(m-1)*y;for(let C=0;C<i;C++){let I=E+C,k=E+C+1,O=m*y+C,V=m*y+C+1;r.push(I,k,O),r.push(k,V,O)}}}this.setIndex(r),this.setAttribute("position",new pt(o,3)),this.setAttribute("normal",new pt(l,3)),this.setAttribute("uv",new pt(c,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new a(e.radius,e.height,e.capSegments,e.radialSegments,e.heightSegments)}},Zi=class a extends kt{constructor(e=1,t=32,n=0,i=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:e,segments:t,thetaStart:n,thetaLength:i},t=Math.max(3,t);let s=[],r=[],o=[],l=[],c=new U,h=new Le;r.push(0,0,0),o.push(0,0,1),l.push(.5,.5);for(let d=0,f=3;d<=t;d++,f+=3){let b=n+d/t*i;c.x=e*Math.cos(b),c.y=e*Math.sin(b),r.push(c.x,c.y,c.z),o.push(0,0,1),h.x=(r[f]/e+1)/2,h.y=(r[f+1]/e+1)/2,l.push(h.x,h.y)}for(let d=1;d<=t;d++)s.push(d,d+1,0);this.setIndex(s),this.setAttribute("position",new pt(r,3)),this.setAttribute("normal",new pt(o,3)),this.setAttribute("uv",new pt(l,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new a(e.radius,e.segments,e.thetaStart,e.thetaLength)}};var Qi=class a extends kt{constructor(e=1,t=1,n=1,i=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:i};let s=e/2,r=t/2,o=Math.floor(n),l=Math.floor(i),c=o+1,h=l+1,d=e/o,f=t/l,b=[],g=[],y=[],p=[];for(let u=0;u<h;u++){let m=u*f-r;for(let M=0;M<c;M++){let x=M*d-s;g.push(x,-m,0),y.push(0,0,1),p.push(M/o),p.push(1-u/l)}}for(let u=0;u<l;u++)for(let m=0;m<o;m++){let M=m+c*u,x=m+c*(u+1),S=m+1+c*(u+1),w=m+1+c*u;b.push(M,x,w),b.push(x,S,w)}this.setIndex(b),this.setAttribute("position",new pt(g,3)),this.setAttribute("normal",new pt(y,3)),this.setAttribute("uv",new pt(p,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new a(e.width,e.height,e.widthSegments,e.heightSegments)}};function Fa(a){let e={};for(let t in a){e[t]={};for(let n in a[t]){let i=a[t][n];if(mh(i))i.isRenderTargetTexture?(ve("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=i.clone();else if(Array.isArray(i))if(mh(i[0])){let s=[];for(let r=0,o=i.length;r<o;r++)s[r]=i[r].clone();e[t][n]=s}else e[t][n]=i.slice();else e[t][n]=i}}return e}function Ut(a){let e={};for(let t=0;t<a.length;t++){let n=Fa(a[t]);for(let i in n)e[i]=n[i]}return e}function mh(a){return a&&(a.isColor||a.isMatrix3||a.isMatrix4||a.isVector2||a.isVector3||a.isVector4||a.isTexture||a.isQuaternion)}function Xf(a){let e=[];for(let t=0;t<a.length;t++)e.push(a[t].clone());return e}function Oc(a){let e=a.getRenderTarget();return e===null?a.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:ze.workingColorSpace}var od={clone:Fa,merge:Ut},qf=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Kf=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,Qt=class extends Ht{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=qf,this.fragmentShader=Kf,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Fa(e.uniforms),this.uniformsGroups=Xf(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let i in this.uniforms){let r=this.uniforms[i].value;r&&r.isTexture?t.uniforms[i]={type:"t",value:r.toJSON(e).uuid}:r&&r.isColor?t.uniforms[i]={type:"c",value:r.getHex()}:r&&r.isVector2?t.uniforms[i]={type:"v2",value:r.toArray()}:r&&r.isVector3?t.uniforms[i]={type:"v3",value:r.toArray()}:r&&r.isVector4?t.uniforms[i]={type:"v4",value:r.toArray()}:r&&r.isMatrix3?t.uniforms[i]={type:"m3",value:r.toArray()}:r&&r.isMatrix4?t.uniforms[i]={type:"m4",value:r.toArray()}:t.uniforms[i]={value:r}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let i in this.extensions)this.extensions[i]===!0&&(n[i]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let n in e.uniforms){let i=e.uniforms[n];switch(this.uniforms[n]={},i.type){case"t":this.uniforms[n].value=t[i.value]||null;break;case"c":this.uniforms[n].value=new Re().setHex(i.value);break;case"v2":this.uniforms[n].value=new Le().fromArray(i.value);break;case"v3":this.uniforms[n].value=new U().fromArray(i.value);break;case"v4":this.uniforms[n].value=new Qe().fromArray(i.value);break;case"m3":this.uniforms[n].value=new Pe().fromArray(i.value);break;case"m4":this.uniforms[n].value=new Ue().fromArray(i.value);break;default:this.uniforms[n].value=i.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(let n in e.extensions)this.extensions[n]=e.extensions[n];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}},pr=class extends Qt{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}},sn=class extends Ht{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Re(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Re(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=uo,this.normalScale=new Le(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new jn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},Gt=class extends sn{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new Le(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return He(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new Re(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new Re(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new Re(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}};var br=class extends Ht{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Kh,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},mr=class extends Ht{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function Ks(a,e){return!a||a.constructor===e?a:typeof e.BYTES_PER_ELEMENT=="number"?new e(a):Array.prototype.slice.call(a)}function Jf(a){function e(i,s){return a[i]-a[s]}let t=a.length,n=new Array(t);for(let i=0;i!==t;++i)n[i]=i;return n.sort(e),n}function gh(a,e,t){let n=a.length,i=new a.constructor(n);for(let s=0,r=0;r!==n;++s){let o=t[s]*e;for(let l=0;l!==e;++l)i[r++]=a[o+l]}return i}function Yf(a,e,t,n){let i=1,s=a[0];for(;s!==void 0&&s[n]===void 0;)s=a[i++];if(s===void 0)return;let r=s[n];if(r!==void 0)if(Array.isArray(r))do r=s[n],r!==void 0&&(e.push(s.time),t.push(...r)),s=a[i++];while(s!==void 0);else if(r.toArray!==void 0)do r=s[n],r!==void 0&&(e.push(s.time),r.toArray(t,t.length)),s=a[i++];while(s!==void 0);else do r=s[n],r!==void 0&&(e.push(s.time),t.push(r)),s=a[i++];while(s!==void 0)}var Tn=class{constructor(e,t,n,i){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=i!==void 0?i:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,i=t[n],s=t[n-1];n:{e:{let r;t:{a:if(!(e<i)){for(let o=n+2;;){if(i===void 0){if(e<s)break a;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===o)break;if(s=i,i=t[++n],e<i)break e}r=t.length;break t}if(!(e>=s)){let o=t[1];e<o&&(n=2,s=o);for(let l=n-2;;){if(s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(i=s,s=t[--n-1],e>=s)break e}r=n,n=0;break t}break n}for(;n<r;){let o=n+r>>>1;e<t[o]?r=o:n=o+1}if(i=t[n],s=t[n-1],s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,s,i)}return this.interpolate_(n,s,e,i)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,s=e*i;for(let r=0;r!==i;++r)t[r]=n[s+r];return t}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},gr=class extends Tn{constructor(e,t,n,i){super(e,t,n,i),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:ic,endingEnd:ic}}intervalChanged_(e,t,n){let i=this.parameterPositions,s=e-2,r=e+1,o=i[s],l=i[r];if(o===void 0)switch(this.getSettings_().endingStart){case sc:s=e,o=2*t-n;break;case rc:s=i.length-2,o=t+i[s]-i[s+1];break;default:s=e,o=n}if(l===void 0)switch(this.getSettings_().endingEnd){case sc:r=e,l=2*n-t;break;case rc:r=1,l=n+i[1]-i[0];break;default:r=e-1,l=t}let c=(n-t)*.5,h=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(l-n),this._offsetPrev=s*h,this._offsetNext=r*h}interpolate_(e,t,n,i){let s=this.resultBuffer,r=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,h=this._offsetPrev,d=this._offsetNext,f=this._weightPrev,b=this._weightNext,g=(n-t)/(i-t),y=g*g,p=y*g,u=-f*p+2*f*y-f*g,m=(1+f)*p+(-1.5-2*f)*y+(-.5+f)*g+1,M=(-1-b)*p+(1.5+b)*y+.5*g,x=b*p-b*y;for(let S=0;S!==o;++S)s[S]=u*r[h+S]+m*r[c+S]+M*r[l+S]+x*r[d+S];return s}},xr=class extends Tn{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let s=this.resultBuffer,r=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,h=(n-t)/(i-t),d=1-h;for(let f=0;f!==o;++f)s[f]=r[c+f]*d+r[l+f]*h;return s}},yr=class extends Tn{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e){return this.copySampleValue_(e-1)}},vr=class extends Tn{interpolate_(e,t,n,i){let s=this.resultBuffer,r=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,h=this.inTangents,d=this.outTangents;if(!h||!d){let g=(n-t)/(i-t),y=1-g;for(let p=0;p!==o;++p)s[p]=r[c+p]*y+r[l+p]*g;return s}let f=o*2,b=e-1;for(let g=0;g!==o;++g){let y=r[c+g],p=r[l+g],u=b*f+g*2,m=d[u],M=d[u+1],x=e*f+g*2,S=h[x],w=h[x+1],T=(n-t)/(i-t),v,E,C,I,k;for(let O=0;O<8;O++){v=T*T,E=v*T,C=1-T,I=C*C,k=I*C;let P=k*t+3*I*T*m+3*C*v*S+E*i-n;if(Math.abs(P)<1e-10)break;let j=3*I*(m-t)+6*C*T*(S-m)+3*v*(i-S);if(Math.abs(j)<1e-10)break;T=T-P/j,T=Math.max(0,Math.min(1,T))}s[g]=k*y+3*I*T*M+3*C*v*w+E*p}return s}},Vt=class{constructor(e,t,n,i){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=Ks(t,this.TimeBufferType),this.values=Ks(n,this.ValueBufferType),this.setInterpolation(i||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:Ks(e.times,Array),values:Ks(e.values,Array)};let i=e.getInterpolation();i!==e.DefaultInterpolation&&(n.interpolation=i)}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new yr(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new xr(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new gr(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new vr(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents),t}setInterpolation(e){let t;switch(e){case Ea:t=this.InterpolantFactoryMethodDiscrete;break;case Ta:t=this.InterpolantFactoryMethodLinear;break;case Zs:t=this.InterpolantFactoryMethodSmooth;break;case ac:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return ve("KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Ea;case this.InterpolantFactoryMethodLinear:return Ta;case this.InterpolantFactoryMethodSmooth:return Zs;case this.InterpolantFactoryMethodBezier:return ac}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]*=e}return this}trim(e,t){let n=this.times,i=n.length,s=0,r=i-1;for(;s!==i&&n[s]<e;)++s;for(;r!==-1&&n[r]>t;)--r;if(++r,s!==0||r!==i){s>=r&&(r=Math.max(r,1),s=r-1);let o=this.getValueSize();this.times=n.slice(s,r),this.values=this.values.slice(s*o,r*o)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(Ie("KeyframeTrack: Invalid value size in track.",this),e=!1);let n=this.times,i=this.values,s=n.length;s===0&&(Ie("KeyframeTrack: Track is empty.",this),e=!1);let r=null;for(let o=0;o!==s;o++){let l=n[o];if(typeof l=="number"&&isNaN(l)){Ie("KeyframeTrack: Time is not a valid number.",this,o,l),e=!1;break}if(r!==null&&r>l){Ie("KeyframeTrack: Out of order keys.",this,o,l,r),e=!1;break}r=l}if(i!==void 0&&cf(i))for(let o=0,l=i.length;o!==l;++o){let c=i[o];if(isNaN(c)){Ie("KeyframeTrack: Value is not a valid number.",this,o,c),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),i=this.getInterpolation()===Zs,s=e.length-1,r=1;for(let o=1;o<s;++o){let l=!1,c=e[o],h=e[o+1];if(c!==h&&(o!==1||c!==e[0]))if(i)l=!0;else{let d=o*n,f=d-n,b=d+n;for(let g=0;g!==n;++g){let y=t[d+g];if(y!==t[f+g]||y!==t[b+g]){l=!0;break}}}if(l){if(o!==r){e[r]=e[o];let d=o*n,f=r*n;for(let b=0;b!==n;++b)t[f+b]=t[d+b]}++r}}if(s>0){e[r]=e[s];for(let o=s*n,l=r*n,c=0;c!==n;++c)t[l+c]=t[o+c];++r}return r!==e.length?(this.times=e.slice(0,r),this.values=t.slice(0,r*n)):(this.times=e,this.values=t),this}clone(){let e=this.times.slice(),t=this.values.slice(),n=this.constructor,i=new n(this.name,e,t);return i.createInterpolant=this.createInterpolant,i}};Vt.prototype.ValueTypeName="";Vt.prototype.TimeBufferType=Float32Array;Vt.prototype.ValueBufferType=Float32Array;Vt.prototype.DefaultInterpolation=Ta;var Gn=class extends Vt{constructor(e,t,n){super(e,t,n)}};Gn.prototype.ValueTypeName="bool";Gn.prototype.ValueBufferType=Array;Gn.prototype.DefaultInterpolation=Ea;Gn.prototype.InterpolantFactoryMethodLinear=void 0;Gn.prototype.InterpolantFactoryMethodSmooth=void 0;var $i=class extends Vt{constructor(e,t,n,i){super(e,t,n,i)}};$i.prototype.ValueTypeName="color";var Vn=class extends Vt{constructor(e,t,n,i){super(e,t,n,i)}};Vn.prototype.ValueTypeName="number";var _r=class extends Tn{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let s=this.resultBuffer,r=this.sampleValues,o=this.valueSize,l=(n-t)/(i-t),c=e*o;for(let h=c+o;c!==h;c+=4)Jt.slerpFlat(s,0,r,c-o,r,c,l);return s}},Wn=class extends Vt{constructor(e,t,n,i){super(e,t,n,i)}InterpolantFactoryMethodLinear(e){return new _r(this.times,this.values,this.getValueSize(),e)}};Wn.prototype.ValueTypeName="quaternion";Wn.prototype.InterpolantFactoryMethodSmooth=void 0;var Xn=class extends Vt{constructor(e,t,n){super(e,t,n)}};Xn.prototype.ValueTypeName="string";Xn.prototype.ValueBufferType=Array;Xn.prototype.DefaultInterpolation=Ea;Xn.prototype.InterpolantFactoryMethodLinear=void 0;Xn.prototype.InterpolantFactoryMethodSmooth=void 0;var ha=class extends Vt{constructor(e,t,n,i){super(e,t,n,i)}};ha.prototype.ValueTypeName="vector";var es=class{constructor(e="",t=-1,n=[],i=qh){this.name=e,this.tracks=n,this.duration=t,this.blendMode=i,this.uuid=un(),this.userData={},this.duration<0&&this.resetDuration()}static parse(e){let t=[],n=e.tracks,i=1/(e.fps||1);for(let r=0,o=n.length;r!==o;++r)t.push(Qf(n[r]).scale(i));let s=new this(e.name,e.duration,t,e.blendMode);return s.uuid=e.uuid,s.userData=JSON.parse(e.userData||"{}"),s}static toJSON(e){let t=[],n=e.tracks,i={name:e.name,duration:e.duration,tracks:t,uuid:e.uuid,blendMode:e.blendMode,userData:JSON.stringify(e.userData)};for(let s=0,r=n.length;s!==r;++s)t.push(Vt.toJSON(n[s]));return i}static CreateFromMorphTargetSequence(e,t,n,i){let s=t.length,r=[];for(let o=0;o<s;o++){let l=[],c=[];l.push((o+s-1)%s,o,(o+1)%s),c.push(0,1,0);let h=Jf(l);l=gh(l,1,h),c=gh(c,1,h),!i&&l[0]===0&&(l.push(s),c.push(c[0])),r.push(new Vn(".morphTargetInfluences["+t[o].name+"]",l,c).scale(1/n))}return new this(e,-1,r)}static findByName(e,t){let n=e;if(!Array.isArray(e)){let i=e;n=i.geometry&&i.geometry.animations||i.animations}for(let i=0;i<n.length;i++)if(n[i].name===t)return n[i];return null}static CreateClipsFromMorphTargetSequences(e,t,n){let i={},s=/^([\w-]*?)([\d]+)$/;for(let o=0,l=e.length;o<l;o++){let c=e[o],h=c.name.match(s);if(h&&h.length>1){let d=h[1],f=i[d];f||(i[d]=f=[]),f.push(c)}}let r=[];for(let o in i)r.push(this.CreateFromMorphTargetSequence(o,i[o],t,n));return r}resetDuration(){let e=this.tracks,t=0;for(let n=0,i=e.length;n!==i;++n){let s=this.tracks[n];t=Math.max(t,s.times[s.times.length-1])}return this.duration=t,this}trim(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].trim(0,this.duration);return this}validate(){let e=!0;for(let t=0;t<this.tracks.length;t++)e=e&&this.tracks[t].validate();return e}optimize(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].optimize();return this}clone(){let e=[];for(let n=0;n<this.tracks.length;n++)e.push(this.tracks[n].clone());let t=new this.constructor(this.name,this.duration,e,this.blendMode);return t.userData=JSON.parse(JSON.stringify(this.userData)),t}toJSON(){return this.constructor.toJSON(this)}};function Zf(a){switch(a.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return Vn;case"vector":case"vector2":case"vector3":case"vector4":return ha;case"color":return $i;case"quaternion":return Wn;case"bool":case"boolean":return Gn;case"string":return Xn}throw new Error("THREE.KeyframeTrack: Unsupported typeName: "+a)}function Qf(a){if(a.type===void 0)throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");let e=Zf(a.type);if(a.times===void 0){let t=[],n=[];Yf(a.keys,t,n,"value"),a.times=t,a.values=n}return e.parse!==void 0?e.parse(a):new e(a.name,a.times,a.values,a.interpolation)}var wn={enabled:!1,files:{},add:function(a,e){this.enabled!==!1&&(xh(a)||(this.files[a]=e))},get:function(a){if(this.enabled!==!1&&!xh(a))return this.files[a]},remove:function(a){delete this.files[a]},clear:function(){this.files={}}};function xh(a){try{let e=a.slice(a.indexOf(":")+1);return new URL(e).protocol==="blob:"}catch{return!1}}var Mr=class{constructor(e,t,n){let i=this,s=!1,r=0,o=0,l,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this._abortController=null,this.itemStart=function(h){o++,s===!1&&i.onStart!==void 0&&i.onStart(h,r,o),s=!0},this.itemEnd=function(h){r++,i.onProgress!==void 0&&i.onProgress(h,r,o),r===o&&(s=!1,i.onLoad!==void 0&&i.onLoad())},this.itemError=function(h){i.onError!==void 0&&i.onError(h)},this.resolveURL=function(h){return h=h.normalize("NFC"),l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,d){return c.push(h,d),this},this.removeHandler=function(h){let d=c.indexOf(h);return d!==-1&&c.splice(d,2),this},this.getHandler=function(h){for(let d=0,f=c.length;d<f;d+=2){let b=c[d],g=c[d+1];if(b.global&&(b.lastIndex=0),b.test(h))return g}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},cd=new Mr,Rn=class{constructor(e){this.manager=e!==void 0?e:cd,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){let n=this;return new Promise(function(i,s){n.load(e,i,t,s)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};Rn.DEFAULT_MATERIAL_NAME="__DEFAULT";var Bn={},lc=class extends Error{constructor(e,t){super(e),this.response=t}},mi=class extends Rn{constructor(e){super(e),this.mimeType="",this.responseType="",this._abortController=new AbortController}load(e,t,n,i){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let s=wn.get(`file:${e}`);if(s!==void 0){this.manager.itemStart(e),setTimeout(()=>{t&&t(s),this.manager.itemEnd(e)},0);return}if(Bn[e]!==void 0){Bn[e].push({onLoad:t,onProgress:n,onError:i});return}Bn[e]=[],Bn[e].push({onLoad:t,onProgress:n,onError:i});let r=new Request(e,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin",signal:typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal}),o=this.mimeType,l=this.responseType;fetch(r).then(c=>{if(c.status===200||c.status===0){if(c.status===0&&ve("FileLoader: HTTP Status 0 received."),typeof ReadableStream>"u"||c.body===void 0||c.body.getReader===void 0)return c;let h=Bn[e],d=c.body.getReader(),f=c.headers.get("X-File-Size")||c.headers.get("Content-Length"),b=f?parseInt(f):0,g=b!==0,y=0,p=new ReadableStream({start(u){m();function m(){d.read().then(({done:M,value:x})=>{if(M)u.close();else{y+=x.byteLength;let S=new ProgressEvent("progress",{lengthComputable:g,loaded:y,total:b});for(let w=0,T=h.length;w<T;w++){let v=h[w];v.onProgress&&v.onProgress(S)}u.enqueue(x),m()}},M=>{u.error(M)})}}});return new Response(p)}else throw new lc(`fetch for "${c.url}" responded with ${c.status}: ${c.statusText}`,c)}).then(c=>{switch(l){case"arraybuffer":return c.arrayBuffer();case"blob":return c.blob();case"document":return c.text().then(h=>new DOMParser().parseFromString(h,o));case"json":return c.json();default:if(o==="")return c.text();{let d=/charset="?([^;"\s]*)"?/i.exec(o),f=d&&d[1]?d[1].toLowerCase():void 0,b=new TextDecoder(f);return c.arrayBuffer().then(g=>b.decode(g))}}}).then(c=>{wn.add(`file:${e}`,c);let h=Bn[e];delete Bn[e];for(let d=0,f=h.length;d<f;d++){let b=h[d];b.onLoad&&b.onLoad(c)}}).catch(c=>{let h=Bn[e];if(h===void 0)throw this.manager.itemError(e),c;delete Bn[e];for(let d=0,f=h.length;d<f;d++){let b=h[d];b.onError&&b.onError(c)}this.manager.itemError(e)}).finally(()=>{this.manager.itemEnd(e)}),this.manager.itemStart(e)}setResponseType(e){return this.responseType=e,this}setMimeType(e){return this.mimeType=e,this}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}};var Qa=new WeakMap,Sr=class extends Rn{constructor(e){super(e)}load(e,t,n,i){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let s=this,r=wn.get(`image:${e}`);if(r!==void 0){if(r.complete===!0)s.manager.itemStart(e),setTimeout(function(){t&&t(r),s.manager.itemEnd(e)},0);else{let d=Qa.get(r);d===void 0&&(d=[],Qa.set(r,d)),d.push({onLoad:t,onError:i})}return r}let o=ii("img");function l(){h(),t&&t(this);let d=Qa.get(this)||[];for(let f=0;f<d.length;f++){let b=d[f];b.onLoad&&b.onLoad(this)}Qa.delete(this),s.manager.itemEnd(e)}function c(d){h(),i&&i(d),wn.remove(`image:${e}`);let f=Qa.get(this)||[];for(let b=0;b<f.length;b++){let g=f[b];g.onError&&g.onError(d)}Qa.delete(this),s.manager.itemError(e),s.manager.itemEnd(e)}function h(){o.removeEventListener("load",l,!1),o.removeEventListener("error",c,!1)}return o.addEventListener("load",l,!1),o.addEventListener("error",c,!1),e.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(o.crossOrigin=this.crossOrigin),wn.add(`image:${e}`,o),s.manager.itemStart(e),o.src=e,o}};var ts=class extends Rn{constructor(e){super(e)}load(e,t,n,i){let s=new It,r=new Sr(this.manager);return r.setCrossOrigin(this.crossOrigin),r.setPath(this.path),r.load(e,function(o){s.image=o,s.needsUpdate=!0,t!==void 0&&t(s)},n,i),s}},ka=class extends rt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new Re(e),this.intensity=t}dispose(){this.dispatchEvent({type:"dispose"})}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}},ns=class extends ka{constructor(e,t,n){super(e,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(rt.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Re(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}toJSON(e){let t=super.toJSON(e);return t.object.groundColor=this.groundColor.getHex(),t}},ec=new Ue,yh=new U,vh=new U,as=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new Le(512,512),this.mapType=Wt,this.map=null,this.mapPass=null,this.matrix=new Ue,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new fi,this._frameExtents=new Le(1,1),this._viewportCount=1,this._viewports=[new Qe(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera,n=this.matrix;yh.setFromMatrixPosition(e.matrixWorld),t.position.copy(yh),vh.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(vh),t.updateMatrixWorld(),ec.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(ec,t.coordinateSystem,t.reversedDepth),t.coordinateSystem===ai||t.reversedDepth?n.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(ec)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},Js=new U,Ys=new Jt,Mn=new U,is=class extends rt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Ue,this.projectionMatrix=new Ue,this.projectionMatrixInverse=new Ue,this.coordinateSystem=fn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(Js,Ys,Mn),Mn.x===1&&Mn.y===1&&Mn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Js,Ys,Mn.set(1,1,1)).invert()}updateWorldMatrix(e,t,n=!1){super.updateWorldMatrix(e,t,n),this.matrixWorld.decompose(Js,Ys,Mn),Mn.x===1&&Mn.y===1&&Mn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Js,Ys,Mn.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},ia=new U,_h=new Le,Mh=new Le,_t=class extends is{constructor(e=50,t=1,n=.1,i=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=Ra*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(Di*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Ra*2*Math.atan(Math.tan(Di*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){ia.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(ia.x,ia.y).multiplyScalar(-e/ia.z),ia.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(ia.x,ia.y).multiplyScalar(-e/ia.z)}getViewSize(e,t){return this.getViewBounds(e,_h,Mh),t.subVectors(Mh,_h)}setViewOffset(e,t,n,i,s,r){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=s,this.view.height=r,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(Di*.5*this.fov)/this.zoom,n=2*t,i=this.aspect*n,s=-.5*i,r=this.view;if(this.view!==null&&this.view.enabled){let l=r.fullWidth,c=r.fullHeight;s+=r.offsetX*i/l,t-=r.offsetY*n/c,i*=r.width/l,n*=r.height/c}let o=this.filmOffset;o!==0&&(s+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+i,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}},hc=class extends as{constructor(){super(new _t(50,1,.5,500)),this.isSpotLightShadow=!0,this.focus=1,this.aspect=1}updateMatrices(e){let t=this.camera,n=Ra*2*e.angle*this.focus,i=this.mapSize.width/this.mapSize.height*this.aspect,s=e.distance||t.far;(n!==t.fov||i!==t.aspect||s!==t.far)&&(t.fov=n,t.aspect=i,t.far=s,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this}},ss=class extends ka{constructor(e,t,n=0,i=Math.PI/3,s=0,r=2){super(e,t),this.isSpotLight=!0,this.type="SpotLight",this.position.copy(rt.DEFAULT_UP),this.updateMatrix(),this.target=new rt,this.distance=n,this.angle=i,this.penumbra=s,this.decay=r,this.map=null,this.shadow=new hc}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.map=e.map,this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.distance=this.distance,t.object.angle=this.angle,t.object.decay=this.decay,t.object.penumbra=this.penumbra,t.object.target=this.target.uuid,this.map&&this.map.isTexture&&(t.object.map=this.map.toJSON(e).uuid),t.object.shadow=this.shadow.toJSON(),t}},dc=class extends as{constructor(){super(new _t(90,1,.5,500)),this.isPointLightShadow=!0}},rs=class extends ka{constructor(e,t,n=0,i=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=i,this.shadow=new dc}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.distance=this.distance,t.object.decay=this.decay,t.object.shadow=this.shadow.toJSON(),t}},da=class extends is{constructor(e=-1,t=1,n=1,i=-1,s=.1,r=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=i,this.near=s,this.far=r,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,i,s,r){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=s,this.view.height=r,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2,s=n-e,r=n+e,o=i+t,l=i-t;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=c*this.view.offsetX,r=s+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(s,r,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},fc=class extends as{constructor(){super(new da(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},Pa=class extends ka{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(rt.DEFAULT_UP),this.updateMatrix(),this.target=new rt,this.shadow=new fc}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}};var qn=class{static extractUrlBase(e){let t=e.lastIndexOf("/");return t===-1?"./":e.slice(0,t+1)}static resolveURL(e,t){return typeof e!="string"||e===""?"":(/^https?:\/\//i.test(t)&&/^\//.test(e)&&(t=t.replace(/(^https?:\/\/[^\/]+).*/i,"$1")),/^(https?:)?\/\//i.test(e)||/^data:.*,.*$/i.test(e)||/^blob:.*$/i.test(e)?e:t+e)}};var tc=new WeakMap,os=class extends Rn{constructor(e){super(e),this.isImageBitmapLoader=!0,typeof createImageBitmap>"u"&&ve("ImageBitmapLoader: createImageBitmap() not supported."),typeof fetch>"u"&&ve("ImageBitmapLoader: fetch() not supported."),this.options={premultiplyAlpha:"none"},this._abortController=new AbortController}setOptions(e){return this.options=e,this}load(e,t,n,i){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let s=this,r=wn.get(`image-bitmap:${e}`);if(r!==void 0){if(s.manager.itemStart(e),r.then){r.then(c=>{tc.has(r)===!0?(i&&i(tc.get(r)),s.manager.itemError(e),s.manager.itemEnd(e)):(t&&t(c),s.manager.itemEnd(e))});return}setTimeout(function(){t&&t(r),s.manager.itemEnd(e)},0);return}let o={};o.credentials=this.crossOrigin==="anonymous"?"same-origin":"include",o.headers=this.requestHeader,o.signal=typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal;let l=fetch(e,o).then(function(c){return c.blob()}).then(function(c){return createImageBitmap(c,Object.assign(s.options,{colorSpaceConversion:"none"}))}).then(function(c){wn.add(`image-bitmap:${e}`,c),t&&t(c),s.manager.itemEnd(e)}).catch(function(c){i&&i(c),tc.set(l,c),wn.remove(`image-bitmap:${e}`),s.manager.itemError(e),s.manager.itemEnd(e)});wn.add(`image-bitmap:${e}`,l),s.manager.itemStart(e)}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}};var $a=-90,ei=1,wr=class extends rt{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let i=new _t($a,ei,e,t);i.layers=this.layers,this.add(i);let s=new _t($a,ei,e,t);s.layers=this.layers,this.add(s);let r=new _t($a,ei,e,t);r.layers=this.layers,this.add(r);let o=new _t($a,ei,e,t);o.layers=this.layers,this.add(o);let l=new _t($a,ei,e,t);l.layers=this.layers,this.add(l);let c=new _t($a,ei,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,i,s,r,o,l]=t;for(let c of t)this.remove(c);if(e===fn)n.up.set(0,1,0),n.lookAt(1,0,0),i.up.set(0,1,0),i.lookAt(-1,0,0),s.up.set(0,0,-1),s.lookAt(0,1,0),r.up.set(0,0,1),r.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===ai)n.up.set(0,-1,0),n.lookAt(-1,0,0),i.up.set(0,-1,0),i.lookAt(1,0,0),s.up.set(0,0,1),s.lookAt(0,1,0),r.up.set(0,0,-1),r.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:i}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[s,r,o,l,c,h]=this.children,d=e.getRenderTarget(),f=e.getActiveCubeFace(),b=e.getActiveMipmapLevel(),g=e.xr.enabled;e.xr.enabled=!1;let y=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let p=!1;e.isWebGLRenderer===!0?p=e.state.buffers.depth.getReversed():p=e.reversedDepthBuffer,e.setRenderTarget(n,0,i),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,s),e.setRenderTarget(n,1,i),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,r),e.setRenderTarget(n,2,i),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,3,i),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(n,4,i),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),n.texture.generateMipmaps=y,e.setRenderTarget(n,5,i),p&&e.autoClear===!1&&e.clearDepth(),e.render(t,h),e.setRenderTarget(d,f,b),e.xr.enabled=g,n.texture.needsPMREMUpdate=!0}},Ar=class extends _t{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}};var Bc="\\[\\]\\.:\\/",$f=new RegExp("["+Bc+"]","g"),zc="[^"+Bc+"]",eu="[^"+Bc.replace("\\.","")+"]",tu=/((?:WC+[\/:])*)/.source.replace("WC",zc),nu=/(WCOD+)?/.source.replace("WCOD",eu),au=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",zc),iu=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",zc),su=new RegExp("^"+tu+nu+au+iu+"$"),ru=["material","materials","bones","map"],uc=class{constructor(e,t,n){let i=n||at.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,i)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,i=this._bindings[n];i!==void 0&&i.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let i=this._targetGroup.nCachedObjects_,s=n.length;i!==s;++i)n[i].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}},at=class a{constructor(e,t,n){this.path=t,this.parsedPath=n||a.parseTrackName(t),this.node=a.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,n){return e&&e.isAnimationObjectGroup?new a.Composite(e,t,n):new a(e,t,n)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace($f,"")}static parseTrackName(e){let t=su.exec(e);if(t===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},i=n.nodeName&&n.nodeName.lastIndexOf(".");if(i!==void 0&&i!==-1){let s=n.nodeName.substring(i+1);ru.indexOf(s)!==-1&&(n.nodeName=n.nodeName.substring(0,i),n.objectName=s)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+e);return n}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(s){for(let r=0;r<s.length;r++){let o=s[r];if(o.name===t||o.uuid===t)return o;let l=n(o.children);if(l)return l}return null},i=n(e.children);if(i)return i}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)e[t++]=n[i]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,s=n.length;i!==s;++i)n[i]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,n=t.objectName,i=t.propertyName,s=t.propertyIndex;if(e||(e=a.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){ve("PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let c=t.objectIndex;switch(n){case"materials":if(!e.material){Ie("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){Ie("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){Ie("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let h=0;h<e.length;h++)if(e[h].name===c){c=h;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){Ie("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){Ie("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[n]===void 0){Ie("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[n]}if(c!==void 0){if(e[c]===void 0){Ie("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}let r=e[i];if(r===void 0){let c=t.nodeName;Ie("PropertyBinding: Trying to update property for track: "+c+"."+i+" but it wasn't found.",e);return}let o=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?o=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(s!==void 0){if(i==="morphTargetInfluences"){if(!e.geometry){Ie("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){Ie("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[s]!==void 0&&(s=e.morphTargetDictionary[s])}l=this.BindingType.ArrayElement,this.resolvedProperty=r,this.propertyIndex=s}else r.fromArray!==void 0&&r.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=r):Array.isArray(r)?(l=this.BindingType.EntireArray,this.resolvedProperty=r):this.propertyName=i;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};at.Composite=uc;at.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};at.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};at.prototype.GetterByBindingType=[at.prototype._getValue_direct,at.prototype._getValue_array,at.prototype._getValue_arrayElement,at.prototype._getValue_toArray];at.prototype.SetterByBindingTypeAndVersioning=[[at.prototype._setValue_direct,at.prototype._setValue_direct_setNeedsUpdate,at.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[at.prototype._setValue_array,at.prototype._setValue_array_setNeedsUpdate,at.prototype._setValue_array_setMatrixWorldNeedsUpdate],[at.prototype._setValue_arrayElement,at.prototype._setValue_arrayElement_setNeedsUpdate,at.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[at.prototype._setValue_fromArray,at.prototype._setValue_fromArray_setNeedsUpdate,at.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var lx=new Float32Array(1);var pc=class a{static{a.prototype.isMatrix2=!0}constructor(e,t,n,i){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,i)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,i){let s=this.elements;return s[0]=e,s[2]=t,s[1]=n,s[3]=i,this}};function jc(a,e,t,n){let i=ou(n);switch(t){case Pc:return a*e;case Pr:return a*e/i.components*i.byteLength;case Nr:return a*e/i.components*i.byteLength;case pa:return a*e*2/i.components*i.byteLength;case Dr:return a*e*2/i.components*i.byteLength;case Nc:return a*e*3/i.components*i.byteLength;case en:return a*e*4/i.components*i.byteLength;case Fr:return a*e*4/i.components*i.byteLength;case hs:case ds:return Math.floor((a+3)/4)*Math.floor((e+3)/4)*8;case fs:case us:return Math.floor((a+3)/4)*Math.floor((e+3)/4)*16;case Lr:case Br:return Math.max(a,16)*Math.max(e,8)/4;case Ur:case Or:return Math.max(a,8)*Math.max(e,8)/2;case zr:case jr:case Gr:case Vr:return Math.floor((a+3)/4)*Math.floor((e+3)/4)*8;case Hr:case ps:case Wr:return Math.floor((a+3)/4)*Math.floor((e+3)/4)*16;case Xr:return Math.floor((a+3)/4)*Math.floor((e+3)/4)*16;case qr:return Math.floor((a+4)/5)*Math.floor((e+3)/4)*16;case Kr:return Math.floor((a+4)/5)*Math.floor((e+4)/5)*16;case Jr:return Math.floor((a+5)/6)*Math.floor((e+4)/5)*16;case Yr:return Math.floor((a+5)/6)*Math.floor((e+5)/6)*16;case Zr:return Math.floor((a+7)/8)*Math.floor((e+4)/5)*16;case Qr:return Math.floor((a+7)/8)*Math.floor((e+5)/6)*16;case $r:return Math.floor((a+7)/8)*Math.floor((e+7)/8)*16;case eo:return Math.floor((a+9)/10)*Math.floor((e+4)/5)*16;case to:return Math.floor((a+9)/10)*Math.floor((e+5)/6)*16;case no:return Math.floor((a+9)/10)*Math.floor((e+7)/8)*16;case ao:return Math.floor((a+9)/10)*Math.floor((e+9)/10)*16;case io:return Math.floor((a+11)/12)*Math.floor((e+9)/10)*16;case so:return Math.floor((a+11)/12)*Math.floor((e+11)/12)*16;case ro:case oo:case co:return Math.ceil(a/4)*Math.ceil(e/4)*16;case lo:case ho:return Math.ceil(a/4)*Math.ceil(e/4)*8;case bs:case fo:return Math.ceil(a/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function ou(a){switch(a){case Wt:case Rc:return{byteLength:1,components:1};case yi:case Ic:case Cn:return{byteLength:2,components:1};case Cr:case kr:return{byteLength:2,components:4};case xn:case Ir:case $t:return{byteLength:4,components:1};case Cc:case kc:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${a}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"185"}}));typeof window<"u"&&(window.__THREE__?ve("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="185");function kd(){let a=null,e=!1,t=null,n=null;function i(s,r){t(s,r),n=a.requestAnimationFrame(i)}return{start:function(){e!==!0&&t!==null&&a!==null&&(n=a.requestAnimationFrame(i),e=!0)},stop:function(){a!==null&&a.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(s){t=s},setContext:function(s){a=s}}}function lu(a){let e=new WeakMap;function t(o,l){let c=o.array,h=o.usage,d=c.byteLength,f=a.createBuffer();a.bindBuffer(l,f),a.bufferData(l,c,h),o.onUploadCallback();let b;if(c instanceof Float32Array)b=a.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)b=a.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?b=a.HALF_FLOAT:b=a.UNSIGNED_SHORT;else if(c instanceof Int16Array)b=a.SHORT;else if(c instanceof Uint32Array)b=a.UNSIGNED_INT;else if(c instanceof Int32Array)b=a.INT;else if(c instanceof Int8Array)b=a.BYTE;else if(c instanceof Uint8Array)b=a.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)b=a.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:f,type:b,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:d}}function n(o,l,c){let h=l.array,d=l.updateRanges;if(a.bindBuffer(c,o),d.length===0)a.bufferSubData(c,0,h);else{d.sort((b,g)=>b.start-g.start);let f=0;for(let b=1;b<d.length;b++){let g=d[f],y=d[b];y.start<=g.start+g.count+1?g.count=Math.max(g.count,y.start+y.count-g.start):(++f,d[f]=y)}d.length=f+1;for(let b=0,g=d.length;b<g;b++){let y=d[b];a.bufferSubData(c,y.start*h.BYTES_PER_ELEMENT,h,y.start,y.count)}l.clearUpdateRanges()}l.onUploadCallback()}function i(o){return o.isInterleavedBufferAttribute&&(o=o.data),e.get(o)}function s(o){o.isInterleavedBufferAttribute&&(o=o.data);let l=e.get(o);l&&(a.deleteBuffer(l.buffer),e.delete(o))}function r(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){let h=e.get(o);(!h||h.version<o.version)&&e.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}let c=e.get(o);if(c===void 0)e.set(o,t(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,o,l),c.version=o.version}}return{get:i,remove:s,update:r}}var hu=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,du=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,fu=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,uu=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,pu=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,bu=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,mu=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,gu=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,xu=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,yu=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,vu=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,_u=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Mu=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Su=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,wu=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Au=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Eu=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Tu=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Ru=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Iu=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Cu=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,ku=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Pu=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,Nu=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Du=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Fu=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,Uu=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Lu=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Ou=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Bu=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,zu="gl_FragColor = linearToOutputTexel( gl_FragColor );",ju=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Hu=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,Gu=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,Vu=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Wu=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Xu=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,qu=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Ku=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Ju=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Yu=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Zu=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Qu=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,$u=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,ep=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,tp=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,np=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,ap=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,ip=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,sp=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,rp=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,op=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,cp=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,lp=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,hp=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,dp=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,fp=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,up=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,pp=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,bp=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,mp=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,gp=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,xp=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,yp=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,vp=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,_p=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Mp=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Sp=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,wp=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Ap=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Ep=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Tp=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Rp=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Ip=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Cp=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,kp=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Pp=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Np=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Dp=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Fp=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Up=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Lp=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Op=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Bp=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,zp=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,jp=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Hp=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Gp=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Vp=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Wp=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Xp=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,qp=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Kp=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,Jp=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Yp=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Zp=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Qp=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,$p=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,eb=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,tb=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,nb=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,ab=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,ib=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,sb=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,rb=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,ob=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,cb=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,lb=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,hb=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,db=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,fb=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,ub=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,pb=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,bb=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,mb=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,gb=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,xb=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,yb=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,vb=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,_b=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Mb=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Sb=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,wb=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Ab=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Eb=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Tb=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Rb=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Ib=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Cb=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,kb=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Pb=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Nb=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Db=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Fb=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Ub=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Lb=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Ob=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,Bb=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,zb=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,jb=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Hb=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Gb=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Oe={alphahash_fragment:hu,alphahash_pars_fragment:du,alphamap_fragment:fu,alphamap_pars_fragment:uu,alphatest_fragment:pu,alphatest_pars_fragment:bu,aomap_fragment:mu,aomap_pars_fragment:gu,batching_pars_vertex:xu,batching_vertex:yu,begin_vertex:vu,beginnormal_vertex:_u,bsdfs:Mu,iridescence_fragment:Su,bumpmap_pars_fragment:wu,clipping_planes_fragment:Au,clipping_planes_pars_fragment:Eu,clipping_planes_pars_vertex:Tu,clipping_planes_vertex:Ru,color_fragment:Iu,color_pars_fragment:Cu,color_pars_vertex:ku,color_vertex:Pu,common:Nu,cube_uv_reflection_fragment:Du,defaultnormal_vertex:Fu,displacementmap_pars_vertex:Uu,displacementmap_vertex:Lu,emissivemap_fragment:Ou,emissivemap_pars_fragment:Bu,colorspace_fragment:zu,colorspace_pars_fragment:ju,envmap_fragment:Hu,envmap_common_pars_fragment:Gu,envmap_pars_fragment:Vu,envmap_pars_vertex:Wu,envmap_physical_pars_fragment:np,envmap_vertex:Xu,fog_vertex:qu,fog_pars_vertex:Ku,fog_fragment:Ju,fog_pars_fragment:Yu,gradientmap_pars_fragment:Zu,lightmap_pars_fragment:Qu,lights_lambert_fragment:$u,lights_lambert_pars_fragment:ep,lights_pars_begin:tp,lights_toon_fragment:ap,lights_toon_pars_fragment:ip,lights_phong_fragment:sp,lights_phong_pars_fragment:rp,lights_physical_fragment:op,lights_physical_pars_fragment:cp,lights_fragment_begin:lp,lights_fragment_maps:hp,lights_fragment_end:dp,lightprobes_pars_fragment:fp,logdepthbuf_fragment:up,logdepthbuf_pars_fragment:pp,logdepthbuf_pars_vertex:bp,logdepthbuf_vertex:mp,map_fragment:gp,map_pars_fragment:xp,map_particle_fragment:yp,map_particle_pars_fragment:vp,metalnessmap_fragment:_p,metalnessmap_pars_fragment:Mp,morphinstance_vertex:Sp,morphcolor_vertex:wp,morphnormal_vertex:Ap,morphtarget_pars_vertex:Ep,morphtarget_vertex:Tp,normal_fragment_begin:Rp,normal_fragment_maps:Ip,normal_pars_fragment:Cp,normal_pars_vertex:kp,normal_vertex:Pp,normalmap_pars_fragment:Np,clearcoat_normal_fragment_begin:Dp,clearcoat_normal_fragment_maps:Fp,clearcoat_pars_fragment:Up,iridescence_pars_fragment:Lp,opaque_fragment:Op,packing:Bp,premultiplied_alpha_fragment:zp,project_vertex:jp,dithering_fragment:Hp,dithering_pars_fragment:Gp,roughnessmap_fragment:Vp,roughnessmap_pars_fragment:Wp,shadowmap_pars_fragment:Xp,shadowmap_pars_vertex:qp,shadowmap_vertex:Kp,shadowmask_pars_fragment:Jp,skinbase_vertex:Yp,skinning_pars_vertex:Zp,skinning_vertex:Qp,skinnormal_vertex:$p,specularmap_fragment:eb,specularmap_pars_fragment:tb,tonemapping_fragment:nb,tonemapping_pars_fragment:ab,transmission_fragment:ib,transmission_pars_fragment:sb,uv_pars_fragment:rb,uv_pars_vertex:ob,uv_vertex:cb,worldpos_vertex:lb,background_vert:hb,background_frag:db,backgroundCube_vert:fb,backgroundCube_frag:ub,cube_vert:pb,cube_frag:bb,depth_vert:mb,depth_frag:gb,distance_vert:xb,distance_frag:yb,equirect_vert:vb,equirect_frag:_b,linedashed_vert:Mb,linedashed_frag:Sb,meshbasic_vert:wb,meshbasic_frag:Ab,meshlambert_vert:Eb,meshlambert_frag:Tb,meshmatcap_vert:Rb,meshmatcap_frag:Ib,meshnormal_vert:Cb,meshnormal_frag:kb,meshphong_vert:Pb,meshphong_frag:Nb,meshphysical_vert:Db,meshphysical_frag:Fb,meshtoon_vert:Ub,meshtoon_frag:Lb,points_vert:Ob,points_frag:Bb,shadow_vert:zb,shadow_frag:jb,sprite_vert:Hb,sprite_frag:Gb},fe={common:{diffuse:{value:new Re(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Pe},alphaMap:{value:null},alphaMapTransform:{value:new Pe},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Pe}},envmap:{envMap:{value:null},envMapRotation:{value:new Pe},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Pe}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Pe}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Pe},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Pe},normalScale:{value:new Le(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Pe},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Pe}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Pe}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Pe}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Re(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new U},probesMax:{value:new U},probesResolution:{value:new U}},points:{diffuse:{value:new Re(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Pe},alphaTest:{value:0},uvTransform:{value:new Pe}},sprite:{diffuse:{value:new Re(16777215)},opacity:{value:1},center:{value:new Le(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Pe},alphaMap:{value:null},alphaMapTransform:{value:new Pe},alphaTest:{value:0}}},Pn={basic:{uniforms:Ut([fe.common,fe.specularmap,fe.envmap,fe.aomap,fe.lightmap,fe.fog]),vertexShader:Oe.meshbasic_vert,fragmentShader:Oe.meshbasic_frag},lambert:{uniforms:Ut([fe.common,fe.specularmap,fe.envmap,fe.aomap,fe.lightmap,fe.emissivemap,fe.bumpmap,fe.normalmap,fe.displacementmap,fe.fog,fe.lights,{emissive:{value:new Re(0)},envMapIntensity:{value:1}}]),vertexShader:Oe.meshlambert_vert,fragmentShader:Oe.meshlambert_frag},phong:{uniforms:Ut([fe.common,fe.specularmap,fe.envmap,fe.aomap,fe.lightmap,fe.emissivemap,fe.bumpmap,fe.normalmap,fe.displacementmap,fe.fog,fe.lights,{emissive:{value:new Re(0)},specular:{value:new Re(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Oe.meshphong_vert,fragmentShader:Oe.meshphong_frag},standard:{uniforms:Ut([fe.common,fe.envmap,fe.aomap,fe.lightmap,fe.emissivemap,fe.bumpmap,fe.normalmap,fe.displacementmap,fe.roughnessmap,fe.metalnessmap,fe.fog,fe.lights,{emissive:{value:new Re(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Oe.meshphysical_vert,fragmentShader:Oe.meshphysical_frag},toon:{uniforms:Ut([fe.common,fe.aomap,fe.lightmap,fe.emissivemap,fe.bumpmap,fe.normalmap,fe.displacementmap,fe.gradientmap,fe.fog,fe.lights,{emissive:{value:new Re(0)}}]),vertexShader:Oe.meshtoon_vert,fragmentShader:Oe.meshtoon_frag},matcap:{uniforms:Ut([fe.common,fe.bumpmap,fe.normalmap,fe.displacementmap,fe.fog,{matcap:{value:null}}]),vertexShader:Oe.meshmatcap_vert,fragmentShader:Oe.meshmatcap_frag},points:{uniforms:Ut([fe.points,fe.fog]),vertexShader:Oe.points_vert,fragmentShader:Oe.points_frag},dashed:{uniforms:Ut([fe.common,fe.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Oe.linedashed_vert,fragmentShader:Oe.linedashed_frag},depth:{uniforms:Ut([fe.common,fe.displacementmap]),vertexShader:Oe.depth_vert,fragmentShader:Oe.depth_frag},normal:{uniforms:Ut([fe.common,fe.bumpmap,fe.normalmap,fe.displacementmap,{opacity:{value:1}}]),vertexShader:Oe.meshnormal_vert,fragmentShader:Oe.meshnormal_frag},sprite:{uniforms:Ut([fe.sprite,fe.fog]),vertexShader:Oe.sprite_vert,fragmentShader:Oe.sprite_frag},background:{uniforms:{uvTransform:{value:new Pe},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Oe.background_vert,fragmentShader:Oe.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Pe}},vertexShader:Oe.backgroundCube_vert,fragmentShader:Oe.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Oe.cube_vert,fragmentShader:Oe.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Oe.equirect_vert,fragmentShader:Oe.equirect_frag},distance:{uniforms:Ut([fe.common,fe.displacementmap,{referencePosition:{value:new U},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Oe.distance_vert,fragmentShader:Oe.distance_frag},shadow:{uniforms:Ut([fe.lights,fe.fog,{color:{value:new Re(0)},opacity:{value:1}}]),vertexShader:Oe.shadow_vert,fragmentShader:Oe.shadow_frag}};Pn.physical={uniforms:Ut([Pn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Pe},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Pe},clearcoatNormalScale:{value:new Le(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Pe},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Pe},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Pe},sheen:{value:0},sheenColor:{value:new Re(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Pe},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Pe},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Pe},transmissionSamplerSize:{value:new Le},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Pe},attenuationDistance:{value:0},attenuationColor:{value:new Re(0)},specularColor:{value:new Re(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Pe},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Pe},anisotropyVector:{value:new Le},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Pe}}]),vertexShader:Oe.meshphysical_vert,fragmentShader:Oe.meshphysical_frag};var mo={r:0,b:0,g:0},Vb=new Ue,Pd=new Pe;Pd.set(-1,0,0,0,1,0,0,0,1);function Wb(a,e,t,n,i,s){let r=new Re(0),o=i===!0?0:1,l,c,h=null,d=0,f=null;function b(m){let M=m.isScene===!0?m.background:null;if(M&&M.isTexture){let x=m.backgroundBlurriness>0;M=e.get(M,x)}return M}function g(m){let M=!1,x=b(m);x===null?p(r,o):x&&x.isColor&&(p(x,1),M=!0);let S=a.xr.getEnvironmentBlendMode();S==="additive"?t.buffers.color.setClear(0,0,0,1,s):S==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,s),(a.autoClear||M)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),a.clear(a.autoClearColor,a.autoClearDepth,a.autoClearStencil))}function y(m,M){let x=b(M);x&&(x.isCubeTexture||x.mapping===ls)?(c===void 0&&(c=new ht(new la(1,1,1),new Qt({name:"BackgroundCubeMaterial",uniforms:Fa(Pn.backgroundCube.uniforms),vertexShader:Pn.backgroundCube.vertexShader,fragmentShader:Pn.backgroundCube.fragmentShader,side:Bt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(S,w,T){this.matrixWorld.copyPosition(T.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(c)),c.material.uniforms.envMap.value=x,c.material.uniforms.backgroundBlurriness.value=M.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=M.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(Vb.makeRotationFromEuler(M.backgroundRotation)).transpose(),x.isCubeTexture&&x.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(Pd),c.material.toneMapped=ze.getTransfer(x.colorSpace)!==Je,(h!==x||d!==x.version||f!==a.toneMapping)&&(c.material.needsUpdate=!0,h=x,d=x.version,f=a.toneMapping),c.layers.enableAll(),m.unshift(c,c.geometry,c.material,0,0,null)):x&&x.isTexture&&(l===void 0&&(l=new ht(new Qi(2,2),new Qt({name:"BackgroundMaterial",uniforms:Fa(Pn.background.uniforms),vertexShader:Pn.background.vertexShader,fragmentShader:Pn.background.fragmentShader,side:pn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(l)),l.material.uniforms.t2D.value=x,l.material.uniforms.backgroundIntensity.value=M.backgroundIntensity,l.material.toneMapped=ze.getTransfer(x.colorSpace)!==Je,x.matrixAutoUpdate===!0&&x.updateMatrix(),l.material.uniforms.uvTransform.value.copy(x.matrix),(h!==x||d!==x.version||f!==a.toneMapping)&&(l.material.needsUpdate=!0,h=x,d=x.version,f=a.toneMapping),l.layers.enableAll(),m.unshift(l,l.geometry,l.material,0,0,null))}function p(m,M){m.getRGB(mo,Oc(a)),t.buffers.color.setClear(mo.r,mo.g,mo.b,M,s)}function u(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return r},setClearColor:function(m,M=1){r.set(m),o=M,p(r,o)},getClearAlpha:function(){return o},setClearAlpha:function(m){o=m,p(r,o)},render:g,addToRenderList:y,dispose:u}}function Xb(a,e){let t=a.getParameter(a.MAX_VERTEX_ATTRIBS),n={},i=f(null),s=i,r=!1;function o(I,k,O,V,P){let j=!1,B=d(I,V,O,k);s!==B&&(s=B,c(s.object)),j=b(I,V,O,P),j&&g(I,V,O,P),P!==null&&e.update(P,a.ELEMENT_ARRAY_BUFFER),(j||r)&&(r=!1,x(I,k,O,V),P!==null&&a.bindBuffer(a.ELEMENT_ARRAY_BUFFER,e.get(P).buffer))}function l(){return a.createVertexArray()}function c(I){return a.bindVertexArray(I)}function h(I){return a.deleteVertexArray(I)}function d(I,k,O,V){let P=V.wireframe===!0,j=n[k.id];j===void 0&&(j={},n[k.id]=j);let B=I.isInstancedMesh===!0?I.id:0,K=j[B];K===void 0&&(K={},j[B]=K);let Q=K[O.id];Q===void 0&&(Q={},K[O.id]=Q);let ee=Q[P];return ee===void 0&&(ee=f(l()),Q[P]=ee),ee}function f(I){let k=[],O=[],V=[];for(let P=0;P<t;P++)k[P]=0,O[P]=0,V[P]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:k,enabledAttributes:O,attributeDivisors:V,object:I,attributes:{},index:null}}function b(I,k,O,V){let P=s.attributes,j=k.attributes,B=0,K=O.getAttributes();for(let Q in K)if(K[Q].location>=0){let ae=P[Q],ie=j[Q];if(ie===void 0&&(Q==="instanceMatrix"&&I.instanceMatrix&&(ie=I.instanceMatrix),Q==="instanceColor"&&I.instanceColor&&(ie=I.instanceColor)),ae===void 0||ae.attribute!==ie||ie&&ae.data!==ie.data)return!0;B++}return s.attributesNum!==B||s.index!==V}function g(I,k,O,V){let P={},j=k.attributes,B=0,K=O.getAttributes();for(let Q in K)if(K[Q].location>=0){let ae=j[Q];ae===void 0&&(Q==="instanceMatrix"&&I.instanceMatrix&&(ae=I.instanceMatrix),Q==="instanceColor"&&I.instanceColor&&(ae=I.instanceColor));let ie={};ie.attribute=ae,ae&&ae.data&&(ie.data=ae.data),P[Q]=ie,B++}s.attributes=P,s.attributesNum=B,s.index=V}function y(){let I=s.newAttributes;for(let k=0,O=I.length;k<O;k++)I[k]=0}function p(I){u(I,0)}function u(I,k){let O=s.newAttributes,V=s.enabledAttributes,P=s.attributeDivisors;O[I]=1,V[I]===0&&(a.enableVertexAttribArray(I),V[I]=1),P[I]!==k&&(a.vertexAttribDivisor(I,k),P[I]=k)}function m(){let I=s.newAttributes,k=s.enabledAttributes;for(let O=0,V=k.length;O<V;O++)k[O]!==I[O]&&(a.disableVertexAttribArray(O),k[O]=0)}function M(I,k,O,V,P,j,B){B===!0?a.vertexAttribIPointer(I,k,O,P,j):a.vertexAttribPointer(I,k,O,V,P,j)}function x(I,k,O,V){y();let P=V.attributes,j=O.getAttributes(),B=k.defaultAttributeValues;for(let K in j){let Q=j[K];if(Q.location>=0){let ee=P[K];if(ee===void 0&&(K==="instanceMatrix"&&I.instanceMatrix&&(ee=I.instanceMatrix),K==="instanceColor"&&I.instanceColor&&(ee=I.instanceColor)),ee!==void 0){let ae=ee.normalized,ie=ee.itemSize,ke=e.get(ee);if(ke===void 0)continue;let Ke=ke.buffer,Ge=ke.type,J=ke.bytesPerElement,re=Ge===a.INT||Ge===a.UNSIGNED_INT||ee.gpuType===Ir;if(ee.isInterleavedBufferAttribute){let te=ee.data,Ce=te.stride,Ne=ee.offset;if(te.isInstancedInterleavedBuffer){for(let Ee=0;Ee<Q.locationSize;Ee++)u(Q.location+Ee,te.meshPerAttribute);I.isInstancedMesh!==!0&&V._maxInstanceCount===void 0&&(V._maxInstanceCount=te.meshPerAttribute*te.count)}else for(let Ee=0;Ee<Q.locationSize;Ee++)p(Q.location+Ee);a.bindBuffer(a.ARRAY_BUFFER,Ke);for(let Ee=0;Ee<Q.locationSize;Ee++)M(Q.location+Ee,ie/Q.locationSize,Ge,ae,Ce*J,(Ne+ie/Q.locationSize*Ee)*J,re)}else{if(ee.isInstancedBufferAttribute){for(let te=0;te<Q.locationSize;te++)u(Q.location+te,ee.meshPerAttribute);I.isInstancedMesh!==!0&&V._maxInstanceCount===void 0&&(V._maxInstanceCount=ee.meshPerAttribute*ee.count)}else for(let te=0;te<Q.locationSize;te++)p(Q.location+te);a.bindBuffer(a.ARRAY_BUFFER,Ke);for(let te=0;te<Q.locationSize;te++)M(Q.location+te,ie/Q.locationSize,Ge,ae,ie*J,ie/Q.locationSize*te*J,re)}}else if(B!==void 0){let ae=B[K];if(ae!==void 0)switch(ae.length){case 2:a.vertexAttrib2fv(Q.location,ae);break;case 3:a.vertexAttrib3fv(Q.location,ae);break;case 4:a.vertexAttrib4fv(Q.location,ae);break;default:a.vertexAttrib1fv(Q.location,ae)}}}}m()}function S(){E();for(let I in n){let k=n[I];for(let O in k){let V=k[O];for(let P in V){let j=V[P];for(let B in j)h(j[B].object),delete j[B];delete V[P]}}delete n[I]}}function w(I){if(n[I.id]===void 0)return;let k=n[I.id];for(let O in k){let V=k[O];for(let P in V){let j=V[P];for(let B in j)h(j[B].object),delete j[B];delete V[P]}}delete n[I.id]}function T(I){for(let k in n){let O=n[k];for(let V in O){let P=O[V];if(P[I.id]===void 0)continue;let j=P[I.id];for(let B in j)h(j[B].object),delete j[B];delete P[I.id]}}}function v(I){for(let k in n){let O=n[k],V=I.isInstancedMesh===!0?I.id:0,P=O[V];if(P!==void 0){for(let j in P){let B=P[j];for(let K in B)h(B[K].object),delete B[K];delete P[j]}delete O[V],Object.keys(O).length===0&&delete n[k]}}}function E(){C(),r=!0,s!==i&&(s=i,c(s.object))}function C(){i.geometry=null,i.program=null,i.wireframe=!1}return{setup:o,reset:E,resetDefaultState:C,dispose:S,releaseStatesOfGeometry:w,releaseStatesOfObject:v,releaseStatesOfProgram:T,initAttributes:y,enableAttribute:p,disableUnusedAttributes:m}}function qb(a,e,t){let n;function i(l){n=l}function s(l,c){a.drawArrays(n,l,c),t.update(c,n,1)}function r(l,c,h){h!==0&&(a.drawArraysInstanced(n,l,c,h),t.update(c,n,h))}function o(l,c,h){if(h===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,l,0,c,0,h);let f=0;for(let b=0;b<h;b++)f+=c[b];t.update(f,n,1)}this.setMode=i,this.render=s,this.renderInstances=r,this.renderMultiDraw=o}function Kb(a,e,t,n){let i;function s(){if(i!==void 0)return i;if(e.has("EXT_texture_filter_anisotropic")===!0){let T=e.get("EXT_texture_filter_anisotropic");i=a.getParameter(T.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function r(T){return!(T!==en&&n.convert(T)!==a.getParameter(a.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(T){let v=T===Cn&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(T!==Wt&&n.convert(T)!==a.getParameter(a.IMPLEMENTATION_COLOR_READ_TYPE)&&T!==$t&&!v)}function l(T){if(T==="highp"){if(a.getShaderPrecisionFormat(a.VERTEX_SHADER,a.HIGH_FLOAT).precision>0&&a.getShaderPrecisionFormat(a.FRAGMENT_SHADER,a.HIGH_FLOAT).precision>0)return"highp";T="mediump"}return T==="mediump"&&a.getShaderPrecisionFormat(a.VERTEX_SHADER,a.MEDIUM_FLOAT).precision>0&&a.getShaderPrecisionFormat(a.FRAGMENT_SHADER,a.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp",h=l(c);h!==c&&(ve("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);let d=t.logarithmicDepthBuffer===!0,f=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control");t.reversedDepthBuffer===!0&&f===!1&&ve("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let b=a.getParameter(a.MAX_TEXTURE_IMAGE_UNITS),g=a.getParameter(a.MAX_VERTEX_TEXTURE_IMAGE_UNITS),y=a.getParameter(a.MAX_TEXTURE_SIZE),p=a.getParameter(a.MAX_CUBE_MAP_TEXTURE_SIZE),u=a.getParameter(a.MAX_VERTEX_ATTRIBS),m=a.getParameter(a.MAX_VERTEX_UNIFORM_VECTORS),M=a.getParameter(a.MAX_VARYING_VECTORS),x=a.getParameter(a.MAX_FRAGMENT_UNIFORM_VECTORS),S=a.getParameter(a.MAX_SAMPLES),w=a.getParameter(a.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:l,textureFormatReadable:r,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:d,reversedDepthBuffer:f,maxTextures:b,maxVertexTextures:g,maxTextureSize:y,maxCubemapSize:p,maxAttributes:u,maxVertexUniforms:m,maxVaryings:M,maxFragmentUniforms:x,maxSamples:S,samples:w}}function Jb(a){let e=this,t=null,n=0,i=!1,s=!1,r=new Sn,o=new Pe,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(d,f){let b=d.length!==0||f||n!==0||i;return i=f,n=d.length,b},this.beginShadows=function(){s=!0,h(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(d,f){t=h(d,f,0)},this.setState=function(d,f,b){let g=d.clippingPlanes,y=d.clipIntersection,p=d.clipShadows,u=a.get(d);if(!i||g===null||g.length===0||s&&!p)s?h(null):c();else{let m=s?0:n,M=m*4,x=u.clippingState||null;l.value=x,x=h(g,f,M,b);for(let S=0;S!==M;++S)x[S]=t[S];u.clippingState=x,this.numIntersection=y?this.numPlanes:0,this.numPlanes+=m}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function h(d,f,b,g){let y=d!==null?d.length:0,p=null;if(y!==0){if(p=l.value,g!==!0||p===null){let u=b+y*4,m=f.matrixWorldInverse;o.getNormalMatrix(m),(p===null||p.length<u)&&(p=new Float32Array(u));for(let M=0,x=b;M!==y;++M,x+=4)r.copy(d[M]).applyMatrix4(m,o),r.normal.toArray(p,x),p[x+3]=r.constant}l.value=p,l.needsUpdate=!0}return e.numPlanes=y,e.numIntersection=0,p}}var ba=4,ld=[.125,.215,.35,.446,.526,.582],Ua=20,Yb=256,gs=new da,hd=new Re,Hc=null,Gc=0,Vc=0,Wc=!1,Zb=new U,xo=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,i=100,s={}){let{size:r=256,position:o=Zb}=s;Hc=this._renderer.getRenderTarget(),Gc=this._renderer.getActiveCubeFace(),Vc=this._renderer.getActiveMipmapLevel(),Wc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(r);let l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,n,i,l,o),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=ud(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=fd(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(Hc,Gc,Vc),this._renderer.xr.enabled=Wc,e.scissorTest=!1,Mi(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===fa||e.mapping===Na?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Hc=this._renderer.getRenderTarget(),Gc=this._renderer.getActiveCubeFace(),Vc=this._renderer.getActiveMipmapLevel(),Wc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:mt,minFilter:mt,generateMipmaps:!1,type:Cn,format:en,colorSpace:Ot,depthBuffer:!1},i=dd(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=dd(e,t,n);let{_lodMax:s}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=Qb(s)),this._blurMaterial=em(s,e,t),this._ggxMaterial=$b(s,e,t)}return i}_compileMaterial(e){let t=new ht(new kt,e);this._renderer.compile(t,gs)}_sceneToCubeUV(e,t,n,i,s){let l=new _t(90,1,t,n),c=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],d=this._renderer,f=d.autoClear,b=d.toneMapping;d.getClearColor(hd),d.toneMapping=mn,d.autoClear=!1,d.state.buffers.depth.getReversed()&&(d.setRenderTarget(i),d.clearDepth(),d.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new ht(new la,new bn({name:"PMREM.Background",side:Bt,depthWrite:!1,depthTest:!1})));let y=this._backgroundBox,p=y.material,u=!1,m=e.background;m?m.isColor&&(p.color.copy(m),e.background=null,u=!0):(p.color.copy(hd),u=!0);for(let M=0;M<6;M++){let x=M%3;x===0?(l.up.set(0,c[M],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x+h[M],s.y,s.z)):x===1?(l.up.set(0,0,c[M]),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y+h[M],s.z)):(l.up.set(0,c[M],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y,s.z+h[M]));let S=this._cubeSize;Mi(i,x*S,M>2?S:0,S,S),d.setRenderTarget(i),u&&d.render(y,l),d.render(e,l)}d.toneMapping=b,d.autoClear=f,e.background=m}_textureToCubeUV(e,t){let n=this._renderer,i=e.mapping===fa||e.mapping===Na;i?(this._cubemapMaterial===null&&(this._cubemapMaterial=ud()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=fd());let s=i?this._cubemapMaterial:this._equirectMaterial,r=this._lodMeshes[0];r.material=s;let o=s.uniforms;o.envMap.value=e;let l=this._cubeSize;Mi(t,0,0,3*l,2*l),n.setRenderTarget(t),n.render(r,gs)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let i=this._lodMeshes.length;for(let s=1;s<i;s++)this._applyGGXFilter(e,s-1,s);t.autoClear=n}_applyGGXFilter(e,t,n){let i=this._renderer,s=this._pingPongRenderTarget,r=this._ggxMaterial,o=this._lodMeshes[n];o.material=r;let l=r.uniforms,c=n/(this._lodMeshes.length-1),h=t/(this._lodMeshes.length-1),d=Math.sqrt(c*c-h*h),f=0+c*1.25,b=d*f,{_lodMax:g}=this,y=this._sizeLods[n],p=3*y*(n>g-ba?n-g+ba:0),u=4*(this._cubeSize-y);l.envMap.value=e.texture,l.roughness.value=b,l.mipInt.value=g-t,Mi(s,p,u,3*y,2*y),i.setRenderTarget(s),i.render(o,gs),l.envMap.value=s.texture,l.roughness.value=0,l.mipInt.value=g-n,Mi(e,p,u,3*y,2*y),i.setRenderTarget(e),i.render(o,gs)}_blur(e,t,n,i,s){let r=this._pingPongRenderTarget;this._halfBlur(e,r,t,n,i,"latitudinal",s),this._halfBlur(r,e,n,n,i,"longitudinal",s)}_halfBlur(e,t,n,i,s,r,o){let l=this._renderer,c=this._blurMaterial;r!=="latitudinal"&&r!=="longitudinal"&&Ie("blur direction must be either latitudinal or longitudinal!");let h=3,d=this._lodMeshes[i];d.material=c;let f=c.uniforms,b=this._sizeLods[n]-1,g=isFinite(s)?Math.PI/(2*b):2*Math.PI/(2*Ua-1),y=s/g,p=isFinite(s)?1+Math.floor(h*y):Ua;p>Ua&&ve(`sigmaRadians, ${s}, is too large and will clip, as it requested ${p} samples when the maximum is set to ${Ua}`);let u=[],m=0;for(let T=0;T<Ua;++T){let v=T/y,E=Math.exp(-v*v/2);u.push(E),T===0?m+=E:T<p&&(m+=2*E)}for(let T=0;T<u.length;T++)u[T]=u[T]/m;f.envMap.value=e.texture,f.samples.value=p,f.weights.value=u,f.latitudinal.value=r==="latitudinal",o&&(f.poleAxis.value=o);let{_lodMax:M}=this;f.dTheta.value=g,f.mipInt.value=M-n;let x=this._sizeLods[i],S=3*x*(i>M-ba?i-M+ba:0),w=4*(this._cubeSize-x);Mi(t,S,w,3*x,2*x),l.setRenderTarget(t),l.render(d,gs)}};function Qb(a){let e=[],t=[],n=[],i=a,s=a-ba+1+ld.length;for(let r=0;r<s;r++){let o=Math.pow(2,i);e.push(o);let l=1/o;r>a-ba?l=ld[r-a+ba-1]:r===0&&(l=0),t.push(l);let c=1/(o-2),h=-c,d=1+c,f=[h,h,d,h,d,d,h,h,d,d,h,d],b=6,g=6,y=3,p=2,u=1,m=new Float32Array(y*g*b),M=new Float32Array(p*g*b),x=new Float32Array(u*g*b);for(let w=0;w<b;w++){let T=w%3*2/3-1,v=w>2?0:-1,E=[T,v,0,T+2/3,v,0,T+2/3,v+1,0,T,v,0,T+2/3,v+1,0,T,v+1,0];m.set(E,y*g*w),M.set(f,p*g*w);let C=[w,w,w,w,w,w];x.set(C,u*g*w)}let S=new kt;S.setAttribute("position",new Mt(m,y)),S.setAttribute("uv",new Mt(M,p)),S.setAttribute("faceIndex",new Mt(x,u)),n.push(new ht(S,null)),i>ba&&i--}return{lodMeshes:n,sizeLods:e,sigmas:t}}function dd(a,e,t){let n=new Yt(a,e,t);return n.texture.mapping=ls,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function Mi(a,e,t,n,i){a.viewport.set(e,t,n,i),a.scissor.set(e,t,n,i)}function $b(a,e,t){return new Qt({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:Yb,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${a}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:_o(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:In,depthTest:!1,depthWrite:!1})}function em(a,e,t){let n=new Float32Array(Ua),i=new U(0,1,0);return new Qt({name:"SphericalGaussianBlur",defines:{n:Ua,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${a}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:i}},vertexShader:_o(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:In,depthTest:!1,depthWrite:!1})}function fd(){return new Qt({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:_o(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:In,depthTest:!1,depthWrite:!1})}function ud(){return new Qt({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:_o(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:In,depthTest:!1,depthWrite:!1})}function _o(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}var yo=class extends Yt{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},i=[n,n,n,n,n,n];this.texture=new Ji(i),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},i=new la(5,5,5),s=new Qt({name:"CubemapFromEquirect",uniforms:Fa(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Bt,blending:In});s.uniforms.tEquirect.value=t;let r=new ht(i,s),o=t.minFilter;return t.minFilter===gn&&(t.minFilter=mt),new wr(1,10,this).update(e,r),t.minFilter=o,r.geometry.dispose(),r.material.dispose(),this}clear(e,t=!0,n=!0,i=!0){let s=e.getRenderTarget();for(let r=0;r<6;r++)e.setRenderTarget(this,r),e.clear(t,n,i);e.setRenderTarget(s)}};function tm(a){let e=new WeakMap,t=new WeakMap,n=null;function i(f,b=!1){return f==null?null:b?r(f):s(f)}function s(f){if(f&&f.isTexture){let b=f.mapping;if(b===Er||b===Tr)if(e.has(f)){let g=e.get(f).texture;return o(g,f.mapping)}else{let g=f.image;if(g&&g.height>0){let y=new yo(g.height);return y.fromEquirectangularTexture(a,f),e.set(f,y),f.addEventListener("dispose",c),o(y.texture,f.mapping)}else return null}}return f}function r(f){if(f&&f.isTexture){let b=f.mapping,g=b===Er||b===Tr,y=b===fa||b===Na;if(g||y){let p=t.get(f),u=p!==void 0?p.texture.pmremVersion:0;if(f.isRenderTargetTexture&&f.pmremVersion!==u)return n===null&&(n=new xo(a)),p=g?n.fromEquirectangular(f,p):n.fromCubemap(f,p),p.texture.pmremVersion=f.pmremVersion,t.set(f,p),p.texture;if(p!==void 0)return p.texture;{let m=f.image;return g&&m&&m.height>0||y&&m&&l(m)?(n===null&&(n=new xo(a)),p=g?n.fromEquirectangular(f):n.fromCubemap(f),p.texture.pmremVersion=f.pmremVersion,t.set(f,p),f.addEventListener("dispose",h),p.texture):null}}}return f}function o(f,b){return b===Er?f.mapping=fa:b===Tr&&(f.mapping=Na),f}function l(f){let b=0,g=6;for(let y=0;y<g;y++)f[y]!==void 0&&b++;return b===g}function c(f){let b=f.target;b.removeEventListener("dispose",c);let g=e.get(b);g!==void 0&&(e.delete(b),g.dispose())}function h(f){let b=f.target;b.removeEventListener("dispose",h);let g=t.get(b);g!==void 0&&(t.delete(b),g.dispose())}function d(){e=new WeakMap,t=new WeakMap,n!==null&&(n.dispose(),n=null)}return{get:i,dispose:d}}function nm(a){let e={};function t(n){if(e[n]!==void 0)return e[n];let i=a.getExtension(n);return e[n]=i,i}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){let i=t(n);return i===null&&Sa("WebGLRenderer: "+n+" extension not supported."),i}}}function am(a,e,t,n){let i={},s=new WeakMap;function r(d){let f=d.target;f.index!==null&&e.remove(f.index);for(let g in f.attributes)e.remove(f.attributes[g]);f.removeEventListener("dispose",r),delete i[f.id];let b=s.get(f);b&&(e.remove(b),s.delete(f)),n.releaseStatesOfGeometry(f),f.isInstancedBufferGeometry===!0&&delete f._maxInstanceCount,t.memory.geometries--}function o(d,f){return i[f.id]===!0||(f.addEventListener("dispose",r),i[f.id]=!0,t.memory.geometries++),f}function l(d){let f=d.attributes;for(let b in f)e.update(f[b],a.ARRAY_BUFFER)}function c(d){let f=[],b=d.index,g=d.attributes.position,y=0;if(g===void 0)return;if(b!==null){let m=b.array;y=b.version;for(let M=0,x=m.length;M<x;M+=3){let S=m[M+0],w=m[M+1],T=m[M+2];f.push(S,w,w,T,T,S)}}else{let m=g.array;y=g.version;for(let M=0,x=m.length/3-1;M<x;M+=3){let S=M+0,w=M+1,T=M+2;f.push(S,w,w,T,T,S)}}let p=new(g.count>=65535?Hi:ji)(f,1);p.version=y;let u=s.get(d);u&&e.remove(u),s.set(d,p)}function h(d){let f=s.get(d);if(f){let b=d.index;b!==null&&f.version<b.version&&c(d)}else c(d);return s.get(d)}return{get:o,update:l,getWireframeAttribute:h}}function im(a,e,t){let n;function i(d){n=d}let s,r;function o(d){s=d.type,r=d.bytesPerElement}function l(d,f){a.drawElements(n,f,s,d*r),t.update(f,n,1)}function c(d,f,b){b!==0&&(a.drawElementsInstanced(n,f,s,d*r,b),t.update(f,n,b))}function h(d,f,b){if(b===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,f,0,s,d,0,b);let y=0;for(let p=0;p<b;p++)y+=f[p];t.update(y,n,1)}this.setMode=i,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function sm(a){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(s,r,o){switch(t.calls++,r){case a.TRIANGLES:t.triangles+=o*(s/3);break;case a.LINES:t.lines+=o*(s/2);break;case a.LINE_STRIP:t.lines+=o*(s-1);break;case a.LINE_LOOP:t.lines+=o*s;break;case a.POINTS:t.points+=o*s;break;default:Ie("WebGLInfo: Unknown draw mode:",r);break}}function i(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:i,update:n}}function rm(a,e,t){let n=new WeakMap,i=new Qe;function s(r,o,l){let c=r.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,d=h!==void 0?h.length:0,f=n.get(o);if(f===void 0||f.count!==d){let E=function(){T.dispose(),n.delete(o),o.removeEventListener("dispose",E)};f!==void 0&&f.texture.dispose();let b=o.morphAttributes.position!==void 0,g=o.morphAttributes.normal!==void 0,y=o.morphAttributes.color!==void 0,p=o.morphAttributes.position||[],u=o.morphAttributes.normal||[],m=o.morphAttributes.color||[],M=0;b===!0&&(M=1),g===!0&&(M=2),y===!0&&(M=3);let x=o.attributes.position.count*M,S=1;x>e.maxTextureSize&&(S=Math.ceil(x/e.maxTextureSize),x=e.maxTextureSize);let w=new Float32Array(x*S*4*d),T=new Oi(w,x,S,d);T.type=$t,T.needsUpdate=!0;let v=M*4;for(let C=0;C<d;C++){let I=p[C],k=u[C],O=m[C],V=x*S*4*C;for(let P=0;P<I.count;P++){let j=P*v;b===!0&&(i.fromBufferAttribute(I,P),w[V+j+0]=i.x,w[V+j+1]=i.y,w[V+j+2]=i.z,w[V+j+3]=0),g===!0&&(i.fromBufferAttribute(k,P),w[V+j+4]=i.x,w[V+j+5]=i.y,w[V+j+6]=i.z,w[V+j+7]=0),y===!0&&(i.fromBufferAttribute(O,P),w[V+j+8]=i.x,w[V+j+9]=i.y,w[V+j+10]=i.z,w[V+j+11]=O.itemSize===4?i.w:1)}}f={count:d,texture:T,size:new Le(x,S)},n.set(o,f),o.addEventListener("dispose",E)}if(r.isInstancedMesh===!0&&r.morphTexture!==null)l.getUniforms().setValue(a,"morphTexture",r.morphTexture,t);else{let b=0;for(let y=0;y<c.length;y++)b+=c[y];let g=o.morphTargetsRelative?1:1-b;l.getUniforms().setValue(a,"morphTargetBaseInfluence",g),l.getUniforms().setValue(a,"morphTargetInfluences",c)}l.getUniforms().setValue(a,"morphTargetsTexture",f.texture,t),l.getUniforms().setValue(a,"morphTargetsTextureSize",f.size)}return{update:s}}function om(a,e,t,n,i){let s=new WeakMap;function r(c){let h=i.render.frame,d=c.geometry,f=e.get(c,d);if(s.get(f)!==h&&(e.update(f),s.set(f,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),s.get(c)!==h&&(t.update(c.instanceMatrix,a.ARRAY_BUFFER),c.instanceColor!==null&&t.update(c.instanceColor,a.ARRAY_BUFFER),s.set(c,h))),c.isSkinnedMesh){let b=c.skeleton;s.get(b)!==h&&(b.update(),s.set(b,h))}return f}function o(){s=new WeakMap}function l(c){let h=c.target;h.removeEventListener("dispose",l),n.releaseStatesOfObject(h),t.remove(h.instanceMatrix),h.instanceColor!==null&&t.remove(h.instanceColor)}return{update:r,dispose:o}}var cm={[vc]:"LINEAR_TONE_MAPPING",[_c]:"REINHARD_TONE_MAPPING",[Mc]:"CINEON_TONE_MAPPING",[Sc]:"ACES_FILMIC_TONE_MAPPING",[Ac]:"AGX_TONE_MAPPING",[Ec]:"NEUTRAL_TONE_MAPPING",[wc]:"CUSTOM_TONE_MAPPING"};function lm(a,e,t,n,i,s){let r=new Yt(e,t,{type:a,depthBuffer:i,stencilBuffer:s,samples:n?4:0,depthTexture:i?new Hn(e,t):void 0}),o=new Yt(e,t,{type:Cn,depthBuffer:!1,stencilBuffer:!1}),l=new kt;l.setAttribute("position",new pt([-1,3,0,-1,-1,0,3,-1,0],3)),l.setAttribute("uv",new pt([0,2,0,0,2,0],2));let c=new pr({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),h=new ht(l,c),d=new da(-1,1,1,-1,0,1),f=null,b=null,g=!1,y,p=null,u=[],m=!1;this.setSize=function(M,x){r.setSize(M,x),o.setSize(M,x);for(let S=0;S<u.length;S++){let w=u[S];w.setSize&&w.setSize(M,x)}},this.setEffects=function(M){u=M,m=u.length>0&&u[0].isRenderPass===!0;let x=r.width,S=r.height;for(let w=0;w<u.length;w++){let T=u[w];T.setSize&&T.setSize(x,S)}},this.begin=function(M,x){if(g||M.toneMapping===mn&&u.length===0)return!1;if(p=x,x!==null){let S=x.width,w=x.height;(r.width!==S||r.height!==w)&&this.setSize(S,w)}return m===!1&&M.setRenderTarget(r),y=M.toneMapping,M.toneMapping=mn,!0},this.hasRenderPass=function(){return m},this.end=function(M,x){M.toneMapping=y,g=!0;let S=r,w=o;for(let T=0;T<u.length;T++){let v=u[T];if(v.enabled!==!1&&(v.render(M,w,S,x),v.needsSwap!==!1)){let E=S;S=w,w=E}}if(f!==M.outputColorSpace||b!==M.toneMapping){f=M.outputColorSpace,b=M.toneMapping,c.defines={},ze.getTransfer(f)===Je&&(c.defines.SRGB_TRANSFER="");let T=cm[b];T&&(c.defines[T]=""),c.needsUpdate=!0}c.uniforms.tDiffuse.value=S.texture,M.setRenderTarget(p),M.render(h,d),p=null,g=!1},this.isCompositing=function(){return g},this.dispose=function(){r.depthTexture&&r.depthTexture.dispose(),r.dispose(),o.dispose(),l.dispose(),c.dispose()}}var Nd=new It,Kc=new Hn(1,1),Dd=new Oi,Fd=new hr,Ud=new Ji,pd=[],bd=[],md=new Float32Array(16),gd=new Float32Array(9),xd=new Float32Array(4);function wi(a,e,t){let n=a[0];if(n<=0||n>0)return a;let i=e*t,s=pd[i];if(s===void 0&&(s=new Float32Array(i),pd[i]=s),e!==0){n.toArray(s,0);for(let r=1,o=0;r!==e;++r)o+=t,a[r].toArray(s,o)}return s}function At(a,e){if(a.length!==e.length)return!1;for(let t=0,n=a.length;t<n;t++)if(a[t]!==e[t])return!1;return!0}function Et(a,e){for(let t=0,n=e.length;t<n;t++)a[t]=e[t]}function Mo(a,e){let t=bd[e];t===void 0&&(t=new Int32Array(e),bd[e]=t);for(let n=0;n!==e;++n)t[n]=a.allocateTextureUnit();return t}function hm(a,e){let t=this.cache;t[0]!==e&&(a.uniform1f(this.addr,e),t[0]=e)}function dm(a,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(a.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(At(t,e))return;a.uniform2fv(this.addr,e),Et(t,e)}}function fm(a,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(a.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(a.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(At(t,e))return;a.uniform3fv(this.addr,e),Et(t,e)}}function um(a,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(a.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(At(t,e))return;a.uniform4fv(this.addr,e),Et(t,e)}}function pm(a,e){let t=this.cache,n=e.elements;if(n===void 0){if(At(t,e))return;a.uniformMatrix2fv(this.addr,!1,e),Et(t,e)}else{if(At(t,n))return;xd.set(n),a.uniformMatrix2fv(this.addr,!1,xd),Et(t,n)}}function bm(a,e){let t=this.cache,n=e.elements;if(n===void 0){if(At(t,e))return;a.uniformMatrix3fv(this.addr,!1,e),Et(t,e)}else{if(At(t,n))return;gd.set(n),a.uniformMatrix3fv(this.addr,!1,gd),Et(t,n)}}function mm(a,e){let t=this.cache,n=e.elements;if(n===void 0){if(At(t,e))return;a.uniformMatrix4fv(this.addr,!1,e),Et(t,e)}else{if(At(t,n))return;md.set(n),a.uniformMatrix4fv(this.addr,!1,md),Et(t,n)}}function gm(a,e){let t=this.cache;t[0]!==e&&(a.uniform1i(this.addr,e),t[0]=e)}function xm(a,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(a.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(At(t,e))return;a.uniform2iv(this.addr,e),Et(t,e)}}function ym(a,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(a.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(At(t,e))return;a.uniform3iv(this.addr,e),Et(t,e)}}function vm(a,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(a.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(At(t,e))return;a.uniform4iv(this.addr,e),Et(t,e)}}function _m(a,e){let t=this.cache;t[0]!==e&&(a.uniform1ui(this.addr,e),t[0]=e)}function Mm(a,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(a.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(At(t,e))return;a.uniform2uiv(this.addr,e),Et(t,e)}}function Sm(a,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(a.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(At(t,e))return;a.uniform3uiv(this.addr,e),Et(t,e)}}function wm(a,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(a.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(At(t,e))return;a.uniform4uiv(this.addr,e),Et(t,e)}}function Am(a,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(a.uniform1i(this.addr,i),n[0]=i);let s;this.type===a.SAMPLER_2D_SHADOW?(Kc.compareFunction=t.isReversedDepthBuffer()?bo:po,s=Kc):s=Nd,t.setTexture2D(e||s,i)}function Em(a,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(a.uniform1i(this.addr,i),n[0]=i),t.setTexture3D(e||Fd,i)}function Tm(a,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(a.uniform1i(this.addr,i),n[0]=i),t.setTextureCube(e||Ud,i)}function Rm(a,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(a.uniform1i(this.addr,i),n[0]=i),t.setTexture2DArray(e||Dd,i)}function Im(a){switch(a){case 5126:return hm;case 35664:return dm;case 35665:return fm;case 35666:return um;case 35674:return pm;case 35675:return bm;case 35676:return mm;case 5124:case 35670:return gm;case 35667:case 35671:return xm;case 35668:case 35672:return ym;case 35669:case 35673:return vm;case 5125:return _m;case 36294:return Mm;case 36295:return Sm;case 36296:return wm;case 35678:case 36198:case 36298:case 36306:case 35682:return Am;case 35679:case 36299:case 36307:return Em;case 35680:case 36300:case 36308:case 36293:return Tm;case 36289:case 36303:case 36311:case 36292:return Rm}}function Cm(a,e){a.uniform1fv(this.addr,e)}function km(a,e){let t=wi(e,this.size,2);a.uniform2fv(this.addr,t)}function Pm(a,e){let t=wi(e,this.size,3);a.uniform3fv(this.addr,t)}function Nm(a,e){let t=wi(e,this.size,4);a.uniform4fv(this.addr,t)}function Dm(a,e){let t=wi(e,this.size,4);a.uniformMatrix2fv(this.addr,!1,t)}function Fm(a,e){let t=wi(e,this.size,9);a.uniformMatrix3fv(this.addr,!1,t)}function Um(a,e){let t=wi(e,this.size,16);a.uniformMatrix4fv(this.addr,!1,t)}function Lm(a,e){a.uniform1iv(this.addr,e)}function Om(a,e){a.uniform2iv(this.addr,e)}function Bm(a,e){a.uniform3iv(this.addr,e)}function zm(a,e){a.uniform4iv(this.addr,e)}function jm(a,e){a.uniform1uiv(this.addr,e)}function Hm(a,e){a.uniform2uiv(this.addr,e)}function Gm(a,e){a.uniform3uiv(this.addr,e)}function Vm(a,e){a.uniform4uiv(this.addr,e)}function Wm(a,e,t){let n=this.cache,i=e.length,s=Mo(t,i);At(n,s)||(a.uniform1iv(this.addr,s),Et(n,s));let r;this.type===a.SAMPLER_2D_SHADOW?r=Kc:r=Nd;for(let o=0;o!==i;++o)t.setTexture2D(e[o]||r,s[o])}function Xm(a,e,t){let n=this.cache,i=e.length,s=Mo(t,i);At(n,s)||(a.uniform1iv(this.addr,s),Et(n,s));for(let r=0;r!==i;++r)t.setTexture3D(e[r]||Fd,s[r])}function qm(a,e,t){let n=this.cache,i=e.length,s=Mo(t,i);At(n,s)||(a.uniform1iv(this.addr,s),Et(n,s));for(let r=0;r!==i;++r)t.setTextureCube(e[r]||Ud,s[r])}function Km(a,e,t){let n=this.cache,i=e.length,s=Mo(t,i);At(n,s)||(a.uniform1iv(this.addr,s),Et(n,s));for(let r=0;r!==i;++r)t.setTexture2DArray(e[r]||Dd,s[r])}function Jm(a){switch(a){case 5126:return Cm;case 35664:return km;case 35665:return Pm;case 35666:return Nm;case 35674:return Dm;case 35675:return Fm;case 35676:return Um;case 5124:case 35670:return Lm;case 35667:case 35671:return Om;case 35668:case 35672:return Bm;case 35669:case 35673:return zm;case 5125:return jm;case 36294:return Hm;case 36295:return Gm;case 36296:return Vm;case 35678:case 36198:case 36298:case 36306:case 35682:return Wm;case 35679:case 36299:case 36307:return Xm;case 35680:case 36300:case 36308:case 36293:return qm;case 36289:case 36303:case 36311:case 36292:return Km}}var Jc=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=Im(t.type)}},Yc=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Jm(t.type)}},Zc=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let i=this.seq;for(let s=0,r=i.length;s!==r;++s){let o=i[s];o.setValue(e,t[o.id],n)}}},Xc=/(\w+)(\])?(\[|\.)?/g;function yd(a,e){a.seq.push(e),a.map[e.id]=e}function Ym(a,e,t){let n=a.name,i=n.length;for(Xc.lastIndex=0;;){let s=Xc.exec(n),r=Xc.lastIndex,o=s[1],l=s[2]==="]",c=s[3];if(l&&(o=o|0),c===void 0||c==="["&&r+2===i){yd(t,c===void 0?new Jc(o,a,e):new Yc(o,a,e));break}else{let d=t.map[o];d===void 0&&(d=new Zc(o),yd(t,d)),t=d}}}var Si=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let r=0;r<n;++r){let o=e.getActiveUniform(t,r),l=e.getUniformLocation(t,o.name);Ym(o,l,this)}let i=[],s=[];for(let r of this.seq)r.type===e.SAMPLER_2D_SHADOW||r.type===e.SAMPLER_CUBE_SHADOW||r.type===e.SAMPLER_2D_ARRAY_SHADOW?i.push(r):s.push(r);i.length>0&&(this.seq=i.concat(s))}setValue(e,t,n,i){let s=this.map[t];s!==void 0&&s.setValue(e,n,i)}setOptional(e,t,n){let i=t[n];i!==void 0&&this.setValue(e,n,i)}static upload(e,t,n,i){for(let s=0,r=t.length;s!==r;++s){let o=t[s],l=n[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,i)}}static seqWithValue(e,t){let n=[];for(let i=0,s=e.length;i!==s;++i){let r=e[i];r.id in t&&n.push(r)}return n}};function vd(a,e,t){let n=a.createShader(e);return a.shaderSource(n,t),a.compileShader(n),n}var Zm=37297,Qm=0;function $m(a,e){let t=a.split(`
`),n=[],i=Math.max(e-6,0),s=Math.min(e+6,t.length);for(let r=i;r<s;r++){let o=r+1;n.push(`${o===e?">":" "} ${o}: ${t[r]}`)}return n.join(`
`)}var _d=new Pe;function eg(a){ze._getMatrix(_d,ze.workingColorSpace,a);let e=`mat3( ${_d.elements.map(t=>t.toFixed(4))} )`;switch(ze.getTransfer(a)){case Ui:return[e,"LinearTransferOETF"];case Je:return[e,"sRGBTransferOETF"];default:return ve("WebGLProgram: Unsupported color space: ",a),[e,"LinearTransferOETF"]}}function Md(a,e,t){let n=a.getShaderParameter(e,a.COMPILE_STATUS),s=(a.getShaderInfoLog(e)||"").trim();if(n&&s==="")return"";let r=/ERROR: 0:(\d+)/.exec(s);if(r){let o=parseInt(r[1]);return t.toUpperCase()+`

`+s+`

`+$m(a.getShaderSource(e),o)}else return s}function tg(a,e){let t=eg(e);return[`vec4 ${a}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}var ng={[vc]:"Linear",[_c]:"Reinhard",[Mc]:"Cineon",[Sc]:"ACESFilmic",[Ac]:"AgX",[Ec]:"Neutral",[wc]:"Custom"};function ag(a,e){let t=ng[e];return t===void 0?(ve("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+a+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+a+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}var go=new U;function ig(){ze.getLuminanceCoefficients(go);let a=go.x.toFixed(4),e=go.y.toFixed(4),t=go.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${a}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function sg(a){return[a.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",a.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(ys).join(`
`)}function rg(a){let e=[];for(let t in a){let n=a[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function og(a,e){let t={},n=a.getProgramParameter(e,a.ACTIVE_ATTRIBUTES);for(let i=0;i<n;i++){let s=a.getActiveAttrib(e,i),r=s.name,o=1;s.type===a.FLOAT_MAT2&&(o=2),s.type===a.FLOAT_MAT3&&(o=3),s.type===a.FLOAT_MAT4&&(o=4),t[r]={type:s.type,location:a.getAttribLocation(e,r),locationSize:o}}return t}function ys(a){return a!==""}function Sd(a,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return a.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function wd(a,e){return a.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var cg=/^[ \t]*#include +<([\w\d./]+)>/gm;function Qc(a){return a.replace(cg,hg)}var lg=new Map;function hg(a,e){let t=Oe[e];if(t===void 0){let n=lg.get(e);if(n!==void 0)t=Oe[n],ve('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">")}return Qc(t)}var dg=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Ad(a){return a.replace(dg,fg)}function fg(a,e,t,n){let i="";for(let s=parseInt(e);s<parseInt(t);s++)i+=n.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return i}function Ed(a){let e=`precision ${a.precision} float;
	precision ${a.precision} int;
	precision ${a.precision} sampler2D;
	precision ${a.precision} samplerCube;
	precision ${a.precision} sampler3D;
	precision ${a.precision} sampler2DArray;
	precision ${a.precision} sampler2DShadow;
	precision ${a.precision} samplerCubeShadow;
	precision ${a.precision} sampler2DArrayShadow;
	precision ${a.precision} isampler2D;
	precision ${a.precision} isampler3D;
	precision ${a.precision} isamplerCube;
	precision ${a.precision} isampler2DArray;
	precision ${a.precision} usampler2D;
	precision ${a.precision} usampler3D;
	precision ${a.precision} usamplerCube;
	precision ${a.precision} usampler2DArray;
	`;return a.precision==="highp"?e+=`
#define HIGH_PRECISION`:a.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:a.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}var ug={[cs]:"SHADOWMAP_TYPE_PCF",[gi]:"SHADOWMAP_TYPE_VSM"};function pg(a){return ug[a.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var bg={[fa]:"ENVMAP_TYPE_CUBE",[Na]:"ENVMAP_TYPE_CUBE",[ls]:"ENVMAP_TYPE_CUBE_UV"};function mg(a){return a.envMap===!1?"ENVMAP_TYPE_CUBE":bg[a.envMapMode]||"ENVMAP_TYPE_CUBE"}var gg={[Na]:"ENVMAP_MODE_REFRACTION"};function xg(a){return a.envMap===!1?"ENVMAP_MODE_REFLECTION":gg[a.envMapMode]||"ENVMAP_MODE_REFLECTION"}var yg={[yc]:"ENVMAP_BLENDING_MULTIPLY",[Vh]:"ENVMAP_BLENDING_MIX",[Wh]:"ENVMAP_BLENDING_ADD"};function vg(a){return a.envMap===!1?"ENVMAP_BLENDING_NONE":yg[a.combine]||"ENVMAP_BLENDING_NONE"}function _g(a){let e=a.envMapCubeUVHeight;if(e===null)return null;let t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:n,maxMip:t}}function Mg(a,e,t,n){let i=a.getContext(),s=t.defines,r=t.vertexShader,o=t.fragmentShader,l=pg(t),c=mg(t),h=xg(t),d=vg(t),f=_g(t),b=sg(t),g=rg(s),y=i.createProgram(),p,u,m=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(p=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(ys).join(`
`),p.length>0&&(p+=`
`),u=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(ys).join(`
`),u.length>0&&(u+=`
`)):(p=[Ed(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(ys).join(`
`),u=[Ed(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+h:"",t.envMap?"#define "+d:"",f?"#define CUBEUV_TEXEL_WIDTH "+f.texelWidth:"",f?"#define CUBEUV_TEXEL_HEIGHT "+f.texelHeight:"",f?"#define CUBEUV_MAX_MIP "+f.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==mn?"#define TONE_MAPPING":"",t.toneMapping!==mn?Oe.tonemapping_pars_fragment:"",t.toneMapping!==mn?ag("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Oe.colorspace_pars_fragment,tg("linearToOutputTexel",t.outputColorSpace),ig(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(ys).join(`
`)),r=Qc(r),r=Sd(r,t),r=wd(r,t),o=Qc(o),o=Sd(o,t),o=wd(o,t),r=Ad(r),o=Ad(o),t.isRawShaderMaterial!==!0&&(m=`#version 300 es
`,p=[b,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+p,u=["#define varying in",t.glslVersion===Fc?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===Fc?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+u);let M=m+p+r,x=m+u+o,S=vd(i,i.VERTEX_SHADER,M),w=vd(i,i.FRAGMENT_SHADER,x);i.attachShader(y,S),i.attachShader(y,w),t.index0AttributeName!==void 0?i.bindAttribLocation(y,0,t.index0AttributeName):t.hasPositionAttribute===!0&&i.bindAttribLocation(y,0,"position"),i.linkProgram(y);function T(I){if(a.debug.checkShaderErrors){let k=i.getProgramInfoLog(y)||"",O=i.getShaderInfoLog(S)||"",V=i.getShaderInfoLog(w)||"",P=k.trim(),j=O.trim(),B=V.trim(),K=!0,Q=!0;if(i.getProgramParameter(y,i.LINK_STATUS)===!1)if(K=!1,typeof a.debug.onShaderError=="function")a.debug.onShaderError(i,y,S,w);else{let ee=Md(i,S,"vertex"),ae=Md(i,w,"fragment");Ie("WebGLProgram: Shader Error "+i.getError()+" - VALIDATE_STATUS "+i.getProgramParameter(y,i.VALIDATE_STATUS)+`

Material Name: `+I.name+`
Material Type: `+I.type+`

Program Info Log: `+P+`
`+ee+`
`+ae)}else P!==""?ve("WebGLProgram: Program Info Log:",P):(j===""||B==="")&&(Q=!1);Q&&(I.diagnostics={runnable:K,programLog:P,vertexShader:{log:j,prefix:p},fragmentShader:{log:B,prefix:u}})}i.deleteShader(S),i.deleteShader(w),v=new Si(i,y),E=og(i,y)}let v;this.getUniforms=function(){return v===void 0&&T(this),v};let E;this.getAttributes=function(){return E===void 0&&T(this),E};let C=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return C===!1&&(C=i.getProgramParameter(y,Zm)),C},this.destroy=function(){n.releaseStatesOfProgram(this),i.deleteProgram(y),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=Qm++,this.cacheKey=e,this.usedTimes=1,this.program=y,this.vertexShader=S,this.fragmentShader=w,this}var Sg=0,$c=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){let i=this._getShaderCacheForMaterial(e);return i.has(t)===!1&&(i.add(t),t.usedTimes++),i.has(n)===!1&&(i.add(n),n.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new el(e),t.set(e,n)),n}},el=class{constructor(e){this.id=Sg++,this.code=e,this.usedTimes=0}};function wg(a){return a===pa||a===ps||a===bs}function Ag(a,e,t,n,i,s){let r=new Bi,o=new $c,l=new Set,c=[],h=new Map,d=n.logarithmicDepthBuffer,f=n.precision,b={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(v){return l.add(v),v===0?"uv":`uv${v}`}function y(v,E,C,I,k,O){let V=I.fog,P=k.geometry,j=v.isMeshStandardMaterial||v.isMeshLambertMaterial||v.isMeshPhongMaterial?I.environment:null,B=v.isMeshStandardMaterial||v.isMeshLambertMaterial&&!v.envMap||v.isMeshPhongMaterial&&!v.envMap,K=e.get(v.envMap||j,B),Q=K&&K.mapping===ls?K.image.height:null,ee=b[v.type];v.precision!==null&&(f=n.getMaxPrecision(v.precision),f!==v.precision&&ve("WebGLProgram.getParameters:",v.precision,"not supported, using",f,"instead."));let ae=P.morphAttributes.position||P.morphAttributes.normal||P.morphAttributes.color,ie=ae!==void 0?ae.length:0,ke=0;P.morphAttributes.position!==void 0&&(ke=1),P.morphAttributes.normal!==void 0&&(ke=2),P.morphAttributes.color!==void 0&&(ke=3);let Ke,Ge,J,re;if(ee){let xe=Pn[ee];Ke=xe.vertexShader,Ge=xe.fragmentShader}else{Ke=v.vertexShader,Ge=v.fragmentShader;let xe=o.getVertexShaderStage(v),ct=o.getFragmentShaderStage(v);o.update(v,xe,ct),J=xe.id,re=ct.id}let te=a.getRenderTarget(),Ce=a.state.buffers.depth.getReversed(),Ne=k.isInstancedMesh===!0,Ee=k.isBatchedMesh===!0,dt=!!v.map,Ve=!!v.matcap,et=!!K,qe=!!v.aoMap,We=!!v.lightMap,xt=!!v.bumpMap&&v.wireframe===!1,St=!!v.normalMap,Tt=!!v.displacementMap,Ct=!!v.emissiveMap,ot=!!v.metalnessMap,yt=!!v.roughnessMap,D=v.anisotropy>0,zt=v.clearcoat>0,Ye=v.dispersion>0,R=v.iridescence>0,_=v.sheen>0,L=v.transmission>0,G=D&&!!v.anisotropyMap,X=zt&&!!v.clearcoatMap,ne=zt&&!!v.clearcoatNormalMap,oe=zt&&!!v.clearcoatRoughnessMap,q=R&&!!v.iridescenceMap,Z=R&&!!v.iridescenceThicknessMap,ce=_&&!!v.sheenColorMap,Me=_&&!!v.sheenRoughnessMap,de=!!v.specularMap,le=!!v.specularColorMap,Ae=!!v.specularIntensityMap,Te=L&&!!v.transmissionMap,De=L&&!!v.thicknessMap,N=!!v.gradientMap,se=!!v.alphaMap,Y=v.alphaTest>0,he=!!v.alphaHash,be=!!v.extensions,$=mn;v.toneMapped&&(te===null||te.isXRRenderTarget===!0)&&($=a.toneMapping);let _e={shaderID:ee,shaderType:v.type,shaderName:v.name,vertexShader:Ke,fragmentShader:Ge,defines:v.defines,customVertexShaderID:J,customFragmentShaderID:re,isRawShaderMaterial:v.isRawShaderMaterial===!0,glslVersion:v.glslVersion,precision:f,batching:Ee,batchingColor:Ee&&k._colorsTexture!==null,instancing:Ne,instancingColor:Ne&&k.instanceColor!==null,instancingMorph:Ne&&k.morphTexture!==null,outputColorSpace:te===null?a.outputColorSpace:te.isXRRenderTarget===!0?te.texture.colorSpace:ze.workingColorSpace,alphaToCoverage:!!v.alphaToCoverage,map:dt,matcap:Ve,envMap:et,envMapMode:et&&K.mapping,envMapCubeUVHeight:Q,aoMap:qe,lightMap:We,bumpMap:xt,normalMap:St,displacementMap:Tt,emissiveMap:Ct,normalMapObjectSpace:St&&v.normalMapType===Jh,normalMapTangentSpace:St&&v.normalMapType===uo,packedNormalMap:St&&v.normalMapType===uo&&wg(v.normalMap.format),metalnessMap:ot,roughnessMap:yt,anisotropy:D,anisotropyMap:G,clearcoat:zt,clearcoatMap:X,clearcoatNormalMap:ne,clearcoatRoughnessMap:oe,dispersion:Ye,iridescence:R,iridescenceMap:q,iridescenceThicknessMap:Z,sheen:_,sheenColorMap:ce,sheenRoughnessMap:Me,specularMap:de,specularColorMap:le,specularIntensityMap:Ae,transmission:L,transmissionMap:Te,thicknessMap:De,gradientMap:N,opaque:v.transparent===!1&&v.blending===wa&&v.alphaToCoverage===!1,alphaMap:se,alphaTest:Y,alphaHash:he,combine:v.combine,mapUv:dt&&g(v.map.channel),aoMapUv:qe&&g(v.aoMap.channel),lightMapUv:We&&g(v.lightMap.channel),bumpMapUv:xt&&g(v.bumpMap.channel),normalMapUv:St&&g(v.normalMap.channel),displacementMapUv:Tt&&g(v.displacementMap.channel),emissiveMapUv:Ct&&g(v.emissiveMap.channel),metalnessMapUv:ot&&g(v.metalnessMap.channel),roughnessMapUv:yt&&g(v.roughnessMap.channel),anisotropyMapUv:G&&g(v.anisotropyMap.channel),clearcoatMapUv:X&&g(v.clearcoatMap.channel),clearcoatNormalMapUv:ne&&g(v.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:oe&&g(v.clearcoatRoughnessMap.channel),iridescenceMapUv:q&&g(v.iridescenceMap.channel),iridescenceThicknessMapUv:Z&&g(v.iridescenceThicknessMap.channel),sheenColorMapUv:ce&&g(v.sheenColorMap.channel),sheenRoughnessMapUv:Me&&g(v.sheenRoughnessMap.channel),specularMapUv:de&&g(v.specularMap.channel),specularColorMapUv:le&&g(v.specularColorMap.channel),specularIntensityMapUv:Ae&&g(v.specularIntensityMap.channel),transmissionMapUv:Te&&g(v.transmissionMap.channel),thicknessMapUv:De&&g(v.thicknessMap.channel),alphaMapUv:se&&g(v.alphaMap.channel),vertexTangents:!!P.attributes.tangent&&(St||D),vertexNormals:!!P.attributes.normal,vertexColors:v.vertexColors,vertexAlphas:v.vertexColors===!0&&!!P.attributes.color&&P.attributes.color.itemSize===4,pointsUvs:k.isPoints===!0&&!!P.attributes.uv&&(dt||se),fog:!!V,useFog:v.fog===!0,fogExp2:!!V&&V.isFogExp2,flatShading:v.wireframe===!1&&(v.flatShading===!0||P.attributes.normal===void 0&&St===!1&&(v.isMeshLambertMaterial||v.isMeshPhongMaterial||v.isMeshStandardMaterial||v.isMeshPhysicalMaterial)),sizeAttenuation:v.sizeAttenuation===!0,logarithmicDepthBuffer:d,reversedDepthBuffer:Ce,skinning:k.isSkinnedMesh===!0,hasPositionAttribute:P.attributes.position!==void 0,morphTargets:P.morphAttributes.position!==void 0,morphNormals:P.morphAttributes.normal!==void 0,morphColors:P.morphAttributes.color!==void 0,morphTargetsCount:ie,morphTextureStride:ke,numDirLights:E.directional.length,numPointLights:E.point.length,numSpotLights:E.spot.length,numSpotLightMaps:E.spotLightMap.length,numRectAreaLights:E.rectArea.length,numHemiLights:E.hemi.length,numDirLightShadows:E.directionalShadowMap.length,numPointLightShadows:E.pointShadowMap.length,numSpotLightShadows:E.spotShadowMap.length,numSpotLightShadowsWithMaps:E.numSpotLightShadowsWithMaps,numLightProbes:E.numLightProbes,numLightProbeGrids:O.length,numClippingPlanes:s.numPlanes,numClipIntersection:s.numIntersection,dithering:v.dithering,shadowMapEnabled:a.shadowMap.enabled&&C.length>0,shadowMapType:a.shadowMap.type,toneMapping:$,decodeVideoTexture:dt&&v.map.isVideoTexture===!0&&ze.getTransfer(v.map.colorSpace)===Je,decodeVideoTextureEmissive:Ct&&v.emissiveMap.isVideoTexture===!0&&ze.getTransfer(v.emissiveMap.colorSpace)===Je,premultipliedAlpha:v.premultipliedAlpha,doubleSided:v.side===rn,flipSided:v.side===Bt,useDepthPacking:v.depthPacking>=0,depthPacking:v.depthPacking||0,index0AttributeName:v.index0AttributeName,extensionClipCullDistance:be&&v.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(be&&v.extensions.multiDraw===!0||Ee)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:v.customProgramCacheKey()};return _e.vertexUv1s=l.has(1),_e.vertexUv2s=l.has(2),_e.vertexUv3s=l.has(3),l.clear(),_e}function p(v){let E=[];if(v.shaderID?E.push(v.shaderID):(E.push(v.customVertexShaderID),E.push(v.customFragmentShaderID)),v.defines!==void 0)for(let C in v.defines)E.push(C),E.push(v.defines[C]);return v.isRawShaderMaterial===!1&&(u(E,v),m(E,v),E.push(a.outputColorSpace)),E.push(v.customProgramCacheKey),E.join()}function u(v,E){v.push(E.precision),v.push(E.outputColorSpace),v.push(E.envMapMode),v.push(E.envMapCubeUVHeight),v.push(E.mapUv),v.push(E.alphaMapUv),v.push(E.lightMapUv),v.push(E.aoMapUv),v.push(E.bumpMapUv),v.push(E.normalMapUv),v.push(E.displacementMapUv),v.push(E.emissiveMapUv),v.push(E.metalnessMapUv),v.push(E.roughnessMapUv),v.push(E.anisotropyMapUv),v.push(E.clearcoatMapUv),v.push(E.clearcoatNormalMapUv),v.push(E.clearcoatRoughnessMapUv),v.push(E.iridescenceMapUv),v.push(E.iridescenceThicknessMapUv),v.push(E.sheenColorMapUv),v.push(E.sheenRoughnessMapUv),v.push(E.specularMapUv),v.push(E.specularColorMapUv),v.push(E.specularIntensityMapUv),v.push(E.transmissionMapUv),v.push(E.thicknessMapUv),v.push(E.combine),v.push(E.fogExp2),v.push(E.sizeAttenuation),v.push(E.morphTargetsCount),v.push(E.morphAttributeCount),v.push(E.numDirLights),v.push(E.numPointLights),v.push(E.numSpotLights),v.push(E.numSpotLightMaps),v.push(E.numHemiLights),v.push(E.numRectAreaLights),v.push(E.numDirLightShadows),v.push(E.numPointLightShadows),v.push(E.numSpotLightShadows),v.push(E.numSpotLightShadowsWithMaps),v.push(E.numLightProbes),v.push(E.shadowMapType),v.push(E.toneMapping),v.push(E.numClippingPlanes),v.push(E.numClipIntersection),v.push(E.depthPacking)}function m(v,E){r.disableAll(),E.instancing&&r.enable(0),E.instancingColor&&r.enable(1),E.instancingMorph&&r.enable(2),E.matcap&&r.enable(3),E.envMap&&r.enable(4),E.normalMapObjectSpace&&r.enable(5),E.normalMapTangentSpace&&r.enable(6),E.clearcoat&&r.enable(7),E.iridescence&&r.enable(8),E.alphaTest&&r.enable(9),E.vertexColors&&r.enable(10),E.vertexAlphas&&r.enable(11),E.vertexUv1s&&r.enable(12),E.vertexUv2s&&r.enable(13),E.vertexUv3s&&r.enable(14),E.vertexTangents&&r.enable(15),E.anisotropy&&r.enable(16),E.alphaHash&&r.enable(17),E.batching&&r.enable(18),E.dispersion&&r.enable(19),E.batchingColor&&r.enable(20),E.gradientMap&&r.enable(21),E.packedNormalMap&&r.enable(22),E.vertexNormals&&r.enable(23),v.push(r.mask),r.disableAll(),E.fog&&r.enable(0),E.useFog&&r.enable(1),E.flatShading&&r.enable(2),E.logarithmicDepthBuffer&&r.enable(3),E.reversedDepthBuffer&&r.enable(4),E.skinning&&r.enable(5),E.morphTargets&&r.enable(6),E.morphNormals&&r.enable(7),E.morphColors&&r.enable(8),E.premultipliedAlpha&&r.enable(9),E.shadowMapEnabled&&r.enable(10),E.doubleSided&&r.enable(11),E.flipSided&&r.enable(12),E.useDepthPacking&&r.enable(13),E.dithering&&r.enable(14),E.transmission&&r.enable(15),E.sheen&&r.enable(16),E.opaque&&r.enable(17),E.pointsUvs&&r.enable(18),E.decodeVideoTexture&&r.enable(19),E.decodeVideoTextureEmissive&&r.enable(20),E.alphaToCoverage&&r.enable(21),E.numLightProbeGrids>0&&r.enable(22),E.hasPositionAttribute&&r.enable(23),v.push(r.mask)}function M(v){let E=b[v.type],C;if(E){let I=Pn[E];C=od.clone(I.uniforms)}else C=v.uniforms;return C}function x(v,E){let C=h.get(E);return C!==void 0?++C.usedTimes:(C=new Mg(a,E,v,i),c.push(C),h.set(E,C)),C}function S(v){if(--v.usedTimes===0){let E=c.indexOf(v);c[E]=c[c.length-1],c.pop(),h.delete(v.cacheKey),v.destroy()}}function w(v){o.remove(v)}function T(){o.dispose()}return{getParameters:y,getProgramCacheKey:p,getUniforms:M,acquireProgram:x,releaseProgram:S,releaseShaderCache:w,programs:c,dispose:T}}function Eg(){let a=new WeakMap;function e(r){return a.has(r)}function t(r){let o=a.get(r);return o===void 0&&(o={},a.set(r,o)),o}function n(r){a.delete(r)}function i(r,o,l){a.get(r)[o]=l}function s(){a=new WeakMap}return{has:e,get:t,remove:n,update:i,dispose:s}}function Tg(a,e){return a.groupOrder!==e.groupOrder?a.groupOrder-e.groupOrder:a.renderOrder!==e.renderOrder?a.renderOrder-e.renderOrder:a.material.id!==e.material.id?a.material.id-e.material.id:a.materialVariant!==e.materialVariant?a.materialVariant-e.materialVariant:a.z!==e.z?a.z-e.z:a.id-e.id}function Td(a,e){return a.groupOrder!==e.groupOrder?a.groupOrder-e.groupOrder:a.renderOrder!==e.renderOrder?a.renderOrder-e.renderOrder:a.z!==e.z?e.z-a.z:a.id-e.id}function Rd(){let a=[],e=0,t=[],n=[],i=[];function s(){e=0,t.length=0,n.length=0,i.length=0}function r(f){let b=0;return f.isInstancedMesh&&(b+=2),f.isSkinnedMesh&&(b+=1),b}function o(f,b,g,y,p,u){let m=a[e];return m===void 0?(m={id:f.id,object:f,geometry:b,material:g,materialVariant:r(f),groupOrder:y,renderOrder:f.renderOrder,z:p,group:u},a[e]=m):(m.id=f.id,m.object=f,m.geometry=b,m.material=g,m.materialVariant=r(f),m.groupOrder=y,m.renderOrder=f.renderOrder,m.z=p,m.group=u),e++,m}function l(f,b,g,y,p,u){let m=o(f,b,g,y,p,u);g.transmission>0?n.push(m):g.transparent===!0?i.push(m):t.push(m)}function c(f,b,g,y,p,u){let m=o(f,b,g,y,p,u);g.transmission>0?n.unshift(m):g.transparent===!0?i.unshift(m):t.unshift(m)}function h(f,b,g){t.length>1&&t.sort(f||Tg),n.length>1&&n.sort(b||Td),i.length>1&&i.sort(b||Td),g&&(t.reverse(),n.reverse(),i.reverse())}function d(){for(let f=e,b=a.length;f<b;f++){let g=a[f];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:t,transmissive:n,transparent:i,init:s,push:l,unshift:c,finish:d,sort:h}}function Rg(){let a=new WeakMap;function e(n,i){let s=a.get(n),r;return s===void 0?(r=new Rd,a.set(n,[r])):i>=s.length?(r=new Rd,s.push(r)):r=s[i],r}function t(){a=new WeakMap}return{get:e,dispose:t}}function Ig(){let a={};return{get:function(e){if(a[e.id]!==void 0)return a[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new U,color:new Re};break;case"SpotLight":t={position:new U,direction:new U,color:new Re,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new U,color:new Re,distance:0,decay:0};break;case"HemisphereLight":t={direction:new U,skyColor:new Re,groundColor:new Re};break;case"RectAreaLight":t={color:new Re,position:new U,halfWidth:new U,halfHeight:new U};break}return a[e.id]=t,t}}}function Cg(){let a={};return{get:function(e){if(a[e.id]!==void 0)return a[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Le};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Le};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Le,shadowCameraNear:1,shadowCameraFar:1e3};break}return a[e.id]=t,t}}}var kg=0;function Pg(a,e){return(e.castShadow?2:0)-(a.castShadow?2:0)+(e.map?1:0)-(a.map?1:0)}function Ng(a){let e=new Ig,t=Cg(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new U);let i=new U,s=new Ue,r=new Ue;function o(c){let h=0,d=0,f=0;for(let E=0;E<9;E++)n.probe[E].set(0,0,0);let b=0,g=0,y=0,p=0,u=0,m=0,M=0,x=0,S=0,w=0,T=0;c.sort(Pg);for(let E=0,C=c.length;E<C;E++){let I=c[E],k=I.color,O=I.intensity,V=I.distance,P=null;if(I.shadow&&I.shadow.map&&(I.shadow.map.texture.format===pa?P=I.shadow.map.texture:P=I.shadow.map.depthTexture||I.shadow.map.texture),I.isAmbientLight)h+=k.r*O,d+=k.g*O,f+=k.b*O;else if(I.isLightProbe){for(let j=0;j<9;j++)n.probe[j].addScaledVector(I.sh.coefficients[j],O);T++}else if(I.isDirectionalLight){let j=e.get(I);if(j.color.copy(I.color).multiplyScalar(I.intensity),I.castShadow){let B=I.shadow,K=t.get(I);K.shadowIntensity=B.intensity,K.shadowBias=B.bias,K.shadowNormalBias=B.normalBias,K.shadowRadius=B.radius,K.shadowMapSize=B.mapSize,n.directionalShadow[b]=K,n.directionalShadowMap[b]=P,n.directionalShadowMatrix[b]=I.shadow.matrix,m++}n.directional[b]=j,b++}else if(I.isSpotLight){let j=e.get(I);j.position.setFromMatrixPosition(I.matrixWorld),j.color.copy(k).multiplyScalar(O),j.distance=V,j.coneCos=Math.cos(I.angle),j.penumbraCos=Math.cos(I.angle*(1-I.penumbra)),j.decay=I.decay,n.spot[y]=j;let B=I.shadow;if(I.map&&(n.spotLightMap[S]=I.map,S++,B.updateMatrices(I),I.castShadow&&w++),n.spotLightMatrix[y]=B.matrix,I.castShadow){let K=t.get(I);K.shadowIntensity=B.intensity,K.shadowBias=B.bias,K.shadowNormalBias=B.normalBias,K.shadowRadius=B.radius,K.shadowMapSize=B.mapSize,n.spotShadow[y]=K,n.spotShadowMap[y]=P,x++}y++}else if(I.isRectAreaLight){let j=e.get(I);j.color.copy(k).multiplyScalar(O),j.halfWidth.set(I.width*.5,0,0),j.halfHeight.set(0,I.height*.5,0),n.rectArea[p]=j,p++}else if(I.isPointLight){let j=e.get(I);if(j.color.copy(I.color).multiplyScalar(I.intensity),j.distance=I.distance,j.decay=I.decay,I.castShadow){let B=I.shadow,K=t.get(I);K.shadowIntensity=B.intensity,K.shadowBias=B.bias,K.shadowNormalBias=B.normalBias,K.shadowRadius=B.radius,K.shadowMapSize=B.mapSize,K.shadowCameraNear=B.camera.near,K.shadowCameraFar=B.camera.far,n.pointShadow[g]=K,n.pointShadowMap[g]=P,n.pointShadowMatrix[g]=I.shadow.matrix,M++}n.point[g]=j,g++}else if(I.isHemisphereLight){let j=e.get(I);j.skyColor.copy(I.color).multiplyScalar(O),j.groundColor.copy(I.groundColor).multiplyScalar(O),n.hemi[u]=j,u++}}p>0&&(a.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=fe.LTC_FLOAT_1,n.rectAreaLTC2=fe.LTC_FLOAT_2):(n.rectAreaLTC1=fe.LTC_HALF_1,n.rectAreaLTC2=fe.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=d,n.ambient[2]=f;let v=n.hash;(v.directionalLength!==b||v.pointLength!==g||v.spotLength!==y||v.rectAreaLength!==p||v.hemiLength!==u||v.numDirectionalShadows!==m||v.numPointShadows!==M||v.numSpotShadows!==x||v.numSpotMaps!==S||v.numLightProbes!==T)&&(n.directional.length=b,n.spot.length=y,n.rectArea.length=p,n.point.length=g,n.hemi.length=u,n.directionalShadow.length=m,n.directionalShadowMap.length=m,n.pointShadow.length=M,n.pointShadowMap.length=M,n.spotShadow.length=x,n.spotShadowMap.length=x,n.directionalShadowMatrix.length=m,n.pointShadowMatrix.length=M,n.spotLightMatrix.length=x+S-w,n.spotLightMap.length=S,n.numSpotLightShadowsWithMaps=w,n.numLightProbes=T,v.directionalLength=b,v.pointLength=g,v.spotLength=y,v.rectAreaLength=p,v.hemiLength=u,v.numDirectionalShadows=m,v.numPointShadows=M,v.numSpotShadows=x,v.numSpotMaps=S,v.numLightProbes=T,n.version=kg++)}function l(c,h){let d=0,f=0,b=0,g=0,y=0,p=h.matrixWorldInverse;for(let u=0,m=c.length;u<m;u++){let M=c[u];if(M.isDirectionalLight){let x=n.directional[d];x.direction.setFromMatrixPosition(M.matrixWorld),i.setFromMatrixPosition(M.target.matrixWorld),x.direction.sub(i),x.direction.transformDirection(p),d++}else if(M.isSpotLight){let x=n.spot[b];x.position.setFromMatrixPosition(M.matrixWorld),x.position.applyMatrix4(p),x.direction.setFromMatrixPosition(M.matrixWorld),i.setFromMatrixPosition(M.target.matrixWorld),x.direction.sub(i),x.direction.transformDirection(p),b++}else if(M.isRectAreaLight){let x=n.rectArea[g];x.position.setFromMatrixPosition(M.matrixWorld),x.position.applyMatrix4(p),r.identity(),s.copy(M.matrixWorld),s.premultiply(p),r.extractRotation(s),x.halfWidth.set(M.width*.5,0,0),x.halfHeight.set(0,M.height*.5,0),x.halfWidth.applyMatrix4(r),x.halfHeight.applyMatrix4(r),g++}else if(M.isPointLight){let x=n.point[f];x.position.setFromMatrixPosition(M.matrixWorld),x.position.applyMatrix4(p),f++}else if(M.isHemisphereLight){let x=n.hemi[y];x.direction.setFromMatrixPosition(M.matrixWorld),x.direction.transformDirection(p),y++}}}return{setup:o,setupView:l,state:n}}function Id(a){let e=new Ng(a),t=[],n=[],i=[];function s(f){d.camera=f,t.length=0,n.length=0,i.length=0}function r(f){t.push(f)}function o(f){n.push(f)}function l(f){i.push(f)}function c(){e.setup(t)}function h(f){e.setupView(t,f)}let d={lightsArray:t,shadowsArray:n,lightProbeGridArray:i,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:s,state:d,setupLights:c,setupLightsView:h,pushLight:r,pushShadow:o,pushLightProbeGrid:l}}function Dg(a){let e=new WeakMap;function t(i,s=0){let r=e.get(i),o;return r===void 0?(o=new Id(a),e.set(i,[o])):s>=r.length?(o=new Id(a),r.push(o)):o=r[s],o}function n(){e=new WeakMap}return{get:t,dispose:n}}var Fg=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Ug=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,Lg=[new U(1,0,0),new U(-1,0,0),new U(0,1,0),new U(0,-1,0),new U(0,0,1),new U(0,0,-1)],Og=[new U(0,-1,0),new U(0,-1,0),new U(0,0,1),new U(0,0,-1),new U(0,-1,0),new U(0,-1,0)],Cd=new Ue,xs=new U,qc=new U;function Bg(a,e,t){let n=new fi,i=new Le,s=new Le,r=new Qe,o=new br,l=new mr,c={},h=t.maxTextureSize,d={[pn]:Bt,[Bt]:pn,[rn]:rn},f=new Qt({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Le},radius:{value:4}},vertexShader:Fg,fragmentShader:Ug}),b=f.clone();b.defines.HORIZONTAL_PASS=1;let g=new kt;g.setAttribute("position",new Mt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let y=new ht(g,f),p=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=cs;let u=this.type;this.render=function(w,T,v){if(p.enabled===!1||p.autoUpdate===!1&&p.needsUpdate===!1||w.length===0)return;this.type===Ah&&(ve("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=cs);let E=a.getRenderTarget(),C=a.getActiveCubeFace(),I=a.getActiveMipmapLevel(),k=a.state;k.setBlending(In),k.buffers.depth.getReversed()===!0?k.buffers.color.setClear(0,0,0,0):k.buffers.color.setClear(1,1,1,1),k.buffers.depth.setTest(!0),k.setScissorTest(!1);let O=u!==this.type;O&&T.traverse(function(V){V.material&&(Array.isArray(V.material)?V.material.forEach(P=>P.needsUpdate=!0):V.material.needsUpdate=!0)});for(let V=0,P=w.length;V<P;V++){let j=w[V],B=j.shadow;if(B===void 0){ve("WebGLShadowMap:",j,"has no shadow.");continue}if(B.autoUpdate===!1&&B.needsUpdate===!1)continue;i.copy(B.mapSize);let K=B.getFrameExtents();i.multiply(K),s.copy(B.mapSize),(i.x>h||i.y>h)&&(i.x>h&&(s.x=Math.floor(h/K.x),i.x=s.x*K.x,B.mapSize.x=s.x),i.y>h&&(s.y=Math.floor(h/K.y),i.y=s.y*K.y,B.mapSize.y=s.y));let Q=a.state.buffers.depth.getReversed();if(B.camera._reversedDepth=Q,B.map===null||O===!0){if(B.map!==null&&(B.map.depthTexture!==null&&(B.map.depthTexture.dispose(),B.map.depthTexture=null),B.map.dispose()),this.type===gi){if(j.isPointLight){ve("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}B.map=new Yt(i.x,i.y,{format:pa,type:Cn,minFilter:mt,magFilter:mt,generateMipmaps:!1}),B.map.texture.name=j.name+".shadowMap",B.map.depthTexture=new Hn(i.x,i.y,$t),B.map.depthTexture.name=j.name+".shadowMapDepth",B.map.depthTexture.format=An,B.map.depthTexture.compareFunction=null,B.map.depthTexture.minFilter=bt,B.map.depthTexture.magFilter=bt}else j.isPointLight?(B.map=new yo(i.x),B.map.depthTexture=new ur(i.x,xn)):(B.map=new Yt(i.x,i.y),B.map.depthTexture=new Hn(i.x,i.y,xn)),B.map.depthTexture.name=j.name+".shadowMap",B.map.depthTexture.format=An,this.type===cs?(B.map.depthTexture.compareFunction=Q?bo:po,B.map.depthTexture.minFilter=mt,B.map.depthTexture.magFilter=mt):(B.map.depthTexture.compareFunction=null,B.map.depthTexture.minFilter=bt,B.map.depthTexture.magFilter=bt);B.camera.updateProjectionMatrix()}let ee=B.map.isWebGLCubeRenderTarget?6:1;for(let ae=0;ae<ee;ae++){if(B.map.isWebGLCubeRenderTarget)a.setRenderTarget(B.map,ae),a.clear();else{ae===0&&(a.setRenderTarget(B.map),a.clear());let ie=B.getViewport(ae);r.set(s.x*ie.x,s.y*ie.y,s.x*ie.z,s.y*ie.w),k.viewport(r)}if(j.isPointLight){let ie=B.camera,ke=B.matrix,Ke=j.distance||ie.far;Ke!==ie.far&&(ie.far=Ke,ie.updateProjectionMatrix()),xs.setFromMatrixPosition(j.matrixWorld),ie.position.copy(xs),qc.copy(ie.position),qc.add(Lg[ae]),ie.up.copy(Og[ae]),ie.lookAt(qc),ie.updateMatrixWorld(),ke.makeTranslation(-xs.x,-xs.y,-xs.z),Cd.multiplyMatrices(ie.projectionMatrix,ie.matrixWorldInverse),B._frustum.setFromProjectionMatrix(Cd,ie.coordinateSystem,ie.reversedDepth)}else B.updateMatrices(j);n=B.getFrustum(),x(T,v,B.camera,j,this.type)}B.isPointLightShadow!==!0&&this.type===gi&&m(B,v),B.needsUpdate=!1}u=this.type,p.needsUpdate=!1,a.setRenderTarget(E,C,I)};function m(w,T){let v=e.update(y);f.defines.VSM_SAMPLES!==w.blurSamples&&(f.defines.VSM_SAMPLES=w.blurSamples,b.defines.VSM_SAMPLES=w.blurSamples,f.needsUpdate=!0,b.needsUpdate=!0),w.mapPass===null&&(w.mapPass=new Yt(i.x,i.y,{format:pa,type:Cn})),f.uniforms.shadow_pass.value=w.map.depthTexture,f.uniforms.resolution.value=w.mapSize,f.uniforms.radius.value=w.radius,a.setRenderTarget(w.mapPass),a.clear(),a.renderBufferDirect(T,null,v,f,y,null),b.uniforms.shadow_pass.value=w.mapPass.texture,b.uniforms.resolution.value=w.mapSize,b.uniforms.radius.value=w.radius,a.setRenderTarget(w.map),a.clear(),a.renderBufferDirect(T,null,v,b,y,null)}function M(w,T,v,E){let C=null,I=v.isPointLight===!0?w.customDistanceMaterial:w.customDepthMaterial;if(I!==void 0)C=I;else if(C=v.isPointLight===!0?l:o,a.localClippingEnabled&&T.clipShadows===!0&&Array.isArray(T.clippingPlanes)&&T.clippingPlanes.length!==0||T.displacementMap&&T.displacementScale!==0||T.alphaMap&&T.alphaTest>0||T.map&&T.alphaTest>0||T.alphaToCoverage===!0){let k=C.uuid,O=T.uuid,V=c[k];V===void 0&&(V={},c[k]=V);let P=V[O];P===void 0&&(P=C.clone(),V[O]=P,T.addEventListener("dispose",S)),C=P}if(C.visible=T.visible,C.wireframe=T.wireframe,E===gi?C.side=T.shadowSide!==null?T.shadowSide:T.side:C.side=T.shadowSide!==null?T.shadowSide:d[T.side],C.alphaMap=T.alphaMap,C.alphaTest=T.alphaToCoverage===!0?.5:T.alphaTest,C.map=T.map,C.clipShadows=T.clipShadows,C.clippingPlanes=T.clippingPlanes,C.clipIntersection=T.clipIntersection,C.displacementMap=T.displacementMap,C.displacementScale=T.displacementScale,C.displacementBias=T.displacementBias,C.wireframeLinewidth=T.wireframeLinewidth,C.linewidth=T.linewidth,v.isPointLight===!0&&C.isMeshDistanceMaterial===!0){let k=a.properties.get(C);k.light=v}return C}function x(w,T,v,E,C){if(w.visible===!1)return;if(w.layers.test(T.layers)&&(w.isMesh||w.isLine||w.isPoints)&&(w.castShadow||w.receiveShadow&&C===gi)&&(!w.frustumCulled||n.intersectsObject(w))){w.modelViewMatrix.multiplyMatrices(v.matrixWorldInverse,w.matrixWorld);let O=e.update(w),V=w.material;if(Array.isArray(V)){let P=O.groups;for(let j=0,B=P.length;j<B;j++){let K=P[j],Q=V[K.materialIndex];if(Q&&Q.visible){let ee=M(w,Q,E,C);w.onBeforeShadow(a,w,T,v,O,ee,K),a.renderBufferDirect(v,null,O,ee,w,K),w.onAfterShadow(a,w,T,v,O,ee,K)}}}else if(V.visible){let P=M(w,V,E,C);w.onBeforeShadow(a,w,T,v,O,P,null),a.renderBufferDirect(v,null,O,P,w,null),w.onAfterShadow(a,w,T,v,O,P,null)}}let k=w.children;for(let O=0,V=k.length;O<V;O++)x(k[O],T,v,E,C)}function S(w){w.target.removeEventListener("dispose",S);for(let v in c){let E=c[v],C=w.target.uuid;C in E&&(E[C].dispose(),delete E[C])}}}function zg(a,e){function t(){let N=!1,se=new Qe,Y=null,he=new Qe(0,0,0,0);return{setMask:function(be){Y!==be&&!N&&(a.colorMask(be,be,be,be),Y=be)},setLocked:function(be){N=be},setClear:function(be,$,_e,xe,ct){ct===!0&&(be*=xe,$*=xe,_e*=xe),se.set(be,$,_e,xe),he.equals(se)===!1&&(a.clearColor(be,$,_e,xe),he.copy(se))},reset:function(){N=!1,Y=null,he.set(-1,0,0,0)}}}function n(){let N=!1,se=!1,Y=null,he=null,be=null;return{setReversed:function($){if(se!==$){let _e=e.get("EXT_clip_control");$?_e.clipControlEXT(_e.LOWER_LEFT_EXT,_e.ZERO_TO_ONE_EXT):_e.clipControlEXT(_e.LOWER_LEFT_EXT,_e.NEGATIVE_ONE_TO_ONE_EXT),se=$;let xe=be;be=null,this.setClear(xe)}},getReversed:function(){return se},setTest:function($){$?te(a.DEPTH_TEST):Ce(a.DEPTH_TEST)},setMask:function($){Y!==$&&!N&&(a.depthMask($),Y=$)},setFunc:function($){if(se&&($=sd[$]),he!==$){switch($){case er:a.depthFunc(a.NEVER);break;case tr:a.depthFunc(a.ALWAYS);break;case nr:a.depthFunc(a.LESS);break;case Aa:a.depthFunc(a.LEQUAL);break;case ar:a.depthFunc(a.EQUAL);break;case ir:a.depthFunc(a.GEQUAL);break;case sr:a.depthFunc(a.GREATER);break;case rr:a.depthFunc(a.NOTEQUAL);break;default:a.depthFunc(a.LEQUAL)}he=$}},setLocked:function($){N=$},setClear:function($){be!==$&&(be=$,se&&($=1-$),a.clearDepth($))},reset:function(){N=!1,Y=null,he=null,be=null,se=!1}}}function i(){let N=!1,se=null,Y=null,he=null,be=null,$=null,_e=null,xe=null,ct=null;return{setTest:function(it){N||(it?te(a.STENCIL_TEST):Ce(a.STENCIL_TEST))},setMask:function(it){se!==it&&!N&&(a.stencilMask(it),se=it)},setFunc:function(it,yn,vn){(Y!==it||he!==yn||be!==vn)&&(a.stencilFunc(it,yn,vn),Y=it,he=yn,be=vn)},setOp:function(it,yn,vn){($!==it||_e!==yn||xe!==vn)&&(a.stencilOp(it,yn,vn),$=it,_e=yn,xe=vn)},setLocked:function(it){N=it},setClear:function(it){ct!==it&&(a.clearStencil(it),ct=it)},reset:function(){N=!1,se=null,Y=null,he=null,be=null,$=null,_e=null,xe=null,ct=null}}}let s=new t,r=new n,o=new i,l=new WeakMap,c=new WeakMap,h={},d={},f={},b=new WeakMap,g=[],y=null,p=!1,u=null,m=null,M=null,x=null,S=null,w=null,T=null,v=new Re(0,0,0),E=0,C=!1,I=null,k=null,O=null,V=null,P=null,j=a.getParameter(a.MAX_COMBINED_TEXTURE_IMAGE_UNITS),B=!1,K=0,Q=a.getParameter(a.VERSION);Q.indexOf("WebGL")!==-1?(K=parseFloat(/^WebGL (\d)/.exec(Q)[1]),B=K>=1):Q.indexOf("OpenGL ES")!==-1&&(K=parseFloat(/^OpenGL ES (\d)/.exec(Q)[1]),B=K>=2);let ee=null,ae={},ie=a.getParameter(a.SCISSOR_BOX),ke=a.getParameter(a.VIEWPORT),Ke=new Qe().fromArray(ie),Ge=new Qe().fromArray(ke);function J(N,se,Y,he){let be=new Uint8Array(4),$=a.createTexture();a.bindTexture(N,$),a.texParameteri(N,a.TEXTURE_MIN_FILTER,a.NEAREST),a.texParameteri(N,a.TEXTURE_MAG_FILTER,a.NEAREST);for(let _e=0;_e<Y;_e++)N===a.TEXTURE_3D||N===a.TEXTURE_2D_ARRAY?a.texImage3D(se,0,a.RGBA,1,1,he,0,a.RGBA,a.UNSIGNED_BYTE,be):a.texImage2D(se+_e,0,a.RGBA,1,1,0,a.RGBA,a.UNSIGNED_BYTE,be);return $}let re={};re[a.TEXTURE_2D]=J(a.TEXTURE_2D,a.TEXTURE_2D,1),re[a.TEXTURE_CUBE_MAP]=J(a.TEXTURE_CUBE_MAP,a.TEXTURE_CUBE_MAP_POSITIVE_X,6),re[a.TEXTURE_2D_ARRAY]=J(a.TEXTURE_2D_ARRAY,a.TEXTURE_2D_ARRAY,1,1),re[a.TEXTURE_3D]=J(a.TEXTURE_3D,a.TEXTURE_3D,1,1),s.setClear(0,0,0,1),r.setClear(1),o.setClear(0),te(a.DEPTH_TEST),r.setFunc(Aa),xt(!1),St(bc),te(a.CULL_FACE),qe(In);function te(N){h[N]!==!0&&(a.enable(N),h[N]=!0)}function Ce(N){h[N]!==!1&&(a.disable(N),h[N]=!1)}function Ne(N,se){return f[N]!==se?(a.bindFramebuffer(N,se),f[N]=se,N===a.DRAW_FRAMEBUFFER&&(f[a.FRAMEBUFFER]=se),N===a.FRAMEBUFFER&&(f[a.DRAW_FRAMEBUFFER]=se),!0):!1}function Ee(N,se){let Y=g,he=!1;if(N){Y=b.get(se),Y===void 0&&(Y=[],b.set(se,Y));let be=N.textures;if(Y.length!==be.length||Y[0]!==a.COLOR_ATTACHMENT0){for(let $=0,_e=be.length;$<_e;$++)Y[$]=a.COLOR_ATTACHMENT0+$;Y.length=be.length,he=!0}}else Y[0]!==a.BACK&&(Y[0]=a.BACK,he=!0);he&&a.drawBuffers(Y)}function dt(N){return y!==N?(a.useProgram(N),y=N,!0):!1}let Ve={[ra]:a.FUNC_ADD,[Th]:a.FUNC_SUBTRACT,[Rh]:a.FUNC_REVERSE_SUBTRACT};Ve[Ih]=a.MIN,Ve[Ch]=a.MAX;let et={[kh]:a.ZERO,[Ph]:a.ONE,[Nh]:a.SRC_COLOR,[Qs]:a.SRC_ALPHA,[Bh]:a.SRC_ALPHA_SATURATE,[Lh]:a.DST_COLOR,[Fh]:a.DST_ALPHA,[Dh]:a.ONE_MINUS_SRC_COLOR,[$s]:a.ONE_MINUS_SRC_ALPHA,[Oh]:a.ONE_MINUS_DST_COLOR,[Uh]:a.ONE_MINUS_DST_ALPHA,[zh]:a.CONSTANT_COLOR,[jh]:a.ONE_MINUS_CONSTANT_COLOR,[Hh]:a.CONSTANT_ALPHA,[Gh]:a.ONE_MINUS_CONSTANT_ALPHA};function qe(N,se,Y,he,be,$,_e,xe,ct,it){if(N===In){p===!0&&(Ce(a.BLEND),p=!1);return}if(p===!1&&(te(a.BLEND),p=!0),N!==Eh){if(N!==u||it!==C){if((m!==ra||S!==ra)&&(a.blendEquation(a.FUNC_ADD),m=ra,S=ra),it)switch(N){case wa:a.blendFuncSeparate(a.ONE,a.ONE_MINUS_SRC_ALPHA,a.ONE,a.ONE_MINUS_SRC_ALPHA);break;case mc:a.blendFunc(a.ONE,a.ONE);break;case gc:a.blendFuncSeparate(a.ZERO,a.ONE_MINUS_SRC_COLOR,a.ZERO,a.ONE);break;case xc:a.blendFuncSeparate(a.DST_COLOR,a.ONE_MINUS_SRC_ALPHA,a.ZERO,a.ONE);break;default:Ie("WebGLState: Invalid blending: ",N);break}else switch(N){case wa:a.blendFuncSeparate(a.SRC_ALPHA,a.ONE_MINUS_SRC_ALPHA,a.ONE,a.ONE_MINUS_SRC_ALPHA);break;case mc:a.blendFuncSeparate(a.SRC_ALPHA,a.ONE,a.ONE,a.ONE);break;case gc:Ie("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case xc:Ie("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Ie("WebGLState: Invalid blending: ",N);break}M=null,x=null,w=null,T=null,v.set(0,0,0),E=0,u=N,C=it}return}be=be||se,$=$||Y,_e=_e||he,(se!==m||be!==S)&&(a.blendEquationSeparate(Ve[se],Ve[be]),m=se,S=be),(Y!==M||he!==x||$!==w||_e!==T)&&(a.blendFuncSeparate(et[Y],et[he],et[$],et[_e]),M=Y,x=he,w=$,T=_e),(xe.equals(v)===!1||ct!==E)&&(a.blendColor(xe.r,xe.g,xe.b,ct),v.copy(xe),E=ct),u=N,C=!1}function We(N,se){N.side===rn?Ce(a.CULL_FACE):te(a.CULL_FACE);let Y=N.side===Bt;se&&(Y=!Y),xt(Y),N.blending===wa&&N.transparent===!1?qe(In):qe(N.blending,N.blendEquation,N.blendSrc,N.blendDst,N.blendEquationAlpha,N.blendSrcAlpha,N.blendDstAlpha,N.blendColor,N.blendAlpha,N.premultipliedAlpha),r.setFunc(N.depthFunc),r.setTest(N.depthTest),r.setMask(N.depthWrite),s.setMask(N.colorWrite);let he=N.stencilWrite;o.setTest(he),he&&(o.setMask(N.stencilWriteMask),o.setFunc(N.stencilFunc,N.stencilRef,N.stencilFuncMask),o.setOp(N.stencilFail,N.stencilZFail,N.stencilZPass)),Ct(N.polygonOffset,N.polygonOffsetFactor,N.polygonOffsetUnits),N.alphaToCoverage===!0?te(a.SAMPLE_ALPHA_TO_COVERAGE):Ce(a.SAMPLE_ALPHA_TO_COVERAGE)}function xt(N){I!==N&&(N?a.frontFace(a.CW):a.frontFace(a.CCW),I=N)}function St(N){N!==Sh?(te(a.CULL_FACE),N!==k&&(N===bc?a.cullFace(a.BACK):N===wh?a.cullFace(a.FRONT):a.cullFace(a.FRONT_AND_BACK))):Ce(a.CULL_FACE),k=N}function Tt(N){N!==O&&(B&&a.lineWidth(N),O=N)}function Ct(N,se,Y){N?(te(a.POLYGON_OFFSET_FILL),(V!==se||P!==Y)&&(V=se,P=Y,r.getReversed()&&(se=-se),a.polygonOffset(se,Y))):Ce(a.POLYGON_OFFSET_FILL)}function ot(N){N?te(a.SCISSOR_TEST):Ce(a.SCISSOR_TEST)}function yt(N){N===void 0&&(N=a.TEXTURE0+j-1),ee!==N&&(a.activeTexture(N),ee=N)}function D(N,se,Y){Y===void 0&&(ee===null?Y=a.TEXTURE0+j-1:Y=ee);let he=ae[Y];he===void 0&&(he={type:void 0,texture:void 0},ae[Y]=he),(he.type!==N||he.texture!==se)&&(ee!==Y&&(a.activeTexture(Y),ee=Y),a.bindTexture(N,se||re[N]),he.type=N,he.texture=se)}function zt(){let N=ae[ee];N!==void 0&&N.type!==void 0&&(a.bindTexture(N.type,null),N.type=void 0,N.texture=void 0)}function Ye(){try{a.compressedTexImage2D(...arguments)}catch(N){Ie("WebGLState:",N)}}function R(){try{a.compressedTexImage3D(...arguments)}catch(N){Ie("WebGLState:",N)}}function _(){try{a.texSubImage2D(...arguments)}catch(N){Ie("WebGLState:",N)}}function L(){try{a.texSubImage3D(...arguments)}catch(N){Ie("WebGLState:",N)}}function G(){try{a.compressedTexSubImage2D(...arguments)}catch(N){Ie("WebGLState:",N)}}function X(){try{a.compressedTexSubImage3D(...arguments)}catch(N){Ie("WebGLState:",N)}}function ne(){try{a.texStorage2D(...arguments)}catch(N){Ie("WebGLState:",N)}}function oe(){try{a.texStorage3D(...arguments)}catch(N){Ie("WebGLState:",N)}}function q(){try{a.texImage2D(...arguments)}catch(N){Ie("WebGLState:",N)}}function Z(){try{a.texImage3D(...arguments)}catch(N){Ie("WebGLState:",N)}}function ce(N){return d[N]!==void 0?d[N]:a.getParameter(N)}function Me(N,se){d[N]!==se&&(a.pixelStorei(N,se),d[N]=se)}function de(N){Ke.equals(N)===!1&&(a.scissor(N.x,N.y,N.z,N.w),Ke.copy(N))}function le(N){Ge.equals(N)===!1&&(a.viewport(N.x,N.y,N.z,N.w),Ge.copy(N))}function Ae(N,se){let Y=c.get(se);Y===void 0&&(Y=new WeakMap,c.set(se,Y));let he=Y.get(N);he===void 0&&(he=a.getUniformBlockIndex(se,N.name),Y.set(N,he))}function Te(N,se){let he=c.get(se).get(N);l.get(se)!==he&&(a.uniformBlockBinding(se,he,N.__bindingPointIndex),l.set(se,he))}function De(){a.disable(a.BLEND),a.disable(a.CULL_FACE),a.disable(a.DEPTH_TEST),a.disable(a.POLYGON_OFFSET_FILL),a.disable(a.SCISSOR_TEST),a.disable(a.STENCIL_TEST),a.disable(a.SAMPLE_ALPHA_TO_COVERAGE),a.blendEquation(a.FUNC_ADD),a.blendFunc(a.ONE,a.ZERO),a.blendFuncSeparate(a.ONE,a.ZERO,a.ONE,a.ZERO),a.blendColor(0,0,0,0),a.colorMask(!0,!0,!0,!0),a.clearColor(0,0,0,0),a.depthMask(!0),a.depthFunc(a.LESS),r.setReversed(!1),a.clearDepth(1),a.stencilMask(4294967295),a.stencilFunc(a.ALWAYS,0,4294967295),a.stencilOp(a.KEEP,a.KEEP,a.KEEP),a.clearStencil(0),a.cullFace(a.BACK),a.frontFace(a.CCW),a.polygonOffset(0,0),a.activeTexture(a.TEXTURE0),a.bindFramebuffer(a.FRAMEBUFFER,null),a.bindFramebuffer(a.DRAW_FRAMEBUFFER,null),a.bindFramebuffer(a.READ_FRAMEBUFFER,null),a.useProgram(null),a.lineWidth(1),a.scissor(0,0,a.canvas.width,a.canvas.height),a.viewport(0,0,a.canvas.width,a.canvas.height),a.pixelStorei(a.PACK_ALIGNMENT,4),a.pixelStorei(a.UNPACK_ALIGNMENT,4),a.pixelStorei(a.UNPACK_FLIP_Y_WEBGL,!1),a.pixelStorei(a.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),a.pixelStorei(a.UNPACK_COLORSPACE_CONVERSION_WEBGL,a.BROWSER_DEFAULT_WEBGL),a.pixelStorei(a.PACK_ROW_LENGTH,0),a.pixelStorei(a.PACK_SKIP_PIXELS,0),a.pixelStorei(a.PACK_SKIP_ROWS,0),a.pixelStorei(a.UNPACK_ROW_LENGTH,0),a.pixelStorei(a.UNPACK_IMAGE_HEIGHT,0),a.pixelStorei(a.UNPACK_SKIP_PIXELS,0),a.pixelStorei(a.UNPACK_SKIP_ROWS,0),a.pixelStorei(a.UNPACK_SKIP_IMAGES,0),h={},d={},ee=null,ae={},f={},b=new WeakMap,g=[],y=null,p=!1,u=null,m=null,M=null,x=null,S=null,w=null,T=null,v=new Re(0,0,0),E=0,C=!1,I=null,k=null,O=null,V=null,P=null,Ke.set(0,0,a.canvas.width,a.canvas.height),Ge.set(0,0,a.canvas.width,a.canvas.height),s.reset(),r.reset(),o.reset()}return{buffers:{color:s,depth:r,stencil:o},enable:te,disable:Ce,bindFramebuffer:Ne,drawBuffers:Ee,useProgram:dt,setBlending:qe,setMaterial:We,setFlipSided:xt,setCullFace:St,setLineWidth:Tt,setPolygonOffset:Ct,setScissorTest:ot,activeTexture:yt,bindTexture:D,unbindTexture:zt,compressedTexImage2D:Ye,compressedTexImage3D:R,texImage2D:q,texImage3D:Z,pixelStorei:Me,getParameter:ce,updateUBOMapping:Ae,uniformBlockBinding:Te,texStorage2D:ne,texStorage3D:oe,texSubImage2D:_,texSubImage3D:L,compressedTexSubImage2D:G,compressedTexSubImage3D:X,scissor:de,viewport:le,reset:De}}function jg(a,e,t,n,i,s,r){let o=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new Le,h=new WeakMap,d=new Set,f,b=new WeakMap,g=!1;try{g=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function y(R,_){return g?new OffscreenCanvas(R,_):ii("canvas")}function p(R,_,L){let G=1,X=Ye(R);if((X.width>L||X.height>L)&&(G=L/Math.max(X.width,X.height)),G<1)if(typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&R instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&R instanceof ImageBitmap||typeof VideoFrame<"u"&&R instanceof VideoFrame){let ne=Math.floor(G*X.width),oe=Math.floor(G*X.height);f===void 0&&(f=y(ne,oe));let q=_?y(ne,oe):f;return q.width=ne,q.height=oe,q.getContext("2d").drawImage(R,0,0,ne,oe),ve("WebGLRenderer: Texture has been resized from ("+X.width+"x"+X.height+") to ("+ne+"x"+oe+")."),q}else return"data"in R&&ve("WebGLRenderer: Image in DataTexture is too big ("+X.width+"x"+X.height+")."),R;return R}function u(R){return R.generateMipmaps}function m(R){a.generateMipmap(R)}function M(R){return R.isWebGLCubeRenderTarget?a.TEXTURE_CUBE_MAP:R.isWebGL3DRenderTarget?a.TEXTURE_3D:R.isWebGLArrayRenderTarget||R.isCompressedArrayTexture?a.TEXTURE_2D_ARRAY:a.TEXTURE_2D}function x(R,_,L,G,X,ne=!1){if(R!==null){if(a[R]!==void 0)return a[R];ve("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+R+"'")}let oe;G&&(oe=e.get("EXT_texture_norm16"),oe||ve("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let q=_;if(_===a.RED&&(L===a.FLOAT&&(q=a.R32F),L===a.HALF_FLOAT&&(q=a.R16F),L===a.UNSIGNED_BYTE&&(q=a.R8),L===a.UNSIGNED_SHORT&&oe&&(q=oe.R16_EXT),L===a.SHORT&&oe&&(q=oe.R16_SNORM_EXT)),_===a.RED_INTEGER&&(L===a.UNSIGNED_BYTE&&(q=a.R8UI),L===a.UNSIGNED_SHORT&&(q=a.R16UI),L===a.UNSIGNED_INT&&(q=a.R32UI),L===a.BYTE&&(q=a.R8I),L===a.SHORT&&(q=a.R16I),L===a.INT&&(q=a.R32I)),_===a.RG&&(L===a.FLOAT&&(q=a.RG32F),L===a.HALF_FLOAT&&(q=a.RG16F),L===a.UNSIGNED_BYTE&&(q=a.RG8),L===a.UNSIGNED_SHORT&&oe&&(q=oe.RG16_EXT),L===a.SHORT&&oe&&(q=oe.RG16_SNORM_EXT)),_===a.RG_INTEGER&&(L===a.UNSIGNED_BYTE&&(q=a.RG8UI),L===a.UNSIGNED_SHORT&&(q=a.RG16UI),L===a.UNSIGNED_INT&&(q=a.RG32UI),L===a.BYTE&&(q=a.RG8I),L===a.SHORT&&(q=a.RG16I),L===a.INT&&(q=a.RG32I)),_===a.RGB_INTEGER&&(L===a.UNSIGNED_BYTE&&(q=a.RGB8UI),L===a.UNSIGNED_SHORT&&(q=a.RGB16UI),L===a.UNSIGNED_INT&&(q=a.RGB32UI),L===a.BYTE&&(q=a.RGB8I),L===a.SHORT&&(q=a.RGB16I),L===a.INT&&(q=a.RGB32I)),_===a.RGBA_INTEGER&&(L===a.UNSIGNED_BYTE&&(q=a.RGBA8UI),L===a.UNSIGNED_SHORT&&(q=a.RGBA16UI),L===a.UNSIGNED_INT&&(q=a.RGBA32UI),L===a.BYTE&&(q=a.RGBA8I),L===a.SHORT&&(q=a.RGBA16I),L===a.INT&&(q=a.RGBA32I)),_===a.RGB&&(L===a.UNSIGNED_SHORT&&oe&&(q=oe.RGB16_EXT),L===a.SHORT&&oe&&(q=oe.RGB16_SNORM_EXT),L===a.UNSIGNED_INT_5_9_9_9_REV&&(q=a.RGB9_E5),L===a.UNSIGNED_INT_10F_11F_11F_REV&&(q=a.R11F_G11F_B10F)),_===a.RGBA){let Z=ne?Ui:ze.getTransfer(X);L===a.FLOAT&&(q=a.RGBA32F),L===a.HALF_FLOAT&&(q=a.RGBA16F),L===a.UNSIGNED_BYTE&&(q=Z===Je?a.SRGB8_ALPHA8:a.RGBA8),L===a.UNSIGNED_SHORT&&oe&&(q=oe.RGBA16_EXT),L===a.SHORT&&oe&&(q=oe.RGBA16_SNORM_EXT),L===a.UNSIGNED_SHORT_4_4_4_4&&(q=a.RGBA4),L===a.UNSIGNED_SHORT_5_5_5_1&&(q=a.RGB5_A1)}return(q===a.R16F||q===a.R32F||q===a.RG16F||q===a.RG32F||q===a.RGBA16F||q===a.RGBA32F)&&e.get("EXT_color_buffer_float"),q}function S(R,_){let L;return R?_===null||_===xn||_===vi?L=a.DEPTH24_STENCIL8:_===$t?L=a.DEPTH32F_STENCIL8:_===yi&&(L=a.DEPTH24_STENCIL8,ve("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):_===null||_===xn||_===vi?L=a.DEPTH_COMPONENT24:_===$t?L=a.DEPTH_COMPONENT32F:_===yi&&(L=a.DEPTH_COMPONENT16),L}function w(R,_){return u(R)===!0||R.isFramebufferTexture&&R.minFilter!==bt&&R.minFilter!==mt?Math.log2(Math.max(_.width,_.height))+1:R.mipmaps!==void 0&&R.mipmaps.length>0?R.mipmaps.length:R.isCompressedTexture&&Array.isArray(R.image)?_.mipmaps.length:1}function T(R){let _=R.target;_.removeEventListener("dispose",T),E(_),_.isVideoTexture&&h.delete(_),_.isHTMLTexture&&d.delete(_)}function v(R){let _=R.target;_.removeEventListener("dispose",v),I(_)}function E(R){let _=n.get(R);if(_.__webglInit===void 0)return;let L=R.source,G=b.get(L);if(G){let X=G[_.__cacheKey];X.usedTimes--,X.usedTimes===0&&C(R),Object.keys(G).length===0&&b.delete(L)}n.remove(R)}function C(R){let _=n.get(R);a.deleteTexture(_.__webglTexture);let L=R.source,G=b.get(L);delete G[_.__cacheKey],r.memory.textures--}function I(R){let _=n.get(R);if(R.depthTexture&&(R.depthTexture.dispose(),n.remove(R.depthTexture)),R.isWebGLCubeRenderTarget)for(let G=0;G<6;G++){if(Array.isArray(_.__webglFramebuffer[G]))for(let X=0;X<_.__webglFramebuffer[G].length;X++)a.deleteFramebuffer(_.__webglFramebuffer[G][X]);else a.deleteFramebuffer(_.__webglFramebuffer[G]);_.__webglDepthbuffer&&a.deleteRenderbuffer(_.__webglDepthbuffer[G])}else{if(Array.isArray(_.__webglFramebuffer))for(let G=0;G<_.__webglFramebuffer.length;G++)a.deleteFramebuffer(_.__webglFramebuffer[G]);else a.deleteFramebuffer(_.__webglFramebuffer);if(_.__webglDepthbuffer&&a.deleteRenderbuffer(_.__webglDepthbuffer),_.__webglMultisampledFramebuffer&&a.deleteFramebuffer(_.__webglMultisampledFramebuffer),_.__webglColorRenderbuffer)for(let G=0;G<_.__webglColorRenderbuffer.length;G++)_.__webglColorRenderbuffer[G]&&a.deleteRenderbuffer(_.__webglColorRenderbuffer[G]);_.__webglDepthRenderbuffer&&a.deleteRenderbuffer(_.__webglDepthRenderbuffer)}let L=R.textures;for(let G=0,X=L.length;G<X;G++){let ne=n.get(L[G]);ne.__webglTexture&&(a.deleteTexture(ne.__webglTexture),r.memory.textures--),n.remove(L[G])}n.remove(R)}let k=0;function O(){k=0}function V(){return k}function P(R){k=R}function j(){let R=k;return R>=i.maxTextures&&ve("WebGLTextures: Trying to use "+R+" texture units while this GPU supports only "+i.maxTextures),k+=1,R}function B(R){let _=[];return _.push(R.wrapS),_.push(R.wrapT),_.push(R.wrapR||0),_.push(R.magFilter),_.push(R.minFilter),_.push(R.anisotropy),_.push(R.internalFormat),_.push(R.format),_.push(R.type),_.push(R.generateMipmaps),_.push(R.premultiplyAlpha),_.push(R.flipY),_.push(R.unpackAlignment),_.push(R.colorSpace),_.join()}function K(R,_){let L=n.get(R);if(R.isVideoTexture&&D(R),R.isRenderTargetTexture===!1&&R.isExternalTexture!==!0&&R.version>0&&L.__version!==R.version){let G=R.image;if(G===null)ve("WebGLRenderer: Texture marked for update but no image data found.");else if(G.complete===!1)ve("WebGLRenderer: Texture marked for update but image is incomplete");else{Ce(L,R,_);return}}else R.isExternalTexture&&(L.__webglTexture=R.sourceTexture?R.sourceTexture:null);t.bindTexture(a.TEXTURE_2D,L.__webglTexture,a.TEXTURE0+_)}function Q(R,_){let L=n.get(R);if(R.isRenderTargetTexture===!1&&R.version>0&&L.__version!==R.version){Ce(L,R,_);return}else R.isExternalTexture&&(L.__webglTexture=R.sourceTexture?R.sourceTexture:null);t.bindTexture(a.TEXTURE_2D_ARRAY,L.__webglTexture,a.TEXTURE0+_)}function ee(R,_){let L=n.get(R);if(R.isRenderTargetTexture===!1&&R.version>0&&L.__version!==R.version){Ce(L,R,_);return}t.bindTexture(a.TEXTURE_3D,L.__webglTexture,a.TEXTURE0+_)}function ae(R,_){let L=n.get(R);if(R.isCubeDepthTexture!==!0&&R.version>0&&L.__version!==R.version){Ne(L,R,_);return}t.bindTexture(a.TEXTURE_CUBE_MAP,L.__webglTexture,a.TEXTURE0+_)}let ie={[oa]:a.REPEAT,[an]:a.CLAMP_TO_EDGE,[ni]:a.MIRRORED_REPEAT},ke={[bt]:a.NEAREST,[Rr]:a.NEAREST_MIPMAP_NEAREST,[Da]:a.NEAREST_MIPMAP_LINEAR,[mt]:a.LINEAR,[xi]:a.LINEAR_MIPMAP_NEAREST,[gn]:a.LINEAR_MIPMAP_LINEAR},Ke={[Yh]:a.NEVER,[td]:a.ALWAYS,[Zh]:a.LESS,[po]:a.LEQUAL,[Qh]:a.EQUAL,[bo]:a.GEQUAL,[$h]:a.GREATER,[ed]:a.NOTEQUAL};function Ge(R,_){if(_.type===$t&&e.has("OES_texture_float_linear")===!1&&(_.magFilter===mt||_.magFilter===xi||_.magFilter===Da||_.magFilter===gn||_.minFilter===mt||_.minFilter===xi||_.minFilter===Da||_.minFilter===gn)&&ve("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),a.texParameteri(R,a.TEXTURE_WRAP_S,ie[_.wrapS]),a.texParameteri(R,a.TEXTURE_WRAP_T,ie[_.wrapT]),(R===a.TEXTURE_3D||R===a.TEXTURE_2D_ARRAY)&&a.texParameteri(R,a.TEXTURE_WRAP_R,ie[_.wrapR]),a.texParameteri(R,a.TEXTURE_MAG_FILTER,ke[_.magFilter]),a.texParameteri(R,a.TEXTURE_MIN_FILTER,ke[_.minFilter]),_.compareFunction&&(a.texParameteri(R,a.TEXTURE_COMPARE_MODE,a.COMPARE_REF_TO_TEXTURE),a.texParameteri(R,a.TEXTURE_COMPARE_FUNC,Ke[_.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(_.magFilter===bt||_.minFilter!==Da&&_.minFilter!==gn||_.type===$t&&e.has("OES_texture_float_linear")===!1)return;if(_.anisotropy>1||n.get(_).__currentAnisotropy){let L=e.get("EXT_texture_filter_anisotropic");a.texParameterf(R,L.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(_.anisotropy,i.getMaxAnisotropy())),n.get(_).__currentAnisotropy=_.anisotropy}}}function J(R,_){let L=!1;R.__webglInit===void 0&&(R.__webglInit=!0,_.addEventListener("dispose",T));let G=_.source,X=b.get(G);X===void 0&&(X={},b.set(G,X));let ne=B(_);if(ne!==R.__cacheKey){X[ne]===void 0&&(X[ne]={texture:a.createTexture(),usedTimes:0},r.memory.textures++,L=!0),X[ne].usedTimes++;let oe=X[R.__cacheKey];oe!==void 0&&(X[R.__cacheKey].usedTimes--,oe.usedTimes===0&&C(_)),R.__cacheKey=ne,R.__webglTexture=X[ne].texture}return L}function re(R,_,L){return Math.floor(Math.floor(R/L)/_)}function te(R,_,L,G){let ne=R.updateRanges;if(ne.length===0)t.texSubImage2D(a.TEXTURE_2D,0,0,0,_.width,_.height,L,G,_.data);else{ne.sort((Me,de)=>Me.start-de.start);let oe=0;for(let Me=1;Me<ne.length;Me++){let de=ne[oe],le=ne[Me],Ae=de.start+de.count,Te=re(le.start,_.width,4),De=re(de.start,_.width,4);le.start<=Ae+1&&Te===De&&re(le.start+le.count-1,_.width,4)===Te?de.count=Math.max(de.count,le.start+le.count-de.start):(++oe,ne[oe]=le)}ne.length=oe+1;let q=t.getParameter(a.UNPACK_ROW_LENGTH),Z=t.getParameter(a.UNPACK_SKIP_PIXELS),ce=t.getParameter(a.UNPACK_SKIP_ROWS);t.pixelStorei(a.UNPACK_ROW_LENGTH,_.width);for(let Me=0,de=ne.length;Me<de;Me++){let le=ne[Me],Ae=Math.floor(le.start/4),Te=Math.ceil(le.count/4),De=Ae%_.width,N=Math.floor(Ae/_.width),se=Te,Y=1;t.pixelStorei(a.UNPACK_SKIP_PIXELS,De),t.pixelStorei(a.UNPACK_SKIP_ROWS,N),t.texSubImage2D(a.TEXTURE_2D,0,De,N,se,Y,L,G,_.data)}R.clearUpdateRanges(),t.pixelStorei(a.UNPACK_ROW_LENGTH,q),t.pixelStorei(a.UNPACK_SKIP_PIXELS,Z),t.pixelStorei(a.UNPACK_SKIP_ROWS,ce)}}function Ce(R,_,L){let G=a.TEXTURE_2D;(_.isDataArrayTexture||_.isCompressedArrayTexture)&&(G=a.TEXTURE_2D_ARRAY),_.isData3DTexture&&(G=a.TEXTURE_3D);let X=J(R,_),ne=_.source;t.bindTexture(G,R.__webglTexture,a.TEXTURE0+L);let oe=n.get(ne);if(ne.version!==oe.__version||X===!0){if(t.activeTexture(a.TEXTURE0+L),(typeof ImageBitmap<"u"&&_.image instanceof ImageBitmap)===!1){let Y=ze.getPrimaries(ze.workingColorSpace),he=_.colorSpace===Kn?null:ze.getPrimaries(_.colorSpace),be=_.colorSpace===Kn||Y===he?a.NONE:a.BROWSER_DEFAULT_WEBGL;t.pixelStorei(a.UNPACK_FLIP_Y_WEBGL,_.flipY),t.pixelStorei(a.UNPACK_PREMULTIPLY_ALPHA_WEBGL,_.premultiplyAlpha),t.pixelStorei(a.UNPACK_COLORSPACE_CONVERSION_WEBGL,be)}t.pixelStorei(a.UNPACK_ALIGNMENT,_.unpackAlignment);let Z=p(_.image,!1,i.maxTextureSize);Z=zt(_,Z);let ce=s.convert(_.format,_.colorSpace),Me=s.convert(_.type),de=x(_.internalFormat,ce,Me,_.normalized,_.colorSpace,_.isVideoTexture);Ge(G,_);let le,Ae=_.mipmaps,Te=_.isVideoTexture!==!0,De=oe.__version===void 0||X===!0,N=ne.dataReady,se=w(_,Z);if(_.isDepthTexture)de=S(_.format===ua,_.type),De&&(Te?t.texStorage2D(a.TEXTURE_2D,1,de,Z.width,Z.height):t.texImage2D(a.TEXTURE_2D,0,de,Z.width,Z.height,0,ce,Me,null));else if(_.isDataTexture)if(Ae.length>0){Te&&De&&t.texStorage2D(a.TEXTURE_2D,se,de,Ae[0].width,Ae[0].height);for(let Y=0,he=Ae.length;Y<he;Y++)le=Ae[Y],Te?N&&t.texSubImage2D(a.TEXTURE_2D,Y,0,0,le.width,le.height,ce,Me,le.data):t.texImage2D(a.TEXTURE_2D,Y,de,le.width,le.height,0,ce,Me,le.data);_.generateMipmaps=!1}else Te?(De&&t.texStorage2D(a.TEXTURE_2D,se,de,Z.width,Z.height),N&&te(_,Z,ce,Me)):t.texImage2D(a.TEXTURE_2D,0,de,Z.width,Z.height,0,ce,Me,Z.data);else if(_.isCompressedTexture)if(_.isCompressedArrayTexture){Te&&De&&t.texStorage3D(a.TEXTURE_2D_ARRAY,se,de,Ae[0].width,Ae[0].height,Z.depth);for(let Y=0,he=Ae.length;Y<he;Y++)if(le=Ae[Y],_.format!==en)if(ce!==null)if(Te){if(N)if(_.layerUpdates.size>0){let be=jc(le.width,le.height,_.format,_.type);for(let $ of _.layerUpdates){let _e=le.data.subarray($*be/le.data.BYTES_PER_ELEMENT,($+1)*be/le.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(a.TEXTURE_2D_ARRAY,Y,0,0,$,le.width,le.height,1,ce,_e)}_.clearLayerUpdates()}else t.compressedTexSubImage3D(a.TEXTURE_2D_ARRAY,Y,0,0,0,le.width,le.height,Z.depth,ce,le.data)}else t.compressedTexImage3D(a.TEXTURE_2D_ARRAY,Y,de,le.width,le.height,Z.depth,0,le.data,0,0);else ve("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Te?N&&t.texSubImage3D(a.TEXTURE_2D_ARRAY,Y,0,0,0,le.width,le.height,Z.depth,ce,Me,le.data):t.texImage3D(a.TEXTURE_2D_ARRAY,Y,de,le.width,le.height,Z.depth,0,ce,Me,le.data)}else{Te&&De&&t.texStorage2D(a.TEXTURE_2D,se,de,Ae[0].width,Ae[0].height);for(let Y=0,he=Ae.length;Y<he;Y++)le=Ae[Y],_.format!==en?ce!==null?Te?N&&t.compressedTexSubImage2D(a.TEXTURE_2D,Y,0,0,le.width,le.height,ce,le.data):t.compressedTexImage2D(a.TEXTURE_2D,Y,de,le.width,le.height,0,le.data):ve("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Te?N&&t.texSubImage2D(a.TEXTURE_2D,Y,0,0,le.width,le.height,ce,Me,le.data):t.texImage2D(a.TEXTURE_2D,Y,de,le.width,le.height,0,ce,Me,le.data)}else if(_.isDataArrayTexture)if(Te){if(De&&t.texStorage3D(a.TEXTURE_2D_ARRAY,se,de,Z.width,Z.height,Z.depth),N)if(_.layerUpdates.size>0){let Y=jc(Z.width,Z.height,_.format,_.type);for(let he of _.layerUpdates){let be=Z.data.subarray(he*Y/Z.data.BYTES_PER_ELEMENT,(he+1)*Y/Z.data.BYTES_PER_ELEMENT);t.texSubImage3D(a.TEXTURE_2D_ARRAY,0,0,0,he,Z.width,Z.height,1,ce,Me,be)}_.clearLayerUpdates()}else t.texSubImage3D(a.TEXTURE_2D_ARRAY,0,0,0,0,Z.width,Z.height,Z.depth,ce,Me,Z.data)}else t.texImage3D(a.TEXTURE_2D_ARRAY,0,de,Z.width,Z.height,Z.depth,0,ce,Me,Z.data);else if(_.isData3DTexture)Te?(De&&t.texStorage3D(a.TEXTURE_3D,se,de,Z.width,Z.height,Z.depth),N&&t.texSubImage3D(a.TEXTURE_3D,0,0,0,0,Z.width,Z.height,Z.depth,ce,Me,Z.data)):t.texImage3D(a.TEXTURE_3D,0,de,Z.width,Z.height,Z.depth,0,ce,Me,Z.data);else if(_.isFramebufferTexture){if(De)if(Te)t.texStorage2D(a.TEXTURE_2D,se,de,Z.width,Z.height);else{let Y=Z.width,he=Z.height;for(let be=0;be<se;be++)t.texImage2D(a.TEXTURE_2D,be,de,Y,he,0,ce,Me,null),Y>>=1,he>>=1}}else if(_.isHTMLTexture){if("texElementImage2D"in a){let Y=a.canvas;if(Y.hasAttribute("layoutsubtree")||Y.setAttribute("layoutsubtree","true"),Z.parentNode!==Y){Y.appendChild(Z),d.add(_),Y.onpaint=he=>{let be=he.changedElements;for(let $ of d)be.includes($.image)&&($.needsUpdate=!0)},Y.requestPaint();return}if(a.texElementImage2D.length===3)a.texElementImage2D(a.TEXTURE_2D,a.RGBA8,Z);else{let be=a.RGBA,$=a.RGBA,_e=a.UNSIGNED_BYTE;a.texElementImage2D(a.TEXTURE_2D,0,be,$,_e,Z)}a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MIN_FILTER,a.LINEAR),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_S,a.CLAMP_TO_EDGE),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_T,a.CLAMP_TO_EDGE)}}else if(Ae.length>0){if(Te&&De){let Y=Ye(Ae[0]);t.texStorage2D(a.TEXTURE_2D,se,de,Y.width,Y.height)}for(let Y=0,he=Ae.length;Y<he;Y++)le=Ae[Y],Te?N&&t.texSubImage2D(a.TEXTURE_2D,Y,0,0,ce,Me,le):t.texImage2D(a.TEXTURE_2D,Y,de,ce,Me,le);_.generateMipmaps=!1}else if(Te){if(De){let Y=Ye(Z);t.texStorage2D(a.TEXTURE_2D,se,de,Y.width,Y.height)}N&&t.texSubImage2D(a.TEXTURE_2D,0,0,0,ce,Me,Z)}else t.texImage2D(a.TEXTURE_2D,0,de,ce,Me,Z);u(_)&&m(G),oe.__version=ne.version,_.onUpdate&&_.onUpdate(_)}R.__version=_.version}function Ne(R,_,L){if(_.image.length!==6)return;let G=J(R,_),X=_.source;t.bindTexture(a.TEXTURE_CUBE_MAP,R.__webglTexture,a.TEXTURE0+L);let ne=n.get(X);if(X.version!==ne.__version||G===!0){t.activeTexture(a.TEXTURE0+L);let oe=ze.getPrimaries(ze.workingColorSpace),q=_.colorSpace===Kn?null:ze.getPrimaries(_.colorSpace),Z=_.colorSpace===Kn||oe===q?a.NONE:a.BROWSER_DEFAULT_WEBGL;t.pixelStorei(a.UNPACK_FLIP_Y_WEBGL,_.flipY),t.pixelStorei(a.UNPACK_PREMULTIPLY_ALPHA_WEBGL,_.premultiplyAlpha),t.pixelStorei(a.UNPACK_ALIGNMENT,_.unpackAlignment),t.pixelStorei(a.UNPACK_COLORSPACE_CONVERSION_WEBGL,Z);let ce=_.isCompressedTexture||_.image[0].isCompressedTexture,Me=_.image[0]&&_.image[0].isDataTexture,de=[];for(let $=0;$<6;$++)!ce&&!Me?de[$]=p(_.image[$],!0,i.maxCubemapSize):de[$]=Me?_.image[$].image:_.image[$],de[$]=zt(_,de[$]);let le=de[0],Ae=s.convert(_.format,_.colorSpace),Te=s.convert(_.type),De=x(_.internalFormat,Ae,Te,_.normalized,_.colorSpace),N=_.isVideoTexture!==!0,se=ne.__version===void 0||G===!0,Y=X.dataReady,he=w(_,le);Ge(a.TEXTURE_CUBE_MAP,_);let be;if(ce){N&&se&&t.texStorage2D(a.TEXTURE_CUBE_MAP,he,De,le.width,le.height);for(let $=0;$<6;$++){be=de[$].mipmaps;for(let _e=0;_e<be.length;_e++){let xe=be[_e];_.format!==en?Ae!==null?N?Y&&t.compressedTexSubImage2D(a.TEXTURE_CUBE_MAP_POSITIVE_X+$,_e,0,0,xe.width,xe.height,Ae,xe.data):t.compressedTexImage2D(a.TEXTURE_CUBE_MAP_POSITIVE_X+$,_e,De,xe.width,xe.height,0,xe.data):ve("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):N?Y&&t.texSubImage2D(a.TEXTURE_CUBE_MAP_POSITIVE_X+$,_e,0,0,xe.width,xe.height,Ae,Te,xe.data):t.texImage2D(a.TEXTURE_CUBE_MAP_POSITIVE_X+$,_e,De,xe.width,xe.height,0,Ae,Te,xe.data)}}}else{if(be=_.mipmaps,N&&se){be.length>0&&he++;let $=Ye(de[0]);t.texStorage2D(a.TEXTURE_CUBE_MAP,he,De,$.width,$.height)}for(let $=0;$<6;$++)if(Me){N?Y&&t.texSubImage2D(a.TEXTURE_CUBE_MAP_POSITIVE_X+$,0,0,0,de[$].width,de[$].height,Ae,Te,de[$].data):t.texImage2D(a.TEXTURE_CUBE_MAP_POSITIVE_X+$,0,De,de[$].width,de[$].height,0,Ae,Te,de[$].data);for(let _e=0;_e<be.length;_e++){let ct=be[_e].image[$].image;N?Y&&t.texSubImage2D(a.TEXTURE_CUBE_MAP_POSITIVE_X+$,_e+1,0,0,ct.width,ct.height,Ae,Te,ct.data):t.texImage2D(a.TEXTURE_CUBE_MAP_POSITIVE_X+$,_e+1,De,ct.width,ct.height,0,Ae,Te,ct.data)}}else{N?Y&&t.texSubImage2D(a.TEXTURE_CUBE_MAP_POSITIVE_X+$,0,0,0,Ae,Te,de[$]):t.texImage2D(a.TEXTURE_CUBE_MAP_POSITIVE_X+$,0,De,Ae,Te,de[$]);for(let _e=0;_e<be.length;_e++){let xe=be[_e];N?Y&&t.texSubImage2D(a.TEXTURE_CUBE_MAP_POSITIVE_X+$,_e+1,0,0,Ae,Te,xe.image[$]):t.texImage2D(a.TEXTURE_CUBE_MAP_POSITIVE_X+$,_e+1,De,Ae,Te,xe.image[$])}}}u(_)&&m(a.TEXTURE_CUBE_MAP),ne.__version=X.version,_.onUpdate&&_.onUpdate(_)}R.__version=_.version}function Ee(R,_,L,G,X,ne){let oe=s.convert(L.format,L.colorSpace),q=s.convert(L.type),Z=x(L.internalFormat,oe,q,L.normalized,L.colorSpace),ce=n.get(_),Me=n.get(L);if(Me.__renderTarget=_,!ce.__hasExternalTextures){let de=Math.max(1,_.width>>ne),le=Math.max(1,_.height>>ne);X===a.TEXTURE_3D||X===a.TEXTURE_2D_ARRAY?t.texImage3D(X,ne,Z,de,le,_.depth,0,oe,q,null):t.texImage2D(X,ne,Z,de,le,0,oe,q,null)}t.bindFramebuffer(a.FRAMEBUFFER,R),yt(_)?o.framebufferTexture2DMultisampleEXT(a.FRAMEBUFFER,G,X,Me.__webglTexture,0,ot(_)):(X===a.TEXTURE_2D||X>=a.TEXTURE_CUBE_MAP_POSITIVE_X&&X<=a.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&a.framebufferTexture2D(a.FRAMEBUFFER,G,X,Me.__webglTexture,ne),t.bindFramebuffer(a.FRAMEBUFFER,null)}function dt(R,_,L){if(a.bindRenderbuffer(a.RENDERBUFFER,R),_.depthBuffer){let G=_.depthTexture,X=G&&G.isDepthTexture?G.type:null,ne=S(_.stencilBuffer,X),oe=_.stencilBuffer?a.DEPTH_STENCIL_ATTACHMENT:a.DEPTH_ATTACHMENT;yt(_)?o.renderbufferStorageMultisampleEXT(a.RENDERBUFFER,ot(_),ne,_.width,_.height):L?a.renderbufferStorageMultisample(a.RENDERBUFFER,ot(_),ne,_.width,_.height):a.renderbufferStorage(a.RENDERBUFFER,ne,_.width,_.height),a.framebufferRenderbuffer(a.FRAMEBUFFER,oe,a.RENDERBUFFER,R)}else{let G=_.textures;for(let X=0;X<G.length;X++){let ne=G[X],oe=s.convert(ne.format,ne.colorSpace),q=s.convert(ne.type),Z=x(ne.internalFormat,oe,q,ne.normalized,ne.colorSpace);yt(_)?o.renderbufferStorageMultisampleEXT(a.RENDERBUFFER,ot(_),Z,_.width,_.height):L?a.renderbufferStorageMultisample(a.RENDERBUFFER,ot(_),Z,_.width,_.height):a.renderbufferStorage(a.RENDERBUFFER,Z,_.width,_.height)}}a.bindRenderbuffer(a.RENDERBUFFER,null)}function Ve(R,_,L){let G=_.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(a.FRAMEBUFFER,R),!(_.depthTexture&&_.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let X=n.get(_.depthTexture);if(X.__renderTarget=_,(!X.__webglTexture||_.depthTexture.image.width!==_.width||_.depthTexture.image.height!==_.height)&&(_.depthTexture.image.width=_.width,_.depthTexture.image.height=_.height,_.depthTexture.needsUpdate=!0),G){if(X.__webglInit===void 0&&(X.__webglInit=!0,_.depthTexture.addEventListener("dispose",T)),X.__webglTexture===void 0){X.__webglTexture=a.createTexture(),t.bindTexture(a.TEXTURE_CUBE_MAP,X.__webglTexture),Ge(a.TEXTURE_CUBE_MAP,_.depthTexture);let ce=s.convert(_.depthTexture.format),Me=s.convert(_.depthTexture.type),de;_.depthTexture.format===An?de=a.DEPTH_COMPONENT24:_.depthTexture.format===ua&&(de=a.DEPTH24_STENCIL8);for(let le=0;le<6;le++)a.texImage2D(a.TEXTURE_CUBE_MAP_POSITIVE_X+le,0,de,_.width,_.height,0,ce,Me,null)}}else K(_.depthTexture,0);let ne=X.__webglTexture,oe=ot(_),q=G?a.TEXTURE_CUBE_MAP_POSITIVE_X+L:a.TEXTURE_2D,Z=_.depthTexture.format===ua?a.DEPTH_STENCIL_ATTACHMENT:a.DEPTH_ATTACHMENT;if(_.depthTexture.format===An)yt(_)?o.framebufferTexture2DMultisampleEXT(a.FRAMEBUFFER,Z,q,ne,0,oe):a.framebufferTexture2D(a.FRAMEBUFFER,Z,q,ne,0);else if(_.depthTexture.format===ua)yt(_)?o.framebufferTexture2DMultisampleEXT(a.FRAMEBUFFER,Z,q,ne,0,oe):a.framebufferTexture2D(a.FRAMEBUFFER,Z,q,ne,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function et(R){let _=n.get(R),L=R.isWebGLCubeRenderTarget===!0;if(_.__boundDepthTexture!==R.depthTexture){let G=R.depthTexture;if(_.__depthDisposeCallback&&_.__depthDisposeCallback(),G){let X=()=>{delete _.__boundDepthTexture,delete _.__depthDisposeCallback,G.removeEventListener("dispose",X)};G.addEventListener("dispose",X),_.__depthDisposeCallback=X}_.__boundDepthTexture=G}if(R.depthTexture&&!_.__autoAllocateDepthBuffer)if(L)for(let G=0;G<6;G++)Ve(_.__webglFramebuffer[G],R,G);else{let G=R.texture.mipmaps;G&&G.length>0?Ve(_.__webglFramebuffer[0],R,0):Ve(_.__webglFramebuffer,R,0)}else if(L){_.__webglDepthbuffer=[];for(let G=0;G<6;G++)if(t.bindFramebuffer(a.FRAMEBUFFER,_.__webglFramebuffer[G]),_.__webglDepthbuffer[G]===void 0)_.__webglDepthbuffer[G]=a.createRenderbuffer(),dt(_.__webglDepthbuffer[G],R,!1);else{let X=R.stencilBuffer?a.DEPTH_STENCIL_ATTACHMENT:a.DEPTH_ATTACHMENT,ne=_.__webglDepthbuffer[G];a.bindRenderbuffer(a.RENDERBUFFER,ne),a.framebufferRenderbuffer(a.FRAMEBUFFER,X,a.RENDERBUFFER,ne)}}else{let G=R.texture.mipmaps;if(G&&G.length>0?t.bindFramebuffer(a.FRAMEBUFFER,_.__webglFramebuffer[0]):t.bindFramebuffer(a.FRAMEBUFFER,_.__webglFramebuffer),_.__webglDepthbuffer===void 0)_.__webglDepthbuffer=a.createRenderbuffer(),dt(_.__webglDepthbuffer,R,!1);else{let X=R.stencilBuffer?a.DEPTH_STENCIL_ATTACHMENT:a.DEPTH_ATTACHMENT,ne=_.__webglDepthbuffer;a.bindRenderbuffer(a.RENDERBUFFER,ne),a.framebufferRenderbuffer(a.FRAMEBUFFER,X,a.RENDERBUFFER,ne)}}t.bindFramebuffer(a.FRAMEBUFFER,null)}function qe(R,_,L){let G=n.get(R);_!==void 0&&Ee(G.__webglFramebuffer,R,R.texture,a.COLOR_ATTACHMENT0,a.TEXTURE_2D,0),L!==void 0&&et(R)}function We(R){let _=R.texture,L=n.get(R),G=n.get(_);R.addEventListener("dispose",v);let X=R.textures,ne=R.isWebGLCubeRenderTarget===!0,oe=X.length>1;if(oe||(G.__webglTexture===void 0&&(G.__webglTexture=a.createTexture()),G.__version=_.version,r.memory.textures++),ne){L.__webglFramebuffer=[];for(let q=0;q<6;q++)if(_.mipmaps&&_.mipmaps.length>0){L.__webglFramebuffer[q]=[];for(let Z=0;Z<_.mipmaps.length;Z++)L.__webglFramebuffer[q][Z]=a.createFramebuffer()}else L.__webglFramebuffer[q]=a.createFramebuffer()}else{if(_.mipmaps&&_.mipmaps.length>0){L.__webglFramebuffer=[];for(let q=0;q<_.mipmaps.length;q++)L.__webglFramebuffer[q]=a.createFramebuffer()}else L.__webglFramebuffer=a.createFramebuffer();if(oe)for(let q=0,Z=X.length;q<Z;q++){let ce=n.get(X[q]);ce.__webglTexture===void 0&&(ce.__webglTexture=a.createTexture(),r.memory.textures++)}if(R.samples>0&&yt(R)===!1){L.__webglMultisampledFramebuffer=a.createFramebuffer(),L.__webglColorRenderbuffer=[],t.bindFramebuffer(a.FRAMEBUFFER,L.__webglMultisampledFramebuffer);for(let q=0;q<X.length;q++){let Z=X[q];L.__webglColorRenderbuffer[q]=a.createRenderbuffer(),a.bindRenderbuffer(a.RENDERBUFFER,L.__webglColorRenderbuffer[q]);let ce=s.convert(Z.format,Z.colorSpace),Me=s.convert(Z.type),de=x(Z.internalFormat,ce,Me,Z.normalized,Z.colorSpace,R.isXRRenderTarget===!0),le=ot(R);a.renderbufferStorageMultisample(a.RENDERBUFFER,le,de,R.width,R.height),a.framebufferRenderbuffer(a.FRAMEBUFFER,a.COLOR_ATTACHMENT0+q,a.RENDERBUFFER,L.__webglColorRenderbuffer[q])}a.bindRenderbuffer(a.RENDERBUFFER,null),R.depthBuffer&&(L.__webglDepthRenderbuffer=a.createRenderbuffer(),dt(L.__webglDepthRenderbuffer,R,!0)),t.bindFramebuffer(a.FRAMEBUFFER,null)}}if(ne){t.bindTexture(a.TEXTURE_CUBE_MAP,G.__webglTexture),Ge(a.TEXTURE_CUBE_MAP,_);for(let q=0;q<6;q++)if(_.mipmaps&&_.mipmaps.length>0)for(let Z=0;Z<_.mipmaps.length;Z++)Ee(L.__webglFramebuffer[q][Z],R,_,a.COLOR_ATTACHMENT0,a.TEXTURE_CUBE_MAP_POSITIVE_X+q,Z);else Ee(L.__webglFramebuffer[q],R,_,a.COLOR_ATTACHMENT0,a.TEXTURE_CUBE_MAP_POSITIVE_X+q,0);u(_)&&m(a.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(oe){for(let q=0,Z=X.length;q<Z;q++){let ce=X[q],Me=n.get(ce),de=a.TEXTURE_2D;(R.isWebGL3DRenderTarget||R.isWebGLArrayRenderTarget)&&(de=R.isWebGL3DRenderTarget?a.TEXTURE_3D:a.TEXTURE_2D_ARRAY),t.bindTexture(de,Me.__webglTexture),Ge(de,ce),Ee(L.__webglFramebuffer,R,ce,a.COLOR_ATTACHMENT0+q,de,0),u(ce)&&m(de)}t.unbindTexture()}else{let q=a.TEXTURE_2D;if((R.isWebGL3DRenderTarget||R.isWebGLArrayRenderTarget)&&(q=R.isWebGL3DRenderTarget?a.TEXTURE_3D:a.TEXTURE_2D_ARRAY),t.bindTexture(q,G.__webglTexture),Ge(q,_),_.mipmaps&&_.mipmaps.length>0)for(let Z=0;Z<_.mipmaps.length;Z++)Ee(L.__webglFramebuffer[Z],R,_,a.COLOR_ATTACHMENT0,q,Z);else Ee(L.__webglFramebuffer,R,_,a.COLOR_ATTACHMENT0,q,0);u(_)&&m(q),t.unbindTexture()}R.depthBuffer&&et(R)}function xt(R){let _=R.textures;for(let L=0,G=_.length;L<G;L++){let X=_[L];if(u(X)){let ne=M(R),oe=n.get(X).__webglTexture;t.bindTexture(ne,oe),m(ne),t.unbindTexture()}}}let St=[],Tt=[];function Ct(R){if(R.samples>0){if(yt(R)===!1){let _=R.textures,L=R.width,G=R.height,X=a.COLOR_BUFFER_BIT,ne=R.stencilBuffer?a.DEPTH_STENCIL_ATTACHMENT:a.DEPTH_ATTACHMENT,oe=n.get(R),q=_.length>1;if(q)for(let ce=0;ce<_.length;ce++)t.bindFramebuffer(a.FRAMEBUFFER,oe.__webglMultisampledFramebuffer),a.framebufferRenderbuffer(a.FRAMEBUFFER,a.COLOR_ATTACHMENT0+ce,a.RENDERBUFFER,null),t.bindFramebuffer(a.FRAMEBUFFER,oe.__webglFramebuffer),a.framebufferTexture2D(a.DRAW_FRAMEBUFFER,a.COLOR_ATTACHMENT0+ce,a.TEXTURE_2D,null,0);t.bindFramebuffer(a.READ_FRAMEBUFFER,oe.__webglMultisampledFramebuffer);let Z=R.texture.mipmaps;Z&&Z.length>0?t.bindFramebuffer(a.DRAW_FRAMEBUFFER,oe.__webglFramebuffer[0]):t.bindFramebuffer(a.DRAW_FRAMEBUFFER,oe.__webglFramebuffer);for(let ce=0;ce<_.length;ce++){if(R.resolveDepthBuffer&&(R.depthBuffer&&(X|=a.DEPTH_BUFFER_BIT),R.stencilBuffer&&R.resolveStencilBuffer&&(X|=a.STENCIL_BUFFER_BIT)),q){a.framebufferRenderbuffer(a.READ_FRAMEBUFFER,a.COLOR_ATTACHMENT0,a.RENDERBUFFER,oe.__webglColorRenderbuffer[ce]);let Me=n.get(_[ce]).__webglTexture;a.framebufferTexture2D(a.DRAW_FRAMEBUFFER,a.COLOR_ATTACHMENT0,a.TEXTURE_2D,Me,0)}a.blitFramebuffer(0,0,L,G,0,0,L,G,X,a.NEAREST),l===!0&&(St.length=0,Tt.length=0,St.push(a.COLOR_ATTACHMENT0+ce),R.depthBuffer&&R.resolveDepthBuffer===!1&&(St.push(ne),Tt.push(ne),a.invalidateFramebuffer(a.DRAW_FRAMEBUFFER,Tt)),a.invalidateFramebuffer(a.READ_FRAMEBUFFER,St))}if(t.bindFramebuffer(a.READ_FRAMEBUFFER,null),t.bindFramebuffer(a.DRAW_FRAMEBUFFER,null),q)for(let ce=0;ce<_.length;ce++){t.bindFramebuffer(a.FRAMEBUFFER,oe.__webglMultisampledFramebuffer),a.framebufferRenderbuffer(a.FRAMEBUFFER,a.COLOR_ATTACHMENT0+ce,a.RENDERBUFFER,oe.__webglColorRenderbuffer[ce]);let Me=n.get(_[ce]).__webglTexture;t.bindFramebuffer(a.FRAMEBUFFER,oe.__webglFramebuffer),a.framebufferTexture2D(a.DRAW_FRAMEBUFFER,a.COLOR_ATTACHMENT0+ce,a.TEXTURE_2D,Me,0)}t.bindFramebuffer(a.DRAW_FRAMEBUFFER,oe.__webglMultisampledFramebuffer)}else if(R.depthBuffer&&R.resolveDepthBuffer===!1&&l){let _=R.stencilBuffer?a.DEPTH_STENCIL_ATTACHMENT:a.DEPTH_ATTACHMENT;a.invalidateFramebuffer(a.DRAW_FRAMEBUFFER,[_])}}}function ot(R){return Math.min(i.maxSamples,R.samples)}function yt(R){let _=n.get(R);return R.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&_.__useRenderToTexture!==!1}function D(R){let _=r.render.frame;h.get(R)!==_&&(h.set(R,_),R.update())}function zt(R,_){let L=R.colorSpace,G=R.format,X=R.type;return R.isCompressedTexture===!0||R.isVideoTexture===!0||L!==Ot&&L!==Kn&&(ze.getTransfer(L)===Je?(G!==en||X!==Wt)&&ve("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Ie("WebGLTextures: Unsupported texture color space:",L)),_}function Ye(R){return typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement?(c.width=R.naturalWidth||R.width,c.height=R.naturalHeight||R.height):typeof VideoFrame<"u"&&R instanceof VideoFrame?(c.width=R.displayWidth,c.height=R.displayHeight):(c.width=R.width,c.height=R.height),c}this.allocateTextureUnit=j,this.resetTextureUnits=O,this.getTextureUnits=V,this.setTextureUnits=P,this.setTexture2D=K,this.setTexture2DArray=Q,this.setTexture3D=ee,this.setTextureCube=ae,this.rebindTextures=qe,this.setupRenderTarget=We,this.updateRenderTargetMipmap=xt,this.updateMultisampleRenderTarget=Ct,this.setupDepthRenderbuffer=et,this.setupFrameBufferTexture=Ee,this.useMultisampledRTT=yt,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function Hg(a,e){function t(n,i=Kn){let s,r=ze.getTransfer(i);if(n===Wt)return a.UNSIGNED_BYTE;if(n===Cr)return a.UNSIGNED_SHORT_4_4_4_4;if(n===kr)return a.UNSIGNED_SHORT_5_5_5_1;if(n===Cc)return a.UNSIGNED_INT_5_9_9_9_REV;if(n===kc)return a.UNSIGNED_INT_10F_11F_11F_REV;if(n===Rc)return a.BYTE;if(n===Ic)return a.SHORT;if(n===yi)return a.UNSIGNED_SHORT;if(n===Ir)return a.INT;if(n===xn)return a.UNSIGNED_INT;if(n===$t)return a.FLOAT;if(n===Cn)return a.HALF_FLOAT;if(n===Pc)return a.ALPHA;if(n===Nc)return a.RGB;if(n===en)return a.RGBA;if(n===An)return a.DEPTH_COMPONENT;if(n===ua)return a.DEPTH_STENCIL;if(n===Pr)return a.RED;if(n===Nr)return a.RED_INTEGER;if(n===pa)return a.RG;if(n===Dr)return a.RG_INTEGER;if(n===Fr)return a.RGBA_INTEGER;if(n===hs||n===ds||n===fs||n===us)if(r===Je)if(s=e.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(n===hs)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===ds)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===fs)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===us)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=e.get("WEBGL_compressed_texture_s3tc"),s!==null){if(n===hs)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===ds)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===fs)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===us)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Ur||n===Lr||n===Or||n===Br)if(s=e.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(n===Ur)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===Lr)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Or)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===Br)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===zr||n===jr||n===Hr||n===Gr||n===Vr||n===ps||n===Wr)if(s=e.get("WEBGL_compressed_texture_etc"),s!==null){if(n===zr||n===jr)return r===Je?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(n===Hr)return r===Je?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC;if(n===Gr)return s.COMPRESSED_R11_EAC;if(n===Vr)return s.COMPRESSED_SIGNED_R11_EAC;if(n===ps)return s.COMPRESSED_RG11_EAC;if(n===Wr)return s.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===Xr||n===qr||n===Kr||n===Jr||n===Yr||n===Zr||n===Qr||n===$r||n===eo||n===to||n===no||n===ao||n===io||n===so)if(s=e.get("WEBGL_compressed_texture_astc"),s!==null){if(n===Xr)return r===Je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===qr)return r===Je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===Kr)return r===Je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===Jr)return r===Je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===Yr)return r===Je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===Zr)return r===Je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===Qr)return r===Je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===$r)return r===Je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===eo)return r===Je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===to)return r===Je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===no)return r===Je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===ao)return r===Je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===io)return r===Je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===so)return r===Je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===ro||n===oo||n===co)if(s=e.get("EXT_texture_compression_bptc"),s!==null){if(n===ro)return r===Je?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===oo)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===co)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===lo||n===ho||n===bs||n===fo)if(s=e.get("EXT_texture_compression_rgtc"),s!==null){if(n===lo)return s.COMPRESSED_RED_RGTC1_EXT;if(n===ho)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===bs)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===fo)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===vi?a.UNSIGNED_INT_24_8:a[n]!==void 0?a[n]:null}return{convert:t}}var Gg=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Vg=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,tl=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new Yi(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,n=new Qt({vertexShader:Gg,fragmentShader:Vg,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new ht(new Qi(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},nl=class extends En{constructor(e,t){super();let n=this,i=null,s=1,r=null,o="local-floor",l=1,c=null,h=null,d=null,f=null,b=null,g=null,y=typeof XRWebGLBinding<"u",p=new tl,u={},m=t.getContextAttributes(),M=null,x=null,S=[],w=[],T=new Le,v=null,E=new _t;E.viewport=new Qe;let C=new _t;C.viewport=new Qe;let I=[E,C],k=new Ar,O=null,V=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(J){let re=S[J];return re===void 0&&(re=new oi,S[J]=re),re.getTargetRaySpace()},this.getControllerGrip=function(J){let re=S[J];return re===void 0&&(re=new oi,S[J]=re),re.getGripSpace()},this.getHand=function(J){let re=S[J];return re===void 0&&(re=new oi,S[J]=re),re.getHandSpace()};function P(J){let re=w.indexOf(J.inputSource);if(re===-1)return;let te=S[re];te!==void 0&&(te.update(J.inputSource,J.frame,c||r),te.dispatchEvent({type:J.type,data:J.inputSource}))}function j(){i.removeEventListener("select",P),i.removeEventListener("selectstart",P),i.removeEventListener("selectend",P),i.removeEventListener("squeeze",P),i.removeEventListener("squeezestart",P),i.removeEventListener("squeezeend",P),i.removeEventListener("end",j),i.removeEventListener("inputsourceschange",B);for(let J=0;J<S.length;J++){let re=w[J];re!==null&&(w[J]=null,S[J].disconnect(re))}O=null,V=null,p.reset();for(let J in u)delete u[J];e.setRenderTarget(M),b=null,f=null,d=null,i=null,x=null,Ge.stop(),n.isPresenting=!1,e.setPixelRatio(v),e.setSize(T.width,T.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(J){s=J,n.isPresenting===!0&&ve("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(J){o=J,n.isPresenting===!0&&ve("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||r},this.setReferenceSpace=function(J){c=J},this.getBaseLayer=function(){return f!==null?f:b},this.getBinding=function(){return d===null&&y&&(d=new XRWebGLBinding(i,t)),d},this.getFrame=function(){return g},this.getSession=function(){return i},this.setSession=async function(J){if(i=J,i!==null){if(M=e.getRenderTarget(),i.addEventListener("select",P),i.addEventListener("selectstart",P),i.addEventListener("selectend",P),i.addEventListener("squeeze",P),i.addEventListener("squeezestart",P),i.addEventListener("squeezeend",P),i.addEventListener("end",j),i.addEventListener("inputsourceschange",B),m.xrCompatible!==!0&&await t.makeXRCompatible(),v=e.getPixelRatio(),e.getSize(T),y&&"createProjectionLayer"in XRWebGLBinding.prototype){let te=null,Ce=null,Ne=null;m.depth&&(Ne=m.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,te=m.stencil?ua:An,Ce=m.stencil?vi:xn);let Ee={colorFormat:t.RGBA8,depthFormat:Ne,scaleFactor:s};d=this.getBinding(),f=d.createProjectionLayer(Ee),i.updateRenderState({layers:[f]}),e.setPixelRatio(1),e.setSize(f.textureWidth,f.textureHeight,!1),x=new Yt(f.textureWidth,f.textureHeight,{format:en,type:Wt,depthTexture:new Hn(f.textureWidth,f.textureHeight,Ce,void 0,void 0,void 0,void 0,void 0,void 0,te),stencilBuffer:m.stencil,colorSpace:e.outputColorSpace,samples:m.antialias?4:0,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1})}else{let te={antialias:m.antialias,alpha:!0,depth:m.depth,stencil:m.stencil,framebufferScaleFactor:s};b=new XRWebGLLayer(i,t,te),i.updateRenderState({baseLayer:b}),e.setPixelRatio(1),e.setSize(b.framebufferWidth,b.framebufferHeight,!1),x=new Yt(b.framebufferWidth,b.framebufferHeight,{format:en,type:Wt,colorSpace:e.outputColorSpace,stencilBuffer:m.stencil,resolveDepthBuffer:b.ignoreDepthValues===!1,resolveStencilBuffer:b.ignoreDepthValues===!1})}x.isXRRenderTarget=!0,this.setFoveation(l),c=null,r=await i.requestReferenceSpace(o),Ge.setContext(i),Ge.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(i!==null)return i.environmentBlendMode},this.getDepthTexture=function(){return p.getDepthTexture()};function B(J){for(let re=0;re<J.removed.length;re++){let te=J.removed[re],Ce=w.indexOf(te);Ce>=0&&(w[Ce]=null,S[Ce].disconnect(te))}for(let re=0;re<J.added.length;re++){let te=J.added[re],Ce=w.indexOf(te);if(Ce===-1){for(let Ee=0;Ee<S.length;Ee++)if(Ee>=w.length){w.push(te),Ce=Ee;break}else if(w[Ee]===null){w[Ee]=te,Ce=Ee;break}if(Ce===-1)break}let Ne=S[Ce];Ne&&Ne.connect(te)}}let K=new U,Q=new U;function ee(J,re,te){K.setFromMatrixPosition(re.matrixWorld),Q.setFromMatrixPosition(te.matrixWorld);let Ce=K.distanceTo(Q),Ne=re.projectionMatrix.elements,Ee=te.projectionMatrix.elements,dt=Ne[14]/(Ne[10]-1),Ve=Ne[14]/(Ne[10]+1),et=(Ne[9]+1)/Ne[5],qe=(Ne[9]-1)/Ne[5],We=(Ne[8]-1)/Ne[0],xt=(Ee[8]+1)/Ee[0],St=dt*We,Tt=dt*xt,Ct=Ce/(-We+xt),ot=Ct*-We;if(re.matrixWorld.decompose(J.position,J.quaternion,J.scale),J.translateX(ot),J.translateZ(Ct),J.matrixWorld.compose(J.position,J.quaternion,J.scale),J.matrixWorldInverse.copy(J.matrixWorld).invert(),Ne[10]===-1)J.projectionMatrix.copy(re.projectionMatrix),J.projectionMatrixInverse.copy(re.projectionMatrixInverse);else{let yt=dt+Ct,D=Ve+Ct,zt=St-ot,Ye=Tt+(Ce-ot),R=et*Ve/D*yt,_=qe*Ve/D*yt;J.projectionMatrix.makePerspective(zt,Ye,R,_,yt,D),J.projectionMatrixInverse.copy(J.projectionMatrix).invert()}}function ae(J,re){re===null?J.matrixWorld.copy(J.matrix):J.matrixWorld.multiplyMatrices(re.matrixWorld,J.matrix),J.matrixWorldInverse.copy(J.matrixWorld).invert()}this.updateCamera=function(J){if(i===null)return;let re=J.near,te=J.far;p.texture!==null&&(p.depthNear>0&&(re=p.depthNear),p.depthFar>0&&(te=p.depthFar)),k.near=C.near=E.near=re,k.far=C.far=E.far=te,(O!==k.near||V!==k.far)&&(i.updateRenderState({depthNear:k.near,depthFar:k.far}),O=k.near,V=k.far),k.layers.mask=J.layers.mask|6,E.layers.mask=k.layers.mask&-5,C.layers.mask=k.layers.mask&-3;let Ce=J.parent,Ne=k.cameras;ae(k,Ce);for(let Ee=0;Ee<Ne.length;Ee++)ae(Ne[Ee],Ce);Ne.length===2?ee(k,E,C):k.projectionMatrix.copy(E.projectionMatrix),ie(J,k,Ce)};function ie(J,re,te){te===null?J.matrix.copy(re.matrixWorld):(J.matrix.copy(te.matrixWorld),J.matrix.invert(),J.matrix.multiply(re.matrixWorld)),J.matrix.decompose(J.position,J.quaternion,J.scale),J.updateMatrixWorld(!0),J.projectionMatrix.copy(re.projectionMatrix),J.projectionMatrixInverse.copy(re.projectionMatrixInverse),J.isPerspectiveCamera&&(J.fov=Ra*2*Math.atan(1/J.projectionMatrix.elements[5]),J.zoom=1)}this.getCamera=function(){return k},this.getFoveation=function(){if(!(f===null&&b===null))return l},this.setFoveation=function(J){l=J,f!==null&&(f.fixedFoveation=J),b!==null&&b.fixedFoveation!==void 0&&(b.fixedFoveation=J)},this.hasDepthSensing=function(){return p.texture!==null},this.getDepthSensingMesh=function(){return p.getMesh(k)},this.getCameraTexture=function(J){return u[J]};let ke=null;function Ke(J,re){if(h=re.getViewerPose(c||r),g=re,h!==null){let te=h.views;b!==null&&(e.setRenderTargetFramebuffer(x,b.framebuffer),e.setRenderTarget(x));let Ce=!1;te.length!==k.cameras.length&&(k.cameras.length=0,Ce=!0);for(let Ve=0;Ve<te.length;Ve++){let et=te[Ve],qe=null;if(b!==null)qe=b.getViewport(et);else{let xt=d.getViewSubImage(f,et);qe=xt.viewport,Ve===0&&(e.setRenderTargetTextures(x,xt.colorTexture,xt.depthStencilTexture),e.setRenderTarget(x))}let We=I[Ve];We===void 0&&(We=new _t,We.layers.enable(Ve),We.viewport=new Qe,I[Ve]=We),We.matrix.fromArray(et.transform.matrix),We.matrix.decompose(We.position,We.quaternion,We.scale),We.projectionMatrix.fromArray(et.projectionMatrix),We.projectionMatrixInverse.copy(We.projectionMatrix).invert(),We.viewport.set(qe.x,qe.y,qe.width,qe.height),Ve===0&&(k.matrix.copy(We.matrix),k.matrix.decompose(k.position,k.quaternion,k.scale)),Ce===!0&&k.cameras.push(We)}let Ne=i.enabledFeatures;if(Ne&&Ne.includes("depth-sensing")&&i.depthUsage=="gpu-optimized"&&y){d=n.getBinding();let Ve=d.getDepthInformation(te[0]);Ve&&Ve.isValid&&Ve.texture&&p.init(Ve,i.renderState)}if(Ne&&Ne.includes("camera-access")&&y){e.state.unbindTexture(),d=n.getBinding();for(let Ve=0;Ve<te.length;Ve++){let et=te[Ve].camera;if(et){let qe=u[et];qe||(qe=new Yi,u[et]=qe);let We=d.getCameraImage(et);qe.sourceTexture=We}}}}for(let te=0;te<S.length;te++){let Ce=w[te],Ne=S[te];Ce!==null&&Ne!==void 0&&Ne.update(Ce,re,c||r)}ke&&ke(J,re),re.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:re}),g=null}let Ge=new kd;Ge.setAnimationLoop(Ke),this.setAnimationLoop=function(J){ke=J},this.dispose=function(){}}},Wg=new Ue,Ld=new Pe;Ld.set(-1,0,0,0,1,0,0,0,1);function Xg(a,e){function t(p,u){p.matrixAutoUpdate===!0&&p.updateMatrix(),u.value.copy(p.matrix)}function n(p,u){u.color.getRGB(p.fogColor.value,Oc(a)),u.isFog?(p.fogNear.value=u.near,p.fogFar.value=u.far):u.isFogExp2&&(p.fogDensity.value=u.density)}function i(p,u,m,M,x){u.isNodeMaterial?u.uniformsNeedUpdate=!1:u.isMeshBasicMaterial?s(p,u):u.isMeshLambertMaterial?(s(p,u),u.envMap&&(p.envMapIntensity.value=u.envMapIntensity)):u.isMeshToonMaterial?(s(p,u),d(p,u)):u.isMeshPhongMaterial?(s(p,u),h(p,u),u.envMap&&(p.envMapIntensity.value=u.envMapIntensity)):u.isMeshStandardMaterial?(s(p,u),f(p,u),u.isMeshPhysicalMaterial&&b(p,u,x)):u.isMeshMatcapMaterial?(s(p,u),g(p,u)):u.isMeshDepthMaterial?s(p,u):u.isMeshDistanceMaterial?(s(p,u),y(p,u)):u.isMeshNormalMaterial?s(p,u):u.isLineBasicMaterial?(r(p,u),u.isLineDashedMaterial&&o(p,u)):u.isPointsMaterial?l(p,u,m,M):u.isSpriteMaterial?c(p,u):u.isShadowMaterial?(p.color.value.copy(u.color),p.opacity.value=u.opacity):u.isShaderMaterial&&(u.uniformsNeedUpdate=!1)}function s(p,u){p.opacity.value=u.opacity,u.color&&p.diffuse.value.copy(u.color),u.emissive&&p.emissive.value.copy(u.emissive).multiplyScalar(u.emissiveIntensity),u.map&&(p.map.value=u.map,t(u.map,p.mapTransform)),u.alphaMap&&(p.alphaMap.value=u.alphaMap,t(u.alphaMap,p.alphaMapTransform)),u.bumpMap&&(p.bumpMap.value=u.bumpMap,t(u.bumpMap,p.bumpMapTransform),p.bumpScale.value=u.bumpScale,u.side===Bt&&(p.bumpScale.value*=-1)),u.normalMap&&(p.normalMap.value=u.normalMap,t(u.normalMap,p.normalMapTransform),p.normalScale.value.copy(u.normalScale),u.side===Bt&&p.normalScale.value.negate()),u.displacementMap&&(p.displacementMap.value=u.displacementMap,t(u.displacementMap,p.displacementMapTransform),p.displacementScale.value=u.displacementScale,p.displacementBias.value=u.displacementBias),u.emissiveMap&&(p.emissiveMap.value=u.emissiveMap,t(u.emissiveMap,p.emissiveMapTransform)),u.specularMap&&(p.specularMap.value=u.specularMap,t(u.specularMap,p.specularMapTransform)),u.alphaTest>0&&(p.alphaTest.value=u.alphaTest);let m=e.get(u),M=m.envMap,x=m.envMapRotation;M&&(p.envMap.value=M,p.envMapRotation.value.setFromMatrix4(Wg.makeRotationFromEuler(x)).transpose(),M.isCubeTexture&&M.isRenderTargetTexture===!1&&p.envMapRotation.value.premultiply(Ld),p.reflectivity.value=u.reflectivity,p.ior.value=u.ior,p.refractionRatio.value=u.refractionRatio),u.lightMap&&(p.lightMap.value=u.lightMap,p.lightMapIntensity.value=u.lightMapIntensity,t(u.lightMap,p.lightMapTransform)),u.aoMap&&(p.aoMap.value=u.aoMap,p.aoMapIntensity.value=u.aoMapIntensity,t(u.aoMap,p.aoMapTransform))}function r(p,u){p.diffuse.value.copy(u.color),p.opacity.value=u.opacity,u.map&&(p.map.value=u.map,t(u.map,p.mapTransform))}function o(p,u){p.dashSize.value=u.dashSize,p.totalSize.value=u.dashSize+u.gapSize,p.scale.value=u.scale}function l(p,u,m,M){p.diffuse.value.copy(u.color),p.opacity.value=u.opacity,p.size.value=u.size*m,p.scale.value=M*.5,u.map&&(p.map.value=u.map,t(u.map,p.uvTransform)),u.alphaMap&&(p.alphaMap.value=u.alphaMap,t(u.alphaMap,p.alphaMapTransform)),u.alphaTest>0&&(p.alphaTest.value=u.alphaTest)}function c(p,u){p.diffuse.value.copy(u.color),p.opacity.value=u.opacity,p.rotation.value=u.rotation,u.map&&(p.map.value=u.map,t(u.map,p.mapTransform)),u.alphaMap&&(p.alphaMap.value=u.alphaMap,t(u.alphaMap,p.alphaMapTransform)),u.alphaTest>0&&(p.alphaTest.value=u.alphaTest)}function h(p,u){p.specular.value.copy(u.specular),p.shininess.value=Math.max(u.shininess,1e-4)}function d(p,u){u.gradientMap&&(p.gradientMap.value=u.gradientMap)}function f(p,u){p.metalness.value=u.metalness,u.metalnessMap&&(p.metalnessMap.value=u.metalnessMap,t(u.metalnessMap,p.metalnessMapTransform)),p.roughness.value=u.roughness,u.roughnessMap&&(p.roughnessMap.value=u.roughnessMap,t(u.roughnessMap,p.roughnessMapTransform)),u.envMap&&(p.envMapIntensity.value=u.envMapIntensity)}function b(p,u,m){p.ior.value=u.ior,u.sheen>0&&(p.sheenColor.value.copy(u.sheenColor).multiplyScalar(u.sheen),p.sheenRoughness.value=u.sheenRoughness,u.sheenColorMap&&(p.sheenColorMap.value=u.sheenColorMap,t(u.sheenColorMap,p.sheenColorMapTransform)),u.sheenRoughnessMap&&(p.sheenRoughnessMap.value=u.sheenRoughnessMap,t(u.sheenRoughnessMap,p.sheenRoughnessMapTransform))),u.clearcoat>0&&(p.clearcoat.value=u.clearcoat,p.clearcoatRoughness.value=u.clearcoatRoughness,u.clearcoatMap&&(p.clearcoatMap.value=u.clearcoatMap,t(u.clearcoatMap,p.clearcoatMapTransform)),u.clearcoatRoughnessMap&&(p.clearcoatRoughnessMap.value=u.clearcoatRoughnessMap,t(u.clearcoatRoughnessMap,p.clearcoatRoughnessMapTransform)),u.clearcoatNormalMap&&(p.clearcoatNormalMap.value=u.clearcoatNormalMap,t(u.clearcoatNormalMap,p.clearcoatNormalMapTransform),p.clearcoatNormalScale.value.copy(u.clearcoatNormalScale),u.side===Bt&&p.clearcoatNormalScale.value.negate())),u.dispersion>0&&(p.dispersion.value=u.dispersion),u.iridescence>0&&(p.iridescence.value=u.iridescence,p.iridescenceIOR.value=u.iridescenceIOR,p.iridescenceThicknessMinimum.value=u.iridescenceThicknessRange[0],p.iridescenceThicknessMaximum.value=u.iridescenceThicknessRange[1],u.iridescenceMap&&(p.iridescenceMap.value=u.iridescenceMap,t(u.iridescenceMap,p.iridescenceMapTransform)),u.iridescenceThicknessMap&&(p.iridescenceThicknessMap.value=u.iridescenceThicknessMap,t(u.iridescenceThicknessMap,p.iridescenceThicknessMapTransform))),u.transmission>0&&(p.transmission.value=u.transmission,p.transmissionSamplerMap.value=m.texture,p.transmissionSamplerSize.value.set(m.width,m.height),u.transmissionMap&&(p.transmissionMap.value=u.transmissionMap,t(u.transmissionMap,p.transmissionMapTransform)),p.thickness.value=u.thickness,u.thicknessMap&&(p.thicknessMap.value=u.thicknessMap,t(u.thicknessMap,p.thicknessMapTransform)),p.attenuationDistance.value=u.attenuationDistance,p.attenuationColor.value.copy(u.attenuationColor)),u.anisotropy>0&&(p.anisotropyVector.value.set(u.anisotropy*Math.cos(u.anisotropyRotation),u.anisotropy*Math.sin(u.anisotropyRotation)),u.anisotropyMap&&(p.anisotropyMap.value=u.anisotropyMap,t(u.anisotropyMap,p.anisotropyMapTransform))),p.specularIntensity.value=u.specularIntensity,p.specularColor.value.copy(u.specularColor),u.specularColorMap&&(p.specularColorMap.value=u.specularColorMap,t(u.specularColorMap,p.specularColorMapTransform)),u.specularIntensityMap&&(p.specularIntensityMap.value=u.specularIntensityMap,t(u.specularIntensityMap,p.specularIntensityMapTransform))}function g(p,u){u.matcap&&(p.matcap.value=u.matcap)}function y(p,u){let m=e.get(u).light;p.referencePosition.value.setFromMatrixPosition(m.matrixWorld),p.nearDistance.value=m.shadow.camera.near,p.farDistance.value=m.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:i}}function qg(a,e,t,n){let i={},s={},r=[],o=a.getParameter(a.MAX_UNIFORM_BUFFER_BINDINGS);function l(x,S){let w=S.program;n.uniformBlockBinding(x,w)}function c(x,S){let w=i[x.id];w===void 0&&(p(x),w=h(x),i[x.id]=w,x.addEventListener("dispose",m));let T=S.program;n.updateUBOMapping(x,T);let v=e.render.frame;s[x.id]!==v&&(f(x),s[x.id]=v)}function h(x){let S=d();x.__bindingPointIndex=S;let w=a.createBuffer(),T=x.__size,v=x.usage;return a.bindBuffer(a.UNIFORM_BUFFER,w),a.bufferData(a.UNIFORM_BUFFER,T,v),a.bindBuffer(a.UNIFORM_BUFFER,null),a.bindBufferBase(a.UNIFORM_BUFFER,S,w),w}function d(){for(let x=0;x<o;x++)if(r.indexOf(x)===-1)return r.push(x),x;return Ie("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function f(x){let S=i[x.id],w=x.uniforms,T=x.__cache;a.bindBuffer(a.UNIFORM_BUFFER,S);for(let v=0,E=w.length;v<E;v++){let C=w[v];if(Array.isArray(C))for(let I=0,k=C.length;I<k;I++)b(C[I],v,I,T);else b(C,v,0,T)}a.bindBuffer(a.UNIFORM_BUFFER,null)}function b(x,S,w,T){if(y(x,S,w,T)===!0){let v=x.__offset,E=x.value;if(Array.isArray(E)){let C=0;for(let I=0;I<E.length;I++){let k=E[I],O=u(k);g(k,x.__data,C),typeof k!="number"&&typeof k!="boolean"&&!k.isMatrix3&&!ArrayBuffer.isView(k)&&(C+=O.storage/Float32Array.BYTES_PER_ELEMENT)}}else g(E,x.__data,0);a.bufferSubData(a.UNIFORM_BUFFER,v,x.__data)}}function g(x,S,w){typeof x=="number"||typeof x=="boolean"?S[0]=x:x.isMatrix3?(S[0]=x.elements[0],S[1]=x.elements[1],S[2]=x.elements[2],S[3]=0,S[4]=x.elements[3],S[5]=x.elements[4],S[6]=x.elements[5],S[7]=0,S[8]=x.elements[6],S[9]=x.elements[7],S[10]=x.elements[8],S[11]=0):ArrayBuffer.isView(x)?S.set(new x.constructor(x.buffer,x.byteOffset,S.length)):x.toArray(S,w)}function y(x,S,w,T){let v=x.value,E=S+"_"+w;if(T[E]===void 0)return typeof v=="number"||typeof v=="boolean"?T[E]=v:ArrayBuffer.isView(v)?T[E]=v.slice():T[E]=v.clone(),!0;{let C=T[E];if(typeof v=="number"||typeof v=="boolean"){if(C!==v)return T[E]=v,!0}else{if(ArrayBuffer.isView(v))return!0;if(C.equals(v)===!1)return C.copy(v),!0}}return!1}function p(x){let S=x.uniforms,w=0,T=16;for(let E=0,C=S.length;E<C;E++){let I=Array.isArray(S[E])?S[E]:[S[E]];for(let k=0,O=I.length;k<O;k++){let V=I[k],P=Array.isArray(V.value)?V.value:[V.value];for(let j=0,B=P.length;j<B;j++){let K=P[j],Q=u(K),ee=w%T,ae=ee%Q.boundary,ie=ee+ae;w+=ae,ie!==0&&T-ie<Q.storage&&(w+=T-ie),V.__data=new Float32Array(Q.storage/Float32Array.BYTES_PER_ELEMENT),V.__offset=w,w+=Q.storage}}}let v=w%T;return v>0&&(w+=T-v),x.__size=w,x.__cache={},this}function u(x){let S={boundary:0,storage:0};return typeof x=="number"||typeof x=="boolean"?(S.boundary=4,S.storage=4):x.isVector2?(S.boundary=8,S.storage=8):x.isVector3||x.isColor?(S.boundary=16,S.storage=12):x.isVector4?(S.boundary=16,S.storage=16):x.isMatrix3?(S.boundary=48,S.storage=48):x.isMatrix4?(S.boundary=64,S.storage=64):x.isTexture?ve("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(x)?(S.boundary=16,S.storage=x.byteLength):ve("WebGLRenderer: Unsupported uniform value type.",x),S}function m(x){let S=x.target;S.removeEventListener("dispose",m);let w=r.indexOf(S.__bindingPointIndex);r.splice(w,1),a.deleteBuffer(i[S.id]),delete i[S.id],delete s[S.id]}function M(){for(let x in i)a.deleteBuffer(i[x]);r=[],i={},s={}}return{bind:l,update:c,dispose:M}}var Kg=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),kn=null;function Jg(){return kn===null&&(kn=new di(Kg,16,16,pa,Cn),kn.name="DFG_LUT",kn.minFilter=mt,kn.magFilter=mt,kn.wrapS=an,kn.wrapT=an,kn.generateMipmaps=!1,kn.needsUpdate=!0),kn}var vo=class{constructor(e={}){let{canvas:t=nd(),context:n=null,depth:i=!0,stencil:s=!1,alpha:r=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:d=!1,reversedDepthBuffer:f=!1,outputBufferType:b=Wt}=e;this.isWebGLRenderer=!0;let g;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");g=n.getContextAttributes().alpha}else g=r;let y=b,p=new Set([Fr,Dr,Nr]),u=new Set([Wt,xn,yi,vi,Cr,kr]),m=new Uint32Array(4),M=new Int32Array(4),x=new U,S=null,w=null,T=[],v=[],E=null;this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=mn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let C=this,I=!1,k=null,O=null,V=null,P=null;this._outputColorSpace=wt;let j=0,B=0,K=null,Q=-1,ee=null,ae=new Qe,ie=new Qe,ke=null,Ke=new Re(0),Ge=0,J=t.width,re=t.height,te=1,Ce=null,Ne=null,Ee=new Qe(0,0,J,re),dt=new Qe(0,0,J,re),Ve=!1,et=new fi,qe=!1,We=!1,xt=new Ue,St=new U,Tt=new Qe,Ct={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},ot=!1;function yt(){return K===null?te:1}let D=n;function zt(A,F){return t.getContext(A,F)}try{let A={alpha:!0,depth:i,stencil:s,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:d};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${"185"}`),t.addEventListener("webglcontextlost",ct,!1),t.addEventListener("webglcontextrestored",it,!1),t.addEventListener("webglcontextcreationerror",yn,!1),D===null){let F="webgl2";if(D=zt(F,A),D===null)throw zt(F)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}}catch(A){throw Ie("WebGLRenderer: "+A.message),A}let Ye,R,_,L,G,X,ne,oe,q,Z,ce,Me,de,le,Ae,Te,De,N,se,Y,he,be,$;function _e(){Ye=new nm(D),Ye.init(),he=new Hg(D,Ye),R=new Kb(D,Ye,e,he),_=new zg(D,Ye),R.reversedDepthBuffer&&f&&_.buffers.depth.setReversed(!0),O=D.createFramebuffer(),V=D.createFramebuffer(),P=D.createFramebuffer(),L=new sm(D),G=new Eg,X=new jg(D,Ye,_,G,R,he,L),ne=new tm(C),oe=new lu(D),be=new Xb(D,oe),q=new am(D,oe,L,be),Z=new om(D,q,oe,be,L),N=new rm(D,R,X),Ae=new Jb(G),ce=new Ag(C,ne,Ye,R,be,Ae),Me=new Xg(C,G),de=new Rg,le=new Dg(Ye),De=new Wb(C,ne,_,Z,g,l),Te=new Bg(C,Z,R),$=new qg(D,L,R,_),se=new qb(D,Ye,L),Y=new im(D,Ye,L),L.programs=ce.programs,C.capabilities=R,C.extensions=Ye,C.properties=G,C.renderLists=de,C.shadowMap=Te,C.state=_,C.info=L}_e(),y!==Wt&&(E=new lm(y,t.width,t.height,o,i,s));let xe=new nl(C,D);this.xr=xe,this.getContext=function(){return D},this.getContextAttributes=function(){return D.getContextAttributes()},this.forceContextLoss=function(){let A=Ye.get("WEBGL_lose_context");A&&A.loseContext()},this.forceContextRestore=function(){let A=Ye.get("WEBGL_lose_context");A&&A.restoreContext()},this.getPixelRatio=function(){return te},this.setPixelRatio=function(A){A!==void 0&&(te=A,this.setSize(J,re,!1))},this.getSize=function(A){return A.set(J,re)},this.setSize=function(A,F,W=!0){if(xe.isPresenting){ve("WebGLRenderer: Can't change size while VR device is presenting.");return}J=A,re=F,t.width=Math.floor(A*te),t.height=Math.floor(F*te),W===!0&&(t.style.width=A+"px",t.style.height=F+"px"),E!==null&&E.setSize(t.width,t.height),this.setViewport(0,0,A,F)},this.getDrawingBufferSize=function(A){return A.set(J*te,re*te).floor()},this.setDrawingBufferSize=function(A,F,W){J=A,re=F,te=W,t.width=Math.floor(A*W),t.height=Math.floor(F*W),this.setViewport(0,0,A,F)},this.setEffects=function(A){if(y===Wt){Ie("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(A){for(let F=0;F<A.length;F++)if(A[F].isOutputPass===!0){ve("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}E.setEffects(A||[])},this.getCurrentViewport=function(A){return A.copy(ae)},this.getViewport=function(A){return A.copy(Ee)},this.setViewport=function(A,F,W,z){A.isVector4?Ee.set(A.x,A.y,A.z,A.w):Ee.set(A,F,W,z),_.viewport(ae.copy(Ee).multiplyScalar(te).round())},this.getScissor=function(A){return A.copy(dt)},this.setScissor=function(A,F,W,z){A.isVector4?dt.set(A.x,A.y,A.z,A.w):dt.set(A,F,W,z),_.scissor(ie.copy(dt).multiplyScalar(te).round())},this.getScissorTest=function(){return Ve},this.setScissorTest=function(A){_.setScissorTest(Ve=A)},this.setOpaqueSort=function(A){Ce=A},this.setTransparentSort=function(A){Ne=A},this.getClearColor=function(A){return A.copy(De.getClearColor())},this.setClearColor=function(){De.setClearColor(...arguments)},this.getClearAlpha=function(){return De.getClearAlpha()},this.setClearAlpha=function(){De.setClearAlpha(...arguments)},this.clear=function(A=!0,F=!0,W=!0){let z=0;if(A){let H=!1;if(K!==null){let pe=K.texture.format;H=p.has(pe)}if(H){let pe=K.texture.type,ge=u.has(pe),ue=De.getClearColor(),ye=De.getClearAlpha(),Se=ue.r,Fe=ue.g,Be=ue.b;ge?(m[0]=Se,m[1]=Fe,m[2]=Be,m[3]=ye,D.clearBufferuiv(D.COLOR,0,m)):(M[0]=Se,M[1]=Fe,M[2]=Be,M[3]=ye,D.clearBufferiv(D.COLOR,0,M))}else z|=D.COLOR_BUFFER_BIT}F&&(z|=D.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),W&&(z|=D.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),z!==0&&D.clear(z)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(A){A.setRenderer(this),k=A},this.dispose=function(){t.removeEventListener("webglcontextlost",ct,!1),t.removeEventListener("webglcontextrestored",it,!1),t.removeEventListener("webglcontextcreationerror",yn,!1),De.dispose(),de.dispose(),le.dispose(),G.dispose(),ne.dispose(),Z.dispose(),be.dispose(),$.dispose(),ce.dispose(),xe.dispose(),xe.removeEventListener("sessionstart",Nl),xe.removeEventListener("sessionend",Dl),ga.stop()};function ct(A){A.preventDefault(),Li("WebGLRenderer: Context Lost."),I=!0}function it(){Li("WebGLRenderer: Context Restored."),I=!1;let A=L.autoReset,F=Te.enabled,W=Te.autoUpdate,z=Te.needsUpdate,H=Te.type;_e(),L.autoReset=A,Te.enabled=F,Te.autoUpdate=W,Te.needsUpdate=z,Te.type=H}function yn(A){Ie("WebGLRenderer: A WebGL context could not be created. Reason: ",A.statusMessage)}function vn(A){let F=A.target;F.removeEventListener("dispose",vn),$d(F)}function $d(A){ef(A),G.remove(A)}function ef(A){let F=G.get(A).programs;F!==void 0&&(F.forEach(function(W){ce.releaseProgram(W)}),A.isShaderMaterial&&ce.releaseShaderCache(A))}this.renderBufferDirect=function(A,F,W,z,H,pe){F===null&&(F=Ct);let ge=H.isMesh&&H.matrixWorld.determinantAffine()<0,ue=af(A,F,W,z,H);_.setMaterial(z,ge);let ye=W.index,Se=1;if(z.wireframe===!0){if(ye=q.getWireframeAttribute(W),ye===void 0)return;Se=2}let Fe=W.drawRange,Be=W.attributes.position,we=Fe.start*Se,$e=(Fe.start+Fe.count)*Se;pe!==null&&(we=Math.max(we,pe.start*Se),$e=Math.min($e,(pe.start+pe.count)*Se)),ye!==null?(we=Math.max(we,0),$e=Math.min($e,ye.count)):Be!=null&&(we=Math.max(we,0),$e=Math.min($e,Be.count));let ft=$e-we;if(ft<0||ft===1/0)return;be.setup(H,z,ue,W,ye);let lt,tt=se;if(ye!==null&&(lt=oe.get(ye),tt=Y,tt.setIndex(lt)),H.isMesh)z.wireframe===!0?(_.setLineWidth(z.wireframeLinewidth*yt()),tt.setMode(D.LINES)):tt.setMode(D.TRIANGLES);else if(H.isLine){let Pt=z.linewidth;Pt===void 0&&(Pt=1),_.setLineWidth(Pt*yt()),H.isLineSegments?tt.setMode(D.LINES):H.isLineLoop?tt.setMode(D.LINE_LOOP):tt.setMode(D.LINE_STRIP)}else H.isPoints?tt.setMode(D.POINTS):H.isSprite&&tt.setMode(D.TRIANGLES);if(H.isBatchedMesh)if(Ye.get("WEBGL_multi_draw"))tt.renderMultiDraw(H._multiDrawStarts,H._multiDrawCounts,H._multiDrawCount);else{let Pt=H._multiDrawStarts,me=H._multiDrawCounts,Xt=H._multiDrawCount,Xe=ye?oe.get(ye).bytesPerElement:1,tn=G.get(z).currentProgram.getUniforms();for(let _n=0;_n<Xt;_n++)tn.setValue(D,"_gl_DrawID",_n),tt.render(Pt[_n]/Xe,me[_n])}else if(H.isInstancedMesh)tt.renderInstances(we,ft,H.count);else if(W.isInstancedBufferGeometry){let Pt=W._maxInstanceCount!==void 0?W._maxInstanceCount:1/0,me=Math.min(W.instanceCount,Pt);tt.renderInstances(we,ft,me)}else tt.render(we,ft)};function Pl(A,F,W){A.transparent===!0&&A.side===rn&&A.forceSinglePass===!1?(A.side=Bt,A.needsUpdate=!0,ws(A,F,W),A.side=pn,A.needsUpdate=!0,ws(A,F,W),A.side=rn):ws(A,F,W)}this.compile=function(A,F,W=null){W===null&&(W=A),w=le.get(W),w.init(F),v.push(w),W.traverseVisible(function(H){H.isLight&&H.layers.test(F.layers)&&(w.pushLight(H),H.castShadow&&w.pushShadow(H))}),A!==W&&A.traverseVisible(function(H){H.isLight&&H.layers.test(F.layers)&&(w.pushLight(H),H.castShadow&&w.pushShadow(H))}),w.setupLights();let z=new Set;return A.traverse(function(H){if(!(H.isMesh||H.isPoints||H.isLine||H.isSprite))return;let pe=H.material;if(pe)if(Array.isArray(pe))for(let ge=0;ge<pe.length;ge++){let ue=pe[ge];Pl(ue,W,H),z.add(ue)}else Pl(pe,W,H),z.add(pe)}),w=v.pop(),z},this.compileAsync=function(A,F,W=null){let z=this.compile(A,F,W);return new Promise(H=>{function pe(){if(z.forEach(function(ge){G.get(ge).currentProgram.isReady()&&z.delete(ge)}),z.size===0){H(A);return}setTimeout(pe,10)}Ye.get("KHR_parallel_shader_compile")!==null?pe():setTimeout(pe,10)})};let Ro=null;function tf(A){Ro&&Ro(A)}function Nl(){ga.stop()}function Dl(){ga.start()}let ga=new kd;ga.setAnimationLoop(tf),typeof self<"u"&&ga.setContext(self),this.setAnimationLoop=function(A){Ro=A,xe.setAnimationLoop(A),A===null?ga.stop():ga.start()},xe.addEventListener("sessionstart",Nl),xe.addEventListener("sessionend",Dl),this.render=function(A,F){if(F!==void 0&&F.isCamera!==!0){Ie("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(I===!0)return;k!==null&&k.renderStart(A,F);let W=xe.enabled===!0&&xe.isPresenting===!0,z=E!==null&&(K===null||W)&&E.begin(C,K);if(A.matrixWorldAutoUpdate===!0&&A.updateMatrixWorld(),F.parent===null&&F.matrixWorldAutoUpdate===!0&&F.updateMatrixWorld(),xe.enabled===!0&&xe.isPresenting===!0&&(E===null||E.isCompositing()===!1)&&(xe.cameraAutoUpdate===!0&&xe.updateCamera(F),F=xe.getCamera()),A.isScene===!0&&A.onBeforeRender(C,A,F,K),w=le.get(A,v.length),w.init(F),w.state.textureUnits=X.getTextureUnits(),v.push(w),xt.multiplyMatrices(F.projectionMatrix,F.matrixWorldInverse),et.setFromProjectionMatrix(xt,fn,F.reversedDepth),We=this.localClippingEnabled,qe=Ae.init(this.clippingPlanes,We),S=de.get(A,T.length),S.init(),T.push(S),xe.enabled===!0&&xe.isPresenting===!0){let ge=C.xr.getDepthSensingMesh();ge!==null&&Io(ge,F,-1/0,C.sortObjects)}Io(A,F,0,C.sortObjects),S.finish(),C.sortObjects===!0&&S.sort(Ce,Ne,F.reversedDepth),ot=xe.enabled===!1||xe.isPresenting===!1||xe.hasDepthSensing()===!1,ot&&De.addToRenderList(S,A),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),qe===!0&&Ae.beginShadows();let H=w.state.shadowsArray;if(Te.render(H,A,F),qe===!0&&Ae.endShadows(),(z&&E.hasRenderPass())===!1){let ge=S.opaque,ue=S.transmissive;if(w.setupLights(),F.isArrayCamera){let ye=F.cameras;if(ue.length>0)for(let Se=0,Fe=ye.length;Se<Fe;Se++){let Be=ye[Se];Ul(ge,ue,A,Be)}ot&&De.render(A);for(let Se=0,Fe=ye.length;Se<Fe;Se++){let Be=ye[Se];Fl(S,A,Be,Be.viewport)}}else ue.length>0&&Ul(ge,ue,A,F),ot&&De.render(A),Fl(S,A,F)}K!==null&&B===0&&(X.updateMultisampleRenderTarget(K),X.updateRenderTargetMipmap(K)),z&&E.end(C),A.isScene===!0&&A.onAfterRender(C,A,F),be.resetDefaultState(),Q=-1,ee=null,v.pop(),v.length>0?(w=v[v.length-1],X.setTextureUnits(w.state.textureUnits),qe===!0&&Ae.setGlobalState(C.clippingPlanes,w.state.camera)):w=null,T.pop(),T.length>0?S=T[T.length-1]:S=null,k!==null&&k.renderEnd()};function Io(A,F,W,z){if(A.visible===!1)return;if(A.layers.test(F.layers)){if(A.isGroup)W=A.renderOrder;else if(A.isLOD)A.autoUpdate===!0&&A.update(F);else if(A.isLightProbeGrid)w.pushLightProbeGrid(A);else if(A.isLight)w.pushLight(A),A.castShadow&&w.pushShadow(A);else if(A.isSprite){if(!A.frustumCulled||et.intersectsSprite(A)){z&&Tt.setFromMatrixPosition(A.matrixWorld).applyMatrix4(xt);let ge=Z.update(A),ue=A.material;ue.visible&&S.push(A,ge,ue,W,Tt.z,null)}}else if((A.isMesh||A.isLine||A.isPoints)&&(!A.frustumCulled||et.intersectsObject(A))){let ge=Z.update(A),ue=A.material;if(z&&(A.boundingSphere!==void 0?(A.boundingSphere===null&&A.computeBoundingSphere(),Tt.copy(A.boundingSphere.center)):(ge.boundingSphere===null&&ge.computeBoundingSphere(),Tt.copy(ge.boundingSphere.center)),Tt.applyMatrix4(A.matrixWorld).applyMatrix4(xt)),Array.isArray(ue)){let ye=ge.groups;for(let Se=0,Fe=ye.length;Se<Fe;Se++){let Be=ye[Se],we=ue[Be.materialIndex];we&&we.visible&&S.push(A,ge,we,W,Tt.z,Be)}}else ue.visible&&S.push(A,ge,ue,W,Tt.z,null)}}let pe=A.children;for(let ge=0,ue=pe.length;ge<ue;ge++)Io(pe[ge],F,W,z)}function Fl(A,F,W,z){let{opaque:H,transmissive:pe,transparent:ge}=A;w.setupLightsView(W),qe===!0&&Ae.setGlobalState(C.clippingPlanes,W),z&&_.viewport(ae.copy(z)),H.length>0&&Ss(H,F,W),pe.length>0&&Ss(pe,F,W),ge.length>0&&Ss(ge,F,W),_.buffers.depth.setTest(!0),_.buffers.depth.setMask(!0),_.buffers.color.setMask(!0),_.setPolygonOffset(!1)}function Ul(A,F,W,z){if((W.isScene===!0?W.overrideMaterial:null)!==null)return;if(w.state.transmissionRenderTarget[z.id]===void 0){let we=Ye.has("EXT_color_buffer_half_float")||Ye.has("EXT_color_buffer_float");w.state.transmissionRenderTarget[z.id]=new Yt(1,1,{generateMipmaps:!0,type:we?Cn:Wt,minFilter:gn,samples:Math.max(4,R.samples),stencilBuffer:s,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:ze.workingColorSpace})}let pe=w.state.transmissionRenderTarget[z.id],ge=z.viewport||ae;pe.setSize(ge.z*C.transmissionResolutionScale,ge.w*C.transmissionResolutionScale);let ue=C.getRenderTarget(),ye=C.getActiveCubeFace(),Se=C.getActiveMipmapLevel();C.setRenderTarget(pe),C.getClearColor(Ke),Ge=C.getClearAlpha(),Ge<1&&C.setClearColor(16777215,.5),C.clear(),ot&&De.render(W);let Fe=C.toneMapping;C.toneMapping=mn;let Be=z.viewport;if(z.viewport!==void 0&&(z.viewport=void 0),w.setupLightsView(z),qe===!0&&Ae.setGlobalState(C.clippingPlanes,z),Ss(A,W,z),X.updateMultisampleRenderTarget(pe),X.updateRenderTargetMipmap(pe),Ye.has("WEBGL_multisampled_render_to_texture")===!1){let we=!1;for(let $e=0,ft=F.length;$e<ft;$e++){let lt=F[$e],{object:tt,geometry:Pt,material:me,group:Xt}=lt;if(me.side===rn&&tt.layers.test(z.layers)){let Xe=me.side;me.side=Bt,me.needsUpdate=!0,Ll(tt,W,z,Pt,me,Xt),me.side=Xe,me.needsUpdate=!0,we=!0}}we===!0&&(X.updateMultisampleRenderTarget(pe),X.updateRenderTargetMipmap(pe))}C.setRenderTarget(ue,ye,Se),C.setClearColor(Ke,Ge),Be!==void 0&&(z.viewport=Be),C.toneMapping=Fe}function Ss(A,F,W){let z=F.isScene===!0?F.overrideMaterial:null;for(let H=0,pe=A.length;H<pe;H++){let ge=A[H],{object:ue,geometry:ye,group:Se}=ge,Fe=ge.material;Fe.allowOverride===!0&&z!==null&&(Fe=z),ue.layers.test(W.layers)&&Ll(ue,F,W,ye,Fe,Se)}}function Ll(A,F,W,z,H,pe){A.onBeforeRender(C,F,W,z,H,pe),A.modelViewMatrix.multiplyMatrices(W.matrixWorldInverse,A.matrixWorld),A.normalMatrix.getNormalMatrix(A.modelViewMatrix),H.onBeforeRender(C,F,W,z,A,pe),H.transparent===!0&&H.side===rn&&H.forceSinglePass===!1?(H.side=Bt,H.needsUpdate=!0,C.renderBufferDirect(W,F,z,H,A,pe),H.side=pn,H.needsUpdate=!0,C.renderBufferDirect(W,F,z,H,A,pe),H.side=rn):C.renderBufferDirect(W,F,z,H,A,pe),A.onAfterRender(C,F,W,z,H,pe)}function ws(A,F,W){F.isScene!==!0&&(F=Ct);let z=G.get(A),H=w.state.lights,pe=w.state.shadowsArray,ge=H.state.version,ue=ce.getParameters(A,H.state,pe,F,W,w.state.lightProbeGridArray),ye=ce.getProgramCacheKey(ue),Se=z.programs;z.environment=A.isMeshStandardMaterial||A.isMeshLambertMaterial||A.isMeshPhongMaterial?F.environment:null,z.fog=F.fog;let Fe=A.isMeshStandardMaterial||A.isMeshLambertMaterial&&!A.envMap||A.isMeshPhongMaterial&&!A.envMap;z.envMap=ne.get(A.envMap||z.environment,Fe),z.envMapRotation=z.environment!==null&&A.envMap===null?F.environmentRotation:A.envMapRotation,Se===void 0&&(A.addEventListener("dispose",vn),Se=new Map,z.programs=Se);let Be=Se.get(ye);if(Be!==void 0){if(z.currentProgram===Be&&z.lightsStateVersion===ge)return Bl(A,ue),Be}else ue.uniforms=ce.getUniforms(A),k!==null&&A.isNodeMaterial&&k.build(A,W,ue),A.onBeforeCompile(ue,C),Be=ce.acquireProgram(ue,ye),Se.set(ye,Be),z.uniforms=ue.uniforms;let we=z.uniforms;return(!A.isShaderMaterial&&!A.isRawShaderMaterial||A.clipping===!0)&&(we.clippingPlanes=Ae.uniform),Bl(A,ue),z.needsLights=rf(A),z.lightsStateVersion=ge,z.needsLights&&(we.ambientLightColor.value=H.state.ambient,we.lightProbe.value=H.state.probe,we.directionalLights.value=H.state.directional,we.directionalLightShadows.value=H.state.directionalShadow,we.spotLights.value=H.state.spot,we.spotLightShadows.value=H.state.spotShadow,we.rectAreaLights.value=H.state.rectArea,we.ltc_1.value=H.state.rectAreaLTC1,we.ltc_2.value=H.state.rectAreaLTC2,we.pointLights.value=H.state.point,we.pointLightShadows.value=H.state.pointShadow,we.hemisphereLights.value=H.state.hemi,we.directionalShadowMatrix.value=H.state.directionalShadowMatrix,we.spotLightMatrix.value=H.state.spotLightMatrix,we.spotLightMap.value=H.state.spotLightMap,we.pointShadowMatrix.value=H.state.pointShadowMatrix),z.lightProbeGrid=w.state.lightProbeGridArray.length>0,z.currentProgram=Be,z.uniformsList=null,Be}function Ol(A){if(A.uniformsList===null){let F=A.currentProgram.getUniforms();A.uniformsList=Si.seqWithValue(F.seq,A.uniforms)}return A.uniformsList}function Bl(A,F){let W=G.get(A);W.outputColorSpace=F.outputColorSpace,W.batching=F.batching,W.batchingColor=F.batchingColor,W.instancing=F.instancing,W.instancingColor=F.instancingColor,W.instancingMorph=F.instancingMorph,W.skinning=F.skinning,W.morphTargets=F.morphTargets,W.morphNormals=F.morphNormals,W.morphColors=F.morphColors,W.morphTargetsCount=F.morphTargetsCount,W.numClippingPlanes=F.numClippingPlanes,W.numIntersection=F.numClipIntersection,W.vertexAlphas=F.vertexAlphas,W.vertexTangents=F.vertexTangents,W.toneMapping=F.toneMapping}function nf(A,F){if(A.length===0)return null;if(A.length===1)return A[0].texture!==null?A[0]:null;x.setFromMatrixPosition(F.matrixWorld);for(let W=0,z=A.length;W<z;W++){let H=A[W];if(H.texture!==null&&H.boundingBox.containsPoint(x))return H}return null}function af(A,F,W,z,H){F.isScene!==!0&&(F=Ct),X.resetTextureUnits();let pe=F.fog,ge=z.isMeshStandardMaterial||z.isMeshLambertMaterial||z.isMeshPhongMaterial?F.environment:null,ue=K===null?C.outputColorSpace:K.isXRRenderTarget===!0?K.texture.colorSpace:ze.workingColorSpace,ye=z.isMeshStandardMaterial||z.isMeshLambertMaterial&&!z.envMap||z.isMeshPhongMaterial&&!z.envMap,Se=ne.get(z.envMap||ge,ye),Fe=z.vertexColors===!0&&!!W.attributes.color&&W.attributes.color.itemSize===4,Be=!!W.attributes.tangent&&(!!z.normalMap||z.anisotropy>0),we=!!W.morphAttributes.position,$e=!!W.morphAttributes.normal,ft=!!W.morphAttributes.color,lt=mn;z.toneMapped&&(K===null||K.isXRRenderTarget===!0)&&(lt=C.toneMapping);let tt=W.morphAttributes.position||W.morphAttributes.normal||W.morphAttributes.color,Pt=tt!==void 0?tt.length:0,me=G.get(z),Xt=w.state.lights;if(qe===!0&&(We===!0||A!==ee)){let st=A===ee&&z.id===Q;Ae.setState(z,A,st)}let Xe=!1;z.version===me.__version?(me.needsLights&&me.lightsStateVersion!==Xt.state.version||me.outputColorSpace!==ue||H.isBatchedMesh&&me.batching===!1||!H.isBatchedMesh&&me.batching===!0||H.isBatchedMesh&&me.batchingColor===!0&&H.colorTexture===null||H.isBatchedMesh&&me.batchingColor===!1&&H.colorTexture!==null||H.isInstancedMesh&&me.instancing===!1||!H.isInstancedMesh&&me.instancing===!0||H.isSkinnedMesh&&me.skinning===!1||!H.isSkinnedMesh&&me.skinning===!0||H.isInstancedMesh&&me.instancingColor===!0&&H.instanceColor===null||H.isInstancedMesh&&me.instancingColor===!1&&H.instanceColor!==null||H.isInstancedMesh&&me.instancingMorph===!0&&H.morphTexture===null||H.isInstancedMesh&&me.instancingMorph===!1&&H.morphTexture!==null||me.envMap!==Se||z.fog===!0&&me.fog!==pe||me.numClippingPlanes!==void 0&&(me.numClippingPlanes!==Ae.numPlanes||me.numIntersection!==Ae.numIntersection)||me.vertexAlphas!==Fe||me.vertexTangents!==Be||me.morphTargets!==we||me.morphNormals!==$e||me.morphColors!==ft||me.toneMapping!==lt||me.morphTargetsCount!==Pt||!!me.lightProbeGrid!=w.state.lightProbeGridArray.length>0)&&(Xe=!0):(Xe=!0,me.__version=z.version);let tn=me.currentProgram;Xe===!0&&(tn=ws(z,F,H),k&&z.isNodeMaterial&&k.onUpdateProgram(z,tn,me));let _n=!1,Yn=!1,Ba=!1,nt=tn.getUniforms(),ut=me.uniforms;if(_.useProgram(tn.program)&&(_n=!0,Yn=!0,Ba=!0),z.id!==Q&&(Q=z.id,Yn=!0),me.needsLights){let st=nf(w.state.lightProbeGridArray,H);me.lightProbeGrid!==st&&(me.lightProbeGrid=st,Yn=!0)}if(_n||ee!==A){_.buffers.depth.getReversed()&&A.reversedDepth!==!0&&(A._reversedDepth=!0,A.updateProjectionMatrix()),nt.setValue(D,"projectionMatrix",A.projectionMatrix),nt.setValue(D,"viewMatrix",A.matrixWorldInverse);let Qn=nt.map.cameraPosition;Qn!==void 0&&Qn.setValue(D,St.setFromMatrixPosition(A.matrixWorld)),R.logarithmicDepthBuffer&&nt.setValue(D,"logDepthBufFC",2/(Math.log(A.far+1)/Math.LN2)),(z.isMeshPhongMaterial||z.isMeshToonMaterial||z.isMeshLambertMaterial||z.isMeshBasicMaterial||z.isMeshStandardMaterial||z.isShaderMaterial)&&nt.setValue(D,"isOrthographic",A.isOrthographicCamera===!0),ee!==A&&(ee=A,Yn=!0,Ba=!0)}if(me.needsLights&&(Xt.state.directionalShadowMap.length>0&&nt.setValue(D,"directionalShadowMap",Xt.state.directionalShadowMap,X),Xt.state.spotShadowMap.length>0&&nt.setValue(D,"spotShadowMap",Xt.state.spotShadowMap,X),Xt.state.pointShadowMap.length>0&&nt.setValue(D,"pointShadowMap",Xt.state.pointShadowMap,X)),H.isSkinnedMesh){nt.setOptional(D,H,"bindMatrix"),nt.setOptional(D,H,"bindMatrixInverse");let st=H.skeleton;st&&(st.boneTexture===null&&st.computeBoneTexture(),nt.setValue(D,"boneTexture",st.boneTexture,X))}H.isBatchedMesh&&(nt.setOptional(D,H,"batchingTexture"),nt.setValue(D,"batchingTexture",H._matricesTexture,X),nt.setOptional(D,H,"batchingIdTexture"),nt.setValue(D,"batchingIdTexture",H._indirectTexture,X),nt.setOptional(D,H,"batchingColorTexture"),H._colorsTexture!==null&&nt.setValue(D,"batchingColorTexture",H._colorsTexture,X));let Zn=W.morphAttributes;if((Zn.position!==void 0||Zn.normal!==void 0||Zn.color!==void 0)&&N.update(H,W,tn),(Yn||me.receiveShadow!==H.receiveShadow)&&(me.receiveShadow=H.receiveShadow,nt.setValue(D,"receiveShadow",H.receiveShadow)),(z.isMeshStandardMaterial||z.isMeshLambertMaterial||z.isMeshPhongMaterial)&&z.envMap===null&&F.environment!==null&&(ut.envMapIntensity.value=F.environmentIntensity),ut.dfgLUT!==void 0&&(ut.dfgLUT.value=Jg()),Yn){if(nt.setValue(D,"toneMappingExposure",C.toneMappingExposure),me.needsLights&&sf(ut,Ba),pe&&z.fog===!0&&Me.refreshFogUniforms(ut,pe),Me.refreshMaterialUniforms(ut,z,te,re,w.state.transmissionRenderTarget[A.id]),me.needsLights&&me.lightProbeGrid){let st=me.lightProbeGrid;ut.probesSH.value=st.texture,ut.probesMin.value.copy(st.boundingBox.min),ut.probesMax.value.copy(st.boundingBox.max),ut.probesResolution.value.copy(st.resolution)}Si.upload(D,Ol(me),ut,X)}if(z.isShaderMaterial&&z.uniformsNeedUpdate===!0&&(Si.upload(D,Ol(me),ut,X),z.uniformsNeedUpdate=!1),z.isSpriteMaterial&&nt.setValue(D,"center",H.center),nt.setValue(D,"modelViewMatrix",H.modelViewMatrix),nt.setValue(D,"normalMatrix",H.normalMatrix),nt.setValue(D,"modelMatrix",H.matrixWorld),z.uniformsGroups!==void 0){let st=z.uniformsGroups;for(let Qn=0,za=st.length;Qn<za;Qn++){let zl=st[Qn];$.update(zl,tn),$.bind(zl,tn)}}return tn}function sf(A,F){A.ambientLightColor.needsUpdate=F,A.lightProbe.needsUpdate=F,A.directionalLights.needsUpdate=F,A.directionalLightShadows.needsUpdate=F,A.pointLights.needsUpdate=F,A.pointLightShadows.needsUpdate=F,A.spotLights.needsUpdate=F,A.spotLightShadows.needsUpdate=F,A.rectAreaLights.needsUpdate=F,A.hemisphereLights.needsUpdate=F}function rf(A){return A.isMeshLambertMaterial||A.isMeshToonMaterial||A.isMeshPhongMaterial||A.isMeshStandardMaterial||A.isShadowMaterial||A.isShaderMaterial&&A.lights===!0}this.getActiveCubeFace=function(){return j},this.getActiveMipmapLevel=function(){return B},this.getRenderTarget=function(){return K},this.setRenderTargetTextures=function(A,F,W){let z=G.get(A);z.__autoAllocateDepthBuffer=A.resolveDepthBuffer===!1,z.__autoAllocateDepthBuffer===!1&&(z.__useRenderToTexture=!1),G.get(A.texture).__webglTexture=F,G.get(A.depthTexture).__webglTexture=z.__autoAllocateDepthBuffer?void 0:W,z.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(A,F){let W=G.get(A);W.__webglFramebuffer=F,W.__useDefaultFramebuffer=F===void 0},this.setRenderTarget=function(A,F=0,W=0){K=A,j=F,B=W;let z=null,H=!1,pe=!1;if(A){let ue=G.get(A);if(ue.__useDefaultFramebuffer!==void 0){_.bindFramebuffer(D.FRAMEBUFFER,ue.__webglFramebuffer),ae.copy(A.viewport),ie.copy(A.scissor),ke=A.scissorTest,_.viewport(ae),_.scissor(ie),_.setScissorTest(ke),Q=-1;return}else if(ue.__webglFramebuffer===void 0)X.setupRenderTarget(A);else if(ue.__hasExternalTextures)X.rebindTextures(A,G.get(A.texture).__webglTexture,G.get(A.depthTexture).__webglTexture);else if(A.depthBuffer){let Fe=A.depthTexture;if(ue.__boundDepthTexture!==Fe){if(Fe!==null&&G.has(Fe)&&(A.width!==Fe.image.width||A.height!==Fe.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");X.setupDepthRenderbuffer(A)}}let ye=A.texture;(ye.isData3DTexture||ye.isDataArrayTexture||ye.isCompressedArrayTexture)&&(pe=!0);let Se=G.get(A).__webglFramebuffer;A.isWebGLCubeRenderTarget?(Array.isArray(Se[F])?z=Se[F][W]:z=Se[F],H=!0):A.samples>0&&X.useMultisampledRTT(A)===!1?z=G.get(A).__webglMultisampledFramebuffer:Array.isArray(Se)?z=Se[W]:z=Se,ae.copy(A.viewport),ie.copy(A.scissor),ke=A.scissorTest}else ae.copy(Ee).multiplyScalar(te).floor(),ie.copy(dt).multiplyScalar(te).floor(),ke=Ve;if(W!==0&&(z=O),_.bindFramebuffer(D.FRAMEBUFFER,z)&&_.drawBuffers(A,z),_.viewport(ae),_.scissor(ie),_.setScissorTest(ke),H){let ue=G.get(A.texture);D.framebufferTexture2D(D.FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_CUBE_MAP_POSITIVE_X+F,ue.__webglTexture,W)}else if(pe){let ue=F;for(let ye=0;ye<A.textures.length;ye++){let Se=G.get(A.textures[ye]);D.framebufferTextureLayer(D.FRAMEBUFFER,D.COLOR_ATTACHMENT0+ye,Se.__webglTexture,W,ue)}}else if(A!==null&&W!==0){let ue=G.get(A.texture);D.framebufferTexture2D(D.FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_2D,ue.__webglTexture,W)}Q=-1},this.readRenderTargetPixels=function(A,F,W,z,H,pe,ge,ue=0){if(!(A&&A.isWebGLRenderTarget)){Ie("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let ye=G.get(A).__webglFramebuffer;if(A.isWebGLCubeRenderTarget&&ge!==void 0&&(ye=ye[ge]),ye){_.bindFramebuffer(D.FRAMEBUFFER,ye);try{let Se=A.textures[ue],Fe=Se.format,Be=Se.type;if(A.textures.length>1&&D.readBuffer(D.COLOR_ATTACHMENT0+ue),!R.textureFormatReadable(Fe)){Ie("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!R.textureTypeReadable(Be)){Ie("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}F>=0&&F<=A.width-z&&W>=0&&W<=A.height-H&&D.readPixels(F,W,z,H,he.convert(Fe),he.convert(Be),pe)}finally{let Se=K!==null?G.get(K).__webglFramebuffer:null;_.bindFramebuffer(D.FRAMEBUFFER,Se)}}},this.readRenderTargetPixelsAsync=async function(A,F,W,z,H,pe,ge,ue=0){if(!(A&&A.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let ye=G.get(A).__webglFramebuffer;if(A.isWebGLCubeRenderTarget&&ge!==void 0&&(ye=ye[ge]),ye)if(F>=0&&F<=A.width-z&&W>=0&&W<=A.height-H){_.bindFramebuffer(D.FRAMEBUFFER,ye);let Se=A.textures[ue],Fe=Se.format,Be=Se.type;if(A.textures.length>1&&D.readBuffer(D.COLOR_ATTACHMENT0+ue),!R.textureFormatReadable(Fe))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!R.textureTypeReadable(Be))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let we=D.createBuffer();D.bindBuffer(D.PIXEL_PACK_BUFFER,we),D.bufferData(D.PIXEL_PACK_BUFFER,pe.byteLength,D.STREAM_READ),D.readPixels(F,W,z,H,he.convert(Fe),he.convert(Be),0);let $e=K!==null?G.get(K).__webglFramebuffer:null;_.bindFramebuffer(D.FRAMEBUFFER,$e);let ft=D.fenceSync(D.SYNC_GPU_COMMANDS_COMPLETE,0);return D.flush(),await id(D,ft,4),D.bindBuffer(D.PIXEL_PACK_BUFFER,we),D.getBufferSubData(D.PIXEL_PACK_BUFFER,0,pe),D.deleteBuffer(we),D.deleteSync(ft),pe}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(A,F=null,W=0){let z=Math.pow(2,-W),H=Math.floor(A.image.width*z),pe=Math.floor(A.image.height*z),ge=F!==null?F.x:0,ue=F!==null?F.y:0;X.setTexture2D(A,0),D.copyTexSubImage2D(D.TEXTURE_2D,W,0,0,ge,ue,H,pe),_.unbindTexture()},this.copyTextureToTexture=function(A,F,W=null,z=null,H=0,pe=0){let ge,ue,ye,Se,Fe,Be,we,$e,ft,lt=A.isCompressedTexture?A.mipmaps[pe]:A.image;if(W!==null)ge=W.max.x-W.min.x,ue=W.max.y-W.min.y,ye=W.isBox3?W.max.z-W.min.z:1,Se=W.min.x,Fe=W.min.y,Be=W.isBox3?W.min.z:0;else{let ut=Math.pow(2,-H);ge=Math.floor(lt.width*ut),ue=Math.floor(lt.height*ut),A.isDataArrayTexture?ye=lt.depth:A.isData3DTexture?ye=Math.floor(lt.depth*ut):ye=1,Se=0,Fe=0,Be=0}z!==null?(we=z.x,$e=z.y,ft=z.z):(we=0,$e=0,ft=0);let tt=he.convert(F.format),Pt=he.convert(F.type),me;F.isData3DTexture?(X.setTexture3D(F,0),me=D.TEXTURE_3D):F.isDataArrayTexture||F.isCompressedArrayTexture?(X.setTexture2DArray(F,0),me=D.TEXTURE_2D_ARRAY):(X.setTexture2D(F,0),me=D.TEXTURE_2D),_.activeTexture(D.TEXTURE0),_.pixelStorei(D.UNPACK_FLIP_Y_WEBGL,F.flipY),_.pixelStorei(D.UNPACK_PREMULTIPLY_ALPHA_WEBGL,F.premultiplyAlpha),_.pixelStorei(D.UNPACK_ALIGNMENT,F.unpackAlignment);let Xt=_.getParameter(D.UNPACK_ROW_LENGTH),Xe=_.getParameter(D.UNPACK_IMAGE_HEIGHT),tn=_.getParameter(D.UNPACK_SKIP_PIXELS),_n=_.getParameter(D.UNPACK_SKIP_ROWS),Yn=_.getParameter(D.UNPACK_SKIP_IMAGES);_.pixelStorei(D.UNPACK_ROW_LENGTH,lt.width),_.pixelStorei(D.UNPACK_IMAGE_HEIGHT,lt.height),_.pixelStorei(D.UNPACK_SKIP_PIXELS,Se),_.pixelStorei(D.UNPACK_SKIP_ROWS,Fe),_.pixelStorei(D.UNPACK_SKIP_IMAGES,Be);let Ba=A.isDataArrayTexture||A.isData3DTexture,nt=F.isDataArrayTexture||F.isData3DTexture;if(A.isDepthTexture){let ut=G.get(A),Zn=G.get(F),st=G.get(ut.__renderTarget),Qn=G.get(Zn.__renderTarget);_.bindFramebuffer(D.READ_FRAMEBUFFER,st.__webglFramebuffer),_.bindFramebuffer(D.DRAW_FRAMEBUFFER,Qn.__webglFramebuffer);for(let za=0;za<ye;za++)Ba&&(D.framebufferTextureLayer(D.READ_FRAMEBUFFER,D.COLOR_ATTACHMENT0,G.get(A).__webglTexture,H,Be+za),D.framebufferTextureLayer(D.DRAW_FRAMEBUFFER,D.COLOR_ATTACHMENT0,G.get(F).__webglTexture,pe,ft+za)),D.blitFramebuffer(Se,Fe,ge,ue,we,$e,ge,ue,D.DEPTH_BUFFER_BIT,D.NEAREST);_.bindFramebuffer(D.READ_FRAMEBUFFER,null),_.bindFramebuffer(D.DRAW_FRAMEBUFFER,null)}else if(H!==0||A.isRenderTargetTexture||G.has(A)){let ut=G.get(A),Zn=G.get(F);_.bindFramebuffer(D.READ_FRAMEBUFFER,V),_.bindFramebuffer(D.DRAW_FRAMEBUFFER,P);for(let st=0;st<ye;st++)Ba?D.framebufferTextureLayer(D.READ_FRAMEBUFFER,D.COLOR_ATTACHMENT0,ut.__webglTexture,H,Be+st):D.framebufferTexture2D(D.READ_FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_2D,ut.__webglTexture,H),nt?D.framebufferTextureLayer(D.DRAW_FRAMEBUFFER,D.COLOR_ATTACHMENT0,Zn.__webglTexture,pe,ft+st):D.framebufferTexture2D(D.DRAW_FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_2D,Zn.__webglTexture,pe),H!==0?D.blitFramebuffer(Se,Fe,ge,ue,we,$e,ge,ue,D.COLOR_BUFFER_BIT,D.NEAREST):nt?D.copyTexSubImage3D(me,pe,we,$e,ft+st,Se,Fe,ge,ue):D.copyTexSubImage2D(me,pe,we,$e,Se,Fe,ge,ue);_.bindFramebuffer(D.READ_FRAMEBUFFER,null),_.bindFramebuffer(D.DRAW_FRAMEBUFFER,null)}else nt?A.isDataTexture||A.isData3DTexture?D.texSubImage3D(me,pe,we,$e,ft,ge,ue,ye,tt,Pt,lt.data):F.isCompressedArrayTexture?D.compressedTexSubImage3D(me,pe,we,$e,ft,ge,ue,ye,tt,lt.data):D.texSubImage3D(me,pe,we,$e,ft,ge,ue,ye,tt,Pt,lt):A.isDataTexture?D.texSubImage2D(D.TEXTURE_2D,pe,we,$e,ge,ue,tt,Pt,lt.data):A.isCompressedTexture?D.compressedTexSubImage2D(D.TEXTURE_2D,pe,we,$e,lt.width,lt.height,tt,lt.data):D.texSubImage2D(D.TEXTURE_2D,pe,we,$e,ge,ue,tt,Pt,lt);_.pixelStorei(D.UNPACK_ROW_LENGTH,Xt),_.pixelStorei(D.UNPACK_IMAGE_HEIGHT,Xe),_.pixelStorei(D.UNPACK_SKIP_PIXELS,tn),_.pixelStorei(D.UNPACK_SKIP_ROWS,_n),_.pixelStorei(D.UNPACK_SKIP_IMAGES,Yn),pe===0&&F.generateMipmaps&&D.generateMipmap(me),_.unbindTexture()},this.initRenderTarget=function(A){G.get(A).__webglFramebuffer===void 0&&X.setupRenderTarget(A)},this.initTexture=function(A){A.isCubeTexture?X.setTextureCube(A,0):A.isData3DTexture?X.setTexture3D(A,0):A.isDataArrayTexture||A.isCompressedArrayTexture?X.setTexture2DArray(A,0):X.setTexture2D(A,0),_.unbindTexture()},this.resetState=function(){j=0,B=0,K=null,_.reset(),be.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return fn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=ze._getDrawingBufferColorSpace(e),t.unpackColorSpace=ze._getUnpackColorSpace()}};function al(a,e){if(e===Dc)return console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles."),a;if(e===_i||e===ms){let t=a.getIndex();if(t===null){let r=[],o=a.getAttribute("position");if(o!==void 0){for(let l=0;l<o.count;l++)r.push(l);a.setIndex(r),t=a.getIndex()}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."),a}let n=t.count-2,i=[];if(e===_i)for(let r=1;r<=n;r++)i.push(t.getX(0)),i.push(t.getX(r)),i.push(t.getX(r+1));else for(let r=0;r<n;r++)r%2===0?(i.push(t.getX(r)),i.push(t.getX(r+1)),i.push(t.getX(r+2))):(i.push(t.getX(r+2)),i.push(t.getX(r+1)),i.push(t.getX(r)));i.length/3!==n&&console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.");let s=a.clone();return s.setIndex(i),s.clearGroups(),s}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:",e),a}function Od(a){let e=new Map,t=new Map,n=a.clone();return Bd(a,n,function(i,s){e.set(s,i),t.set(i,s)}),n.traverse(function(i){if(!i.isSkinnedMesh)return;let s=i,r=e.get(i),o=r.skeleton.bones;s.skeleton=r.skeleton.clone(),s.bindMatrix.copy(r.bindMatrix),s.skeleton.bones=o.map(function(l){return t.get(l)}),s.bind(s.skeleton,s.bindMatrix)}),n}function Bd(a,e,t){t(a,e);for(let n=0;n<a.children.length;n++)Bd(a.children[n],e.children[n],t)}var So=class extends Rn{constructor(e){super(e),this.dracoLoader=null,this.ktx2Loader=null,this.meshoptDecoder=null,this.pluginCallbacks=[],this.register(function(t){return new hl(t)}),this.register(function(t){return new dl(t)}),this.register(function(t){return new vl(t)}),this.register(function(t){return new _l(t)}),this.register(function(t){return new Ml(t)}),this.register(function(t){return new ul(t)}),this.register(function(t){return new pl(t)}),this.register(function(t){return new bl(t)}),this.register(function(t){return new ml(t)}),this.register(function(t){return new ll(t)}),this.register(function(t){return new gl(t)}),this.register(function(t){return new fl(t)}),this.register(function(t){return new yl(t)}),this.register(function(t){return new xl(t)}),this.register(function(t){return new ol(t)}),this.register(function(t){return new wo(t,je.EXT_MESHOPT_COMPRESSION)}),this.register(function(t){return new wo(t,je.KHR_MESHOPT_COMPRESSION)}),this.register(function(t){return new Sl(t)})}load(e,t,n,i){let s=this,r;if(this.resourcePath!=="")r=this.resourcePath;else if(this.path!==""){let c=qn.extractUrlBase(e);r=qn.resolveURL(c,this.path)}else r=qn.extractUrlBase(e);this.manager.itemStart(e);let o=function(c){i?i(c):console.error(c),s.manager.itemError(e),s.manager.itemEnd(e)},l=new mi(this.manager);l.setPath(this.path),l.setResponseType("arraybuffer"),l.setRequestHeader(this.requestHeader),l.setWithCredentials(this.withCredentials),l.load(e,function(c){try{s.parse(c,r,function(h){t(h),s.manager.itemEnd(e)},o)}catch(h){o(h)}},n,o)}setDRACOLoader(e){return this.dracoLoader=e,this}setKTX2Loader(e){return this.ktx2Loader=e,this}setMeshoptDecoder(e){return this.meshoptDecoder=e,this}register(e){return this.pluginCallbacks.indexOf(e)===-1&&this.pluginCallbacks.push(e),this}unregister(e){return this.pluginCallbacks.indexOf(e)!==-1&&this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(e),1),this}parse(e,t,n,i){let s,r={},o={},l=new TextDecoder;if(typeof e=="string")s=JSON.parse(e);else if(e instanceof ArrayBuffer)if(l.decode(new Uint8Array(e,0,4))===Vd){try{r[je.KHR_BINARY_GLTF]=new wl(e)}catch(d){i&&i(d);return}s=JSON.parse(r[je.KHR_BINARY_GLTF].content)}else s=JSON.parse(l.decode(e));else s=e;if(s.asset===void 0||s.asset.version[0]<2){i&&i(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));return}let c=new kl(s,{path:t||this.resourcePath||"",crossOrigin:this.crossOrigin,requestHeader:this.requestHeader,manager:this.manager,ktx2Loader:this.ktx2Loader,meshoptDecoder:this.meshoptDecoder});c.fileLoader.setRequestHeader(this.requestHeader);for(let h=0;h<this.pluginCallbacks.length;h++){let d=this.pluginCallbacks[h](c);d.name||console.error("THREE.GLTFLoader: Invalid plugin found: missing name"),o[d.name]=d,r[d.name]=!0}if(s.extensionsUsed)for(let h=0;h<s.extensionsUsed.length;++h){let d=s.extensionsUsed[h],f=s.extensionsRequired||[];switch(d){case je.KHR_MATERIALS_UNLIT:r[d]=new cl;break;case je.KHR_DRACO_MESH_COMPRESSION:r[d]=new Al(s,this.dracoLoader);break;case je.KHR_TEXTURE_TRANSFORM:r[d]=new El;break;case je.KHR_MESH_QUANTIZATION:r[d]=new Tl;break;default:f.indexOf(d)>=0&&o[d]===void 0&&console.warn('THREE.GLTFLoader: Unknown extension "'+d+'".')}}c.setExtensions(r),c.setPlugins(o),c.parse(n,i)}parseAsync(e,t){let n=this;return new Promise(function(i,s){n.parse(e,t,i,s)})}};function Zg(){let a={};return{get:function(e){return a[e]},add:function(e,t){a[e]=t},remove:function(e){delete a[e]},removeAll:function(){a={}}}}function gt(a,e,t){let n=a.json.materials[e];return n.extensions&&n.extensions[t]?n.extensions[t]:null}var je={KHR_BINARY_GLTF:"KHR_binary_glTF",KHR_DRACO_MESH_COMPRESSION:"KHR_draco_mesh_compression",KHR_LIGHTS_PUNCTUAL:"KHR_lights_punctual",KHR_MATERIALS_CLEARCOAT:"KHR_materials_clearcoat",KHR_MATERIALS_DISPERSION:"KHR_materials_dispersion",KHR_MATERIALS_IOR:"KHR_materials_ior",KHR_MATERIALS_SHEEN:"KHR_materials_sheen",KHR_MATERIALS_SPECULAR:"KHR_materials_specular",KHR_MATERIALS_TRANSMISSION:"KHR_materials_transmission",KHR_MATERIALS_IRIDESCENCE:"KHR_materials_iridescence",KHR_MATERIALS_ANISOTROPY:"KHR_materials_anisotropy",KHR_MATERIALS_UNLIT:"KHR_materials_unlit",KHR_MATERIALS_VOLUME:"KHR_materials_volume",KHR_TEXTURE_BASISU:"KHR_texture_basisu",KHR_TEXTURE_TRANSFORM:"KHR_texture_transform",KHR_MESH_QUANTIZATION:"KHR_mesh_quantization",KHR_MATERIALS_EMISSIVE_STRENGTH:"KHR_materials_emissive_strength",EXT_MATERIALS_BUMP:"EXT_materials_bump",EXT_TEXTURE_WEBP:"EXT_texture_webp",EXT_TEXTURE_AVIF:"EXT_texture_avif",EXT_MESHOPT_COMPRESSION:"EXT_meshopt_compression",KHR_MESHOPT_COMPRESSION:"KHR_meshopt_compression",EXT_MESH_GPU_INSTANCING:"EXT_mesh_gpu_instancing"},ol=class{constructor(e){this.parser=e,this.name=je.KHR_LIGHTS_PUNCTUAL,this.cache={refs:{},uses:{}}}_markDefs(){let e=this.parser,t=this.parser.json.nodes||[];for(let n=0,i=t.length;n<i;n++){let s=t[n];s.extensions&&s.extensions[this.name]&&s.extensions[this.name].light!==void 0&&e._addNodeRef(this.cache,s.extensions[this.name].light)}}_loadLight(e){let t=this.parser,n="light:"+e,i=t.cache.get(n);if(i)return i;let s=t.json,l=((s.extensions&&s.extensions[this.name]||{}).lights||[])[e],c,h=new Re(16777215);l.color!==void 0&&h.setRGB(l.color[0],l.color[1],l.color[2],Ot);let d=l.range!==void 0?l.range:0;switch(l.type){case"directional":c=new Pa(h),c.target.position.set(0,0,-1),c.add(c.target);break;case"point":c=new rs(h),c.distance=d;break;case"spot":c=new ss(h),c.distance=d,l.spot=l.spot||{},l.spot.innerConeAngle=l.spot.innerConeAngle!==void 0?l.spot.innerConeAngle:0,l.spot.outerConeAngle=l.spot.outerConeAngle!==void 0?l.spot.outerConeAngle:Math.PI/4,c.angle=l.spot.outerConeAngle,c.penumbra=1-l.spot.innerConeAngle/l.spot.outerConeAngle,c.target.position.set(0,0,-1),c.add(c.target);break;default:throw new Error("THREE.GLTFLoader: Unexpected light type: "+l.type)}return c.position.set(0,0,0),Nn(c,l),l.intensity!==void 0&&(c.intensity=l.intensity),c.name=t.createUniqueName(l.name||"light_"+e),i=Promise.resolve(c),t.cache.add(n,i),i}getDependency(e,t){if(e==="light")return this._loadLight(t)}createNodeAttachment(e){let t=this,n=this.parser,s=n.json.nodes[e],o=(s.extensions&&s.extensions[this.name]||{}).light;return o===void 0?null:this._loadLight(o).then(function(l){return n._getNodeRef(t.cache,o,l)})}},cl=class{constructor(){this.name=je.KHR_MATERIALS_UNLIT}getMaterialType(){return bn}extendParams(e,t,n){let i=[];e.color=new Re(1,1,1),e.opacity=1;let s=t.pbrMetallicRoughness;if(s){if(Array.isArray(s.baseColorFactor)){let r=s.baseColorFactor;e.color.setRGB(r[0],r[1],r[2],Ot),e.opacity=r[3]}s.baseColorTexture!==void 0&&i.push(n.assignTexture(e,"map",s.baseColorTexture,wt))}return Promise.all(i)}},ll=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_EMISSIVE_STRENGTH}extendMaterialParams(e,t){let n=gt(this.parser,e,this.name);return n===null||n.emissiveStrength!==void 0&&(t.emissiveIntensity=n.emissiveStrength),Promise.resolve()}},hl=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_CLEARCOAT}getMaterialType(e){return gt(this.parser,e,this.name)!==null?Gt:null}extendMaterialParams(e,t){let n=gt(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];if(n.clearcoatFactor!==void 0&&(t.clearcoat=n.clearcoatFactor),n.clearcoatTexture!==void 0&&i.push(this.parser.assignTexture(t,"clearcoatMap",n.clearcoatTexture)),n.clearcoatRoughnessFactor!==void 0&&(t.clearcoatRoughness=n.clearcoatRoughnessFactor),n.clearcoatRoughnessTexture!==void 0&&i.push(this.parser.assignTexture(t,"clearcoatRoughnessMap",n.clearcoatRoughnessTexture)),n.clearcoatNormalTexture!==void 0&&(i.push(this.parser.assignTexture(t,"clearcoatNormalMap",n.clearcoatNormalTexture)),n.clearcoatNormalTexture.scale!==void 0)){let s=n.clearcoatNormalTexture.scale;t.clearcoatNormalScale=new Le(s,s)}return Promise.all(i)}},dl=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_DISPERSION}getMaterialType(e){return gt(this.parser,e,this.name)!==null?Gt:null}extendMaterialParams(e,t){let n=gt(this.parser,e,this.name);return n===null||(t.dispersion=n.dispersion!==void 0?n.dispersion:0),Promise.resolve()}},fl=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_IRIDESCENCE}getMaterialType(e){return gt(this.parser,e,this.name)!==null?Gt:null}extendMaterialParams(e,t){let n=gt(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];return n.iridescenceFactor!==void 0&&(t.iridescence=n.iridescenceFactor),n.iridescenceTexture!==void 0&&i.push(this.parser.assignTexture(t,"iridescenceMap",n.iridescenceTexture)),n.iridescenceIor!==void 0&&(t.iridescenceIOR=n.iridescenceIor),t.iridescenceThicknessRange===void 0&&(t.iridescenceThicknessRange=[100,400]),n.iridescenceThicknessMinimum!==void 0&&(t.iridescenceThicknessRange[0]=n.iridescenceThicknessMinimum),n.iridescenceThicknessMaximum!==void 0&&(t.iridescenceThicknessRange[1]=n.iridescenceThicknessMaximum),n.iridescenceThicknessTexture!==void 0&&i.push(this.parser.assignTexture(t,"iridescenceThicknessMap",n.iridescenceThicknessTexture)),Promise.all(i)}},ul=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_SHEEN}getMaterialType(e){return gt(this.parser,e,this.name)!==null?Gt:null}extendMaterialParams(e,t){let n=gt(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];if(t.sheenColor=new Re(0,0,0),t.sheenRoughness=0,t.sheen=1,n.sheenColorFactor!==void 0){let s=n.sheenColorFactor;t.sheenColor.setRGB(s[0],s[1],s[2],Ot)}return n.sheenRoughnessFactor!==void 0&&(t.sheenRoughness=n.sheenRoughnessFactor),n.sheenColorTexture!==void 0&&i.push(this.parser.assignTexture(t,"sheenColorMap",n.sheenColorTexture,wt)),n.sheenRoughnessTexture!==void 0&&i.push(this.parser.assignTexture(t,"sheenRoughnessMap",n.sheenRoughnessTexture)),Promise.all(i)}},pl=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_TRANSMISSION}getMaterialType(e){return gt(this.parser,e,this.name)!==null?Gt:null}extendMaterialParams(e,t){let n=gt(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];return n.transmissionFactor!==void 0&&(t.transmission=n.transmissionFactor),n.transmissionTexture!==void 0&&i.push(this.parser.assignTexture(t,"transmissionMap",n.transmissionTexture)),Promise.all(i)}},bl=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_VOLUME}getMaterialType(e){return gt(this.parser,e,this.name)!==null?Gt:null}extendMaterialParams(e,t){let n=gt(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];t.thickness=n.thicknessFactor!==void 0?n.thicknessFactor:0,n.thicknessTexture!==void 0&&i.push(this.parser.assignTexture(t,"thicknessMap",n.thicknessTexture)),t.attenuationDistance=n.attenuationDistance||1/0;let s=n.attenuationColor||[1,1,1];return t.attenuationColor=new Re().setRGB(s[0],s[1],s[2],Ot),Promise.all(i)}},ml=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_IOR}getMaterialType(e){return gt(this.parser,e,this.name)!==null?Gt:null}extendMaterialParams(e,t){let n=gt(this.parser,e,this.name);return n===null||(t.ior=n.ior!==void 0?n.ior:1.5,t.ior===0&&(t.ior=1e3)),Promise.resolve()}},gl=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_SPECULAR}getMaterialType(e){return gt(this.parser,e,this.name)!==null?Gt:null}extendMaterialParams(e,t){let n=gt(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];t.specularIntensity=n.specularFactor!==void 0?n.specularFactor:1,n.specularTexture!==void 0&&i.push(this.parser.assignTexture(t,"specularIntensityMap",n.specularTexture));let s=n.specularColorFactor||[1,1,1];return t.specularColor=new Re().setRGB(s[0],s[1],s[2],Ot),n.specularColorTexture!==void 0&&i.push(this.parser.assignTexture(t,"specularColorMap",n.specularColorTexture,wt)),Promise.all(i)}},xl=class{constructor(e){this.parser=e,this.name=je.EXT_MATERIALS_BUMP}getMaterialType(e){return gt(this.parser,e,this.name)!==null?Gt:null}extendMaterialParams(e,t){let n=gt(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];return t.bumpScale=n.bumpFactor!==void 0?n.bumpFactor:1,n.bumpTexture!==void 0&&i.push(this.parser.assignTexture(t,"bumpMap",n.bumpTexture)),Promise.all(i)}},yl=class{constructor(e){this.parser=e,this.name=je.KHR_MATERIALS_ANISOTROPY}getMaterialType(e){return gt(this.parser,e,this.name)!==null?Gt:null}extendMaterialParams(e,t){let n=gt(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];return n.anisotropyStrength!==void 0&&(t.anisotropy=n.anisotropyStrength),n.anisotropyRotation!==void 0&&(t.anisotropyRotation=n.anisotropyRotation),n.anisotropyTexture!==void 0&&i.push(this.parser.assignTexture(t,"anisotropyMap",n.anisotropyTexture)),Promise.all(i)}},vl=class{constructor(e){this.parser=e,this.name=je.KHR_TEXTURE_BASISU}loadTexture(e){let t=this.parser,n=t.json,i=n.textures[e];if(!i.extensions||!i.extensions[this.name])return null;let s=i.extensions[this.name],r=t.options.ktx2Loader;if(!r){if(n.extensionsRequired&&n.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");return null}return t.loadTextureImage(e,s.source,r)}},_l=class{constructor(e){this.parser=e,this.name=je.EXT_TEXTURE_WEBP}loadTexture(e){let t=this.name,n=this.parser,i=n.json,s=i.textures[e];if(!s.extensions||!s.extensions[t])return null;let r=s.extensions[t],o=i.images[r.source],l=n.textureLoader;if(o.uri){let c=n.options.manager.getHandler(o.uri);c!==null&&(l=c)}return n.loadTextureImage(e,r.source,l)}},Ml=class{constructor(e){this.parser=e,this.name=je.EXT_TEXTURE_AVIF}loadTexture(e){let t=this.name,n=this.parser,i=n.json,s=i.textures[e];if(!s.extensions||!s.extensions[t])return null;let r=s.extensions[t],o=i.images[r.source],l=n.textureLoader;if(o.uri){let c=n.options.manager.getHandler(o.uri);c!==null&&(l=c)}return n.loadTextureImage(e,r.source,l)}},wo=class{constructor(e,t){this.name=t,this.parser=e}loadBufferView(e){let t=this.parser.json,n=t.bufferViews[e];if(n.extensions&&n.extensions[this.name]){let i=n.extensions[this.name],s=this.parser.getDependency("buffer",i.buffer),r=this.parser.options.meshoptDecoder;if(!r||!r.supported){if(t.extensionsRequired&&t.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");return null}return s.then(function(o){let l=i.byteOffset||0,c=i.byteLength||0,h=i.count,d=i.byteStride,f=new Uint8Array(o,l,c);return r.decodeGltfBufferAsync?r.decodeGltfBufferAsync(h,d,f,i.mode,i.filter).then(function(b){return b.buffer}):r.ready.then(function(){let b=new ArrayBuffer(h*d);return r.decodeGltfBuffer(new Uint8Array(b),h,d,f,i.mode,i.filter),b})})}else return null}},Sl=class{constructor(e){this.name=je.EXT_MESH_GPU_INSTANCING,this.parser=e}createNodeMesh(e){let t=this.parser.json,n=t.nodes[e];if(!n.extensions||!n.extensions[this.name]||n.mesh===void 0)return null;let i=t.meshes[n.mesh];for(let c of i.primitives)if(c.mode!==on.TRIANGLES&&c.mode!==on.TRIANGLE_STRIP&&c.mode!==on.TRIANGLE_FAN&&c.mode!==void 0)return null;let r=n.extensions[this.name].attributes,o=[],l={};for(let c in r)o.push(this.parser.getDependency("accessor",r[c]).then(h=>(l[c]=h,l[c])));return o.length<1?null:(o.push(this.parser.createNodeMesh(e)),Promise.all(o).then(c=>{let h=c.pop(),d=h.isGroup?h.children:[h],f=c[0].count,b=[];for(let g of d){let y=new Ue,p=new U,u=new Jt,m=new U(1,1,1),M=new Wi(g.geometry,g.material,f);for(let x=0;x<f;x++)l.TRANSLATION&&p.fromBufferAttribute(l.TRANSLATION,x),l.ROTATION&&u.fromBufferAttribute(l.ROTATION,x),l.SCALE&&m.fromBufferAttribute(l.SCALE,x),M.setMatrixAt(x,y.compose(p,u,m));for(let x in l)if(x==="_COLOR_0"){let S=l[x];M.instanceColor=new ca(S.array,S.itemSize,S.normalized)}else x!=="TRANSLATION"&&x!=="ROTATION"&&x!=="SCALE"&&g.geometry.setAttribute(x,l[x]);rt.prototype.copy.call(M,g),this.parser.assignFinalMaterial(M),b.push(M)}return h.isGroup?(h.clear(),h.add(...b),h):b[0]}))}},Vd="glTF",vs=12,zd={JSON:1313821514,BIN:5130562},wl=class{constructor(e){this.name=je.KHR_BINARY_GLTF,this.content=null,this.body=null;let t=new DataView(e,0,vs),n=new TextDecoder;if(this.header={magic:n.decode(new Uint8Array(e.slice(0,4))),version:t.getUint32(4,!0),length:t.getUint32(8,!0)},this.header.magic!==Vd)throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");if(this.header.version<2)throw new Error("THREE.GLTFLoader: Legacy binary file detected.");let i=this.header.length-vs,s=new DataView(e,vs),r=0;for(;r<i;){let o=s.getUint32(r,!0);r+=4;let l=s.getUint32(r,!0);if(r+=4,l===zd.JSON){let c=new Uint8Array(e,vs+r,o);this.content=n.decode(c)}else if(l===zd.BIN){let c=vs+r;this.body=e.slice(c,c+o)}r+=o}if(this.content===null)throw new Error("THREE.GLTFLoader: JSON content not found.")}},Al=class{constructor(e,t){if(!t)throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");this.name=je.KHR_DRACO_MESH_COMPRESSION,this.json=e,this.dracoLoader=t,this.dracoLoader.preload()}decodePrimitive(e,t){let n=this.json,i=this.dracoLoader,s=e.extensions[this.name].bufferView,r=e.extensions[this.name].attributes,o={},l={},c={};for(let h in r){let d=Il[h]||h.toLowerCase();o[d]=r[h]}for(let h in e.attributes){let d=Il[h]||h.toLowerCase();if(r[h]!==void 0){let f=n.accessors[e.attributes[h]],b=Ai[f.componentType];c[d]=b.name,l[d]=f.normalized===!0}}return t.getDependency("bufferView",s).then(function(h){return new Promise(function(d,f){i.decodeDracoFile(h,function(b){for(let g in b.attributes){let y=b.attributes[g],p=l[g];p!==void 0&&(y.normalized=p)}d(b)},o,c,Ot,f)})})}},El=class{constructor(){this.name=je.KHR_TEXTURE_TRANSFORM}extendTexture(e,t){return(t.texCoord===void 0||t.texCoord===e.channel)&&t.offset===void 0&&t.rotation===void 0&&t.scale===void 0||(e=e.clone(),t.texCoord!==void 0&&(e.channel=t.texCoord),t.offset!==void 0&&e.offset.fromArray(t.offset),t.rotation!==void 0&&(e.rotation=t.rotation),t.scale!==void 0&&e.repeat.fromArray(t.scale),e.needsUpdate=!0),e}},Tl=class{constructor(){this.name=je.KHR_MESH_QUANTIZATION}},Ao=class extends Tn{constructor(e,t,n,i){super(e,t,n,i)}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,s=e*i*3+i;for(let r=0;r!==i;r++)t[r]=n[s+r];return t}interpolate_(e,t,n,i){let s=this.resultBuffer,r=this.sampleValues,o=this.valueSize,l=o*2,c=o*3,h=i-t,d=(n-t)/h,f=d*d,b=f*d,g=e*c,y=g-c,p=-2*b+3*f,u=b-f,m=1-p,M=u-f+d;for(let x=0;x!==o;x++){let S=r[y+x+o],w=r[y+x+l]*h,T=r[g+x+o],v=r[g+x]*h;s[x]=m*S+M*w+p*T+u*v}return s}},Qg=new Jt,Rl=class extends Ao{interpolate_(e,t,n,i){let s=super.interpolate_(e,t,n,i);return Qg.fromArray(s).normalize().toArray(s),s}},on={FLOAT:5126,FLOAT_MAT3:35675,FLOAT_MAT4:35676,FLOAT_VEC2:35664,FLOAT_VEC3:35665,FLOAT_VEC4:35666,LINEAR:9729,REPEAT:10497,SAMPLER_2D:35678,POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6,UNSIGNED_BYTE:5121,UNSIGNED_SHORT:5123},Ai={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},jd={9728:bt,9729:mt,9984:Rr,9985:xi,9986:Da,9987:gn},Hd={33071:an,33648:ni,10497:oa},il={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},Il={POSITION:"position",NORMAL:"normal",TANGENT:"tangent",TEXCOORD_0:"uv",TEXCOORD_1:"uv1",TEXCOORD_2:"uv2",TEXCOORD_3:"uv3",COLOR_0:"color",WEIGHTS_0:"skinWeight",JOINTS_0:"skinIndex"},ma={scale:"scale",translation:"position",rotation:"quaternion",weights:"morphTargetInfluences"},$g={CUBICSPLINE:void 0,LINEAR:Ta,STEP:Ea},sl={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};function ex(a){return a.DefaultMaterial===void 0&&(a.DefaultMaterial=new sn({color:16777215,emissive:0,metalness:1,roughness:1,transparent:!1,depthTest:!0,side:pn})),a.DefaultMaterial}function La(a,e,t){for(let n in t.extensions)a[n]===void 0&&(e.userData.gltfExtensions=e.userData.gltfExtensions||{},e.userData.gltfExtensions[n]=t.extensions[n])}function Nn(a,e){e.extras!==void 0&&(typeof e.extras=="object"?Object.assign(a.userData,e.extras):console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, "+e.extras))}function tx(a,e,t){let n=!1,i=!1,s=!1;for(let c=0,h=e.length;c<h;c++){let d=e[c];if(d.POSITION!==void 0&&(n=!0),d.NORMAL!==void 0&&(i=!0),d.COLOR_0!==void 0&&(s=!0),n&&i&&s)break}if(!n&&!i&&!s)return Promise.resolve(a);let r=[],o=[],l=[];for(let c=0,h=e.length;c<h;c++){let d=e[c];if(n){let f=d.POSITION!==void 0?t.getDependency("accessor",d.POSITION):a.attributes.position;r.push(f)}if(i){let f=d.NORMAL!==void 0?t.getDependency("accessor",d.NORMAL):a.attributes.normal;o.push(f)}if(s){let f=d.COLOR_0!==void 0?t.getDependency("accessor",d.COLOR_0):a.attributes.color;l.push(f)}}return Promise.all([Promise.all(r),Promise.all(o),Promise.all(l)]).then(function(c){let h=c[0],d=c[1],f=c[2];return n&&(a.morphAttributes.position=h),i&&(a.morphAttributes.normal=d),s&&(a.morphAttributes.color=f),a.morphTargetsRelative=!0,a})}function nx(a,e){if(a.updateMorphTargets(),e.weights!==void 0)for(let t=0,n=e.weights.length;t<n;t++)a.morphTargetInfluences[t]=e.weights[t];if(e.extras&&Array.isArray(e.extras.targetNames)){let t=e.extras.targetNames;if(a.morphTargetInfluences.length===t.length){a.morphTargetDictionary={};for(let n=0,i=t.length;n<i;n++)a.morphTargetDictionary[t[n]]=n}else console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.")}}function ax(a){let e,t=a.extensions&&a.extensions[je.KHR_DRACO_MESH_COMPRESSION];if(t?e="draco:"+t.bufferView+":"+t.indices+":"+rl(t.attributes):e=a.indices+":"+rl(a.attributes)+":"+a.mode,a.targets!==void 0)for(let n=0,i=a.targets.length;n<i;n++)e+=":"+rl(a.targets[n]);return e}function rl(a){let e="",t=Object.keys(a).sort();for(let n=0,i=t.length;n<i;n++)e+=t[n]+":"+a[t[n]]+";";return e}function Cl(a){switch(a){case Int8Array:return 1/127;case Uint8Array:return 1/255;case Int16Array:return 1/32767;case Uint16Array:return 1/65535;default:throw new Error("THREE.GLTFLoader: Unsupported normalized accessor component type.")}}function ix(a){return a.search(/\.jpe?g($|\?)/i)>0||a.search(/^data\:image\/jpeg/)===0?"image/jpeg":a.search(/\.webp($|\?)/i)>0||a.search(/^data\:image\/webp/)===0?"image/webp":a.search(/\.ktx2($|\?)/i)>0||a.search(/^data\:image\/ktx2/)===0?"image/ktx2":"image/png"}var sx=new Ue,kl=class{constructor(e={},t={}){this.json=e,this.extensions={},this.plugins={},this.options=t,this.cache=new Zg,this.associations=new Map,this.primitiveCache={},this.nodeCache={},this.meshCache={refs:{},uses:{}},this.cameraCache={refs:{},uses:{}},this.lightCache={refs:{},uses:{}},this.sourceCache={},this.textureCache={},this.nodeNamesUsed={};let n=!1,i=-1,s=!1,r=-1;if(typeof navigator<"u"&&typeof navigator.userAgent<"u"){let o=navigator.userAgent;n=/^((?!chrome|android).)*safari/i.test(o)===!0;let l=o.match(/Version\/(\d+)/);i=n&&l?parseInt(l[1],10):-1,s=o.indexOf("Firefox")>-1,r=s?o.match(/Firefox\/([0-9]+)\./)[1]:-1}typeof createImageBitmap>"u"||n&&i<17||s&&r<98?this.textureLoader=new ts(this.options.manager):this.textureLoader=new os(this.options.manager),this.textureLoader.setCrossOrigin(this.options.crossOrigin),this.textureLoader.setRequestHeader(this.options.requestHeader),this.fileLoader=new mi(this.options.manager),this.fileLoader.setResponseType("arraybuffer"),this.options.crossOrigin==="use-credentials"&&this.fileLoader.setWithCredentials(!0)}setExtensions(e){this.extensions=e}setPlugins(e){this.plugins=e}parse(e,t){let n=this,i=this.json,s=this.extensions;this.cache.removeAll(),this.nodeCache={},this._invokeAll(function(r){return r._markDefs&&r._markDefs()}),Promise.all(this._invokeAll(function(r){return r.beforeRoot&&r.beforeRoot()})).then(function(){return Promise.all([n.getDependencies("scene"),n.getDependencies("animation"),n.getDependencies("camera")])}).then(function(r){let o={scene:r[0][i.scene||0],scenes:r[0],animations:r[1],cameras:r[2],asset:i.asset,parser:n,userData:{}};return La(s,o,i),Nn(o,i),Promise.all(n._invokeAll(function(l){return l.afterRoot&&l.afterRoot(o)})).then(function(){for(let l of o.scenes)l.updateMatrixWorld();e(o)})}).catch(t)}_markDefs(){let e=this.json.nodes||[],t=this.json.skins||[],n=this.json.meshes||[];for(let i=0,s=t.length;i<s;i++){let r=t[i].joints;for(let o=0,l=r.length;o<l;o++)e[r[o]].isBone=!0}for(let i=0,s=e.length;i<s;i++){let r=e[i];r.mesh!==void 0&&(this._addNodeRef(this.meshCache,r.mesh),r.skin!==void 0&&(n[r.mesh].isSkinnedMesh=!0)),r.camera!==void 0&&this._addNodeRef(this.cameraCache,r.camera)}}_addNodeRef(e,t){t!==void 0&&(e.refs[t]===void 0&&(e.refs[t]=e.uses[t]=0),e.refs[t]++)}_getNodeRef(e,t,n){if(e.refs[t]<=1)return n;let i=n.clone(),s=(r,o)=>{let l=this.associations.get(r);l!=null&&this.associations.set(o,l);for(let[c,h]of r.children.entries())s(h,o.children[c])};return s(n,i),i.name+="_instance_"+e.uses[t]++,i}_invokeOne(e){let t=Object.values(this.plugins);t.push(this);for(let n=0;n<t.length;n++){let i=e(t[n]);if(i)return i}return null}_invokeAll(e){let t=Object.values(this.plugins);t.unshift(this);let n=[];for(let i=0;i<t.length;i++){let s=e(t[i]);s&&n.push(s)}return n}getDependency(e,t){let n=e+":"+t,i=this.cache.get(n);if(!i){switch(e){case"scene":i=this.loadScene(t);break;case"node":i=this._invokeOne(function(s){return s.loadNode&&s.loadNode(t)});break;case"mesh":i=this._invokeOne(function(s){return s.loadMesh&&s.loadMesh(t)});break;case"accessor":i=this.loadAccessor(t);break;case"bufferView":i=this._invokeOne(function(s){return s.loadBufferView&&s.loadBufferView(t)});break;case"buffer":i=this.loadBuffer(t);break;case"material":i=this._invokeOne(function(s){return s.loadMaterial&&s.loadMaterial(t)});break;case"texture":i=this._invokeOne(function(s){return s.loadTexture&&s.loadTexture(t)});break;case"skin":i=this.loadSkin(t);break;case"animation":i=this._invokeOne(function(s){return s.loadAnimation&&s.loadAnimation(t)});break;case"camera":i=this.loadCamera(t);break;default:if(i=this._invokeOne(function(s){return s!=this&&s.getDependency&&s.getDependency(e,t)}),!i)throw new Error("Unknown type: "+e);break}this.cache.add(n,i)}return i}getDependencies(e){let t=this.cache.get(e);if(!t){let n=this,i=this.json[e+(e==="mesh"?"es":"s")]||[];t=Promise.all(i.map(function(s,r){return n.getDependency(e,r)})),this.cache.add(e,t)}return t}loadBuffer(e){let t=this.json.buffers[e],n=this.fileLoader;if(t.type&&t.type!=="arraybuffer")throw new Error("THREE.GLTFLoader: "+t.type+" buffer type is not supported.");if(t.uri===void 0&&e===0)return Promise.resolve(this.extensions[je.KHR_BINARY_GLTF].body);let i=this.options;return new Promise(function(s,r){n.load(qn.resolveURL(t.uri,i.path),s,void 0,function(){r(new Error('THREE.GLTFLoader: Failed to load buffer "'+t.uri+'".'))})})}loadBufferView(e){let t=this.json.bufferViews[e];return this.getDependency("buffer",t.buffer).then(function(n){let i=t.byteLength||0,s=t.byteOffset||0;return n.slice(s,s+i)})}loadAccessor(e){let t=this,n=this.json,i=this.json.accessors[e];if(i.bufferView===void 0&&i.sparse===void 0){let r=il[i.type],o=Ai[i.componentType],l=i.normalized===!0,c=new o(i.count*r);return Promise.resolve(new Mt(c,r,l))}let s=[];return i.bufferView!==void 0?s.push(this.getDependency("bufferView",i.bufferView)):s.push(null),i.sparse!==void 0&&(s.push(this.getDependency("bufferView",i.sparse.indices.bufferView)),s.push(this.getDependency("bufferView",i.sparse.values.bufferView))),Promise.all(s).then(function(r){let o=r[0],l=il[i.type],c=Ai[i.componentType],h=c.BYTES_PER_ELEMENT,d=h*l,f=i.byteOffset||0,b=i.bufferView!==void 0?n.bufferViews[i.bufferView].byteStride:void 0,g=i.normalized===!0,y,p;if(b&&b!==d){let u=Math.floor(f/b),m="InterleavedBuffer:"+i.bufferView+":"+i.componentType+":"+u+":"+i.count,M=t.cache.get(m);M||(y=new c(o,u*b,i.count*b/h),M=new ci(y,b/h),t.cache.add(m,M)),p=new li(M,l,f%b/h,g)}else o===null?y=new c(i.count*l):y=new c(o,f,i.count*l),p=new Mt(y,l,g);if(i.sparse!==void 0){let u=il.SCALAR,m=Ai[i.sparse.indices.componentType],M=i.sparse.indices.byteOffset||0,x=i.sparse.values.byteOffset||0,S=new m(r[1],M,i.sparse.count*u),w=new c(r[2],x,i.sparse.count*l);o!==null&&(p=new Mt(p.array.slice(),p.itemSize,p.normalized)),p.normalized=!1;for(let T=0,v=S.length;T<v;T++){let E=S[T];if(p.setX(E,w[T*l]),l>=2&&p.setY(E,w[T*l+1]),l>=3&&p.setZ(E,w[T*l+2]),l>=4&&p.setW(E,w[T*l+3]),l>=5)throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.")}p.normalized=g}return p})}loadTexture(e){let t=this.json,n=this.options,s=t.textures[e].source,r=t.images[s],o=this.textureLoader;if(r.uri){let l=n.manager.getHandler(r.uri);l!==null&&(o=l)}return this.loadTextureImage(e,s,o)}loadTextureImage(e,t,n){let i=this,s=this.json,r=s.textures[e],o=s.images[t],l=(o.uri||o.bufferView)+":"+r.sampler;if(this.textureCache[l])return this.textureCache[l];let c=this.loadImageSource(t,n).then(function(h){h.flipY=!1,h.name=r.name||o.name||"",h.name===""&&typeof o.uri=="string"&&o.uri.startsWith("data:image/")===!1&&(h.name=o.uri);let f=(s.samplers||{})[r.sampler]||{};return h.magFilter=jd[f.magFilter]||mt,h.minFilter=jd[f.minFilter]||gn,h.wrapS=Hd[f.wrapS]||oa,h.wrapT=Hd[f.wrapT]||oa,h.generateMipmaps=!h.isCompressedTexture&&h.minFilter!==bt&&h.minFilter!==mt,i.associations.set(h,{textures:e}),h}).catch(function(){return null});return this.textureCache[l]=c,c}loadImageSource(e,t){let n=this,i=this.json,s=this.options;if(this.sourceCache[e]!==void 0)return this.sourceCache[e].then(d=>d.clone());let r=i.images[e],o=self.URL||self.webkitURL,l=r.uri||"",c=!1;if(r.bufferView!==void 0)l=n.getDependency("bufferView",r.bufferView).then(function(d){c=!0;let f=new Blob([d],{type:r.mimeType});return l=o.createObjectURL(f),l});else if(r.uri===void 0)throw new Error("THREE.GLTFLoader: Image "+e+" is missing URI and bufferView");let h=Promise.resolve(l).then(function(d){return new Promise(function(f,b){let g=f;t.isImageBitmapLoader===!0&&(g=function(y){let p=new It(y);p.needsUpdate=!0,f(p)}),t.load(qn.resolveURL(d,s.path),g,void 0,b)})}).then(function(d){return c===!0&&o.revokeObjectURL(l),Nn(d,r),d.userData.mimeType=r.mimeType||ix(r.uri),d}).catch(function(d){throw console.error("THREE.GLTFLoader: Couldn't load texture",l),d});return this.sourceCache[e]=h,h}assignTexture(e,t,n,i){let s=this;return this.getDependency("texture",n.index).then(function(r){if(!r)return null;if(n.texCoord!==void 0&&n.texCoord>0&&(r=r.clone(),r.channel=n.texCoord),s.extensions[je.KHR_TEXTURE_TRANSFORM]){let o=n.extensions!==void 0?n.extensions[je.KHR_TEXTURE_TRANSFORM]:void 0;if(o){let l=s.associations.get(r);r=s.extensions[je.KHR_TEXTURE_TRANSFORM].extendTexture(r,o),s.associations.set(r,l)}}return i!==void 0&&(r.colorSpace=i),e[t]=r,r})}assignFinalMaterial(e){let t=e.geometry,n=e.material,i=t.attributes.tangent===void 0,s=t.attributes.color!==void 0,r=t.attributes.normal===void 0;if(e.isPoints){let o="PointsMaterial:"+n.uuid,l=this.cache.get(o);l||(l=new pi,Ht.prototype.copy.call(l,n),l.color.copy(n.color),l.map=n.map,l.sizeAttenuation=!1,this.cache.add(o,l)),n=l}else if(e.isLine){let o="LineBasicMaterial:"+n.uuid,l=this.cache.get(o);l||(l=new ui,Ht.prototype.copy.call(l,n),l.color.copy(n.color),l.map=n.map,this.cache.add(o,l)),n=l}if(i||s||r){let o="ClonedMaterial:"+n.uuid+":";i&&(o+="derivative-tangents:"),s&&(o+="vertex-colors:"),r&&(o+="flat-shading:");let l=this.cache.get(o);l||(l=n.clone(),s&&(l.vertexColors=!0),r&&(l.flatShading=!0),i&&(l.normalScale&&(l.normalScale.y*=-1),l.clearcoatNormalScale&&(l.clearcoatNormalScale.y*=-1)),this.cache.add(o,l),this.associations.set(l,this.associations.get(n))),n=l}e.material=n}getMaterialType(){return sn}loadMaterial(e){let t=this,n=this.json,i=this.extensions,s=n.materials[e],r,o={},l=s.extensions||{},c=[];if(l[je.KHR_MATERIALS_UNLIT]){let d=i[je.KHR_MATERIALS_UNLIT];r=d.getMaterialType(),c.push(d.extendParams(o,s,t))}else{let d=s.pbrMetallicRoughness||{};if(o.color=new Re(1,1,1),o.opacity=1,Array.isArray(d.baseColorFactor)){let f=d.baseColorFactor;o.color.setRGB(f[0],f[1],f[2],Ot),o.opacity=f[3]}d.baseColorTexture!==void 0&&c.push(t.assignTexture(o,"map",d.baseColorTexture,wt)),o.metalness=d.metallicFactor!==void 0?d.metallicFactor:1,o.roughness=d.roughnessFactor!==void 0?d.roughnessFactor:1,d.metallicRoughnessTexture!==void 0&&(c.push(t.assignTexture(o,"metalnessMap",d.metallicRoughnessTexture)),c.push(t.assignTexture(o,"roughnessMap",d.metallicRoughnessTexture))),r=this._invokeOne(function(f){return f.getMaterialType&&f.getMaterialType(e)}),c.push(Promise.all(this._invokeAll(function(f){return f.extendMaterialParams&&f.extendMaterialParams(e,o)})))}s.doubleSided===!0&&(o.side=rn);let h=s.alphaMode||sl.OPAQUE;if(h===sl.BLEND?(o.transparent=!0,o.depthWrite=!1):(o.transparent=!1,h===sl.MASK&&(o.alphaTest=s.alphaCutoff!==void 0?s.alphaCutoff:.5)),s.normalTexture!==void 0&&r!==bn&&(c.push(t.assignTexture(o,"normalMap",s.normalTexture)),o.normalScale=new Le(1,1),s.normalTexture.scale!==void 0)){let d=s.normalTexture.scale;o.normalScale.set(d,d)}if(s.occlusionTexture!==void 0&&r!==bn&&(c.push(t.assignTexture(o,"aoMap",s.occlusionTexture)),s.occlusionTexture.strength!==void 0&&(o.aoMapIntensity=s.occlusionTexture.strength)),s.emissiveFactor!==void 0&&r!==bn){let d=s.emissiveFactor;o.emissive=new Re().setRGB(d[0],d[1],d[2],Ot)}return s.emissiveTexture!==void 0&&r!==bn&&c.push(t.assignTexture(o,"emissiveMap",s.emissiveTexture,wt)),Promise.all(c).then(function(){let d=new r(o);return s.name&&(d.name=s.name),Nn(d,s),t.associations.set(d,{materials:e}),s.extensions&&La(i,d,s),d})}createUniqueName(e){let t=at.sanitizeNodeName(e||"");return t in this.nodeNamesUsed?t+"_"+ ++this.nodeNamesUsed[t]:(this.nodeNamesUsed[t]=0,t)}loadGeometries(e){let t=this,n=this.extensions,i=this.primitiveCache;function s(o){return n[je.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(o,t).then(function(l){return Gd(l,o,t)})}let r=[];for(let o=0,l=e.length;o<l;o++){let c=e[o],h=ax(c),d=i[h];if(d)r.push(d.promise);else{let f;c.extensions&&c.extensions[je.KHR_DRACO_MESH_COMPRESSION]?f=s(c):f=Gd(new kt,c,t),i[h]={primitive:c,promise:f},r.push(f)}}return Promise.all(r)}loadMesh(e){let t=this,n=this.json,i=this.extensions,s=n.meshes[e],r=s.primitives,o=[];for(let l=0,c=r.length;l<c;l++){let h=r[l].material===void 0?ex(this.cache):this.getDependency("material",r[l].material);o.push(h)}return o.push(t.loadGeometries(r)),Promise.all(o).then(function(l){let c=l.slice(0,l.length-1),h=l[l.length-1],d=[];for(let b=0,g=h.length;b<g;b++){let y=h[b],p=r[b],u,m=c[b];if(p.mode===on.TRIANGLES||p.mode===on.TRIANGLE_STRIP||p.mode===on.TRIANGLE_FAN||p.mode===void 0)u=s.isSkinnedMesh===!0?new Gi(y,m):new ht(y,m),u.isSkinnedMesh===!0&&u.normalizeSkinWeights(),p.mode===on.TRIANGLE_STRIP?u.geometry=al(u.geometry,ms):p.mode===on.TRIANGLE_FAN&&(u.geometry=al(u.geometry,_i));else if(p.mode===on.LINES)u=new Xi(y,m);else if(p.mode===on.LINE_STRIP)u=new Ca(y,m);else if(p.mode===on.LINE_LOOP)u=new qi(y,m);else if(p.mode===on.POINTS)u=new Ki(y,m);else throw new Error("THREE.GLTFLoader: Primitive mode unsupported: "+p.mode);Object.keys(u.geometry.morphAttributes).length>0&&nx(u,s),u.name=t.createUniqueName(s.name||"mesh_"+e),Nn(u,s),p.extensions&&La(i,u,p),t.assignFinalMaterial(u),d.push(u)}for(let b=0,g=d.length;b<g;b++)t.associations.set(d[b],{meshes:e,primitives:b});if(d.length===1)return s.extensions&&La(i,d[0],s),d[0];let f=new Ft;s.extensions&&La(i,f,s),t.associations.set(f,{meshes:e});for(let b=0,g=d.length;b<g;b++)f.add(d[b]);return f})}loadCamera(e){let t,n=this.json.cameras[e],i=n[n.type];if(!i){console.warn("THREE.GLTFLoader: Missing camera parameters.");return}return n.type==="perspective"?t=new _t(Lc.radToDeg(i.yfov),i.aspectRatio||1,i.znear||1,i.zfar||2e6):n.type==="orthographic"&&(t=new da(-i.xmag,i.xmag,i.ymag,-i.ymag,i.znear,i.zfar)),n.name&&(t.name=this.createUniqueName(n.name)),Nn(t,n),Promise.resolve(t)}loadSkin(e){let t=this.json.skins[e],n=[];for(let i=0,s=t.joints.length;i<s;i++)n.push(this._loadNodeShallow(t.joints[i]));return t.inverseBindMatrices!==void 0?n.push(this.getDependency("accessor",t.inverseBindMatrices)):n.push(null),Promise.all(n).then(function(i){let s=i.pop(),r=i,o=[],l=[];for(let c=0,h=r.length;c<h;c++){let d=r[c];if(d){o.push(d);let f=new Ue;s!==null&&f.fromArray(s.array,c*16),l.push(f)}else console.warn('THREE.GLTFLoader: Joint "%s" could not be found.',t.joints[c])}return new Vi(o,l)})}loadAnimation(e){let t=this.json,n=this,i=t.animations[e],s=i.name?i.name:"animation_"+e,r=[],o=[],l=[],c=[],h=[];for(let d=0,f=i.channels.length;d<f;d++){let b=i.channels[d],g=i.samplers[b.sampler],y=b.target,p=y.node,u=i.parameters!==void 0?i.parameters[g.input]:g.input,m=i.parameters!==void 0?i.parameters[g.output]:g.output;y.node!==void 0&&(r.push(this.getDependency("node",p)),o.push(this.getDependency("accessor",u)),l.push(this.getDependency("accessor",m)),c.push(g),h.push(y))}return Promise.all([Promise.all(r),Promise.all(o),Promise.all(l),Promise.all(c),Promise.all(h)]).then(function(d){let f=d[0],b=d[1],g=d[2],y=d[3],p=d[4],u=[];for(let M=0,x=f.length;M<x;M++){let S=f[M],w=b[M],T=g[M],v=y[M],E=p[M];if(S===void 0)continue;S.updateMatrix&&S.updateMatrix();let C=n._createAnimationTracks(S,w,T,v,E);if(C)for(let I=0;I<C.length;I++)u.push(C[I])}let m=new es(s,void 0,u);return Nn(m,i),m})}createNodeMesh(e){let t=this.json,n=this,i=t.nodes[e];return i.mesh===void 0?null:n.getDependency("mesh",i.mesh).then(function(s){let r=n._getNodeRef(n.meshCache,i.mesh,s);return i.weights!==void 0&&r.traverse(function(o){if(o.isMesh)for(let l=0,c=i.weights.length;l<c;l++)o.morphTargetInfluences[l]=i.weights[l]}),r})}loadNode(e){let t=this.json,n=this,i=t.nodes[e],s=n._loadNodeShallow(e),r=[],o=i.children||[];for(let c=0,h=o.length;c<h;c++)r.push(n.getDependency("node",o[c]));let l=i.skin===void 0?Promise.resolve(null):n.getDependency("skin",i.skin);return Promise.all([s,Promise.all(r),l]).then(function(c){let h=c[0],d=c[1],f=c[2];f!==null&&h.traverse(function(b){b.isSkinnedMesh&&b.bind(f,sx)});for(let b=0,g=d.length;b<g;b++)h.add(d[b]);if(h.userData.pivot!==void 0&&d.length>0){let b=h.userData.pivot,g=d[0];h.pivot=new U().fromArray(b),h.position.x-=b[0],h.position.y-=b[1],h.position.z-=b[2],g.position.set(0,0,0),delete h.userData.pivot}return h})}_loadNodeShallow(e){let t=this.json,n=this.extensions,i=this;if(this.nodeCache[e]!==void 0)return this.nodeCache[e];let s=t.nodes[e],r=s.name?i.createUniqueName(s.name):"",o=[],l=i._invokeOne(function(c){return c.createNodeMesh&&c.createNodeMesh(e)});return l&&o.push(l),s.camera!==void 0&&o.push(i.getDependency("camera",s.camera).then(function(c){return i._getNodeRef(i.cameraCache,s.camera,c)})),i._invokeAll(function(c){return c.createNodeAttachment&&c.createNodeAttachment(e)}).forEach(function(c){o.push(c)}),this.nodeCache[e]=Promise.all(o).then(function(c){let h;if(s.isBone===!0?h=new hi:c.length>1?h=new Ft:c.length===1?h=c[0]:h=new rt,h!==c[0])for(let d=0,f=c.length;d<f;d++)h.add(c[d]);if(s.name&&(h.userData.name=s.name,h.name=r),Nn(h,s),s.extensions&&La(n,h,s),s.matrix!==void 0){let d=new Ue;d.fromArray(s.matrix),h.applyMatrix4(d)}else s.translation!==void 0&&h.position.fromArray(s.translation),s.rotation!==void 0&&h.quaternion.fromArray(s.rotation),s.scale!==void 0&&h.scale.fromArray(s.scale);if(!i.associations.has(h))i.associations.set(h,{});else if(s.mesh!==void 0&&i.meshCache.refs[s.mesh]>1){let d=i.associations.get(h);i.associations.set(h,{...d})}return i.associations.get(h).nodes=e,h}),this.nodeCache[e]}loadScene(e){let t=this.extensions,n=this.json.scenes[e],i=this,s=new Ft;n.name&&(s.name=i.createUniqueName(n.name)),Nn(s,n),n.extensions&&La(t,s,n);let r=n.nodes||[],o=[];for(let l=0,c=r.length;l<c;l++)o.push(i.getDependency("node",r[l]));return Promise.all(o).then(function(l){for(let h=0,d=l.length;h<d;h++){let f=l[h];f.parent!==null?s.add(Od(f)):s.add(f)}let c=h=>{let d=new Map;for(let[f,b]of i.associations)(f instanceof Ht||f instanceof It)&&d.set(f,b);return h.traverse(f=>{let b=i.associations.get(f);b!=null&&d.set(f,b)}),d};return i.associations=c(s),s})}_createAnimationTracks(e,t,n,i,s){let r=[],o=e.name?e.name:e.uuid,l=[];function c(b){b.morphTargetInfluences&&l.push(b.name?b.name:b.uuid)}ma[s.path]===ma.weights?(c(e),e.isGroup&&e.children.forEach(c)):l.push(o);let h;switch(ma[s.path]){case ma.weights:h=Vn;break;case ma.rotation:h=Wn;break;case ma.translation:case ma.scale:h=ha;break;default:n.itemSize===1?h=Vn:h=ha;break}let d=i.interpolation!==void 0?$g[i.interpolation]:Ta,f=this._getArrayFromAccessor(n);for(let b=0,g=l.length;b<g;b++){let y=new h(l[b]+"."+ma[s.path],t.array,f,d);i.interpolation==="CUBICSPLINE"&&this._createCubicSplineTrackInterpolant(y),r.push(y)}return r}_getArrayFromAccessor(e){let t=e.array;if(e.normalized){let n=Cl(t.constructor),i=new Float32Array(t.length);for(let s=0,r=t.length;s<r;s++)i[s]=t[s]*n;t=i}return t}_createCubicSplineTrackInterpolant(e){e.createInterpolant=function(n){let i=this instanceof Wn?Rl:Ao;return new i(this.times,this.values,this.getValueSize()/3,n)},e.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=!0}};function rx(a,e,t){let n=e.attributes,i=new Zt;if(n.POSITION!==void 0){let o=t.json.accessors[n.POSITION],l=o.min,c=o.max;if(l!==void 0&&c!==void 0){if(i.set(new U(l[0],l[1],l[2]),new U(c[0],c[1],c[2])),o.normalized){let h=Cl(Ai[o.componentType]);i.min.multiplyScalar(h),i.max.multiplyScalar(h)}}else{console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");return}}else return;let s=e.targets;if(s!==void 0){let o=new U,l=new U;for(let c=0,h=s.length;c<h;c++){let d=s[c];if(d.POSITION!==void 0){let f=t.json.accessors[d.POSITION],b=f.min,g=f.max;if(b!==void 0&&g!==void 0){if(l.setX(Math.max(Math.abs(b[0]),Math.abs(g[0]))),l.setY(Math.max(Math.abs(b[1]),Math.abs(g[1]))),l.setZ(Math.max(Math.abs(b[2]),Math.abs(g[2]))),f.normalized){let y=Cl(Ai[f.componentType]);l.multiplyScalar(y)}o.max(l)}else console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.")}}i.expandByVector(o)}a.boundingBox=i;let r=new jt;i.getCenter(r.center),r.radius=i.min.distanceTo(i.max)/2,a.boundingSphere=r}function Gd(a,e,t){let n=e.attributes,i=[];function s(r,o){return t.getDependency("accessor",r).then(function(l){a.setAttribute(o,l)})}for(let r in n){let o=Il[r]||r.toLowerCase();o in a.attributes||i.push(s(n[r],o))}if(e.indices!==void 0&&!a.index){let r=t.getDependency("accessor",e.indices).then(function(o){a.setIndex(o)});i.push(r)}return ze.workingColorSpace!==Ot&&"COLOR_0"in n&&console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${ze.workingColorSpace}" not supported.`),Nn(a,e),rx(a,e,t),Promise.all(i).then(function(){return e.targets!==void 0?tx(a,e.targets,t):a})}var Mv=(function(){var a="b9H79Tebbbe9ok9Geueu9Geub9Gbb9Gruuuuuuueu9Gvuuuuueu9Gduueu9Gluuuueu9Gvuuuuub9Gouuuuuub9Gluuuub9GiuuueuiE8AdilveoveovrrwrrrDDoDrbqqbelve9Weiiviebeoweuecj:Gdkr:PlCo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8F9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949c919M9MWV9mW4W2be8A9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949c919M9MWVbd8F9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949c919M9MWV9c9V919U9KbiE9TW79O9V9Wt9FW9U9J9V9KW9wWVtW949wWV79P9V9UblY9TW79O9V9Wt9FW9U9J9V9KW69U9KW949c919M9MWVbv8E9TW79O9V9Wt9FW9U9J9V9KW69U9KW949c919M9MWV9c9V919U9Kbo8A9TW79O9V9Wt9FW9U9J9V9KW69U9KW949wWV79P9V9UbrE9TW79O9V9Wt9FW9U9J9V9KW69U9KW949tWG91W9U9JWbwa9TW79O9V9Wt9FW9U9J9V9KW69U9KW949tWG91W9U9JW9c9V919U9KbDL9TW79O9V9Wt9FW9U9J9V9KWS9P2tWV9p9JtbqK9TW79O9V9Wt9FW9U9J9V9KWS9P2tWV9r919HtbkL9TW79O9V9Wt9FW9U9J9V9KWS9P2tWVT949WbxY9TW79O9V9Wt9FW9U9J9V9KWS9P2tWVJ9V29VVbmE9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94J9H9J9OWbza9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94J9H9J9OW9ttV9P9WbHa9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94SWt9J9O9sW9T9H9WbOK9TW79O9V9Wt9F79W9Ht9P9H29t9VVt9sW9T9H9WbAl79IV9RbXDwebcekdKYq:zf8Adbk;wadhud9:8Jjjjjbc;qw9Rgr8KjjjjbcbhwdnaeTmbabcbyd;i:I:cjbaoaocb9iEgDc:GeV86bbarc;adfcbcjdz:xjjjb8AdnaiTmbarc;adfadalz:wjjjb8Akarc;abfalfcbcbcjdal9RalcFe0Ez:xjjjb8Aarc;abfarc;adfalz:wjjjb8Aar9cb83iUar9cb83i8War9cb83iyar9cb83iaar9cb83iKar9cb83izar9cb83iwar9cb83ibcj;abal9Uc;WFbGcjdalca0Ehqdnaicd6mbavcd9imbaDTmbadcefhkaqci2gxal2hmarc;alfclfhParc;qlfceVhsarc;qofclVhzcbhHincdhOcbhAdnavci6mbar9cb83i;Ooar9cb83i;Goar9cb83i;yoar9cb83i;qoadaHfgoybbhCcbhXincbhwcbhQdninaoalfhLaoybbgKaC7aQVhQawcP0meaLhoaKhCawcefgwaXfai6mbkkcbhCarc;qofhwincwhYcwh8AdnaQaC93gocFeGgEcs0mbclh8AaEci0mbcdcbaEEh8Akdnaocw4cFeGgEcs0mbclhYaEci0mbcdcbaEEhYkaYa8AfhEawydbh3cwhYcwh8Adnaocz4cFeGg5cs0mbclh8Aa5ci0mbcdcba5Eh8AkaEa3fhEdnaocFFFFb0mbclhYaocFFF8F0mbcbcdaocjjjw6EhYkawaEa8AfaYfBdbawclfhwaCcefgCcw9hmbkaLhoaKhCaXczfgXai6mbkcbhocehwazhQinawaoaQydbarc;qofaocdtfydb6EhoaQclfhQawcefgwcw9hmbkaoclthAcihOkcbhEarc;qlfcbcjdz:xjjjb8AarcbBd;ilar9cb83i;aladh8Eaqh8Fakh3inarc;qlfadaEaEcb9h9Ral2falz:wjjjb8Aaia8Faia8F6EhadnaqaiaE9RaEaqfai6EgKcsfc9WGgoaK9nmbarc;qofaKfcbaoaK9Rz:xjjjb8AkadaEal2fhhcbhginagaAVcl4hXarc;alfagcdtfh8JaHh8Kcbh8Lina8LaHfhwdndndndndndndnagPlbedibkaKTmvahawfhoarc;qlfawfRbbhQarc;qofhwaahCinawaoRbbgYaQ9RgQcetaQcKtc8F91786bbawcefhwaoalfhoaYhQaEaCcufgC9hmbxvkkaKTmla8Kc9:Ghoa8LcitcwGh8Aarc;qlfawceVfRbbcwtarc;qlfawc9:GfRbbVhQarc;qofhwaahCinawa3aofRbbcwta8EaofRbbVgYaQ9RgQcetaQcztc8F917cFFiGa8A486bbaoalfhoawcefhwaYhQaEaCcufgC9hmbxlkkasa8Kc98GgQfhoa3aQfhYarc;qlfawc98GgQfRbbhCcwhwinaoRbbawtaCVhCaocefhoawcwfgwca9hmbxdkkaKTmdxekaKTmea8Lcith5ahaQfh8AcbhLina8ARbbhQcwhoaYhwinawRbbaotaQVhQawcefhwaocwfgoca9hmbkarc;qofaLfaQaC7aX93a5486bbaYalfhYa8Aalfh8AaQhCaLcefgLaK9hmbkka8Jydbh8AcbhLarc;qofhoincdhQcbhwinaQaoawfRbbcb9hfhQawcefgwcz9hmbkclhCcbhwinaCaoawfRbbcd0fhCawcefgwcz9hmbkcwhYcbhwinaYaoawfRbbcP0fhYawcefgwcz9hmbkaQaCaQaC6EgwaYawaY6Egwczawcz6Ea8Afh8AaoczfhoaLczfgLaK6mbka8Ja8ABdbka8Kcefh8Ka8Lcefg8Lcl9hmbkagcefggaO9hmbka8Eamfh8Ea8Faxfh8Fa3amfh3aEaxfgEai6mbkcbhocehwaPhQinawaoaQydbarc;alfaocdtfydb6EhoaQclfhQaOawcefgw9hmbkaraHcd4faAcdVaoaocdSE86bbaHclfgHal6mbkkabaefhgabcefhoalcd4g8McbaDEhkadcefh8Narc;abfceVhecbhmdndninaiam9nmearc;qofcbcjdz:xjjjb8Aagao9Rak6mdadamal2gwfhxcbhHa8Nawfhzaocbakz:xjjjbg8Fakfh3aqaiam9Ramaqfai6Egscsfgocl4cifcd4hOaoc9WGg8JThPindndndndndndndndndndnaDTmbaraHcd4fRbbgQciGPlbedlbkasTmdaxaHfhoarc;abfaHfRbbhQarc;qofhwashCinawaoRbbgYaQ9RgQcetaQcKtc8F91786bbawcefhwaoalfhoaYhQaCcufgCmbxikkasTmiaHcitcwGh8Aarc;abfaHceVfRbbcwtarc;abfaHc9:GgofRbbVhQaxaofhoarc;qofhwashCinawao8VbbgYaQ9RgQcetaQcztc8F917cFFiGa8A486bbawcefhwaoalfhoaYhQaCcufgCmbxikkaeaHc98Gg8Afhoaza8AfhYarc;abfa8AfRbbhCcwhwinaoRbbawtaCVhCaocefhoawcwfgwca9hmbkasTmdaQcl4hKaHcitcKGhEaxa8Afh8AcbhLina8ARbbhQcwhoaYhwinawRbbaotaQVhQawcefhwaocwfgoca9hmbkarc;qofaLfaQaC7aK93aE486bbaYalfhYa8Aalfh8AaQhCaLcefgLas9hmbkkaDmbcbhoxlka8JTmbcbhodninarc;qofaofgwcwf8Pibaw8Pib:e9qTmeaoczfgoa8J9pmdxbkkdnavmbcehoxikcbh8AaOhLaOhKinarc;qofa8Afgocwf8Pibhyao8Pibh8PcdhQcbhwinaQaoawfRbbcb9hfhQawcefgwcz9hmbkclhCcbhwinaCaoawfRbbcd0fhCawcefgwcz9hmbkcwhYcbhwinaYaoawfRbbcP0fhYawcefgwcz9hmbkaQaCaQaC6EgoaYaoaY6Egoczaocz6EaKfhKaocucbaya8P:e9cb9sEgwaoaw6EaLfhLa8Aczfg8Aa8J9pmdxbkka8FaHcd4fgoaoRbbcdaHcetcoGtV86bbxikdnaLas6mbaKas6mba8FaHcd4fgoaoRbbciaHcetcoGtV86bbaga39Ras6mra3arc;qofasz:wjjjbasfh3xikaLaK9phoka8FaHcd4fgwawRbbaoaHcetcoGtV86bbkaga39RaO6mla3cbaOz:xjjjbgaaOfhKdndna8JmbaPhoxekdnagaK9RcK9pmbaPhoxekaocdtc:q:G:cjbfcj:G:cjbaDEg3ydxghcetc;:FFFeGhAcuhEcuahtcu7cFeGh8Ecbh8Karc;qofhQinarc;qofa8KfhXczh8AdndndnahPDbeeeeeeedekcucbaXcwf8PibaX8Pib:e9cb9sEh8AxekcbhoaAh8Aina8Aa8EaQaofRbb9nfh8Aaocefgocz9hmbkkcih5cbhYinczhwdndndna3aYcdtfydbgLPDbeeeeeeedekcucbaXcwf8PibaX8Pib:e9cb9sEhwxekaLcetc;:FFFeGhwcuaLtcu7cFeGhCcbhoinawaCaQaofRbb9nfhwaocefgocz9hmbkkdndnawa8A6mbaLaE9hmeawa8A9hmea3a5cdtfydbcwSmekaYh5awh8AkaYcefgYci9hmbkaaa8Kco4fgoaoRbba5a8Kci4coGtV86bbdndndna3a5cdtfydbgEPDdbbbbbbbebkdncwaE9Tg5TmbcuaEtcu7hwdndnaEceSmbcbh8LaQhXinaXhoa5hYcbhCinaoRbbg8AawcFeGgLa8AaL6EaCaEtVhCaocefhoaYcufgYmbkaKaC86bbaXa5fhXaKcefhKa8La5fg8Lcz6mbxdkkcbh8LaQhXinaXhoa5hYcbhCinaoRbbg8AawcFeGgLa8AaL6EaCcetVhCaocefhoaYcufgYmbkaKaC:T9cFe:d9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:9ca188bbaXa5fhXaKcefhKa8La5fg8Lcz6mbkkcbhoinaKaQaofRbbgC86bbaKaCawcFeG9pfhKaocefgocz9hmbxikkdnaEceSmbinaKcb86bbaKcefhKxbkkinaKcb86bbaKcefhKxbkkaKaX8Pbw83bwaKaX8Pbb83bbaKczfhKka8Kczfg8Ka8J9pgomeaQczfhQagaK9RcK9pmbkkaoTmlaKh3aKTmlkaHcefgHal9hmbkarc;abfaxascufal2falz:wjjjb8Aasamfhma3hoa3mbkcbhwxdkdnagao9RakalfgwcKcaaDEgQawaQ0EgC9pmbcbhwxdkdnawaQ9pmbaocbaCaw9Rgwz:xjjjbawfhokaoarc;adfalz:wjjjbalfhodnaDTmbaoara8Mz:wjjjba8Mfhokaoab9Rhwxekcbhwkarc;qwf8Kjjjjbawk5babaeadaialcdcbyd;i:I:cjbz:bjjjbk9reduaecd4gdaefgicaaica0Eabcj;abae9Uc;WFbGcjdaeca0Egifcufai9Uae2aiadfaicl4cifcd4f2fcefkmbcbabBd;i:I:cjbk;HPeLu8Jjjjjbc;ae9Rgl8Kjjjjbcbhvdnaeaici9UgocHf6mbabcbyd;m:I:cjbgrc;GeV86bbalc;abfcFecjez:xjjjb8Aal9cu83iUal9cu83i8Wal9cu83iyal9cu83iaal9cu83iKal9cu83izal9cu83iwal9cu83ibabaefc9WfhwabcefgDaofhednaiTmbcmcsarcb9kgqEhkcbhxcbhmcbhPcbhscbhzindnaeaw9nmbcbhvxikazcufhvadaPcdtfgHydbhOaHcwfydbhAaHclfydbhCcbhXdndndninalc;abfavcsGcitfgoydlhQdndndnaoydbgoaO9hmbaQaCSmekdnaoaC9hmbaQaA9hmbaXcefhXxekaoaA9hmeaQaO9hmeaXcdfhXkaXc870mdascufhvaHaXcdtgAcxGgoyd:4:G:cjbcdtfydbhQaHaoyd:0:G:cjbcdtfydbhCaHaoyd:W:G:cjbcdtfydbhOcbhodnindnalavcsGcdtfydbaQ9hmbaohXxdkcuhXavcufhvaocefgocz9hmbkkaxaQaxSgvaXce9iaXak9oVgoGfhxdndndncbcsavEaXaoEgvcs9hmbarce9imbaQaQamaQcefamSgvEgmcefSmecmcsavEhvkaDavaAc;WeGV86bbavcs9hmeaQam9Rgvcetavc8F917hvinaecbcjeavcje6EavcFbGV86bbaecefheavcr4gvmbkaQhmxvkcPhvaDaAcPV86bbaQhmkavTmiavak9omicdhocehXazhAxlkavcufhvaXclfgXc;ab9hmbkkdnaHcecdcbaAaxSEaCaxSEcdtgvyd:W:G:cjbcdtfydbgOTaHavyd:0:G:cjbcdtfydbgCceSGaHavyd:4:G:cjbcdtfydbgQcdSGaxcb9hGaqGgLce9hmbal9cu83iUal9cu83i8Wal9cu83iyal9cu83iaal9cu83iKal9cu83izal9cu83iwal9cu83ibcbhxkcbhXascufgvhodnindnalaocsGcdtfydbaC9hmbaXhAxdkcuhAaocufhoaXcefgXcz9hmbkkcbhodnindnalavcsGcdtfydbaQ9hmbaohXxdkcuhXavcufhvaocefgocz9hmbkkaxaOaxSgKfhHdndnaAcm0mbaAcefhAxekcbcsaCaHSgvEhAaHavfhHkdndnaXcm0mbaXcefhXxekcbcsaQaHSgvEhXaHavfhHkc9:cuaKEhYcbhvaXaAcltVg8AcFeGhodndndninavc;q:G:cjbfRbbaoSmeavcefgvcz9hmbxdkkaLaOax9havcm0VVmbaDavc;WeV86bbxekaDaY86bbaea8A86bbaecefhekdnaKmbaOam9Rgvcetavc8F917hvinaecbcjeavcje6EavcFbGV86bbaecefheavcr4gvmbkaOhmkdnaAcs9hmbaCam9Rgvcetavc8F917hvinaecbcjeavcje6EavcFbGV86bbaecefheavcr4gvmbkaChmkdnaXcs9hmbaQam9Rgvcetavc8F917hvinaecbcjeavcje6EavcFbGV86bbaecefheavcr4gvmbkaQhmkalascdtfaOBdbascefcsGhvdndnaAPzbeeeeeeeeeeeeeebekalavcdtfaCBdbascdfcsGhvkdndnaXPzbeeeeeeeeeeeeeebekalavcdtfaQBdbavcefcsGhvkcihoalc;abfazcitfgXaOBdlaXaCBdbazcefcsGhAcdhXavhsaHhxxekcdhoalascdtfaQBdbcehXascefcsGhsazhAkalc;abfaAcitfgvaCBdlavaQBdbalc;abfazaXfcsGcitfgvaQBdlavaOBdbaDcefhDazaofcsGhzaPcifgPai6mbkkdnaeaw9nmbcbhvxekcbhvinaeavfavc;q:G:cjbfRbb86bbavcefgvcz9hmbkaeab9Ravfhvkalc;aef8KjjjjbavkZeeucbhddninadcefgdc8F0meaeceadt0mbkkadcrfcFeGcr9Uci2cdfabci9U2cHfkmbcbabBd;m:I:cjbk:zderu8Jjjjjbcz9Rhlcbhvdnaeaicvf6mbabcbRb;m:I:cjbc;qeV86bbal9cb83iwabcefhvabaefc98fhodnaiTmbcbhecbhrcbhwindnavao6mbcbskadawcdtfydbgDalcwfaraDae9Rgeaec8F91ge7ae9Rc507grcdtfgqydb9Rgec8E91c9:Gaecdt7arVheinavcbcjeaecje6EaecFbGV86bbavcefhvaecr4gembkaqaDBdbaDheawcefgwai9hmbkkdnavao9nmbcbskavcbBbbavab9RclfhvkavkBeeucbhddninadcefgdc8F0meaeceadt0mbkkabadcwfcFeGcr9U2cvfk:dvli99dui99ludnaeTmbcuadcetcuftcu7:Zhvdndncuaicuftcu7:ZgoJbbbZMgr:lJbbb9p9DTmbar:Ohwxekcjjjj94hwkcbhicbhDinalclfIdbgrJbbbbJbbjZalIdbgq:lar:lMalcwfIdbgk:lMgr:varJbbbb9BEgrNhxaqarNhralcxfIdbhqdndnakJbbbb9GTmbaxhkxekJbbjZar:l:tgkak:maxJbbbb9GEhkJbbjZax:l:tgxax:marJbbbb9GEhrkdndnaqJbbj:;aqJbbj:;9GEgxJbbjZaxJbbjZ9FEavNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohmxekcjjjj94hmkdndnakJbbj:;akJbbj:;9GEgqJbbjZaqJbbjZ9FEaoNJbbbZJbbb:;akJbbbb9GEMgq:lJbbb9p9DTmbaq:OhPxekcjjjj94hPkdndnarJbbj:;arJbbj:;9GEgqJbbjZaqJbbjZ9FEaoNJbbbZJbbb:;arJbbbb9GEMgr:lJbbb9p9DTmbar:Ohsxekcjjjj94hskdndnadcl9hmbabaDfgzas86bbazcifam86bbazcdfaw86bbazcefaP86bbxekabaifgzas87ebazcofam87ebazclfaw87ebazcdfaP87ebkaicwfhiaDclfhDalczfhlaecufgembkkk;hlld99eud99eudnaeTmbdndncuaicuftcu7:ZgvJbbbZMgo:lJbbb9p9DTmbao:Ohixekcjjjj94hikaic;8FiGhrinabcofcicdalclfIdb:lalIdb:l9EgialcwfIdb:lalaicdtfIdb:l9EEgialcxfIdb:lalaicdtfIdb:l9EEgiarV87ebdndnJbbj:;JbbjZalaicdtfIdbJbbbb9DEgoalaicd7cdtfIdbJ;Zl:1ZNNgwJbbj:;awJbbj:;9GEgDJbbjZaDJbbjZ9FEavNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohqxekcjjjj94hqkabcdfaq87ebdndnalaicefciGcdtfIdbJ;Zl:1ZNaoNgwJbbj:;awJbbj:;9GEgDJbbjZaDJbbjZ9FEavNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohqxekcjjjj94hqkabaq87ebdndnaoalaicufciGcdtfIdbJ;Zl:1ZNNgoJbbj:;aoJbbj:;9GEgwJbbjZawJbbjZ9FEavNJbbbZJbbb:;aoJbbbb9GEMgo:lJbbb9p9DTmbao:Ohixekcjjjj94hikabclfai87ebabcwfhbalczfhlaecufgembkkk;gvdDue998Jjjjjbcjd9Rgo8Kjjjjbdndndnadcd4grTmbc:CucbavEhwaohdarhDinadawBdbadclfhdaDcufgDmbkavcd9hmbaeTmbarcdthqcbhkalhxinaohdaxhDarhwinadadydbgmaDydbcL4cFeGc:cufgPamaP9kEBdbaDclfhDadclfhdawcufgwmbkaxaqfhxakcefgkae9hmbxdkkaeTmekarcdthxavce9hhqcbhkindndndnaqmbarTmdc:CuhDalhdarhwinaDadydbcL4cFeGc:cufgmaDam9kEhDadclfhdawcufgwmbxdkkdndndndnavPleddbdkarTmlaohdalhDarhwinadcbaDydbcL4cFeGgmc:cufgPaPam0EBdbadclfhdaDclfhDawcufgwmbxikkarTmicbhdarhDindnaladfIdbgsJbbbb9Bmbaoadfas:8cL4cFeGgwc8Aawc8A0Ec:cufBdbkadclfhdaDcufgDmbxdkkarTmdkc:CuhDkcbhdarhminaDhwdnavceSmbaoadfydbhwkdndnaladfIdbgscjjj;8iawai9RcefgwcLt9R::NJbbbZJbbb:;asJbbbb9GEMgs:lJbbb9p9DTmbas:OhPxekcjjjj94hPkabadfaPcFFFrGawcKtVBdbadclfhdamcufgmmbkkabaxfhbalaxfhlakcefgkae9hmbkkaocjdf8Kjjjjbk:Olveue99iue99iudnaeTmbceaicufthvcuaitcu7:Zhocbhradcl9hhwcbhDindndnalcwfIdbgqJbbbbaqJbbbb9GEgqJbbjZaqJbbjZ9FEaoNJbbbZMgq:lJbbb9p9DTmbaq:Ohixekcjjjj94hikdndnalIdbgqJbbbbaqJbbbb9GEgqJbbjZaqJbbjZ9FEaoNJbbbZMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkadai9Rcd9TgkaifhidndnalclfIdbgqJbbbbaqJbbbb9GEgqJbbjZaqJbbjZ9FEaoNJbbbZMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkadai9Rcd9ThddndnalcxfIdbgqJbbbbaqJbbbb9GEgqJbbjZaqJbbjZ9FEaoNJbbbZMgq:lJbbb9p9DTmbaq:Ohxxekcjjjj94hxkadaifhiaxce91avVhxdndnawmbabaDfgmai86bbamcifax86bbamcdfad86bbamcefak86bbxekabarfgmai87ebamcofax87ebamclfad87ebamcdfak87ebkarcwfhraDclfhDalczfhlaecufgembkkk;mqdQui998Jjjjjbc:qd9Rgv8Kjjjjbavc:Sefcbc;Kbz:xjjjb8AdnadTmbaiTmbdndnabaeSmbaehoxekavcuadcdtgradcFFFFi0Ecbyd;q:I:cjbHjjjjbbgoBd:SeavceBd:mdaoaearz:wjjjb8AkavcbBd:Oeav9cb83i:Geavc:Gefaoadaiavc:Sefz:pjjjbavyd:Gehwadci9UgDcbyd;q:I:cjbHjjjjbbheavc:Sefavyd:mdgqcdtfaeBdbavaqcefgrBd:mdaecbaDz:xjjjbhkavc:SefarcdtfcuaicdtaicFFFFi0Ecbyd;q:I:cjbHjjjjbbgxBdbavaqcdfgmBd:mdalc;ebfhPawheaxhrinaralIdbaPaeydbgscwascw6EcdtfIdbMUdbaeclfhearclfhraicufgimbkavc:SefamcdtfcuaDcdtadcFFFF970Ecbyd;q:I:cjbHjjjjbbgmBdbdnadci6mbaoheamhraDhiinaraxaeydbcdtfIdbaxaeclfydbcdtfIdbMaxaecwfydbcdtfIdbMUdbaecxfhearclfhraicufgimbkkaqcifhzalc;ebfhHavc;qbfhOavheavyd:KehAavyd:OehCcbhscbhrcbhXcehQinaehLaoarcx2fgKydbhPaKclfydbhdabaXcx2fgecwfaKcwfydbgYBdbaeclfadBdbaeaPBdbakarfce86bbaOaYBdwaOadBdlaOaPBdbamarcdtfcbBdbcih8AdnasTmbaLhiinaOa8AcdtfaiydbgeBdba8AaeaY9haeaP9haead9hGGfh8AaiclfhiascufgsmbkkaXcefhXcbhsinaCaAaKascdtfydbcdtgifydbcdtfgYheawaifgdydbgPhidnaPTmbdninaeydbarSmeaeclfheaicufgiTmdxbkkaeaYaPcdtfc98fydbBdbadadydbcufBdbkascefgsci9hmbkdndndna8ATmbcuhrJbbbbhEcbhdavyd:KehYavyd:OehKindnawaOadcdtfydbcdtgsfydbgeTmbaxasfgiIdbh3aialcuadadcs0EcdtfclfIdbaHaecwaecw6EcdtfIdbMg5Udba5a3:th5aecdthiaKaYasfydbcdtfheinamaeydbgscdtfgPa5aPIdbMg3Udba3aEaEa39DgPEhEasaraPEhraeclfheaic98fgimbkkadcefgda8A9hmbkarcu9hmekaQaD9pmeindnakaQfRbbmbaQhrxdkaDaQcefgQ9hmbxdkka8Acza8Acz6EhsaOheaLhOarcu9hmekkazTmbaqcdtavc:Seffcwfheinaeydbcbyd;u:I:cjbH:bjjjbbaec98fheazcufgzmbkkavc:qdf8Kjjjjbk:0leoucuaicdtgvaicFFFFi0Egocbyd;q:I:cjbHjjjjbbhralalyd9GgwcdtfarBdbalawcefBd9GabarBdbaocbyd;q:I:cjbHjjjjbbhralalyd9GgocdtfarBdbalaocefBd9GabarBdlcuadcdtadcFFFFi0Ecbyd;q:I:cjbHjjjjbbhralalyd9GgocdtfarBdbalaocefBd9GabarBdwabydbcbavz:xjjjb8AabydbhraehladhvinaralydbcdtfgoaoydbcefBdbalclfhlavcufgvmbkcbhvabydlglhoarhwaihDinaoavBdbaoclfhoawydbavfhvawclfhwaDcufgDmbkadci9Uhqdnadcd9nmbabydwhocbhvinaecwfydbhwaeclfydbhDalaeydbcdtfgbabydbgbcefBdbaoabcdtfavBdbalaDcdtfgDaDydbgDcefBdbaoaDcdtfavBdbalawcdtfgwawydbgwcefBdbaoawcdtfavBdbaecxfheaqavcefgv9hmbkkinalalydbarydb9RBdbarclfhralclfhlaicufgimbkkQbabaeadaic;G:G:cjbz:ojjjbkQbabaeadaic;i:H:cjbz:ojjjbk9DeeuabcFeaicdtz:xjjjbhlcbhbdnadTmbindnalaeydbcdtfgiydbcu9hmbaiabBdbabcefhbkaeclfheadcufgdmbkkabk:3vioud9:du8Jjjjjbc;Wa9Rgl8Kjjjjbcbhvalcxfcbc;Kbz:xjjjb8AalcuadcitgoadcFFFFe0Ecbyd;q:I:cjbHjjjjbbgrBdxalceBd2araeadaicezNjjjbalcuaoadcjjjjoGEcbyd;q:I:cjbHjjjjbbgwBdzadcdthednadTmbabhiinaiavBdbaiclfhiadavcefgv9hmbkkawaefhDalabBdwalawBdl9cbhqindnadTmbaq9cq9:hkarhvaDhiadheinaiav8Pibak1:NcFrG87ebavcwfhvaicdfhiaecufgembkkalclfaq:NceGcdtfydbhxalclfaq9ce98gq:NceGcdtfydbhmalc;Wbfcbcjaz:xjjjb8AaDhvadhidnadTmbinalc;Wbfav8VebcdtfgeaeydbcefBdbavcdfhvaicufgimbkkcbhvcbhiinalc;WbfavfgeydbhoaeaiBdbaoaifhiavclfgvcja9hmbkadhvdndnadTmbinalc;WbfaDamydbgicetf8VebcdtfgeaeydbgecefBdbaxaecdtfaiBdbamclfhmavcufgvmbkaq9cv9smdcbhvinabawydbcdtfavBdbawclfhwadavcefgv9hmbxdkkaq9cv9smekkcwhvcbhiinalcxfavfc98fydbcbyd;u:I:cjbH:bjjjbbaiceGheclhvcehiaeTmbkalc;Waf8Kjjjjbk:Awliuo99iud9:cbhv8Jjjjjbca9Rgocbyd:4:I:cjbBdKaocb8Pd:W:I:cjb83izaocbyd;e:I:cjbBdwaocb8Pd:8:I:cjb83ibaicd4hrdndnadmbJFFuFhwJFFuuhDJFFuuhqJFFuFhkJFFuuhxJFFuFhmxekarcdthPaehsincbhiinaoczfaifgzasaifIdbgwazIdbgDaDaw9EEUdbaoaifgzawazIdbgDaDaw9DEUdbaiclfgicx9hmbkasaPfhsavcefgvad9hmbkaoIdKhDaoIdwhwaoIdChqaoIdlhkaoIdzhxaoIdbhmkdnadTmbJbbbbJbFu9hJbbbbamax:tgmamJbbbb9DEgmakaq:tgkakam9DEgkawaD:tgwawak9DEgw:vawJbbbb9BEhwdnalmbarcdthoindndnaeclfIdbaq:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikai:S9cC:ghHdndnaeIdbax:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikaHai:S:ehHdndnaecwfIdbaD:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikabaHai:T9cy:g:e83ibaeaofheabcwfhbadcufgdmbxdkkarcdthoindndnaeIdbax:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikai:SgH9ca:gaH9cz:g9cjjj;4s:d:eaH9cFe:d:e9cF:bj;4:pj;ar:d9c:bd9:9c:p;G:d;4j:E;ar:d9cH9:9c;d;H:W:y:m:g;d;Hb:d9cv9:9c;j:KM;j:KM;j:Kd:dhOdndnaeclfIdbaq:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikai:SgH9ca:gaH9cz:g9cjjj;4s:d:eaH9cFe:d:e9cF:bj;4:pj;ar:d9c:bd9:9c:p;G:d;4j:E;ar:d9cH9:9c;d;H:W:y:m:g;d;Hb:d9cq9:9cM;j:KM;j:KM;jl:daO:ehOdndnaecwfIdbaD:tawNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikabaOai:SgH9ca:gaH9cz:g9cjjj;4s:d:eaH9cFe:d:e9cF:bj;4:pj;ar:d9c:bd9:9c:p;G:d;4j:E;ar:d9cH9:9c;d;H:W:y:m:g;d;Hb:d9cC9:9c:KM;j:KM;j:KMD:d:e83ibaeaofheabcwfhbadcufgdmbkkk9teiucbcbyd;y:I:cjbgeabcifc98GfgbBd;y:I:cjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;LeeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiclfaeclfydbBdbaicwfaecwfydbBdbaicxfaecxfydbBdbaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk;aeedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdbaicxfalBdbaicwfalBdbaiclfalBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabk9teiucbcbyd;y:I:cjbgeabcrfc94GfgbBd;y:I:cjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaikTeeucbabcbyd;y:I:cjbge9Rcifc98GaefgbBd;y:I:cjbdnabZbcztge9nmbabae9RcFFifcz4nb8Akkk;Sddbcj:Gdk;idbbbbdbbblbbbwbbbbbbbebbbdbbblbbbwbbbbbbbbbbbbbbbbbbbebbbdbbbbbbbebbbbbbbbbbbbbbbb4:h9w9N94:P:gW:j9O:ye9Pbbbbbb:l29hZ;69:9kZ;N;76Z;rg97Z;z;o9xZ8J;B85Z;:;u9yZ;b;k9HZ:2;Z9DZ9e:l9mZ59A8KZ:r;T3Z:A:zYZ79OHZ;j4::8::Y:D9V8:bbbb9s:49:Z8R:hBZ9M9M;M8:L;z;o8:;8:PG89q;x:J878R:hQ8::M:B;e87bbbbbbjZbbjZbbjZ:E;V;N8::Y:DsZ9i;H;68:xd;R8:;h0838:;W:NoZbbbb:WV9O8:uf888:9i;H;68:9c9G;L89;n;m9m89;D8Ko8:bbbbf:8tZ9m836ZS:2AZL;zPZZ818EZ9e:lxZ;U98F8:819E;68:FFuuFFuuFFuuFFuFFFuFFFuFbc;i:IdkCebbbebbbebbbdbbb9G:rbb",e=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var t,n=WebAssembly.instantiate(i(a),{}).then(function(b){t=b.instance,t.exports.__wasm_call_ctors(),t.exports.meshopt_encodeVertexVersion(1),t.exports.meshopt_encodeIndexVersion(1)});function i(b){for(var g=new Uint8Array(b.length),y=0;y<b.length;++y){var p=b.charCodeAt(y);g[y]=p>96?p-97:p>64?p-39:p+4}for(var u=0,y=0;y<b.length;++y)g[u++]=g[y]<60?e[g[y]]:(g[y]-60)*64+g[++y];return g.buffer.slice(0,u)}function s(b){if(!b)throw new Error("Assertion failed")}function r(b){return new Uint8Array(b.buffer,b.byteOffset,b.byteLength)}function o(b,g,y,p){var u=t.exports.sbrk,m=u(g.length*4),M=u(y*4),x=new Uint8Array(t.exports.memory.buffer),S=r(g);x.set(S,m),p&&p(m,m,g.length,y);var w=b(M,m,g.length,y);x=new Uint8Array(t.exports.memory.buffer);var T=new Uint32Array(y);new Uint8Array(T.buffer).set(x.subarray(M,M+y*4)),S.set(x.subarray(m,m+g.length*4)),u(m-u(0));for(var v=0;v<g.length;++v)g[v]=T[g[v]];return[T,w]}function l(b,g,y,p){var u=t.exports.sbrk,m=u(y*4),M=u(y*p),x=new Uint8Array(t.exports.memory.buffer);x.set(r(g),M),b(m,M,y,p),x=new Uint8Array(t.exports.memory.buffer);var S=new Uint32Array(y);return new Uint8Array(S.buffer).set(x.subarray(m,m+y*4)),u(m-u(0)),S}function c(b,g,y,p,u,m,M){var x=t.exports.sbrk,S=x(g),w=x(p*u),T=new Uint8Array(t.exports.memory.buffer);T.set(r(y),w);var v=b(S,g,w,p,u,m,M),E=new Uint8Array(v);return E.set(T.subarray(S,S+v)),x(S-x(0)),E}function h(b){for(var g=0,y=0;y<b.length;++y){var p=b[y];g=g<p?p:g}return g}function d(b,g){if(s(g==2||g==4),g==4)return new Uint32Array(b.buffer,b.byteOffset,b.byteLength/4);var y=new Uint16Array(b.buffer,b.byteOffset,b.byteLength/2);return new Uint32Array(y)}function f(b,g,y,p,u,m,M){var x=t.exports.sbrk,S=x(y*p),w=x(y*m),T=new Uint8Array(t.exports.memory.buffer);T.set(r(g),w),b(S,y,p,u,w,M);var v=new Uint8Array(y*p);return v.set(T.subarray(S,S+y*p)),x(S-x(0)),v}return{ready:n,supported:!0,reorderMesh:function(b,g,y){s(b instanceof Uint32Array||b instanceof Int32Array),s(!g||b.length%3==0);var p=g?y?t.exports.meshopt_optimizeVertexCacheStrip:t.exports.meshopt_optimizeVertexCache:void 0;return o(t.exports.meshopt_optimizeVertexFetchRemap,b,h(b)+1,p)},reorderPoints:function(b,g){return s(b instanceof Float32Array),s(b.length%g==0),s(g>=3),l(t.exports.meshopt_spatialSortRemap,b,b.length/g,g*4)},encodeVertexBuffer:function(b,g,y){s(y>0&&y<=256),s(y%4==0);var p=t.exports.meshopt_encodeVertexBufferBound(g,y);return c(t.exports.meshopt_encodeVertexBuffer,p,b,g,y)},encodeVertexBufferLevel:function(b,g,y,p,u){s(y>0&&y<=256),s(y%4==0),s(p>=0&&p<=3),s(u===void 0||u==0||u==1);var m=t.exports.meshopt_encodeVertexBufferBound(g,y);return c(t.exports.meshopt_encodeVertexBufferLevel,m,b,g,y,p,u===void 0?-1:u)},encodeIndexBuffer:function(b,g,y){s(y==2||y==4),s(g%3==0);var p=d(b,y),u=t.exports.meshopt_encodeIndexBufferBound(g,h(p)+1);return c(t.exports.meshopt_encodeIndexBuffer,u,p,g,4)},encodeIndexSequence:function(b,g,y){s(y==2||y==4);var p=d(b,y),u=t.exports.meshopt_encodeIndexSequenceBound(g,h(p)+1);return c(t.exports.meshopt_encodeIndexSequence,u,p,g,4)},encodeGltfBuffer:function(b,g,y,p,u){var m={ATTRIBUTES:this.encodeVertexBufferLevel,TRIANGLES:this.encodeIndexBuffer,INDICES:this.encodeIndexSequence};return s(m[p]),m[p](b,g,y,2,u===void 0?0:u)},encodeFilterOct:function(b,g,y,p){return s(y==4||y==8),s(p>=2&&p<=16),f(t.exports.meshopt_encodeFilterOct,b,g,y,p,16)},encodeFilterQuat:function(b,g,y,p){return s(y==8),s(p>=4&&p<=16),f(t.exports.meshopt_encodeFilterQuat,b,g,y,p,16)},encodeFilterExp:function(b,g,y,p,u){s(y>0&&y%4==0),s(p>=1&&p<=24);var m={Separate:0,SharedVector:1,SharedComponent:2,Clamped:3};return s(!u||u in m),f(t.exports.meshopt_encodeFilterExp,b,g,y,p,y,u?m[u]:1)},encodeFilterColor:function(b,g,y,p){return s(y==4||y==8),s(p>=2&&p<=16),f(t.exports.meshopt_encodeFilterColor,b,g,y,p,16)}}})();var Wd=(function(){var a="b9H79Tebbbe8Fv9Gbb9Gvuuuuueu9Giuuub9Geueu9Giuuueuixkbeeeddddillviebeoweuecj:Gdkr;Neqo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbeY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVbdE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbiL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtblK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949WboY9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVJ9V29VVbrl79IV9Rbwq1Zkdbk:kYi5ud9:du8Jjjjjbcjq9Rgv8Kjjjjbc9:hodnalTmbcuhoaiRbbgrc;WeGc:Ge9hmbarcsGgwce0mbc9:hoalcufadcd4cbawEgDadfgrcKcaawEgqaraq0Egk6mbaicefhxcj;abad9Uc;WFbGcjdadca0EhmaialfgPar9Rgoadfhsavaoadz:jjjjbgzceVhHcbhOdndninaeaO9nmeaPax9RaD6mdamaeaO9RaOamfgoae6EgAcsfglc9WGhCaAcethXaxaDfhiaOaeaoaeao6E9RhQalcl4cifcd4hLazcjdfaAfhKcbhYabaOad2fg8AhEaHh3incbh5dnawTmbaxaYcd4fRbbh5kcbh8Eazcjdfhqinaih8Fdndndndna5a8Ecet4ciGgoc9:fPdebdkaPa8F9RaA6mrazcjdfa8EaA2fa8FaAz:jjjjb8Aa8FaAfhixdkazcjdfa8EaA2fcbaAz:kjjjb8Aa8FhixekaPa8F9RaL6mva8FaLfhidnaCTmbaPai9RcK6mbaocdtc:q:G:cjbfcj:G:cjbawEhaczhrcbhlinargoc9Wfghaqfhrdndndndndndnaaa8Fahco4fRbbalcoG4ciGcdtfydbPDbedvivvvlvkar9cb83bwar9cb83bbxlkarcbaiRbdai8Xbb9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:gg9cjjjjjz:dg8J9qE86bbaqaofgrcGfcbaicdfa8J9c8N1:NfghRbbag9cjjjjjw:dg8J9qE86bbarcVfcbaha8J9c8M1:NfghRbbag9cjjjjjl:dg8J9qE86bbarc7fcbaha8J9c8L1:NfghRbbag9cjjjjjd:dg8J9qE86bbarctfcbaha8J9c8K1:NfghRbbag9cjjjjje:dg8J9qE86bbarc91fcbaha8J9c8J1:NfghRbbag9cjjjj;ab:dg8J9qE86bbarc4fcbaha8J9cg1:NfghRbbag9cjjjja:dg8J9qE86bbarc93fcbaha8J9ch1:NfghRbbag9cjjjjz:dgg9qE86bbarc94fcbahag9ca1:NfghRbbai8Xbe9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:gg9cjjjjjz:dg8J9qE86bbarc95fcbaha8J9c8N1:NfgiRbbag9cjjjjjw:dg8J9qE86bbarc96fcbaia8J9c8M1:NfgiRbbag9cjjjjjl:dg8J9qE86bbarc97fcbaia8J9c8L1:NfgiRbbag9cjjjjjd:dg8J9qE86bbarc98fcbaia8J9c8K1:NfgiRbbag9cjjjjje:dg8J9qE86bbarc99fcbaia8J9c8J1:NfgiRbbag9cjjjj;ab:dg8J9qE86bbarc9:fcbaia8J9cg1:NfgiRbbag9cjjjja:dg8J9qE86bbarcufcbaia8J9ch1:NfgiRbbag9cjjjjz:dgg9qE86bbaiag9ca1:NfhixikaraiRblaiRbbghco4g8Ka8KciSg8KE86bbaqaofgrcGfaiclfa8Kfg8KRbbahcl4ciGg8La8LciSg8LE86bbarcVfa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc7fa8Ka8Lfg8KRbbahciGghahciSghE86bbarctfa8Kahfg8KRbbaiRbeghco4g8La8LciSg8LE86bbarc91fa8Ka8Lfg8KRbbahcl4ciGg8La8LciSg8LE86bbarc4fa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc93fa8Ka8Lfg8KRbbahciGghahciSghE86bbarc94fa8Kahfg8KRbbaiRbdghco4g8La8LciSg8LE86bbarc95fa8Ka8Lfg8KRbbahcl4ciGg8La8LciSg8LE86bbarc96fa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc97fa8Ka8Lfg8KRbbahciGghahciSghE86bbarc98fa8KahfghRbbaiRbigico4g8Ka8KciSg8KE86bbarc99faha8KfghRbbaicl4ciGg8Ka8KciSg8KE86bbarc9:faha8KfghRbbaicd4ciGg8Ka8KciSg8KE86bbarcufaha8KfgrRbbaiciGgiaiciSgiE86bbaraifhixdkaraiRbwaiRbbghcl4g8Ka8KcsSg8KE86bbaqaofgrcGfaicwfa8Kfg8KRbbahcsGghahcsSghE86bbarcVfa8KahfghRbbaiRbeg8Kcl4g8La8LcsSg8LE86bbarc7faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarctfaha8KfghRbbaiRbdg8Kcl4g8La8LcsSg8LE86bbarc91faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc4faha8KfghRbbaiRbig8Kcl4g8La8LcsSg8LE86bbarc93faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc94faha8KfghRbbaiRblg8Kcl4g8La8LcsSg8LE86bbarc95faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc96faha8KfghRbbaiRbvg8Kcl4g8La8LcsSg8LE86bbarc97faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc98faha8KfghRbbaiRbog8Kcl4g8La8LcsSg8LE86bbarc99faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc9:faha8KfghRbbaiRbrgicl4g8Ka8KcsSg8KE86bbarcufaha8KfgrRbbaicsGgiaicsSgiE86bbaraifhixekarai8Pbw83bwarai8Pbb83bbaiczfhikdnaoaC9pmbalcdfhlaoczfhraPai9RcL0mekkaoaC6moaimexokaCmva8FTmvkaqaAfhqa8Ecefg8Ecl9hmbkdndndndnawTmbasaYcd4fRbbgociGPlbedrbkaATmdazaYfh8Fazcjdfhhcbh8EaEhaina8FRbbhraahocbhlinaoahalfRbbgqce4cbaqceG9R7arfgr86bbaoadfhoaAalcefgl9hmbkaacefhaa8Fcefh8FahaAfhha8Ecefg8Ecl9hmbxikkaATmeazaYfhaazcjdfhhcbhoceh8EaKh8FinaEaofhlaa8Vbbhrcbhoinala8FaofRbbcwtahaofRbbgqVc;:FiGce4cbaqceG9R7arfgr87bbaladfhlaQaocefgofmbka8FaXfh8FcdhoaacdfhaahaXfhha8EceGhlcbh8EalmbxdkkaATmbaocl4h8EazaYfRbbhqcwhoa3hlinalRbbaotaqVhqalcefhlaocwfgoca9hmbkcbhhaEh8FaKhainazcjdfahfRbbhrcwhoaahlinalRbbaotarVhralaAfhlaocwfgoca9hmbkara8E94aq7hqcbhoa8Fhlinalaqao486bbalcefhlaocwfgoca9hmbka8Fadfh8FaacefhaahcefghaA9hmbkkaEclfhEa3clfh3aYclfgYad6mbkaza8AaAcufad2fadz:jjjjb8AaAaOfhOaihxaimbkc9:hoxdkcbc99aPax9RakSEhoxekc9:hokavcjqf8Kjjjjbaok:ysezu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnalaeci9UgrcHf6mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgDce0mbavc;abfcFecjez:kjjjb8Aav9cu83iUav9cu83i8Wav9cu83iyav9cu83iaav9cu83iKav9cu83izav9cu83iwav9cu83ibaialfc9WfhqaicefgwarfhldnaeTmbcmcsaDceSEhkcbhxcbhmcbhrcbhicbhoindnalaq9nmbc9:hoxikdndnawRbbgDc;Ve0mbavc;abfaoaDcu7gPcl4fcsGcitfgsydlhzasydbhHdndnaDcsGgsak9pmbavaiaPfcsGcdtfydbaxasEhDaxasTgOfhxxekdndnascsSmbcehOasc987asamffcefhDxekalcefhDal8SbbgscFeGhPdndnascu9mmbaDhlxekalcvfhlaPcFbGhPcrhsdninaD8SbbgOcFbGastaPVhPaOcu9kmeaDcefhDascrfgsc8J9hmbxdkkaDcefhlkcehOaPce4cbaPceG9R7amfhDkaDhmkavc;abfaocitfgsaDBdbasazBdlavaicdtfaDBdbavc;abfaocefcsGcitfgsaHBdbasaDBdlaocdfhoaOaifhidnadcd9hmbabarcetfgsaH87ebasclfaD87ebascdfaz87ebxdkabarcdtfgsaHBdbascwfaDBdbasclfazBdbxekdnaDcpe0mbavaiaqaDcsGfRbbgscl4gP9RcsGcdtfydbaxcefgOaPEhDavaias9RcsGcdtfydbaOaPTgzfgOascsGgPEhsaPThPdndnadcd9hmbabarcetfgHax87ebaHclfas87ebaHcdfaD87ebxekabarcdtfgHaxBdbaHcwfasBdbaHclfaDBdbkavaicdtfaxBdbavc;abfaocitfgHaDBdbaHaxBdlavaicefgicsGcdtfaDBdbavc;abfaocefcsGcitfgHasBdbaHaDBdlavaiazfgicsGcdtfasBdbavc;abfaocdfcsGcitfgDaxBdbaDasBdlaocifhoaiaPfhiaOaPfhxxekaxcbalRbbgsEgHaDc;:eSgDfhOascsGhAdndnascl4gCmbaOcefhzxekaOhzavaiaC9RcsGcdtfydbhOkdndnaAmbazcefhxxekazhxavaias9RcsGcdtfydbhzkdndnaDTmbalcefhDxekalcdfhDal8SbegPcFeGhsdnaPcu9kmbalcofhHascFbGhscrhldninaD8SbbgPcFbGaltasVhsaPcu9kmeaDcefhDalcrfglc8J9hmbkaHhDxekaDcefhDkasce4cbasceG9R7amfgmhHkdndnaCcsSmbaDhsxekaDcefhsaD8SbbglcFeGhPdnalcu9kmbaDcvfhOaPcFbGhPcrhldninas8SbbgDcFbGaltaPVhPaDcu9kmeascefhsalcrfglc8J9hmbkaOhsxekascefhskaPce4cbaPceG9R7amfgmhOkdndnaAcsSmbashlxekascefhlas8SbbgDcFeGhPdnaDcu9kmbascvfhzaPcFbGhPcrhDdninal8SbbgscFbGaDtaPVhPascu9kmealcefhlaDcrfgDc8J9hmbkazhlxekalcefhlkaPce4cbaPceG9R7amfgmhzkdndnadcd9hmbabarcetfgDaH87ebaDclfaz87ebaDcdfaO87ebxekabarcdtfgDaHBdbaDcwfazBdbaDclfaOBdbkavc;abfaocitfgDaOBdbaDaHBdlavaicdtfaHBdbavc;abfaocefcsGcitfgDazBdbaDaOBdlavaicefgicsGcdtfaOBdbavc;abfaocdfcsGcitfgDaHBdbaDazBdlavaiaCTaCcsSVfgicsGcdtfazBdbaiaATaAcsSVfhiaocifhokawcefhwaocsGhoaicsGhiarcifgrae6mbkkcbc99alaqSEhokavc;aef8Kjjjjbaok:clevu8Jjjjjbcz9Rhvdnalaecvf9pmbc9:skdnaiRbbc;:eGc;qeSmbcuskav9cb83iwaicefhoaialfc98fhrdnaeTmbdnadcdSmbcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcdtfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgiBdbalaiBdbawcefgwae9hmbxdkkcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcetfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgi87ebalaiBdbawcefgwae9hmbkkcbc99aoarSEk:Lvoeue99dud99eud99dndnadcl9hmbaeTmeindndnabcdfgd8Sbb:Yab8Sbbgi:Ygl:l:tabcefgv8Sbbgo:Ygr:l:tgwJbb;:9cawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai86bbdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad86bbdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad86bbabclfhbaecufgembxdkkaeTmbindndnabclfgd8Ueb:Yab8Uebgi:Ygl:l:tabcdfgv8Uebgo:Ygr:l:tgwJb;:FSawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai87ebdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad87ebdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad87ebabcwfhbaecufgembkkk:4ioiue99dud99dud99dnaeTmbcbhiabhlindndnal8Uebgv:YgoJ:ji:1Salcof8UebgrciVgw:Y:vgDNJbbbZJbbb:;avcu9kEMgq:lJbbb9p9DTmbaq:Ohkxekcjjjj94hkkalclf8Uebhvalcdf8UebhxalarcefciGcetfak87ebdndnax:YgqaDNJbbbZJbbb:;axcu9kEMgm:lJbbb9p9DTmbam:Ohxxekcjjjj94hxkabaiarciGgkfcd7cetfax87ebdndnav:YgmaDNJbbbZJbbb:;avcu9kEMgP:lJbbb9p9DTmbaP:Ohvxekcjjjj94hvkalarcufciGcetfav87ebdndnawaw2:ZgPaPMaoaoN:taqaqN:tamamN:tgoJbbbbaoJbbbb9GE:raDNJbbbZMgD:lJbbb9p9DTmbaD:Ohrxekcjjjj94hrkalakcetfar87ebalcwfhlaiclfhiaecufgembkkk9mbdnadcd4ae2gdTmbinababydbgecwtcw91:Yaece91cjjj98Gcjjj;8if::NUdbabclfhbadcufgdmbkkk:Tvirud99eudndnadcl9hmbaeTmeindndnabRbbgiabcefgl8Sbbgvabcdfgo8Sbbgrf9R:YJbbuJabcifgwRbbgdce4adVgDcd4aDVgDcl4aDVgD:Z:vgqNJbbbZMgk:lJbbb9p9DTmbak:Ohxxekcjjjj94hxkaoax86bbdndnaraif:YaqNJbbbZMgk:lJbbb9p9DTmbak:Ohoxekcjjjj94hokalao86bbdndnavaifar9R:YaqNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikabai86bbdndnaDadcetGadceGV:ZaqNJbbbZMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkawad86bbabclfhbaecufgembxdkkaeTmbindndnab8Vebgiabcdfgl8Uebgvabclfgo8Uebgrf9R:YJbFu9habcofgw8Vebgdce4adVgDcd4aDVgDcl4aDVgDcw4aDVgD:Z:vgqNJbbbZMgk:lJbbb9p9DTmbak:Ohxxekcjjjj94hxkaoax87ebdndnaraif:YaqNJbbbZMgk:lJbbb9p9DTmbak:Ohoxekcjjjj94hokalao87ebdndnavaifar9R:YaqNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikabai87ebdndnaDadcetGadceGV:ZaqNJbbbZMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkawad87ebabcwfhbaecufgembkkk9teiucbcbyd:K:G:cjbgeabcifc98GfgbBd:K:G:cjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;LeeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiclfaeclfydbBdbaicwfaecwfydbBdbaicxfaecxfydbBdbaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk;aeedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdbaicxfalBdbaicwfalBdbaiclfalBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabkk83dbcj:Gdk8Kbbbbdbbblbbbwbbbbbbbebbbdbbblbbbwbbbbc:K:Gdkl8W:qbb",e="b9H79TebbbeKl9Gbb9Gvuuuuueu9Giuuub9Geueuixkbbebeeddddilve9Weeeviebeoweuecj:Gdkr;Neqo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbdY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVblE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtboK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbrL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949WbwY9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVJ9V29VVbDl79IV9Rbqq:59Dklbzik94evu8Jjjjjbcz9Rhbcbheincbhdcbhiinabcwfadfaicjuaead4ceGglE86bbaialfhiadcefgdcw9hmbkaeai86b:q:W:cjbaecitab8Piw83i:q:G:cjbaecefgecjd9hmbkk:SBlEud97dur978Jjjjjbcj;kb9Rgv8Kjjjjbc9:hodnalTmbcuhoaiRbbgrc;WeGc:Ge9hmbarcsGgwce0mbc9:hoalcufadcd4cbawEgDadfgrcKcaawEgqaraq0Egk6mbaialfgxar9RhodnadTgmmbavaoad;8qbbkaicefhPcj;abad9Uc;WFbGcjdadca0EhsdndndnadTmbaoadfhzcbhHinaeaH9nmdaxaP9RaD6miabaHad2fgOavcjdfasaeaH9RaHasfae6EgAaAcsfgoc9WGgCSEhXaPaDfhQaocl4cifcd4hLavcj;cbfaCcetfhKavcj;cbfaCci2fhYavcj;cbfaCfh8AcbhEaoc;ab6h3incbh5dnawTmbaPaEcd4fRbbh5kcbh8Eavcj;cbfh8Findndndndna5a8Ecet4ciGgoc9:fPdebdkaxaQ9RaC6mwdnaCTmbavcj;cbfa8EaC2faQaC;8qbbkaQaAfhQxdkaCTmeavcj;cbfa8EaC2fcbaC;8kbxekaxaQ9RaL6moaoclVcbawEhraQaLfhocbhidna3mbaxao9Rc;Gb6mbcbhlina8FalfhidndndndndndnaQalco4fRbbgqciGarfPDbedibledibkaipxbbbbbbbbbbbbbbbbpklbxlkaiaopbblaopbbbgaclp:meaapmbzeHdOiAlCvXoQrLgacdp:meaapmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9oghpxiiiiiiiiiiiiiiiip8Jgap5b9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbagRb:q:W:cjbggpsaap5e9cjF;8;4;W;G;ab9:9cU1:Ng8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPahaap9spklbagaoclffa8JRb:q:W:cjbfhoxikaiaopbbwaopbbbgaclp:meaapmbzeHdOiAlCvXoQrLpxssssssssssssssssp9oghpxssssssssssssssssp8Jgap5b9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbagRb:q:W:cjbggpsaap5e9cjF;8;4;W;G;ab9:9cU1:Ng8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPahaap9spklbagaocwffa8JRb:q:W:cjbfhoxdkaiaopbbbpklbaoczfhoxekaiaopbbdaoRbbggcitpbi:q:G:cjbagRb:q:W:cjbggpsaoRbeg8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpklbagaocdffa8JRb:q:W:cjbfhokdndndndndndnaqcd4ciGarfPDbedibledibkaiczfpxbbbbbbbbbbbbbbbbpklbxlkaiczfaopbblaopbbbgaclp:meaapmbzeHdOiAlCvXoQrLgacdp:meaapmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9oghpxiiiiiiiiiiiiiiiip8Jgap5b9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbagRb:q:W:cjbggpsaap5e9cjF;8;4;W;G;ab9:9cU1:Ng8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPahaap9spklbagaoclffa8JRb:q:W:cjbfhoxikaiczfaopbbwaopbbbgaclp:meaapmbzeHdOiAlCvXoQrLpxssssssssssssssssp9oghpxssssssssssssssssp8Jgap5b9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbagRb:q:W:cjbggpsaap5e9cjF;8;4;W;G;ab9:9cU1:Ng8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPahaap9spklbagaocwffa8JRb:q:W:cjbfhoxdkaiczfaopbbbpklbaoczfhoxekaiczfaopbbdaoRbbggcitpbi:q:G:cjbagRb:q:W:cjbggpsaoRbeg8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpklbagaocdffa8JRb:q:W:cjbfhokdndndndndndnaqcl4ciGarfPDbedibledibkaicafpxbbbbbbbbbbbbbbbbpklbxlkaicafaopbblaopbbbgaclp:meaapmbzeHdOiAlCvXoQrLgacdp:meaapmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9oghpxiiiiiiiiiiiiiiiip8Jgap5b9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbagRb:q:W:cjbggpsaap5e9cjF;8;4;W;G;ab9:9cU1:Ng8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPahaap9spklbagaoclffa8JRb:q:W:cjbfhoxikaicafaopbbwaopbbbgaclp:meaapmbzeHdOiAlCvXoQrLpxssssssssssssssssp9oghpxssssssssssssssssp8Jgap5b9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbagRb:q:W:cjbggpsaap5e9cjF;8;4;W;G;ab9:9cU1:Ng8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPahaap9spklbagaocwffa8JRb:q:W:cjbfhoxdkaicafaopbbbpklbaoczfhoxekaicafaopbbdaoRbbggcitpbi:q:G:cjbagRb:q:W:cjbggpsaoRbeg8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpklbagaocdffa8JRb:q:W:cjbfhokdndndndndndnaqco4arfPDbedibledibkaic8Wfpxbbbbbbbbbbbbbbbbpklbxlkaic8Wfaopbblaopbbbgaclp:meaapmbzeHdOiAlCvXoQrLgacdp:meaapmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9oghpxiiiiiiiiiiiiiiiip8Jgap5b9cjF;8;4;W;G;ab9:9cU1:Ngicitpbi:q:G:cjbaiRb:q:W:cjbgipsaap5e9cjF;8;4;W;G;ab9:9cU1:Ngqcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPahaap9spklbaiaoclffaqRb:q:W:cjbfhoxikaic8Wfaopbbwaopbbbgaclp:meaapmbzeHdOiAlCvXoQrLpxssssssssssssssssp9oghpxssssssssssssssssp8Jgap5b9cjF;8;4;W;G;ab9:9cU1:Ngicitpbi:q:G:cjbaiRb:q:W:cjbgipsaap5e9cjF;8;4;W;G;ab9:9cU1:Ngqcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPahaap9spklbaiaocwffaqRb:q:W:cjbfhoxdkaic8Wfaopbbbpklbaoczfhoxekaic8WfaopbbdaoRbbgicitpbi:q:G:cjbaiRb:q:W:cjbgipsaoRbegqcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpklbaiaocdffaqRb:q:W:cjbfhokalc;abfhialcjefaC0meaihlaxao9Rc;Fb0mbkkdnaiaC9pmbaici4hlinaxao9RcK6mwa8FaifhqdndndndndndnaQaico4fRbbalcoG4ciGarfPDbedibledibkaqpxbbbbbbbbbbbbbbbbpkbbxlkaqaopbblaopbbbgaclp:meaapmbzeHdOiAlCvXoQrLgacdp:meaapmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9oghpxiiiiiiiiiiiiiiiip8Jgap5b9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbagRb:q:W:cjbggpsaap5e9cjF;8;4;W;G;ab9:9cU1:Ng8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPahaap9spkbbagaoclffa8JRb:q:W:cjbfhoxikaqaopbbwaopbbbgaclp:meaapmbzeHdOiAlCvXoQrLpxssssssssssssssssp9oghpxssssssssssssssssp8Jgap5b9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbagRb:q:W:cjbggpsaap5e9cjF;8;4;W;G;ab9:9cU1:Ng8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPahaap9spkbbagaocwffa8JRb:q:W:cjbfhoxdkaqaopbbbpkbbaoczfhoxekaqaopbbdaoRbbggcitpbi:q:G:cjbagRb:q:W:cjbggpsaoRbeg8Jcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpkbbagaocdffa8JRb:q:W:cjbfhokalcdfhlaiczfgiaC6mbkkaohQaoTmoka8FaCfh8Fa8Ecefg8Ecl9hmbkdndndndnawTmbazaEcd4fRbbglciGPlbedwbkaCTmdaXaEfhlavaEfpbdbh8Kcbhoinalavcj;cbfaofpblbg8La8Aaofpblbg8MpmbzeHdOiAlCvXoQrLg8NaKaofpblbgyaYaofpblbg8PpmbzeHdOiAlCvXoQrLgIpmbezHdiOAlvCXorQLgacep9Taapxeeeeeeeeeeeeeeeeghp9op9Hp9rgaa8Kp9Ug8Kp9Abbbaladfgla8Kaaaapmlvorlvorlvorlvorp9Ug8Kp9Abbbaladfgla8KaaaapmwDqkwDqkwDqkwDqkp9Ug8Kp9Abbbaladfgla8KaaaapmxmPsxmPsxmPsxmPsp9Ug8Kp9Abbbaladfgla8Ka8NaIpmwDKYqk8AExm35Ps8E8Fgacep9Taaahp9op9Hp9rgap9Ug8Kp9Abbbaladfgla8Kaaaapmlvorlvorlvorlvorp9Ug8Kp9Abbbaladfgla8KaaaapmwDqkwDqkwDqkwDqkp9Ug8Kp9Abbbaladfgla8KaaaapmxmPsxmPsxmPsxmPsp9Ug8Kp9Abbbaladfgla8Ka8La8MpmwKDYq8AkEx3m5P8Es8Fg8Laya8PpmwKDYq8AkEx3m5P8Es8Fg8MpmbezHdiOAlvCXorQLgacep9Taaahp9op9Hp9rgap9Ug8Kp9Abbbaladfgla8Kaaaapmlvorlvorlvorlvorp9Ug8Kp9Abbbaladfgla8KaaaapmwDqkwDqkwDqkwDqkp9Ug8Kp9Abbbaladfgla8KaaaapmxmPsxmPsxmPsxmPsp9Ug8Kp9Abbbaladfgla8Ka8La8MpmwDKYqk8AExm35Ps8E8Fgacep9Taaahp9op9Hp9rgap9Ughp9Abbbaladfglahaaaapmlvorlvorlvorlvorp9Ughp9AbbbaladfglahaaaapmwDqkwDqkwDqkwDqkp9Ughp9AbbbaladfglahaaaapmxmPsxmPsxmPsxmPsp9Ug8Kp9AbbbaladfhlaoczfgoaC6mbxikkaCTmeaXaEfhlavaEfpbdbh8Kcbhoinalavcj;cbfaofpblbg8La8Aaofpblbg8MpmbzeHdOiAlCvXoQrLg8NaKaofpblbgyaYaofpblbg8PpmbzeHdOiAlCvXoQrLgIpmbezHdiOAlvCXorQLgacep:neaapxebebebebebebebebghp9op:bep9rgaa8Kp:oeg8Kp9Abbbaladfgla8Kaaaapmlvorlvorlvorlvorp:oeg8Kp9Abbbaladfgla8KaaaapmwDqkwDqkwDqkwDqkp:oeg8Kp9Abbbaladfgla8KaaaapmxmPsxmPsxmPsxmPsp:oeg8Kp9Abbbaladfgla8Ka8NaIpmwDKYqk8AExm35Ps8E8Fgacep:neaaahp9op:bep9rgap:oeg8Kp9Abbbaladfgla8Kaaaapmlvorlvorlvorlvorp:oeg8Kp9Abbbaladfgla8KaaaapmwDqkwDqkwDqkwDqkp:oeg8Kp9Abbbaladfgla8KaaaapmxmPsxmPsxmPsxmPsp:oeg8Kp9Abbbaladfgla8Ka8La8MpmwKDYq8AkEx3m5P8Es8Fg8Laya8PpmwKDYq8AkEx3m5P8Es8Fg8MpmbezHdiOAlvCXorQLgacep:neaaahp9op:bep9rgap:oeg8Kp9Abbbaladfgla8Kaaaapmlvorlvorlvorlvorp:oeg8Kp9Abbbaladfgla8KaaaapmwDqkwDqkwDqkwDqkp:oeg8Kp9Abbbaladfgla8KaaaapmxmPsxmPsxmPsxmPsp:oeg8Kp9Abbbaladfgla8Ka8La8MpmwDKYqk8AExm35Ps8E8Fgacep:neaaahp9op:bep9rgap:oeghp9Abbbaladfglahaaaapmlvorlvorlvorlvorp:oeghp9AbbbaladfglahaaaapmwDqkwDqkwDqkwDqkp:oeghp9AbbbaladfglahaaaapmxmPsxmPsxmPsxmPsp:oeg8Kp9AbbbaladfhlaoczfgoaC6mbxdkkaCTmbaXaEfhrcbhocbalcl4gl9Rc8FGhiavaEfpbdbhhinaravcj;cbfaofpblbg8Ka8Aaofpblbg8LpmbzeHdOiAlCvXoQrLg8MaKaofpblbg8NaYaofpblbgypmbzeHdOiAlCvXoQrLg8PpmbezHdiOAlvCXorQLgaaip:Reaaalp:Tep9qgaahp9rghp9Abbbaradfgrahaaaapmlvorlvorlvorlvorp9rghp9AbbbaradfgrahaaaapmwDqkwDqkwDqkwDqkp9rghp9AbbbaradfgrahaaaapmxmPsxmPsxmPsxmPsp9rghp9Abbbaradfgraha8Ma8PpmwDKYqk8AExm35Ps8E8Fgaaip:Reaaalp:Tep9qgap9rghp9Abbbaradfgrahaaaapmlvorlvorlvorlvorp9rghp9AbbbaradfgrahaaaapmwDqkwDqkwDqkwDqkp9rghp9AbbbaradfgrahaaaapmxmPsxmPsxmPsxmPsp9rghp9Abbbaradfgraha8Ka8LpmwKDYq8AkEx3m5P8Es8Fg8Ka8NaypmwKDYq8AkEx3m5P8Es8Fg8LpmbezHdiOAlvCXorQLgaaip:Reaaalp:Tep9qgap9rghp9Abbbaradfgrahaaaapmlvorlvorlvorlvorp9rghp9AbbbaradfgrahaaaapmwDqkwDqkwDqkwDqkp9rghp9AbbbaradfgrahaaaapmxmPsxmPsxmPsxmPsp9rghp9Abbbaradfgraha8Ka8LpmwDKYqk8AExm35Ps8E8Fgaaip:Reaaalp:Tep9qgap9rghp9Abbbaradfgrahaaaapmlvorlvorlvorlvorp9rghp9AbbbaradfgrahaaaapmwDqkwDqkwDqkwDqkp9rghp9AbbbaradfgrahaaaapmxmPsxmPsxmPsxmPsp9rghp9AbbbaradfhraoczfgoaC6mbkkaEclfgEad6mbkdnaXavcjdf9hmbaAad2goTmbaOavcjdfao;8qbbkdnammbavaXaAcufad2fad;8qbbkaAaHfhHc9:hoaQhPaQmbxlkkaeTmbaDalfhrcbhocuhlinaralaD9RglfaD6mdasaeao9Raoasfae6Eaofgoae6mbkaial9RhPkcbc99axaP9RakSEhoxekc9:hokavcj;kbf8Kjjjjbaokwbz:bjjjbkNsezu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnalaeci9UgrcHf6mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgDce0mbavc;abfcFecje;8kbav9cu83iUav9cu83i8Wav9cu83iyav9cu83iaav9cu83iKav9cu83izav9cu83iwav9cu83ibaialfc9WfhqaicefgwarfhldnaeTmbcmcsaDceSEhkcbhxcbhmcbhrcbhicbhoindnalaq9nmbc9:hoxikdndnawRbbgDc;Ve0mbavc;abfaoaDcu7gPcl4fcsGcitfgsydlhzasydbhHdndnaDcsGgsak9pmbavaiaPfcsGcdtfydbaxasEhDaxasTgOfhxxekdndnascsSmbcehOasc987asamffcefhDxekalcefhDal8SbbgscFeGhPdndnascu9mmbaDhlxekalcvfhlaPcFbGhPcrhsdninaD8SbbgOcFbGastaPVhPaOcu9kmeaDcefhDascrfgsc8J9hmbxdkkaDcefhlkcehOaPce4cbaPceG9R7amfhDkaDhmkavc;abfaocitfgsaDBdbasazBdlavaicdtfaDBdbavc;abfaocefcsGcitfgsaHBdbasaDBdlaocdfhoaOaifhidnadcd9hmbabarcetfgsaH87ebasclfaD87ebascdfaz87ebxdkabarcdtfgsaHBdbascwfaDBdbasclfazBdbxekdnaDcpe0mbavaiaqaDcsGfRbbgscl4gP9RcsGcdtfydbaxcefgOaPEhDavaias9RcsGcdtfydbaOaPTgzfgOascsGgPEhsaPThPdndnadcd9hmbabarcetfgHax87ebaHclfas87ebaHcdfaD87ebxekabarcdtfgHaxBdbaHcwfasBdbaHclfaDBdbkavaicdtfaxBdbavc;abfaocitfgHaDBdbaHaxBdlavaicefgicsGcdtfaDBdbavc;abfaocefcsGcitfgHasBdbaHaDBdlavaiazfgicsGcdtfasBdbavc;abfaocdfcsGcitfgDaxBdbaDasBdlaocifhoaiaPfhiaOaPfhxxekaxcbalRbbgsEgHaDc;:eSgDfhOascsGhAdndnascl4gCmbaOcefhzxekaOhzavaiaC9RcsGcdtfydbhOkdndnaAmbazcefhxxekazhxavaias9RcsGcdtfydbhzkdndnaDTmbalcefhDxekalcdfhDal8SbegPcFeGhsdnaPcu9kmbalcofhHascFbGhscrhldninaD8SbbgPcFbGaltasVhsaPcu9kmeaDcefhDalcrfglc8J9hmbkaHhDxekaDcefhDkasce4cbasceG9R7amfgmhHkdndnaCcsSmbaDhsxekaDcefhsaD8SbbglcFeGhPdnalcu9kmbaDcvfhOaPcFbGhPcrhldninas8SbbgDcFbGaltaPVhPaDcu9kmeascefhsalcrfglc8J9hmbkaOhsxekascefhskaPce4cbaPceG9R7amfgmhOkdndnaAcsSmbashlxekascefhlas8SbbgDcFeGhPdnaDcu9kmbascvfhzaPcFbGhPcrhDdninal8SbbgscFbGaDtaPVhPascu9kmealcefhlaDcrfgDc8J9hmbkazhlxekalcefhlkaPce4cbaPceG9R7amfgmhzkdndnadcd9hmbabarcetfgDaH87ebaDclfaz87ebaDcdfaO87ebxekabarcdtfgDaHBdbaDcwfazBdbaDclfaOBdbkavc;abfaocitfgDaOBdbaDaHBdlavaicdtfaHBdbavc;abfaocefcsGcitfgDazBdbaDaOBdlavaicefgicsGcdtfaOBdbavc;abfaocdfcsGcitfgDaHBdbaDazBdlavaiaCTaCcsSVfgicsGcdtfazBdbaiaATaAcsSVfhiaocifhokawcefhwaocsGhoaicsGhiarcifgrae6mbkkcbc99alaqSEhokavc;aef8Kjjjjbaok:clevu8Jjjjjbcz9Rhvdnalaecvf9pmbc9:skdnaiRbbc;:eGc;qeSmbcuskav9cb83iwaicefhoaialfc98fhrdnaeTmbdnadcdSmbcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcdtfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgiBdbalaiBdbawcefgwae9hmbxdkkcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcetfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgi87ebalaiBdbawcefgwae9hmbkkcbc99aoarSEk;Toio97eue97aec98Ghedndnadcl9hmbaeTmecbhdinababpbbbgicKp:RecKp:Sep;6eglaicwp:RecKp:Sep;6ealp;Geaiczp:RecKp:Sep;6egvp;Gep;Kep;Legopxbbbbbbbbbbbbbbbbp:2egralpxbbbjbbbjbbbjbbbjgwp9op9rp;Keglpxbb;:9cbb;:9cbb;:9cbb;:9calalp;Meaoaop;Meavaravawp9op9rp;Keglalp;Mep;Kep;Kep;Jep;Negvp;Mepxbbn0bbn0bbn0bbn0grp;KepxFbbbFbbbFbbbFbbbp9oaipxbbbFbbbFbbbFbbbFp9op9qalavp;Mearp;Kecwp:RepxbFbbbFbbbFbbbFbbp9op9qaoavp;Mearp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qpkbbabczfhbadclfgdae6mbxdkkaeTmbcbhdinabczfgDaDpbbbgipxbbbbbbFFbbbbbbFFgwp9oabpbbbgoaipmbediwDqkzHOAKY8AEgvczp:Reczp:Sep;6eglaoaipmlvorxmPsCXQL358E8FpxFubbFubbFubbFubbp9op;6eavczp:Sep;6egvp;Gealp;Gep;Kep;Legipxbbbbbbbbbbbbbbbbp:2egralpxbbbjbbbjbbbjbbbjgqp9op9rp;Keglpxb;:FSb;:FSb;:FSb;:FSalalp;Meaiaip;Meavaravaqp9op9rp;Keglalp;Mep;Kep;Kep;Jep;Negvp;Mepxbbn0bbn0bbn0bbn0grp;KepxFFbbFFbbFFbbFFbbp9oaiavp;Mearp;Keczp:Rep9qgialavp;Mearp;KepxFFbbFFbbFFbbFFbbp9oglpmwDKYqk8AExm35Ps8E8Fp9qpkbbabaoawp9oaialpmbezHdiOAlvCXorQLp9qpkbbabcafhbadclfgdae6mbkkk;2ileue97euo97dnaec98GgiTmbcbheinabcKfpx:ji:1S:ji:1S:ji:1S:ji:1SabpbbbglabczfgvpbbbgopmlvorxmPsCXQL358E8Fgrczp:Segwpxibbbibbbibbbibbbp9qp;6egDp;NegqaDaDp;MegDaDp;KealaopmbediwDqkzHOAKY8AEgDczp:Reczp:Sep;6eglalp;MeaDczp:Sep;6egoaop;Mearczp:Reczp:Sep;6egrarp;Mep;Kep;Kep;Lepxbbbbbbbbbbbbbbbbp:4ep;Jep;Mepxbbn0bbn0bbn0bbn0gDp;KepxFFbbFFbbFFbbFFbbgkp9oaqaop;MeaDp;Keczp:Rep9qgoaqalp;MeaDp;Keakp9oaqarp;MeaDp;Keczp:Rep9qgDpmwDKYqk8AExm35Ps8E8Fglp5eawclp:RegqpEi:T:j83ibavalp5baqpEd:T:j83ibabcwfaoaDpmbezHdiOAlvCXorQLgDp5eaqpEe:T:j83ibabaDp5baqpEb:T:j83ibabcafhbaeclfgeai6mbkkkuee97dnadcd4ae2c98GgeTmbcbhdinababpbbbgicwp:Recwp:Sep;6eaicep:SepxbbjFbbjFbbjFbbjFp9opxbbjZbbjZbbjZbbjZp:Uep;Mepkbbabczfhbadclfgdae6mbkkk:Sodw97euaec98Ghedndnadcl9hmbaeTmecbhdinabpxbbuJbbuJbbuJbbuJabpbbbgicKp:TeglaicYp:Tep9qgvcdp:Teavp9qgvclp:Teavp9qgop;6ep;Negvaicwp:RecKp:SegraipxFbbbFbbbFbbbFbbbgwp9ogDp:Uep;6ep;Mepxbbn0bbn0bbn0bbn0gqp;Kecwp:RepxbFbbbFbbbFbbbFbbp9oavaDarp:Xeaiczp:RecKp:Segip:Uep;6ep;Meaqp;Keawp9op9qavaDaraip:Uep:Xep;6ep;Meaqp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qavaoalcep:Rep9oalpxebbbebbbebbbebbbp9op9qp;6ep;Meaqp;KecKp:Rep9qpkbbabczfhbadclfgdae6mbxdkkaeTmbcbhdinabczfgkpxbFu9hbFu9hbFu9hbFu9habpbbbglakpbbbgrpmlvorxmPsCXQL358E8Fgvczp:TegqavcHp:Tep9qgicdp:Teaip9qgiclp:Teaip9qgicwp:Teaip9qgop;6ep;NegialarpmbediwDqkzHOAKY8AEgDpxFFbbFFbbFFbbFFbbglp9ograDczp:Segwp:Ueavczp:Reczp:SegDp:Xep;6ep;Mepxbbn0bbn0bbn0bbn0gvp;Kealp9oaiarawaDp:Uep:Xep;6ep;Meavp;Keczp:Rep9qgwaiaoaqcep:Rep9oaqpxebbbebbbebbbebbbp9op9qp;6ep;Meavp;Keczp:ReaiaDarp:Uep;6ep;Meavp;Kealp9op9qgipmwDKYqk8AExm35Ps8E8FpkbbabawaipmbezHdiOAlvCXorQLpkbbabcafhbadclfgdae6mbkkk9teiucbcbydj:G:cjbgeabcifc98GfgbBdj:G:cjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaikkxebcj:Gdklz:zbb",t=new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,3,2,0,0,5,3,1,0,1,12,1,0,10,22,2,12,0,65,0,65,0,65,0,252,10,0,0,11,7,0,65,0,253,15,26,11]),n=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var i=WebAssembly.validate(t)?o(e):o(a),s,r=WebAssembly.instantiate(i,{}).then(function(u){s=u.instance,s.exports.__wasm_call_ctors()});function o(u){for(var m=new Uint8Array(u.length),M=0;M<u.length;++M){var x=u.charCodeAt(M);m[M]=x>96?x-97:x>64?x-39:x+4}for(var S=0,M=0;M<u.length;++M)m[S++]=m[M]<60?n[m[M]]:(m[M]-60)*64+m[++M];return m.buffer.slice(0,S)}function l(u,m,M,x,S,w,T){var v=u.exports.sbrk,E=x+3&-4,C=v(E*S),I=v(w.length),k=new Uint8Array(u.exports.memory.buffer);k.set(w,I);var O=m(C,x,S,I,w.length);if(O==0&&T&&T(C,E,S),M.set(k.subarray(C,C+x*S)),v(C-v(0)),O!=0)throw new Error("Malformed buffer data: "+O)}var c={NONE:"",OCTAHEDRAL:"meshopt_decodeFilterOct",QUATERNION:"meshopt_decodeFilterQuat",EXPONENTIAL:"meshopt_decodeFilterExp",COLOR:"meshopt_decodeFilterColor"},h={ATTRIBUTES:"meshopt_decodeVertexBuffer",TRIANGLES:"meshopt_decodeIndexBuffer",INDICES:"meshopt_decodeIndexSequence"},d=[],f=0;function b(u){var m={object:new Worker(u),pending:0,requests:{}};return m.object.onmessage=function(M){var x=M.data;m.pending-=x.count,m.requests[x.id][x.action](x.value),delete m.requests[x.id]},m}function g(u){for(var m="self.ready = WebAssembly.instantiate(new Uint8Array(["+new Uint8Array(i)+"]), {}).then(function(result) { result.instance.exports.__wasm_call_ctors(); return result.instance; });self.onmessage = "+p.name+";"+l.toString()+p.toString(),M=new Blob([m],{type:"text/javascript"}),x=URL.createObjectURL(M),S=d.length;S<u;++S)d[S]=b(x);for(var S=u;S<d.length;++S)d[S].object.postMessage({});d.length=u,URL.revokeObjectURL(x)}function y(u,m,M,x,S){for(var w=d[0],T=1;T<d.length;++T)d[T].pending<w.pending&&(w=d[T]);return new Promise(function(v,E){var C=new Uint8Array(M),I=++f;w.pending+=u,w.requests[I]={resolve:v,reject:E},w.object.postMessage({id:I,count:u,size:m,source:C,mode:x,filter:S},[C.buffer])})}function p(u){var m=u.data;self.ready.then(function(M){if(!m.id)return self.close();try{var x=new Uint8Array(m.count*m.size);l(M,M.exports[m.mode],x,m.count,m.size,m.source,M.exports[m.filter]),self.postMessage({id:m.id,count:m.count,action:"resolve",value:x},[x.buffer])}catch(S){self.postMessage({id:m.id,count:m.count,action:"reject",value:S})}})}return{ready:r,supported:!0,useWorkers:function(u){g(u)},decodeVertexBuffer:function(u,m,M,x,S){l(s,s.exports.meshopt_decodeVertexBuffer,u,m,M,x,s.exports[c[S]])},decodeIndexBuffer:function(u,m,M,x){l(s,s.exports.meshopt_decodeIndexBuffer,u,m,M,x)},decodeIndexSequence:function(u,m,M,x){l(s,s.exports.meshopt_decodeIndexSequence,u,m,M,x)},decodeGltfBuffer:function(u,m,M,x,S,w){l(s,s.exports[h[S]],u,m,M,x,s.exports[c[w]])},decodeGltfBufferAsync:function(u,m,M,x,S){return d.length>0?y(u,m,M,h[x],c[S]):r.then(function(){var w=new Uint8Array(u*m);return l(s,s.exports[h[x]],w,u,m,M,s.exports[c[S]]),w})}}})();var Av=(function(){var a="b9H79Tebbbe:6eO9Geueu9Geub9Gbb9Gsuuuuuuuuuuuu99uueu9Gvuuuuub9Gruuuuuuub9Gouuuuuue999Gvuuuuueu9Gzuuuuuuuuuuu99uuuub9Gquuuuuuu99uueu9GPuuuuuuuuuuu99uueu9Gquuuuuuuu99ueu9Gruuuuuu99eu9Gwuuuuuu99ueu9Giuuue999Gluuuueu9Gluuuub9GiuuueuiLQdilvorlwDiqkxmPszbHHbelve9Weiiviebeoweuecj:Gdkr:Bdxo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bbz9TW79O9V9Wt9F79P9T9W29P9M95bw8E9TW79O9V9Wt9F79P9T9W29P9M959x9Pt9OcttV9P9I91tW7bD8A9TW79O9V9Wt9F79P9T9W29P9M959x9Pt9O9v9W9K9HtWbqQ9TW79O9V9Wt9F79P9T9W29P9M959t29V9W9W95bkX9TW79O9V9Wt9F79P9T9W29P9M959qV919UWbxQ9TW79O9V9Wt9F79P9T9W29P9M959q9V9P9Ut7bmX9TW79O9V9Wt9F79P9T9W29P9M959t9J9H2WbPa9TW79O9V9Wt9F9V9Wt9P9T9P96W9wWVtW94SWt9J9O9sW9T9H9Wbs59TW79O9V9Wt9F9NW9UWV9HtW9q9V79Pt9P9V9U9sW9T9H9Wbzl79IV9RbHDwebcekdCXq;y;WeQdbk;r:herYue99iuY99Xue9:D998Jjjjjbcj;sb9Rgs8Kjjjjbcbhzasc:Cefcbc;Kbz:tjjjb8AdnabaeSmbabaeadcdtzMjjjb8AkdnamcdGTmbalcrfci4cbyd1:H:cjbHjjjjbbhHasc:Cefasyd;8egecdtfaHBdbasaecefBd;8ecbhlcbhednadTmbabheadhOinaHaeydbci4fcb86bbaeclfheaOcufgOmbkcbhlabheadhOinaHaeydbgAci4fgCaCRbbgCceaAcrGgAtV86bbaCcu7aA4ceGalfhlaeclfheaOcufgOmbkcualcdtalcFFFFi0Ehekaecbyd1:H:cjbHjjjjbbhzasc:Cefasyd;8egecdtfazBdbasaecefBd;8ealcd4alfhOcehHinaHgecethHaeaO6mbkcbhXcuaecdtgOaecFFFFi0Ecbyd1:H:cjbHjjjjbbhHasc:Cefasyd;8egAcdtfaHBdbasaAcefBd;8eaHcFeaOz:tjjjbhQdnadTmbaecufhLcbhKindndnaQabaKcdtfgYydbgAc:v;t;h;Ev2aLGgOcdtfgCydbgHcuSmbceheinazaHcdtfydbaASmdaOaefhHaecefheaQaHaLGgOcdtfgCydbgHcu9hmbkkazaXcdtfaABdbaCaXBdbaXhHaXcefhXkaYaHBdbaKcefgKad9hmbkkaQcbyd:m:H:cjbH:bjjjbbasasyd;8ecufBd;8ekcbh8AcualcefgecdtaecFFFFi0Ecbyd1:H:cjbHjjjjbbhLasc:Cefasyd;8egecdtfaLBdbasaLBdNeasaecefBd;8ecuadcitadcFFFFe0Ecbyd1:H:cjbHjjjjbbhEasc:Cefasyd;8egecdtfaEBdbasaEBd:yeasaecefBd;8eascNefabadalcbz:cjjjbcualcdtgealcFFFFi0Eg3cbyd1:H:cjbHjjjjbbhOasc:Cefasyd;8egHcdtfaOBdbasaHcefBd;8ea3cbyd1:H:cjbHjjjjbbhQasc:Cefasyd;8egHcdtfaQBdbasaHcefBd;8eaOaQaialavazasc:Cefz:djjjbalcbyd1:H:cjbHjjjjbbhYasc:Cefasyd;8egHcdtfaYBdbasaHcefBd;8ea3cbyd1:H:cjbHjjjjbbhHasc:Cefasyd;8egAcdtfaHBdbasaAcefBd;8ea3cbyd1:H:cjbHjjjjbbhAasc:Cefasyd;8egCcdtfaABdbasaCcefBd;8eaHcFeaez:tjjjbh5aAcFeaez:tjjjbh8EdnalTmbindnaLa8AgAcefg8AcdtfydbgCaLaAcdtgefydbgHSmbaCaH9Rh8FaEaHcitfhaa8Eaefhha5aefhKcbhCindndnaaaCcitfydbgXaA9hmbaKaABdbahaABdbxekdnaLaXcdtggfgeclfydbgHaeydbgeSmbaHae9RhHaEaecitfheinaeydbaASmdaecwfheaHcufgHmbkka8EagfgeaAaXaeydbcuSEBdbaKaXaAaKydbcuSEBdbkaCcefgCa8F9hmbkka8Aal9hmbkaOhHaQhAa5hXa8EhCcbheindndnaeaHydbgK9hmbdnaeaAydbgK9hmbaXydbhKdnaCydbg8Fcu9hmbaKcu9hmbaYaefcb86bbxikdna8FcuSmbaKcuSmbaea8FSmbaOa8FcdtfydbaOaKcdtfydb9hmbaYaefcd86bbxikaYaefhadnaea8FSmbaeaKSmbaace86bbxikaacl86bbxdkdnaeaQaKcdtg8Ffydb9hmbdnaCydbgacuSmbaeaaSmbaXydbggcuSmbaeagSmba8Ea8FfydbghcuSmbahaKSmba5a8Ffydbg8FcuSmba8FaKSmbdnaOaacdtfydbgKaOa8Fcdtfydb9hmbaKaOagcdtfydbg8FSmba8FaOahcdtfydb9hmbaYaefcd86bbxlkaYaefcl86bbxikaYaefcl86bbxdkaYaefcl86bbxekaYaefaYaKfRbb86bbkaHclfhHaAclfhAaXclfhXaCclfhCalaecefge9hmbkdnamcaGTmbcbh8JindndnaYa8Jfg8KRbbg8Lc9:fPibebekdndndnaOa8Jcdtfydbgea8J9hmbdnaqmbcbh8FxdkdnazTmbcbh8Fa8JheinaqazaecdtgefydbfRbbce4a8FVceGh8FaQaefydbgea8J9hmbxikkcbh8Fa8JheinaqaefRbbce4a8FVceGh8FaQaecdtfydbgea8J9hmbxdkkaYaefRbbhexeka8JheindnaLaecdtg8AfgeclfydbgHaeydbgeSmbaHae9RhgaEaecitfhhaOa8AfhacbhKinahaKcitfydbgXhednindnaLaecdtgCfgeclfydbgHaeydbgeSmbaHae9RhHaEaecitfheaaydbhAdninaOaeydbcdtfydbaASmeaecwfheaHcufgHTmdxbkkcbhexdkaQaCfydbgeaX9hmbkceheka8FaeVh8FaKcefgKag9hmbkkaQa8Afydbgea8J9hmbka8Lcia8FceGEheka8Kae86bbka8Jcefg8Jal9hmbkkdnaqTmbdndnazTmbazheaOhHalhAindnaqaeydbfRbbceGTmbaYaHydbfcl86bbkaeclfheaHclfhHaAcufgAmbxdkkaqheaOhHalhAindnaeRbbceGTmbaYaHydbfcl86bbkaecefheaHclfhHaAcufgAmbkkaOhealhAaYhHindnaYaeydbfRbbcl9hmbaHcl86bbkaeclfheaHcefhHaAcufgAmbkkamceGTmbaYhealhHindnaeRbbce9hmbaecl86bbkaecefheaHcufgHmbkkcbh8Mcualcx2alc;v:Q;v:Qe0Ecbyd1:H:cjbHjjjjbbh8Nasc:Cefasyd;8egecdtfa8NBdbasaecefBd;8eascbBd:qeas9cb83i1ea8Naialavazasc1efz:ejjjbhydndnaDmbcbh8PcbhCxekcbhCawhecbhHindnaeIdbJbbbb9ETmbasaCcdtfaHBdbaCcefhCkaeclfheaDaHcefgH9hmbkcuaCal2gecdtaecFFFFi0Ecbyd1:H:cjbHjjjjbbh8Pasc:Cefasyd;8egecdtfa8PBdbasaecefBd;8ealTmbdnaCmbcbhCxekarcd4hgdnazTmbaCcdthhcbh8Fa8Phainaoaza8Fcdtfydbag2cdtfhKasheaahHaChAinaHaKaeydbcdtgXfIdbawaXfIdbNUdbaeclfheaHclfhHaAcufgAmbkaaahfhaa8Fcefg8Fal9hmbxdkkaCcdthhcbh8Fa8Phainaoa8Fag2cdtfhKasheaahHaChAinaHaKaeydbcdtgXfIdbawaXfIdbNUdbaeclfheaHclfhHaAcufgAmbkaaahfhaa8Fcefg8Fal9hmbkkcualc8S2gHalc;D;O;f8U0EgXcbyd1:H:cjbHjjjjbbheasc:Cefasyd;8egAcdtfaeBdbasaAcefBd;8eaecbaHz:tjjjbhIcbh8RcbhgdnaCTmbcbh8MaXcbyd1:H:cjbHjjjjbbhgasc:Cefasyd;8egecdtfagBdbasaecefBd;8eagcbaHz:tjjjb8AcuaCal2gecltgHaecFFFFb0Ecbyd1:H:cjbHjjjjbbh8Rasc:Cefasyd;8egecdtfa8RBdbasaecefBd;8ea8RcbaHz:tjjjb8AamcjjjjdGTmbcualcltgealcFFFFb0Ecbyd1:H:cjbHjjjjbbh8Masc:Cefasyd;8egHcdtfa8MBdbasaHcefBd;8ea8Mcbaez:tjjjb8AkdnadTmbcbhKabhHina8NaHclfydbg8Fcx2fgeIdba8NaHydbgacx2fgAIdbg8S:tgRa8NaHcwfydbghcx2fgXIdlaAIdlg8U:tg8VNaeIdla8U:tg8WaXIdba8S:tg8XN:tg8Ya8YNa8WaXIdwaAIdwg8Z:tg80NaeIdwa8Z:tg8Wa8VN:tg81a81Na8Wa8XNaRa80N:tg80a80NMMg8V:rhBa8Yh8Xa80h8Wa81hRdna8VJbbbb9EgATmba8YaB:vh8Xa80aB:vh8Wa81aB:vhRkaIaOaacdtfydbgXc8S2fgeaRaB:rg8VaRNNg83aeIdbMUdbaea8Wa8Va8WNgUNg85aeIdlMUdlaea8Xa8Va8XNg86Ng87aeIdwMUdwaeaRaUNgUaeIdxMUdxaea86aRNg88aeIdzMUdzaea8Wa86Ng89aeIdCMUdCaeaRa8Va8Xa8ZNaRa8SNa8Ua8WNMM:mg8:Ng86NgRaeIdKMUdKaea8Wa86Ng8WaeId3MUd3aea8Xa86Ng8XaeIdaMUdaaea86a8:Ng86aeId8KMUd8Kaea8VaeIdyMUdyaIaOa8Fcdtfydbg8Fc8S2fgea83aeIdbMUdbaea85aeIdlMUdlaea87aeIdwMUdwaeaUaeIdxMUdxaea88aeIdzMUdzaea89aeIdCMUdCaeaRaeIdKMUdKaea8WaeId3MUd3aea8XaeIdaMUdaaea86aeId8KMUd8Kaea8VaeIdyMUdyaIaOahcdtfydbgac8S2fgea83aeIdbMUdbaea85aeIdlMUdlaea87aeIdwMUdwaeaUaeIdxMUdxaea88aeIdzMUdzaea89aeIdCMUdCaeaRaeIdKMUdKaea8WaeId3MUd3aea8XaeIdaMUdaaea86aeId8KMUd8Kaea8VaeIdyMUdydna8MTmbdnaATmba8YaB:vh8Ya80aB:vh80a81aB:vh81ka8MaXcltfgeaBJbbbZNgRa80Ng8VaeIdlMUdlaeaRa8YNg8WaeIdwMUdwaeaRa81Ng8XaeIdbMUdbaeaRa8S:ma81Na8Ua80N:ta8Za8YN:tNgRaeIdxMUdxa8Ma8Fcltfgea8VaeIdlMUdlaea8WaeIdwMUdwaea8XaeIdbMUdbaeaRaeIdxMUdxa8Maacltfgea8VaeIdlMUdlaea8WaeIdwMUdwaea8XaeIdbMUdbaeaRaeIdxMUdxkaHcxfhHaKcifgKad6mbkkdnalTmbJq;x8J88J;n;m;m89J:v:;;w8ZamczGEamc;abGEh80cbhHaOhXazhKaIhea8NhAindnaHaXydb9hmbaHh8FdnazTmbaKydbh8Fka80hRdnaqTmbJbbjZa80aqa8FfRbbclGEhRkaecxfg8Fa8FIdbJbbbbMUdbaeczfg8Fa8FIdbJbbbbMUdbaecCfg8Fa8FIdbJbbbbMUdbaeaRaecyfg8FIdbg8YNgRaeIdbMUdbaeclfgaaRaaIdbMUdbaecwfgaaRaaIdbMUdbaecKfgaaaIdbaAIdbg8WaRN:tUdbaAcwfIdbh8Vaec3fgaaaIdbaRaAclfIdbg8XN:tUdbaecafgaaaIdbaRa8VN:tUdbaec8KfgaIdbh81a8Fa8YaRMUdbaaa81aRa8Va8VNa8Wa8WNa8Xa8XNMMNMUdbkaXclfhXaKclfhKaec8SfheaAcxfhAalaHcefgH9hmbkkdnadTmbcbh8Aabhainaba8Acdtfh8FcbhHinaYa8FaHc:G:G:cjbfydbcdtfydbgAfRbbhedndnaYaaaHfydbgXfRbbgKc99fcFeGcpe0mbaec99fcFeGc;:e6mekdnaKcufcFeGce0mba5aXcdtfydbaA9hmekdnaecufcFeGce0mba8EaAcdtfydbaX9hmekJbbacJbbacJbbbZaecFeGceSEaKcFeGceSEhUdna8Na8FaHc:K:G:cjbfydbcdtfydbcx2fgeIdwa8NaXcx2fgKIdwg86:tg8Sa8NaAcx2fghIdwa86:tg8Xa8XNahIdbaKIdbg8U:tg80a80NahIdlaKIdlg8Z:tg8Va8VNMMg81Na8Xa8Sa8XNaeIdba8U:tg83a80Na8VaeIdla8Z:tg85NMMg8WN:tg8Ya8YNa83a81Na80a8WN:tgRaRNa85a81Na8Va8WN:tg8Wa8WNMMgBJbbbb9ETmba8YaB:rgB:vh8Ya8WaB:vh8WaRaB:vhRkaUa81:rNgBa8Ya86NaRa8UNa8Za8WNMM:mg81Ng87a81Nh88a80a85Na8Va83N:tg81a81Na8Va8SNa8Xa85N:tg8Va8VNa8Xa83Na80a8SN:tg8Xa8XNMMg83:rh80a8Ya87Nh85a8Wa87Nh89aRa87Nh87a8WaBa8YNg8SNh8:a8SaRNhZaRaBa8WNgnNhca8Ya8SNh8Ya8WanNh8WaRaBaRNNh8Sdna83Jbbbb9ETmba81a80:vh81a8Xa80:vh8Xa8Va80:vh8VkaIaOaXcdtfydbc8S2fgeaeIdba8Sa8VaUa80:rNgRa8VNNMg80MUdbaea8Wa8XaRa8XNg8SNMg83aeIdlMUdlaea8Ya81aRa81Ng8WNMg8YaeIdwMUdwaeaca8Va8SNMg8SaeIdxMUdxaeaZa8Wa8VNMgUaeIdzMUdzaea8:a8Xa8WNMg8WaeIdCMUdCaea87a8VaRa81a86Na8Va8UNa8Za8XNMMg86:mNgRNMg8VaeIdKMUdKaea89a8XaRNMg8XaeId3MUd3aea85a81aRNMg81aeIdaMUdaaea88a86aRN:tgRaeId8KMUd8KaeaBaeIdyMUdyaIaOaAcdtfydbc8S2fgea80aeIdbMUdbaea83aeIdlMUdlaea8YaeIdwMUdwaea8SaeIdxMUdxaeaUaeIdzMUdzaea8WaeIdCMUdCaea8VaeIdKMUdKaea8XaeId3MUd3aea81aeIdaMUdaaeaRaeId8KMUd8KaeaBaeIdyMUdykaHclfgHcx9hmbkaacxfhaa8Acifg8Aad6mbkaCTmbcbhainJbbbbh80a8Nabaacdtfgeclfydbg8Fcx2fgHIdwa8Naeydbghcx2fgAIdwg8Z:tg8Va8VNaHIdbaAIdbg83:tg8Wa8WNaHIdlaAIdlg85:tg8Xa8XNMMg8Sa8Naecwfydbg8Acx2fgeIdwa8Z:tg8YNa8Va8YNa8WaeIdba83:tg81Na8XaeIdla85:tgBNMMgRa8VN:tJbbbbJbbjZa8Sa8Ya8YNa81a81NaBaBNMMg8UNaRaRN:tg86:va86Jbbbb9BEg86Nh88a8Ua8VNaRa8YN:ta86Nh89a8SaBNaRa8XN:ta86Nh8:a8Ua8XNaRaBN:ta86NhZa8Sa81NaRa8WN:ta86Nhna8Ua8WNaRa81N:ta86Nhca8WaBNa8Xa81N:tgRaRNa8Xa8YNa8VaBN:tgRaRNa8Va81Na8Wa8YN:tgRaRNMM:rJbbbZNhRa8PahaC2g8JcdtfhHa8Pa8AaC2gDcdtfhAa8Pa8FaC2g8KcdtfhXa8Z:mh9ca85:mhJa83:mh9eascjdfheaChKJbbbbhBJbbbbh86Jbbbbh8SJbbbbh8UJbbbbh8ZJbbbbh83Jbbbbh85Jbbbbh87JbbbbhUinaecwfaRa89aXIdbaHIdbg8Y:tg8XNa88aAIdba8Y:tg81NMg8VNUdbaeclfaRaZa8XNa8:a81NMg8WNUdbaeaRaca8XNana81NMg8XNUdbaecxfaRa9ca8VNaJa8WNa8Ya9ea8XNMMMg8YNUdbaRa8Va8WNNa8ZMh8ZaRa8Va8XNNa8UMh8UaRa8Wa8XNNa8SMh8SaRa8Ya8YNNaUMhUaRa8Va8YNNa87Mh87aRa8Wa8YNNa85Mh85aRa8Xa8YNNa83Mh83aRa8Va8VNNa86Mh86aRa8Wa8WNNaBMhBaRa8Xa8XNNa80Mh80aHclfhHaXclfhXaAclfhAaeczfheaKcufgKmbkagahc8S2fgea80aeIdbMUdbaeaBaeIdlMUdlaea86aeIdwMUdwaea8SaeIdxMUdxaea8UaeIdzMUdzaea8ZaeIdCMUdCaea83aeIdKMUdKaea85aeId3MUd3aea87aeIdaMUdaaeaUaeId8KMUd8KaeaRaeIdyMUdyaga8Fc8S2fgea80aeIdbMUdbaeaBaeIdlMUdlaea86aeIdwMUdwaea8SaeIdxMUdxaea8UaeIdzMUdzaea8ZaeIdCMUdCaea83aeIdKMUdKaea85aeId3MUd3aea87aeIdaMUdaaeaUaeId8KMUd8KaeaRaeIdyMUdyaga8Ac8S2fgea80aeIdbMUdbaeaBaeIdlMUdlaea86aeIdwMUdwaea8SaeIdxMUdxaea8UaeIdzMUdzaea8ZaeIdCMUdCaea83aeIdKMUdKaea85aeId3MUd3aea87aeIdaMUdaaeaUaeId8KMUd8KaeaRaeIdyMUdya8Ra8Jcltfh8FcbhHaChXina8FaHfgeascjdfaHfgAIdbaeIdbMUdbaeclfgKaAclfIdbaKIdbMUdbaecwfgKaAcwfIdbaKIdbMUdbaecxfgeaAcxfIdbaeIdbMUdbaHczfhHaXcufgXmbka8Ra8Kcltfh8FcbhHaChXina8FaHfgeascjdfaHfgAIdbaeIdbMUdbaeclfgKaAclfIdbaKIdbMUdbaecwfgKaAcwfIdbaKIdbMUdbaecxfgeaAcxfIdbaeIdbMUdbaHczfhHaXcufgXmbka8RaDcltfh8FcbhHaChXina8FaHfgeascjdfaHfgAIdbaeIdbMUdbaeclfgKaAclfIdbaKIdbMUdbaecwfgKaAcwfIdbaKIdbMUdbaecxfgeaAcxfIdbaeIdbMUdbaHczfhHaXcufgXmbkaacifgaad6mbkkcbhAdndnamcwGgTmbJbbbbh8ScbhScbh9hcbh9ixekcbhSa3cbyd1:H:cjbHjjjjbbh9iasc:Cefasyd;8egecdtfa9iBdbasaecefBd;8ecua9ialabadaOz:fjjjbgXcltaXcjjjjiGEcbyd1:H:cjbHjjjjbbh9hasc:Cefasyd;8egecdtfa9hBdbasaecefBd;8ea9haXa9ia8Nalz:gjjjbJFFuuh8SaXTmba9hheaXhHinaeIdbgRa8Sa8SaR9EEh8SaeclfheaHcufgHmbkaXhSkdnalTmbaLclfheaLydbhXaYhHalhKcbhAincbaeydbg8FaX9RaHRbbcpeGEaAfhAaHcefhHaeclfhea8FhXaKcufgKmbkaAce4hAkcuadaA9Rcifg6cx2a6c;v:Q;v:Qe0Ecbyd1:H:cjbHjjjjbbh9kasc:Cefasyd;8egecdtfa9kBdbasaecefBd;8ecua6cdta6cFFFFi0Ecbyd1:H:cjbHjjjjbbh0asc:Cefasyd;8egecdtfa0BdbasaecefBd;8ea3cbyd1:H:cjbHjjjjbbh9masc:Cefasyd;8egecdtfa9mBdbasaecefBd;8ealcbyd1:H:cjbHjjjjbbh9nasc:Cefasyd;8egecdtfa9nBdbasaecefBd;8eaxaxNayJbbjZamclGEgZaZN:vh87JbbbbhUdnadak9nmbdna6ci6mbaCclth9oa9kcwfh9pJbbbbh85JbbbbhUinascNefabadalaOz:cjjjbabh8Acbh9qcbh9rinaba9rcdtfhDcbheindnaOa8AaefydbgAcdtghfydbgXaOaDaec:W:G:cjbfydbcdtfydbgHcdtg8JfydbgKSmbaYaHfRbbgacv2aYaAfRbbg8FfRb;a:G:cjbg8La8Fcv2aafg8KRb;a:G:cjbg3VcFeGTmbdnaKaX9nmba8KRb;G:G:cjbcFeGmekdna8FcufcFeGce0mbaaTmba5ahfydbaH9hmekdna8FTmbaacufcFeGce0mba8Ea8JfydbaA9hmeka9ka9qcx2fgXaHaAa3cFeGgKEBdlaXaAaHaKEBdbaXaKa8LGcb9hBdwa9qcefh9qkaeclfgecx9hmbkdna9rcifg9rad9pmba8Acxfh8Aa9qcifa69nmekka9qTmdcbh8KinaIaOa9ka8Kcx2fghydbgKcdtgXfydbg8Ac8S2fgeIdwa8Nahydlg8Fcx2fgHIdwg8WNaeIdzaHIdbg8XNaeIdaMgRaRMMa8WNaeIdlaHIdlg8YNaeIdCa8WNaeId3MgRaRMMa8YNaeIdba8XNaeIdxa8YNaeIdKMgRaRMMa8XNaeId8KMMM:lhRJbbbbJbbjZaeIdyg8V:va8VJbbbb9BEh8VdndnahydwgDmbJFFuuh86xekJbbbbJbbjZaIaOa8Fcdtfydbc8S2fgeIdyg81:va81Jbbbb9BEaeIdwa8NaKcx2fgHIdwg81NaeIdzaHIdbg80NaeIdaMgBaBMMa81NaeIdlaHIdlgBNaeIdCa81NaeId3Mg81a81MMaBNaeIdba80NaeIdxaBNaeIdKMg81a81MMa80NaeId8KMMM:lNh86ka8VaRNhBdnaCTmbagaKc8S2fgAIdwa8WNaAIdza8XNaAIdaMgRaRMMa8WNaAIdla8YNaAIdCa8WNaAId3MgRaRMMa8YNaAIdba8XNaAIdxa8YNaAIdKMgRaRMMa8XNaAId8KMMMhRa8Pa8FaC2gacdtfhHa8RaKaC2g8JcltfheaAIdyh81aChAinaHIdbg8Va8Va81NaecxfIdba8WaecwfIdbNa8XaeIdbNa8YaeclfIdbNMMMg8Va8VM:tNaRMhRaHclfhHaeczfheaAcufgAmbkdndnaDmbJbbbbh8Vxekaga8Fc8S2fgAIdwa8NaKcx2fgeIdwg8XNaAIdzaeIdbg8YNaAIdaMg8Va8VMMa8XNaAIdlaeIdlg81NaAIdCa8XNaAId3Mg8Va8VMMa81NaAIdba8YNaAIdxa81NaAIdKMg8Va8VMMa8YNaAId8KMMMh8Va8Pa8JcdtfhHa8RaacltfheaAIdyh80aChAinaHIdbg8Wa8Wa80NaecxfIdba8XaecwfIdbNa8YaeIdbNa81aeclfIdbNMMMg8Wa8WM:tNa8VMh8VaHclfhHaeczfheaAcufgAmbka8V:lh8VkaBaR:lMhBa86a8VMh86dndndnaYaKfRbbc9:fPddbekaQaXfydbgXaKSmbaOa8Fcdtfydbh8Jindndna5aXcdtgafydbgecuSmbaOaecdtfydba8JSmekdna8EaafydbgecuSmbaOaecdtfydba8JSmeka8FhekagaXc8S2fgAIdwa8Naecx2fgHIdwg8WNaAIdzaHIdbg8XNaAIdaMgRaRMMa8WNaAIdlaHIdlg8YNaAIdCa8WNaAId3MgRaRMMa8YNaAIdba8XNaAIdxa8YNaAIdKMgRaRMMa8XNaAId8KMMMhRa8PaeaC2cdtfhHa8RaXaC2cltfheaAIdyh81aChAinaHIdbg8Va8Va81NaecxfIdba8WaecwfIdbNa8XaeIdbNa8YaeclfIdbNMMMg8Va8VM:tNaRMhRaHclfhHaeczfheaAcufgAmbkaBaR:lMhBaQaafydbgXaK9hmbkkaYa8FfRbbci9hmeaDTmeaQa8FcdtfydbgXa8FSmeindndna5aXcdtgafydbgecuSmbaOaecdtfydba8ASmekdna8EaafydbgecuSmbaOaecdtfydba8ASmekaKhekagaXc8S2fgAIdwa8Naecx2fgHIdwg8WNaAIdzaHIdbg8XNaAIdaMgRaRMMa8WNaAIdlaHIdlg8YNaAIdCa8WNaAId3MgRaRMMa8YNaAIdba8XNaAIdxa8YNaAIdKMgRaRMMa8XNaAId8KMMMhRa8PaeaC2cdtfhHa8RaXaC2cltfheaAIdyh81aChAinaHIdbg8Va8Va81NaecxfIdba8WaecwfIdbNa8XaeIdbNa8YaeclfIdbNMMMg8Va8VM:tNaRMhRaHclfhHaeczfheaAcufgAmbka86aR:lMh86aQaafydbgXa8F9hmbxdkkdna8Ea5a5aXfydba8FSEaQaXfydbgacdtfydbgXcu9hmbaQa8FcdtfydbhXkagaac8S2fgAIdwa8NaXcx2fgeIdwg8WNaAIdzaeIdbg8XNaAIdaMgRaRMMa8WNaAIdlaeIdlg8YNaAIdCa8WNaAId3MgRaRMMa8YNaAIdba8XNaAIdxa8YNaAIdKMgRaRMMa8XNaAId8KMMMhRa8PaXaC2g8AcdtfhHa8RaaaC2g8JcltfheaAIdyh81aChAinaHIdbg8Va8Va81NaecxfIdba8WaecwfIdbNa8XaeIdbNa8YaeclfIdbNMMMg8Va8VM:tNaRMhRaHclfhHaeczfheaAcufgAmbkdndnaDmbJbbbbh8VxekagaXc8S2fgAIdwa8Naacx2fgeIdwg8XNaAIdzaeIdbg8YNaAIdaMg8Va8VMMa8XNaAIdlaeIdlg81NaAIdCa8XNaAId3Mg8Va8VMMa81NaAIdba8YNaAIdxa81NaAIdKMg8Va8VMMa8YNaAId8KMMMh8Va8Pa8JcdtfhHa8Ra8AcltfheaAIdyh80aChAinaHIdbg8Wa8Wa80NaecxfIdba8XaecwfIdbNa8YaeIdbNa81aeclfIdbNMMMg8Wa8WM:tNa8VMh8VaHclfhHaeczfheaAcufgAmbka8V:lh8VkaBaR:lMhBa86a8VMh86kaha86aBa86aB9DgeEUdwahaKa8FaeaDcb9hGgeEBdlaha8FaKaeEBdba8Kcefg8Ka9q9hmbkascjdfcbcj;qbz:tjjjb8Aa9phea9qhHinascjdfaeydbcA4cF8FGgAcFAaAcFA6EcdtfgAaAydbcefBdbaecxfheaHcufgHmbkcbhecbhHinascjdfaefgAydbhXaAaHBdbaXaHfhHaeclfgecj;qb9hmbkcbhea9phHinascjdfaHydbcA4cF8FGgAcFAaAcFA6EcdtfgAaAydbgAcefBdba0aAcdtfaeBdbaHcxfhHa9qaecefge9hmbkadak9RgAci9Uh9sdnalTmbcbhea9mhHinaHaeBdbaHclfhHalaecefge9hmbkkcbh9ta9ncbalz:tjjjbh3aAcO9Uh9ua9sce4h9rcbh8Lcbh8Kdnina9ka0a8Kcdtfydbcx2fg8JIdwgRa879Emea8La9s9pmeJFFuuh8Vdna9ra9q9pmba9ka0a9rcdtfydbcx2fIdwJbb;aZNh8VkdnaRa8V9ETmbaRaU9ETmba8La9u0mdkdna3aOa8JydlgDcdtg9vfg8AydbgAfg9wRbba3aOa8Jydbghcdtg9xfydbgefg9yRbbVmbaYahfRbbh9zdndnaLaecdtfgHclfydbgXaHydbgHSmbaXaH9RhXa8NaAcx2fh8Fa8Naecx2fhaaEaHcitfheindna9maeydbcdtfydbgHaASmba9maeclfydbcdtfydbgKaASmbaHaKSmba8NaKcx2fgKIdba8NaHcx2fgHIdbg8W:tgRaaIdlaHIdlg8X:tg80NaKIdla8X:tg8VaaIdba8W:tgBN:tg8YaRa8FIdla8X:tg86Na8Va8FIdba8W:tg8UN:tg8XNa8VaaIdwaHIdwg81:tg8ZNaKIdwa81:tg8Wa80N:tg80a8Va8FIdwa81:tg83Na8Wa86N:tg8VNa8WaBNaRa8ZN:tg81a8Wa8UNaRa83N:tgRNMMa8Ya8YNa80a80Na81a81NMMa8Xa8XNa8Va8VNaRaRNMMN:rJbbj8:N9FmikaecwfheaXcufgXmbkkdndndndna9zc9:fPdebdkahheina8AydbhAdndna5aecdtgHfydbgecuSmbaOaecdtfydbaASmekdna8EaHfydbgecuSmbaOaecdtfydbaASmekaDheka9maHfaeBdbaQaHfydbgeah9hmbxikkdna8Ea5a5a9xfydbaDSEaQa9xfydbghcdtfydbgecu9hmbaQa9vfydbheka9ma9xfaDBdbaehDka9mahcdtfaDBdbka9yce86bba9wce86bba8JIdwgRaUaUaR9DEhUa9tcefh9tcecda9zceSEa8Lfh8Lxeka9rcefh9rka8Kcefg8Ka9q9hmbkka9tTmddnalTmbcbh8Fcbhhindna9mahcdtgefydbgAahSmbaOaAcdtfydbh8AdnahaOaefydb9hg8JmbaIa8Ac8S2fgeaIahc8S2fgHIdbaeIdbMUdbaeaHIdlaeIdlMUdlaeaHIdwaeIdwMUdwaeaHIdxaeIdxMUdxaeaHIdzaeIdzMUdzaeaHIdCaeIdCMUdCaeaHIdKaeIdKMUdKaeaHId3aeId3MUd3aeaHIdaaeIdaMUdaaeaHId8KaeId8KMUd8KaeaHIdyaeIdyMUdya8MTmba8Ma8Acltfgea8MahcltfgHIdbaeIdbMUdbaeaHIdlaeIdlMUdlaeaHIdwaeIdwMUdwaeaHIdxaeIdxMUdxkaCTmbagaAc8S2fgeagahc8S2gDfgHIdbaeIdbMUdbaeaHIdlaeIdlMUdlaeaHIdwaeIdwMUdwaeaHIdxaeIdxMUdxaeaHIdzaeIdzMUdzaeaHIdCaeIdCMUdCaeaHIdKaeIdKMUdKaeaHId3aeId3MUd3aeaHIdaaeIdaMUdaaeaHId8KaeId8KMUd8KaeaHIdyaeIdyMUdya9oaA2haa8RhHaChXinaHaafgeaHa8FfgAIdbaeIdbMUdbaeclfgKaAclfIdbaKIdbMUdbaecwfgKaAcwfIdbaKIdbMUdbaecxfgeaAcxfIdbaeIdbMUdbaHczfhHaXcufgXmbka8JmbJbbbbJbbjZaIaDfgeIdygR:vaRJbbbb9BEaeIdwa8Na8Acx2fgHIdwgRNaeIdzaHIdbg8VNaeIdaMg8Wa8WMMaRNaeIdlaHIdlg8WNaeIdCaRNaeId3MgRaRMMa8WNaeIdba8VNaeIdxa8WNaeIdKMgRaRMMa8VNaeId8KMMM:lNgRa85a85aR9DEh85ka8Fa9ofh8Fahcefghal9hmbkcbhHa5heindnaeydbgAcuSmbdnaHa9maAcdtgXfydbgA9hmbcuhAa5aXfydbgXcuSmba9maXcdtfydbhAkaeaABdbkaeclfhealaHcefgH9hmbkcbhHa8EheindnaeydbgAcuSmbdnaHa9maAcdtgXfydbgA9hmbcuhAa8EaXfydbgXcuSmba9maXcdtfydbhAkaeaABdbkaeclfhealaHcefgH9hmbkka85aUaCEh85cbhHabhecbhAindnaOa9maeydbcdtfydbg8FcdtfydbgXaOa9maeclfydbcdtfydbgacdtfydbgKSmbaXaOa9maecwfydbcdtfydbg8AcdtfydbghSmbaKahSmbabaHcdtfgXa8FBdbaXcwfa8ABdbaXclfaaBdbaHcifhHkaecxfheaAcifgAad6mbkdndnaTmbaHhdxekdnaHak0mbaHhdxekdna8Sa859FmbaHhdxekJFFuuh8ScbhdabhecbhAindna9ha9iaeydbgXcdtfydbcdtfIdbgRa859ETmbaeclf8Pdbh9AabadcdtfgKaXBdbaKclfa9A83dbaRa8Sa8SaR9EEh8SadcifhdkaecxfheaAcifgAaH6mbkkadak0mbxdkkascNefabadalaOz:cjjjbkdndnadak0mbadhaxekdnaTmbadhaxekdna8Sa879FmbadhaxekcehKina8SJbb;aZNgRa87aRa879DEh8WJbbbbhRdnaSTmba9hheaShHinaeIdbg8VaRa8Va8W9FEaRa8VaR9EEhRaeclfheaHcufgHmbkkJFFuuh8ScbhaabhecbhHindna9ha9iaeydbgAcdtfydbcdtfIdbg8Va8W9ETmbaeclf8Pdbh9AabaacdtfgXaABdbaXclfa9A83dba8Va8Sa8Sa8V9EEh8SaacifhakaecxfheaHcifgHad6mbkdnaKaaad9hVceGmbadhaxdkaRaUaUaR9DEhUaaak9nmecbhKaahda8Sa879FmbkkdnamcjjjjdGTmba9ncbalz:tjjjbh8AdnaaTmbabheaahHina8AaeydbgAfce86bba8AaOaAcdtfydbfce86bbaeclfheaHcufgHmbkkascNefabaaalaOz:cjjjbdndnalTmbcbhXindna8AaXfRbbTmbdnaYaXfRbbgecl0mbceaetcQGmekdnaOaXcdtg8FfydbgeaXSmba8NaXcx2fgHa8Naecx2fgeydwBdwaHae8Pdb83dbxekaIaXc8S2fgKIdygcacJL:3;rUNgRMh87aKIdwg9BaRMh8SaKIdlg9CaRMh8UaKIdbg9DaRMh81aKIdag9EaRa8NaXcx2fg8JIdwg88N:th8ZaKId3g9FaRa8JIdlg89N:th83aKIdKg9Ga8JIdbg8:aRN:th80JbbbbhnaKIdCg9HJbbbbMh85aKIdzg9IJbbbbMhBaKIdxg9JJbbbbMh86dndnaCTmbaXhAinJbbbba87agaAc8S2fgHIdygR:vaRJbbbb9BEhRa8RaAaC2cltfheaHIdaa87Na8ZMh8ZaHId3a87Na83Mh83aHIdKa87Na80Mh80aHIdCa87Na85Mh85aHIdza87NaBMhBaHIdxa87Na86Mh86aHIdwa87Na8SMh8SaHIdla87Na8UMh8UaHIdba87Na81Mh81aChHina8ZaecwfIdbg8VaecxfIdbg8YNaRN:th8Za83aeclfIdbg8Wa8YNaRN:th83a85a8Wa8VNaRN:th85a81aeIdbg8Xa8XNaRN:th81a80a8Xa8YNaRN:th80aBa8Xa8VNaRN:thBa86a8Xa8WNaRN:th86a8Sa8Va8VNaRN:th8Sa8Ua8Wa8WNaRN:th8UaeczfheaHcufgHmbkaQaAcdtfydbgAaX9hmbka8MTmba8MaXcltfgeIdxhxaeIdwh9caeIdlhJaeIdbhRxekJbbbbhxJbbbbh9cJbbbbhJJbbbbhRkaBa81:vg8Wa80Na8Z:ta85aBa86a81:vg8VN:tg8Za8Ua86a8VN:tg8Y:vg8Xa8Va80Na83:tg8UN:th83a9caRa8WN:taJaRa8VN:tg86a8XN:tg85a8SaBa8WN:ta8Za8XN:tgB:vg8S:mh8Za86a8Y:vg9c:mhJdnJbbbbaRaRa81:vg9eN:ta86a9cN:ta85a8SN:tg86:la87J:983:g81NgR9ETmba8Za83NaJa8UNa9ea80Nax:tMMa86:vhnka81:laR9ETmba8Y:laR9ETmbaB:laR9ETmba9e:manNa8W:ma8ZanNa83aB:vMgBNa8V:maJanNa8X:maBNa8Ua8Y:vMMg85Na80:ma81:vMMMh87aLa8FfgeclfydbgHaeydbge9RhhaEaecitfh8FJbbbbhRdnaHaeSgDmbJbbbbhRa8FheahhAina8Naeclfydbcx2fgHIdwa88:tg8Va8VNaHIdba8::tg8Va8VNaHIdla89:tg8Va8VNMMg8Va8Naeydbcx2fgHIdwa88:tg8Wa8WNaHIdba8::tg8Wa8WNaHIdla89:tg8Wa8WNMMg8WaRaRa8W9DEgRaRa8V9DEhRaecwfheaAcufgAmbkaR:rgRaRNhRkaBa88:tg8Va8VNa87a8::tg8Va8VNa85a89:tg8Va8VNMMaR9EmbaKId8KhndnaDmbina8Na8Fclfydbcx2fgeIdba8Na8Fydbcx2fgHIdbg8W:tgRa89aHIdlg8X:tg80NaeIdla8X:tg8Va8:a8W:tg86N:tg8YaRa85a8X:tg8SNa8Va87a8W:tg8UN:tg8XNa8Va88aHIdwg81:tg8ZNaeIdwa81:tg8Wa80N:tg80a8VaBa81:tg83Na8Wa8SN:tg8VNa8Wa86NaRa8ZN:tg81a8Wa8UNaRa83N:tgRNMMa8Ya8YNa80a80Na81a81NMMa8Xa8XNa8Va8VNaRaRNMMN:rJbbj8:N9Fmda8Fcwfh8FahcufghmbkkJbbbbJbbjZac:vacJbbbb9BEgRa9BaBNa9Ia87Na9EMg8Va8VMMaBNa9Ca85Na9HaBNa9FMg8Va8VMMa85Na9Da87Na9Ja85Na9GMg8Va8VMMa87NanMMM:lNaRa9Ba88Na9Ia8:Na9EMg8Va8VMMa88Na9Ca89Na9Ha88Na9FMg8Va8VMMa89Na9Da8:Na9Ja89Na9GMg8Va8VMMa8:NanMMM:lNJbb;aZNJ:983:g81M9Emba8JaBUdwa8Ja85Udla8Ja87UdbkaXcefgXal9hmbkdnaCmbcbhCxdkcbhXindna8AaXfRbbTmbaOaXcdtgefydbaX9hmbaYaXfhhaQaefh8Ja8NaXcx2fhAa8PaXaC2cdtfhDcbhEincuhLdnahRbbci9hmbaXhLa8JydbgeaXSmba8PaEcdtgHfhKaDaHfIdbhRaXhLinaLhHcuhLdnaKaeaC2cdtfIdbaR9CmbaHcuSmbaHhLagaec8S2fIdyagaHc8S2fIdy9ETmbaehLkaQaecdtfydbgeaX9hmbkka8PaEcdtfhKa8RaEcltfh8FaXheinaKaeaC2cdtfJbbbbJbbjZagaeaLaLcuSEgHc8S2fIdygR:vaRJbbbb9BEa8FaHaC2cltfgHIdwaAIdwNaHIdbaAIdbNaHIdlaAIdlNMMaHIdxMNUdbaQaecdtfydbgeaX9hmbkaEcefgEaC9hmbkkaXcefgXal9hmbxdkkaCmbcbhCkaiavaoarawaCala8Na8Pazasayasc1efaYa8Aaqz:hjjjbkdnamcjjjjlGTmbazmbaaTmbabhecbhLinaYaeydbgAfRbbc3thQaecwfgXydbhHcjjjj94hCdna5aAcdtgEfydbaeclfgKydbgOSmbcjjjj94cba8EaOcdtfydbaASEhCkaeaQaCVaAVBdbaYaOfRbbc3th8Fcjjjj94hCcjjjj94hQdna5aOcdtfydbaHSmbcjjjj94cba8EaHcdtfydbaOSEhQkaKa8FaQVaOVBdbaYaHfRbbc3thOdna5aHcdtfydbaASmbcjjjj94cba8EaEfydbaHSEhCkaXaOaCVaHVBdbaecxfheaLcifgLaa6mbkkdnazTmbaaTmbaaheinabazabydbcdtfydbBdbabclfhbaecufgembkkdnaPTmbaPaZaU:rNUdbkdnasyd;8egHTmbaHcdtasc:Ceffc98fheinaeydbcbyd:m:H:cjbH:bjjjbbaec98fheaHcufgHmbkkascj;sbf8Kjjjjbaak;Yieouabydlhvabydbclfcbaicdtz:tjjjbhoadci9UhrdnadTmbdnalTmbaehwadhDinaoalawydbcdtfydbcdtfgqaqydbcefBdbawclfhwaDcufgDmbxdkkaehwadhDinaoawydbcdtfgqaqydbcefBdbawclfhwaDcufgDmbkkdnaiTmbcbhDaohwinawydbhqawaDBdbawclfhwaqaDfhDaicufgimbkkdnadci6mbinaecwfydbhwaeclfydbhDaeydbhidnalTmbalawcdtfydbhwalaDcdtfydbhDalaicdtfydbhikavaoaicdtfgqydbcitfaDBdbavaqydbcitfawBdlaqaqydbcefBdbavaoaDcdtfgqydbcitfawBdbavaqydbcitfaiBdlaqaqydbcefBdbavaoawcdtfgwydbcitfaiBdbavawydbcitfaDBdlawawydbcefBdbaecxfhearcufgrmbkkabydbcbBdbk:todDue99aicd4aifhrcehwinawgDcethwaDar6mbkcuaDcdtgraDcFFFFi0Ecbyd1:H:cjbHjjjjbbhwaoaoyd9GgqcefBd9GaoaqcdtfawBdbawcFearz:tjjjbhkdnaiTmbalcd4hlaDcufhxcbhminamhDdnavTmbavamcdtfydbhDkcbadaDal2cdtfgDydlgwawcjjjj94SEgwcH4aw7c:F:b:DD2cbaDydbgwawcjjjj94SEgwcH4aw7c;D;O:B8J27cbaDydwgDaDcjjjj94SEgDcH4aD7c:3F;N8N27axGhwamcdthPdndndnavTmbakawcdtfgrydbgDcuSmeadavaPfydbal2cdtfgsIdbhzcehqinaqhrdnadavaDcdtfydbal2cdtfgqIdbaz9CmbaqIdlasIdl9CmbaqIdwasIdw9BmlkarcefhqakawarfaxGgwcdtfgrydbgDcu9hmbxdkkakawcdtfgrydbgDcuSmbadamal2cdtfgsIdbhzcehqinaqhrdnadaDal2cdtfgqIdbaz9CmbaqIdlasIdl9CmbaqIdwasIdw9BmikarcefhqakawarfaxGgwcdtfgrydbgDcu9hmbkkaramBdbamhDkabaPfaDBdbamcefgmai9hmbkkakcbyd:m:H:cjbH:bjjjbbaoaoyd9GcufBd9GdnaeTmbaiTmbcbhDaehwinawaDBdbawclfhwaiaDcefgD9hmbkcbhDaehwindnaDabydbgrSmbawaearcdtfgrydbBdbaraDBdbkabclfhbawclfhwaiaDcefgD9hmbkkk;:odvuv998Jjjjjbca9Rgocbyd1:G:cjbBdKaocb8Pdj:G:cjb83izaocbydN:G:cjbBdwaocb8Pd:m:G:cjb83ibdnadTmbaicd4hrdnabmbdnalTmbcbhwinaealawcdtfydbar2cdtfhDcbhiinaoczfaifgqaDaifIdbgkaqIdbgxaxak9EEUdbaoaifgqakaqIdbgxaxak9DEUdbaiclfgicx9hmbkawcefgwad9hmbxikkarcdthwcbhDincbhiinaoczfaifgqaeaifIdbgkaqIdbgxaxak9EEUdbaoaifgqakaqIdbgxaxak9DEUdbaiclfgicx9hmbkaeawfheaDcefgDad9hmbxdkkdnalTmbcbhwinabawcx2fgiaealawcdtfydbar2cdtfgDIdbUdbaiaDIdlUdlaiaDIdwUdwcbhiinaoczfaifgqaDaifIdbgkaqIdbgxaxak9EEUdbaoaifgqakaqIdbgxaxak9DEUdbaiclfgicx9hmbkawcefgwad9hmbxdkkarcdthlcbhwaehDinabawcx2fgiaeawar2cdtfgqIdbUdbaiaqIdlUdlaiaqIdwUdwcbhiinaoczfaifgqaDaifIdbgkaqIdbgxaxak9EEUdbaoaifgqakaqIdbgxaxak9DEUdbaiclfgicx9hmbkaDalfhDawcefgwad9hmbkkJbbbbaoIdbaoIdzgx:tgkakJbbbb9DEgkaoIdlaoIdCgm:tgPaPak9DEgkaoIdwaoIdKgP:tgsasak9DEhsdnabTmbadTmbJbbbbJbbjZas:vasJbbbb9BEhkinabakabIdbax:tNUdbabclfgoakaoIdbam:tNUdbabcwfgoakaoIdbaP:tNUdbabcxfhbadcufgdmbkkdnavTmbavaPUdwavamUdlavaxUdbkask:WlewudnaeTmbcbhvabhoinaoavBdbaoclfhoaeavcefgv9hmbkkdnaiTmbcbhrinadarcdtfhwcbhDinalawaDcdtgvyd:G:G:cjbcdtfydbcdtfydbhodnalawavfydbcdtfydbgqabaqcdtfgkydbgvSmbinakabavgqcdtfgxydbgvBdbaxhkaqav9hmbkkdnaoabaocdtfgkydbgvSmbinakabavgocdtfgxydbgvBdbaxhkaoav9hmbkkdnaqaoSmbabaqaoaqao0Ecdtfaqaoaqao6EBdbkaDcefgDci9hmbkarcifgrai6mbkkdnaembcbskcbhxindnalaxcdtgvfydbax9hmbaxhodnaxabavfgDydbgvSmbaDhqinaqabavgocdtfgkydbgvBdbakhqaoav9hmbkkaDaoBdbkaxcefgxae9hmbkcbhkabhvcbhoindndnaoalydbgq9hmbdnaoavydbgq9hmbavakBdbakcefhkxdkavabaqcdtfydbBdbxekavabaqcdtfydbBdbkalclfhlavclfhvaeaocefgo9hmbkakk;jiilud99euabcbaecltz:tjjjbhvdnalTmbadhoaihralhwinarcwfIdbhDarclfIdbhqavaoydbcltfgkarIdbakIdbMUdbakaqakIdlMUdlakaDakIdwMUdwakakIdxJbbjZMUdxaoclfhoarcxfhrawcufgwmbkkdnaeTmbavhkaehrinakcxfgoIdbhDaocbBdbakakIdbJbbbbJbbjZaD:vaDJbbbb9BEgDNUdbakclfgoaDaoIdbNUdbakcwfgoaDaoIdbNUdbakczfhkarcufgrmbkkdnalTmbinavadydbcltfgkaicwfIdbakIdw:tgDaDNaiIdbakIdb:tgDaDNaiclfIdbakIdl:tgDaDNMMgDakIdxgqaqaD9DEUdxadclfhdaicxfhialcufglmbkkdnaeTmbavcxfhkinabakIdbUdbakczfhkabclfhbaecufgembkkk:moerudnaoTmbaecd4hzdnavTmbaicd4hHavcdthOcbhAindnaPaAfRbbTmbaAhednaDTmbaDaAcdtfydbhekdnasTmbasaefRbbceGmekdnamaAfRbbclSmbabaeaz2cdtfgiaraAcx2fgCIdbakNaxIdbMUdbaiaCIdlakNaxIdlMUdlaiaCIdwakNaxIdwMUdwkadaeaH2cdtfhXaqheawhiavhCinaXaeydbcdtgQfaiIdbalaQfIdb:vUdbaeclfheaiclfhiaCcufgCmbkkawaOfhwaAcefgAao9hmbxdkkdnasmbcbheaDhiindnaPaefRbbTmbaehCdnaDTmbaiydbhCkamaefRbbclSmbabaCaz2cdtfgCarIdbakNaxIdbMUdbaCarclfIdbakNaxIdlMUdlaCarcwfIdbakNaxIdwMUdwkaiclfhiarcxfhraoaecefge9hmbxdkkdnaDTmbindnaPRbbTmbasaDydbgefRbbceGmbamRbbclSmbabaeaz2cdtfgearIdbakNaxIdbMUdbaearclfIdbakNaxIdlMUdlaearcwfIdbakNaxIdwMUdwkaPcefhPaDclfhDamcefhmarcxfhraocufgombxdkkazcdthicbheindnaPaefRbbTmbasaefRbbceGmbamaefRbbclSmbabarIdbakNaxIdbMUdbabclfarclfIdbakNaxIdlMUdbabcwfarcwfIdbakNaxIdwMUdbkarcxfhrabaifhbaoaecefge9hmbkkk8MbabaeadaialavcbcbcbcbcbaoarawaDz:bjjjbk8MbabaeadaialavaoarawaDaqakaxamaPz:bjjjbkRbababaeadaialavaoarawaDaqakaxcjjjjdVamz:bjjjbk:g8Koque99due99duq998Jjjjjbc;Wb9Rgq8Kjjjjbcbhkaqcxfcbc;Kbz:tjjjb8Aaqcualcx2alc;v:Q;v:Qe0Ecbyd1:H:cjbHjjjjbbgxBdxaqceBd2axaialavcbcbz:ejjjb8AaqcualcdtalcFFFFi0Egmcbyd1:H:cjbHjjjjbbgiBdzaqcdBd2dndnJFF959eJbbjZawJbbjZawJbbjZ9DE:vawJ9VO:d869DEgw:lJbbb9p9DTmbaw:OhPxekcjjjj94hPkadci9Uhsarco9UhzdndnaombaPcd9imekdnalTmbaPcuf:YhwdnaoTmbcbhvaihHaxhOindndnaoavfRbbceGTmbavcjjjjlVhAxekdndnaOclfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhAxekcjjjj94hAkaAcqthAdndnaOcwfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhXxekcjjjj94hXkaAaXVhAdndnaOIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhXxekcjjjj94hXkaAaXcCtVhAkaHaABdbaHclfhHaOcxfhOalavcefgv9hmbxdkkaxhvaihOalhHindndnavIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhAxekcjjjj94hAkaAcCthAdndnavclfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhXxekcjjjj94hXkaXcqtaAVhAdndnavcwfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhXxekcjjjj94hXkaOaAaXVBdbavcxfhvaOclfhOaHcufgHmbkkadTmbcbhkaehvcbhOinakaiavclfydbcdtfydbgHaiavcwfydbcdtfydbgA9haiavydbcdtfydbgXaH9haXaA9hGGfhkavcxfhvaOcifgOad6mbkkarci9UhQdndnaz:Z:rJbbbZMgw:lJbbb9p9DTmbaw:Ohvxekcjjjj94hvkaQ:ZhLcbhKc:bwhzdninakaQ9pmeazaP9Rcd9imeavazcufgOavaO9iEaPcefavaP9kEhYdnalTmbaYcuf:YhwdnaoTmbcbhOaihHaxhvindndnaoaOfRbbceGTmbaOcjjjjlVhAxekdndnavclfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhAxekcjjjj94hAkaAcqthAdndnavcwfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhXxekcjjjj94hXkaAaXVhAdndnavIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhXxekcjjjj94hXkaAaXcCtVhAkaHaABdbaHclfhHavcxfhvalaOcefgO9hmbxdkkaxhvaihOalhHindndnavIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhAxekcjjjj94hAkaAcCthAdndnavclfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhXxekcjjjj94hXkaXcqtaAVhAdndnavcwfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhXxekcjjjj94hXkaOaAaXVBdbavcxfhvaOclfhOaHcufgHmbkkcbhOdnadTmbaehvcbhHinaOaiavclfydbcdtfydbgAaiavcwfydbcdtfydbgX9haiavydbcdtfydbgraA9haraX9hGGfhOavcxfhvaHcifgHad6mbkkdnas:ZgCaL:taY:Ygwaz:Y:tg8ANak:ZgEaO:Zg3:tNaEaL:tawaP:Y:tg5Na3aC:tNMg8EJbbbb9BmbaCaE:ta5a8Aa3aL:tNNNa8E:vawMhwkdndnaOaQ0mbaOhkaYhPxekaOhsaYhzkdndnaKcl0mbdnawJbbbZMgw:lJbbb9p9DTmbaw:Ohvxdkcjjjj94hvxekaPazfcd9ThvkaKcefgKcs9hmbkkdndndnakmbJbbjZhwcbhOcdhvaDmexdkalcd4alfhHcehOinaOgvcethOavaH6mbkcbhOaqcuavcdtgYavcFFFFi0Ecbyd1:H:cjbHjjjjbbgKBdCaqciBd2aqamcbyd1:H:cjbHjjjjbbgzBdKaqclBd2dndndndnalTmbaPcuf:YhwaoTmecbhOaihAaxhHindndnaoaOfRbbceGTmbaOcjjjjlVhXxekdndnaHclfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhXxekcjjjj94hXkaXcqthXdndnaHcwfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:Ohrxekcjjjj94hrkaXarVhXdndnaHIdbawNJbbbZMgC:lJbbb9p9DTmbaC:Ohrxekcjjjj94hrkaXarcCtVhXkaAaXBdbaAclfhAaHcxfhHalaOcefgO9hmbxikkaKcFeaYz:tjjjb8AcbhPcbhvxdkaxhOaihHalhAindndnaOIdbawNJbbbZMgC:lJbbb9p9DTmbaC:OhXxekcjjjj94hXkaXcCthXdndnaOclfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:Ohrxekcjjjj94hrkarcqtaXVhXdndnaOcwfIdbawNJbbbZMgC:lJbbb9p9DTmbaC:Ohrxekcjjjj94hrkaHaXarVBdbaOcxfhOaHclfhHaAcufgAmbkkaKcFeaYz:tjjjbhravcufhocbhPcbhYindndndnaraiaYcdtgKfydbgAcm4aA7c:v;t;h;Ev2gvcs4av7aoGgHcdtfgXydbgOcuSmbcehvinaiaOcdtgOfydbaASmdaHavfhOavcefhvaraOaoGgHcdtfgXydbgOcu9hmbkkaXaYBdbaPhvaPcefhPxekazaOfydbhvkazaKfavBdbaYcefgYal9hmbkcuaPc8S2gOaPc;D;O;f8U0EhvkcbhXaqavcbyd1:H:cjbHjjjjbbgvBd3aqcvBd2avcbaOz:tjjjbhOdnadTmbaehiinaxaiclfydbgrcx2fgvIdbaxaiydbgocx2fgHIdbg3:tgCaxaicwfydbgYcx2fgAIdlaHIdlg8A:tgwNavIdla8A:tgEaAIdba3:tg8EN:tgLaLNaEaAIdwaHIdwg5:tg8FNavIdwa5:tgEawN:tgwawNaEa8ENaCa8FN:tgCaCNMMg8E:rhEJbbnnJbbjZazaocdtfydbgvazarcdtfydbgASavazaYcdtfydbgrSGgHEh8Fdna8EJbbbb9ETmbaLaE:vhLaCaE:vhCawaE:vhwkaOavc8S2fgvavIdbawa8FaE:rNgEawNNg8FMUdbavaCaEaCNgaNghavIdlMUdlavaLaEaLNg8ENggavIdwMUdwavawaaNgaavIdxMUdxava8EawNg8JavIdzMUdzavaCa8ENg8EavIdCMUdCavawaEaLa5Nawa3Na8AaCNMM:mg8ANg3NgwavIdKMUdKavaCa3NgCavId3MUd3avaLa3NgLavIdaMUdaava3a8ANg3avId8KMUd8KavaEavIdyMUdydnaHmbaOaAc8S2fgva8FavIdbMUdbavahavIdlMUdlavagavIdwMUdwavaaavIdxMUdxava8JavIdzMUdzava8EavIdCMUdCavawavIdKMUdKavaCavId3MUd3avaLavIdaMUdaava3avId8KMUd8KavaEavIdyMUdyaOarc8S2fgva8FavIdbMUdbavahavIdlMUdlavagavIdwMUdwavaaavIdxMUdxava8JavIdzMUdzava8EavIdCMUdCavawavIdKMUdKavaCavId3MUd3avaLavIdaMUdaava3avId8KMUd8KavaEavIdyMUdykaicxfhiaXcifgXad6mbkkcbhAaqcuaPcdtgvaPcFFFFi0Egicbyd1:H:cjbHjjjjbbgHBdaaqcoBd2aqaicbyd1:H:cjbHjjjjbbgiBd8KaqcrBd2aHcFeavz:tjjjbhYdnalTmbazhHinJbbbbJbbjZaOaHydbgXc8S2fgvIdygw:vawJbbbb9BEavIdwaxcwfIdbgwNavIdzaxIdbgCNavIdaMgLaLMMawNavIdlaxclfIdbgLNavIdCawNavId3MgwawMMaLNavIdbaCNavIdxaLNavIdKMgwawMMaCNavId8KMMM:lNhwdndnaYaXcdtgvfgXydbcuSmbaiavfIdbaw9ETmekaXaABdbaiavfawUdbkaHclfhHaxcxfhxalaAcefgA9hmbkkdndnaPmbJbbbbhwxekJbbbbhwinaiIdbgCawawaC9DEhwaiclfhiaPcufgPmbkaw:rhwkakcd4akfhOcehiinaigvcethiavaO6mbkcbhOaqcuavcdtgiavcFFFFi0Ecbyd1:H:cjbHjjjjbbgHBdyaHcFeaiz:tjjjbhXdnadTmbavcufhrcbhPcbhxindnazaeaxcdtfgvydbcdtfydbgiazavclfydbcdtfydbgOSmbaiazavcwfydbcdtfydbgvSmbaOavSmbaYavcdtfydbhAdndnaYaOcdtfydbgvaYaicdtfydbgi9pmbavaA9pmbaAhlaihoavhAxekdnaAai9pmbaAav9pmbaihlavhoxekavhlaAhoaihAkabaPcx2fgvaABdbavcwfaoBdbavclfalBdbdnaXaoc:3F;N8N2alc:F:b:DD27aAc;D;O:B8J27arGgOcdtfgvydbgicuSmbcehHinaHhvdnabaicx2fgiydbaA9hmbaiydlal9hmbaiydwaoSmikavcefhHaXaOavfarGgOcdtfgvydbgicu9hmbkkavaPBdbaPcefhPkaxcifgxad6mbkaPci2hOkcwhvaDTmekaDawUdbkavcdthvaqcxfc98fhiinaiavfydbcbyd:m:H:cjbH:bjjjbbavc98fgvmbkaqc;Wbf8KjjjjbaOk:3ldrue9:8Jjjjjbc;Wb9Rgr8Kjjjjbcbhwarcxfcbc;Kbz:tjjjb8AdnabaeSmbabaeadcdtzMjjjb8AkarcualcdtalcFFFFi0EgDcbyd1:H:cjbHjjjjbbgqBdxarceBd2aqcbaialavcbarcxfz:djjjbcualcx2alc;v:Q;v:Qe0Ecbyd1:H:cjbHjjjjbbhkarcxfaryd2gxcdtfakBdbaraxcefgmBd2akaialavcbcbz:ejjjb8AarcxfamcdtfaDcbyd1:H:cjbHjjjjbbgiBdbaraxcdfgvBd2arcxfavcdtfcuaialaeadaqz:fjjjbgecltaecjjjjiGEcbyd1:H:cjbHjjjjbbgqBdbaqaeaiakalz:gjjjbaxcifhkdnadTmbaoaoNhocbhwabhlcbheindnaqaialydbgvcdtfydbcdtfIdbao9ETmbalclf8PdbhPabawcdtfgDavBdbaDclfaP83dbawcifhwkalcxfhlaecifgead6mbkkdnakTmbaxcdtarcxffcwfhlinalydbcbyd:m:H:cjbH:bjjjbbalc98fhlakcufgkmbkkarc;Wbf8Kjjjjbawk:WCoDud99vue99vuv998Jjjjjbc;Wb9Rgw8KjjjjbdndnarmbcbhDxekawcxfcbc;Kbz:tjjjb8Aawcuadcx2adc;v:Q;v:Qe0Ecbyd1:H:cjbHjjjjbbgqBdxawceBd2aqaeadaicbcbz:ejjjb8AawcuadcdtadcFFFFi0Egkcbyd1:H:cjbHjjjjbbgxBdzawcdBd2adcd4adfhmceheinaegicetheaiam6mbkcbhPawcuaicdtgsaicFFFFi0Ecbyd1:H:cjbHjjjjbbgzBdCawciBd2dndnar:ZgH:rJbbbZMgO:lJbbb9p9DTmbaO:Ohexekcjjjj94hekaicufhAc:bwhCcbhXadhQcbhLinaeaCcufgiaeai9iEaPcefaeaP9kEhDdndnadTmbaDcuf:YhOaqhiaxheadhmindndnaiIdbaONJbbbZMgK:lJbbb9p9DTmbaK:OhYxekcjjjj94hYkaYcCthYdndnaiclfIdbaONJbbbZMgK:lJbbb9p9DTmbaK:Oh8Axekcjjjj94h8Aka8AcqtaYVhYdndnaicwfIdbaONJbbbZMgK:lJbbb9p9DTmbaK:Oh8Axekcjjjj94h8AkaeaYa8AVBdbaicxfhiaeclfheamcufgmmbkazcFeasz:tjjjbhEcbh3cbh5indnaEaxa5cdtfydbgYcm4aY7c:v;t;h;Ev2gics4ai7aAGgmcdtfg8AydbgecuSmbaeaYSmbcehiinaEamaifaAGgmcdtfg8AydbgecuSmeaicefhiaeaY9hmbkka8AaYBdba3aecuSfh3a5cefg5ad9hmbxdkkazcFeasz:tjjjb8Acbh3kdnaQ:ZgKaH:taD:YgOaC:Y:tg8ENaX:Zg8Fa3:Zga:tNa8FaH:taOaP:Y:tghNaaaK:tNMggJbbbb9BmbaKa8F:taha8EaaaH:tNNNag:vaOMhOkaPaDa3ar0giEhPaXa3aiEhXdna3arSmbaDaCaiEgCaP9Rcd9imbdndnaLcl0mbdnaOJbbbZMgO:lJbbb9p9DTmbaO:Ohexdkcjjjj94hexekaPaCfcd9Theka3aQaiEhQaLcefgLcs9hmekkdndnaXmbcihicbhDxekcbhiawakcbyd1:H:cjbHjjjjbbg5BdKawclBd2aPcuf:YhKdndnadTmbaqhiaxheadhmindndnaiIdbaKNJbbbZMgO:lJbbb9p9DTmbaO:OhYxekcjjjj94hYkaYcCthYdndnaiclfIdbaKNJbbbZMgO:lJbbb9p9DTmbaO:Oh8Axekcjjjj94h8Aka8AcqtaYVhYdndnaicwfIdbaKNJbbbZMgO:lJbbb9p9DTmbaO:Oh8Axekcjjjj94h8AkaeaYa8AVBdbaicxfhiaeclfheamcufgmmbkazcFeasz:tjjjbhEcbhDcbh3indndndnaEaxa3cdtgCfydbgYcm4aY7c:v;t;h;Ev2gics4ai7aAGgmcdtfg8AydbgecuSmbcehiinaxaecdtgefydbaYSmdamaifheaicefhiaEaeaAGgmcdtfg8Aydbgecu9hmbkka8Aa3BdbaDhiaDcefhDxeka5aefydbhika5aCfaiBdba3cefg3ad9hmbkcuaDc32giaDc;j:KM;jb0EhexekazcFeasz:tjjjb8AcbhDcbhekawaecbyd1:H:cjbHjjjjbbgeBd3awcvBd2aecbaiz:tjjjbh8Aavcd4hxdnadTmbdnalTmbaxcdthEa5hYaqhealhmadhAina8AaYydbc32fgiaeIdbaiIdbMUdbaiaeclfIdbaiIdlMUdlaiaecwfIdbaiIdwMUdwaiamIdbaiIdxMUdxaiamclfIdbaiIdzMUdzaiamcwfIdbaiIdCMUdCaiaiIdKJbbjZMUdKaYclfhYaecxfheamaEfhmaAcufgAmbxdkka5hmaqheadhYina8Aamydbc32fgiaeIdbaiIdbMUdbaiaeclfIdbaiIdlMUdlaiaecwfIdbaiIdwMUdwaiaiIdxJbbbbMUdxaiaiIdzJbbbbMUdzaiaiIdCJbbbbMUdCaiaiIdKJbbjZMUdKamclfhmaecxfheaYcufgYmbkkdnaDTmba8AhiaDheinaiaiIdbJbbbbJbbjZaicKfIdbgO:vaOJbbbb9BEgONUdbaiclfgmaOamIdbNUdbaicwfgmaOamIdbNUdbaicxfgmaOamIdbNUdbaiczfgmaOamIdbNUdbaicCfgmaOamIdbNUdbaic3fhiaecufgembkkcbhYawcuaDcdtgCaDcFFFFi0Egicbyd1:H:cjbHjjjjbbgeBdaawcoBd2awaicbyd1:H:cjbHjjjjbbgEBd8KaecFeaCz:tjjjbh3dnadTmbaoJbbjZJbbjZaK:vaPceSENgOaONhKaxcdthxalheinaKaec;8:G:cjbalEgmIdwa8Aa5ydbgAc32fgiIdC:tgOaONamIdbaiIdx:tgOaONamIdlaiIdz:tgOaONMMNaqcwfIdbaiIdw:tgOaONaqIdbaiIdb:tgOaONaqclfIdbaiIdl:tgOaONMMMhOdndna3aAcdtgifgmydbcuSmbaEaifIdbaO9ETmekamaYBdbaEaifaOUdbka5clfh5aqcxfhqaeaxfheadaYcefgY9hmbkkaba3aCzMjjjb8Acrhikaicdthiawcxfc98fheinaeaifydbcbyd:m:H:cjbH:bjjjbbaic98fgimbkkawc;Wbf8KjjjjbaDk:Pdidui99ducbhi8Jjjjjbca9Rglcbyd1:G:cjbBdKalcb8Pdj:G:cjb83izalcbydN:G:cjbBdwalcb8Pd:m:G:cjb83ibdndnaembJbbjFhvJbbjFhoJbbjFhrxekadcd4cdthwincbhdinalczfadfgDabadfIdbgvaDIdbgoaoav9EEUdbaladfgDavaDIdbgoaoav9DEUdbadclfgdcx9hmbkabawfhbaicefgiae9hmbkalIdwalIdK:thralIdlalIdC:thoalIdbalIdz:thvkJbbbbavavJbbbb9DEgvaoaoav9DEgvararav9DEk9DeeuabcFeaicdtz:tjjjbhlcbhbdnadTmbindnalaeydbcdtfgiydbcu9hmbaiabBdbabcefhbkaeclfheadcufgdmbkkabk;Bidqui998Jjjjjbc;Wb9Rgl8Kjjjjbalcxfcbc;Kbz:tjjjb8Aadcd4adfhvcehoinaogrcethoarav6mbkalcuarcdtgoarcFFFFi0Ecbyd1:H:cjbHjjjjbbgvBdxavcFeaoz:tjjjbhwdnadTmbaicd4hDarcufhqcbhkindndnawcbaeakaD2cdtfgrydlgiaicjjjj94SEgocH4ao7c:F:b:DD2cbarydbgxaxcjjjj94SEgocH4ao7c;D;O:B8J27cbarydwgmamcjjjj94SEgrcH4ar7c:3F;N8N27aqGgvcdtfgrydbgocuSmbam::hPai::hsax::hzcehiinaihrdnaeaoaD2cdtfgiIdbaz9CmbaiIdlas9CmbaiIdwaP9BmikarcefhiawavarfaqGgvcdtfgrydbgocu9hmbkkarakBdbakhokabakcdtfaoBdbakcefgkad9hmbkkalydxcbyd:m:H:cjbH:bjjjbbalc;Wbf8Kjjjjbk9teiucbcbyd:q:H:cjbgeabcifc98GfgbBd:q:H:cjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;LeeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiclfaeclfydbBdbaicwfaecwfydbBdbaicxfaecxfydbBdbaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk;aeedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdbaicxfalBdbaicwfalBdbaiclfalBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabk9teiucbcbyd:q:H:cjbgeabcrfc94GfgbBd:q:H:cjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaikTeeucbabcbyd:q:H:cjbge9Rcifc98GaefgbBd:q:H:cjbdnabZbcztge9nmbabae9RcFFifcz4nb8Akkk:Kedbcj:Gdk1eFFuuFFuuFFuuFFuFFFuFFFuFbbbbbbbbebbbdbbbbbbbebbbebbbdbbbbbbbbbbbeeeeebebbebbebebbbeebbbbbbbbbbbbeeeeeebebbeeebeebbbbebebbbbbbbbbbbbbbbbbbc1:Hdkxebbbdbbb:G:qbb",e=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var t,n=WebAssembly.instantiate(i(a),{}).then(function(m){t=m.instance,t.exports.__wasm_call_ctors()});function i(m){for(var M=new Uint8Array(m.length),x=0;x<m.length;++x){var S=m.charCodeAt(x);M[x]=S>96?S-97:S>64?S-39:S+4}for(var w=0,x=0;x<m.length;++x)M[w++]=M[x]<60?e[M[x]]:(M[x]-60)*64+M[++x];return M.buffer.slice(0,w)}function s(m){if(!m)throw new Error("Assertion failed")}function r(m){return new Uint8Array(m.buffer,m.byteOffset,m.byteLength)}function o(m,M,x,S){var w=t.exports.sbrk,T=w(x*4),v=w(x*S*4),E=new Uint8Array(t.exports.memory.buffer);E.set(r(M),v),m(T,v,x,S*4),E=new Uint8Array(t.exports.memory.buffer);var C=new Uint32Array(x);return new Uint8Array(C.buffer).set(E.subarray(T,T+x*4)),w(T-w(0)),C}function l(m,M,x){var S=t.exports.sbrk,w=S(M.length*4),T=S(x*4),v=new Uint8Array(t.exports.memory.buffer),E=r(M);v.set(E,w);var C=m(T,w,M.length,x);v=new Uint8Array(t.exports.memory.buffer);var I=new Uint32Array(x);new Uint8Array(I.buffer).set(v.subarray(T,T+x*4)),S(w-S(0));for(var k=0;k<M.length;++k)M[k]=I[M[k]];return[I,C]}function c(m){for(var M=0,x=0;x<m.length;++x){var S=m[x];M=M<S?S:M}return M}function h(m,M,x,S,w,T,v,E,C){var I=t.exports.sbrk,k=I(4),O=I(x*4),V=I(w*T),P=I(x*4),j=new Uint8Array(t.exports.memory.buffer);j.set(r(S),V),j.set(r(M),P);var B=m(O,P,x,V,w,T,v,E,C,k);j=new Uint8Array(t.exports.memory.buffer);var K=new Uint32Array(B);r(K).set(j.subarray(O,O+B*4));var Q=new Float32Array(1);return r(Q).set(j.subarray(k,k+4)),I(k-I(0)),[K,Q[0]]}function d(m,M,x,S,w,T,v,E,C,I,k,O,V){var P=t.exports.sbrk,j=P(4),B=P(x*4),K=P(w*T),Q=P(w*E),ee=P(C.length*4),ae=P(x*4),ie=I?P(w):0,ke=new Uint8Array(t.exports.memory.buffer);ke.set(r(S),K),ke.set(r(v),Q),ke.set(r(C),ee),ke.set(r(M),ae),I&&ke.set(r(I),ie);var Ke=m(B,ae,x,K,w,T,Q,E,ee,C.length,ie,k,O,V,j);ke=new Uint8Array(t.exports.memory.buffer);var Ge=new Uint32Array(Ke);r(Ge).set(ke.subarray(B,B+Ke*4));var J=new Float32Array(1);return r(J).set(ke.subarray(j,j+4)),P(j-P(0)),[Ge,J[0]]}function f(m,M,x,S,w,T,v,E,C,I,k,O,V){var P=t.exports.sbrk,j=P(4),B=P(w*T),K=P(w*E),Q=P(C.length*4),ee=P(x*4),ae=I?P(w):0,ie=new Uint8Array(t.exports.memory.buffer);ie.set(r(S),B),ie.set(r(v),K),ie.set(r(C),Q),ie.set(r(M),ee),I&&ie.set(r(I),ae);var ke=m(ee,x,B,w,T,K,E,Q,C.length,ae,k,O,V,j);ie=new Uint8Array(t.exports.memory.buffer),r(M).set(ie.subarray(ee,ee+ke*4)),r(S).set(ie.subarray(B,B+w*T)),r(v).set(ie.subarray(K,K+w*E));var Ke=new Float32Array(1);return r(Ke).set(ie.subarray(j,j+4)),P(j-P(0)),[ke,Ke[0]]}function b(m,M,x,S){var w=t.exports.sbrk,T=w(x*S),v=new Uint8Array(t.exports.memory.buffer);v.set(r(M),T);var E=m(T,x,S);return w(T-w(0)),E}function g(m,M,x,S,w,T,v,E){var C=t.exports.sbrk,I=C(E*4),k=C(x*S),O=w?C(x*T):0,V=new Uint8Array(t.exports.memory.buffer);V.set(r(M),k),w&&V.set(r(w),O);var P=m(I,k,x,S,O,T,v,E);V=new Uint8Array(t.exports.memory.buffer);var j=new Uint32Array(P);return r(j).set(V.subarray(I,I+P*4)),C(I-C(0)),j}function y(m,M,x,S,w,T,v,E,C){var I=t.exports.sbrk,k=I(4),O=I(x*4),V=I(w*T),P=I(x*4),j=v?I(w):0,B=new Uint8Array(t.exports.memory.buffer);B.set(r(S),V),B.set(r(M),P),v&&B.set(r(v),j);var K=m(O,P,x,V,w,T,j,E,C,k);B=new Uint8Array(t.exports.memory.buffer);var Q=new Uint32Array(K);r(Q).set(B.subarray(O,O+K*4));var ee=new Float32Array(1);return r(ee).set(B.subarray(k,k+4)),I(k-I(0)),[Q,ee[0]]}function p(m,M,x,S,w,T,v){var E=t.exports.sbrk,C=E(x*4),I=E(w*T),k=E(x*4),O=new Uint8Array(t.exports.memory.buffer);O.set(r(S),I),O.set(r(M),k);var V=m(C,k,x,I,w,T,v);O=new Uint8Array(t.exports.memory.buffer);var P=new Uint32Array(V);return r(P).set(O.subarray(C,C+V*4)),E(C-E(0)),P}var u={LockBorder:1,Sparse:2,ErrorAbsolute:4,Prune:8,Regularize:16,Permissive:32,RegularizeLight:64,_InternalDebug:1<<30};return{ready:n,supported:!0,compactMesh:function(m){s(m instanceof Uint32Array||m instanceof Int32Array||m instanceof Uint16Array||m instanceof Int16Array),s(m.length%3==0);var M=m.BYTES_PER_ELEMENT==4?m:new Uint32Array(m),x=l(t.exports.meshopt_optimizeVertexFetchRemap,M,c(m)+1);if(m!==M)for(var S=0;S<M.length;++S)m[S]=M[S];return x},generatePositionRemap:function(m,M){return s(m instanceof Float32Array),s(m.length%M==0),s(M>=3),o(t.exports.meshopt_generatePositionRemap,m,m.length/M,M)},simplify:function(m,M,x,S,w,T){s(m instanceof Uint32Array||m instanceof Int32Array||m instanceof Uint16Array||m instanceof Int16Array),s(m.length%3==0),s(M instanceof Float32Array),s(M.length%x==0),s(x>=3),s(S>=0&&S<=m.length),s(S%3==0),s(w>=0);for(var v=0,E=0;E<(T?T.length:0);++E)s(T[E]in u),v|=u[T[E]];var C=m.BYTES_PER_ELEMENT==4?m:new Uint32Array(m),I=h(t.exports.meshopt_simplify,C,m.length,M,M.length/x,x*4,S,w,v);return I[0]=m instanceof Uint32Array?I[0]:new m.constructor(I[0]),I},simplifyWithAttributes:function(m,M,x,S,w,T,v,E,C,I){s(m instanceof Uint32Array||m instanceof Int32Array||m instanceof Uint16Array||m instanceof Int16Array),s(m.length%3==0),s(M instanceof Float32Array),s(M.length%x==0),s(x>=3),s(S instanceof Float32Array),s(S.length==w*(M.length/x)),s(w>=0),s(v==null||v instanceof Uint8Array),s(v==null||v.length==M.length/x),s(E>=0&&E<=m.length),s(E%3==0),s(C>=0),s(Array.isArray(T)),s(w>=T.length),s(T.length<=32);for(var k=0;k<T.length;++k)s(T[k]>=0);for(var O=0,k=0;k<(I?I.length:0);++k)s(I[k]in u),O|=u[I[k]];var V=m.BYTES_PER_ELEMENT==4?m:new Uint32Array(m),P=d(t.exports.meshopt_simplifyWithAttributes,V,m.length,M,M.length/x,x*4,S,w*4,new Float32Array(T),v,E,C,O);return P[0]=m instanceof Uint32Array?P[0]:new m.constructor(P[0]),P},simplifyWithUpdate:function(m,M,x,S,w,T,v,E,C,I){s(m instanceof Uint32Array||m instanceof Int32Array||m instanceof Uint16Array||m instanceof Int16Array),s(m.length%3==0),s(M instanceof Float32Array),s(M.length%x==0),s(x>=3),s(S instanceof Float32Array),s(S.length==w*(M.length/x)),s(w>=0),s(v==null||v instanceof Uint8Array),s(v==null||v.length==M.length/x),s(E>=0&&E<=m.length),s(E%3==0),s(C>=0),s(Array.isArray(T)),s(w>=T.length),s(T.length<=32);for(var k=0;k<T.length;++k)s(T[k]>=0);for(var O=0,k=0;k<(I?I.length:0);++k)s(I[k]in u),O|=u[I[k]];var V=m.BYTES_PER_ELEMENT==4?m:new Uint32Array(m),P=f(t.exports.meshopt_simplifyWithUpdate,V,m.length,M,M.length/x,x*4,S,w*4,new Float32Array(T),v,E,C,O);if(m!==V)for(var k=0;k<P[0];++k)m[k]=V[k];return P},getScale:function(m,M){return s(m instanceof Float32Array),s(m.length%M==0),s(M>=3),b(t.exports.meshopt_simplifyScale,m,m.length/M,M*4)},simplifyPoints:function(m,M,x,S,w,T){return s(m instanceof Float32Array),s(m.length%M==0),s(M>=3),s(x>=0&&x<=m.length/M),S?(s(S instanceof Float32Array),s(S.length%w==0),s(w>=3),s(m.length/M==S.length/w),g(t.exports.meshopt_simplifyPoints,m,m.length/M,M*4,S,w*4,T||0,x)):g(t.exports.meshopt_simplifyPoints,m,m.length/M,M*4,void 0,0,0,x)},simplifySloppy:function(m,M,x,S,w,T){s(m instanceof Uint32Array||m instanceof Int32Array||m instanceof Uint16Array||m instanceof Int16Array),s(m.length%3==0),s(M instanceof Float32Array),s(M.length%x==0),s(x>=3),s(S==null||S instanceof Uint8Array),s(S==null||S.length==M.length/x),s(w>=0&&w<=m.length),s(w%3==0),s(T>=0);var v=m.BYTES_PER_ELEMENT==4?m:new Uint32Array(m),E=y(t.exports.meshopt_simplifySloppy,v,m.length,M,M.length/x,x*4,S,w,T);return E[0]=m instanceof Uint32Array?E[0]:new m.constructor(E[0]),E},simplifyPrune:function(m,M,x,S){s(m instanceof Uint32Array||m instanceof Int32Array||m instanceof Uint16Array||m instanceof Int16Array),s(m.length%3==0),s(M instanceof Float32Array),s(M.length%x==0),s(x>=3),s(S>=0);var w=m.BYTES_PER_ELEMENT==4?m:new Uint32Array(m),T=p(t.exports.meshopt_simplifyPrune,w,m.length,M,M.length/x,x*4,S);return T=m instanceof Uint32Array?T:new m.constructor(T),T}}})();var Tv=(function(){var a="b9H79Tebbbe:neP9Geueu9Geub9Gbb9Giuuueu9Gmuuuuuuuuuuu9999eu9Gouuuuuueu9Gruuuuuuub9Gxuuuuuuuuuuuueu9Gxuuuuuuuuuuu99eu9GPuuuuuuuuuuuuu99b9Gouuuuuub9Gwuuuuuuuub9Gvuuuuub9GluuuubiQXdilvorwDqokoqxmbiibeilve9Weiiviebeoweuecj:Gdkr;Zeqo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9I919P29K9nW79O2Wt79c9V919U9KbeY9TW79O9V9Wt9F9I919P29K9nW79O2Wt7S2W94bd39TW79O9V9Wt9F9I919P29K9nW79O2Wt79t9W9Ht9P9H2bo39TW79O9V9Wt9F9J9V9T9W91tWJ2917tWV9c9V919U9K7bw39TW79O9V9Wt9F9J9V9T9W91tW9nW79O2Wt9c9V919U9K7bkE9TW79O9V9Wt9F9J9V9T9W91tW9t9W9OWVW9c9V919U9K7bxL9TW79O9V9Wt9F9V9Wt9P9T9P96W9nW79O2WtbPl79IV9RbsDwebcekdOAq;W:leXdbkIbabaec9:fgefcufae9Ugeabci9Uadfcufad9Ugbaeab0Ek:88JDPue99eux99due99euo99iu8Jjjjjbc:WD9Rgm8KjjjjbdndnalmbcbhPxekamc:Cwfcbc;Kbz:rjjjb8AcuaocdtgsaocFFFFi0Ehzcbyd;0:G:cjbhHdndnalcb9imbaoal9nmbamazaHHjjjjbbgHBd:CwamceBd;8wamazcbyd;0:G:cjbHjjjjbbgOBd:GwamcdBd;8wamcualcdtalcFFFFi0Ecbyd;0:G:cjbHjjjjbbgABd:KwamciBd;8waihzalhsinaHazydbcdtfcbBdbazclfhzascufgsmbkaihzalhsinaHazydbcdtfgCaCydbcefBdbazclfhzascufgsmbkaihzalhCcbhXindnaHazydbcdtgQfgsydbcb9imbaOaQfaXBdbasasydbgQcjjjj94VBdbaQaXfhXkazclfhzaCcufgCmbkalci9UhLdnalci6mbcbhzaihsinascwfydbhCasclfydbhXaOasydbcdtfgQaQydbgQcefBdbaAaQcdtfazBdbaOaXcdtfgXaXydbgXcefBdbaAaXcdtfazBdbaOaCcdtfgCaCydbgCcefBdbaAaCcdtfazBdbascxfhsaLazcefgz9hmbkkaihzalhsindnaHazydbcdtgCfgXydbgQcu9kmbaXaQcFFFFrGgQBdbaOaCfgCaCydbaQ9RBdbkazclfhzascufgsmbxdkkamazaHHjjjjbbgHBd:CwamceBd;8wamazcbyd;0:G:cjbHjjjjbbgOBd:GwamcdBd;8wamcualcdtalcFFFFi0Ecbyd;0:G:cjbHjjjjbbgABd:KwamciBd;8waHcbasz:rjjjbhXaihzalhsinaXazydbcdtfgCaCydbcefBdbazclfhzascufgsmbkalci9UhLdnaoTmbcbhzaOhsaXhCaohQinasazBdbasclfhsaCydbazfhzaCclfhCaQcufgQmbkkdnalci6mbcbhzaihsinascwfydbhCasclfydbhQaOasydbcdtfgKaKydbgKcefBdbaAaKcdtfazBdbaOaQcdtfgQaQydbgQcefBdbaAaQcdtfazBdbaOaCcdtfgCaCydbgCcefBdbaAaCcdtfazBdbascxfhsaLazcefgz9hmbkkaoTmbcbhzaohsinaOazfgCaCydbaXazfydb9RBdbazclfhzascufgsmbkkamaLcbyd;0:G:cjbHjjjjbbgzBd:OwamclBd;8wazcbaLz:rjjjbhYamcuaLcK2alcjjjjd0Ecbyd;0:G:cjbHjjjjbbg8ABd:SwamcvBd;8wJbbbbhEdnalci6g3mbarcd4hKaihsa8AhzaLhrJbbbbh5inavasclfydbaK2cdtfgCIdlh8EavasydbaK2cdtfgXIdlhEavascwfydbaK2cdtfgQIdlh8FaCIdwhaaXIdwhhaQIdwhgazaCIdbg8JaXIdbg8KMaQIdbg8LMJbbnn:vUdbazclfaXIdlaCIdlMaQIdlMJbbnn:vUdbaQIdwh8MaCIdwh8NaXIdwhyazcxfa8EaE:tg8Eagah:tggNaaah:tgaa8FaE:tghN:tgEJbbbbJbbjZa8Ja8K:tg8FahNa8Ea8La8K:tg8KN:tghahNaEaENaaa8KNa8FagN:tgEaENMMg8K:rg8E:va8KJbbbb9BEg8KNUdbazczfaEa8KNUdbazcCfaha8KNUdbazcwfa8Maya8NMMJbbnn:vUdba5a8EMh5ascxfhsazcKfhzarcufgrmbka5aL:Z:vJbbbZNhEkamcuaLcdtalcFFFF970Ecbyd;0:G:cjbHjjjjbbgCBd:WwamcoBd;8waq:Zhhdna3mbcbhzaChsinasazBdbasclfhsaLazcefgz9hmbkkaEahNhhamcuaLcltalcFFFFd0Ecbyd;0:G:cjbHjjjjbbg8PBd:0wamcrBd;8wcba8Pa8AaCaLcbz:djjjb8AJFFuuh8MJFFuuh8NJFFuuhydnalci6mbJFFuuhya8AhzaLhsJFFuuh8NJFFuuh8MinazcwfIdbgEa8Ma8MaE9EEh8MazclfIdbgEa8Na8NaE9EEh8NazIdbgEayayaE9EEhyazcKfhzascufgsmbkkah:rhEamaocetgzcuaocu9kEcbyd;0:G:cjbHjjjjbbgCBd:4wdndnaoal9nmbaihzalhsinaCazydbcetfcFFi87ebazclfhzascufgsmbxdkkaCcFeazz:rjjjb8AkaEJbbbZNh8JcuhIdnalci6mbcbhsJFFuuhEa8AhzcuhIinazcwfIdba8M:tghahNazIdbay:tghahNazclfIdba8N:tghahNMM:rghaEaIcuSahaE9DVgXEhEasaIaXEhIazcKfhzaLascefgs9hmbkkamczfcbcjwz:rjjjb8Aam9cb83iwam9cb83ibaxa8JNh8RJbbjZak:th8Lcbh8SJbbbbhRJbbbbh8UJbbbbh8VJbbbbh8WJbbbbh8XJbbbbh8Ycbh8ZcbhPinJbbbbhEdna8STmbJbbjZa8S:Z:vhEkJbbbbhhdna8Ya8YNa8Wa8WNa8Xa8XNMMg8KJbbbb9BmbJbbjZa8K:r:vhhka8VaENh8Ka8UaENh5aRaENh8EaIhLdndndndndna8SaPVTmbamydwg80Tmea8YahNh8Fa8XahNhaa8WahNhgaeamydbcdtfh81cbh3JFFuuhEcvhQcuhLindnaHa81a3cdtfydbcdtgzfydbgvTmbaAaOazfydbcdtfhsindndnaCaiasydbgKcx2fgzclfydbgrcetf8Vebcs4aCazydbgXcetf8Vebcs4faCazcwfydbglcetf8Vebcs4fgombcbhzxekcehzaHaXcdtfydbgXceSmbcehzaHarcdtfydbgrceSmbcehzaHalcdtfydbglceSmbdnarcdSaXcdSfalcdSfcd6mbaocefhzxekaocdfhzkdnazaQ9kmba8AaKcK2fgXIdwa8K:tghahNaXIdba8E:tghahNaXIdla5:tghahNMM:ra8J:va8LNJbbjZMJ9VO:d86JbbjZaXIdCa8FNaXIdxagNaaaXIdzNMMakN:tghahJ9VO:d869DENghaEazaQ6ahaE9DVgXEhEaKaLaXEhLazaQaXEhQkasclfhsavcufgvmbkka3cefg3a809hmbkkaLcu9hmekama8KUd:ODama5Ud:KDama8EUd:GDamcuBd:qDamcFFF;7rBdjDa8Pcba8AaYamc:GDfamc:qDfamcjDfz:ejjjbamyd:qDhLdndnaxJbbbb9ETmba8SaD6mbaLcuSmeceh3amIdjDa8R9EmixdkaLcu9hmekdna8STmbabaPcltfgHam8Piw83dwaHam8Pib83dbaPcefhPkc3hHinamc:CwfaHfydbcbyd;4:G:cjbH:bjjjbbaHc98fgHc989hmbxvkkcbh3a8Saq9pmbamydwaCaiaLcx2fgzydbcetf8Vebcs4aCazcwfydbcetf8Vebcs4faCazclfydbcetf8Vebcs4ffaw9nmekcbhzcbhsdna8ZTmbcbhsamczfhXinamczfascdtfaXydbgQBdbaXclfhXasaYaQfRbbTfhsa8Zcufg8ZmbkkamydwhlamydbhXam9cu83i:GDam9cu83i:ODam9cu83i:qDam9cu83i:yDinamcjDfazfcFFF;7rBdbazclfgzcz9hmbkasc;8easclfc:bd6Eg8Zcdth80dnalTmbaeaXcdtfhocbhrindnaHaoarcdtfydbcdtgzfydbgvTmbaAaOazfydbcdtfhscuhQcuhzinaHaiasydbgKcx2fgXclfydbcdtfydbaHaXydbcdtfydbfaHaXcwfydbcdtfydbfgXazaXaz6gXEhzaKaQaXEhQasclfhsavcufgvmbkaQcuSmba8AaQcK2fgsIdwa8M:tgEaENasIdbay:tgEaENasIdla8N:tgEaENMM:rhEcbhsindndnazamc:qDfasfgvydbgX6mbazaX9hmeaEamcjDfasfIdb9FTmekavazBdbamc:GDfasfaQBdbamcjDfasfaEUdbxdkasclfgscz9hmbkkarcefgral9hmbkkamczfa80fhQcbhzcbhsindnamc:GDfazfydbgXcuSmbaQascdtfaXBdbascefhskazclfgzcz9hmbkasa8Zfg8ZTmbJFFuuhhcuhKamczfhza8ZhvcuhQina8AazydbgXcK2fgsIdwa8M:tgEaENasIdbay:tgEaENasIdla8N:tgEaENMM:rhEdndnaHaiaXcx2fgsclfydbcdtfydbaHasydbcdtfydbfaHascwfydbcdtfydbfgsaQ6mbasaQ9hmeaEah9DTmekaEhhashQaXhKkazclfhzavcufgvmbkaKcuSmbaKhLkdnamaiaLcx2fgrydbarclfydbarcwfydbaCabaeadaPawaqa3z:fjjjbTmbaPcefhPJbbbbhRJbbbbh8UJbbbbh8VJbbbbh8WJbbbbh8XJbbbbh8YkcbhXinaAaOaraXcdtfydbcdtgsfydbcdtfgKhzaHasfgvydbgQhsdnaQTmbdninazydbaLSmeazclfhzascufgsTmdxbkkazaKaQcdtfc98fydbBdbavavydbcufBdbkaXcefgXci9hmbka8AaLcK2fgzIdbhEazIdlhhazIdwh8KazIdxh5azIdzh8EazIdCh8FaYaLfce86bba8Ya8FMh8Ya8Xa8EMh8Xa8Wa5Mh8Wa8Va8KMh8Va8UahMh8UaRaEMhRamydxh8Sxbkkamc:WDf8KjjjjbaPkjoivuv99lu8Jjjjjbca9Rgo8Kjjjjbdndnalcw0mbaiydbhraeabcitfgwalcdtciVBdlawarBdbdnalcd6mbaiclfhralcufhDawcxfhwinarydbhqawcuBdbawc98faqBdbawcwfhwarclfhraDcufgDmbkkalabfhwxekcbhqaocbBdKao9cb83izaocbBdwao9cb83ibJbbjZhkJbbjZhxinadaiaqcdtfydbcK2fhDcbhwinaoczfawfgraDawfIdbgmarIdbgP:tgsaxNaPMgPUdbaoawfgrasamaP:tNarIdbMUdbawclfgwcx9hmbkJbbjZakJbbjZMgk:vhxaqcefgqal9hmbkcbhradcbcecdaoIdlgmaoIdwgP9GEgwaoIdbgsaP9GEawasam9GEgzcdtgwfhHaoczfawfIdbhmaihwalhDinaiarcdtfgqydbhOaqawydbgABdbawaOBdbawclfhwaraHaAcK2fIdbam9DfhraDcufgDmbkdndnarcv6mbavc8X9kmbaralc98f6mekaiydbhraeabcitfgwalcdtciVBdlawarBdbaiclfhralcufhDawcxfhwinarydbhqawcuBdbawc98faqBdbawcwfhwarclfhraDcufgDmbkalabfhwxekaeabcitfgwamUdbawawydlc98GazVBdlabcefaeadaiaravcefgqz:djjjbhDawawydlciGaDabcu7fcdtVBdlaDaeadaiarcdtfalar9Raqz:djjjbhwkaocaf8Kjjjjbawk;Oddvue99dninabaecitfgrydlgwcd4gDTmednawciGgqci9hmbcihqdnawcl6mbabaecitfhbcbheawhqcehkindnaiabydbgDfRbbmbcbhkadaDcK2fgwIdwalIdw:tgxaxNawIdbalIdb:tgxaxNawIdlalIdl:tgxaxNMM:rgxaoIdb9DTmbaoaxUdbavaDBdbarydlhqkabcwfhbaecefgeaqcd46mbkakceGTmikaraqciGBdlskdnabcbaDalaqcdtfIdbarIdb:tgxJbbbb9FEgwaD7aecefgDfgecitfydlabawaDfgDcitfydlVci0mbaraqBdlkabaDadaialavaoz:ejjjbax:laoIdb9Fmbkkkjlevudndnabydwgxaladcetfgm8Vebcs4alaecetfgP8Vebgscs4falaicetfgz8Vebcs4ffaD0mbakmbcbhDabydxaq6mekavawcltfgxab8Pdw83dwaxab8Pdb83dbabydbhDdnabydwgwTmbaoaDcdtfhxawhsinalaxydbcetfcFFi87ebaxclfhxascufgsmbkkabaDawfBdbabydxhxab9cb83dwababydlaxci2fBdlaP8VebhscehDcbhxkdnascztcz91cu9kmbabaxcefBdwaPax87ebaoabydbcdtfaxcdtfaeBdbkdnam8Uebcu9kmbababydwgxcefBdwamax87ebaoabydbcdtfaxcdtfadBdbkdnaz8Uebcu9kmbababydwgxcefBdwazax87ebaoabydbcdtfaxcdtfaiBdbkarabydlfabydxci2faPRbb86bbarabydlfabydxci2fcefamRbb86bbarabydlfabydxci2fcdfazRbb86bbababydxcefBdxaDk:mPrHue99eue99eue99iu8Jjjjjbc;W;Gb9Rgx8KjjjjbdndnalmbcbhmxekcbhPaxc:m;Gbfcbc;Kbz:rjjjb8Aaxcualci9UgscltascjjjjiGEcbyd;0:G:cjbHjjjjbbgzBd:m9GaxceBd;S9GaxcuascK2gHcKfalcpFFFe0Ecbyd;0:G:cjbHjjjjbbgOBd:q9GaxcdBd;S9Gdnalci6gAmbarcd4hCascdthXaOhQazhLinavaiaPcx2fgrydwaC2cdtfhKavarydlaC2cdtfhYavarydbaC2cdtfh8AcbhraLhEinaQarfgma8Aarfg3Idbg5aYarfg8EIdbg8Fa5a8F9DEg5UdbamaKarfgaIdbg8Fa5a8Fa59DEg8FUdbamcxfgma3Idbg5a8EIdbgha5ah9EEg5UdbamaaIdbgha5aha59EEg5UdbaEa8Fa5MJbbbZNUdbaEaXfhEarclfgrcx9hmbkaQcKfhQaLclfhLaPcefgPas9hmbkkaOaHfgr9cb83dbar9cb83dzar9cb83dwaxcuascx2gralc:bjjjl0Ecbyd;0:G:cjbHjjjjbbgHBdN9GaxciBd;S9GascdthgazarfhvaxcwVhPaxclVhCaHh8Jazh8KcbhLinaxcbcj;Gbz:rjjjbhEaLas2cdthadnaAmba8Khrash3inaEarydbgmc8F91cjjjj94Vam7gmcQ4cx2fg8Ea8EydwcefBdwaEamcd4cFrGcx2fg8Ea8EydbcefBdbaEamcx4cFrGcx2fgmamydlcefBdlarclfhra3cufg3mbkkazaafh8AaHaafhXcbhmcbh3cbh8EcbhainaEamfgrydbhQara3BdbarcwfgKydbhYaKaaBdbarclfgrydbhKara8EBdbaQa3fh3aYaafhaaKa8Efh8Eamcxfgmcj;Gb9hmbkdnaAmbcbhravhminamarBdbamclfhmasarcefgr9hmbkavhrashminaEa8Aarydbg3cdtfydbg8Ec8F91a8E7cd4cFrGcx2fg8Ea8Eydbg8EcefBdbaXa8Ecdtfa3Bdbarclfhramcufgmmbka8JhrashminaCa8Aarydbg3cdtfydbg8Ec8F91a8E7cx4cFrGcx2fg8Ea8Eydbg8EcefBdbava8Ecdtfa3BdbarclfhramcufgmmbkavhrashminaPa8Aarydbg3cdtfydbg8Ec8F91cjjjj94Va8E7cQ4cx2fg8Ea8Eydbg8EcefBdbaXa8Ecdtfa3Bdbarclfhramcufgmmbkka8Jagfh8Ja8Kagfh8KaLcefgLci9hmbkaEaocetgrcuaocu9kEcbyd;0:G:cjbHjjjjbbgKBd:y9GaEclBd;S9Gdndnaoal9nmbaihralhminaKarydbcetfcFFi87ebarclfhramcufgmmbxdkkaKcFearz:rjjjb8Akcbh8EaEascbyd;0:G:cjbHjjjjbbg8ABd:C9GaOaHaHascdtfaHascitfa8AascbazaKaiawaDaqakz:hjjjbdndnalci6mba8Ahrashmina8EarRbbfh8EarcefhramcufgmmbkaE9cb83iwaE9cb83ibalawc9:fgrfcufar9UgrasaDfcufaD9Ugmaram0EhYcbhmcbhra8Ehaincbh3dnarTmba8AarfRbbceSh3kamaEaiaHydbcx2fgQydbaQclfydbaQcwfydbaKabaeadamawaqa3a3ce7a8EaY9nVaaamfaY6VGz:fjjjbfhmaHclfhHaaa8AarfRbb9Rhaasarcefgr9hmbkaEydxTmeabamcltfgraE8Piw83dwaraE8Pib83dbamcefhmxekaE9cb83iwaE9cb83ibcbhmkczhrinaEc:m;Gbfarfydbcbyd;4:G:cjbH:bjjjbbarc98fgrc989hmbkkaxc;W;Gbf8Kjjjjbamk:wKDQue99iue99iul9:euw99iu8Jjjjjbc;qb9RgP8Kjjjjbaxhsaxhzdndnavax0gHmbdnavTmbcbhOaehzavhAinawaDazydbcx2fgCcwfydbcetfgX8VebhQawaCclfydbcetfgL8VebhKawaCydbcetfgC8VebhYaXce87ebaLce87ebaCce87ebaOaKcs4aYcs4faQcs4ffhOazclfhzaAcufgAmbkaehzavhAinawaDazydbcx2fgCcwfydbcetfcFFi87ebawaCclfydbcetfcFFi87ebawaCydbcetfcFFi87ebazclfhzaAcufgAmbkcehzaqhsaOaq0mekalce86bbalcefcbavcufz:rjjjb8AxekaPaiBdxaPadBdwaPaeBdlavakaqci9Ug8Aaka8Aak6EaHEgK9RhEaxaK9Rh3aKcufh5aKceth8EaKcdtgCc98fh8FavcitgOaC9Rarfc98fhaascufhhavcufhgaraOfh8JJbbjZas:Y:vh8KcbazceakaxSEg8Lcdtg8M9Rh8NJFFuuhycuh8PcbhIcbh8RinaPclfa8RcdtfydbhQaPcb8Pd:y:G:cjbg8S83i9iaPcb8Pd:q:G:cjbgR83inaPcb8Pd1:G:cjbg8U83iUaPcb8Pdj:G:cjbg8V83i8WaPa8S83iyaPaR83iaaPa8U83iKaPa8V83izaQavcdtgYfh8WcbhXinabaQaXcdtgLfydbcK2fhAcbhzinaPc8WfazfgCaAazfgOIdbg8XaCIdbg8Ya8Xa8Y9DEUdbaCczfgCaOcxfIdbg8XaCIdbg8Ya8Xa8Y9EEUdbazclfgzcx9hmbkaba8WaXcu7cdtfydbcK2fhAcbhzaPIdUh8ZaPId9ih80aPId80h81aPId9ehBaPId8Wh83aPIdnhUinaPczfazfgCaAazfgOIdbg8XaCIdbg8Ya8Xa8Y9DEUdbaCczfgCaOcxfIdbg8XaCIdbg8Ya8Xa8Y9EEUdbazclfgzcx9hmbkaraLfgza80a8Z:tg8XaUa83:tg8YNa8YaBa81:tg8ZNa8Za8XNMMUdbazaYfaPIdyaPIdK:tg8XaPIdaaPIdz:tg8YNa8YaPId8KaPIdC:tg8ZNa8Za8XNMMUdbaXcefgXav9hmbkcbh85dnaHmbcbhAaQhza8JhCavhXinawaDazydbcx2fgOcwfydbcetfgL8Vebh8WawaOclfydbcetfg858Vebh86awaOydbcetfgO8Vebh87aLce87eba85ce87ebaOce87ebaCaAa86cs4a87cs4fa8Wcs4ffgABdbazclfhzaCclfhCaXcufgXmbkavhCinawaDaQydbcx2fgzcwfydbcetfcFFi87ebawazclfydbcetfcFFi87ebawazydbcetfcFFi87ebaQclfhQaCcufgCmbka8Jh85kdndndndndndndndndndndnava8E6mba8Eax9nmeavavaK9UgzaK29Raza320mda5aE9pmqa85Th87ceh8WaEhQxwka5ag9pmDa8Eax9nmixokavaK6mea5aE9pmwcehQaEhXa85Tmixlka5ag6mlxrka5ag9pmokcbhQaghXa85mekJFFuuh8XcbhLa5hzindnazcefgCaK6mbaQavaC9RgOaK6GmbarazcdtfIdbg8YaC:YNaravaz9RcdtfaYfc94fIdbg8ZaO:YNMg80a8X9Embdndna8KaOahf:YNg81:lJbbb9p9DTmba81:OhAxekcjjjj94hAka8ZasaA2aO9R:YNh8Zdndna8Kazasf:YNg81:lJbbb9p9DTmba81:OhOxekcjjjj94hOkamasaO2aC9R:Ya8YNa8ZMNa80Mg8Ya8Xa8Ya8X9DgOEh8XaCaLaOEhLkaza8LfgzaX6mbxlkkJFFuuh8XcbhLaEhCaahAa8FhOaKhzindnazaK6mbaQaCaK6GmbaraOfIdbg8Yaz:YNaAIdbg8ZaC:YNMg80a8X9Embdndna8Ka85aOfydbgYahf:YNg81:lJbbb9p9DTmba81:Oh8Wxekcjjjj94h8Wkamasa8W2aY9R:Yg81a8YNa8Za81NMNa80Mg8Ya8Xa8Ya8X9DgYEh8XazaLaYEhLkaCa8L9RhCaAa8NfhAaOa8MfhOaza8LfgzcufaX6mbxikka85Th87cbh8WaghQkJFFuuh8XcbhLaEhCaahAa8FhOaKhzindnazazaK9UgXaK29RaXa320mbdna8WTmbaCaCaK9UgXaK29RaXa320mekaraOfIdbg8Yaz:YNaAIdbg8ZaC:YNMg80a8X9EmbazhXaChYdna87mba85aOfydbgXhYkdndna8KaYahf:YNg81:lJbbb9p9DTmba81:Oh86xekcjjjj94h86ka8Zasa862aY9R:YNh8Zdndna8KaXahf:YNg81:lJbbb9p9DTmba81:OhYxekcjjjj94hYkamasaY2aX9R:Ya8YNa8ZMNa80Mg8Ya8Xa8Ya8X9DgXEh8XazaLaXEhLkaCa8L9RhCaAa8NfhAaOa8MfhOaza8LfgzcufaQ6mbkkaLTmba8Xay9DTmba8XhyaLhIa8Rh8Pka8Rcefg8Rci9hmbkdndnaoc8X9kmba8Pcb9omeka8Acufh85cbhYindndndnavaY9RaxaYaxfav0Eg8WTmbcbhAaeaYcdtfgzhCa8WhXinawaDaCydbcx2fgOcwfydbcetfgQ8VebhbawaOclfydbcetfgL8VebhrawaOydbcetfgO8VebhKaQce87ebaLce87ebaOce87ebaAarcs4aKcs4fabcs4ffhAaCclfhCaXcufgXmbka8WhOinawaDazydbcx2fgCcwfydbcetfcFFi87ebawaCclfydbcetfcFFi87ebawaCydbcetfcFFi87ebazclfhzaOcufgOmbkaAaq0mekalaYfgzce86bbazcefcba8Wcufz:rjjjb8AxekalaYfgzce86bbazcefcba85z:rjjjb8Aa8Ah8Wka8WaYfgYav9pmdxbkkaravcdtg8WfhLdnaITmbaPclfa8PcdtfydbhzaIhCinaLazydbfcb86bbazclfhzaCcufgCmbkkdnavaI9nmbaPclfa8PcdtfydbaIcdtfhzavaI9RhCinaLazydbfce86bbazclfhzaCcufgCmbkkcbhYindnaYa8PSmbcbhzaraPclfaYcdtfydbgKa8Wz:qjjjbhCavhXaIhOinaKaOazaLaCydbgQfRbbgAEcdtfaQBdbaCclfhCaOaAfhOazaA9RcefhzaXcufgXmbkkaYcefgYci9hmbkabaeadaialaIaocefgCarawaDaqakaxamz:hjjjbabaeaIcdtgzfadazfaiazfalaIfavaI9RaCarawaDaqakaxamz:hjjjbkaPc;qbf8Kjjjjbk:Seeru8Jjjjjbc:q;ab9Rgo8Kjjjjbaoc:q8WfcFecjzz:rjjjb8AcbhrdnadTmbaehwadhDinaoarcdtfawydbgqBdbaoc:q8WfaqcFiGcdtfgkydbhxakaqBdbawclfhwaraxaq9hfhraDcufgDmbkkabaeadaoaraiavz:jjjjbaoc:q;abf8Kjjjjbk;Sqloud99euD998Jjjjjbc:W;ab9Rgr8KjjjjbdndnadTmbaocd4hwcbhDcbhqindnavaeclfydbaw2cdtfgkIdbavaeydbaw2cdtfgxIdbgm:tgPavaecwfydbaw2cdtfgsIdlaxIdlgz:tgHNakIdlaz:tgOasIdbam:tgAN:tgCaCNaOasIdwaxIdwgX:tgQNakIdwaX:tgOaHN:tgHaHNaOaANaPaQN:tgPaPNMMgOJbbbb9Bmbarc8WfaDcltfgkaCaO:rgO:vgCUdwakaPaO:vgPUdlakaHaO:vgHUdbakaCaXNaHamNazaPNMM:mUdxaDcefhDkaecxfheaqcifgqad6mbkab9cb83dyab9cb83daab9cb83dKab9cb83dzab9cb83dwab9cb83dbaDTmearcbBd8Sar9cb83iKar9cb83izarczfavalaoarc8Sfcbcraiz:kjjjbarIdKhQarIdChLarIdzhKar9cb83iwar9cb83ibararc8WfaDczarc8Sfcbcicbz:kjjjbJbbbbhmdnarIdwgzazNarIdbgHaHNarIdlgXaXNMMgCJbbbb9BmbJbbjZaC:r:vhmkazamNhCaXamNhXaHamNhHJbbjZhmarc8WfheaDhvinaecwfIdbaCNaeIdbaHNaXaeclfIdbNMMgzamazam9DEhmaeczfheavcufgvmbkabaQUdwabaLUdlabaKUdbabarId3UdxdndnamJ;n;m;m899FmbJbbbbhzarc8WfheinaecxfIdbaQaecwfIdbgPNaKaeIdbgONaLaeclfIdbgANMMMaCaPNaHaONaXaANMM:vgPazaPaz9EEhzaeczfheaDcufgDmbkabaCUd8KabaXUdaabaHUd3abaQaCazN:tUdKabaLaXazN:tUdCabaKaHazN:tUdzabJbbjZamamN:t:rgmUdydndnaCJbbj:;aCJbbj:;9GEgzJbbjZazJbbjZ9FEJbb;:9cNJbbbZJbbb:;aCJbbbb9GEMgz:lJbbb9p9DTmbaz:Ohexekcjjjj94hekabae86b8UdndnaXJbbj:;aXJbbj:;9GEgzJbbjZazJbbjZ9FEJbb;:9cNJbbbZJbbb:;aXJbbbb9GEMgz:lJbbb9p9DTmbaz:Ohvxekcjjjj94hvkabav86bRdndnaHJbbj:;aHJbbj:;9GEgzJbbjZazJbbjZ9FEJbb;:9cNJbbbZJbbb:;aHJbbbb9GEMgz:lJbbb9p9DTmbaz:Ohwxekcjjjj94hwkabaw86b8SdndnaecKtcK91:YJbb;:9c:vaC:t:lavcKtcK91:YJbb;:9c:vaX:t:lawcKtcK91:YJbb;:9c:vaH:t:lamMMMJbb;:9cNJbbjZMgm:lJbbb9p9DTmbam:Ohexekcjjjj94hekaecFbaecFb9iEhexekabcjjj;8iBdycFbhekabae86b8Vxekab9cb83dyab9cb83daab9cb83dKab9cb83dzab9cb83dwab9cb83dbkarc:W;abf8Kjjjjbk;7woDuo99eue99euv998Jjjjjbcje9Rgw8Kjjjjbawc;abfcbaocdtgDz:rjjjb8Aawc;GbfcbaDz:rjjjb8AawcafhDawhqaohkinaqcFFF97BdbaDcFFF;7rBdbaqclfhqaDclfhDakcufgkmbkavcd4hxaicd4hmdnadTmbaocx2hPcbhsinashzdnarTmbarascdtfydbhzkaeazam2cdtfgDIdwhHaDIdlhOaDIdbhAalazax2cdtfIdbhCcbhDawcafhqawc;Gbfhvawhkawc;abfhiinaCaDc:O:G:cjbfIdbaHNaDc:G:G:cjbfIdbaANaDc:K:G:cjbfIdbaONMMgXMhQazhLdnaXaC:tgXaqIdbgK9DgYmbavydbhLkavaLBdbazhLdnaQakIdbg8A9EmbaiydbhLa8AhQkaiaLBdbakaQUdbaqaXaKaYEUdbaiclfhiakclfhkavclfhvaqclfhqaPaDcxfgD9hmbkascefgsad9hmbkkJbbbbhQcbhLawc;GbfhDawc;abfhqcbhkinalaqydbgvax2cdtfIdbalaDydbgiax2cdtfIdbaeavam2cdtfgvIdwaeaiam2cdtfgiIdw:tgCaCNavIdbaiIdb:tgCaCNavIdlaiIdl:tgCaCNMM:rMMgCaQaCaQ9EgvEhQakaLavEhLaqclfhqaDclfhDaoakcefgk9hmbkJbbbbhCdnaeawc;abfaLcdtgqfydbgkam2cdtfgDIdwaeawc;Gbfaqfydbgvam2cdtfgqIdwgH:tgXaXNaDIdbaqIdbgA:tg8Aa8ANaDIdlaqIdlgE:tgOaONMMgKJbbbb9ETmbaK:rgCalakax2cdtfIdbMalavax2cdtfIdb:taCaCM:vhCkaQJbbbZNhKaXaCNaHMhHaOaCNaEMhOa8AaCNaAMhAdnadTmbcbhqarhkinaqhDdnarTmbakydbhDkdnalaDax2cdtfIdbg3aeaDam2cdtfgDIdwaH:tgQaQNaDIdbaA:tgCaCNaDIdlaO:tgXaXNMMg5:rgEMg8EaK9ETmbJbbbbh8Adna5Jbbbb9ETmba8EaK:taEaEM:vh8Aka8AaQNaHMhHa8AaXNaOMhOa8AaCNaAMhAa3aKaEMMJbbbZNhKkakclfhkadaqcefgq9hmbkkabaKUdxabaHUdwabaOUdlabaAUdbawcjef8Kjjjjbk:reevu8Jjjjjbcj8W9Rgr8Kjjjjbaici2hwcbhDdnaiTmbarhiawhqinaiaeadRbbgkcdtfydbBdbaDakcefgkaDak0EhDaiclfhiadcefhdaqcufgqmbkkabarawaeaDalaoz:jjjjbarcj8Wf8Kjjjjbk:Eeeeu8Jjjjjbca9Rgo8Kjjjjbab9cb83dyab9cb83daab9cb83dKab9cb83dzab9cb83dwab9cb83dbdnadTmbaocbBd3ao9cb83iwao9cb83ibaoaeadaialaoc3falEavcbalEcrcbz:kjjjbabao8Pib83dbabao8Piw83dwkaocaf8Kjjjjbk::meQu8Jjjjjbcjz9Rgv8KjjjjbcbhoavcjPfcbaez:rjjjb8Aavcjxfcbaez:rjjjb8AdnaiTmbadhoaihrinavcjxfaoRbbfgwawRbbcef86bbavcjxfaocefRbbfgwawRbbcef86bbavcjxfaocdfRbbfgwawRbbcef86bbaocifhoarcufgrmbkcbhDcjehoadhqcehkindndnalTmbcbhxcuhmaqhrakhwcuhPinawcufamaoavcjPfarcefRbbgsfRbb9RcFeGgzci6aoavcjPfarRbbgHfRbb9RcFeGgOci6faoavcjPfarcdfRbbgAfRbb9RcFeGgCci6fgXcOtaOcFr7azaCf9RcwtVavcjxfaAfRbbgzavcjxfaHfRbbgHavcjxfasfRbbgsaHas6Egsazas6EcFe7VgsaP9kgzEhmaXcd6gHaxcefgOal9iVce9hmdasaPazEhPaxaOaHEhxarcifhrawai6hsawcefhwasmbxdkkcuhmaqhrakhwcuhxinawcufamaoavcjPfarcefRbbfRbb9RcFeGci6aoavcjPfarRbbfRbb9RcFeGci6faoavcjPfarcdfRbbfRbb9RcFeGci6fgPax9kgsEhmaPce0meaPaxasEhxarcifhrawai6hPawcefhwaPmbkkadamci2fgrcdfRbbhwarcefRbbhxarRbbhPadaDci2fgrcifaramaD9Rci2zNjjjb8AaPavcjPffaocefgo86bbaPavcjxffgmamRbbcuf86bbaxavcjPffao86bbaxavcjxffgmamRbbcuf86bbarcdfaw86bbarcefax86bbaraP86bbawavcjPffao86bbawavcjxffgrarRbbcuf86bbaqcifhqakcefhkaDcefgDai9hmbkcbhzdnalcb9mmbcbhsavcjPfcbaez:rjjjb8Aadcvfhlinadasci2fgxcefgDRbbhoaxcdfgqRbbhrdndnavcjPfaxRbbgmfRbbmbavcjPfarfRbbhwdndndnavcjPfaofRbbTmbawcFeGTmexikawcFeGmdascefgAai9pmdasc980mdascifhQcbhLarcFeGhCamcFeGhXalhwcbhKcbhYinawcufRbbhPawRbbhOcehkdndnawc9:fRbbgHao9hmbaPcFeGamSmekdnaPcFeGao9hmbaOcFeGamSmekaHamSaOcFeGaoSGhkkceh8AaYceGhYdndnaHar9hmbaPcFeGaoSmekdnaPcFeGar9hmbaOcFeGaoSmekaHaoSaOcFeGarSGh8AkakaYVhYaLaHcFeGgHaXSaPcFeGgPaCSGaPaXSaOcFeGgPaCSGVaHaCSaPaXSGVVhLa8AaKceGVhKdnaAcefgPai9pmbawcifhwaAaQ6hHaPhAaHmekkaYTmeaKmekarhwaohPaohHarhOamhrxdkdnaYTaLVceGTmbaYaKTVaLVceGmekamhwarhParhHamhOaohrxekaohwamhPamhHaohOkavcjPfarfce86bbavcjPfawfce86bbaxaH86bbaqar86bbaDaO86bbavcjPfaPfce86bbalcifhlascefgsai9hmbkkavcFeaecetz:rjjjbhwaici2hrindnawadRbbgmcetfgx8Uebgocu9kmbaxaz87ebawcjlfazcdtfabamcdtfydbBdbazhoazcefhzkadao86bbadcefhdarcufgrmbkazcdthokabavcjlfaoz:qjjjb8Aavcjzf8KjjjjbkObabaiaeadcbz:njjjbk9teiucbcbyd;8:G:cjbgeabcifc98GfgbBd;8:G:cjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;LeeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiclfaeclfydbBdbaicwfaecwfydbBdbaicxfaecxfydbBdbaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk;aeedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdbaicxfalBdbaicwfalBdbaiclfalBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabk9teiucbcbyd;8:G:cjbgeabcrfc94GfgbBd;8:G:cjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaikTeeucbabcbyd;8:G:cjbge9Rcifc98GaefgbBd;8:G:cjbdnabZbcztge9nmbabae9RcFFifcz4nb8Akk:3qeludndnadch6mbadTmeabaead;8qbbabskabaeSmbdnaeadabfgi9Rcbadcet9R0mbadTmeabaead;8qbbabskaeab7ciGhldndndnabae9pmbdnalTmbadhvabhixikdnabciGmbadhvabhixdkadTmiabaeRbb86bbadcufhvdnabcefgiciGmbaecefhexdkavTmiabaeRbe86beadc9:fhvdnabcdfgiciGmbaecdfhexdkavTmiabaeRbd86bdadc99fhvdnabcifgiciGmbaecifhexdkavTmiabaeRbi86biabclfhiaeclfheadc98fhvxekdnalmbdnaiciGTmbadTmlabadcufgifglaeaifRbb86bbdnalciGmbaihdxekaiTmlabadc9:fgifglaeaifRbb86bbdnalciGmbaihdxekaiTmlabadc99fgifglaeaifRbb86bbdnalciGmbaihdxekaiTmlabadc98fgdfaeadfRbb86bbkadcl6mbdnadc98fgocxGcxSmbaocd4cefciGhiaec98fhlabc98fhvinavadfaladfydbBdbadc98fhdaicufgimbkkaocx6mbaec9Wfhvabc9WfhoinaoadfgicxfavadfglcxfydbBdbaicwfalcwfydbBdbaiclfalclfydbBdbaialydbBdbadc9Wfgdci0mbkkadTmdadhidnadciGglTmbaecufhvabcufhoadhiinaoaifavaifRbb86bbaicufhialcufglmbkkadcl6mdaec98fhlabc98fhvinavaifgecifalaifgdcifRbb86bbaecdfadcdfRbb86bbaecefadcefRbb86bbaeadRbb86bbaic98fgimbxikkavcl6mbdnavc98fglc3Gc3Smbavalcd4cefcrGgdcdt9RhvinaiaeydbBdbaeclfheaiclfhiadcufgdmbkkalc36mbinaiaeydbBdbaiclfaeclfydbBdbaicwfaecwfydbBdbaicxfaecxfydbBdbaiczfaeczfydbBdbaicCfaecCfydbBdbaicKfaecKfydbBdbaic3faec3fydbBdbaecafheaicafhiavc9Gfgvci0mbkkavTmbdndnavcrGgdmbavhlxekavc94GhlinaiaeRbb86bbaicefhiaecefheadcufgdmbkkavcw6mbinaiaeRbb86bbaicefaecefRbb86bbaicdfaecdfRbb86bbaicifaecifRbb86bbaiclfaeclfRbb86bbaicvfaecvfRbb86bbaicofaecofRbb86bbaicrfaecrfRbb86bbaicwfhiaecwfhealc94fglmbkkabkk:pedbcj:GdktFFuuFFuuFFuubbbbFFuFFFuFFFuFbbbbbbjZbbbbbbbbbbbbbbjZbbbbbbbbbbbbbbjZ86;nAZ86;nAZ86;nAZ86;nA:;86;nAZ86;nAZ86;nAZ86;nA:;86;nAZ86;nAZ86;nAZ86;nA:;bc;0:Gdkxebbbdbbbj:qbb",e=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var t,n=WebAssembly.instantiate(i(a),{}).then(function(y){t=y.instance,t.exports.__wasm_call_ctors()});function i(y){for(var p=new Uint8Array(y.length),u=0;u<y.length;++u){var m=y.charCodeAt(u);p[u]=m>96?m-97:m>64?m-39:m+4}for(var M=0,u=0;u<y.length;++u)p[M++]=p[u]<60?e[p[u]]:(p[u]-60)*64+p[++u];return p.buffer.slice(0,M)}function s(y){if(!y)throw new Error("Assertion failed")}function r(y){return new Uint8Array(y.buffer,y.byteOffset,y.byteLength)}var o=48,l=16;function c(y,p){var u=y.meshlets[p*4+0],m=y.meshlets[p*4+1],M=y.meshlets[p*4+2],x=y.meshlets[p*4+3];return{vertices:y.vertices.subarray(u,u+M),triangles:y.triangles.subarray(m,m+x*3)}}function h(y,p,u,m,M,x,S,w,T,v){var E=t.exports.sbrk,C=t.exports.meshopt_buildMeshletsBound(p.length,x,S),I=E(C*l),k=E(p.length*4),O=E(p.length),V=E(p.byteLength),P=E(u.byteLength),j=new Uint8Array(t.exports.memory.buffer);j.set(r(p),V),j.set(r(u),P);var B=y(I,k,O,V,p.length,P,m,M,x,S,w,T,v);j=new Uint8Array(t.exports.memory.buffer);for(var K=j.subarray(I,I+B*l),Q=new Uint32Array(K.buffer,K.byteOffset,K.byteLength/4).slice(),ee=0;ee<B;++ee){var ae=Q[ee*4+0],ie=Q[ee*4+1],m=Q[ee*4+2],ke=Q[ee*4+3];t.exports.meshopt_optimizeMeshlet(k+ae*4,O+ie,ke,m)}var Ke=B?Q[(B-1)*4+0]+Q[(B-1)*4+2]:0,Ge=B?Q[(B-1)*4+1]+Q[(B-1)*4+3]*3:0,J={meshlets:Q,vertices:new Uint32Array(j.buffer,k,Ke).slice(),triangles:new Uint8Array(j.buffer,O,Ge).slice(),meshletCount:B};return E(I-E(0)),J}function d(y){var p=new Float32Array(t.exports.memory.buffer,y,o/4);return{centerX:p[0],centerY:p[1],centerZ:p[2],radius:p[3],coneApexX:p[4],coneApexY:p[5],coneApexZ:p[6],coneAxisX:p[7],coneAxisY:p[8],coneAxisZ:p[9],coneCutoff:p[10]}}function f(y,p,u,m){var M=t.exports.sbrk,x=[],S=M(p.byteLength),w=M(y.vertices.byteLength),T=M(y.triangles.byteLength),v=M(o),E=new Uint8Array(t.exports.memory.buffer);E.set(r(p),S),E.set(r(y.vertices),w),E.set(r(y.triangles),T);for(var C=0;C<y.meshletCount;++C){var I=y.meshlets[C*4+0],k=y.meshlets[C*4+1],O=y.meshlets[C*4+3];t.exports.meshopt_computeMeshletBounds(v,w+I*4,T+k,O,S,u,m),x.push(d(v))}return M(S-M(0)),x}function b(y,p,u,m){var M=t.exports.sbrk,x=M(o),S=M(y.byteLength),w=M(p.byteLength),T=new Uint8Array(t.exports.memory.buffer);T.set(r(y),S),T.set(r(p),w),t.exports.meshopt_computeClusterBounds(x,S,y.length,w,u,m);var v=d(x);return M(x-M(0)),v}function g(y,p,u,m,M){var x=t.exports.sbrk,S=x(o),w=x(y.byteLength),T=m?x(m.byteLength):0,v=new Uint8Array(t.exports.memory.buffer);v.set(r(y),w),m&&v.set(r(m),T),t.exports.meshopt_computeSphereBounds(S,w,p,u,T,m?M:0);var E=d(S);return x(S-x(0)),E}return{ready:n,supported:!0,buildMeshlets:function(y,p,u,m,M,x){s(y.length%3==0),s(p instanceof Float32Array),s(p.length%u==0),s(u>=3),s(m>=3&&m<=256),s(M>=1&&M<=512),x=x||0;var S=y.BYTES_PER_ELEMENT==4?y:new Uint32Array(y);return h(t.exports.meshopt_buildMeshletsFlex,S,p,p.length/u,u*4,m,M,M,x,0)},buildMeshletsFlex:function(y,p,u,m,M,x,S,w){s(y.length%3==0),s(p instanceof Float32Array),s(p.length%u==0),s(u>=3),s(m>=3&&m<=256),s(M>=1&&x<=512),s(M<=x),S=S||0,w=w||0;var T=y.BYTES_PER_ELEMENT==4?y:new Uint32Array(y);return h(t.exports.meshopt_buildMeshletsFlex,T,p,p.length/u,u*4,m,M,x,S,w)},buildMeshletsSpatial:function(y,p,u,m,M,x,S){s(y.length%3==0),s(p instanceof Float32Array),s(p.length%u==0),s(u>=3),s(m>=3&&m<=256),s(M>=1&&x<=512),s(M<=x),S=S||0;var w=y.BYTES_PER_ELEMENT==4?y:new Uint32Array(y);return h(t.exports.meshopt_buildMeshletsSpatial,w,p,p.length/u,u*4,m,M,x,S)},extractMeshlet:function(y,p){return s(p>=0&&p<y.meshletCount),c(y,p)},computeClusterBounds:function(y,p,u){s(y.length%3==0),s(y.length/3<=512),s(p instanceof Float32Array),s(p.length%u==0),s(u>=3);var m=y.BYTES_PER_ELEMENT==4?y:new Uint32Array(y);return b(m,p,p.length/u,u*4)},computeMeshletBounds:function(y,p,u){return s(p instanceof Float32Array),s(p.length%u==0),s(u>=3),f(y,p,p.length/u,u*4)},computeSphereBounds:function(y,p,u,m){return s(y instanceof Float32Array),s(y.length%p==0),s(p>=3),s(!u||u instanceof Float32Array),s(!u||u.length%m==0),s(!u||m>=1),s(!u||y.length/p==u.length/m),m=m||0,g(y,y.length/p,p*4,u,m*4)}}})();var Iv=(function(){var a="b9H79Tebbbegv9Geueu9Geub9Gbb9Gkuuuuuuuuuuub9Giuuueuirodiblbelve9Weiiviebeoweuecj:Gdkrnlo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bbK9TW79O9V9Wt9F9NW9UWV9HtW9u9H9U9NW9Ut7bel79IV9RbdDwebcekdlvq;m8Lodbk:wgvOuw99iuv99vu8Jjjjjbc;Wb9Rgk8Kjjjjbakcxfcbc;Kbz:djjjb8AakcualcdtgxalcFFFFi0Ecbyd:q:G:cjbHjjjjbbgmBdxakceBd2adci9UhPalcd4alfhscehzinazgHcethzaHas6mbkakcuaHcdtgzaHcFFFFi0Ecbyd:q:G:cjbHjjjjbbgsBdzakcdBd2ascFeazz:djjjbhOaDcd4hAarcd4hCavcd4hXdnalTmbaHcufhrcbhvindndnaOcbaiavaX2cdtfgHydlgDaDcjjjj94SEgscH4cbaoavaC2cdtfgzydlgQcs4aQcjjjj94SE7as7c:F:b:DD2cbaHydbgLaLcjjjj94SEgscH4cbazydbgKcs4aKcjjjj94SE7as7c;D;O:B8J27cbaHydwgYaYcjjjj94SEgHcH4cbazydwg8Acs4a8Acjjjj94SE7aH7c:3F;N8N27awavaA2cdtfgHydlgEaHydbg37cFFFFrGgHcm4aH7c:fjjK27arGgscdtfgHydbgzcuSmbaE::h5a3::h8Ea8A::h8FaQ::haaK::hhaY::hgaD::h8JaL::h8KcehDinaDhHdnaiazaX2cdtfgDIdba8K9CmbaDIdla8J9CmbaDIdwag9CmbaoazaC2cdtfgDIdbah9CmbaDIdlaa9CmbaDIdwa8F9CmbawazaA2cdtfgDIdba8E9CmbaDIdla59BmikaHcefhDaOasaHfarGgscdtfgHydbgzcu9hmbkkaHavBdbavhzkamavcdtfazBdbavcefgval9hmbkkaOcbydN:G:cjbH:bjjjbbakceBd2akcualcefgHcdtaHcFFFFi0Ecbyd:q:G:cjbHjjjjbbg8LBdzakcdBd2akcuadcdtadcFFFFi0EgYcbyd:q:G:cjbHjjjjbbg8MBdCakciBd2a8Lclfcbaxz:djjjbhzdnadTmbdnaeTmbaehHadhsinazamaHydbcdtfydbcdtfgDaDydbcefBdbaHclfhHascufgsmbxdkkamhHadhsinazaHydbcdtfgDaDydbcefBdbaHclfhHascufgsmbkkdnalTmbcbhsazhHalhDinaHydbhOaHasBdbaHclfhHaOasfhsaDcufgDmbkkdnadci6gQmbcbhscdhHaPhOindndnaeTmbamaeasfgvydbcdtfhDamavcwfydbcdtfhramavclfydbcdtfhvxekamasfgDcwfhraDclfhvkarydbhravydbhvazaDydbcdtfgDaDydbgDcefBdba8MaDcdtfaHc9:fBdbazavcdtfgDaDydbgDcefBdba8MaDcdtfaHcufBdbazarcdtfgDaDydbgDcefBdba8MaDcdtfaHBdbascxfhsaHclfhHaOcufgOmbkkcbhsa8LcbBdbakcuaPcltadcFFFFd0Ecbyd:q:G:cjbHjjjjbbg8NBdKakclBd2dnaQmbaehza8NhHaPhvindndnaeTmbazcwfydbhDazclfydbhOazydbhrxekascdfhDascefhOashrkJbbbbh8KJbbbbJbbbbJbbbbJbbbbJbbjZJbbj:;awaOaA2cdtfgQIdbawaraA2cdtfgLIdbgh:tawaDaA2cdtfgKIdlaLIdlgg:tg8JNaQIdlag:tggaKIdbah:tN:tghJbbbb9EEahJbbbb9BEg8EaiaraX2cdtfgrIdwghaiaOaX2cdtfgOIdwg59BEa8EarIdlgaaOIdlgy9BEa8EarIdbg8FaOIdbg8P9BEg8EahaiaDaX2cdtfgDIdwgI9BEa8EaaaDIdlg8R9BEa8Ea8FaDIdbg8S9BEg8Ea5aI9BEa8Eaya8R9BEa8Ea8Pa8S9BEh8Edna8Ja5ah:tNagaIah:tN:tghahNa8Ja8Pa8F:tNaga8Sa8F:tN:tg8Fa8FNa8Jayaa:tNaga8Raa:tN:tg8Ja8JNMMggJbbbb9Bmba8Eag:r:vh8KkaHcxfa8EUdbaHcwfaha8KNUdbaHclfa8Ja8KNUdbaHa8Fa8KNUdbazcxfhzaHczfhHascifhsavcufgvmbkkcbhHakaYcbyd:q:G:cjbHjjjjbbgDBd3akcvBd2dnadTmbaDhzinazaHBdbazclfhzadaHcefgH9hmbkkakcuaPcdtadcFFFF970Ecbyd:q:G:cjbHjjjjbbgvBdaakcoBd2akaPcbyd:q:G:cjbHjjjjbbg8ABd8KakcrBd2dnadci6mba8NcxfhzavhscbhHinasaHBdba8AaHfcdcbazIdbg8KJbbbb9DEa8KJbbbb9EV86bbasclfhsazczfhzaPaHcefgH9hmbkkdnalTmbcbhRinaRcdthHdna8LaRcefgRcdtfydbgza8LaHfydbgHSmbazaH9RhLa8MaHcdtfhKcbh8UinaKa8Ucdtfg8VydbgHcd4g8Wci2gxaHciGcdtgzyd:e:G:cjbfhHaxazydj:G:cjbfhzdnaeTmbaeaHcdtfydbhHaeazcdtfydbhzkdna8Ucefg8UaL9pmbamaHcdtfydbhYamazcdtfydbh3a8Aa8WfhEava8Wcdtfh8Xa8UhwinaKawcdtfgQydbgHcd4gzci2gAaHciGcdtgHyd:e:G:cjbfhsaAaHydj:G:cjbfhHdnaeTmbaeascdtfydbhsaeaHcdtfydbhHkdndnamaHcdtfydbaYSmbamascdtfydba39hmeka8AazfRbbgHaERbbgsVciSmbdnaHasGmba8Whsdna8Wa8XydbgHSmba8XhOinaOavaHgscdtfgrydbgHBdbarhOasaH9hmbkkdnazavazcdtfgOydbgHSmbinaOavaHgzcdtfgrydbgHBdbarhOazaH9hmbkkasazSmba8AazfgORbba8AasfgHRbbVciSmeavazcdtfasBdbaHaHRbbaORbbV86bbkdna8VydbciGaxfgzaDazcdtfgsydbgHSmbinasaDaHgzcdtfgOydbgHBdbaOhsazaH9hmbkkdnaQydbciGaAfgsaDascdtfgOydbgHSmbinaOaDaHgscdtfgrydbgHBdbarhOasaH9hmbkkazasSmbaDascdtfazBdbkawcefgwaL9hmbkka8UaL9hmbkkaRal9hmbkkdnadTmbcbhrinarhzdnaraDarcdtfgwydbgHSmbawhsinasaDaHgzcdtfgOydbgHBdbaOhsazaH9hmbkkawazBdbarcefgrad9hmbkcbh8Vabcbadcltz:djjjbhKdnadci6mbaqceGhEaDhYaeh3cbh8Windna8Na8WcltfgsIdxJbbbb9Bmbama8Wcx2gHfhxaeaHfhLcbhza8VhwinaKaYazfydbcltfhHdndnaeTmbamaLazc:e:G:cjbfydbcdtfydbcdtfhAamaLazcj:G:cjbfydbcdtfydbcdtfhra3azfydbhOxekaxazc:e:G:cjbfydbcdtfhAaxazcj:G:cjbfydbcdtfhrawhOkaHasIdbggaoamaOcdtfydbgQaC2cdtfgOIdbg8KasIdwg8FaOIdwg8JNaga8KNasIdlg8EaOIdlggNMMghN:tgaJbbbbJbbjZa8Fa8JahN:tg8Fa8FNaaaaNa8EagahN:tghahNMMga:r:vaaJbbbb9BEJ;As6nJbbjZaiarydbaX2cdtfgOIdwaiaQaX2cdtfgrIdwg5:tgaa8Jaaa8JNaOIdbarIdbgy:tg8Pa8KNagaOIdlarIdlgI:tg8RNMMgaN:tg8EaiaAydbaX2cdtfgOIdwa5:tg5a8Ja5a8JNaOIdbay:tg8Sa8KNagaOIdlaI:tgINMMg5N:tg8JNa8Pa8KaaN:tgya8Sa8Ka5N:tg8KNa8RagaaN:tgaaIaga5N:tggNMMJbbbbJbbjZa8Ea8ENayayNaaaaNMMa8Ja8JNa8Ka8KNagagNMMNg8K:rg8J:va8KJbbbb9BENgg:lg8Ka8KJbbjZ9EEg8Ka8KJ7;A9s89NJ:L9t9s::MNJ;ob;jZMJbbjZa8K:t:rNg8K:ta8KagJbbbb9DENg8Ka8Ja8KNaEEg8KNaHIdbMUdbaHaha8KNaHIdlMUdlaHa8Fa8KNaHIdwMUdwawcefhwazclfgzcx9hmbkkaYcxfhYa3cxfh3a8Vcifh8Va8Wcefg8WaP9hmbkcbhrinarhzdnaravarcdtfgsydbgHSmbinasavaHgzcdtfgOydbgHBdbaOhsazaH9hmbkkaKarc8W2fgHc3fJbbjZJbbj:;a8AazfRbbceGEg8KUdbaHc8Sfa8KUdbaHa8KUdxarcefgraP9hmbkkaqcdGhvcbhzaDhsaKhHindnazasydb9hmbJbbbbh8KdnaHcwfgOIdbg8Ja8JNaHIdbggagNaHclfgrIdbghahNMMgaJbbbb9BmbJbbjZaa:r:vh8KkaOa8Ja8KNUdbaraha8KNUdbaHaga8KNg8JUdbavmbaHJbbjZa8Ja8KJbbbb9BEUdbkasclfhsaHczfhHadazcefgz9hmbkcbhHaKhzindnaHaDydbgsSmbazaKascltfgsydwBdwazas8Pdb83dbkaDclfhDazczfhzadaHcefgH9hmbkkdnakyd2gzTmbazcdtakcxffc98fhHinaHydbcbydN:G:cjbH:bjjjbbaHc98fhHazcufgzmbkkakc;Wbf8Kjjjjbk9teiucbcbyd:y:G:cjbgeabcifc98GfgbBd:y:G:cjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;aeedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdbaicxfalBdbaicwfalBdbaiclfalBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabk9teiucbcbyd:y:G:cjbgeabcrfc94GfgbBd:y:G:cjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaikTeeucbabcbyd:y:G:cjbge9Rcifc98GaefgbBd:y:G:cjbdnabZbcztge9nmbabae9RcFFifcz4nb8Akkk8Rdbcj:Gdkzebbbdbbbbbbbebbbbc:q:Gdkxebbbdbbba:qbb",e=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var t,n=WebAssembly.instantiate(i(a),{}).then(function(c){t=c.instance,t.exports.__wasm_call_ctors()});function i(c){for(var h=new Uint8Array(c.length),d=0;d<c.length;++d){var f=c.charCodeAt(d);h[d]=f>96?f-97:f>64?f-39:f+4}for(var b=0,d=0;d<c.length;++d)h[b++]=h[d]<60?e[h[d]]:(h[d]-60)*64+h[++d];return h.buffer.slice(0,b)}function s(c){if(!c)throw new Error("Assertion failed")}function r(c){return new Uint8Array(c.buffer,c.byteOffset,c.byteLength)}function o(c,h,d,f,b,g,y,p,u,m){var M=t.exports.sbrk,x=M(h*16),S=c?M(c.byteLength):0,w=M(d.byteLength),T=M(g.byteLength),v=M(p.byteLength),E=new Uint8Array(t.exports.memory.buffer);c&&E.set(r(c),S),E.set(r(d),w),E.set(r(g),T),E.set(r(p),v),t.exports.meshopt_generateTangents(x,S,h,w,f,b*4,T,y*4,v,u*4,m),E=new Uint8Array(t.exports.memory.buffer);var C=new Float32Array(E.buffer,x,h*4).slice();return M(x-M(0)),C}var l={Compatible:1,ZeroFallback:2};return{ready:n,supported:!0,generateTangents:function(c,h,d,f,b,g,y,p){s(c===null||c instanceof Uint32Array||c instanceof Int32Array||c instanceof Uint16Array||c instanceof Int16Array),s(c===null||c.length%3==0),s(h instanceof Float32Array),s(h.length%d==0),s(d>=3),s(f instanceof Float32Array),s(f.length%b==0),s(b>=3),s(g instanceof Float32Array),s(g.length%y==0),s(y>=2),s(h.length/d==f.length/b),s(h.length/d==g.length/y),s(c!==null||h.length/d%3==0);for(var u=0,m=0;m<(p?p.length:0);++m)s(p[m]in l),u|=l[p[m]];var M=h.length/d,x=c?c.length:M,S=c===null||c.BYTES_PER_ELEMENT==4?c:new Uint32Array(c);return o(S,x,h,M,d,f,b,g,y,u)}}})();var ox=await fetch("./manifest.json").then(a=>a.json()),Kd=document.querySelector("canvas"),To=new vo({canvas:Kd,antialias:!0});To.setPixelRatio(Math.min(devicePixelRatio,2));To.setClearColor(14477544);var Ms=new zi;Ms.add(new ns(16777215,5203312,2.3),new Pa(16777215,2));Ms.children.at(-1).position.set(2,4,3);var _s=new _t(35,1,.01,20);_s.position.set(1.3,.85,1.8);_s.lookAt(0,.3,0);Ms.add(new ht(new Zi(.75,40),new sn({color:8100753,roughness:1})).rotateX(-Math.PI/2));var Jd=new So;Jd.setMeshoptDecoder(Wd);var Oa=null,Xd=0,Jn="idle",Eo=0,Yd=()=>{let{width:a,height:e}=Kd.getBoundingClientRect();To.setSize(a,e,!1),_s.aspect=a/e,_s.updateProjectionMatrix()};addEventListener("resize",Yd);Yd();function cx(){let a=new Ft,e=new sn({color:4811641,roughness:.9}),t=new sn({color:4081749,roughness:1}),n=new sn({color:2630953,roughness:1});for(let i of[-1,1]){let s=new Ft;s.position.set(i*.048,.235,0);let r=new ht(new bi(.042,.145,4,8),t);r.position.y=-.1145;let o=new ht(new la(.072,.034,.108),n);o.position.set(0,-.212,.018),s.add(r,o),a.add(s);let l=new Ft;l.position.set(i*.09,.402,0);let c=new ht(new bi(.031,.118,4,8),e);c.position.y=-.09,l.add(c),a.add(l)}return a}async function Zd(a){Oa?.removeFromParent();let e=ox.characters.find(s=>s.avatar===a),t=await Jd.loadAsync(`.${e.url}`),n=new Ft,i=t.scene;i.scale.setScalar(.58/e.sourceFullBounds.max[1]),i.position.y=-.58*e.sourceFullBounds.min[1]/e.sourceFullBounds.max[1],n.add(cx(),i),Ms.add(n),Oa=n}for(let a of document.querySelectorAll("[data-avatar]"))a.onclick=()=>Zd(a.dataset.avatar);for(let a of document.querySelectorAll("[data-move]"))a.onclick=()=>{Jn=a.dataset.move,Eo=Jn==="jump"?.55:0};await Zd("bianca");var qd=performance.now();function Qd(a){let e=Math.min(.05,(a-qd)/1e3);if(qd=a,Xd+=e*(Jn==="run"?9:Jn==="walk"?5:0),Oa){let t=Oa.children[0].children,n=Math.sin(Xd)*(Jn==="run"?.95:.58);if(Jn==="walk"||Jn==="run")t[0].rotation.x=-n,t[1].rotation.x=n,t[2].rotation.x=n,t[3].rotation.x=-n;else if(Jn==="wave")t[3].rotation.x=-2.45;else if(Jn==="dance")Oa.rotation.z=Math.sin(a/180)*.2;else for(let i of t)i.rotation.x*=.85;Eo>0?(Eo-=e,Oa.position.y=Math.sin(Math.max(0,Eo)/.55*Math.PI)*.26):Oa.position.y=0}To.render(Ms,_s),requestAnimationFrame(Qd)}requestAnimationFrame(Qd);
