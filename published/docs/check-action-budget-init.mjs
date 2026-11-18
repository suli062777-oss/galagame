import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {ACTIONS} from '../server/engine.js';

// Run the real room update with untouched initial controls. No input event is sent.
const catalog={actions:ACTIONS};
const noop=()=>{};
const nodes={
 '#action-form':{},
 '#action-id':{value:catalog.actions[0].id},
 '#action-target':{value:'1'},
 '#action-scale':{value:'1',dataset:{}},
 '#action-target-label':{hidden:false},
 '#action-description':{textContent:''},
 '#action-estimate':{innerHTML:'',title:''}
};
const context=vm.createContext({document:{querySelector:s=>nodes[s]||null,addEventListener:noop},window:{addEventListener:noop},history:{},location:{hash:'#/tavern',search:'',origin:'http://127.0.0.1:3020'},localStorage:{getItem:()=>null},matchMedia:()=>({matches:false}),URL,URLSearchParams,crypto:globalThis.crypto,console,setTimeout,clearTimeout,structuredClone});
let source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
source=source.replace(/^import .*$/gm,'').replace("window.addEventListener('hashchange',render);render();",'');
vm.runInContext(source+`;globalThis.budgetCheck=(catalog,cash)=>{config=catalog;currentState={id:'budget-regression',phase:'decision',round:1,deadline:Date.now()+45000,me:{id:'mine',action:null},players:[{id:'mine',cash}]};updateGame();};`,context);
context.budgetCheck(catalog,1200);
assert.match(nodes['#action-estimate'].innerHTML,/预计投入/);
assert.match(nodes['#action-estimate'].innerHTML,/可用预算 <b>1,180<\/b>/);
assert.match(nodes['#action-estimate'].innerHTML,/已留20运营费/);
assert.ok(nodes['#action-description'].textContent.trim(),'Initial description is populated without user input');
assert.match(nodes['#action-estimate'].title,/不会立即扣款/);
const all=catalog.actions.find(action=>action.scope==='all');assert.ok(all);
nodes['#action-id'].value=all.id;context.budgetCheck(catalog,800);
assert.equal(nodes['#action-target-label'].hidden,true);assert.equal(nodes['#action-target'].disabled,true);assert.equal(nodes['#action-target'].value,'0');
assert.match(nodes['#action-estimate'].innerHTML,/可用预算 <b>780<\/b>/);
const targeted=catalog.actions.find(action=>action.scope!=='all');assert.ok(targeted);
nodes['#action-id'].value=targeted.id;context.budgetCheck(catalog,800);
assert.equal(nodes['#action-target-label'].hidden,false);assert.equal(nodes['#action-target'].disabled,false);
console.log('Untouched initial room update populates budget/description; cash refresh and all/targeted scope visibility pass. No model call or room creation.');
