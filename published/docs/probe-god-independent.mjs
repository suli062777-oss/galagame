import {buildGodInput,validateHostOutput} from '../worker/god-contract.js';
const input=buildGodInput({round:1,phase:'decision',product:{id:'P01'},players:[{seat:0,score:30,users:450,cash:1200,profit:0,rank:2},{seat:1,score:40,users:900,cash:800,profit:0,rank:1}],world:[{round:1,type:'rumor',text:'下一轮或许有内容触达机会，但仍待核验。'},{round:1,type:'forecast',text:'公开预告：下一轮可能有流量变化。'}]});
const cases=[
 ['metric-first-seat','fact',['P0','P1'],'第一席的有效用户为900[P0][P1]。'],
 ['metric-adverb','fact',['P0','P1'],'席位1现在的有效用户为900[P0][P1]。'],
 ['winner-paraphrase','fact',['P0'],'席位1已经拿下了这局胜利[P0]。'],
 ['rumor-verified-paraphrase','rumor',['W0'],'这条未核实传闻现在已经核实落地[W0]。'],
 ['forecast-realized-paraphrase','trend',['W1'],'这条预告的变化如今已经兑现[W1]。'],
 ['host-authority-paraphrase','fact',['P0'],'本轮由主持替席位1完成下单操作[P0]。'],
 ['private-paraphrase','fact',['P0'],'席位1的研究说明，备考新手更偏好新增引导[P0]。'],
 ['unreleased-action-paraphrase','fact',['P0'],'席位1刚刚完成了用户调研[P0]。']
];
const results=cases.map(([name,kind,claimIds,sentence])=>{const value={kind,claimIds,knowledgeIds:['K13'],tone:'calm',narration:sentence+'公开事实与尚待核验的说法，需要分开作为判断依据[K13]。'};try{validateHostOutput(value,input,{requireNatural:true});return {name,accepted:true,narration:value.narration};}catch(error){return {name,accepted:false,reason:error.message};}});
console.log(JSON.stringify(results,null,2));
