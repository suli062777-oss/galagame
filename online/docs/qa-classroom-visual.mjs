/* Read-only preview checks for the generated asset, home and entry layouts. */
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {spawn} from 'node:child_process';
const output=resolve('docs/evidence/classroom-visual');await mkdir(output,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'classroom-visual-'));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
const report={date:'2026-11-18',scope:'Read-only actual preview home/entry; Chrome desktop emulated widths; no rooms or model calls',pages:[],errors:[]};let ws;
try{
 let port;for(let i=0;i<100;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await pause(100);}}
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 let id=0;const pending=new Map();ws.addEventListener('message',e=>{const d=JSON.parse(e.data);if(d.id){const p=pending.get(d.id);if(p){pending.delete(d.id);d.error?p.reject(Error(JSON.stringify(d.error))):p.resolve(d.result);}}else if(d.method==='Runtime.exceptionThrown')report.errors.push(d.params.exceptionDetails.text);});
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 const run=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
 await cdp('Page.enable');await cdp('Runtime.enable');
 for(const width of [1440,1024,768,390,360,320]){
  for(const page of ['home','tavern']){
   await cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:false});await cdp('Page.navigate',{url:'http://localhost:3020/#/'+page});
   let loaded=false;for(let i=0;i<100;i++){if(await run(`!!document.querySelector(${JSON.stringify(page==='home'?'.classroom-home':'.classroom-entry')})`)){loaded=true;break;}await pause(100);}if(!loaded)throw Error('Preview did not render '+page);
   await run('document.fonts.ready.then(()=>true)');await pause(120);
   const data=await run(`(()=>{const e=document.querySelector('#entry-submit'),r=e?.getBoundingClientRect(),input=document.querySelector('input[name=name]'),s=input?getComputedStyle(input):null,hero=document.querySelector('.hero-art img'),hs=hero?getComputedStyle(hero):null;return{page:${JSON.stringify(page)},width:innerWidth,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,entry:r?{top:r.top,bottom:r.bottom,visible:r.top>=0&&r.bottom<=innerHeight}:null,input:s?{background:s.backgroundColor,color:s.color,placeholder:getComputedStyle(input,'::placeholder').color}:null,hero:hero?{naturalWidth:hero.naturalWidth,objectFit:hs.objectFit,aspectRatio:hs.aspectRatio,filter:hs.filter}:null};})()`);
   report.pages.push(data);
   if(width===1440||width===390||width===320){const png=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,clip:{x:0,y:0,width,height:844,scale:1}});await writeFile(join(output,page+'-'+width+'.png'),Buffer.from(png.data,'base64'));}
  }
 }
 report.passed=report.errors.length===0&&report.pages.every(p=>p.scrollWidth<=p.clientWidth&&(!p.hero||p.hero.naturalWidth>0)&&(!p.entry||p.width>800||p.entry.visible));
}catch(error){report.passed=false;report.fatal=error.stack;}
finally{ws?.close();browser.kill();await pause(600);const p=resolve(profile),t=resolve(tmpdir());if(p.startsWith(t+sep)&&p.slice(t.length+1).startsWith('classroom-visual-')){try{await rm(p,{recursive:true,force:true});}catch{}}await writeFile(join(output,'preview-checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
