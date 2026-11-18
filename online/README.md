# 增长酒馆 · 课堂体验改进

本轮按2026-11-18详评落实课堂加入、开局任务、十二行动说明、手机操作、真实回合复盘、札记草稿和实验预测。纸白阅读与暖暗酒馆延续原品牌，首页新增内置image_gen生成的折纸棋子插画和真实经营预览。

回退基线：`baseline-v8-20261118`（cbcc8cc）；开发分支：`codex/classroom-experience-20261118`。完整实现映射与验收边界见 [CLASSROOM_RELEASE.md](docs/CLASSROOM_RELEASE.md)，独立品审见 [CLASSROOM_INDEPENDENT_REVIEW.md](docs/CLASSROOM_INDEPENDENT_REVIEW.md)，图片与最终提示词见 [HERO_IMAGE.md](docs/HERO_IMAGE.md)。实际部署版本由交付记录确认。

运行仍为Node.js24、`npm ci`、`npm run dev`，默认 http://localhost:3020/#/home ，本地主持为模板，无需密钥；`npm test`包含新增草稿、历史证据与回链回归，`npm run build`构建原站点Worker。没有新增框架或运行依赖。

## 历史基础与后端边界（保留原说明）

以下是前版V6/托管版本7的历史实现和模型边界，本轮前端改进不重置数据或模型配置；当前课堂前端以上述实施记录为准。

# 增长酒馆 · V6体验 / 线上版本7

本轮把酒馆改为固定的回合条、经营与信息栏、单一行动区，并重做真实四席圆桌的木质桌椅、坐姿人物、头像归属和背景氛围。项目由原线上 Worker 工程复制到独立目录，保留 V2 和当前公开站点。

公开入口：<https://growth-tavern-suli-demo.zheiisu.chatgpt.site/#/tavern>。V6体验现已发布为托管版本7，继续使用原D1、Secret与四席六轮规则。2026-11-17用户明确允许按需使用现有DeepSeek余额，因此新增显式 `GOD_MAX_CALLS=unlimited` 配置；累计计数保留，重试也计数，不自动充值。实际部署见 `docs/evidence/classroom-deployment-v7.json`；首次完整六轮成功记录为 `classroom-online-v6-before-etag.json`，修复后的复测另存 `classroom-online-v7.json`，以各文件实际status和失败记录为准。

实际发布源位于 `classroom-online/.sites-checkout`，发布归档为同级 `growth-tavern-classroom-v3_20261117.tar.gz`。`delivery/` 的旧ZIP是首次本地交付基线，不代表此次课堂线上版本。

## 本地运行

需要 Node.js 24；本次验证使用 Windows Node.js 24.13.1。

```powershell
npm ci
npm run dev
```

打开 <http://localhost:3020/#/tavern>。开发服务使用 `public/` 的真实前端和 `server/` 的真实本地 HTTP 房间，不需要密钥。房间写入 `data/dev/`，该目录不提交、不打包。本地主持使用模板，练习桌明确显示三席脚本；它们不能被描述成三名真人。

`npm start` 启动原生 API 服务，默认端口 3001；`npm run dev` 默认 3020，另外提供仅限本机的浏览器验证入口。

真实模型本地验收可在服务端加载现有环境，并显式设置 `QA_REAL_GOD=1`、`GOD_PROVIDER=deepseek`、`GOD_ALLOW_PAID_CALLS=true`、`GOD_MAX_CALLS=unlimited`。密钥只从服务进程环境读取；不提交 `.env`，不向网页传Key。未显式启用时，`dev`仍为模板。Node本地计数按进程保存；线上采用共享D1持久计数，两者不能混算。

## 验证与构建

```powershell
npm test
npm run test:api
npm run build
```

`npm test` 覆盖权限、经济引擎一致性、主持有限/无限计数、自然话术、独立中文反例、ETag与真实Three几何。`node scripts/qa-multiplayer-v6.mjs`运行两桌八身份、混合协议六轮的真实本地HTTP验证；受控服务时钟加速等待，报告明确不代表公网延迟。`test:api`另检查头像、回放和重启恢复。构建产物为 `dist/server/index.js` 与 `dist/.openai/hosting.json`。

浏览器验证在用户实际打开的本地浏览器内操作真实 DOM 与本地 API，报告位于 `docs/evidence/`。四个 CSS 视口的结果不代表四种真实移动设备；合成的 HTTP 503 与响应丢失场景会明确标识。首次用户观察和实体手机性能需要另外测量。

## 主要改动

- `public/app.js`、`tavern-v3.css`：经营摘要、情报/研究/账本、手机底部面板、预算与接收/失败/不确定/锁定反馈。草稿跨轮询与页签保留。
- `public/roundtable-scene.js`：真实 WebGL 四席、自然头像比例、缩放及全标记桌面间距、按需绘制、球体局部手势。
- `public/tavern-models.js`、`tavern-environment.js`：木与黄铜桌椅、服装和手部、杯垫笔记、吧台瓶罐、窗灯植物及黄铜天平。
- `server/persistence.js`：仅修复 Windows 对目录 fsync 返回 EPERM 的兼容问题，保留临时文件 fsync 与原子改名。

经营规则与席位权限未改。新版真实主持默认每次最多600输出token，最多重试一次429/5xx，超时或不合规时标记模板回退，结算不等待模型。未配置 `unlimited` 时仍兼容原12次上限；现有生产累计值不会重置。真实模型评测保留失败样本、版本、用量和独立人工评分。

God权威来源为 `worker/god-knowledge.js`（76条）与 `god-contract.js`，Node和Worker共用。检索仅使用已公开证据；模型获得聚焦的一条事实与相关知识，生成自然中文，逐句校验后展示。旧 `server/knowledge.json` 是历史遗留，不再作为现用知识库。已做知识整理、提示词与few-shot调教、真实模型评测；没有参数微调或自动学习。

V6还增加常显主持、全文/历史/知识来源弹窗、低画质设置、单请求轮询与304响应，以及静止/后台停止绘制。参见 `docs/V6_UI.md`、`docs/SCENE_PERFORMANCE_2026-11-17.md`、`docs/GOD_NATURAL_CONTRACT.md`。浏览器提交次数不是GPU完成帧率；桌面窄视口不是实体手机，真实课堂仍需同学设备试局。

设计映射与证据见 `docs/V3_UI.md`、`docs/V3_SCENE.md`、`docs/QA_REQUIREMENTS.md` 及交付说明。本轮新增 Figma V3 页面，保留之前用户修改稿；三维场景在 Figma 中是独立素材，文字、字段、按钮和信息结构为可编辑图层。
