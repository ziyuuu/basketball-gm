# 05 — Probability & Parameter Registry（概率与参数 Registry）

版本：v2.9（修订：V28-01 传球链残留清除、V28-02 BOXOUT actor 派生、计数修正 34+10；前版 V27-01/V27-02/N02 保持）
日期：2026-08-03
状态：COMPLETE（[CALIBRATE] 初值待开发计划 §7.4 场景校准）

满足 Phase 3 通过条件：同因素只一次；所有概率有上下界；无隐性 0%/100%；高星优势来自具体能力；低星有合理成功概率。

## A. 统一判定框架（基线 §12.4，结构冻结）

P02 概率模型是**执行值差式**，非乘法模型。修正只结算一次，固定顺序（F-125）：

```
对一次行为判定：
1. 能力组合 → 进攻执行 / 防守执行（0-100）
2. − 疲劳执行惩罚（减法，F-75）
3. ± 位置错配执行点（副-3 / 其他-8，F-100）
4. ± 特质执行点（+6，F-89~96）
5. ± 单次封顶 ±6 战术执行点（F-115）
6. 关键公式（失误率/命中率/篮板率/犯规率/归因率）
7. 一次 rng(drawKey) 判定：命中 ⟺ rng < P
```

**禁止**在概率公式外再次乘入疲劳、位置、特质或同一战术效果（F-125）。

## B. 执行值组合（基线 §12.4，[CALIBRATE] 系数可调、结构冻结）

| 执行值 | 公式 |
|---|---|
| 护球组织 | 0.50×控球 + 0.30×组织 + 0.20×战术理解 |
| 防守压力 | 0.55×对位外防 + 0.25×运动 + 0.20×战术理解 |
| 篮下进攻 | 0.55×终结 + 0.20×运动 + 0.15×体型 + 0.10×战术理解 |
| 篮下防守 | 0.50×内防 + 0.20×运动 + 0.20×体型 + 0.10×战术理解 |
| 中投进攻 | 0.65×投射 + 0.20×终结 + 0.15×战术理解 |
| 中投防守 | 0.45×外防 + 0.25×内防 + 0.15×运动 + 0.15×战术理解 |
| 三分进攻 | 0.80×投射 + 0.20×战术理解 |
| 三分防守 | 0.65×外防 + 0.20×运动 + 0.15×战术理解 |
| 创造执行（空位/传球创造） | 0.55×创造者组织 + 0.25×创造者控球 + 0.20×创造者战术理解 |
| 突破创造执行（DRIVE） | 0.55×控球 + 0.25×运动能力 + 0.20×战术理解 |
| 晃动创造执行（SHAKE） | 0.50×控球 + 0.30×运动能力 + 0.20×战术理解 |
| 单打创造执行（ISO） | 0.50×控球 + 0.30×运动能力 + 0.20×战术理解 |
| 后撤步创造执行（STEP_BACK） | 0.50×控球 + 0.30×运动能力 + 0.20×战术理解（**不用 shooting**，创造空间靠脚步/控球，命中才用 shooting） |
| 背身要位执行（POSTUP） | 0.45×控球 + 0.35×体型影响 + 0.20×战术理解（**不用 finishing**，要位靠体型，终结才用 finishing） |
| 高位组织执行（HIGH_POST_CREATION） | 0.55×组织 + 0.25×控球 + 0.20×战术理解 |
| 团队协作指数 | clamp(50 + 5×团队执行修正, 20, 80) |
| 空间指数 | 其他在场进攻球员平均(0.70×投射 + 0.15×运动 + 0.15×战术理解) |
| 对方协防执行 | 对方非直接对位球员平均(0.50×外防 + 0.30×内防 + 0.20×战术) + 对方团队执行修正 |
| 协防环境 | 100 - clamp(对方协防执行, 0, 100) |
| 机会质量 | clamp(0.35×创造执行 + 0.25×团队协作指数 + 0.20×空间指数 + 0.20×协防环境 + 机会类战术执行点, 0, 100) |
| 个人篮板执行 | 0.60×篮板 + 0.20×体型 + 0.20×运动 |
| 防守控制 | 0.55×相关区域防守 + 0.25×战术理解 + 0.20×运动 |
| 进攻对抗（篮下/突破） | 0.50×终结 + 0.25×运动 + 0.15×体型 + 0.10×控球 |
| 进攻对抗（中投/三分） | 0.60×投射 + 0.20×控球 + 0.20×战术理解 |
| 抢断执行 | 0.60×外防 + 0.25×运动 + 0.15×战术理解 + 动作压力修正 |
| 护球执行 | 0.55×控球 + 0.25×组织 + 0.20×战术理解 |
| 封盖执行 | 0.55×内防 + 0.25×体型 + 0.20×运动 |
| 出手保护（篮下） | 0.50×终结 + 0.25×运动 + 0.15×体型 + 0.10×战术理解 |
| 出手保护（中投） | 0.60×投射 + 0.20×控球 + 0.20×战术理解 |
| 助攻执行 | 0.60×传球者组织 + 0.20×传球者战术 + 0.20×团队协作指数 |
| 自主创造 | 0.45×射手控球 + 0.35×区域主能力 + 0.20×射手运动能力 |

## C. 关键公式（基线 §12.4，[CALIBRATE]）

### C.1 持球/传球失误率
```
失误率 = clamp(
  0.13 + 0.002×(防守压力 - 护球组织)
       + 0.002×动作压力修正
       + 节奏修正
       - 0.002×团队执行修正,
  0.06, 0.25)
受压失误分类率 = clamp(
  0.50 + 0.04×动作压力修正 + 0.002×(防守压力 - 护球组织),
  0.10, 0.90)
```
- 节奏修正：慢 -0.015 / 平衡 0 / 快 +0.015。
- 动作压力修正：稳守 -3 / 冒险 +4（防守动作，F-32）。
- 失误分 `PRESSURED_LIVE_BALL`（可抢断归因）与 `UNFORCED_DEAD_BALL`（出界/违例，无抢断）。
- 进攻犯规已判则不进入本分类。

### C.2 区域命中率
```
区域基础：篮下 0.56 / 中投 0.39 / 三分 0.33
命中率 = clamp(
  区域基础值
  + 0.0025×(区域进攻执行 - 区域防守执行)
  + 0.0015×(机会质量 - 50),
  区域下限, 区域上限)
候选上下限：篮下 0.25-0.80 / 中投 0.15-0.65 / 三分 0.10-0.60
```
- 特质、位置、疲劳和直接战术修正已进入区域执行，不再另加"场景执行修正"。
- **CONTEST 单一消费（V24-03）**：干扰执行**并入 `区域防守执行`**（`区域防守执行 = 区域防守基础 + 干扰执行`，仅一次），命中率公式**不再次扣减**。禁止在公式外另减命中率。

### C.3 罚球
```
罚球命中率 = clamp(0.75 + 0.003×(投射 - 50) - 0.002×疲劳执行惩罚, 0.45, 0.95)
```
罚球不受默契影响（F-130）。

### C.4 前场篮板
```
前场篮板率 = clamp(0.27 + 0.0025×(进攻篮板执行 - 防守篮板执行), 0.12, 0.45)
```
- 冲抢倾向只决定哪些球员参加争抢与候选权重，不直接提高成功率（F-68/基线 §12.4）。
- 收缩禁区防守篮板 +2 作为防守争抢者直接战术执行点进入。

### C.5 犯规
```
防守犯规率 = clamp(
  场景基础犯规率 + 0.0015×(进攻对抗 - 防守控制) + 动作风险修正,
  0.01, 0.25)
场景基础犯规率：持球压迫 0.04 / 中投三分干扰 0.05 / 篮下突破 0.10
动作风险修正：稳守 -0.015 / 冒险 +0.025

进攻犯规率 = clamp(
  0.02 + 0.001×(防守控制 - (0.50×控球 + 0.30×运动 + 0.20×战术理解)),
  0.005, 0.08)
```
- 突破动作先独立检查进攻犯规；成立则立即失球权 + 进攻者 PF，不再检查防守犯规。
- 防守犯规：投篮动作 → 按区域 2/3 罚或 and-one 1 罚；非投篮 → 死球进攻方保留球权。
- **P02 不模拟球队犯规奖励**（F-109）。

