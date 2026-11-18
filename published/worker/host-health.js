const clean=(v,n=80)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').slice(0,n);
const nonnegative=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
export function sanitizeHostStatus(s={}){
 const unlimited=s.unlimited===true||s.budgetMode==='unlimited',calls=nonnegative(s.calls),limit=unlimited?null:nonnegative(s.limit);
 return {configuredProvider:s.configuredProvider==='deepseek'?'deepseek':'template',keyConfigured:s.keyConfigured===true,enabled:s.enabled===true,model:clean(s.model||'deepseek-flash'),calls,limit,unlimited,budgetMode:unlimited?'unlimited':'limited',remaining:unlimited?null:Math.max(0,limit-calls),busy:nonnegative(s.busy),lastResult:s.lastResult?{provider:s.lastResult.provider==='deepseek'?'deepseek':'template',reason:s.lastResult.reason?clean(s.lastResult.reason,60):null}:null,lastSuccessAt:typeof s.lastSuccessAt==='string'?clean(s.lastSuccessAt,40):null,lastLatencyMs:Number.isFinite(s.lastLatencyMs)?Math.max(0,s.lastLatencyMs):null,reportedUsage:Object.fromEntries(['prompt_tokens','completion_tokens','total_tokens'].map(k=>[k,nonnegative(s.reportedUsage?.[k])])),budgetPersistence:clean(s.budgetPersistence||'unknown',30)};
}
