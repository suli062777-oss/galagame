/** Growth Tavern deterministic engine. Adapted from the user's v0.1 model.
 * Not a real-world business predictor. No LLM can write economic state.
 * Money is settled to integer cents with explicit ROUND_HALF_UP (nonnegative magnitudes).
 */
import { createHash } from 'node:crypto';
export const PRODUCTS = [
  {
    "id": "P01",
    "name": "学习打卡 App",
    "core_behavior": "当周完成至少三次有效学习任务",
    "revenue": "周会员订阅",
    "north_star": "当周完成核心行为的去重主用用户",
    "segments": [
      "备考新手",
      "长期自学者",
      "进阶学习者"
    ],
    "market": [
      1400,
      1600,
      1000
    ],
    "activation": [
      0.28,
      0.42,
      0.48
    ],
    "retention": [
      0.6,
      0.76,
      0.8
    ],
    "pay": [
      0.12,
      0.17,
      0.22
    ],
    "paid_cpc": [
      1.8,
      2.3,
      2.8
    ],
    "organic_cpc": [
      1.4,
      1.8,
      2.2
    ],
    "onboarding_response": [
      1.25,
      0.7,
      0.35
    ],
    "habit_response": [
      0.75,
      1.2,
      0.65
    ],
    "demand_news": "考试时间公布，备考新手开始集中寻找学习工具。",
    "concepts": [
      "K01",
      "K02",
      "K03",
      "K04",
      "K05",
      "K06"
    ]
  },
  {
    "id": "P02",
    "name": "健身习惯 App",
    "core_behavior": "当周完成至少两次计划训练",
    "revenue": "周会员订阅",
    "north_star": "当周完成核心行为的去重主用用户",
    "segments": [
      "健身新手",
      "习惯培养者",
      "规律训练者"
    ],
    "market": [
      1500,
      1500,
      1000
    ],
    "activation": [
      0.3,
      0.36,
      0.5
    ],
    "retention": [
      0.54,
      0.7,
      0.84
    ],
    "pay": [
      0.13,
      0.18,
      0.23
    ],
    "paid_cpc": [
      1.7,
      2.2,
      3.0
    ],
    "organic_cpc": [
      1.5,
      1.7,
      2.4
    ],
    "onboarding_response": [
      1.0,
      0.65,
      0.3
    ],
    "habit_response": [
      1.3,
      1.1,
      0.45
    ],
    "demand_news": "大众运动活动启动，健身新手的尝试意愿上升。",
    "concepts": [
      "K01",
      "K02",
      "K03",
      "K04",
      "K05",
      "K06"
    ]
  },
  {
    "id": "P03",
    "name": "AI 笔记工具",
    "core_behavior": "当周完成一次笔记整理并再次查阅使用",
    "revenue": "周会员订阅",
    "north_star": "当周完成核心行为的去重主用用户",
    "segments": [
      "初次尝试者",
      "日常记录者",
      "深度知识工作者"
    ],
    "market": [
      1300,
      1500,
      1200
    ],
    "activation": [
      0.24,
      0.4,
      0.56
    ],
    "retention": [
      0.58,
      0.74,
      0.86
    ],
    "pay": [
      0.1,
      0.18,
      0.26
    ],
    "paid_cpc": [
      1.8,
      2.6,
      3.2
    ],
    "organic_cpc": [
      1.4,
      1.9,
      2.6
    ],
    "onboarding_response": [
      1.3,
      0.85,
      0.25
    ],
    "habit_response": [
      0.7,
      1.15,
      0.5
    ],
    "demand_news": "新的记录与整理需求出现，初次尝试者进入市场。",
    "concepts": [
      "K01",
      "K02",
      "K03",
      "K04",
      "K05",
      "K06"
    ]
  }
];
export const ACTIONS = [
  {
    "id": "A01",
    "name": "付费获客",
    "cost": 220,
    "scope": "target",
    "effect": "按目标人群的付费获客成本购买接触机会；成本受同轮总投放拥挤度影响",
    "concept": "K02",
    "scales": [
      0.5,
      1.0,
      1.5
    ]
  },
  {
    "id": "A02",
    "name": "内容获客",
    "cost": 160,
    "scope": "target",
    "effect": "内容接触机会一半本轮生效，一半下一轮生效；最后一轮的延后部分不计终局收益",
    "concept": "K02",
    "scales": [
      0.5,
      1.0,
      1.5
    ]
  },
  {
    "id": "A03",
    "name": "用户推荐",
    "cost": 140,
    "scope": "target",
    "effect": "以该公司上轮有效活跃用户数×0.55×投入档位产生目标人群接触机会",
    "concept": "K02",
    "scales": [
      0.5,
      1.0,
      1.5
    ]
  },
  {
    "id": "A04",
    "name": "调整新手引导",
    "cost": 160,
    "scope": "target",
    "effect": "目标人群激活加成增加0.10×隐藏响应×投入档位，累计范围-0.10至0.20；响应可能为负",
    "concept": "K03",
    "scales": [
      0.5,
      1.0,
      1.5
    ]
  },
  {
    "id": "A05",
    "name": "调整习惯机制",
    "cost": 160,
    "scope": "target",
    "effect": "目标人群留存加成增加0.08×隐藏响应×投入档位，累计范围-0.08至0.16；响应可能为负",
    "concept": "K04",
    "scales": [
      0.5,
      1.0,
      1.5
    ]
  },
  {
    "id": "A06",
    "name": "改善核心价值",
    "cost": 200,
    "scope": "all",
    "effect": "所有人群的激活和留存共同加成增加0.025×投入档位，累计上限0.08",
    "concept": "K01",
    "scales": [
      0.5,
      1.0,
      1.5
    ]
  },
  {
    "id": "A07",
    "name": "限时付费试用",
    "cost": 120,
    "scope": "all",
    "effect": "本轮付费概率增加0.05×投入档位，实际单价乘0.75；下一轮本公司付费概率乘0.90",
    "concept": "K05",
    "scales": [
      0.5,
      1.0,
      1.5
    ]
  },
  {
    "id": "A08",
    "name": "提高订阅价格",
    "cost": 20,
    "scope": "all",
    "effect": "价格设为基础价×1.40，付费概率乘0.72，留存率减0.04；覆盖旧定价，持续生效",
    "concept": "K05",
    "scales": [
      1.0
    ]
  },
  {
    "id": "A09",
    "name": "降低订阅价格",
    "cost": 20,
    "scope": "all",
    "effect": "价格设为基础价×0.75，付费概率乘1.22，留存率加0.02；覆盖旧定价，持续生效",
    "concept": "K05",
    "scales": [
      1.0
    ]
  },
  {
    "id": "A10",
    "name": "用户调研",
    "cost": 80,
    "scope": "target",
    "effect": "返回目标人群的引导和习惯响应估计，估计带有误差；仅本公司可见，无直接增长奖励",
    "concept": "K01",
    "scales": [
      1.0
    ]
  },
  {
    "id": "A11",
    "name": "小规模对照实验",
    "cost": 100,
    "scope": "target",
    "effect": "在独立实验样本中比较现有引导和改进引导，每组40人；给出样本数、差值和保守区间；不自动推广",
    "concept": "K06",
    "scales": [
      1.0
    ]
  },
  {
    "id": "A12",
    "name": "等待并观察",
    "cost": 0,
    "scope": "all",
    "effect": "不开展新行动，保留现有产品和定价，正常发生留存、自然接触和经营成本",
    "concept": "K06",
    "scales": [
      1.0
    ]
  }
];
export const EVENTS = [
  {
    "id": "E01",
    "name": "细分人群需求窗口",
    "kind": "external",
    "trigger": "第2回合起的候选池",
    "effect": {
      "target_exposure": 1.25
    },
    "duration": 1,
    "weight": 1,
    "cooldown": 2,
    "concept": "K02",
    "news": "场景中的第一类人群尝试意愿上升，相关接触机会增加。",
    "visibility": "public",
    "compatible_products": [
      "P01",
      "P02",
      "P03"
    ],
    "decision_options": [
      "按原计划执行并承担影响",
      "调整合法行动或目标人群",
      "执行已锁定默认行动；自由输入仍需映射到行动库"
    ],
    "test_requirements": [
      "只按事件编号规定的条件触发",
      "起止回合明确",
      "不得绕过行动次数与预算",
      "同一效果只计入一次"
    ]
  },
  {
    "id": "E02",
    "name": "广告平台涨价",
    "kind": "external",
    "trigger": "第2回合起的候选池",
    "effect": {
      "paid_cost": 1.25
    },
    "duration": 1,
    "weight": 1,
    "cooldown": 2,
    "concept": "K02",
    "news": "广告平台调整收费，本轮付费获客成本上升。",
    "visibility": "public",
    "compatible_products": [
      "P01",
      "P02",
      "P03"
    ],
    "decision_options": [
      "按原计划执行并承担影响",
      "调整合法行动或目标人群",
      "执行已锁定默认行动；自由输入仍需映射到行动库"
    ],
    "test_requirements": [
      "只按事件编号规定的条件触发",
      "起止回合明确",
      "不得绕过行动次数与预算",
      "同一效果只计入一次"
    ]
  },
  {
    "id": "E03",
    "name": "内容渠道机会",
    "kind": "external",
    "trigger": "第2回合起的候选池",
    "effect": {
      "organic": 1.3
    },
    "duration": 1,
    "weight": 1,
    "cooldown": 2,
    "concept": "K02",
    "news": "内容渠道出现新的推荐机会，内容接触量上升。",
    "visibility": "public",
    "compatible_products": [
      "P01",
      "P02",
      "P03"
    ],
    "decision_options": [
      "按原计划执行并承担影响",
      "调整合法行动或目标人群",
      "执行已锁定默认行动；自由输入仍需映射到行动库"
    ],
    "test_requirements": [
      "只按事件编号规定的条件触发",
      "起止回合明确",
      "不得绕过行动次数与预算",
      "同一效果只计入一次"
    ]
  },
  {
    "id": "E04",
    "name": "广告信任下降",
    "kind": "external",
    "trigger": "第2回合起的候选池",
    "effect": {
      "paid_activation": 0.8
    },
    "duration": 1,
    "weight": 1,
    "cooldown": 2,
    "concept": "K03",
    "news": "广告带来的访客更谨慎，付费渠道的首次激活率承压。",
    "visibility": "public",
    "compatible_products": [
      "P01",
      "P02",
      "P03"
    ],
    "decision_options": [
      "按原计划执行并承担影响",
      "调整合法行动或目标人群",
      "执行已锁定默认行动；自由输入仍需映射到行动库"
    ],
    "test_requirements": [
      "只按事件编号规定的条件触发",
      "起止回合明确",
      "不得绕过行动次数与预算",
      "同一效果只计入一次"
    ]
  },
  {
    "id": "E05",
    "name": "使用环境改善",
    "kind": "external",
    "trigger": "第2回合起的候选池",
    "effect": {
      "retention": 0.04
    },
    "duration": 1,
    "weight": 1,
    "cooldown": 2,
    "concept": "K04",
    "news": "用户使用环境改善，本轮更容易维持使用习惯。",
    "visibility": "public",
    "compatible_products": [
      "P01",
      "P02",
      "P03"
    ],
    "decision_options": [
      "按原计划执行并承担影响",
      "调整合法行动或目标人群",
      "执行已锁定默认行动；自由输入仍需映射到行动库"
    ],
    "test_requirements": [
      "只按事件编号规定的条件触发",
      "起止回合明确",
      "不得绕过行动次数与预算",
      "同一效果只计入一次"
    ]
  },
  {
    "id": "E06",
    "name": "订阅疲劳",
    "kind": "external",
    "trigger": "第2回合起的候选池",
    "effect": {
      "pay": 0.8
    },
    "duration": 1,
    "weight": 1,
    "cooldown": 2,
    "concept": "K05",
    "news": "用户开始精简订阅，本轮付费意愿下降。",
    "visibility": "public",
    "compatible_products": [
      "P01",
      "P02",
      "P03"
    ],
    "decision_options": [
      "按原计划执行并承担影响",
      "调整合法行动或目标人群",
      "执行已锁定默认行动；自由输入仍需映射到行动库"
    ],
    "test_requirements": [
      "只按事件编号规定的条件触发",
      "起止回合明确",
      "不得绕过行动次数与预算",
      "同一效果只计入一次"
    ]
  },
  {
    "id": "E07",
    "name": "基础服务涨价",
    "kind": "external",
    "trigger": "第2回合起的候选池",
    "effect": {
      "variable_cost": 1.4
    },
    "duration": 1,
    "weight": 1,
    "cooldown": 2,
    "concept": "K05",
    "news": "基础服务商提高收费，每位活跃用户的服务成本上升。",
    "visibility": "public",
    "compatible_products": [
      "P01",
      "P02",
      "P03"
    ],
    "decision_options": [
      "按原计划执行并承担影响",
      "调整合法行动或目标人群",
      "执行已锁定默认行动；自由输入仍需映射到行动库"
    ],
    "test_requirements": [
      "只按事件编号规定的条件触发",
      "起止回合明确",
      "不得绕过行动次数与预算",
      "同一效果只计入一次"
    ]
  },
  {
    "id": "E08",
    "name": "推荐热潮",
    "kind": "external",
    "trigger": "第2至4回合候选池；后续回合没有预留链事件",
    "effect": {
      "referral": 1.3
    },
    "duration": 2,
    "weight": 1,
    "cooldown": 2,
    "concept": "K02",
    "news": "朋友推荐成为热点，持续两轮；随后进入推荐疲劳期。",
    "follow_up": "E18",
    "follow_delay": 2,
    "visibility": "public",
    "compatible_products": [
      "P01",
      "P02",
      "P03"
    ],
    "decision_options": [
      "按原计划执行并承担影响",
      "调整合法行动或目标人群",
      "执行已锁定默认行动；自由输入仍需映射到行动库"
    ],
    "test_requirements": [
      "只按事件编号规定的条件触发",
      "起止回合明确",
      "不得绕过行动次数与预算",
      "同一效果只计入一次"
    ]
  },
  {
    "id": "E09",
    "name": "价值认知提升",
    "kind": "external",
    "trigger": "第2回合起的候选池",
    "effect": {
      "activation": 0.05
    },
    "duration": 1,
    "weight": 1,
    "cooldown": 2,
    "concept": "K03",
    "news": "用户更熟悉这类产品，首次完成核心行为的阻力下降。",
    "visibility": "public",
    "compatible_products": [
      "P01",
      "P02",
      "P03"
    ],
    "decision_options": [
      "按原计划执行并承担影响",
      "调整合法行动或目标人群",
      "执行已锁定默认行动；自由输入仍需映射到行动库"
    ],
    "test_requirements": [
      "只按事件编号规定的条件触发",
      "起止回合明确",
      "不得绕过行动次数与预算",
      "同一效果只计入一次"
    ]
  },
  {
    "id": "E10",
    "name": "消费收缩",
    "kind": "external",
    "trigger": "第2至5回合候选池",
    "effect": {
      "pay": 0.85
    },
    "duration": 2,
    "weight": 1,
    "cooldown": 2,
    "concept": "K05",
    "news": "消费意愿进入两轮收缩期，各公司需要检查收费策略。",
    "visibility": "public",
    "compatible_products": [
      "P01",
      "P02",
      "P03"
    ],
    "decision_options": [
      "按原计划执行并承担影响",
      "调整合法行动或目标人群",
      "执行已锁定默认行动；自由输入仍需映射到行动库"
    ],
    "test_requirements": [
      "只按事件编号规定的条件触发",
      "起止回合明确",
      "不得绕过行动次数与预算",
      "同一效果只计入一次"
    ]
  },
  {
    "id": "E11",
    "name": "注意力分散",
    "kind": "external",
    "trigger": "第2回合起的候选池",
    "effect": {
      "retention": -0.05
    },
    "duration": 1,
    "weight": 1,
    "cooldown": 2,
    "concept": "K04",
    "news": "新的外部活动分散用户注意力，本轮留存承压。",
    "visibility": "public",
    "compatible_products": [
      "P01",
      "P02",
      "P03"
    ],
    "decision_options": [
      "按原计划执行并承担影响",
      "调整合法行动或目标人群",
      "执行已锁定默认行动；自由输入仍需映射到行动库"
    ],
    "test_requirements": [
      "只按事件编号规定的条件触发",
      "起止回合明确",
      "不得绕过行动次数与预算",
      "同一效果只计入一次"
    ]
  },
  {
    "id": "E12",
    "name": "季节性需求高峰",
    "kind": "external",
    "trigger": "第2至4回合候选池；后续回合没有预留链事件",
    "effect": {
      "target_exposure": 1.4
    },
    "duration": 2,
    "weight": 1,
    "cooldown": 2,
    "concept": "K02",
    "news": "第一类人群迎来两轮需求高峰，之后将回落。",
    "follow_up": "E17",
    "follow_delay": 2,
    "visibility": "public",
    "compatible_products": [
      "P01",
      "P02",
      "P03"
    ],
    "decision_options": [
      "按原计划执行并承担影响",
      "调整合法行动或目标人群",
      "执行已锁定默认行动；自由输入仍需映射到行动库"
    ],
    "test_requirements": [
      "只按事件编号规定的条件触发",
      "起止回合明确",
      "不得绕过行动次数与预算",
      "同一效果只计入一次"
    ]
  },
  {
    "id": "E13",
    "name": "广告渠道拥挤播报",
    "kind": "derived",
    "trigger": "上轮全桌付费投放总额大于600",
    "effect": {},
    "duration": 1,
    "weight": 1,
    "cooldown": 0,
    "concept": "K02",
    "news": "多家公司争夺同一广告渠道，拥挤成本已经计入结算；本新闻不再次涨价。",
    "visibility": "public",
    "compatible_products": [
      "P01",
      "P02",
      "P03"
    ],
    "decision_options": [
      "按原计划执行并承担影响",
      "调整合法行动或目标人群",
      "执行已锁定默认行动；自由输入仍需映射到行动库"
    ],
    "test_requirements": [
      "只按事件编号规定的条件触发",
      "起止回合明确",
      "不得绕过行动次数与预算",
      "同一效果只计入一次"
    ]
  },
  {
    "id": "E14",
    "name": "快速扩张的服务压力",
    "kind": "conditional",
    "trigger": "上轮活跃超过180且较前轮增长超过25%的未破产公司",
    "effect": {
      "local_variable_cost": 1.4
    },
    "duration": 1,
    "weight": 1,
    "cooldown": 2,
    "concept": "K04",
    "news": "部分公司增长超过服务准备速度，本轮承担额外服务成本。",
    "visibility": "public",
    "compatible_products": [
      "P01",
      "P02",
      "P03"
    ],
    "decision_options": [
      "按原计划执行并承担影响",
      "调整合法行动或目标人群",
      "执行已锁定默认行动；自由输入仍需映射到行动库"
    ],
    "test_requirements": [
      "只按事件编号规定的条件触发",
      "起止回合明确",
      "不得绕过行动次数与预算",
      "同一效果只计入一次"
    ]
  },
  {
    "id": "E15",
    "name": "调研结果到账",
    "kind": "derived",
    "trigger": "上轮完成A10的公司",
    "effect": {},
    "duration": 1,
    "weight": 1,
    "cooldown": 0,
    "concept": "K01",
    "news": "调研结果已加入本公司资料；其他公司不能读取。",
    "visibility": "private",
    "compatible_products": [
      "P01",
      "P02",
      "P03"
    ],
    "decision_options": [
      "按原计划执行并承担影响",
      "调整合法行动或目标人群",
      "执行已锁定默认行动；自由输入仍需映射到行动库"
    ],
    "test_requirements": [
      "只按事件编号规定的条件触发",
      "起止回合明确",
      "不得绕过行动次数与预算",
      "同一效果只计入一次"
    ]
  },
  {
    "id": "E16",
    "name": "试用优惠结束",
    "kind": "scheduled_company",
    "trigger": "上轮执行A07的公司",
    "effect": {
      "local_pay": 0.9
    },
    "duration": 1,
    "weight": 1,
    "cooldown": 0,
    "concept": "K05",
    "news": "试用优惠结束，本公司本轮需承受付费回落。",
    "visibility": "public",
    "compatible_products": [
      "P01",
      "P02",
      "P03"
    ],
    "decision_options": [
      "按原计划执行并承担影响",
      "调整合法行动或目标人群",
      "执行已锁定默认行动；自由输入仍需映射到行动库"
    ],
    "test_requirements": [
      "只按事件编号规定的条件触发",
      "起止回合明确",
      "不得绕过行动次数与预算",
      "同一效果只计入一次"
    ]
  },
  {
    "id": "E17",
    "name": "季节性需求回落",
    "kind": "followup",
    "trigger": "E12开始两轮后",
    "effect": {
      "target_exposure": 0.85
    },
    "duration": 1,
    "weight": 1,
    "cooldown": 2,
    "concept": "K02",
    "news": "需求高峰结束，第一类人群接触机会暂时低于常态。",
    "visibility": "public",
    "compatible_products": [
      "P01",
      "P02",
      "P03"
    ],
    "decision_options": [
      "按原计划执行并承担影响",
      "调整合法行动或目标人群",
      "执行已锁定默认行动；自由输入仍需映射到行动库"
    ],
    "test_requirements": [
      "只按事件编号规定的条件触发",
      "起止回合明确",
      "不得绕过行动次数与预算",
      "同一效果只计入一次"
    ]
  },
  {
    "id": "E18",
    "name": "推荐疲劳",
    "kind": "followup",
    "trigger": "E08开始两轮后",
    "effect": {
      "referral": 0.75
    },
    "duration": 1,
    "weight": 1,
    "cooldown": 2,
    "concept": "K04",
    "news": "推荐热潮消退，继续投入推荐渠道的效率下降。",
    "visibility": "public",
    "compatible_products": [
      "P01",
      "P02",
      "P03"
    ],
    "decision_options": [
      "按原计划执行并承担影响",
      "调整合法行动或目标人群",
      "执行已锁定默认行动；自由输入仍需映射到行动库"
    ],
    "test_requirements": [
      "只按事件编号规定的条件触发",
      "起止回合明确",
      "不得绕过行动次数与预算",
      "同一效果只计入一次"
    ]
  }
];

