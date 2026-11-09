import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {crc32,deflateSync} from 'node:zlib';
import {validateAvatar} from '../server/avatars.js';
import {defaultAvatar,PRESETS,MAX_AVATAR_REQUEST_BYTES} from '../public/avatar-contract.js';
import {createServer} from '../server/api.js';
import {buildGodInput} from '../server/god.js';
const fixtureRoot=fileURLToPath(new URL('../data/',import.meta.url));
function chunk(type,data=Buffer.alloc(0)){const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length,0);out.write(type,4,'ascii');data.copy(out,8);out.writeUInt32BE(crc32(out.subarray(4,8+data.length)),8+data.length);return out;}
function png({size=128,noise=false,rawOverride=null}={}){
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
 const pixels=Buffer.alloc(size*(size*4+1));let rand=7919;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*(size*4+1)+1+x*4;for(let c=0;c<3;c++){rand=(Math.imul(rand,1664525)+1013904223)>>>0;pixels[i+c]=noise?rand>>>24:80+c*30;}pixels[i+3]=255;}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(rawOverride||pixels)),chunk('IEND')]);
}
const asAvatar=bytes=>({kind:'image',dataUrl:'data:image/png;base64,'+bytes.toString('base64')});
async function setup(){fs.mkdirSync(fixtureRoot,{recursive:true});const dataDir=fs.mkdtempSync(path.join(fixtureRoot,'test-avatars-'));const server=createServer({dataDir,preparationMs:0,settlementMs:0});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return {server,dataDir,base:`http://127.0.0.1:${server.address().port}`};}
async function request(ctx,url,body,token){const response=await fetch(ctx.base+url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,...await response.json()};}
async function close(c){await new Promise(resolve=>c.server.close(resolve));fs.rmSync(c.dataDir,{recursive:true,force:true});}

test('Avatar validation accepts supported presets/static PNG and rejects executable/remote/corrupt images',()=>{
 assert.deepEqual(validateAvatar(null,{seat:2}),defaultAvatar(2));for(const p of PRESETS)assert.deepEqual(validateAvatar({kind:'preset',id:p.id}),{kind:'preset',id:p.id});
 const valid=asAvatar(png());assert.deepEqual(validateAvatar(valid),valid);
 const corrupt=png();corrupt[40]^=1;
 for(const value of [{kind:'preset',id:'unknown'},{kind:'preset',id:'ember',playerId:'other'},{kind:'image',dataUrl:'https://other.invalid/photo.png'},{kind:'image',dataUrl:'data:image/svg+xml;base64,'+Buffer.from('<svg onload="alert(1)"/>').toString('base64')},asAvatar(Buffer.from('<html>fake</html>')),asAvatar(corrupt),asAvatar(Buffer.concat([png(),Buffer.from('<script/>')])),asAvatar(png({size:512})),asAvatar(png({rawOverride:Buffer.alloc(128*128*8)})),asAvatar(png().subarray(0,-5))])assert.throws(()=>validateAvatar(value));
});

test('Avatar API updates only authenticated human seat and broadcasts the public avatar to other players',async t=>{
 const c=await setup();t.after(()=>close(c));const a=await request(c,'/api/rooms',{name:'A',mode:'multiplayer'}),p='/api/rooms/'+a.roomId,b=await request(c,p+'/join',{name:'B'});
 assert.deepEqual(a.state.me.avatar,defaultAvatar(0));assert.deepEqual(b.state.me.avatar,defaultAvatar(1));
 assert.equal((await request(c,p+'/avatar',{avatar:{kind:'preset',id:'orbit'}})).status,401);
 assert.equal((await request(c,p+'/avatar',{avatar:{kind:'preset',id:'orbit'}},a.agentToken)).status,403);
 assert.equal((await request(c,p+'/avatar',{avatar:{kind:'preset',id:'orbit'},playerId:a.playerId},b.token)).status,400);
 const before=(await request(c,p,undefined,a.token)).state.players[0].avatar;
 const changed=await request(c,p+'/avatar',{avatar:{kind:'preset',id:'copper'}},b.token);assert.equal(changed.status,200);assert.deepEqual(changed.state.players[0].avatar,before);assert.deepEqual(changed.state.me.avatar,{kind:'preset',id:'copper'});
 const seen=await request(c,p,undefined,a.token);assert.equal(seen.state.players.find(p=>p.id===b.playerId).avatar.id,'copper');
 assert.equal((await request(c,p+'/avatar',{avatar:{kind:'preset',id:'bad'}},b.token)).status,400);assert.equal((await request(c,p,undefined,b.token)).state.me.avatar.id,'copper');
 const restored=await request(c,p+'/avatar',{avatar:null},b.token);assert.deepEqual(restored.state.me.avatar,defaultAvatar(1));
});

