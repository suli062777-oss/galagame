import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash as nodeHash} from 'node:crypto';
import {crc32,deflateSync} from 'node:zlib';
import {handleApi,projectPublic} from '../api.js';
import {createHash} from '../sha256.js';
import {readRoom,mutateRoom} from '../storage.js';
import {validateAvatar} from '../avatars.js';
import oracle from './engine-oracle.json' with {type:'json'};
import * as workerEngine from '../engine.js';
function fixture(){
 // Test-only schema in :memory:, never deployment DDL.
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('CREATE TABLE rooms (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL)');
 const DB={prepare(sql){return {bind(...params){return {async first(){return sqlite.prepare(sql).get(...params)||null;},async run(){const r=sqlite.prepare(sql).run(...params);return {success:true,meta:{changes:Number(r.changes)}};}};}};}};
 let now=100000;const scheduled=[];const services={clock:()=>now,timing:{preparationMs:0,settlementMs:0},scheduleNarration(room){scheduled.push({id:room.id,round:room.game.round,history:room.game.history.length});}};
 return {env:{DB},services,sqlite,scheduled,setNow(v){now=v;},addTime(v){now+=v;},close(){sqlite.close();}};
}
async function call(c,path,body,token,extra={}){const response=await handleApi(new Request('https://growth.example'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...extra.headers},body:body===undefined?undefined:JSON.stringify(body)}),c.env,{waitUntil(){}},c.services);return {status:response.status,...await response.json()};}
const roomPath=id=>'/api/rooms/'+id;
const act=(round,id='A02',requestId='idempotent-'+round)=>({round,action:{id,target:1,scale:1},requestId});

test('Synchronous SHA256 and all six-round engine outcomes match native engine byte for byte',()=>{
 for(const s of ['', 'abc', '增长酒馆😀', 'a'.repeat(100000)])assert.equal(createHash('sha256').update(s).digest('hex'),nodeHash('sha256').update(s).digest('hex'));
 assert.equal(oracle.ruleVersion,workerEngine.RULES.version);for(const [seed,expected] of Object.entries(oracle.seeds)){const game=workerEngine.createGame({seed}),digest=()=>nodeHash('sha256').update(JSON.stringify(game)).digest('hex');assert.equal(digest(),expected[0]);for(let r=1;r<=6;r++){workerEngine.beginRound(game);workerEngine.settle(game,Array.from({length:4},(_,seat)=>workerEngine.scriptAction(game,seat)));assert.equal(digest(),expected[r]);}}
});

test('Four real Request clients share authoritative D1 room, concurrent joins cannot duplicate seats, full six-round replay',async t=>{
 const c=fixture();t.after(()=>c.close());const a=await call(c,'/api/rooms',{name:'A',mode:'multiplayer'});assert.equal(a.status,201);const p=roomPath(a.roomId);
 assert.equal((await call(c,p+'/start',{},a.token)).status,409);
 const joined=await Promise.all(['B','C','D'].map(name=>call(c,p+'/join',{name})));assert.ok(joined.every(r=>r.status===201));const seats=[a,...joined];assert.equal(new Set(joined.map(r=>r.state.me.seat)).size,3);
 assert.equal((await call(c,p+'/join',{name:'E'})).status,409);assert.equal((await call(c,p+'/start',{},joined[0].token)).status,403);assert.equal((await call(c,p+'/advance',{},a.token)).status,403);
 let r=await call(c,p+'/start',{},a.token);assert.equal(r.state.deadline,145000);assert.equal(c.scheduled.length,1);
 const raw=c.sqlite.prepare('SELECT data FROM rooms WHERE id=?').get(a.roomId).data;for(const s of seats){assert.ok(!raw.includes(s.token));assert.ok(!raw.includes(s.agentToken));}
 for(let round=1;round<=6;round++){
  const results=await Promise.all(seats.map((s,i)=>call(c,p+'/action',act(round,i===0?'A10':'A02','round-'+round+'-seat-'+i),s.token)));assert.ok(results.every(r=>r.receipt?.status==='accepted'));
  const duplicate=await call(c,p+'/action',act(round,'A10','round-'+round+'-seat-0'),a.token);assert.equal(duplicate.duplicate,true);
  const privateA=await call(c,p,undefined,a.token),privateB=await call(c,p,undefined,seats[1].token);assert.equal(privateA.state.me.id,a.playerId);assert.equal(privateB.state.me.id,seats[1].playerId);
  for(const forbidden of ['humanHash','agentHash','agenda','onboarding_response','rumorTruth'])assert.ok(!JSON.stringify(privateB).includes(forbidden));
  c.addTime(45000);const snapshots=await Promise.all(seats.map(s=>call(c,p,undefined,s.token)));r=snapshots[0];assert.equal(r.state.history.length,round);assert.ok(snapshots.every(s=>s.state.round===r.state.round));
 }
 assert.equal(r.state.phase,'finished');assert.equal(c.scheduled.length,7);assert.equal((await call(c,p+'/replay',undefined,a.token)).replay.verified,true);assert.equal(projectPublic(await readRoom(c.env,a.roomId)).me,null);
});

