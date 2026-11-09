/** Bounded counterstrategy study. No production parameters changed. */
import fs from 'node:fs';
import {createGame,beginRound,settle,normalizeAction,rankings,scoreCompany,PRODUCTS,WAIT} from '../server/engine.js';
const names=['旧获客交替','推荐高档','机会留存','线索留存','推荐标准','内容高档'];
function legal(c,a){try{return normalizeAction(a,c.cash);}catch{return{...WAIT};}}
function policy(name,g,seat){
 const c=g.companies[seat],p=PRODUCTS.find(p=>p.id===g.productId),round=g.round;
 const activeEvents=g.starts.filter(e=>e.start<=round&&e.end>=round),demand=activeEvents.some(e=>['E01','E12'].includes(e.id))?1.4:activeEvents.some(e=>e.id==='E17')?.85:1;
 const target=p.activation.map((n,j)=>(n+c.onboard[j]+c.quality)*(j===0?demand:1)).reduce((best,n,j,a)=>n>a[best]?j:best,0);
 let id='A03',scale=1.5,t=target;
 if(name==='推荐第二群'){t=p.activation.map((a,i)=>({a,i})).sort((a,b)=>b.a-a.a)[1].i;}
 if(name==='竞争避让'&&g.history.length){
  const prev=g.history.at(-1).players,ownUsers=c.active.reduce((a,b)=>a+b,0);
  const expected=p.activation.map((act,j)=>{
   const exposure=j===0?demand:1;
   const own=ownUsers*.55*1.5*(act+c.onboard[j]+c.quality)*exposure;
   const competing=prev.filter(d=>d.seat!==seat&&d.action.id==='A03'&&d.action.target===j).reduce((sum,d)=>sum+d.users*.55*d.action.scale*act*exposure,0);
   const retained=prev.reduce((sum,d)=>sum+d.activeBySegment[j]*p.retention[j],0),available=Math.max(0,p.market[j]-retained);
   return own*Math.min(1,available/(own+competing));
  });t=expected.reduce((best,n,j,a)=>n>a[best]?j:best,0);
 }

 if(name==='旧获客交替'){id=round%2?'A02':'A03';scale=1;t=p.activation.map((v,j)=>v*p.retention[j]/p.organic_cpc[j]).reduce((b,v,j,a)=>v>a[b]?j:b,0);}
 if(name==='推荐标准')scale=1;
 if(name==='内容高档')id='A02';
 if(name==='机会留存'){
  // Public/current own-state planning: compare bounded guaranteed quality gain
  // with referral's expected immediate users; use quality only if 3+ weeks remain.
  const old=c.active.reduce((a,b)=>a+b,0),marginalQuality=old*.0375*(7-round);
  const referral=old*.55*1.5*(p.activation[target]+c.onboard[target]+c.quality);
  if(round<=3&&c.quality<.08&&marginalQuality>referral*.75)id='A06';
 }
 if(name==='线索留存'){
  const researchTarget=p.retention.indexOf(Math.min(...p.retention));
  if(round===1){id='A10';t=researchTarget;scale=1;}
  else if(round===2&&(c.privateNotes.find(n=>n.type==='research')?.habit??0)>.6){id='A05';t=researchTarget;}
 }
 return legal(c,{id,target:t,scale});
}
const results={type:'bounded-counterstrategy-study',ruleVersion:'growth-1.0.0',seeds:{development:[700,719],heldout:[800,819]},productionParametersChanged:false,products:{}};
for(const product of PRODUCTS){const report={comparisons:[],selfPlay:[]};
 for(const candidate of names.slice(1))for(const group of ['development','heldout']){
  const start=group==='development'?700:800;let wins=0,ties=0,score=0,baselineWins=0;
  for(let seed=start;seed<start+20;seed++)for(let rotation=0;rotation<4;rotation++){
   const lineup=['旧获客交替','旧获客交替','旧获客交替',candidate],seats=lineup.map((_,i)=>lineup[(i+rotation)%4]),g=createGame({seed:`counter-${seed}`,productId:product.id});
   for(let r=0;r<6;r++){beginRound(g);settle(g,seats.map((n,i)=>policy(n,g,i)));}
   const winners=rankings(g).winners,candidateSeat=seats.indexOf(candidate);wins+=winners.includes(candidateSeat)?1/winners.length:0;ties+=winners.includes(candidateSeat)&&winners.length>1?1:0;baselineWins+=winners.some(i=>i!==candidateSeat)?1:0;score+=g.companies[candidateSeat].score;
  }
  report.comparisons.push({candidate,group,games:80,winCredit:wins,winRate:wins/80,ties,averageScore:score/80,baselineWinnerGames:baselineWins});
 }
 for(const name of names){let score=0,users=0,profit=0;for(let seed=800;seed<810;seed++){const g=createGame({seed:`self-${seed}`,productId:product.id});for(let r=0;r<6;r++){beginRound(g);settle(g,[0,1,2,3].map(i=>policy(name,g,i)));}for(const c of g.companies){score+=c.score;users+=c.inputs.users;profit+=c.profit;}}report.selfPlay.push({strategy:name,games:10,averageScore:score/40,averageRecentUsers:users/40,averageProfit:profit/40});}
 results.products[product.id]={name:product.name,...report};
 console.log(product.name,report.comparisons.filter(x=>x.group==='heldout').map(x=>`${x.candidate}:${(100*x.winRate).toFixed(1)}%`).join(' '));
}
results.targetCounterStudy={opponents:'3名推荐高档，使用最高即时激活目标',products:{}};
for(const product of PRODUCTS){const report=[];for(const candidate of ['推荐第二群','竞争避让'])for(const group of ['development','heldout']){
 const start=group==='development'?700:800;let games=0,winCredit=0,score=0;
 for(let seed=start;seed<start+20;seed++)for(let rotation=0;rotation<4;rotation++){
  const lineup=['推荐高档','推荐高档','推荐高档',candidate],seats=lineup.map((_,i)=>lineup[(i+rotation)%4]),g=createGame({seed:`target-counter-${seed}`,productId:product.id});
  for(let r=0;r<6;r++){beginRound(g);settle(g,seats.map((name,i)=>policy(name,g,i)));}
  const winners=rankings(g).winners,seat=seats.indexOf(candidate);games++;if(winners.includes(seat))winCredit+=1/winners.length;score+=g.companies[seat].score;
 }
 report.push({candidate,group,games,winCredit,winRate:winCredit/games,averageScore:score/games});
}results.targetCounterStudy.products[product.id]=report;}
// Load coefficient variants only in memory; the production source stays unchanged.
results.parameterStudy={productionChanged:false,lineup:['推荐高档','旧获客交替','线索留存','内容高档'],variants:{}};
const source=fs.readFileSync(new URL('../server/engine.js',import.meta.url),'utf8');
for(const coefficient of [.55,.45,.35,.2,.15]){
 const engine=coefficient===.55?{createGame,beginRound,settle,rankings}:await import('data:text/javascript;base64,'+Buffer.from(source.replace('oldTotal*.55*s','oldTotal*'+coefficient+'*s')).toString('base64'));
 const report={};
 for(const product of PRODUCTS){report[product.id]={};for(const group of ['development','heldout']){
  const start=group==='development'?700:800,stats=Object.fromEntries(results.parameterStudy.lineup.map(n=>[n,{winCredit:0,averageScore:0}]));let games=0;
  for(let seed=start;seed<start+20;seed++)for(let rotation=0;rotation<4;rotation++){
   const lineup=results.parameterStudy.lineup,seats=lineup.map((_,i)=>lineup[(i+rotation)%4]),g=engine.createGame({seed:`variant-${seed}`,productId:product.id});
   for(let r=0;r<6;r++){engine.beginRound(g);engine.settle(g,seats.map((n,i)=>policy(n,g,i)));}
   const winners=engine.rankings(g).winners;games++;for(let i=0;i<4;i++){stats[seats[i]].averageScore+=g.companies[i].score;if(winners.includes(i))stats[seats[i]].winCredit+=1/winners.length;}
  }
  for(const stat of Object.values(stats)){stat.winRate=stat.winCredit/games;stat.averageScore/=games;}
  report[product.id][group]={games,stats};
 }}
 results.parameterStudy.variants[coefficient]=report;
}
fs.writeFileSync(new URL('../docs/COUNTER_STRATEGIES.json',import.meta.url),JSON.stringify(results,null,2));
let md='# 有界反制策略研究\n\n`node tests/counter-strategies.mjs`复现。未修改生产参数或50/35/15权重。每个候选面对三名旧“获客交替”(A02/A03×1)；每产品20开发seed＋20保留seed，各4次换座，5候选，共2400场；另180场同策略自博弈。换座是配对对照。策略只读自身状态、私有调研和已公开事件，不用隐藏响应。\n\n候选：推荐高档(A03×1.5)、推荐标准(A03×1)、内容高档(A02×1.5)、机会留存(以剩余周数比较确定核心价值改进与推荐回报，其他时间A03×1.5)、线索留存(先调研，正向习惯估计足够才改习惯，其后A03×1.5)。访谈噪声可能误导，不把估计当真值。\n\n';
for(const r of Object.values(results.products)){
 md+=`## ${r.name}\n\n|反制候选|开发seed条件胜率|保留seed条件胜率|保留平均综合分|\n|---|---:|---:|---:|\n`;
 for(const name of names.slice(1)){const a=r.comparisons.find(x=>x.candidate===name&&x.group==='development'),b=r.comparisons.find(x=>x.candidate===name&&x.group==='heldout');md+=`|${name}|${(100*a.winRate).toFixed(2)}%|${(100*b.winRate).toFixed(2)}%|${b.averageScore.toFixed(2)}|\n`;}
 md+='\n|同策略自博弈|平均综合分|末三轮用户均值|累计利润均值|\n|---|---:|---:|---:|\n';for(const s of r.selfPlay)md+=`|${s.strategy}|${s.averageScore.toFixed(2)}|${s.averageRecentUsers.toFixed(1)}|${s.averageProfit.toFixed(2)}|\n`;md+='\n';
}
md+='## 共享市场的目标反制\n\n对手改为3名连续高档推荐（每轮挑最高即时激活目标）。竞争避让只根据上轮公开行动、公开各群活跃与容量估计拥挤，假定对手短期重复行动；不读取对手下一步或隐藏参数。第二人群方案固定转向基线激活次高群体，是可见的有代价取舍。\n\n|产品|候选|开发胜率|保留胜率|\n|---|---|---:|---:|\n';
for(const p of PRODUCTS)for(const candidate of ['推荐第二群','竞争避让']){const r=results.targetCounterStudy.products[p.id],a=r.find(x=>x.candidate===candidate&&x.group==='development'),b=r.find(x=>x.candidate===candidate&&x.group==='heldout');md+=`|${p.name}|${candidate}|${(100*a.winRate).toFixed(2)}%|${(100*b.winRate).toFixed(2)}%|\n`;}
md+='\n这个对照960场，换座不增加独立世界。它显示固定最高激活目标的连续推荐也存在反制；三人追逐同一群体时，较低激活但更空的人群可能获得更高最终规模。不能据此断言竞争避让也普遍最优。\n\n';
md+='## 推荐系数的内存对照（未改生产）\n\n固定四策略：推荐高档、旧获客交替、线索留存、内容高档。下列为保留seed中推荐高档的条件胜率。每个系数3产品×40seed×4换座=480场；5系数共2400场，仍是配对比较。\n\n|系数|学习打卡|健身习惯|AI笔记|\n|---|---:|---:|---:|\n';
for(const [coefficient,r]of Object.entries(results.parameterStudy.variants))md+=`|${coefficient}|${PRODUCTS.map(p=>(100*r[p.id].heldout.stats['推荐高档'].winRate).toFixed(2)+'%').join('|')}|\n`;
md+='\n单独降系数不保证所有策略等强；应查看JSON内所有策略胜率与平均分。0.55是本次生产值，其他仅在内存加载模型后重算完整经营。\n\n';
md+='## 判断\n\n旧获客交替在前一轮八策略组里胜率高，并不构成“无条件主导”的证明。投入、目标与时机都能改变对局；上表存在直接反制，不能用弱脚本占比推出必须改权重。另一方面，高档推荐的滚动接触量与已有总活跃成正比，可能形成正反馈；当前短局对研究与低成本策略仍较苛刻。此次不改生产参数，保留模型透明性。参数对照显示0.45、0.35、0.20均未改变原四策略组的高档推荐胜率，不能推荐小降系数为已验证改进；0.15会明显改写产品差异，尚无足够依据采用。目标反制已显示共享市场中存在更有意义的响应，因此保持生产0.55与50/35/15；下一步应验证真人能否理解和利用竞争信息，若仍单调再研究公开渠道疲劳等单一机制。\n';
fs.writeFileSync(new URL('../docs/COUNTER_STRATEGIES.md',import.meta.url),md);
