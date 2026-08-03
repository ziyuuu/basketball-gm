# P02-003 Headless Model B v2.9 FINAL 修订包独立核验报告

- 审核日期：2026-08-03
- 审核身份：P02-003 Headless Model B 独立玩法设计审核人
- 审核对象：`d18a81f3-49e5-4081-b9ee-9eb2e14a7c4e.zip`
- 压缩包 SHA-256：`488a6cac9231e297daccc930ae92f38b65137229184d34448a683c398449887e`
- 文档版本：v2.9 FINAL（V29 非阻塞清理修订包）
- 文档规模：14 个 Markdown 文件，共 2,579 行、18,100 词、203,010 字节正文
- 对照基线：已通过的 v2.9 设计包与 `P02-003_SCHEME_B_V2.9_FINAL_INDEPENDENT_AUDIT_REPORT.md`
- 仓库合同基线：`ziyuuu/basketball-gm@45dc1a261172ebfff46f30b122cbdf5621596959`
- 最终评分：**95/100**
- 最终决定：**READY FOR DEVELOPMENT**

> 本次是对“最终审核通过后的非阻塞清理修订包”重新核验。包内对既有审核结论的引用不作为证据；本报告独立检查实际文件差异、44 行为集合、行为分类、传球链、BOXOUT、RNG ordinal 及 Event/Fact 合同。

# Executive Summary

本修订包相对已通过的 v2.9 基线共有 9 个文件发生变化，5 个文件保持字节级一致。

保持不变的文件：

- `01_EXTERNAL_RESEARCH.md`
- `06_EVENT_STAT_FACT_MATRIX.md`
- `07_BALANCE_AND_REALISM_REGISTRY.md`
- `08_P02-002_TRACEABILITY.md`
- `09_CONTRACT_GAPS.md`

发生变化的文件主要用于：

- 更新 FINAL / READY 状态；
- 将 F-33 概括条款显式指向四类 Behavior Classification；
- 统一 HELDKICK opportunityQuality delta 文字；
- 为 BOXOUT 登记 `[CALIBRATE]` 执行加成；
- 明确 BOXOUT 的 `CLOCK_ADVANCED` 属于 REBOUND 片段；
- 记录最终独立审核和非阻塞清理状态。

核验结果：

1. 没有修改比赛状态机、球权流转、shotClock、犯规、出界或加时合同；
2. 没有重新引入独立 HELDKICK success draw；
3. 没有重新将 HPASS/ASTOPP 设为无失误 deterministic pass；
4. 没有重新将 BOXOUT 放入 `P_select`；
5. 没有重新引入 BOXOUT actor draw 或不存在的 `behaviorSelectionOrdinal`；
6. 44 个 Behavior ID、34/10 分类和 selectable 集合仍机器一致；
7. RNG semantic ordinal、Event/Fact/Statistic 因果链没有变化；
8. 没有新增 MatchInput、Player Schema、Save Schema、drawKind 或 EventType。

因此，原 **READY FOR DEVELOPMENT** 决定继续有效。

# Change Audit

## 1. 文件差异范围

相对上一份 v2.9 设计包：

| 文件 | 变化性质 | 是否影响核心合同 |
|---|---|---|
| `00_SOURCE_REGISTER.md` | FINAL 状态文字 | 否 |
| `00b_REVISION_RESPONSE.md` | 记录最终审核和 N01-N05 清理 | 否 |
| `00c_RE_AUDIT_SUMMARY.md` | 更新审核轨迹 | 否 |
| `02_FROZEN_DECISIONS.md` | F-33 引用四类分类；BOXOUT 参数说明 | 否，属于澄清/校准登记 |
| `03_HEADLESS_MODEL_B_NORMATIVE_DESIGN.md` | FINAL 状态文字 | 否 |
| `04_BEHAVIOR_ATTRIBUTE_MATRIX.md` | BOXOUT 片段事件及加成说明 | 否 |
| `05_PROBABILITY_AND_PARAMETER_REGISTRY.md` | HELDKICK delta、BOXOUT 参数、校准说明 | 否，未改变 RNG/状态转移 |
| `10_REVIEW_REPORT.md` | 记录最终审核 | 否 |
| `11_OWNER_APPROVAL_CHECKLIST.md` | 更新 READY 状态 | 否 |

没有发现伪装成“非阻塞清理”的新行为、公式分支、Event 或 RNG 调用。

# Machine Verification

## 1. Behavior ID 集合

对 `04_BEHAVIOR_ATTRIBUTE_MATRIX.md` 与 `05 §C.10` 实际解析：

```text
04 行为记录：45 行
04 唯一 Behavior ID：44
05 §C.10 分类行：44
05 §C.10 唯一 Behavior ID：44

missing = []
extra = []
```

