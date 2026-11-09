import {PRESETS,AVATAR_SIZE,MAX_AVATAR_BYTES,defaultAvatar,normalizeAvatar} from './avatar-contract.js';
import {drawAvatarCanvas,drawPresetAvatar,loadAvatarImage} from './avatar-art.js';
const CSS=`.avatar-editor{box-sizing:border-box;width:min(530px,calc(100% - 28px));max-height:92dvh;padding:0;border:1px solid #ffffff2c;border-radius:24px;background:#121113;color:#f4eee8;box-shadow:0 28px 100px #0009;font:15px/1.6 system-ui,-apple-system,BlinkMacSystemFont,sans-serif;overflow:auto}.avatar-editor::backdrop{background:#000b;backdrop-filter:blur(8px)}.avatar-editor *{box-sizing:border-box}.avatar-editor button,.avatar-editor input{font:inherit}.avatar-editor header{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:20px 24px;background:#121113f2;border-bottom:1px solid #ffffff12}.avatar-editor h2{font:650 21px/1.3 system-ui;margin:0;color:inherit}.avatar-editor .avatar-close{display:grid;place-items:center;width:36px;height:36px;border:1px solid #ffffff28;border-radius:50%;background:transparent;color:inherit;font-size:22px;cursor:pointer}.avatar-editor .avatar-body{padding:20px 24px 24px}.avatar-editor .avatar-preview{width:144px;height:144px;display:block;margin:0 auto 14px;border:3px solid #eb583e;border-radius:50%;box-shadow:0 8px 35px #0005;background:#222}.avatar-editor .avatar-privacy{font-size:14px;line-height:1.7;color:#b4aaa3;text-align:center;margin:0 0 20px}.avatar-editor .avatar-presets{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-bottom:18px}.avatar-editor .avatar-preset{display:grid;justify-items:center;gap:5px;padding:7px 3px;border:1px solid transparent;background:transparent;color:#bdb2aa;border-radius:14px;cursor:pointer;font-size:13px;min-width:0}.avatar-editor .avatar-preset[aria-pressed=true]{border-color:#eb583e;background:#eb583e13;color:#fff}.avatar-editor .avatar-preset canvas{display:block;width:48px;height:48px;max-width:100%;border-radius:50%}.avatar-editor .avatar-upload{display:flex;gap:12px;align-items:center;justify-content:center;border:1px solid #ffffff2b;border-radius:999px;padding:10px 17px;cursor:pointer;min-height:44px;font-weight:500}.avatar-editor .avatar-file{position:absolute;width:1px!important;height:1px!important;min-height:0!important;padding:0!important;opacity:0;overflow:hidden;clip-path:inset(50%)}.avatar-editor .avatar-hint{font-size:13px;text-align:center;color:#9e938a;margin:8px 0 16px}.avatar-editor .avatar-adjust{display:grid;gap:10px;margin:18px 0}.avatar-editor .avatar-adjust[hidden]{display:none}.avatar-editor .avatar-adjust label{display:grid;grid-template-columns:52px 1fr;align-items:center;gap:12px;font-size:14px;color:#bfb3ab}.avatar-editor .avatar-adjust input{width:100%;min-height:32px;padding:0;border:0;background:transparent;accent-color:#eb583e}.avatar-editor .avatar-error{min-height:1.6em;margin:12px 0;color:#ff9c88;font-size:14px}.avatar-editor .avatar-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.avatar-editor .avatar-apply,.avatar-editor .avatar-reset{border-radius:999px;min-height:44px;padding:10px 18px;cursor:pointer;font-weight:550}.avatar-editor .avatar-apply{flex:1;border:1px solid #eb583e;background:#eb583e;color:white}.avatar-editor .avatar-reset{border:1px solid #ffffff28;background:transparent;color:#c7bbb2}.avatar-editor button:focus-visible,.avatar-editor .avatar-upload:focus-within{outline:2px solid #ff967c;outline-offset:3px}.avatar-editor button:disabled{opacity:.5;cursor:wait}@media(max-width:420px){.avatar-editor header{padding:17px 18px}.avatar-editor .avatar-body{padding:18px}.avatar-editor .avatar-presets{grid-template-columns:repeat(3,1fr);gap:4px}.avatar-editor .avatar-preset{grid-template-columns:40px 1fr;gap:6px;padding:6px;text-align:left;align-items:center;font-size:13px}.avatar-editor .avatar-preset canvas{width:40px;height:40px}.avatar-editor .avatar-actions{gap:8px}.avatar-editor .avatar-reset{padding:10px 13px;font-size:14px}}`;
export function openAvatarEditor({current,seatIndex=0,onSave,onClose}={}){
  if(typeof onSave!=='function')throw Error('缺少头像保存回调');
  document.querySelector('.avatar-editor')?.close();
  if(!document.querySelector('#avatar-editor-style')){const style=document.createElement('style');style.id='avatar-editor-style';style.textContent=CSS;document.head.append(style);}
  const dialog=document.createElement('dialog');dialog.className='avatar-editor';dialog.setAttribute('aria-labelledby','avatar-editor-title');
  dialog.innerHTML=`<header><h2 id="avatar-editor-title">你的圆桌形象</h2><button type="button" class="avatar-close" aria-label="关闭头像编辑">×</button></header><div class="avatar-body"><canvas class="avatar-preview" width="192" height="192" aria-label="头像裁切预览" role="img"></canvas><p class="avatar-privacy">头像会贴在你的人物头部，并显示给同桌玩家。<br>照片仅用于本机酒馆，不会发送给主持模型。</p><div class="avatar-presets" aria-label="预设头像"></div><label class="avatar-upload"><span>选择一张照片</span><input class="avatar-file" type="file" accept="image/png,image/jpeg,image/webp" aria-label="选择头像照片"></label><p class="avatar-hint">支持 PNG、JPG、WebP，最大 5 MB</p><div class="avatar-adjust" hidden><label>缩放<input aria-label="头像缩放" name="zoom" type="range" min="1" max="3" step="0.01" value="1"></label><label>左右<input aria-label="头像左右位置" name="offsetX" type="range" min="-100" max="100" value="0"></label><label>上下<input aria-label="头像上下位置" name="offsetY" type="range" min="-100" max="100" value="0"></label></div><p class="avatar-error" role="alert"></p><div class="avatar-actions"><button type="button" class="avatar-reset">恢复默认</button><button type="button" class="avatar-apply">应用头像</button></div></div>`;
  const preview=dialog.querySelector('.avatar-preview'),ctx=preview.getContext('2d'),error=dialog.querySelector('.avatar-error'),adjust=dialog.querySelector('.avatar-adjust'),apply=dialog.querySelector('.avatar-apply');
  let closed=false,busy=false,photo=null,selected,drawVersion=0,loadVersion=0,objectUrl=null;
  try{selected=normalizeAvatar(current,{seat:seatIndex});}catch{selected=defaultAvatar(seatIndex);}
  const controls=Object.fromEntries([...adjust.querySelectorAll('input')].map(el=>[el.name,el]));
  const showError=message=>{error.textContent=message||'';};
  function updateSelection(){for(const button of dialog.querySelectorAll('.avatar-preset'))button.setAttribute('aria-pressed',String(selected?.kind==='preset'&&selected.id===button.dataset.preset));}
  async function redraw(){
    const version=++drawVersion;
    if(photo){
      const base=Math.max(AVATAR_SIZE/photo.naturalWidth,AVATAR_SIZE/photo.naturalHeight),scale=base*Number(controls.zoom.value),w=photo.naturalWidth*scale,h=photo.naturalHeight*scale;
      const x=(AVATAR_SIZE-w)/2+Number(controls.offsetX.value)/100*(w-AVATAR_SIZE)/2,y=(AVATAR_SIZE-h)/2+Number(controls.offsetY.value)/100*(h-AVATAR_SIZE)/2;
      ctx.clearRect(0,0,AVATAR_SIZE,AVATAR_SIZE);ctx.fillStyle='#171719';ctx.fillRect(0,0,AVATAR_SIZE,AVATAR_SIZE);ctx.drawImage(photo,x,y,w,h);return;
    }
    const canvas=await drawAvatarCanvas(selected,seatIndex);if(closed||version!==drawVersion)return;ctx.clearRect(0,0,AVATAR_SIZE,AVATAR_SIZE);ctx.drawImage(canvas,0,0);
  }
  for(const preset of PRESETS){const button=document.createElement('button');button.type='button';button.className='avatar-preset';button.dataset.preset=preset.id;button.setAttribute('aria-label','使用'+preset.label+'头像');button.append(drawPresetAvatar(preset.id),document.createTextNode(preset.label));dialog.querySelector('.avatar-presets').append(button);}
  async function save(value){
    if(busy)return;busy=true;apply.disabled=true;for(const button of dialog.querySelectorAll('button'))button.disabled=true;showError('');
    try{await onSave(value);close();}catch(e){showError(e?.message||'保存失败，请重试。');busy=false;for(const button of dialog.querySelectorAll('button'))button.disabled=false;}
  }
  const onClick=async event=>{
    const button=event.target.closest('button');if(!button||busy)return;
    if(button.classList.contains('avatar-close'))close();
    if(button.dataset.preset){loadVersion++;apply.disabled=false;dialog.querySelector('.avatar-file').value='';photo=null;selected={kind:'preset',id:button.dataset.preset};adjust.hidden=true;showError('');updateSelection();await redraw();}
    if(button.classList.contains('avatar-reset'))await save(null);
    if(button.classList.contains('avatar-apply')){
      if(photo){
        let dataUrl;
        for(const size of [192,160,128,96,64]){const canvas=document.createElement('canvas');canvas.width=canvas.height=size;canvas.getContext('2d').drawImage(preview,0,0,size,size);dataUrl=canvas.toDataURL('image/png');if((dataUrl.length-22)*3/4<=MAX_AVATAR_BYTES)break;}
        try{selected=normalizeAvatar({kind:'image',dataUrl});}catch(e){showError(e.message);return;}
      }
      await save(selected);
    }
  };
  const onInput=()=>{showError('');void redraw();};
  const onFile=async event=>{
    const file=event.target.files?.[0];if(!file||busy)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){showError('请选择不超过5 MB的PNG、JPG或WebP照片。');event.target.value='';return;}
    const version=++loadVersion;if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(file);apply.disabled=true;showError('正在读取照片……');
    try{const image=await loadAvatarImage(objectUrl);if(closed||version!==loadVersion)return;if(image.naturalWidth<32||image.naturalHeight<32||image.naturalWidth*image.naturalHeight>40000000)throw Error('照片尺寸不适合，请选择清晰且不超过4000万像素的照片。');photo=image;selected={kind:'image'};controls.zoom.value='1';controls.offsetX.value=controls.offsetY.value='0';adjust.hidden=false;showError('');updateSelection();await redraw();}catch(e){if(!closed&&version===loadVersion)showError(e.message||'照片读取失败，请换一张。');}finally{if(!closed&&version===loadVersion)apply.disabled=false;}
  };
  const onCancel=event=>{event.preventDefault();if(!busy)close();};
  function close(){if(closed)return;closed=true;drawVersion++;dialog.removeEventListener('click',onClick);adjust.removeEventListener('input',onInput);dialog.querySelector('.avatar-file').removeEventListener('change',onFile);dialog.removeEventListener('cancel',onCancel);dialog.removeEventListener('close',close);if(objectUrl)URL.revokeObjectURL(objectUrl);if(dialog.open)dialog.close();dialog.remove();onClose?.();}
  dialog.addEventListener('click',onClick);adjust.addEventListener('input',onInput);dialog.querySelector('.avatar-file').addEventListener('change',onFile);dialog.addEventListener('cancel',onCancel);dialog.addEventListener('close',close);
  document.body.append(dialog);updateSelection();void redraw();dialog.showModal();dialog.querySelector('.avatar-close').focus();
  return {close};
}