### C.6 抢断 / 封盖 / 助攻归因
```
抢断归因率 = clamp(0.35 + 0.003×(抢断执行 - 护球执行), 0.10, 0.75)
封盖归因率 = clamp(0.08 + 0.002×(封盖执行 - 出手保护), 0.01, 0.25)
助攻归因率 = clamp(0.55 + 0.0025×(助攻执行 - 自主创造), 0.15, 0.90)
```
- 抢断只在 `PRESSURED_LIVE_BALL` 失误中有候选；候选为直接防守者（F-37）。
- 封盖只在篮下/中投未命中后分类，不改变命中结果；候选为直接防守者+至多一名协防者取高者。
- 助攻候选只能是同一球权最后一次合法传球的传球者；命中后检查一次；每次命中至多 1 助攻（F-110）。

### C.7 花式传球（CREATIVE_PASS）风险收益（修复 B-B08/反例5）
```
机会质量收益 = clamp(创意传球机会加成, 0, 机会质量上限)   [CALIBRATE]
失误概率增量 = clamp(创意传球失误风险, 0, 失误率上界)     [CALIBRATE]
合法条件：进攻空间充裕 且 防守冒险压力低
```
- `CREATIVE_PASS` 相对 `PASS`：机会质量收益 `+creativePassOpportunityBonus`（[CALIBRATE]，默认 `+[6..12]` 机会质量点），失误概率增量 `+creativePassTurnoverRisk`（[CALIBRATE]，默认 `+[0.03..0.08]` 失误率）。
- 两个参数独立登记于 Registry，不得与 PASS 共用默认参数。
- 机会质量收益在成功进入机会质量公式（§C.2）；失误概率增量进入 §C.1 失误率。

### C.8 创造行为结果概率合同（修复 R01/R02，行为级冻结）

每个创造行为一次 RNG，结果集与概率如下（[CALIBRATE] 初值）：

| 创造行为 | 创造执行 | 成功概率公式 | 结果转移 |
|---|---|---|---|
| DRIVE | 突破创造执行 | `P_success = clamp(0.45 + 0.002×(突破创造执行 - 防守压力), 0.20, 0.75)` | 成功→机会质量+DRIVE_BONUS；被逼停→REORG；丢球→并入通用失误判定 |
| SHAKE | 晃动创造执行 | `P_success = clamp(0.40 + 0.002×(晃动创造执行 - 防守压力), 0.20, 0.70)` | 成功→机会质量+SHAKE_BONUS；被识破→REORG |
| ISO | 单打创造执行 | `P_success = clamp(0.35 + 0.002×(单打创造执行 - 防守压力), 0.15, 0.65)` | 成功→机会质量+ISO_BONUS；被逼停→REORG |
| STEP_BACK | 后撤步创造执行 | `P_success = clamp(0.40 + 0.002×(后撤步创造执行 - 防守压力), 0.20, 0.70)` | 成功→机会质量+STEPBACK_BONUS；被识破→MID 仍可出手但低质量 |
| POSTUP | 背身要位执行 | `P_success = clamp(0.45 + 0.002×(背身要位执行 - 内线防守执行), 0.20, 0.75)` | 成功→机会质量+POST_BONUS；被顶住→REORG/CLOSE 低质量 |
| HIGH_POST_CREATION | 高位组织执行 | `P_success = clamp(0.50 + 0.002×(高位组织执行 - 对方协防执行), 0.25, 0.80)`（修复 V22-03：比较的是高位组织执行 vs **对方协防执行**，不是协防环境） | 成功→弱侧空位机会；组织中断→REORG |

**创造成功加成（[CALIBRATE]）**：DRIVE_BONUS/SHAKE_BONUS/ISO_BONUS/STEPBACK_BONUS/POST_BONUS ∈ `[8..15]` 机会质量点。
**结果概率归一**：创造行为内部只有"成功/失败"两个结果（一次 RNG）；失败后的转移（REORG/低质量出手）与**丢球失误**分离——丢球由通用 `TURNOVER_OCCURRENCE` 判定（§C.1），不在创造行为内部二次判定（修复 R01 的"丢球与通用失误优先关系"问题）。

**属性分层（修复 R02/V22-01）**：
- STEP_BACK 创造用 `后撤步创造执行`（ballHandling/athleticism/TU），**不用 shooting**；命中阶段 MID 才用 shooting → shooting 只消费一次。
- POSTUP 创造用 `背身要位执行`（ballHandling/bodyImpact/TU），**不用 finishing**；终结阶段 HOOK/CLOSE 才用 finishing → finishing 只消费一次。
- 机会质量和命中公式各消费一次创造属性，不重复增强（F-62）。

**单调性反例（V22-03 关闭验证）**：
- 进攻属性固定、对方协防执行从低到高 → HIGH_POST_CREATION 成功率**不得上升**（必须单调不增）。Gate 测试：固定 64 seed，将对方协防执行 20/40/60/80 递增，断言 P_success 单调不增。
- 同理：防守压力递增 → DRIVE/SHAKE/ISO/STEP_BACK 成功率不得上升；内线防守执行递增 → POSTUP 成功率不得上升。

**丢球归属（V22-01 统一）**：创造行为结果集只含 {成功/失败}；丢球（丢球权）由独立 `TURNOVER_OCCURRENCE` 判定（§C.1），不并入创造行为。全文（`02` F-35a / `03` §6.1 / `04` §B.1 / `05` §C.8）同一口径。

### C.9 无球 / 协防行为执行概率合同（修复 V23-03 + V24-01/V24-03 + V25-02）

**行为 RNG 次数原则（V25-01，对齐 F-33/F-35/F-35b）**：下表每个行为**一次 keyed RNG（ONE_DRAW），结果集只有 {成功/失败}**。失败后**不内嵌二次抽取**；犯规/失误/机会质量 delta 是行为结果后的**独立后续规则判定**（用各自 drawKind）。完整分类见 `05` §C.10。

**机会质量 delta 唯一四层公式（V26-03）**：
```
rawDelta             = 行为结果原始 delta（如 +10 / -10 / +8；HELDKICK 属 +10 集合）
perEventEffective    = clamp(rawDelta, -6, +6)                     // 逐事件 cap
netPossessionDelta   = clamp(Σ perEventEffective（同球权累计）, -6, +6)  // 球权净 cap（V26-03 唯一）
finalOpportunityQuality = clamp(基础机会质量 + netPossessionDelta, 0, 100)
```
- **cap 是逐事件 AND 球权净两层**（V26-03 反例 8：SCREEN→CUT → perEvent each +6 → net = clamp(+6+6, -6, +6) = **+6 唯一**）。
- **C.8 BONUS [8..15] / C.7 CREATIVE_PASS [6..12] 是 `rawDelta` 范围**，实际 `perEventEffective` 由逐事件 ±6 cap 决定（V26-03：范围是 raw，不绕过 cap）。
- **V29 非阻塞（区分度校准）**：±6 cap 压缩 raw BONUS [8..15] / [6..12] 后**区分度偏低**，属 `[CALIBRATE]` 校准项，留至开发计划 §7.4 Gate B 校准；不改变 raw→perEvent→net→final 四层结构。
- **Fact 记录 perEventEffective**（每行为一个 CreationFact，记录该行为 effective）；**shot 机会质量输入用 netPossessionDelta**（V26-03 反例 8：Fact 与有效输入一致）。
- 每次行为至多一个 CreationFact；多个 CreationFact 同球权累计经 net cap。

