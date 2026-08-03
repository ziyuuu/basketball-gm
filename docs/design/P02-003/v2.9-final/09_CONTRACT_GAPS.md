# 09 — Contract Gaps（合同增补清单）

版本：v2.9（修订：与 v2.8 复审一致，无合同 Schema 增补）
日期：2026-08-03
状态：COMPLETE

原则（F-157）：禁止静默扩大 Schema；每项增补必须有明确理由且不破坏身份链。**v1.0 假设合同缺失的若干项，实际合同已含**（如加时、规则性失败、创建机会事实），本节逐项复核后修正。

## 核对结果总览

| 项 | 合同现状 | 处理 |
|---|---|---|
| 加时（300s、重定球权） | ✅ 已含 `overtimePeriodSeconds:300` | 无增补 |
| 规则性失败（<2人） | ✅ 已含 anchor `status` + `terminationReason` | 无增补 |
| 创建机会事实 | ✅ 已含 `MatchFact`（EXPLANATION） | 无字段增补，需实现 reducer |
| 球队统计 | ✅ `TeamBoxScoreSchema`（球员合计） | 无独立团队行（P02 无 team rebound 独立概念） |
| 30s 进攻时钟 | ❌ 合同无 `shotClock` 字段/事件 | **已决策：方案 A 实现，不改合同（违例=UNFORCED_DEAD_BALL）** |
| 徽章接口（独立 Badge） | ⚠️ 合同以 `archetypeTrait` 表达 | **仅接口与设计，不落实（用户已决策）** |
| 短人阵容 4/3/2 | ⚠️ 事件/状态可表达，但无专门字段 | 复核，确认无新 Schema |
| 队内 6v6 | ✅ 已含 `ScrimmageSideInputSchema` | 无增补 |

## G1. 30 秒进攻时钟【已决策：方案 A，不改合同，事件重建（修复 B-B03）】

- **现状**：P02-002 合同 `MatchRulesSchema` 无 `shotClock`；`MatchDrawKindSchema` 无违例 drawKind；`MatchEventTypeSchema` 无违例事件。P02 基线 §12.2 用节奏产生回合时长（慢×1.12/快×0.88），无 30s 硬时钟。
- **冲突**：主提示词 §4.1 冻结"进攻时间 30 模拟秒"（F-06/F-23）。`00` 冲突 #4。
- **决策（Owner 2026-08-03）**：实现 30s 进攻时钟（方案 A）。**不改合同**——开发线程按策划方案实现。
- **跨控制边界恢复（审核 B-B03）**：`shotClock` 不写入持久 Schema，**由已提交事件确定性重建**：
  - 复位点：`POSSESSION_STARTED` → 30；`REBOUND(OFFENSIVE)` → 20；其他 carry → 继承；
  - `shotClock(anchor) = 复位值 − Σ(该球权内自最近复位点起 CLOCK_ADVANCED.seconds)`；
  - `stepMatch` 在 draft 上按 events 重算；重放时从事件流重建同一值 → `step/runToEnd/replay` 一致。
- **实现要点**：
  1. `shotClock` 为片段内规则状态（非持久 Schema 字段），随行为时间递减，与 `periodClockSeconds` 并行；
  2. 复位：新球权 30s / 前场进攻篮板 20s / 球权变更 30s / 非投篮犯规死球继承剩余（F-06a）；
  3. 违例：`shotClock==0` 活球 → **`TURNOVER(UNFORCED_DEAD_BALL)`**（合同已有该 turnoverKind，无需新增事件）+ EXPLANATION fact；对方球权，不记抢断（F-06b）；
  4. 临违例出手压力：`shotClock ≤ 5s` 出手权重↑、仓促出手负修正（F-06c）。
- **Schema 变更**：否。仅需规则常量 `shotClockSeconds=30` 及重建/复位规则，开发线程在 resolver 中实现。

## G2. 短人阵容 4/3/2 人继续【复核，无新 Schema】

- 合同 anchor `status`、`MATCH_COMPLETED` terminationReason、FOUL/SUBSTITUTION 事件可表达。
- 少人规则调整（传球池缩小、疲劳速率上升、防守折扣）为 `[CALIBRATE]` 行为参数，非 Schema 增补。
- **结论**：无需新增字段；需实现 reducer 处理。

## G3. 规则性失败 <2 人【已含，确认】

- 合同 `status: FORFEIT_INSUFFICIENT_PLAYERS` + `terminationReason`。**无增补**。
- 规则性胜者按正式 winner 结算；终止前比分/统计原样保留（基线 §12.5）。

## G4. 团队篮板 / 团队失误【已决策：选项 2（简化口径），修复 B-B06/E-B01】

**审核结论**：原判定"已覆盖"错误。合同 `REBOUND`/`TURNOVER` 强制绑定球员，且 `TeamBoxScoreSchema` 无独立团队行——出界、时钟违例、死球篮板等团队事件无法同时满足"官方口径"与"强制个人归因"。

**Owner 决策（2026-08-03）**：**采用选项 2（简化口径）**。

**选项 2 细则（无几何依赖，修复"离球最近"不可实现问题）**：
- **P02-003 无几何位置模型**（无 x/y 坐标），归因不得依赖空间距离，只能从事件流已确定状态派生。
- 投篮不中 + 球出界（无人控制）→ **不产生 REBOUND 事件**；球权经 `POSSESSION_ENDED` → 掷入给防守方；官方"team rebound"用 EXPLANATION fact 记录，box score 无个人篮板。
- 传球/运球出界 → `TURNOVER(UNFORCED_DEAD_BALL)`，`playerId = 传球者/持球者`（事件流确定）。
- 时钟违例 → `TURNOVER(UNFORCED_DEAD_BALL)`，`playerId = 当前持球者`（`BALL_HANDLER` draw 确定）。
- 盖帽散球（活球）→ 抢到者 `REBOUND`；若出界则按 V23-01 规则。
- 球队统计=球员合计；官方口径由 EXPLANATION fact 表达，不进 box score 独立行。
- **实现细节见 `06` §E。**

