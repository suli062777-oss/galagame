/** Independent visual evidence; uses the owner's already running local template server. */
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
const base=process.env.QUALITY_ORIGIN||'http://127.0.0.1:3020';
const output=resolve('docs/evidence/classroom-20261118/quality/scene-diagnosis-viewport');await mkdir(output,{recursive:true});
const health=await(await fetch(base+'/api/health')).json();
if(health.provider!=='template'||health.host?.enabled)throw Error('Quality capture requires the local template-only host');
const scratch=await mkdtemp(join(tmpdir(),'classroom-quality-'));
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--use-angle=swiftshader','--enable-unsafe-swiftshader','--user-data-dir='+scratch,'about:blank'],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const report={date:'2026-11-18',scope:'Independent Chrome screenshots; actual local template practice and UI; no public rooms or model calls; software WebGL; desktop emulation of phone dimensions',health:{provider:health.provider,enabled:health.host.enabled},screens:[],observations:[],errors:[]};
let ws;
try{
 let port;for(let i=0;i<100;i++){try{port=(await readFile(join(scratch,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await sleep(100);}}
 if(!port)throw Error('No Chrome debugger');
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 let id=0;const pending=new Map();
 ws.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const p=pending.get(data.id);if(p){clearTimeout(p.timer);pending.delete(data.id);data.error?p.reject(Error(JSON.stringify(data.error))):p.resolve(data.result);}}else if(data.method==='Runtime.exceptionThrown')report.errors.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text);});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject,timer:setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout '+method));},20000)});ws.send(JSON.stringify({id:n,method,params}));});
 const run=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const wait=async expression=>{for(let i=0;i<150;i++){if(await run(expression))return;await sleep(100);}throw Error('Wait failed: '+expression);};
 const size=async(width,height)=>{await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(150);};
 const navigate=async(route,selector)=>{await cdp('Page.navigate',{url:base+'/#/'+route});await wait('!!document.querySelector('+JSON.stringify(selector)+')');await run('document.fonts.ready.then(()=>true)');await sleep(200);};
 const click=async selector=>{const point=await run(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();if(!r.width||!r.height)throw Error('Hidden control '+${JSON.stringify(selector)});return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);await cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await sleep(180);};
 const capture=async(name,{full=false}={})=>{
  await run('window.scrollTo(0,0)');await sleep(200);
  const metrics=await run(`(()=>{const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};const n=document.querySelector('#room-form input[name=name]'),a=document.querySelector('.arena-stage');return{url:location.href,width:innerWidth,height:innerHeight,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,phase:document.body.dataset.gamePhase||null,headings:[...document.querySelectorAll('h1,h2,h3')].map(e=>e.textContent.trim()),entrySubmit:rect(document.querySelector('#entry-submit')),nameInput:n?{background:getComputedStyle(n).backgroundColor,color:getComputedStyle(n).color,placeholder:getComputedStyle(n,'::placeholder').color}:null,stage:rect(a),brokenImages:[...document.images].filter(x=>!x.complete||x.naturalWidth===0).map(x=>x.getAttribute('src'))};})()`);
  const image=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:full,clip:{x:0,y:0,width:metrics.width,height:full?Math.min(metrics.scrollHeight,5000):metrics.height,scale:1}});
  await writeFile(join(output,name+'.png'),Buffer.from(image.data,'base64'));report.screens.push({name,...metrics});await writeFile(join(output,'quality-evidence.json'),JSON.stringify(report,null,2));console.log('Captured '+name);
 };
 await cdp('Runtime.enable');await cdp('Page.enable');
 await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const f=window.fetch;window.fetch=async(...args)=>{const r=await f(...args);if(r.status!==304&&r.headers.get('content-type')?.includes('application/json'))r.clone().json().then(d=>{if(d.state)window.__qualityState=d.state;}).catch(()=>{});return r;};})();`});
 await size(1440,1000);await navigate('home','.classroom-home');await capture('home-desktop');await size(390,844);await capture('home-mobile');
 await size(1440,1000);await navigate('tavern','#room-form');await capture('entry-join-desktop');await size(390,844);await capture('entry-join-mobile');await click('[data-action="entry-mode"][data-mode="practice"]');await capture('entry-practice-mobile');
 await size(360,800);await capture('entry-practice-360');
 await size(1440,1000);await run(`(()=>{const f=document.querySelector('#room-form');f.elements.name.value='独立品审';f.requestSubmit();})()`);await wait("window.__qualityState?.phase==='lobby'&&!!document.querySelector('.v3-room')");await sleep(1000);await capture('room-lobby-desktop');await size(390,844);await capture('room-lobby-mobile');
 await size(1440,1000);await click('[data-action="start"]');await wait("['preparing','decision'].includes(window.__qualityState?.phase)");
 const closeSurfaces=async()=>{if(await run("!!document.querySelector('#modal[open]')"))await click('#modal [data-action="close-modal"]');if(await run("document.querySelector('.v3-room')?.dataset.actionOpen==='true'"))await click('[data-action="close-action-sheet"]');};
 const advance=async()=>{await closeSurfaces();if(await run("innerWidth<=680&&window.__qualityState?.phase==='decision'"))await click('[data-action="toggle-action-sheet"]');if(await run("!!document.querySelector('.action-options:not([open]) [data-action=advance]')"))await click('.action-options > summary');const before=await run("[window.__qualityState.phase,window.__qualityState.round,window.__qualityState.history?.length].join(':')");await click('[data-action="advance"]');await wait("[window.__qualityState.phase,window.__qualityState.round,window.__qualityState.history?.length].join(':')!=="+JSON.stringify(before));};

 if(await run("window.__qualityState.phase==='preparing'"))await advance();await wait("window.__qualityState?.phase==='decision'&&!!document.querySelector('#action-form')");
 const diagnose=async(label)=>{const data=await run(`(()=>{const container=document.querySelector('#globe-container'),shell=container.querySelector('.roundtable-scene'),canvas=shell.querySelector('canvas');const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');return{label:${JSON.stringify(label)},diagnostics:container.getSceneDiagnostics(),documentHidden:document.hidden,canvas:{width:canvas.width,height:canvas.height,rect:rect(canvas),visibility:getComputedStyle(canvas).visibility,display:getComputedStyle(canvas).display,opacity:getComputedStyle(canvas).opacity,contextLost:gl.isContextLost(),contextAttributes:gl.getContextAttributes()},shell:{rect:rect(shell),bounds:shell.dataset.sceneBounds},container:rect(container)};})()`);report.observations.push(data);console.log(JSON.stringify({label,renderCount:data.diagnostics.renderCount,viewport:data.diagnostics.viewport,scheduler:data.diagnostics.performance.scheduler,contextLost:data.canvas.contextLost,canvas:data.canvas.rect}));};
 await sleep(600);await diagnose('decision-before-capture');await capture('decision-before');
 const uri=await run("document.querySelector('.roundtable-scene').captureSceneImage()");
 if(uri)await writeFile(join(output,'forced-scene-capture.png'),Buffer.from(uri.split(',')[1],'base64'));
 await diagnose('after-force-draw');await capture('decision-after-force');
 await click('.scene-toggle');await sleep(500);await diagnose('after-expand');await capture('decision-expanded');
 await click('.scene-toggle');await sleep(500);await diagnose('after-collapse');await capture('decision-collapsed');
 await size(1370,930);await sleep(500);await diagnose('after-resize-desktop');await capture('decision-resized');
 await size(390,844);await sleep(500);await diagnose('after-resize-mobile');await capture('decision-mobile');
 await click('[data-action="toggle-action-sheet"]');await capture('action-sheet-mobile',{full:false});
 report.passed=report.errors.length===0;
}catch(error){report.passed=false;report.fatal=error.stack;}
finally{ws?.close();browser.kill();await sleep(700);const p=resolve(scratch),t=resolve(tmpdir());if(p.startsWith(t+sep)&&p.slice(t.length+1).startsWith('classroom-quality-')){try{await rm(p,{recursive:true,force:true});}catch{}}await writeFile(join(output,'quality-evidence.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({screens:report.screens.length,completedRounds:report.completedRounds||0,errors:report.errors,passed:report.passed,fatal:report.fatal||null,output}));}
