/** Explicit post-deployment smoke test. Do not run until deployment succeeded.
 * Usage: node scripts/qa-classroom-online.mjs https://PUBLIC-SITE-HOST
 * Creates two new four-seat rooms; never resets budgets, changes rules, calls a
 * provider directly, or uses the practice-only advance route. Credentials stay
 * in memory. This is eight HTTP identities, not eight humans or external LLMs.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'docs/evidence/classroom-online-2tables.json');
const POLL_MS=1500,REQUEST_TIMEOUT_MS=15000,RUN_TIMEOUT_MS=120000;
const credentials=new Set();
const evidence={startedAt:new Date().toISOString(),status:'running',scope:'Actual deployed HTTPS Worker/D1 protocol smoke: two rooms, four independent human credentials each, one production-timed round. Protocol Agent clients are deterministic test code, not external LLM Agents or eight real people.',limits:['Not six-round verification.','Not classroom capacity, load, latency-SLA or physical-device validation.','No external Agent application or LLM is exercised.','Existing global model budget and secrets must remain unchanged.'],modelRequestsDirectlyMade:0,advanceRequestsMade:0,pollIntervalMs:POLL_MS,checks:[],tables:[]};
let base,stopAt;
const redact=value=>{let result=String(value??'').replace(/Bearer\s+\S+/gi,'Bearer [redacted]').replace(/\b[a-f0-9]{64}\b/gi,'[redacted]').replace(/sk-[A-Za-z0-9_-]+/g,'[redacted]');for(const credential of credentials)result=result.split(credential).join('[redacted]');return result.slice(0,400);};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function progress(event,details={}){console.log(JSON.stringify({task:'classroom-online-smoke',event,...details}));}
function check(condition,name,details){evidence.checks.push({name,passed:Boolean(condition),...(details===undefined?{}:{details})});if(!condition)throw new Error(name);}
function timeLeft(){if(Date.now()>=stopAt)throw new Error('Smoke test exceeded its bounded runtime');}
async function request(route,{method='GET',body,credential,expected=200}={}){
 timeLeft();
 if(/\/advance(?:[/?]|$)/.test(route))throw new Error('Advance requests are prohibited in this production-timing smoke test');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
 let response,data;
 try{response=await fetch(new URL(route,base),{method,redirect:'error',signal:controller.signal,headers:{Accept:'application/json',...(body!==undefined?{'Content-Type':'application/json'}:{}),...(credential?{Authorization:'Bearer '+credential}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});data=await response.json();}
 catch{throw new Error((response?'Response body/JSON/timeout failure HTTP '+response.status:'Network/timeout failure')+' on '+method+' '+route);}
 finally{clearTimeout(timer);}
 if(response.status!==expected)throw new Error('Unexpected HTTP '+response.status+' on '+method+' '+route+'; expected '+expected);
 if(expected<400&&data.ok===false)throw new Error('API rejected '+method+' '+route);
 return data;
}
function safeHealth(data){return {status:data.status,storage:data.storage,online:data.online,ruleVersion:data.ruleVersion,host:{calls:data.host?.calls,limit:data.host?.limit,enabled:data.host?.enabled,configuredProvider:data.host?.configuredProvider}};}
async function verifyExhaustedBudget(label){
 const health=await request('/api/health');
 check(health.status==='ready'&&health.storage==='cloudflare-d1'&&health.online===true,label+': deployed shared D1 is ready');
 check(health.host?.limit===12&&health.host?.calls===12,label+': original shared cap is exhausted at exactly 12/12',safeHealth(health));
 return safeHealth(health);
}
function ownClient(data,role,authorization){
 if(typeof data.token!=='string'||typeof data.agentToken!=='string'||!data.state?.me)throw new Error('Room did not return an independent own-seat credential');
 credentials.add(data.token);credentials.add(data.agentToken);
 return {role,authorization,token:data.token,agentToken:data.agentToken,id:data.state.me.id,seat:data.state.me.seat};
}
const roomPath=table=>'/api/rooms/'+encodeURIComponent(table.id);
function wantedAction(id,catalog){const definition=catalog.find(action=>action.id===id);if(!definition||(definition.scales&&!definition.scales.includes(1)))throw new Error('Expected standard action is unavailable: '+id);return {id,target:definition.scope==='all'?0:1,scale:1};}
function sameAction(left,right){return left?.id===right.id&&Number(left?.target)===right.target&&Number(left?.scale)===right.scale;}
function safeReceipt(receipt){return {status:receipt.status,source:receipt.source,round:receipt.round,action:{id:receipt.action.id,target:receipt.action.target,scale:receipt.action.scale},cost:receipt.cost};}

async function createTable(label){
 const created=await request('/api/rooms',{method:'POST',body:{name:'课堂烟测-'+label+'-手动1',mode:'multiplayer',authorization:'assist'},expected:201});
 const table={id:created.roomId,label,clients:[ownClient(created,'manual-1','assist')],summary:{label,roomId:created.roomId,roles:['manual-1','manual-2','assist-protocol-agent','autopilot-protocol-agent'],receipts:[],polls:0,maxPollStartGapMs:0}};
 evidence.tables.push(table.summary);
 for(const [role,authorization] of [['manual-2','assist'],['assist-protocol-agent','assist'],['autopilot-protocol-agent','autopilot']]){
  const joined=await request(roomPath(table)+'/join',{method:'POST',body:{name:'课堂烟测-'+label+'-'+role,authorization},expected:201});table.clients.push(ownClient(joined,role,authorization));
 }
 check(new Set(table.clients.map(client=>client.id)).size===4&&new Set(table.clients.map(client=>client.token)).size===4&&new Set(table.clients.map(client=>client.seat)).size===4,label+': four independent human-seat credentials');
 const views=await Promise.all(table.clients.map(client=>request(roomPath(table),{credential:client.token})));
 check(views.every((view,index)=>view.state.me.id===table.clients[index].id&&view.state.players.length===4&&view.state.players.every(player=>!player.isBot)&&view.state.phase==='lobby'),label+': all four clients share a real multiplayer lobby');
 for(const client of table.clients.slice(2)){
  const result=await request(roomPath(table)+'/agent/check',{credential:client.agentToken});
  check(result.connected===true&&result.scope==='own-seat'&&result.state.me.id===client.id&&result.state.me.authorization===client.authorization,label+': '+client.role+' completes real own-seat protocol self-check');
 }
 progress('table-created',{table:label,roomId:table.id,seats:4});return table;
}

async function isolateTables(tables){
 const outcomes=await Promise.allSettled(tables.map(async(table,index)=>{
  const other=tables[1-index];
  await request(roomPath(table),{credential:other.clients[0].token,expected:403});
  await request(roomPath(table)+'/agent/state',{credential:other.clients[2].agentToken,expected:403});
  await request(roomPath(table),{expected:401});
  check(true,table.label+': other-room human/Agent credentials and unauthenticated access are rejected');
 }));
 if(outcomes.some(result=>result.status==='rejected'))throw new Error('Cross-room authority check failed');
}

async function pollUntil(table,initial,predicate,label){
 let state=initial,lastPollStart=null,lastProgress=null;
 while(!predicate(state)){
  timeLeft();const started=Date.now();
  if(lastPollStart!==null)table.summary.maxPollStartGapMs=Math.max(table.summary.maxPollStartGapMs,started-lastPollStart);
  lastPollStart=started;
  const result=await request(roomPath(table),{credential:table.clients[0].token});state=result.state;table.summary.polls++;
  if(!state||state.id!==table.id)throw new Error(table.label+': poll returned another room');
  const remaining=Math.max(0,Math.ceil((state.deadline-state.serverTime)/1000)),key=state.phase+':'+state.round+':'+Math.ceil(remaining/10);
  if(key!==lastProgress){progress('waiting',{table:table.label,phase:state.phase,round:state.round,remainingSeconds:remaining,for:label});lastProgress=key;}
  if(!predicate(state))await sleep(Math.max(0,POLL_MS-(Date.now()-started)));
 }
 return state;
}

async function runOneRound(table,catalog){
 const p=roomPath(table),[manual1,manual2,assist,autopilot]=table.clients;
 let state=(await request(p+'/start',{method:'POST',body:{},credential:manual1.token})).state;
 check(state.round===1&&['preparing','decision'].includes(state.phase)&&state.history.length===0,table.label+': host starts an untouched first production round');
 state=await pollUntil(table,state,s=>s?.round===1&&s.phase==='decision','production decision window');
 const windowMs=state.deadline-state.serverTime;
 check(windowMs>=43000&&windowMs<=45000,table.label+': observed production decision window is approximately 45 seconds',{observedRemainingMs:windowMs,serverTime:state.serverTime,deadline:state.deadline});
 table.summary.decision={observedRemainingMs:windowMs,serverTime:state.serverTime,deadline:state.deadline};
 const actions=new Map([[manual1.id,wantedAction('A02',catalog)],[manual2.id,wantedAction('A12',catalog)],[assist.id,wantedAction('A10',catalog)],[autopilot.id,wantedAction('A03',catalog)]]);
 const submit=(client,agent,action)=>request(p+(agent?'/agent/action':'/action'),{method:'POST',credential:agent?client.agentToken:client.token,body:{round:1,action,requestId:randomUUID(),summary:'课堂协议烟测：固定测试动作；没有调用外部模型。'}});
 await Promise.all([manual1,manual2].map(async client=>{
  const result=await submit(client,false,actions.get(client.id));
  check(result.receipt?.status==='accepted'&&result.receipt.source==='human'&&sameAction(result.receipt.action,actions.get(client.id)),table.label+': '+client.role+' action is accepted by the server');
  table.summary.receipts.push({role:client.role,...safeReceipt(result.receipt)});
 }));
 const assistState=await request(p+'/agent/state',{credential:assist.agentToken});
 check(assistState.state.me.authorization==='assist'&&assistState.state.me.action===null,table.label+': assist Agent reads its own undecided seat');
 const suggestion=await submit(assist,true,actions.get(assist.id));
 check(suggestion.receipt?.status==='suggested'&&suggestion.receipt.source==='agent'&&suggestion.state.me.action===null,table.label+': assist protocol submission remains a suggestion');
 table.summary.receipts.push({role:assist.role,step:'suggestion',...safeReceipt(suggestion.receipt)});
 const confirmation=await submit(assist,false,actions.get(assist.id));
 check(confirmation.receipt?.status==='accepted'&&confirmation.receipt.source==='human'&&sameAction(confirmation.receipt.action,actions.get(assist.id)),table.label+': owner confirms the assist suggestion');
 table.summary.receipts.push({role:assist.role,step:'owner-confirmation',...safeReceipt(confirmation.receipt)});
 const autoState=await request(p+'/agent/state',{credential:autopilot.agentToken});
 check(autoState.state.me.authorization==='autopilot',table.label+': autonomous Agent reads its own authorized seat');
 const autoAction=await submit(autopilot,true,actions.get(autopilot.id));
 check(autoAction.receipt?.status==='accepted'&&autoAction.receipt.source==='agent'&&sameAction(autoAction.receipt.action,actions.get(autopilot.id)),table.label+': autonomous protocol action is accepted directly');
 table.summary.receipts.push({role:autopilot.role,...safeReceipt(autoAction.receipt)});
 state=(await request(p,{credential:manual1.token})).state;
 check(state.round===1&&state.history.length===0&&state.players.every(player=>player.submitted),table.label+': four actions are held before the deadline, not settled early');
 progress('four-actions-accepted',{table:table.label,round:1});
 state=await pollUntil(table,state,s=>s?.history?.length>=1,'first authoritative settlement');
 check(state.history.length===1&&state.history[0].round===1&&state.serverTime>=table.summary.decision.deadline,table.label+': exactly one round settles after its real deadline');
 const views=await Promise.all(table.clients.map(client=>request(p,{credential:client.token})));
 const canonical=JSON.stringify(views[0].state.history[0]);
 check(views.every((view,index)=>view.state.me.id===table.clients[index].id&&view.state.history.length===1&&JSON.stringify(view.state.history[0])===canonical),table.label+': all four independent clients read the identical authoritative ledger');
 const ledger=views[0].state.history[0];
 check(ledger.players.length===4&&table.clients.every(client=>sameAction(ledger.players.find(row=>row.seat===client.seat)?.action,actions.get(client.id))),table.label+': settled actions match both manual seats, confirmed assist, and autonomous Agent');
 check(views.every(view=>view.state.god?.provider==='template'),table.label+': exhausted-budget narration remains honestly identified as template');
 table.summary.ledger={round:1,sha256:createHash('sha256').update(canonical).digest('hex'),players:ledger.players.map(row=>({seat:row.seat,role:table.clients.find(client=>client.seat===row.seat)?.role,action:row.action,cash:row.cash,users:row.users,profit:row.profit,score:row.score}))};
 table.summary.finishedPhase=views[0].state.phase;table.summary.finishedRound=views[0].state.round;table.summary.passed=true;
 progress('table-passed',{table:table.label,settledRounds:1,clientsWithMatchingLedger:4});
}

async function main(){
 const argument=process.argv[2];if(!argument)throw new Error('Usage: node scripts/qa-classroom-online.mjs https://PUBLIC-SITE-HOST');
 const url=new URL(argument);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('Supply only an HTTPS site origin, without credentials, path, query or fragment');
 base=url.origin+'/';evidence.origin=url.origin;stopAt=Date.now()+RUN_TIMEOUT_MS;
 progress('budget-preflight');evidence.initialHealth=await verifyExhaustedBudget('Initial preflight');
 // Nothing that creates a room or schedules narration runs before this gate.
 const config=await request('/api/config');check(Array.isArray(config.actions),'Deployed action catalog is available');
 const created=await Promise.allSettled(['A','B'].map(createTable));
 evidence.preparationFailures=created.flatMap((result,index)=>result.status==='rejected'?[{table:['A','B'][index],message:redact(result.reason?.message||'Preparation failed')}]:[]);
 if(created.some(result=>result.status==='rejected'))throw new Error('One or more smoke-test rooms could not be prepared');
 const tables=created.map(result=>result.value);
 await isolateTables(tables);evidence.beforeStartHealth=await verifyExhaustedBudget('Immediately before starting rooms');
 const results=await Promise.allSettled(tables.map(table=>runOneRound(table,config.actions)));
 for(let index=0;index<results.length;index++)if(results[index].status==='rejected'){tables[index].summary.passed=false;tables[index].summary.error=redact(results[index].reason?.message||'Table smoke failed');}
 evidence.finalHealth=await verifyExhaustedBudget('Final health');
 check(evidence.finalHealth.host.calls===evidence.initialHealth.host.calls,'Shared model usage remains exactly 12 after both tables');
 if(results.some(result=>result.status==='rejected'))throw new Error('One or more table smoke checks failed; inspect safe per-table evidence');
 evidence.status='passed';progress('passed',{tables:2,seats:8,settledRoundsPerTable:1,modelCallsBefore:12,modelCallsAfter:12});
}

try{await main();}
catch(error){evidence.status='failed';evidence.error=redact(error?.message||'Smoke test failed');process.exitCode=1;progress('failed',{message:evidence.error});}
finally{
 evidence.finishedAt=new Date().toISOString();
 // Defence in depth: even accidental future evidence fields cannot persist a
 // captured own-seat credential. No request headers or raw responses are saved.
 let serialized=JSON.stringify(evidence,null,2);for(const credential of credentials)serialized=serialized.split(credential).join('[redacted]');
 await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,serialized+'\n','utf8');
 progress('evidence-written',{path:'docs/evidence/classroom-online-2tables.json',status:evidence.status});
}
