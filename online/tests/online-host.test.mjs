import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {makeTestDb} from './d1-adapter.mjs';
import {createRoom,readRoom,mutateRoom} from '../worker/storage.js';
import {createGame,beginRound} from '../worker/engine.js';
import {processNarration,scheduleNarration,hostStatus} from '../worker/host.js';

// This suite never contacts D1 production, DeepSeek or any other network service.
const realFetch=globalThis.fetch;
let unexpectedNetwork=0;
before(()=>{globalThis.fetch=async()=>{unexpectedNetwork++;throw Error('NETWORK_DISABLED_IN_HOST_TESTS');};});
after(()=>{globalThis.fetch=realFetch;assert.equal(unexpectedNetwork,0,'a test attempted unmocked network access');});
const envFor=(DB,scope)=>({DB,GOD_PROVIDER:'deepseek',GOD_ALLOW_PAID_CALLS:'true',DEEPSEEK_API_KEY:'TEST_ONLY_NOT_A_REAL_KEY',GOD_MAX_CALLS:'12',GOD_BUDGET_ID:scope});
function roomFixture(id){
 const game=createGame({seed:'online-host-'+id});beginRound(game);
 return {id,version:1,mode:'practice',phase:'decision',createdAt:0,deadline:60000,game,hostId:id+'-0',players:Array.from({length:4},(_,seat)=>({id:id+'-'+seat,seat,name:'Test seat '+seat,isBot:seat>0,color:['red','gold','green','blue'][seat],avatar:{kind:'preset',id:['ember','tide','moss','orbit'][seat]}})),god:{provider:'template',text:'Original template'}};
}
async function fixture(t,scope){const DB=makeTestDb();t.after(()=>DB.close());return {DB,env:envFor(DB,scope)};}
async function addRoom(env,id){return createRoom(env,roomFixture(id));}
function successfulResponse(init){
 const outgoing=JSON.parse(init.body),input=JSON.parse(outgoing.messages.find(m=>m.role==='user').content);
 const content=JSON.stringify({kind:'fact',claimIds:['C0'],knowledgeIds:[input.knowledge[0].id],tone:'calm'});
 return {ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',message:{content}}],usage:{prompt_tokens:40,completion_tokens:10,total_tokens:50}})};
}
function mockProvider(){
 const requests=[];
 return {requests,fetchImpl:async(url,init)=>{requests.push({url,init});return successfulResponse(init);}};
}
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
async function freshHost(label){return import(new URL('../worker/host.js?test-isolate='+label,import.meta.url));}

test('default provider retains the Worker global fetch receiver',async t=>{
 const {env}=await fixture(t,'worker-fetch-receiver'),room=await addRoom(env,'RECEIVER');
 const previous=globalThis.fetch;
 globalThis.fetch=async function(url,init){assert.equal(this,globalThis);return successfulResponse(init);};
 try{assert.equal((await processNarration(room,env)).provider,'deepseek');}
 finally{globalThis.fetch=previous;}
});

test('Worker-compatible manual redirects never follow or forward credentials',async t=>{
 const {env}=await fixture(t,'redirects'),room=await addRoom(env,'REDIRECT');let requests=0;
 const result=await processNarration(room,env,{fetchImpl:async(url,init)=>{
  requests++;assert.equal(init.redirect,'manual');
  return new Response(null,{status:302,headers:{Location:'https://other.invalid/steal'}});
 }});
 assert.equal(requests,1);assert.equal(result.reason,'unexpected-redirect');
 assert.equal((await hostStatus(env)).calls,1);
});

test('D1 adapter preserves bind reuse, RETURNING and atomic batch rollback',async t=>{
 const DB=makeTestDb({schemaPath:null});t.after(()=>DB.close());
 await DB.prepare('CREATE TABLE sample (id INTEGER PRIMARY KEY, value TEXT UNIQUE)').run();
 const insert=DB.prepare('INSERT INTO sample(id,value) VALUES (?1,?2) RETURNING id,value');
 assert.deepEqual(await insert.bind(1,'one').first(),{id:1,value:'one'});
 assert.deepEqual(await insert.bind(2,'two').first(),{id:2,value:'two'});
 assert.equal(await DB.prepare('SELECT value FROM sample WHERE id=?').bind(99).first(),null);
 const batch=await DB.batch([DB.prepare('UPDATE sample SET value=? WHERE id=? RETURNING id').bind('changed',1),DB.prepare('SELECT value FROM sample WHERE id=?').bind(1)]);
 assert.equal(batch[0].meta.changes,1);assert.deepEqual(batch[1].results,[{value:'changed'}]);
 await assert.rejects(DB.batch([insert.bind(3,'three'),insert.bind(4,'changed')]));
 assert.equal(await DB.prepare('SELECT count(*) AS n FROM sample').first('n'),2);
});

test('real SQL CAS retains overlapping mutations and rejects duplicate room creation',async t=>{
 const {env}=await fixture(t,'cas');
 await createRoom(env,{id:'CAS',counter:0,log:[]});
 assert.equal(await createRoom(env,{id:'CAS',counter:999}),null);
 await Promise.all(['a','b','c','d'].map(id=>mutateRoom(env,'CAS',r=>{r.counter++;r.log.push(id);})));
 const room=await readRoom(env,'CAS');
 assert.equal(room.counter,4);assert.equal(room.version,5);assert.deepEqual([...room.log].sort(),['a','b','c','d']);
 await assert.rejects(mutateRoom(env,'CAS',async r=>{r.counter=999;}),/synchronous/);
 assert.equal((await readRoom(env,'CAS')).counter,4);
});

test('CAS gives a retryable conflict after ten real competing SQL revisions',async t=>{
 const {DB,env}=await fixture(t,'cas-conflicts');await createRoom(env,{id:'CONFLICT',counter:0});
 let conflicts=0;
 const contested={...env,DB:{
   prepare(sql){
     const statement=DB.prepare(sql);
     if(!/^UPDATE rooms SET revision/.test(sql))return statement;
     return {
       bind(...args){
         const bound=statement.bind(...args);
         return {
           async run(){
             conflicts++;
             await DB.prepare("UPDATE rooms SET revision=revision+1,data=json_set(data,'$.version',revision+1) WHERE id=?").bind('CONFLICT').run();
             return bound.run();
           }
         };
       }
     };
   }
 }};
 await assert.rejects(mutateRoom(contested,'CONFLICT',r=>{r.counter++;}),error=>error.status===409&&error.code==='state_conflict');
 assert.equal(conflicts,10);assert.equal((await readRoom(env,'CONFLICT')).counter,0);
});

test('independent hosts share twelve durable attempts and deduplicate one economic key',async t=>{
 const {env}=await fixture(t,'shared-twelve'),provider=mockProvider();
 const hosts=await Promise.all(['a','b','c'].map(freshHost)),room=await addRoom(env,'SHARED');
 const same=await Promise.all(Array.from({length:9},(_,i)=>hosts[i%3].processNarration(room,{...env},{fetchImpl:provider.fetchImpl})));
 assert.equal(provider.requests.length,1);assert.equal(same.filter(r=>r.provider==='deepseek').length,1);
 await mutateRoom(env,room.id,r=>{r.players[0].avatar={kind:'preset',id:'aurora'};});
 assert.equal((await processNarration(await readRoom(env,room.id),env,{fetchImpl:provider.fetchImpl})).skipped,true);
 for(let i=1;i<12;i++){
   const result=await hosts[i%3].processNarration(await addRoom(env,'SERIAL-'+i),{...env},{fetchImpl:provider.fetchImpl});
   assert.equal(result.provider,'deepseek');
 }
 assert.equal(provider.requests.length,12);
 const restarted=await freshHost('after-restart');
 const denied=await restarted.processNarration(await addRoom(env,'THIRTEENTH'),{...env},{fetchImpl:provider.fetchImpl});
 assert.equal(denied.reason,'call-limit');assert.equal(provider.requests.length,12);
 const status=await restarted.hostStatus({...env});
 assert.equal(status.calls,12);assert.equal(status.remaining,0);assert.equal(status.busy,0);
 assert.equal(status.budgetPersistence,'shared-d1');assert.deepEqual(status.reportedUsage,{prompt_tokens:480,completion_tokens:120,total_tokens:600});
 assert.equal((await restarted.hostStatus({...env,GOD_MAX_CALLS:'99'})).limit,12);
});

test('concurrent rooms across independent hosts cannot reserve a thirteenth attempt',async t=>{
 const {DB,env}=await fixture(t,'concurrent-cap');
 await DB.prepare('INSERT INTO host_budget(scope,calls) VALUES (?,11)').bind(env.GOD_BUDGET_ID).run();
 const hosts=await Promise.all(['pressure-a','pressure-b','pressure-c'].map(freshHost));
 const rooms=await Promise.all(Array.from({length:24},(_,i)=>addRoom(env,'PRESSURE-'+i)));
 const started=deferred(),release=deferred();let calls=0;
 const fetchImpl=async(_url,init)=>{calls++;started.resolve();await release.promise;return successfulResponse(init);};
 const pending=Promise.all(rooms.map((r,i)=>hosts[i%3].processNarration(r,{...env},{fetchImpl})));
 await started.promise;release.resolve();const results=await pending;
 assert.equal(calls,1);assert.equal((await hostStatus(env)).calls,12);
 assert.equal(results.filter(r=>r.provider==='deepseek').length,1);
 assert.ok(results.every(r=>r.provider==='deepseek'||['call-limit','concurrency-limit'].includes(r.reason)));
});

test('retryable failures consume attempts; authentication does not retry; last slot cannot retry',async t=>{
 for(const [status,expectedAttempts] of [[429,2],[503,2],[401,1]]){
   await t.test('HTTP '+status,async st=>{
     const {env}=await fixture(st,'retry-'+status);let calls=0;
     const result=await processNarration(await addRoom(env,'RETRY-'+status),env,{fetchImpl:async(_url,init)=>{calls++;return calls===1?{ok:false,status}:successfulResponse(init);}});
     assert.equal(calls,expectedAttempts);assert.equal((await hostStatus(env)).calls,expectedAttempts);
     assert.equal(result.provider,status===401?'template':'deepseek');
   });
 }
 await t.test('budget has only one remaining attempt',async st=>{
   const {DB,env}=await fixture(st,'retry-last-slot');let calls=0;
   await DB.prepare('INSERT INTO host_budget(scope,calls) VALUES (?,11)').bind(env.GOD_BUDGET_ID).run();
   const result=await processNarration(await addRoom(env,'LAST-SLOT'),env,{fetchImpl:async()=>{calls++;return {ok:false,status:429};}});
   assert.equal(result.reason,'call-limit');assert.equal(calls,1);assert.equal((await hostStatus(env)).calls,12);
 });
});

test('an old round response cannot overwrite a newer room or its narration',async t=>{
 const {env}=await fixture(t,'stale-round'),room=await addRoom(env,'STALE'),started=deferred(),release=deferred();
 const pending=processNarration(room,env,{fetchImpl:async(_url,init)=>{started.resolve();await release.promise;return successfulResponse(init);}});
 await started.promise;
 await mutateRoom(env,room.id,r=>{r.game.round++;r.god={provider:'template',text:'NEW_ROUND_NARRATION'};});
 release.resolve();await pending;
 const current=await readRoom(env,room.id);
 assert.equal(current.game.round,2);assert.equal(current.god.text,'NEW_ROUND_NARRATION');
 assert.notEqual(current.hostedEconomicKey,'1:0');assert.equal((await hostStatus(env)).calls,1);
});

test('model request excludes credentials, private research, future state, pending actions and avatar bytes',async t=>{
 const {env}=await fixture(t,'whitelist'),room=roomFixture('SECRETS'),provider=mockProvider();
 const markers=['HUMAN_HASH_PRIVATE','AGENT_HASH_PRIVATE','INTENT_PRIVATE','ACTION_PRIVATE','RESEARCH_PRIVATE','FUTURE_PRIVATE','SEED_PRIVATE','OLD_HOST_PRIVATE'];
 room.players[0].humanHash=markers[0];room.players[0].agentHash=markers[1];room.players[0].intent=markers[2];
 room.players[0].decision={action:{id:'A01',target:0,scale:1},summary:markers[3]};
 room.game.companies[0].privateNotes=[markers[4]];room.game.futureEvents=[markers[5]];room.game.seed=markers[6];room.god.text=markers[7];
 const avatarBytes='UFJJVkFURV9BVkFUQVI=';room.players[0].avatar={kind:'image',dataUrl:'data:image/png;base64,'+avatarBytes};
 await createRoom(env,room);const result=await processNarration(room,env,{fetchImpl:provider.fetchImpl});
 assert.equal(result.provider,'deepseek');assert.equal(provider.requests.length,1);
 const outgoing=provider.requests[0].init,body=outgoing.body;
 assert.equal(outgoing.headers.Authorization,'Bearer '+env.DEEPSEEK_API_KEY);
 for(const marker of [...markers,avatarBytes,env.DEEPSEEK_API_KEY])assert.ok(!body.includes(marker),'private sentinel entered model body');
 assert.ok(!body.includes('data:image'));assert.ok(!body.includes('avatar'));
 const input=JSON.parse(JSON.parse(body).messages.find(m=>m.role==='user').content);
 assert.equal(input.version,'god-contract-2');assert.ok(input.claims.some(c=>c.id==='C0'));assert.ok(input.knowledge.some(k=>k.id==='K02'));
});

test('zero budget makes no provider request and scheduleNarration registers its returned promise',async t=>{
 const {env}=await fixture(t,'zero-budget'),provider=mockProvider();
 const zero={...env,GOD_MAX_CALLS:'0'};
 const result=await processNarration(await addRoom(zero,'ZERO'),zero,{fetchImpl:provider.fetchImpl});
 assert.equal(result.reason,'call-limit');assert.equal(provider.requests.length,0);assert.equal((await hostStatus(zero)).calls,0);
 const disabled={...env,GOD_PROVIDER:'template'},tasks=[];
 const task=scheduleNarration(await addRoom(disabled,'SCHEDULE'),disabled,{waitUntil:p=>tasks.push(p)});
 assert.ok(task instanceof Promise);assert.equal(tasks.length,1);assert.equal(tasks[0],task);
 assert.equal((await task).reason,'calls-disabled');assert.equal((await readRoom(disabled,'SCHEDULE')).god.provider,'template');
});
