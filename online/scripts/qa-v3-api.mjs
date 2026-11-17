import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server/api.js';
import * as worker from '../worker/engine.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ownedRoot=path.join(root,'data');
await fs.mkdir(ownedRoot,{recursive:true});
const dataDir=await fs.mkdtemp(path.join(ownedRoot,'v3-independent-qa-'));
const report={scope:'Four independent HTTP clients against the copied local preview backend; no browser or real human playtest claimed',startedAt:new Date().toISOString(),modelCalls:0,checks:[],rounds:[]};
let now=100000,server;
function check(name,fn){fn();report.checks.push({name,passed:true});}
try{
 server=createServer({dataDir,clock:()=>now,decisionMs:45000,preparationMs:0,settlementMs:0});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let base=`http://127.0.0.1:${server.address().port}`;
 async function call(url,body,credential){const response=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(credential?{Authorization:'Bearer '+credential}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});return {status:response.status,...await response.json()};}
 const health=await call('/api/health');
 check('Local host uses template with zero model calls',()=>{assert.equal(health.provider,'template');assert.equal(health.host.enabled,false);assert.equal(health.host.calls,0);});
 const host=await call('/api/rooms',{mode:'multiplayer',name:'QA 岸边'}),p='/api/rooms/'+host.roomId;
 const guests=await Promise.all(['QA 迟雨','QA 芦笛','QA 南枝'].map(name=>call(p+'/join',{name})));
 const clients=[host,...guests];
 check('Four independent human seats share one room',()=>{assert.equal(host.status,201);assert.ok(guests.every(g=>g.status===201));assert.equal(new Set(clients.map(c=>c.playerId)).size,4);assert.ok(guests.at(-1).state.players.every(p=>!p.isBot));});
 const avatar={kind:'preset',id:'aurora'};
 const avatarResult=await call(p+'/avatar',{avatar},clients[1].token);
 check('Own avatar change accepted',()=>assert.equal(avatarResult.status,200));
 const views=await Promise.all(clients.map(c=>call(p,undefined,c.token)));
 check('Avatar visible consistently across four projections',()=>assert.ok(views.every(v=>v.state.players.find(p=>p.id===clients[1].playerId).avatar.id==='aurora')));
 const forbidden=await call(p+'/avatar',{avatar:{kind:'preset',id:'moss'}},clients[1].agentToken);
 check('Agent cannot change a human avatar',()=>assert.equal(forbidden.status,403));
 const started=await call(p+'/start',{},host.token);
 check('Full decision window retained',()=>{assert.equal(started.state.phase,'decision');assert.equal(started.state.deadline-started.state.serverTime,45000);});
 const actions=[];
 for(let round=1;round<=6;round++){
  const chosen=clients.map((c,seat)=>({round,action:{id:seat===0&&round===1?'A10':'A02',target:1,scale:1},requestId:`v3-${round}-seat-${seat}`}));
  const receipts=await Promise.all(clients.map((c,seat)=>call(p+'/action',chosen[seat],c.token)));
  check(`Round ${round}: four accepted independent actions`,()=>assert.ok(receipts.every(r=>r.receipt?.status==='accepted')));
  const duplicate=await call(p+'/action',chosen[0],host.token);
  check(`Round ${round}: repeated submission is idempotent`,()=>assert.equal(duplicate.duplicate,true));
  const before=await call(p,undefined,host.token);
  now+=45000;server.tick();
  const after=await Promise.all(clients.map(c=>call(p,undefined,c.token)));
  check(`Round ${round}: one shared authoritative ledger`,()=>{assert.ok(after.every(r=>r.state.history.length===round));const history=JSON.stringify(after[0].state.history);assert.ok(after.every(r=>JSON.stringify(r.state.history)===history));});
  const state=after[0].state;
  report.rounds.push({round,players:state.history.at(-1).players.map(p=>({seat:p.seat,action:p.action,score:p.score,users:p.users,cash:p.cash,profit:p.profit})),sharedClients:4,acceptedActions:4});
  actions.push(chosen.map(c=>c.action));
  check(`Round ${round}: public projection retains no credentials`,()=>{const raw=JSON.stringify(state);assert.ok(!/humanHash|agentHash|rumorTruth|onboarding_response/.test(raw));assert.ok(clients.every(c=>!raw.includes(c.token)&&!raw.includes(c.agentToken)));});
  check(`Round ${round}: avatar survives settlement`,()=>assert.equal(state.players.find(p=>p.id===clients[1].playerId).avatar.id,'aurora'));
  if(round===1)check('Private research is only in owner projection',()=>{assert.equal(state.me.privateNotes.length,1);assert.equal(after[1].state.me.privateNotes.length,0);});
  if(round<6){const stale=await call(p+'/action',{...chosen[0],requestId:`stale-round-${round}`},host.token);check(`Round ${round}: stale actions rejected after transition`,()=>assert.equal(stale.status,409));}
  if(round===6){check('Game finishes after six complete rounds',()=>assert.equal(state.phase,'finished'));report.final={phase:state.phase,scores:state.players.map(p=>({seat:p.seat,score:p.score,rank:p.rank})),ruleVersion:state.rules.version};}
 }
 const replay=await call(p+'/replay',undefined,host.token);
 check('Server replay verifies',()=>assert.equal(replay.replay.verified,true));
 const expected=worker.createGame({seed:replay.replay.seed,productId:replay.replay.productId});
 for(const round of replay.replay.actions){worker.beginRound(expected);worker.settle(expected,round.players.map(p=>p.action));}
 check('Preview six-round scores match the production Worker engine',()=>assert.deepEqual(expected.companies.map(c=>c.score),report.final.scores.map(s=>s.score)));
 await new Promise(resolve=>server.close(resolve));server=null;
 server=createServer({dataDir,clock:()=>now,decisionMs:45000,preparationMs:0,settlementMs:0});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
 const restored=await call(p,undefined,host.token);
 check('Real server restart restores final scores, avatar and original credential',()=>{assert.equal(restored.state.phase,'finished');assert.equal(restored.state.history.length,6);assert.deepEqual(restored.state.players.map(p=>p.score),report.final.scores.map(s=>s.score));assert.equal(restored.state.players.find(p=>p.id===clients[1].playerId).avatar.id,'aurora');});
 const restoredReplay=await call(p+'/replay',undefined,host.token);
 check('Replay still verifies after restart',()=>assert.equal(restoredReplay.replay.verified,true));
 const ending=await call('/api/health');check('QA leaves paid call count at zero',()=>assert.equal(ending.host.calls,0));
 report.passed=true;
}catch(error){report.passed=false;report.error={name:error.name,message:error.message};process.exitCode=1;}
finally{
 if(server)await new Promise(resolve=>server.close(resolve));
 const relative=path.relative(ownedRoot,dataDir);
 if(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative))await fs.rm(dataDir,{recursive:true,force:true});
 report.completedAt=new Date().toISOString();
 const out=path.join(root,'docs/evidence/v3-independent-api.json');await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,rounds:report.rounds.length,modelCalls:0,evidence:out,error:report.error}));
}
