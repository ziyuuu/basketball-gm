# 08 — P02-002 Traceability Matrix（合同追溯矩阵）

版本：v2.7（内容自 v2.2 未变，N1：traceability 稳定）
日期：2026-08-03
状态：COMPLETE

## A. 说明

本矩阵以真实仓库 P02-002 合同（`main@45dc1a26`，PR #13 合并）为基准逐项对应 P02-003 设计。每项引用合同类型/Schema 与 P02-003 文档章节。

## B. 逐项对应矩阵

### B.1 MatchInput（合同 `MatchInputSchema`）
| 合同字段 | P02-003 设计 | 章节 |
|---|---|---|
| `matchKind/recordScope` | OFFICIAL/OFFICIAL_CAREER、FRIENDLY/FRIENDLY_ARCHIVE、SCRIMMAGE/SCRIMMAGE_OBSERVATION 三对闭合 | `03` §1 |
| `gameIdentity/gameId/matchId/slotIdentity/absoluteWeek` | 确定性身份链（`idHash`） | `03` §2.4 |
| `rules{regularPeriodSeconds:600, overtimePeriodSeconds:300, foulOutLimit:5}` | 4×10 分钟、加时 5 分钟、5 犯离场 | `03` §3 |
| `matchSeed[4×u32]` | keyed RNG 种子材料 | `03` §2.3 |
| `controlStrategy` | INSTANT/FULL_COACH | `03` §14 |
| `homeTeam/awayTeam`（12 人完整登记） | 正式/友谊整队登记 | `03` §1 |
| `sourceTeamId/sourceRosterIds`（队内 6v6） | 12 人确定性拆 6v6 | F-11 |
| `MatchPlayerSnapshotSchema`：abilities/bodyImpact/tendencies/archetypeTrait/fatigueMilli/chemistryMilli | 10 能力+体型+6倾向+特质+状态 | `04` §C |
| `startingLineup/roles/tactics/rotationPreset` | 五槽首发、三职责、三轴战术、轮换预设 | `03` §11/13 |

### B.2 MatchAnchor（合同 `MatchAnchorSchema`）
| 合同字段 | P02-003 设计 |
|---|---|
| `previousAnchorHash/anchorHash` | 哈希链，first 绑定 genesis |
| `period/periodClockSeconds/score` | 节次/时钟/比分 |
| `possession{side, possessionIndex, segmentIndex}` | 球权归属与片段推进（F-24） |
| `lineups/roles` | 在场槽位与职责 |
| `pendingSubstitutionEntryHashes` | 排队换人 |
| `fatigueMilliByPlayer/chemistryWeightedMilli` | 疲劳/场上默契即时值 |
| `boxScore{home,away}` | 合同 PlayerBoxScoreSchema 累积 |
| `effectiveFragment/effectiveFragmentHash` | 生效战术/roles/lineups/effects |
| `controlBoundary` | MATCH_START/DEAD_BALL/PERIOD_BREAK/MATCH_COMPLETE |
| `status` | IN_PROGRESS/COMPLETED/FORFEIT_INSUFFICIENT_PLAYERS |
| `eventCursor/transcriptCursor/localRevision` | 稠密游标 + 局部修订 |

### B.3 MatchEvent（合同 `MatchEventSchema`）
- 16 项闭合事件类型（F-104），P02-003 行为全部映射（`04` §B）。
- `localEventSequence` 片段内稠密从 0；`cursor` 整场稠密；`eventId` 绑定坐标（`03` §2.4）。
- 归因绑定：持球方/对方（F-138）。

### B.4 MatchFact（合同 `MatchFactSchema`）
- factKind EXPLANATION/STATISTICAL/OBSERVATION；创建机会用 EXPLANATION fact（F-41）。
- 必须回指 source event ID，UTF-16 排序，factId 绑定（`03` §2.4）。

### B.5 MatchEffect（合同 `MatchEffectSchema` + `effects.ts`）
- 来源 `BASE_TACTIC/OPPONENT_POLICY`；8 参数闭合（F-117）。
- 同键替换、跨来源合并封顶（ADD ±6000 / MULTIPLY 750-1250）、持续球权递减（F-118）。
- P02-003 复用 `selectActiveMatchEffects/mergeMatchEffects/decrementEffectsAfterCommittedPossession`（开发计划 §4.6）。

