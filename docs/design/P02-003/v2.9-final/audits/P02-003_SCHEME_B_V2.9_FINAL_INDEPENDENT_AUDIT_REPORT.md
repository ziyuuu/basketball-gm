# P02-003 Headless Model B v2.9 最终独立审核报告

- 审核日期：2026-08-03
- 审核身份：P02-003 Headless Model B 独立玩法设计审核人
- 审核对象：`18c0b626-349f-4195-b4a3-c37543dc8456.zip`
- 压缩包 SHA-256：`9a21023e1abd302caf8e2f8b218823093a66e2b80864b7c4c2079a78e9db397c`
- 文档版本：方案 B v2.9
- 文档规模：14 个 Markdown 文件，共 2,595 行、约 198,760 字节正文
- 对照前次复审：`P02-003_SCHEME_B_V2.8_INDEPENDENT_REAUDIT_REPORT.md`
- 仓库合同基线：`ziyuuu/basketball-gm@45dc1a261172ebfff46f30b122cbdf5621596959`
- 最终评分：**95/100**
- 最终决定：**READY FOR DEVELOPMENT**

> 本报告只判断设计是否已经达到“开发线程无需自行发明比赛状态机、行为分类、参与者选择、随机坐标和 Event/Fact/Statistic 因果链”的标准。审核未修改设计、补写玩法、编写开发方案或替代 Owner 审批。

# Executive Summary

v2.9 已经实质关闭 v2.8 的全部两项 BLOCKING：

1. PASS、HPASS、CREATIVE_PASS、ASTOPP、HELDKICK 全文统一为唯一一次 `TURNOVER_OCCURRENCE` 失败判定；
2. BOXOUT 全文统一为 `RULE_RESULT`，不参加 `P_select`、没有 `behaviorSelectionOrdinal`、不调用独立 actor draw，其 boxer 由 REBOUND 解析确定性派生。

同时，上一轮指出的分类计数错误已经修正：

```text
6 SELECTABLE_DETERMINISTIC
+ 28 SELECTABLE_ONE_DRAW
= 34 selectable

9 RULE_RESULT
+ 1 ATTRIBUTION_ONLY
= 10 non-selectable

34 + 10 = 44
```

机器核验结果：

```text
BehaviorMatrixUniqueIds == ClassificationRegistryIds
size == 44
missing == []
extra == []

SelectableRegistryIds == ClassificationSelectableIds
size == 34
missing == []
extra == []
```

当前设计已经冻结并形成唯一实现路径的内容包括：

- 比赛状态机与球权流转；
- 第 2～4 节和加时首球权；
- 30 秒进攻时间及事件重建；
- 44 个 Behavior ID 的唯一分类；
- 行为选择、执行和后续规则判定；
- 10 项能力、6 项倾向及角色差异；
- keyed RNG drawKind 与 semantic localIndex；
- receiver、beneficiary、actor 和防守参与者选择；
- 投篮、罚球、篮板、失误、犯规、助攻、抢断和封盖；
- MatchEvent、MatchFact 和 Statistic reducer 因果链；
- team rebound/team turnover 简化口径；
- step、runToEnd 和 replay 的确定性要求；
- Gate B 的方向场景、反例和性能要求。

开发线程已经不需要自行选择另一套篮球规则、随机调用顺序或事件合同。

因此，最终决定为：

# READY FOR DEVELOPMENT

# Reviewed Materials

已逐文件读取：

1. `00_SOURCE_REGISTER.md`
2. `00b_REVISION_RESPONSE.md`
3. `00c_RE_AUDIT_SUMMARY.md`
4. `01_EXTERNAL_RESEARCH.md`
5. `02_FROZEN_DECISIONS.md`
6. `03_HEADLESS_MODEL_B_NORMATIVE_DESIGN.md`
7. `04_BEHAVIOR_ATTRIBUTE_MATRIX.md`
8. `05_PROBABILITY_AND_PARAMETER_REGISTRY.md`
9. `06_EVENT_STAT_FACT_MATRIX.md`
10. `07_BALANCE_AND_REALISM_REGISTRY.md`
11. `08_P02-002_TRACEABILITY.md`
12. `09_CONTRACT_GAPS.md`
13. `10_REVIEW_REPORT.md`
14. `11_OWNER_APPROVAL_CHECKLIST.md`