`04` 出现 45 行是因为 HELDKICK 同时在传球与关键无球表达中展示，去重后仍为 44 个正式 ID。

结论：**PASS**

## 2. 分类计数

```text
SELECTABLE_DETERMINISTIC = 6
SELECTABLE_ONE_DRAW      = 28
RULE_RESULT              = 9
ATTRIBUTION_ONLY         = 1

selectable     = 34
non-selectable = 10
total          = 44
```

结论：**PASS**

## 3. 传球链

全文仍保留唯一链：

```text
PASS / HPASS / CREATIVE_PASS / ASTOPP / HELDKICK
→ 一次 TURNOVER_OCCURRENCE
→ 未发生：成功，receiver 立即成为当前 handler
→ 发生：PASSTOV
```

核验：

- C.9 不再为 HELDKICK 设置独立 BEHAVIOR success draw；
- H.2 off-ball execution 只保留 SCREEN/CUT/DOUBLECREATE；
- H.3 不再把 HPASS/ASTOPP 列为无 RNG deterministic pass；
- `04 §B.3` 与 `02 F-35c` 一致。

结论：**PASS**

## 4. BOXOUT

唯一合同仍为：

```text
classification = RULE_RESULT
selectable = false
behaviorSelectionOrdinal = none
independent actor draw = none
independent BOXOUT Event/Fact = none
boxer = REBOUND 候选中个人篮板执行最高者
tie-break = playerId UTF-16 stable order
```

本轮新增：

- `[CALIBRATE] +[3..5]` 个人篮板执行点；
- `CLOCK_ADVANCED` 明确属于 REBOUND 片段。

没有改变 BOXOUT 的行为分类、参与者身份或 RNG 坐标。

结论：**PASS**

# Authority Check

## 结论

**PASS**

- P02-002 合同基线未改变；
- 没有扩展合同闭合枚举；
- `05 §C.10` 仍是 Behavior Classification 唯一权威；
- `02 F-33` 已明确引用 F-35b / C.10 的 deterministic、one-draw、rule-result 和 attribution-only 分类；
- 传球、BOXOUT、助攻、抢断、封盖和犯规因果链保持一致；
- 未引入 P02-004+、UI、卡牌、LLM、DDA 或 OVR。

# Review 1 — Scope

## 结论

**PASS**

本修订没有扩大到：

- GameState/Save V2；
- 训练、成长或招募；
- 产品助教轮换；
- 临场命令 handler；
- UI、2D、卡牌；
- LLM 或 Agent。

# Review 2 — Basketball Rules and State Machine

## 结论

**PASS**

以下内容未发生变化并继续满足开发标准：

- 4×10 分钟；
- 正式/友谊赛加时；
- 队内赛允许平局；
- 第 2～4 节交替球权；
- 30 秒进攻时钟；
- ORB 后 20 秒；
- 节末 `POSSESSION_ENDED → PERIOD_COMPLETED`；
- 5 犯离场；
- 少人继续及规则性失败；
- 投篮、罚球、篮板、失误和犯规；
- 正确的盖帽出界归属。

# Review 3 — Behavior / Attribute / Tendency

## 结论

**PASS**

- 44 Behavior ID 的分类和选择集合保持闭合；
- shooting、finishing 与创造属性继续分层；
- athleticism 不成为万能属性；
- tacticalUnderstanding 不直接提升所有概率；
- 六项倾向只决定行为选择，不直接决定成功；
- 角色差异、3D、组织中锋、得分核心和防守专家继续成立。

# Review 4 — Probability and RNG

## 结论

**PASS WITH CALIBRATION REQUIREMENTS**

没有新增或改变结果 RNG：

- 行为选择、行为结果、off-ball execution、receiver、actor、防守模式、防守执行、turnover、foul、shot、rebound 和 attribution 区间保持不变；
- 分支缺失不移动其他语义键；
- 日志、Fact、UI 和 cosmetic 不消费结果 RNG；
- step / runToEnd / replay 仍可使用同一语义坐标。

本轮新增的 BOXOUT 加成属于 `[CALIBRATE]` 参数，不是新的随机分支。

# Review 5 — Event / Fact / Statistic

## 结论

**PASS**

- EventType 闭合枚举未改变；
- box score 继续只由 Event reducer 累积；
- ASSIST、STEAL、BLOCK、FOUL 的发生与归因顺序未变化；
- CreationFact / PossessionHandlerFact 字段合同未变化；
- BOXOUT 的 `CLOCK_ADVANCED` 只是现有 REBOUND 片段时间事件，不是新 EventType；
- HELDKICK delta 修改不增加 Event、Fact 类型或第二次 RNG。

# Previous Non-Blocking Cleanup Assessment

