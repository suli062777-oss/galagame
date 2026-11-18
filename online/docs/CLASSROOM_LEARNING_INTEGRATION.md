# 课堂入口、学习辅助与札记草稿的集成

2026-11-18。新增文件仅为 `public/classroom-learning.js`、`public/note-drafts.js` 和有必要的数据恢复检查；不改 app.js、CSS、index.html，交由总控集成。原生 ESM，无新增依赖。

## 首页与入口

```js
import {renderHome,renderEntry,setEntryMode,mountLabLearning} from './classroom-learning.js?v=20261118classroom';

function home(){
 const resume=chapters.find(c=>(progress[c.id]?.percent||0)>0&&(progress[c.id]?.percent||0)<100)||chapters[0];
 main.innerHTML=renderHome({bookMeta,readPercent:readPct(),resumeId:resume.id,sessions});
}
```

`renderHome` 可选 `heroSrc`（默认 `/assets/classroom/hero-folded-table.webp`）与 `previewSrc`。后者应由实际对局截图导出供首页使用；不传时不会渲染空预览区域。首页保留朱红酒馆主动作和次要阅读、出版信息与阅读恢复，建议路径顺序为经营→阅读→实验。没有捏造用户数量或学习效果。

`tavernLanding()` 保留原邀请身份恢复判断，再 `main.innerHTML=renderEntry({invited:invitationRoom(),sessions});void refreshHostDisclosure();`。模板已经给邀请 roomId 赋值，隐藏代码框、保留 required 输入且其值有效，只要求填写称呼；无需再调用旧 `prepareInvitationEntry()` 以免重复提示。

`entry-mode` action 替换为 `setEntryMode(document,el.dataset.mode);break;`。三种 `data-mode` 为 `join / practice / create`。该方法只切字段与文字，保留已经输入的称呼与代码。

- 默认 join：`entry=join`，代码必填，`mode=multiplayer` 隐藏字段留作兼容。
- practice：`entry=create`，`mode=practice`，代码 disabled，不进入 FormData。
- create：`entry=create`，`mode=multiplayer`，代码 disabled。
- 真实邀请：模式锁 join，保留默认 analytical / medium / assist 字段，不要求先配置 Agent。

沿用原 room-form 提交 API 与 error 节点，不改变权限、45秒或费用。可以在原错误处理中按 code 改写可操作的帮助，但不要把未知、满员、已开始等不同原因统一写成成功。最近房间来自现有本机 sessions，只显示称呼与房间ID，不展示 token，也不谎称席位已恢复成功。

## 札记草稿

```js
import {createNoteDrafts} from './note-drafts.js?v=20261118classroom';
let draftService;
function noteDrafts(){return draftService??=createNoteDrafts();}
```

默认 storage 的访问在模块内部有异常保护。工厂注入 storage/now 是为受控的恢复测试，不需要把 localStorage 读取挪到不受保护的顶层。

`notesPage(id)` 原 DOM 写入后：

```js
const form=$('#note-form'),note=notes.find(n=>n.id===form.dataset.id);
const state=noteDrafts().restore(form,{savedNote:note});
if(state.message)$('#note-save-status').textContent=state.message;
```

输入（title/body/tag）时，以及 `render()` 清空旧 DOM 之前、`pagehide` 时，对当前 `#note-form` 调用 `capture(form)`。恢复时服务会记录正式内容基线；没有改动不产生草稿。草稿独立保存于 `ga:note-drafts:v1:<noteId>`，未命名页为 `:new`，不占正式 `ga:notes` 或互相覆盖。

正式保存 `saveStore('notes',notes)` **成功后、go() 之前**调用 `markSaved(form)`。它既清理草稿，也把当前原始表单值标为干净，避免 render 之前的 capture 再把刚保存的草稿恢复回来。保存失败时保留草稿，并继续显示存储失败/复制/导出提示。删除已保存札记成功时可 `clear(id)` 清掉该条遗留草稿。

恢复结果：

