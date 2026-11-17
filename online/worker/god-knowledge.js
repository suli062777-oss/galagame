/** Versioned, traceable teaching knowledge. These are project-authored summaries,
 * not book quotations, a vector index, or fine-tuned model weights. */
import {ACTIONS,PRODUCTS,EVENTS,RULES} from './engine.js';
export const KNOWLEDGE_VERSION='growth-god-knowledge-2.0.2';
const legacy=[{"id": "K01", "version": "1.0.0", "scope": "public", "title": "增长是团队方法", "chapter": "north-star", "text": "增长由提出问题、确定指标、形成假设、排序实验、分析结果与复用经验构成。单次投放不是整个增长过程。", "source": "肖恩·埃利斯、摩根·布朗《增长黑客》，中信2018中文版，方法概念转述"}, {"id": "K02", "version": "1.0.0", "scope": "public", "title": "核心价值先于扩张", "chapter": "north-star", "text": "先确认用户完成了有价值的核心行为，再扩大触达。曝光、注册与有效活跃不是同一个口径。", "source": "同上，产品核心价值与增长前提概念转述"}, {"id": "K03", "version": "1.0.0", "scope": "public", "title": "激活与首次价值", "chapter": "activation", "text": "引导的目标是缩短用户抵达首次价值的路径。相同引导对不同群体可能产生相反效果，因此应检验而非迷信按钮修改。", "source": "同上，激活概念；干预响应为本游戏改编"}, {"id": "K04", "version": "1.0.0", "scope": "public", "title": "留存是持续价值", "chapter": "retention", "text": "留存是上一回合用户继续完成核心行为的人数比例。游戏用最近三回合人数加权合并，并非现实七日留存。", "source": "同上，留存概念；窗口与公式为游戏规则"}, {"id": "K05", "version": "1.0.0", "scope": "public", "title": "获客要看边际成本", "chapter": "growth-loop", "text": "广告竞价会随同桌投入增加而变贵。渠道效果依赖激活、留存与现金约束，不能只看新增数量。", "source": "游戏v0.1经营模型与书籍获客概念"}, {"id": "K06", "version": "1.0.0", "scope": "public", "title": "内容有延后回报", "chapter": "growth-loop", "text": "内容行动的一半接触延到下一回合。终局未兑现的接触不计有效用户，也不预支未来利润。", "source": "游戏v0.1 A02"}, {"id": "K07", "version": "1.0.0", "scope": "public", "title": "推荐依赖已有价值", "chapter": "growth-loop", "text": "推荐的潜在触达来自上轮活跃用户，已有规模与真正愿意继续使用相互关联；推荐不会凭空扩容。", "source": "游戏v0.1 A03与书籍推荐概念"}, {"id": "K08", "version": "1.0.0", "scope": "public", "title": "实验不等于部署", "chapter": "experiments", "text": "实验面板与市场活跃分开计算。证据不足并非没有效果，显著结果也不会自动部署产品改进。", "source": "游戏v0.1 A11；保守区间为教学简化"}, {"id": "K09", "version": "1.0.0", "scope": "public", "title": "调研是带误差的信息", "chapter": "experiments", "text": "访谈提供有误差的私有线索，而非隐藏参数的答案。把线索作为下一次行动的输入，防止将单一样本泛化。", "source": "游戏v0.1 A10"}, {"id": "K10", "version": "1.0.0", "scope": "public", "title": "变现有取舍", "chapter": "economics", "text": "高定价提高单价同时降低付费与留存，优惠可能影响后续付费。收入减全部实际费用才是利润。", "source": "游戏v0.1 A07/A08/A09"}, {"id": "K11", "version": "1.0.0", "scope": "public", "title": "同一把尺衡量结果", "chapter": "metrics", "text": "综合分由规模、累计净利润与合并留存构成。仅以公开两位小数排位，同分并列；破产者无获胜资格。", "source": "综合得分v0.2与growth-1.0.0"}, {"id": "K12", "version": "1.0.0", "scope": "public", "title": "把判断带回下一次实验", "chapter": "experiments", "text": "复盘应区分行动、事件、竞争与证据。一次胜负不能证明策略普遍有效，更不能从游戏收益推断现实收入。", "source": "书籍迭代概念与本项目改编边界"}, {"id": "K13", "version": "1.0.0", "scope": "public", "title": "事实与传闻分开", "chapter": "experiments", "text": "世界频道中的事实已发生，预告只有有限范围，传闻到期后核验。主持语言不改变真值，也不分配额外奖励。", "source": "世界情报与自带Agent接入v0.3"}, {"id": "K14", "version": "1.0.0", "scope": "public", "title": "十二行动与等待", "chapter": "north-star", "text": "每回合执行一项既有行动，附目标与档位。未能通过预算校验的提交不执行，截止时使用合法缓存默认，否则等待。", "source": "growth-1.0.0权限与时间协议"}];

