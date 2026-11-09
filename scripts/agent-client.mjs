/** Transport helper for the player's own Codex. This is NOT an LLM or a bot. */
import {readFileSync} from 'node:fs';
const base=process.env.GROWTH_URL||'http://127.0.0.1:3001';
const room=process.env.GROWTH_ROOM_ID,credential=process.env.GROWTH_AGENT_TOKEN;
if(!room||!credential){console.error('Set GROWTH_ROOM_ID and GROWTH_AGENT_TOKEN in your own shell. Never share the token.');process.exit(1);}
const command=process.argv[2]||'check',paths={check:'check',state:'state',inbox:'inbox',submit:'action'};
if(!paths[command]){console.error('Usage: node scripts/agent-client.mjs check|state|inbox|submit');process.exit(1);}
let body;
if(command==='submit') {body=JSON.parse(readFileSync(0,'utf8'));body.requestId ||= crypto.randomUUID();}
const url=new URL(`/api/rooms/${encodeURIComponent(room)}/agent/${paths[command]}`,base);
const res=await fetch(url,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${credential}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
const result=await res.json();console.log(JSON.stringify(result,null,2));if(!res.ok)process.exitCode=1;
