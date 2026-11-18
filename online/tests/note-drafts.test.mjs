import test from 'node:test';
import assert from 'node:assert/strict';
import {createNoteDrafts} from '../public/note-drafts.js';

function storage(){const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};}
function form(id='',value={}){const controls={title:{value:value.title||''},body:{value:value.body||''},tag:{value:value.tag||'自由思考'}};return {dataset:{id},elements:{...controls,namedItem:name=>controls[name]}};}

test('unsaved text survives a new service and form without changing the formal note',()=>{
 const store=storage(),saved={id:'note-a',title:'正式标题',body:'正式正文',tag:'自由思考',updated:50},original=structuredClone(saved);
 const first=form(saved.id,saved),drafts=createNoteDrafts({storage:store,now:()=>100});drafts.restore(first,{savedNote:saved});
 first.elements.title.value='尚未保存的题目';first.elements.body.value='我观察到的事实：\n保留换行与用户原文。';
 assert.equal(drafts.capture(first).persisted,true);
 const second=form(saved.id,saved),restored=createNoteDrafts({storage:store}).restore(second,{savedNote:saved});
 assert.equal(restored.restored,true);assert.equal(second.elements.title.value,'尚未保存的题目');assert.equal(second.elements.body.value,first.elements.body.value);assert.deepEqual(saved,original);
});

test('new-note and individual-note drafts use separate keys; clearing one preserves others',()=>{
 const store=storage(),drafts=createNoteDrafts({storage:store});
 for(const [id,text]of [['','未命名草稿'],['note-a','甲'],['note-b','乙']]){const f=form(id);drafts.restore(f);f.elements.body.value=text;drafts.capture(f);}
 drafts.clear('note-a');const next=createNoteDrafts({storage:store});
 assert.equal(next.get('note-a'),null);assert.equal(next.get('').body,'未命名草稿');assert.equal(next.get('note-b').body,'乙');
});

test('successful save marks current raw form clean and prevents route capture resurrecting draft',()=>{
 const store=storage(),drafts=createNoteDrafts({storage:store}),f=form();drafts.restore(f);
 f.elements.body.value='  保存前保留用户空格\n';drafts.capture(f);assert.ok(drafts.get(''));
 drafts.markSaved(f);assert.equal(drafts.capture(f).unchanged,true);assert.equal(drafts.get(''),null);assert.equal(store.values.size,0);
});

test('quota failure keeps this-session text and reports memory scope honestly',()=>{
 const store={getItem:()=>null,setItem(){throw Error('quota');},removeItem(){throw Error('quota');}},drafts=createNoteDrafts({storage:store}),first=form('note-a');drafts.restore(first);
 first.elements.body.value='配额不足时的正文';const captured=drafts.capture(first);assert.equal(captured.persisted,false);assert.equal(captured.mode,'memory');assert.match(captured.message,/本次会话/);
 const second=form('note-a');const restored=drafts.restore(second);assert.equal(restored.restored,true);assert.equal(second.elements.body.value,first.elements.body.value);assert.match(restored.message,/关闭前/);
});

test('unreadable persisted draft is not silently overwritten',()=>{
 const store=storage(),key='ga:note-drafts:v1:note-a';store.setItem(key,'{损坏的旧数据');const drafts=createNoteDrafts({storage:store}),f=form('note-a');
 assert.equal(drafts.restore(f).reason,'unreadable');f.elements.body.value='本次会话新草稿';assert.equal(drafts.capture(f).persisted,false);assert.equal(store.getItem(key),'{损坏的旧数据');assert.equal(drafts.get('note-a').body,'本次会话新草稿');
});

test('newer saved version requires explicit restore; passive route capture preserves conflicted draft',()=>{
 const store=storage(),old={title:'旧正式',body:'旧正文',tag:'自由思考',updated:50},first=form('note-a',old),one=createNoteDrafts({storage:store,now:()=>100});one.restore(first,{savedNote:old});first.elements.body.value='未保存的旧草稿';one.capture(first);
 const newer={title:'新正式',body:'另一处保存的新正文',tag:'自由思考',updated:200},second=form('note-a',newer),two=createNoteDrafts({storage:store});
 assert.equal(two.restore(second,{savedNote:newer}).conflict,true);assert.equal(second.elements.body.value,newer.body);assert.equal(two.capture(second).conflict,true);assert.equal(two.get('note-a').body,'未保存的旧草稿');
 assert.equal(two.restore(second,{savedNote:newer,force:true}).restored,true);assert.equal(second.elements.body.value,'未保存的旧草稿');
});

test('explicit discard returns to saved values and removes only that draft',()=>{
 const store=storage(),saved={title:'已保存',body:'正式正文',tag:'自由思考',updated:50},f=form('note-a',saved),drafts=createNoteDrafts({storage:store});drafts.restore(f,{savedNote:saved});f.elements.body.value='要丢弃的修改';drafts.capture(f);
 assert.equal(drafts.discard(f,{savedNote:saved}).cleared,true);assert.equal(f.elements.body.value,saved.body);assert.equal(drafts.capture(f).unchanged,true);assert.equal(drafts.get('note-a'),null);
});
