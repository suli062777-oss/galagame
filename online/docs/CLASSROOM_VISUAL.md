# 课堂体验版：视觉实现

日期：2026-11-18。实现文件为 `public/classroom.css`，须放在 `style.css`、`tavern-v3.css`、`roundtable.css` 之后加载。保持原生 ESM、现有系统中文字体与真实 Three.js 场景；不新增依赖。

## 方向

按 `design-taste-frontend` 的层级、布局与交互原则，结合本产品的中文课堂场景，采用纸白学习与暖暗经营的双环境。以留白、位置、字号和单一主动作分层；不添加颗粒滤镜、光晕、自动循环装饰、渐变文字或大圆角卡片网格。首页继续保留「增长黑客」和朱红酒馆入口。

生成图使用 `/assets/classroom/hero-folded-table.webp`。图片按完整 3:2 比例显示，`object-fit: contain`，没有在前端叠加纹理、混合模式或噪点。四枚棋子及折纸路径的边缘应完整可见。PNG 保留为源素材，WebP 供网页使用。

## 已落实的视觉关系

- 首页采用左文右图与纵向路径列表，作者出处移至支持信息。
- 酒馆加入的 DOM 先表单后说明；桌面表单在右，手机保持 DOM 次序且去掉外层装饰面板。三个入席方式为明确文字控件。
- 深色输入框用与全局基础规则相同类型、更明确作用域的选择器修复背景覆盖；输入、placeholder、焦点与 autofill 都定义真实深色状态。
- 手机保留产品名称；决策圆桌默认 240px，可由 `data-scene-expanded="true"` 展开至 370px。候场与结束分别分配场景高度。
- 本轮事实、传闻、预算、动作与提交回执的字号/色阶分层，完整来源仍可展开。
- 手机动作面板在底部安全区内滚动；打开面板时隐藏背景操作栏，避免同时出现两个主要动作。
- 非决策阶段的 dock 回到正常文档流，结束摘要不会盖住主持；`classroom-result` 排在圆桌前，回合选择与证据相邻。
- 实验预测与固定基线以轻量文字/对照行组织，不再嵌套多层卡片。

## 与主控的 CSS 契约

游戏区域使用现有 `body.in-game[data-game-phase]`、`.v3-room`、`.arena-main`、`.arena-stage`、`.arena-dock`。场景展开状态需放在 `.v3-room.dataset.sceneExpanded`，按钮 `.scene-toggle`。

新增模块支持：`.classroom-mission`、`.classroom-first-turn`、`.action-purpose`、`.action-context`、`.classroom-round-summary`、`.classroom-result`、`.round-timeline`、`.round-review`、`.review-metrics`、`.classroom-concept`、`.classroom-scene-caption`。主控后续若增加结构，应沿用这些职责，避免每个小内容块重复加容器。

桌面主区采用可滚动文档列，舞台 220–310px；结束阶段允许整个页面滚动。手机信息面板与动作面板沿用现有数据状态，CSS 不改变回执、草稿、权限或经营规则。

## 待集成后的实际复核

必须对 1440、1024、768、390、360、320px 检查：首屏加入动作、长昵称/产品名、默认与展开圆桌、动作面板/信息面板、结束复盘、输入焦点与预算说明。布局检查不等于真实 iOS/Android 键盘和 GPU 性能验证。截图由主控提供后继续迭代。

## 本轮实际检查与迭代

只读真实预览检查位于 `docs/evidence/classroom-visual/preview-checks.json`；脚本 `docs/qa-classroom-visual.mjs` 仅浏览首页与入口，不创建房间或调用模型。六个宽度各两页共 12 项通过：未出现全页横向溢出，主图加载且按完整 3:2 contain 显示，所有窄屏初始主加入按钮可见。390×844 的加入按钮 y=522–572；320×844 为 y=532–582。

实测暗色输入背景为 `#151610`，正文 `#eee9dd` 与 placeholder `#aaa99a`，按 sRGB 计算对比度约 15.02:1 与 7.67:1。这些数值仅证明该控件的颜色组合，不代表全站无障碍认证。

独立品审截图后已修两项实际样式问题：打开动作面板时提高整个 dock 的 stacking context，使内部编辑面板越过 scrim；结果分项使用三列、综合分数值与名次文字拆分字号，防止手机继承大字号断行。320px 六回合按钮改为三列两行，保留可读数字。相关对局截图需由独立品审刷新后复核。真实3D在阶段尺寸切换后出现空画布的问题已交总控排查渲染失效通知，CSS没有隐藏canvas或设置祖先opacity。
