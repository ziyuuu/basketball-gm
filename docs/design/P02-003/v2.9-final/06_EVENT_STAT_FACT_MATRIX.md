# 06 — Event · Stat · Fact Matrix（事件/统计/事实矩阵）

版本：v2.9（修订：V28-02 BOXOUT actor 例外；前版 V27-02/V27-03 保持）
日期：2026-08-03
状态：COMPLETE

满足 Phase 4 通过条件：所有统计由事件累积；不允许终场后重新生成；球队统计=球员合计；关键创造行为可追溯。

## A. 分层定义（合同闭合）

| 层 | 合同/设计定义 |
|---|---|
| `MatchEvent` | 合同 `MatchEventSchema`：matchId/eventId/eventHash/cursor/period/possessionIndex/segmentIndex/localEventSequence/eventType/previousAnchorHash/nextAnchorHash/payload |
| `MatchEventType` | **合同闭合 16 项**（F-104） |
| `MatchFact` | 合同 `MatchFactSchema`：factKind(EXPLANATION/STATISTICAL/OBSERVATION) + sourceEventIds + payload；创建机会/解释用 fact 表达（F-41） |
| box score reducer | 合同 `PlayerBoxScoreSchema` 累积（F-134）；球队=球员合计（F-139） |
| 展示事件 | 文字直播/未来 2D 消费已提交事件（F-38~40） |
| LLM 未来可读 | EXPLANATION/STATISTICAL facts 结构化（非本阶段实现） |

## B. 合同事件目录（16 项 → 统计影响）

| EventType | 统计影响 | 归因绑定（合同 superRefine） |
|---|---|---|
| `CLOCK_ADVANCED` | 上场秒数（min） | 无球员 |
| `POSSESSION_STARTED` | 球权起始 | side = 前一 Anchor 持球方 |
| `POSSESSION_ENDED` | 球权结束 | side = 前一 Anchor 持球方 |
| `TURNOVER` | TOV | playerId ∈ 持球方 |
| `FOUL` | PF | OFFENSIVE→持球方，否则对方 |
| `FREE_THROW` | FTM/FTA | shooterId ∈ 持球方 |
| `SHOT` | FGM/FGA/3PM/3PA（INSIDE/MID_RANGE/THREE_POINT） | shooterId ∈ 持球方 |
| `REBOUND` | ORB/DRB | OFFENSIVE→持球方，DEFENSIVE→对方 |
| `SCORE` | PTS | side = 持球方，playerId ∈ side |
| `ASSIST` | AST | playerId ∈ 持球方，sourceEventId 回指 |
| `STEAL` | STL | playerId ∈ 对方，sourceEventId 回指 |
| `BLOCK` | BLK | playerId ∈ 对方，sourceEventId 回指 |
| `SUBSTITUTION` | 上场秒数 | side 双方，forced 标记 |
| `EFFECT_APPLIED` | — | effectKey |
| `PERIOD_COMPLETED` | 节次 | period |
| `MATCH_COMPLETED` | 终场/终止 | terminationReason(COMPLETED/FORFEIT_INSUFFICIENT_PLAYERS) |

**归因闭合规则**（合同 schemas superRefine，F-138）：SHOT/SCORE/FT/REBOUND(进攻)/ASSIST→持球方；STEAL/BLOCK/REBOUND(防守)→对方；FOUL(OFFENSIVE)→持球方否则对方。越界或错队归因被验证器拒绝。

## C. 统计口径

### C.1 球员统计（合同 `PlayerBoxScoreSchema`）
`secondsPlayed, points, fieldGoalsMade/Attempted, threePointersMade/Attempted, freeThrowsMade/Attempted, offensiveRebounds, defensiveRebounds, assists, steals, blocks, turnovers, personalFouls`

- 命中 ≤ 出手；三分命中 ≤ 三分出手；三分出手 ≤ 总出手（合同 superRefine）。
- 得分 = 2×两分命中 + 3×三分命中 + 罚球命中（F-136）。
- 每次命中至多 1 助攻、每受压失误至多 1 抢断、每未命中至多 1 封盖（F-110）。

### C.2 球队统计
- 合同 `TeamBoxScoreSchema` = `{ players: PlayerBoxScore[] }`。**球队统计 = 球员合计；无独立球队行**（F-139）。
- 分节/加时合计 = 终场；出场秒数按实际人数×区间时长核对（F-136/137）。
- 归属：官方口径——助攻一球一助；抢断需主动接触；盖帽需改变飞行（`01` R17/18，与合同一致）。

## D. 创建机会 Fact 字段级合同（修复 B-B07 / E-B02）

