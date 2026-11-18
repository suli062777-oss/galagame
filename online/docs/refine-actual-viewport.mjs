import fs from 'node:fs';

const appPath=new URL('../public/app.js',import.meta.url),cssPath=new URL('../public/tavern-v3.css',import.meta.url);
let app=fs.readFileSync(appPath,'utf8'),css=fs.readFileSync(cssPath,'utf8');
const replace=(source,before,after)=>{if(!source.includes(before))throw new Error(`Missing source: ${before.slice(0,90)}`);return source.replace(before,after);};
app=replace(app,"function phaseName(s)","function playerDisplayName(player){const name=String(player?.name||'');return player?.isBot?name.split('·')[0].trim():name;}\nfunction phaseName(s)");
app=replace(app,"<span>${p?esc(p.name):'等待朋友'}${p?.id===me.id?' · 你':''}${p?.isBot?' · 脚本':''}</span>","<span title=\"${p?esc(p.name):'等待朋友'}\">${p?esc(playerDisplayName(p)):'等待朋友'}${p?.id===me.id?' · 你':''}</span>");
app=replace(app,'<button data-action="seat-detail" data-id="${esc(p.id)}"><span class="ranking-position">','<button data-action="seat-detail" data-id="${esc(p.id)}" title="${esc(p.name)}" aria-label="查看${esc(p.name)}的公开经营资料"><span class="ranking-position">');
app=replace(app,'${esc(p.name)}${p.id===s.me?.id?\'<small>你</small>\':\'\'}${p.isBot?\'<small>脚本</small>\':\'\'}</span><b>${fmt(p.score)}','<span class="ranking-label">${esc(playerDisplayName(p))}</span>${p.id===s.me?.id?\'<small>你</small>\':\'\'}</span><b>${fmt(p.score)}');
app=replace(app,'<th>${esc(p.name)}</th>','<th title="${esc(p.name)}">${esc(playerDisplayName(p))}</th>');
app=replace(app,"}toast('服务端已接收，截止前仍可更新。');return true;","}return true;");
app=replace(app,"case 'start':await act('start');toast('第一回合开始。');break;","case 'start':await act('start');break;");
app=replace(app,"case 'advance':await act('advance');toast(currentState.phase==='finished'?'六回合已完成。':'已结算，进入下一回合。');break;","case 'advance':await act('advance');break;");
css=replace(css,'height:clamp(365px,calc(100dvh - 322px),530px)','height:clamp(370px,calc(100dvh - 440px),410px)');
css=replace(css,'.ranking-name>i{','.ranking-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ranking-name>i{');
css+='\n/* Actual browser capture: preserve the roundtable, shorten repeated identity labels. */\n.lobby-seat-status li{min-width:0;max-width:100%}.lobby-seat-status li>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lobby-seat-status li>i{flex-shrink:0}\n@media(max-width:900px){body.in-game #toast{bottom:calc(112px + env(safe-area-inset-bottom))}}\n';
fs.writeFileSync(appPath,app);fs.writeFileSync(cssPath,css);
console.log('Applied actual-capture refinements to app and V3 stylesheet.');
