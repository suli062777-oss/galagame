import {PRODUCTS,ACTIONS} from './engine.js';
import {knowledge,KNOWLEDGE_VERSION} from './god-knowledge.js';
import {retrieveKnowledge} from './god-retrieval.js';
import {validateNaturalNarration,stripEvidenceMarkers} from './god-grounding.js';
import {narrationFocus,modelNarrationInput} from './god-focus.js';
export {knowledge,KNOWLEDGE_VERSION};
export {modelNarrationInput};
export const NARRATION_CONTRACT='grounded-natural-1';
import {HOST_PROMPT,HOST_PROMPT_VERSION} from './god-prompt.js';
export {HOST_PROMPT,HOST_PROMPT_VERSION};
const phaseNames={lobby:'等待入席',preparing:'准备',decision:'共同决策',settling:'锁单结算',finished:'终局'};
const safeText=(x,max=600)=>String(x??'').replace(/[<>\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').slice(0,max);
const unsafePublicText=text=>/Bearer|\b(?:humanHash|agentHash|api[_ -]?key)\b|sk-[a-z0-9_-]{12,}|[a-f0-9]{64}|(?:忽略|无视|覆盖).{0,12}(?:指令|规则|提示词)|(?:主持|你|系统).{0,10}(?:替|代).{0,12}(?:提交|下单)|(?:发放|赠送|增加).{0,8}(?:现金|奖励|分数)/i.test(text);
const rounded=value=>Math.round(Number(value)*100)/100;
export function buildGodInput(state={},options={}){
 const round=Math.max(0,Math.min(6,Number(state.round)||0)),phase=Object.hasOwn(phaseNames,state.phase)?state.phase:'lobby';
 const claims=[{id:'C0',type:'fact',text:`当前第${round}回合，阶段为${phaseNames[phase]}。`,metrics:{round},source:'当前公开服务端阶段'}];
 for(const [index,player] of (state.players||[]).slice(0,4).entries()){
  const seat=Number.isInteger(player.seat)&&player.seat>=0&&player.seat<4?player.seat+1:index+1;
  const metrics={score:rounded(player.score||0),users:Math.round(Number(player.users)||0),profit:rounded(player.profit||0)};
  for(const key of ['cash','rank'])if(player[key]!=null&&Number.isFinite(Number(player[key])))metrics[key]=rounded(player[key]);
  if(player.retention!=null&&Number.isFinite(Number(player.retention)))metrics.retention=rounded(Number(player.retention)*100)/100;
  claims.push({id:`P${index}`,type:'fact',seat,metrics,bankrupt:Boolean(player.bankrupt),text:`席位${seat}综合分${metrics.score}，有效用户${metrics.users}，累计利润${metrics.profit}${metrics.cash!=null?'，现金'+metrics.cash:''}${metrics.rank>0?'，名次'+metrics.rank:''}${metrics.retention!=null?'，留存率'+(metrics.retention*100).toFixed(2)+'%':''}，${player.bankrupt?'已破产':'经营中'}。`,source:'公开经营资料；有效用户按界面取整数，其余数值按两位小数展示'});
 }
 for(const [index,item] of (state.world||[]).slice(-5).entries()){
  if(!['fact','forecast','rumor','verification'].includes(item.type)||item.eventId==='E15'||Number(item.round)>round)continue;
  if(unsafePublicText(String(item.text||'')))continue;
  const eventId=/^E(0[1-9]|1[0-8])$/.test(item.eventId||'')?item.eventId:undefined;
  const hasTargets=Array.isArray(item.targets),targetSeats=hasTargets?[...new Set(item.targets.filter(seat=>Number.isInteger(seat)&&seat>=0&&seat<4).map(seat=>seat+1))]:undefined;
  const targetNote=hasTargets?(targetSeats.length?' 公开消息标注对象：'+targetSeats.map(seat=>'席位'+seat).join('、')+'。':' 公开消息未列出具体席位对象。'):'';
  claims.push({id:`W${index}`,round:Number(item.round),type:item.type,text:safeText(String(item.text||'').replaceAll('本公司','受影响席位'))+targetNote,...(hasTargets?{targetSeats}:{}),...(eventId?{eventId}:{}),...(typeof item.verified==='boolean'?{verified:item.verified}:{}),source:'已经发布的公开世界消息；对象以消息明确标注为准'});
 }
 const recent=Array.isArray(state.history)?state.history.at(-1):null;
 const recentSettled=recent&&Number(recent.round)>=1&&Number(recent.round)<round+(phase==='finished'?1:0);
 if(recentSettled)for(const [index,row] of (recent.players||[]).slice(0,4).entries()){
  const seat=Number.isInteger(row.seat)&&row.seat>=0&&row.seat<4?row.seat+1:index+1,actionId=/^A(0[1-9]|1[0-2])$/.test(row.action?.id)?row.action.id:undefined;
  const metrics={delta:rounded(row.delta||0),net:rounded(row.net||0)};
  claims.push({id:`L${index}`,type:'fact',seat,...(actionId?{actionId}:{}),metrics,text:`已结算第${Number(recent.round)}回合，席位${seat}执行${actionId||'等待'}${actionId?'（'+ACTIONS.find(action=>action.id===actionId).name+'）':''}，综合分变化${metrics.delta}，回合净利润${metrics.net}。一次变化不能单独证明行动效果。`,source:'上一已结算公开账本'});
 }
 const product=PRODUCTS.find(item=>item.id===state.product?.id);
 const focus=narrationFocus({phase,round,claims,productId:product?.id});
 const retrieval=retrieveKnowledge({round,phase,preferredIds:focus.knowledgeIds,productId:product?.id,actionIds:recentSettled?(recent.players||[]).map(row=>row.action?.id):[],eventIds:claims.filter(claim=>claim.eventId&&['fact','verification'].includes(claim.type)).map(claim=>claim.eventId),publicText:claims.map(claim=>claim.text).join(' '),query:safeText(options.question||'',300)},{limit:options.knowledgeLimit});
 return {version:'god-contract-2',narrationContract:NARRATION_CONTRACT,promptVersion:HOST_PROMPT_VERSION,focus,knowledgeVersion:KNOWLEDGE_VERSION,round,phase,...(product?{product:{id:product.id,name:product.name,coreBehavior:product.core_behavior,northStar:product.north_star}}:{}),claims,knowledge:retrieval.cards.map(({id,title,text,category,chapter,source,sourceType,sourceRefs,version,scope,mechanicsText,sourceNote})=>({id,title,text,category,chapter,source,sourceType,sourceRefs,version,scope,...(mechanicsText?{mechanicsText}:{}),...(sourceNote?{sourceNote}:{})})),retrieval:{version:retrieval.version,strategy:retrieval.strategy,trace:retrieval.trace}};
}
export function validateHostOutput(value,input,options={}){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('HOST_SCHEMA');
 const natural=Object.hasOwn(value,'narration'),keys=Object.keys(value).sort().join(',');
 if(keys!==(natural?'claimIds,kind,knowledgeIds,narration,tone':'claimIds,kind,knowledgeIds,tone'))throw Error('HOST_FIELDS');
 if(options.requireNatural&&!natural)throw Error('HOST_NATURAL_REQUIRED');
 if(!['fact','rumor','trend','recap'].includes(value.kind)||!['calm','curious','reflective'].includes(value.tone))throw Error('HOST_ENUM');
 if(value.kind==='recap'&&input.phase!=='finished')throw Error('HOST_PHASE');
 for(const [key,allowed,max] of [['claimIds',input.claims,3],['knowledgeIds',input.knowledge,2]])if(!Array.isArray(value[key])||value[key].length<1||value[key].length>max||new Set(value[key]).size!==value[key].length||value[key].some(id=>typeof id!=='string'||!allowed.some(item=>item.id===id)))throw Error('HOST_REFERENCE');
 if(value.kind==='rumor'&&value.claimIds.some(id=>input.claims.find(claim=>claim.id===id).type!=='rumor'))throw Error('HOST_RUMOR');
 if(value.kind==='fact'&&value.claimIds.some(id=>!['fact','verification'].includes(input.claims.find(claim=>claim.id===id).type)))throw Error('HOST_FACT');
 if(value.kind==='trend'&&value.claimIds.some(id=>input.claims.find(claim=>claim.id===id).type==='rumor'))throw Error('HOST_TREND');
 if(natural)validateNaturalNarration(value,input);
 return value;
}
export function resolveNarrationCitations(value,input){
 return [...value.claimIds.map(id=>{const claim=input.claims.find(item=>item.id===id);return claim?{id,type:'claim',claimType:claim.type,title:claim.type==='rumor'?'未核实传闻':claim.type==='forecast'?'有限预告':'公开经营证据',text:claim.text,source:claim.source||'公开服务端状态',...(claim.eventId?{eventId:claim.eventId}:{})}:null;}),...value.knowledgeIds.map(id=>{const item=input.knowledge.find(card=>card.id===id);return item&&(!item.scope||item.scope==='public')?{id,type:'knowledge',title:item.title,text:item.text,chapter:item.chapter,source:item.source,sourceType:item.sourceType,sourceRefs:item.sourceRefs,version:item.version}:null;})].filter(Boolean);
}
export function renderHostOutput(value,input){
 if(Object.hasOwn(value,'narration')){validateHostOutput(value,input,{requireNatural:true});return stripEvidenceMarkers(value.narration);}
 const opening={calm:'先看已经确认的情况。',curious:'这次判断，可以用什么证据检验？',reflective:'复盘时，把经营结果与外部事件分开。'}[value.tone];
 return [opening,...value.claimIds.map(id=>{const claim=input.claims.find(item=>item.id===id);return `${{fact:'事实',forecast:'有限预告',rumor:'未核实传闻',verification:'核验结果'}[claim.type]}：${claim.text}`;}),...value.knowledgeIds.map(id=>input.knowledge.find(item=>item.id===id).text)].join(' ');
}
export function templateNarration(state,reason='template-mode'){
 const input=buildGodInput(state),topic=input.knowledge.find(item=>item.category==='action')||input.knowledge.find(item=>item.id===(input.phase==='finished'?'K12':input.round<=1?'K02':'K04'))||input.knowledge[0];
 const claim=input.claims.find(item=>item.id.startsWith('L'))||[...input.claims].reverse().find(item=>item.id.startsWith('W')&&['fact','verification'].includes(item.type))||input.claims[0];
 const opening=input.phase==='finished'?'账本已经落定，可以开始复盘。':input.phase==='lobby'?'入席之后，先把要验证的问题说清楚。':'先把已经确认的变化和猜测分开。';
 return {provider:'template',text:`${opening} ${claim.text} ${topic.text}`,reason,claimIds:[claim.id],knowledgeIds:[topic.id],knowledgeVersion:KNOWLEDGE_VERSION,narrationContract:NARRATION_CONTRACT};
}