### B.6 MatchCommand（合同 `MatchCommandSchema`）
- 4 命令闭合：SET_MATCH_TACTICS/SET_MATCH_ROLES/QUEUE_SUBSTITUTIONS/CANCEL_QUEUED_SUBSTITUTIONS。
- 无 `RUN_MATCH` 命令（合同测试确认）；step/runToEnd 是 application/debug API（F-153）。

### B.7 MatchTranscript（合同 `MatchTranscriptSchema`）
- actor PLAYER/ASSISTANT/OPPONENT/RULES；local revision +1；hash 链连续。
- 中性命令不追加 transcript（F-18）；非法命令不改变 Anchor/RNG/transcript。

### B.8 MatchResultDraft / MatchProtocolBundle
- `finalAnchor/events/facts/transcript/eventDigest/terminationReason/matchResultId` 全部绑定（合同 superRefine）。
- 分类 result 必须等于 MatchInput 分类。

### B.9 keyed RNG（合同 `match/keyed-rng.ts`）
- `MatchDrawKey{matchSeed, period, possessionIndex, segmentIndex, drawKind, localIndex}` → SHA-256 前 64 位 → [0,1)/整数（`03` §2.3）。
- 16 drawKind 闭合（F-105）；不可变、无 cursor、命令/UI/cosmetic 隔离。
- `deriveMatchSeedMaterial` 固定 4 次 nextUint32。

### B.10 fixed point（合同 `core/fixed-point.ts`）
- 千分位定点；roundHalfUp 签名舍入；clamp；溢出拒绝；序列化无 locale（`03` §2.2）。

### B.11 Canonical / 身份
- 合同 `core/canonical-v2.ts`：UTF-16 key 排序、纯 SHA-256、idHash（`03` §2.4）。
- 无 UUID/墙钟/进程顺序/UI 状态（ADR-0005）。

## C. 10 能力 + 配套字段 → 设计映射

| 字段 | 使用位置（`04` §B） |
|---|---|
| `finishing` | SHOT(INSIDE) 终结主体 |
| `shooting` | SHOT(MID_RANGE/THREE_POINT) + FT |
| `ballHandling` | 推进/突破/护球 + 失误抵抗 |
| `playmaking` | 传球/助攻/空位创造 |
| `perimeterDefense` | 外线压制/抢断/突破防线 |
| `interiorDefense` | 内线防守/封盖 |
| `rebounding` | 篮板归属 |
| `athleticism` | 突破/封盖/退防/冲板修正 |
| `stamina` | 疲劳负荷增长 |
| `tacticalUnderstanding` | 选择/团队执行 |
| `bodyImpact` | 内线对抗/犯规/篮板卡位 |
| 6 倾向 | 行为选择（F-63~68） |
| `archetypeTrait` | 特质 +6 执行点（F-89~96） |
| `fatigueMilli/chemistryMilli` | 执行惩罚/团队修正（F-75/84） |

## D. 追溯完整性核查

| 合同项 | 状态 |
|---|---|
| MatchInput | ✅ B.1 |
| MatchAnchor | ✅ B.2 |
| MatchEvent | ✅ B.3 |
| MatchFact | ✅ B.4 |
| MatchEffect | ✅ B.5 |
| MatchCommand | ✅ B.6 |
| MatchTranscript | ✅ B.7 |
| MatchResultDraft/ProtocolBundle | ✅ B.8 |
| keyed RNG | ✅ B.9（drawKind/localIndex 注册规则见 `05` §H，修复 B-B02） |
| fixed point | ✅ B.10 |
| Canonical/身份链 | ✅ B.11 |
| 10 能力+配套字段 | ✅ §C |
| 不破坏身份链 | ✅ 事件全链路引用 anchor |
| RNG 注册闭合 | ✅ `05` §H：每判定合法 drawKind + stable localIndex + 候选稳定排序 + 多次抽取 |
| 所有 RNG 判定闭合 drawKey | ✅ 合同 MatchDrawKeySchema |
