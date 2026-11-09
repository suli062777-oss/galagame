// Shared shape contract. Image bytes are additionally validated on the server.
export const AVATAR_SIZE = 192;
export const MAX_AVATAR_PIXELS = 256;
export const MAX_AVATAR_BYTES = 90 * 1024;
export const MAX_AVATAR_REQUEST_BYTES = 160 * 1024;
export const PRESETS = Object.freeze([
  {id:'ember',label:'暖橙',background:'#ef704e',hair:'#392327',skin:'#efc09e',shirt:'#623a52',style:'human'},
  {id:'tide',label:'潮汐',background:'#6aa4c9',hair:'#142d48',skin:'#d8aa8f',shirt:'#183f5c',style:'human'},
  {id:'moss',label:'青苔',background:'#76b9a1',hair:'#173c37',skin:'#b2e7d0',shirt:'#1f5f53',style:'robot'},
  {id:'orbit',label:'星轨',background:'#9690d6',hair:'#493049',skin:'#edc5ac',shirt:'#49436d',style:'human'},
  {id:'aurora',label:'晨光',background:'#dbb36b',hair:'#463225',skin:'#b77a58',shirt:'#44675e',style:'glasses'},
  {id:'copper',label:'赤铜',background:'#c88782',hair:'#35282f',skin:'#e6d4b7',shirt:'#465063',style:'robot'}
].map(p=>Object.freeze(p)));
export const DEFAULT_AVATAR = Object.freeze({kind:'preset',id:'ember'});
export function defaultAvatar(seat=0){return {kind:'preset',id:PRESETS[((Math.floor(Number(seat))||0)%4+4)%4].id};}
export function normalizeAvatar(value,{seat=0}={}){
  if(value===null||value===undefined)return defaultAvatar(seat);
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('头像格式无效');
  if(value.kind==='preset'){
    if(Object.keys(value).some(k=>!['kind','id'].includes(k))||!PRESETS.some(p=>p.id===value.id))throw Error('请选择已有头像');
    return {kind:'preset',id:value.id};
  }
  if(value.kind==='image'){
    const prefix='data:image/png;base64,';
    if(Object.keys(value).some(k=>!['kind','dataUrl'].includes(k))||typeof value.dataUrl!=='string'||!value.dataUrl.startsWith(prefix))throw Error('头像必须为裁切后的PNG图片');
    const data=value.dataUrl.slice(prefix.length);
    if(!data||data.length>Math.ceil(MAX_AVATAR_BYTES/3)*4||data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(data))throw Error('头像图片数据无效或过大');
    return {kind:'image',dataUrl:value.dataUrl};
  }
  throw Error('头像类型无效');
}
