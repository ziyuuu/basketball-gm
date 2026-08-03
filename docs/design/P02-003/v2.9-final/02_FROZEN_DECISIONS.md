# 02 — Frozen Decision Register（冻结决策登记表）

版本：v2.9（修订：对齐 V27-01 唯一分类、V27-02 单 draw 传球链、V28-01 传球链残留清除、V28-02 BOXOUT actor 派生）
日期：2026-08-03
状态：COMPLETE — 本清单为不可重开项。

## 1. 比赛与规则（来源：主提示词 §4.1 + 合同 `MatchRulesSchema`）

| ID | 冻结决策 | 数值 | 合同依据 |
|---|---|---|---|
| F-01 | 正式赛/友谊赛节数 | 4 节 | `regularPeriodSeconds: 600` |
| F-02 | 每节内部模拟时间 | 10 分钟（600 模拟秒） | `MatchRulesSchema` |
| F-03 | 玩家观看表现时间 | 每节约 60 秒 | 主提示词（展示层约束） |
| F-04 | 时间比例 | 1 显示秒 = 10 模拟秒 | 主提示词 |
| F-05 | 单个行为消耗 | 1～5 模拟秒 | 主提示词；开发计划 §7.4"活球片段至少消耗1秒" |
| F-06 | 进攻时间 | 30 模拟秒 | **决策：实现 30s 进攻时钟（方案 A）。不改合同事件枚举——违例用合同 `TURNOVER(UNFORCED_DEAD_BALL)` 表达，只增加规则常量 `shotClockSeconds=30`** |
| F-06a | 进攻时钟复位 | 新球权 30s；前场进攻篮板 20s；球权变更 30s；**非投篮犯规死球继承剩余** | NCAA R1/R2；`[DESIGN]` |
| F-06b | 进攻时钟违例 | `shotClock==0` 活球 → `TURNOVER(UNFORCED_DEAD_BALL)` + EXPLANATION fact；对方球权；不记抢断 | F-23；合同 TURNOVER payload |
| F-06c | 临违例出手压力 | `shotClock ≤ 5s` 时出手权重上升、仓促出手负修正 | F-22；`[CALIBRATE]` |
| F-06d | shotClock 跨边界恢复 | **事件重建**：`shotClock(anchor) = 复位值 − Σ(自最近复位点起 CLOCK_ADVANCED.seconds)`；复位点由 POSSESSION_STARTED(30)/REBOUND(OFFENSIVE)(20)/carry(继承) 事件流确定；不写入持久 Schema，step/runToEnd/replay 从事件流重建同一值 | `03` §4.4（修复 B-B03） |
| F-07 | 平局加时 | 正式/友谊 5 分钟加时直到分出胜负；队内赛允许平局 | `overtimePeriodSeconds: 300`；开发计划 §8.3"正式/友谊终场不平，队内赛可平" |
| F-08 | 个人犯规离场 | 5 次 | `foulOutLimit: 5` |
| F-09 | P02 全队固定 | 12 人 | `FullRosterMatchTeamInputSchema(12)` |
| F-10 | 正式赛/友谊赛登记 | 完整 12 人 | 合同 `registeredRosterIds.length(12)` |
| F-11 | 队内赛拆分 | 同一 12 人确定性拆 6v6 | `ScrimmageSideInputSchema(6)`；P02 基线 §4.2 确定性分组规则 |

## 2. 比赛架构（来源：主提示词 §4.2 + ADR-0005 + 开发计划 §4.4）

| ID | 冻结决策 | 合同/ADR 依据 |
|---|---|---|
| F-12 | 事件驱动模型 | 开发计划 §4.4 `MatchStep` |
| F-13 | Headless 决定比赛事实 | ADR-0005；开发计划 §7.4 resolver |
| F-14 | 展示层只消费事件，不反向决定事实 | P02 基线 §12.7 |
| F-15 | 2D 不逐帧同步；只展示球权变化、得分、关键行为、球员状态 | 主提示词 F-15 |
| F-16 | MatchSession 只从已提交 Anchor 推进到下一合法控制边界 | ADR-0005；开发计划 §4.4 |
| F-17 | Anchor 只含已提交事实，不含预采样未来 | ADR-0005 |
| F-18 | 中性命令不重抽未来、不追加 transcript | ADR-0005；开发计划 §4.6 |

## 3. 球权与行为主体（来源：主提示词 §4.3）

