/** RFC 9110 conditional GET regression. Local real SQL/CAS only; no network. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeTestDb} from './d1-adapter.mjs';
import {handleApi} from '../worker/api.js';
import {readRoom} from '../worker/storage.js';
import {etagMatches} from '../worker/room-transport.js';

const weak=tag=>'W/'+tag.replace(/^W\//,'');
test('A comma inside an opaque tag is data, not a list delimiter',()=>{
 assert.equal(etagMatches('"other", W/"room,seat"','"room,seat"'),true);
 assert.equal(etagMatches('W/"room,seat"','"room"'),false);
 assert.equal(etagMatches('"room", "seat"','"room,seat"'),false);
});
test('Weak indicators and opaque values retain RFC case sensitivity',()=>{
 assert.equal(etagMatches('W/"CaseSensitive"','"CaseSensitive"'),true);
 assert.equal(etagMatches('"CaseSensitive"','W/"CaseSensitive"'),true);
 assert.equal(etagMatches('w/"CaseSensitive"','"CaseSensitive"'),false);
 assert.equal(etagMatches('W/"casesensitive"','"CaseSensitive"'),false);
});
test('Invalid mixed wildcard and malformed suffixes cannot short-circuit a valid member',()=>{
 for(const header of ['*, "room"','"room", *','"room" trailing','"room", W/not-quoted','"room", "unterminated'])assert.equal(etagMatches(header,'"room"'),false,header);
});
async function fixture(t){
 const DB=makeTestDb();t.after(()=>DB.close());const env={DB};let now=100000;
 async function call(path,{body,token,etag}={}){
  const response=await handleApi(new Request('https://etag.local'+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{}),...(etag?{'If-None-Match':etag}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}),env,{}, {clock:()=>now});
  const text=await response.text();return {response,text,data:text?JSON.parse(text):null};
 }
 const created=(await call('/api/rooms',{body:{name:'Conditional owner',mode:'practice'}})).data,path='/api/rooms/'+created.roomId;
 const first=await call(path,{token:created.token});
 return {env,created,path,call,tag:first.response.headers.get('etag'),advance:ms=>{now+=ms;},time:()=>now};
}

test('If-None-Match weak form matches the same own-seat opaque tag',async t=>{
 const f=await fixture(t),reply=await f.call(f.path,{token:f.created.token,etag:weak(f.tag)});
 assert.equal(reply.response.status,304);assert.equal(reply.text,'');assert.equal(reply.response.headers.get('x-server-time'),String(f.time()));
});
test('If-None-Match list matches any strong or weak member with optional whitespace',async t=>{
 const f=await fixture(t),reply=await f.call(f.path,{token:f.created.token,etag:'"unrelated",\t'+weak(f.tag)+' , "other"'});
 assert.equal(reply.response.status,304);assert.equal(reply.text,'');
});
test('Authenticated wildcard matches an existing room representation',async t=>{
 const f=await fixture(t),reply=await f.call(f.path,{token:f.created.token,etag:'*'});
 assert.equal(reply.response.status,304);assert.equal(reply.text,'');
});
test('A nonmatching tag list returns the actual own-seat representation',async t=>{
 const f=await fixture(t),reply=await f.call(f.path,{token:f.created.token,etag:'"unrelated", W/"other"'});
 assert.equal(reply.response.status,200);assert.equal(reply.data.state.me.id,f.created.playerId);
});
test('Wildcard and weak tags never bypass authentication or room isolation',async t=>{
 const f=await fixture(t),other=(await f.call('/api/rooms',{body:{name:'Other owner',mode:'practice'}})).data;
 assert.equal((await f.call(f.path,{etag:'*'})).response.status,401);
 assert.equal((await f.call(f.path,{token:other.token,etag:'*'})).response.status,403);
 assert.equal((await f.call(f.path,{token:other.token,etag:weak(f.tag)})).response.status,403);
});
test('An old weak tag cannot hide an authoritative deadline transition',async t=>{
 const f=await fixture(t),started=await f.call(f.path+'/start',{body:{},token:f.created.token}),tag=started.response.headers.get('etag');
 assert.equal(started.data.state.phase,'preparing');f.advance(5000);
 const reply=await f.call(f.path,{token:f.created.token,etag:weak(tag)});
 assert.equal(reply.response.status,200);assert.equal(reply.data.state.phase,'decision');assert.equal(reply.data.state.deadline,f.time()+45000);assert.notEqual(reply.response.headers.get('etag'),tag);
});
test('Wildcard still performs the due phase change before emitting 304',async t=>{
 const f=await fixture(t);await f.call(f.path+'/start',{body:{},token:f.created.token});f.advance(5000);
 const reply=await f.call(f.path,{token:f.created.token,etag:'*'}),room=await readRoom(f.env,f.created.roomId);
 assert.equal(reply.response.status,304);assert.equal(reply.text,'');assert.equal(room.phase,'decision');assert.equal(room.deadline,f.time()+45000);assert.equal(reply.response.headers.get('x-server-time'),String(f.time()));
});
