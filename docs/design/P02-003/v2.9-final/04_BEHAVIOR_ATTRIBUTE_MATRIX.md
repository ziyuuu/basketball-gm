# 04 — Behavior × Attribute Matrix（行为属性矩阵）

版本：v2.9（修订：V28-01 传球链残留清除、V28-02 BOXOUT actor 派生、计数修正 34+10；前版 V27-01~V27-03 保持）
日期：2026-08-03
状态：COMPLETE

满足 Phase 2 通过条件：开发线程无需自行补行为；无废属性；无行为循环死路；每活球行为 ≥1s；球权由事件自然终止。

## A. 行为字段规范

每个行为定义：触发条件、主体、对位/协防参与者、核心专项属性、身体修正、意识修正、倾向输入、特质输入、状态输入、对手输入、**RNG 分类（`05` §C.10 唯一权威：SELECTABLE_DETERMINISTIC/SELECTABLE_ONE_DRAW/RULE_RESULT/ATTRIBUTION_ONLY）**、结果集合、时间消耗、事件输出、统计影响、是否展示。

**关键（V26-01 修正）**：
- 事件输出落在合同 `MatchEventTypeSchema` 闭合枚举内；RNG 落在 `MatchDrawKindSchema` 闭合枚举内（F-104/105）。
- **单行为单判定**：ONE_DRAW 行为一次 RNG {成功/失败}；犯规/失误/归因/机会质量 delta 是**独立后续规则判定**（各自 drawKind）。**并非所有行为都消耗结果 RNG**——DETERMINISTIC 行为 0 次、RULE_RESULT/ATTRIBUTION_ONLY 不可选（`05` §C.10，V26-01 反例 12）。

## B. 行为 × 属性矩阵

### B.1 持球与创造（纯创造行为，不直接终结）

| ID | 行为 | 创造核心属性（唯一权威，V22-01） | 身体修正 | drawKind | 一次RNG结果集 | 成功场景修正 | 后续独立行为 | 时间 | 事件 |
|---|---|---|---|---|---|---|---|---|---|
| ADV | 控球推进 | ballHandling | athleticism | SEGMENT_DURATION/BALL_HANDLER | 推进前场/被逼停 | — | REORG 或进攻 | 1-3s | CLOCK_ADVANCED/POSSESSION_STARTED |
| REORG | 普通调整 | ballHandling | — | BEHAVIOR | 维持球权 | — | 传球/创造/出手 | 1-2s | CLOCK_ADVANCED |
| DRIVE | 突破创造 | **ballHandling**（不用 finishing） | athleticism/bodyImpact | BEHAVIOR | {成功（突破优势）/失败（被逼停）}；**丢球由独立 `TURNOVER_OCCURRENCE` 判定** | 机会质量↑ | LAYUP/CONTACTFIN/HELDKICK | 2-4s | CLOCK_ADVANCED+EXPLANATION |
| SHAKE | 晃人变向 | **ballHandling** | athleticism | BEHAVIOR | {成功（半步空间）/失败（被识破）} | 机会质量↑ | SPOTUP/PULLUP/THREE | 1-3s | CLOCK_ADVANCED+EXPLANATION |
| ISO | 持球单打创造 | **ballHandling** | athleticism | BEHAVIOR | {成功（创造空间）/失败（被逼停）} | 机会质量↑ | PULLUP/MID | 2-4s | CLOCK_ADVANCED+EXPLANATION |
| STEP_BACK | 后撤步（v0.7 新增） | **ballHandling**（**不用 shooting**；shooting 仅进入后续 MID 命中） | athleticism | BEHAVIOR | {成功（创造出手空间）/失败（被识破）} | 机会质量↑ | MID（后撤步跳投） | 2-3s | CLOCK_ADVANCED+EXPLANATION |
| POSTUP | 背身要位 | **ballHandling**（**不用 finishing**；finishing 仅进入后续 HOOK/CLOSE 终结） | bodyImpact | BEHAVIOR | {成功（背身优势）/失败（被顶住）} | 机会质量↑ | HOOK/CLOSE | 2-5s | CLOCK_ADVANCED+EXPLANATION |
| HIGH_POST_CREATION | 高位组织（v0.7 新增） | **playmaking** | — | BEHAVIOR | {成功（弱侧空位）/失败（组织中断）} | 机会质量↑ | HPASS/SPOTUP | 2-4s | CLOCK_ADVANCED+EXPLANATION |

