# 课堂静态Demo构建

发布目录：dist。复制完整public UI与本地Three.js和全部图片，新增demo-transport.js作为app api()的本地替代。demo-engine.js来自server/engine.js，只替换node:crypto import为同步浏览器SHA-256适配器；经营公式未改。无需npm安装或构建，直接静态发布dist。

支持书籍、实验、札记、圆桌3D人物、预设/照片头像、本浏览器单人练习+三脚本、准备5秒/决策45秒、六轮结算、研究/账本、超时默认、可验证回放。房间、头像与进度在本浏览器localStorage保存。GET状态驱动deadline阶段推进；前台app原有1秒轮询继续工作。

入口明确“课堂Demo · 本浏览器保存 · 三席脚本对手”。不提供线上多人或真实Agent；主持为本地模板，不发送模型请求。没有.env、服务端密钥、原房间凭据或后端运行时。

GitHub Pages子路径适配：index和app素材链接已改相对路径，页面使用hash路由；JS模块均相对引用。本次用户要求停止额外验收，未操作浏览器、未新增测试；只做源文件语法检查。
