# Figma V6 同步交付

账号：lisu。原文件：`yfJQvcO0KOxgL3o7gjxRSJ`；原页：`207:150`。本次复用总控session `edf5ba80-6c68-4fcd-b243-737b96edd169`，使用 figma-use、figma-generate-design。

[打开V6总览](https://www.figma.com/design/yfJQvcO0KOxgL3o7gjxRSJ/?node-id=244-181)

| 新画面 | ID | 尺寸 | 链接 |
|---|---|---|---|
| 桌面决策与常显主持 | 244:214 | 1440×900 | [桌面](https://www.figma.com/design/yfJQvcO0KOxgL3o7gjxRSJ/?node-id=244-214) |
| 手机决策与常显主持 | 244:288 | 390×844 | [手机](https://www.figma.com/design/yfJQvcO0KOxgL3o7gjxRSJ/?node-id=244-288) |
| 主持全文与知识来源展开 | 244:386 | 650×608 | [全文](https://www.figma.com/design/yfJQvcO0KOxgL3o7gjxRSJ/?node-id=244-386) |
| 主持历史按回合阅读 | 244:407 | 650×632 | [历史](https://www.figma.com/design/yfJQvcO0KOxgL3o7gjxRSJ/?node-id=244-407) |
| 更多与显示质量 | 244:433 | 214×578 | [质量设置](https://www.figma.com/design/yfJQvcO0KOxgL3o7gjxRSJ/?node-id=244-433) |

## 原稿与差异

原桌面 `208:150`、手机 `208:220`、手机行动面板 `209:166`、操作反馈 `215:179` 全部保留。新稿在同页右侧空白处克隆构建，未覆盖原稿。

原稿桌面没有常显主持、Agent直达入口与低频行动栏，右侧还有重复主持摘要。已按当前 `app.js`、`tavern-v3.css` 修正这些主要变化：场景1066×418、主持78高、行动仍从y620开始；右侧保留固定经营和三页签，去掉重复主持。预算显示预计投入/可用预算/预留运营费。手机保留362×404场景、固定行动入口，新增下方主持与移动Agent短入口，阶段和时间继续常显。

God全文/历史/知识来源和质量菜单均由可编辑图层组成。历史引用使用与来源相符的示例内容，不代表Figma本身接入模型；运行时真实模型证据在另一个评测报告中。

## 组件与token发现

本地未发现Code Connect源码文件，Figma页的Code Connect map为空；没有已启用远程库。已搜索完整主持面板，没有合适的库组件。复用既有 `207:161` primary、`207:163` outline、`207:165` field及原暖色token，没有导入不相关社区设计体系。

新增本地组件集：

- `244:191` Tavern V6/Agent Entry：桌面/手机。
- `244:213` Tavern V6/Host Broadcast：桌面/手机，Source/Body可编辑。
- `244:385` Tavern V6/Host Message：引用知识展开/折叠。

新增token：`VariableID:244:179` hostSurface、`VariableID:244:180` hostBody、`VariableID:246:270` agentTint、`VariableID:246:271` agentStroke。后两项修复了变量alpha导致Agent入口误呈主按钮的视觉问题。

## 编辑性与视觉验证

最终总览 `244:181` 有219个后代：63 Frame、38 Instance、114 Text、2 Vector、2 Rectangle。只含两块独立WebGL场景图像：`244:225` 1066×418及`244:309` 362×404；没有完整UI截图、截图底板或在截图上盖少量文字的做法。按钮、字段、文字、布局与弹窗均可修改。

字体读回仅Noto Sans SC Regular/Medium，已显式检查。当前Web源码使用系统字体栈；Figma环境没有Microsoft YaHei/PingFang SC，沿用原稿已说明的Noto Sans SC替代，不宣称跨平台字形逐像素一致。

场景复用原稿既有局部素材；人物模型与真实运行质量档位仍由代码控制，Figma图像不代表可编辑三维几何。桌面裁切与手机保留高度已在总览截图检查，人物和头像未被主持区覆盖。

组合截图后做一次定点修正：手机Agent显式短文案、入口改为正确浅色描边、弹窗按内容收紧、选中页签补指示线。最终截图为 `docs/evidence/figma-v6-composition-final.png`，其后没有再做视觉变更或重复截图。

所有创建、修改、移除的克隆层ID及最终结构证据记录在 `docs/evidence/figma-v6-manifest.json`。创建/移除只发生于新V6区域及新增组件；原屏幕ID不在修改集合内。