test('Photo avatar crosses old 16KB bound only on avatar route, persists on restart and never enters God input',async t=>{
 const c=await setup();t.after(()=>close(c));const a=await request(c,'/api/rooms',{name:'Photo',mode:'practice'}),p='/api/rooms/'+a.roomId,avatar=asAvatar(png({noise:true}));
 assert.ok(JSON.stringify({avatar}).length>16384);assert.ok(JSON.stringify({avatar}).length<MAX_AVATAR_REQUEST_BYTES);
 const update=await request(c,p+'/avatar',{avatar},a.token);assert.equal(update.status,200);assert.deepEqual(update.state.me.avatar,avatar);
 const input=JSON.stringify(buildGodInput(update.state));assert.ok(!input.includes('data:image'));assert.ok(!input.includes(avatar.dataUrl.slice(22,80)));assert.ok(!input.includes('avatar'));
 assert.equal((await request(c,p+'/profile',{persona:'x'.repeat(17000)},a.token)).status,413);
 assert.equal((await request(c,p+'/avatar',{avatar:{kind:'image',dataUrl:'x'.repeat(MAX_AVATAR_REQUEST_BYTES)}},a.token)).status,413);
 await new Promise(resolve=>c.server.close(resolve));c.server=createServer({dataDir:c.dataDir,preparationMs:0,settlementMs:0});await new Promise(resolve=>c.server.listen(0,'127.0.0.1',resolve));c.base=`http://127.0.0.1:${c.server.address().port}`;
 assert.deepEqual((await request(c,p,undefined,a.token)).state.me.avatar,avatar);
 await request(c,p+'/start',{},a.token);assert.equal((await request(c,p+'/avatar',{avatar:{kind:'preset',id:'moss'}},a.token)).status,200);
});

test('Connected second-seat SSE receives an avatar replacement without changing seat identity',async t=>{
 const c=await setup();const controller=new AbortController();t.after(async()=>{controller.abort();await close(c);});
 const a=await request(c,'/api/rooms',{name:'A',mode:'multiplayer'}),p='/api/rooms/'+a.roomId,b=await request(c,p+'/join',{name:'B'});
 const response=await fetch(c.base+p+'/events',{headers:{Authorization:'Bearer '+b.token},signal:controller.signal}),reader=response.body.getReader();let buffer='';
 async function next(){while(!buffer.includes('\n\n')){const part=await reader.read();if(part.done)throw Error('SSE ended');buffer+=new TextDecoder().decode(part.value);}const end=buffer.indexOf('\n\n'),event=buffer.slice(0,end);buffer=buffer.slice(end+2);return JSON.parse(event.split('\n').find(s=>s.startsWith('data: ')).slice(6));}
 assert.equal((await next()).me.id,b.playerId);
 await request(c,p+'/avatar',{avatar:{kind:'preset',id:'aurora'}},a.token);
 const event=await next();assert.equal(event.me.id,b.playerId);assert.equal(event.players.find(p=>p.id===a.playerId).avatar.id,'aurora');assert.deepEqual(event.me.avatar,defaultAvatar(1));controller.abort();
});