- `restored:true`：已把草稿放回表单，`message` 如实说明本机持久化或仅本次会话。
- `conflict:true`：存在更新的正式记录，未用旧草稿覆盖。显示“恢复旧草稿”与“保留已保存版本”两个明确选择；前者 `restore(form,{savedNote:note,force:true})`，后者 `discard(form,{savedNote:note})`。未作选择前 capture 不覆盖冲突草稿。
- `reason:'unreadable'`：原草稿值格式不合法，模块不会覆盖该原始值；本次编辑只暂存内存。正式札记仍不受影响。
- `mode:'memory'`：localStorage不可用或写入失败，仅保留当前页面会话；不要显示“已保存到本机”。仍可复制或用原导出入口保存当前正文。

失败提示明确要求关闭前复制当前正文。原“导出备份”只导出正式 notes，未保存草稿若要进入原备份，应先点击正式保存（即使仅进入会话内存）再导出；不假称原导出已经包含编辑中的草稿。

`discard(form,{savedNote})` 是显式丢弃当前编辑并恢复正式内容；不要将普通导航或换页当丢弃。`clear(id)` 是底层清理，正式保存优先用 `markSaved(form)`。

## 实验预测与基线

原 `labPage()` 写入 DOM、`updateLabs()` 后调用 `mountLabLearning(document)`。它在三个原 `.lab-experiment .experiment-work` 前插入轻量预测与对照，不更换原滑块、原模型或说明。旧 DOM 销毁后绑定随元素释放；函数返回 cleanup，若保留旧 DOM 可主动调用。

三个固定基线：

1. 留存 70%、每轮新增100、初始100、六轮逐次取整 → 306人。
2. 访问1000、完成率20% → 200人。
3. 影响/信心/便利均5分 → 教学版平均5.0分。

预测先记住选择，不立即给答案；点“按题目条件试一次”会设置题目明确给定的滑块条件并触发原 input 流程，之后显示具体条件与结果，用户手动调到条件也会验证。之后自由探索时仍保留那次题目验证的具体数值，避免与当前滑块混淆。预测可跳过，不阻止下方操作。“记住这次对照”仅在本页内记住当时的结果，文案明确“本页暂存”；不新增假自动保存或将教学模型视为经营收益预测。当前比较实时读取原滑块，所以无需从图表文本反算。留存计算 helper `retentionSeries(rate,rounds=6)` 与现有模型逐轮取整一致。

## 自检与浏览器待验

`node --check` 两模块通过。`node --test tests/note-drafts.test.mjs` 覆盖重新创建服务/表单恢复、noteId隔离、正式保存后防复活、配额失败、损坏草稿不覆盖、较新正式记录冲突、显式丢弃。它们检查持久数据行为，不替代浏览器体验。

总控浏览器需验证：无邀请默认代码加入；三模式字段和真实API对应；邀请仅填称呼；360/390px主动作可达；正文输入→切阅读→回札记、刷新、保存后再进；实验预测选择/跳过、滑块变化、固定基线不漂移、记住对照。最终插画和CSS由视觉/总控接入后再品审。

## 本轮独立浏览器复验

已在总控启动的 `http://127.0.0.1:3020` 模板服务完成27项真实DOM/本地API检查，全部通过，Runtime异常0。报告为 `docs/evidence/classroom-20261118/learning/browser-verification.json`，另存手机入口、恢复草稿、冲突草稿和实验对照4张截图。浏览器使用全新隔离profile；没有访问公网或真实模型。临时浏览器已关闭，总控服务继续保留。

- join / practice / create 的实际字段与API均检查；practice实际创建3席脚本房，组长开桌、代码加入、邀请加入、已有邀请席位恢复均真实经过本地API。
- 390×844 视口主加入按钮初始可见；这仍是桌面浏览器窄视口，不代表实体手机软键盘验收。
- 札记跨路由、浏览器刷新、正式保存后无草稿复活、明确丢弃、较新保存版本冲突和主动恢复均通过。冲突是受控写入同一隔离profile的本地存储，不能称两个真人协作。
- 从真实章节按钮创建札记、正式保存、来源链接保留及实际点击回原章节通过；真实经营轮次来源由总控六轮验证另行覆盖。
- 三个预测先记录而不揭晓，按题目条件操作原滑块后才得到具体条件/数值反馈；固定基线、记住旧对照和跳过均通过。
