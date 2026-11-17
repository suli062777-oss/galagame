import {templateNarration} from '../worker/god-contract.js';
import {createGodHost} from '../server/god-runtime.js';
/** Local-only preview. Production Worker and its persisted model budget are untouched. */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server/api.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const evidence=path.join(root,'docs/evidence');
await fs.mkdir(evidence,{recursive:true});
const port=Number(process.env.PORT||3020);
const realGod=process.env.QA_REAL_GOD==='1',host=realGod?createGodHost():null;
if(realGod&&!host.status().enabled)throw Error('Real QA requires an explicitly configured server-side DeepSeek provider.');
const server=createServer({dataDir:path.join(root,realGod?'data/dev-real':'data/dev'),godNarrate:state=>host?host.narrate(state):templateNarration(state,'template-mode'),godStatus:()=>host?host.status():({configuredProvider:'template',enabled:false,keyConfigured:false,calls:0,limit:12,model:null})});
const original=server.listeners('request')[0];server.removeListener('request',original);
function clean(value){if(Array.isArray(value))return value.map(clean);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!/^(token|agentToken|humanHash|agentHash|authorization|secret|apiKey)$/i.test(key)).map(([k,v])=>[k,clean(v)]));return typeof value==='string'?value.replace(/sk-[A-Za-z0-9_-]{20,}/g,'[redacted]'):value;}
server.on('request',async(req,res)=>{
 try{
  const url=new URL(req.url,`http://localhost:${port}`);
  if(url.pathname==='/__qa/version'){
   const files=['public/app.js','public/tavern-v3.css','public/roundtable.css','public/roundtable-scene.js','public/tavern-models.js','public/tavern-environment.js','public/scene-runtime.js','scripts/qa-v6-browser.mjs'];
   const version=await Promise.all(files.map(async file=>{const s=await fs.stat(path.join(root,file));return [file,s.mtimeMs,s.size];}));
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({bootId:process.pid,files:version}));
  }
  if(url.pathname==='/__qa/viewport'){
   const width=Math.max(320,Math.min(1920,Number(url.searchParams.get('width'))||1440));
   const height=Math.max(600,Math.min(1200,Number(url.searchParams.get('height'))||900));
   const capture=url.searchParams.get('capture')==='1';
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
   return res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>酒馆V3 · 浏览器验证</title><style>body{margin:0;background:#141310;color:#eee9dd;font:14px/1.5 system-ui}header{padding:12px 18px;display:flex;justify-content:space-between;gap:12px}a{color:#dc9b70}#host{position:relative;margin:auto;overflow:hidden}iframe{border:1px solid #544737;transform-origin:top left;background:#141310}#state{color:#bbae99}</style><header><span>酒馆 V3 · 实际浏览器验证 <b id="size"></b></span><span id="state">准备场景</span><a id="direct" target="_blank">全尺寸打开</a></header><div id="host"></div><script>
const sizes=[[${width},${height}],[390,844],[360,800],[1280,800]],captureFirst=${capture},host=document.querySelector('#host');let index=0,frame,captureAttempted=false,currentVersion=null,checking=false;const reports=[];
function resize(){if(!frame)return;const [w,h]=sizes[index],scale=Math.min(1,(innerWidth-24)/w,(innerHeight-70)/h);frame.style.transform='scale('+scale+')';host.style.width=w*scale+'px';host.style.height=h*scale+'px';}
function load(){const [w,h]=sizes[index];document.querySelector('#size').textContent=w+' × '+h;document.querySelector('#state').textContent='测试进行中';if(frame)frame.remove();frame=document.createElement('iframe');frame.width=w;frame.height=h;const shouldCapture=captureFirst&&index===0&&!captureAttempted;const src='/?qa='+(shouldCapture?'capture':'child')+(shouldCapture?'&capture=1'+location.hash:'');frame.src=src;host.append(frame);document.querySelector('#direct').href=src;resize();}
addEventListener('resize',resize);addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='growth-v3-qa')return;const report=event.data.report;document.querySelector('#state').textContent=report.stage||'已接收报告';if(report.stage==='capture-ready')captureAttempted=true;if(report.stage==='failed'){reports.push(report);document.querySelector('#state').textContent='发现问题，等待修复后自动重测';return;}if(['complete','completed'].includes(report.stage)){reports.push(report);if(index<sizes.length-1){index++;setTimeout(load,1200);}else{document.querySelector('#state').textContent='多视口检查完成';fetch('/__qa/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stage:'viewport-matrix',reports})});}}});
setInterval(async()=>{if(checking)return;checking=true;try{const version=JSON.stringify(await(await fetch('/__qa/version')).json());if(currentVersion&&version!==currentVersion){index=0;reports.length=0;load();}currentVersion=version;}catch{}finally{checking=false;}},1800);load();
</script></html>`);
  }
  if(url.pathname==='/__qa/browser.js'){
   res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});
   return res.end(await fs.readFile(path.join(root,'scripts/qa-v6-browser.mjs')));
  }
  if(url.pathname==='/__qa/report'&&req.method==='POST'){
   const origin=req.headers.origin;if(origin&&!['http://localhost:'+port,'http://127.0.0.1:'+port].includes(origin)){res.writeHead(403);return res.end('Local QA only');}
   let raw='',size=0;for await(const part of req){size+=part.length;if(size>2e6){res.writeHead(413);return res.end('Report too large');}raw+=part;}
   const report=clean(JSON.parse(raw));report.receivedAt=new Date().toISOString();
   const content=JSON.stringify(report,null,2)+'\n';
   await fs.writeFile(path.join(evidence,'browser-qa.json'),content,'utf8');
   const tag=String(report.qaRunId||'run').replace(/[^\w-]/g,'').slice(0,64)+'-'+String(report.stage||'report').replace(/[^\w-]/g,'').slice(0,40);
   await fs.writeFile(path.join(evidence,'browser-qa-'+tag+'-'+Date.now()+'.json'),content,'utf8');
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end('{"ok":true}');
  }
  if(url.pathname==='/__qa/latest'){
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
   try{return res.end(await fs.readFile(path.join(evidence,'browser-qa.json')));}catch{return res.end('{"status":"waiting-for-browser"}');}
  }
  if(url.pathname==='/'||url.pathname==='/index.html'){
   let html=await fs.readFile(path.join(root,'public/index.html'),'utf8');
   if(url.searchParams.has('capture')&&!url.searchParams.has('qa'))html=html.replace('</head>','<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script></head>');
   if(url.searchParams.has('qa'))html=html.replace('</body>','<script type="module" src="/__qa/browser.js"></script></body>');
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(html);
  }
  return original(req,res);
 }catch(error){res.writeHead(500,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok:false,error:error.message}));}
});
server.listen(port,'127.0.0.1',()=>console.log(`Growth Tavern V6 http://localhost:${port}/#/tavern · real local rooms · ${realGod?'real DeepSeek server host':'template host · no paid calls'}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