| ID | 冻结决策 |
|---|---|
| F-19 | 球员驱动，不是球队整体评分直接生成结果 |
| F-20 | 当前持球球员是行为决策主体 |
| F-21 | 球权由真实篮球事件自然流转：得分后发球/防守篮板/进攻篮板/抢断/传球成败/盖帽落点或出界/犯规与罚球 |
| F-21a | **首段球权（开场/加时）**：`keyedDrawUnitInterval({matchSeed, period, possessionIndex:0, segmentIndex:0, drawKind:'BALL_HANDLER', localIndex:0}) < 0.5 → 主队先，否则客队先`；用 `POSSESSION_STARTED` 表达 | `03` §4.1（修复 B-B05，Owner 已冻结） |
| F-22 | 允许无限传球；不设置人为行为次数上限 |
| F-23 | 进攻时间归零按正常篮球规则判为违例（不是强制命中或隐藏补偿）；违例 = `TURNOVER(UNFORCED_DEAD_BALL)`，对方球权，不记抢断 |
| F-24 | 每球权由片段推进：`possessionIndex` 球权归属改变时递增；`segmentIndex` 在同一球权内每次新进攻机会片段递增（含同方死球继续持球**与进攻篮板后再次进攻**，对齐基线 §12.2） | 开发计划 §4.4 / 基线 §12.2 / 合同 `SegmentKeySchema` |
| F-24a | ORB 后：`possessionIndex` 不变、`segmentIndex +1`；同方死球后：`possessionIndex` 不变、`segmentIndex +1`；球权变更：`possessionIndex +1`、`segmentIndex` 重置 0 | `03` §4.3（修复 B-B04） |
| F-25 | 死球必须由已发生篮球事件派生，不能独立抽取"是否死球" | P02 基线 §12.2 |

## 4. 攻防模型（来源：主提示词 §4.4 + P02 基线 §12.4）

| ID | 冻结决策 |
|---|---|
| F-26 | 攻防双方采用同一套球员驱动原则 |
| F-27 | 进攻球员选择行为，防守球员选择应对 |
| F-28 | 双方属性、倾向、状态和场景共同形成一次对抗 |
| F-29 | 默认直接防守者是对方同槽位球员（PG↔PG...C↔C） | 基线 §12.4 直接对位 |
| F-30 | 短人/空槽时按槽位距离选择最近在场防守者，距离相同取较小槽位号再按稳定球员 ID | 基线 §12.4 |
| F-31 | P02-003 不实现复杂换防、联防轮转、错位追踪、完整无球跑位 | 主提示词 |
| F-32 | 防守动作二态：稳守 / 冒险；动作压力修正 稳守 -3、冒险 +4 | 基线 §5.7/§12.4 |

## 5. 单行为单判定（来源：主提示词 §4.5 + 基线 §12.2）

