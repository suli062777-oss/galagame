import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const pending=[],writes={html:0,text:0},element={_html:'',_text:'',get innerHTML(){return this._html;},set innerHTML(value){writes.html++;this._html=value;},get textContent(){return this._text;},set textContent(value){writes.text++;this._text=value;}};
const noop=()=>{};
const context=vm.createContext({AbortController,DOMException,Date,URL,URLSearchParams,crypto:globalThis.crypto,console,setTimeout,clearTimeout,setInterval,clearInterval,structuredClone,document:{hidden:false,querySelector:()=>null,addEventListener:noop},window:{addEventListener:noop},location:{hash:'#/tavern/ROOM',search:'',origin:'http://unit.test'},history:{},localStorage:{getItem:()=>null},matchMedia:()=>({matches:false}),fetch:(path,options)=>new Promise((resolve,reject)=>pending.push({path,options,resolve:state=>resolve({ok:true,json:async()=>({state})}),reject}))});
let source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');source=source.replace(/^import .*$/gm,'').replace("window.addEventListener('hashchange',render);render();",'');
vm.runInContext(source+`;renderGame=()=>{};updateGame=()=>{};globalThis.unit={setup(state){stopRoomSync();location.hash='#/tavern/'+state.id;sessions[state.id]={token:'unit-token'};currentState=state;viewKey=state.id+'-'+state.phase+'-'+state.round;},poll:()=>pollRoom(currentState.id),act,stop:stopRoomSync,state:()=>currentState,accept:state=>acceptRoomState(state),cache(element){setMarkup(element,'same');setMarkup(element,'same');setText(element,'same');setText(element,'same');},host:(god)=>hostBroadcastMarkup({god}),knowledge:hostKnowledgeMarkup};`,context);
const unit=context.unit,state=(version,serverTime)=>({id:'ROOM',phase:'decision',round:1,version,serverTime});
try{
 unit.setup(state(4,400));const poll=unit.poll();assert.equal(pending.length,1);await unit.poll();assert.equal(pending.length,1,'Slow polling never overlaps itself');
 const action=unit.act('action',{round:1});assert.equal(pending.length,2);pending[1].resolve(state(6,600));await action;pending[0].resolve(state(5,500));await poll;assert.equal(unit.state().version,6,'Late read cannot replace a newer accepted mutation');
 assert.equal(unit.accept(state(6,550)),false,'Equal-version older snapshots are rejected');
 unit.setup(state(1,100));const old=unit.poll(),request=pending.at(-1);unit.stop();assert.equal(request.options.signal.aborted,true,'Leaving aborts the fetch signal');
 unit.setup(state(2,200));request.resolve(state(99,9900));await old;assert.equal(unit.state().version,2,'A fetch implementation ignoring abort cannot cross route epochs');
 unit.cache(element);assert.deepEqual(writes,{html:1,text:1},'Identical markup and text do not rewrite DOM');
 assert.match(unit.host({status:'generating',provider:'deepseek'}),/正在撰写/);assert.match(unit.host({status:'ready',provider:'template',text:'真实模板'}),/真实模板/);assert.match(unit.host({status:'fallback',provider:'template',text:'继续经营'}),/接替播报/);assert.match(unit.host({status:'error',provider:'deepseek'}),/暂不可用/);
 const knowledge=unit.knowledge([{id:'chapter-1',title:'留存',chapter:'第三章',section:'同期群',summary:'公开摘要',source:'项目交互书',version:'v1'}]);assert.match(knowledge,/第三章 · 同期群/);assert.match(knowledge,/公开摘要/);assert.match(knowledge,/项目交互书/);
 const first=unit.knowledge([{id:'K02',title:'同一知识'}],'message-one'),second=unit.knowledge([{id:'K02',title:'同一知识'}],'message-two');assert.match(first,/data-knowledge="message-one:K02"/);assert.match(second,/data-knowledge="message-two:K02"/);assert.notEqual(first,second,'Repeated knowledge across history messages keeps separate expansion identities');
 console.log('8 sync/cache/host checks passed: serial poll, stale mutation read, same-version ordering, abort, route epoch, DOM cache, truthful host states, real knowledge fields. No network or model.');
}finally{unit.stop();}