test('Deadlines, defaults, agent assist/autopilot, token rotation, cross-room auth and private research survive authoritative reads',async t=>{
 const c=fixture();t.after(()=>c.close());const a=await call(c,'/api/rooms',{name:'A',mode:'practice'}),b=await call(c,'/api/rooms',{name:'Other',mode:'practice'}),p=roomPath(a.roomId);
 assert.equal((await call(c,p,undefined,b.token)).status,403);assert.equal((await call(c,p)).status,401);assert.equal((await call(c,p+'/agent/check',undefined,a.token)).status,403);
 await call(c,p+'/start',{},a.token);await call(c,p+'/default',{action:{id:'A10',target:1,scale:1}},a.token);
 let r=await call(c,p+'/agent/action',act(1,'A02','agent-assist-1'),a.agentToken);assert.equal(r.receipt.status,'suggested');assert.equal(r.state.me.action,null);
 await call(c,p+'/intent',{text:'PRIVATE_INTENT'},a.token);assert.equal((await call(c,p+'/agent/state',undefined,a.agentToken)).state.me.intent,'PRIVATE_INTENT');
 await call(c,p+'/profile',{authorization:'autopilot'},a.token);r=await call(c,p+'/agent/action',act(1,'A10','agent-auto-1'),a.agentToken);assert.equal(r.receipt.status,'accepted');
 c.addTime(45000);r=await call(c,p,undefined,a.token);assert.equal(r.state.round,2);assert.equal(r.state.me.privateNotes.length,1);
 assert.equal((await call(c,p+'/action',act(1),a.token)).status,409);
 const rotated=await call(c,p+'/agent/rotate',{},a.token);assert.equal((await call(c,p+'/agent/check',undefined,a.agentToken)).status,403);assert.equal((await call(c,p+'/agent/check',undefined,rotated.agentToken)).connected,true);
 c.addTime(24*60*60*1000+1);assert.equal((await call(c,p+'/agent/check',undefined,rotated.agentToken)).code,'token_expired');
});

test('Production phase timing gives complete 45 seconds and simultaneous polls settle only once',async t=>{
 const c=fixture();c.services.timing={};t.after(()=>c.close());const a=await call(c,'/api/rooms',{name:'Clock',mode:'practice'}),p=roomPath(a.roomId);let r=await call(c,p+'/start',{},a.token);assert.equal(r.state.phase,'preparing');
 c.addTime(5000);r=await call(c,p,undefined,a.token);assert.equal(r.state.phase,'decision');assert.equal(r.state.deadline-r.state.serverTime,45000);
 c.addTime(45000);r=await call(c,p,undefined,a.token);assert.equal(r.state.phase,'settling');assert.equal(r.state.history.length,0);
 c.addTime(1000);const polls=await Promise.all(Array.from({length:5},()=>call(c,p,undefined,a.token)));assert.ok(polls.every(p=>p.state.history.length===1));assert.equal(c.scheduled.length,2);
});