const bookSource={id:'book:growth-2018',kind:'book-summary',label:'肖恩·埃利斯、摩根·布朗《增长黑客》2018中文版，项目方法转述',locator:'项目既有K01–K14；非逐字引用，未声称页码'};
const engineSource=(group,id)=>group==='API'?{id:'api:'+id,kind:'game-protocol',label:'公开席位与Agent接入协议',locator:'worker/api.js#'+id}:{id:'engine:'+id,kind:'game-rule',label:'growth-1.0.0 '+id,locator:'worker/engine.js#'+group+':'+id};
function card(id,title,text,category,tags={},sourceRefs=[engineSource('RULES',RULES.version)],extra={}){return Object.freeze({id,version:KNOWLEDGE_VERSION,scope:'public',title,text,category,chapter:category,tags,source:sourceRefs.map(s=>s.label).join('；'),sourceType:sourceRefs[0]?.kind||'project-summary',sourceRefs,...extra});}
const concepts=legacy.map(k=>{const bookBased=/肖恩|同上|书籍/.test(k.source),origin={id:'legacy:'+k.id,kind:bookBased?'book-and-game-summary':'project-rule-summary',label:k.source,locator:'项目知识卡#'+k.id};return card(k.id,k.title,k.text,'concept',{chapters:[k.chapter]},bookBased?[origin,bookSource]:[origin,engineSource('RULES',RULES.version)],{legacyVersion:k.version,chapter:k.chapter});});
const actionCards=ACTIONS.map(a=>card('K-'+a.id,a.name+'的规则与取舍',`${a.id}「${a.name}」：标准行动成本${a.cost}，可用档位${a.scales.join('、')}；${a.scope==='all'?'面向全部人群':'选择一个目标人群'}。${a.effect}。它不是必胜策略，结果还受产品、人群、事件和同桌竞争影响。`,'action',{actionIds:[a.id],keywords:[a.name,a.concept]},[engineSource('ACTIONS',a.id)],{mechanics:{cost:a.cost,scales:a.scales,scope:a.scope}}));
const productCards=PRODUCTS.map(p=>card('K-'+p.id,p.name+'的核心价值',`本产品是「${p.name}」。核心行为：${p.core_behavior}；北极星指标：${p.north_star}。公开人群为${p.segments.join('、')}。这些定义不透露本局隐藏响应，不能断言某一人群必然更好。`,'product',{productIds:[p.id],keywords:[p.name,...p.segments]},[engineSource('PRODUCTS',p.id)]));
const effectNames={target_exposure:'目标人群接触机会乘数',paid_cost:'付费获客成本乘数',organic:'内容接触机会乘数',paid_activation:'付费渠道激活乘数',retention:'留存率加减项',pay:'付费概率乘数',variable_cost:'变动成本乘数',referral:'推荐接触机会乘数',activation:'激活率加减项',local_variable_cost:'受影响席位变动成本乘数',local_pay:'受影响席位付费概率乘数'};
const eventCards=EVENTS.map(e=>{
 const privateEvent=e.visibility!=='public';
 const mechanics=Object.entries(e.effect).map(([key,value])=>`${effectNames[key]||key}为${value}`).join('；');
 const sourceNote='适用来源：只有关联事件已进入公开事实或核验时，公共主持才取得本机制说明；发生状态和对象由关联公开claim提供。此备注属于来源元数据，不是播报正文。';
 let mechanicsText=privateEvent?'此事件属于私有研究返回。公共主持不得检索、描述或推断研究结果；只可说明私有信息属于本人。':`「${e.name}」机制：${e.news.replaceAll('本公司','受影响席位')}${mechanics?'公开效果：'+mechanics+'。':''}事件效果持续${e.duration}轮。`;
 if(e.id==='E12')mechanicsText+='高峰之后的公开信息仅为“会回落”。除非后续公开情报另有说明，不能推断接触机会恢复常态或低于常态，也不能推断回落的具体幅度或持续时长。当前高峰的持续轮数不等于回落阶段的持续轮数。';
 if(e.id==='E13')mechanicsText=`「${e.name}」只播报已经计入结算的渠道拥挤情况。播报标记持续${e.duration}轮；该播报不施加任何额外成本，也不延长任何成本效果。拥挤费用已按经营公式计入，不能据新闻判断费用何时结束。`;
 if(e.id==='E16')mechanicsText=`「${e.name}」机制：试用优惠结束，受影响席位在该事件作用轮承受付费回落。受影响席位付费概率乘数为${e.effect.local_pay}，事件效果持续${e.duration}轮。作用对象以公开情报列出的席位为准，不扩展到其他席位，也不改变行动次数或共同决策窗口。`;
 return card('K-'+e.id,e.name,mechanicsText,'event',{eventIds:[e.id],keywords:[e.name]},[{...engineSource('EVENTS',e.id),note:sourceNote}],{scope:privateEvent?'private-rule-only':'public',requiresPublicEventId:e.id,publicHostEligible:!privateEvent,mechanicsText,sourceNote});
});
const ruleCards=[
 card('K-R01','一局的时间与操作边界',`本局${RULES.players}席、${RULES.rounds}轮，每轮共同决策窗口${RULES.decisionSeconds}秒。准备、决策、锁单结算和终局是不同阶段；只有决策窗口内的合法行动才能被接收。每席每轮执行1个行动，截止前可以更新。`,'rule',{phases:['lobby','preparing','decision','settling'],keywords:['时间','截止','次数']}),
 card('K-R02','现金、预算与固定运营费',`每家公司从${RULES.initialCash}现金、${RULES.initialUsers}有效用户起步。可用行动预算需预留${RULES.fixedCost}固定运营费；接收行动不会立即扣款，截止后统一结算。不能花未来收入，也不能靠主持临时加钱。`,'rule',{keywords:['现金','预算','运营费','提交']}),
 card('K-R03','综合分、排名与破产',`综合分权重为规模${RULES.weights.growth*100}%、累计利润${RULES.weights.profit*100}%、合并留存${RULES.weights.retention*100}%。只按公开的${RULES.moneyPrecision}位小数综合分排位，同分并列；现金小于0破产，失去获胜资格，全员破产则无胜者。`,'rule',{phases:['finished'],keywords:['分数','排名','破产']}),
 card('K-R04','共用市场不是各自独立增长','同桌公司面对共享人群。接触、激活、留存、价格、事件与竞争共同决定经营结果；同一行动在不同产品、人群或对手投入下可能有不同结果。不能用一次变化证明单一因果。','rule',{keywords:['竞争','共享','因果']}),
 card('K-R05','超时、掉线与默认行动','超时以服务端时钟和回执为准。没有本轮合法行动时尝试已保存的合法默认，否则等待；掉线不会给个人额外操作时间。发送请求不等于接收成功，重复重试应保留幂等标识。','rule',{keywords:['断线','超时','默认','回执']}),
 card('K-R06','事实、有限预告、传闻与核验','事实和核验描述已经公开的证据；有限预告只包含获准公开的范围；未核实传闻不能说成既定事实，必须保留不确定性。规则库中存在一个事件，不等于它会在本局发生。','rule',{keywords:['传闻','事实','核验','未来']}),
 card('K-R07','主持和玩家Agent的权限','主持只解释公开证据和知识，不替任何席位提交、不修改规则和计分、不分配额外奖励。玩家Agent只能在本席授权范围提出建议或提交行动，建议模式仍需本人确认。','rule',{keywords:['权限','Agent','主持']}),
 card('K-R08','复盘与模型适用边界','这是群体期望值教学模型，有效用户可能是小数，并非真实企业预测。完整回放可以复核规则、种子和历史行动，但一次输赢不能推出真实世界收益或普遍最优策略。','rule',{phases:['finished'],keywords:['回放','复盘','模型','小数']})
];
const misconceptionCards=[
 ['01','曝光不等于有效用户','接触机会不是已经激活或留下来的用户。先分清触达、核心行为和留存，再讨论增长。',['激活','接触']],
 ['02','短期利润不等于最终胜负','利润只是综合分的一部分，规模与留存也重要。不能仅凭某次收入或一次领先就宣布最终胜负。',['利润','胜负']],
 ['03','内容的延迟收益','内容行动的部分接触会延后；最后一轮来不及兑现的部分不会预支给终局。看账本时注意行动与效果的时间差。',['内容','延迟']],
 ['04','实验结果不自动成为产品改动','独立实验给出带不确定性的证据，不会自动推广，也不会直接奖励增长；公共主持不能披露本席私有结果。',['实验','研究']],
 ['05','更高投入不一定更划算','现金约束、边际成本、渠道拥挤和响应方向都会影响投入效果。花更多钱不是必胜策略。',['投入','拥挤']],
 ['06','未知响应不能靠主持猜出','引导与习惯响应可能因人群而不同，甚至为负。主持没有本席私有研究，不能宣布隐藏参数的实际取值。',['隐藏','响应']],
 ['07','相同规则不代表跨桌同一场景','不同房间可能有不同产品和事件条件。组内相同起点可比较，跨桌原始分数不能自动当作同场公平的全班名次。',['公平','房间']],
 ['08','主持语言不加分','自然主持、模板回退、沙盘装饰和头像都不改变经营结算。所有胜负都来自冻结规则与服务端账本。',['主持','装饰','计分']]
].map(([id,title,text,keywords])=>card('K-M'+id,title,text,'misconception',{keywords},[engineSource('RULES',RULES.version),bookSource]));
const faqCards=[
 ['01','一定要连接自己的Agent吗','不需要，手动选择合法行动也能完成一局。接入入口为自己的Agent提供本席连接流程；复制指令本身不代表已经通过连接自检。',['接入','连接','手动']],
 ['02','建议和自主模式有什么不同','建议模式由Agent提出候选行动，玩家确认才执行；自主模式允许本席Agent直接提交。主持不能把建议擅自当作已接收行动。',['建议','自主','授权']],
 ['03','主持是真模型还是模板','主持来源以本次服务端实际结果为准。未配置、额度不足、忙碌或输出不合规时可回退模板；配置了模型不等于每条播报都由真实模型生成。',['模板','模型','额度']],
 ['04','自己的研究会给其他人看到吗','本席研究和意图属于私有信息。公共主持不能读取、引用或推断它们，其他玩家只能看到公开资料与已结算公开账本。',['私有','研究','意图']],
 ['05','为什么有人已经提交还可以改','在本轮截止前可以更新合法行动，最终以服务端接受的版本为准；正在编辑的新草稿不等于已经更新已接收版本。',['更新','提交','草稿']],
 ['06','怎么判断是行动效果还是外部事件','先查看已结算账本与已核验事件，比较多轮证据，区分行动、竞争、随机条件和时序；仅凭单次变化不能认定因果。',['事件','因果','复盘']],
 ['07','为什么用户数有小数','用户数采用群体期望值模拟，允许小数；不能因此把它描述为真实自然人的精确人数，也不能当作服务异常。',['用户','小数']],
 ['08','一桌满员后还能加入吗','当前每桌固定四个席位，开局后不再接受新席位。全班可分桌，但当前房间榜不等于全班统一比赛榜。',['满员','班级','加入']]
].map(([id,title,text,keywords])=>card('K-F'+id,title,text,'faq',{keywords},[engineSource('API','protocol'),engineSource('RULES',RULES.version)]));
const styleCards=[
 ['01','平静而具体','优先说一条有据可查的变化，再提出一个可复盘的问题；不堆砌术语，不逐条朗读全部数据。',['calm']],
 ['02','好奇而不暗示答案','用开放问题引导核对证据，不给必胜建议，不根据未知响应劝某席选择具体行动。',['curious']],
 ['03','复盘时区分结果与原因','结局可以承认公开名次，但要把行动、事件与竞争分开；不用一次胜负评判玩家的现实能力。',['reflective']],
 ['04','不羞辱、不偏袒','对所有席位使用同一证据标准。不嘲讽落后或破产者，不夸大赢家的策略，也不替任何席位站台。',['calm','reflective']],
 ['05','简洁的圆桌主持','每次用两到四句自然中文，聚焦当前公开证据与相关增长方法；避免每句都重复回合编号或固定开场。',['calm','curious','reflective']]
].map(([id,title,text,tones])=>card('K-S'+id,title,text,'style',{tones},[{id:'project:host-style',kind:'editorial-policy',label:'增长酒馆主持编辑规范',locator:'worker/god-knowledge.js#styleCards'}]));
export const knowledge=Object.freeze([...concepts,...actionCards,...productCards,...eventCards,...ruleCards,...misconceptionCards,...faqCards,...styleCards]);
export const knowledgeById=new Map(knowledge.map(k=>[k.id,k]));
export const knowledgeCoverage=Object.freeze({total:knowledge.length,concepts:concepts.length,actions:actionCards.length,products:productCards.length,events:eventCards.length,publicEvents:eventCards.filter(k=>k.publicHostEligible).length,rules:ruleCards.length,misconceptions:misconceptionCards.length,faqs:faqCards.length,styles:styleCards.length});
export function resolveKnowledgeReferences(ids){return ids.map(id=>knowledgeById.get(id)).filter(k=>k&&k.scope==='public').map(({id,title,category,source,sourceRefs,version})=>({id,title,category,source,sourceRefs,version}));}