**结论**：不改合同，个人统计零污染，无几何依赖，事件流派生、可重放。G4 关闭。

## G5. 盖帽散球/出界归属【已含，确认，修复 V22-05/V23-01】

- `REBOUND` 事件（BLOCK 后活球散球归属）。
- **盖帽后出界球权归属（V23-01，遵循 FIBA 23.2.1，与 G4 完全同术语）**：
  - 防守者盖帽、且**防守者最后触球**将球盖出界 → **进攻方继续**（同 possessionIndex、segment+1，shotClock carry），无 REBOUND、无 TOV。
  - 防守者盖帽后球反弹、**进攻方最后触球**出界 → 进攻方 `TURNOVER(UNFORCED_DEAD_BALL)`，防守方新 possession。
  - 无法判断最后触球 → 确定性简化归进攻方（盖帽为防守受迫动作，无从判断时归进攻方，避免防守方凭空获利）。
  - 分来源表见 `04` §B.6，与 `06` §E 一致。
- **无增补**。

## G6. 同队保留球权（ORB 后新 segment）【已含，确认，修复 B-B04】

- `possessionIndex` 不变、`segmentIndex` 递增（F-24，对齐基线 §12.2：进攻篮板后再次进攻进入新 segment）。**无增补**。

## G7. 加时结构【已含，确认】

- `overtimePeriodSeconds:300` + 重定首段球权 + 队内允许平局。**无增补**。

## G8. 规则性胜者【已含，确认】

- 见 G3。正式/友谊按规则性胜者结算，不伪造 20:0。

## G9. 创建机会事实【已含容器，字段级合同见 06（修复 B-B07/E-B02）】

- 容器：合同 `MatchFact`(EXPLANATION) + 8 effect 参数中 `OPPORTUNITY_QUALITY`。**无新事件/无新 Schema 字段**。
- **字段级合同**：`06` §D 冻结 `CreationFactPayload { creatorId, beneficiaryId, behaviorId, opportunityQualityDelta, defensiveResponse, period, possessionIndex, segmentIndex, nextBehaviorId }`——**不含 `sourceEventIds`**（N02：源事件由 MatchFact 顶层 `sourceEventIds` 承载，`06` §D 已删除 payload 内重复字段，本行同步）。
- **reducer/Gate 映射**：`06` §D 定义 `tacticExecutionRate`、`defensiveBreakdownEvents`、区域机会、`possessionHHI` 如何由 CreationFact/事件得出（供 `07` S4/S7/S8 消费）。
- 结论：P02-003 需实现 reducer，无需合同字段增补。

## G10. 徽章接口【仅接口与设计，不落实】

- 合同现有 `archetypeTrait`（6 特质 +6 执行点）即徽章等价物（F-89~97）。
- 主提示词 §6.4 要求徽章影响"行为被选择的基础概率 + 行为成功的基础概率"。合同特质只覆盖成功执行点。
- **用户决策（2026-08-03）**：**只保留接口与设计，不进入合同 schema 落实阶段**。P02-003 交付的是接口定义与设计，是否在未来写入 schema 属后续阶段决策。
- **接口设计**（P02-003 交付层面，供未来使用）：
  ```
  Badge {
    id: BadgeId,
    type: "select" | "success" | "both",
    scope: BehaviorId | BehaviorGroup,
    selectBonus: milli,   // 加到该行为选择权重
    successBonus: milli,  // 加到该行为成功执行点
  }
  ```
  P02-002 合同现以 `archetypeTrait`（成功执行点 +6）作为 P02 期最小徽章载体；完整 `Badge` 接口为设计形态，不要求本阶段落库。
- **约束**：徽章不修改属性/建技能树/改规则（F-98）；获取/升级/槽位/传承仍属 P08/P09，P02-003 只设计接口。

## G11. 行为时间（1..5s）【已含，确认】

- 活球片段 ≥1s（开发计划 §7.4）；行为时间 1-5s（F-05）。行为目录数据，非 Schema。

## 汇总

| 增补 | Schema 变更 | 优先级 | 状态 |
|---|---|---|---|
| G1 30s 进攻时钟 | 否 | 已决策：方案 A（事件重建，修复 B-B03） | 冲突 #4 已解决 |
| G2 短人阵容 | 否 | 复核通过 | 实现 reducer |
| G3 规则性失败 | 否 | 已含 | 确认 |
| G4 团队篮板/失误 | 否 | 已决策：选项 2 简化口径（无几何依赖） | B-B06 已修复并关闭 |
| G5 盖帽散球/出界 | 否 | 已含（活球 REBOUND；出界无 REBOUND） | 确认（B-B06 配套） |
| G6 ORB 保留球权 | 否 | 已含（segment 语义已统一） | 确认（B-B04 已修复） |
| G7 加时 | 否 | 已含 | 确认 |
| G8 规则性胜者 | 否 | 已含 | 确认 |
| G9 创建机会事实 | 否 | 字段级合同见 06 §D | 需实现（B-B07 已修复） |
| G10 徽章接口 | 否 | 仅接口与设计，不落实 | 用户已决策 |
| G11 行为时间 | 否 | 已含 | 确认 |

**结论**：真实合同已覆盖大部分机制。G1（30s 进攻时钟）已决策方案 A 且以事件重建保证可重放；G4（团队篮板/失误）**已决策选项 2 简化口径并关闭**（R05）；G10（徽章接口）仅保留接口与设计；其余为实现任务。所有增补显式列出，无静默扩大，全文状态一致。
