# P02-003 Headless Model B v2.8 独立复审报告

- 审核日期：2026-08-03
- 审核身份：P02-003 Headless Model B 独立玩法设计审核人
- 审核对象：`c945e03e-c131-4886-a31a-5b1c51a0439c.zip`
- 压缩包 SHA-256：`4ea8c2ea731025e89185337651559a0a42e601bd17184846db9f10a2f082d7e6`
- 文档版本：方案 B v2.8
- 文档规模：14 个 Markdown 文件，共 2,595 行、17,828 词、198,760 字节正文
- 对照前次复审：`P02-003_SCHEME_B_V2.7_INDEPENDENT_REAUDIT_REPORT.md`
- 仓库合同基线：`ziyuuu/basketball-gm@45dc1a261172ebfff46f30b122cbdf5621596959`
- 最终评分：**91/100**
- 最终决定：**NOT READY FOR DEVELOPMENT**

> 本报告不修改设计、不替开发线程补规则，也不以包内 `COMPLETE`、自审 PASS 或“全部归一化”声明作为放行证据。判断标准只有一个：开发线程是否能够依据当前文档，在不自行选择行为分类、传球概率链、参与者身份或 RNG ordinal 的情况下，实现唯一的 P02-003 Model B。

# Executive Summary

v2.8 对 v2.7 的三项 BLOCKING 做了显著修复：

1. `05 §C.10` 现在确实列出了 44 个 Behavior ID；
2. 该 44 ID 集合与 `04 Behavior × Attribute Matrix` 的 44 个唯一 ID 完全一致；
3. `PASSTOV / BALLDESTROY / FOUL / BLKLOOSE` 已纳入分类表；
4. ORB、DRB 已明确为 `RULE_RESULT`，不再进入普通行为选择；
5. PASS、HPASS、CREATIVE_PASS、ASTOPP、HELDKICK 的主要权威条款已改为单一 `TURNOVER_OCCURRENCE` 链；
6. `04 §B.3` 已同步单一传球链；
7. `04 §B.5` 已与 `05` 的防守 resolver 因果链对齐：
   - STLTRY 不直接生成 STEAL/FOUL；
   - HELPD、DOUBLET 不直接生成 TURNOVER/FOUL；
   - FOUL_TYPE 只负责已发生犯规的类型分类。

因此：

| v2.7 BLOCKING | v2.8 复审 |
|---|---|
| V27-01 44 行为 Registry 不一致 | **PARTIAL CLOSED**：44 ID 集合已闭合；BOXOUT 分类后的 actor/ordinal 仍冲突，计数断言错误 |
| V27-02 PASS 两条失败概率链 | **PARTIAL CLOSED**：主权威已统一；C.9/H.2/H.3 仍保留互斥旧定义 |
| V27-03 Event Matrix 未同步 | **CLOSED** |

当前剩余 **2 项 BLOCKING**：

1. HELDKICK、HPASS、ASTOPP 的传球失败链仍在同一权威文档中存在互斥定义；
2. BOXOUT 已被归类为不可选择的规则结果，但 actor 合同仍要求使用不存在的 `behaviorSelectionOrdinal`。

另有一项必须修正的机器计数错误：

- 实际分类为 **34 selectable + 10 non-selectable = 44**；
- 文档却声明 **33 selectable + 11 non-selectable**。

该计数错误本身不改变比赛语义，列为 NON-BLOCKING；但当前声称的自动断言会失败，正式开发包必须修正。

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

同时进行了以下机器核验：

- `04` 行为矩阵唯一 ID 数量；
- `05 §C.10` 分类表 ID 数量；
- 两个集合的缺失项、额外项与重复项；
- `05 §D.2` selectable 行数量；
- 四类 classification 实际计数。

# Machine Verification Results

## 1. Behavior ID 集合

`04` 中存在：

- 45 行行为记录；
- 其中 HELDKICK 在传球与关键无球章节各出现一次；
- 去重后为 **44 个唯一 Behavior ID**。

`05 §C.10` 中存在：

- **44 行**；
- **44 个唯一 Behavior ID**；
- 无重复。

集合结果：

```text
BehaviorMatrixUniqueIds == ClassificationRegistryIds
size == 44
missing == []
extra == []
```

