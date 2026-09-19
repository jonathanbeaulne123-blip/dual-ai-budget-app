import {displayJpegDimensions,sourceImageType} from '../boardMedia/image.ts';
import {guestAssert,GUEST_LIMITS} from './guestContracts.ts';
const CRC_TABLE=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc=(bytes:Uint8Array)=>{let c=0xffffffff;for(const b of bytes)c=CRC_TABLE[(c^b)&255]!^(c>>>8);return(c^0xffffffff)>>>0;};
/** Prepared image bytes only. No silent rewrite of an already reviewed visual.
 * PNG structure follows https://www.w3.org/TR/png-3/#5DataRep; pixel decoding remains a browser check. */
export function assertGuestImage(bytes:Uint8Array,mime:'image/png'|'image/jpeg'):void{
 guestAssert(bytes.byteLength>0&&bytes.byteLength<=GUEST_LIMITS.mediaBytes&&sourceImageType(bytes)===mime,'GUEST_MEDIA_UNAVAILABLE');
 if(mime==='image/jpeg'){try{displayJpegDimensions(bytes);}catch{throw Error('GUEST_IMAGE_PREPARATION_REQUIRED');}return;}
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let p=8,width=0,height=0,sawData=false,ended=false;const seen=new Set<string>();
 while(p<bytes.length){
  guestAssert(p+12<=bytes.length,'GUEST_MEDIA_UNAVAILABLE');const length=view.getUint32(p),end=p+12+length;
  guestAssert(end<=bytes.length,'GUEST_MEDIA_UNAVAILABLE');const type=String.fromCharCode(...bytes.subarray(p+4,p+8));
  guestAssert(crc(bytes.subarray(p+4,end-4))===view.getUint32(end-4),'GUEST_MEDIA_UNAVAILABLE');
  guestAssert(['IHDR','IDAT','IEND','sRGB','gAMA','cHRM','pHYs'].includes(type),'GUEST_IMAGE_PREPARATION_REQUIRED');
  guestAssert(type==='IDAT'||!seen.has(type),'GUEST_MEDIA_UNAVAILABLE');
  if(type==='IHDR'){
   guestAssert(p===8&&length===13,'GUEST_MEDIA_UNAVAILABLE');width=view.getUint32(p+8);height=view.getUint32(p+12);
   guestAssert(width>0&&height>0&&width<=10000&&height<=10000&&width*height<=8000000&&bytes[p+16]===8&&[2,6].includes(bytes[p+17]!)&&bytes[p+18]===0&&bytes[p+19]===0&&bytes[p+20]===0,'GUEST_MEDIA_UNAVAILABLE');
  }else{
   guestAssert(width&&height,'GUEST_MEDIA_UNAVAILABLE');
   if(type==='IDAT'){guestAssert(length>0&&!ended,'GUEST_MEDIA_UNAVAILABLE');sawData=true;}
   else if(type==='IEND'){guestAssert(length===0&&sawData&&end===bytes.length,'GUEST_MEDIA_UNAVAILABLE');ended=true;}
   else{
    guestAssert(!sawData,'GUEST_MEDIA_UNAVAILABLE');
    if(type==='sRGB')guestAssert(length===1&&bytes[p+8]!<=3,'GUEST_IMAGE_PREPARATION_REQUIRED');
    if(type==='gAMA')guestAssert(length===4&&view.getUint32(p+8)===45455,'GUEST_IMAGE_PREPARATION_REQUIRED');
    if(type==='pHYs')guestAssert(length===9&&view.getUint32(p+8)===3780&&view.getUint32(p+12)===3780&&bytes[p+16]===1,'GUEST_IMAGE_PREPARATION_REQUIRED');
    if(type==='cHRM')guestAssert(length===32&&[31270,32900,64000,33000,30000,60000,15000,6000].every((v,i)=>view.getUint32(p+8+i*4)===v),'GUEST_IMAGE_PREPARATION_REQUIRED');
   }
  }
  seen.add(type);p=end;
 }
 guestAssert(ended,'GUEST_MEDIA_UNAVAILABLE');
}
