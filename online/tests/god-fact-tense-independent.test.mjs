/** Independent published-fact tense checks. Pure fixtures; no model/network. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {EVENTS} from '../worker/engine.js';
import {buildGodInput,modelNarrationInput,validateHostOutput} from '../worker/god-contract.js';

const event=EVENTS.find(item=>item.id==='E12');
const input=modelNarrationInput(buildGodInput({round:2,phase:'decision',product:{id:'P03'},players:[],history:[],world:[{round:2,type:'fact',eventId:'E12',text:event.news}]}));
const claim=input.claims.find(item=>item.eventId==='E12');
const value=sentence=>({kind:'fact',claimIds:[claim.id],knowledgeIds:['K-E12'],tone:'calm',narration:sentence+`[${claim.id}]。公开信息只说明高峰之后会回落，不能据此推断回落幅度或持续时长[K-E12]。`});

test('Published E12 cannot be announced as an event still about to arrive',()=>{
 for(const sentence of ['第一类人群将迎来两轮需求高峰','第一类人群的两轮需求高峰即将发生'])assert.throws(()=>validateHostOutput(value(sentence),input,{requireNatural:true}),/HOST_FACT_TENSE/);
});
test('Published E12 cannot be described as not yet happened',()=>{
 assert.throws(()=>validateHostOutput(value('第一类人群的两轮需求高峰尚未发生'),input,{requireNatural:true}),/HOST_FACT_TENSE/);
});
test('A current public peak may retain its explicitly published future falloff',()=>{
 const output=value('第一类人群正在经历两轮需求高峰，之后将回落');
 assert.equal(validateHostOutput(output,input,{requireNatural:true}),output);
});
