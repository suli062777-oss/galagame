import test from 'node:test';
import assert from 'node:assert/strict';
import {makeTestDb} from './d1-adapter.mjs';
import {createGame,beginRound} from '../worker/engine.js';
import {createRoom,readRoom} from '../worker/storage.js';
import {processNarration,hostStatus} from '../worker/host.js';
import {handleApi} from '../worker/api.js';
import {publicHostMessage} from '../worker/host-messages.js';

function setup(t,scope){const DB=makeTestDb();t.after(()=>DB.close());return {DB,GOD_PROVIDER:'deepseek',GOD_ALLOW_PAID_CALLS:'true',DEEPSEEK_API_KEY:'TEST_ONLY_NOT_A_REAL_KEY',GOD_BUDGET_ID:scope,GOD_MAX_CALLS:'unlimited'};}
function room(id){const game=createGame({seed:id});beginRound(game);return {id,version:1,mode:'practice',phase:'decision',deadline:60000,game,hostId:id+'-0',players:Array.from({length:4},(_,seat)=>({id:id+'-'+seat,seat,name:'Fixture '+seat,isBot:seat>0,color:'#e04748',avatar:{kind:'preset',id:'ember'}})),god:{provider:'template',text:'Initial template'}};}
function realShapeReply(init){
 const input=JSON.parse(JSON.parse(init.body).messages.at(-1).content),card=input.knowledge[0],claim=input.claims[0];
 const value={kind:claim.type==='rumor'?'rumor':'fact',claimIds:[claim.id],knowledgeIds:[card.id],tone:'calm',narration:(claim.type==='rumor'?'这里有一条未核实传闻，仍需等待核验':claim.text.split('。')[0])+`[${claim.id}]。`+card.text.split('。')[0]+`[${card.id}]。`};
 return {ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}],usage:{prompt_tokens:5,completion_tokens:4,total_tokens:9}})};
}

test('explicit unlimited mode preserves the prior twelve attempts and permits further counted requests',async t=>{
 const env=setup(t,'owner-approved-unlimited');await env.DB.prepare('INSERT INTO host_budget(scope,calls) VALUES (?,12)').bind(env.GOD_BUDGET_ID).run();let requests=0;
 for(let i=0;i<3;i++){const r=room('UNLIMITED-'+i);await createRoom(env,r);const value=await processNarration(r,env,{fetchImpl:async(_url,init)=>{requests++;return realShapeReply(init)}});assert.equal(value.provider,'deepseek');}
 const status=await hostStatus(env);assert.equal(requests,3);assert.equal(status.calls,15);assert.equal(status.limit,null);assert.equal(status.remaining,null);assert.equal(status.unlimited,true);assert.equal(status.budgetPersistence,'shared-d1');
});
test('actual job pending, completion, public citations and history survive a fresh database read',async t=>{
 const env=setup(t,'message-persistence'),r=room('MESSAGE');await createRoom(env,r);let release,started;const gate=new Promise(resolve=>{release=resolve}),ready=new Promise(resolve=>{started=resolve});
 const pending=processNarration(r,env,{fetchImpl:async(_url,init)=>{started();await gate;return realShapeReply(init)}});await ready;
 const generating=await readRoom(env,r.id);assert.equal(generating.god.status,'generating');assert.equal((generating.godHistory||[]).length,0);
 release();await pending;const persisted=await readRoom(env,r.id);assert.equal(persisted.god.status,'ready');assert.equal(persisted.god.provider,'deepseek');assert.ok(persisted.god.knowledgeRefs.length);assert.equal(persisted.godHistory.length,1);assert.equal(persisted.godHistory[0].id,persisted.god.id);
 assert.equal((await processNarration(persisted,env,{fetchImpl:()=>{throw Error('Duplicate provider request')}})).skipped,true);assert.equal((await readRoom(env,r.id)).godHistory.length,1);
 assert.equal(publicHostMessage({knowledgeIds:['K-E15'],text:'Public message'}).knowledgeRefs.length,0);
});
test('private ETags avoid duplicate room reads, change on deadlines and never bypass own-seat authorization',async t=>{
 const env=setup(t,'etag');let now=100000,roomReads=0;const original=env.DB.prepare.bind(env.DB);env.DB.prepare=sql=>{if(/^SELECT id, revision, data FROM rooms/.test(sql))roomReads++;return original(sql)};
 async function call(route,{body,token,etag}={}){const response=await handleApi(new Request('https://local.test'+route,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(etag?{'If-None-Match':etag}:{})},...(body?{body:JSON.stringify(body)}:{})}),env,{}, {clock:()=>now});return {response,data:response.status===304?null:await response.json()};}
 const created=(await call('/api/rooms',{body:{name:'ETag owner',mode:'practice'}})).data,path='/api/rooms/'+created.roomId;
 roomReads=0;const first=await call(path,{token:created.token});assert.equal(roomReads,1);const tag=first.response.headers.get('etag');assert.ok(tag);assert.ok(!tag.includes(created.token));assert.equal(first.response.headers.get('cache-control'),'no-store');
 const unchanged=await call(path,{token:created.token,etag:tag});assert.equal(unchanged.response.status,304);assert.equal(unchanged.data,null);assert.equal(unchanged.response.headers.get('x-server-time'),String(now));
 assert.equal((await call(path,{etag:tag})).response.status,401);
 await call(path+'/start',{body:{},token:created.token});const preparing=await call(path,{token:created.token});const startTag=preparing.response.headers.get('etag');assert.notEqual(startTag,tag);now+=5000;
 const decision=await call(path,{token:created.token,etag:startTag});assert.equal(decision.response.status,200);assert.equal(decision.data.state.phase,'decision');assert.notEqual(decision.response.headers.get('etag'),startTag);
});
test('online-presence expiry invalidates an unchanged version tag',async t=>{
 const env=setup(t,'presence-tag');let now=100000;
 const run=async(route,body,token,etag)=>handleApi(new Request('https://local.test'+route,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(etag?{'If-None-Match':etag}:{})},...(body?{body:JSON.stringify(body)}:{})}),env,{}, {clock:()=>now});
 const created=await (await run('/api/rooms',{name:'Presence',mode:'practice'})).json(),path='/api/rooms/'+created.roomId;
 await run(path+'/agent/check',null,created.agentToken);const before=await run(path,null,created.token),first=await before.json();assert.equal(first.state.me.agentConnected,true);now+=61000;
 const expired=await run(path,null,created.token,before.headers.get('etag'));assert.equal(expired.status,200);assert.equal((await expired.json()).state.me.agentConnected,false);
});
