# V6 主持区与同步性能

本次只修改 `public/app.js`、`public/tavern-v3.css` 与 `public/index.html`。保留原生ESM、阅读/札记、原规则、密钥隔离、提交回执及人物API。未调用模型。

## 常显主持区

`#host-broadcast` 位于场景和行动之间，桌面与手机使用同一份DOM。默认显示最近播报的两行正文、真实来源以及“展开”“往期”两个普通文字按钮，不覆盖人物，也不新增主要行动按钮。情报页签中的旧主持折叠卡已移除。

桌面为78px固定播报行让位，舞台仍只由视口尺寸确定：`clamp(320px, calc(100dvh - 482px), 460px)`，不会随阶段面板长短改变。手机370–410px舞台规则保留，播报位于其下；操作入口继续固定在底部。

来源依据服务端 `god.provider`、`god.status` 和 `god.reason` 显示：DeepSeek、模板、实际生成中、模板接替或错误。没有按准备阶段推断模型正在生成。常显区不显示内部原因码；高级播报详情可查看真实reason和时间。

完整播报使用原生dialog。最新/往期可切换；知识引用按服务端 `knowledgeRefs` 逐条展开，显示title、chapter/section、summary或text，以及提供的source/sourceType/version。缺少引用时明确显示未附引用。没有生成前端伪引用。历史读取服务端 `godHistory`，不自行拼凑已完成记录。

历史展开状态以稳定的message ID＋knowledge ID记录；多条播报引用同一知识时，后续状态刷新只恢复用户展开的那一条，不连带展开其他消息。

可访问选择器：

- `[data-action=host-latest]`、`[data-action=host-history]`：打开完整播报。
- `#host-dialog-content`：当前内容。
- `[data-action=host-view][data-view=latest|history]`：切换列表。
- `.host-knowledge[data-knowledge]`：引用知识的原生details。

## 同步与渲染

- 轮询由在途请求结束后递归setTimeout安排，同一房间只有一个轮询GET在途。慢网络不会排队叠加轮询；错误采用最多8秒的退避。
- 所有房间API请求使用AbortController，读取12秒、变更20秒超时。离开路由、pagehide会取消房间请求；隐藏页面停止轮询和无效时钟更新，重新可见后立即同步。
- `acceptRoomState()` 统一处理开房读取、轮询、操作与头像回包。房间ID、路由epoch、version与同version的serverTime共同拒绝旧响应；即使底层fetch忽略abort，旧epoch也不能进入新页面。
- 时钟每250ms检查，但只在实际秒数变化时更新；网络响应慢也不会冻住倒计时或截止锁定。
- scene仅在players数据改变时update；同值HTML、文字与热点属性不重写。经营数据、主持区、信息页、预算与回执使用稳定局部节点，保持草稿、展开状态及滚动位置。
- GET轮询使用服务端私有ETag。304不解析JSON、不渲染，只按`X-Server-Time`校时并恢复连接状态。tag在状态真正被接受后才更新，并按roomEpoch、房间与当前人类token隔离；离页清除。迟到的旧tag 304不能覆盖新操作回包的tag或时钟。
- 请求超时或丢失响应仍保留“不确定”语义，轮询从服务器动作确认；已有6项回执回归保持通过。

`api()`、`act()` 函数名与返回数据结构保留。Node/Worker需在真实God job生成中、完成和回退时提升room.version，才能按同一有序快照协议投影。

## 显示质量

更多 → 沙盘视图 → 显示质量，使用 `#scene-quality`。选项为自动/节能/清晰，本机保存 `ga:sceneQuality`。初次传入 `mountGlobe(...,{quality})`，切换时调用 `globe.setQuality(mode)`。不改变规则、头像或桌上人数；具体DPR/阴影/背景细节由场景模块实现。原缩放、旋转API保留。

## 当前验证证据

- `node --check public/app.js`：通过。
- `node docs/check-v6-room-sync.mjs`：8项源函数回归通过；覆盖串行轮询、操作后旧读包、同版时戳、离页abort、旧epoch、DOM缓存、四种真实主持状态与知识来源字段。使用明确的网络fixture，没有真实网络或模型调用。
- `node docs/check-action-budget-init.mjs`：默认行动未经input也立即显示预算/说明，现金变化与all/targeted目标切换通过；直接读取实际engine ACTIONS，不创建房间。
- `node docs/check-receipt-state.mjs`：原6项丢包、更新草稿、截止和失败回执行为通过。
- `node --test tests/frontend-etag.test.mjs`：4项ETag/304源函数回归通过，覆盖不读body/不渲染/草稿保留、新轮次tag、POST后旧304、POST缺tag清除及token/epoch隔离。

这些检查不能替代真实浏览器四尺寸、GPU表现与真实DeepSeek端到端证据；由总控在集成后安排。`docs/v6-*.js` 和实施脚本是执行资料，不是产品依赖。
