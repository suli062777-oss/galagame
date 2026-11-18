from pathlib import Path
import re

root=Path(__file__).resolve().parents[1]
path=root/'public/app.js'
s=path.read_text(encoding='utf-8')
assert "classroom-game.js" not in s, 'Already integrated'
imports="""import {renderHome as classroomHome,renderEntry as classroomEntry,setEntryMode,mountLabLearning} from './classroom-learning.js?v=20261118-classroom';
import {createNoteDrafts} from './note-drafts.js?v=20261118-classroom';
import {missionMarkup,actionOptions,actionPurposeMarkup,actionGuideMarkup,actionContextMarkup,roundSummaryMarkup,resultMarkup,roundReviewMarkup,conceptMarkup,roundNoteData,noteSourceMarkup,evidenceMarkup} from './classroom-game.js?v=20261118-classroom';
"""
s=imports+s

def replace_function(name,code):
 global s
 match=re.search(r'^(?:async )?function '+name+r'\(',s,re.M)
 assert match,name
 end=re.search(r'^(?:async )?function |^(?:const|let) |^document\.|^window\.',s[match.end():],re.M)
 finish=match.end()+end.start() if end else len(s)
 s=s[:match.start()]+code.rstrip()+'\n'+s[finish:]

replace_function('home',"""function home(){const resume=chapters.find(c=>(progress[c.id]?.percent||0)>0&&(progress[c.id]?.percent||0)<100)||chapters[0];main.innerHTML=classroomHome({bookMeta,readPercent:readPct(),resumeId:resume.id,sessions});}""")
replace_function('tavernLanding',"""function tavernLanding(){const invited=invitationRoom();if(invited&&credentials(invited)){consumeInvitation();go('tavern/'+invited);return;}main.innerHTML=classroomEntry({invited,sessions});prepareInvitationEntry();void refreshHostDisclosure();}""")
replace_function('prepareInvitationEntry',"""function prepareInvitationEntry(){const invited=invitationRoom();setEntryMode(document,'join');const form=$('#room-form');if(invited&&form)form.elements.roomId.value=invited;}""")

# Keep the existing engine projection, transport, receipts and 3D implementation.
s=s.replace("'preparing':'Agent准备'","'preparing':'开局准备'")
s=s.replace("preparing:'Agent准备'","preparing:'开局准备'")
s=s.replace("roomUi={tab:'world',seatId:null,sheet:null,actionOpen:false,history:false}","roomUi={tab:'world',seatId:null,sheet:null,actionOpen:false,history:false,reviewRound:null,sceneExpanded:false}")
s=s.replace('<div class="arena-main"><section class="arena-stage"','<div class="arena-main"><div id="classroom-result-slot"></div><div id="classroom-mission-slot"></div><section class="arena-stage"')
s=s.replace('<div id="globe-container" class="globe-container" aria-label="四位经营者围坐的三维圆桌"></div></section>','<div id="globe-container" class="globe-container" aria-label="四位经营者围坐的三维圆桌"></div><button class="scene-toggle" data-action="scene-toggle" aria-pressed="false">展开圆桌</button></section>')
s=s.replace('<section class="decision-panel arena-dock" id="decision-panel"','<div id="classroom-round-summary-slot"></div><section class="decision-panel arena-dock" id="decision-panel"')
s=s.replace("${catalog.map(a=>`<option value=\"${a.id}\" ${action.id===a.id?'selected':''}>${esc(a.name)}</option>`).join('')}","${actionOptions(catalog,action.id)}")
s=s.replace('<div id="suggestion-slot"></div><form id="action-form">','<div id="suggestion-slot"></div>${s.round===1&&!getStore(\'firstTurnHelpDismissed\',false)?\'<aside class="classroom-first-turn"><p>先看情报，再核对行动、人群与预算。默认草稿不是推荐，确认后才提交。</p><button type="button" class="quiet-button" data-action="dismiss-first-turn">知道了</button></aside>\':\'\'}${actionContextMarkup(s)}${actionPurposeMarkup()}<form id="action-form">')
# A finished room has one dedicated result surface, rather than another score card.
start=s.index(" if(s.phase==='finished'){",s.index('function decisionMarkup'))
end=s.index('\n const action=currentDraft',start)
s=s[:start]+''' if(s.phase==='finished')return `<div class="phase-actions classroom-finished-actions"><a class="button outline" href="#/tavern">再开一桌</a><button class="quiet-button" data-action="download-replay">导出完整回放</button><button class="quiet-button" data-action="scene-toggle">再看看圆桌</button></div>`;'''+s[end:]

