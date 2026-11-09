// Read-only provider discovery. No chat/completions or generated tokens.
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export async function checkDeepSeek({env=process.env,fetchImpl=globalThis.fetch}={}) {
  const model=env.DEEPSEEK_MODEL||'deepseek-flash';
  if(!env.DEEPSEEK_API_KEY)return {ok:false,keyConfigured:false,reason:'missing-key',generationRequests:0};
  const base=(env.DEEPSEEK_BASE_URL||'https://api.deepseek.com').replace(/\/$/,'');
  if(!['https://api.deepseek.com','https://api.deepseek.com/v1'].includes(base))return {ok:false,keyConfigured:true,reason:'invalid-provider-origin',generationRequests:0};
  const result={checkedAt:new Date().toISOString(),keyConfigured:true,configuredModel:model,metadataRequests:0,generationRequests:0};
  for(const endpoint of ['/models','/user/balance']){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try{
      result.metadataRequests++;
      const response=await fetchImpl(base+endpoint,{headers:{Authorization:`Bearer ${env.DEEPSEEK_API_KEY}`},redirect:'error',signal:controller.signal});
      const field=endpoint==='/models'?'models':'balance';
      result[field+'HttpStatus']=response.status;
      if(!response.ok){result[field+'Reason']=({401:'authentication-error',402:'insufficient-balance',429:'rate-limited'})[response.status]||'provider-error';continue;}
      const payload=await response.json();
      if(endpoint==='/models'){
        result.models=Array.isArray(payload.data)?payload.data.map(m=>String(m.id||'')).filter(id=>/^[a-zA-Z0-9_.:-]{1,100}$/.test(id)):[];
        result.configuredModelAvailable=result.models.includes(model);
      }else result.balanceAvailable=payload.is_available===true;
    }catch(error){result.reason=error.name==='AbortError'?'timeout':'network-error';}
    finally{clearTimeout(timer);}
  }
  result.ok=result.modelsHttpStatus===200&&result.configuredModelAvailable===true;
  return result;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=await checkDeepSeek();
  if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n',{encoding:'utf8',flag:'wx'});
  console.log(JSON.stringify(result,null,2));
  if(!result.ok)process.exitCode=1;
}