该项通过。

## 2. 实际分类计数

`05 §C.10` 实际分类为：

```text
SELECTABLE_DETERMINISTIC = 6
SELECTABLE_ONE_DRAW      = 28
RULE_RESULT              = 9
ATTRIBUTION_ONLY         = 1
```

所以：

```text
selectable     = 34
non-selectable = 10
total          = 44
```

不是文档声明的：

```text
selectable     = 33
non-selectable = 11
```

`05 §D.2` 的 selectable 表实际也有 **34 行**，不是标题声称的 33 行。

# Scoring

| 维度 | 权重 | v2.7 | v2.8 | 独立复审结论 |
|---|---:|---:|---:|---|
| 权威来源与合同忠实度 | 10 | 9 | 9 | 44 ID 与防守 Event 已统一；传球与 BOXOUT 仍有残留冲突 |
| 范围控制 | 5 | 5 | 5 | PASS |
| 比赛规则与状态机 | 15 | 15 | 15 | PASS |
| 行为合同与篮球真实性 | 15 | 12 | 13 | 主体闭合；BOXOUT actor 链未闭合 |
| 属性、倾向与角色差异 | 12 | 11 | 11 | PASS WITH CALIBRATION |
| 概率与参数模型 | 15 | 12 | 13 | 主 PASS 链已统一；HELDKICK/C.9 仍冲突 |
| 确定性与 P02-002 兼容 | 12 | 11 | 10 | 大部分 ordinal 闭合；BOXOUT 无合法 selection ordinal |
| Event / Fact / Statistic | 10 | 9 | 9 | V27-03 已关闭，传球事件链仍受旧合同影响 |
| 平衡、反例与可验证性 | 6 | 5 | 6 | 场景充分 |
| **总分** | **100** | **89** | **91** | **NOT READY** |

总分不是自动放行阈值。传球概率链或参与者 RNG 坐标存在任一互斥定义，都不能判定 READY。

# Authority Check

## 结论

**PARTIAL PASS — 9/10**

已通过：

- P02-002 的闭合 drawKind/EventType 未被扩展；
- 未扩 MatchInput、Player Schema、Save Schema；
- 未引入 P02-004+、UI、卡牌、LLM、DDA 或 OVR；
- 状态机、shotClock、节间球权、犯规、篮板、出界和统计分层稳定；
- `05 §C.10` 已成为真正包含 44 ID 的分类表；
- `04 §B.5` 防守事件链已经同步。

未通过：

- `05 §C.9/H.2/H.3` 仍保留与 F-35c、C.10 相反的传球定义；
- BOXOUT 的 classification 与 actor ordinal 规则不相容。

# Review 1 — Scope

## 结论

**PASS — 5/5**

没有混入：

- GameState/Save V2；
- 训练、成长、招募；
- 产品助教轮换；
- 临场命令实现；
- 生产 UI、2D、卡牌；
- LLM 或 Agent。

# Review 2 — Basketball Reality

## 结论

**PASS — 15/15**

篮球规则层已经满足开发要求：

- 4×10 分钟；
- 正式/友谊赛加时；
- 第 2～4 节交替球权；
- 30 秒进攻时间；
- ORB 后 20 秒；
- 5 犯离场；
- 2～4 人继续、少于 2 人规则性失败；
- 投篮、罚球、篮板、失误、犯规；
- 突破、后撤步、急停、抛投、对抗终结；
- 高位组织、掩护、空切和突破分球；
- 单防、压迫、协防、包夹、抢断、封盖；
- 正确的盖帽出界处理；
- team rebound/team turnover 简化口径。

当前阻塞不再是篮球规则本身，而是同一行为在不同 Registry 中的技术语义未统一。

# Review 3 — Attribute and Game Experience

## 结论

**PASS WITH CALIBRATION NOTE — 11/12**

十项能力均有独立作用：

- shooting 只负责投篮执行；
- finishing 负责篮下终结；
- ballHandling 负责护球与创造；
- playmaking 负责传球和组织；
- perimeterDefense / interiorDefense 分工清晰；
- rebounding 决定篮板争抢；
- athleticism 不直接成为万能属性；
- stamina 只通过疲劳作用；
- tacticalUnderstanding 不直接提升所有概率。

