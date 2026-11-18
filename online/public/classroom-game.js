const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>Number(value||0).toLocaleString('zh-CN',{maximumFractionDigits:2});
const fixed=value=>Number(value||0).toFixed(2);
const own=s=>s.players?.find(p=>p.id===s.me?.id);
const ownLedger=(s,h)=>h?.players?.find(p=>p.seat===own(s)?.seat||p.id===s.me?.id);
const finite=value=>typeof value==='number'&&Number.isFinite(value);

export const actionGroups=[
 {id:'acquire',name:'找到新用户',actions:['A01','A02','A03']},
 {id:'experience',name:'激活与留存',actions:['A04','A05','A06']},
 {id:'revenue',name:'定价与收益',actions:['A07','A08','A09']},
 {id:'learn',name:'研究与观察',actions:['A10','A11','A12']}
];
const actionNotes={
 A01:['增加接触机会','投放拥挤会影响成本；触达不等于有效使用。'],
 A02:['用内容吸引用户','部分效果在下一轮出现，最后一轮需考虑时间窗口。'],
 A03:['让现有用户带来推荐','机会与上轮有效用户有关，基础规模也很重要。'],
 A04:['改善第一次体验','对不同人群的响应不同，也可能出现负响应。'],
 A05:['帮助用户持续回来','影响留存；不同人群的响应不同，也有累计边界。'],
 A06:['改善产品核心价值','同时影响激活与留存，作用于所有人群，有累计上限。'],
 A07:['在付费与收入之间取舍','本轮单价与付费概率变化，也会影响下一轮。'],
 A08:['提高单次收入','付费概率与留存也会变化，不能只看价格上升。'],
 A09:['降低用户付费门槛','价格下降与付费概率、留存共同作用，不能保证利润提高。'],
 A10:['了解一个目标人群','获得带误差的估计，不直接获得增长奖励。'],
 A11:['用小样本比较引导','独立样本结果不自动推广，也不是本局增长的保证。'],
 A12:['保留当前产品与定价','没有新行动费用，仍正常发生经营成本与市场变化。']
};

export function missionMarkup(s){
 const product=s.product||{},rules=s.rules||{},weights=rules.weights||{};
 const names={growth:'规模',profit:'累计利润',retention:'留存'};
 const score=Object.entries(names).filter(([key])=>finite(weights[key])).map(([key,name])=>`${name} ${Math.round(weights[key]*100)}%`).join(' · ');
 const me=own(s);
 return `<section class="classroom-mission" aria-labelledby="mission-title"><div class="mission-heading"><span>本局任务</span><h2 id="mission-title">经营${esc(product.name||'本局产品')}</h2></div><dl><div><dt>让用户获得价值</dt><dd>${esc(product.coreBehavior||'完成产品的核心行为。')}</dd></div><div><dt>怎样算有效用户</dt><dd>${esc(product.northStar||'以本局公开规则中的核心行为口径为准。')}</dd></div></dl><details class="mission-rules"><summary>六轮后，怎样比较经营表现？</summary><p>${score?esc(score):'按本局绑定规则中的综合分比较。'}，同分并列；破产归零。</p><p>每席各自经营公司，共享同一个市场。相同起点不代表每次选择都有相同结果。</p><button class="quiet-button" data-action="rules">查看本局完整规则</button></details><p class="mission-next">你在第 ${(me?.seat??0)+1} 席 · ${s.hostId===s.me?.id?'你是房主，人齐后开始。':'等房主开始，先看看产品和操作样例。'} 可以全程手动，Agent 可选。</p><button class="quiet-button" data-action="action-sample">看一个操作样例 <span aria-hidden="true">→</span></button></section>`;
}

export function actionOptions(catalog,selected){
 const known=new Set(actionGroups.flatMap(g=>g.actions));
 return actionGroups.map(g=>`<optgroup label="${g.name}">${catalog.filter(a=>g.actions.includes(a.id)).map(a=>`<option value="${esc(a.id)}" ${a.id===selected?'selected':''}>${esc(a.name)}</option>`).join('')}</optgroup>`).join('')+catalog.filter(a=>!known.has(a.id)).map(a=>`<option value="${esc(a.id)}" ${a.id===selected?'selected':''}>${esc(a.name)}</option>`).join('');
}

