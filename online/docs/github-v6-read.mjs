import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(fs.readFileSync(path.join(process.env.TEMP,'growth-tavern-v6-github-20261117/upload-manifest.json'),'utf8'));
if(process.argv[2]==='--chunk'){
 const index=Number(process.argv[3]),offset=Number(process.argv[4]),limit=Number(process.argv[5]||18000);if(!Number.isInteger(index)||!Number.isInteger(offset)||limit<1||limit>20000)throw Error('Invalid chunk parameters');
 const file=manifest.files[index],bytes=fs.readFileSync(path.join(manifest.stage,file.path));if(createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('Snapshot changed');const text=bytes.toString('utf8');console.log(JSON.stringify({index,offset,total:text.length,chunk:text.slice(offset,offset+limit)}));
}else{
 console.log(JSON.stringify({...manifest,files:manifest.files.map((file,index)=>({...file,index,...(!file.unchanged&&!file.reusable&&!file.binary?{textLength:fs.readFileSync(path.join(manifest.stage,file.path),'utf8').length}:{})}))}));
}
