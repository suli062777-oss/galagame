/** Reproducible strategy smoke/sensitivity study; scripts, not human or LLM agents. */
import fs from 'node:fs';
import {createGame,beginRound,settle,normalizeAction,scoreCompany,rankings,PRODUCTS,ACTIONS,WAIT} from '../server/engine.js';
const names=['获客','留存','低成本盈利','研究适应','混合','随机合法','等待','终局冲刺'];
function pick(seed,round,seat,n){let x=seed*1103515245+round*12345+seat*1013904223;return((x>>>0)%n);}
function policy(name,g,seat,seed){
 const c=g.companies[seat],p=PRODUCTS.find(p=>p.id===g.productId),r=g.round;
 const best=p.activation.map((v,j)=>v*p.retention[j]/p.organic_cpc[j]).reduce((b,v,j,a)=>v>a[b]?j:b,0);
 let id='A12',target=best,scale=1;
 if(name==='获客'){id=r%2?'A02':'A03';}
 if(name==='留存'){id=r===1?'A06':[2,4].includes(r)?'A05':'A03';}
 if(name==='低成本盈利'){id=r===1?'A08':[2,4].includes(r)?'A02':'A12';scale=id==='A02'?.5:1;}
 if(name==='研究适应'){
  id=r===1?'A10':r===2?'A11':r===3?((c.privateNotes.find(n=>n.type==='research')?.onboarding??0)>.8?'A04':'A02'):'A03';
 }
 if(name==='混合'){id=r===1?'A06':r===2?'A02':r===3?'A05':r===4?'A03':r===5?'A08':'A03';}
 if(name==='随机合法'){const def=ACTIONS[pick(seed,r,seat,ACTIONS.length)];id=def.id;target=pick(seed+3,r,seat,3);scale=def.scales[pick(seed+7,r,seat,def.scales.length)];}
 if(name==='终局冲刺'){id=r===6?'A03':'A12';scale=r===6?1.5:1;}
 try{return normalizeAction({id,target,scale},c.cash);}catch{return{...WAIT};}
}
const variants={base:{w:[.5,.35,.15],u:450,p:1200},growthPlus5:{w:[.55,.30,.15],u:450,p:1200},growthMinus5:{w:[.45,.40,.15],u:450,p:1200},retentionPlus5:{w:[.45,.35,.20],u:450,p:1200},retentionMinus5:{w:[.55,.35,.10],u:450,p:1200},profitToRetention5:{w:[.5,.30,.20],u:450,p:1200},retentionToProfit5:{w:[.5,.40,.10],u:450,p:1200},userRefMinus10:{w:[.5,.35,.15],u:405,p:1200},userRefPlus10:{w:[.5,.35,.15],u:495,p:1200},profitRefMinus10:{w:[.5,.35,.15],u:450,p:1080},profitRefPlus10:{w:[.5,.35,.15],u:450,p:1320}};
function rescored(c,v){if(c.bankrupt)return 0;const {inputs,retention}=scoreCompany(c),g=inputs.users/(inputs.users+v.u),f=.5+.5*c.profit/(Math.abs(c.profit)+v.p);return Math.floor((1000*(v.w[0]*g+v.w[1]*f+v.w[2]*retention))*100+.5+1e-9)/100;}
function winners(scores,cs){const alive=cs.map((c,i)=>({i,dead:c.bankrupt,s:scores[i]})).filter(x=>!x.dead),best=Math.max(...alive.map(x=>x.s));return alive.filter(x=>x.s===best).map(x=>x.i).join(',');}
const combos=[];for(let a=0;a<8;a++)for(let b=a+1;b<8;b++)for(let c=b+1;c<8;c++)for(let d=c+1;d<8;d++)combos.push([a,b,c,d]);
const result={ruleVersion:'growth-1.0.0',type:'scripted-strategy-study',seedRange:[400,419],independentWorldsPerProduct:20,combinations:70,seatRotations:4,note:'同一产品/seed的组合与换座是配对比较，不是新增独立随机世界；无调参，无真实Agent或真人。',products:{}};
for(const product of PRODUCTS){
 const report={games:0,strategies:Object.fromEntries(names.map(n=>[n,{entries:0,winCredit:0,wins:0,ties:0,bankrupt:0,totalScore:0,totalUsers:0,totalProfit:0,totalRetention:0}])),sensitivity:Object.fromEntries(Object.keys(variants).filter(k=>k!=='base').map(k=>[k,{changedWinnerSets:0,maxAbsoluteScoreChange:0}])),halves:{first:{games:0,winCredit:Object.fromEntries(names.map(n=>[n,0]))},heldout:{games:0,winCredit:Object.fromEntries(names.map(n=>[n,0]))}}};
 for(let seed=400;seed<420;seed++)for(const combo of combos)for(let rotation=0;rotation<4;rotation++){
  const seats=combo.map((_,i)=>names[combo[(i+rotation)%4]]),g=createGame({seed:`balance-${seed}`,productId:product.id});
  for(let r=0;r<6;r++){beginRound(g);settle(g,seats.map((name,seat)=>policy(name,g,seat,seed)));}
  const ranks=rankings(g),scores=g.companies.map(c=>c.score),baseWinners=winners(scores,g.companies),half=seed<410?'first':'heldout';report.games++;report.halves[half].games++;
  for(let i=0;i<4;i++){
   const c=g.companies[i],s=report.strategies[seats[i]],won=ranks.winners.includes(i),credit=won?1/ranks.winners.length:0;
   s.entries++;s.winCredit+=credit;s.wins+=won?1:0;s.ties+=won&&ranks.winners.length>1?1:0;s.bankrupt+=c.bankrupt?1:0;s.totalScore+=c.score;s.totalUsers+=c.inputs.users;s.totalProfit+=c.profit;s.totalRetention+=c.retention;report.halves[half].winCredit[seats[i]]+=credit;
  }
  for(const[k,v]of Object.entries(variants)){if(k==='base')continue;const score=g.companies.map(c=>rescored(c,v)),s=report.sensitivity[k];s.changedWinnerSets+=winners(score,g.companies)!==baseWinners?1:0;s.maxAbsoluteScoreChange=Math.max(s.maxAbsoluteScoreChange,...score.map((n,i)=>Math.abs(n-scores[i])));}
 }
 for(const s of Object.values(report.strategies)){s.winRate=s.winCredit/s.entries;s.averageScore=s.totalScore/s.entries;s.averageRecentUsers=s.totalUsers/s.entries;s.averageProfit=s.totalProfit/s.entries;s.averageRetention=s.totalRetention/s.entries;delete s.totalScore;delete s.totalUsers;delete s.totalProfit;delete s.totalRetention;}
 for(const s of Object.values(report.sensitivity))s.changedRate=s.changedWinnerSets/report.games;
 result.products[product.id]={name:product.name,...report};console.log(product.name,report.games,Object.entries(report.strategies).map(([n,s])=>`${n}:${(s.winRate*100).toFixed(1)}%`).join(' '));
}
fs.writeFileSync(new URL('../docs/BALANCE_RESULTS.json',import.meta.url),JSON.stringify(result,null,2));
let md='# 规则与策略验证（脚本，不是真实Agent）\n\n版本growth-1.0.0。`node tests/balance.mjs`可重现。3产品×20固定世界种子×70种四策略组合×4换座，共16800场。独立产品/种子世界仅60个；换座与策略组合是配对比较，不增加独立样本量。未根据本次结果调参；400–409为首半、410–419为保留种子复测。\n\n所有策略只读自身私有信息和产品公开基线。研究适应先调研、后实验，再按带误差线索决策；实验不会自动部署或送分。随机策略仅从合法行动/档位选择。经营数字是假设群体模型，不是真实商业预测。\n\n';
for(const r of Object.values(result.products)){
 md+=`## ${r.name}\n\n|策略|分摊并列冠军的胜率|平均综合分|平均末三轮用户|平均累计利润|平均留存|破产次数|\n|---|---:|---:|---:|---:|---:|---:|\n`;
 for(const[n,s]of Object.entries(r.strategies))md+=`|${n}|${(s.winRate*100).toFixed(2)}%|${s.averageScore.toFixed(2)}|${s.averageRecentUsers.toFixed(1)}|${s.averageProfit.toFixed(2)}|${(s.averageRetention*100).toFixed(1)}%|${s.bankrupt}|\n`;
 md+='\n权重/基准只在同一批账本重算，不是另跑新对局。\n\n|重算变体|冠军集合变化|最大单公司分差|\n|---|---:|---:|\n';
 for(const[k,s]of Object.entries(r.sensitivity))md+=`|${k}|${(s.changedRate*100).toFixed(2)}%|${s.maxAbsoluteScoreChange.toFixed(2)}|\n`;
 md+='\n';
}
md+='## 解读与限制\n\n胜率的分母是该策略参赛次数，并列冠军按1/人数分摊；不是要求八策略均为12.5%或四策略均25%。研究需要先付出短局成本且有效期只有6周，低成本盈利偏保守，结果须结合上表，不能把公式正确等同竞技平衡。实验策略名称不代表所有可能的实验策略；表现弱不能推出“研究无价值”。保留种子未做调参，但只有20种随机世界/产品，仍需要真实Agent、真人理解与更广策略搜索。\n\n初始综合分为0并显示“待首轮结算”；历史旧版规模/利润副榜已移除，排名只比较当前公开两位综合分；同分并列。财务逐笔两位小数结算，现金<0破产无浮点透支。参数冻结在局创建时的规则版本，v1尚无在线调参入口。\n';
fs.writeFileSync(new URL('../docs/BALANCE_REPORT.md',import.meta.url),md);
