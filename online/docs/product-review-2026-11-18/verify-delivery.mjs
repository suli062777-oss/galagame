import {createServer} from 'node:http';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve,extname,sep,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
const root=resolve('docs/product-review-2026-11-18'),scratch=await mkdtemp(join(tmpdir(),'growth-report-'));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const types={'.html':'text/html; charset=utf-8','.png':'image/png','.webp':'image/webp','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8'};
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'}).end(bytes);}catch{if(!res.headersSent)res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+scratch,'about:blank'],{windowsHide:true,stdio:'ignore'});
const result={date:'2026-11-18',scope:'Review artifacts only; no production state changes',pages:[],interactions:[],errors:[]};let ws;
try{
 let port;for(let i=0;i<100;i++){try{port=(await readFile(join(scratch,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await pause(100);}}
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let id=0;const pending=new Map();ws.addEventListener('message',e=>{const d=JSON.parse(e.data);if(d.id){const p=pending.get(d.id);if(p){pending.delete(d.id);d.error?p.reject(Error(JSON.stringify(d.error))):p.resolve(d.result);}}else if(d.method==='Runtime.exceptionThrown')result.errors.push(d.params.exceptionDetails.text);});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 const run=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
 const wait=async expression=>{for(let i=0;i<80;i++){if(await run(expression))return;await pause(70);}throw Error('Wait failed: '+expression);};
 await cdp('Page.enable');await cdp('Runtime.enable');
 for(const page of ['review.html','product-ux-review.html','reference-research.html','visual-review.html','direction-demo.html']){
  for(const width of [1440,390]){
   await cdp('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:false});await cdp('Page.navigate',{url:base+'/'+page});await wait("document.readyState==='complete'&&!!document.querySelector('h1')");await pause(120);
   const data=await run(`({page:${JSON.stringify(page)},width:innerWidth,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,brokenImages:[...document.images].filter(x=>!x.complete||x.naturalWidth===0).map(x=>x.src),headings:document.querySelectorAll('h2,h3').length})`);
   if(data.scrollWidth>data.clientWidth||data.brokenImages.length)throw Error(JSON.stringify(data));result.pages.push(data);
   if(width===1440&&['review.html','direction-demo.html'].includes(page)){const p=await cdp('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:1440,height:950,scale:1},captureBeyondViewport:false});await writeFile(join(root,'screenshots',page.replace('.html','')+'-preview.png'),Buffer.from(p.data,'base64'));}
  }
 }
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await cdp('Page.navigate',{url:base+'/direction-demo.html'});await wait("!!document.querySelector('#action')");
 for(const step of ['entry','mission','decision','review']){await run(`document.querySelector('[data-step=${step}]').click()`);const shown=await run("[...document.querySelectorAll('[data-screen]')].filter(x=>!x.hidden).map(x=>x.dataset.screen)");if(shown.length!==1||shown[0]!==step)throw Error('State switch '+step);result.interactions.push({step,visible:shown});}
 await run("document.querySelector('[data-step=entry]').click();document.querySelector('[data-mode=practice]').click()");if(!await run("document.querySelector('#code-field').hidden"))throw Error('Practice code must hide');
 await run("document.querySelector('[data-step=decision]').click();document.querySelector('[data-group=learn]').click()");if(await run("document.querySelector('#action').options.length")!==3)throw Error('Action group');await run("document.querySelector('#confirm').click()");if(await run("document.querySelector('#receipt').hidden"))throw Error('Demo receipt');
 const png=await cdp('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:1440,height:1000,scale:1},captureBeyondViewport:false});await writeFile(join(root,'screenshots','decision-proposal-preview.png'),Buffer.from(png.data,'base64'));
 result.passed=result.errors.length===0;
}catch(error){result.passed=false;result.fatal=error.stack;}
finally{ws?.close();browser.kill();await new Promise(r=>server.close(r));await pause(700);const p=resolve(scratch),t=resolve(tmpdir());if(p.startsWith(t+sep)&&p.slice(t.length+1).startsWith('growth-report-')){try{await rm(p,{recursive:true,force:true});}catch{}}await writeFile(join(root,'delivery-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}
