# 课堂体验交付核查

日期：2026-11-18。范围来自用户“按照改进计划输出项目、使用多个子智能体、生图干净美观、另设品审”的要求，以及 `product-review-2026-11-18/REVIEW.md` 的 F01–F14；优先场景为课堂现场与首次开局。

## 要求与当前证据

| 要求 | 已检查的实际证据 | 结论 |
| --- | --- | --- |
| 改进计划 F01–F02 | classroom-learning.js 的加入/邀请/练习/组长分流；learning/browser-verification.json 的真实入席与原席位恢复；classroom-visual/preview-checks.json 的六宽度首屏位置 | 已实现并通过所列本地检查 |
| F03–F05 | 实际 product/rules 渲染任务与权重；十二项行动完整保留；真实草稿与提交回执；functional/browser-evidence.json 六轮实际 HTTP 旅程；手机行动截图 | 已实现；没有更改倒计时、经济规则或权限 |
| F06 | 真实输入字段计算颜色及对比度记录；classroom.css 明确作用域、焦点样式 | 所列字段文字/placeholder均超过4.5:1；不代表全站认证 |
| F07–F08 | hostBriefMarkup/evidenceMarkup 的公开来源与时间过滤；175项回归中的未来/核验边界测试；quality-final/quality-evidence.json 三条摘要、主持原文/引用、真实结算字段比对 | 已实现，26项定向检查通过 |
| F09–F11 | resultMarkup、roundReviewMarkup、conceptMarkup；六轮真实结算后选择第2轮→概念→完整章节→回原轮次→写带来源札记；手机方法卡/情报关闭和Escape恢复原面板与焦点 | 已通过实际闭环；提前结束、破产及回链范围另有数据测试 |
| F12 | note-drafts.js 与7项针对恢复/冲突/配额/清除的测试；learning真实浏览器跨页、刷新、正式保存不复活旧稿、显式丢弃/恢复 | 已实现并核对 |
| F13–F14 | 首页酒馆主动作前置放大；真实对局预览；新插画；三个实际实验先预测→操作→固定基线/记住对照；学习agent和品审独立记录 | 已实现并实际操作/看图 |
| 多个子智能体 | learning_entry负责入口/学习/札记；visual_implementation负责视觉CSS；taste_quality独立品审；各自实施/报告和原始证据均保留 | 三个分工已完成，总控负责整合与交付 |
| 干净美观的生成图 | 内置imagegen生成记录与完整最终提示词在HERO_IMAGE.md；原图/WebP及实际1440/390首页均经独立肉眼审查 | 通过所列样本品审，无全局颗粒、乱码或多余AI装饰；纸和木的自然材质仍保留 |
| 回退点 | 固定baseline-v8-20261118与checkpoint-classroom-20261118；published/、baseline/、服务端/Worker规则目录与基线对比一致 | 两个存档均保留；后续发布不改变这些标签 |

`CLASSROOM_RELEASE.md` 给出逐项实现位置；`CLASSROOM_INDEPENDENT_REVIEW.md` 与 `CLASSROOM_TARGETED_FINAL_REVIEW.md` 区分实际检查、工具截图误差和未实测范围。检查结论来自原始JSON、截图与代码，不把报告文字本身当作运行证明。

## 构建与发布证据

最终自动回归 `npm test` 为175项通过、0项失败，原始输出见 `evidence/classroom-20261118/final-tests.txt`。在原Sites源检出中构建：19个模块、37个静态资源，Worker 3,061,745字节、gzip 1,723,120字节；Worker语法检查和六项关键课堂资源检查通过。

GitHub交付分支为 `codex/classroom-release-20261118`，`online/` 为开发源码。原站点沿用原project_id、公开访问和DB绑定。精确Git提交、Sites源提交、保存版本与最终发布状态以交付时的独立部署回执为准，不能用Git提交成功代替线上发布成功。

## 验收边界

真实HTTP检查在本机、模板主持和脚本席位下完成，没有新增付费模型调用。175项自动回归、六轮浏览器旅程、27项学习路径检查、12项首页/入口宽度检查、此前19张品审截图和本次26项定向检查/11张截图，分别证明对应实现和样本；不是所有设备、所有随机事件或所有真人课堂情境的穷尽证明。

计划中的实体手机软键盘/安全区、真实学生首次理解率与课堂网络研究属于后续实地验证，本次没有声称达到这些研究指标。本站不包含玩家数据快照；源码回退与线上版本回退分开执行，见baseline/ROLLBACK.md。
