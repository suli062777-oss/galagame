import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=(await readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/^import .*$/gm,'').replace("window.addEventListener('hashchange',render);render();",'');
const state=(version=1,round=1)=>({id:'ROOM',phase:'decision',round,version,serverTime:Date.now()-100,deadline:Date.now()+45000,players:[],me:{id:'mine'}});
function fixture(){
 const requests=[],counts={json:0,renders:0},connection={offline:true,textContent:'连接中断',classList:{remove(){connection.offline=false;},add(){connection.offline=true;}}},noop=()=>{};
 const context=vm.createContext({AbortController,DOMException,Date,URL,URLSearchParams,crypto:globalThis.crypto,console,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone,document:{hidden:false,querySelector:selector=>selector==='#connection-status'?connection:null,addEventListener:noop},window:{addEventListener:noop},location:{hash:'#/tavern/ROOM',search:'',origin:'http://unit.test'},history:{},localStorage:{getItem:()=>null},matchMedia:()=>({matches:false}),fetch:(path,options)=>new Promise(resolve=>requests.push({path,options,respond(status,body,headers={}){const normalized=Object.fromEntries(Object.entries(headers).map(([key,value])=>[key.toLowerCase(),value]));resolve({status,ok:status>=200&&status<300,headers:{get:name=>normalized[name.toLowerCase()]??null},json:async()=>{counts.json++;if(status===304)throw Error('304 has no JSON body');return body;}});}}))});
 context.counts=counts;
 vm.runInContext(source+`;renderGame=()=>counts.renders++;updateGame=()=>counts.renders++;globalThis.unit={setup(state,tag,token='human-one'){stopRoomSync();location.hash='#/tavern/'+state.id;sessions[state.id]={token};currentState=state;viewKey=state.id+'-'+state.phase+'-'+state.round;draftState={key:roomActionKey(state),action:{id:'A01',target:1,scale:.5},dirty:true};rememberRoomEtag(state.id,roomEpoch,tag);},poll:()=>pollRoom(currentState.id),routeActive:id=>roomIsActive(id),changeHash:hash=>location.hash=hash,act,stop:stopRoomSync,state:()=>currentState,tag:()=>currentRoomEtag(currentState.id),draft:()=>JSON.stringify(draftState),changeToken(token){sessions[currentState.id].token=token;},accept:(state,tag)=>acceptRoomState(state,roomEpoch,Date.now(),tag)};`,context);
 return {unit:context.unit,requests,counts,connection};
}

test('304 avoids JSON/render, preserves dirty draft, restores connection and synchronizes clock',async()=>{
 const f=fixture();try{f.unit.setup(state(), '"v1"');const draft=f.unit.draft(),pending=f.unit.poll();assert.equal(f.requests[0].options.headers['If-None-Match'],'"v1"');const time=Date.now();f.requests[0].respond(304,null,{'ETag':'"v1"','X-Server-Time':String(time)});await pending;assert.equal(f.counts.json,0);assert.equal(f.counts.renders,0);assert.equal(f.unit.draft(),draft);assert.equal(f.unit.state().serverTime,time);assert.equal(f.connection.offline,false);assert.equal(f.connection.textContent,'');assert.equal(f.unit.tag(),'"v1"');}finally{f.unit.stop();}
});
test('new-version and next-round JSON responses update the ETag only with accepted state',async()=>{
 const f=fixture();try{f.unit.setup(state(), '"v1"');const p=f.unit.poll();f.requests[0].respond(200,{state:state(2,2)},{ETag:'"v2"'});await p;assert.equal(f.unit.state().round,2);assert.equal(f.unit.tag(),'"v2"');assert.equal(f.counts.renders,1);assert.equal(f.unit.accept(state(1,1),'"older"'),false);assert.equal(f.unit.tag(),'"v2"');}finally{f.unit.stop();}
});
test('late old-tag 304 cannot replace a newer POST tag or clock; absent POST tag clears cache',async()=>{
 const f=fixture();try{f.unit.setup(state(), '"v1"');const poll=f.unit.poll(),action=f.unit.act('action',{round:1});f.requests[1].respond(200,{state:state(2)},{ETag:'"v2"'});await action;const time=f.unit.state().serverTime;f.requests[0].respond(304,null,{ETag:'"v1"','X-Server-Time':String(time-1000)});await poll;assert.equal(f.unit.tag(),'"v2"');assert.equal(f.unit.state().serverTime,time);assert.equal(f.counts.renders,1);const next=f.unit.act('default',{round:1});f.requests[2].respond(200,{state:state(3)});await next;assert.equal(f.unit.tag(),null);}finally{f.unit.stop();}
});
test('ETag never crosses a human token or route epoch, even when fetch ignores abort',async()=>{
 const f=fixture();try{f.unit.setup(state(), '"private-one"');f.unit.changeToken('human-two');assert.equal(f.unit.tag(),null);const noTag=f.unit.poll();assert.equal(f.requests[0].options.headers['If-None-Match'],undefined);f.unit.stop();assert.equal(f.requests[0].options.signal.aborted,true);f.unit.setup(state(5),'"new-epoch"','human-two');const time=f.unit.state().serverTime;f.requests[0].respond(304,null,{ETag:'"private-one"','X-Server-Time':String(time+999)});await noTag;assert.equal(f.unit.tag(),'"new-epoch"');assert.equal(f.unit.state().version,5);assert.equal(f.unit.state().serverTime,time);assert.equal(f.counts.renders,0);}finally{f.unit.stop();}
});

// Review deep links belong to the same authorized room; arbitrary suffixes do not.
test('specific settled-round deep links retain room identity without broad prefix matching',()=>{
 const f=fixture();try{f.unit.setup(state());f.unit.changeHash('#/tavern/ROOM/review/2');assert.equal(f.unit.routeActive('ROOM'),true);assert.equal(f.unit.routeActive('ROOM_OTHER'),false);f.unit.changeHash('#/tavern/ROOM/review/7');assert.equal(f.unit.routeActive('ROOM'),false);f.unit.changeHash('#/tavern/ROOM/unrelated');assert.equal(f.unit.routeActive('ROOM'),false);}finally{f.unit.stop();}
});