export function actionPurposeMarkup(){return `<details class="action-purpose"><summary>比较十二种行动</summary><div>${actionGroups.map(g=>`<button type="button" data-action="action-guide" data-group="${g.id}">${g.name}</button>`).join('')}</div><p>先判断问题，再选行动。默认草稿不是推荐，确认后才会提交。</p></details>`;}

export function actionGuideMarkup(catalog,groupId,{sample=false}={}){
 const groups=actionGroups.filter(g=>!groupId||g.id===groupId);
 return `<div class="classroom-action-guide">${sample?'<p>这里是等待时的操作样例，不会提交或计入成绩。</p>':'<p>以下是当前规则的行动范围。费用是标准档基础成本，完整机制可以展开核对。</p>'}${groups.map(g=>`<section><h3>${g.name}</h3>${catalog.filter(a=>g.actions.includes(a.id)).map(a=>{const [purpose,tradeoff]=actionNotes[a.id]||['查看本局规则','效果以公开规则为准。'];return `<article><div class="action-guide-heading"><h4>${esc(a.name)}</h4><span>${number(a.cost)} 标准费用</span></div><p>${purpose}</p><p class="muted">${tradeoff}</p><details><summary>完整机制</summary><p>${esc(a.effect||'')}</p></details>${!sample?`<button type="button" class="quiet-button" data-action="choose-action" data-id="${esc(a.id)}">选择这个行动 →</button>`:''}</article>`;}).join('')}</section>`).join('')}${sample?'<div class="action-sample"><h3>确认前，核对三件事</h3><ol><li>选择行动：它处理哪个问题？</li><li>选择目标与投入：费用是否在预算内？</li><li>点击确认：看到服务端“已接收”，才算提交。</li></ol><p>正式每轮 45 秒，截止前可更新。没有确认的默认草稿不会自动执行；超时采用你已保存的合法默认，否则等待。</p></div>':''}</div>`;
}

export function evidenceMarkup(s,{round=s.round,compact=false}={}){
 const available=(s.world||[]).filter(w=>Number(w.round||0)<=Number(round));
 const current=available.filter(w=>w.round===round||Number(w.endRound)>=round);
 const items=(current.length?current:available).slice().reverse();
 const definitions=[['fact','已确认'],['forecast','有限预告'],['rumor','尚未核实'],['verification','本轮核验']];
 const rows=definitions.map(([type,label])=>{const entry=items.find(w=>w.type===type);if(!entry)return '';const text=compact&&entry.text.length>115?entry.text.slice(0,115)+'…':entry.text;return `<div class="evidence-line evidence-${type}"><b>${label}</b><p>${esc(text)}</p></div>`;}).filter(Boolean);
 return rows.length?rows.slice(0,compact?2:4).join(''):`<p class="evidence-empty">${s.phase==='lobby'?'开局后发布公开情报。':'本轮没有新的公开消息，可以查看已公开历史。'}</p>`;
}

export function actionContextMarkup(s){return `<details class="action-context"><summary>选行动时，回看本轮情报</summary>${evidenceMarkup(s)}<button type="button" class="quiet-button" data-action="open-panel" data-panel="world">查看完整公开情报</button></details>`;}

function metric(label,value){return `<div><dt>${label}</dt><dd>${value}</dd></div>`;}
export function roundSummaryMarkup(s){
 const h=s.history?.at(-1),r=ownLedger(s,h);if(!h||!r||s.phase==='finished')return '';
 return `<section class="classroom-round-summary"><div class="round-summary-heading"><h2>第 ${h.round} 轮已结算</h2><button class="quiet-button" data-action="review-round" data-round="${h.round}">回看这轮 →</button></div><dl>${metric('综合分变化',`${Number(r.delta)>=0?'+':''}${fixed(r.delta)}`)}${metric('有效用户',number(r.users))}${metric('本轮净利润',number(r.net))}</dl><p>已按真实账本记录。结果同时受行动、市场竞争与事件影响，一次变化不能单独证明行动效果。</p></section>`;
}

