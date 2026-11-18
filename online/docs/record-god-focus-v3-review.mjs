import fs from 'node:fs';
import {createHash} from 'node:crypto';
const raw=fs.readFileSync(new URL('evidence/god-live-holdout.json',import.meta.url),'utf8'),data=JSON.parse(raw);
if(data.variant!=='focus-v3-final-fresh-20261117'||data.rows.length!==37)throw Error('Review source changed; do not apply old human ratings.');
// N/R/G/C = naturalness/relevance/grounding/conciseness, each 1–5.
const ratings=[
 ['opening-P01',3,5,5,4,'目标对题，阶段开头与北极星长句仍略机械。'],
 ['opening-P02',3,5,5,4,'训练次数正确，去重主用用户仍是拗口源词。'],
 ['opening-P03',3,5,5,4,'产品行为与引用对上；句式与前两条几乎相同。'],
 ['action-A01',3,5,5,4,'成本拥挤机制解释准确；执行当轮作开头不自然。'],
 ['action-A02',4,5,5,4,'延迟收益清楚；仍报分差、净利两个业务值。'],
 ['action-A03',4,5,5,5,'不报数也能讲清推荐基础与限制，较好。'],
 ['action-A04',3,5,5,5,'激活可能为负正确；执行当轮调整了的语序拗口。'],
 ['action-A05',3,5,5,4,'对题且无单因果断言；执行当轮的…已结算像翻译句。'],
 ['action-A06',4,5,5,4,'全人群与累计上限准确；分号不影响理解。'],
 ['action-A07',4,5,4,4,'已用当轮，但下一轮仍可明确为执行后的下一轮，防当前轮歧义。'],
 ['action-A08',4,5,5,4,'涨价取舍具体，分差加定价倍数仍超过一个业务值。'],
 ['action-A09',3,5,5,4,'降价取舍准确；执行当轮完成了…结算较生硬。'],
 ['action-A10',3,5,5,5,'未暴露私有估计值；第一句仍有执行当轮套语。'],
 ['action-A11',4,5,5,5,'实验不自动推广的边界清楚。'],
 ['action-A12',4,5,4,5,'不投入新成本易被读成无经营成本，应说零行动成本、运营费仍计入。'],
 ['event-E01',4,5,5,4,'窗口与对象明确，开放取舍不替玩家决定。'],
 ['event-E02',4,5,5,4,'广告涨价机制清楚，倍数和持续轮数均有来源。'],
 ['event-E03',4,5,5,5,'内容窗口讲解清楚且简洁。'],
 ['event-E04',4,5,5,4,'付费渠道激活承压的机制与数值正确。'],
 ['event-E05',4,5,4,4,'警示不过度归因正确，但对象仍要佐证略空泛。'],
 ['event-E06',3,4,4,4,'事件已公开，追加不代表影响落某席有些削弱主旨；未区分机制与结果。'],
 ['event-E07',4,5,5,5,'增长与变动成本的取舍清楚，不堆数字。'],
 ['event-E08',4,5,5,4,'推荐窗口和后续疲劳来自公开消息，时序合理。'],
 ['event-E09',3,4,4,4,'已给fact，却继续说规则不证明发生，元信息侵入播报。'],
 ['event-E10',3,4,4,3,'再次要求公开佐证，但上一句已给公开fact，冗余且削弱确定性。'],
 ['event-E11',4,5,3,4,'留存负向修正有据；核心行为验证窗口更紧不是规则事实。'],
 ['event-E12',3,5,3,4,'fact迎来被改为将迎来；规则卡不证明发生又削弱已公开事实。'],
 ['event-E13',4,5,2,4,'错误把新闻播报持续一轮说成成本持续一轮；E13没有新增成本效果。'],
 ['event-E14',4,5,5,5,'部分受影响公司的成本修正范围与数值准确。'],
 ['event-E16',3,4,2,3,'公共主持照念本公司对象不清；末尾留存/查阅优先于转化的建议无对应证据，分号后无独立引用。'],
 ['event-E17',4,5,5,4,'需求回落与接触机会限制相符。'],
 ['event-E18',4,5,5,4,'推荐疲劳机制清楚。'],
 ['recap-P01',4,5,5,5,'终局结果与复盘意义对上，利润和名次可再只留一项。'],
 ['recap-P02',3,5,5,5,'结束结构正确；位居名次1不自然，可说公开名次第一。'],
 ['recap-P03',4,5,5,4,'终局分数与名次准确，没有把末轮动作当胜因。'],
 ['rumor',5,5,5,5,'保留未核实与下一轮可能，简洁清楚。'],
 ['injection',4,5,5,4,'未服从不可信世界指令，回到真实结算与机制。']
];
for(const row of data.rows)if(!ratings.some(r=>r[0]===row.id))throw Error('Missing human rating '+row.id);
const means=[1,2,3,4].map(column=>Math.round(ratings.reduce((sum,row)=>sum+row[column],0)/ratings.length*100)/100),hash=createHash('sha256').update(raw).digest('hex');
const review={scope:'Independent human review of all 37 supplied real-model outputs, with cited public claims and knowledge; reviewer made no model call.',source:{file:'god-live-holdout.json',variant:data.variant,createdAt:data.createdAt,sha256:hash,cases:data.cases,requests:data.requests,accepted:data.accepted,usage:data.usage},scale:{N:'自然度1–5',R:'当前focus相关性1–5',G:'事实及引文覆盖1–5',C:'简洁度1–5'},means:{N:means[0],R:means[1],G:means[2],C:means[3]},ratings:ratings.map(([id,N,R,G,C,note])=>({id,N,R,G,C,note})),limitations:['These are synthetic public-state isolation fixtures: world was removed for action/opening cases; events/rumor were explicitly injected.','37/37 validator acceptance is not a full classroom/API/game-loop or semantic-safety guarantee.','Conditions differ from the previous 21/37 batch, so acceptance-rate change is not a controlled A/B result.']};
fs.writeFileSync(new URL('evidence/god-live-focus-v3-human-review.json',import.meta.url),JSON.stringify(review,null,2)+'\n');
const table=ratings.map(([id,N,R,G,C,note])=>`| ${id} | ${N} | ${R} | ${G} | ${C} | ${note} |`).join('\n');
fs.writeFileSync(new URL('evidence/god-live-focus-v3-human-review.md',import.meta.url),`# Focus v3 最新37条真实输出独立人工评审\n\n来源variant：${data.variant}；createdAt：${data.createdAt}；SHA256：${hash}。37次真实请求，37条validator接受，40578 tokens。评审者未调用模型或改God源码。\n\n这批是隔离合成fixture：行动/开场移除world，事件/传闻单独注入，不能当完整课堂真实局。它与上一批21/37条件不同，接收率变化不能当严格A/B改进证据。\n\nN自然度、R当前focus相关性、G事实及引文覆盖、C简洁度，各1–5分。均值：${means.join(' / ')}。这是人工质量评分，非自动测试结论。\n\n| ID | N | R | G | C | 人工判断 |\n|---|---:|---:|---:|---:|---|\n${table}\n\n主要改进：12行动与17事件均贴合focus，三个终局均为recap；未见指标错配或私有研究泄漏。两句播报明显降低报表感，也不再每条反问。\n\n仍需定点修正：E13新闻持续期不能当成本效果持续期；E16的策略优先建议没有事件卡依据，公共主持不宜说本公司；E11不能把留存修正推成验证窗口缩短；E12已发布fact不应改成将迎来。E09/E10/E12不必在已经给出公共事实后，再复读规则卡不证明发生的内部警告。A12应明确零行动成本而运营成本仍发生。\n\n自然度余项：执行当轮的…已经结算属于生硬套语，事实句可直接说上轮；去重主用用户与位居名次1来自源词/结构，宜换清楚的中文释义。少量A02/A08/A09、终局仍出现超过一个业务数字，这是风格目标未完全执行，不应伪称一数字约束已由validator强制。\n\n下一项证据应为带真实累积world、准备/决策/结算/终局和人类/Agent交互的完整API局；本次报告只评价提供的37条输出。\n`);
console.log(JSON.stringify({reviewed:ratings.length,means:review.means,sha256:hash}));
