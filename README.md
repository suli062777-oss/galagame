# 增长黑客 · Agent增长酒馆

交互阅读、增长实验、代码圆桌人物与可换头像的四席六轮经营练习。

## 课堂 Demo

**[立即打开课堂 Demo](https://growth-tavern-suli-demo.zheiisu.chatgpt.site/)**（公开访问，无需登录）。`demo/` 可直接静态托管，保留完整书、实验、札记、圆桌头像与原规则六轮练习。演示为本浏览器保存、一人加三脚本、模板主持；没有伪装真实多人或外部模型接入。

## 完整本地版本

安装 Node.js 22+ 后运行 `sh scripts/start.sh`，打开 http://127.0.0.1:3001/ 。完整原生 Node API 支持四人房、玩家 Agent 协议、确定性回放及可配置的 DeepSeek 主持。按 `.env.example` 在本机设置；仓库不含任何真实密钥或私人房间数据。

`public/roundtable-scene.js` 用 Three.js 几何体构建桌、四椅与四个坐姿人物，头像作为头部纹理。照片在本地裁切，只有本人能更新对应席位。

原始书籍：肖恩·埃利斯、摩根·布朗《增长黑客》，本项目为学习型二次解读与教学改编。AgentBar/Three.js 许可见版权说明。