| 行为 | 分类 | actor（`06` §F.3） | 进攻执行 | 防守执行 | success 概率公式 [CALIBRATE] | clamp | 失败结果 | drawKind/ordinal | 独立后续判定 |
|---|---|---|---|---|---|---|---|---|---|
| SCREEN | ONE_DRAW | screener | 掩护执行 = 0.50×TU + 0.30×bodyImpact + 0.20×athleticism | 挤过执行 = 0.50×perimeterDefense + 0.30×athleticism + 0.20×TU | `P = clamp(0.50 + 0.002×(掩护执行 - 挤过执行), 0.20, 0.80)` | 0.20-0.80 | 掩护失败（无加成） | BEHAVIOR 3000..3999 | 成功→CreationFact（beneficiary=持球者，effective_delta=+10 受 ±6 cap）；失败→CLOCK_ADVANCED |
| CUT | ONE_DRAW | cutter | 空切执行 = 0.50×TU + 0.30×athleticism + 0.20×finishing | 跟防执行 = 0.45×perimeterDefense + 0.25×interiorDefense + 0.15×athleticism + 0.15×TU | `P = clamp(0.45 + 0.002×(空切执行 - 跟防执行), 0.15, 0.75)` | 0.15-0.75 | 空切被挡（无加成） | BEHAVIOR 3000..3999 | 成功→CreationFact（beneficiary=cutter，effective_delta=+10） |
| HELDKICK | SELECTABLE_ONE_DRAW | creator=持球者 | 分球执行 = 0.55×playmaking + 0.25×TU + 0.20×ballHandling | 弱侧协防执行 = 对方非直接对位球员平均(0.50×外防+0.30×内防+0.20×TU) | **单 draw TURNOVER_OCCURRENCE（V27-02 唯一链，V28-01 清除双阶段残留）**：未发生→成功，成功概率=1−p（p 见 §C.1） | p∈[0.06,0.25]（§C.1） | PASSTOV（发生） | **TURNOVER_OCCURRENCE 2000+selectionOrdinal** + receiver（BALL_HANDLER 2000..2999） | 未发生→成功（receiver 权威化 + CreationFact：beneficiary=receiver，**分球质量 delta：raw 属 +10 集合（`分球执行−弱侧协防执行` 确定性定级，§C.9 四层）→ 经 ±6 cap 为 perEventEffective**，非二次 RNG，V27-02 反例 9） |
| DOUBLECREATE | ONE_DRAW | creator | 弱侧组织执行 = 0.50×TU + 0.30×playmaking + 0.20×shooting | 包夹回收执行 = 0.45×interiorDefense + 0.25×perimeterDefense + 0.15×athleticism + 0.15×TU | `P = clamp(0.40 + 0.002×(弱侧组织执行 - 包夹回收执行), 0.15, 0.75)` | 0.15-0.75 | 包夹未形成（无加成） | BEHAVIOR 3000..3999 | 成功→CreationFact（beneficiary=弱侧球员，effective_delta=+10） |
| HELPD | ONE_DRAW | helper | 协防执行 = 0.45×interiorDefense + 0.25×perimeterDefense + 0.20×TU + 0.10×athleticism | 攻方处理执行 = 0.50×ballHandling + 0.30×playmaking + 0.20×TU | `P = clamp(0.50 + 0.002×(协防执行 - 攻方处理执行), 0.20, 0.80)` | 0.20-0.80 | 协防漏人（对方 effective_delta=+8） | DEFENSIVE_ACTION 1000..1999 | 成功→压低攻方机会质量（effective_delta=-10）；失败→对方 effective_delta=+8 + CreationFact（beneficiary=被漏攻方） |
| DOUBLET | ONE_DRAW | 两名 defender（确定性 top-2） | 包夹执行 = 0.40×perimeterDefense + 0.30×interiorDefense + 0.20×TU + 0.10×athleticism | 护球执行 = 0.55×ballHandling + 0.25×playmaking + 0.20×TU | `P = clamp(0.35 + 0.002×(包夹执行 - 护球执行), 0.15, 0.70)` | 0.15-0.70 | 包夹失位 | DEFENSIVE_ACTION 1000..1999 | 成功→TURNOVER_OCCURRENCE 基础率 +0.03；失败→**独立 `DEFENSIVE_FOUL` 判定犯规**（V25-02：不用 FOUL_TYPE 决定是否犯规）；不犯规→对方 effective_delta=+8 |
| PRESS | ONE_DRAW | 压迫者 | 压迫执行 = 0.50×perimeterDefense + 0.25×athleticism + 0.25×TU | 破压迫执行 = 0.50×ballHandling + 0.30×playmaking + 0.20×TU | `P = clamp(0.40 + 0.002×(压迫执行 - 破压迫执行), 0.15, 0.75)` | 0.15-0.75 | 压迫被破（攻方 effective_delta=+8） | DEFENSIVE_ACTION 1000..1999 | 成功→TURNOVER_OCCURRENCE 基础率 +0.03；失败→攻方 effective_delta=+8 |
| STLTRY | **DETERMINISTIC（不消耗执行 draw，V25-02）** | 抢断者 | 抢断执行（进入 `STEAL_ATTRIBUTION` 归因率） | 护球执行 | **无独立 success**；只提高 `STEAL_ATTRIBUTION` 归因率（`§C.6`） | — | 无 STEAL（转普通失误处理） | **STEAL_ATTRIBUTION**（仅在 PRESSURED_LIVE_BALL 失误后） | **先 PRESSURED_LIVE_BALL turnover → 才 STEAL_ATTRIBUTION → 成功才 STEAL** |
| CONTEST | **DETERMINISTIC（不消耗执行 draw，V25-02）** | 直接对位者 | 干扰执行（并入 `区域防守执行`） | — | **无独立 success RNG**；并入 `区域防守执行`（`§C.2`），命中率公式只消费一次 | — | 干扰无效 | 无执行 draw | 干扰执行进入 `区域防守执行`（替代/组合见 `§C.2` 注） |

**BLK 移出本表（V25-02）**：封盖是 **missed SHOT 后的归因**，不是出手前 selectable 行为。BLK 执行合同见 `05` §C.6（`BLOCK_ATTRIBUTION` 只在篮下/中投未命中后分类，不改写命中结果）；**BLK 失败不决定犯规**（犯规由独立 `DEFENSIVE_FOUL` 判定，若出手动作伴随犯规）。

**规则（V25-01/V25-02/V25-03 闭合）**：
- **每个行为一次 keyed RNG（ONE_DRAW），结果集 {成功/失败}**；失败后不内嵌二次抽取（F-35 修订）。
- 犯规由独立 `DEFENSIVE_FOUL` 判定；`FOUL_TYPE` 只在犯规已发生后分类（V25-02）。
- STLTRY/CONTEST 为 DETERMINISTIC（不消耗执行 draw）；STLTRY 不独立制造 STEAL，CONTEST 只进入区域防守执行一次。
- 机会质量 delta：raw → effective（±6 cap）→ 求和 → 最终 clamp；Fact 记录 effective（V25-03）。
- 该表 + §C.10 满足"每个 selectable 行为都有执行概率或确定性声明、结果、drawKind/ordinal、事件/Fact"（V23-03 + V25 关闭）。

### C.10 唯一 Behavior Classification Registry（V27-01 唯一权威：44 行，每 ID 恰好一次，机器校验）

**4 类唯一分类**（`03`/`04`/`05` 全文只引用本表，不得另写）：

| 分类 | 含义 | 是否进 `P_select` |
|---|---|---|
| `SELECTABLE_DETERMINISTIC` | 可选择，效果由事件规则决定（0 次结果 RNG） | 是 |
| `SELECTABLE_ONE_DRAW` | 可选择，1 次结果 RNG {成功/失败} | 是 |
| `RULE_RESULT` | 不可选，规则结果 | 否 |
| `ATTRIBUTION_ONLY` | 不可选，事件后归因 | 否 |

**44 行表（机器断言：`RegistryBehaviorIds == BehaviorMatrixIds`、size=44、无缺失/无额外）**：

