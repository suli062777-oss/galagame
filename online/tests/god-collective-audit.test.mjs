/** Independent regression of the latest collective/comparative predicate fix.
 * No provider calls. Numeric fixtures deliberately disagree between seats. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGodInput,validateHostOutput} from '../worker/god-contract.js';
const input=buildGodInput({round:3,phase:'decision',product:{id:'P01'},players:[{seat:0,score:30,users:450,cash:1200,profit:0,rank:2},{seat:1,score:40,users:900,cash:800,profit:0,rank:1}],world:[],history:[]},{question:'怎么判断是行动效果还是外部事件',knowledgeLimit:18});
function output(sentence,claims=['P0','P1']){return {kind:'fact',claimIds:claims,knowledgeIds:['K13'],tone:'calm',narration:sentence+'公开事实与尚待核验的说法，需要分开作为判断依据[K13]。'};}
for(const predicate of ['均为','同为','同样为','都为','都是','皆为','全都为','均有','都有'])test('Reject false collective users predicate: '+predicate,()=>{
 assert.throws(()=>validateHostOutput(output('席位1和席位2的有效用户'+predicate+'900[P0][P1]。'),input,{requireNatural:true}),/HOST_/);
});
for(const sentence of ['席位1的有效用户高于席位2[P0][P1]。','席位1比席位2拥有更多有效用户[P0][P1]。','席位1的有效用户最高[P0][P1]。'])test('Reject false relationship even with two public citations: '+sentence,()=>{
 assert.throws(()=>validateHostOutput(output(sentence),input,{requireNatural:true}),/HOST_/);
});
test('Single-seat unsupported superlative is rejected',()=>{assert.throws(()=>validateHostOutput(output('席位1的有效用户较高[P0]。',['P0']),input,{requireNatural:true}),/HOST_COMPARISON_REFERENCE/);});
test('Normal once/next-judgment wording is not fabricated arithmetic',()=>{
 assert.ok(input.knowledge.some(card=>card.id==='K-F06'));
 const value={kind:'fact',claimIds:['P0'],knowledgeIds:['K-F06'],tone:'reflective',narration:'当前经营结果只是一个观察点[P0]。不能从一次变化推出单一因果，下一次判断仍应核对事件与竞争[K-F06]。'};
 assert.equal(validateHostOutput(value,input,{requireNatural:true}),value);
});
test('Explicitly negated guarantee remains a caution, not an unsafe promise',()=>{const value=output('当前经营结果并不保证正向收益[P0]。',['P0']);assert.equal(validateHostOutput(value,input,{requireNatural:true}),value);});
