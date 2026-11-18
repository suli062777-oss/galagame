const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roomEntries=sessions=>Object.entries(sessions||{}).filter(([id,value])=>/^[A-Za-z0-9_-]{4,100}$/.test(id)&&value&&typeof value.name==='string').slice(-4).reverse();

export function renderHome({bookMeta={},readPercent=0,resumeId='',sessions={},heroSrc='/assets/classroom/hero-folded-table.webp',previewSrc=''}={}){
 const pct=Math.min(100,Math.max(0,Math.round(Number(readPercent)||0))),recent=roomEntries(sessions)[0];
 return `<div class="page home-page classroom-home">
  <section class="home-hero classroom-hero"><div class="hero-copy">
   <h1>增长黑客</h1><p class="hero-description">把增长判断，放进六轮经营。<br>和同学各自经营一家公司，在同一个市场里，看见选择带来的变化。</p>
   <div class="hero-context"><span>课堂可直接加入</span><span>4 席 · 6 轮 · 每轮 45 秒</span></div>
   <div class="hero-actions"><a class="button solid hero-primary" href="#/tavern">进入增长酒馆 <span aria-hidden="true">→</span></a><a class="button outline" href="#/map">开始阅读</a></div>
   <p class="hero-entry-note">可以全程手动，Agent 是可选搭档。</p>
   ${recent?`<a class="classroom-resume-room text-link" href="#/tavern/${escapeHTML(recent[0])}">继续 ${escapeHTML(recent[1].name)} 上次的房间 <span aria-hidden="true">→</span></a>`:''}
  </div><figure class="hero-art"><img src="${escapeHTML(heroSrc)}" alt="朱红折纸路径与四枚圆桌棋子，表现阅读和经营相连的过程" width="1440" height="960" fetchpriority="high"></figure></section>
  ${previewSrc?`<section class="classroom-product-preview"><img src="${escapeHTML(previewSrc)}" alt="增长酒馆真实对局：四席圆桌、经营信息与行动区" width="1280" height="720" loading="lazy"><div><h2>同一张桌，各自作判断。</h2><p>看看本轮发生了什么，再决定把预算放在哪里。结果保留在账本里，方便回头核对。</p><a class="text-link" href="#/tavern">加入一桌 <span aria-hidden="true">→</span></a></div></section>`:''}
  <section class="home-path"><div><h2>从一轮决定开始</h2><p class="muted">先经营，也可以带着问题读。</p></div><div class="path-list">
   <a href="#/tavern"><div><h3>经营一局</h3><p>加入同学的桌，或者和三席脚本先练习。</p></div><b aria-hidden="true">↗</b></a>
   <a href="#/map"><div><h3>回看为什么</h3><p>理解用户、激活、留存与增长实验。</p></div><b aria-hidden="true">↗</b></a>
   <a href="#/lab"><div><h3>换一个变量试试</h3><p>先作预测，再观察教学模型怎样变化。</p></div><b aria-hidden="true">↗</b></a>
  </div></section>
  <section class="reading-resume"><h3>${pct?'继续上次的阅读':'翻开第一篇'}</h3><div class="resume-track"><i style="width:${pct}%"></i></div><span>${pct}% 已读</span><a class="text-link" href="#/${resumeId?'read/'+escapeHTML(resumeId):'map'}">${pct?'继续阅读':'从第一篇读起'} <span aria-hidden="true">→</span></a></section>
  <p class="home-book-source">基于《增长黑客》的交互阅读与教学经营。<br>${escapeHTML(bookMeta.authors)} · ${escapeHTML(bookMeta.edition)}</p>
 </div>`;
}

const entryCopy={
 join:{title:'加入同学的增长桌',description:'有房间代码，就从这里入席。',submit:'加入这桌 →',help:'填写组长分享的房间代码。每人使用自己的称呼与席位。'},
 practice:{title:'自己先练习一局',description:'只有你与三席脚本，无需等待同学。',submit:'进入练习 →',help:'单人练习不需要房间代码。你可以手动完成六轮，也可以选择连接自己的 Agent。'},
 create:{title:'开一桌，邀请同学',description:'你将成为房主，入席后分享邀请链接。',submit:'新开一桌 →',help:'另外三位同学到齐后，由你统一开始。四席各自经营，共享同一个市场。'}
};