| behaviorId | 分类 | selectable | 结果判定 | 后续规则 |
|---|---|---|---|---|
| ADV | SELECTABLE_DETERMINISTIC | 是 | 推进由事件规则 | 无 |
| REORG | SELECTABLE_DETERMINISTIC | 是 | 调整由事件规则 | 无 |
| DRIVE | SELECTABLE_ONE_DRAW | 是 | BEHAVIOR 1000..1999 创造结果 | 丢球→TURNOVER_OCCURRENCE；犯规→DEFENSIVE_FOUL/OFFENSIVE_FOUL；成功→机会质量 delta |
| SHAKE | SELECTABLE_ONE_DRAW | 是 | 同上 | 同上 |
| ISO | SELECTABLE_ONE_DRAW | 是 | 同上 | 同上 |
| STEP_BACK | SELECTABLE_ONE_DRAW | 是 | 同上 | 同上 |
| POSTUP | SELECTABLE_ONE_DRAW | 是 | 同上 | 同上 |
| HIGH_POST_CREATION | SELECTABLE_ONE_DRAW | 是 | 同上 | 成功→beneficiary |
| SPOTUP | SELECTABLE_ONE_DRAW | 是 | SHOOTER→SHOT 命中 | 不中→REBOUND；投篮犯规→DEFENSIVE_FOUL |
| CATCHSHOT | SELECTABLE_ONE_DRAW | 是 | 同上 | 同上 |
| THREE | SELECTABLE_ONE_DRAW | 是 | 同上 | 同上 |
| MID | SELECTABLE_ONE_DRAW | 是 | 同上 | 同上 |
| PULLUP | SELECTABLE_ONE_DRAW | 是 | 同上 | 同上 |
| CLOSE | SELECTABLE_ONE_DRAW | 是 | 同上 | 同上 |
| FLOATER | SELECTABLE_ONE_DRAW | 是 | 同上 | 同上 |
| HOOK | SELECTABLE_ONE_DRAW | 是 | 同上 | 同上 |
| LAYUP | SELECTABLE_ONE_DRAW | 是 | 同上 | 同上 |
| CONTACTFIN | SELECTABLE_ONE_DRAW | 是 | 同上 | 同上 |
| CONTESTEDFIN | SELECTABLE_ONE_DRAW | 是 | 同上 | 同上 |
| PASS | SELECTABLE_ONE_DRAW | 是 | **单一 TURNOVER_OCCURRENCE draw（V27-02 唯一链）** | 未发生→传球成功（receiver 权威化 + 助攻候选）；发生→PASSTOV（turnover） |
| HPASS | SELECTABLE_ONE_DRAW | 是 | 同上 | 同上 |
| CREATIVE_PASS | SELECTABLE_ONE_DRAW | 是 | 同上（成功→机会质量 delta，C.7） | 同上 |
| ASTOPP | SELECTABLE_ONE_DRAW | 是 | 同上 | 同上 |
| HELDKICK | SELECTABLE_ONE_DRAW | 是 | 同上 | 同上 |
| SCREEN | SELECTABLE_ONE_DRAW | 是 | BEHAVIOR 3000..3999 成功/失败 | 成功→CreationFact（beneficiary=持球者） |
| CUT | SELECTABLE_ONE_DRAW | 是 | 同上 | 成功→CreationFact（beneficiary=cutter） |
| DOUBLECREATE | SELECTABLE_ONE_DRAW | 是 | 同上 | 成功→CreationFact（beneficiary=弱侧） |
| ONDEF | SELECTABLE_DETERMINISTIC | 是 | 稳健单防由事件规则 | 压低命中 |
| PRESS | SELECTABLE_ONE_DRAW | 是 | DEFENSIVE_ACTION 1000..1999 成功/失败 | 成功→TURNOVER_OCCURRENCE 基础率+0.03；失败→对方机会质量 delta+8 |
| STLTRY | SELECTABLE_DETERMINISTIC | 是 | 无独立 success | 提高 STEAL_ATTRIBUTION 归因率（先 PRESSURED_LIVE_BALL，不直接 STEAL） |
| CONTEST | SELECTABLE_DETERMINISTIC | 是 | 无独立 success | 并入区域防守执行一次 |
| HELPD | SELECTABLE_ONE_DRAW | 是 | DEFENSIVE_ACTION 1000..1999 成功/失败 | 成功→压低机会质量-10；失败→对方+8 + CreationFact |
| DOUBLET | SELECTABLE_ONE_DRAW | 是 | DEFENSIVE_ACTION 1000..1999 成功/失败 | 成功→TURNOVER_OCCURRENCE 基础率+0.03；失败→独立 DEFENSIVE_FOUL，不犯规才对方+8 |
| TRANSITIOND | SELECTABLE_DETERMINISTIC | 是 | 退防由事件规则 | 限制转换 |
| FT | RULE_RESULT | 否 | SHOT 5000..5999 罚球命中 | 不中→REBOUND |
| PASSTOV | RULE_RESULT | 否 | 传球失败的结果（TURNOVER_OCCURRENCE 发生） | — |
| BALLDESTROY | RULE_RESULT | 否 | 被破坏传球的对方球权 | — |
| PUTBACK | RULE_RESULT | 否 | ORB 后 SHOT 命中 | 不中→REBOUND |
| BLK | ATTRIBUTION_ONLY | 否 | missed SHOT 后 BLOCK_ATTRIBUTION 归因 | 不改写命中；BLK 失败不决定犯规 |
| FOUL | RULE_RESULT | 否 | DEFENSIVE_FOUL/OFFENSIVE_FOUL 判定发生；FOUL_TYPE 仅分类 | — |
| ORB | RULE_RESULT | 否 | REBOUND 归属（C.4 前场篮板率） | — |
| DRB | RULE_RESULT | 否 | REBOUND 归属（100%−对方 ORB 率） | — |
| BOXOUT | RULE_RESULT | 否 | 无独立 RNG（提高个人篮板执行 **首候选 +4，范围 [3..5]，`[FROZEN-FIRST-CANDIDATE]`**）；**boxer 由 REBOUND 规则确定性派生（V28-02，无独立 actor draw / 无 behaviorSelectionOrdinal）**；CLOCK_ADVANCED 属 REBOUND 片段，非独立事件 | — |
| BLKLOOSE | RULE_RESULT | 否 | 盖帽后散球归属（REBOUND） | — |

> **V27-01 关闭**：表内恰为 44 个 Behavior ID（含 PASSTOV/BALLDESTROY/FOUL/BLKLOOSE），无额外非 Behavior 项；`RegistryBehaviorIds == BehaviorMatrixIds` 机器断言。**ORB/DRB/BOXOUT 为 RULE_RESULT（不参加 P_select）**——与 §D.2 同步（V27-01 反例 5）；PASSTOV/BALLDESTROY/FOUL/BLKLOOSE 明确归属（V27-01 反例 6）。
>
> **V27-02 关闭（唯一 PASS 链）**：PASS/HPASS/CREATIVE_PASS/ASTOPP/HELDKICK 统一为**单 draw `TURNOVER_OCCURRENCE`**：
> - 未发生 → 传球成功（receiver 权威化 + 助攻候选）；
> - 发生 → PASSTOV（turnover）。
> **不设独立 BEHAVIOR success draw**（V27-02 反例 7/8：无"行为失败但未 turnover"悬空状态；实际失误概率恒等于 §C.1 的 p，非 p²）。HELDKICK 的分球质量作为成功后的 CreationFact delta，不构成第二次失败判定（V27-02 反例 9）。
>
> **V28-01 关闭（清除传球链残留）**：`§C.9` HELDKICK 行、`§H.2` off-ball 执行区间、`§H.3` 确定性列表中的旧定义已清除——全文只剩**一条** PASS 失败链（单 draw `TURNOVER_OCCURRENCE`）。HELDKICK 分球质量为成功后**确定性** CreationFact delta（非二次 RNG），无"两阶段失误 / 完全无失误"第三实现。

## D. 行为选择（基线 §5.7，行为级映射修复 R01）

### D.1 通用权重公式（基线）
```
行为权重 = 内容倾向权重 × 战术倍率 × 场景可用性   （场景可用性 0-1）
P_select(b) = w(b) / Σ w
```
- 先过滤合法行为；不合法行为场景可用性 = 0。
- 球权参与选持球者；传球选择对 `100-传球选择` 比较传球 vs 自行处理；转换/防守冒险/前场篮板各自对 `100-值`。
- 进入投篮分支后用三元 `shotZones` 向量。
- 总权重为 0 → 固定安全行为（F-72）。
- 倾向不直接改变成功率（F-70）。