同时复核：

- `docs/P02_GAMEPLAY_BASELINE.md` v1.2；
- `docs/P02_DEVELOPMENT_PLAN.md` v1.2；
- P02-002 MatchInput、MatchAnchor、MatchEvent、MatchFact 和 MatchResultDraft；
- P02-002 闭合 drawKind/EventType；
- v2.8 独立审核提出的 Required Resubmission Evidence。

# Scoring

| 审核维度 | 权重 | v2.8 | v2.9 | 独立审核结论 |
|---|---:|---:|---:|---|
| 权威来源与合同忠实度 | 10 | 9 | 9 | PASS；仅剩非阻塞措辞清理 |
| 范围控制 | 5 | 5 | 5 | PASS |
| 比赛规则与状态机 | 15 | 15 | 15 | PASS |
| 行为合同与篮球真实性 | 15 | 13 | 15 | PASS |
| 属性、倾向与角色差异 | 12 | 11 | 12 | PASS |
| 概率与参数模型 | 15 | 13 | 14 | PASS WITH CALIBRATION |
| 确定性与 P02-002 兼容 | 12 | 10 | 12 | PASS |
| Event / Fact / Statistic | 10 | 9 | 10 | PASS |
| 平衡、反例与可验证性 | 6 | 6 | 3 | PASS；实测留给 Gate B |
| **总分** | **100** | **91** | **95** | **READY FOR DEVELOPMENT** |

“平衡、反例与可验证性”未给满分，不代表设计不完整，而是方向结果必须由 P02-003 实现后的 64-seed 场景和 10,000 场性能 Gate 验证，不能由设计文档预先宣称通过。

# Authority Check

## 结论

**PASS**

- P02-002 合同基线与当前仓库主线一致；
- 未扩展 MatchInput；
- 未扩展 Player Schema；
- 未扩展 Save Schema；
- 未增加 drawKind；
- 未增加 MatchEventType；
- 未引入 P02-004+；
- 未引入生产 UI、卡牌、LLM、DDA 或 OVR；
- `05 §C.10` 是当前唯一 Behavior Classification Registry；
- Event/Fact/Statistic 继续使用 P02-002 的闭合容器和身份链。

# Review 1 — Scope

## 结论

**PASS**

未混入：

- P02-004 GameState/Save V2；
- P02-005 训练和成长；
- P02-006 产品助教轮换；
- P02-009 玩家临场命令实现；
- UI、2D、卡牌；
- LLM 或 Agent。

中性轮换继续限定为 `internal/test`。

# Review 2 — Basketball Reality

## 结论

**PASS**

设计已经覆盖：

- 4×10 分钟；
- 正式赛/友谊赛加时；
- 队内赛允许平局；
- 第 2～4 节交替球权；
- 开场和加时确定性首球权；
- 30 秒进攻时钟；
- ORB 后 20 秒；
- 5 犯离场；
- 2～4 人继续；
- 少于 2 人规则性失败；
- 得分、罚球、篮板、失误和犯规；
- 突破、后撤步、急停、抛投、对抗终结；
- 高位组织、掩护、空切和突破分球；
- 单防、压迫、协防、包夹、抢断和封盖；
- 进攻篮板、防守篮板和球队篮板事实；
- 正确的盖帽出界球权归属。

开发线程不需要再发明基础篮球流转规则。

# Review 3 — Attribute Audit

## 结论

**PASS**

| 属性 | 不可替代作用 | 结论 |
|---|---|---|
| finishing | 篮下及对抗终结 | PASS |
| shooting | 中投、三分、罚球 | PASS |
| ballHandling | 护球、突破、脚步创造 | PASS |
| playmaking | 传球、助攻、高位组织 | PASS |
| perimeterDefense | 外线压力、干扰、抢断归因 | PASS |
| interiorDefense | 护框、低位、防守归因 | PASS |
| rebounding | 篮板争抢 | PASS |
| athleticism | 到位、爆发、协防修正 | PASS；不是万能身体属性 |
| stamina | 疲劳增长 | PASS；不直接加命中 |
| tacticalUnderstanding | 团队执行和行为稳定 | PASS；不直接提升所有概率 |

