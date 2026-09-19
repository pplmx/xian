# 组装指南 —— 从零搭一套自己的数值系统

这份指南只回答一件事:**要做一个 X 类的游戏,按什么顺序接哪些模块。**
它不是 API 手册(那是 [README](../README.md)),也不是迁移记录(那是 [parity.md](./parity.md))。

每条结论后面都跟着**能跑的证据**:示例程序或库里的判据用例。指南里提到的每个 `create*`
与每个示例文件都会被自检核对(`scripts/verify-dist.mjs` 与 `scripts/engine-standalone.mjs`),
所以它不会烂在文档里 —— 拆了模块、改了名字,自检当场就红。

> 证据(**示例**与**用例**)住在仓库里,**不随包发布**(包里只有 `dist` 与文档)——
> 所以这里的每条路径都写成了指回仓库的绝对链接,点开就能看/能跑:
> <https://github.com/pplmx/wanxiang-engine>。

**要抄的话,从这里开始**:[`examples/from-zero.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/examples/from-zero.ts) 是一份
**不引用任何内容包**、一百多行装完一个世界的程序(槽位 / 品质 / 词条 / 两段路 / 六个阻碍全写在里面),
复制它、把名字与数字换成你的,就是你的游戏。下面四条配方是"按玩法形状挑模块"的索引。

---

## 0 · 三个前置决定(与题材无关)

| 决定 | 为什么要先定 | 库里的位置 |
| --- | --- | --- |
| **时钟单位** | 秒还是毫秒、用游戏内时长还是墙上时间 —— 定错会出现"离线一晚净值翻倍"这类事故 | `cycles` 用**游戏内秒**;墙上时间(状态到期)走"内容写秒、时钟声明毫秒",见 `createBuffSystem` 的 `clock` |
| **数值层** | 后期数值会不会超过 double(1e40 那种) | `Numeric<T>`:`numberNumeric` 是默认,换大数只传一层(`resources` / `settlement` 都吃它) |
| **状态放在哪** | 库是**纯函数 + 结构**:吃 state、返回新 state | 存档、store、服务端都行;`saveShape` 负责把坏数据修回来 |

一条经验:只要游戏里存在"离线也涨"的东西,**先把时钟与数值层定下来**再接别的 —— 后补这两样
要动每一处算术。

## 1 · 依赖顺序(按这条顺序接,基本不会返工)

1. **地基**:`createRng`(可复现随机)→ `snapshotOf` / `deltaSince`(基准快照)
2. **账本**:`createResourceSystem` → `createHoldingSystem` → `createIntake` → `createSettlement`
3. **成长**:`createAttributeSystem` → `createRealmSystem` → `createEquipmentSystem` → `createSkillSystem` →
   `composeCraftRate` + `createRecipeRunner` → `createFacilitySystem` / `createPointPool`
4. **时间**:`planIdle` / `runIdle` → `createCycleSystem` → `accrue`(每小时产出)
5. **目标**:`evalGoal` / `goalProgress` → `createTaskBoard`(每期)/ `createChain`(顺序)/ `createUnlockRegistry`(一次性)
6. **抽取**:`drawFrom` / `drawMany` → `createDropTable` → `createPityCounter`
7. **世界**:`createChoiceSystem` / `createCodex` / `createStageMemory` / `createEconomyReadings` / `createTriage` / `createBuffSystem`
8. **存档**:`asRecord` 等形状原语 → `defineSaveFormat` / `runMigrations`
9. **收口**:`defineGame` 做内容交叉校验;`presets/xiuxian`、`presets/demo`、`presets/daily` 当参照

为什么是这个顺序:后一层的输入基本都在前一层 —— 没有账本就谈不上"结算回执",没有计数器就
谈不上任务进度,没有可复现随机就谈不上"保底不改随机流"。

## 2 · 四条配方

### 配方 A · 放置修仙(回合制战斗 + 长线成长)

```
属性/境界 → 装备与词条 → 副本与战斗 → 掉落表 → 设施与投资点 → 离线账 → 状态(丹药增益)
```

| 你要的东西 | 接哪个 | 可跑的证据 |
| --- | --- | --- |
| 等级曲线、进阶、寿元 | `createRealmSystem` | `presets/xiuxian` + `presets.spec.ts` |
| 等级曲线的手感(一层涨多少、跨境陡不陡、卡关卡几次) | 同上 | `realms.sim.spec.ts`(境内涨 14.9 倍而跨境只涨 1.28 倍;大关另走一条成功率线) |
| **数值涨到多大就该换大数** | `Numeric<T>` 适配器 | `numeric.sim.spec.ts`(安全区到 2^53;面板先失真:同一个"1.0京"盖住 5e14;×1.5 每层到第 80 层、×3.2 到第 28 层;换成 bigint 的实测对照) |
| **我这套曲线跑起来什么手感**(哪一格跳得最狠 / 什么时候开始碾压内容) | `createProgressionAudit` | `progression.spec.ts`(相邻格倍数、换界单列、碾压阈值可调)+ [`examples/realm-ladder.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/examples/realm-ladder.ts)(体检当场抓到"换到新界反而更便宜"的倒挂) |
| **自己写一张境界表**(世界分段 / 逐境层数 / 两段式需求 / 大关走试炼 / 换数值层) | `createRealmSystem` + `Numeric<T>` | [`examples/realm-ladder.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/examples/realm-ladder.ts)(「一梯三界」:点心铺学徒 → 宗师,7 境 × 5 层、没配 lifespan 就等于无限、只拧一个后段倍率就从 871 天缩到 660 天) |
| 掉装 / 洗练 / 装配 | `createEquipmentSystem` | [`examples/quickstart.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/examples/quickstart.ts) |
| 洗练 / 重铸(锁住几条、其余重掷) | `equipment.rerollAffixes` | `equipment.sim.spec.ts`(锁两条必定洗出三条;池子被门槛排空是唯一例外) |
| 技能 / 功法(等级曲线、升级消耗、满级择路) | `createSkillSystem` | `skills.spec.ts` + `skills.sim.spec.ts`(练满总账、折扣只省可折项、分支值几级) |
| 背包 / 持有(容量、装配即腾位、满了怎么办) | `createHoldingSystem` | `holding.spec.ts` + `holding.sim.spec.ts`(装上 6 件就腾出 6 位) |
| 副本链(区域怎么开、打几场见首领、通关给什么) | `createDungeonSystem` | `dungeons.spec.ts` + `dungeons.sim.spec.ts`(两种节奏差一场、敌人随层级陡多少) |
| 战斗骨架(护盾、反击、追击、技能标签) | `createCombatEngine` | [`examples/combo-arts.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/examples/combo-arts.ts) |
| 默认伤害公式的节奏(攻防比 → 几回合打完) | 同上 | `combat.sim.spec.ts`(攻翻倍伤害 2.67 倍;1000 血靶子:攻=防 20 回合 / 攻·4 只 4 回合) |
| **把你自己那套战斗整段接进来** | `BattleConfig` 的 `skillFn` / `strikeFn` / `actFn` | [`examples/combat-takeover.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/examples/combat-takeover.ts)(老口径 × 接管版,同 200 颗种子逐场相同) |
| **换一种完全不同的战斗口径再试一次** | 同上三处主权 | [`examples/arena-takeover.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/examples/arena-takeover.ts)(拳赛:体力 / 连击 / 确定性反打 —— 同 200 颗种子逐场相同) |
| 掉落表(概率归一、保底、份数) | `createDropTable` | `drops.spec.ts` |
| 炼制 / 合成的成功率(四乘区相乘 + 越级) | `composeCraftRate` / `leverFactor` / `overReachFactor` | `crafting.spec.ts` + `crafting.sim.spec.ts`(每个乘区值多少、越级多陡、练到九成要多久) |
| 技艺 → 采料 → 开炉 → 成品这一整条怎么串 | `createSkillSystem` + `createDropTable` + `createRecipeRunner` + `createCompanionSystem` | [`examples/craft-loop.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/examples/craft-loop.ts)(「药庐二十四炉」:技艺涨一炉就稳一分、保料把"亏"变成"慢"、灵药是瓶颈) |
| 开炉之后实际发生什么(没开炉 / 失败保料 / 双成) | `createRecipeRunner` | `recipes.spec.ts` |
| 建造 / 每小时产出 | `createFacilitySystem` + `accrue` | [`examples/daily-loop.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/examples/daily-loop.ts) 的设施段 |
| 产线曲线与仓库上限怎么搭 | `createFacilitySystem` 的 `perHour` / `cap` | `facilities.sim.spec.ts`(装满后每小时白产多少、结算粒度对总量的影响) |
| 加点(天赋 / 灵脉) | `createPointPool` | `points.spec.ts` |
| 离线上限与步数 | `planIdle` / `runIdle` | [`examples/daily-loop.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/examples/daily-loop.ts) 的离线段 |
| 限时增益 | `createBuffSystem` | [`examples/daily-loop.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/examples/daily-loop.ts) 的状态段 |

### 配方 B · 学习打卡 / 日常(无战斗)

```
计数器 → 今日任务板 → 主线链 → 一次性成就 → 资源账本(奖励)+ 状态(专注)
```

| 你要的东西 | 接哪个 | 可跑的证据 |
| --- | --- | --- |
| 今日三件(按增量结算、换期幂等) | `createTaskBoard` | [`examples/quest-loop.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/examples/quest-loop.ts) |
| 每日任务的目标值定多少 | `createTaskBoard` 的 `target` | `tasks.sim.spec.ts`(按休闲画像的六成定,别按活跃画像) |
| 主线三节(一次结算连推多节) | `createChain` | [`examples/quest-loop.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/examples/quest-loop.ts) |
| 成就 / 里程碑(只记一次) | `createUnlockRegistry` | [`examples/quest-loop.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/examples/quest-loop.ts) |
| "本季多少" | `snapshotOf` / `deltaSince` | [`examples/quest-loop.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/examples/quest-loop.ts) 的本季段 |
| 伙伴 / 随从(性格系数怎么合) | `createCompanionSystem` | `companions.spec.ts` + `companions.sim.spec.ts`(默认 override 只留最后一只;`add-relative` 才是相加) |
| 抉择(事件选项 / 分支:能不能选、按权重掷哪种后果、没选时的兜底) | `createChoiceSystem` | `choices.spec.ts` + `choices.sim.spec.ts`(5% 的分支抽 100 次可能一次不出;兜底三级落到哪) |
| 图鉴 / 见闻(见过什么、懂到什么程度) | `createCodex` | `codex.spec.ts` + `codex.sim.spec.ts`(门槛 3/8/20 次照面、概率升档的到位率) |
| 世界记忆(区域繁荣 / 阵营好感:升档与回落) | `createStageMemory` | `memory.spec.ts` + `memory.sim.spec.ts`(两路门槛取先到、闲置到点即回落) |

> **这一层我根本没有怎么办**:在 `defineGame` 的配置里写 `equipment: null` / `dungeons: null`,
> 就是一句"这款游戏没有装备 / 没有副本"。门面里那一层仍在,但那是**空系统**(0 槽 0 件 / 0 区域):
> 读结构给你有意义的空,真去用(抽一件、取第一处区域)会当场说明白。
> **省略 ≠ 没有** —— 漏了一节会在装配时被拦下,因为"忘写了"和"故意没有"必须分得清。
> 一份 60 行的骨架(只有等级与属性)可以照抄:
> [`src/presets/minimal.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/src/presets/minimal.ts)。

