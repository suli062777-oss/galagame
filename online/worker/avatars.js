import {normalizeAvatar,defaultAvatar,MAX_AVATAR_BYTES,MAX_AVATAR_PIXELS} from './avatar-contract.js';
const SIGNATURE=[137,80,78,71,13,10,26,10];
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function pngCrc(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function concat(parts){const result=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){result.set(p,at);at+=p.length;}return result;}
export async function validateAvatar(value,{seat=0}={}){
 const avatar=normalizeAvatar(value,{seat});if(avatar.kind==='preset')return avatar;
 const base64=avatar.dataUrl.slice(22);let decoded;try{decoded=atob(base64);}catch{throw Error('头像不是有效的PNG图片');}
 if(decoded.length>MAX_AVATAR_BYTES||decoded.length<57||btoa(decoded)!==base64)throw Error('头像不是有效的PNG图片');
 const bytes=Uint8Array.from(decoded,c=>c.charCodeAt(0)),view=new DataView(bytes.buffer);
 if(SIGNATURE.some((v,i)=>bytes[i]!==v))throw Error('头像不是有效的PNG图片');
 let offset=8,width=0,height=0,channels=0,ended=false,sawData=false;const compressed=[];
 while(offset<bytes.length){
  if(offset+12>bytes.length)throw Error('PNG图片不完整');
  const length=view.getUint32(offset),end=offset+12+length;if(end>bytes.length)throw Error('PNG图片不完整');
  const type=String.fromCharCode(...bytes.subarray(offset+4,offset+8)),data=bytes.subarray(offset+8,offset+8+length),dataView=new DataView(data.buffer,data.byteOffset,data.byteLength);
  if(pngCrc(bytes.subarray(offset+4,offset+8+length))!==view.getUint32(offset+8+length))throw Error('PNG校验失败，请重新选择照片');
  if(offset===8&&type!=='IHDR')throw Error('PNG缺少图片尺寸');
  if(type==='IHDR'){
   if(width||length!==13)throw Error('PNG图片头无效');width=dataView.getUint32(0);height=dataView.getUint32(4);channels=data[9]===6?4:data[9]===2?3:0;
   if(width<64||width>MAX_AVATAR_PIXELS||height!==width||data[8]!==8||!channels||data[10]||data[11]||data[12])throw Error('请使用64至256像素的静态方形PNG头像');
  }else if(type==='IDAT'){if(!width)throw Error('PNG图片头无效');sawData=true;compressed.push(data);}
  else if(type==='IEND'){if(length||!sawData||end!==bytes.length)throw Error('PNG结束数据无效');ended=true;offset=end;break;}
  else if(!['sRGB','gAMA','cHRM','pHYs'].includes(type))throw Error('请在头像编辑器中重新裁切照片');offset=end;
 }
 if(!ended||!compressed.length)throw Error('PNG图片不完整');
 const stride=width*channels+1,expected=stride*height;let pixels;
 try{
  const reader=new Blob([concat(compressed)]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();const parts=[];let count=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>expected){await reader.cancel();throw Error('limit');}parts.push(value);}}finally{reader.releaseLock();}
  pixels=concat(parts);
 }catch{throw Error('PNG像素数据无效');}
 if(pixels.length!==expected)throw Error('PNG像素数据无效');for(let row=0;row<height;row++)if(pixels[row*stride]>4)throw Error('PNG像素过滤无效');return avatar;
}
export function publicAvatar(player){try{return normalizeAvatar(player.avatar,{seat:player.seat});}catch{return defaultAvatar(player.seat);}}
