import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,beginRound,settle,normalizeAction,actionCost,scoreCompany,rankings,replayGame,assertInvariants,scriptAction,halfUp,ACTIONS,PRODUCTS,WAIT} from '../server/engine.js';
const sum=a=>a.reduce((s,n)=>s+n,0);
function play(seed='test',productId='P01',policy=(g,s)=>scriptAction(g,s)){const g=createGame({seed,productId});for(let r=1;r<=6;r++){beginRound(g);settle(g,[0,1,2,3].map(s=>policy(g,s)));}return g;}

test('all 12 actions validate exact legal scales, target and reserved cash',()=>{
 assert.equal(ACTIONS.length,12);
 for(const def of ACTIONS)for(const scale of def.scales){const a={id:def.id,target:2,scale};assert.deepEqual(normalizeAction(a,1200),a);assert.equal(actionCost(a),def.cost*scale);}
 for(const a of [null,[],{}, {id:'A99'},{id:'A01',target:3},{id:'A01',target:1.2},{id:'A01',scale:'1'},{id:'A01',scale:NaN},{id:'A01',scale:Infinity},{id:'A08',scale:.5},{id:'A12',cash:1}])assert.throws(()=>normalizeAction(a,1200));
 assert.deepEqual(normalizeAction({id:'A01',target:0,scale:1},240),{id:'A01',target:0,scale:1});assert.throws(()=>normalizeAction({id:'A01',scale:1},239.99));assert.deepEqual(normalizeAction(WAIT,0),WAIT);
});
test('score examples, pooled retention, 3-round users and cumulative profit',()=>{
 const c={profit:600,bankrupt:false,history:[{users:450,previousUsers:450,retained:360}]};assert.equal(scoreCompany(c).score,603.33);
 assert.equal(halfUp(1.005),1.01);assert.equal(halfUp(-1.005),-1.01);
 c.history=[{users:900,previousUsers:100,retained:90},{users:300,previousUsers:900,retained:450}];assert.equal(scoreCompany(c).retention,.54);
 c.history=[{users:1,previousUsers:1,retained:0},{users:300,previousUsers:100,retained:90},{users:300,previousUsers:100,retained:90},{users:900,previousUsers:100,retained:90}];assert.equal(scoreCompany(c).inputs.users,500);
 assert.throws(()=>scoreCompany({...c,history:[{users:1,previousUsers:0,retained:1}]}));assert.throws(()=>scoreCompany({...c,profit:NaN}));
 assert.equal(scoreCompany({...c,bankrupt:true}).score,0);
});
test('ties only use public score; all bankrupt yields no winner',()=>{
 const g=createGame();g.companies.forEach((c,s)=>{c.score=100;c.profit=s*100;c.active=[s,0,0];});assert.deepEqual(rankings(g).winners,[0,1,2,3]);assert.ok(rankings(g).rows.every(r=>r.rank===1));
 g.companies.forEach(c=>{c.bankrupt=true;c.score=0;});assert.deepEqual(rankings(g).winners,[]);assert.equal(rankings(g).allBankrupt,true);
});
test('settlement order preserves budgets, price set semantics, no repeated round',()=>{
 const g=createGame({seed:'order',productId:'P01',events:false});beginRound(g);const d=settle(g,[{id:'A08'},WAIT,WAIT,WAIT]);assert.equal(d.players[0].price,11.2);assert.equal(d.players[0].actionCost,20);assert.equal(d.players[0].cash,halfUp(1200+d.players[0].revenue-d.players[0].operations-20));
 assert.throws(()=>settle(g,[WAIT,WAIT,WAIT,WAIT]));beginRound(g);settle(g,[{id:'A08'},WAIT,WAIT,WAIT]);assert.equal(g.history[1].players[0].price,11.2);
});
test('content delayed contacts paid once and trial expiry applied once',()=>{
 const g=createGame({seed:'effects',productId:'P01',events:false});beginRound(g);settle(g,[{id:'A02',target:0,scale:1},{id:'A07'},WAIT,WAIT]);const pending=g.companies[0].pendingContent[0];assert.ok(pending>0);beginRound(g);settle(g,[WAIT,WAIT,WAIT,WAIT]);assert.equal(g.companies[0].pendingContent[0],0);assert.equal(g.history[1].players[1].effects.local_pay,.9);beginRound(g);settle(g,[WAIT,WAIT,WAIT,WAIT]);assert.equal(g.history[2].players[1].effects.local_pay,1);assert.equal(g.history[2].players[0].visitors[0],10);
});
test('bankrupt state freezes economics; exact zero is not bankruptcy until costs',()=>{
 const g=createGame({events:false});const c=g.companies[0];c.cash=0;c.profit=-1200;c.active=[0,0,0];assert.equal(c.bankrupt,false);beginRound(g);settle(g,[{id:'A01'},WAIT,WAIT,WAIT]);assert.equal(c.history[0].action.id,'A12');assert.equal(c.bankrupt,true);assert.deepEqual(c.active,[0,0,0]);const cash=c.cash;beginRound(g);settle(g,[WAIT,WAIT,WAIT,WAIT]);assert.equal(c.cash,cash);assert.equal(c.history[1].revenue,0);assert.equal(c.history[1].operations,0);assert.equal(c.score,0);
});
test('research/experiments are private information without free users or rewards',()=>{
 const g=createGame({seed:'study',events:false});beginRound(g);settle(g,[{id:'A10',target:0},{id:'A11',target:0},WAIT,WAIT]);assert.equal(g.companies[0].privateNotes[0].type,'research');assert.equal(g.companies[1].privateNotes[0].controlN,40);assert.equal(g.companies[1].privateNotes[0].treatmentN,40);assert.deepEqual(g.companies[0].active,g.companies[1].active);assert.deepEqual(g.companies[1].active,g.companies[2].active);assert.equal(g.companies[1].quality,0);
});
test('deterministic replay, market conservation, event cooldown and chains over 180 worlds',()=>{
 for(const p of PRODUCTS)for(let seed=0;seed<60;seed++){
  const g=play(`world-${seed}`,p.id);assert.equal(g.history.length,6);assert.equal(replayGame(g).verified,true);assertInvariants(g);
  for(const h of g.history){h.marketTotals.forEach((n,j)=>assert.ok(n<=p.market[j]+1e-7));for(const d of h.players)assert.equal(halfUp(d.cashBefore+d.revenue-d.operations-d.actionCost),d.cash);}
  for(const start of g.starts.filter(e=>e.id==='E08'||e.id==='E12'))assert.ok(g.starts.some(e=>e.id===(start.id==='E08'?'E18':'E17')&&e.start===start.start+2));
  assert.equal(g.world.filter(m=>m.type==='rumor').length,5);assert.equal(g.world.filter(m=>m.type==='verification').length,5);
 }
});
test('all strategies are executable across held-out seeds, no score derives from action count',()=>{
 const policies=[()=>WAIT,(g)=>({id:'A01',target:1,scale:1}),()=>({id:'A05',target:1,scale:1}),g=>({id:g.round===1?'A08':'A12'}),g=>({id:g.round===1?'A10':g.round===2?'A11':'A03',target:1,scale:1})];
 for(let seed=200;seed<220;seed++)for(const policy of policies){const g=play(`holdout-${seed}`,'P03',policy);assertInvariants(g);assert.ok(g.companies.every(c=>c.score>=0&&c.score<=1000));}
});