以下历史问题已经关闭：

- shooting 不再替代 STEP_BACK 创造；
- finishing 不再同时承担 POSTUP 创建和终结；
- athleticism 不直接制造投篮能力；
- tacticalUnderstanding 不进入所有概率；
- fatigue 只通过执行减点进入；
- chemistry 只进入团队相关场景。

# Review 4 — Game Experience

## 结论

**PASS**

设计能够产生：

- 得分核心；
- 3D 后卫；
- 组织后卫；
- 策应中锋；
- 防守专家；
- 后撤步得分手；
- 内线终结者。

同能力、不同倾向能够产生不同打法：

- possessionParticipation 控制球权参与；
- passSelection 控制传球和自行处理；
- shotZones 控制射区；
- transitionParticipation 控制转换参与；
- defensiveRisk 控制稳守/冒险；
- offensiveRebounding 控制冲抢参与。

不存在：

- OVR 直接倍率；
- 隐藏胜率；
- DDA；
- 星级直接比赛加成。

# Review 5 — Behavior Registry

## 结论

**PASS**

### 44 ID 集合

机器核验：

```text
04 Behavior Matrix：
45 行记录
44 个唯一 Behavior ID
HELDKICK 因同时属于“传球表达”和“关键无球结果”出现两次，但 ID 去重后为 44

05 §C.10：
44 行
44 个唯一 Behavior ID
无重复

集合：
missing = []
extra = []
```

### 分类

```text
SELECTABLE_DETERMINISTIC = 6
SELECTABLE_ONE_DRAW      = 28
RULE_RESULT              = 9
ATTRIBUTION_ONLY         = 1
```

分类和 `selectable` 字段完全一致：

```text
34 selectable
10 non-selectable
44 total
```

### 关键身份

- ORB / DRB / BOXOUT：RULE_RESULT；
- BLK：ATTRIBUTION_ONLY；
- PASS / HPASS / CREATIVE_PASS / ASTOPP / HELDKICK：SELECTABLE_ONE_DRAW；
- SCREEN / CUT / DOUBLECREATE：独立 off-ball execution draw；
- STLTRY / CONTEST：SELECTABLE_DETERMINISTIC；
- PUTBACK：ORB 后规则结果。

行为分类已足够直接转成 TypeScript 判别联合或常量 Registry。

# Review 6 — PASS Chain

## 结论

**PASS**

五类传球全文统一：

```text
PASS
HPASS
CREATIVE_PASS
ASTOPP
HELDKICK
```

唯一失败链：

```text
TURNOVER_OCCURRENCE draw
  未发生 → 传球成功
  发生   → PASSTOV
```

已确认：

- 不再调用独立 `BEHAVIOR` success draw；
- HELDKICK 已从 off-ball execution ordinal 移除；
- HPASS/ASTOPP 已从 deterministic 行为移除；
- 实际 turnover 概率等于 C.1 的 `p`，不是 `p²`；
- 不存在“传球失败但未 turnover”的悬空状态；
- 成功 receiver 立即成为当前 handler；
- 同一球权最后一次合法传球可以被助攻归因恢复。

v2.8 的 V28-01 已关闭。

# Review 7 — BOXOUT Contract

## 结论

**PASS**

BOXOUT 唯一身份：

```text
classification = RULE_RESULT
selectable = false
behaviorSelectionOrdinal = none
actor draw = none
independent Event/Fact = none
```

boxer 唯一派生规则：

```text
投篮不中进入 REBOUND 解析
→ 在同侧合法争抢候选（非持球者）中
→ 按个人篮板执行降序
→ 并列按 playerId UTF-16 稳定排序
→ 第一名为 boxer
```

BOXOUT 已从以下系统移除：

- `P_select`；
- `BALL_HANDLER 3000+` actor draw；
- 防守行为选择 ordinal；
- `06 §F.3` 随机 actor 列表。

该规则不再要求不存在的 behaviorSelectionOrdinal。v2.8 的 V28-02 已关闭。

