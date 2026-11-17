# God知识契约独立审查

本审查未修改知识/校验器实现，也未联网或调用模型。源范围：`worker/god-contract.js`、`god-knowledge.js`、`god-retrieval.js`、`god-grounding.js`、`host-messages.js` 与真实engine条目。

## 已验证

`node --test tests/god-independent-review.test.mjs`：28项全部通过。

- 与实际engine逐项核对12行动、3产品、18事件；17个公共事件与E15私有规则区分正确。
- E15文本、玩家私有研究、意图、头像、未公开动作、未来事件和种子哨兵未进入主持输入；猜出E15名称/编号也不能让检索返回其私有卡。
- 各个已结算行动可检索真实行动卡；各产品只取当前产品公开定义。
- 来源包含实际条目ID/规则定位；方法摘要明确为项目转述，未发现伪造书籍页码。

## 独立发现并由知识owner修复

原校验器实际放行了10条错误自然话术：两种串席数值表述、决策期宣布胜利、把传闻说已核实、把预告说已兑现、主持替玩家下单、虚构研究结论、凭指标声称已做调研、借别人的数值编造合计和“均为”关系。

此外，engine真实发布的rumor含事件名称但无eventId，原校验器误拒保留不确定性的正确复述。

已先将可执行反例交给知识owner；owner修改其源码后，原样独立测试10条错误全部被拒、正确rumor可接受。原始probe保存在 `docs/probe-god-independent.mjs` 和 `docs/probe-god-independent-extra.mjs`。

## 证据边界

这证明覆盖门禁和这些已知反例通过回归，不能证明任意中文都有形式化语义蕴含。自然度、相关性、重复性及未见改写仍需以真实DeepSeek留出输出评估；本文件不把fixture当模型证据。

## Focus收敛独立回归

`node --test tests/god-focus-independent.test.mjs`：39项通过。逐个覆盖17公共事件、rumor/forecast、最新世界消息、终局与破产、A01–A12在round2–6的已结算席位轮换、三产品定义隔离与compact payload私有哨兵隔离；确认每次模型payload只有1claim＋1知识，来源保留在服务端完整input。

测试的行动轮换与开场目标使用无world场景，不能据此声称真实累积world下也会轮换。已向总控报告：陈旧world缺少轮次元数据时可能始终压住最新账本；验证ID范围也应采用实际发给模型的compact input，完整input仅用于来源与渲染。