| ID | 冻结决策 |
|---|---|
| F-33 | 每个行为：选择行为 → 确定参与球员 → 计算双方属性/倾向/状态/场景 → **一次 keyed RNG 判定 → 一个明确结果**。行为结果后的犯规/失误/归因/机会质量 delta 是**独立后续规则判定**（用各自 drawKind），不构成行为内部第二层（V25-01）。**行为唯一 4 类分类（SELECTABLE_DETERMINISTIC / SELECTABLE_ONE_DRAW / RULE_RESULT / ATTRIBUTION_ONLY）见 F-35b，`05` §C.10 为唯一权威（V29：概括表述显式引用四类分类）** |
| F-34 | 突破成功只代表突破成功；后续投篮或传球是新的独立行为 |
| F-35 | 不允许在一个行为内部隐藏多层随机链；**行为一次 RNG 只产生 {成功/失败}，不得在失败后内嵌二次抽取**（如"失败→FOUL_TYPE 30/70"）。犯规由独立 `DEFENSIVE_FOUL`/`OFFENSIVE_FOUL` 判定，`FOUL_TYPE` 只在犯规已发生后分类（V25-02） |
| F-35a | **创造类行为边界冻结（修复 B-B01/V22-01）**：DRIVE/SHAKE/ISO/STEP_BACK/POSTUP/HIGH_POST_CREATION 为**纯创造行为**，一次 RNG 结果集只含 {成功（创造优势）/失败（被逼停或组织中断）}；**不包含**丢球、出手命中、防守犯规、进攻犯规判定——丢球由独立 `TURNOVER_OCCURRENCE` 判定（`05` §C.1），犯规在独立 `DEFENSIVE_FOUL`/`OFFENSIVE_FOUL` drawKind 判定，后续终结/出手/传球是独立行为 | `03` §6.1 / `04` §B / `05` §C.8 |
| F-35b | **行为唯一 4 类分类（V25-01 + V26-01 + V27-01）**：每行为归属唯一类——`SELECTABLE_DETERMINISTIC`（0 次结果 RNG）/ `SELECTABLE_ONE_DRAW`（1 次 {成功/失败}）/ `RULE_RESULT`（不可选，规则结果）/ `ATTRIBUTION_ONLY`（不可选，归因，如 BLK）。**`05` §C.10 是唯一 44 行权威（机器断言 = 04 ID 集合）**。犯规/失误/归因/机会质量 delta 是独立后续判定，**计入行为总次数但不嵌套** |
| F-35c | **传球唯一失败链（V27-02，V28-01 全文唯一）**：PASS/HPASS/CREATIVE_PASS/ASTOPP/HELDKICK 统一为**单 draw `TURNOVER_OCCURRENCE`**——未发生即传球成功（receiver 权威化 + 助攻候选），发生即 PASSTOV。**不设独立 BEHAVIOR success draw**；实际失误概率恒等于 §C.1 的 p，无"失败但未 turnover"悬空状态。HELDKICK 分球质量为成功后**确定性** CreationFact delta（非二次 RNG）；HPASS/ASTOPP 非确定性行为（消耗 TURNOVER_OCCURRENCE draw） |
| F-35d | **BOXOUT actor 确定性派生（V28-02）**：BOXOUT 为 RULE_RESULT（不参加 `P_select`，无 `behaviorSelectionOrdinal`），**不产生独立 actor draw**。boxer = 投篮不中进入 REBOUND 解析时，同侧争抢候选（非持球者）中 `个人篮板执行` 最高者（并列 playerId UTF-16 稳定排序）；box-out 执行加成 **首个实现候选 `+4` 个人篮板执行点（`[FROZEN-FIRST-CANDIDATE]`，范围 [3..5]，Gate B 校准；纳入 rules/content hash，变更=§I 版本提升+全量重跑）** 进入该 boxer 的 `个人篮板执行` 后参与 REBOUND draw 候选权重。无 `BALL_HANDLER 3000+` ordinal、无独立 BOXOUT 事件（CLOCK_ADVANCED 属 REBOUND 片段） | `05` §C.10/D.6 + `06` §F.3 + `04` §B.6 |
| F-36 | 每个会抽取新比赛结果的活球片段至少消耗 1 秒；零时钟片段只允许已确定的罚球/换人/战术命令 | 开发计划 §7.4/§8.3 |
| F-37 | 犯规/抢断/封盖/助攻归因必须来自同一球权事实，不可终场后补抽 | 基线 §12.4 |

## 6. 展示与事实（来源：主提示词 §4.6 + 合同 MatchFact）

| ID | 冻结决策 |
|---|---|
| F-38 | 无价值普通过程可以不展示（普通传球/跑位/站位） |
| F-39 | 关键过程形成事实与展示：突破创造空间、吸引包夹、掩护创造机会、高质量传球、空切形成机会、空位出手、助攻、抢断、盖帽、关键篮板、得分、犯规与离场 |
| F-40 | 不模拟完整无球运动，只记录改变机会结构或产生角色价值的关键无球结果 |
| F-41 | 创建机会事实 = 由事件 reducer 生成的 `MatchFact`（EXPLANATION/STATISTICAL/OBSERVATION），非独立事件类型 | 合同 `MatchFactSchema` |

## 7. 球员数据模型（来源：合同 `MatchAbilitiesSchema` + `MatchPlayerSnapshotSchema`）

### 7.1 10 项能力（合同字段，0-100 整数）
| ID | 字段 | 语义（基线 §5.3） |
|---|---|---|
| F-42 | `finishing` | 终结：篮下和对抗中完成进攻 |
| F-43 | `shooting` | 投射：中远距离和罚球 |
| F-44 | `ballHandling` | 控球：持球推进并保护球 |
| F-45 | `playmaking` | 组织：发现并创造队友机会 |
| F-46 | `perimeterDefense` | 外线防守 |
| F-47 | `interiorDefense` | 内线防守 |
| F-48 | `rebounding` | 篮板 |
| F-49 | `athleticism` | 运动能力：速度/敏捷/爆发合并代理 |
| F-50 | `stamina` | 耐力：疲劳增长速度，不直接加命中 |
| F-51 | `tacticalUnderstanding` | 战术理解：传切/轮转/战术变更/持球传球错误 |