export function renderEntry({invited='',sessions={}}={}){
 const invitation=/^[A-Za-z0-9_-]{4,40}$/.test(invited)?invited.toUpperCase():'',copy=entryCopy.join,rooms=roomEntries(sessions);
 return `<div class="tavern-landing classroom-landing"><div class="page">
  ${rooms.length?`<section class="saved-sessions classroom-saved-sessions" aria-label="最近的房间"><div><h2>继续上次的房间</h2><p>使用这台设备保存的席位。</p></div>${rooms.map(([id,session])=>`<a href="#/tavern/${escapeHTML(id)}"><span>${escapeHTML(session.name)}</span><b>${escapeHTML(id)} <span aria-hidden="true">→</span></b></a>`).join('')}</section>`:''}
  <section class="tavern-intro classroom-intro">
   <div class="tavern-entry classroom-entry" data-entry-mode="join">
    <div class="classroom-entry-heading"><h1 id="entry-title">${invitation?'朋友为你留了一席':copy.title}</h1><p id="entry-description">${invitation?'房间 '+escapeHTML(invitation)+' · 填写称呼后加入。':copy.description}</p></div>
    ${invitation?'':`<div class="entry-tabs classroom-entry-nav" role="group" aria-label="选择入席方式"><button type="button" class="active" data-action="entry-mode" data-mode="join" aria-pressed="true">加入房间</button><button type="button" data-action="entry-mode" data-mode="practice" aria-pressed="false">自己先练习</button><button type="button" data-action="entry-mode" data-mode="create" aria-pressed="false">我是组长</button></div>`}
    <form id="room-form" data-invited="${invitation?'true':'false'}">
     <input type="hidden" name="entry" value="join"><div id="create-fields" hidden><input type="hidden" name="mode" value="multiplayer"></div>
     <div id="join-field" ${invitation?'hidden':''}><label>房间代码<input name="roomId" value="${escapeHTML(invitation)}" placeholder="输入组长分享的代码" maxlength="40" required autocomplete="off" autocapitalize="characters" spellcheck="false" aria-describedby="entry-help"></label></div>
     <label>你的称呼<input name="name" placeholder="怎么称呼你？" maxlength="24" required autocomplete="nickname"></label>
     <p class="classroom-manual-note">可以全程手动，Agent 可选。</p>
     <button type="submit" class="button solid full" id="entry-submit">加入这桌 →</button>
     <p class="form-error" id="room-error" role="alert"></p><p class="classroom-entry-help" id="entry-help">${invitation?'你会加入这张桌，由房主统一开始。':copy.help}</p>
     ${invitation?'<input type="hidden" name="persona" value="analytical"><input type="hidden" name="risk" value="medium"><input type="hidden" name="authorization" value="assist">':`<details class="entry-preferences"><summary>可选：Agent 偏好与授权</summary><p>手动玩家可以保留默认设置。入席后也能连接自己的 Agent。</p><div class="form-two"><label>性格<select name="persona"><option value="analytical">理性分析</option><option value="creative">探索创新</option><option value="pragmatic">务实经营</option></select></label><label>风险偏好<select name="risk"><option value="medium">平衡</option><option value="low">稳健</option><option value="high">进取</option></select></label></div><label>授权<select name="authorization"><option value="assist">建议模式 · 我来确认</option><option value="autopilot">自主模式 · Agent 可提交</option></select></label></details>`}
     <p class="entry-privacy">网页不收集玩家模型密钥。选择接入个人 Agent 时，模型消耗由自己的账号承担。</p>
    </form>
   </div>
   <div class="tavern-lobby-copy classroom-entry-copy"><span class="tavern-label">增长酒馆</span><h2>课堂经营练习</h2><p>四位经营者，各自经营一家公司。每轮选择行动、核对情报，六轮结束回看账本。</p><div class="tavern-principles"><span>4 个席位</span><span>6 个回合</span><span>每轮 45 秒</span></div><details class="classroom-about"><summary>第一次来，怎么玩？</summary><ol><li>加入一桌，或与三席脚本单人练习。</li><li>先看本局产品，再选择行动、人群和投入。</li><li>确认后看服务端回执；六轮结束回看账本。</li></ol><p>规则是教学改编，不是实际经营预测。</p></details><p class="tavern-disclosure" id="host-disclosure">正在检查主持状态。你可以先手动入席。</p><a class="text-link" href="#/read/experiments">先读实验与复盘 <span aria-hidden="true">→</span></a></div>
  </section>
 </div></div>`;
}

