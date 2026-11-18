# 当前本地工作存档 · 2026-11-18

用户要求先上传 Git 存档，后续改进不满意时能够恢复。本记录区分已发布的改进前基线与当前本地工作，防止混用。

| 存档 | 固定标签 | 内容 |
| --- | --- | --- |
| 改进前线上 V8 | `baseline-v8-20261118` | 已发布版本8的完整源码、当时开发源码、评审和回退说明；提交 `cbcc8cc25df89189cc644f1f5263e404adec5d40` |
| 当前本地工作 | `checkpoint-classroom-20261118` | 本次提交中的 `online/`，包括当前尚未发布的课堂体验工作、素材、测试及品审证据 |

仓库：<https://github.com/suli062777-oss/galagame>

当前工作分支：`codex/classroom-experience-20261118`。`published/` 与 `baseline/` 保持原始基线，原固定标签与存档分支没有移动。本次操作只做 Git 存档，不发布网站，也不执行回退。

## 完整性检查

`manifest.json` 列出当前 `online/` 纳入 Git 的每个文件的字节数与 SHA-256。不包含依赖、运行时数据、环境密钥和可重新构建的输出。`validation.json` 记录存档前的检查；Git 提交后还需逐文件核对 Git blob 与清单，并确认远端分支、标签指向同一提交。

本地已有最终测试记录：`online/docs/evidence/classroom-20261118/final-tests.txt`，173 项通过、0 项失败；这是当前工作原有的验证记录，本次存档没有重新执行功能测试。

## 后续恢复

先保存之后的工作，再从所需标签创建新的恢复分支或独立 worktree，避免覆盖未提交内容。以下命令在本仓库检出中执行，示例目标目录必须尚不存在：

```powershell
git fetch origin --tags
git worktree add -b codex/restore-baseline-v8 ../restore-baseline-v8 baseline-v8-20261118
```

需要恢复当前本地工作时，将上例的分支名、目标目录另取新名，并使用 `checkpoint-classroom-20261118` 标签。

线上回到 V8 的操作与保存版本标识见 `baseline/ROLLBACK.md`。Git 恢复源码不会自动改变线上站点；该档不包含玩家数据快照。