**创造行为统一权威（V22-01）**：
- **结果集**：所有创造行为一次 RNG 只有 {成功/失败} 两结果。**丢球不在此结果集内**——丢球由独立 `TURNOVER_OCCURRENCE` 判定（`05` §C.1），不并入创造行为（`02` F-35a 同口径）。
- **属性分层**：STEP_BACK 创造核心 = ballHandling（不用 shooting）；POSTUP 创造核心 = ballHandling（不用 finishing）。shooting/finishing 只进入**后续终结/出手行为**的命中阶段，机会质量与命中各消费一次（`05` §B/§C.8）。
- **犯规边界**：防守犯规在独立 `DEFENSIVE_FOUL` drawKind 判定；进攻犯规在独立 `OFFENSIVE_FOUL` drawKind 判定。不并入创造行为。

### B.2 投篮与终结（独立行为，`SHOT` drawKind）
| ID | 行为 | 核心 | 射区 | drawKind | 事件 | 时间 | 统计 |
|---|---|---|---|---|---|---|---|
| SPOTUP | 空位投篮 | shooting | MID_RANGE/THREE_POINT | SHOOTER→SHOT | SHOT | 1-2s | FGM/FGA |
| CATCHSHOT | 接球投篮 | shooting | THREE_POINT | SHOOTER→SHOT | SHOT | 1-2s | FGM/FGA/3PM |
| THREE | 三分 | shooting | THREE_POINT | SHOOTER→SHOT | SHOT | 2-3s | 3PM/3PA |
| MID | 中投 | shooting | MID_RANGE | SHOOTER→SHOT | SHOT | 1-2s | FGM/FGA |
| PULLUP | 干拔（运球急停跳投） | shooting | MID_RANGE | SHOOTER→SHOT | SHOT | 2-3s | FGM/FGA |
| CLOSE | 近距离 | finishing | INSIDE | SHOOTER→SHOT | SHOT | 1-2s | FGM/FGA |
| FLOATER | 抛投 | finishing | INSIDE | SHOOTER→SHOT | SHOT | 1-2s | FGM/FGA |
| HOOK | 勾手 | finishing | INSIDE | SHOOTER→SHOT | SHOT | 1-2s | FGM/FGA |
| LAYUP | 上篮 | finishing | INSIDE | SHOOTER→SHOT | SHOT | 1-2s | FGM/FGA |
| CONTACTFIN | 对抗终结 | finishing | INSIDE | SHOOTER→SHOT | SHOT | 2-3s | FGM/FGA |
| CONTESTEDFIN | 干扰终结 | finishing | INSIDE | SHOOTER→SHOT | SHOT | 1-2s | FGM/FGA |
| FT | 罚球 | shooting | — | **SHOT**（罚球命中判定，localIndex 递增） | FREE_THROW | 1s | FTM/FTA |

命中率公式（基线 §12.4，`05`）：`clamp(区域基础 + 0.0025×(区域进攻执行-区域防守执行) + 0.0015×(机会质量-50), 下限, 上限)`。

