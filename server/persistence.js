import fs from 'node:fs';
import path from 'node:path';
/** Single-process durable local store. Atomic rename + fsync; not a multi-writer DB. */
export function createStore(dataDir) {
  fs.mkdirSync(dataDir,{recursive:true,mode:0o700});
  const file=path.join(dataDir,'rooms.json');
  let state={schema:1,rooms:{}};
  if(fs.existsSync(file)){
    const parsed=JSON.parse(fs.readFileSync(file,'utf8'));
    if(parsed.schema!==1||!parsed.rooms||typeof parsed.rooms!=='object')throw new Error('持久数据schema不匹配；未覆盖原数据');
    state=parsed;
  }
  return {
    readAll:()=>structuredClone(state.rooms),
    save(rooms){
      const next={schema:1,rooms},temp=path.join(dataDir,`.rooms-${process.pid}.tmp`);
      let fd;
      try{fd=fs.openSync(temp,'w',0o600);fs.writeFileSync(fd,JSON.stringify(next));fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(temp,file);const dir=fs.openSync(dataDir,'r');try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}state=structuredClone(next);}
      catch(error){if(fd!==undefined)fs.closeSync(fd);try{fs.unlinkSync(temp);}catch{}throw error;}
    },file
  };
}
