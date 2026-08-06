# 07 — Balance & Realism Registry（平衡与真实性 Registry）

版本：v2.7（内容自 v2.4 未变，N1：平衡/真实性方向稳定）
日期：2026-08-03
状态：COMPLETE（方向结论为设计预期；实测由开发线程按开发计划 §7.4 场景 registry 执行）

满足 Phase 5 通过条件：星级分层大致满足 Owner 区间（P02 3★/4★）；高星碾压来自机制非 DDA；三星 vs 三星不频繁职业级高分；属性组合产生不同比赛风格。

## A. 方向场景 Registry（开发计划 §7.4 权威）

**每场景：64 个固定配对 seed**（预注册，修改 registry 即提升场景版本并重跑全部候选，不能只保留有利 seed）。P02-003 先通过前四项 + 弱队适配不抹平差距；浅/深轮换 P02-006 补（F-148）。

| # | 场景 | 预注册指标与初始 Gate [CALIBRATE] |
|---|---|---|
| S1 | 明显强弱队 | `OFFICIAL` 强弱直接对阵；`scoreMargin = strongPoints - weakPoints`；64 场平均分差 > 0，强队至少 33/64 获胜 |
| S2 | 高疲劳 vs 充分恢复 | 只把同一方全员赛前疲劳从 10 改为 80；`tacticExecutionRate`、`q4NetRating = 100×(Q4得分-Q4失分)/Q4球权` 均值更低且 ≥40/64 配对更低；高疲劳胜场数至少少 4 |
| S3 | 正常位置 vs 五人错配 | 只改五个首发槽位；`tacticExecutionRate` 更低、`unforcedTurnoverRate = UNFORCED_DEAD_BALL/teamPossessions` 更高、`defensiveBreakdownRate = defensiveBreakdownEvents/opponentHalfCourtPossessions` 更高；三项汇总方向均成立且各 ≥40/64 |
| S4 | 战术适配 vs 不适配 | 只改一个战术轴；主指标与代价指标按规则方向变化 ≥40/64；代表目标区域机会占比差初始 ≥8 个百分点 |
| S5 | 浅轮换 vs 深轮换 | P02-006 后加入（P02-003 不 gate） |
| S6 | 弱队适配不抹平实力差 | 同一强弱对阵只把弱队改为最适配战术；强队平均分差仍 > 0，弱队最多 31/64 获胜 |
| S7 | tacticalUnderstanding 单属性消融（Non-Blocking 1） | 同一 4★ 阵容，仅把 `tacticalUnderstanding` 全员从 X 降至 X-30；`tacticExecutionRate` 下降、传球/创造类行为成功率下降、而个人终结命中（SHOT INSIDE 无创造）变化 ≤ [CALIBRATE] 阈值；证明 TU 不成为准万能属性 |
| S8 | 多核心高持球冲突（Non-Blocking 2） | 同能力两阵容：A=单高 `possessionParticipation`(80)，B=三名 `possessionParticipation`(80)；B 队 `possessionHHI`（持球集中度）显著低于 A、`tacticExecutionRate` 下降、`turnoverRate` 略升；证明冲突可观察且可由事件统计 |

**指标来源**：`successfulTacticExecutions`、`tacticExecutionOpportunities`、`defensiveBreakdownEvents`、区域机会、`possessionHHI` 必须由结构化事件或事件 reducer 得出（F-41/06 §D/E）。

**possessionHHI 数据来源（修复 N01/N2）**：`BALL_HANDLER` 是 drawKind 而非 Event，`POSSESSION_STARTED` payload 无 playerId——**不能直接从现合同事件计算球员级 HHI**。修复：
- 方案（采用）：resolver 在每次 `BALL_HANDLER` 持球者选择后生成一个 **STATISTICAL fact（PossessionHandlerFact，拼写统一，N1）**。**结构层级修正（N01）**：factKind/sourceEventIds/localFactSequence 属于 **MatchFact 顶层**（合同 `MatchFactSchema`），payload 只含识别数据：
  ```
  MatchFact {
    factKind: "STATISTICAL",
    sourceEventIds: [与持球者选择相关的 CLOCK_ADVANCED/POSSESSION_STARTED 事件id],
    localFactSequence,
    payload: {
      type: "POSSESSION_HANDLER",
      handlerPlayerId,
      period,
      possessionIndex,
      segmentIndex
    }
  }
  ```
  （factKind/sourceEventIds/localFactSequence 对齐合同 `MatchFactSchema`；不新增事件类型；N01 层级修正。）
