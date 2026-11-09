/** Pure Web API multiplayer runtime. Deterministic economics + D1 CAS authority. */
import {createHash} from './sha256.js';
import {readRoom,createRoom,mutateRoom} from './storage.js';
import {validateAvatar,publicAvatar} from './avatars.js';
import {defaultAvatar,MAX_AVATAR_REQUEST_BYTES} from './avatar-contract.js';
import {createGame,beginRound,settle,normalizeAction,actionCost,rankings,scriptAction,publicProduct,replayGame,RULES,ACTIONS,PRODUCTS,WAIT} from './engine.js';
const clone=value=>structuredClone(value),hash=value=>createHash('sha256').update(String(value)).digest('hex');
function randomHex(length){const bytes=new Uint8Array(length);crypto.getRandomValues(bytes);return [...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');}
const token=()=>randomHex(32);
const colors=['#e04748','#dbb367','#55c3ae','#799ce9'];
const clean=(v,max=80)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max);
function fail(message,status=400,code='invalid_request'){const e=new Error(message);e.status=status;e.code=code;throw e;}
function validateAction(raw,cash){try{return normalizeAction(raw,cash);}catch(error){fail(error.message,400,'invalid_action');}}
function hasHash(provided,expected){const actual=hash(provided);if(typeof expected!=='string'||actual.length!==expected.length)return false;let diff=0;for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^expected.charCodeAt(i);return diff===0;}
function strict(body,allowed){if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))fail('请求含未知字段');}
function publicLedger(d){return{seat:d.seat,round:d.round,action:clone(d.action),cashBefore:d.cashBefore,previousUsers:d.previousUsers,actionCost:d.actionCost,users:d.users,retained:d.retained,newUsers:d.newActive.reduce((a,b)=>a+b,0),activeBySegment:clone(d.activeBySegment),paying:d.paying,revenue:d.revenue,operations:d.operations,net:d.net,cash:d.cash,profit:d.profit,bankrupt:d.bankrupt,score:d.score,delta:d.delta,retention:d.retention,contributions:clone(d.contributions),scoreInputs:clone(d.scoreInputs),effects:clone(d.effects),price:d.price};}
function publicWorld(game){return game.world.map(m=>Object.fromEntries(Object.entries(m).filter(([k])=>['id','round','type','text','eventId','targets','effect','endRound','concept','dueRound','claimId','verified'].includes(k))));}
function newSeat(name,seat,opts,now,isBot=false){
  const human=token(),agent=token();
  return {player:{id:randomHex(8),seat,name:clean(name,32)||`旅人${seat+1}`,color:colors[seat],avatar:defaultAvatar(seat),isBot,persona:clean(opts.persona||'理性探索者',100),risk:['low','medium','high'].includes(opts.risk)?opts.risk:'medium',authorization:opts.authorization==='autopilot'?'autopilot':'assist',humanHash:hash(human),agentHash:hash(agent),agentExpiresAt:now+24*60*60*1000,agentConnected:false,agentLastSeen:null,defaultAction:{...WAIT},intent:'',suggestion:null,decision:null,receipt:null,receipts:{}},token:human,agentToken:agent};
}
export function project(room,player=null,now=Date.now()){
  const ranking=rankings(room.game),ranks=new Map(ranking.rows.map(r=>[r.seat,r.rank]));
  const players=room.players.map(p=>{const c=room.game.companies[p.seat];return{id:p.id,seat:p.seat,name:p.name,color:p.color,avatar:publicAvatar(p),isBot:p.isBot,users:c.active.reduce((a,b)=>a+b,0),cash:c.cash,profit:c.profit,score:c.score,delta:c.delta,rank:ranks.get(p.seat),bankrupt:c.bankrupt,retention:c.retention,contributions:clone(c.contributions),scoreInputs:clone(c.inputs||{}),submitted:['decision','settling'].includes(room.phase)&&(p.isBot||!!p.decision),agentConnected:p.agentConnected&&now-(p.agentLastSeen||0)<60000};});
  const me=player?{id:player.id,seat:player.seat,avatar:publicAvatar(player),persona:player.persona,risk:player.risk,authorization:player.authorization,defaultAction:clone(player.defaultAction),action:clone(player.decision?.action||null),receipt:clone(player.receipt),privateNotes:clone(room.game.companies[player.seat].privateNotes),company:{activeBySegment:clone(room.game.companies[player.seat].active),pricing:room.game.companies[player.seat].pricing,onboarding:clone(room.game.companies[player.seat].onboard),habit:clone(room.game.companies[player.seat].habit),quality:room.game.companies[player.seat].quality,pendingContent:clone(room.game.companies[player.seat].pendingContent)},intent:player.intent,suggestion:clone(player.suggestion),agentConnected:player.agentConnected&&now-(player.agentLastSeen||0)<60000,agentExpiresAt:player.agentExpiresAt}:null;
  const state={id:room.id,mode:room.mode,phase:room.phase,round:room.game.round,totalRounds:6,deadline:room.deadline,serverTime:now,version:room.version,createdAt:room.createdAt,product:publicProduct(room.game),players,me,world:publicWorld(room.game),history:room.game.history.map(h=>({round:h.round,players:h.players.map(d=>({...publicLedger(d),id:room.players.find(p=>p.seat===d.seat)?.id})),marketTotals:clone(h.marketTotals)})),rules:clone(room.rulesSnapshot||RULES),winners:room.phase==='finished'?ranking.winners.map(s=>room.players.find(p=>p.seat===s)?.id).filter(Boolean):[],hostId:room.hostId,god:clone(room.god||{provider:'template',text:'模板主持已就位。胜负由确定性经营规则计算。'})};
  return state;
}
function collectActions(room){
  return room.players.map(p=>{
    const c=room.game.companies[p.seat];
    if(c.bankrupt)return{...WAIT};
    if(p.isBot)return scriptAction(room.game,p.seat);
    try{return normalizeAction(p.decision?.action||p.defaultAction,c.cash);}catch{return{...WAIT};}
  });
}
function openRoundPhase(room,now,timing){
  room.phase=timing.preparationMs>0?'preparing':'decision';
  room.deadline=now+(timing.preparationMs>0?timing.preparationMs:timing.decisionMs);
}
function resolveRound(room,now,timing){
  const actions=room.lockedActions||collectActions(room);
  settle(room.game,actions);
  room.lockedActions=null;
  room.players.forEach(p=>{p.decision=null;p.suggestion=null;p.intent='';});
  if(room.game.round>=6||rankings(room.game).allBankrupt){room.phase='finished';room.deadline=null;room.finishedAt=now;}
  else {beginRound(room.game);openRoundPhase(room,now,timing);}
  room.god={provider:'template',text:room.phase==='finished'?'六周经营已完成。展开账本比较规模、利润与留存，再把下一次实验写入札记。':`第${room.game.round}周开始。先区分事实与传闻；每家公司只能提交一个合法行动。`};
}
export const projectPublic=room=>project(room,null,Date.now());
function headers(extra={}){return {'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",...extra};}
function json(status,payload){return new Response(JSON.stringify(payload),{status,headers:headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'})});}
async function readJson(request,limit=16384){
 if(!request.body)return{};const reader=request.body.getReader(),parts=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();fail('请求过大',413);}parts.push(value);}}
 finally{reader.releaseLock();}
 if(!size)return{};const all=new Uint8Array(size);let offset=0;for(const p of parts){all.set(p,offset);offset+=p.length;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all));}catch{fail('JSON格式错误');}
}
function authenticate(request,room,now,{agentOnly=false,humanOnly=false}={}){
 const raw=String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!/^[a-f0-9]{64}$/.test(raw))fail('需要本人席位凭据',401,'unauthorized');
 for(const player of room.players){
  if(!agentOnly&&hasHash(raw,player.humanHash))return {player,isAgent:false};
  if(!humanOnly&&hasHash(raw,player.agentHash)){if(now>=player.agentExpiresAt)fail('Agent凭据已过期，请在网页重新生成',401,'token_expired');return {player,isAgent:true};}
 }
 fail('凭据不属于本房间',403,'forbidden');
}
function assertVersion(room){if(room.game.ruleVersion!==RULES.version)fail('本局规则版本与当前运行器不兼容，需恢复对应版本或迁移；未更改原局',409,'rule_version_mismatch');}
function sanitizeHost(s={}){return {configuredProvider:s.configuredProvider==='deepseek'?'deepseek':'template',keyConfigured:s.keyConfigured===true,enabled:s.enabled===true,model:clean(s.model||'deepseek-flash',80),calls:Math.max(0,Number(s.calls)||0),limit:Math.max(0,Number(s.limit)||0),busy:Math.max(0,Number(s.busy)||0),lastResult:s.lastResult?{provider:s.lastResult.provider==='deepseek'?'deepseek':'template',reason:s.lastResult.reason?clean(s.lastResult.reason,60):null}:null,lastSuccessAt:typeof s.lastSuccessAt==='string'?clean(s.lastSuccessAt,40):null,lastLatencyMs:Number.isFinite(s.lastLatencyMs)?Math.max(0,s.lastLatencyMs):null,reportedUsage:Object.fromEntries(['prompt_tokens','completion_tokens','total_tokens'].map(k=>[k,Math.max(0,Number(s.reportedUsage?.[k])||0)]))};}
export async function handleApi(request,env,ctx={},services={}){
 try{
  const clock=typeof services.clock==='function'?services.clock:()=>Date.now(),timing={decisionMs:45000,preparationMs:5000,settlementMs:1000,...services.timing};
  if(!Number.isFinite(timing.decisionMs)||timing.decisionMs<1||!Number.isFinite(timing.preparationMs)||timing.preparationMs<0||!Number.isFinite(timing.settlementMs)||timing.settlementMs<0)throw Error('Invalid timing');
  const url=new URL(request.url),parts=url.pathname.split('/').filter(Boolean),method=request.method;
  if(request.headers.has('origin')){let origin;try{origin=new URL(request.headers.get('origin'));}catch{fail('Origin无效',403);}if(origin.origin!==url.origin)fail('仅允许同源请求',403);}
  const avatarRoute=parts.length===4&&parts[0]==='api'&&parts[1]==='rooms'&&parts[3]==='avatar';
  const body=method==='POST'?await readJson(request,avatarRoute?MAX_AVATAR_REQUEST_BYTES:16384):null;
  function schedule(room){if(typeof services.scheduleNarration!=='function')return;try{const task=services.scheduleNarration(room,env,ctx);if(task&&typeof task.then==='function')ctx.waitUntil?.(task.catch(()=>{}));}catch{}}
  if(url.pathname==='/api/health'&&method==='GET'){
   const host=sanitizeHost(typeof services.hostStatus==='function'?await services.hostStatus(env):{});
   return json(200,{ok:true,status:env?.DB?'ready':'storage-unavailable',storage:'cloudflare-d1',online:true,multiplayer:true,provider:host.enabled?'deepseek':'template',host,ruleVersion:RULES.version});
  }
  if(['/api/config','/api/catalog'].includes(url.pathname)&&method==='GET')return json(200,{ok:true,online:true,multiplayer:true,actions:clone(ACTIONS),products:PRODUCTS.map(p=>({id:p.id,name:p.name,coreBehavior:p.core_behavior,segments:clone(p.segments)})),rules:clone(RULES)});
  if(url.pathname==='/api/rooms'&&method==='POST'){
   strict(body,['name','mode','persona','risk','authorization']);if(!clean(body.name,32))fail('请填写显示名');
   const now=clock(),mode=body.mode==='multiplayer'?'multiplayer':'practice';
   for(let attempt=0;attempt<10;attempt++){
    const seat=newSeat(body.name,0,body,now),id=randomHex(3).toUpperCase();
    const room={id,mode,hostId:seat.player.id,createdAt:now,rulesSnapshot:clone(RULES),timing:{...timing},version:1,phase:'lobby',deadline:null,game:createGame({seed:randomHex(12)}),players:[seat.player],god:{provider:'template',text:'主持正在等候开局。胜负由确定性经营规则计算。'}};
    if(mode==='practice')for(let i=1;i<4;i++)room.players.push(newSeat(['','火种 · 获客脚本','常青 · 留存脚本','罗盘 · 研究脚本'][i],i,{},now,true).player);
    if(await createRoom(env,room))return json(201,{ok:true,roomId:id,playerId:seat.player.id,token:seat.token,agentToken:seat.agentToken,state:project(room,seat.player,now)});
   }
   fail('房间创建繁忙，请重试',409,'state_conflict');
  }
  if(parts[0]!=='api'||parts[1]!=='rooms'||!parts[2])fail('接口不存在',404,'not_found');
  const id=parts[2].toUpperCase(),route=parts.slice(3).join('/');let room=await readRoom(env,id);if(!room)fail('房间不存在',404,'not_found');
  if(route==='join'&&method==='POST'){
   strict(body,['name','persona','risk','authorization']);if(!clean(body.name,32))fail('请填写显示名');let seat;
   room=await mutateRoom(env,id,r=>{assertVersion(r);if(r.mode!=='multiplayer'||r.phase!=='lobby')fail('本房间不再接受加入',409);if(r.players.length>=4)fail('四个席位已满',409);seat=newSeat(body.name,r.players.length,body,clock());r.players.push(seat.player);});
   if(!room)fail('房间不存在',404,'not_found');return json(201,{ok:true,roomId:id,playerId:seat.player.id,token:seat.token,agentToken:seat.agentToken,state:project(room,room.players.find(p=>p.id===seat.player.id),clock())});
  }
  const authOptions={agentOnly:route.startsWith('agent/')&&route!=='agent/rotate',humanOnly:['start','advance','default','intent','agent/rotate','profile','avatar'].includes(route)};
  authenticate(request,room,clock(),authOptions);
  // Every authenticated room request applies at most one due phase transition.
  // CAS retries re-read phase, credentials and clock; only the successful resolve schedules God.
  let resolved=false;
  room=await mutateRoom(env,id,r=>{
   resolved=false;authenticate(request,r,clock(),authOptions);
   if(r.game.ruleVersion!==RULES.version||!['preparing','decision','settling'].includes(r.phase)||clock()<r.deadline)return false;
   const t=r.timing||timing,now=clock();
   if(r.phase==='preparing'){r.phase='decision';r.deadline=now+t.decisionMs;return;}
   if(r.phase==='decision'&&t.settlementMs>0){r.lockedActions=collectActions(r);r.phase='settling';r.deadline=now+t.settlementMs;return;}
   resolveRound(r,now,t);resolved=true;
  });
  if(!room)fail('房间不存在',404,'not_found');if(resolved)schedule(room);
  let auth=authenticate(request,room,clock(),authOptions),playerId=auth.player.id;
  if(room.game.ruleVersion!==RULES.version&&(method!=='GET'||route==='replay'))assertVersion(room);
  async function change(fn){const next=await mutateRoom(env,id,r=>{assertVersion(r);const a=authenticate(request,r,clock(),authOptions);return fn(r,a.player,a,clock());});if(!next)fail('房间不存在',404,'not_found');room=next;auth=authenticate(request,room,clock(),authOptions);playerId=auth.player.id;return room;}
  const response=(extra={})=>json(200,{ok:true,...extra,state:project(room,room.players.find(p=>p.id===playerId),clock())});
  if(auth.isAgent&&['agent/check','agent/state','agent/inbox','agent/action'].includes(route))await change((r,p,_a,now)=>{p.agentConnected=true;p.agentLastSeen=now;});
  if(!route&&method==='GET')return response();
  if(route==='events'&&method==='GET')return response({transport:'polling',polling:true,pollAfterMs:1000});
  if(route==='start'&&method==='POST'){
   strict(body,[]);await change((r,p,_a,now)=>{if(p.id!==r.hostId)fail('仅房主可以开始',403);if(r.phase!=='lobby')fail('房间已经开始',409);if(r.players.length!==4)fail('等待四位玩家入座',409);beginRound(r.game);openRoundPhase(r,now,r.timing||timing);});schedule(room);return response();
  }
  if(route==='advance'&&method==='POST'){
   strict(body,[]);let narrated=false;await change((r,p,_a,now)=>{narrated=false;if(r.mode!=='practice'||p.id!==r.hostId)fail('只有练习房房主可以提前推进',403);if(!['preparing','decision','settling'].includes(r.phase))fail('当前没有可推进阶段',409);if(r.phase==='preparing'){r.phase='decision';r.deadline=now+(r.timing||timing).decisionMs;}else{resolveRound(r,now,r.timing||timing);narrated=true;}});if(narrated)schedule(room);return response();
  }
  if(route==='default'&&method==='POST'){strict(body,['action']);await change((r,p)=>{p.defaultAction=validateAction(body.action,r.game.companies[p.seat].cash);});return response();}
  if(route==='avatar'&&method==='POST'){
   strict(body,['avatar']);if(!Object.hasOwn(body,'avatar'))fail('请选择头像');let avatar=null;
   if(body.avatar!==null)try{avatar=await validateAvatar(body.avatar);}catch(error){fail(error.message,400,'invalid_avatar');}
   await change((_r,p)=>{p.avatar=avatar||defaultAvatar(p.seat);});return response();
  }
  if(route==='profile'&&method==='POST'){
   strict(body,['persona','risk','authorization']);await change((_r,p)=>{if(body.persona!==undefined)p.persona=clean(body.persona,100);if(body.risk!==undefined){if(!['low','medium','high'].includes(body.risk))fail('风险偏好非法');p.risk=body.risk;}if(body.authorization!==undefined){if(!['assist','autopilot'].includes(body.authorization))fail('授权模式非法');p.authorization=body.authorization;}});return response();
  }
  if(route==='intent'&&method==='POST'){
   strict(body,['text']);await change((r,p,_a,now)=>{if(r.phase!=='decision'||now>=r.deadline)fail('仅决策阶段可发送意图',409);if(typeof body.text!=='string'||!clean(body.text,1000))fail('意图不能为空');p.intent=clean(body.text,1000);});return response();
  }
  if(['action','agent/action'].includes(route)&&method==='POST'){
   strict(body,['round','action','requestId','summary']);if(typeof body.requestId!=='string'||!/^[\w.:-]{8,100}$/.test(body.requestId))fail('requestId必须为8至100位唯一标识');
   const fingerprint=hash(JSON.stringify({round:body.round,action:body.action,summary:body.summary||''}));let extra;
   await change((r,p,a,now)=>{
    const existing=p.receipts[body.requestId];if(existing){if(existing.fingerprint!==fingerprint)fail('幂等键已用于其他内容',409,'idempotency_conflict');extra={receipt:clone(existing.receipt),duplicate:true};return false;}
    if(r.phase!=='decision'||body.round!==r.game.round||now>=r.deadline)fail('回合已结束或编号过期',409,'stale_round');if(r.game.companies[p.seat].bankrupt)fail('公司已破产，不能再提交行动',409);
    const action=validateAction(body.action,r.game.companies[p.seat].cash),receipt={id:body.requestId,round:body.round,action,cost:actionCost(action),acceptedAt:now,source:a.isAgent?'agent':'human',summary:clean(body.summary||'',200),status:a.isAgent&&p.authorization==='assist'?'suggested':'accepted'};
    p.receipts[body.requestId]={fingerprint,receipt};if(receipt.status==='suggested')p.suggestion=receipt;else{p.decision={action,round:body.round};p.receipt=receipt;}extra={receipt:clone(receipt)};
   });return response(extra);
  }
  if(route==='agent/rotate'&&method==='POST'){strict(body,[]);const raw=token();await change((_r,p,_a,now)=>{p.agentHash=hash(raw);p.agentExpiresAt=now+24*60*60*1000;p.agentConnected=false;p.agentLastSeen=null;});return response({agentToken:raw});}
  if(route==='agent/check'&&method==='GET')return response({connected:true,playerId,scope:'own-seat',expiresAt:auth.player.agentExpiresAt,protocol:'growth-v1'});
  if(route==='agent/state'&&method==='GET')return response();
  if(route==='agent/inbox'&&method==='GET'){const since=Number(url.searchParams.get('since')||0);if(!Number.isSafeInteger(since)||since<0)fail('游标非法');return response({events:publicWorld(room.game).map((e,i)=>({...e,cursor:i+1})).filter(e=>e.cursor>since),cursor:room.game.world.length});}
  if(route==='replay'&&method==='GET'){if(room.phase!=='finished')fail('终局后才开放完整回放',409);const verified=replayGame(room.game).verified;return response({replay:{ruleVersion:room.game.ruleVersion,seed:room.game.seed,productId:room.game.productId,actions:room.game.history.map(h=>({round:h.round,players:h.players.map(d=>({seat:d.seat,action:clone(d.action)}))})),ledgers:room.game.history.map(h=>({round:h.round,players:h.players.map(d=>({...publicLedger(d),id:room.players.find(p=>p.seat===d.seat)?.id}))})),verified}});}
  fail('接口不存在',404,'not_found');
 }catch(error){return json(error.status||500,{ok:false,error:error.status&&error.status<500?error.message:'持久化或服务异常，请稍后重试',code:error.status?(error.code||'invalid_request'):'server_error'});}
}