创建机会事实（突破创造空间/掩护/空切/弱侧空位/高位组织/花式传球）由事件 reducer 生成 `MatchFact`（factKind=EXPLANATION），**payload 字段级冻结**如下：

```
CreationFactPayload {
  creatorId: string,            // 创造者 playerId
  beneficiaryId: string,        // 受益者 playerId（空位/接球者）
  behaviorId: BehaviorId,       // 创造行为（DRIVE/SHAKE/ISO/STEP_BACK/POSTUP/
                                //   HIGH_POST_CREATION/SCREEN/CUT/HELDKICK/DOUBLECREATE/CREATIVE_PASS）
  opportunityQualityDelta: milli, // perEventEffective（V26-03：raw→±6 cap 后的 effective，编码 = 机会质量点 × 1000，N2）
  defensiveResponse: enum,      // 防守应对：NONE / CONTESTED / DOUBLE_TEAM / COLLAPSED
  period, possessionIndex, segmentIndex,  // 坐标
  nextBehaviorId: BehaviorId | null,  // 后续独立行为（如 LAYUP/MID/HPASS）
}
```
> **N3 修复**：payload **不含 `sourceEventIds`**。CreationFact 的源事件由 MatchFact **顶层 `sourceEventIds`** 承载（合同 `MatchFactSchema` 字段），即 `MatchFact.sourceEventIds` 回指触发该创造的行为事件（如 DRIVE 的 CLOCK_ADVANCED）。payload 内不再重复该字段，避免两处可能不一致（N3）。

**字段约束**：
- `creatorId`/`beneficiaryId` 必须 ∈ 该侧登记名单（合同验证器同款约束）。
- `MatchFact.sourceEventIds` 必须回指本场已提交事件，UTF-16 排序（合同 MatchFact 约束）。
- 一次创造至多一个 CreationFact（不重复记账）。

**reducer 消费规则（V26-03）**：
- **Fact 记录 `perEventEffective`**（该行为 raw→±6 cap 后的 effective，`05` §C.9 四层公式）；shot 机会质量输入用 `netPossessionDelta = clamp(Σ perEventEffective, -6, +6)`，进最终 `finalOpportunityQuality = clamp(基础 + net, 0, 100)`。
- 同一球权多个 CreationFact 的 effective 经 net cap（SCREEN→CUT → net=+6 唯一）。
- `tacticExecutionRate = successfulTacticExecutions / tacticExecutionOpportunities`：成功创造（有下一行为且命中机会质量）计 successful，机会本身计 opportunity。
- `defensiveBreakdownEvents`：`defensiveResponse != NONE` 且对方空位命中的创造事件计数。
- 区域机会占比（§C.2/`07` S4）：由 CreationFact 的 `beneficiaryId` 后续出手射区统计得出。
- 上述指标全部由 fact/event reducer 稳定得出，供 `07` 方向场景 Gate 消费。

## E. 团队篮板 / 团队失误（修复 B-B06 / E-B01）

**现状**：合同 `REBOUND`/`TURNOVER` 事件强制绑定球员；`TeamBoxScoreSchema` 无独立团队行。**P02-003 无几何位置模型**（无 x/y 坐标），任何依赖"离球最近"或空间距离的归因规则不可实现——归因必须从事件流已确定的状态派生。

**决定（Owner 2026-08-03 已决策）**：**采用选项 2（简化口径，无几何依赖）**，全文唯一口径。

- **选项 1（不采用，仅备选）**：最小 Schema 增补（`REBOUND` 增加 `kind: 'TEAM'`、`TURNOVER` 增加 `teamTurnover`、box score 团队行）。代价：改 P02-002 合同；仅 P06+ 需完整官方 box score 时考虑。
- **选项 2（采用，无几何依赖）**：**不为团队事件编造个人归因**，全部从事件流确定状态派生：
  - **投篮不中 + 球出界（无人控制）**：不产生 `REBOUND` 事件（无人抢到球，本不该有个人篮板）；球权经 `POSSESSION_ENDED` → 掷入给防守方；官方"team rebound"用 EXPLANATION fact 记录，box score 无个人篮板（个人统计零污染）。
  - **传球/运球出界**：`TURNOVER(UNFORCED_DEAD_BALL)`，`playerId = 传球者/持球者`（事件流中确定存在）。
  - **时钟违例**：`TURNOVER(UNFORCED_DEAD_BALL)`，`playerId = 当前持球者`（由 `BALL_HANDLER` draw 确定的持球状态，resolver 内部必有）。
  - **盖帽散球（活球）**：抢到者正常 `REBOUND`（个人篮板）；若出界则按 V23-01 规则（防守者最后触球→进攻方继续；进攻方最后触球→防守方新 possession）。
  - 球队统计=球员合计；官方口径（team rebound/team turnover）由 EXPLANATION fact 表达，不进入 box score 独立行。

