# 增长黑客 · Agent增长酒馆 V6

**当前运行源码在 [online/](online/README.md)**。这是原生ESM前端、Cloudflare Worker+D1共享房间及Node本地服务；四个真实协议席位、六轮经营、可换照片头像、常显主持与知识来源。公开演示：[增长酒馆](https://growth-tavern-suli-demo.zheiisu.chatgpt.site/#/tavern)。

本分支供评审；不会自动合并或替代部署。历史demo目录与仓库根目录旧Node源码保留，不能把旧浏览器模拟模式当当前线上实现。

DeepSeek密钥仅在服务端运行时Secret中。未显式配置时仍为12次上限、重试计数、超限模板；用户于2026-11-17另行授权后，可显式设置GOD_MAX_CALLS=unlimited使用已有余额，D1累计计数不重置，不自动充值。每条播报展示实际DeepSeek/模板/生成中/回退来源。

God使用公开证据、本地知识检索、提示词与few-shot调教、真实模型评测；没有参数微调、SFT或自动学习。私有研究E15、玩家意图、未公开行动、种子和未来安排不送公共主持。详见 [God契约](online/docs/GOD_NATURAL_CONTRACT.md)。

前一版公网两桌六轮验证通过，14条播报中13条真实DeepSeek、1条如实模板；行动请求p95为2.474秒，未达到候选2秒目标，304样本为0。此源码已补弱ETag比较并有独立回归，实际304上线效果需要后续postfix报告，不能用源码测试替代。协议身份与合成fixture不等于8名真人或真实手机课堂。

安装、构建、模型边界、Figma及精简证据见 [online/README.md](online/README.md)。仓库不包含密钥、私人房间、凭据、数据目录、构建产物或浏览器档案。

原始书籍：肖恩·埃利斯、摩根·布朗《增长黑客》，中信2018中文版。本项目为学习型二次解读，经营规则为教学改编；现有AgentBar与Three.js版权说明保留。
