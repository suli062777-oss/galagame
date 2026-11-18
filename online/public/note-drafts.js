const limits={title:100,body:20000,tag:100};
const fields=['title','body','tag'];
const cleanValues=value=>Object.fromEntries(fields.map(name=>[name,String(value?.[name]??(name==='tag'?'自由思考':'')).slice(0,limits[name])]));
const sameValues=(a,b)=>fields.every(name=>a[name]===b[name]);
const noteId=form=>String(form?.dataset?.id||'');
const validId=value=>value===''||/^[A-Za-z0-9_-]{1,100}$/.test(value);
const control=(form,name)=>form?.elements?.namedItem?.(name)||form?.elements?.[name];
const readForm=form=>cleanValues(Object.fromEntries(fields.map(name=>[name,control(form,name)?.value])));

export function createNoteDrafts({storage,key='ga:note-drafts:v1',now=()=>Date.now()}={}){
 let backend=storage,mode='local',reason='',storageRead=false;
 const memory=new Map(),baselines=new WeakMap(),conflicts=new WeakSet(),blocked=new Set();
 const storageKey=id=>key+':'+(id||'new');
 const fail=(why)=>{mode='memory';reason=why;};
 function getBackend(){if(storageRead)return backend;storageRead=true;try{if(backend===undefined)backend=globalThis.localStorage;if(!backend)fail('unavailable');}catch{backend=null;fail('unavailable');}return backend;}
 function read(id){
  if(!validId(id))return null;
  if(memory.has(id))return memory.get(id);
  const target=getBackend();if(!target||blocked.has(id))return null;
  try{
   const raw=target.getItem(storageKey(id));if(!raw)return null;
   const value=JSON.parse(raw);
   if(value?.version!==1||value.noteId!==id||typeof value.title!=='string'||typeof value.body!=='string'||typeof value.tag!=='string'||!Number.isFinite(value.updated))throw Error('shape');
   const draft={...cleanValues(value),noteId:id,version:1,updated:value.updated,baseUpdated:Number(value.baseUpdated)||0};memory.set(id,draft);return draft;
  }catch{blocked.add(id);fail('unreadable');return null;}
 }
 function persist(id,value){
  memory.set(id,value);const target=getBackend();if(!target||blocked.has(id)){fail(blocked.has(id)?'unreadable':'unavailable');return false;}
  try{value===null?target.removeItem(storageKey(id)):target.setItem(storageKey(id),JSON.stringify(value));mode='local';reason='';return true;}catch{fail('write-failed');return false;}
 }
 function message(restored=false){return mode==='local'?(restored?'已恢复未保存草稿，修改会继续暂存在此浏览器。':'草稿已暂存在此浏览器，点击保存后收入札记。'):(restored?'已恢复本次会话中的草稿；本机存储不可用，关闭前请复制当前正文。':'草稿仅暂存在本次会话，关闭前请复制当前正文。');}
 function clear(id=''){if(!validId(id))return {cleared:false,persisted:false};return {cleared:true,persisted:persist(id,null),mode,reason};}
 function writeForm(form,values){for(const name of fields){const field=control(form,name);if(!field)continue;if(name==='tag'&&field.options&&![...field.options].some(option=>option.value===values[name])&&field.ownerDocument){const option=field.ownerDocument.createElement('option');option.value=values[name];option.textContent=values[name];field.append(option);}field.value=values[name];}}
 return {
  capture(form,{savedNote}={}){
   if(!form||!validId(noteId(form)))return {captured:false};
   if(conflicts.has(form))return {captured:false,conflict:true,mode,reason,message:'请先选择恢复或丢弃旧草稿，再继续暂存。'};
   const id=noteId(form),values=readForm(form),baseline=baselines.get(form)||{values:cleanValues(savedNote),updated:Number(savedNote?.updated)||0};
   if(sameValues(values,baseline.values)||(!id&&!values.title&&!values.body)){const existing=read(id);if(existing)clear(id);return {captured:false,unchanged:true,mode,reason};}
   const draft={...values,noteId:id,version:1,updated:now(),baseUpdated:baseline.updated};const persisted=persist(id,draft);
   return {captured:true,persisted,mode,reason,message:message(false)};
  },
  restore(form,{savedNote,force=false}={}){
   if(!form||!validId(noteId(form)))return {found:false,restored:false};
   const id=noteId(form),baseline={values:readForm(form),updated:Number(savedNote?.updated)||0};baselines.set(form,baseline);
   const draft=read(id);if(!draft)return {found:false,restored:false,mode,reason,message:mode==='memory'?'草稿存储暂不可用；当前正文未被覆盖。':''};
   if(sameValues(draft,baseline.values)){clear(id);return {found:false,restored:false,mode,reason};}
   if(!force&&savedNote&&baseline.updated>draft.updated&&baseline.updated!==draft.baseUpdated){conflicts.add(form);return {found:true,restored:false,conflict:true,mode,reason,message:'检测到较新的已保存版本。未保存草稿仍在，尚未覆盖当前正文。'};}
   conflicts.delete(form);writeForm(form,draft);return {found:true,restored:true,mode,reason,message:message(true),updated:draft.updated};
  },
  markSaved(form){if(!form)return {cleared:false};conflicts.delete(form);const result=clear(noteId(form));baselines.set(form,{values:readForm(form),updated:now()});return result;},
  clear,
  discard(form,{savedNote}={}){if(!form)return {cleared:false};conflicts.delete(form);const id=noteId(form),baseline=baselines.get(form),values=savedNote?cleanValues(savedNote):(baseline?.values||cleanValues(null));writeForm(form,values);baselines.set(form,{values,updated:Number(savedNote?.updated)||baseline?.updated||0});return clear(id);},
  get(id=''){return read(id);},
  status(){getBackend();return {mode,reason};}
 };
}