### 配方 C · 抽卡收集

```
随机源 → 内容池(权重/一次性)→ 单次概率 → 跨次保底 → 图鉴收录 → 入库漏斗(满了怎么办)
```

| 你要的东西 | 接哪个 | 可跑的证据 |
| --- | --- | --- |
| 抽到不重复、按标签切题 | `drawFrom` / `drawMany` | `deck.spec.ts` |
| 内容池的权重到底影响什么 | 权重是**排序**不是门槛:清空整池的抽数固定等于张数,权重只决定"先见谁";一旦限定预算(只抽 10 次),排序才变成覆盖率 | `deck.sim.spec.ts`(实测:同一批内容只抽 10 次,见到"罕见"档的概率 22% vs 摊平权重后 94%) |
| 单次概率(归一 + 上限)、保底、份数 | `createDropTable` | `drops.spec.ts` + `drops.sim.spec.ts`(实测数字) |
| 软保底(越抽越容易)与第 N 次必出 | `createPityCounter` / `softChance` | `pity.spec.ts` + `pity.sim.spec.ts`(实测数字) |
| 收集进度(照面 / 懂几成) | `createCodex` | `codex.spec.ts` |
| 重复的怎么处理 | `createIntake` | `intake.spec.ts` |
| 整套抽卡 + 图鉴 + 日常的闭环 | —— | [`examples/collect-loop.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/examples/collect-loop.ts)(内容池 / 保底 / 集册 / 折算 / 今日三件 / 成就 / 经济体检在一份 200 行的小程序里) |
| 收不下怎么办(被拒 / 被挤掉 / 收不下,三条去路同一本折算账) | `createIntake` | `intake.spec.ts` + `intake.sim.spec.ts`(一次入库折算的是哪一件、见证与收纳分开) |

### 配方 D · 经营模拟

```
资源账本 → 产线(每小时产出与零头)→ 上限与截断 → 结算回执 → 经济读数 → 入库与分流裁决
```

| 你要的东西 | 接哪个 | 可跑的证据 |
| --- | --- | --- |
| 收支带来源、上限、取整 | `createResourceSystem` | `resources.spec.ts` |
| 上限截断、来源审计、整笔付出 | 同上 | `resources.sim.spec.ts`(发 150 只入 10、买不起整笔不扣) |
| 每小时产出(零头不丢) | `accrue` | `facilities.spec.ts` |
| 离线时长账(上限 / 效率 / 步数) | `planIdle` / `runIdle` | `idle.spec.ts` + `idle.sim.spec.ts`(边际收益曲线,以及"上限是按每次结算施加的") |
| "本次所得"与账本对得上 | `createSettlement` | `settlement.spec.ts` |
| 哪个资源是瓶颈 / 烂在手里 | `createEconomyReadings` | `economy.spec.ts` + `economy.sim.spec.ts`(默认阈值翻译成"支出/收入"区间,以及 ±10% 的敏感区有多宽) |
| 自动清理规则链 | `createTriage` | [`examples/daily-loop.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/examples/daily-loop.ts) 的清理段 |
| 清理规则"顺序换了会多扔几件" | 顺序即政策:重叠的规则谁在前谁定生死(同一批货留 6 件到留 13 件都有);"某条一次都没出手"要数每条规则接走几件才看得出来(被全覆盖 / 阈值超出内容值域) | `triage.sim.spec.ts` |
| 整套经营闭环(产线 → 上限 → 卖出 → 体检 → 升级 → 清理 → 日常) | —— | [`examples/shop-loop.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/examples/shop-loop.ts)(一产一销的一间铺子:零头不丢、上限截断、离线时长账、两种升级选择各算一遍、清仓规则链,全在一份 200 行的小程序里) |
| 跨模块自洽(账目) | —— | `integration.spec.ts`(守恒 / 同源 / 单调幂等 / 可复现) |
| 跨模块自洽(时间 × 随机) | `planIdle` + `createCycleSystem` + `createPityCounter` | `integrationTime.spec.ts`(同种子同结果、问周期不消耗随机、保底不改未触发前的随机、分段与逐步一致) |
| 轮换的长期分布与"最长连着重复几天" | `createCycleSystem` | `cycles.sim.spec.ts`(权重摆好之后一年里的实测天数与最长连庄) |
| 周期 + 抉择 + 投资点 + 世界记忆怎么串 | 四层各一 | [`examples/world-loop.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/examples/world-loop.ts)(「行商十二日」:每天换行情、路上遇事、加点、名声回落) |
| 投资点的容量怎么分、换主位亏不亏 | `createPointPool` | `points.sim.spec.ts`(主位上限与总容量是两道闸;超额部分冻结) |
| 跨模块自洽(状态 × 投资点 × 任务) | `createBuffSystem` + `createPointPool` + `createTaskBoard` | `integrationBuffs.spec.ts`(到期边界与剪枝顺序无关、加点不回溯、进度不回退、叠加是相乘) |
| 跨模块自洽(战斗 → 掉落 → 入库 → 装配 → 面板) | 战斗 + 掉落 + 入库 + 装备 + 属性 | `integrationLoot.spec.ts`(件数守恒、折算同源、见证不漏、容量不越界、面板单调、同种子可复现) |
| 跨模块自洽(周期 × 内容池 × 抉择) | `createCycleSystem` + `drawFrom` + `createChoiceSystem` | `integrationWorld.spec.ts`(问行情不掷骰、抽到的事必须切题、一次性牌只碰一次、账目守恒) |
| 跨模块自洽(技艺 → 采料 → 开炉 → 入库 → 体检) | `createSkillSystem` + `createCompanionSystem` + `createDropTable` + `createRecipeRunner` + `createEconomyReadings` | `integrationCraft.spec.ts`(没开炉不扣料也不掷骰、回执与公式同源、失败逐条保料、产出 = 成功 + 双成、体检与账本同源、同种子可复现) |
| 跨模块自洽(境界 × 副本 × 世界记忆) | `createRealmSystem` + `createDungeonSystem` + `createStageMemory` | `integrationDungeons.spec.ts`(开图要等级与前置同时满足、`winsUntilBoss` 与实跑的第几场见首领一致、`cycle`/`once` 两种节奏、记忆回落不清进度、奖励逐场入账、同种子可复现) |
| **同一段代码跑四份内容包**(三次换展示名、一次连键名一起换) | `defineGame` 门面 + `combat.keys` 映射 | `integrationGenres.spec.ts`(装配 → 进阶 → 掉装 → 装配 → 打一场 → 通关奖励 → 入账 → 存档往返;断言面板单调、账目守恒、存档不挑题材、同种子可复现) |