# Review 8 — Determinism and RNG

## 结论

**PASS**

已冻结的 semantic ordinal 区间：

| drawKind | 语义 |
|---|---|
| BEHAVIOR 0..999 | 行为选择 |
| BEHAVIOR 1000..1999 | 创建行为结果 |
| BEHAVIOR 3000..3999 | SCREEN/CUT/DOUBLECREATE 执行 |
| BALL_HANDLER 0 | 首段球队 |
| BALL_HANDLER 1..999 | 持球者 |
| BALL_HANDLER 2000..2999 | receiver/beneficiary |
| BALL_HANDLER 3000..3999 | 多参与者 actor |
| DEFENSIVE_ACTION 0..99 | 稳守/冒险模式 |
| DEFENSIVE_ACTION 1000..1999 | 防守行为执行 |
| TURNOVER_OCCURRENCE 2000..2999 | 按行为实例的失误 |
| OFFENSIVE_FOUL 4000+selection | 按行为实例的进攻犯规 |
| DEFENSIVE_FOUL 5000+selection | 按行为实例的防守犯规 |
| SHOT 5000..5999 | 罚球 |

已满足：

- 分支少一次抽取不移动其他语义键；
- UI、日志、Fact 和 cosmetic 不消费结果 RNG；
- 候选数组稳定排序；
- receiver、actor、犯规和失误绑定行为实例；
- step / runToEnd / replay 可使用相同坐标重放。

# Review 9 — Event / Fact / Statistic

## 结论

**PASS**

- box score 只从 Event reducer 累积；
- 不允许终场补随机数；
- ASSIST 只在后续 made SHOT 后产生；
- STEAL 只来自 PRESSURED_LIVE_BALL turnover；
- BLOCK 只在 missed SHOT 后归因；
- FOUL_TYPE 只在犯规发生后分类；
- HELPD/DOUBLET 不绕过规则直接产生 TURNOVER/FOUL；
- CreationFact 和 PossessionHandlerFact 的顶层/payload 分层正确；
- team rebound/team turnover 通过现有 Event + MatchFact 表达；
- receiver 成功后立即成为 handler；
- sourceEventIds 使用 MatchFact 顶层字段；
- Event、Fact、Anchor 和 Result 继续服从 P02-002 身份链。

# Contract Gap Assessment

## 结论

**PASS**

没有无理由扩大：

- MatchInput；
- Player Schema；
- Save Schema；
- MatchEventType；
- MatchDrawKind。

已采用的最小表达：

- shotClock：从事件前缀重建；
- shot-clock violation：现有 TURNOVER；
- Creation Fact：现有 MatchFact payload；
- team rebound：EXPLANATION fact；
- team turnover：现有 player-bound TURNOVER 简化口径；
- BOXOUT：REBOUND resolver 内部规则结果。

# Counterexample Audit

| # | 反例 | 最终结论 |
|---:|---|---|
| 1 | 低 shooting + 高 athleticism 成为射手 | PASS |
| 2 | 组织型中锋成立 | PASS |
| 3 | 3D 后卫抢全部球权 | PASS方向；由倾向约束 |
| 4 | 多核心可观察 | PASS；由 PossessionHandlerFact 支持 |
| 5 | 花式传球风险收益 | PASS |
| 6 | 疲劳只影响执行 | PASS |
| 7 | 高星不是作弊 | PASS |
| 8 | 三星仍有价值 | PASS WITH CALIBRATION |
| 9 | 无限传球自然终止 | PASS |
| 10 | 进攻时间归零 | PASS |
| 11 | HELDKICK 两阶段失败 | PASS：已删除 |
| 12 | HPASS/ASTOPP 无失误 | PASS：已删除 deterministic 旧定义 |
| 13 | BOXOUT 进入 P_select | PASS：禁止 |
| 14 | BOXOUT 使用不存在 ordinal | PASS：无 actor draw |
| 15 | 44 ID 集合与计数 | PASS |

# Non-Blocking Issues

以下事项不阻止进入开发，但应在设计文档入库或首个实现候选前清理：

## N01 — F-33 表述应引用四类分类