s=s.replace("viewKey=key;document.body.dataset.gamePhase=s.phase;", "viewKey=key;document.body.dataset.gamePhase=s.phase;const requested=location.hash.split('/');if(requested[3]==='review'&&Number(requested[4])>=1&&Number(requested[4])<=6)roomUi.reviewRound=Number(requested[4]);")
s=s.replace("updateHostBroadcast(s);setMarkup($('#economy-summary')", "updateHostBroadcast(s);updateClassroomSurfaces(s);setMarkup($('#economy-summary')")
s=s.replace("const description=(typeof a?.effect", "const description=(typeof a?.effect")
s=s.replace("setText($('#action-description'),description);", "setText($('#action-description'),description);if($('#action-concept-link'))$('#action-concept-link').dataset.concept=a.concept||'K06';")
s=s.replace('<p id="action-description" class="action-description"></p>','<p id="action-description" class="action-description"></p><button type="button" class="quiet-button" id="action-concept-link" data-action="concept" data-concept="K06">理解这个行动背后的方法</button>')
s=s.replace("const latest=(s.world||[])","const latest=(s.world||[])")

# Preserve text fields during stable polling. Only factual summaries are refreshed.
helpers="""
let noteDraftManager=null;
function noteDrafts(){return noteDraftManager||(noteDraftManager=createNoteDrafts());}
function captureNoteDraft(){const form=$('#note-form');if(!form)return;const result=noteDrafts().capture(form);if(result.message)setText($('#note-save-status'),result.message);}
function restoreNoteDraft(savedNote,force=false){const form=$('#note-form');if(!form)return;const result=noteDrafts().restore(form,{savedNote,force});if(result.message)setText($('#note-save-status'),result.message);const old=$('#note-draft-choices');old?.remove();if(result.found){const actions=document.createElement('div');actions.id='note-draft-choices';actions.className='note-draft-choices';actions.innerHTML=(result.conflict?'<button type="button" class="quiet-button" data-action="restore-note-draft">恢复未保存草稿</button>':'')+'<button type="button" class="quiet-button" data-action="discard-note-draft">丢弃未保存草稿</button>';form.append(actions);}}
function updateClassroomSurfaces(s){
 setMarkup($('#classroom-mission-slot'),s.phase==='lobby'?missionMarkup(s):'');
 setMarkup($('#classroom-round-summary-slot'),roundSummaryMarkup(s));
 setMarkup($('#classroom-result-slot'),s.phase==='finished'?resultMarkup(s,roomUi.reviewRound,config?.actions||[]):'');
 const arena=$('.v3-room');if(arena)arena.dataset.sceneExpanded=String(Boolean(roomUi.sceneExpanded));
 document.querySelectorAll('.scene-toggle').forEach(button=>{button.textContent=roomUi.sceneExpanded?'收起圆桌':'展开圆桌';button.setAttribute('aria-pressed',String(Boolean(roomUi.sceneExpanded)));});
}
function openRoundReview(round){if(!currentState)return;closeRoomSheets();modal('回看第 '+Number(round)+' 轮',(['decision','preparing'].includes(currentState.phase)?'<p class="classroom-timer-note">本轮计时继续，查看后可以回到行动。</p>':'')+roundReviewMarkup(currentState,round,config?.actions||[]));}
function notesSourceBanner(note){const markup=noteSourceMarkup(note?.source);if(markup)$('#note-form')?.insertAdjacentHTML('beforebegin',markup);}
"""
idx=s.index('function notesPage(')
s=s[:idx]+helpers+'\n'+s[idx:]