角色方向可以形成：

- 得分核心；
- 3D 后卫；
- 组织后卫；
- 策应中锋；
- 防守专家；
- 后撤步得分手；
- 内线终结者。

同能力、不同倾向可产生不同打法；不存在 OVR 倍率、隐藏胜率或 DDA。

## NON-BLOCKING-N01：创造 bonus 仍被 ±6 cap 压平

C.7/C.8 的 raw bonus 区间为 6～15，但 per-event effective delta 统一 cap 为 +6。

因此不同 raw bonus 当前大多得到同一有效值。数学结果是唯一的，不阻塞实现，但参数区间在校准前需要调整。

# Review 4 — Behavior Classification Registry

## 结论

**PARTIAL PASS**

### 已经关闭

- 44 个唯一 ID 全部进入 C.10；
- 无缺失、无额外 ID；
- PASSTOV、BALLDESTROY、FOUL、BLKLOOSE 已分类；
- ORB、DRB 已归为 RULE_RESULT；
- BLK 已归为 ATTRIBUTION_ONLY；
- STLTRY、HELPD、DOUBLET 的 Event 语义已与 resolver 对齐。

### NON-BLOCKING-N02：分类计数声明错误

实际：

```text
34 selectable + 10 non-selectable = 44
```

文档：

```text
33 selectable + 11 non-selectable = 44
```

这会使文档中声称的 machine assertion 失败，但每一行的具体 classification 本身清楚，所以当前作为 NON-BLOCKING 文档/验收错误处理。

修复要求：

- 将 `05 §D.2` 的 33 改为 34；
- 将 rule/attribution 11 改为 10；
- 自动从 C.10 行生成计数，禁止再次手写。

# Blocking Issues

## BLOCKING-V28-01 — 传球唯一失败链尚未全文归一化

### 已冻结的主规则

以下位置明确规定：

- `02 F-35c`
- `04 §B.3`
- `05 §C.10`

PASS、HPASS、CREATIVE_PASS、ASTOPP、HELDKICK 均使用：

```text
单一 TURNOVER_OCCURRENCE draw
未发生 → 传球成功
发生   → PASSTOV
```

并且：

```text
不设独立 BEHAVIOR success draw
```

### 冲突 1：C.9 仍给 HELDKICK 独立 BEHAVIOR 成功判定

`05 §C.9` 仍定义：

```text
HELDKICK:
P_success = clamp(...)
drawKind = BEHAVIOR 3000..3999
失败 → 独立 TURNOVER_OCCURRENCE
```

这重新形成两阶段模型：

1. HELDKICK success/failure；
2. failure 后再判 turnover。

它与 F-35c/C.10 的单 draw 模型直接互斥。

### 冲突 2：H.2 仍把 HELDKICK 放进 off-ball execution 区间

RNG Registry 仍写：

```text
BEHAVIOR 3000..3999 =
SCREEN / CUT / HELDKICK / DOUBLECREATE 的 success/failure
```

但 C.10 已明确 HELDKICK 不消耗该 success draw。

### 冲突 3：H.3 仍把 HPASS、ASTOPP 声明为 deterministic

`05 §H.3` 仍写：

```text
HPASS / ASTOPP 为确定性行为，不消耗结果 RNG
```

但 C.10/F-35c 规定它们必须消耗一次 `TURNOVER_OCCURRENCE`。

### 冲突 4：04 B.4 继续把 HELDKICK 的执行概率指向 C.9

`04 §B.4` 仍写：

> HELDKICK 执行概率合同见 `05 §C.9`。

而 `04 §B.3` 同时写它只使用 TURNOVER_OCCURRENCE。

### 影响

开发线程存在两种合规实现：

```text
A. 单 draw：
TURNOVER_OCCURRENCE 未发生 → HELDKICK 成功并产生 delta
```

```text
B. 两阶段：
先 BEHAVIOR success
失败后再 TURNOVER_OCCURRENCE
```

HPASS/ASTOPP 也可能被实现成：

- 无失误的 deterministic pass；
- 或使用通用失误率的 one-draw pass。