### 7.2 配套字段（合同）
| ID | 字段 | 语义 |
|---|---|---|
| F-52 | `bodyImpact` 体型影响 | 0-100 静态代理，不可训练；参与篮下终结/内线防守/篮板/封盖；不直接计入综合总评 | 基线 §5.4 |
| F-53 | `primaryPosition`/`secondaryPosition` | 主/副位置；副位置判定 -3 执行点、其他位置 -8 执行点 | 基线 §5.5 |
| F-54 | 6 个倾向 | 见 §8（合同 `MatchTendenciesSchema`） |
| F-55 | `archetypeTrait` | 0-1 个固定特质；6 个特质各 +6 执行点 | 基线 §5.8 |
| F-56 | `fatigueMilli` | 疲劳，千分位定点 `[0,100_000]` | 合同 `MilliSchema` |
| F-57 | `chemistryMilli` | 个人默契，千分位定点 `[0,100_000]` | 合同 `MilliSchema` |

### 7.3 属性作用原则（来源：主提示词 §5.3 + 基线 §12.4 公式）
| ID | 冻结决策 |
|---|---|
| F-58 | 专项能力决定行为上限 |
| F-59 | 身体素质（运动能力/体型）决定执行条件、对抗和稳定性 |
| F-60 | 意识（战术理解）决定判断、选择质量和团队执行 |
| F-61 | 身体和意识不得替代专项能力 |
| F-62 | 公式中的执行值是能力组合（如 `篮下进攻 = 0.55×终结+0.20×运动+0.15×体型+0.10×战术`），疲劳/位置/特质/战术各进入一次 | 基线 §12.4 |

## 8. 倾向（合同 `MatchTendenciesSchema`，FIXED）

| ID | 倾向字段 | 语义 | 值域 |
|---|---|---|---|
| F-63 | `possessionParticipation` 球权参与 | 获得和保留球权的相对权重（选择持球者） | 0-100 |
| F-64 | `passSelection` 传球选择 | 持球后寻找队友 vs 自行终结 | 0-100 |
| F-65 | `shotZones` 出手区域 | 外线/中投/篮下归一化偏好向量 | 三元合计=100 |
| F-66 | `transitionParticipation` 转换参与 | 快攻推进/跟进/提前落位权重 | 0-100 |
| F-67 | `defensiveRisk` 防守冒险 | 抢断/协防/压迫主动度，同时影响失位/犯规风险 | 0-100 |
| F-68 | `offensiveRebounding` 前场篮板 | 投篮后冲抢 vs 优先退防 | 0-100 |

| ID | 冻结决策 |
|---|---|
| F-69 | 引擎先过滤合法行为，再按 `行为权重 = 内容倾向权重 × 战术倍率 × 场景可用性` 归一化抽取 | 基线 §5.7 |
| F-70 | 倾向不直接改变成功率；只决定更可能选择什么 | 基线 §5.7 |
| F-70a | **能力不得充当行为倾向（V24-02）**：行为选择只由 6 项倾向 + 战术 + 场景决定；能力（含 tacticalUnderstanding）只进执行层。SCREEN/DOUBLECREATE/HELPD 不得以能力作主倾向 | `05` §D.2 |
| F-71 | 球权参与用于选择持球者；传球选择对 `100-传球选择` 比较传球与自行处理；转换/防守冒险/前场篮板各自对 `100-值` 比较 | 基线 §5.7 |
| F-72 | 过滤后总权重为 0 → 固定安全行为（按位置槽序号距离/名单顺序/稳定ID选队友传球；无合法传球执行当前区域最低风险合法出手） | 基线 §5.7 |
| F-73 | 多高持球倾向球员产生可观察的进攻割裂 | 主提示词 §6.1 |

## 9. 状态：疲劳与默契

