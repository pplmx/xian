# 组装指南 —— 从零搭一套自己的数值系统

这份指南只回答一件事:**要做一个 X 类的游戏,按什么顺序接哪些模块。**
它不是 API 手册(那是 [README](../README.md)),也不是迁移记录(那是 [parity.md](./parity.md))。

每条结论后面都跟着**能跑的证据**:示例程序或库里的判据用例。指南里提到的每个 `create*`
与每个示例文件都会被自检核对(`scripts/verify-dist.mjs` 与 `scripts/engine-standalone.mjs`),
所以它不会烂在文档里 —— 拆了模块、改了名字,自检当场就红。

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
| 掉装 / 洗练 / 装配 | `createEquipmentSystem` | `examples/quickstart.ts` |
| 战斗骨架(护盾、反击、追击、技能标签) | `createCombatEngine` | `examples/combo-arts.ts` |
| **把你自己那套战斗整段接进来** | `BattleConfig` 的 `skillFn` / `strikeFn` / `actFn` | `examples/combat-takeover.ts`(老口径 × 接管版,同 200 颗种子逐场相同) |
| 掉落表(概率归一、保底、份数) | `createDropTable` | `drops.spec.ts` |
| 建造 / 每小时产出 | `createFacilitySystem` + `accrue` | `examples/daily-loop.ts` 的设施段 |
| 加点(天赋 / 灵脉) | `createPointPool` | `points.spec.ts` |
| 离线上限与步数 | `planIdle` / `runIdle` | `examples/daily-loop.ts` 的离线段 |
| 限时增益 | `createBuffSystem` | `examples/daily-loop.ts` 的状态段 |

### 配方 B · 学习打卡 / 日常(无战斗)

```
计数器 → 今日任务板 → 主线链 → 一次性成就 → 资源账本(奖励)+ 状态(专注)
```

| 你要的东西 | 接哪个 | 可跑的证据 |
| --- | --- | --- |
| 今日三件(按增量结算、换期幂等) | `createTaskBoard` | `examples/quest-loop.ts` |
| 主线三节(一次结算连推多节) | `createChain` | `examples/quest-loop.ts` |
| 成就 / 里程碑(只记一次) | `createUnlockRegistry` | `examples/quest-loop.ts` |
| "本季多少" | `snapshotOf` / `deltaSince` | `examples/quest-loop.ts` 的本季段 |

### 配方 C · 抽卡收集

```
随机源 → 内容池(权重/一次性)→ 单次概率 → 跨次保底 → 图鉴收录 → 入库漏斗(满了怎么办)
```

| 你要的东西 | 接哪个 | 可跑的证据 |
| --- | --- | --- |
| 抽到不重复、按标签切题 | `drawFrom` / `drawMany` | `deck.spec.ts` |
| 单次概率(归一 + 上限)、保底、份数 | `createDropTable` | `drops.spec.ts` + `drops.sim.spec.ts`(实测数字) |
| 软保底(越抽越容易)与第 N 次必出 | `createPityCounter` / `softChance` | `pity.spec.ts` + `pity.sim.spec.ts`(实测数字) |
| 收集进度(照面 / 懂几成) | `createCodex` | `codex.spec.ts` |
| 重复的怎么处理 | `createIntake` | `intake.spec.ts` |
| 整套抽卡 + 图鉴 + 日常的闭环 | —— | `examples/collect-loop.ts`(内容池 / 保底 / 集册 / 折算 / 今日三件 / 成就 / 经济体检在一份 200 行的小程序里) |

### 配方 D · 经营模拟

```
资源账本 → 产线(每小时产出与零头)→ 上限与截断 → 结算回执 → 经济读数 → 入库与分流裁决
```

| 你要的东西 | 接哪个 | 可跑的证据 |
| --- | --- | --- |
| 收支带来源、上限、取整 | `createResourceSystem` | `resources.spec.ts` |
| 每小时产出(零头不丢) | `accrue` | `facilities.spec.ts` |
| "本次所得"与账本对得上 | `createSettlement` | `settlement.spec.ts` |
| 哪个资源是瓶颈 / 烂在手里 | `createEconomyReadings` | `economy.spec.ts` + `economy.sim.spec.ts`(默认阈值翻译成"支出/收入"区间,以及 ±10% 的敏感区有多宽) |
| 自动清理规则链 | `createTriage` | `examples/daily-loop.ts` 的清理段 |
| 清理规则"顺序换了会多扔几件" | 顺序即政策:重叠的规则谁在前谁定生死(同一批货留 6 件到留 13 件都有);"某条一次都没出手"要数每条规则接走几件才看得出来(被全覆盖 / 阈值超出内容值域) | `triage.sim.spec.ts` |
| 整套经营闭环(产线 → 上限 → 卖出 → 体检 → 升级 → 清理 → 日常) | —— | `examples/shop-loop.ts`(一产一销的一间铺子:零头不丢、上限截断、离线时长账、两种升级选择各算一遍、清仓规则链,全在一份 200 行的小程序里) |
| 跨模块自洽(账目) | —— | `integration.spec.ts`(守恒 / 同源 / 单调幂等 / 可复现) |
| 跨模块自洽(时间 × 随机) | `planIdle` + `createCycleSystem` + `createPityCounter` | `integrationTime.spec.ts`(同种子同结果、问周期不消耗随机、保底不改未触发前的随机、分段与逐步一致) |
| 跨模块自洽(状态 × 投资点 × 任务) | `createBuffSystem` + `createPointPool` + `createTaskBoard` | `integrationBuffs.spec.ts`(到期边界与剪枝顺序无关、加点不回溯、进度不回退、叠加是相乘) |

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
| 换期不幂等 | 同期再调一次必须原样返回(心跳每次都会问) | `tasks.spec.ts` |
| 状态刷新吞掉剩余时长 | 叠时长:`max(旧到期, now) + 时长` | `buffs.spec.ts` |
| 状态读取问"列表里有没有" | 问"此刻还算不算数"(到期时刻 > 时钟) | `buffs.spec.ts` |
| 保底时跳过掷骰 | 照样掷,只改写结果 | `drops.spec.ts` / `pity.spec.ts` |
| 软保底不封顶 | 涨幅封顶(不封顶等于偷偷变成硬保底) | `pity.sim.spec.ts` |
| 以为"概率翻倍"就等于产出翻倍 | 撞上 1 或 `chanceCap` 之后倍率在那一条上失效(同一份内容 ×4 只拿到 2.45 倍产出) | `drops.sim.spec.ts` |
| 开了 `guarantee` 却没看出变化 | 保底只对挂了 `guaranteed: true` 的条目生效 —— 没挂的条目开不开都一样 | `drops.sim.spec.ts` |
| 想要产出翻倍,却用 `scalesWithAttempts` | 那是"多抽一次":期望一样,但**掷骰次数翻倍、后面的随机流全变**;不改随机流地翻倍用 `countMult` | `drops.sim.spec.ts` |
| "没开炉"与"开炉失败"混成一个 false | 分成 `fired` 与 `succeeded` 两档 | `recipes.spec.ts` |
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
