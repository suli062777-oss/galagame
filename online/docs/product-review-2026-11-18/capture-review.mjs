import {createServer} from '../../server/api.js';
import {templateNarration} from '../../worker/god-contract.js';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';

const output=resolve('docs/product-review-2026-11-18');
const detailsMode=process.argv.includes('--details');
const reportName=detailsMode?'details-evidence.json':'browser-evidence.json';
await mkdir(join(output,'screenshots'),{recursive:true});
const scratch=await mkdtemp(join(tmpdir(),'growth-review-'));
const profile=join(scratch,'chrome');
const server=createServer({dataDir:join(scratch,'data'),godNarrate:state=>templateNarration(state,'template-mode'),godStatus:()=>({configuredProvider:'template',enabled:false,keyConfigured:false,calls:0,limit:12})});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const local='http://127.0.0.1:'+server.address().port;
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--use-angle=swiftshader','--enable-unsafe-swiftshader','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const report={date:'2026-11-18',liveVersion:8,scope:'Live public pages read-only; local real API practice with three script seats and template narration; Chrome software WebGL, desktop emulation of mobile, no model calls and no public rooms created',screens:[],journey:[],errors:[]};
let ws;
try{
 let port;for(let i=0;i<100;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await pause(100);}}
 if(!port)throw Error('No browser debugger');
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 let id=0;const pending=new Map();
 ws.addEventListener('message',e=>{const d=JSON.parse(e.data);if(d.id){const p=pending.get(d.id);if(p){clearTimeout(p.timer);pending.delete(d.id);d.error?p.reject(Error(JSON.stringify(d.error))):p.resolve(d.result);}}else if(d.method==='Runtime.exceptionThrown')report.errors.push(d.params.exceptionDetails.text);});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject,timer:setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout '+method));},20000)});ws.send(JSON.stringify({id:n,method,params}));});
 const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const waitFor=async(expression,ms=12000)=>{const start=Date.now();while(Date.now()-start<ms){if(await evaluate(expression))return;await pause(120);}throw Error('Wait failed: '+expression);};
 const navigate=async(url,selector)=>{await cdp('Page.navigate',{url});await waitFor('!!document.querySelector('+JSON.stringify(selector)+')',20000);await evaluate('document.fonts.ready.then(()=>true)');await pause(180);};
 const size=async(width,height=900)=>{await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await pause(140);};
 const click=async selector=>{const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control');e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();if(!r.width||!r.height)throw Error('Hidden control');return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await pause(180);};
 const capture=async(name,source='local',full=true)=>{
  await evaluate('window.scrollTo(0,0)');await pause(200);
  const details=await evaluate(`(()=>{const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&r.top<innerHeight&&r.bottom>0;};return{url:location.href,width:innerWidth,height:innerHeight,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,phase:document.body.dataset.gamePhase||null,headings:[...document.querySelectorAll('h1,h2,h3')].map(x=>x.textContent.trim()),visibleActions:[...document.querySelectorAll('button,a,summary')].filter(visible).map(x=>x.textContent.trim()).filter(Boolean),text:document.body.innerText.slice(0,24000)};})()`);
  if(source==='official-reference'){delete details.text;delete details.visibleActions;details.headings=details.headings.slice(0,1);details.note='Public page appearance only; no raw article text retained. Challenge/loading screens do not prove access to product UI.';}
  const png=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:full,clip:{x:0,y:0,width:details.width,height:full?Math.min(details.scrollHeight,6000):details.height,scale:1}});
  const file=join(output,'screenshots',name+'.png');await writeFile(file,Buffer.from(png.data,'base64'));report.screens.push({name,source,file,...details});await writeFile(join(output,reportName),JSON.stringify(report,null,2));console.log('Captured '+name);
 };
 await cdp('Runtime.enable');await cdp('Page.enable');
 await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const original=window.fetch;window.fetch=async(...args)=>{const r=await original(...args);if(r.headers.get('content-type')?.includes('application/json')&&r.status!==304)r.clone().json().then(d=>{if(d.state)window.__reviewState=d.state;}).catch(()=>{});return r;};})();`});
 if(detailsMode){
  await size(390,844);await navigate(local+'/#/tavern','.tavern-landing');
  report.entryMetrics=await evaluate(`(()=>{const input=document.querySelector('#room-form input[name=name]'),button=document.querySelector('#room-form button[type=submit]'),i=getComputedStyle(input),p=getComputedStyle(input,'::placeholder'),b=button.getBoundingClientRect();return{viewport:{width:innerWidth,height:innerHeight},input:{background:i.backgroundColor,color:i.color,placeholder:p.color,parentBackground:getComputedStyle(input.closest('.tavern-entry')).backgroundColor},button:{top:b.top,bottom:b.bottom,height:b.height},initiallyVisible:b.top<innerHeight&&b.bottom>0};})()`);
  await size(1440,900);await navigate(local+'/#/notes','.notes-page');
  await evaluate(`(()=>{const f=document.querySelector('#note-form');const inputs=[...document.querySelectorAll('textarea')];inputs[0].value='课堂评审草稿：暂不保存';inputs[0].dispatchEvent(new Event('input',{bubbles:true}));})()`);
  report.noteDraftBefore=await evaluate("document.querySelector('textarea').value");
  await evaluate("location.hash='/map'");await waitFor("!!document.querySelector('.map-page')");await evaluate("location.hash='/notes'");await waitFor("!!document.querySelector('.notes-page')");
  report.noteDraftAfter=await evaluate("document.querySelector('textarea').value");report.noteDraftLost=report.noteDraftAfter!==report.noteDraftBefore;
  for(const [name,url] of [['ref-lichess-analysis','https://lichess.org/analysis'],['ref-stripe-press','https://stripe.press/'],['ref-linear-design','https://linear.app/now/behind-the-latest-design-refresh']]){
   try{await navigate(url,'body');await pause(1800);await capture(name,'official-reference',false);}catch(error){report.errors.push(name+': '+error.message);}
  }
  report.finished=true;
 }else{
 await size(1440,900);
 try{await navigate('https://growth-tavern-suli-demo.zheiisu.chatgpt.site/#/home','.home-page');await capture('live-home-desktop','live');await navigate('https://growth-tavern-suli-demo.zheiisu.chatgpt.site/#/tavern','.tavern-landing');await capture('live-entry-desktop','live');}catch(error){report.liveLimitation=error.message;console.log('Live capture limitation: '+error.message);}
 for(const [route,selector] of [['home','.home-page'],['tavern','.tavern-landing'],['map','.map-page'],['read/experiments','.read-page'],['lab','.lab-page'],['cases','.cases-page'],['notes','.notes-page']]){
  try{await navigate(local+'/#/'+route,selector);await capture('desktop-'+route.replace('/','-'));}catch(error){report.errors.push(route+': '+error.message);console.log(route+': '+error.message);}
 }
 await size(390,844);
 for(const [route,selector] of [['home','.home-page'],['tavern','.tavern-landing'],['read/experiments','.read-page']]){await navigate(local+'/#/'+route,selector);await capture('mobile-'+route.replace('/','-'));}
 await size(1440,900);await navigate(local+'/#/tavern','.tavern-landing');
 await click('[data-action="entry-mode"][data-mode="join"]');await capture('desktop-entry-join');await click('[data-action="entry-mode"][data-mode="create"]');
 await evaluate(`(()=>{const f=document.querySelector('#room-form');f.elements.name.value='首次体验评审';f.elements.mode.value='practice';f.requestSubmit();})()`);
 await waitFor("window.__reviewState?.phase==='lobby'&&!!document.querySelector('.v3-room')",20000);await pause(1200);await capture('desktop-room-lobby');
 await click('[data-action="start"]');await waitFor("['preparing','decision'].includes(window.__reviewState?.phase)");
 const advance=async()=>{
  if(await evaluate("!!document.querySelector('#modal[open]')"))await click('#modal [data-action="close-modal"]');
  if(await evaluate("innerWidth<=680&&window.__reviewState?.phase==='decision'&&document.querySelector('.v3-room').dataset.actionOpen!=='true'"))await click('[data-action="toggle-action-sheet"]');
  if(await evaluate("!!document.querySelector('.action-options:not([open]) [data-action=advance]')"))await click('.action-options > summary');
  const before=await evaluate("[window.__reviewState.phase,window.__reviewState.round,window.__reviewState.history?.length].join(':')");await click('[data-action="advance"]');await waitFor("[window.__reviewState.phase,window.__reviewState.round,window.__reviewState.history?.length].join(':')!=="+JSON.stringify(before));
 };
 for(let round=1;round<=6;round++){
  if(await evaluate("window.__reviewState.phase==='preparing'"))await advance();
  await waitFor("window.__reviewState?.phase==='decision'&&!!document.querySelector('#action-form')");
  if(round===1){
   await capture('desktop-first-decision');
   await click('[data-action="host-latest"]');await capture('desktop-host-detail');await click('#modal [data-action="close-modal"]');
   await size(390,844);await capture('mobile-first-decision', 'local', false);await click('[data-action="toggle-action-sheet"]');await capture('mobile-action-sheet','local',false);await click('[data-action="close-action-sheet"]');await size(1440,900);
  }
  await evaluate("document.querySelector('#action-form').requestSubmit()");await waitFor("document.querySelector('#receipt-status')?.dataset.state==='accepted'");
  if(round===1)await capture('desktop-action-accepted');
  report.journey.push(await evaluate("({round:window.__reviewState.round,phase:window.__reviewState.phase,action:window.__reviewState.me.action?.id,receipt:document.querySelector('#receipt-status')?.innerText})"));
  await advance();await pause(180);
 }
 await waitFor("window.__reviewState?.phase==='finished'",20000);await capture('desktop-finished');await size(390,844);await capture('mobile-finished');
 report.finished=true;report.modelCalls=0;
 }
}catch(error){report.fatal=error.stack;console.log('Capture stopped: '+error.message);}
finally{
 if(ws)ws.close();chrome.kill();await new Promise(r=>server.close(r));await pause(900);
 const resolved=resolve(scratch),tempRoot=resolve(tmpdir());if(resolved.startsWith(tempRoot+sep)&&resolved.slice(tempRoot.length+1).startsWith('growth-review-')){try{await rm(resolved,{recursive:true,force:true});}catch{}}
 await writeFile(join(output,reportName),JSON.stringify(report,null,2));console.log(JSON.stringify({screens:report.screens.length,finished:report.finished||false,errors:report.errors,fatal:report.fatal||null,output}));
}