### D.2 唯一 canonical Behavior Registry（修复 V23-02，全文唯一权威）

**行为总数**：**44 个 behavior ID**；其中 **34 个 selectable**、**10 个 rule-result / attribution-only**（V28 计数修正：机器核验 34 selectable + 10 non-selectable = 44，见 `§C.10`；V27-01 已把 ORB/DRB/BOXOUT/BLK 移出 selectable，BLK→ATTRIBUTION_ONLY）。**本表 selectable 行只列 34 项**；`RULE_RESULT`/`ATTRIBUTION_ONLY`（FT/PASSTOV/BALLDESTROY/PUTBACK/BLK/FOUL/ORB/DRB/BOXOUT/BLKLOOSE）见 §C.10。**开发 Gate 机器校验（N3）**：断言 `RegistryBehaviorIds == BehaviorMatrixIds`、size=44、**selectable=34、non-selectable=10**、无缺失/无额外；校验失败即 Gate 阻塞。**分类以 §C.10 为唯一权威**。

**selectable behaviors（34 项，进 `行为权重 = 倾向 × 战术 × 场景`）**：

| behaviorId | 行为族 | 主倾向（复合用相乘，§D.3） | 基础权重 [CALIBRATE] | drawKind/ordinal | receiver/beneficiary |
|---|---|---|---|---|---|
| ADV | 推进 | `passSelection`（组织节奏） | 10 | BEHAVIOR 0..999 | 否 |
| REORG | 推进 | `passSelection` | 10 | BEHAVIOR 0..999 | 否 |
| DRIVE | 创造 | `possessionParticipation` × `shotZones.inside` | 15 | BEHAVIOR 0..999 + 结果 1000..1999 | 否 |
| SHAKE | 创造 | `possessionParticipation` × `shotZones.perimeter+midRange` | 12 | 同上 | 否 |
| ISO | 创造 | `possessionParticipation` | 10 | 同上 | 否 |
| STEP_BACK | 创造 | `possessionParticipation` × `shotZones.perimeter+midRange` | 10 | 同上 | 否 |
| POSTUP | 创造 | `possessionParticipation` × `shotZones.inside` | 12 | 同上 | 否 |
| HIGH_POST_CREATION | 创造 | `passSelection` | 10 | 同上 | **是**（beneficiary） |
| SPOTUP | 投篮 | `shotZones.perimeter/midRange` | 12 | SHOOTER→SHOT | 否 |
| CATCHSHOT | 投篮 | `shotZones.perimeter` | 12 | SHOOTER→SHOT | 是（接球者=shooter） |
| THREE | 投篮 | `shotZones.perimeter` | 12 | SHOOTER→SHOT | 否 |
| MID | 投篮 | `shotZones.midRange` | 10 | SHOOTER→SHOT | 否 |
| PULLUP | 投篮 | `shotZones.midRange` | 8 | SHOOTER→SHOT | 否 |
| CLOSE | 投篮 | `shotZones.inside` | 10 | SHOOTER→SHOT | 否 |
| FLOATER | 投篮 | `shotZones.inside` | 8 | SHOOTER→SHOT | 否 |
| HOOK | 投篮 | `shotZones.inside` | 10 | SHOOTER→SHOT | 否 |
| LAYUP | 投篮 | `shotZones.inside` | 12 | SHOOTER→SHOT | 否 |
| CONTACTFIN | 投篮 | `shotZones.inside` | 10 | SHOOTER→SHOT | 否 |
| CONTESTEDFIN | 投篮 | `shotZones.inside` | 8 | SHOOTER→SHOT | 否 |
| PASS | 传球 | `passSelection`（对 100-passSelection） | 15 | BEHAVIOR 0..999 + BALL_HANDLER 2000..2999 | **是**（receiver） |
| HPASS | 传球 | `passSelection` | 10 | 同上 | **是**（receiver） |
| CREATIVE_PASS | 传球 | `passSelection` | 6 | 同上 | **是**（receiver） |
| ASTOPP | 传球 | `passSelection` | 8 | 同上 | **是**（receiver） |
| HELDKICK | 传球 | **`passSelection`**（统一，V23-02 修正：突破分球由传球倾向控制，非 transition/offReb） | 8 | BEHAVIOR 0..999 + BALL_HANDLER 2000..2999 | **是**（receiver） |
| SCREEN | 无球 | `transitionParticipation`（选 SCREEN 时机；**不用能力作倾向**，V24-02） | 8 | BEHAVIOR 0..999（执行 BEHAVIOR 3000..3999，§C.9） | **是**（受益者=持球者） |
| CUT | 无球 | `transitionParticipation` × `shotZones.inside` | 8 | BEHAVIOR 0..999（执行 3000..3999，§C.9） | 是（受益者=cutter） |
| DOUBLECREATE | 无球 | `passSelection`（包夹时选弱侧组织的意愿；**不用能力作倾向**，V24-02） | 6 | BEHAVIOR 0..999（执行 3000..3999，§C.9） | 是（受益者=弱侧球员） |
| ONDEF | 防守 | `defensiveRisk`（对 100-risk） | 12 | DEFENSIVE_ACTION 0..99（模式） | 否 |
| PRESS | 防守 | `defensiveRisk`（对 100-risk） | 8 | DEFENSIVE_ACTION 1000..1999（执行，§C.9） | 否 |
| STLTRY | 防守 | `defensiveRisk`（对 100-risk） | 6 | **DETERMINISTIC（V25-02）**：不消耗执行 draw；只提高 `STEAL_ATTRIBUTION` 归因率（§C.6/C.9） | 否 |
| CONTEST | 防守 | `defensiveRisk` | 12 | **DETERMINISTIC（V25-02）**：不消耗执行 draw；干扰并入 `区域防守执行`（§C.2） | 否 |
| HELPD | 防守 | `defensiveRisk`（**只用倾向，不用 TU 作倾向**，V24-02） | 8 | DEFENSIVE_ACTION 1000..1999（执行，§C.9） | 否 |
| DOUBLET | 防守 | `defensiveRisk` | 6 | DEFENSIVE_ACTION 1000..1999（执行，§C.9） | 否 |
| TRANSITIOND | 防守 | `transitionParticipation`（对 100-值） | 8 | TRANSITION 0 | 否 |

> **V27-01**：ORB/DRB/BOXOUT 已从 selectable 移除，归类为 `RULE_RESULT`（`§C.10`）：`offensiveRebounding` 倾向只决定哪些球员参加冲抢及候选权重，不提高成功率；篮板归属由 `REBOUND` draw（`§C.4`）决定。**它们不进入 `P_select`，不与 REBOUND draw 双重选择**（V27-01 反例 5）。BLK 为 `ATTRIBUTION_ONLY`（missed SHOT 后 `BLOCK_ATTRIBUTION`）。

**rule-result / 结果分类（不进 `P_select(b)`；完整非 selectable 集合 = 10 项，`§C.10` 为唯一权威，本表为结果分类摘要）**：
| 表项 | 归类 | 说明 |
|---|---|---|
| `FT`（罚球） | 规则结果 | 由犯规类型/区域决定次数（2/3/1）；命中判定走 `SHOT` 5000..5999 |
| `PASSTOV` | 结果分类 | 传球失败结果（`TURNOVER_OCCURRENCE`→`TURNOVER_CLASSIFICATION`） |
| `BALLDESTROY` | 结果分类 | 被破坏传球对方球权，非可选项 |
| `FOUL` | 规则结果 | 防守/进攻犯规判定（`DEFENSIVE_FOUL`/`OFFENSIVE_FOUL`） |
| `BLKLOOSE` | 结果分类 | 封盖后散球归属（`REBOUND`） |
| `PUTBACK` | **规则结果**（V23-02：**不进入普通行为选择**，仅 ORB 事件后自动二次进攻） | ORB 后触发，非 `P_select(b)` 候选 |

