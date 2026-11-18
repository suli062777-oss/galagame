/** Local, independent HTTP protocol/performance verification. No env/key reads.
 * Real server/router/persistence/economics; injected real template narration.
 * Controlled service time replaces 6 x 45s waiting, never HTTP measurement time.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from '../server/api.js';
import {templateNarration} from '../worker/god-contract.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),ownedRoot=path.join(root,'data');
const POLL_MS=250,requestRows=[],actionSamples=[],secrets=new Set(),clients=[],pollTasks=[];
const rawFetch=globalThis.fetch,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const started=performance.now();let now=Date.UTC(2026,10,17,12),server,dataDir,base,stopping=false,narrations=0,blockedExternalRequests=0;
const report={startedAt:new Date().toISOString(),scope:'Loopback Node HTTP, atomic-local-json storage, two rooms and eight independent seat identities; not production D1/public Internet, eight humans, external Agent applications, or classroom capacity evidence.',environment:{node:process.version,platform:process.platform,transport:'native Node fetch -> 127.0.0.1 ephemeral HTTP server',storage:'atomic-local-json'},timing:{controlledServiceClock:true,decisionMs:45000,preparationMs:5000,settlementMs:1000,pollIntervalMs:POLL_MS,httpTiming:'Monotonic wall time from fetch dispatch through full response-body receipt/JSON parsing. No sleeps or service-clock advances are included.',bodyBytes:'Decoded HTTP response body bytes; excludes headers/TCP/TLS framing.'},modelCalls:0,checks:[],tables:[],clockAdvances:[],limits:['Loopback figures do not establish real cloud/Wi-Fi latency or classroom capacity.','No UI, draft editing, browser, physical mobile device or external LLM Agent was tested.','The 250ms polling cadence is an explicitly accelerated local protocol check, not the deployed browser cadence.','Expected 400/401/403/409 security/timing rejections are reported separately from unexpected failures.']};
function safe(message){let text=String(message||'').replace(/Bearer\s+\S+/gi,'Bearer [redacted]').replace(/sk-[A-Za-z0-9_-]+/g,'[redacted]');for(const secret of secrets)text=text.split(secret).join('[redacted]');return text.slice(0,500);}
function check(condition,name,details){report.checks.push({name,passed:Boolean(condition),...(details===undefined?{}:{details})});if(!condition)throw Error(name);}
async function waitFor(predicate,label,timeout=10000){const end=performance.now()+timeout;while(true){if(predicate())return;if(performance.now()>end)throw Error('Timed out: '+label);await sleep(10);}}
function advanceClock(ms,label){now+=ms;report.clockAdvances.push({label,advanceMs:ms,serverTime:now});}
const roundNumber=value=>Math.round(value*1000)/1000;
const safeRoute=route=>route.replace(/\/api\/rooms\/[^/?]+/,'/api/rooms/[room]');
async function http(route,{body,credential,etag,expected=[200],category='protocol',label='system'}={}){
 const method=body===undefined?'GET':'POST',start=performance.now(),row={method,route:safeRoute(route),category,label,expectedStatuses:expected};
 try{
  const response=await fetch(base+route,{method,redirect:'error',signal:AbortSignal.timeout(10000),headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(credential?{Authorization:'Bearer '+credential}:{}),...(etag?{'If-None-Match':etag}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const bytes=Buffer.from(await response.arrayBuffer()),data=bytes.length?JSON.parse(bytes.toString('utf8')):null;
  Object.assign(row,{status:response.status,bodyBytes:bytes.length,durationMs:roundNumber(performance.now()-start),expected:expected.includes(response.status)});requestRows.push(row);
  if(!row.expected)throw Error(`Unexpected HTTP ${response.status}: ${method} ${safeRoute(route)}`);
  return {status:response.status,data,etag:response.headers.get('etag'),serverTime:Number(response.headers.get('x-server-time')),row,startedAt:start,completedAt:performance.now()};
 }catch(error){if(row.status===undefined){Object.assign(row,{status:0,bodyBytes:0,durationMs:roundNumber(performance.now()-start),expected:false,error:'network-or-body-error'});requestRows.push(row);}throw error;}
}
function remember(data,role,table){secrets.add(data.token);secrets.add(data.agentToken);const client={table,role,id:data.playerId,seat:data.state.me.seat,token:data.token,agentToken:data.agentToken,lastState:null,etag:null,inFlight:0,maxInFlight:0,pollCount:0,seenActions:new Map()};clients.push(client);return client;}
function route(table,suffix=''){return '/api/rooms/'+table.id+suffix;}
async function makeTable(label){
 const created=(await http('/api/rooms',{body:{name:label+'-manual-1',mode:'multiplayer',authorization:'assist'},expected:[201],label})).data;
 const table={label,id:created.roomId,clients:[],summary:{label,rounds:[],roles:['manual-1','manual-2','assist-protocol','autopilot-protocol']}};report.tables.push(table.summary);
 table.clients.push(remember(created,'manual-1',table));
 for(const [role,authorization] of [['manual-2','assist'],['assist-protocol','assist'],['autopilot-protocol','autopilot']]){const result=(await http(route(table,'/join'),{body:{name:label+'-'+role,authorization},expected:[201],label})).data;table.clients.push(remember(result,role,table));}
 check(new Set(table.clients.map(client=>client.id)).size===4&&new Set(table.clients.map(client=>client.token)).size===4,label+': four independent seat identities');
 for(const client of table.clients.slice(2)){const result=(await http(route(table,'/agent/check'),{credential:client.agentToken,label:label+'/'+client.role})).data;check(result.connected===true&&result.state.me.id===client.id,label+': own Agent protocol self-check '+client.role);}
 return table;
}
async function poll(client){
 const cycle=performance.now();client.inFlight++;client.maxInFlight=Math.max(client.maxInFlight,client.inFlight);
 try{
  const response=await http(route(client.table),{credential:client.token,etag:client.etag,expected:[200,304],category:'poll',label:client.table.label+'/'+client.role});client.pollCount++;
  if(response.status===304){check(response.row.bodyBytes===0&&response.etag===client.etag&&Number.isFinite(response.serverTime),'304 is empty, tagged and carries server time');}
  else{
   const state=response.data.state;
   if(state.id!==client.table.id||state.me.id!==client.id)throw Error('Poll escaped its own room/seat');
   if(client.lastState&&state.version<client.lastState.version)throw Error('Serial poll regressed state version');
   client.lastState=state;client.etag=response.etag;
   if(state.me.receipt?.status==='accepted'&&!client.seenActions.has(state.me.receipt.id))client.seenActions.set(state.me.receipt.id,response.completedAt);
  }
 }finally{client.inFlight--;}
 if(!stopping)await sleep(Math.max(0,POLL_MS-(performance.now()-cycle)));
}
async function pollLoop(client){while(!stopping)await poll(client);}
async function expectNegative(table,client,suffix,expectedStatus,body,credential=client?.token){return http(route(table,suffix),{body,credential,expected:[expectedStatus],category:'expected-rejection',label:table.label+'/'+(client?.role||'anonymous')});}
async function postAction(client,round,action,agent=false,requestId=randomUUID()){
 const startedAt=performance.now(),response=await http(route(client.table,agent?'/agent/action':'/action'),{body:{round,action,requestId,summary:'Local deterministic protocol QA; no external LLM.'},credential:agent?client.agentToken:client.token,category:'action',label:client.table.label+'/'+client.role});
 const receipt=response.data.receipt;
 check(receipt?.status===(agent&&client.role==='assist-protocol'?'suggested':'accepted'),client.table.label+': action receipt '+client.role+' round '+round);
 actionSamples.push({table:client.table.label,role:client.role,round,status:receipt.status,source:receipt.source,httpAcceptedMs:response.row.durationMs,start:startedAt,acknowledgedAt:response.completedAt,client,requestId});
 return response;
}
function canonicalLedger(state){return JSON.stringify(state.history);}
function stats(values){const sorted=[...values].sort((a,b)=>a-b),percentile=p=>sorted.length?roundNumber(sorted[Math.max(0,Math.ceil(sorted.length*p)-1)]):null;return {samples:sorted.length,p50Ms:percentile(.5),p95Ms:percentile(.95),maxMs:sorted.length?roundNumber(sorted.at(-1)):null};}
function summarizeRequests(){
 const byStatus={},byCategory={};for(const row of requestRows){const status=String(row.status);(byStatus[status]??=[]).push(row);(byCategory[row.category]??=[]).push(row);}
 return {total:requestRows.length,expectedResponses:requestRows.filter(row=>row.expected).length,unexpectedResponses:requestRows.filter(row=>!row.expected).length,expectedRejections:requestRows.filter(row=>row.category==='expected-rejection').length,networkOrBodyFailures:requestRows.filter(row=>row.status===0).length,all:stats(requestRows.map(row=>row.durationMs)),byStatus:Object.fromEntries(Object.entries(byStatus).map(([status,rows])=>[status,{...stats(rows.map(row=>row.durationMs)),bodyBytes:rows.reduce((sum,row)=>sum+row.bodyBytes,0),meanBodyBytes:Math.round(rows.reduce((sum,row)=>sum+row.bodyBytes,0)/rows.length)}])),byCategory:Object.fromEntries(Object.entries(byCategory).map(([category,rows])=>[category,stats(rows.map(row=>row.durationMs))]))};
}

try{
 await fs.mkdir(ownedRoot,{recursive:true});dataDir=await fs.mkdtemp(path.join(ownedRoot,'v6-multiplayer-qa-'));
 server=createServer({dataDir,clock:()=>now,decisionMs:45000,preparationMs:5000,settlementMs:1000,godNarrate:async state=>{narrations++;return templateNarration(state,'local-protocol-qa');},godStatus:()=>({configuredProvider:'template',enabled:false,keyConfigured:false,calls:0,limit:12})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
 globalThis.fetch=(input,options)=>{if(new URL(typeof input==='string'?input:input.url).origin!==base){blockedExternalRequests++;throw Error('NON_LOOPBACK_NETWORK_BLOCKED');}return rawFetch(input,options);};
 const health=(await http('/api/health')).data;check(health.provider==='template'&&health.host.calls===0&&health.host.enabled===false,'Injected host is honestly template, no provider credentials or calls');
 const results=await Promise.allSettled(['A','B'].map(makeTable));if(results.some(result=>result.status==='rejected'))throw Error('Could not create both test tables');const tables=results.map(result=>result.value);
 for(const [index,table] of tables.entries()){
  const other=tables[1-index];await expectNegative(table,other.clients[0],'',403);await expectNegative(table,other.clients[2],'/agent/state',403,undefined,other.clients[2].agentToken);await expectNegative(table,null,'',401);
  await expectNegative(table,table.clients[0],'/agent/check',403);await expectNegative(table,table.clients[2],'/start',403,{},table.clients[2].agentToken);
  check(true,table.label+': cross-room, unauthenticated, human-as-Agent and Agent-as-host rejected');
 }
 const initial=await http(route(tables[0]),{credential:tables[0].clients[0].token});
 const wrongSeatTag=await http(route(tables[0]),{credential:tables[0].clients[1].token,etag:initial.etag});check(wrongSeatTag.status===200,'An own-seat ETag cannot serve another seat a304');
 for(const client of clients)pollTasks.push(pollLoop(client).catch(error=>{client.pollError=safe(error.message);stopping=true;}));
 await waitFor(()=>clients.every(client=>client.lastState)&&requestRows.filter(row=>row.status===304).length>=8,'all independent pollers have live cached snapshots');
 advanceClock(500,'lobby-clock-only');
 const unchanged=await http(route(tables[0]),{credential:tables[0].clients[0].token,etag:initial.etag,expected:[304]});check(unchanged.serverTime===now,'Unchanged304 carries current service time without JSON snapshot');
 await Promise.all(tables.map(table=>http(route(table,'/start'),{body:{},credential:table.clients[0].token,label:table.label})));
 for(let round=1;round<=6;round++){
  advanceClock(5000,'round-'+round+'-preparation');
  await waitFor(()=>clients.every(client=>client.lastState?.round===round&&client.lastState.phase==='decision'),'all clients enter decision '+round);
  check(clients.every(client=>client.lastState.deadline-client.lastState.serverTime===45000),'Round '+round+': complete45-second service window');
  if(round===3)for(const table of tables){const client=table.clients[2],oldToken=client.agentToken,rotated=(await http(route(table,'/agent/rotate'),{body:{},credential:client.token,label:table.label+'/assist-protocol'})).data;client.agentToken=rotated.agentToken;secrets.add(client.agentToken);await expectNegative(table,client,'/agent/check',403,undefined,oldToken);const checkResult=(await http(route(table,'/agent/check'),{credential:client.agentToken})).data;check(checkResult.connected===true,table.label+': rotated Agent credential works and old one fails');}
  const submitted=await Promise.allSettled(tables.map(async table=>{
   const [manual1,manual2,assist,autopilot]=table.clients;
   const manual=await Promise.all([postAction(manual1,round,{id:'A02',target:1,scale:1}),postAction(manual2,round,{id:'A12',target:0,scale:1})]);
   const id=manual[0].data.receipt.id,duplicate=await postAction(manual1,round,{id:'A02',target:1,scale:1},false,id);check(duplicate.data.duplicate===true,table.label+': idempotent retry round '+round);
   const agentRead=await http(route(table,'/agent/state'),{credential:assist.agentToken});check(agentRead.data.state.me.id===assist.id,table.label+': Agent reads own state round '+round);
   const suggestion=await postAction(assist,round,{id:'A10',target:1,scale:1},true);check(suggestion.data.state.me.action===null,table.label+': assist proposal does not secretly accept round '+round);
   await postAction(assist,round,{id:'A10',target:1,scale:1});await http(route(table,'/agent/state'),{credential:autopilot.agentToken});await postAction(autopilot,round,{id:'A03',target:1,scale:1},true);
   await expectNegative(table,manual1,'/action',409,{round:round-1,action:{id:'A12',target:0,scale:1},requestId:randomUUID()});
  }));
  if(submitted.some(result=>result.status==='rejected'))throw Error('Mixed action submission failed in round '+round);
  await waitFor(()=>clients.every(client=>client.lastState.round===round&&client.lastState.players.every(player=>player.submitted)),'all eight independent polls observe accepted actions '+round);
  advanceClock(45000,'round-'+round+'-deadline');
  for(const table of tables)await expectNegative(table,table.clients[0],'/action',409,{round,action:{id:'A12',target:0,scale:1},requestId:randomUUID()});
  await waitFor(()=>clients.every(client=>client.lastState.phase==='settling'),'all polls see locked settlement '+round);
  check(clients.every(client=>client.lastState.history.length===round-1),'Round '+round+': deadline locks before single settlement');
  advanceClock(1000,'round-'+round+'-settle');
  await waitFor(()=>clients.every(client=>client.lastState.history.length===round),'all clients see settled ledger '+round);
  for(const table of tables){const history=canonicalLedger(table.clients[0].lastState);check(table.clients.every(client=>canonicalLedger(client.lastState)===history),table.label+': four authoritative ledgers agree round '+round);const latest=table.clients[0].lastState.history.at(-1);table.summary.rounds.push({round,ledgerSha256:createHash('sha256').update(JSON.stringify(latest)).digest('hex'),sharedClients:4,rows:latest.players.map(row=>({seat:row.seat,action:row.action,cash:row.cash,users:row.users,profit:row.profit,score:row.score}))});}
  console.log(JSON.stringify({event:'round-verified',round,tables:2,clients:8,modelCalls:0}));
 }
 await waitFor(()=>clients.every(client=>client.lastState.phase==='finished'&&client.lastState.godHistory?.length>=7),'six rounds and actual new template host history');
 for(const table of tables){const replay=(await http(route(table,'/replay'),{credential:table.clients[0].token})).data;check(replay.replay.verified===true,table.label+': real six-round replay verifies');check(table.clients.every(client=>client.lastState.god.provider==='template'),table.label+': host remains honestly template');table.summary.passed=true;}
 check(clients.every(client=>client.maxInFlight===1&&!client.pollError),'Eight independent pollers never overlap their own requests or regress versions');
 stopping=true;await Promise.allSettled(pollTasks);
 advanceClock(24*60*60*1000+1,'Agent-expiration-only-after-six-rounds');
 for(const table of tables){const expired=await expectNegative(table,table.clients[3],'/agent/check',401,undefined,table.clients[3].agentToken);check(expired.data.code==='token_expired',table.label+': expired Agent authority rejected');const human=await http(route(table),{credential:table.clients[3].token});check(human.data.state.phase==='finished',table.label+': own human credential still restores finished room');}
 const finalHealth=(await http('/api/health')).data;check(finalHealth.host.calls===0&&blockedExternalRequests===0,'No model or non-loopback request occurred');
 check(requestRows.some(row=>row.status===304)&&requestRows.filter(row=>row.status===304).every(row=>row.bodyBytes===0),'Conditional polls actually return empty304 bodies');
 report.passed=true;
}catch(error){report.passed=false;report.error=safe(error.message);process.exitCode=1;}
finally{
 stopping=true;await Promise.allSettled(pollTasks);globalThis.fetch=rawFetch;if(server)await new Promise(resolve=>server.close(resolve));
 if(dataDir){const resolved=path.resolve(dataDir),relative=path.relative(ownedRoot,resolved);if(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&path.basename(resolved).startsWith('v6-multiplayer-qa-')){await fs.rm(resolved,{recursive:true,force:true});report.temporaryDataRemoved=true;}else throw Error('Refusing cleanup outside the verified QA workspace');}
 report.completedAt=new Date().toISOString();report.elapsedWallMs=roundNumber(performance.now()-started);report.templateNarrations=narrations;report.blockedExternalRequests=blockedExternalRequests;report.requests=summarizeRequests();
 const accepted=actionSamples.filter(sample=>sample.status==='accepted'),unique=accepted.filter((sample,index)=>accepted.findIndex(other=>other.requestId===sample.requestId&&other.client===sample.client)===index);
 report.actionAccepted={httpRoundTrip:stats(unique.map(sample=>sample.httpAcceptedMs)),visibilityFromSubmitStart:stats(unique.filter(sample=>sample.client.seenActions.has(sample.requestId)).map(sample=>sample.client.seenActions.get(sample.requestId)-sample.start)),visibilityAfterHttpAck:stats(unique.filter(sample=>sample.client.seenActions.has(sample.requestId)).map(sample=>Math.max(0,sample.client.seenActions.get(sample.requestId)-sample.acknowledgedAt))),acceptedUniqueRequests:unique.length};
 report.pollers=clients.map(client=>({table:client.table.label,role:client.role,polls:client.pollCount,maxOwnInFlight:client.maxInFlight,finalRound:client.lastState?.round,historyLength:client.lastState?.history.length,error:client.pollError||null}));report.requestSamples=requestRows;
 let text=JSON.stringify(report,null,2);for(const secret of secrets)text=text.split(secret).join('[redacted]');
 await fs.mkdir(path.join(root,'docs/evidence'),{recursive:true});await fs.writeFile(path.join(root,'docs/evidence/multiplayer-local-v6.json'),text+'\n');
 const r=report.requests,a=report.actionAccepted,http=a.httpRoundTrip;
 const explanation=`# V6 本地两桌协议与性能核对\n\n结果：${report.passed?'通过':'失败'}；${report.checks.filter(check=>check.passed).length}/${report.checks.length}项。两桌、八独立HTTP席位、手动/建议确认/自主协议、完整六轮。\n\n真实HTTP请求${r.total}次；意外失败${r.unexpectedResponses}次；预期鉴权/截止拒绝${r.expectedRejections}次。唯一已接收行动${a.acceptedUniqueRequests}次，HTTP往返p50=${http.p50Ms}ms、p95=${http.p95Ms}ms、max=${http.maxMs}ms；该计时只包单个真实请求与响应体，不包含sleep或推进服务时钟。\n\n实际条件GET：200响应${r.byStatus['200']?.samples||0}个、正文${r.byStatus['200']?.bodyBytes||0}字节；304响应${r.byStatus['304']?.samples||0}个、正文${r.byStatus['304']?.bodyBytes||0}字节。字节为解码后的正文，不是线缆流量。各poller串行，同一时刻最多一个自己的请求。\n\n服务使用独立临时目录、真实Node HTTP路由/原子JSON持久化/经济引擎和新模板主持；服务时钟按5秒准备、45秒决策、1秒结算受控推进。没有advance后门，没有读供应商密钥或调用模型。八个协议身份不等于八真人，也没有外部LLM Agent。\n\n这是当前进程/机器的loopback测量，不能替代公网D1、校园Wi-Fi、浏览器、实体手机或课堂容量压测。草稿属于UI，本脚本没有假装通过API测试草稿。请求逐条样本、分组分位数、跨房权限、Token轮换/过期、幂等/旧轮/截止拒绝、共享账本及回放见同名JSON。\n`;
 await fs.writeFile(path.join(root,'docs/evidence/multiplayer-local-v6.md'),explanation);
 console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,requests:r.total,httpAcceptedP95Ms:http.p95Ms,modelCalls:0,evidence:'docs/evidence/multiplayer-local-v6.json',error:report.error||null}));
}
