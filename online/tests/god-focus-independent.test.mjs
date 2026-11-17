import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIONS,PRODUCTS,EVENTS} from '../worker/engine.js';
import {buildGodInput,modelNarrationInput} from '../worker/god-contract.js';

// Independent public-state fixtures. No provider, API, model call or mutation.
const players=()=>Array.from({length:4},(_,seat)=>({seat,users:450+seat,score:100+seat,profit:seat,cash:1200,rank:seat===2?1:seat+2,bankrupt:false}));
const base=(extra={})=>({round:2,phase:'preparing',product:{id:'P01'},players:players(),world:[],history:[],...extra});
function compact(state){const full=buildGodInput(state,{knowledgeLimit:18}),model=modelNarrationInput(full);assert.equal(model.claims.length,1);assert.equal(model.knowledge.length,1);assert.ok(full.claims.some(c=>c.id===model.claims[0].id));assert.ok(full.knowledge.some(k=>k.id===model.knowledge[0].id));return {full,model};}

for(const event of EVENTS.filter(e=>e.visibility==='public'))test('focus public event '+event.id+' without unrelated seat data',()=>{
 const {full,model}=compact(base({world:[{round:2,type:'fact',eventId:event.id,text:event.name+'：'+event.news}]}));
 assert.equal(full.focus.reason,'latest-published-world-message');assert.equal(model.claims[0].eventId,event.id);assert.equal(model.knowledge[0].id,'K-'+event.id);assert.ok(!model.claims.some(c=>/^P|^L/.test(c.id)));
});
test('latest public message wins over earlier messages',()=>{
 const {model}=compact(base({world:[{round:1,type:'fact',eventId:'E01',text:'旧公开事件'},{round:2,type:'fact',eventId:'E17',text:'新公开事件'}]}));assert.equal(model.claims[0].eventId,'E17');
});
test('rumor keeps its uncertainty category and receives no unpublished event mechanics',()=>{
 const {model}=compact(base({world:[{round:2,type:'rumor',text:'下一轮可能出现新活动，消息尚未核实。'}]}));assert.equal(model.claims[0].type,'rumor');assert.equal(model.knowledge[0].id,'K13');assert.ok(!JSON.stringify(model).includes('K-E'));
});
test('forecast keeps its future category rather than becoming an event fact',()=>{
 const {model}=compact(base({world:[{round:2,type:'forecast',text:'公开预告：后续可能出现变化。'}]}));assert.equal(model.claims[0].type,'forecast');assert.equal(model.knowledge[0].id,'K13');
});
test('finished prioritizes the public nonbankrupt result over world and settled actions',()=>{
 const {full,model}=compact(base({phase:'finished',round:6,world:[{round:6,type:'fact',eventId:'E17',text:'终轮公开事件'}],history:[{round:6,players:[{seat:0,action:{id:'A01'},delta:1,net:2}]}]}));assert.equal(full.focus.reason,'final-public-result');assert.equal(model.claims[0].seat,3);assert.equal(model.claims[0].metrics.rank,1);assert.equal(model.knowledge[0].id,'K12');
});
test('bankrupt players are never selected as the final winner',()=>{
 const rows=players();rows[0].rank=1;rows[0].score=1000;rows[0].bankrupt=true;const {model}=compact(base({phase:'finished',round:6,players:rows}));assert.notEqual(model.claims[0].seat,1);
});
test('all-bankrupt final input makes no invented individual winner selection',()=>{
 const {model}=compact(base({phase:'finished',round:6,players:players().map(p=>({...p,bankrupt:true,rank:0}))}));assert.equal(model.claims[0].id,'C0');assert.equal(model.knowledge[0].id,'K12');
});
for(const action of ACTIONS)test('rotating settled focus preserves action '+action.id+' and its own knowledge',()=>{
 for(const round of [2,3,4,5,6]){const chosen=(round-2)%4,rows=Array.from({length:4},(_,seat)=>({seat,action:{id:seat===chosen?action.id:'A12'},delta:seat,net:seat}));const {full,model}=compact(base({round,history:[{round:round-1,players:rows}]}));assert.equal(full.focus.reason,'rotate-through-settled-seats');assert.equal(model.claims[0].seat,chosen+1);assert.equal(model.claims[0].actionId,action.id);assert.equal(model.knowledge[0].id,'K-'+action.id);}
});
for(const product of PRODUCTS)test('opening product '+product.id+' cannot borrow another product definition',()=>{
 const {full,model}=compact(base({round:1,product:{id:product.id}}));assert.equal(full.focus.reason,'opening-product-goal');assert.equal(model.claims[0].id,'C0');assert.equal(model.product.id,product.id);assert.equal(model.knowledge[0].id,'K-'+product.id);assert.ok(model.knowledge[0].text.includes(product.core_behavior));assert.ok(!model.knowledge.some(k=>/^K-P/.test(k.id)&&k.id!=='K-'+product.id));
});
test('compact model payload excludes private state and retains provenance only on the server',()=>{
 const marker='INDEPENDENT_FOCUS_PRIVATE_e2c5',state=base({round:1,seed:marker,futureEvents:[marker],agenda:[marker],me:{privateNotes:[marker],intent:marker},players:players().map(p=>({...p,name:marker,privateNotes:[marker],intent:marker,avatar:{dataUrl:marker},decision:{summary:marker}})),product:{id:'P02',hiddenResponse:marker},world:[{round:1,type:'fact',eventId:'E15',text:marker},{round:6,type:'fact',eventId:'E01',text:marker}]});
 const {full,model}=compact(state),payload=JSON.stringify(model);assert.ok(!payload.includes(marker));assert.ok(!payload.includes('K-E15'));assert.ok(!payload.includes('sourceRefs'));assert.ok(!payload.includes('retrieval'));assert.ok(!payload.includes('privateNotes'));assert.ok(full.knowledge[0].sourceRefs?.length);assert.deepEqual(Object.keys(model.knowledge[0]).sort(),['id','text','title']);
});
