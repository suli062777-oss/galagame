# 增长酒馆 · 真实线上四人版

Cloudflare Worker + D1共享房间。浏览器仅保存本人凭据；经营、截止时间、结算、私有信息权限及主持调用额度由服务器裁定。

DeepSeek密钥通过Sites运行时Secret配置，不存在源码、前端资源或Git历史。全站共享D1调用计数（最多12，包含失败重试）；Worker冷启动或扩容不重置。额度用尽自动模板，经营游戏仍可完成。

构建：运行 `node scripts/build.mjs`（当前工作机使用已核实的Sharp运行库，仅做静态PNG编码压缩）。迁移位于drizzle，部署时由Sites应用。主入口worker/index.js，无Node服务器、文件系统或外部npm运行时依赖。