export function setEntryMode(root=globalThis.document,mode='join'){
 const form=root?.querySelector?.('#room-form');if(!form)return false;
 if(form.dataset.invited==='true')mode='join';
 if(!Object.hasOwn(entryCopy,mode))mode='join';
 const copy=entryCopy[mode],joining=mode==='join';
 form.elements.namedItem('entry').value=joining?'join':'create';
 form.elements.namedItem('mode').value=mode==='practice'?'practice':'multiplayer';
 const roomInput=form.elements.namedItem('roomId');roomInput.required=joining;roomInput.disabled=!joining;
 root.querySelector('#join-field').hidden=!joining||form.dataset.invited==='true';
 root.querySelector('#create-fields').hidden=true;
 root.querySelector('.classroom-entry')?.setAttribute('data-entry-mode',mode);
 root.querySelectorAll('.classroom-entry-nav button').forEach(button=>{const active=button.dataset.mode===mode;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
 if(form.dataset.invited!=='true'){
  root.querySelector('#entry-title').textContent=copy.title;root.querySelector('#entry-description').textContent=copy.description;root.querySelector('#entry-help').textContent=copy.help;
 }
 root.querySelector('#entry-submit').textContent=copy.submit;
 const error=root.querySelector('#room-error');if(error)error.textContent='';
 return mode;
}

export function retentionSeries(rate,rounds=6){let users=100;return Array.from({length:rounds},()=>users=Math.round(users*rate+100));}

const labPlans=[
 {id:'retention',question:'新增保持不变，留存从 70% 降到 50%，第六轮人数会怎样？',options:[['lower','更少'],['same','不变'],['higher','更多']],expected:'lower',scenario:{'retention-input':50},baseline:'70% 留存 · 第六轮 306 人',read:root=>{const rate=Number(root.querySelector('#retention-input').value)/100;return {current:`${Math.round(rate*100)}% 留存 · 第六轮 ${retentionSeries(rate)[5]} 人`,delta:retentionSeries(rate)[5]-306,explanation:'每轮新增固定为 100 人。留存改变，会逐轮影响能沉淀下来的用户；模型没有渠道和人群差异。'};}},
 {id:'activation',question:'访问量保持 1,000 人，完成率从 20% 提到 25%，首次获得价值的人会怎样？',options:[['higher','更多'],['same','不变'],['lower','更少']],expected:'higher',scenario:{'visitors-input':1000,'activation-input':25},baseline:'1,000 人访问 × 20% 完成率 = 200 人',read:root=>{const visits=Number(root.querySelector('#visitors-input').value),rate=Number(root.querySelector('#activation-input').value),value=Math.round(visits*rate/100);return {current:`${visits.toLocaleString('zh-CN')} 人访问 × ${rate}% 完成率 = ${value.toLocaleString('zh-CN')} 人`,delta:value-200,explanation:'激活人数等于访问量乘完成率。先固定访问量，只动完成率，再比较结果；这里不推断成本和收益。'};}},
 {id:'ice',question:'影响与便利都保持 5 分，信心从 5 分降到 3 分，教学版 ICE 平均分会怎样？',options:[['lower','降低'],['same','不变'],['higher','提高']],expected:'lower',scenario:{'ice-impact':5,'ice-confidence':3,'ice-ease':5},baseline:'影响 5 / 信心 5 / 便利 5 · 平均分 5.0',read:root=>{const values=['impact','confidence','ease'].map(id=>Number(root.querySelector('#ice-'+id).value)),score=values.reduce((sum,value)=>sum+value,0)/3;return {current:`影响 ${values[0]} / 信心 ${values[1]} / 便利 ${values[2]} · 平均分 ${score.toFixed(1)}`,delta:score-5,explanation:'本项目用三项平均值帮助排序。分数表达判断，不是成功概率；证据变少时，信心也应重新评估。'};}}
];

export function mountLabLearning(root=globalThis.document){
 const page=root?.querySelector?.('.lab-page');if(!page)return ()=>{};
 const experiments=[...page.querySelectorAll('.lab-experiment')],cleanups=[];
 experiments.forEach((experiment,index)=>{
  const plan=labPlans[index],work=experiment.querySelector('.experiment-work');if(!plan||!work||work.querySelector('.lab-learning'))return;
  const holder=experiment.ownerDocument.createElement('div');holder.className='lab-learning';holder.dataset.lab=plan.id;
  holder.innerHTML=`<section class="lab-prediction" aria-labelledby="prediction-${plan.id}"><p class="lab-prediction-label">先作一个预测</p><h4 id="prediction-${plan.id}">${plan.question}</h4><div class="lab-prediction-options" role="group" aria-label="${plan.question}">${plan.options.map(([value,label])=>`<button type="button" class="lab-prediction-option" data-prediction="${value}" aria-pressed="false">${label}</button>`).join('')}<button type="button" class="quiet-button lab-skip">直接操作</button></div><p class="lab-prediction-feedback" aria-live="polite"></p><button type="button" class="text-link lab-run-prediction" hidden>按题目条件试一次 <span aria-hidden="true">→</span></button></section><section class="lab-comparison" aria-label="基线与当前结果对照"><div class="lab-comparison-row"><span>固定基线</span><b>${plan.baseline}</b></div><div class="lab-comparison-row"><span>当前结果</span><b class="lab-current-result"></b></div><p class="lab-comparison-note"></p><p class="lab-comparison-status" aria-live="polite"></p><button type="button" class="text-link lab-save-comparison">记住这次对照</button></section>`;
  work.prepend(holder);let saved=null,prediction=null,predictionLabel='',revealed=false;
  const update=(fromInput=false)=>{const value=plan.read(root),delta=Math.abs(value.delta)<.00001?0:value.delta,difference=plan.id==='ice'?Math.abs(delta).toFixed(1):Math.abs(delta).toLocaleString('zh-CN');holder.querySelector('.lab-current-result').textContent=value.current;holder.querySelector('.lab-comparison-note').textContent=(delta===0?'当前与固定基线相同。':`相对基线${delta>0?'增加':'减少'} ${difference}${plan.id==='ice'?' 分':' 人'}。`)+value.explanation;if(saved)holder.querySelector('.lab-comparison-status').textContent='这次对照已记住：'+saved+'（本页暂存）';if(fromInput&&prediction&&!revealed&&Object.entries(plan.scenario).every(([id,target])=>Number(root.querySelector('#'+id).value)===target)){revealed=true;holder.querySelector('.lab-prediction-feedback').textContent=`题目验证：${value.current}。你的预测是「${predictionLabel}」，${prediction===plan.expected?'与该条件下的模型方向一致。':'与该条件下的模型方向不同。'}可继续调整变量，比较其他结果。`;holder.querySelector('.lab-run-prediction').hidden=true;}};
  const choose=event=>{const button=event.target.closest('button');if(!button||!holder.contains(button))return;
   if(button.dataset.prediction){prediction=button.dataset.prediction;predictionLabel=button.textContent.trim();revealed=false;holder.querySelectorAll('[data-prediction]').forEach(option=>option.setAttribute('aria-pressed',String(option===button)));holder.querySelector('.lab-prediction-feedback').textContent=`你的预测：${predictionLabel}。接下来按题目条件，操作一次模型。`;holder.querySelector('.lab-run-prediction').hidden=false;}
   if(button.classList.contains('lab-run-prediction')){let last;for(const [id,value] of Object.entries(plan.scenario)){last=root.querySelector('#'+id);last.value=String(value);}if(last){const EventClass=last.ownerDocument.defaultView.Event;last.dispatchEvent(new EventClass('input',{bubbles:true}));}}
   if(button.classList.contains('lab-skip')){prediction=null;revealed=false;holder.querySelectorAll('[data-prediction]').forEach(option=>option.setAttribute('aria-pressed','false'));holder.querySelector('.lab-run-prediction').hidden=true;holder.querySelector('.lab-prediction-feedback').textContent='已跳过预测，直接操作下方变量即可。';const range=work.querySelector('input[type="range"]');range?.focus({preventScroll:true});}
   if(button.classList.contains('lab-save-comparison')){saved=plan.read(root).current;update();}
  };
  const changed=()=>update(true);holder.addEventListener('click',choose);experiment.addEventListener('input',changed);cleanups.push(()=>{holder.removeEventListener('click',choose);experiment.removeEventListener('input',changed);});update();
 });
 return ()=>cleanups.forEach(clean=>clean());
}
