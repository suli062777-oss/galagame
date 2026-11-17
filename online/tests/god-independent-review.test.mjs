import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIONS,PRODUCTS,EVENTS} from '../worker/engine.js';
import {knowledge,knowledgeCoverage,resolveKnowledgeReferences} from '../worker/god-knowledge.js';
import {retrieveKnowledge} from '../worker/god-retrieval.js';
import {buildGodInput,validateHostOutput} from '../worker/god-contract.js';

// Independent review fixtures: deliberately not model outputs or production calls.
const players=[{seat:0,score:30,users:450,cash:1200,profit:0,rank:2},{seat:1,score:40,users:900,cash:800,profit:0,rank:1}];
const base={round:1,phase:'decision',product:{id:'P01'},players};
const input=buildGodInput({...base,world:[{round:1,type:'rumor',text:'下一轮或许有内容触达机会，但仍待核验。'},{round:1,type:'forecast',text:'公开预告：下一轮可能有流量变化。'}]});
const value=(kind,claimIds,sentence)=>({kind,claimIds,knowledgeIds:['K13'],tone:'calm',narration:sentence+'公开事实与尚待核验的说法，需要分开作为判断依据[K13]。'});

test('knowledge covers actual 12 actions, 3 products and 18 events with traceable rule sources',()=>{
 assert.equal(ACTIONS.length,12);assert.equal(PRODUCTS.length,3);assert.equal(EVENTS.length,18);
 assert.equal(knowledgeCoverage.actions,12);assert.equal(knowledgeCoverage.products,3);assert.equal(knowledgeCoverage.events,18);assert.equal(knowledgeCoverage.publicEvents,17);
 for(const [category,items] of [['action',ACTIONS],['product',PRODUCTS],['event',EVENTS]])for(const item of items){const card=knowledge.find(k=>k.id==='K-'+item.id);assert.ok(card,item.id);assert.equal(card.category,category);assert.ok(card.sourceRefs.some(ref=>ref.id==='engine:'+item.id));if(category==='action')assert.deepEqual(card.mechanics,{cost:item.cost,scales:item.scales,scope:item.scope});}
 for(const card of knowledge){assert.ok(card.source&&card.sourceRefs.length,card.id);assert.ok(!card.sourceRefs.some(ref=>/第\s*\d+\s*页|\bpp?\.\s*\d+|\bpp?\s+\d+/i.test(ref.locator+' '+ref.label)),card.id+' fabricates a book page');}
});

test('private E15, player intent/research/avatar, future and unpublished action values never enter host context',()=>{
 const sentinel='INDEPENDENT_PRIVATE_MARKER_7c4e';
 const result=buildGodInput({...base,seed:sentinel,futureEvents:[sentinel],me:{privateNotes:[sentinel],intent:sentinel},players:players.map(p=>({...p,name:sentinel,privateNotes:[sentinel],avatar:{dataUrl:sentinel},decision:{action:{id:'A04'},summary:sentinel}})),world:[{round:1,type:'fact',eventId:'E15',text:sentinel},{round:6,type:'fact',eventId:'E01',text:sentinel},{round:1,type:'private',text:sentinel}]},{question:'E15 调研结果到账 '+sentinel,knowledgeLimit:18});
 assert.ok(!JSON.stringify(result).includes(sentinel));assert.ok(!result.knowledge.some(k=>k.id==='K-E15'));assert.ok(!result.claims.some(c=>c.eventId==='E15'));assert.deepEqual(resolveKnowledgeReferences(['K-E15']),[]);
 for(const event of EVENTS){const before=retrieveKnowledge({round:2,phase:'decision',productId:'P01',query:event.name+' '+event.id},{limit:18});assert.ok(!before.cards.some(k=>k.id==='K-'+event.id),'Unreleased event entered retrieval: '+event.id);const after=retrieveKnowledge({round:2,phase:'decision',productId:'P01',eventIds:[event.id]},{limit:18});assert.equal(after.cards.some(k=>k.id==='K-'+event.id),event.visibility==='public',event.id);}
});

for(const action of ACTIONS)test('settled '+action.id+' retrieves its actual action card',()=>{
 const result=buildGodInput({...base,round:2,history:[{round:1,players:[{seat:0,action:{id:action.id},delta:0,net:-20}]}]},{knowledgeLimit:18});
 assert.ok(result.knowledge.some(k=>k.id==='K-'+action.id));
});
for(const product of PRODUCTS)test('product '+product.id+' retrieves only its public definition',()=>{
 const result=buildGodInput({...base,product:{id:product.id}},{knowledgeLimit:18});
 assert.ok(result.knowledge.some(k=>k.id==='K-'+product.id));assert.ok(!result.knowledge.some(k=>/^K-P/.test(k.id)&&k.id!=='K-'+product.id));
});

const wrong=[
 ['first-seat metric swap','fact',['P0','P1'],'第一席的有效用户为900[P0][P1]。'],
 ['adverb metric swap','fact',['P0','P1'],'席位1现在的有效用户为900[P0][P1]。'],
 ['premature paraphrased victory','fact',['P0'],'席位1已经拿下了这局胜利[P0]。'],
 ['rumor falsely verified','rumor',['W0'],'这条未核实传闻现在已经核实落地[W0]。'],
 ['forecast falsely realized','trend',['W1'],'这条预告的变化如今已经兑现[W1]。'],
 ['host acting on a player behalf','fact',['P0'],'本轮由主持替席位1完成下单操作[P0]。'],
 ['invented private research conclusion','fact',['P0'],'席位1的研究说明，备考新手更偏好新增引导[P0]。'],
 ['unreleased player action','fact',['P0'],'席位1刚刚完成了用户调研[P0]。'],
 ['wrong aggregate using a real but unrelated number','fact',['P0','P1'],'两家公司合计900名有效用户[P0][P1]。'],
 ['wrong shared metric relationship','fact',['P0','P1'],'席位1和席位2的有效用户均为900[P0][P1]。']
];
for(const [name,kind,claimIds,sentence] of wrong)test('reject '+name,()=>assert.throws(()=>validateHostOutput(value(kind,claimIds,sentence),input,{requireNatural:true})));

test('allow an actually public rumor event name while preserving uncertainty',()=>{
 const event=EVENTS.find(e=>e.visibility==='public'),rumorInput=buildGodInput({...base,world:[{round:1,type:'rumor',text:`下一轮可能出现「${event.name}」。消息尚未核实，不保证成真。`}]});
 const narration=value('rumor',['W0'],`关于${event.name}的说法仍是未核实传闻，暂时保留不确定性[W0]。`);
 assert.doesNotThrow(()=>validateHostOutput(narration,rumorInput,{requireNatural:true}));
});