### D.3 复合倾向组合（唯一，V23-02）
```
tendencyFactor(b) = ∏(倾向因子_j)
倾向因子_j = 该倾向值/100   （对"对 100-值"类用 (100-值)/100）
```
- DRIVE = (possessionParticipation/100) × (shotZones.inside/100)。
- 不冻结加法/加权平均等替代组合。

### D.4 创造成功后多出口选择（V23-02 修正：候选按自身基础权重分配，非"按表顺序吞并"）

创造成功后的多出口（如 DRIVE→LAYUP/CONTACTFIN/HELDKICK）**不是**按固定表顺序吞并，而是**在出口候选集上再次运行 `行为权重` 公式**：
```
出口候选集 = 该创造行为允许的后续行为（§D.2 selectable 中的对应项）
出口权重 = 各候选的 基础权重 × 倾向因子 × 场景可用性    （§D.2/D.3）
P_select(出口) = 出口权重 / Σ(出口候选权重)
```
- 出口候选权重由**各候选自身的基础权重**与倾向决定，例如：
  - DRIVE 出口：LAYUP(基础12) vs CONTACTFIN(基础10) vs HELDKICK(基础8)，再乘 `shotZones.inside`（LAYUP/CONTACTFIN）或 `passSelection`（HELDKICK）——LAYUP 不会被同权重吞并。
  - SHAKE 出口：SPOTUP(12)/PULLUP(8)/THREE(12) 乘各自射区倾向。
  - POSTUP 出口：HOOK(10)/CLOSE(10) 乘 `shotZones.inside`；POSTUP 失败→REORG(10) 或 CLOSE 低质量。
  - HIGH_POST 成功出口：HPASS(10)/SPOTUP(12) 乘 `passSelection`/`shotZones`。
- 出口选择**再次调用 `BEHAVIOR` drawKind**（选择区间 `0..999`，新 ordinal）。
- 出口候选须满足场景可用性；并列按 `04` §B 固定行为表顺序打破（仅并列时）。
- 创造失败出口与丢球分离——丢球由 `TURNOVER_OCCURRENCE` 判定（§C.1）。

### D.5 HELDKICK 唯一倾向（V23-02 修正）
- HELDKICK（突破吸引协防后外传）**统一由 `passSelection` 控制**，核心 `playmaking`（`04` §B.3）。它是传球族 selectable 行为（§D.2），并可作为 DRIVE 的传球出口（§D.4）。
- **不再**由 `transitionParticipation + offensiveRebounding` 控制（V23-02 消除三方冲突）。
- 当 DRIVE 选择 HELDKICK 出口时，出口权重用 `passSelection`（与 HELDKICK 独立选择时同倾向）。

### D.6 多参与者行为：trigger / actor / opponent 选择（修复 V24-02/V24-04 + V25-04）

下表为所有**多参与者行为**冻结触发条件、行为主体（actor）、对抗者（opponent）与确定性选择。**actor ordinal 绑定行为选择实例（V25-04）**：
```
actor_ordinal = 3000 + behaviorSelectionOrdinal
  behaviorSelectionOrdinal = 该行为在该片段的 BEHAVIOR 选择 ordinal（§H.2 选择区间 0..999 中的序号）
```
- 同一片段两次 SCREEN：第一次选择 ordinal=0 → actor=3000；第二次选择 ordinal=1 → actor=3001（V25-04 反例 4：不同且稳定）。
- **废除**固定编号（SCREEN=3000、CUT=3001 等）——避免与"第 k 次"冲突（V25-04 反例 9）。
- 前一 actor 分支缺失不改变后一语义实例 key（ordinal 绑定选择序号，不绑定调用计数）。

| 行为 | trigger（触发条件） | actor（主体） | opponent（对抗者） | actor 选择 | 说明 |
|---|---|---|---|---|---|
| SCREEN | 持球者选择 SCREEN；无球球员位置允许 | screener（`06` §F.3 候选） | 被掩护者直接防守者（挤过） | BALL_HANDLER `3000+selectionOrdinal` | 受益者=持球者 |
| CUT | 无球球员持球时切向篮下 | cutter（`06` §F.3 候选） | 对位跟防者 | 同上 | 受益者=cutter |
| DOUBLECREATE | 对方 DOUBLET 成功/包夹形成 | creator（`06` §F.3 候选） | 包夹回收防守者 | 同上 | 受益者=弱侧球员 |
| HELPD | 对位持球者突破、无球者协防 | helper（`06` §F.3 候选） | 被协防的攻方持球者 | 同上 | 失败→被漏攻方 |
| DOUBLET | 持球者强攻、防守选择包夹 | **两名 defender（确定性 top-2，V25-04）** | 攻方持球者 | **无随机 draw**：取 `interiorDefense` 降序前二 + playerId 稳定排序 | 两名防守者 |
| PRESS | 防守轴=压迫 | 压迫者（`06` §F.3 候选） | 攻方持球者 | BALL_HANDLER `3000+selectionOrdinal` | — |
| STLTRY | 防守冒险动作 | 抢断者（`06` §F.3 候选） | 攻方持球者 | 同上 | — |
| CONTEST | 对位者出手前 | 直接对位者（固定） | 出手者 | 无 draw（直接对位者固定） | — |
| BLK | **missed SHOT 后归因（V25-02）** | 直接对位者/至多一名协防者取高者 | 出手者 | BLOCK_ATTRIBUTION（非 selectable） | 见 `05` §C.6 |
| BOXOUT | 投篮不中后（REBOUND 解析） | **boxer（REBOUND 规则确定性派生，V28-02）** | — | **无 draw**（boxer = 同侧争抢候选（非持球者）中 `个人篮板执行` 最高者，并列 playerId UTF-16 稳定排序） | RULE_RESULT：无独立 actor draw / 无独立 BOXOUT 事件 |
| HIGH_POST_CREATION | 高位持球 | creator=持球者 | 对方协防者 | —（creator=持球者固定） | 受益者=弱侧球员 |

**选择规则（V25-04 闭合）**：
- actor 候选集合 = 该侧场上非持球者（除固定 creator 外）；按 `06` §F.3 候选权重（场景可用性）+ playerId UTF-16 stable sort；`BALL_HANDLER 3000+selectionOrdinal` draw。
- **BOXOUT 例外（V28-02）**：RULE_RESULT，**不参加 `BALL_HANDLER 3000+` actor 选择**（无 behaviorSelectionOrdinal）；boxer 由 REBOUND 规则确定性派生（无 draw，见本表 BOXOUT 行与 `§C.10`）。
- **DOUBLET 两名 defender 确定性 top-2**（interiorDefense 降序 + playerId 稳定排序），**不用随机 draw**（V25-04：消除"随机 vs 确定性"并存）。
- **空候选回退唯一化（V25-04）**：合法候选集合**为空** → 该行为**不可用**（场景可用性=0，不进入候选），**不读取空集合**、不产生非法事实。不再有"从空集合取最小 ID"。
- opponent = 对位者（默认位置对位，F-29）。

### D.7 防守行为选择机制（修复 V26-02）

**防守行为选择唯一机制**（V26-02 反例 10）：
```
1. 防守片段：先按 `defensiveRisk` 对 `100-defensiveRisk` 二态选 稳守/冒险 模式（DEFENSIVE_ACTION 0..99）
2. 再用 `BEHAVIOR 0..999`（防守行为选择）从可用防守行为候选按 行为权重 = 倾向 × 战术 × 场景 归一化选择具体行为
   候选 = ONDEF/PRESS/STLTRY/CONTEST/HELPD/DOUBLET/TRANSITIOND（STLTRY/CONTEST 为 SELECTABLE_DETERMINISTIC，选择后无独立执行 draw）
3. 被选行为取得 behaviorSelectionOrdinal（= 该防守片段 BEHAVIOR 0..999 序号）
   → actor_ordinal = 3000 + behaviorSelectionOrdinal（防守/篮板行为同样适用，V26-02）
```
- **防守行为也使用 `BEHAVIOR 0..999` 选择**（V26-02：不是只用 DEFENSIVE_ACTION）。这保证 HELPD/PRESS/STLTRY 有可用 `behaviorSelectionOrdinal`。**BOXOUT 除外（V28-02）：RULE_RESULT，无 selection ordinal，boxer 由 REBOUND 规则确定性派生。**
- **DOUBLET 双人执行聚合（V26-02 反例 11）**：`包夹执行 = max(两名 defender 各自的包夹执行)`（主施压者代表包夹效果）。
- STLTRY/CONTEST 选择后为 DETERMINISTIC（不消耗执行 draw，`05` §C.9/C.10）。
- BLK 不参加防守行为选择（`ATTRIBUTION_ONLY`，missed SHOT 后归因）。
- 防守行为候选重排不改变行为/actor（stable sort + keyed draw，V26-02 反例 5）。