function png(){const chunk=(type,data)=>{const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);data.copy(b,8);b.writeUInt32BE(crc32(b.subarray(4,8+data.length)),8+data.length);return b;};const header=Buffer.alloc(13);header.writeUInt32BE(64);header.writeUInt32BE(64,4);header[8]=8;header[9]=6;const pixels=Buffer.alloc(64*257,100);for(let y=0;y<64;y++)pixels[y*257]=0;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);}

test('Web PNG verification, avatar human-only scope, body limits and D1 persistence',async t=>{
 const c=fixture();t.after(()=>c.close());const bytes=png(),avatar={kind:'image',dataUrl:'data:image/png;base64,'+bytes.toString('base64')};assert.deepEqual(await validateAvatar(avatar),avatar);
 const bad=Buffer.from(bytes);bad[40]^=1;await assert.rejects(()=>validateAvatar({kind:'image',dataUrl:'data:image/png;base64,'+bad.toString('base64')}));
 const a=await call(c,'/api/rooms',{name:'Avatar',mode:'multiplayer'}),p=roomPath(a.roomId),b=await call(c,p+'/join',{name:'B'});
 assert.equal((await call(c,p+'/avatar',{avatar},a.agentToken)).status,403);assert.equal((await call(c,p+'/avatar',{avatar,playerId:b.playerId},a.token)).status,400);
 assert.equal((await call(c,p+'/avatar',{avatar},a.token)).status,200);assert.deepEqual((await call(c,p,undefined,b.token)).state.players[0].avatar,avatar);
 assert.equal((await call(c,p+'/profile',{persona:'x'.repeat(17000)},a.token)).status,413);
 const persisted=await readRoom(c.env,a.roomId);assert.deepEqual(persisted.players[0].avatar,avatar);assert.equal((await call(c,p+'/events',undefined,b.token)).polling,true);
 assert.equal((await call(c,p+'/avatar',{avatar:null},a.token)).state.me.avatar.kind,'preset');
});

test('CAS retries protect simultaneous updates and reject async mutators',async t=>{
 const c=fixture();t.after(()=>c.close());const a=await call(c,'/api/rooms',{name:'CAS',mode:'practice'});
 await Promise.all(Array.from({length:6},()=>mutateRoom(c.env,a.roomId,r=>{r.testCounter=(r.testCounter||0)+1;})));
 const result=await readRoom(c.env,a.roomId);assert.equal(result.testCounter,6);assert.equal(result.version,7);
 await assert.rejects(()=>mutateRoom(c.env,a.roomId,async()=>{}),/synchronous/);assert.equal((await readRoom(c.env,a.roomId)).version,7);
});

test('Slow POST bodies cannot carry revoked Agent authority or a decision across the deadline',async t=>{
 const c=fixture();t.after(()=>c.close());const a=await call(c,'/api/rooms',{name:'Slow',mode:'practice',authorization:'autopilot'}),p=roomPath(a.roomId);await call(c,p+'/start',{},a.token);
 function slow(route,body,token){const bytes=new TextEncoder().encode(JSON.stringify(body));let finish;const stream=new ReadableStream({start(controller){controller.enqueue(bytes.slice(0,8));finish=()=>{controller.enqueue(bytes.slice(8));controller.close();};}});const request=new Request('https://growth.example'+p+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:stream,duplex:'half'});return {finish,pending:handleApi(request,c.env,{},c.services).then(async r=>({status:r.status,...await r.json()}))};}
 const revoked=slow('/agent/action',act(1,'A03','revoked-agent-request'),a.agentToken);await call(c,p+'/agent/rotate',{},a.token);revoked.finish();assert.equal((await revoked.pending).status,403);
 const late=slow('/action',act(1,'A03','late-human-request'),a.token);c.addTime(45000);assert.equal((await call(c,p,undefined,a.token)).state.history.length,1);late.finish();const result=await late.pending;assert.equal(result.status,409);assert.equal(result.code,'stale_round');assert.equal((await readRoom(c.env,a.roomId)).game.history.length,1);
});
