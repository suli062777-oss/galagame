import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:3020';
async function api(path,body,token){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();assert.ok(r.ok,d.error);return d;}
const catalog=await api('/api/config'),session=await api('/api/rooms',{name:'界面结构校验',mode:'practice'});
const states=[session.state];states.push((await api(`/api/rooms/${session.roomId}/start`,{},session.token)).state);states.push((await api(`/api/rooms/${session.roomId}/advance`,{},session.token)).state);
const noop=()=>{};const context=vm.createContext({document:{querySelector:()=>({}),addEventListener:noop},window:{addEventListener:noop},history:{},location:{hash:'#/tavern',search:'',origin:base},localStorage:{getItem:()=>null},matchMedia:()=>({matches:false}),URL,URLSearchParams,crypto:globalThis.crypto,console,setTimeout,clearTimeout,structuredClone});
let app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');app=app.replace(/^import .*$/gm,'').replace("window.addEventListener('hashchange',render);render();",'');
vm.runInContext(app+`;globalThis.checkView=(state,catalog)=>{config=catalog;currentState=state;return gameMarkup(state);};`,context);
for(const state of states){const html=context.checkView(state,catalog),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'Duplicate IDs in '+state.phase);assert.ok(html.includes('id="insight-panel"'));assert.ok(html.includes('data-action="insight-tab"'));assert.equal((html.match(/class="arena-toolbar"/g)||[]).length,0);if(state.phase==='decision'){assert.ok(html.includes('id="action-form"'));assert.ok(html.includes('id="action-target-label"'));assert.ok(html.includes('data-action="toggle-action-sheet"'));}console.log(`${state.phase}: unique IDs ${ids.length}; information rail and action surfaces valid`);}
console.log('Template checks use the actual local practice API. If its host is enabled, starting a room can trigger a real server-side model request; this script never calls the provider directly.');
