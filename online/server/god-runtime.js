import {createHash} from 'node:crypto';
import {knowledge,HOST_PROMPT,buildGodInput,modelNarrationInput,validateHostOutput,renderHostOutput,templateNarration} from '../worker/god-contract.js';
export {knowledge,HOST_PROMPT,buildGodInput,validateHostOutput,renderHostOutput,templateNarration};

export function createGodHost({env=process.env,fetchImpl=(...args)=>globalThis.fetch(...args),onSample=null}={}){
 const allowed=env.GOD_PROVIDER==='deepseek'&&env.GOD_ALLOW_PAID_CALLS==='true'&&Boolean(env.DEEPSEEK_API_KEY);
 const unlimited=String(env.GOD_MAX_CALLS||'').toLowerCase()==='unlimited';
 const raw=Number(env.GOD_MAX_CALLS??12),limit=unlimited?null:Math.max(0,Math.min(12,Number.isFinite(raw)?Math.floor(raw):12));
 let calls=0,busy=0,lastResult=null,lastSuccessAt=null,lastLatencyMs=null,queue=Promise.resolve();
 const reportedUsage={prompt_tokens:0,completion_tokens:0,total_tokens:0},cache=new Map();
 const sample=value=>{if(typeof onSample==='function')onSample(value);};
 async function execute(state,input){
  if(!allowed)return templateNarration(state,'calls-disabled');
  if(limit!==null&&calls>=limit)return templateNarration(state,'call-limit');
  const base=(env.DEEPSEEK_BASE_URL||'https://api.deepseek.com').replace(/\/$/,'');
  if(!['https://api.deepseek.com','https://api.deepseek.com/v1'].includes(base))return templateNarration(state,'invalid-config');
  busy++;
  try{
   for(let attempt=0;attempt<2;attempt++){
    if(limit!==null&&calls>=limit)return templateNarration(state,'call-limit');
    calls++;
    const controller=new AbortController(),timeout=Math.max(100,Math.min(30000,Number(env.GOD_TIMEOUT_MS)||12000)),start=performance.now(),timer=setTimeout(()=>controller.abort(),timeout);
    let rawOutput='',usage={prompt_tokens:0,completion_tokens:0,total_tokens:0},httpStatus=null;
    try{
     const response=await fetchImpl(base+'/chat/completions',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.DEEPSEEK_API_KEY},body:JSON.stringify({model:env.DEEPSEEK_MODEL||'deepseek-flash',messages:[{role:'system',content:HOST_PROMPT},{role:'user',content:JSON.stringify(modelNarrationInput(input))}],response_format:{type:'json_object'},max_tokens:Math.max(128,Math.min(1200,Number(env.GOD_MAX_TOKENS)||600)),temperature:0.7,thinking:{type:'disabled'},stream:false}),signal:controller.signal});
     httpStatus=response.status;
     if(response.status>=300&&response.status<400)return templateNarration(state,'unexpected-redirect');
     if(!response.ok){sample({attempt,httpStatus,latencyMs:performance.now()-start,usage,error:'http-error'});if(attempt===0&&(response.status===429||response.status>=500))continue;return templateNarration(state,({401:'authentication-error',402:'insufficient-balance',429:'rate-limited'})[response.status]||'provider-error');}
     const payload=await response.json(),choice=payload.choices?.[0];
     for(const k of Object.keys(usage)){usage[k]=Number.isFinite(Number(payload.usage?.[k]))?Math.max(0,Math.floor(Number(payload.usage[k]))):0;reportedUsage[k]+=usage[k];}
     rawOutput=typeof choice?.message?.content==='string'?choice.message.content:'';
     if(choice?.finish_reason==='length'){sample({attempt,httpStatus,rawOutput,usage,latencyMs:performance.now()-start,error:'truncated-output'});return templateNarration(state,'truncated-output');}
     if(!rawOutput.trim())throw new Error('HOST_EMPTY');
     const value=validateHostOutput(JSON.parse(rawOutput),env.GOD_NATURAL_REQUIRED==='false'?input:modelNarrationInput(input),{requireNatural:env.GOD_NATURAL_REQUIRED!=='false'});
     const result={provider:'deepseek',text:renderHostOutput(value,input),kind:value.kind,knowledgeIds:value.knowledgeIds,claimRefs:value.claimIds.map(id=>input.claims.find(c=>c.id===id)),model:payload.model||env.DEEPSEEK_MODEL||'deepseek-flash',usage,latencyMs:performance.now()-start};
     sample({attempt,httpStatus,rawOutput,usage,latencyMs:result.latencyMs,accepted:true});
     return result;
    }catch(error){
     const code=error.name==='AbortError'?'timeout':/^[A-Z_0-9]{3,80}$/.test(error.message)?error.message:'invalid-response';
     sample({attempt,httpStatus,rawOutput,usage,latencyMs:performance.now()-start,error:code});
     return {...templateNarration(state,error.name==='AbortError'?'timeout':'invalid-response'),validationError:code};
    }finally{clearTimeout(timer);lastLatencyMs=performance.now()-start;}
   }
   return templateNarration(state,'provider-error');
  }finally{busy--;}
 }
 return {narrate(state){const input=buildGodInput(state),key=createHash('sha256').update(JSON.stringify(input)).digest('hex');if(cache.has(key))return cache.get(key);const pending=queue.then(()=>execute(state,input)).then(result=>{lastResult={provider:result.provider,reason:result.reason||null};if(result.provider==='deepseek')lastSuccessAt=new Date().toISOString();return result;});queue=pending.catch(()=>{});cache.set(key,pending);if(cache.size>100)cache.delete(cache.keys().next().value);return pending;},status(){return {configuredProvider:env.GOD_PROVIDER==='deepseek'?'deepseek':'template',keyConfigured:Boolean(env.DEEPSEEK_API_KEY),enabled:allowed,model:env.DEEPSEEK_MODEL||'deepseek-flash',calls,limit,unlimited,budgetMode:unlimited?'unlimited':'limited',remaining:unlimited?null:Math.max(0,limit-calls),busy,lastResult,lastSuccessAt,lastLatencyMs,reportedUsage:{...reportedUsage},budgetPersistence:'process-local'};}};
}
