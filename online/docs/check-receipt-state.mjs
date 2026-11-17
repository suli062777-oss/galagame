import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const selectors=['#main','#receipt-status','#mobile-action-state','#mobile-action-title','[data-action=toggle-action-sheet]','#action-form button[type=submit]','#action-error'];
const nodes=Object.fromEntries(selectors.map(s=>[s,{dataset:{},textContent:'',innerHTML:'',disabled:false}]));
const noop=()=>{},context=vm.createContext({document:{querySelector:s=>nodes[s]||null,addEventListener:noop},window:{addEventListener:noop},history:{},location:{hash:'#/tavern',search:'',origin:'http://localhost'},localStorage:{getItem:()=>null},matchMedia:()=>({matches:false}),URL,URLSearchParams,crypto:globalThis.crypto,console,setTimeout,clearTimeout,structuredClone});
let app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');app=app.replace(/^import .*$/gm,'').replace("window.addEventListener('hashchange',render);render();",'');
vm.runInContext(app+`;globalThis.simulateReceipt=input=>{config={actions:[{id:'A03',name:'内容获客'},{id:'A04',name:'用户调研'}]};currentState=structuredClone(input.state);draftState=structuredClone(input.draft);submissionError=input.error||'';submissionUncertain=!!input.uncertain;unconfirmedAction=structuredClone(input.sent);submitting=!!input.submitting;serverOffset=0;updateReceipt();return {draft:structuredClone(draftState),error:submissionError};};`,context);
const a={id:'A03',target:0,scale:1},b={id:'A04',target:1,scale:1},key='receipt-test:1';
const state={id:'receipt-test',round:1,phase:'decision',deadline:Date.now()+100000,me:{id:'me',action:a},players:[{id:'me',bankrupt:false}]};
function check(name,input,expected){const result=context.simulateReceipt(input);assert.equal(nodes['#receipt-status'].dataset.state,expected);return result;}
let result=check('lost response is reconciled',{state,draft:{key,action:a,dirty:true},uncertain:true,error:'Network lost',sent:{key,action:a}},'accepted');assert.equal(result.draft.dirty,false);assert.equal(result.error,'');
result=check('later user draft survives reconciliation',{state,draft:{key,action:b,dirty:true},uncertain:true,error:'Network lost',sent:{key,action:a}},'draft');assert.equal(result.draft.dirty,true);assert.equal(result.draft.action.id,b.id);assert.equal(result.error,'');
check('no matching authority remains uncertain',{state:{...state,me:{id:'me',action:null}},draft:{key,action:a,dirty:true},uncertain:true,error:'Network lost',sent:{key,action:a}},'uncertain');
check('deadline locks immediately',{state:{...state,deadline:Date.now()-1},draft:null,sent:null},'locked');assert.equal(nodes['#action-form button[type=submit]'].disabled,true);
result=check('confirmed rejection preserves draft',{state,draft:{key,action:b,dirty:true},error:'HTTP 503',sent:{key,action:b}},'error');assert.equal(result.draft.action.id,b.id);
check('request in flight disables resubmission',{state,draft:{key,action:b,dirty:true},sent:{key,action:b},submitting:true},'submitting');assert.equal(nodes['#action-form button[type=submit]'].disabled,true);
console.log('6 receipt behaviors passed: lost-response reconciliation, newer draft preservation, uncertainty, deadline lock, rejection, pending. No network.');