## 3 · 三条纪律

1. **默认不变**:不显式配置任何东西时,行为与旧实现逐位一致。库的每一层都带一份"冻结旧实现
   做对账"的判据(见 [parity.md](./parity.md),宿主侧另有 20 多份 `engine*Parity.spec`)。
2. **结构与内容分开**:键名、阈值、文案、曲线都是你的;库只给顺序与边界。看到 `blocked` / `reason`
   这类回调,那都是"由内容给一句人话"的位置。
3. **随机流是契约**:保底**改写结果而不跳过掷骰**;周期类的东西**不消耗全局随机流**。
   这两条都是为了"同一颗种子跑两遍,整条链一样"。

## 4 · 最容易踩的坑(都来自真实返工)

| 坑 | 正确做法 | 判据 |
| --- | --- | --- |
| `cap: 0` 当"无上限" | **不写 `cap` 才是无上限**;写 `0` 就是上限 0 | `integration.spec.ts` |
| 以为 `evictable` 是单件对单件 | 签名是 `evictable(items, incoming)` —— 拿到现有全部件再挑 | `intake.spec.ts` |
| 用"清零计数器"实现每日刷新 | 打**基准快照**(`rollover`),计数器留给生涯成就 | `tasks.spec.ts` |
| 把"清理规则的顺序"当风格问题 | 顺序即政策:重叠的规则换一下,同一批货会多留 7 件;改顺序要让玩家看得见 | `triage.sim.spec.ts` |
| 规则装了就当它在生效 | 数每条规则接走几件:0 次要么是被前一条全覆盖,要么是阈值超出内容值域 | `triage.sim.spec.ts` |
| 以为"权重低"等于"清空成本高" | 一次性池里抽到就排除,清空抽数**恒等于张数**;权重只排序 —— 限定预算时才体现为曝光差异 | `deck.sim.spec.ts` |
| 全是一次性牌却不留底牌 | 池子抽干后每抽都是 `null`(玩家:"什么都没发生")—— 常驻底牌或保底标签二选一 | `deck.sim.spec.ts` |
| 以为离线上限"按天累计" | 上限是**按每次结算**施加的:同样 8 小时,拆成 4+4 两次结算就多拿 2 步 —— 要真封顶,得自己维护"今天已经计入多少" | `idle.sim.spec.ts` |
| 换期不幂等 | 同期再调一次必须原样返回(心跳每次都会问) | `tasks.spec.ts` |
| 状态刷新吞掉剩余时长 | 叠时长:`max(旧到期, now) + 时长` | `buffs.spec.ts` |
| 以为"叠时长 / 刷新"只是口味问题 | 重叠时差得很远:同样 24 剂药,叠时长兑现 720 分钟、刷新只有 490 分钟(≈ 白吃 7.7 剂);不重叠时两者一样 | `buffs.sim.spec.ts` |
| 以为递减阶梯会一路衰减下去 | `[1, 0.75, 0.5, 0.25]` 只折前四条,第 5 条起恒定 25%;要真封顶得靠软阈值或 `max` | `attributes.sim.spec.ts` |
| 以为乘区全弱成功率就是 0 | 下限是刻意的:全弱 ≈ 2%(低到不该开炉,但"赌一把"这个选择还在) | `crafting.sim.spec.ts` |
| 以为熟练度有"练满" | 双曲饱和永远不到顶:9 × scale 才九成,99 分要 99 × scale —— 想要"练满"就在内容层按阈值判 | `crafting.sim.spec.ts` |
| 给一条稀有分支配了 5% 权重就以为"玩家总会撞到" | 抽 100 次一次不出的概率约 0.6% —— 稀有内容要么多给机会,要么配保底 | `choices.sim.spec.ts` |
| 以为"没选"就是取第一个选项 | 兜底是三级:标了默认且可选 → 第一条可选的 → 第一条;锁住的默认项不会被硬塞 | `choices.sim.spec.ts` |
| 以为 `bossProgress` 一样的两种节奏是一回事 | `cycle` 第 4 场见首领、`once` 第 5 场(差一场,玩家能感觉出来) | `dungeons.sim.spec.ts` |
| 以为见过首领之后次次见首领 | 首领倒下即**重新计数**;`once` 通关后更是再没有首领(刷本变纯刷素材) | `dungeons.sim.spec.ts` |
| 以为概率升档与累计阈值是两条差不多的路 | 差得多:每次 10%、照面 20 次,累计阈值必定到顶,概率路只有约三分之一到顶(每掷中一次只推一层) | `codex.sim.spec.ts` |
| 以为世界记忆会逐级回落 | 到点**直接回最低档**(系数 1.15 → 1.00);差一点只掉一档是升档时的分级取,回落没有过渡 | `memory.sim.spec.ts` |
| 以为折扣打在整本账上 | 只作用于可折项:声明三成折扣,整本只省 26.4%(不参与打折的那一项按原价收) | `skills.sim.spec.ts` |
| 玩家报"背包满了",先想到加容量 | 先看他是不是没把新装备穿上 —— **装配不占背包位**,容量 20 的包装上 6 件就能再收 6 件 | `holding.sim.spec.ts` |
| 产线"每秒结算一次"更精确 | 若每步向下取整,1.6 件/小时的产线按 10 分钟结算**一天一件都发不出**;正确做法是零头进累加器 | `facilities.sim.spec.ts` |
| 以为洗练"总会给点新的" | 池子被门槛(部位 / 品阶 / 层级)筛空时给不出新的,只保留锁住的 —— 要不要允许这种"洗了等于没洗"由内容决定 | `equipment.sim.spec.ts` |
| 以为"堆同名"最后自然没收益 | 六条同名 +10% 在 ranked 下是 30%、`max` 10%、`sum` 60% —— 三种是完全不同的内容政策 | `attributes.sim.spec.ts` |
| 状态读取问"列表里有没有" | 问"此刻还算不算数"(到期时刻 > 时钟) | `buffs.spec.ts` |
| 保底时跳过掷骰 | 照样掷,只改写结果 | `drops.spec.ts` / `pity.spec.ts` |
| 软保底不封顶 | 涨幅封顶(不封顶等于偷偷变成硬保底) | `pity.sim.spec.ts` |
| 以为"概率翻倍"就等于产出翻倍 | 撞上 1 或 `chanceCap` 之后倍率在那一条上失效(同一份内容 ×4 只拿到 2.45 倍产出) | `drops.sim.spec.ts` |
| 开了 `guarantee` 却没看出变化 | 保底只对挂了 `guaranteed: true` 的条目生效 —— 没挂的条目开不开都一样 | `drops.sim.spec.ts` |
| 想要产出翻倍,却用 `scalesWithAttempts` | 那是"多抽一次":期望一样,但**掷骰次数翻倍、后面的随机流全变**;不改随机流地翻倍用 `countMult` | `drops.sim.spec.ts` |
| "没开炉"与"开炉失败"混成一个 false | 分成 `fired` 与 `succeeded` 两档 | `recipes.spec.ts` |
| 以为"成功率"就等于"一炉的产量" | 期望产出 = 成功率 × (1 + 双成率);保料率决定失败是"慢"还是"亏" | `recipes.sim.spec.ts` |
| 小数产出按拍取整 | 零头留累加器,够了整数才发 | `facilities.spec.ts` |
| 接管战斗时只照抄公式、不照抄**掷骰序列** | 对方那边"掷了但没用上"的骰子(反击/追击/震慑,词条为 0 也照掷)必须照掷,否则后面全乱 | `combat.spec.ts`(三处主权)+ 你自己那份同种子对账 |
| 接管时把"某一部分"写重了(两边各加一次暴击基数) | 整段接管要连"这一部分是**谁**加的"一起搬 —— 库默认加的那一份,接管之后就别再加 | 同上(主权版样例就在宿主侧的消融用例里) |

## 5 · 验证你自己的装配

装完之后至少做两件事:

1. **跨模块不变量**:照 `integration.spec.ts` 的写法,把"产出 → 入账 → 计数 → 目标 → 再投资"
   串起来,断言守恒(产出 = 入账 + 截断)、同源(账本增量 = 回执)、幂等与单调。
2. **时间与随机也要一起验**:照 `integrationTime.spec.ts` 的写法,把"离线时长账 → 周期环境 →
   掉落/保底 → 入库 → 回执"串起来,断言同种子两遍一致、问周期不消耗随机、
   保底不改未触发之前的随机、分段走与一次算完一致。

如果这两条都能过,你的数值层基本不会出现"玩家看得见、你算不出"的账。
