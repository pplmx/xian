# 用哪一层:模块速查与定制点

这份文档回答两个问题:**要做的这件事该接哪个模块**,以及**想改的东西该改哪里**。

- 想先跑起来:看 [README 的快速开始](../README.md#快速开始);
- 想装配一整套玩法(抽卡 / 经营 / 战斗接管……):看 [组装指南](./assembly.md) 的四条配方;
- 想调数值之前先有个刻度(离线上限 / 保底 / 权重 / 状态叠加……):看 [调参实测参考](./tuning.md);
- 想知道自己写的东西有没有跑歪:看 [判据](./parity.md);
- 想看真的能跑的程序:`examples/` 下有十几份,每一份都是能跑的程序,`bun run examples` 一次跑完。

## 模块一览

| 模块 | 入口 | 回答的问题 |
| --- | --- | --- |
| 等级 | `game.realms` | 有哪些境界/层?升一层要多少修为?进阶成功率多少、寿元多少、基础属性多高? |
| 属性 | `game.attributes` | 词条怎么合并(递减、软阈值)?本值 × 平铺 × 百分比 × 另乘 之后是多少? |
| 随机源 | `createRng` / `mulberry32` / `seedFromString` / `randomRng` | 同一颗种子跑两遍一样吗?要"不可复现"的那一个时用哪个?字符串种子怎么变成数? |
| 装备 | `game.equipment` | 这一层这一部位掉什么?这一件是什么品质、哪几条词条?装配后汇总多少? |
| 背包 / 持有 | `createHoldingSystem` | 收得下吗?满了之后怎么办?装上去还占背包吗?同一件被挂在两个槽上怎么办? |
| 副本 | `game.dungeons` | 哪些图开着?这次遇到谁?打几次出首领?通关给什么? |
| 战斗 | `game.combat` | 这场遭遇谁赢?回合日志长什么样? |
| 技能 | `createSkillSystem` | 练到第几级加多少?要花什么?满级选哪条路? |
| 炼制 | `composeCraftRate` 等 | 这次能不能成?四个乘区各贡献多少? |
| 配方执行 | `createRecipeRunner` | 开炉之后实际发生什么:没开炉与开炉失败、失败保料、成功后再掷双成 |
| 目标 | `evalGoal` / `goalProgress` | 这条任务达成了吗?进度怎么显示? |
| 随机内容池 | `drawFrom` / `drawMany` | 该从池子里抽什么?怎么保证切题? |
| 伙伴 | `createCompanionSystem` | 带这只伙伴的系数是多少?带多只怎么合? |
| 离线账 | `planIdle` / `runIdle` | 过去多久?多少计入上限?拆成多少步? |
| 存档 | `defineSaveFormat` 等 | 老档怎么升到新版本?形状坏了怎么补? |
| 数值层 | `Numeric<T>` | 数值超过 double 怎么办? |
| 存档形状修复 | `saveShape` 那一组(`asRecord` / `asStringArray` / `asFiniteNumber` …) | 存档里那一格是字符串 / null / 负数 / 超上限时,怎么兜回来?深结构里混了垃圾元素怎么办? |
| 装配 | `defineGame` | 内容之间的引用是否自洽? |
| 内容包 | `presets/*`(仙侠 / 星港 / 日常学习) | 想看"同一套内核换三套名字"长什么样?想抄一份现成内容? |
| 资源账本 | `createResourceSystem` | 灵石 / 信用点 / 零花钱:收多少、付得起吗、上限多少、这批是哪来的? |
| 分流裁决 | `createTriage` | 这一件留还是不留?自动回收 / 自动分解的规则顺序与读数 |
| 周期 | `createCycleSystem` | 每天 / 每赛季换一种环境:今天是什么、还有多久换、接下来几天分别是什么 |
| 抉择 | `createChoiceSystem` | 事件选项 / 任务分支:能不能选、按权重掷哪种后果、效果由谁解释、没选时用哪条 |
| 图鉴 | `createCodex` | 见过什么、懂到什么程度:照面累计升档、概率升档、用过才算真懂、只记见过的最好一件 |
| 世界记忆 | `createStageMemory` | 区域繁荣 / 阵营好感:多路门槛取先到、有资格才升档、不打交道会回落 |
| 经济读数 | `createEconomyReadings` | 哪一样不对劲:进/出比值的判词(瓶颈·健康·过剩·闲置)、分期读、带"没把握"标记 |
| 入库漏斗 | `createIntake` | 收不下怎么办:先见证、按规则拒收、满了腾位、折算成别的东西 |
| 结算回执 | `createSettlement` | 这一笔到底给了多少:合计取自账本实际入账,被截掉的部分另给一栏 |
| 掉落表 | `createDropTable` | 这一场给不给、给几份:概率先归一(可另设上限)、保底不改随机流、翻倍翻的是份数、命中当场处理 |
| 状态 / 时效增益 | `createBuffSystem` | 这一条还在不在、还剩多久、再叠一次怎样:叠时长而非刷新、过期不叠负剩余、生效与清理同一判据、按分类清除 |
| 设施 | `createFacilitySystem` / `accrue` | 这一座几级、还能不能再升、升了每小时多出什么:门槛顺序即说法、上限取小且只封升级、零头留在累加器里 |
| 投资点 | `createPointPool` | 天赋 / 科技 / 属性点往哪儿投:总容量与主副两档上限、换位不作废已投、投不成什么都不改 |
| 周期任务板 | `createTaskBoard` | 每日 / 每周 / 打卡:进度靠"当前 − 期初基准"(不清零计数器)、换期幂等、增量不出现负数、一期只结算一次 |
| 计数器基准快照 | `snapshotOf` / `deltaOf` / `deltaSince` | "从哪一刻算起":同一份只增不减的计数器同时回答"生涯多少"与"这一段多少",不用清零 |
| 顺序任务链 | `createChain` | 主线 / 章节 / 教程:一次结算连推多节、有守卫且撞上要能说出来、不可逆、到链尾就停 |
| 抽取保底 | `softChance` / `createPityCounter` | 抽得越多越容易出(涨幅封顶、概率有上下限)、第 N 次必出(保底照样掷骰)、出货清不清账你定 |
| 一次性解锁 | `createUnlockRegistry` | 成就 / 里程碑 / 勋章:只记一次、一次可解多条且顺序稳定、显式解锁也去重 |

### 战斗:副本的下半场

战斗只吃属性系统的输出。读哪几个键由你指定 —— 本值叫"火力/装甲/结构值"或"专注力/耐心/精力"都能直接指过去:

<!-- compile-check -->
```ts
import { createCombatEngine } from 'wanxiang-engine'

const combat = createCombatEngine({
  keys: { attack: 'power', defense: 'armor', hp: 'hull', maxHp: 'hullMax', speed: 'thrust' },
  damageFn: ctx => Math.max(1, ctx.attack * ctx.mult - ctx.defense)   // 减法型?整条公式归你
})
```

技能上的效果标记(`stun` / `drain` / `pierce` / `multi`…)库里**不认识**,只原样交给你解释:

<!-- compile-check -->
```ts
import { createCombatEngine } from 'wanxiang-engine'

createCombatEngine({
  skillEffectFn: ctx => {
    if (ctx.skill.effect !== 'stun') return        // 返回空 = 交回默认出手
    ctx.skipNextTurn(ctx.defender)                 // 让对手的下一次出手跳过
    ctx.log('skill', `${ctx.attacker.name} 定住了 ${ctx.defender.name}`)
    return true                                    // 这次出手由我处理完
  }
})
```

`ctx` 给的是引擎自己那条路上的原语:默认那一击 `strike(mult?)`、只算不落账 `damage(mult?)`、
落账 `applyDamage(target, amount)`、`skipNextTurn`、日志 `log`,以及本场共用的小抽屉 `state`(跨回合记层数/冷却)。

**护盾、反击、追击、标签语义**也都有开关(默认全关,关着时与旧版逐位一致):

<!-- compile-check -->
```ts
import { createCombatEngine } from 'wanxiang-engine'

createCombatEngine({
  shield: { capRatio: 0.5 },        // 护盾先吃伤害、总量封顶;开局盾读 mods.shieldOnStart,溢疗成盾读 mods.overhealShield
  followups: {},                    // 反击与追击:读 counterRate/comboRate,打一记打折的,且不再链
  skillEffects: { multiHits: 2 },   // 给 multi/stun/drain/shield/bleed/pierce 一套通行语义;不配就一个都不解释
  tickFn: ctx => {                  // 每回合结束:流血 / 层数 / 冷却 / 首领阶段都落在这儿
    const stacks = (ctx.state.bleed as number) ?? 0
    ctx.state.bleed = stacks + 1
    ctx.applyDamage(ctx.enemy, 5 * stacks)
  },
  onEvent: (ctx, event) => {        // 内容驱动的反应:看到会心就追加一记(钩子自己引发的出手不会再触发它)
    if (event.kind === 'crit' && event.actor === ctx.player.name) {
      ctx.strike(ctx.player, ctx.enemy, { mult: 0.7, label: '剑势连绵' })
    }
  }
})
```

**什么留在作品那一侧**(库只给接口形状,不实现规则):**流派组合技**(用 `onEvent` 看会心 / 破盾等事件再追加一记)、
**法宝自动触发**(同样在 `onEvent`,或在 `tickFn` 里数冷却)、**首领阶段**(在 `tickFn` 里比对 `hp/maxHp` 的阈值,
越过就换技能表与词条)。这三样都绑内容 —— 塞进库里等于把某个游戏的设计当成通用规则。

### 离线推进

`planIdle` 只算时长账;每一步产出什么是你的事(`runIdle` 按步折叠):

<!-- compile-check -->
```ts
import { planIdle, runIdle } from 'wanxiang-engine'

const plan = planIdle(8 * 3600_000, { stepMs: 60_000, capMs: 6 * 3600_000, efficiency: 0.9 })
// cappedMs 6h · effectiveMs 5.4h · steps 324 · overflowMs 2h
const gained = runIdle(plan, 0, (total, i, stepMs) => total + stepMs)
```

### 存档:形状修复 + 版本迁移

两个模块,**都不碰存储介质**(localStorage / 文件 / 云 / 内存由你接 —— 于是浏览器、容器、服务端同一套):

<!-- compile-check -->
```ts
import { defineSaveFormat, encodeSave, decodeSave, asFiniteNumber, asStringArray } from 'wanxiang-engine'

type State = { gold: number; bag: string[] }
const state: State = { gold: 5, bag: [] }   // 例如从存档里读出来的那一份

const FORMAT = defineSaveFormat<State>({
  currentVersion: 3,
  migrations: {
    1: d => ({ ...(d as object), gold: Number((d as { gold?: unknown }).gold ?? 0) }), // v1 → v2
    2: d => ({ ...(d as object), bag: [] })                                            // v2 → v3
  },
  revive: d => ({
    gold: asFiniteNumber((d as { gold?: unknown }).gold, 0, 0),
    bag: asStringArray((d as { bag?: unknown }).bag)
  })
})

const text = encodeSave(state, FORMAT)          // { version, savedAt, data }
const result = decodeSave(text, FORMAT)
if (result.ok) console.log(result.state, result.fromVersion, result.migrated)
else console.log(result.reason)                 // 'parse' | 'future' | 'shape'
```

两条铁律,都是从"老玩家的档必须进得来"倒推的:

- **迁移是链,不是分支**:版本 1 的档一路走到当前版本,每一跳只做那一跳的事;缺的那一跳按"形状没变"处理。
  版本号缺失/损坏时按**最老**的一版补起。
- **未来的版本不许猜**:读到比当前更高的版本就拒绝并说明 —— 猜错的代价是把新档写坏。
  失败有三种名字(`parse` / `future` / `shape`),界面才说得清"是文件选错了、该升级了,还是真损坏"。

`revive` 里用的 `asArray` / `asRecord` / `asFiniteNumber` / `asNumberRecord` / `asStringArray`
是配套的**形状修复原语**:形状不对就用兜底值,而不是抛错。`asArray` 的自定义判据拿到的元素
保证不是 null/undefined —— 判据里那次"忘了写 `!!x &&`"正是白屏的常见起因。

### 技能 / 功法:等级曲线、消耗、满级分支

<!-- compile-check -->
```ts
import { createSkillSystem } from 'wanxiang-engine'

const skills = createSkillSystem({
  skills: [{
    id: 'sword',
    name: '青锋诀',
    kind: '主修',                                                  // 引擎只当标签,不当规则
    maxLevel: 9,
    baseMods: { attackPct: 0.05 },                                 // 入门就会的
    perLevelMods: { attackPct: 0.03 },                             // 练出来的
    costs: [
      { key: 'wudao', base: 10, growth: 1.5 },                     // 基数 × 倍率^等级
      { key: 'page', base: 0, levelStep: 2, discountable: false }  // 线性项,且不吃折扣
    ],
    branches: [{ id: 'fast', name: '疾锋', mods: { speed: 0.05 } }] // 满级再择一条路
  }]
})

skills.modsAt('sword', 3)                                           // 第 N 级 = 基础 + 每级 × (N-1)
skills.costAt('sword', 2, { discount: 0.2 })
skills.sourcesOf([{ skillId: 'sword', level: 9, branchId: 'fast' }]) // 每部功法一份来源
```

三处刻意的设计:

- **基础与每级分开写**:调平衡时才分得清"它本来就这么强"与"练满才有这么强";
- **折扣是按项选的**(`discountable`):一组消耗常常只有一部分打折。一刀切乘到所有项上,
  省几行配置、换一处静默漂移;
- **装配汇总返回一组来源,而不是一个加总**:作品侧通常还要过自己的合并规则(递减、软上限),
  加总就把那层信息丢了。

### 炼制:成功率是四个乘区相乘

<!-- compile-check -->
```ts
import { composeCraftRate, proficiencyFromExp, stageNameOf, type CraftFormula } from 'wanxiang-engine'

const FORMULA = {
  baseRate: 0.95,                        // 各项皆满、不越级时的上限 —— 剩下的留给天意
  levers: {                              // 乘区:几个、叫什么,全由作品定
    mastery: { floor: 0.22, span: 0.78 }, // 配方掌握度
    lore: { floor: 0.42, span: 0.58 },    // 材料认知度
    skill: { floor: 0.3, span: 0.7 }      // 技艺水平(调用方先归一到 0~1)
  },
  overReach: {                           // 越级:表内查表,表外指数衰减
    key: 'overReach',                    // 读输入里的哪一项当"越了几阶"
    spec: { table: [1, 0.6, 0.35, 0.18], decay: 0.45 }
  }
} satisfies CraftFormula

composeCraftRate({ mastery: 0.6, lore: 0.8, skill: 0.5, overReach: 1 }, FORMULA)
proficiencyFromExp(5400, 600)   // 90 —— 双曲饱和:逼近上限而不到顶
stageNameOf(92, [{ min: 85, name: '通玄' }, { min: 0, name: '生疏' }])
```

为什么不是"够级就成"的硬门槛:硬门槛把"我准备得怎么样"压成一个布尔值,于是知识、材料、技艺、越级
这四条本可各自权衡的线全被一条线吞掉。这里四区相乘、**各有下限** —— 任何一项弱都不会把成功率归零,
但四项全弱时自然低到不该开炉;"赌一把"于是始终是玩家的选择。

### 资源账本:钱、材料、点数

<!-- compile-check -->
```ts
import { createResourceSystem, planIdle } from 'wanxiang-engine'

const plan = planIdle(8 * 3600_000, { stepMs: 3600_000 })   // 与上面离线那一层对接

const res = createResourceSystem({
  resources: [
    { key: 'stone', name: '灵石' },
    { key: 'herb', name: '灵草', cap: 100 },
    { key: 'wudao', name: '悟道点', cap: 5000 }
  ]
})

let wallet = res.create({ stone: 30 })
const paid = res.pay(wallet, [{ key: 'stone', amount: 50, source: '炼丹' }])
paid.ok            // false —— 买不起就整笔不扣
paid.shortfall     // [{ key: 'stone', short: 20 }]

wallet = res.grant(wallet, [{ key: 'herb', amount: 150, source: '掉落' }]).ledger
res.of(wallet, 'herb')                       // 100 —— 落账时夹到上限,而不是事后修补

// 挂机产出与 idle 的步数账对接:逐步夹上限(一次乘完再加是算不出"中途到顶"的)
const mined = res.produce(wallet, plan.steps, [{ key: 'stone', amount: 5, source: '洞府' }])
res.audit(mined.entries).bySource            // 每个来源贡献了多少,一眼可查
```

键名、上限、名字、来源标签全归你 —— 库不认识"灵石"这两个字(与属性系统的约定一致)。
存档坏了那一格用 `res.normalize(存档里的那一坨)` 兜回来,而不是让整个档报废。

### 任务 / 成就:一条判据,两种用法

<!-- compile-check -->
```ts
import { evalGoal, goalProgress, type GoalEnv } from 'wanxiang-engine'

const counters: Record<string, number> = { kills: 3 }   // 你的计数器
const player = { major: 2, sub: 1 }                     // 你的境界状态
const flags: Record<string, boolean> = { met: true }    // 你的一次性标记

const cond = { type: 'counter', key: 'kills', value: 10 } as const
const env: GoalEnv = {
  counter: key => counters[key] ?? 0,      // 引擎不认识你的存档,只向环境提问
  level: () => player.major,
  subLevel: () => player.sub,
  custom: key => flags[key] === true
}

evalGoal(cond, env)        // 达成与否 —— 界面与发赏共用这一份
goalProgress(cond, env)    // { done, ratio, current, target }
```

条件有五种:`counter`(计数)、`level`(等级)、`position`(大阶 + 小阶)、`rank`(品阶)、`custom`(交给作品判),
也可以用 `{ type: 'all' | 'any', of: [...] }` 组合(可嵌套)。
**"达成与否"只有一处实现** —— 否则迟早出现"界面说成了、领赏时不算",而玩家只会当成吞奖励。
进度视图只对可量化的条件给比例;等级/位阶这类只有"到没到",`ratio` 为 null,界面就不画条。

### 伙伴 / 随从:数值之外还有"性格"

<!-- compile-check -->
```ts
import { createCompanionSystem } from 'wanxiang-engine'

const companions = createCompanionSystem({
  neutral: { exploreDurMult: 1, dangerMult: 1, dropLuck: 0, lossReduction: 0 }, // 键名与中性值由作品给
  traits: [
    { id: 'greedy', name: '贪宝', mods: { dangerMult: 1.05, dropLuck: 0.06 } },
    { id: 'steady', name: '慢稳', mods: { exploreDurMult: 1.1, lossReduction: 0.02 } }
  ],
  companions: [{ id: 'fox', name: '青羽灵狐', traitId: 'greedy', mods: { luck: 0.05 } }]
})

companions.effectsOf('fox')               // 性格系数(与中性基线合并后的完整一组)
companions.modsOf('fox')                  // 伙伴自身词条(与装备同一种表达)
companions.activeMods(['fox', 'turtle'])  // 带多只时的合并
```

- **中性值必须由作品给**:倍率的中性是 1、加法的中性是 0,引擎猜不出来 —— 猜错就会出现
  "没带伙伴反而更快/更穷"这种没人能一眼看出的偏差。故配置里少一个键就直接报错;
- **性格系数是绝对取值**(写 1.05,不写 "+5%"):读的时候不必反推基线;
- **性格键名由作品定**:引擎只当它是"一组有中性值的系数" —— 换个题材完全可以换成"曝光率/噪音/耗油"。

## 定制:想改什么,改哪里

库里"写死的"只有**结构**(有序的名字串、曲线的形状、区间与权重),
凡是"具体长什么样"的地方,都留了配置字段或钩子:

| 你想改的东西 | 怎么改 |
| --- | --- |
| 名字(境界 / 装备 / 属性 / 副本 / 技能 / 性格……) | 各处定义的 `name`;属性可用 `attributeDefs({ rename })`;**境界标签的拼法**用 `realms.labelFormat`(占位符 `{world}` 界域 / `{realm}` 境界 / `{layer}` 小层,不认识的占位符原样保留) |
| 属性维度(几个、叫什么) | `attributes.defs` + `core`;本值想有几个就几个 |
| **每级需求完全自己定**(手调表、非指数公式) | `realms.exp.costFn(major, layer)` |
| **基础属性完全自己定** | `realms.combat.statsFn(major, layer)` |
| **进阶成功率完全自己定** | `realms.breakthrough.rateFn(major, layer)`(仍受 `min/max` 夹取) |
| 不要"寿元"这回事 | 省略 `lifespan`(`lifespanOf` 返回 Infinity) |
| 品质档数 / 槽位数量 / 每档词条条数 | `qualities[]` / `slots[]` / `QualityDef.affixes` |
| **逐境层数不同**(前几境九层、后几境三层) | `realms.worlds[].realms[]` 里给某一境写 `layers`(其余仍用全局 `layerNames`) |
| 层级系数是张表而不是指数 | `equipment.power.tierFactors` |
| 词条数值单位(百分点 / 分数) | `equipment.affixValueScale` 或单个词条的 `scale` |
| 词条数值的取值曲线 | `AffixDef.valueCurve(roll)`(默认线性;凸/凹曲线可表达「掷得满更值钱」) |
| **词条合并的算法本身** | `attributes.diminish`:默认按贡献降序打折,也可 `'max'`(只取最强)/ `'sum'`(直接相加)/ 自定义 `fold(values)` |
| **强化加成曲线** | `equipment.power.levelBonusFn(level)`(默认每级 × `levelBonus`) |
| **一件装备几条词条 / 每条词多重** | `equipment.affixCountFn(quality, tier, rng)`、`equipment.affixWeightFn(affix, quality, tier)` |
| **洗练 / 重铸词条**(保留几条、其余推倒重来) | `equipment.rerollAffixes(affixes, { rng, quality, tier, slot, keep })` —— 与生成共用同一处掷词条实现;`keep` 就是"封存"的那几条,成本与次数上限归你 |
| **自动去留的规则顺序**(自动回收 / 自动分解 / 自动出售) | `createTriage({ rules, skip?, fallback? })`:第一条表态的说了算,谁都没表态才用兜底;`impact()` 给"每条规则各判掉多少"的读数,与裁决共用同一条链 |
| **行囊满了先挤掉谁** | `compareBy(比较器…)`:一串比较器依次比,前一层分出胜负就不再往下 |
| **每日 / 每赛季的环境轮换**(天时、运势、节气、赛季规则) | `createCycleSystem({ periodSec, pools, pick?, seedOf? })` —— 由周期序号派生独立随机源(不碰全局随机流、不依赖现实时间),换池与预告都有;抽取规则与种子公式可接管 |
| **事件的选项与后果**(加权结果、代价与收益、超时兜底) | `createChoiceSystem({ interpret })` —— 选项能不能选、后果按权重掷、效果逐条由你解释并收成回执、没选时的三级兜底;效果标签库一律不认 |
| **图鉴 / 收集深度**(见过 → 眼熟 → 洞悉 / 用过才算真懂) | `createCodex({ stages, stagesOf? })` —— 累计照面升档(一次只进一层、可分组换门槛表)/ 概率升档 / 直接推到某档;`rememberBest` 只记见过的最好一件(各维度取高);`view` / `stats` 给"还差多少""已知几条" |
| **世界对该对象的记忆**(区域繁荣、阵营好感、门派声望) | `createStageMemory({ stages, decayAfterHours? })` —— 门槛可多路取先到(计数 / 时长)、没资格停在最低档、不打交道就回落;`touchedAt` / `hoursUntil` / `idleBeyond` 管"最后一次打交道"与倒计时 |
| **经济体检**(哪个资源是瓶颈 / 烂在手里) | `createEconomyReadings({ bands?, labels? })` —— 进/出比值的判词(默认阈值 0.7 / 3 / 10,换算成"支出/收入":`< 1.43` 健康、`< 0.34` 过剩、`< 0.10` 只进不出)、分期读、带 `note` 的"没把握"标记;出为 0 时比值是无穷而不是 1 |
| **曲线体检**(哪一格跳得最狠 / 哪一段整体最陡 / 玩家什么时候开始碾压内容 / **改一个数之后变的是哪一段**) | `createProgressionAudit({ game })` 或 `({ realms, power, contentPower, crushRatio })` —— 沿等级阶梯逐格量:需求与面板的**相邻格倍数**、**换界那几格**单列(跳变记在落点上)、玩家 ÷ 内容 ≥ `crushRatio`(默认 3)算"碾压"。强度三档来源:**给了 `game` 就用属性系统的战力评分**(标准答案,权重取自 `powerWeights`)/ 自己给 `power` / 都不给则用"面板之和"兜底。四种读法:`lines()` 一行一格、`segments()` **按段聚合**(默认按大境界,也能按界域 —— 段跨度 = 段末 ÷ 段首,"进门那一步"单独给,排期看的是这个)、`summary()` 给最狠的两处跳变与第一次碾压、`compareProgression(改前, 改后)` **两份配置并排比**(逐段跨度变化倍数 + 全程跨度;段数不同时它会明说 `mismatched`) |
| **掉落/奖励收不下怎么办** | `createIntake({ holding, accept?(item, holding), evictable?(items, incoming) → 被挤掉那件, fallback, witness? })` —— 先见证再裁决、满了腾位(腾位失败不追回)、各条去路共用一条折算账、回执带人话与原因;`evictable` 拿到的是**现有全部件 + 新来的那件**(挑谁走由你比) |
| **"本次所得"与账本对不上** | `createSettlement({ resources }, numeric?)` —— 回执里的每个数字都取自落账时的**实际发生额**,`clipped` 单独说明被上限截掉多少;想显示别的数就得绕过回执,那是显式越界 |
| **掉率与保底的口径**(叠过 1 算必中 / 再高也不超过 90% / 首领第一抽必出) | `createDropTable(entries)`:`chanceCap` 另设上限、`guaranteed` 配 `guarantee` 开保底(开不开都不改随机流)、`scalesWithChance` / `scalesWithAttempts` / `scalesWithCount` 各自决定吃不吃倍率;`rollOne` 逐条掷、`roll` 整表掷,**顺序即声明顺序** |
| **增益 / 减益的时长口径**(同一条再吃一次药:叠时长 / 取较长者 / 重新起算) | `createBuffSystem({ defs, stacking })` —— 默认 `'extend'`(剩余 + 新时长),`'longest'` 是取较长者(刷新,剩余被吞),`'reset'` 一律从现在起算;`maxDurationSec` 可给叠加上限 |
| **"清除负面"清哪些** | `clear(list, kind)` —— 分类由内容给(库不认识什么是负面),只剪该分类并回报剪掉几条;中性、无分类的残留不动 |
| **时间单位与时钟** | `clock: 'sec' \| 'ms'` —— 内容表里的 `durationSec` 永远是秒,`now` / `endsAt` 用哪个单位由这一处声明(毫秒对应 `Date.now()`);`remainingSec` 报给界面的永远是秒 |
| **状态效果的合并** | `mods` 库不解释,`active(list, now)` 原样带出 —— 拿去喂你自己的属性汇总(本作是 `mergeMods`,递减口径仍在本作) |
| **"下一次状态变化在什么时候"**(面板重算与倒计时) | `nextExpiry(list, now)` 给出最近到期的那一条(标识 + 到期时刻 + 还有多久);全空或全过期即 `null` |
| **升级门槛与"为什么不能升"**(境界 / 声望 / 前置建筑) | `createFacilitySystem({ facilities })` 里每条给 `blocked(levels, level, ctx)` —— 返回一句人话或 `undefined`,**顺序即界面的说法**;库只保证"能升"与"要花什么"出自同一次判定 |
| **等级上限由别的东西决定**(洞府决定其余建筑上限 / 科技等级决定产线上限) | `cap(levels, ctx)` + `capReason`:与自身上限 `maxLevel` **取小**,只封升级、不改已有等级(本作:(洞府等级 + 1) × 5) |
| **升级要花什么** | `costs(level, ctx)` 返回 `{ key, amount }[]` —— 键名与数额都归你(数额是泛型:本作的灵石是大数),付钱由调用方做(配 `createResourceSystem` 的 `pay`) |
| **每小时产出与零头**(1.5 点/小时、2.4 块/小时) | `perHour(level)` 给速率、`accrue(frac, rates, sec)` 按秒推进:零头留在累加器里,够了整数才发,连"设施拆了"攒下的零头也会发出去 |
| **加点 / 天赋树 / 科技点**(往哪儿投、能不能回头) | `createPointPool({ branches, total, mainCap, sideCap })` —— 总容量与主副两档上限取小,三句说法由内容给;`switchMain` 换主位**只换方向、不作废已投点数**;投不成状态原样返回(含"首投自动认主"只在成功那次生效) |
| **加点的效果与费用** | `branch.effect(points)` 与 `costs(state, id, ctx)` / `switchCosts(...)` —— 效果库不解释(本作是每点 × 点数相加);费用数额是泛型(本作灵石是大数);`blocked` 返回 `''` 表示"不说理由" |
| **炼制 / 合成的执行**(材料够不够、失败赔多少、双成) | `createRecipeRunner({ costs, rate, spentOnFail?, bonus?, bonusCap?, blocked?, affordable? })` —— **"没开炉"与"开炉失败"分开**(前者不扣料、不掷骰、不计失败);失败按**逐条花费**折减(门槛费通常不退);双成在成功后再掷一次并夹上限;回报带 `spent` / `produced` 供你记账 |
| **每日 / 每周任务怎么算进度** | `createTaskBoard({ tasks })` —— 任务只声明"看哪个计数器、干到多少";`rollover(state, counters, period)` 换期时给计数器**打基准快照**(而不是清零,生涯成就还要用它),同期再调**幂等** |
| **自动发放还是玩家手动领** | `settle(state, counters)` 一次挑出"达成且没领过"的(自动发放,顺序即声明顺序);`claim(state, counters, id)` 是手动领取 —— 两条路共用同一份 `claimed`,不会重复给 |
| **进度条读什么** | `board(state, counters)` 一行一条:`delta`(本期增量,已夹到 ≥ 0)/ `progress`(封在目标值)/ `done` / `claimed`,界面直接用 |
| **"本世 / 本赛季 / 本次活动"从哪算起** | `snapshotOf(counters)` 打基准、`deltaSince(base, counters, key)` 算这一段 —— 与周期任务板同一份原语;增量一律夹到 ≥ 0,缺基准按 0 起算(回档那天不出现负进度) |
| **非计数器的"这一段"**(择定了几条路 / 雪耻几个宿敌) | `deltaOf(base, now)` —— 同一个夹取规则,不为整数单写一遍 |
| **主线 / 章节 / 教程怎么推进** | `createChain({ nodes, done, maxSteps? })` —— `done(node, ctx)` 由内容给(库不认识境界 / 计数);一次能推多远推多远(默认最多 5 节,撞上守卫回报 `capped`),到链尾即停,推进不可逆 |
| **"还剩几节 / 现在在哪一节"** | `current(state)` / `remaining(state)` / `indexOf(id)` / `nodeAt(index)` —— 界面读数与推进共用同一份;坏下标自动夹回合法范围 |
| **"看/抽了多少次之后概率变高"**(软保底) | `softChance(base, tries, { step, cap, from?, floor?, ceil? })` —— 涨多少、从第几次开始涨、涨到哪儿封顶、概率夹在哪区间,一次说清(本作的照面次数保底:每多看一次 +3%、最多 +35%、夹在 4%~90%;抽卡常见的"第 75 抽起每抽 +6%"写 `from: 75`) |
| **"第 N 次必出"**(硬保底与计数) | `createPityCounter({ hardAt, resetOn })` —— `roll(state, pool, rng, base, soft?)` 掷一次并回报 `hit / pity / chance`;**保底照样掷骰**(随机流与开不开保底无关);`resetOn: 'hit' \| 'pity'` 决定什么时候清零,池子各记各的 |
| **成就 / 里程碑 / 勋章**(达成过一次就永远算数) | `createUnlockRegistry({ entries })` —— `scan(state, ok)` 一次挑出"达成了且还没解开"的(顺序即声明顺序);`unlock(state, id)` 给"没有可判定的条件、只能由当时动作声明"的成就(同样去重,反复触发也只发一次);`list` 保留解锁顺序,成就墙按它排 |
| 首领节奏(循环刷 / 一次通关) | `dungeons.bossRhythm: 'cycle' \| 'once'` |
| **敌人数值曲线完全自己定** | `dungeons.enemyPower.scaleFn(tier)`(或给整表 `tierFactors`) |
| **遭遇调度完全自己定** | `dungeons.encounterFn(ctx, rng)`(给出 region/progress/bossDue/pool;返回 `null` 即交回默认逻辑) |
| **奖励数额完全自己定** | `dungeons.victoryRewards[].amount(tier)`(概率仍生效) |
| **整场奖励完全自己接管** | `dungeons.rewardFn(ctx, rng)`(默认奖励已算好放在 `ctx.defaultRewards` 里,可以先看再决定;`null` 即交回默认) |
| **区域多条前置**("两条线都通才开"/"任一即可") | `requireCleared: string \| string[]` + `requireMode: 'all' \| 'any'` |
| **战斗读哪几个键** | `BattleConfig.keys: { attack, defense, hp, maxHp, speed }` —— 本值叫火力/装甲/结构值也能直接指过去 |
| **战斗伤害公式完全自己定** | `BattleConfig.damageFn(ctx, rng)`(减法型/除算型/查表型都行;给了它,地板与修正都归你) |
| **技能的效果标记怎么解释** | `BattleConfig.skillEffectFn(ctx, rng)` —— 库不认识 `stun/drain/pierce/multi`,只把标签交过来;返回 `true` 即"这次出手归我" |
| **这一回合出哪一招** | `BattleConfig.skillFn(ctx, rng)` —— 返回技能 = 用它 / 返回 `null` = 这一回合不出技能 / 不返回 = 交回默认(每个技能各掷一颗再抽一个);"按序掷、第一个命中即用"这类规则就在这里接管(随机流从此与本作对齐) |
| **整次出手怎么打**(先掷浮动还是先判暴击、吸血何时结算) | `BattleConfig.strikeFn(ctx, rng)` —— 返回 `true` 即整次归你:自己掷、自己用 `ctx.applyDamage` 落账(它返回的量就是这次出手的伤害);`ctx.damage(mult)` 可拿默认公式的结果"基于默认改一点" |
| **整回合的节奏**(回合开头回血 / 法宝的节拍 / 震慑何时清) | `BattleConfig.actFn(ctx, rng)` —— 返回 `true` 即这一回合归你(引擎不回血、不选技能、不出手);要哪几样自己用 `ctx.strike` / `ctx.heal` / `ctx.gainShield` 拼;引擎保留的只有回合调度与生命周期 |
| **"把整段战斗接过来"到底要接哪几处** | `skillFn` + `strikeFn` + `actFn` 三处;实测两格(纯公式 / 带技能护盾反击,各 200 种子)接上之后**胜负与回合数 100% 与本作相同**(默认配置 75% / 58%)。两条经验:①本作每次出手后还会掷三颗骰子(反击/追击/震慑),**词条为 0 也照掷**;②整段接管要连"这一部分是谁加的"一起搬(别让两边各加一次暴击基数) |
| **技能标签的通行解释**(多段 / 震慑 / 吸取 / 加盾 / 放血 / 穿甲) | `BattleConfig.skillEffects`(段数、概率、比例都可配;不配则一个标签都不解释,继续交给 `skillEffectFn`) |
| **要按回合推进的东西**(流血 / 中毒 / 增益层数 / 冷却 / 首领阶段) | `BattleConfig.tickFn(ctx, rng)` —— 每回合结束叫一次,`ctx` 给同一套原语与一个本场抽屉 `state` |
| **内容驱动的反应**(流派组合技 / 法宝触发) | `BattleConfig.onEvent(ctx, event, rng)` —— 每记完一条事件交给你看一眼(如"看到会心就追加一记");钩子自己引发的出手不会再触发它(防递归) |
| **护盾池**(先吃盾再掉血 / 上限封顶 / 溢疗成盾) | `BattleConfig.shield`:上限 `capRatio`(默认 50%)、开局盾 `mods.shieldOnStart`、溢疗成盾 `mods.overhealShield`;不配就没有护盾这回事 |
| **反击与追击** | `BattleConfig.followups`:各读一对词条(默认 `counterRate/counterDamage`、`comboRate/comboDamage`),概率触发一记打折出手,且这一记不再引发反击/追击 |
| **技能消耗完全自己定** | `skills.costs[].amount(level)`(折扣与下限仍生效) |
| **技能词条曲线完全自己定** | `SkillDef.modsFn(level)`(给了它,`baseMods`/`perLevelMods` 忽略) |
| **炼制乘区几个、叫什么、什么形状** | `crafting.levers`(任意键)+ 每区 `LeverSpec.curve`(自定义曲线)+ 可选 `overReach` |
| **随机内容池的标签体系与区间** | `deck` 的 `tags` / `min` / `max` / `weight` / `once`,`weightMultiplier`(倾向而非门槛) |
| 牌堆标签怎么算切题 | `DeckContext.match: 'any' \| 'all'`(相交 / 牌要求全中)、`excludeTags`(命中即排除) |
| **抽 N 张的保底** | `drawMany(..., { guarantee: { tag, min } })`(至少 min 张带该标签;池里不够则补多少算多少) |
| 目标/成就条件 | `goals` 的 `counter \| level \| position \| rank \| custom`,自定义键用 `GoalEnv.custom` |
| **目标条件的组合** | `{ type: 'all', of: [...] }` / `{ type: 'any', of: [...] }`(可嵌套;空 `all` 成立、空 `any` 不成立) |
| 多只伙伴的性格怎么合 | `companions.stack: 'override'`(默认,覆盖)/ `'add-relative'`(各自相对中性那一份相加) |
| 伙伴性格的键名与中性值 | `companions.traits[].mods` + `companions.neutral`(缺中性值直接报错) |
| **大数实现**(数值超过 double) | `Numeric<T>` 适配器 —— 公式一行不用改;**该换的时机与边界**见[调参实测参考](./tuning.md)的「数字什么时候不够用」那一节(2^53 起 +1 会被吞;每层 ×1.5 打到第 80 层越界) |
| **资源有哪些 / 叫什么 / 上限多少**(货币、材料、点数) | `createResourceSystem({ resources })`:键名与展示名分开,`cap` / `floor` 写在**每条资源**上(**不写 `cap` 才是无上限**,写 `0` 就是上限 0);要"上限随别的资源变"就把它写在**配置这一层**(不是资源条目上):`capFn` 的签名是 `(key, ledger)`,一给就以它为准 —— 例:`capFn: (k, l) => k === 'coin' ? Number(l.dust ?? 0) * 10 : undefined` |
| **收支要不要带来源**(审计"这批是哪来的") | 每条收支都可带 `source`;`audit()` 按资源与按来源各汇总一份,明细恒等于合计 |
| **买不起时怎么办** | `pay` 默认**整笔要么全成、要么不动**并给出缺口;要允许分次付就显式开 `partial` |
| **挂机产出的上限** | `produce(ledger, steps, perStep)` 逐步夹上限 —— 一步乘完再加是算不出"中途到顶"的 |
| 随机源(可复现 / 平台随机) | `Rng` 接口;库自带 mulberry32,可换 |
| 存档介质与加密 | 库**不碰介质**:`encodeSave` 出字符串,写哪儿、要不要加密都归你 |
| **存档的编码格式** | `SaveFormat.codec: { encode, decode }`(压缩/加密/换封套都行;迁移链与形状修复照旧) |
| 内容校验的严格度 | `defineGame(config, { strict: true })` 把警告也当错误 |

两条不变式(其余都能改):

1. **机制键是接口,展示名是你的** —— `attack` 一直叫 `attack`(公式、存档、内容 gate 都认它),
   但它显示成"攻击力""火力"还是"专注力",完全由你决定;
2. **引擎要求的字段都是结构,不是题材** —— 它要的是"一串有序的世界名""每层的成长曲线"
   "每个部位有几种成色",不是"你得叫它境界/装备"。

战斗与副本出的都是**本值表**(`{ stats: { … } }`),与属性系统的本值一一对应:
键名按引擎的接口词(`attack/defense/hp/maxHp/speed`),想用自己的叫法就在 `BattleConfig.keys` 里指过去。
