import {createServer} from '../server/api.js';
import {templateNarration} from '../worker/god-contract.js';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';

const output=resolve('docs/evidence/classroom-20261118/functional');
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
const report={date:'2026-11-18',candidateBuild:"20261118-classroom",scope:'Actual local UI with real API and template narration; viewport captures only; no live site mutation or paid calls',screens:[],journey:[],errors:[]};
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
 const capture=async(name,source='local',full=false)=>{
  await evaluate('window.scrollTo(0,0)');await pause(200);
  const details=await evaluate(`(()=>{const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&r.top<innerHeight&&r.bottom>0;};return{url:location.href,width:innerWidth,height:innerHeight,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,phase:document.body.dataset.gamePhase||null,headings:[...document.querySelectorAll('h1,h2,h3')].map(x=>x.textContent.trim()),visibleActions:[...document.querySelectorAll('button,a,summary')].filter(visible).map(x=>x.textContent.trim()).filter(Boolean),text:document.body.innerText.slice(0,24000)};})()`);
  if(source==='official-reference'){delete details.text;delete details.visibleActions;details.headings=details.headings.slice(0,1);details.note='Public page appearance only; no raw article text retained. Challenge/loading screens do not prove access to product UI.';}
  const png=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:full,clip:{x:0,y:0,width:details.width,height:full?Math.min(details.scrollHeight,6000):details.height,scale:1}});
  const file=join(output,'screenshots',name+'.png');await writeFile(file,Buffer.from(png.data,'base64'));report.screens.push({name,source,file,...details});await writeFile(join(output,reportName),JSON.stringify(report,null,2));console.log('Captured '+name);
 };
 await cdp('Runtime.enable');await cdp('Page.enable');
 await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const original=window.fetch;window.fetch=async(...args)=>{const r=await original(...args);if(r.headers.get('content-type')?.includes('application/json')&&r.status!==304)r.clone().json().then(d=>{if(d.state)window.__reviewState=d.state;}).catch(()=>{});return r;};})();`});

 report.tests=[];const assert=(value,message)=>{if(!value)throw Error(message);};
 const check=async(name,fn)=>{await fn();report.tests.push({name,passed:true});console.log('PASS '+name);};
 const close=async()=>{if(await evaluate("!!document.querySelector('#modal[open]')"))await click('#modal [data-action="close-modal"]');if(await evaluate("document.querySelector('.v3-room')?.dataset.actionOpen==='true'"))await click('[data-action="close-action-sheet"]');};
 const openAction=async()=>{if(await evaluate("innerWidth<=900&&document.querySelector('.v3-room')?.dataset.actionOpen!=='true'"))await click('[data-action="toggle-action-sheet"]');};
 const advance=async()=>{await close();if(await evaluate("window.__reviewState.phase==='decision'"))await openAction();if(await evaluate("!!document.querySelector('.action-options:not([open]) [data-action=advance]')"))await click('.action-options > summary');const before=await evaluate("[window.__reviewState.phase,window.__reviewState.round,window.__reviewState.history?.length].join(':')");await click('[data-action="advance"]');await waitFor("[window.__reviewState.phase,window.__reviewState.round,window.__reviewState.history?.length].join(':')!=="+JSON.stringify(before));};
 await size(1440,1000);await navigate(local+'/#/home','.classroom-home');
 await check('Home uses real new hero and actual product preview',async()=>{assert(await evaluate("document.querySelector('.hero-art img').complete&&document.querySelector('.hero-art img').naturalWidth>0"),'hero');assert(await evaluate("!!document.querySelector('.classroom-product-preview img')"),'real preview');});await capture('home-desktop');
 await navigate(local+'/#/tavern','.classroom-landing');await click('[data-action="entry-mode"][data-mode="practice"]');
 await evaluate("(()=>{const f=document.querySelector('#room-form');f.elements.name.value='课堂功能验收';f.requestSubmit();})()");await waitFor("window.__reviewState?.phase==='lobby'&&!!document.querySelector('.v3-room')",20000);
 await check('Actual practice has three script seats and actual product mission',async()=>{assert(await evaluate("window.__reviewState.players.length===4&&window.__reviewState.players.filter(p=>p.isBot).length===3"),'seats');assert(await evaluate("document.querySelector('.classroom-mission').textContent.includes(window.__reviewState.product.coreBehavior)"),'actual core behavior');});await capture('room-lobby');
 await click('[data-action="start"]');await waitFor("['preparing','decision'].includes(window.__reviewState?.phase)");
 if(await evaluate("window.__reviewState.phase==='preparing'"))await advance();await waitFor("window.__reviewState?.phase==='decision'&&!!document.querySelector('#action-form')");
 await check('All twelve actions remain available in purpose groups',async()=>{assert(await evaluate("document.querySelector('#action-id').options.length===12&&document.querySelectorAll('#action-id optgroup').length===4"),'catalog');});
 await click('.action-purpose > summary');await click('[data-action="action-guide"][data-group="acquire"]');await waitFor("!!document.querySelector('#modal[open] .classroom-action-guide')");await click('[data-action="choose-action"][data-id="A03"]');
 await check('Guide selection updates a draft without submitting an action',async()=>{assert(await evaluate("document.querySelector('#action-id').value==='A03'&&!window.__reviewState.me.action"),'guide posted an action');});
 await size(390,844);await close();await capture('decision-mobile');await openAction();await capture('action-mobile');
 await check('Mobile action context and one confirmation are reachable',async()=>{assert(await evaluate("!!document.querySelector('.action-context')&&document.querySelector('#action-form button[type=submit]').getBoundingClientRect().height>=44"),'mobile action');});await close();await size(1440,1000);await capture('decision-desktop');
 for(const [index,id] of ['A01','A04','A05','A06','A02','A12'].entries()){
  const round=index+1;if(await evaluate("window.__reviewState.phase==='preparing'"))await advance();await waitFor("window.__reviewState.phase==='decision'&&!!document.querySelector('#action-form')");
  await evaluate(`(()=>{const e=document.querySelector('#action-id');e.value=${JSON.stringify(id)};e.dispatchEvent(new Event('input',{bubbles:true}));const scale=document.querySelector('#action-scale');if([...scale.options].some(o=>o.value==='0.5')){scale.value='0.5';scale.dispatchEvent(new Event('input',{bubbles:true}));}document.querySelector('#action-form').requestSubmit();})()`);
  await waitFor("document.querySelector('#receipt-status')?.dataset.state==='accepted'");report.journey.push(await evaluate("({round:window.__reviewState.round,phase:window.__reviewState.phase,action:window.__reviewState.me.action.id,receipt:document.querySelector('#receipt-status').textContent})"));
  assert(await evaluate("window.__reviewState.me.action.id==="+JSON.stringify(id)),'wrong accepted action');await advance();
  if(round<6)await check('Round '+round+' displays a real ledger summary',async()=>{await waitFor("!!document.querySelector('.classroom-round-summary')");});
 }
 await waitFor("window.__reviewState.phase==='finished'",20000);await check('Six different actions genuinely settle and the result has real contributions',async()=>{assert(await evaluate("window.__reviewState.history.length===6&&!!document.querySelector('.result-contributions')"),'result');});await capture('result-desktop');
 await click('[data-action="select-review-round"][data-round="2"]');await check('Historical round selector displays this seat actual action',async()=>{assert(await evaluate("document.querySelector('.round-review').dataset.reviewRound==='2'&&document.querySelector('.round-review').textContent.includes('调整新手引导')"),'history selection');});
 await click('.review-evidence > summary');await check('Historical evidence is explicitly bounded to settlement time',async()=>{assert(await evaluate("document.querySelector('.review-evidence').textContent.includes('不代表做决定前已经知道')"),'retro evidence');});
 await click('.round-review [data-action="concept"]');await waitFor("!!document.querySelector('.classroom-concept')");const related=await evaluate("document.querySelector('.classroom-concept a').getAttribute('href')");await click('.classroom-concept a');await waitFor("!!document.querySelector('.reading-return')");
 await check('Related reading keeps a return link to the chosen round',async()=>{assert(await evaluate("document.querySelector('.reading-return a').getAttribute('href').endsWith('/review/2')"),'read return');});await click('.reading-return a');await waitFor("!!document.querySelector('.round-review[data-review-round=\"2\"]')");
 await click('[data-action="round-note"][data-round="2"]');await waitFor("!!document.querySelector('#note-form')");
 await check('Round note has real facts and a specific source return',async()=>{assert(await evaluate("document.querySelector('#note-body').value.includes('实际执行了调整新手引导')&&document.querySelector('.note-source-link').getAttribute('href').endsWith('/review/2')"),'note source');});
 await click('.note-source-link');await waitFor("!!document.querySelector('.classroom-result')");await size(390,844);await capture('result-mobile');
 report.finished=true;report.modelCalls=0;
}catch(error){report.fatal=error.stack;console.log('Capture stopped: '+error.message);}
finally{
 if(ws)ws.close();chrome.kill();await new Promise(r=>server.close(r));await pause(900);
 const resolved=resolve(scratch),tempRoot=resolve(tmpdir());if(resolved.startsWith(tempRoot+sep)&&resolved.slice(tempRoot.length+1).startsWith('growth-review-')){try{await rm(resolved,{recursive:true,force:true});}catch{}}
 await writeFile(join(output,reportName),JSON.stringify(report,null,2));console.log(JSON.stringify({screens:report.screens.length,finished:report.finished||false,errors:report.errors,fatal:report.fatal||null,output}));
}