### B.3 传球与组织
| ID | 行为 | 核心 | drawKind | 事件 | 时间 | 统计 |
|---|---|---|---|---|---|---|
| PASS | 普通传球 | playmaking | **TURNOVER_OCCURRENCE（唯一链，V27-02）** | 未发生→CLOCK_ADVANCED+PASS fact；发生→TURNOVER | 1-3s | 成功→receiver 权威化+助攻候选；失败→TOV |
| HPASS | 高质量传球 | playmaking | **TURNOVER_OCCURRENCE（唯一链）** | 同上 | 1-3s | 助攻候选 |
| CREATIVE_PASS | 花式传球（v0.7 新增，独立风险收益） | playmaking | **TURNOVER_OCCURRENCE（唯一链）** | 未发生→CLOCK_ADVANCED+机会质量delta（C.7）；发生→TURNOVER | 2-4s | 成功→receiver+delta+助攻候选；失败→TOV |
| ASTOPP | 助攻机会创造 | playmaking | **TURNOVER_OCCURRENCE（唯一链）** | 同上 | 1-3s | 助攻机会 |
| HELDKICK | 突破分球 | playmaking | **TURNOVER_OCCURRENCE（唯一链）** | 未发生→receiver+delta；发生→TURNOVER | 1-3s | 助攻候选 |
| PASSTOV | 传球失误 | ballHandling×playmaking | TURNOVER_CLASSIFICATION | TURNOVER | 1-2s | TOV |
| BALLDESTROY | 被破坏传球 | perimeterDefense | TURNOVER_OCCURRENCE | TURNOVER(UNFORCED_DEAD_BALL) | 1-2s | 对方 TOV |

> **V27-02（唯一传球链）**：所有传球行为（PASS/HPASS/CREATIVE_PASS/ASTOPP/HELDKICK）统一为**单 draw `TURNOVER_OCCURRENCE`**——未发生即传球成功（receiver 权威化 + 助攻候选），发生即 PASSTOV。**不设独立 BEHAVIOR success draw**；实际失误概率恒等于 §C.1 的 p，无"失败但未 turnover"悬空状态（`05` §C.10）。

**防守冒险**（F-32/67）：防守者按 `defensiveRisk` 对 `100-defensiveRisk` 二态选择"稳守（-3）/冒险（+4）"；冒险未制造失误则本方后续防守执行 -2、对方机会质量 +3。

### B.4 无球关键结果（机会质量 + EXPLANATION fact）
| ID | 行为 | 核心 | 表达 |
|---|---|---|---|
| SCREEN | 掩护创造优势 | tacticalUnderstanding | 机会质量↑ + EXPLANATION fact |
| CUT | 空切形成机会 | tacticalUnderstanding | 机会质量↑ + EXPLANATION fact |
| HELDKICK | 突破吸引协防外传 | playmaking | 弱侧空位 + 助攻候选 |
| DOUBLECREATE | 包夹后弱侧空位 | tacticalUnderstanding | 弱侧空位 + EXPLANATION fact |
| PUTBACK | 二次进攻 | finishing×rebounding | ORB 后 SHOT(INSIDE) |

**执行概率合同（V23-03，V28-01 修订）**：SCREEN/CUT/DOUBLECREATE 的进攻/防守执行、success 概率、clamp、drawKind/ordinal、结果转移见 `05` §C.9；**HELDKICK 属传球族（V27-02/V28-01），唯一结果判定 = 单 draw `TURNOVER_OCCURRENCE`（无独立 BEHAVIOR success），分球质量为成功后确定性 CreationFact delta**（`05` §C.9/C.10）。PUTBACK 是 **rule-result**（不进 `P_select(b)`，仅 ORB 后触发，`05` §D.2）。HELDKICK 倾向统一为 `passSelection`（`05` §D.5）。

