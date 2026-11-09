import {handleApi} from './api.js';
import {scheduleNarration,hostStatus} from './host.js';
import {ASSETS} from './assets.js';
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',json:'application/json; charset=utf-8',svg:'image/svg+xml',png:'image/png',webp:'image/webp',jpg:'image/jpeg'};
export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/')){
   if(!env.DB)return Response.json({ok:false,error:'共享房间数据库暂不可用，请稍后重试。',code:'storage_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
   return handleApi(request,env,ctx,{scheduleNarration,hostStatus});
  }
  const path=decodeURIComponent(url.pathname)==='/'?'/index.html':decodeURIComponent(url.pathname),asset=ASSETS[path];
  if(!asset||!['GET','HEAD'].includes(request.method))return new Response('Not found',{status:404});
  const headers={'Content-Type':asset.type||types[path.split('.').pop()]||'application/octet-stream','Cache-Control':/\.(html|js|css)$/.test(path)?'no-store':'public, max-age=3600','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"};
  const body=asset.encoding==='base64'?Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)):asset.body;
  return new Response(request.method==='HEAD'?null:body,{headers});
 }
};
