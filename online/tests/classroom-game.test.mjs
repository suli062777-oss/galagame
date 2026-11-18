import test from 'node:test';
import assert from 'node:assert/strict';
import {missionMarkup,actionOptions,roundReviewMarkup,resultMarkup,roundNoteData,noteSourceMarkup} from '../public/classroom-game.js';
import {ACTIONS} from '../server/engine.js';

const row={seat:0,action:{id:'A01',target:0,scale:.5},previousUsers:450,users:420,actionCost:110,net:23,cashBefore:1200,cash:1223,profit:23,score:350,delta:350,retained:310,newUsers:110,contributions:{growth:240,profit:35,retention:75}};
const state=()=>({id:'TEST_ROOM',round:2,totalRounds:6,mode:'practice',phase:'finished',hostId:'own',me:{id:'own'},product:{name:'AI 笔记工具',coreBehavior:'完成整理并再次查阅',northStar:'完成核心行为的去重用户'},rules:{version:'test',weights:{growth:.5,profit:.35,retention:.15}},players:[{id:'own',seat:0,rank:1,cash:1223,users:420,profit:23,score:350,contributions:row.contributions},{id:'other',seat:1,score:999}],history:[{round:1,players:[row,{seat:1,action:{id:'A10'},users:999,profit:999}]}],world:[{round:1,type:'fact',text:'第1轮已公开事实'},{round:1,type:'verification',text:'第1轮结算核验'},{round:2,type:'fact',text:'只在第2轮公开的消息'}]});

test('a historical review excludes later-round messages and identifies settlement-time evidence',()=>{
 const html=roundReviewMarkup(state(),1,ACTIONS);
 assert.match(html,/第1轮已公开事实/);assert.match(html,/第1轮结算核验/);assert.doesNotMatch(html,/只在第2轮公开/);
 assert.match(html,/不代表做决定前已经知道/);
});

test('a bankrupt early finish reports actual completed rounds and the score override',()=>{
 const s=state();s.players[0]={...s.players[0],bankrupt:true,score:0};
 const html=resultMarkup(s,1,ACTIONS);
 assert.match(html,/已完成 1 \/ 6 轮/);assert.match(html,/综合分按规则归零/);assert.match(html,/不相加作为最终分/);
 assert.match(html,/<strong>0\.00<\/strong>/);
});

test('round note uses this seat actual execution, not another player or an assumed human intention',()=>{
 const note=roundNoteData(state(),1,ACTIONS);
 assert.match(note.body,/实际执行了付费获客/);assert.match(note.body,/450 → 420/);assert.doesNotMatch(note.body,/999/);
 assert.equal(note.source.roomId,'TEST_ROOM');assert.equal(note.source.round,1);
 assert.match(noteSourceMarkup(note.source),/#\/tavern\/TEST_ROOM\/review\/1/);
});

test('mission uses actual product and bound rule weights, with safe escaped data',()=>{
 const s=state();s.product.name='<script>unsafe</script>';s.rules.weights={growth:.4,profit:.4,retention:.2};
 const html=missionMarkup(s);assert.match(html,/规模 40% · 累计利润 40% · 留存 20%/);assert.match(html,/完成整理并再次查阅/);
 assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
});

test('all catalog actions remain available exactly once, including an unknown future catalog entry',()=>{
 const catalog=[...ACTIONS,{id:'A99',name:'新增目录行动'}];const html=actionOptions(catalog,'A11');
 for(const action of catalog)assert.equal(html.split('value="'+action.id+'"').length-1,1);
 assert.match(html,/value="A11" selected/);assert.match(html,/新增目录行动/);
});

test('note source rejects untrusted room IDs and out-of-range rounds',()=>{
 assert.equal(noteSourceMarkup({kind:'tavern-round',roomId:'" onclick="bad',round:1}), '');
 assert.equal(noteSourceMarkup({kind:'tavern-round',roomId:'ROOM',round:99}), '');
 assert.equal(roundNoteData(state(),6,ACTIONS),null);
});