### B.5 防守
| ID | 行为 | 核心 | drawKind | 事件 | 时间 | 结果 |
|---|---|---|---|---|---|---|
| ONDEF | 稳健单防 | 位置对应防守 | DEFENSIVE_ACTION 0..99（模式） | CLOCK_ADVANCED | 1-3s | 压低命中 |
| PRESS | 压迫防守 | perimeterDefense | DEFENSIVE_ACTION 1000..1999 | CLOCK_ADVANCED | 1-2s | 成功→TURNOVER_OCCURRENCE+0.03；失败→对方+8 |
| STLTRY | 抢断尝试 | perimeterDefense | STEAL_ATTRIBUTION（仅 PRESSURED_LIVE_BALL 后） | CLOCK_ADVANCED | 1-2s | **提高 STEAL_ATTRIBUTION 归因率；不直接 STEAL/FOUL（V27-03）** |
| CONTEST | 投篮干扰 | 位置对应防守 | 并入区域防守执行（无执行 draw） | SHOT | 1-2s | 压低命中 |
| BLK | 封盖 | interiorDefense | BLOCK_ATTRIBUTION（missed SHOT 后） | BLOCK | 1-2s | 盖帽/干扰（不改写命中结果；BLK 失败不决定犯规） |
| HELPD | 协防 | interiorDefense | DEFENSIVE_ACTION 1000..1999 | CLOCK_ADVANCED | 1-2s | 成功→压低机会质量-10；失败→对方+8（**不直接 TURNOVER/FOUL，V27-03**） |
| DOUBLET | 包夹 | perimeter+interior | DEFENSIVE_ACTION 1000..1999 | CLOCK_ADVANCED | 1-3s | 成功→TURNOVER_OCCURRENCE+0.03；失败→独立 DEFENSIVE_FOUL，不犯规才对方+8（**不直接 TURNOVER/FOUL，V27-03**） |
| TRANSITIOND | 退防 | athleticism | TRANSITION | CLOCK_ADVANCED | 1-3s | 限制转换 |
| FOUL | 犯规 | bodyImpact | **DEFENSIVE_FOUL/OFFENSIVE_FOUL（判定发生）→ FOUL_TYPE（仅分类）** | FOUL(PERSONAL/SHOOTING/OFFENSIVE) | 1-2s | 犯规（V27-03：FOUL_TYPE 不决定是否犯规） |

**执行概率合同（V23-03 + V25-02 + V26-01 + V27-03）**：**所有防守行为的事件/结果列以上述 `05` §C.9/§C.10 唯一 resolver 链为准**——STLTRY 不直接 STEAL/FOUL、HELPD/DOUBLET 不直接 TURNOVER/FOUL、FOUL 发生由 DEFENSIVE_FOUL/OFFENSIVE_FOUL 判定。行为唯一分类见 `05` §C.10。

### B.6 篮板
| ID | 行为 | 核心 | drawKind | 事件 | 时间 | 统计 |
|---|---|---|---|---|---|---|
| ORB | 进攻篮板 | rebounding | REBOUND | REBOUND(OFFENSIVE) | 1-2s | ORB |
| DRB | 防守篮板 | rebounding | REBOUND | REBOUND(DEFENSIVE) | 1-2s | DRB |
| BOXOUT | 卡位 | rebounding×bodyImpact | REBOUND（规则派生，无独立 actor draw，V28-02） | CLOCK_ADVANCED（属 REBOUND 片段，非独立 BOXOUT 事件，V29） | 1-2s | 提高执行（boxer 由 REBOUND 规则确定性派生；执行加成 首候选 +4，范围 [3..5]） |
| BLKLOOSE | 盖帽散球 | rebounding | REBOUND | REBOUND | 1s | 归属判定 |
| 出界（投篮不中无人控制） | — | — | — | 无 REBOUND、无 TURNOVER；`POSSESSION_ENDED` → 掷入防守方 | 1s | 无个人统计（EXPLANATION team rebound fact） |
| 出界（传球/运球） | — | — | TURNOVER_CLASSIFICATION | `TURNOVER(UNFORCED_DEAD_BALL)`，playerId=传球者/持球者 | 1s | 个人 TOV |

**出界归因分来源（修复 R05，对齐 G4 选项 2）**：
- 投篮不中 + 无人控制出界 → **不产生 REBOUND、不产生 TURNOVER**；球权经 `POSSESSION_ENDED` → 掷入给防守方；官方 team rebound 用 EXPLANATION fact 记录（`06` §E）。
- 传球/运球出界 → `TURNOVER(UNFORCED_DEAD_BALL)`，playerId=传球者/持球者。
- 不允许把投篮出界统一映射成 turnover（R05）。