**盖帽后出界（V23-01 修正，遵循 FIBA 23.2.1；与 `04` §B.6/`09` G4/G5 完全同术语）**：
- 防守者盖帽、且**防守者最后触球**将球盖出界 → **进攻方继续**（同 possessionIndex、segment+1，shotClock carry），无 REBOUND、无 TOV。
- 防守者盖帽后球反弹、**进攻方最后触球**出界 → 进攻方 `TURNOVER(UNFORCED_DEAD_BALL)`，防守方新 possession。
- 无法判断最后触球 → 确定性简化归进攻方（盖帽为防守受迫动作，无从判断时归进攻方，避免防守方凭空获利）。

**全文仅保留选项 2**（`09` G4/G5、`04` §B.6、`00b`/`00c`、`11` 已同步；R05/V22-05/V23-01 修复）。不存在"待决策"或第二套口径。

## F. 成功传球因果链（修复 E-B03 + R04）

普通传球成功只产生 `CLOCK_ADVANCED`，不足以恢复"最后一次合法传球者"。**修复**：

- 每次成功传球（PASS/HPASS/CREATIVE_PASS/ASTOPP/HELDKICK）在 reducer 中生成一个内部 PASS 记录，**即使事件只有 CLOCK_ADVANCED**，也通过伴随的 EXPLANATION fact 记录：`{ passerId, receiverId, behaviorId, possessionIndex, segmentIndex, sequence }`。
- 助攻归因（§C 助攻候选 = 同一球权最后一次合法传球者）从该 fact 链恢复，不依赖事件 payload 扩展。
- 该 fact 的 `sourceEventIds` 回指对应 CLOCK_ADVANCED 事件。
- **约束**：不新增合同事件类型；只在 MatchFact payload 中承载。

### F.1 助攻因果链唯一化（修复 R04）

**唯一因果链**（所有传球行为，含 CREATIVE_PASS，统一）：
```
传球成功 → 只登记"最后一次合法传球候选"（PASS fact，不含 ASSIST 事件）
  → 后续同球权 SHOT(made)
  → 执行 ASSIST_ATTRIBUTION draw
  → 命中且归因成功 → 生成 ASSIST 事件
  → 未命中 / 无候选 / 归因失败 → 不生成 ASSIST
```

- **禁止**在传球成功时直接生成 ASSIST 事件（R04 冲突 1）。
- **禁止**仅凭传球行为写 AST 统计；AST 只能由 `ASSIST` 事件累积，该事件只在"made SHOT 后归因"发生（R04 冲突 2）。
- `04` §B.3 中 CREATIVE_PASS 的事件/统计列已同步改为"助攻候选→命中后 AST；失败 TOV"。
- 每次命中至多 1 助攻（F-110）。

### F.2 receiver / beneficiary 确定性选择（修复 V23-04 + V24-04）

PASS/HPASS/CREATIVE_PASS/ASTOPP/HELDKICK 的接球者（receiver），以及 SCREEN/CUT/DOUBLECREATE/HIGH_POST/HELPD 的受益者（beneficiary），由确定性合同选择（合同 drawKind 不可新增，复用 `BALL_HANDLER`，ordinal `2000..2999`，`05` §H.2）：

```
receiver/beneficiary 候选集合 =
  该侧（进攻方/受益方）当前在场球员 − 传出者/创造者
  （对 HELPD/DOUBLET 失败的受益者：对方场上球员）

候选权重 = 场景可用性 × 基础权重   （基础权重见 `05` §D.2；无几何，用稳定属性代理）
  传球/助攻类（PASS/HPASS/CREATIVE_PASS/HELDKICK）：所有合法候选权重 = 1（均匀），仅场景可用性过滤
  受益者类（SCREEN→持球者固定；CUT→空切者固定；DOUBLECREATE/HIGH_POST→按 §C.9 成功结果）

receiver_ordinal = 2000 + 该传球/创造行为的 behaviorSelectionOrdinal   （V25-04，绑定选择实例）
选择 = keyedDraw(BALL_HANDLER, receiver_ordinal) 按候选权重归一化抽取
候选排序 = playerId UTF-16（stable sort，与合同 canonical 一致）
```

