# 00 — Source Register（资料审计登记表）

版本：v2.9 FINAL（最终独立审核 READY FOR DEVELOPMENT 95/100；登记 v2.8 复审 V28-01~V28-02 修复与计数修正 + V29 非阻塞清理）
日期：2026-08-03
状态：COMPLETE

## 1. 登记目的

本文件登记 P02-003 线程在资料审计阶段读取的全部权威来源。**v1.0 因无法访问仓库而登记了"仓库文件缺失"；随后仓库被克隆并全文读取，本版本是修订后的真实登记表。**

## 2. 仓库现状（真实）

| 项 | 审计结论 |
|---|---|
| Git 仓库 | **存在**。`https://github.com/ziyuuu/basketball-gm`，克隆于 `D:\basketballgm\repo-ziyuuu` |
| HEAD | **`45dc1a261172ebfff46f30b122cbdf5621596959`** = `Merge pull request #13 from ziyuuu/task/p02-002-match-contract-keyed-rng`（P02-002 合并） |
| 与主提示词 §1.1 声明 | ✅ 一致（`main@45dc1a26...` 正是当前 HEAD） |
| `AGENTS.md` | **存在**，已全文读取（28 行工程规则） |
| `docs/P02_GAMEPLAY_BASELINE.md` | **存在**，v1.2，`OWNER_APPROVED`，1834 行已全文读取 |
| `docs/P02_DEVELOPMENT_PLAN.md` | **存在**，v1.2，已读取 §0-9 关键章节含 §7.4 |
| `docs/adr/0005-...` | **存在**，已全文读取 |
| `packages/domain/src/match/**` | **存在**：`schemas.ts`(1658行)、`keyed-rng.ts`、`effects.ts`、`index.ts` 已全文读取 |
| `packages/domain/src/core/**` | `canonical-v2.ts`、`fixed-point.ts`、`rng-contract.ts`、`index.ts` 已全文读取 |
| `tests/p02-002-*.test.ts` | **存在** 7 个：match-contracts、canonical-v2、effects、fixed-point、package-exports、rng-contract 已读取其中 3 个核心 |
| `evidence/P02/p02-002/**` | **存在**：scope-snapshot、requirements-traceability、known-issues、gate-candidate 已读取 |
| 交接包 | `D:\basketballgm\P02-003_handover_package.zip`（5 份骨架文档）已解压读取 |

## 3. P02-002 合同源码（最高技术权威）

以下文件是 P02-003 的直接合同基础，已全文读取：

| 文件 | 关键内容 |
|---|---|
| `packages/domain/src/match/schemas.ts` | MatchInput/Anchor/Event/Fact/Transcript/Result/Command/Effect 全部 Schema；**16 个 drawKind 枚举**；**16 个事件类型**；10 能力、6 倾向（含 shotZones 三元合计=100）、特质、12人整队/6v6队内、MatchRules(600s/300s/5犯) |
| `packages/domain/src/match/keyed-rng.ts` | `MatchDrawKey = {matchSeed, period, possessionIndex, segmentIndex, drawKind, localIndex}` → SHA-256 前64位 → [0,1)/整数区间 |
| `packages/domain/src/match/effects.ts` | effect 选择/替换/合并/递减；ADD ±6000 milli 封顶、MULTIPLY 750-1250 |
| `packages/domain/src/core/fixed-point.ts` | 千分位定点，roundHalfUp 签名为 half-away-from-zero，clamp |
| `packages/domain/src/core/canonical-v2.ts` | UTF-16 key 排序 + 纯 SHA-256 + idHash 身份链 |
| `packages/domain/src/core/rng-contract.ts` | `nextUint32` 顺序流 + 4×uint32 seed material |

## 4. 交接包文件

