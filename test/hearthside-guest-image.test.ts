import {expect,it} from 'vitest';
import sharp from 'sharp';
import {assertGuestImage} from '../src/hearthside/guestImage.ts';
const image=()=>sharp({create:{width:12,height:9,channels:4,background:{r:142,g:85,b:104,alpha:1}}});
const chunk=(type:string,data:Buffer)=>{const body=Buffer.concat([Buffer.from(type),data]);let crc=0xffffffff;for(const b of body){crc^=b;for(let i=0;i<8;i++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;}const out=Buffer.alloc(body.length+8);out.writeUInt32BE(data.length,0);body.copy(out,4);out.writeUInt32BE((crc^0xffffffff)>>>0,out.length-4);return out;};
it('admits exact prepared pixels and rejects private PNG chunks, trailing data, CRC corruption and unprepared JPEG metadata',async()=>{
 const source=await image().png().toBuffer(),parts=[source.subarray(0,8)];
 for(let p=8;p<source.length;){const end=p+12+source.readUInt32BE(p);if(source.toString('ascii',p+4,p+8)!=='pHYs')parts.push(source.subarray(p,end));p=end;}
 const png=Buffer.concat(parts),jpeg=await image().jpeg().toBuffer();
 expect(()=>assertGuestImage(png,'image/png')).not.toThrow();expect(()=>assertGuestImage(jpeg,'image/jpeg')).not.toThrow();
 const privateMetadata=Buffer.from('Household\0HH-private balance=123 target=456');
 for(const kind of ['tEXt','iTXt','zTXt','eXIf','iCCP','tIME','acTL']){
  const modified=Buffer.concat([png.subarray(0,33),chunk(kind,privateMetadata),png.subarray(33)]);
  expect(()=>assertGuestImage(modified,'image/png')).toThrow('GUEST_IMAGE_PREPARATION_REQUIRED');
 }
 const corrupt=Buffer.from(png);corrupt[corrupt.length-1]=corrupt[corrupt.length-1]!^1;expect(()=>assertGuestImage(corrupt,'image/png')).toThrow('GUEST_MEDIA_UNAVAILABLE');
 expect(()=>assertGuestImage(Buffer.concat([png,privateMetadata]),'image/png')).toThrow('GUEST_MEDIA_UNAVAILABLE');
 const withExif=await image().withMetadata({exif:{IFD0:{Artist:'Private household'}}}).jpeg().toBuffer();
 expect(()=>assertGuestImage(withExif,'image/jpeg')).toThrow('GUEST_IMAGE_PREPARATION_REQUIRED');
 expect(()=>assertGuestImage(png.subarray(0,8),'image/png')).toThrow();expect(()=>assertGuestImage(png,'image/jpeg')).toThrow();
});
