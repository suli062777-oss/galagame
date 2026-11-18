import {buildGodInput,validateHostOutput} from '../worker/god-contract.js';
import {EVENTS} from '../worker/engine.js';
const event=EVENTS.find(e=>e.visibility==='public'),base={round:1,phase:'decision',product:{id:'P01'},players:[{seat:0,score:30,users:450,cash:1200,profit:0,rank:2},{seat:1,score:40,users:900,cash:800,profit:0,rank:1}]};
const input=buildGodInput({...base,world:[{round:1,type:'rumor',text:`下一轮可能出现「${event.name}」。消息尚未核实，不保证成真。`}]});
for(const [name,value] of [
 ['false-sum',{kind:'fact',claimIds:['P0','P1'],knowledgeIds:['K13'],tone:'calm',narration:'两家公司合计900名有效用户[P0][P1]。公开事实与尚待核验的说法，需要分开作为判断依据[K13]。'}],
 ['false-shared-metric',{kind:'fact',claimIds:['P0','P1'],knowledgeIds:['K13'],tone:'calm',narration:'席位1和席位2的有效用户均为900[P0][P1]。公开事实与尚待核验的说法，需要分开作为判断依据[K13]。'}],
 ['true-public-rumor-name',{kind:'rumor',claimIds:['W0'],knowledgeIds:['K13'],tone:'calm',narration:`关于${event.name}的说法仍是未核实传闻，暂时保留不确定性[W0]。公开事实与尚待核验的说法，需要分开作为判断依据[K13]。`}]
]){try{validateHostOutput(value,input,{requireNatural:true});console.log(name+': ACCEPTED');}catch(error){console.log(name+': REJECTED '+error.message);}}
