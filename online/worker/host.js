import {buildGodInput,HOST_PROMPT,validateHostOutput,renderHostOutput,templateNarration} from './god-contract.js';
import {mutateRoom} from './storage.js';
import {projectPublic} from './api.js';
const cap=env=>{const n=Number(env.GOD_MAX_CALLS??12);return Number.isFinite(n)?Math.max(0,Math.min(12,Math.floor(n))):12;};
const scopeOf=env=>/^[a-zA-Z0-9_-]{1,80}$/.test(env.GOD_BUDGET_ID||'')?env.GOD_BUDGET_ID:'online-20261109-v2';
const enabled=env=>env.GOD_PROVIDER==='deepseek'&&env.GOD_ALLOW_PAID_CALLS==='true'&&Boolean(env.DEEPSEEK_API_KEY);
const economicKey=room=>`${room.game.round}:${room.game.history.length}`;
const change=r=>Number(r?.meta?.changes||0)>0;
async function ensureBudget(env,scope){await env.DB.prepare('INSERT OR IGNORE INTO host_budget (scope,calls,updated_at) VALUES (?,0,?)').bind(scope,Date.now()).run();}
export async function hostStatus(env){
 const scope=scopeOf(env),limit=cap(env);let row=null;
 if(env.DB)row=await env.DB.prepare('SELECT * FROM host_budget WHERE scope=?').bind(scope).first();
 let result=null;try{result=row?.last_result?JSON.parse(row.last_result):null;}catch{}
 return {configuredProvider:env.GOD_PROVIDER==='deepseek'?'deepseek':'template',keyConfigured:Boolean(env.DEEPSEEK_API_KEY),enabled:enabled(env),model:env.DEEPSEEK_MODEL||'deepseek-flash',calls:Number(row?.calls||0),limit,remaining:Math.max(0,limit-Number(row?.calls||0)),busy:row?.lease_token&&Number(row.lease_until)>Date.now()?1:0,lastResult:result,lastSuccessAt:row?.last_success_at||null,lastLatencyMs:row?.last_latency_ms??null,reportedUsage:{prompt_tokens:Number(row?.prompt_tokens||0),completion_tokens:Number(row?.completion_tokens||0),total_tokens:Number(row?.total_tokens||0)},budgetPersistence:'shared-d1'};
}
async function claimJob(env,id,room,key,now){
 await env.DB.prepare("INSERT OR IGNORE INTO host_jobs (id,room_id,economic_key,status,lease_until,created_at,updated_at) VALUES (?,?,?,'pending',0,?,?)").bind(id,room.id,key,now,now).run();
 return change(await env.DB.prepare("UPDATE host_jobs SET status='working',lease_until=?,updated_at=? WHERE id=? AND (status='pending' OR (status='working' AND lease_until<?))").bind(now+45000,now,id,now).run());
}
async function providerNarration(room,env,{fetchImpl,clock}){
 const state=projectPublic(room),input=buildGodInput(state),scope=scopeOf(env),limit=cap(env);
 if(!enabled(env))return templateNarration(state,'calls-disabled');
 const base=(env.DEEPSEEK_BASE_URL||'https://api.deepseek.com').replace(/\/$/,'');
 if(!['https://api.deepseek.com','https://api.deepseek.com/v1'].includes(base))return templateNarration(state,'invalid-config');
 await ensureBudget(env,scope);
 const lease=crypto.randomUUID(),now=clock();
 const acquired=await env.DB.prepare('UPDATE host_budget SET lease_token=?,lease_until=?,updated_at=? WHERE scope=? AND calls<? AND (lease_token IS NULL OR lease_until<?)').bind(lease,now+45000,now,scope,limit,now).run();
 if(!change(acquired)){
  const current=await env.DB.prepare('SELECT calls FROM host_budget WHERE scope=?').bind(scope).first();
  return templateNarration(state,Number(current?.calls||0)>=limit?'call-limit':'concurrency-limit');
 }
 let final=templateNarration(state,'provider-error'),lastLatency=null;
 try{
  for(let attempt=0;attempt<2;attempt++){
   const reserved=await env.DB.prepare('UPDATE host_budget SET calls=calls+1,updated_at=? WHERE scope=? AND lease_token=? AND calls<?').bind(clock(),scope,lease,limit).run();
   if(!change(reserved)){final=templateNarration(state,'call-limit');break;}
   const controller=new AbortController(),timeout=Math.max(100,Math.min(12000,Number(env.GOD_TIMEOUT_MS)||12000)),timer=setTimeout(()=>controller.abort(),timeout),start=clock();
   try{
    const response=await fetchImpl(`${base}/chat/completions`,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.DEEPSEEK_API_KEY}`},signal:controller.signal,body:JSON.stringify({model:env.DEEPSEEK_MODEL||'deepseek-flash',messages:[{role:'system',content:HOST_PROMPT},{role:'user',content:JSON.stringify(input)}],response_format:{type:'json_object'},max_tokens:Math.max(64,Math.min(220,Number(env.GOD_MAX_TOKENS)||220)),stream:false,thinking:{type:'disabled'}})});
    if(response.status>=300&&response.status<400){final=templateNarration(state,'unexpected-redirect');break;}
    if(!response.ok){if(attempt===0&&(response.status===429||response.status>=500))continue;final=templateNarration(state,({401:'authentication-error',402:'insufficient-balance',429:'rate-limited'})[response.status]||'provider-error');break;}
    const payload=await response.json(),choice=payload?.choices?.[0],text=choice?.message?.content;
    const use=k=>Number.isFinite(Number(payload.usage?.[k]))?Math.max(0,Math.floor(Number(payload.usage[k]))):0;
    await env.DB.prepare('UPDATE host_budget SET prompt_tokens=prompt_tokens+?,completion_tokens=completion_tokens+?,total_tokens=total_tokens+? WHERE scope=?').bind(use('prompt_tokens'),use('completion_tokens'),use('total_tokens'),scope).run();
    if(choice?.finish_reason==='length'){final=templateNarration(state,'truncated-output');break;}
    if(typeof text!=='string'||!text.trim()){final=templateNarration(state,'empty-output');break;}
    const result=validateHostOutput(JSON.parse(text),input);
    final={provider:'deepseek',text:renderHostOutput(result,input),kind:result.kind,knowledgeIds:result.knowledgeIds};break;
   }catch(error){
    const message=String(error?.message||'').split(String(env.DEEPSEEK_API_KEY||'__no_key__')).join('[redacted]').replace(/Bearer\s+\S+/gi,'Bearer [redacted]').slice(0,200);
    console.warn('host_provider_failure',JSON.stringify({name:error?.name||'Error',message}));
    final=templateNarration(state,error.name==='AbortError'?'timeout':'invalid-response');break;
   }
   finally{clearTimeout(timer);lastLatency=Math.max(0,clock()-start);}
  }
  return final;
 }finally{
  const success=final.provider==='deepseek'?new Date(clock()).toISOString():null;
  await env.DB.prepare('UPDATE host_budget SET lease_token=NULL,lease_until=0,last_result=?,last_success_at=COALESCE(?,last_success_at),last_latency_ms=?,updated_at=? WHERE scope=? AND lease_token=?').bind(JSON.stringify({provider:final.provider,reason:final.reason||null}),success,lastLatency,clock(),scope,lease).run();
 }
}
export async function processNarration(room,env,{fetchImpl=(...args)=>globalThis.fetch(...args),clock=()=>Date.now()}={}){
 const key=economicKey(room),scope=scopeOf(env),id=`${scope}:${room.id}:${key}`;
 if(room.hostedEconomicKey===key&&room.hostedScope===scope)return {skipped:true};
 if(!await claimJob(env,id,room,key,clock()))return {skipped:true};
 try{
  const result=await providerNarration(room,env,{fetchImpl,clock});
  await mutateRoom(env,room.id,current=>{
   if(economicKey(current)!==key)return false;
   current.god={provider:result.provider==='deepseek'?'deepseek':'template',text:String(result.text||'').slice(0,1600),reason:result.reason||null,knowledgeIds:result.knowledgeIds||[]};current.hostedEconomicKey=key;current.hostedScope=scope;
  });
  await env.DB.prepare("UPDATE host_jobs SET status='done',lease_until=0,updated_at=? WHERE id=?").bind(clock(),id).run();
  return result;
 }catch{
  await env.DB.prepare("UPDATE host_jobs SET status='done',lease_until=0,updated_at=? WHERE id=?").bind(clock(),id).run();
  return {provider:'template',reason:'host-unavailable'};
 }
}
export function scheduleNarration(room,env,ctx){const task=processNarration(room,env);if(ctx?.waitUntil)ctx.waitUntil(task);return task;}
