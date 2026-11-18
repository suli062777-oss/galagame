import {knowledge} from './god-contract.js';

const text=(value,max=1600)=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').slice(0,max);
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
export function knowledgeReferences(ids=[]){
 return [...new Set(Array.isArray(ids)?ids:[])].slice(0,6).map(id=>knowledge.find(k=>k.id===id&&k.scope==='public')).filter(Boolean).map(k=>({id:k.id,title:k.title,chapter:k.chapter||'',section:k.section||'',summary:k.text,source:k.source,sourceType:k.sourceType||'reference',version:k.version||'1.0.0'}));
}
export function makeHostMessage(result,{roomId,round,key,generatedAt=new Date().toISOString()}={}){
 const provider=result.provider==='deepseek'?'deepseek':'template';
 const ids=Array.isArray(result.knowledgeIds)?result.knowledgeIds:[];
 return {id:`${roomId}:${key}`,round:Math.max(0,Math.min(6,finite(round))),text:text(result.text),provider,reason:result.reason?text(result.reason,80):null,status:provider==='deepseek'||!result.reason||['template-mode','calls-disabled'].includes(result.reason)?'ready':'fallback',generatedAt,kind:text(result.kind||'fact',20),knowledgeIds:ids.slice(0,6),knowledgeRefs:knowledgeReferences(ids),claimRefs:(result.claimRefs||[]).slice(0,8).map(c=>({id:text(c.id,40),type:text(c.type,20),text:text(c.text,600)})),model:result.model?text(result.model,80):null,latencyMs:Number.isFinite(result.latencyMs)?Math.max(0,result.latencyMs):null,usage:result.usage?Object.fromEntries(['prompt_tokens','completion_tokens','total_tokens'].map(k=>[k,Math.max(0,finite(result.usage[k]))])):null};
}
export function publishHostMessage(room,message){
 const old=Array.isArray(room.godHistory)?room.godHistory:[];
 room.godHistory=[...old.filter(item=>item.id!==message.id),message].slice(-16);
 room.god=message;
}
function publicReferences(message){
 return knowledgeReferences(message.knowledgeIds).map(current=>{
  const snapshot=Array.isArray(message.knowledgeRefs)?message.knowledgeRefs.find(ref=>ref.id===current.id):null;
  if(!snapshot)return current;
  return {id:current.id,title:text(snapshot.title||current.title,120),chapter:text(snapshot.chapter||current.chapter,80),section:text(snapshot.section||'',120),summary:text(snapshot.summary||current.summary,1600),source:text(snapshot.source||current.source,300),sourceType:text(snapshot.sourceType||current.sourceType,40),version:text(snapshot.version||current.version,80)};
 });
}
export function publicHostMessage(message={},round=0){
 const ids=Array.isArray(message.knowledgeIds)?message.knowledgeIds:[];
 const references=publicReferences({...message,knowledgeIds:ids});
 const status=['generating','ready','fallback','error'].includes(message.status)?message.status:message.reason?'fallback':'ready';
 return {id:text(message.id||`legacy:${round}`,100),round:Math.max(0,Math.min(6,finite(message.round,round))),text:text(message.text||'主持正在等候开局。'),provider:message.provider==='deepseek'?'deepseek':'template',reason:message.reason?text(message.reason,80):null,status,generatedAt:typeof message.generatedAt==='string'?text(message.generatedAt,40):null,knowledgeIds:references.map(k=>k.id),knowledgeRefs:references,claimRefs:Array.isArray(message.claimRefs)?message.claimRefs.slice(0,8).map(c=>({id:text(c.id,40),type:text(c.type,20),text:text(c.text,600)})):[],model:message.model?text(message.model,80):null,latencyMs:Number.isFinite(message.latencyMs)?Math.max(0,message.latencyMs):null,usage:message.usage?Object.fromEntries(['prompt_tokens','completion_tokens','total_tokens'].map(k=>[k,Math.max(0,finite(message.usage[k]))])):null};
}
export const publicHostHistory=room=>(Array.isArray(room.godHistory)?room.godHistory:[]).slice(-16).map(m=>publicHostMessage(m,room.game?.round||0));