### 9.1 疲劳（基线 §6.2，千分位定点）
| ID | 冻结决策 |
|---|---|
| F-74 | 疲劳范围 0-100（`fatigueMilli` 千分位），越高状态越差 |
| F-75 | 比赛执行惩罚：`疲劳执行惩罚 = clamp((疲劳 - 30) × 0.20, 0, 14)` —— **减法修正**，非乘数 |
| F-76 | 终结/投射/控球/外防/内防/篮板/运动能力扣完整惩罚；组织/战术理解扣一半；耐力不被扣 | 基线 §6.2 |
| F-77 | 疲劳不改变行为偏好（只走执行惩罚层） | 主提示词 F-60 |
| F-78 | 疲劳按已提交时间片累计：`本时间片疲劳增加 = 类型基础负荷 × (在场秒数/2400) × 耐力修正 × 节奏负荷系数 × 防守策略负荷系数`；不得终场倒算，加时继续累加 | 基线 §4.5 |
| F-79 | 比赛类型负荷：队内 6 / 友谊 10 / 正式 12；耐力修正 = `1 - 0.003×耐力` | 基线 §4.5 |
| F-80 | 节奏负荷系数 慢0.90/平衡1.00/快1.15；防守策略负荷 默认1.00/外扩压迫1.10；总战术负荷限制 0.85-1.20 | 基线 §4.5 |

### 9.2 默契（基线 §6.3-6.5）
| ID | 冻结决策 |
|---|---|
| F-81 | 个人默契 `chemistryMilli` 0-100，每球员一个；不保存两两关系/固定五人组合 |
| F-82 | 当前五人场上默契 C = Σ(个人默契 × 当前职责权重)/Σ权重；职责权重：第一组织者1.25/进攻战术枢纽1.10/防守指挥者1.10/其他1.00；同一球员多职责只取最高 | 基线 §6.4 |
| F-83 | 换人/强制替换/改职责/换战术枢纽时重算 C；短人时对实际在场 2-4 人用同一公式，分母为实际职责权重之和 | 基线 §6.4 |
| F-84 | 团队执行修正 = `clamp((C - 50) × 0.12, -6, +6)` —— **加法修正**，非乘数 | 基线 §6.5 |
| F-85 | 默契只作用于团队协作判定：传球衔接/持球传球失误、无球跑动与空位质量、协防轮转换防、新战术执行稳定性 | 基线 §6.5 |
| F-86 | 默契不直接增加个人投篮/罚球/力量/速度/单人篮板/一对一防守 | 基线 §6.5 |
| F-87 | 默契成长：`应用配合经验(F,E) = F + (100-F)×E/100`；按成长出场比例 `min(1, 实际出场秒数/2400)` | 基线 §6.6 |
| F-88 | 位置适配和战术适配是独立机制，不乘入默契公式 | 基线 §6.4 |

## 10. 原型特质 / 徽章接口

### 10.1 合同特质（`ArchetypeTraitSchema`，6 个，各 +6 执行点）
| ID | 特质 | 唯一生效场景 | 效果 |
|---|---|---|---|
| F-89 | `SPOT_SHOOTER` 定点射手 | 空位外线出手 | 投射执行 +6 |
| F-90 | `TOUGH_FINISHER` 强硬终结 | 篮下对抗终结 | 终结执行 +6 |
| F-91 | `STEADY_HANDLER` 稳健持球 | 持球/传球失误判定 | 控球执行 +6 |
| F-92 | `PERIMETER_LOCK` 外线锁防 | 直接防守持球人 | 外线防守执行 +6 |
| F-93 | `PAINT_BARRIER` 禁区屏障 | 篮下干扰/封盖 | 内线防守执行 +6 |
| F-94 | `REBOUND_INSTINCT` 篮板嗅觉 | 有对抗的篮板归属 | 篮板执行 +6 |

| ID | 冻结决策 |
|---|---|
| F-95 | 每名球员最多 1 个特质；3★可没有，4★夹具固定 1 个；获得即生效，无等级/XP/装备 | 基线 §5.8 |
| F-96 | 特质执行点只进入对应场景一次，`+6` 是执行点（非 600% 命中率） | 基线 §12.4 |
| F-97 | **徽章接口**：P02-002 合同以 `archetypeTrait` 作为徽章等价物（主提示词 §6.4 的"徽章"映射）；完整 `Badge` 接口仅保留设计与接口形态，**不进入合同 schema 落实**（G10，用户已决策） |
| F-98 | 禁止徽章修改基础属性、创建独立技能树、改变篮球规则 | 主提示词 |