## E. 参数 Registry

### E.1 冻结参数
| 参数 | 值 | 来源 |
|---|---|---|
| 节长 / 加时 / 犯满 | 600s / 300s / 5 | 合同 MatchRules |
| 类型负荷 | 队内6/友谊10/正式12 | 基线 §4.5 |
| 耐力修正 | 1 - 0.003×耐力 | 基线 §4.5 |
| 疲劳执行惩罚 | clamp((疲劳-30)×0.20, 0, 14) | 基线 §6.2 |
| 团队执行修正 | clamp((C-50)×0.12, -6, +6) | 基线 §6.5 |
| 位置错配执行点 | 副 -3 / 其他 -8 | 基线 §5.5 |
| 特质执行点 | +6 | 基线 §5.8 |
| 战术执行点上限 | ±6 | 基线 §10.3 |
| 乘法效果限制 | 0.75-1.25 | 合同 effects |
| 动作压力修正 | 稳守 -3 / 冒险 +4 | 基线 §12.4 |
| 节奏修正 | 慢-0.015/平衡0/快+0.015 | 基线 §12.4 |
| 节奏负荷系数 | 慢0.90/平衡1.00/快1.15 | 基线 §4.5 |
| 节奏回合时长 | 慢×1.12/平衡×1.00/快×0.88 | 基线 §10.2 |
| 转换权重 | 慢×0.80/平衡×1.00/快×1.25 | 基线 §10.2 |

### E.2 位置默认权重（[DESIGN]）
倾向主导，位置权重只给底线（主提示词 F-56）。位置摘要权重（基线 §5.6 用于队内分组/推荐）不进入比赛公式。

### E.3 [CALIBRATE] 项
- `k` 系数（各执行组合权重）、区域基础、各 clamp 上下限、场景基础犯规率、归因率基线 —— 均按开发计划 §7.4 场景 registry 校准；**不得改变机制结构**（基线 §21）。

## F. 计算顺序（F-125，唯一）
```
能力组合 → −疲劳惩罚 → ±位置错配 → ±特质 → ±战术(±6) → 关键公式 → clamp → round → rng
```
同一因素在整条链只出现一次。定点：千分位，乘法后一次 roundHalfUp（合同 fixed-point）。

## G. Phase 3 通过条件核查

| 条件 | 结论 |
|---|---|
| 同因素一次 | ✅ F-125 固定顺序 |
| 所有概率有上下界 | ✅ 各公式 clamp |
| 无隐性 0%/100% | ✅ clamp 下限 ≥0.005，上限 ≤0.95 |
| 高星优势来自具体能力 | ✅ 执行值来自能力组合，无 OVR |
| 低星合理成功概率 | ✅ clamp 下限保底 |
| 疲劳/位置/特质/战术不重复结算 | ✅ 各入一次 |

---

## H. RNG Registry（修复 B-B02 / T-B01 / T-B02）

### H.1 原则（修复 R03：localIndex = 固定语义 ordinal，非调用计数）

- 每个会抽取比赛结果的判定**必须**指定一个合同 drawKind 和 stable localIndex。
- **`localIndex` 是冻结的"语义序号"，不是运行时调用计数**。同一 (period, possessionIndex, segmentIndex, drawKind) 内，每个**语义角色**拥有固定的 ordinal 区间；区间内的序号只由该角色的实例序号决定，**不受其他分支是否执行的影响**（P02 基线 §12.3："同一片段各类随机量的键不因上一分支少走一步而错位"）。
- **区间分区**：drawKind 内不同语义角色使用不重叠的 ordinal 区间（见 H.2）。角色 A 少走一步，只影响角色 A 内部序号，**不改变角色 B 的键**。
- **候选数组排序**：所有候选（球员、行为、归因）先按 stable key 排序（UTF-16 code unit，与合同 canonical 一致），再用于选择；不得依赖插入顺序或运行时数组顺序。
- **失败/未发生不释放本角色区间**：某角色未进入（如无创造判定），其区间序号不被占用；后续同类角色实例仍从固定起点编号。
- **多次同类抽取**（如 2/3 次罚球、多次 PASS）：同一角色内的多次实例按固定起点顺序编号。
- 命令、UI、解释、cosmetic 不调用结果 draw（F-18）。
- **行为时间与 SEGMENT_DURATION（N4）**：行为时间是**累计时钟消耗**（该片段各行为时间 1..5s 之和，`03` §3.2）；`SEGMENT_DURATION` draw 生成**片段总时长**（回合时长），二者关系为：片段总时长 ≥ 该片段行为累计时间；`SEGMENT_DURATION` 只在片段开始抽取一次，行为时间不额外触发该 draw。

### H.2 drawKind → 语义角色 ordinal 区间表

| drawKind | 语义角色 | ordinal 区间 | 说明 |
|---|---|---|---|
| `SEGMENT_DURATION` | 片段回合时长 | 0 | 每片段固定 1 次 |
| `TRANSITION` | 转换/阵地 | 0 | 每片段至多 1 次 |
| `BALL_HANDLER` | 首段球队选择 | **0**（仅比赛/加时首片段） | 与持球者选择不同区间（N04） |
| `BALL_HANDLER` | 持球者选择 | **1..999** | 每片段按持球候选 stable 排序 |
| `BALL_HANDLER` | **PASS_RECEIVER / beneficiary 选择**（修复 V23-04/V25-04） | **2000..2999** | 复用 BALL_HANDLER drawKind（合同不可增）；**receiver_ordinal = 2000 + 该传球/创造行为的 behaviorSelectionOrdinal**（绑定选择实例，非调用计数）。候选集合/权重/回退见 `06` §F.2 |
| `BALL_HANDLER` | **多参与者 actor 选择**（screener/cutter/helper/creator，修复 V24-04/V25-04） | **3000..3999** | 复用 BALL_HANDLER；**actor_ordinal = 3000 + behaviorSelectionOrdinal**（绑定选择实例）。DOUBLET 为确定性 top-2（无随机 draw）。候选集合见 `06` §F.3。**BOXOUT 例外（V28-02）：RULE_RESULT，无 actor draw，boxer 由 REBOUND 规则派生** |
| `DEFENSIVE_ACTION` | 防守稳守/冒险模式 | 0..99 | 每防守片段 1 次 |
| `DEFENSIVE_ACTION` | **防守行为执行**（HELPD/DOUBLET/PRESS 的 success/failure，修复 V24-01/V25-02/V26-04） | **1000..1999** | `defenseExecutionOrdinal = 1000 + defenseBehaviorSelectionOrdinal`（绑定防守行为选择实例）。**STLTRY/CONTEST 为 DETERMINISTIC（不消耗执行 draw，V25-02）；BLK 移出（missed SHOT 后 `BLOCK_ATTRIBUTION`）** |
| `TURNOVER_OCCURRENCE` | 失误发生（每行为） | **2000..2999** | **`turnoverOrdinal = 2000 + behaviorSelectionOrdinal`（V26-04 绑定行为实例，N02 区间同步）**；同一片段每行为独立槽，不与其它行为复用 |
| `TURNOVER_CLASSIFICATION` | 失误分类 | 0 | 每失误判定 1 次 |
| `BEHAVIOR` | **行为选择** | **0..999** | 同一片段内第 n 次行为选择 = ordinal n |
| `BEHAVIOR` | **创造行为结果**（DRIVE/SHAKE/ISO/STEP_BACK/POSTUP/HIGH_POST） | **1000..1999** | 与行为选择**分离**；第 n 次创造判定 = ordinal 1000+n |
| `BEHAVIOR` | **off-ball 行为执行**（SCREEN/CUT/DOUBLECREATE 的 success/failure，修复 V24-01） | **3000..3999** | 与行为选择/创造结果**分离**；第 n 次 off-ball 执行判定 = ordinal 3000+n。**HELDKICK 已移出（V28-01）：属传球族，唯一结果判定 = 单 draw `TURNOVER_OCCURRENCE` 2000+selectionOrdinal（V27-02）** |
| `SHOOTER` | 出手者选择 | 0..n | 每出手 1 次 |
| `SHOT` | 出手命中判定 | 0..n | 每次出手 1 次 |
| `SHOT` | **罚球命中判定** | **5000..5999** | 与出手分离；第 k 次罚球 = ordinal 5000+k |
| `OFFENSIVE_FOUL` | 进攻犯规 | 0..n | **`foulOrdinal = 4000 + behaviorSelectionOrdinal`（V26-04 绑定行为实例）**；同一片段多次创造/突破各独立槽 |
| `DEFENSIVE_FOUL` | 防守犯规 | 0..n | **`foulOrdinal = 5000 + behaviorSelectionOrdinal`（V26-04 绑定行为实例）**；同一片段 DRIVE→LAYUP 两次犯规检查用不同 key |
| `FOUL_TYPE` | 犯规类型 | 0 | 每犯规 1 次（只在犯规已发生后分类，V25-02） |
| `REBOUND` | 篮板归属 | 0..n | 每次未命中/罚球不中后 1 次 |
| `STEAL_ATTRIBUTION` | 抢断归因 | 0 | 每 PRESSURED_LIVE_BALL 失误 1 次 |
| `BLOCK_ATTRIBUTION` | 封盖归因 | 0 | 每未命中（篮下/中投）1 次 |
| `ASSIST_ATTRIBUTION` | 助攻归因 | 0 | 每命中 1 次 |