- `possessionHHI = Σ(possessionCount_i / totalPossessions)²`（i=球员），由该 fact 链 reducer 计算。
- **替代（不采用）**：改 `POSSESSION_STARTED` payload 增加 playerId（改合同，违反"不改合同"）。**不采用**。
- S7 消融阈值：`[CALIBRATE]`，方向必须成立；不允许借消融改变行为边界或 RNG 规则（`05` §I）。
- **S8 预期降级说明（N02）**：多核心冲突的"tacticExecutionRate 下降 / turnoverRate 略升"为**方向性预期**，由高 `possessionParticipation` 竞争同一持球池（`05` §D.2）自然产生；如实测无方向差异，S8 判定为"不成立"，不强制机制补写。

## B. 真实性观察区间

| 指标 | 真实区间（`01` §C2） | P02 设计目标（3★/4★） |
|---|---|---|
| 每队得分 | 女篮高中 40-60 / NCAA 66 | 3★ 20-40 / 4★ 30-60（F-142） |
| 回合数 | 55-75/队/40min | 55-70 |
| FG% | 41% | 35-48%（按星级） |
| 3P% | 31% | 25-36% |
| FT% | 71% | 65-80% |
| TOV% | 22-23% | 18-28%（低星高） |
| ORB% | 31% | 26-34% |
| AST% | ~13/场 | 8-15/场 |
| PF | ~16.6/场 | 12-20/场 |
| FTA/FGA | ~0.28 | 0.20-0.35 |

## C. 星级分层（P02 3★/4★）

### C.1 四要素星级梯度（[CALIBRATE]）
| 要素 | 3★ | 4★ | 机制来源 |
|---|---|---|---|
| eFG% | 低 (~35%) | 中 (~43%) | shooting/finishing → 执行值 |
| TOV% | 高 (~26%) | 中 (~20%) | ballHandling/playmaking → 失误率 |
| ORB% | 低 (~26%) | 中 (~30%) | rebounding → 篮板率 |
| FTr | 低 | 中 | drive 冲击 + 犯规率 |

### C.2 实现机制（全部来自具体能力，无 OVR）
- 高命中 ← 高 shooting/finishing 执行值
- 低失误 ← 高 ballHandling/playmaking
- 高篮板 ← 高 rebounding
- 高星存在感 ← 具体能力自然涌现（F-101）
- 三星角色价值 ← 低星 clamp 下限保底 + 角色行为（SCREEN/CUT 核心是 tacticalUnderstanding，不依赖终结）

### C.3 说明（F-140~142）
- P02 只生成 3★/4★；5★/6★ 目标为 P09 远期参考，不进 P02 Gate（`00` 冲突 #5）。
- 用户确认"三星主要算是业余球员，20-40 分可以"。

## D. 无 DDA / 橡皮筋保证

- 唯一"状态"修正为疲劳/默契（F-74~88），无连胜/分差/隐形难度修正。
- 不参考 OVR（F-99）；不参考比分做难度调整。
- 分差只由四要素自然产生（F-143 场景方向）。

## E. 校验协议（开发线程执行）

1. 场景 registry 预注册：64 固定配对 seed、唯一被改变的输入维度、公式、分母、无候选分母处理、平局处理、配对阈值、汇总阈值。
2. 每场景汇总指标对照 §A Gate 阈值。
3. 越界项按 `05` §E.3 校准顺序微调（先区域基础，再执行组合系数，最后 clamp/下限）；不得改机制结构（基线 §21）。
4. 方向结论记录回本文件，形成可审计闭环。
5. 三星 vs 三星不得频繁出现职业级高分。
6. 每个 seed 的 event/fact/transcript 在 step/runToEnd/replay 三条路径逐项一致（F-153）。

## F. 性能预算（F-150~152）

- 10,000 场 INSTANT 总耗时 ≤60,000ms、p95 ≤10ms、peak RSS ≤512MiB；预热 `p02-match-warmup-0001~0200`、测量 `p02-match-bench-00001~10000`；冻结 B_total/B_p95。
- watchdog 零触发；跨机器 CI 数值只报告，性能裁决只在登记的 Gate runner 复现。
