# 回退基线：baseline-v8-20261118

日期：2026-11-18（北京时间）。GitHub仓库：suli062777-oss/galagame。
存档分支：`codex/archive-pre-improvement-20261118`。用户允许先存档，后续改进不满意时回到这档；本次没有执行回退或新改进。

## 本地回到该档

先提交或另存改进中的工作，再从此标签创建恢复分支。以下命令在此GitHub仓库的检出中执行：

```powershell
git fetch origin --tags
git switch -c codex/restore-baseline-v8 baseline-v8-20261118
```

`online/`为当时开发源码，`published/`为当时线上源码。后续改进应新建独立分支，保留存档分支与标签不移动。不需要使用reset --hard或强制推送即可回看/恢复。

## 线上回到已保存版本8

站点：`appgprj_6af1a8e67e188191ae760465531b894b`
已保存版本：8
version_id：`appgprj_6af1a8e67e188191ae760465531b894b~appgver_129701012af4819191401d519cb1971a`
来源提交：`1b1d0b98d15b2321f5c5e668ceda6fce82a2c5d3`
已成功部署记录：`appgdep_6afcaef19cdc81918dedd43ea67cc698`

用户要求回退时，优先通过Sites将这个已保存版本重新部署到原站点，并检查最终部署状态。它能恢复版本8的页面/Worker；不重建站点，不改变访问范围、D1或Secret，不把Git检出当成线上已经回退。

如需从Git重建，使用 `published/` 的完整源码与原站点ID，经原有构建、存版、发布流程完成。旧Node本地API与线上Worker配置应分别核验；不得因为本档带构建输出就跳过来源匹配检查。

## 此档包含什么

- 现有可运行产品与版本8首页按钮调整。
- 本地Node API传输修复与对应测试。
- 本次完整评审、参考、截图、交互结构示意。
- 冻结文件的SHA256及Git blob清单。

不包含玩家房间快照和密钥；真实用户数据迁移或数据库回滚需要独立方案。后续产品改进先验证，再发布；不覆盖此回退点。