export const RULES = Object.freeze({ version:'growth-1.0.0', rounds:6, players:4, decisionSeconds:45,
  initialCash:1200, initialUsers:450, fixedCost:20, weights:{growth:.50,profit:.35,retention:.15},
  userReference:450, profitReference:1200, scoreWindow:3, moneyPrecision:2,
  ranking:'公开两位小数综合分降序，同分并列；现金小于0破产，永久失去获胜资格；全员破产无胜者',
  model:'群体期望值模拟；有效用户可为小数；并非真实企业预测' });
const actionById=Object.fromEntries(ACTIONS.map(a=>[a.id,a]));
const eventById=Object.fromEntries(EVENTS.map(e=>[e.id,e]));
const negative=new Set(['E02','E04','E06','E07','E10','E11','E17','E18']);
export const WAIT=Object.freeze({id:'A12',target:0,scale:1});
const clone=x=>structuredClone(x);
const sum=a=>a.reduce((s,n)=>s+n,0);
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
export const halfUp=(n,places=2)=>{const m=10**places;return Math.sign(n)*Math.floor(Math.abs(n)*m+1e-9+.5)/m;};
function rng(seed,...parts) {let n=createHash('sha256').update([seed,...parts].join('|')).digest().readUInt32LE(0);return()=>{n=(n+0x6D2B79F5)|0;let t=Math.imul(n^(n>>>15),1|n);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};}
export function normalizeAction(raw,cash=Infinity) {
  if (!raw || typeof raw!=='object' || Array.isArray(raw) || Object.keys(raw).some(k=>!['id','target','scale'].includes(k))) throw new Error('行动字段非法');
  const {id,target=0,scale=1}=raw;
  const def=actionById[id];
  if(!def)throw new Error('未知行动');
  if(!Number.isInteger(target)||target<0||target>2)throw new Error('目标人群必须为0至2');
  if(typeof scale!=='number'||!Number.isFinite(scale)||!def.scales.includes(scale))throw new Error('投入档位非法');
  const cost=halfUp(def.cost*scale);
  if(cost>Math.max(0,halfUp(cash-20)))throw new Error('预算不足，需保留20固定运营费');
  return {id,target,scale};
}
export const actionCost=a=>halfUp(actionById[a.id].cost*a.scale);
function fallback(raw,cash){try{return normalizeAction(raw,cash);}catch{return {...WAIT};}}
function chooseAgenda(seed) {
  const starts=[],pending={},last={},randomHistory=[];
  for(let round=2;round<=6;round++){
    let id=pending[round];
    if(!id){
      const candidates=EVENTS.filter(e=>e.kind==='external'&&round-(last[e.id]??-100)>e.cooldown&&round+e.duration-1<=6&&(!e.follow_up||(round<=4&&!pending[round+e.follow_delay]))&&!(randomHistory.length>=2&&randomHistory.slice(-2).every(x=>negative.has(x))&&negative.has(e.id)));
      id=candidates[Math.floor(rng(seed,'event',round)()*candidates.length)]?.id;
      if(id)randomHistory.push(id);
    }
    if(!id)continue;
    const e=eventById[id];last[id]=round;starts.push({id,start:round,end:round+e.duration-1,targets:[0,1,2,3]});
    if(e.follow_up)pending[round+e.follow_delay]=e.follow_up;
  }
  return starts;
}
export function createGame({seed='default',productId,events=true}={}) {
  const p=PRODUCTS.find(p=>p.id===productId)||PRODUCTS[Math.floor(rng(seed,'product')()*PRODUCTS.length)];
  const factors=[-.5,.1,.65,1,1.35];
  return {ruleVersion:RULES.version,seed:String(seed),productId:p.id,round:0,history:[],useEvents:events,
    agenda:events?chooseAgenda(seed):[],starts:[],world:[],rumors:[],
    hidden:Object.fromEntries(['onboarding_response','habit_response'].map(k=>[k,p[k].map((n,j)=>n*factors[Math.floor(rng(seed,k,j)()*factors.length)])])),
    companies:[0,1,2,3].map(seat=>({seat,cash:1200,profit:0,active:[150,150,150],onboard:[0,0,0],habit:[0,0,0],quality:0,pricing:'normal',bankrupt:false,
      lastActive:450,previousActive:450,lastAction:'A12',pendingContent:[0,0,0],privateNotes:[],history:[],score:0,delta:0,retention:0,contributions:{growth:0,profit:0,retention:0}}))};
}
function world(game,type,text,extra={}){
  game.world.push({id:createHash('sha256').update(`${game.seed}|message|${game.world.length}`).digest('hex').slice(0,14),round:game.round,type,text,...extra});
}
function addEvent(game,id,targets=[0,1,2,3]){
  const e=eventById[id],entry={id,start:game.round,end:game.round+e.duration-1,targets};game.starts.push(entry);
  if(e.visibility==='public')world(game,'fact',`${e.name}：${e.news}`,{eventId:id,targets,effect:clone(e.effect),endRound:entry.end,concept:e.concept});
}
export function beginRound(game) {
  if(game.round!==game.history.length||game.round>=6)throw new Error('回合状态错误');
  game.round++;
  for(const claim of game.rumors.filter(r=>r.due===game.round)){
    world(game,'verification',`核验「${claim.text}」：${claim.truth?'与本轮实际事件一致':'未发生，传闻不成立'}。`,{claimId:claim.id,verified:claim.truth});
  }
  const start=game.agenda.find(e=>e.start===game.round);if(start)addEvent(game,start.id);
  const previous=game.history.at(-1);
  if(previous?.totalPaidSpend>600)addEvent(game,'E13');
  const pressure=game.companies.filter(c=>!c.bankrupt&&c.lastActive>180&&c.lastActive>1.25*Math.max(1,c.previousActive)).map(c=>c.seat);
  if(game.useEvents&&pressure.length&&game.round-(game.starts.filter(e=>e.id==='E14').at(-1)?.start??-100)>2)addEvent(game,'E14',pressure);
  const trial=game.companies.filter(c=>!c.bankrupt&&c.lastAction==='A07').map(c=>c.seat);if(trial.length)addEvent(game,'E16',trial);
  for(const e of game.starts.filter(e=>e.start===game.round&&eventById[e.id].follow_up))world(game,'forecast',`${eventById[e.id].name}将持续到第${e.end}轮；第${e.start+2}轮有已知后续影响。`,{dueRound:e.start+2});
  if(game.round===1)world(game,'fact','四家公司拥有相同起点：1200现金、450有效用户。本局六周，经营公式已冻结。');
  if(game.round<6){
    const next=game.agenda.find(e=>e.start===game.round+1);
    const possible=EVENTS.filter(e=>e.kind==='external'&&e.id!==next?.id);
    const truthful=rng(game.seed,'rumorTruth',game.round)()<.5;
    const rumored=truthful&&next?eventById[next.id]:possible[Math.floor(rng(game.seed,'rumorChoice',game.round)()*possible.length)];
    const text=`下一轮可能出现「${rumored.name}」`;
    world(game,'rumor',`${text}。消息尚未核实，不保证成真。`);
    const id=game.world.at(-1).id;game.rumors.push({id,text,due:game.round+1,truth:rumored.id===next?.id});
  }
}
function effects(game,seat) {
  const v={paid_cost:1,organic:1,paid_activation:1,retention:0,pay:1,variable_cost:1,referral:1,activation:0,target_exposure:1,local_variable_cost:1,local_pay:1};
  for(const start of game.starts)if(start.start<=game.round&&start.end>=game.round&&start.targets.includes(seat))for(const [k,n]of Object.entries(eventById[start.id].effect))v[k]=['retention','activation'].includes(k)?v[k]+n:v[k]*n;
  v.retention=clamp(v.retention,-.06,.06);v.target_exposure=clamp(v.target_exposure,.6,1.5);return v;
}
function wilson(success,n){const z=1.96,p=success/n,den=1+z*z/n,mid=(p+z*z/(2*n))/den,half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;return[mid-half,mid+half];}
export function scoreCompany(company) {
  const recent=company.history.slice(-3);if(!recent.length)return{score:0,retention:0,contributions:{growth:0,profit:0,retention:0},inputs:{users:450,profit:0,retained:0,previousUsers:0}};
  for(const d of recent)if(![d.users,d.previousUsers,d.retained].every(Number.isFinite)||d.users<0||d.previousUsers<0||d.retained<0||d.retained>d.previousUsers+1e-7)throw new Error('计分数据缺失或越界');
  if(!Number.isFinite(company.profit))throw new Error('利润非法');
  const users=sum(recent.map(d=>d.users))/recent.length,den=sum(recent.map(d=>d.previousUsers)),retained=sum(recent.map(d=>d.retained)),retention=den?retained/den:0;
  const contributions={growth:500*users/(users+450),profit:350*(.5+.5*company.profit/(Math.abs(company.profit)+1200)),retention:150*retention};
  return{score:company.bankrupt?0:halfUp(sum(Object.values(contributions))),retention,contributions,inputs:{users,profit:company.profit,retained,previousUsers:den}};
}
export function rankings(game){
  const ordered=game.companies.map(c=>({seat:c.seat,score:c.score,bankrupt:c.bankrupt})).sort((a,b)=>b.score-a.score);
  let prev=null,rank=0;ordered.forEach((r,i)=>{if(r.score!==prev)rank=i+1;r.rank=rank;prev=r.score;});
  const alive=ordered.filter(r=>!r.bankrupt),best=alive[0]?.score;return{rows:ordered,winners:alive.filter(r=>r.score===best).map(r=>r.seat),allBankrupt:!alive.length};
}
export function settle(game,submitted) {
  if(game.round!==game.history.length+1||submitted.length!==4)throw new Error('回合未开启或已经结算');
  const p=PRODUCTS.find(p=>p.id===game.productId),locked=submitted.map((a,i)=>game.companies[i].bankrupt?{...WAIT}:fallback(a,game.companies[i].cash));
  const totalPaidSpend=sum(locked.filter(a=>a.id==='A01').map(actionCost)),details=[],retained=[],requests=[];
  for(let i=0;i<4;i++){
    const c=game.companies[i],a=locked[i],t=a.target,s=a.scale,f=effects(game,i),old=clone(c.active),oldTotal=sum(old),cost=c.bankrupt?0:actionCost(a);
    let trialBoost=0,trialPrice=1;
    if(!c.bankrupt){
      if(a.id==='A04')c.onboard[t]=clamp(c.onboard[t]+.1*game.hidden.onboarding_response[t]*s,-.1,.2);
      if(a.id==='A05')c.habit[t]=clamp(c.habit[t]+.08*game.hidden.habit_response[t]*s,-.08,.16);
      if(a.id==='A06')c.quality=Math.min(.08,c.quality+.025*s);
      if(a.id==='A07'){trialBoost=.05*s;trialPrice=.75;}
      if(a.id==='A08')c.pricing='high';if(a.id==='A09')c.pricing='low';
      if(a.id==='A10'){
        const r=rng(game.seed,'interview',game.round,i,t);
        c.privateNotes.push({round:game.round,type:'research',target:t,text:'访谈估计含±0.35抽样误差，不是因果结论。',onboarding:game.hidden.onboarding_response[t]+r()*.7-.35,habit:game.hidden.habit_response[t]+r()*.7-.35});
      }
    }
    const [price,payPrice,retPrice]={normal:[1,1,0],high:[1.4,.72,-.04],low:[.75,1.22,.02]}[c.pricing];
    const act=p.activation.map((v,j)=>clamp(v+c.onboard[j]+c.quality+f.activation,.05,.9));
    const ret=p.retention.map((v,j)=>clamp(v+c.habit[j]+c.quality+retPrice+f.retention,.05,.95));
    const pay=p.pay.map(v=>clamp((v+trialBoost)*payPrice*f.pay*f.local_pay,.01,.85));
    if(a.id==='A11'&&!c.bankrupt){
      const r=rng(game.seed,'experiment',game.round,i,t),candidate=clamp(p.activation[t]+clamp(c.onboard[t]+.1*game.hidden.onboarding_response[t],-.1,.2)+c.quality+f.activation,.05,.9);
      let ctrl=0,treat=0;for(let j=0;j<40;j++)ctrl+=r()<act[t]?1:0;for(let j=0;j<40;j++)treat+=r()<candidate?1:0;
      const [lc,uc]=wilson(ctrl,40),[lt,ut]=wilson(treat,40),interval=[lt-uc,ut-lc];
      c.privateNotes.push({round:game.round,type:'experiment',target:t,controlN:40,treatmentN:40,controlSuccess:ctrl,treatmentSuccess:treat,difference:(treat-ctrl)/40,interval,verdict:interval[0]>0?'支持改善':interval[1]<0?'支持下降':'证据不足',text:'独立面板不计用户或收入；未自动部署改动。'});
    }
    const organic=clone(c.pendingContent),paid=[0,0,0],referral=[0,0,0];c.pendingContent=[0,0,0];
    const adFactor=Math.min(1.6,(1+totalPaidSpend/700)*f.paid_cost);
    if(a.id==='A01')paid[t]=cost/(p.paid_cpc[t]*adFactor);
    if(a.id==='A02'){const raw=cost/p.organic_cpc[t];organic[t]+=raw*.5;c.pendingContent[t]=raw*.5;}
    if(a.id==='A03')referral[t]=oldTotal*.55*s;
    const rr=[],qq=[],visitors=[];
    for(let j=0;j<3;j++){
      const exposure=j===0?f.target_exposure:1,natural=10*exposure,pv=paid[j]*exposure,ov=organic[j]*f.organic*exposure,rv=referral[j]*f.referral*exposure;
      rr.push(c.bankrupt?0:old[j]*ret[j]);qq.push(c.bankrupt?0:(natural+ov+rv)*act[j]+pv*clamp(act[j]*f.paid_activation,.05,.9));visitors.push(c.bankrupt?0:natural+pv+ov+rv);
    }
    retained.push(rr);requests.push(qq);details.push({seat:i,action:a,cashBefore:c.cash,previousUsers:oldTotal,actionCost:cost,effects:f,activationRates:act,retentionRates:ret,payRates:pay,visitors,activationRequests:qq,retainedBySegment:rr,price:8*price*trialPrice,adCostFactor:adFactor});
  }
  const added=game.companies.map(()=>[0,0,0]);
  for(let j=0;j<3;j++){
    const available=Math.max(0,p.market[j]-sum(retained.map(x=>x[j]))),total=sum(requests.map(x=>x[j])),ratio=total?Math.min(1,available/total):1;
    for(let i=0;i<4;i++)added[i][j]=requests[i][j]*ratio;
  }
  for(let i=0;i<4;i++){
    const c=game.companies[i],d=details[i],wasBankrupt=c.bankrupt,active=retained[i].map((n,j)=>n+added[i][j]),total=sum(active),paying=sum(active.map((n,j)=>n*d.payRates[j]));
    const revenue=halfUp(paying*d.price),operations=wasBankrupt?0:halfUp(20+.25*total*d.effects.variable_cost*d.effects.local_variable_cost),net=halfUp(revenue-operations-d.actionCost);
    c.cash=halfUp(c.cash+net);c.profit=halfUp(c.profit+net);c.previousActive=c.lastActive;c.lastActive=total;c.lastAction=d.action.id;
    c.bankrupt=wasBankrupt||c.cash<0;c.active=c.bankrupt?[0,0,0]:active;
    Object.assign(d,{round:game.round,newActive:added[i],activeBySegment:clone(c.active),users:sum(c.active),retained:sum(retained[i]),paying,revenue,operations,net,cash:c.cash,profit:c.profit,bankrupt:c.bankrupt});
    c.history.push(clone(d));const oldScore=c.score;Object.assign(c,scoreCompany(c));c.delta=halfUp(c.score-oldScore);
    Object.assign(d,{score:c.score,delta:c.delta,retention:c.retention,contributions:clone(c.contributions),scoreInputs:clone(c.inputs)});
  }
  const log={round:game.round,totalPaidSpend,players:details,events:clone(game.starts.filter(e=>e.start===game.round)),marketTotals:p.market.map((_,j)=>sum(game.companies.map(c=>c.active[j])))};
  game.history.push(log);assertInvariants(game);
  const leaders=rankings(game).rows.filter(r=>!r.bankrupt&&r.rank===1);world(game,'fact',`第${game.round}周结算完成。${leaders.length>1?'当前最高分并列':'当前最高分'} ${leaders[0]?.score.toFixed(2)??'0.00'}；完整账本已保存。`);
  return log;
}
export function assertInvariants(game){
  const p=PRODUCTS.find(p=>p.id===game.productId);
  for(let j=0;j<3;j++)if(sum(game.companies.map(c=>c.active[j]))>p.market[j]+1e-6)throw new Error('市场超发');
  for(const c of game.companies){
    if(c.active.some(n=>n<0||!Number.isFinite(n))||Math.abs(c.cash-1200-c.profit)>.001||c.bankrupt&&sum(c.active)!==0)throw new Error('经营不变量失败');
    const d=c.history.at(-1);if(d&&(halfUp(d.cashBefore+d.revenue-d.operations-d.actionCost)!==c.cash||d.paying>sum(d.activeBySegment)+1e-6&&!c.bankrupt))throw new Error('账目不一致');
  }
}
export function scriptAction(game,seat){
  const c=game.companies[seat],r=game.round,p=PRODUCTS.find(p=>p.id===game.productId);
  const target=p.activation.map((v,j)=>v*p.retention[j]/p.organic_cpc[j]).reduce((best,v,j,a)=>v>a[best]?j:best,0);
  let id=seat===1?(r%2===0?'A03':'A02'):seat===2?({1:'A06',2:'A05',3:'A02',4:'A05',5:'A02',6:'A03'}[r]):({1:'A10',2:'A11',3:'A02',4:'A03',5:'A08',6:'A03'}[r]);
  return fallback({id,target,scale:1},c.cash);
}
export function publicProduct(game){const p=PRODUCTS.find(p=>p.id===game.productId);return{id:p.id,name:p.name,coreBehavior:p.core_behavior,northStar:p.north_star,segments:clone(p.segments),market:clone(p.market),baseline:{activation:clone(p.activation),retention:clone(p.retention),pay:clone(p.pay),paidCpc:clone(p.paid_cpc),contentCpc:clone(p.organic_cpc)}};}
export function replayGame(game){
  const replay=createGame({seed:game.seed,productId:game.productId,events:game.useEvents});
  for(const round of game.history){beginRound(replay);settle(replay,round.players.map(p=>p.action));}
  return {game:replay,verified:JSON.stringify(replay.history)===JSON.stringify(game.history)};
}