## 11. 综合评分与影响力
| ID | 冻结决策 |
|---|---|
| F-99 | OVR/显示适配度不参与比赛公式；只用于展示与推荐 | 基线 §5.5/§12.4 |
| F-100 | 位置错配执行点（副位置 -3/其他 -8）只作用于组织职责、防守对位、战术站位和协作判定，不降低原始投射/终结 | 基线 §5.5 |
| F-101 | 高星存在感通过具体能力与倾向自然产生，不用 OVR 修改命中率 | 主提示词 |

## 12. 比赛行为覆盖（来源：主提示词 §7 + 合同事件/drawKind）
| ID | 冻结决策 |
|---|---|
| F-102 | 覆盖持球/创造/投篮/终结/传球/无球关键结果/防守/篮板（`04` 完整矩阵） |
| F-103 | 每个行为需明确：触发条件、核心属性、修正属性、对抗属性、可能结果、事件输出 |
| F-104 | **事件类型以合同 `MatchEventTypeSchema` 16 项为闭合枚举**：CLOCK_ADVANCED/POSSESSION_STARTED/POSSESSION_ENDED/TURNOVER/FOUL/FREE_THROW/SHOT/REBOUND/SCORE/ASSIST/STEAL/BLOCK/SUBSTITUTION/EFFECT_APPLIED/PERIOD_COMPLETED/MATCH_COMPLETED |
| F-105 | **drawKind 以合同 `MatchDrawKindSchema` 16 项为闭合枚举**：SEGMENT_DURATION/TRANSITION/BALL_HANDLER/DEFENSIVE_ACTION/TURNOVER_OCCURRENCE/TURNOVER_CLASSIFICATION/BEHAVIOR/SHOOTER/SHOT/OFFENSIVE_FOUL/DEFENSIVE_FOUL/FOUL_TYPE/REBOUND/STEAL_ATTRIBUTION/BLOCK_ATTRIBUTION/ASSIST_ATTRIBUTION |
| F-106 | 犯规类型闭合：`PERSONAL/SHOOTING/OFFENSIVE`（无技术/违体/球队犯规奖励） | 合同 FOUL payload |
| F-107 | 失误类型闭合：`PRESSURED_LIVE_BALL/UNFORCED_DEAD_BALL/OFFENSIVE_FOUL` | 合同 TURNOVER payload |
| F-108 | 射区闭合：`INSIDE/MID_RANGE/THREE_POINT` | 合同 SHOT payload |
| F-109 | **P02 不模拟球队犯规奖励**；投篮犯规按区域 2/3 罚、and-one 1 罚、进攻犯规失球权记PF、非投篮犯规死球保留球权 | 基线 §12.4 |
| F-110 | 每命中至多 1 助攻，每受压失误至多 1 抢断，每未命中至多 1 封盖；每次失误/未命中至多对应一个归因 | 基线 §12.4/开发计划 §8.3 |
| F-110a | **STLTRY 不得独立制造 STEAL（V24-03）**：必须先有 `PRESSURED_LIVE_BALL` turnover → 才允许 `STEAL_ATTRIBUTION` → 归因成功才产生 STEAL。STLTRY 只提高归因率 | `05` §C.6/C.9 |
| F-110b | **receiver 权威化（V24-04）**：成功传球后 receiver 立即成为当前 handler，不重新抽选；除非后续事件改变球权 | `06` §F.2 |

## 13. 三轴战术与 effect
| ID | 冻结决策 | 合同/基线依据 |
|---|---|---|
| F-111 | 三轴 = 节奏/进攻重心/防守重心 | `MatchTacticsSchema` |
| F-112 | 节奏：慢/平衡/快 → 回合时长 ×1.12/基准/×0.88，转换权重 ×0.80/×1.25，失误率节奏修正 ±0.015，负荷 ×0.90/×1.15 | 基线 §10.2 |
| F-113 | 进攻重心：外线/均衡/篮下 → 外线出手 ×1.25/篮下 ×0.85 等；篮下额外造犯规 ×1.10 | 基线 §10.2 |
| F-114 | 防守重心：外扩压迫/均衡/收缩禁区 → 对方外线执行 -4 等；每个战术有代价 | 基线 §10.2 |
| F-115 | 单战术轴对一次判定净执行修正上限 ±6；乘法效果限制 0.75-1.25 | 基线 §10.3/合同 effects |
| F-116 | 明显强弱队能力差不能被一个正确战术稳定抹平 | 基线 §10.3/开发计划 §7.4 场景6 |
| F-117 | effect 参数枚举闭合 8 项：PACE/PERIMETER_ATTEMPT_WEIGHT/INTERIOR_ATTEMPT_WEIGHT/PERIMETER_DEFENSE_EXECUTION/INTERIOR_DEFENSE_EXECUTION/DEFENSIVE_REBOUND_EXECUTION/TURNOVER_PRESSURE/OPPORTUNITY_QUALITY | 合同 `EffectParameterSchema` |
| F-118 | effect 来源闭合：`BASE_TACTIC/OPPONENT_POLICY`；同键新替旧、跨来源合并封顶、持续球权递减 | 合同 effects.ts/开发计划 §4.6 |
| F-119 | 三轴以 effect 形式进入 reducer，只在对应场景进入一次 | 开发计划 §4.6 |

