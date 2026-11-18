# V6仓库同步审计

此分支仅供Draft PR评审，不合并main、不发布。online替换为本轮冻结运行源，根旧Node和demo保留。已包含弱ETag、引用快照、新scene-runtime及SHA256为62d1e02fcb4243d1526da043a41eb77386ca7b1e10611b6a75664a0aef829e71的修正版PowerShell公网验证脚本。

密钥/私有检查在上传前对完整待提交集合执行；当前DeepSeek实钥格式、环境中现有DeepSeek值及证据凭据字段必须为0。只提交精简公开证据，未上传.env、数据目录、构建产物、生成worker/assets.js或完整浏览器/房间档案。源码逐路径SHA256见evidence/source.json。

已有公网报告属于弱ETag修复前，p95=2473.95ms，304样本0，不伪称2秒达标。修复后实际效果由后续独立报告补充，不混改旧报告。
