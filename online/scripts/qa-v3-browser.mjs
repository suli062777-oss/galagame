/* Explicit local QA entry. Injected only by the development server for ?qa=... .
 * Operates the real page DOM and local API. It never visits production or reports credentials.
 */
const localHosts=new Set(['localhost','127.0.0.1','[::1]']);
if(!localHosts.has(location.hostname))throw new Error('V3 browser QA is restricted to localhost');
const query=new URLSearchParams(location.search),captureMode=query.get('qa')==='capture';
const realFetch=window.fetch.bind(window),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const runStart=performance.now();
const report={qaRunId:crypto.randomUUID(),startedAt:new Date().toISOString(),stage:'starting',scope:'Actual DOM and localhost API in the user-opened browser; no external automation or production model calls',viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},tests:[],errors:[],apiEvents:[],modelCalls:0,rounds:[],syntheticFaults:[],scene:null};
let latestState=null,qaRoomId=null,collectRooms=false,rejectNextAction=false,loseNextActionResponse=false,holdRoomPollUntil=0,actualActionPosts=0,running=false;
const clean=value=>String(value||'').replace(/Bearer\s+\S+/gi,'Bearer [redacted]').replace(/sk-[A-Za-z0-9_-]+/g,'[redacted]').replace(/\b[a-f0-9]{64}\b/gi,'[redacted]').slice(0,500);
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const visible=element=>{if(!element||element.hidden)return false;for(let ancestor=element.parentElement;ancestor;ancestor=ancestor.parentElement){if(ancestor.tagName==='DETAILS'&&!ancestor.open&&!ancestor.querySelector(':scope > summary')?.contains(element))return false;}if(typeof element.checkVisibility==='function'&&!element.checkVisibility({checkVisibilityCSS:true,contentVisibilityAuto:true}))return false;const style=getComputedStyle(element),r=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&r.width>0&&r.height>0;};
const inViewport=element=>{if(!visible(element))return false;const r=element.getBoundingClientRect();return r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth;};
async function waitFor(fn,label,timeout=14000){const until=performance.now()+timeout;while(true){const value=await fn();if(value)return value;if(performance.now()>=until)throw new Error('Timed out: '+label);await sleep(75);}}
async function test(name,fn){const started=performance.now();try{const details=await fn();report.tests.push({name,passed:true,elapsedMs:Math.round(performance.now()-started),...(details===undefined?{}:{details})});await publish('progress');return details;}catch(error){report.tests.push({name,passed:false,elapsedMs:Math.round(performance.now()-started),error:clean(error.message)});await publish('progress');throw error;}}
function observe(data){if(!data||!data.state)return;if(collectRooms&&data.roomId){qaRoomId=data.roomId;collectRooms=false;}if(data.state.id===qaRoomId&&(!latestState||data.state.version>=latestState.version))latestState=data.state;}
function apiEvent(url,method,status,data,kind='response'){if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return;const event={elapsedMs:Math.round(performance.now()-runStart),kind,route:url.pathname.replace(/\/api\/rooms\/[^/]+/,'/api/rooms/[test-room]'),method,status,...(data?.state?{phase:data.state.phase,round:data.state.round,version:data.state.version}:{}),visibilityState:document.visibilityState};report.apiEvents.push(event);if(report.apiEvents.length>50)report.apiEvents.shift();}
window.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input.url,location.href),method=String(init?.method||input?.method||'GET').toUpperCase();
 if(rejectNextAction&&method==='POST'&&url.origin===location.origin&&url.pathname===`/api/rooms/${qaRoomId}/action`){rejectNextAction=false;report.syntheticFaults.push({kind:'one client fetch returns HTTP 503',path:url.pathname.split('/').slice(0,2).join('/')+'/[test-room]/action'});apiEvent(url,method,503,null,'synthetic-response');return Response.json({ok:false,error:'QA：临时提交失败，请保留草稿后重试。',code:'qa_injected_failure'},{status:503});}
 const actionRequest=method==='POST'&&url.origin===location.origin&&url.pathname===`/api/rooms/${qaRoomId}/action`;if(actionRequest)actualActionPosts++;
 const loseResponse=actionRequest&&loseNextActionResponse;if(loseResponse)loseNextActionResponse=false;
 let response;try{response=await realFetch(input,init);}catch(error){apiEvent(url,method,null,null,'network-rejection');throw error;}
 if(loseResponse){const accepted=await response.json();apiEvent(url,method,response.status,accepted,'actual-response-discarded');assert(response.ok&&accepted.receipt?.status==='accepted','Lost-response test requires a real accepted server action');holdRoomPollUntil=performance.now()+400;report.syntheticFaults.push({kind:'Actual HTTP 200 accepted action discarded before application receives it; subsequent local room poll delayed at most 400ms so uncertain state can be observed'});throw new TypeError('QA: simulated response loss after server accepted');}
 if(method==='GET'&&url.pathname===`/api/rooms/${qaRoomId}`&&performance.now()<holdRoomPollUntil)await sleep(holdRoomPollUntil-performance.now());
 if(url.origin===location.origin&&url.pathname.startsWith('/api/')){try{const data=await response.clone().json();apiEvent(url,method,response.status,data);observe(data);}catch{apiEvent(url,method,response.status,null,'non-json-response');}}
 return response;
};
const errorListener=event=>report.errors.push({type:'window-error',message:clean(event.message),source:clean(event.filename?new URL(event.filename,location.href).pathname:'')});
const rejectionListener=event=>report.errors.push({type:'unhandled-rejection',message:clean(event.reason?.message||event.reason)});
addEventListener('error',errorListener);addEventListener('unhandledrejection',rejectionListener);
const realConsoleError=console.error;
console.error=function(...args){const message=args.map(value=>typeof value==='string'?value:String(value)).join(' ');if(/THREE\.WebGLProgram|VALIDATE_STATUS|shader error|ERROR:\s*\d+:\d+/i.test(message))report.errors.push({type:'webgl-shader-error',message:clean(message)});return realConsoleError.apply(this,args);};