这些实现会产生不同的：

- turnover 概率；
- RNG 消耗；
- receiver；
- CreationFact；
- assist candidate；
- Event/Result hash。

### 关闭条件

全文只保留 F-35c/C.10 模型：

1. 从 C.9 ONE_DRAW 表删除 HELDKICK；
2. HELDKICK 成功定义为 `TURNOVER_OCCURRENCE` 未发生；
3. HELDKICK 的 CreationFact delta 在成功后确定性应用，不再有第二个 success draw；
4. 从 H.2 off-ball execution 列表删除 HELDKICK；
5. 从 H.3 deterministic 列表删除 HPASS、ASTOPP；
6. `04 B.4` 不再引用 HELDKICK 的 C.9 success 公式。

---

## BLOCKING-V28-02 — BOXOUT 作为 RULE_RESULT 后仍引用不存在的 behaviorSelectionOrdinal

### 当前唯一分类

`05 §C.10`：

```text
BOXOUT = RULE_RESULT
selectable = 否
不进入 P_select
无独立 RNG
```

### 冲突 1：D.6 仍要求 BOXOUT actor draw

`05 §D.6`：

```text
BOXOUT actor = BALL_HANDLER 3000 + behaviorSelectionOrdinal
```

但 RULE_RESULT 不参加行为选择，因此 BOXOUT 没有 `behaviorSelectionOrdinal`。

### 冲突 2：D.7 声称 BOXOUT 有 behaviorSelectionOrdinal

`05 §D.7` 仍称：

> 防守行为使用 BEHAVIOR 选择，这保证 HELPD/PRESS/STLTRY/BOXOUT 有 behaviorSelectionOrdinal。

但：

- BOXOUT 不在 D.7 的防守候选；
- C.10 明确 BOXOUT 不 selectable。

### 冲突 3：F.3 继续为 BOXOUT 随机选择 actor

`06 §F.3` 要求：

```text
BOXOUT actor_ordinal = 3000 + behaviorSelectionOrdinal
keyedDraw(BALL_HANDLER, actor_ordinal)
```

同样引用不存在的 selection ordinal。

### 冲突 4：H.3 又把 BOXOUT 称为 deterministic behavior

H.3 将 BOXOUT 与 ADV/REORG 等并列为 deterministic behavior，但 C.10 将它定义为 RULE_RESULT。

### 影响

开发必须自行决定 BOXOUT：

1. 是 selectable deterministic behavior；
2. 是 rebound rule-result；
3. actor 使用随机选择；
4. actor 使用篮板候选链；
5. 或完全不记录独立 actor。

这些选择会改变：

- 参与篮板的球员；
- 个人篮板执行；
- ORB/DRB 归属；
- actor Fact；
- RNG key；
- MatchResult hash。

### 关闭条件

必须选择唯一模型。

若保持当前 C.10 的 `RULE_RESULT`：

- 删除 BOXOUT 的 behaviorSelectionOrdinal；
- actor 从 REBOUND 争抢候选/归属流程中确定；
- 使用 REBOUND 实例 identity 或确定性候选规则；
- 不调用 `BALL_HANDLER 3000+behaviorSelectionOrdinal`；
- 从 D.7/H.3 的 selectable/deterministic behavior 说明中删除 BOXOUT；
- `06 F.3` 改为引用 rebound participant contract。

审核不代替设计选择另一模型，但不能同时保留两套。

# Event / Fact / Statistic Assessment

## 结论

**PASS WITH BLOCKED INPUT CHAINS — 9/10**

已通过：

- box score 只由 Event reducer 累积；
- ASSIST 只在 made SHOT 后产生；
- STEAL 只来自 PRESSURED_LIVE_BALL turnover；
- BLOCK 只在 missed SHOT 后归因；
- FOUL_TYPE 只在 foul 已发生后分类；
- HELPD/DOUBLET 不直接绕过规则产生事件；
- CreationFact 与 PossessionHandlerFact 字段层级正确；
- receiver 成功后立即成为当前 handler；
- team rebound/team turnover 不污染个人统计。

仍受 BLOCKING 影响：

- HELDKICK/HPASS/ASTOPP 的成功与失败 Event 入口不唯一；
- BOXOUT actor 与 rebound 事件链不唯一。

