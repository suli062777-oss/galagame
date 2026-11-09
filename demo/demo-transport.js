// Classroom-only transport. Everything runs in this browser, no server/model secrets.
import {ACTIONS,PRODUCTS,RULES,WAIT,createGame,beginRound,settle,normalizeAction,actionCost,rankings,scriptAction,publicProduct,replayGame} from './demo-engine.js';
import {defaultAvatar,normalizeAvatar} from './avatar-contract.js';
const KEY='ga:classroom-demo:rooms:v1',clone=x=>structuredClone(x),colors=['#e04748','#dbb367','#55c3ae','#799ce9'];
let memory={},memoryOnly=false;
const read=()=>{if(memoryOnly)return memory;try{const value=JSON.parse(localStorage.getItem(KEY)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return memory;}};
function save(rooms){memory=rooms;try{localStorage.setItem(KEY,JSON.stringify(rooms));}catch{memoryOnly=true;if(!document.querySelector('#demo-storage-warning')){const warning=document.createElement('p');warning.id='demo-storage-warning';warning.textContent='浏览器存储已满或不可用，本局暂存在内存，关闭前请导出回放。';warning.style.cssText='position:fixed;bottom:0;left:0;right:0;background:#5d2b1b;color:white;padding:12px;z-index:300;font:14px system-ui';document.body.append(warning);}}}
const id=length=>{const b=new Uint8Array(Math.ceil(length/2));crypto.getRandomValues(b);return [...b].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,length);};
const clean=(x,n=100)=>String(x??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n);
function newPlayer(name,seat,body={},isBot=false){return{id:id(16),seat,name:clean(name,32)||'旅人',color:colors[seat],avatar:defaultAvatar(seat),isBot,persona:clean(body.persona||'analytical'),risk:body.risk||'medium',authorization:'assist',token:id(64),defaultAction:{...WAIT},intent:'',decision:null,receipt:null,receipts:{}};}
function ledger(d){return{seat:d.seat,round:d.round,action:clone(d.action),cashBefore:d.cashBefore,previousUsers:d.previousUsers,actionCost:d.actionCost,users:d.users,retained:d.retained,newUsers:d.newActive.reduce((a,b)=>a+b,0),activeBySegment:clone(d.activeBySegment),paying:d.paying,revenue:d.revenue,operations:d.operations,net:d.net,cash:d.cash,profit:d.profit,bankrupt:d.bankrupt,score:d.score,delta:d.delta,retention:d.retention,contributions:clone(d.contributions),scoreInputs:clone(d.scoreInputs),effects:clone(d.effects),price:d.price};}
function publicWorld(game){return game.world.map(m=>Object.fromEntries(Object.entries(m).filter(([k])=>['id','round','type','text','eventId','targets','effect','endRound','concept','dueRound','claimId','verified'].includes(k))));}
function project(room,player){
 const now=Date.now(),ranking=rankings(room.game),ranks=new Map(ranking.rows.map(r=>[r.seat,r.rank]));
 const players=room.players.map(p=>{const c=room.game.companies[p.seat];return{id:p.id,seat:p.seat,name:p.name,color:p.color,avatar:clone(p.avatar),isBot:p.isBot,users:c.active.reduce((a,b)=>a+b,0),cash:c.cash,profit:c.profit,score:c.score,delta:c.delta,rank:ranks.get(p.seat),bankrupt:c.bankrupt,retention:c.retention,contributions:clone(c.contributions),scoreInputs:clone(c.inputs||{}),submitted:['decision','settling'].includes(room.phase)&&(p.isBot||!!p.decision),agentConnected:false};});
 const c=room.game.companies[player.seat],me={id:player.id,seat:player.seat,avatar:clone(player.avatar),persona:player.persona,risk:player.risk,authorization:'assist',defaultAction:clone(player.defaultAction),action:clone(player.decision?.action||null),receipt:clone(player.receipt),privateNotes:clone(c.privateNotes),company:{activeBySegment:clone(c.active),pricing:c.pricing,onboarding:clone(c.onboard),habit:clone(c.habit),quality:c.quality,pendingContent:clone(c.pendingContent)},intent:player.intent,suggestion:null,agentConnected:false,agentExpiresAt:0};
 return{id:room.id,mode:'practice',demo:true,phase:room.phase,round:room.game.round,totalRounds:6,deadline:room.deadline,serverTime:now,version:room.version,createdAt:room.createdAt,product:publicProduct(room.game),players,me,world:publicWorld(room.game),history:room.game.history.map(h=>({round:h.round,players:h.players.map(d=>({...ledger(d),id:room.players.find(p=>p.seat===d.seat)?.id})),marketTotals:clone(h.marketTotals)})),rules:clone(RULES),winners:room.phase==='finished'?ranking.winners.map(seat=>room.players[seat].id):[],hostId:room.hostId,god:{provider:'template',text:room.phase==='finished'?'课堂Demo六轮已完成。请比较真实账本，再写下下一次要验证的假设。':`课堂Demo · 第${room.game.round}轮。事实与传闻分开判断；每轮一项行动，胜负由确定性经营引擎计算。`}};
}
function openRound(room,now){room.phase='preparing';room.deadline=now+5000;}
function resolve(room,now){
 const actions=room.lockedActions||room.players.map(p=>{const c=room.game.companies[p.seat];if(c.bankrupt)return {...WAIT};if(p.isBot)return scriptAction(room.game,p.seat);try{return normalizeAction(p.decision?.action||p.defaultAction,c.cash);}catch{return {...WAIT};}});
 settle(room.game,actions);room.lockedActions=null;room.players.forEach(p=>{p.decision=null;p.intent='';});
 if(room.game.round>=6||rankings(room.game).allBankrupt){room.phase='finished';room.deadline=null;}else{beginRound(room.game);openRound(room,now);}
}
function tick(room){const now=Date.now();if(!['preparing','decision','settling'].includes(room.phase)||now<room.deadline)return false;if(room.phase==='preparing'){room.phase='decision';room.deadline=now+45000;}else if(room.phase==='decision'){room.lockedActions=room.players.map(p=>p.isBot?scriptAction(room.game,p.seat):(()=>{try{return normalizeAction(p.decision?.action||p.defaultAction,room.game.companies[p.seat].cash);}catch{return {...WAIT};}})());room.phase='settling';room.deadline=now+1000;}else resolve(room,now);room.version++;return true;}
export async function demoRequest(url,{method='GET',body={},token}={}){
 const pathname=new URL(url,location.origin).pathname;
 if(pathname==='/api/health')return{ok:true,status:'classroom-demo',provider:'template',demo:true,host:{configuredProvider:'template',keyConfigured:false,enabled:false,calls:0,limit:0,lastSuccessAt:null}};
 if(['/api/config','/api/catalog'].includes(pathname))return{ok:true,actions:clone(ACTIONS),products:PRODUCTS.map(p=>({id:p.id,name:p.name,coreBehavior:p.core_behavior,segments:clone(p.segments)})),rules:clone(RULES)};
 const rooms=read();
 if(pathname==='/api/rooms'&&method==='POST'){
  if(body.mode==='multiplayer')throw Error('课堂Demo仅支持单人练习，另外三席为脚本对手。');if(!clean(body.name,32))throw Error('请填写显示名');
  const roomId=id(6).toUpperCase(),p=newPlayer(body.name,0,body),players=[p,...['火种 · 获客脚本','常青 · 留存脚本','罗盘 · 研究脚本'].map((name,i)=>newPlayer(name,i+1,{},true))],room={id:roomId,mode:'practice',hostId:p.id,createdAt:Date.now(),version:1,phase:'lobby',deadline:null,game:createGame({seed:id(24)}),players};rooms[roomId]=room;save(rooms);return{ok:true,roomId,playerId:p.id,token:p.token,agentToken:'demo-no-external-agent',state:project(room,p)};
 }
 const parts=pathname.split('/').filter(Boolean),room=rooms[parts[2]?.toUpperCase()],route=parts.slice(3).join('/');
 if(route==='join')throw Error('课堂Demo不提供线上多人房间。请新建单人练习。');
 if(!room)throw Error('本浏览器没有这张桌，请新开练习房。');
 const p=room.players.find(p=>!p.isBot&&p.token===token);if(!p)throw Error('需要当前浏览器的练习席位凭据。');
 if(tick(room))save(rooms);
 const response=extra=>({ok:true,...extra,state:project(room,p)}),commit=()=>{room.version++;save(rooms);return response();};
 if(!route&&method==='GET')return response();
 if(route.startsWith('agent/'))throw Error('课堂Demo不连接真实外部Agent；请使用手动行动。');
 if(route==='start'){if(room.phase!=='lobby')throw Error('本局已经开始');beginRound(room.game);openRound(room,Date.now());return commit();}
 if(route==='advance'){if(room.phase==='preparing'){room.phase='decision';room.deadline=Date.now()+45000;}else if(['decision','settling'].includes(room.phase))resolve(room,Date.now());else throw Error('当前没有可推进的阶段');return commit();}
 if(route==='avatar'){p.avatar=normalizeAvatar(body.avatar,{seat:p.seat});return commit();}
 if(route==='profile'){p.persona=clean(body.persona||p.persona);p.risk=['low','medium','high'].includes(body.risk)?body.risk:p.risk;return commit();}
 if(route==='intent'){if(room.phase!=='decision')throw Error('仅共同决策阶段可记录想法');p.intent=clean(body.text,1000);return commit();}
 if(route==='default'){p.defaultAction=normalizeAction(body.action,room.game.companies[p.seat].cash);return commit();}
 if(route==='action'){
  const fingerprint=JSON.stringify({round:body.round,action:body.action}),previous=p.receipts[body.requestId];if(previous){if(previous.fingerprint!==fingerprint)throw Error('请使用新的行动请求编号');return response({receipt:clone(previous.receipt),duplicate:true});}
  if(room.phase!=='decision'||room.game.round!==body.round||Date.now()>=room.deadline)throw Error('回合已经结束，请查看当前阶段');if(room.game.companies[p.seat].bankrupt)throw Error('公司已破产');
  const action=normalizeAction(body.action,room.game.companies[p.seat].cash),receipt={id:body.requestId,round:body.round,action,cost:actionCost(action),acceptedAt:Date.now(),source:'human',status:'accepted'};p.decision={action,round:body.round};p.receipt=receipt;p.receipts[body.requestId]={fingerprint,receipt};room.version++;save(rooms);return response({receipt});
 }
 if(route==='replay'){if(room.phase!=='finished')throw Error('终局后才可导出回放');const checked=replayGame(room.game);return response({replay:{ruleVersion:room.game.ruleVersion,seed:room.game.seed,productId:room.game.productId,actions:room.game.history.map(h=>({round:h.round,players:h.players.map(d=>({seat:d.seat,action:clone(d.action)}))})),ledgers:clone(room.game.history),verified:checked.verified,demo:true}});}
 throw Error('课堂Demo暂不提供此功能');
}
