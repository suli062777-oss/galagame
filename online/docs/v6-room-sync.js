// Source fragments for the V6 room synchronization changes. Runtime source is public/app.js.
async function api(path,options={}){
 const {token,body,method='GET'}=options,roomRequest=path.startsWith('/api/rooms/'),controller=roomRequest?new AbortController():null,signal=controller?.signal||options.signal;
 let timer;const forwardAbort=()=>controller?.abort(options.signal?.reason);
 if(controller){roomRequests.add(controller);if(options.signal?.aborted)forwardAbort();else options.signal?.addEventListener('abort',forwardAbort,{once:true});timer=setTimeout(()=>controller.abort(new DOMException('服务器响应超时，请稍后重试。','TimeoutError')),method==='GET'?12000:20000);}
 try{let res;try{res=await fetch(path,{method,signal,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});}catch(error){if(signal?.aborted)throw signal.reason||error;throw new Error('暂时无法连接游戏服务器，请稍后重试。');}
  let data;try{data=await res.json();}catch(error){if(signal?.aborted)throw signal.reason||error;throw new Error('服务器返回了无法读取的响应。');}
  if(!res.ok||data.ok===false){const error=new Error(data.error||'请求失败，请稍后重试。');error.status=res.status;error.code=data.code;error.confirmedRejected=true;throw error;}return data;
 }finally{clearTimeout(timer);if(controller){roomRequests.delete(controller);options.signal?.removeEventListener('abort',forwardAbort);}}
}
function roomAbort(){return new DOMException('已离开此房间。','AbortError');}
function roomIsActive(id,epoch=roomEpoch){return epoch===roomEpoch&&location.hash==='#/tavern/'+id;}
function stopRoomSync(){roomEpoch++;clearTimeout(pollId);clearInterval(clockId);pollId=null;clockId=null;pollController?.abort();pollController=null;for(const controller of roomRequests)controller.abort();roomRequests.clear();pollFailures=0;scenePlayersKey='';lastClockKey='';}
function scheduleRoomPoll(id,epoch,delay=1000){clearTimeout(pollId);if(roomIsActive(id,epoch)&&!document.hidden)pollId=setTimeout(()=>pollRoom(id,epoch),delay);}
function acceptRoomState(next,epoch=roomEpoch,started=Date.now()){
 if(!next||!roomIsActive(next.id,epoch))return false;
 if(currentState?.id===next.id){const oldVersion=Number(currentState.version||0),version=Number(next.version||0);if(version<oldVersion||(version===oldVersion&&Number(next.serverTime||0)<Number(currentState.serverTime||0)))return false;}
 currentState=next;if(Number.isFinite(next.serverTime))serverOffset=(started+Date.now())/2-next.serverTime;
 if(viewKey!==`${next.id}-${next.phase}-${next.round}`)renderGame();else updateGame();return true;
}
function updateRoomClock(){if(!currentState||document.hidden)return;const s=currentState,remaining=s.deadline==null?0:Math.max(0,Math.ceil((s.deadline-(Date.now()-serverOffset))/1000)),key=`${s.id}:${s.round}:${s.phase}:${remaining}`;if(lastClockKey===key)return;lastClockKey=key;const el=$('#countdown');if(el){setMarkup(el,`${remaining}<span>秒</span>`);el.classList.toggle('urgent',remaining<=10);}updateReceipt();}
async function openRoom(id){const credential=credentials(id),epoch=roomEpoch;if(!credential){main.innerHTML=`<div class="page room-missing"><h1>这张桌，<br>还没有你的席位。</h1><p>首次加入请在入口输入代码；已有凭据可在原浏览器恢复。</p>${link('前往入席 →','tavern','button solid')}</div>`;return;}
 try{await loadConfig();if(!roomIsActive(id,epoch))return;const started=Date.now(),data=await api('/api/rooms/'+id,{token:credential.token});if(!roomIsActive(id,epoch))return;acceptRoomState(data.state,epoch,started);clockId=setInterval(updateRoomClock,250);scheduleRoomPoll(id,epoch);}
 catch(error){if(!roomIsActive(id,epoch)||error.name==='AbortError')return;main.innerHTML=`<div class="page room-missing"><h1>暂时没能<br>回到这张桌。</h1><p>${esc(error.message)}</p><button class="button solid" data-action="retry-room" data-id="${esc(id)}">重试连接 →</button>${link('返回酒馆入口','tavern')}</div>`;}
}
async function pollRoom(id,epoch=roomEpoch){if(!roomIsActive(id,epoch)||document.hidden||pollController)return;const controller=new AbortController(),started=Date.now();pollController=controller;
 try{const data=await api('/api/rooms/'+id,{token:credentials(id)?.token,signal:controller.signal});if(!roomIsActive(id,epoch))return;pollFailures=0;acceptRoomState(data.state,epoch,started);const el=$('#connection-status');if(el){el.classList.remove('offline');setText(el,'');}}
 catch(error){if(!roomIsActive(id,epoch)||error.name==='AbortError')return;pollFailures++;const el=$('#connection-status');if(el){el.classList.add('offline');setText(el,'连接中断 · 正在重试');}}
 finally{if(pollController===controller)pollController=null;if(roomIsActive(id,epoch))scheduleRoomPoll(id,epoch,pollFailures?Math.min(8000,1000*2**pollFailures):currentState?.phase==='finished'?3000:1000);}
}
async function act(action,body={}){if(!currentState)throw roomAbort();const id=currentState.id,epoch=roomEpoch,started=Date.now(),data=await api('/api/rooms/'+id+'/'+action,{method:'POST',token:credentials(id).token,body});if(!roomIsActive(id,epoch))throw roomAbort();if(data.state)acceptRoomState(data.state,epoch,started);return data;}