# Counterexample Audit

| # | 反例 | v2.8 结论 |
|---:|---|---|
| 1 | 44 Behavior ID 集合一致 | **PASS** |
| 2 | Registry 无缺失/额外 ID | **PASS** |
| 3 | ORB/DRB 不进入 P_select | **PASS** |
| 4 | 防守行为不直接生成错误 Event | **PASS** |
| 5 | 普通 PASS 只有单一 turnover 链 | **PASS** |
| 6 | HELDKICK 只有单一 turnover 链 | **FAIL**：C.9/H.2 保留独立 success draw |
| 7 | HPASS/ASTOPP 使用统一传球失误链 | **FAIL**：H.3 称其 deterministic |
| 8 | BOXOUT 不进入 P_select | **PASS in C.10** |
| 9 | BOXOUT actor 有合法稳定 ordinal | **FAIL**：引用不存在的 selectionOrdinal |
| 10 | selectable 机器计数正确 | **FAIL NON-BLOCKING**：实际 34，文档写 33 |
| 11 | 无 PRESSURED_LIVE_BALL turnover 不产生 STEAL | **PASS** |
| 12 | 未发生 foul 不调用 FOUL_TYPE | **PASS** |

# Non-Blocking Issues

1. selectable 实际计数应从 33 改为 34，non-selectable 从 11 改为 10。
2. `03 §21` 历史表仍保留旧的 `44=38+6`、`selectable 37` 等文本；应标明为历史版本数据，避免被当作当前规范。
3. `05 §C.9` 的表格仍把 `effective_delta=+10` 作为文字，但数学公式规定 raw +10、effective +6；建议改写字段名称。
4. C.7/C.8 raw bonus 被 ±6 cap 压平，校准前调整参数范围。
5. D.2 的 rule-result 摘要表仅列 6 项，另 4 项依赖正文补充；最终可以直接从 C.10 自动生成，减少重复。
6. 包内自评“全部归一化”应在独立审核通过后再改为 CLOSED。

# Required Resubmission Evidence

下一版无需新增机制，只需删除冲突定义：

1. 删除 C.9 中 HELDKICK 的独立 success 公式；
2. 删除 H.2 中 HELDKICK 的 off-ball execution ordinal；
3. 删除 H.3 中 HPASS、ASTOPP 的 deterministic 声明；
4. 更新 04 B.4 对 HELDKICK 的引用；
5. 选择 BOXOUT 的唯一身份；
6. 若 BOXOUT 为 RULE_RESULT，定义其 actor 如何从 REBOUND 链产生；
7. 删除 BOXOUT 的 behaviorSelectionOrdinal 和 BALL_HANDLER actor draw；
8. 修正 selectable/non-selectable 自动计数；
9. 增加以下机器反例：
   - HELDKICK 全链只调用一次 TURNOVER_OCCURRENCE；
   - HPASS/ASTOPP 失误概率等于 C.1；
   - BOXOUT 从不调用 BEHAVIOR selection；
   - BOXOUT actor 不引用未定义 ordinal；
   - 44 ID 集合与分类/计数均由同一表自动生成；
   - 日志和 Fact 开关不改变 rebound participant。

# Final Decision

# NOT READY FOR DEVELOPMENT

v2.8 已经关闭 v2.7 三项阻塞中的大部分内容：

- 44 Behavior ID 集合已经真正统一；
- ORB/DRB 分类已经统一；
- 防守 Event Matrix 已经统一；
- 普通 PASS 主概率链已经统一。

当前只剩两个结果相关的规范残留：

1. HELDKICK/HPASS/ASTOPP 的传球链仍有旧定义；
2. BOXOUT 被改成 RULE_RESULT 后，参与者与 RNG ordinal 没有同步重构。

这两项不是新增玩法问题，而是最后一轮规范归一化未覆盖到 C.9、D.6、D.7、H.2、H.3 与 F.3。

建议状态：

`FINAL NORMALIZATION REQUIRED → FINAL INDEPENDENT RE-AUDIT`

两项 BLOCKING 关闭后，可以进行 READY FOR DEVELOPMENT 的最终判定。
