# 增长酒馆 V6 · 当前源码

当前实现位于本目录，兼容包版本仍为3.1.0。原生前端在public；Worker+D1入口为worker/index.js；server提供独立Node本地HTTP服务。历史demo与根旧Node源码保留。

## 运行与构建

需要Node.js 24（本次24.13.1）。在online目录执行：

```powershell
npm ci
npm run dev
```

打开http://localhost:3020/#/tavern 。默认模板主持，无需密钥；练习另外三席明确为脚本。房间数据写data/dev，不入Git。npm start默认3001。

```powershell
npm test
npm run test:api
npm run build
```

build重新生成worker/assets.js及dist，二者不提交。迁移在drizzle；构建产物dist/server/index.js与dist/.openai/hosting.json。线上使用既有D1和运行时Secret，部署由授权的平台流程处理，PR不自动部署。

## V6行为

- 四席六轮共享权威房间，45秒共同决策；人类/Agent权限与私有研究隔离，真实回执、幂等和截止锁定。
- 暖木圆桌、本人头像上传、按需绘制、自动/节能/清晰质量档位；后台停止绘制。
- 常显God、全文/历史/知识来源；逐条保留生成时来源快照。模板回退不阻塞结算，不假装模型。
- 串行轮询、离页取消、旧回包门禁、ETag/304。最新弱ETag/list/*/带引号逗号兼容修复包含在本次源码内。

## DeepSeek与费用边界

密钥只从服务端环境/运行时Secret读取，不在网页、仓库或报告中。GOD_PROVIDER=deepseek、GOD_ALLOW_PAID_CALLS=true及密钥显式启用真实主持。默认GOD_MAX_CALLS仍为12；用户新增授权下显式unlimited不重置线上D1累计值，重试计数，不充值。Node本地按进程计数，不能与线上共享D1混算。模型默认最多600输出token，429/5xx最多重试一次，超时/不合规如实回退。

76条版本化知识覆盖12行动、3产品、18事件；私有E15不入公共检索，其余事件也须已公开。已做知识整理、确定性检索、提示词/few-shot和真实输出评测，没有参数微调或自动学习。直接供应商评测与线上D1主持调用是不同计数范围，均保留失败与成本证据。

## 验证证据

- [精简公网六轮报告](docs/evidence/classroom-online-v6.json)：两桌、48个已接收行动、14条播报13 DeepSeek/1模板，p95=2473.95ms，304=0；这是弱ETag修复前。未达到2秒候选目标，不能称8真人或手机课堂测试。
- [独立公网审计](docs/evidence/CLASSROOM_ONLINE_V6_INDEPENDENT_AUDIT.md)、[God运行独立评审](docs/evidence/V6_GOD_RUNTIME_INDEPENDENT_REVIEW.md)。
- [真实模型调用汇总](docs/evidence/god-live-run-summary.json)：包含失败批次。原37类型分析后不再称未见类别留出，新seed只称变体；最终旧37重验36/37，后续E12定点真实输出通过，不混称一次最终37/37。
- [独立人工评分](docs/evidence/god-live-focus-v3-human-review.md)、[定向语义复核](docs/evidence/god-live-targeted-human-review.md)。合成隔离fixture不代表完整课堂局。
- [源码哈希清单](docs/evidence/source.json)及[本次仓库审计](docs/GITHUB_V6_REVIEW.md)。完整浏览器/请求档案留在本机，不上传。

[UI](docs/V6_UI.md) · [场景性能](docs/SCENE_PERFORMANCE_2026-11-17.md) · [God契约](docs/GOD_NATURAL_CONTRACT.md) · [Figma同步](docs/FIGMA_V6_SYNC.md)。Figma沿用可编辑文本/组件，场景为独立素材，不是可编辑三维几何。