### H.3 关键判定 ordinal 细节（修复 R03/N04）

- **行为选择 vs 创造结果 vs off-ball 执行分离（V24-01）**：`BEHAVIOR` 选择区间 `0..999`、创造结果 `1000..1999`、off-ball 执行 `3000..3999` 互不共享。SCREEN 的选择（`BEHAVIOR 0..999`）与执行（`BEHAVIOR 3000..3999`）**不是同一个 key**。第 1 次行为选择恒为 ordinal 0，无论该行为是否触发创造/执行判定；**分支少走一步不再使后续键位移**。
- **防守模式 vs 防守执行分离（V24-01）**：`DEFENSIVE_ACTION` 稳守/冒险模式 `0..99`、防守行为执行 `1000..1999` 互不共享。稳守/冒险选择不占用 HELPD/DOUBLET/PRESS/STLTRY/CONTEST/BLK 的执行判定槽。
- **首段球队选择 vs 持球者选择**：首段球队选择固定 ordinal 0（仅比赛/加时首片段）；同一片段持球者选择固定从 ordinal 1 开始。首段判定即使存在，也不占用持球者选择区间（N04 已显式登记）。
- **receiver vs actor 选择（V24-04）**：`BALL_HANDLER` receiver/beneficiary `2000..2999`、多参与者 actor `3000..3999` 互不共享。
- **罚球 2/3 次**：`SHOT` 罚球区间 `5000..5999`，第 1/2/3 次罚球 = ordinal 5000/5001/5002，与常规出手（0..n）分离。
- **多次 PASS**：每成功/失败 PASS 各占 `BEHAVIOR` 选择区间一个 ordinal（0,1,2,...），固定顺序。
- **创造失败后的后续行为**：创造结果占 `BEHAVIOR` 创造区间（1000+），后续出手占 `SHOOTER`/`SHOT`——三类角色区间独立，互不移位。
- **候选稳定排序**：球员候选按 `playerId` UTF-16；行为候选按固定行为表顺序（`04` §B）；归因候选按 `interiorDefense` 降序后 playerId 稳定排序。
- **确定性行为（V24-03，V28-01 修订）**：ADV/REORG/ONDEF/TRANSITIOND/BOXOUT 为**确定性行为**（结果由事件规则决定，**不消耗结果 RNG**，不进 §H ordinal 表；BOXOUT 为 RULE_RESULT，boxer 由 REBOUND 规则派生）；其推进/组织效果通过 CLOCK_ADVANCED/PASS fact 表达。**PASS/HPASS/CREATIVE_PASS/ASTOPP/HELDKICK 已移出（V28-01）**：均为 SELECTABLE_ONE_DRAW，唯一结果判定 = 单 draw `TURNOVER_OCCURRENCE` 2000+selectionOrdinal（V27-02），**消耗结果 RNG**。

### H.4 罚球 drawKind 结论（T-B01）
罚球命中判定 drawKind = **`SHOT`**，ordinal 区间 `5000..5999`（与常规出手 `0..n` 分离）。不使用空 drawKind。

### H.5 shotClock 与 RNG 坐标
- `shotClock` 是规则状态，**不占用 drawKind**（违例是确定性规则事件，非随机判定）。
- 违例发生时 `TURNOVER(UNFORCED_DEAD_BALL)` 作为确定性结果提交，不消耗 RNG。
- 重建算法见 `03` §4.4。

### H.6 后续规则判定 localIndex 绑定行为实例（修复 V26-04）

**所有 per-behavior 后续规则判定的 ordinal 绑定该行为的 `behaviorSelectionOrdinal`**（即该行为在本片段的 `BEHAVIOR 0..999` 选择序号），不是统一 0、也不是实际调用计数：

| 判定 | ordinal 公式 |
|---|---|
| `DEFENSIVE_FOUL` | `5000 + behaviorSelectionOrdinal` |
| `OFFENSIVE_FOUL` | `4000 + behaviorSelectionOrdinal` |
| `TURNOVER_OCCURRENCE` | `2000 + behaviorSelectionOrdinal` |
| `DEFENSIVE_ACTION` 防守执行 | `1000 + defenseBehaviorSelectionOrdinal` |
| `BALL_HANDLER` receiver | `2000 + behaviorSelectionOrdinal`（`06` §F.2） |
| `BALL_HANDLER` actor | `3000 + behaviorSelectionOrdinal`（`06` §F.3） |

**V26-04 反例固定**：
- 同一片段 DRIVE（selection=0）未犯规 → LAYUP（selection=1）再检查投篮犯规：两次 `DEFENSIVE_FOUL` 用 `5000+0` 与 `5000+1`，**不同 key**。
- DOUBLET 失败 → 独立 `DEFENSIVE_FOUL`（绑定 DOUBLET 的 selectionOrdinal）→ 后续 SHOT 犯规用下一 selectionOrdinal，不复用。
- 同一片段两次 PASS：`TURNOVER_OCCURRENCE` 用 `2000+0`、`2000+1`。
- 前一行为分支缺失不改变后一行为语义 key（ordinal 绑定选择序号）。

---

## I. [CALIBRATE] 校准边界（Non-Blocking 5）

- `[CALIBRATE]` 允许在开发期调优**数值**（系数、clamp、基础率、默认值）。
- **禁止**借校准改变：行为边界（§B 结果集）、RNG drawKind/localIndex 规则（§H）、事件/事实合同、机制结构（基线 §21）。
- 任一行为边界或 RNG 规则变更 = 场景 registry 版本提升 + 全量重跑（开发计划 §7.4），不得局部保留有利 seed。
- **数值纳入 rules/content hash（V29 修订）**：所有 `[CALIBRATE]` 数值（含 BOXOUT 执行加成，**首候选 +4**）参与场景 registry 版本（rules/content hash）；Gate B 校准修改任一数值时版本提升 + 全量重跑，不得局部保留有利 seed。
