import {inflateSync} from 'node:zlib';
import {normalizeAvatar,defaultAvatar,MAX_AVATAR_BYTES,MAX_AVATAR_PIXELS} from '../public/avatar-contract.js';
const SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function pngCrc(buffer){let crc=0xffffffff;for(const byte of buffer)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export function validateAvatar(value,{seat=0}={}){
  const avatar=normalizeAvatar(value,{seat});
  if(avatar.kind==='preset')return avatar;
  const base64=avatar.dataUrl.slice('data:image/png;base64,'.length),bytes=Buffer.from(base64,'base64');
  if(bytes.length>MAX_AVATAR_BYTES||bytes.length<57||bytes.toString('base64')!==base64||!bytes.subarray(0,8).equals(SIGNATURE))throw Error('头像不是有效的PNG图片');
  let offset=8,width=0,height=0,channels=0,ended=false,sawData=false;const compressed=[];
  while(offset<bytes.length){
    if(offset+12>bytes.length)throw Error('PNG图片不完整');
    const length=bytes.readUInt32BE(offset),end=offset+12+length;
    if(end>bytes.length)throw Error('PNG图片不完整');
    const type=bytes.toString('ascii',offset+4,offset+8),data=bytes.subarray(offset+8,offset+8+length);
    if(pngCrc(bytes.subarray(offset+4,offset+8+length))!==bytes.readUInt32BE(offset+8+length))throw Error('PNG校验失败，请重新选择照片');
    if(offset===8&&type!=='IHDR')throw Error('PNG缺少图片尺寸');
    if(type==='IHDR'){
      if(width||length!==13)throw Error('PNG图片头无效');
      width=data.readUInt32BE(0);height=data.readUInt32BE(4);channels=data[9]===6?4:data[9]===2?3:0;
      if(width<64||width>MAX_AVATAR_PIXELS||height!==width||data[8]!==8||!channels||data[10]!==0||data[11]!==0||data[12]!==0)throw Error('请使用64至256像素的静态方形PNG头像');
    }else if(type==='IDAT'){
      if(!width)throw Error('PNG图片头无效');sawData=true;compressed.push(data);
    }else if(type==='IEND'){
      if(length!==0||!sawData||end!==bytes.length)throw Error('PNG结束数据无效');ended=true;offset=end;break;
    }else if(!['sRGB','gAMA','cHRM','pHYs'].includes(type))throw Error('请在头像编辑器中重新裁切照片');
    offset=end;
  }
  if(!ended||!compressed.length)throw Error('PNG图片不完整');
  const stride=width*channels+1,expected=stride*height;
  let pixels;try{pixels=inflateSync(Buffer.concat(compressed),{maxOutputLength:expected});}catch{throw Error('PNG像素数据无效');}
  if(pixels.length!==expected)throw Error('PNG像素数据无效');
  for(let row=0;row<height;row++)if(pixels[row*stride]>4)throw Error('PNG像素过滤无效');
  return avatar;
}
export function publicAvatar(player){
  try{return normalizeAvatar(player.avatar,{seat:player.seat});}catch{return defaultAvatar(player.seat);}
}