async function publish(stage){
 report.stage=stage;report.updatedAt=new Date().toISOString();report.viewport={width:innerWidth,height:innerHeight,dpr:devicePixelRatio};report.visibilityState=document.visibilityState;report.elapsedMs=Math.round(performance.now()-runStart);report.currentState=latestState?{phase:latestState.phase,round:latestState.round,version:latestState.version,historyLength:latestState.history?.length}:null;
 window.__v3QAReport=structuredClone(report);
 try{await realFetch('/__qa/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)});}catch(error){console.warn('Local QA report delivery failed:',clean(error.message));}
 if(parent!==window)parent.postMessage({type:'growth-v3-qa',report:structuredClone(report)},location.origin);
}
function click(selector){const elements=[...document.querySelectorAll(selector)].filter(visible),element=elements.find(inViewport)||elements[0];assert(element,'Visible control missing: '+selector);assert(!element.disabled,'Control disabled: '+selector);if(!inViewport(element))element.scrollIntoView({block:'nearest',behavior:'instant'});assert(inViewport(element),'Control cannot be reached in viewport: '+selector);element.click();return element;}
function choose(selector,value){const input=document.querySelector(selector);assert(input,'Missing form field: '+selector);assert([...input.options].some(o=>o.value===String(value)),'Unavailable choice: '+selector+'='+value);input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
async function openAction(){if(innerWidth<=680&&document.querySelector('.v3-room')?.dataset.actionOpen!=='true'){click('[data-action="toggle-action-sheet"]');await waitFor(()=>document.querySelector('.v3-room')?.dataset.actionOpen==='true'&&inViewport(document.querySelector('#action-form')),'mobile action sheet');}}
async function closeSheets(){const root=document.querySelector('.v3-room');if(!root)return;
 if(root.dataset.actionOpen==='true'){const close=[...document.querySelectorAll('[data-action="close-action-sheet"], [data-action="toggle-action-sheet"]')].find(visible);if(close)close.click();}
 if(root.dataset.sheet==='info'){const close=[...document.querySelectorAll('#insight-panel [data-action="close-sheet"]')].find(visible);if(close)close.click();else document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));}
 await sleep(120);
}
async function exposeAdvance(){if(latestState?.phase==='decision')await openAction();let control=[...document.querySelectorAll('[data-action="advance"]')].find(visible);if(control){if(!inViewport(control))control.scrollIntoView({block:'nearest',behavior:'instant'});return control;}
 const candidate=document.querySelector('[data-action="advance"]'),details=candidate?.closest('details');
 if(details){const summary=details.querySelector(':scope > summary');assert(summary,'Practice advance has an accessible details summary');if(!details.open){summary.scrollIntoView({block:'nearest',behavior:'instant'});summary.click();}await sleep(80);control=[...document.querySelectorAll('[data-action="advance"]')].find(visible);}
 assert(control,'Practice advance must be reachable through a visible control');control.scrollIntoView({block:'nearest',behavior:'instant'});return control;
}
async function advance(){const previous=latestState;await closeSheets();(await exposeAdvance()).click();await waitFor(()=>latestState&&(latestState.phase!==previous.phase||latestState.round!==previous.round),'practice phase advance');await sleep(180);}
async function enterDecision(){if(latestState.phase==='preparing')await advance();await waitFor(()=>latestState?.phase==='decision'&&document.querySelector('#action-form'),'decision state');await sleep(220);}
async function createPractice(name,startImmediately=true){
 latestState=null;qaRoomId=null;location.hash='#/tavern';
 const form=await waitFor(()=>document.querySelector('#room-form'),'tavern create form');form.elements.name.value=name;
 if(form.elements.entry)form.elements.entry.value='create';if(form.elements.mode)form.elements.mode.value='practice';
 form.scrollIntoView({block:'center',behavior:'instant'});collectRooms=true;form.requestSubmit();await waitFor(()=>latestState?.phase==='lobby'&&document.querySelector('.v3-room'),'real practice room');
 if(!startImmediately)return;
 click('[data-action="start"]');await waitFor(()=>latestState&&latestState.phase!=='lobby','start response');await enterDecision();
}
function currentChoice(){return {id:document.querySelector('#action-id')?.value,target:document.querySelector('#action-target')?.value,scale:document.querySelector('#action-scale')?.value};}
async function fillChoice(id){await openAction();await waitFor(()=>document.querySelector('#action-id')?.options?.length,'action catalog');choose('#action-id',id);await sleep(100);const target=document.querySelector('#action-target');if(target&&!target.disabled&&[...target.options].some(o=>o.value==='1'))choose('#action-target','1');choose('#action-scale','1');await sleep(120);return currentChoice();}
async function submitChoice(){const form=document.querySelector('#action-form');assert(visible(form),'Action form must be visible before submit');const button=form.querySelector('button[type="submit"]');assert(button&&!button.disabled,'Enabled form submit button exists');button.scrollIntoView({block:'nearest',behavior:'instant'});assert(inViewport(button),'Submit is in viewport after scrolling');form.requestSubmit();}
async function testInformationTabs(){
 if(innerWidth<=680){await closeSheets();const opener=document.querySelector('.mobile-intel-peek[data-action="open-panel"][data-panel="world"]');assert(visible(opener),'Mobile information opener is visible');opener.scrollIntoView({block:'nearest',behavior:'instant'});opener.click();await waitFor(()=>document.querySelector('.v3-room')?.dataset.sheet==='info'&&inViewport(document.querySelector('#insight-panel')),'mobile information sheet');}
 for(const panel of ['world','research','ledger']){const element=click(`[data-action="insight-tab"][data-panel="${panel}"]`);await sleep(80);assert(element.getAttribute('aria-selected')==='true','Selected tab reflects '+panel);assert(document.querySelector('#insight-content')?.textContent.trim(),'Tab has content or a meaningful empty state: '+panel);}
 await closeSheets();await openAction();
}
function bounds(element){const r=element.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)};}
function diagnostics(){const shell=document.querySelector('.globe-shell');try{const value=typeof shell?.getSceneDiagnostics==='function'?shell.getSceneDiagnostics():typeof window.__tavernSceneDiagnostics==='function'?window.__tavernSceneDiagnostics():shell?.dataset.sceneBounds?JSON.parse(shell.dataset.sceneBounds):null;return value;}catch(error){return {error:clean(error.message)};}}
async function inspectLayout(){
 await closeSheets();const root=document.querySelector('.v3-room'),canvas=root?.querySelector('canvas');assert(root,'V3 room rendered');assert(canvas,'Real scene has canvas');
 assert(document.documentElement.scrollWidth<=innerWidth+2,'No horizontal page overflow');
 const summary=document.querySelector(innerWidth<=680?'#mobile-economy':'#economy-summary');assert(visible(summary),'Own economy summary is visible');
 const clock=document.querySelector('#countdown');assert(visible(clock),'Deadline clock remains visible');
 const r=clock.getBoundingClientRect();assert(r.top>=-1&&r.bottom<=innerHeight+1,'Deadline clock is in viewport');
 const labels=[...root.querySelectorAll('.roundtable-label')].filter(visible);assert(labels.length===4,'Four human/agent seat labels visible in practice room');
 assert(labels.every(el=>!/[0-9]+\.[0-9]{2}/.test(el.innerText)),'Detailed score text removed from scene labels');
 const topButtons=[...root.querySelectorAll('.arena-hud button')].filter(visible);assert(topButtons.length<=4,'Top HUD has room/menu controls rather than eight tools');
 const primary=[...root.querySelectorAll('.button.solid')].filter(inViewport);assert(primary.length<=1,'Decision base view has one dominant primary action');
 const required=innerWidth<=680?[...root.querySelectorAll('[data-action="toggle-action-sheet"]')].filter(inViewport):[...root.querySelectorAll('#action-form button[type="submit"]')].filter(inViewport);
 assert(required.length,'Primary decision action visible');for(const el of required){const b=el.getBoundingClientRect();assert(b.width>=44&&b.height>=44,'Primary target at least 44px');}
 const shell=root.querySelector('.globe-shell');assert(shell?.dataset.renderer==='webgl','Scene is actually rendered by WebGL');
 report.scene=diagnostics();assert(report.scene,'Actual scene exposes geometry diagnostics');
 return {root:bounds(root),canvas:bounds(canvas),clock:bounds(clock),economy:bounds(summary),sceneLabels:labels.map(el=>({text:clean(el.innerText),bounds:bounds(el)})),topVisibleButtons:topButtons.length,primaryTargets:required.map(bounds)};
}
async function inspectScene(){const d=diagnostics();assert(d,'Scene diagnostics available');report.scene=d;
 report.initialSceneViewport={width:d.viewport.width,height:d.viewport.height};
 assert(d.seatCount===4,'Scene has four seats');assert(d.occupiedSeats===4,'Practice has one human and three occupied script seats');assert(d.avatarSeats?.length===4,'Four avatar bindings are exposed');
 assert(d.avatarSeats.every((seat,index)=>seat.seat===index),'Avatar ownership retains ordered seat anchors');
 assert(d.avatarSeats.every(seat=>seat.headScale?.every(value=>Math.abs(value-1)<.01)),'Heads retain natural scale instead of mobile-only enlargement');
 for(const seat of d.avatarSeats){const h=seat.head,l=seat.label;assert(h&&[h.left,h.right,h.top,h.bottom].every(Number.isFinite),'Projected head bounds exist');assert(h.left>=-1&&h.right<=d.viewport.width+1&&h.top>=-1&&h.bottom<=d.viewport.height+1,'Head stays inside actual canvas: seat '+seat.seat);const overlapX=Math.min(h.right,l.left+l.width)-Math.max(h.left,l.left),overlapY=Math.min(h.bottom,l.top+l.height)-Math.max(h.top,l.top);assert(overlapX<=0||overlapY<=0,'Identity label does not cover own head: seat '+seat.seat);}
 await waitFor(()=>diagnostics()?.avatarSeats?.every(p=>p.hasTexture),'four head textures loaded');
 const clearances=['current','default','maximum'].map(key=>{const b=d.globe?.[key];assert(b&&Number.isFinite(b.allMarkersBottom)&&Number.isFinite(b.tableTop),'Actual '+key+' marker bounds exposed');return {mode:key,value:b.allMarkersBottom-b.tableTop};});
 assert(clearances.every(c=>c.value>=.12),'Sphere and conservative markers are above table at all allowed zooms');
 assert(d.defaultAutoRotate===false,'Scene defaults to no automatic rotation');assert(d.environment?.bottleCount>0&&d.environment?.lampCount>0,'Actual environment has bottles and lamps');
 report.scene=diagnostics();return {diagnostics:report.scene,clearances,performanceNote:'fps counts actual WebGL renders; callbackFps counts RAF callbacks. Idle on-demand rendering is not an active GPU performance profile.'};
}
async function inspectGlobeControls(){
 await closeSheets();const shell=document.querySelector('.globe-shell'),canvas=shell.querySelector('canvas'),initial=diagnostics().globe.current.zoom;
 const key=value=>canvas.dispatchEvent(new KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true}));
 for(let i=0;i<18;i++)key('+');const maximum=diagnostics().globe.current;assert(Math.abs(maximum.zoom-diagnostics().globe.maximumZoom)<.001,'Actual keyboard zoom clamps at allowed maximum');assert(maximum.allMarkersBottom-maximum.tableTop>=.12,'Maximum zoom markers stay above tabletop');
 let remove=await mountReferenceSnapshot('actual-keyboard-maximum-zoom');remove();
 for(let i=0;i<18;i++)key('-');const minimum=diagnostics().globe.current;assert(Math.abs(minimum.zoom-diagnostics().globe.minimumZoom)<.001,'Actual keyboard zoom clamps at allowed minimum');assert(minimum.allMarkersBottom-minimum.tableTop>=.12,'Minimum zoom markers stay above tabletop');
 const hit=shell.querySelector('.roundtable-globe-hit'),rect=hit.getBoundingClientRect();hit.dispatchEvent(new WheelEvent('wheel',{deltaY:-(initial-minimum.zoom)/.00065,clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2,bubbles:true,cancelable:true}));
 assert(Math.abs(diagnostics().globe.current.zoom-initial)<.001,'Actual wheel handler restores original zoom');
 const performanceSample={valid:false,input:'Repeated synthetic keyboard events on the actual canvas rotation handler; real renderer draw count, not RAF count',visibilityState:document.visibilityState,candidateTarget:innerWidth<=680?30:45};
 if(document.visibilityState==='visible'){
  let remainedVisible=true;const listener=()=>{if(document.visibilityState!=='visible')remainedVisible=false;};document.addEventListener('visibilitychange',listener);
  const before=diagnostics().renderCount,started=performance.now();
  try{while(performance.now()-started<1800&&document.visibilityState==='visible'){key('ArrowRight');await new Promise(resolve=>{let done=false;const finish=()=>{if(!done){done=true;resolve();}};requestAnimationFrame(finish);setTimeout(finish,100);});}}
  finally{document.removeEventListener('visibilitychange',listener);}
  const elapsed=performance.now()-started,frames=diagnostics().renderCount-before;
  Object.assign(performanceSample,{valid:remainedVisible&&document.visibilityState==='visible',elapsedMs:Math.round(elapsed),renderedFrames:frames,renderFps:Math.round(frames*10000/elapsed)/10});
  if(performanceSample.valid){assert(frames>0,'Visible rotation input produces actual WebGL draws');performanceSample.meetsCandidateTarget=performanceSample.renderFps>=performanceSample.candidateTarget;}
 }
 if(!performanceSample.valid)performanceSample.note='No valid active FPS conclusion: browser was hidden before or during sampling.';
 report.rotationPerformance=performanceSample;return {minimum,maximum,restoredZoom:diagnostics().globe.current.zoom,performanceSample};
}
function inspectTypography(){const selectors=['#phase-label','.arena-phase','.arena-phase strong span','#mobile-economy span','#mobile-economy small','.mobile-action-state','#receipt-status','.action-estimate','.host-source','.world-type','.insight-tabs button'];const samples=[];for(const selector of selectors){for(const node of document.querySelectorAll(selector)){if(!visible(node)||!node.textContent.trim())continue;const size=parseFloat(getComputedStyle(node).fontSize);samples.push({selector,fontSize:size,text:clean(node.textContent).slice(0,70)});assert(size>=13,'Critical label is smaller than 13px: '+selector+' '+size);}}return samples;}
async function changeOwnAvatar(){
 const seat=latestState.me.seat,before=diagnostics()?.avatarSeats?.find(p=>p.seat===seat),previousTexture=before?.textureUuid;
 const nextPreset=latestState.me.avatar?.id==='aurora'?'ember':'aurora';
 await closeSheets();click(`.roundtable-head-hit[data-seat="${seat}"]`);
 await waitFor(()=>document.querySelector('dialog.avatar-editor')?.open,'own avatar dialog');
 const closeTarget=bounds(document.querySelector('dialog.avatar-editor .avatar-close'));assert(closeTarget.width>=44&&closeTarget.height>=44,'Actual avatar close target is at least 44px');
 click(`dialog.avatar-editor [data-preset="${nextPreset}"]`);
 await waitFor(()=>document.querySelector(`dialog.avatar-editor [data-preset="${nextPreset}"]`)?.getAttribute('aria-pressed')==='true','avatar preset selected');
 click('dialog.avatar-editor .avatar-apply');
 await waitFor(()=>latestState.me?.avatar?.kind==='preset'&&latestState.me.avatar.id===nextPreset,'server confirms own avatar');
 await waitFor(()=>!document.querySelector('dialog.avatar-editor')?.open,'avatar dialog closes after accepted save');
 const after=await waitFor(()=>{const d=diagnostics()?.avatarSeats?.find(p=>p.seat===seat);return d?.hasTexture&&(!previousTexture||d.textureUuid!==previousTexture)?d:null;},'updated head texture ready');
 report.avatarChanged={seat,preset:nextPreset,method:'Actual own head click, native avatar dialog, preset selection and Apply; photo filechooser not used',textureChanged:previousTexture?after.textureUuid!==previousTexture:null,closeTarget};
 return report.avatarChanged;
}
function resultPanel(passed){const element=document.createElement('aside');element.id='v3-qa-result';element.dataset.qaOverlay='true';element.style.cssText='position:fixed;right:8px;top:8px;z-index:9999;padding:8px 12px;border-radius:8px;background:#15241f;color:#eff7f0;font:13px/1.5 system-ui;max-width:280px';element.textContent=passed?'本地自动验证完成，可继续体验。':'本地验证发现问题，报告已保存。';const close=document.createElement('button');close.textContent='关闭';close.style.cssText='margin-left:12px;color:inherit;background:transparent;border:0;cursor:pointer';close.onclick=()=>element.remove();element.append(close);document.body.append(element);}