export function roundReviewMarkup(s,round,catalog=[]){
 const history=(s.history||[]).find(h=>h.round===Number(round)),r=ownLedger(s,history);
 if(!r)return '<p>这轮还未结算，结算后可以回看。</p>';
 const action=catalog.find(a=>a.id===r.action?.id);
 const before=finite(r.previousUsers)?number(r.previousUsers):'—';
 const current=number(r.users);
 const world=(s.world||[]).filter(w=>Number(w.round||0)<=history.round).filter(w=>w.round===history.round||Number(w.endRound)>=history.round);
 return `<section class="round-review" data-review-round="${history.round}"><div class="round-review-heading"><span>第 ${history.round} 轮 · 你的实际行动</span><h3>${esc(action?.name||r.action?.id||'等待')}</h3></div><dl class="review-metrics">${metric('行动费用',number(r.actionCost))}${metric('有效用户',`${before} → ${current}`)}${metric('本轮净利润',number(r.net))}${metric('综合分',fixed(r.score))}</dl><details class="review-evidence"><summary>核对截至这一轮结算的公开记录</summary><p>以下只列截至第 ${history.round} 轮结算已公开的记录，可能包含结算后消息；不代表做决定前已经知道。后续轮次的核验不会列入。</p>${world.length?world.map(w=>`<div class="evidence-line evidence-${esc(w.type)}"><b>${({fact:'事实',forecast:'有限预告',rumor:'尚未核实',verification:'当轮核验'})[w.type]||'公开消息'}</b><p>${esc(w.text)}</p></div>`).join(''):'<p>这一轮没有额外公开消息，仍可核对实际行动与账本。</p>'}<p>留存用户 ${number(r.retained)} · 新增有效用户 ${number(r.newUsers)} · 结算前现金 ${number(r.cashBefore)} · 结算后现金 ${number(r.cash)}</p></details><p class="review-question">你当时根据什么做决定？哪些变化还不能归因于这次行动？</p><div class="round-review-actions"><button class="quiet-button" data-action="round-note" data-round="${history.round}">写下这一轮的判断 →</button>${action?`<button class="quiet-button" data-action="concept" data-concept="${esc(action.concept||'K06')}" data-round="${history.round}">看看相关增长方法</button>`:''}</div></section>`;
}

export function resultMarkup(s,selectedRound,catalog=[]){
 const p=own(s);if(!p)return '';
 const available=s.history||[];const selected=available.some(h=>h.round===Number(selectedRound))?Number(selectedRound):available.at(-1)?.round;
 const c=p.contributions||{};
 return `<section class="classroom-result" aria-labelledby="result-title"><header><span>已完成 ${available.length} / ${s.totalRounds||6} 轮 · 本局结果</span><h2 id="result-title">本局经营复盘</h2><div class="result-score"><strong>${fixed(p.score)}</strong><span>综合分 · 第 ${p.rank||'—'} 名</span></div><p>有效用户 ${number(Math.round(p.users))} · 累计利润 ${number(p.profit)} · ${s.mode==='practice'?'单人练习，另外三席为脚本':'四席共享市场'}</p></header>${p.bankrupt?'<p class="result-bankruptcy">本席已破产，综合分按规则归零。下列分项仅供核对，不相加作为最终分。</p>':''}<dl class="result-contributions">${metric('规模贡献',fixed(c.growth))}${metric('利润贡献',fixed(c.profit))}${metric('留存贡献',fixed(c.retention))}</dl><p class="result-score-note">分项来自本局实际规则与账本，同分并列；球面领地是分数可视化，不是真实市场份额。</p><div class="round-timeline-heading"><h3>选一轮，回看当时的决定</h3><button class="quiet-button" data-action="open-panel" data-panel="ledger">完整账本</button></div><div class="round-timeline" aria-label="已完成回合">${available.map(h=>{const row=ownLedger(s,h);return `<button type="button" data-action="select-review-round" data-round="${h.round}" aria-pressed="${h.round===selected}"><span>第 ${h.round} 轮</span><b>${fixed(row?.score)}</b><small>${Number(row?.delta)>=0?'+':''}${fixed(row?.delta)}</small></button>`;}).join('')}</div>${roundReviewMarkup(s,selected,catalog)}<div class="result-primary"><button class="button solid" data-action="save-review">整理这局复盘</button><a class="text-link" href="#/map">回到增长方法 →</a></div></section>`;
}

