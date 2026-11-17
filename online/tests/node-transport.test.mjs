import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server/api.js';

test('actual Node HTTP room reads accept weak validators while retaining auth and deadline changes',async t=>{
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../data');
 await fs.mkdir(root,{recursive:true});const directory=await fs.mkdtemp(path.join(root,'node-transport-'));
 let now=100000;
 const server=createServer({dataDir:directory,clock:()=>now,preparationMs:0,settlementMs:0,godStatus:()=>({configuredProvider:'template',enabled:false,keyConfigured:false,calls:0,limit:12})});
 t.after(async()=>{
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  const target=path.resolve(directory);assert.ok(target.startsWith(root+path.sep)&&path.basename(target).startsWith('node-transport-'));
  await fs.rm(target,{recursive:true,force:true});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 async function call(route,{body,token,tag}={}){
  const response=await fetch(base+route,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(tag?{'If-None-Match':tag}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const raw=await response.text();return {status:response.status,tag:response.headers.get('etag'),raw,data:raw?JSON.parse(raw):null};
 }
 const made=await call('/api/rooms',{body:{name:'Node transport fixture',mode:'practice'}});assert.equal(made.status,201);
 const token=made.data.token,route='/api/rooms/'+made.data.roomId;
 const first=await call(route,{token});assert.equal(first.status,200);assert.equal(first.data.state.me.id,made.data.playerId);
 const unchanged=await call(route,{token,tag:'W/'+first.tag});assert.equal(unchanged.status,304);assert.equal(unchanged.raw,'');
 assert.equal((await call(route,{tag:'*'})).status,401);
 assert.equal((await call(route+'/start',{body:{},token})).status,200);
 const decision=await call(route,{token});assert.equal(decision.data.state.phase,'decision');
 now+=45001;
 const changed=await call(route,{token,tag:'W/'+decision.tag});assert.equal(changed.status,200);assert.equal(changed.data.state.history.length,1);assert.equal(changed.data.state.round,2);
});