**规则（V23-04 + V24-04 + V25-04）**：
- 同候选顺序变化不改变 receiver（stable sort + keyed draw 与顺序无关，V23-04 反例）。
- **receiver 成为权威当前持球者（V24-04）**：成功传球后，receiver **立即成为该球权的当前 handler**，不再重新从全队候选抽选。后续行为以 receiver 为持球者决策；除非后续事件（抢断/失误/再次传球/得分）明确改变球权。
- **receiver_ordinal 绑定行为选择实例（V25-04）**：同一片段两次 PASS 分别用 `2000+0`、`2000+1`；前一 PASS 分支缺失不改变后一 receiver key。
- **空候选回退唯一化（V25-04）**：合法候选集合**为空** → 该传球/创造行为**不可用**（场景可用性=0，不进入候选，行为失败处理），**不读取空集合、不产生 self-pass**。不再"从空集合取最小 ID"。
- receiver/beneficiary 写入 CreationFact/PASS fact（§D/§F）。
- 日志/Fact 开关不改变 beneficiary（keyed draw 不依赖日志；N 验证）。

### F.3 多参与者行为 actor 选择（修复 V24-04）

screener/cutter/helper/doubler/creator 执行者的确定性选择（`BALL_HANDLER` ordinal `3000..3999`，`05` §D.6；**BOXOUT 例外：RULE_RESULT，无 actor draw，boxer 由 REBOUND 规则派生，V28-02**）：

```
actor 候选集合 = 该侧当前在场球员 − 持球者/已固定 creator
  （DOUBLET：**确定性 top-2**，无随机 draw —— interiorDefense 降序前二 + playerId UTF-16 稳定排序，V25-04）
候选权重 = 场景可用性 × 1（均匀，无几何无法空间加权）
actor_ordinal = 3000 + 该行为的 behaviorSelectionOrdinal   （V25-04，绑定选择实例）
选择 = keyedDraw(BALL_HANDLER, actor_ordinal) 按候选权重归一化
候选排序 = playerId UTF-16（stable sort）
空候选（集合为空）→ 该行为**不可用**（场景可用性=0，不进入候选），不触发、不读取空集合（V25-04）
```

**规则（V24-04 + V25-04）**：
- actor 候选**排除持球者/固定 creator**。
- **DOUBLET 两名 defender 确定性 top-2**（interiorDefense 降序 + playerId 稳定排序），**不用随机 draw**（V25-04：消除"随机 vs 确定性"并存）；候选数组重排不改变两名 defender（反例 8）。
- **actor_ordinal 绑定行为选择实例**（V25-04）：两次 SCREEN → `3000+0`、`3000+1`；前一 actor 分支缺失不改变后一语义实例 key（反例 5）。
- actor 写入行为执行：SCREEN→screener、CUT→cutter、HELPD→helper、DOUBLET→两名 defender、STLTRY→抢断者（**BOXOUT 例外（V28-02）：RULE_RESULT，不参加 actor draw；boxer 由 REBOUND 规则确定性派生——同侧争抢候选（非持球者）中 `个人篮板执行` 最高者，并列 playerId UTF-16 稳定排序，见 `05` §C.4/C.10。BLK 移出：missed SHOT 后归因，非 selectable actor，见 `05` §C.6**）。
- actor 的能力用于 `05` §C.9 执行公式；actor 写入 CreationFact.creatorId / 行为 Fact。
- actor 候选数组重排不改变 actor（stable sort + keyed draw）。

## G. 事实与展示（F-38~41）

| 类别 | 是否展示 | 表达 |
|---|---|---|
| 普通传球/跑位/站位 | 否 | 仅 CLOCK_ADVANCED（+ PASS fact 链 §F） |
| 突破创造空间/包夹/掩护/空切/高质量传球/空位出手/助攻/抢断/盖帽/关键篮板/得分/犯规离场 | 是 | 合同事件 + EXPLANATION/STATISTICAL fact + CreationFact |
| 完整无球运动 | 否 | 不模拟，只记关键结果 |
| 球权变化/得分/球员状态 | 是（2D） | F-15 |

创建机会事实 = `CreationFact`（§D），源为已提交事件（F-41/合同 fact 必须回指 source event）。

## H. Phase 4 通过条件核查

| 条件 | 结论 |
|---|---|
| 所有统计由事件累积 | ✅ B 表全部由 reducer 累积 |
| 不允许终场后重新生成 | ✅ 基线 §12.4 |
| 球队统计可表达 | ✅ 球队=球员合计；团队事件按选项 2 简化口径（§E，已决策） |
| 关键创造行为可追溯 | ✅ CreationFact 字段级合同（§D）+ sourceEventId + drawKey |
| 归因回指实际事件 | ✅ 合同验证器强制 |
| 创建机会可追溯 | ✅ §D CreationFact 的 creator/beneficiary/behavior/coords 全字段回指 |
| 团队事件口径确定 | ✅ §E 选项 2 简化口径（无几何依赖），全文唯一（R05） |