const concepts={
 K01:{title:'先看用户获得什么价值',chapter:'north-star',text:'北极星指标应对应用户真正获得的价值。增长前，先分清注册、触达与完成核心行为。'},
 K02:{title:'接触机会，不等于有效增长',chapter:'growth-loop',text:'获客带来接触机会，是否完成核心行为、继续回来，还受激活和留存影响。同轮竞争也会改变结果。'},
 K03:{title:'激活：让价值第一次发生',chapter:'activation',text:'激活关注用户是否完成核心任务。引导不是越多越好，应帮助目标人群获得价值，并观察实际响应。'},
 K04:{title:'留存：让价值持续发生',chapter:'retention',text:'留存关注用户是否继续获得价值。新增与流失共同改变有效用户，不能只把规模变化归到投放。'},
 K05:{title:'把收入和代价放在一起看',chapter:'economics',text:'价格、付费概率与留存可能同时变化。现金和累计利润口径不同，要先核对成本和账本。'},
 K06:{title:'把判断变成可验证的假设',chapter:'experiments',text:'先区分已确认事实、自己的解释和下一次要验证的假设。小样本和单局结果不能直接证明普遍规律。'}
};
export function conceptMarkup(id,s,round,{chapters=[]}={}){
 const concept=concepts[id]||concepts.K06;const chapter=chapters.find(c=>c.id===concept.chapter)||chapters.find(c=>c.id==='experiments')||chapters[0];
 const route=chapter?`#/read/${chapter.id}/from/${encodeURIComponent(s.id)}/${Number(round)||s.round}`:null;
 return {title:concept.title,html:`<section class="classroom-concept"><p>${concept.text}</p><p class="muted">这是方法解释，不是最佳行动建议。经营结果仍以本局规则与实际结算为准。</p>${route&&s.phase==='finished'?`<a class="button outline" href="${route}">读相关一篇，再回第 ${Number(round)||s.round} 轮 →</a>`:'<p>先完成本轮；本局结束后，可以从回合复盘读完整章节。</p>'}<button class="quiet-button" data-action="close-modal">回到这次判断</button></section>`};
}

export function roundNoteData(s,round,catalog=[]){
 const h=(s.history||[]).find(h=>h.round===Number(round)),r=ownLedger(s,h),p=own(s);if(!r)return null;
 const action=catalog.find(a=>a.id===r.action?.id);
 return {title:`${s.product?.name||'增长酒馆'} · 第${h.round}轮复盘`,tag:'酒馆复盘',source:{kind:'tavern-round',roomId:s.id,round:h.round,product:s.product?.name||''},body:`房间：${s.id}\n产品：${s.product?.name||''}\n规则：${s.rules?.version||''}\n\n已确认事实\n第${h.round}轮实际执行了${action?.name||r.action?.id||'等待'}。\n行动费用：${number(r.actionCost)}\n有效用户：${number(r.previousUsers)} → ${number(r.users)}\n本轮净利润：${number(r.net)}；结算后综合分：${fixed(r.score)}。\n\n我的解释（不是已经证明的原因）\n\n下一次，我想验证\n\n回到本轮：#/tavern/${s.id}/review/${h.round}`};
}

export function noteSourceMarkup(source){
 if(source?.kind==='tavern-round'&&/^[A-Za-z0-9_-]{1,100}$/.test(source.roomId)&&Number(source.round)>=1&&Number(source.round)<=6)return `<a class="note-source-link" href="#/tavern/${source.roomId}/review/${Number(source.round)}">← 回到${esc(source.product||'这局经营')}第 ${Number(source.round)} 轮</a>`;
 if(source?.kind==='chapter'&&/^[a-z0-9-]+$/.test(source.chapterId))return `<a class="note-source-link" href="#/read/${source.chapterId}">← 回到这条札记的阅读来源</a>`;
 return '';
}
