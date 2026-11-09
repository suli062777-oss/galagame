/** Growth-specific room API. Room projection/Bearer/SSE patterns follow MIT AgentBar.
 * Original games remain untouched. Human/agent credentials and private economic
 * state are deliberately separated; every response uses an explicit projection.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { createStore } from './persistence.js';
import {validateAvatar,publicAvatar} from './avatars.js';
import {defaultAvatar,MAX_AVATAR_REQUEST_BYTES} from '../public/avatar-contract.js';
import { createGame,beginRound,settle,normalizeAction,actionCost,rankings,scriptAction,publicProduct,replayGame,RULES,ACTIONS,PRODUCTS,WAIT,halfUp } from './engine.js';
const here=path.dirname(fileURLToPath(import.meta.url)),publicDir=path.resolve(here,'../public');
const clone=x=>structuredClone(x),hash=s=>createHash('sha256').update(String(s)).digest('hex'),token=()=>randomBytes(32).toString('hex');
const colors=['#e04748','#dbb367','#55c3ae','#799ce9'];
const clean=(v,max=80)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max);
function fail(message,status=400,code='invalid_request'){const e=new Error(message);e.status=status;e.code=code;throw e;}
function validateAction(raw,cash){try{return normalizeAction(raw,cash);}catch(error){fail(error.message,400,'invalid_action');}}
function hasHash(provided,expected){const a=Buffer.from(hash(provided)),b=Buffer.from(expected||'');return a.length===b.length&&timingSafeEqual(a,b);}
function strict(body,allowed){if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))fail('请求含未知字段');}
function publicLedger(d){return{seat:d.seat,round:d.round,action:clone(d.action),cashBefore:d.cashBefore,previousUsers:d.previousUsers,actionCost:d.actionCost,users:d.users,retained:d.retained,newUsers:d.newActive.reduce((a,b)=>a+b,0),activeBySegment:clone(d.activeBySegment),paying:d.paying,revenue:d.revenue,operations:d.operations,net:d.net,cash:d.cash,profit:d.profit,bankrupt:d.bankrupt,score:d.score,delta:d.delta,retention:d.retention,contributions:clone(d.contributions),scoreInputs:clone(d.scoreInputs),effects:clone(d.effects),price:d.price};}
function publicWorld(game){return game.world.map(m=>Object.fromEntries(Object.entries(m).filter(([k])=>['id','round','type','text','eventId','targets','effect','endRound','concept','dueRound','claimId','verified'].includes(k))));}
function newSeat(name,seat,opts,now,isBot=false){
  const human=token(),agent=token();
  return {player:{id:randomBytes(8).toString('hex'),seat,name:clean(name,32)||`旅人${seat+1}`,color:colors[seat],avatar:defaultAvatar(seat),isBot,persona:clean(opts.persona||'理性探索者',100),risk:['low','medium','high'].includes(opts.risk)?opts.risk:'medium',authorization:opts.authorization==='autopilot'?'autopilot':'assist',humanHash:hash(human),agentHash:hash(agent),agentExpiresAt:now+24*60*60*1000,agentConnected:false,agentLastSeen:null,defaultAction:{...WAIT},intent:'',suggestion:null,decision:null,receipt:null,receipts:{}},token:human,agentToken:agent};
}
function project(room,player,now){
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
async function readJson(req,maxBytes=16384){let bytes=0,parts=[];for await(const part of req){bytes+=part.length;if(bytes>maxBytes)fail('请求过大',413);parts.push(part);}if(!parts.length)return{};try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{fail('JSON格式错误');}}
function headers(extra={}){return{'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",...extra};}
function json(res,status,payload){res.writeHead(status,headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}));res.end(JSON.stringify(payload));}
export function createServer({dataDir=path.resolve(here,'../data'),clock=()=>Date.now(),decisionMs=45000,preparationMs=5000,settlementMs=1000,godNarrate=null,godStatus=null}={}) {
  if(typeof clock!=='function'||!Number.isFinite(decisionMs)||decisionMs<1||!Number.isFinite(preparationMs)||preparationMs<0||!Number.isFinite(settlementMs)||settlementMs<0)throw new Error('无效服务器配置');
  const store=createStore(dataDir);let rooms=store.readAll();const streams=new Map();
  function hostStatus(){
    let s={};try{s=typeof godStatus==='function'?godStatus():{};}catch{}
    return {configuredProvider:s.configuredProvider==='deepseek'?'deepseek':'template',keyConfigured:s.keyConfigured===true,enabled:s.enabled===true,model:clean(s.model||'deepseek-flash',80),calls:Math.max(0,Number(s.calls)||0),limit:Math.max(0,Number(s.limit)||0),busy:Math.max(0,Number(s.busy)||0),lastResult:s.lastResult?{provider:s.lastResult.provider==='deepseek'?'deepseek':'template',reason:s.lastResult.reason?clean(s.lastResult.reason,60):null}:null,lastSuccessAt:typeof s.lastSuccessAt==='string'?clean(s.lastSuccessAt,40):null,lastLatencyMs:Number.isFinite(s.lastLatencyMs)?Math.max(0,s.lastLatencyMs):null,reportedUsage:Object.fromEntries(['prompt_tokens','completion_tokens','total_tokens'].map(k=>[k,Number.isFinite(Number(s.reportedUsage?.[k]))?Math.max(0,Math.floor(Number(s.reportedUsage[k]))):0]))};
  }
  function broadcast(id){for(const s of streams.get(id)||[])try{s.res.write(`id: ${rooms[id].version}\nevent: state\ndata: ${JSON.stringify(project(rooms[id],rooms[id].players.find(p=>p.id===s.playerId),clock()))}\n\n`);}catch{s.res.end();}}
  function saveRoom(id,fn){const room=clone(rooms[id]);fn(room);room.version++;const next={...rooms,[id]:room};store.save(next);rooms=next;broadcast(id);return room;}
  function timingFor(room){return room.timing||{decisionMs,preparationMs,settlementMs};}
  function tick(id){
    let room=rooms[id];if(room&&room.game.ruleVersion!==RULES.version)return room;if(!room||!['preparing','decision','settling'].includes(room.phase)||clock()<room.deadline)return room;
    const timing=timingFor(room);
    if(room.phase==='preparing')return saveRoom(id,r=>{r.phase='decision';r.deadline=clock()+timing.decisionMs;});
    if(room.phase==='decision'&&timing.settlementMs>0)return saveRoom(id,r=>{r.lockedActions=collectActions(r);r.phase='settling';r.deadline=clock()+timing.settlementMs;});
    room=saveRoom(id,r=>resolveRound(r,clock(),timing));void narrateRoom(room);return room;
  }
  async function narrateRoom(room){
    if(!godNarrate)return;
    const expectedRound=room.game.round,expectedHistory=room.game.history.length;
    try {const result=await godNarrate(project(room,null,clock()));if(rooms[room.id]?.game.round===expectedRound&&rooms[room.id]?.game.history.length===expectedHistory&&result&&typeof result.text==='string')saveRoom(room.id,r=>{r.god={provider:result.provider==='deepseek'?'deepseek':'template',text:clean(result.text,1600),reason:result.reason?clean(result.reason,60):null,knowledgeIds:Array.isArray(result.knowledgeIds)?result.knowledgeIds.filter(id=>/^K\d{2}$/.test(id)).slice(0,2):[]};});}catch{}
  }
  function authenticate(req,room,{agentOnly=false,humanOnly=false}={}){
    const raw=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');if(!/^[a-f0-9]{64}$/.test(raw))fail('需要本人席位凭据',401,'unauthorized');
    for(const p of room.players){
      if(!agentOnly&&hasHash(raw,p.humanHash))return{player:p,isAgent:false};
      if(!humanOnly&&hasHash(raw,p.agentHash)){
        if(clock()>=p.agentExpiresAt)fail('Agent凭据已过期，请在网页重新生成',401,'token_expired');return{player:p,isAgent:true};
      }
    }fail('凭据不属于本房间',403,'forbidden');
  }
  const server=http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost'),parts=url.pathname.split('/').filter(Boolean),method=req.method;
      if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin);}catch{fail('Origin无效',403);}if(origin.host!==req.headers.host)fail('仅允许同源请求',403);}
      // Parse before selecting mutable room state. No await is allowed between room
      // selection/authentication/validation and synchronous atomic mutation.
      const avatarRoute=parts.length===4&&parts[0]==='api'&&parts[1]==='rooms'&&parts[3]==='avatar';
      const requestBody=method==='POST'?await readJson(req,avatarRoute?MAX_AVATAR_REQUEST_BYTES:16384):null;
      if(url.pathname==='/api/health'&&method==='GET'){const host=hostStatus();return json(res,200,{ok:true,status:'ready',storage:'atomic-local-json',provider:host.enabled?'deepseek':'template',host,ruleVersion:RULES.version});}
      if(['/api/config','/api/catalog'].includes(url.pathname)&&method==='GET')return json(res,200,{ok:true,actions:clone(ACTIONS),products:PRODUCTS.map(p=>({id:p.id,name:p.name,coreBehavior:p.core_behavior,segments:clone(p.segments)})),rules:clone(RULES)});
      if(url.pathname==='/api/rooms'&&method==='POST'){
        const body=requestBody;strict(body,['name','mode','persona','risk','authorization']);if(!clean(body.name,32))fail('请填写显示名');
        const now=clock(),mode=body.mode==='multiplayer'?'multiplayer':'practice';let id;do{id=randomBytes(4).toString('hex').slice(0,6).toUpperCase();}while(rooms[id]);
        const seat=newSeat(body.name,0,body,now),room={id,mode,hostId:seat.player.id,createdAt:now,rulesSnapshot:clone(RULES),timing:{decisionMs,preparationMs,settlementMs},version:1,phase:'lobby',deadline:null,game:createGame({seed:randomBytes(12).toString('hex')}),players:[seat.player],god:{provider:'template',text:'模板主持 · 当前未调用外部模型。准备好后开始六周经营。'}};
        if(mode==='practice')for(let i=1;i<4;i++)room.players.push(newSeat(['','火种 · 获客脚本','常青 · 留存脚本','罗盘 · 研究脚本'][i],i,{},now,true).player);
        const next={...rooms,[id]:room};store.save(next);rooms=next;
        return json(res,201,{ok:true,roomId:id,playerId:seat.player.id,token:seat.token,agentToken:seat.agentToken,state:project(room,seat.player,now)});
      }
      if(parts[0]==='api'&&parts[1]==='rooms'&&parts[2]){
        const id=parts[2].toUpperCase();let room=tick(id);if(!room)fail('房间不存在',404,'not_found');
        const route=parts.slice(3).join('/');
        if(room.game.ruleVersion!==RULES.version&&(method!=='GET'||route==='replay'))fail('本局规则版本与当前运行器不兼容，需恢复对应版本或迁移；未更改原局',409,'rule_version_mismatch');
        if(route==='join'&&method==='POST'){
          const body=requestBody;strict(body,['name','persona','risk','authorization']);if(!clean(body.name,32))fail('请填写显示名');
          if(room.mode!=='multiplayer'||room.phase!=='lobby')fail('本房间不再接受加入',409);if(room.players.length>=4)fail('四个席位已满',409);
          const seat=newSeat(body.name,room.players.length,body,clock());room=saveRoom(id,r=>r.players.push(seat.player));return json(res,201,{ok:true,roomId:id,playerId:seat.player.id,token:seat.token,agentToken:seat.agentToken,state:project(room,seat.player,clock())});
        }
        const isAgentRoute=route.startsWith('agent/')&&!['agent/rotate'].includes(route),auth=authenticate(req,room,{agentOnly:isAgentRoute,humanOnly:['start','advance','default','intent','agent/rotate','profile','avatar'].includes(route)}),playerId=auth.player.id;
        if(auth.isAgent&&['agent/check','agent/state','agent/inbox','agent/action'].includes(route)){
          // Presence does not affect economics and is persisted so refresh can show it.
          room=saveRoom(id,r=>{const p=r.players.find(p=>p.id===playerId);p.agentConnected=true;p.agentLastSeen=clock();});
        }
        let player=room.players.find(p=>p.id===playerId);
        const response=(extra={})=>json(res,200,{ok:true,...extra,state:project(room,room.players.find(p=>p.id===playerId),clock())});
        if(!route&&method==='GET')return response();
        if(route==='events'&&method==='GET'){
          res.writeHead(200,headers({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','Connection':'keep-alive'}));
          const entry={res,playerId};if(!streams.has(id))streams.set(id,new Set());streams.get(id).add(entry);res.write(`event: state\ndata: ${JSON.stringify(project(room,player,clock()))}\n\n`);req.on('close',()=>streams.get(id)?.delete(entry));return;
        }
        if(route==='start'&&method==='POST'){
          const body=requestBody;strict(body,[]);if(player.id!==room.hostId)fail('仅房主可以开始',403);if(room.phase!=='lobby')fail('房间已经开始',409);if(room.players.length!==4)fail('等待四位玩家入座',409);
          room=saveRoom(id,r=>{beginRound(r.game);openRoundPhase(r,clock(),timingFor(r));});void narrateRoom(room);return response();
        }
        if(route==='advance'&&method==='POST'){
          const body=requestBody;strict(body,[]);if(room.mode!=='practice'||player.id!==room.hostId)fail('只有练习房房主可以提前推进',403);if(!['preparing','decision','settling'].includes(room.phase))fail('当前没有可推进阶段',409);
          if(room.phase==='preparing')room=saveRoom(id,r=>{r.phase='decision';r.deadline=clock()+timingFor(r).decisionMs;});
          else {room=saveRoom(id,r=>resolveRound(r,clock(),timingFor(r)));void narrateRoom(room);}return response();
        }
        if(route==='default'&&method==='POST'){
          const body=requestBody;strict(body,['action']);const action=validateAction(body.action,room.game.companies[player.seat].cash);
          room=saveRoom(id,r=>r.players.find(p=>p.id===playerId).defaultAction=action);return response();
        }
        if(route==='avatar'&&method==='POST'){
          const body=requestBody;strict(body,['avatar']);if(!Object.hasOwn(body,'avatar'))fail('请选择头像');
          let avatar;try{avatar=validateAvatar(body.avatar,{seat:player.seat});}catch(error){fail(error.message,400,'invalid_avatar');}
          room=saveRoom(id,r=>{r.players.find(p=>p.id===playerId).avatar=avatar;});return response();
        }
        if(route==='profile'&&method==='POST'){
          const body=requestBody;strict(body,['persona','risk','authorization']);room=saveRoom(id,r=>{const p=r.players.find(p=>p.id===playerId);if(body.persona!==undefined)p.persona=clean(body.persona,100);if(body.risk!==undefined){if(!['low','medium','high'].includes(body.risk))fail('风险偏好非法');p.risk=body.risk;}if(body.authorization!==undefined){if(!['assist','autopilot'].includes(body.authorization))fail('授权模式非法');p.authorization=body.authorization;}});return response();
        }
        if(route==='intent'&&method==='POST'){
          const body=requestBody;strict(body,['text']);if(room.phase!=='decision')fail('仅决策阶段可发送意图',409);if(typeof body.text!=='string'||!clean(body.text,1000))fail('意图不能为空');room=saveRoom(id,r=>r.players.find(p=>p.id===playerId).intent=clean(body.text,1000));return response();
        }
        if(['action','agent/action'].includes(route)&&method==='POST'){
          const body=requestBody;strict(body,['round','action','requestId','summary']);
          if(typeof body.requestId!=='string'||!/^[\w.:-]{8,100}$/.test(body.requestId))fail('requestId必须为8至100位唯一标识');
          const existing=player.receipts[body.requestId],fingerprint=hash(JSON.stringify({round:body.round,action:body.action,summary:body.summary||''}));
          if(existing){if(existing.fingerprint!==fingerprint)fail('幂等键已用于其他内容',409,'idempotency_conflict');return response({receipt:clone(existing.receipt),duplicate:true});}
          if(room.phase!=='decision'||body.round!==room.game.round||clock()>=room.deadline)fail('回合已结束或编号过期',409,'stale_round');
          if(room.game.companies[player.seat].bankrupt)fail('公司已破产，不能再提交行动',409);
          const action=validateAction(body.action,room.game.companies[player.seat].cash),source=auth.isAgent?'agent':'human',receipt={id:body.requestId,round:body.round,action,cost:actionCost(action),acceptedAt:clock(),source,summary:clean(body.summary||'',200),status:auth.isAgent&&player.authorization==='assist'?'suggested':'accepted'};
          room=saveRoom(id,r=>{const p=r.players.find(p=>p.id===playerId);p.receipts[body.requestId]={fingerprint,receipt};if(receipt.status==='suggested')p.suggestion=receipt;else{p.decision={action,round:body.round};p.receipt=receipt;}});return response({receipt});
        }
        if(route==='agent/rotate'&&method==='POST'){
          const body=requestBody;strict(body,[]);const raw=token();room=saveRoom(id,r=>{const p=r.players.find(p=>p.id===playerId);p.agentHash=hash(raw);p.agentExpiresAt=clock()+24*60*60*1000;p.agentConnected=false;p.agentLastSeen=null;});return response({agentToken:raw});
        }
        if(route==='agent/check'&&method==='GET')return response({connected:true,playerId,scope:'own-seat',expiresAt:player.agentExpiresAt,protocol:'growth-v1'});
        if(route==='agent/state'&&method==='GET')return response();
        if(route==='agent/inbox'&&method==='GET'){
          const since=Number(url.searchParams.get('since')||0);if(!Number.isSafeInteger(since)||since<0)fail('游标非法');return response({events:publicWorld(room.game).map((e,i)=>({...e,cursor:i+1})).filter(e=>e.cursor>since),cursor:room.game.world.length});
        }
        if(route==='replay'&&method==='GET'){
          if(room.phase!=='finished')fail('终局后才开放完整回放',409);const verify=replayGame(room.game);
          return response({replay:{ruleVersion:room.game.ruleVersion,seed:room.game.seed,productId:room.game.productId,actions:room.game.history.map(h=>({round:h.round,players:h.players.map(d=>({seat:d.seat,action:clone(d.action)}))})),ledgers:room.game.history.map(h=>({round:h.round,players:h.players.map(d=>({...publicLedger(d),id:room.players.find(p=>p.seat===d.seat)?.id}))})),verified:verify.verified}});
        }
        fail('接口不存在',404,'not_found');
      }
      if(url.pathname.startsWith('/api/'))fail('接口不存在',404,'not_found');
      if(!['GET','HEAD'].includes(method))fail('方法不允许',405);
      let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{fail('路径编码错误');}
      if(pathname.includes('\0')||pathname.split('/').includes('..'))fail('路径非法',403);
      const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=path.resolve(publicDir,relative);
      if(!file.startsWith(publicDir+path.sep))fail('路径非法',403);
      const ext=path.extname(file),types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2','.json':'application/json'};
      if(!fs.existsSync(file)||!fs.statSync(file).isFile())fail('页面不存在',404,'not_found');
      res.writeHead(200,headers({'Content-Type':types[ext]||'application/octet-stream','Cache-Control':['.html','.js','.css'].includes(ext)?'no-store':'public, max-age=3600'}));if(method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
    }catch(error){if(!res.headersSent)json(res,error.status||500,{ok:false,error:error.status&&error.status<500?error.message:'持久化或服务异常，请稍后重试',code:error.status?(error.code||'invalid_request'):'server_error'});else res.end();}
  });
  const timer=setInterval(()=>{for(const id of Object.keys(rooms))try{tick(id);}catch(error){console.error('Room settlement failed:',error.message);}},250);timer.unref();
  server.on('close',()=>{clearInterval(timer);for(const set of streams.values())for(const s of set)s.res.end();});
  server.tick=()=>{for(const id of Object.keys(rooms))tick(id);};
  server.dataFile=store.file;
  return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||3001),host=process.env.HOST||'127.0.0.1';
  let godNarrate=null,godStatus=null;
  try{const mod=await import('./god.js');godNarrate=mod.narrate||null;godStatus=mod.getGodStatus||null;}catch{}
  const server=createServer({dataDir:process.env.DATA_DIR||path.resolve(here,'../data'),godNarrate,godStatus});
  server.listen(port,host,()=>console.log(`Growth Atlas http://${host}:${port} · ${godStatus?.().enabled?'DeepSeek enabled':'template host; paid calls disabled'} · local atomic storage`));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
}