**出界归属分来源表（V23-01 修正，遵循 FIBA 23.2.1：球出界由出界前最后触球者造成，球权给其对手）**：
| 出界来源 | 是否 TURNOVER | playerId | 球权归属 | 下一坐标 |
|---|---|---|---|---|
| 投篮不中 + 无人控制出界 | 否（无 REBOUND 无 TOV） | — | 防守方掷入（最后触球为投篮方，其对手得球） | 对方新 possessionIndex，segment=0 |
| 传球/运球出界 | 是 | 传球者/持球者 | 对方掷入 | 对方新 possessionIndex，segment=0 |
| 防守者盖帽、且**防守者最后触球**将球盖出界 | 否 | 无个人统计 | **进攻方继续**（最后触球者=防守方，其对手=进攻方得球） | **进攻方同 possessionIndex、segment+1；shotClock 按同方出界 carry（继承剩余）** |
| 防守者盖帽后球反弹，**进攻方最后触球**出界 | 是 | 进攻方最后触球者 | 防守方掷入 | 防守方新 possessionIndex，segment=0 |
| 无法判断最后触球 | 否（确定性简化） | 无个人统计 | **进攻方继续**（盖帽为防守受迫动作，无从判断时归进攻方，避免防守方凭空获利） | 进攻方同 possessionIndex、segment+1；shotClock carry |

- **核心修正（V23-01）**：防守者最后触球盖出界 → **进攻方继续**（同 possession 新 segment，shotClock 按同方出界 carry），**不是**防守方球权。FIBA 23.2.1。
- 只有进攻方最后触球出界才记进攻方 UNFORCED TOV（防守方得球权）。
- **无判断时确定性简化归进攻方**——这是明确的游戏简化，与"已知防守者最后触球"情形（也归进攻方）一致，不与篮球规则冲突（V23-01 Non-Blocking 6 声明）。
- 该表与 `09` G4/G5、`06` §E 术语完全一致。

前场篮板率（基线 §12.4）：`clamp(0.27 + 0.0025×(进攻篮板执行-防守篮板执行), 0.12, 0.45)`。

## C. 属性有效性矩阵

### C.1 每属性不可替代用途
| 属性 | 不可替代用途 | 万能？ |
|---|---|---|
| `finishing` | 篮下/对抗终结（SHOT INSIDE 主体） | 否 |
| `shooting` | 中远投/罚球（SHOT MID/THREE + FT） | 否 |
| `ballHandling` | 持球推进/护球/突破创造/失误抵抗 | 否 |
| `playmaking` | 传球/助攻/空位创造（HPASS/CREATIVE_PASS/HIGH_POST） | 否 |
| `perimeterDefense` | 外线压制/抢断/突破防线 | 否 |
| `interiorDefense` | 内线防守/封盖/低位 | 否 |
| `rebounding` | 篮板归属 | 否 |
| `athleticism` | 突破/退防/封盖/冲板修正 | 否（只入执行组合） |
| `stamina` | 疲劳负荷增长速率 | 否 |
| `tacticalUnderstanding` | 选择质量/团队执行/传切/轮转 | 否（只作组合修正） |
| `bodyImpact` | 内线对抗/犯规/篮板卡位 | 否 |

### C.2 覆盖率核查
- 11 字段全覆盖 ✅
- 无万能属性 ✅
- `athleticism` vs `bodyImpact` 语义分离 ✅

### C.3 倾向主导核查（F-69~73）
- 组织型中锋：高 `passSelection`+高 `playmaking` → 传球权重高 ✅
- 3D 后卫：高 `defensiveRisk`+低持球倾向 → 防守角色 ✅
- 多高持球：`possessionParticipation` 竞争 → 可观察割裂 ✅

## D. Phase 2 通过条件核查

| 条件 | 结论 |
|---|---|
| 开发线程无需自行补行为 | ✅ **44 个 behavior ID**（34 selectable + 10 rule-result/attribution-only，`05` §C.10/D.2 canonical registry 唯一权威；含 STEP_BACK/HIGH_POST_CREATION/CREATIVE_PASS）全定义且映射合同 drawKind/事件 |
| 无废属性 | ✅ C.1 |
| 无行为循环死路 | ✅ 结果有转移；球权由事件终止 |
| 每活球行为 ≥1s | ✅ 全部 ≥1s |
| 球权自然终止 | ✅ 得分/篮板/失误/犯规/违例/节末 |
