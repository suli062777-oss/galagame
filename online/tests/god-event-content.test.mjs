import test from 'node:test';
import assert from 'node:assert/strict';
import {EVENTS} from '../worker/engine.js';
import {knowledge} from '../worker/god-knowledge.js';
import {buildGodInput,modelNarrationInput,HOST_PROMPT} from '../worker/god-contract.js';
const state=world=>({round:3,phase:'decision',product:{id:'P03'},players:[],history:[],world});
const event=id=>EVENTS.find(item=>item.id===id);

test('E13 distinguishes its announcement lifetime from economic cost effects',()=>{
 const card=knowledge.find(item=>item.id==='K-E13');
 assert.match(card.text,/播报标记持续1轮/);assert.match(card.text,/不施加任何额外成本/);assert.match(card.text,/拥挤费用已按经营公式计入/);assert.match(card.text,/不能据新闻判断费用何时结束/);assert.doesNotMatch(card.text,/成本持续1轮/);
 assert.deepEqual(event('E13').effect,{});assert.equal(card.mechanicsText,card.text);assert.ok(card.sourceNote);
});
test('Published E13 compact payload contains mechanics, not a generic occurrence disclaimer',()=>{
 const input=buildGodInput(state([{round:3,type:'fact',eventId:'E13',text:event('E13').news,targets:[0,1,2,3]}])),model=modelNarrationInput(input);
 assert.equal(model.knowledge[0].id,'K-E13');assert.match(model.knowledge[0].text,/播报不施加任何额外成本/);
 assert.ok(input.knowledge.find(card=>card.id==='K-E13').sourceNote);assert.ok(!Object.hasOwn(model.knowledge[0],'sourceNote'));
 assert.doesNotMatch(JSON.stringify(model.knowledge),/不证明本局|适用来源|来源元数据/);
});
test('E16 neutralizes company perspective and converts only explicit public targets to human seats',()=>{
 const fixture=state([{round:3,type:'fact',eventId:'E16',text:event('E16').news,targets:[0,2]}]),before=structuredClone(fixture),rawNews=event('E16').news;
 const input=buildGodInput(fixture),claim=input.claims.find(item=>item.eventId==='E16'),card=input.knowledge.find(item=>item.id==='K-E16'),model=modelNarrationInput(input);
 assert.doesNotMatch(claim.text,/本公司/);assert.match(claim.text,/受影响席位/);assert.deepEqual(claim.targetSeats,[1,3]);assert.match(claim.text,/席位1、席位3/);assert.doesNotMatch(claim.text,/席位2|席位4/);
 assert.doesNotMatch(card.text,/本公司/);assert.match(card.text,/受影响席位付费概率乘数为0.9/);assert.match(card.text,/不改变行动次数或共同决策窗口/);
 assert.deepEqual(model.claims[0].targetSeats,[1,3]);assert.equal(model.knowledge[0].text,card.mechanicsText);assert.deepEqual(fixture,before);assert.equal(event('E16').news,rawNews);assert.match(rawNews,/本公司/);
});
test('Missing, empty or malformed target lists never guess a whole table or another seat',()=>{
 const without=buildGodInput(state([{round:3,type:'fact',eventId:'E16',text:event('E16').news}])).claims.find(item=>item.eventId==='E16');
 assert.ok(!Object.hasOwn(without,'targetSeats'));assert.doesNotMatch(without.text,/席位[1-4]|全桌/);
 const empty=buildGodInput(state([{round:3,type:'fact',eventId:'E16',text:event('E16').news,targets:[]}])).claims.find(item=>item.eventId==='E16');assert.deepEqual(empty.targetSeats,[]);assert.match(empty.text,/未列出具体席位对象/);
 const filtered=buildGodInput(state([{round:3,type:'fact',eventId:'E16',text:event('E16').news,targets:[-1,4,'0',2,2]}])).claims.find(item=>item.eventId==='E16');assert.deepEqual(filtered.targetSeats,[3]);
});
test('Event provenance stays out of compact knowledge even for a legacy input without focus',()=>{
 const input=buildGodInput(state([{round:3,type:'fact',eventId:'E16',text:event('E16').news,targets:[1]}]));delete input.focus;
 const model=modelNarrationInput(input);assert.ok(model.knowledge.some(card=>card.id==='K-E16'));assert.ok(model.knowledge.every(card=>Object.keys(card).every(key=>['id','title','text'].includes(key))));assert.doesNotMatch(JSON.stringify(model.knowledge),/来源元数据|不证明本局/);
});
test('Prompt states fact certainty, strategy limits and fixed timing rather than new mechanics',()=>{
 assert.match(HOST_PROMPT,/不替玩家挑选策略/);assert.match(HOST_PROMPT,/type=fact表示已经公开发生/);assert.match(HOST_PROMPT,/不改变既有行动次数、截止时间或共同决策窗口/);assert.match(HOST_PROMPT,/不把机制推演成新规则/);
});