源：`D:\basketballgm\P02-003_handover_package.zip`（解压至 `D:\basketballgm\P02-003_handover\`），5 份骨架文档与 v1.0 登记相同，均为主提示词的压缩复述，无新增信息。

## 5. 主任务提示词（skill 参数）

15 节全文为任务权威。**与真实仓库的关系**：主提示词 §9 星级目标（含 5★/6★）与 §4.1 进攻时钟等，需与仓库实际对齐（见 Authority Conflict Log）。

## 6. 读取状态核对（修订后）

| 主提示词指定源 | 预期 | 实际（v2.0） |
|---|---|---|
| AGENTS.md | 读取 | ✅ 已读取 |
| P02_GAMEPLAY_BASELINE.md v1.2 | 读取 | ✅ 已全文读取 |
| P02_DEVELOPMENT_PLAN.md v1.2 | 读取 | ✅ 已读取关键章节（§7.4 P02-003 定义、§8.3 不变量、§8.5 方向场景解释） |
| ADR 0005 | 读取 | ✅ 已读取 |
| packages/domain/src/match/** | 读取 | ✅ 4 文件全部读取 |
| tests/p02-002-*.test.ts | 读取 | ✅ 7 个存在，3 个核心已读取 |
| evidence/P02/p02-002/** | 读取 | ✅ 4 文件读取 |
| 交接包 | 读取 | ✅ 已读取 |
| 主任务提示词 | 读取 | ✅ 已读取 |

**Phase 0 通过声明（修订版）**：全部指定文件均已核验——其中玩法基线/ADR/match 合同为**全文读取**，开发计划为**关键章节读取**（§0-9 含 §7.4/§8.3/§8.5）、P02-002 测试为 **7 个存在、3 个核心全文读取、其余 4 个核对存在性**。本表如实区分读取深度，不夸大为"全部全文读取"。无未解释权威冲突（冲突见下方日志）。

---

## Authority Conflict Log（权威冲突日志，v2.4）

### 冲突 #1（已解决）：v1.0 误判"仓库不存在"
- **内容**：v1.0 登记"仓库不存在"。
- **解决**：仓库存在且已克隆读取。本冲突作废。v1.0 是基于"初始工作目录 `D:\basketballgm` 为空"的误判——仓库在 GitHub，不在本地工作目录。已修正。

### 冲突 #2（已解决）：主提示词 6 倾向 vs 合同具体倾向
- **内容**：主提示词 §5.1 只说"6 个倾向"未列名；v1.0 设计推断为 shotTendency 等 6 项。
- **解决**：合同 `MatchTendenciesSchema` 明确规定 6 项：`possessionParticipation`（球权参与）、`passSelection`（传球选择）、`shotZones{perimeter,midRange,inside}`（出手区域三元，合计=100）、`transitionParticipation`（转换参与）、`defensiveRisk`（防守冒险）、`offensiveRebounding`（前场篮板）。**以合同为准**。

### 冲突 #3（已解决）：v1.0 概率模型（乘法）vs 合同（执行值差式）
- **内容**：v1.0 设计"base × bodyMod × awareMod..."乘法模型。
- **解决**：P02 基线 §12.4 明确规定执行值组合 + `命中率 = 区域基础 + 0.0025×(进攻执行-防守执行) + 0.0015×(机会质量-50)` 差式模型；`[CALIBRATE]` 允许调系数，**不允许改结构**。**以合同基线为准**。

### 冲突 #4（已解决）：30 秒进攻时钟
- **内容**：主提示词 §4.1 冻结"进攻时间 30 模拟秒"；P02-002 合同 `MatchRulesSchema` **无 shotClock 字段**，`MatchDrawKind` 无时钟违例 drawKind，`MatchEventType` 无违例事件。P02 基线 §12.2 用节奏产生回合时长（慢×1.12/快×0.88），无 30s 硬时钟概念。
- **解决（Owner 2026-08-03）**：**实现 30s 进攻时钟（方案 A），不改合同**。合同 `TURNOVER(UNFORCED_DEAD_BALL)` 已能表达违例；**shotClock 由已提交事件确定性重建**（`03` §4.4，修复审核 B-B03），保证跨同方死球边界与 step/runToEnd/replay 可重放。仅需规则常量 `shotClockSeconds=30`、复位规则与重建算法，无需改动 P02-002 合同 schema。
- **是否需 Owner 决策**：否（已决策）。

### 冲突 #9（已关闭）：独立审核轨迹（71→95/100，最终 READY FOR DEVELOPMENT）
- **内容**：独立审核轨迹 **71→77→79→81→83→84→86→89→91→95/100**（首审 8 BLOCKING → v2.1 R01-R05 → v2.2 V22-01~V22-05 → v2.3 V23-01~V23-04 → v2.4 V24-01~V24-04 → v2.5 V25-01~V25-04 → v2.6 V26-01~V26-04 → v2.7 V27-01~V27-03 → v2.8 V28-01/V28-02 + 计数修正 → **最终 READY**）。
- **处理**：逐轮修复见 `00b`/`10` §21 映射；v2.9 FINAL 通过最终独立审核。
- **状态**：**已关闭 ✅**。最终独立审核 `P02-003_SCHEME_B_V2.9_FINAL_INDEPENDENT_AUDIT_REPORT.md`（95/100，READY FOR DEVELOPMENT）与修订包核验 `P02-003_SCHEME_B_V2.9_FINAL_REVISION_AUDIT_REPORT.md`（95/100，READY 保持）均通过；无残留 NOT READY 状态。
- **是否需 Owner 决策**：G4 已决策；无剩余 Owner 决策项。

### 冲突 #5：星级分层（5★/6★ 不在 P02）
- **内容**：主提示词 §9 星级目标含 5★(50-80)、6★(60-90)；P02 基线 §5.2 明确 **5★/6★ 不生成、不平衡，移入 P09**。P02 只有 3★/4★。
- **采用哪个权威**：**以仓库为准**。P02-003 平衡目标聚焦 3★(20-40)/4★(30-60)；5★/6★ 目标保留为 P09 远期参考，不进入 P02 Gate。用户确认"三星主要算是业余球员，是可以"。
- **是否需要 Owner 决策**：否（已由仓库 v1.2 + 用户确认解决）。

### 冲突 #6：球队犯规奖励
- **内容**：v1.0 设计"每节第 5 次团队犯规 bonus 2 罚"。P02 基线 §12.4 明确"**P02 不模拟球队犯规奖励**"；合同 `FOUL` 事件 `foulKind` 仅 `PERSONAL/SHOOTING/OFFENSIVE`。
- **采用哪个权威**：**以仓库为准**。删除球队犯规奖励/bonus 设计。犯规处理：投篮犯规按区域 2/3 罚、进球+犯规 and-one 1 罚、进攻犯规失去球权记 PF、非投篮犯规死球保留球权。

### 冲突 #7：跳球
- **内容**：主提示词 §Phase2 状态机要求"开场球权"；合同无 jump ball drawKind/事件。
- **解决**：P02 无跳球事件。开场/加时首球权由 `POSSESSION_STARTED` 事件 + **确定性伪随机抽取**（`BALL_HANDLER` keyed draw，`03` §4.1）确定——**确定性伪随机**（同 seed 同结果，可重放），不是"非随机"（N1 措辞修正）。登记为设计选择。

### 冲突 #8：方向场景集
- **内容**：主提示词 §Phase5 列出 10 个方向场景；开发计划 §7.4 规定 P02-003 正式基线场景 **5 个 + 1 个增补**（明显强弱队/高疲劳vs恢复/正常位置vs错配/战术适配vs不适配/浅轮换vs深轮换(P02-006补)/弱队适配不抹平差距）。
- **采用哪个权威**：**以开发计划 §7.4 为准**。主提示词 10 场景中与开发计划重叠的保留，其余作为增补观察场景。每场景 64 固定配对 seed（与主提示词一致）。

## 权威优先级（修订后实际生效）

1. Owner 确认（主提示词 + 用户三条确认）
2. 仓库正式玩法文档 `P02_GAMEPLAY_BASELINE.md` v1.2（公式/规则权威）
3. 仓库开发计划 `P02_DEVELOPMENT_PLAN.md` v1.2（§7.4 场景与 Gate 权威）
4. P02-002 合同与测试（schema/drawKind/事件/身份链权威）
5. 交接包初稿
6. 外部资料（`01`）
7. 设计推断

低优先级不得静默推翻高优先级。本版全部文档以 1-4 为基准重写。

## 独立审核报告归档引用（v2.9 FINAL 修订包）

最终归档包内附 `audits/` 目录，稳定引用近三轮独立审核报告（外部原稿存 `D:\Downloads\`）：

| 报告 | 评分/结论 | 归档路径 | 外部原稿 |
|---|---|---|---|
| v2.8 复审 | 91/100 NOT READY（V28-01/V28-02 + 计数修正） | `audits/P02-003_SCHEME_B_V2.8_INDEPENDENT_REAUDIT_REPORT.md` | `D:\Downloads\P02-003_SCHEME_B_V2.8_INDEPENDENT_REAUDIT_REPORT.md` |
| v2.9 最终审核 | **95/100 READY FOR DEVELOPMENT** | `audits/P02-003_SCHEME_B_V2.9_FINAL_INDEPENDENT_AUDIT_REPORT.md` | `D:\Downloads\P02-003_SCHEME_B_V2.9_FINAL_INDEPENDENT_AUDIT_REPORT.md` |
| v2.9 FINAL 修订包核验 | **95/100 READY 保持**（SHA-256 `488a6cac9231e297daccc930ae92f38b65137229184d34448a683c398449887e`） | `audits/P02-003_SCHEME_B_V2.9_FINAL_REVISION_AUDIT_REPORT.md` | `D:\Downloads\P02-003_SCHEME_B_V2.9_FINAL_REVISION_AUDIT_REPORT.md` |

> 完整审核轨迹（首审→v2.9 FINAL）见 `10` 与 `00c`。