# Render-time enhancement hooks are bounded to their own views.
needle='`;updateLabs();}'
assert needle in s
s=s.replace(needle,'`;updateLabs();mountLabLearning(document);}',1)
note_start=s.index('function notesPage(');note_end=s.index('\nasync function api',note_start)
note=s[note_start:note_end]
assert note.rstrip().endswith(';}')
note=note.rstrip()[:-1]+'notesSourceBanner(note);restoreNoteDraft(note);}\n'
s=s[:note_start]+note+s[note_end:]

# A chapter opened from a result can return directly to the chosen round.
s=s.replace("activeReadId=c.id;suspendReading=true;", "const from=location.hash.replace(/^#\\/?/,'').split('/');if(from[2]==='from'&&/^[A-Za-z0-9_-]{1,100}$/.test(from[3]||'')&&Number(from[4])>=1&&Number(from[4])<=6){$('.read-topline')?.insertAdjacentHTML('afterend',`<nav class=\"reading-return\"><a href=\"#/tavern/${esc(from[3])}/review/${Number(from[4])}\">← 回到第 ${Number(from[4])} 轮复盘</a><span>带着这次判断，读相关的方法。</span></nav>`);}activeReadId=c.id;suspendReading=true;")

old="case 'entry-mode':{const join=el.dataset.mode==='join';$('#room-form').elements.entry.value=join?'join':'create';$('#join-field').hidden=!join;$('#create-fields').hidden=join;document.querySelectorAll('.entry-tabs button').forEach(b=>b.classList.toggle('active',b===el));$('#room-form').elements.roomId.required=join;break;}"
assert old in s
s=s.replace(old,"case 'entry-mode':setEntryMode(document,el.dataset.mode);break;")
cases="""
 case 'scene-toggle':roomUi.sceneExpanded=!roomUi.sceneExpanded;updateClassroomSurfaces(currentState);break;
 case 'dismiss-first-turn':saveStore('firstTurnHelpDismissed',true);el.closest('.classroom-first-turn')?.remove();break;
 case 'action-sample':modal('先试着读懂一个行动',actionGuideMarkup(config?.actions||[],'acquire',{sample:true}));break;
 case 'action-guide':{if(!currentState)break;closeRoomSheets();modal('比较行动的作用与代价',(currentState.phase==='decision'?'<p class="classroom-timer-note">本轮计时继续；选择这里只会更新草稿。</p>':'')+actionGuideMarkup(config?.actions||[],el.dataset.group));break;}
 case 'choose-action':{const definition=config?.actions?.find(a=>a.id===el.dataset.id);if(!definition||currentState?.phase!=='decision')break;const old=currentDraft();$('#modal').close();roomUi.actionOpen=true;setRoomSheets();applyActionToInputs({id:definition.id,target:old?.target||0,scale:definition.scales?.includes(old?.scale)?old.scale:1});storeDraft();$('#action-id')?.focus({preventScroll:true});break;}
 case 'review-round':openRoundReview(Number(el.dataset.round));break;
 case 'select-review-round':roomUi.reviewRound=Number(el.dataset.round);updateClassroomSurfaces(currentState);$(`[data-action=select-review-round][data-round="${roomUi.reviewRound}"]`)?.focus({preventScroll:true});break;
 case 'round-note':{const data=roundNoteData(currentState,Number(el.dataset.round),config?.actions||[]);if(data){$('#modal').close();newNote(data);}break;}
 case 'concept':{if(!currentState)break;const round=Number(el.dataset.round)||currentState.round;closeRoomSheets();const card=conceptMarkup(el.dataset.concept,currentState,round,{chapters});modal(card.title,card.html);break;}
 case 'restore-note-draft':restoreNoteDraft(notes.find(n=>n.id===$('#note-form')?.dataset.id),true);break;
 case 'discard-note-draft':modal('丢弃未保存草稿？','<p>会恢复到上次正式保存的内容。当前未保存的修改将被丢弃。</p><button class="button solid" data-action="confirm-discard-note-draft">丢弃草稿</button>');break;
 case 'confirm-discard-note-draft':{const form=$('#note-form');noteDrafts().discard(form,{savedNote:notes.find(n=>n.id===form?.dataset.id)});$('#modal').close();$('#note-draft-choices')?.remove();setText($('#note-save-status'),'已丢弃未保存草稿，保留正式札记。');break;}
"""
s=s.replace(" case 'close-modal':",cases+" case 'close-modal':",1)
s=s.replace("case 'note-from-chapter':{const c=chapters.find(c=>c.id===el.dataset.id);newNote({title:","case 'note-from-chapter':{const c=chapters.find(c=>c.id===el.dataset.id);newNote({source:{kind:'chapter',chapterId:c.id},title:")
old_start=s.index(" case 'save-review':{");old_end=s.index("\n case 'download-replay'",old_start)
s=s[:old_start]+" case 'save-review':{const selected=roomUi.reviewRound||currentState.history?.at(-1)?.round;const data=roundNoteData(currentState,selected,config?.actions||[]);if(data){const p=currentState.players.find(p=>p.id===currentState.me.id);data.title=currentState.product.name+' · 六轮经营复盘';data.body='本局最终综合分：'+fmt(p.score)+'，第'+p.rank+'名\\n\\n'+data.body;newNote(data);}break;}"+s[old_end:]

