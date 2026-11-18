# 增长酒馆：改进前存档 · 2026-11-18

冻结标识：`baseline-v8-20261118`；存档分支：`codex/archive-pre-improvement-20261118`。这是用户要求在下一轮改进之前保存的可回退基线。主分支与原源码评审分支保持原有状态。

- `online/`：当前本地开发源码，包含首页酒馆主按钮调整、本地 Node 传输修复、规则、素材、测试与运行脚本。
- `published/`：当前线上版本8对应的完整Git提交内容，来源提交 `1b1d0b98d15b2321f5c5e668ceda6fce82a2c5d3`。保留该提交内的构建输出，便于核对线上基线；与开发目录分开，避免把本地修复和已发布文件混为一谈。
- [本次详评](online/docs/product-review-2026-11-18/review.html)：三个独立子报告、参考、截图与四状态结构示意。
- [回退说明](baseline/ROLLBACK.md) 与 [逐文件清单](baseline/manifest.json)。

线上入口：https://growth-tavern-suli-demo.zheiisu.chatgpt.site/#/home

版本8包含：进入增长酒馆主按钮前置、朱红实心并放大；开始阅读为次要描边按钮。后续详评建议尚未实施。原产品文档中的部分版本7字样属于冻结前已有历史说明，当前发布版本以本清单为准。

## 使用开发源码

需要 Node.js24。进入 `online/` 后执行 `npm ci`、`npm run dev`，访问 http://localhost:3020/#/tavern 。默认模板主持，无需密钥。发布源码的构建使用 `published/` 内配置。

## 存档边界

本档保存代码、规则、素材、构建及评审资料，不提交真实环境密钥、玩家房间数据、本机凭据、node_modules或浏览器档案。线上D1及运行时Secret由既有站点保留；代码回退不会自动恢复玩家数据或运行时配置。未改变任何线上状态。