| 最终审核 N 项 | 本包处理 | 复核 |
|---|---|---|
| N01 F-33 应引用四类分类 | 已增加 F-35b / C.10 引用 | **CLOSED** |
| N02 HELDKICK delta 文字统一 | 已归入 raw +10、公共 ±6 cap | **CLOSED WITH WORDING NOTE** |
| N03 BOXOUT 加成明确 | 已登记 `[CALIBRATE] +[3..5]` | **CLOSED FOR DESIGN / IMPLEMENTATION VALUE REQUIRED** |
| N04 BOXOUT CLOCK_ADVANCED 属 REBOUND 片段 | 已明确 | **CLOSED** |
| N05 bonus 区分度偏低 | 明确留到 Gate B 校准 | **CLOSED AS CALIBRATION ITEM** |

# Remaining Non-Blocking Issues

以下问题不要求开发线程发明新的状态机、行为、RNG 或 Event 合同，因此不撤销 READY。

## N01 — 状态台账仍有旧文字

`00_SOURCE_REGISTER.md` 的冲突 #9 仍写：

- “已响应，待独立复审通过”。

`10_REVIEW_REPORT.md` 末尾仍保留：

- “正式独立复审通过前本设计仍为 NOT READY”。

这些与同包的 FINAL / READY 状态冲突，但属于审核历史状态文字，没有改变任何规范规则。

要求：归档前更新为“最终独立审核已通过”。

## N02 — Owner Checklist 尚未正式勾选

`11_OWNER_APPROVAL_CHECKLIST.md` 中大量普通确认项和：

- “无未解释权威冲突”

仍未勾选。

独立审核结论可以是 READY，但 Owner 的最终批准动作仍需由 Owner 完成。未勾选本身不是设计缺陷，也不阻塞开发技术准备；正式进入项目主线前应记录 Owner 批准。

## N03 — BOXOUT 初值仍是范围

`+[3..5]` 是允许校准的参数范围，不是唯一数值。

这不改变：

- BOXOUT 分类；
- boxer 身份；
- RNG；
- Event/Fact；
- 状态转移。

但首个实现候选必须在预注册场景运行前选择一个精确的定点初值，并把它纳入 rules/content hash。开发线程可以依据 `[CALIBRATE]` 协议选择，无需再次请求 Owner。

## N04 — HELDKICK “定级”措辞

权威公式已经给出：

```text
raw delta = +10
per-event effective delta = clamp(+10, -6, +6) = +6
```

“由分球执行−弱侧协防执行确定性定级”的文字没有提供另一套数值映射，因此不得被实现为额外可变公式。

开发应按四层 Registry 的固定 raw +10 执行；如 Gate B 后要引入差值映射，必须提升 rules/content 版本并重新审核。

## N05 — 最终审核报告未包含在设计压缩包内

包内多次引用 `P02-003_SCHEME_B_V2.9_FINAL_INDEPENDENT_AUDIT_REPORT.md`，但压缩包本身只包含 14 份设计文档。

这不影响设计合同，但最终归档包建议加入审核报告或提供稳定仓库路径，避免开发线程只能看到自报审核状态。

# Development Entry Conditions

READY 不代表实现自动通过。开发必须：

1. 以 `05 §C.10` 生成唯一 Behavior Registry；
2. 保持 44 ID、34 selectable、10 non-selectable 的机器断言；
3. 使用唯一传球失败链；
4. 保持 BOXOUT 为 RULE_RESULT；
5. 在开始 64-seed 校准前冻结 BOXOUT 精确初值；
6. `step == runToEnd == replay` 比较 Event/Fact/Transcript 身份；
7. 跑完方向场景、反例和 10,000 场性能 Gate；
8. 不扩到 P02-004；
9. 任何对行为分类、RNG 区间或 Event 因果链的修改均需重新设计审核。

# Final Decision

# READY FOR DEVELOPMENT

本修订包没有引入新的 BLOCKING，也没有破坏已批准的 v2.9 核心合同。

最终判断：

- 比赛状态机：完整；
- 篮球规则：完整；
- Behavior Registry：机器一致；
- PASS 链：唯一；
- BOXOUT：唯一；
- 属性与倾向：有效；
- RNG semantic ordinal：闭合；
- Event / Fact / Statistic：闭合；
- Contract Gap：最小且明确。

剩余问题均属于：

- 状态台账清理；
- Owner 正式勾选；
- `[CALIBRATE]` 精确初值；
- 归档完整性。

这些不会迫使开发线程自行发明核心玩法或确定性合同。

建议流程：

```text
v2.9 FINAL 修订包
→ Owner 记录正式批准
→ 开发线程实现 P02-003
→ 单元测试 / replay / 64-seed 场景 / 10,000 场性能
→ Gate B 独立实现审核
```