s=s.replace("async function render(){stopRoomSync();","async function render(){captureNoteDraft();stopRoomSync();")
s=s.replace("window.addEventListener('pagehide',()=>{stopRoomSync();","window.addEventListener('pagehide',()=>{captureNoteDraft();stopRoomSync();")
s=s.replace("document.addEventListener('input',e=>{if(e.target.closest('.lab-page'))", "document.addEventListener('input',e=>{if(e.target.closest('#note-form'))captureNoteDraft();if(e.target.closest('.lab-page'))")
s=s.replace("const saved=saveStore('notes',notes);go('notes/'+n.id);", "const saved=saveStore('notes',notes);if(saved)noteDrafts().markSaved(form);go('notes/'+n.id);")
s=s.replace("updated:Number(n.updated)||Date.now()});", "updated:Number(n.updated)||Date.now(),...(n.source&&noteSourceMarkup(n.source)?{source:n.source}:{})});")
# Match closed sheets to their controls for keyboard continuity.
s=s.replace("case 'close-action-sheet':roomUi.actionOpen=false;setRoomSheets();break;", "case 'close-action-sheet':roomUi.actionOpen=false;setRoomSheets();$('[data-action=toggle-action-sheet]')?.focus({preventScroll:true});break;")

# Accessible focus containment for the existing mobile sheet behavior.
trap="""if(event.key==='Tab'&&matchMedia('(max-width:900px)').matches){const panel=roomUi.actionOpen?$('.action-editor'):roomUi.sheet==='info'?$('#insight-panel'):null;if(panel&&!$('#modal')?.open){const controls=[...panel.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary')].filter(el=>el.getClientRects().length);const first=controls[0],last=controls.at(-1);if(event.shiftKey&&(event.target===first||!panel.contains(event.target))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&(event.target===last||!panel.contains(event.target))){event.preventDefault();first?.focus();}}} """
s=s.replace("document.addEventListener('keydown',event=>{if(!currentState)return;", "document.addEventListener('keydown',event=>{if(!currentState)return;"+trap)

path.write_text(s,encoding='utf-8',newline='\n')
html=root/'public/index.html';h=html.read_text(encoding='utf-8')
h=h.replace('</head>','<link rel="stylesheet" href="/classroom.css?v=20261118-classroom">\n</head>')
h=h.replace('20261118-home-cta','20261118-classroom').replace('content="20261117v6-host"','content="20261118-classroom"')
html.write_text(h,encoding='utf-8',newline='\n')
print('Integrated classroom home, entry, mission, action guidance, real round review, note drafts and experiments.')
