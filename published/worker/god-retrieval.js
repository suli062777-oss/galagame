/** Local retrieval with deterministic evidence gates and lexical ranking.
 * No embedding service, model request, vector store or hidden-state access. */
import {knowledge,KNOWLEDGE_VERSION} from './god-knowledge.js';
export const RETRIEVAL_VERSION='public-evidence-lexical-1';
const actionConcept={A01:'K05',A02:'K06',A03:'K07',A04:'K03',A05:'K04',A06:'K01',A07:'K10',A08:'K10',A09:'K10',A10:'K09',A11:'K08',A12:'K14'};
function terms(text){const value=String(text||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' '),found=new Set(value.match(/[a-z][a-z0-9_-]{1,30}/g)||[]);for(const run of value.match(/[\p{Script=Han}]{2,}/gu)||[])for(let i=0;i<run.length-1;i++)found.add(run.slice(i,i+2));return [...found].slice(0,120);}
export function retrieveKnowledge(context={},options={}){
 const limit=Math.max(4,Math.min(18,Number(options.limit)||12));
 const phase=['lobby','preparing','decision','settling','finished'].includes(context.phase)?context.phase:'lobby',round=Number(context.round)||0;
 const actions=new Set((context.actionIds||[]).filter(id=>/^A(0[1-9]|1[0-2])$/.test(id)));
 const events=new Set((context.eventIds||[]).filter(id=>/^E(0[1-9]|1[0-8])$/.test(id)&&id!=='E15'));
 const product=/^P0[1-3]$/.test(context.productId||'')?context.productId:null;
 const anchors=phase==='finished'?['K11','K12','K-R03','K13']:round<=1?['K01','K02','K14','K13']:['K13','K04','K-R04'];
 const queryTerms=terms(context.query),publicTerms=terms(context.publicText);
 const scored=[];
 for(const card of knowledge){
  if(card.scope!=='public'||card.publicHostEligible===false)continue;
  // A rule about an event is not evidence of its occurrence. Unreleased events
  // never enter model context, even if a query guesses their name or identifier.
  if(card.requiresPublicEventId&&!events.has(card.requiresPublicEventId))continue;
  if(card.category==='product'&&!card.tags.productIds?.includes(product))continue;
  let score=0;const reasons=[];
  if((context.preferredIds||[]).includes(card.id)){score+=2000;reasons.push('public-narration-focus');}
  const anchor=anchors.indexOf(card.id);if(anchor>=0){score+=1000-anchor;reasons.push('phase-anchor');}
  if(card.tags.eventIds?.some(id=>events.has(id))){score+=350;reasons.push('public-event');}
  if(card.tags.actionIds?.some(id=>actions.has(id))){score+=260;reasons.push('settled-action');}
  if([...actions].some(id=>actionConcept[id]===card.id)){score+=210;reasons.push('action-concept');}
  if(card.tags.productIds?.includes(product)){score+=180;reasons.push('public-product');}
  if(card.tags.phases?.includes(phase)){score+=100;reasons.push('phase');}
  if(card.id==='K-S05'){score+=25;reasons.push('host-style');}
  const haystack=(card.title+' '+card.text+' '+(card.tags.keywords||[]).join(' ')).toLowerCase();
  const hits=queryTerms.filter(term=>haystack.includes(term));if(hits.length){score+=Math.min(700,hits.length*32);reasons.push('question-lexical');}
  const publicHits=publicTerms.filter(term=>haystack.includes(term));if(publicHits.length){score+=Math.min(70,publicHits.length*4);reasons.push('public-claim-lexical');}
  if(score>0)scored.push({card,score,reasons});
 }
 scored.sort((a,b)=>b.score-a.score||a.card.id.localeCompare(b.card.id,'en'));
 const selected=scored.slice(0,limit);
 return {version:RETRIEVAL_VERSION,knowledgeVersion:KNOWLEDGE_VERSION,strategy:'deterministic-public-evidence-gates-and-lexical-ranking',cards:selected.map(row=>row.card),trace:selected.map(({card,score,reasons})=>({id:card.id,score,reasons,sourceIds:card.sourceRefs.map(source=>source.id)}))};
}
