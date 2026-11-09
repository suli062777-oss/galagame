import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dir=path.join(root,'worker');
const sharp=(await import('sharp').catch(()=>import('/Users/lisuhang1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs'))).default;
const assets={};
async function walk(relative=''){
 for(const e of fs.readdirSync(path.join(root,'public',relative),{withFileTypes:true})){
  const rel=relative?`${relative}/${e.name}`:e.name;
  if(e.isDirectory()){await walk(rel);continue;}
  if(!e.isFile()||e.name.startsWith('.'))continue;
  let bytes=fs.readFileSync(path.join(root,'public',rel));const ext=path.extname(rel).slice(1).toLowerCase();
  const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml',png:'image/png',webp:'image/webp',jpg:'image/jpeg'};
  let type=types[ext]||'application/octet-stream';
  if(ext==='png'){bytes=await sharp(bytes).webp({quality:86}).toBuffer();type='image/webp';}
  const text=['html','js','css','svg','json'].includes(ext);
  assets['/'+rel]={type,encoding:text?'utf8':'base64',body:bytes.toString(text?'utf8':'base64')};
 }
}
await walk();
fs.writeFileSync(path.join(dir,'assets.js'),'export const ASSETS='+JSON.stringify(assets)+';\n');
const factories=new Map();
function compile(id){
 if(factories.has(id))return;factories.set(id,'');
 let code=fs.readFileSync(path.join(dir,id),'utf8'),exports=[],deps=[];
 code=code.replace(/^import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?\s*$/gm,(_match,clause,specifier)=>{
  if(!specifier.startsWith('.'))throw Error('External runtime dependency: '+specifier);
  const target=path.posix.normalize(path.posix.join(path.posix.dirname(id),specifier));deps.push(target);
  if(clause.trim().startsWith('{'))return 'const '+clause.trim().replace(/\bas\b/g,':')+'=__require('+JSON.stringify(target)+');';
  if(clause.trim().startsWith('* as '))return 'const '+clause.trim().slice(5)+'=__require('+JSON.stringify(target)+');';
  return 'const '+clause.trim()+'=__require('+JSON.stringify(target)+').default;';
 });
 code=code.replace(/^export\s+(async\s+)?function\s+(\w+)/gm,(_m,asyncPart,name)=>{exports.push(name);return (asyncPart||'')+'function '+name;});
 code=code.replace(/^export\s+(const|let|var|class)\s+(\w+)/gm,(_m,kind,name)=>{exports.push(name);return kind+' '+name;});
 code=code.replace(/^export\s*\{([^}]+)\};?\s*$/gm,(_m,names)=>{for(const n of names.split(',')){const [local,alias]=n.trim().split(/\s+as\s+/);exports.push(alias?alias+':'+local:local);}return '';});
 let hasDefault=false;code=code.replace(/^export\s+default\s+/gm,()=>{hasDefault=true;return 'const __default=';});
 if(hasDefault)exports.push('default:__default');
 factories.set(id,'()=>{\n'+code+'\nreturn {'+[...new Set(exports)].join(',')+'};\n}');
 for(const dependency of deps)compile(dependency);
}
compile('index.js');
const output='const __cache=Object.create(null);\nfunction __require(id){if(__cache[id])return __cache[id];const value=__factories[id]();__cache[id]=value;return value;}\nconst __factories={\n'+[...factories].map(([id,factory])=>JSON.stringify(id)+':'+factory).join(',\n')+'\n};\nexport default __require("index.js").default;\n';
const dist=path.join(root,'dist');fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(path.join(dist,'server'),{recursive:true});fs.mkdirSync(path.join(dist,'.openai'),{recursive:true});
fs.writeFileSync(path.join(dist,'server/index.js'),output);fs.copyFileSync(path.join(root,'.openai/hosting.json'),path.join(dist,'.openai/hosting.json'));
console.log(JSON.stringify({modules:factories.size,assets:Object.keys(assets).length,workerBytes:Buffer.byteLength(output),gzipBytes:zlib.gzipSync(output).length}));