`02 F-33` 仍以概括语气写“每个行为一次 keyed RNG”，而 `F-35b` 已明确 deterministic / rule-result / attribution-only 例外。

建议将 F-33 改为：

> 每个需要结果随机判定的 SELECTABLE_ONE_DRAW 行为一次 keyed RNG；其他分类以 F-35b 为准。

具体实现以 `05 §C.10` 为唯一权威，不构成实现歧义。

## N02 — HELDKICK delta 文字应统一

`05 §C.9` 的四层公式已把 HELDKICK 列入 raw `+10` 集合，实际 effective delta 受 ±6 cap；同一行末尾又写成“由分球执行−协防执行确定性计算”。

正式入库前应二选一并统一措辞。当前实现可按 Registry 明示的 raw `+10` 和公共 cap 执行；该项属于 `[CALIBRATE]` 数值表达，不改变传球成功/失败链、RNG 或 Event 合同。

## N03 — BOXOUT “加成”数值表达应明确

BOXOUT actor、RNG 和 Event 合同已经唯一，但“提高个人篮板执行”的额外数值未单独登记。

在首个实现候选中应明确：

- 该效果是否已经包含在 `rebounding/bodyImpact` 的个人篮板执行中；
- 若存在额外执行点，应作为 `[CALIBRATE]` 参数登记。

该项只影响普通平衡参数，不改变行为分类、参与者、随机键或统计合同，因此为 NON-BLOCKING。

## N04 — BOXOUT Event 表述

`04 §B.6` 写 `CLOCK_ADVANCED`，而 F-35d 写“无独立 BOXOUT 事件”。

两者可兼容解释为：

- BOXOUT 不产生独立行为类型事件；
- 时间消耗包含在该 REBOUND 片段现有 CLOCK_ADVANCED 中。

建议在表格中直接写“随 REBOUND 片段的 CLOCK_ADVANCED”，避免误解为增加一个额外事件。

## N05 — 参数区间校准

创造行为 raw bonus 6～15 经统一 per-event ±6 cap 后，大部分最终值相同。实现可以使用当前可运行初值，但 Gate B 校准前应重新调整 raw 区间或 cap，使不同创造质量具有区分度。

# Deferred Issues

以下内容不属于 P02-003，不影响本次放行：

- 产品级助教轮换；
- 训练和成长；
- GameState/Save V2；
- 临场命令 handler；
- 生产比赛 UI；
- 完整徽章系统；
- 招募、伤病、关系、士气；
- LLM/Agent；
- 后续联赛和赛事系统。

# Development Entry Conditions

READY 不等于实现自动通过。

进入开发后必须执行：

1. 以 `05 §C.10` 生成唯一 Behavior Registry，不允许从其他表重新推断分类；
2. 以 P02-002 的闭合 drawKind/EventType 为边界；
3. 先提交固定场景 registry，再调 `[CALIBRATE]` 数值；
4. `stepToNextControlBoundary == runToEnd == replayMatch` 逐 Event/Fact/Transcript 身份一致；
5. 64-seed 方向场景全部运行；
6. 10,000 场性能 Gate 零 watchdog；
7. Event/Fact/Statistic 不变量全部通过；
8. 不扩到 P02-004；
9. 设计中的 NON-BLOCKING 文档清理不得改变已批准的核心合同。

# Final Decision

# READY FOR DEVELOPMENT

理由：

- 所有此前 BLOCKING 均已关闭；
- 44 个 Behavior ID 的分类和 selectable 集合已机器一致；
- PASS 失败链已全文统一；
- BOXOUT 已形成唯一的 rule-result 参与者合同；
- 比赛状态机、概率结构、参与者选择、RNG semantic ordinal 和 Event/Fact/Statistic 因果链已经足以直接实现；
- 剩余问题均为数值校准或文档措辞，不要求开发线程发明新的篮球规则、Schema、事件类型或随机调用顺序。

建议后续状态：

```text
P02-003 v2.9
→ Owner 记录正式批准
→ 开发线程实现 Headless Model B
→ 单元测试 / replay / 64-seed 场景 / 10,000 场性能
→ Gate B 独立实现审核
```
