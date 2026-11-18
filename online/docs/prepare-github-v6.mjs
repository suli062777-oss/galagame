import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const project=fileURLToPath(new URL('../',import.meta.url));
const temp=path.join(process.env.TEMP,'growth-tavern-v6-github-20261117'),base=JSON.parse(fs.readFileSync(path.join(temp,'base.json'),'utf8'));
const stage=path.join(temp,'stage-'+Date.now());fs.mkdirSync(stage,{recursive:true});
const sha256=b=>createHash('sha256').update(b).digest('hex'),blob=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const selected=[];
function visit(dir,prefix=''){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const rel=prefix?prefix+'/'+entry.name:entry.name;if(entry.name==='node_modules'||entry.name==='.git'||entry.name==='.DS_Store'||entry.name.startsWith('.env')||entry.name.endsWith('.log'))continue;if(entry.isDirectory())visit(path.join(dir,entry.name),rel);else if(rel!=='worker/assets.js')selected.push(rel);}}
for(const dir of ['public','server','worker','drizzle','scripts','tests'])visit(path.join(project,dir),dir);
selected.push('package.json','package-lock.json','.gitignore','.openai/hosting.json');
const docs=['V6_UI.md','V3_UI.md','V3_SCENE.md','SCENE_PERFORMANCE_2026-11-17.md','GOD_NATURAL_CONTRACT.md','GOD_INDEPENDENT_REVIEW.md','FIGMA_MAP.md','FIGMA_V6_SYNC.md','QA_REQUIREMENTS.md','god-evaluation-contract.json','god-evaluation-set.json','build-god-eval-data.mjs','check-action-budget-init.mjs','check-v6-room-sync.mjs','check-receipt-state.mjs','check-ui-templates.mjs','check-agent-entry.mjs'];
for(const file of docs)if(fs.existsSync(path.join(project,'docs',file)))selected.push('docs/'+file);
const evidence=['god-live-run-summary.json','god-offline-final-guards.json','god-live-focus-v3-human-review.md','god-live-focus-v3-human-review.json','god-live-human-review.md','god-live-targeted-human-review.md','V6_GOD_RUNTIME_INDEPENDENT_REVIEW.md','CLASSROOM_ONLINE_V6_INDEPENDENT_AUDIT.md','multiplayer-local-v6.md','v6-built-worker-smoke.json'];
for(const file of evidence)if(fs.existsSync(path.join(project,'docs/evidence',file)))selected.push('docs/evidence/'+file);
function put(rel,content){const dest=path.join(stage,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,content);}
for(const rel of selected){const bytes=fs.readFileSync(path.join(project,rel));put('online/'+rel,bytes);}
const rootReadme=`# 增长黑客 · Agent增长酒馆 V6

**当前运行源码在 [online/](online/README.md)**。这是原生ESM前端、Cloudflare Worker+D1共享房间及Node本地服务；四个真实协议席位、六轮经营、可换照片头像、常显主持与知识来源。公开演示：[增长酒馆](https://growth-tavern-suli-demo.zheiisu.chatgpt.site/#/tavern)。

本分支供评审；不会自动合并或替代部署。历史demo目录与仓库根目录旧Node源码保留，不能把旧浏览器模拟模式当当前线上实现。

DeepSeek密钥仅在服务端运行时Secret中。未显式配置时仍为12次上限、重试计数、超限模板；用户于2026-11-17另行授权后，可显式设置GOD_MAX_CALLS=unlimited使用已有余额，D1累计计数不重置，不自动充值。每条播报展示实际DeepSeek/模板/生成中/回退来源。

God使用公开证据、本地知识检索、提示词与few-shot调教、真实模型评测；没有参数微调、SFT或自动学习。私有研究E15、玩家意图、未公开行动、种子和未来安排不送公共主持。详见 [God契约](online/docs/GOD_NATURAL_CONTRACT.md)。

前一版公网两桌六轮验证通过，14条播报中13条真实DeepSeek、1条如实模板；行动请求p95为2.474秒，未达到候选2秒目标，304样本为0。此源码已补弱ETag比较并有独立回归，实际304上线效果需要后续postfix报告，不能用源码测试替代。协议身份与合成fixture不等于8名真人或真实手机课堂。

安装、构建、模型边界、Figma及精简证据见 [online/README.md](online/README.md)。仓库不包含密钥、私人房间、凭据、数据目录、构建产物或浏览器档案。

原始书籍：肖恩·埃利斯、摩根·布朗《增长黑客》，中信2018中文版。本项目为学习型二次解读，经营规则为教学改编；现有AgentBar与Three.js版权说明保留。
`;
put('README.md',rootReadme);
put('online/README.md',`# 增长酒馆 V6 · 当前源码

当前实现位于本目录，兼容包版本仍为3.1.0。原生前端在public；Worker+D1入口为worker/index.js；server提供独立Node本地HTTP服务。历史demo与根旧Node源码保留。

## 运行与构建

需要Node.js 24（本次24.13.1）。在online目录执行：

\`\`\`powershell
npm ci
npm run dev
\`\`\`

打开http://localhost:3020/#/tavern 。默认模板主持，无需密钥；练习另外三席明确为脚本。房间数据写data/dev，不入Git。npm start默认3001。

\`\`\`powershell
npm test
npm run test:api
npm run build
\`\`\`

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
`.replaceAll('\\`','`'));
put('online/ONLINE_UI.md','# 当前线上UI\n\nV6的常显God、经营信息、草稿与回执、手机操作、显示质量和真实来源说明见[docs/V6_UI.md](docs/V6_UI.md)。本目录public调用真实服务端API，不含旧demoTransport。\n');
const fullReportBytes=fs.readFileSync(path.join(project,'docs/evidence/classroom-online-v6.json')),fullReport=JSON.parse(fullReportBytes);
const providers={};for(const table of fullReport.tables||[])for(const message of table.hostHistory||[]){const provider=message.provider||'unknown';providers[provider]=(providers[provider]||0)+1;}
const summary={summaryOnly:true,sourceReportSha256:sha256(fullReportBytes),status:fullReport.status,origin:fullReport.origin,startedAt:fullReport.startedAt,finishedAt:fullReport.finishedAt,scope:fullReport.scope,transport:fullReport.transport,weakEtagFixStatus:'This measurement predates the weak-ETag fix included in this review source. Postfix public evidence is separate.',tableCount:fullReport.tables.length,roundsPerTable:fullReport.tables.map(t=>t.rounds.length),matchingFinalClients:fullReport.tables.map(t=>t.matchingFinalClients),acceptedActions:fullReport.acceptedActions.length,suggestions:fullReport.suggestions.length,networkErrorCount:fullReport.networkErrors.length,actualHostProviders:providers,latency:fullReport.latency,responseBodies:fullReport.responseBodies,godUsage:fullReport.godUsage,notVerified:fullReport.notVerified,constraints:fullReport.constraints,limitations:['Protocol clients are not 8 real students.','The accepted-action p95 2473.95ms exceeds the candidate 2000ms target.','This beforefix report has zero 304 samples; tests cannot replace subsequent deployed measurements.','Room IDs, participant identities, requests, source state, hashes, credentials and full browser archives are excluded from this public summary.']};
put('online/docs/evidence/classroom-online-v6.json',JSON.stringify(summary,null,2)+'\n');
const psHash=sha256(fs.readFileSync(path.join(stage,'online/scripts/qa-classroom-v6-online.ps1')));if(psHash!=='62d1e02fcb4243d1526da043a41eb77386ca7b1e10611b6a75664a0aef829e71')throw Error('Required fixed PowerShell script differs');
let files=[];function stageFiles(dir,prefix=''){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const rel=prefix?prefix+'/'+entry.name:entry.name;if(entry.isDirectory())stageFiles(path.join(dir,entry.name),rel);else{const b=fs.readFileSync(path.join(dir,entry.name));files.push({path:rel,size:b.length,sha256:sha256(b),gitSha:blob(b),binary:/\.(png|webp|jpe?g|gif|ico|woff2?|ttf|pdf|zip|gz)$/i.test(rel)});}}}stageFiles(stage);
put('online/docs/evidence/source.json',JSON.stringify({snapshot:'V6 review branch 2026-11-17',baseCommit:base.sha,paths:files.map(({path,size,sha256})=>({path,size,sha256})),fixedPowerShellSha256:psHash,exclusions:['node_modules','.env','data','dist','worker/assets.js','delivery','classroom-online/.sites-checkout','raw browser/request archives','private room state and credentials']},null,2)+'\n');
put('online/docs/GITHUB_V6_REVIEW.md','# V6仓库同步审计\n\n此分支仅供Draft PR评审，不合并main、不发布。online替换为本轮冻结运行源，根旧Node和demo保留。已包含弱ETag、引用快照、新scene-runtime及SHA256为62d1e02fcb4243d1526da043a41eb77386ca7b1e10611b6a75664a0aef829e71的修正版PowerShell公网验证脚本。\n\n密钥/私有检查在上传前对完整待提交集合执行；当前DeepSeek实钥格式、环境中现有DeepSeek值及证据凭据字段必须为0。只提交精简公开证据，未上传.env、数据目录、构建产物、生成worker/assets.js或完整浏览器/房间档案。源码逐路径SHA256见evidence/source.json。\n\n已有公网报告属于弱ETag修复前，p95=2473.95ms，304样本0，不伪称2秒达标。修复后实际效果由后续独立报告补充，不混改旧报告。\n');
files=[];stageFiles(stage);
const secrets=[process.env.DEEPSEEK_API_KEY,process.env.DEEPSEEK_KEY].filter(v=>typeof v==='string'&&v.length>=16),issues=[];
for(const file of files){const bytes=fs.readFileSync(path.join(stage,file.path)),text=bytes.toString('utf8');if(secrets.some(secret=>bytes.includes(Buffer.from(secret))))issues.push({path:file.path,reason:'existing-process-secret-match'});if(/sk-[a-f0-9]{32}(?![a-f0-9])/i.test(text))issues.push({path:file.path,reason:'current-DeepSeek-key-format'});if(/(?:^|\/)(?:\.env(?:\..*)?|node_modules|data|dist)(?:\/|$)/.test(file.path)||file.path==='online/worker/assets.js')issues.push({path:file.path,reason:'excluded-path'});if(file.path.includes('/docs/evidence/')&&file.path.endsWith('.json')){const value=JSON.parse(text);function scan(obj,p=''){if(!obj||typeof obj!=='object')return;for(const [key,v]of Object.entries(obj)){if(/^(token|agentToken|humanHash|agentHash|authorization|apiKey|headers|cookies)$/i.test(key)&&v!=null&&v!=='')issues.push({path:file.path,reason:'credential-field:'+p+key});scan(v,p+key+'.');}}scan(value);}}
if(issues.length){fs.writeFileSync(path.join(temp,'scan-failure.json'),JSON.stringify(issues,null,2));throw Error('Upload scan rejected '+issues.length+' findings; paths only in local scan-failure.json');}
const byPath=new Map(base.tree.filter(n=>n.type==='blob').map(n=>[n.path,n])),allShas=new Set(base.tree.filter(n=>n.type==='blob').map(n=>n.sha));
files=files.map(file=>({...file,unchanged:byPath.get(file.path)?.sha===file.gitSha,reusable:allShas.has(file.gitSha)}));
const allowed=new Set(files.map(f=>f.path)),deleted=base.tree.filter(n=>n.type==='blob'&&n.path.startsWith('online/')&&!allowed.has(n.path)).map(n=>n.path);
const manifest={stage,repository:base.repository,baseCommit:base.sha,baseTree:base.treeSha,branch:'codex/tavern-v6-20261117',files,deleted,scan:{files:files.length,bytes:files.reduce((sum,f)=>sum+f.size,0),currentDeepSeekKeyFormatMatches:0,existingProcessSecretMatches:0,environmentSecretNeedles:secrets.length,excludedPaths:0,evidenceCredentialFields:0},fixedPowerShellSha256:psHash};
fs.writeFileSync(path.join(temp,'upload-manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({files:files.length,bytes:manifest.scan.bytes,changed:files.filter(f=>!f.unchanged).length,reused:files.filter(f=>f.reusable).length,newBinary:files.filter(f=>f.binary&&!f.reusable).map(f=>({path:f.path,size:f.size})),deleted,scan:manifest.scan,fixedPowerShellSha256:psHash,criticalFiles:files.filter(f=>['online/worker/room-transport.js','online/worker/api.js','online/server/api.js','online/tests/etag-independent.test.mjs','online/public/scene-runtime.js'].includes(f.path)).map(f=>({path:f.path,sha256:f.sha256}))},null,2));