## 14. 控制策略与轮换
| ID | 冻结决策 | 依据 |
|---|---|---|
| F-120 | 控制策略闭合：`INSTANT/FULL_COACH`；队内赛固定 INSTANT | 合同 `ControlStrategySchema` |
| F-121 | 快速结算使用确定性助教；完整执教玩家手动换人；犯满强制替换固定兜底 | 基线 §8.4/8.5 |
| F-122 | 助教轮换预设闭合：`SHALLOW/BALANCED/DEEP/MANUAL`；阈值 75/65/55、最多使用 8/10/12 人 | 基线 §8.5 |
| F-123 | **P02-003 的中性测试轮换必须标记 `internal/test`，不得直接成为产品助教策略** | 开发计划 §7.4 |
| F-124 | 犯满后自动补位；2-4 人继续；少于 2 人 `FORFEIT_INSUFFICIENT_PLAYERS` 规则性失败 | 基线 §8.6/合同 anchor status |

## 15. 概率与统计公式（来源：基线 §12.4 [CALIBRATE]）
| ID | 冻结决策 |
|---|---|
| F-125 | 修正只结算一次，固定顺序：能力组合→疲劳惩罚→位置错配修正→特质执行点→单次封顶±6 战术执行点 | 基线 §12.4 |
| F-126 | 失误率 = `clamp(0.13 + 0.002×(防守压力-护球组织) + 0.002×动作压力修正 + 节奏修正 - 0.002×团队执行修正, 0.06, 0.25)` | 基线 §12.4 |
| F-127 | 受压失误分类率 = `clamp(0.50 + 0.04×动作压力修正 + 0.002×(防守压力-护球组织), 0.10, 0.90)` | 基线 §12.4 |
| F-128 | 区域基础命中：篮下0.56/中投0.39/三分0.33；命中率 = `clamp(区域基础 + 0.0025×(区域进攻执行-区域防守执行) + 0.0015×(机会质量-50), 区域下限, 区域上限)`；候选上下限 篮下0.25-0.80/中投0.15-0.65/三分0.10-0.60 | 基线 §12.4 |
| F-129 | 机会质量 = `clamp(0.35×创造执行 + 0.25×团队协作指数 + 0.20×空间指数 + 0.20×协防环境 + 机会类战术执行点, 0, 100)` | 基线 §12.4 |
| F-130 | 罚球命中率 = `clamp(0.75 + 0.003×(投射-50) - 0.002×疲劳执行惩罚, 0.45, 0.95)`；罚球不受默契影响 | 基线 §12.4 |
| F-131 | 前场篮板率 = `clamp(0.27 + 0.0025×(进攻篮板执行-防守篮板执行), 0.12, 0.45)` | 基线 §12.4 |
| F-132 | 防守犯规率 / 进攻犯规率 / 抢断归因率 / 封盖归因率 / 助攻归因率公式见 `05` | 基线 §12.4 |
| F-133 | 所有判定用 keyed RNG：`(matchSeed, period, possessionIndex, segmentIndex, drawKind, localIndex)`；命令/UI/cosmetic 不消耗结果 RNG | 合同 keyed-rng.ts/开发计划 §4.5 |

