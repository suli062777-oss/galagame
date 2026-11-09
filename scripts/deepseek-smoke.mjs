// This makes a real, potentially billable request only after explicit opt-in.
import {createGodHost} from '../server/god.js';
if(process.env.GOD_ALLOW_PAID_CALLS!=='true'||process.env.GOD_PROVIDER!=='deepseek'||!process.env.DEEPSEEK_API_KEY){console.error('Not run: set provider, local key and explicit paid-call opt-in after authorization.');process.exit(2);}
const host=createGodHost();const result=await host.narrate({phase:'lobby',round:0,players:[],world:[]});
console.log(JSON.stringify({provider:result.provider,reason:result.reason||null,text:result.text,calls:host.status().calls},null,2));
if(result.provider!=='deepseek')process.exitCode=1;