async function mountReferenceSnapshot(stage){
 const shell=await waitFor(()=>{const n=document.querySelector('.tavern-scene-v3');return typeof n?.captureSceneImage==='function'?n:null;},'real scene snapshot method');
 const dataUrl=shell.captureSceneImage();assert(typeof dataUrl==='string'&&dataUrl.startsWith('data:image/png'),'Reference is a real scene PNG');
 const canvas=shell.querySelector('canvas'),image=document.createElement('img');image.alt='V3酒馆实时渲染素材';image.dataset.qaReferenceSnapshot='true';image.draggable=false;image.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';image.src=dataUrl;canvas.insertAdjacentElement('afterend',image);if(image.decode)await image.decode();
 (report.referenceSnapshots||=[]).push({stage,width:canvas.width,height:canvas.height,source:'Synchronous actual Three render exported to PNG solely for Figma reference capture; no HUD or UI labels included'});
 // Deliberately separate from report: large local image data never follows later
 // progress reports and contains only our own rendered scene, never API data.
 const snapshotReport={stage:'scene-snapshot',qaRunId:report.qaRunId,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},sceneSnapshot:{dataUrl,width:canvas.width,height:canvas.height},source:'Actual synchronous local Three renderer; scene only, without UI text',updatedAt:new Date().toISOString()};
 try{const response=await realFetch('/__qa/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshotReport)});if(!response.ok)report.referenceSnapshots.at(-1).snapshotDeliveryStatus=response.status;}catch(error){report.referenceSnapshots.at(-1).snapshotDeliveryError=clean(error.message);}
 return ()=>image.remove();
}





export async function runV3QA(){
 if(running)return report;running=true;
 try{
  if(document.visibilityState!=='visible'){await publish('waiting-visible');await new Promise(resolve=>{const listener=()=>{if(document.visibilityState==='visible'){document.removeEventListener('visibilitychange',listener);resolve();}};document.addEventListener('visibilitychange',listener);if(document.visibilityState==='visible')listener();});}
  if(captureMode&&location.hash.includes('figmacapture='))await waitFor(()=>typeof window.figma?.captureForDesign==='function','Figma capture script initialization',15000);
  await test('Create a real local practice room through visible form and start it',()=>createPractice('V3验收 · '+new Date().toLocaleTimeString('zh-CN')));
  await test('Practice mode honestly identifies three script seats',()=>{assert(latestState.players.length===4&&latestState.players.filter(p=>p.isBot).length===3,'Exactly three script seats expected');assert(latestState.god.provider==='template','QA local host remains template');});
  // A genuine rendered room is enough to collect the reference; a later layout
  // assertion must still fail honestly, but must not destroy the only screenshot.
  await waitFor(()=>document.querySelector('.v3-room .globe-shell')?.getBoundingClientRect().width>0,'scene shell laid out');await sleep(700);report.scene=diagnostics();
  if(captureMode){const removeSnapshot=await mountReferenceSnapshot('desktop-reference');try{report.captureReadyAt=new Date().toISOString();await publish('capture-ready');await sleep(20000);}finally{removeSnapshot();}}
  if(!captureMode){const removeSnapshot=await mountReferenceSnapshot('qa-visual-evidence');removeSnapshot();}
  // Capturing can occupy a browser much longer than a 45-second round. Keep
  // the reference room honest, then start a new real room for the full game.
  if(captureMode){await test('Start a fresh real practice after reference capture, without changing game clocks',()=>createPractice('V3完整验收 · '+new Date().toLocaleTimeString('zh-CN')));await waitFor(()=>document.querySelector('.v3-room .globe-shell')?.getBoundingClientRect().width>0,'fresh scene laid out');await sleep(700);}
  await test('Decision base layout and fixed information structure',inspectLayout);
  await test('Critical on-screen labels remain readable instead of shrinking below 13px',inspectTypography);
  await test('Initial untouched action already shows a correct budget and useful description',async()=>{await openAction();const estimate=document.querySelector('#action-estimate'),description=document.querySelector('#action-description');assert(estimate?.textContent.includes('预计投入')&&estimate.textContent.includes('可用预算'),'Initial estimate exists before any input/change event');assert(description?.textContent.trim(),'Initial action description exists');const budget=Number(estimate.querySelectorAll('b')[1]?.textContent.replaceAll(',','')),player=latestState.players.find(p=>p.id===latestState.me.id);assert(budget===Math.max(0,player.cash-20),'Initial budget reserves the authoritative 20 operating fee');const details={untouchedChoice:currentChoice(),estimate:clean(estimate.textContent),description:clean(description.textContent),budget};await closeSheets();return details;});
  await test('Scene geometry diagnostics',inspectScene);
  await test('Actual canvas keyboard and wheel handlers enforce zoom bounds; rotation performance is recorded honestly',inspectGlobeControls);
  await test('Own avatar can be changed through actual visible controls',changeOwnAvatar);
  const firstChoice=await fillChoice('A10');
  await test('Action budget and receipt text remain readable',inspectTypography);
  await test('Information tabs can be read without losing the selected action',async()=>{await testInformationTabs();assert(JSON.stringify(currentChoice())===JSON.stringify(firstChoice),'Draft changes lost after information tab navigation');});
  await test('An injected failed submission shows inline error and preserves draft',async()=>{rejectNextAction=true;await submitChoice();await waitFor(()=>document.querySelector('#action-error')?.textContent.trim(),'inline failed action feedback');assert(JSON.stringify(currentChoice())===JSON.stringify(firstChoice),'Failure lost the draft');assert(!document.querySelector('#action-form button[type="submit"]')?.disabled,'Retry is enabled after failure');return {fault:'Explicit synthetic client fetch 503; not a production outage'};});
  for(let round=1;round<=6;round++){
   await enterDecision();await fillChoice(round===1?'A10':'A12');
   const selected=currentChoice();
   await test(`Round ${round}: real DOM action receives server acceptance`,async()=>{await submitChoice();await waitFor(()=>latestState?.round===round&&latestState.me?.action?.id===selected.id,'accepted action state');assert(latestState.me.receipt?.status==='accepted','Server accepted receipt is shown');await waitFor(()=>document.querySelector('#receipt-status')?.dataset.state==='accepted','visible accepted receipt');return {receiptText:clean(document.querySelector('#receipt-status').textContent)};});
   if(round===1){await fillChoice('A12');await test('Changed draft is distinct from the last accepted action',()=>assert(document.querySelector('#receipt-status')?.dataset.state==='draft','Changed draft is explicitly marked as not submitted'));const postsBefore=actualActionPosts;await test('Lost response after real server acceptance is honestly shown as uncertain',async()=>{loseNextActionResponse=true;await submitChoice();await waitFor(()=>document.querySelector('#receipt-status')?.dataset.state==='uncertain','uncertain submission UI');assert(currentChoice().id==='A12','Uncertain submission retains selected draft');});await test('Next poll confirms the exact accepted action without duplicate POST',async()=>{await waitFor(()=>latestState.me?.action?.id==='A12','updated accepted action from poll');await waitFor(()=>document.querySelector('#receipt-status')?.dataset.state==='accepted','updated accepted UI after poll');assert(actualActionPosts===postsBefore+1,'No automatic duplicate action request');});}
   await test(`Round ${round}: visible practice control advances one authoritative round`,async()=>{await advance();await waitFor(()=>latestState.history?.length===round,'settled ledger');assert(latestState.me.avatar?.id===report.avatarChanged.preset,'Own changed avatar survives round '+round);assert(latestState.phase!=='decision'&&!document.querySelector('#action-form button[type="submit"]:not(:disabled)'),'Action is not editable between rounds or after final result');report.rounds.push({round,historyLength:latestState.history.length,phase:latestState.phase,score:latestState.players.find(p=>p.id===latestState.me.id)?.score,ownAvatar:report.avatarChanged.preset});});
   if(round===1){await test('Scene viewport stays the same between decision and settled preparation',()=>{const actual=diagnostics().viewport,initial=report.initialSceneViewport;assert(Math.abs(actual.width-initial.width)<=1&&Math.abs(actual.height-initial.height)<=1,'Scene viewport changed between phases: '+JSON.stringify({initial,actual}));return {initial,afterSettlement:{width:actual.width,height:actual.height}};});await waitFor(()=>diagnostics()?.globe?.markerCount>0,'real settled economic markers');const removeSnapshot=await mountReferenceSnapshot('first-real-settlement-colored-market');removeSnapshot();}
  }
  await test('Six-round result and recap exits are reachable',()=>{assert(latestState.phase==='finished','Six rounds finish');assert(latestState.history.length===6,'Six ledgers retained');assert([...document.querySelectorAll('[data-action="save-review"]')].some(visible),'Save recap visible');assert([...document.querySelectorAll('[data-action="download-replay"]')].some(visible),'Replay export reachable');});
  await test('No application runtime error was observed',()=>{const appErrors=report.errors.filter(e=>!e.source||!e.source.includes('html-to-design'));assert(appErrors.length===0,'Application runtime errors: '+appErrors.map(e=>e.message).join('; '));});
  report.passed=true;report.completedAt=new Date().toISOString();await publish('completed');
  if(parent===window){await createPractice('V3体验 · 继续经营');report.showcaseRoomReady=true;await publish('showcase-ready');}
  resultPanel(true);
 }catch(error){report.passed=false;report.error={name:error.name,message:clean(error.message)};report.completedAt=new Date().toISOString();await publish('failed');resultPanel(false);}
 finally{window.fetch=realFetch;console.error=realConsoleError;running=false;}
 return report;
}
// The four-viewport six-round functional matrix is archived separately. The
// final CSS-only change needs only these real-DOM budget/CTA state checks.
async function runV3PolishQA(){
 if(running)return report;running=true;report.polishOnly=true;report.scope='Targeted actual DOM verification after the final CSS-only primary-button fix; full six-round matrices are archived separately.';
 try{
  if(document.visibilityState!=='visible'){await publish('waiting-visible');await new Promise(resolve=>{const listener=()=>{if(document.visibilityState==='visible'){document.removeEventListener('visibilitychange',listener);resolve();}};document.addEventListener('visibilitychange',listener);if(document.visibilityState==='visible')listener();});}
  await test('Create a real local practice room for targeted final UI checks',()=>createPractice('增长酒馆 · 继续体验'));
  await test('Initial untouched action displays authoritative budget and description',async()=>{await openAction();const estimate=document.querySelector('#action-estimate'),description=document.querySelector('#action-description');assert(estimate?.textContent.includes('预计投入')&&estimate.textContent.includes('可用预算'),'Initial budget is not empty before any change/input');assert(description?.textContent.trim(),'Initial action description is not empty');const budget=Number(estimate.querySelectorAll('b')[1]?.textContent.replaceAll(',','')),player=latestState.players.find(p=>p.id===latestState.me.id);assert(budget===Math.max(0,player.cash-20),'Initial budget matches authoritative cash less operating reserve');return {budget,estimate:clean(estimate.textContent),description:clean(description.textContent),untouchedChoice:currentChoice()};});
  await test('Open action editor has one visible primary confirmation',async()=>{await openAction();const buttons=[...document.querySelectorAll('.v3-room .button.solid')].filter(inViewport),confirmation=document.querySelector('#action-form button[type="submit"]');assert(buttons.length===1&&buttons[0]===confirmation,'Open editor has exactly one primary action, the actual form confirmation');if(innerWidth<=680)assert(!visible(document.querySelector('.mobile-action-bar .button')),'Background action entry is hidden while action sheet is open');return {primaryCount:buttons.length,confirmation:bounds(confirmation),backgroundEntryVisible:visible(document.querySelector('.mobile-action-bar .button'))};});
  await test('Closing mobile action sheet restores its primary entry',async()=>{await closeSheets();if(innerWidth<=680){const entry=document.querySelector('.mobile-action-bar .button');assert(inViewport(entry)&&!entry.disabled,'Closing sheet restores the reachable background entry');const buttons=[...document.querySelectorAll('.v3-room .button.solid')].filter(inViewport);assert(buttons.length===1&&buttons[0]===entry,'Closed sheet returns to one primary entry');return {entry:bounds(entry),primaryCount:buttons.length};}return {desktop:'Inline action confirmation remains the primary control'};});
  await test('Targeted checks observed no application or shader error',()=>assert(report.errors.length===0,'Errors were observed'));
  report.passed=true;report.completedAt=new Date().toISOString();await publish('completed');
 }catch(error){report.passed=false;report.error={name:error.name,message:clean(error.message)};report.completedAt=new Date().toISOString();await publish('failed');}
 finally{window.fetch=realFetch;console.error=realConsoleError;running=false;}
 return report;
}
window.runV3QA=runV3QA;
window.runV3PolishQA=runV3PolishQA;

async function runAgentEntryQA(){
 if(running)return report;running=true;report.agentEntryOnly=true;report.realClipboardWrites=0;report.scope='Focused actual local UI checks for the Agent entry; clipboard is stubbed, self-check is a real local protocol request by QA, not an external Agent or model.';
 const whollyInViewport=element=>{if(!visible(element))return false;const r=element.getBoundingClientRect();return r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;};
 function entryLayout(){const entry=document.querySelector('.agent-connect-entry'),phase=document.querySelector('.arena-phase'),tools=document.querySelector('.arena-tools');assert(document.documentElement.scrollWidth<=innerWidth+2,'No horizontal page overflow');assert(whollyInViewport(entry),'Agent entry is fully visible without opening More');const b=entry.getBoundingClientRect(),p=phase.getBoundingClientRect(),t=tools.getBoundingClientRect();assert(b.width>=44&&b.height>=44,'Agent entry has a 44px target');assert(p.right<=t.left+1,'Agent tools do not overlap the phase/time');assert(!entry.classList.contains('solid'),'Agent entry remains a secondary action');return {entry:bounds(entry),phase:bounds(phase),tools:bounds(tools),label:clean(entry.innerText),horizontalOverflow:document.documentElement.scrollWidth-innerWidth};}
 async function openAndInspect(){click('.agent-connect-entry');await waitFor(()=>document.querySelector('#modal')?.open&&document.querySelector('#copy-agent-button'),'Agent dialog');const dialog=document.querySelector('#modal'),copy=document.querySelector('#copy-agent-button'),instructions=document.querySelector('#agent-instructions'),preferences=document.querySelector('.agent-preferences');assert(whollyInViewport(copy),'Copy control is visible on first opening');assert(copy.getBoundingClientRect().height>=44,'Copy control has a 44px target');assert(!instructions.open&&!preferences.open,'Full credentials and preferences start collapsed');assert(document.activeElement===copy,'Initial focus is on the copy control');assert(document.querySelector('#agent-prompt').readOnly&&!visible(document.querySelector('#agent-prompt')),'Private instructions are folded and readonly');return {dialog:bounds(dialog),copy:bounds(copy),instructionsCollapsed:true,preferencesCollapsed:true};}
 async function closeAgent(){click('#modal [data-action="close-modal"]');await waitFor(()=>!document.querySelector('#modal').open,'Agent dialog closed');}
 try{
  if(document.visibilityState!=='visible'){await publish('waiting-visible');await new Promise(resolve=>{const listener=()=>{if(document.visibilityState==='visible'){document.removeEventListener('visibilitychange',listener);resolve();}};document.addEventListener('visibilitychange',listener);if(document.visibilityState==='visible')listener();});}
  await test('Create a fresh local practice lobby for Agent-entry checks',()=>createPractice('Agent入口 · 本地核对',false));
  await test('Lobby exposes a non-overlapping secondary Agent entry',entryLayout);
  await test('Agent dialog puts the copy control above collapsed credentials and preferences',openAndInspect);
  await test('Actual copy UI handles stubbed success and denial without claiming connection',async()=>{const before=JSON.stringify({authorization:latestState.me.authorization,choice:currentChoice()}),descriptor=Object.getOwnPropertyDescriptor(navigator,'clipboard');let calls=0,reject=false;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{calls++;assert(typeof value==='string'&&value.length>30,'Stub receives instructions without persisting them');if(reject)throw new Error('QA clipboard denied');}}});try{click('#copy-agent-button');await waitFor(()=>document.querySelector('#copy-agent-button').dataset.copied==='true','stubbed copy success');assert(document.querySelector('#agent-copy-feedback').textContent.includes('已复制'),'Inline success shown');assert(document.querySelector('#agent-modal-connection').dataset.connected==='false'&&!latestState.me.agentConnected,'Copy does not claim Agent connectivity');reject=true;click('#copy-agent-button');await waitFor(()=>document.querySelector('#copy-agent-button').dataset.copied==='false'&&!document.querySelector('#copy-agent-button').disabled,'stubbed denial fallback');const field=document.querySelector('#agent-prompt');assert(document.querySelector('#agent-instructions').open&&document.activeElement===field&&field.selectionStart===0&&field.selectionEnd===field.value.length,'Denial expands and selects full manual instructions');assert(document.querySelector('#agent-copy-feedback').textContent.includes('自动复制未成功'),'Manual-copy feedback shown');assert(before===JSON.stringify({authorization:latestState.me.authorization,choice:currentChoice()}),'Copy leaves authorization and choice unchanged');return {stubCalls:calls,realClipboardWrites:0,manualSelectionConfirmed:true,connectionClaimedByCopy:false};}finally{if(descriptor)Object.defineProperty(navigator,'clipboard',descriptor);else delete navigator.clipboard;}});
  await test('Real local Agent protocol self-check updates the still-open dialog through polling',async()=>{const field=document.querySelector('#agent-prompt'),match=field.value.match(/Agent Bearer token：([^\r\n]+)/);assert(match,'Own-seat protocol credential is available only inside the private dialog');const before=latestState.me.authorization;const response=await fetch('/api/rooms/'+qaRoomId+'/agent/check',{headers:{Authorization:'Bearer '+match[1].trim()}}),data=await response.json();assert(response.ok&&data.connected===true,'Local test Agent self-check accepted');await waitFor(()=>latestState.me.agentConnected&&document.querySelector('#agent-modal-connection').dataset.connected==='true'&&document.querySelector('.agent-connect-entry').dataset.connected==='true','real self-check status from normal room polling');assert(latestState.me.authorization===before,'Self-check does not change authorization');return {protocol:'real localhost GET agent/check by QA; not an external Agent/model',openDialogUpdated:true,authorizationUnchanged:true};});
  await closeAgent();click('[data-action="start"]');await waitFor(()=>latestState.phase!=='lobby','practice start');await enterDecision();await fillChoice('A10');await closeSheets();
  await test('Decision entry and reopened dialog retain a chosen draft and authorization',async()=>{const layout=entryLayout(),before=JSON.stringify({authorization:latestState.me.authorization,choice:currentChoice()});const dialog=await openAndInspect();assert(document.querySelector('#agent-modal-connection').dataset.connected==='true','Reopened dialog reflects the real self-check');await closeAgent();assert(before===JSON.stringify({authorization:latestState.me.authorization,choice:currentChoice()}),'Opening and closing leaves draft/authorization untouched');return {layout,dialog,draftPreserved:true,authorizationPreserved:true};});
  await test('Focused Agent-entry checks observed no application or shader error',()=>assert(report.errors.length===0,'No runtime or shader error'));
  report.passed=true;report.completedAt=new Date().toISOString();await publish('completed');
 }catch(error){report.passed=false;report.error={name:error.name,message:clean(error.message)};report.completedAt=new Date().toISOString();await publish('failed');}
 finally{window.fetch=realFetch;console.error=realConsoleError;running=false;}
 return report;
}
window.runAgentEntryQA=runAgentEntryQA;
await runAgentEntryQA();