## 16. 统计与不变量
| ID | 冻结决策 | 依据 |
|---|---|---|
| F-134 | box score 字段 = 合同 `PlayerBoxScoreSchema`：secondsPlayed/points/fgm/fga/3pm/3pa/ftm/fta/orb/drb/ast/stl/blk/tov/pf | 合同 |
| F-135 | 所有统计由事件累积；禁止终场后重新生成 | 基线 §12.4/开发计划 §4.4 |
| F-136 | 球员得分=球队得分，分节/加时合计=终场；命中≤出手；三分为投篮子集 | 开发计划 §8.3 |
| F-137 | 出场秒数按实际人数×区间时长核对；犯满后无后续参赛事件 | 开发计划 §8.3 |
| F-138 | 事件归因绑定：SHOT/SCORE/FT/REBOUND(进攻)/ASSIST→持球方；STEAL/BLOCK/REBOUND(防守)→对方；FOUL(OFFENSIVE)→持球方，否则对方 | 合同 schemas superRefine |
| F-139 | 球队统计=球员合计；P02 无独立球队行（无 team rebound/team TO 独立字段） | 合同 `TeamBoxScoreSchema` |

## 17. 星级与平衡
| ID | 冻结决策 | 依据 |
|---|---|---|
| F-140 | P02 只生成 3★/4★；5★/6★ 不生成、移入 P09 | 基线 §5.2 |
| F-141 | 3★：通用角色主体，软上限较低；4★：独立角色/培养核心，可拥有特质 | 基线 §5.2 |
| F-142 | 三星队目标 20-40 分（用户确认"业余球员"合理）；四星 30-60；5★/6★ 为 P09 远期参考 | 主提示词 + 用户确认 + 冲突#5 |
| F-143 | 方向场景 = 开发计划 §7.4 的 5 基线 + 1 增补，64 固定配对 seed | 开发计划 §7.4 |
| F-144 | 明显强弱队：64 场平均分差>0，强队≥33/64 获胜 | 开发计划 §7.4 |
| F-145 | 高疲劳 vs 恢复：tacticExecutionRate 与 q4NetRating 均值更低且≥40/64 配对更低，高疲劳胜场少≥4 | 开发计划 §7.4 |
| F-146 | 正常位置 vs 错配：tacticExecutionRate 更低、unforcedTurnoverRate 更高、defensiveBreakdownRate 更高，各≥40/64 | 开发计划 §7.4 |
| F-147 | 战术适配 vs 不适配：主要指标与代价指标按规则方向，≥40/64；代表目标区域机会占比差≥8 个百分点 | 开发计划 §7.4 |
| F-148 | 浅轮换 vs 深轮换：P02-006 后加入（P02-003 不 gate） | 开发计划 §7.4 |
| F-149 | 弱队适配不抹平实力差：强队平均分差仍>0，弱队最多 31/64 获胜 | 开发计划 §7.4 |

## 18. 性能预算（开发计划 §7.4）
| ID | 冻结决策 |
|---|---|
| F-150 | P02-003 首次 Gate：10,000 场总耗时 ≤60,000ms、单场 p95 ≤10ms、进程 peak RSS ≤512MiB；预热 seed `p02-match-warmup-0001~0200`，测量 seed `p02-match-bench-00001~10000` |
| F-151 | 冻结首次通过值 B_total/B_p95 后，后续 Gate 满足 `total ≤ min(2×B_total, 60000ms)`、`p95 ≤ min(2×B_p95, 10ms)` |
| F-152 | watchdog 只报引擎错误；Gate 全部固定 seed 零触发 |

## 19. 流程约束（主提示词 §10-15 + 开发计划）
| ID | 冻结决策 |
|---|---|
| F-153 | stepToNextControlBoundary/runToEnd/replay 在相同输入+seed+transcript 下 event/fact/transcript 身份逐项一致 | 开发计划 §7.4 |
| F-154 | 非法局部命令只拒绝；Anchor/局部RNG/transcript 不变；中止整场丢弃工作副本零全局污染 | 开发计划 §4.6 |
| F-155 | 单次 stepMatch 局部原子：draft 上完成 resolver+reducer+归因+校验，再替换 Anchor | 开发计划 §4.6 |
| F-156 | 全部指定资料已读取；完成研究前不向 Owner 提普通问题；`[CALIBRATE]` 不逐项问 | 主提示词 |
| F-157 | 禁止：写代码/建 Issue/改仓库/冒充依据/静默扩大 Schema | 主提示词 §15 |

## 20. 来源与优先级（修订版）
以 `00` Authority Conflict Log 修订后的优先级为准：Owner 确认 > 玩法基线 v1.2 > 开发计划 v1.2 > P02-002 合同/测试 > 交接包 > 外部资料 > 设计推断。
