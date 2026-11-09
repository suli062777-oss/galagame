/** D1-authoritative single-row CAS. No isolate-local room cache. */
function database(env){if(!env?.DB?.prepare){const e=new Error('数据库暂不可用');e.status=503;e.code='storage_unavailable';throw e;}return env.DB;}
function decode(row){if(!row)return null;const room=JSON.parse(row.data);if(!room||typeof room!=='object'||room.id!==row.id)throw Error('Invalid persisted room');return room;}
export async function readRoom(env,id){const row=await database(env).prepare('SELECT id, revision, data FROM rooms WHERE id = ?').bind(id).first();return decode(row);}
export async function createRoom(env,room){
 const value=structuredClone(room);value.version=Math.max(1,Number(value.version)||1);
 try{const result=await database(env).prepare('INSERT INTO rooms (id, revision, data, updated_at) VALUES (?, ?, ?, ?)').bind(value.id,value.version,JSON.stringify(value),Date.now()).run();if(result?.success===false)throw Error('Room insert failed');return value;}
 catch(error){if(/unique|constraint.*primary|primary.*constraint/i.test(String(error?.message)))return null;throw error;}
}
export async function mutateRoom(env,id,fn){
 const db=database(env);
 for(let attempt=0;attempt<10;attempt++){
  const row=await db.prepare('SELECT id, revision, data FROM rooms WHERE id = ?').bind(id).first();if(!row)return null;
  const current=decode(row),next=structuredClone(current),outcome=fn(next);
  if(outcome&&typeof outcome.then==='function')throw Error('Room mutations must be synchronous');
  if(outcome===false)return current;
  next.version=Math.max(Number(current.version)||0,Number(row.revision)||0)+1;
  const response=await db.prepare('UPDATE rooms SET revision = ?, data = ?, updated_at = ? WHERE id = ? AND revision = ?').bind(next.version,JSON.stringify(next),Date.now(),id,row.revision).run();
  if(Number(response?.meta?.changes??response?.changes)===1)return next;
 }
 const error=new Error('同桌状态正在更新，请重试');error.status=409;error.code='state_conflict';throw error;
}
