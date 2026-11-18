/** Mechanical checks for cited natural narration. This does not claim formal
 * semantic entailment for arbitrary Chinese; held-out/model review is required. */
import {ACTIONS,EVENTS} from './engine.js';
const marker=/\[([A-Z][A-Z0-9_-]{0,31})\]/g;
export const stripEvidenceMarkers=text=>String(text).replace(marker,'').replace(/[ \t]+/g,' ').trim();
const chineseDigits={零:0,〇:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
function chineseNumber(text){let total=0,section=0,digit=0;for(const char of text){if(char in chineseDigits){digit=chineseDigits[char];continue;}const unit={十:10,百:100,千:1000,万:10000,亿:100000000}[char];if(!unit)return NaN;if(unit<10000){section+=(digit||1)*unit;digit=0;}else{total+=(section+digit||1)*unit;section=0;digit=0;}}return total+section+digit;}
function numericValue(token){const normalized=token.replaceAll(',','').replace('−','-');if(normalized.startsWith('百分之'))return chineseNumber(normalized.slice(3))/100;if(/[零〇一二两三四五六七八九十百千万亿]/.test(normalized)){const [whole,fraction]=normalized.split('点');return chineseNumber(whole)+(fraction?Number('0.'+[...fraction].map(char=>chineseDigits[char]).join('')):0);}return normalized.endsWith('%')?Number(normalized.slice(0,-1))/100:Number(normalized);}
function near(a,b){return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(a),Math.abs(b));}
export function evidenceNumbers(text){
 const value=String(text).replace(marker,'').replace(/(?:这|某|下)?一次(?=变化|结算|结果|观察|输赢|判断)/g,'单次').replace(/\b(?:A\d{2}|E\d{2}|P\d{2}|K[A-Z0-9_-]*)\b/g,'');
 const values=(value.match(/[-+−]?\d[\d,]*(?:\.\d+)?%?/g)||[]).map(numericValue);
 if(value.includes('一半'))values.push(.5);
 for(const match of value.matchAll(/百分之([零〇一二两三四五六七八九十百千万亿]+)/g))values.push(chineseNumber(match[1])/100);
 for(const match of value.matchAll(/([零〇一二两三四五六七八九十百千万亿]+)(?=个|人|用户|活跃|访问|元|分|轮|回合|秒|次|倍|席|位|条|笔|家公司|公司|名)/g))values.push(chineseNumber(match[1]));
 return values.filter(Number.isFinite);
}
function canonicalActors(text){return text.replace(/第([1-4一二三四])(?:号|个)?席(?:位)?/g,(_,n)=>'席位'+(Number(n)||chineseNumber(n))).replace(/([1-4一二三四])号(?:席位|玩家|公司|选手)/g,(_,n)=>'席位'+(Number(n)||chineseNumber(n))).replace(/第([1-4一二三四])(?:位玩家|家公司|位经营者)/g,(_,n)=>'席位'+(Number(n)||chineseNumber(n))).replace(/席位([一二三四])/g,(_,n)=>'席位'+chineseNumber(n));}
function withoutNegativeAssertions(text){return text.replace(/(?:不能|不代表|不意味着|不等于|并非|不是|不保证|未必|尚未|还没|无法).{0,10}(?:获胜|胜利|冠军|赢家|胜出|领先|成真|事实|核实|核验|证实|确定|兑现|应验|发生|必胜|增长)/g,'').replace(/失去获胜资格|无获胜资格|没有胜者|无胜者|失去获胜机会/g,'');}
function metricChecks(sentence,claims){
 const text=canonicalActors(sentence),actors=[...text.matchAll(/席位([1-4])/g)];
 const valuePattern='([-+−]?\\d[\\d,]*(?:\\.\\d+)?%?|百分之[零〇一二两三四五六七八九十百千万亿]+|[零〇一二两三四五六七八九十百千万亿]+(?:点[零〇一二两三四五六七八九]+)?)';
 const metrics=[['综合分变化|得分变化','delta'],['回合净利润|本轮净利润','net'],['累计(?:净)?利润|(?<!净|计)利润','profit'],['(?:有效|活跃)?用户(?:的)?(?:数量|人数|数|量)?','users'],['(?:综合得分|综合分|得分|分数)(?!变化)','score'],['可用现金|现金余额|现金','cash'],['合并留存率|留存率','retention'],['名次|排名','rank']];
 for(let index=0;index<actors.length;index++){
  const actor=actors[index],seat=Number(actor[1]),segment=text.slice(actor.index+actor[0].length,actors[index+1]?.index??text.length),own=claims.filter(claim=>claim.seat===seat);
  for(const [label,metric] of metrics){
   const pattern=new RegExp('(?:'+label+')(?:的|现在|目前|当前|已经|达到|达到了|为|是|有|约|变化|增加|减少|至|了){0,6}\\s*'+valuePattern,'g');
   for(const match of segment.matchAll(pattern))if(!own.some(claim=>near(Number(claim.metrics?.[metric]),numericValue(match[1]))))throw Error('HOST_METRIC_BINDING');
  }
  const beforeUsers=new RegExp('(?:拥有|有|留下|留下了|达到)\\s*'+valuePattern+'(?:名|个)?(?:有效|活跃)?用户','g');
  for(const match of segment.matchAll(beforeUsers))if(!own.some(claim=>near(Number(claim.metrics?.users),numericValue(match[1]))))throw Error('HOST_METRIC_BINDING');
  if(/榜首|领先|第一名|获胜|赢家|胜利|冠军|胜出/.test(withoutNegativeAssertions(segment))&&!own.some(claim=>claim.metrics?.rank===1&&!claim.bankrupt))throw Error('HOST_RANK_BINDING');
  if(/(?:研究|调研|访谈|实验)(?:结果|结论|反馈|报告)?(?:显示|表明|说明|发现|证实|告诉|揭示|指出)/.test(segment))throw Error('HOST_PRIVATE_ASSERTION');
  if(/(?:执行|采取|选择|使用|完成|做了|开展|进行|实施|安排|投放|开启|启动|改用)/.test(segment))for(const action of ACTIONS)if(segment.includes(action.id)||segment.includes(action.name))if(!own.some(claim=>claim.actionId===action.id))throw Error('HOST_ACTION_BINDING');
 }
}
export function validateNaturalNarration(value,input){
 const narration=value.narration;
 if(typeof narration!=='string'||stripEvidenceMarkers(narration).length<24||narration.length>700||!/[\p{Script=Han}]/u.test(narration))throw Error('HOST_NARRATION_LENGTH');
 if(/[<>`\u0000-\u0008\u000b\u000c\u000e-\u001f]|https?:\/\//i.test(narration))throw Error('HOST_NARRATION_FORMAT');
 if(/Bearer|\btoken\b|api[_ -]?key|sk-[a-z0-9_-]+|[a-f0-9]{64}|密钥|系统提示词|忽略.{0,12}(?:指令|规则)|更改.{0,8}规则|修改.{0,8}计分|(?:发放|增加|奖励).{0,8}(?:现金|分数|奖励)|(?:我|主持).{0,8}(?:替|代|为|帮).{0,15}(?:提交|决策|下单|选定|投放|执行)/i.test(narration))throw Error('HOST_AUTHORITY');
 if(/(?:私有研究|私人研究|调研结果|访谈结果|实验结果|隐藏参数|隐藏响应).{0,12}(?:显示|表明|数值为|取值为|是[-+\d]|为[-+\d])|(?:我|主持).{0,8}(?:看到了|知道了|掌握了).{0,8}(?:私有|隐藏|研究)/.test(narration))throw Error('HOST_PRIVATE_ASSERTION');
 const cautionRemoved=narration.replace(/(?:并不|不能|无法|不足以|并不足以|尚不能|不)(?:直接|单独|充分)?(?:证明|保证)/g,'否证').replace(/(?:不能|无法|不代表|并非|不是|不保证|没有).{0,5}(?:保证|证明|必胜|稳赚|必然|一定)/g,'');
 if(/必胜|稳赚|保证.{0,8}(?:增长|获胜|收益)|必然带来|全靠|就是因为|(?:结果|数据).{0,8}证明/.test(cautionRemoved))throw Error('HOST_UNSUPPORTED_CAUSALITY');
 if(/(?:你|席位[1-4一二三四]|各位).{0,12}(?:应该|必须|建议|请).{0,12}(?:选择|执行|提交|提价|降价|投放)/.test(narration))throw Error('HOST_PLAYER_ADVICE');
 const selected=new Map([...input.claims.filter(c=>value.claimIds.includes(c.id)),...input.knowledge.filter(k=>value.knowledgeIds.includes(k.id))].map(item=>[item.id,item]));
 const cited=new Set();const sentences=narration.match(/[^。！？!?\n]+[。！？!?]?/g)||[];
 if(sentences.length<2||sentences.length>4)throw Error('HOST_SENTENCE_COUNT');
 for(const segment of sentences){
  const sentence=segment.trim();if(!sentence)continue;
  const ids=[...sentence.matchAll(marker)].map(match=>match[1]);if(!ids.length||ids.some(id=>!selected.has(id)))throw Error('HOST_SENTENCE_REFERENCE');
  ids.forEach(id=>cited.add(id));const body=stripEvidenceMarkers(sentence);if(/[\[\]]/.test(body)||body.replace(/[。！？!?；;\s]/g,'').length<4)throw Error('HOST_NARRATION_FORMAT');
  const sources=ids.map(id=>selected.get(id)),claims=sources.filter(source=>value.claimIds.includes(source.id));
  if(claims.some(claim=>claim.type==='fact'&&claim.eventId)&&/将迎来|即将(?:出现|发生|迎来)|尚未发生/.test(body))throw Error('HOST_FACT_TENSE');
  const allowed=evidenceNumbers(sources.map(source=>source.text).join(' '));
  if(evidenceNumbers(body).some(number=>!allowed.some(candidate=>near(candidate,number))))throw Error('HOST_UNGROUNDED_NUMBER');
  if(evidenceNumbers(body).length&&/合计|总计|共计|加起来|总和|平均|(?:均|都|同|同样|皆)(?:为|是|有)|分别(?:为|是|达到|有)/.test(body))throw Error('HOST_DERIVED_NUMBER');
  // Two citations establish availability, not the truth of a comparative
  // relation. Until typed comparisons exist, reject explicit-seat comparisons.
  if(/席位[1-4]/.test(canonicalActors(body))&&/(?:高于|低于|多于|少于|优于|最多|最少|最高|最低|较高|较低|更高|更低|更多|更少|超过|不及|不如|强于|弱于|高出|低出|大于|小于)/.test(body))throw Error('HOST_COMPARISON_REFERENCE');
  metricChecks(body,claims);
  if(/获胜|胜利|冠军|赢家|胜出|赢了|赢得|夺冠/.test(withoutNegativeAssertions(body))&&input.phase!=='finished')throw Error('HOST_WINNER_PHASE');
  if(claims.some(claim=>claim.type==='rumor')&&!/未核实|传闻|尚未证实|无法确认|待核验/.test(body))throw Error('HOST_RUMOR_CERTAINTY');
  const positive=withoutNegativeAssertions(body).replace(/尚未证实|尚未确定|无法确定|不一定|不代表已经发生|不等于已经发生|尚未发生/g,'');
  const certain=/已经确定|已经证实|已被证实|确定发生|必然|一定|属实|成真|实锤|板上钉钉|(?:已经|现已|如今|现在|已然|已)(?:被|获|得到)?(?:核实|核验|证实|坐实|落地|兑现|应验|确定)|(?:核实|核验).{0,4}(?:落地|完成|通过)/;
  if(claims.some(claim=>claim.type==='rumor')&&certain.test(positive))throw Error('HOST_RUMOR_CERTAINTY');
  if(claims.some(claim=>claim.type==='forecast')&&!/预告|可能|预计|尚未|后续|待/.test(body))throw Error('HOST_FORECAST_CERTAINTY');
  if(claims.some(claim=>claim.type==='forecast')&&(/已经发生|已发生|确定发生|成为事实|已被证实|兑现|应验|落地/.test(positive)||certain.test(positive)))throw Error('HOST_FORECAST_CERTAINTY');
  if(/(?:传闻|消息).{0,10}(?:属实|已经证实|已被证实|确定发生)/.test(positive)&&!claims.some(claim=>claim.type==='verification'&&claim.verified===true))throw Error('HOST_VERIFICATION_BINDING');
  if(/(?:下一轮|下轮|未来|接下来).{0,20}(?:将发生|将会|会发生|必然|一定)/.test(body)&&!claims.some(claim=>claim.type==='forecast'))throw Error('HOST_FUTURE_ASSERTION');
  for(const event of EVENTS)if(body.includes(event.name)&&!claims.some(claim=>claim.eventId===event.id||claim.text.includes(event.name))&&!(sources.some(source=>source.id==='K-'+event.id)&&input.claims.some(claim=>claim.eventId===event.id&&['fact','verification'].includes(claim.type))))throw Error('HOST_UNGROUNDED_EVENT');
  for(const id of body.match(/\b(?:A\d{2}|E\d{2}|P\d{2})\b/g)||[])if(!sources.some(source=>source.text.includes(id)))throw Error('HOST_UNGROUNDED_ENTITY');
 }
 if([...value.claimIds,...value.knowledgeIds].some(id=>!cited.has(id)))throw Error('HOST_UNUSED_REFERENCE');
 return narration.trim();
}
