# 万象引擎 · wanxiang-engine

**一套可配置的游戏基础数值内核。** 等级(境界)、属性、装备、副本、技能、炼制、资源账本、
伙伴、目标、随机内容池 —— 换一套名字与内容,就能搭出自己的放置 / RPG / 养成游戏;机制一行不用重写。
零运行时依赖,纯 ESM + 类型声明。

它的规则不是拍脑袋来的:整套数值与一个在运营的放置游戏**逐数字对账**,迁移前后玩家看到的数字一位不变
(见[判据](./docs/parity.md))。

**判断标准只有一条:只有那部作品才需要的东西,不进库。** 我们自己就是第一个"拿库定制游戏"的用户 ——
凡是本作独有的设计(流派组合技、法宝触发、首领阶段……)都留在作品侧,库只提供它们需要的**能力形状**
(比如"破盾了""会心了""每回合结束了"这三个落点)。详见[什么留在作品那一侧](#战斗副本的下半场)。

[![CI](https://github.com/pplmx/wanxiang-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/pplmx/wanxiang-engine/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](#边界与兼容性)
[![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](#边界与兼容性)
[![license](https://img.shields.io/badge/license-MIT-blue)](#许可)
[![release](https://img.shields.io/github/v/tag/pplmx/wanxiang-engine?label=release)](https://github.com/pplmx/wanxiang-engine/releases)

## 目录

- [这是什么](#这是什么)
- [安装](#安装)
- [快速开始](#快速开始)
- [核心概念](#核心概念)
- [模块一览](#模块一览)
- [定制:想改什么,改哪里](#定制想改什么改哪里)
- [题材无关性](#题材无关性)
- [内容包](#内容包)
- [装配时的校验](#装配时的校验)
- [质量与判据](#质量与判据)
- [边界与兼容性](#边界与兼容性)
- [版本与发布](#版本与发布)
- [开发](#开发)
- [目录](#目录)
- [许可](#许可)

## 这是什么

做一款游戏,最难反复重写的是同一批东西:升级要多少经验、攻防怎么算、装备怎么掷、副本什么时候出首领。
每换一个题材,这些机制都要重来一遍 —— 而它们其实与题材无关,变的只是名字。

万象引擎把它们收进一个库:**你写内容(名字与数值),它负责机制**。

```ts
const game = defineGame({
  name: '我的游戏',
  attributes: { defs: attributeDefs({ rename: { attack: '术法', defense: '护体', maxHp: '气血' } }) },
  realms: { worlds: [{ id: 'mortal', name: '尘世', realms: ['引气', '凝元', '化形'] }], /* … */ },
  equipment: { slots: [{ id: 'weapon', name: '兵刃' }], /* … */ },
  dungeons: { regions: [{ id: 'r1', name: '后山', /* … */ }], enemies: [/* … */] }
})

game.realms.expCost(0, 0)                          // 这一层要多少修为
game.equipment.generate(rng, { tier: 1 })          // 掉一件装备
game.dungeons.nextEncounter('r1', progress, rng)   // 这次遇到谁
```

库里"写死的"只有**结构** —— 一串有序的名字、一条成长曲线的形状、几个区间与权重。
凡是"具体长什么样"的地方,都留了配置字段或钩子。

## 安装

尚未发布到 npm。按 tag 引用(**请用 tag,不要跟 `main`** —— 库还在长,`main` 随时会动):

```bash
bun add github:pplmx/wanxiang-engine#v0.1.7
# 或
npm  i github:pplmx/wanxiang-engine#v0.1.7
```

```ts
import { defineGame, createRng } from 'wanxiang-engine'

// 三份现成的内容包也从包名起就能取到
import { XIUXIAN } from 'wanxiang-engine/presets/xiuxian'   // 修仙
import { DEMO }    from 'wanxiang-engine/presets/demo'      // 科幻
import { DAILY }   from 'wanxiang-engine/presets/daily'     // 日常 · 学习
```

其他接法(本地路径依赖 / tgz / monorepo 工作区)见[开发文档](./docs/development.md#接进你自己的项目)。
装 git 依赖时包会自己跑一次 `prepare` 把 `dist` 编译出来,仓库里刻意不提交产物。

## 快速开始

一份完整可跑的程序在 [`examples/quickstart.ts`](./examples/quickstart.ts),用 `bun examples/quickstart.ts` 运行。
它装配一个自己的小世界,然后走完「修炼 → 进阶 → 掉装 → 装配 → 遭遇 → 通关结算」:

```ts
import { attributeDefs, createRng, defineGame, emptyProgress } from 'wanxiang-engine'

const game = defineGame({
  name: '我的游戏',

  // 属性:只改展示名,机制键不动
  attributes: {
    defs: attributeDefs({ rename: { attack: '术法', defense: '护体', maxHp: '气血', critRate: '会心率' } })
  },

  // 等级:世界(界域)与每界境界名;层名与显示模板都可换
  realms: {
    worlds: [
      { id: 'mortal', name: '尘世', realms: ['引气', '凝元', '化形'] },
      { id: 'heaven', name: '天界', realms: ['登天', '斩道'] }
    ],
    layerNames: ['一重', '二重', '三重', '圆满'],
    labelFormat: '{realm}·{layer}',
    exp: { base: 40, realmGrowth: 19, layerGrowth: 1.32, worldStepMult: 2 },
    combat: { base: { attack: 12, defense: 7, maxHp: 150 }, realmGrowth: 3.8, layerGrowth: 1.09 },
    breakthrough: { layerBase: 0.95, layerDecay: 0.03, majorBase: 0.78, majorDecay: 0.05, min: 0.15, max: 0.98 },
    lifespan: { base: 150, growth: 3, worldStepMult: 100 }
  },

  // 装备:槽位 / 品质 / 模板 / 词条 / 套装
  equipment: {
    slots: [{ id: 'weapon', name: '兵刃' }, { id: 'body', name: '战袍' }],
    qualities: [{ id: 'common', name: '凡品', rank: 0, mult: 1, affixes: [0, 1], weight: 100 }],
    templates: [
      { id: 'w1', name: '青竹剑', slot: 'weapon', tier: 1, base: { attack: 10 } },
      { id: 'b1', name: '粗布衣', slot: 'body', tier: 1, base: { defense: 4, maxHp: 20 } }
    ],
    affixes: [{ id: 'atk1', name: '锋锐', key: 'attackPct', min: 2, max: 5, weight: 100, desc: '攻击提升 {v}%' }],
    power: { tierGrowth: 1.9, baseFactor: 0.5, qualityExponent: 1.8 },
    affixValueScale: 100
  },

  // 副本:区域链 + 敌人表
  dungeons: {
    regions: [{ id: 'r1', name: '后山', tier: 1, minRealm: 0, enemies: ['e1'], boss: 'b1' }],
    enemies: [
      { id: 'e1', name: '野狼', tier: 1, hpMult: 1, atkMult: 1, defMult: 1, speed: 1 },
      { id: 'b1', name: '狼王', tier: 1, hpMult: 3, atkMult: 1.2, defMult: 1, speed: 1, boss: true }
    ],
    bossProgress: 8,
    victoryRewards: [{ id: 'exp', name: '修为', base: 40, tierGrowth: 1.9 }]
  }
})

// —— 用起来 ——
const rng = createRng('一局')
let state = { major: 0, layer: 0, exp: 0 }
state = game.realms.addExp(state, Number(game.realms.expCost(state.major, state.layer)))
const step = game.realms.attemptBreakthrough(state, { rng })
console.log(step.ok ? `进阶到 ${step.to}` : `还差一点(${step.reason})`)
console.log(game.realms.label(0, 2))                  // 引气·三重
console.log(game.attributes.name('critRate'))         // 会心率

const loot = game.equipment.generate(rng, { tier: 1 })
const item = game.equipment.resolve(loot)
console.log(item.quality.name, item.template?.name, item.affixLines.map(l => l.desc))

const progress = emptyProgress()
const encounter = game.dungeons.nextEncounter('r1', progress, rng)
const foe = game.dungeons.snapshot(encounter.enemyId)
const stats = game.attributes.compute({
  base: game.realms.baseStats(state.major, state.layer),
  flat: item.flats,
  modSources: [item.mods]
})
const battle = game.combat.resolve(
  {
    id: 'p',
    name: '我',
    mods: stats.mods,
    stats: {
      hp: stats.final.maxHp!,
      maxHp: stats.final.maxHp!,
      attack: stats.final.attack!,
      defense: stats.final.defense!,
      speed: 1
    }
  },
  { id: foe.id, name: foe.name, stats: foe.stats, mods: foe.mods, skills: foe.skills },
  rng
)
console.log(battle.win ? '胜' : '败', battle.rounds, '回合')
console.log(game.dungeons.onVictory('r1', { ...encounter, kind: 'boss' }, progress, rng).rewards)
```

## 核心概念

只有三条,其余都是它们的组合:

| 概念 | 含义 | 你要给的是 |
| --- | --- | --- |
| **机制键** | 引擎内部认的键名(`attack`、`exp`、`key`、`slot`、`tier`…) | 什么都不用给,照抄即可 |
| **展示名** | 玩家看到的字(`name` 字段) | 你的题材词 —— 想叫什么都行 |
| **结构** | 有序的名字串、曲线的形状、区间与权重 | 内容与数值 |

于是每个可配置点都有两条路:

1. **默认公式** —— 开箱可用,填几个系数就行;
2. **自定义函数** —— 明说"这块归我",引擎不再叠加自己的规则。

而没有显式配置时,**默认行为逐位不变** —— 这是全套改动的一条纪律,由对账用例兜底(见 [判据](./docs/parity.md))。

## 模块一览

| 模块 | 入口 | 回答的问题 |
| --- | --- | --- |
| 等级 | `game.realms` | 有哪些境界/层?升一层要多少修为?进阶成功率多少、寿元多少、基础属性多高? |
| 属性 | `game.attributes` | 词条怎么合并(递减、软阈值)?本值 × 平铺 × 百分比 × 另乘 之后是多少? |
| 装备 | `game.equipment` | 这一层这一部位掉什么?这一件是什么品质、哪几条词条?装配后汇总多少? |
| 副本 | `game.dungeons` | 哪些图开着?这次遇到谁?打几次出首领?通关给什么? |
| 战斗 | `game.combat` | 这场遭遇谁赢?回合日志长什么样? |
| 技能 | `createSkillSystem` | 练到第几级加多少?要花什么?满级选哪条路? |
| 炼制 | `composeCraftRate` 等 | 这次能不能成?四个乘区各贡献多少? |
| 目标 | `evalGoal` / `goalProgress` | 这条任务达成了吗?进度怎么显示? |
| 随机内容池 | `drawFrom` / `drawMany` | 该从池子里抽什么?怎么保证切题? |
| 伙伴 | `createCompanionSystem` | 带这只伙伴的系数是多少?带多只怎么合? |
| 离线账 | `planIdle` / `runIdle` | 过去多久?多少计入上限?拆成多少步? |
| 存档 | `defineSaveFormat` 等 | 老档怎么升到新版本?形状坏了怎么补? |
| 数值层 | `Numeric<T>` | 数值超过 double 怎么办? |
| 装配 | `defineGame` | 内容之间的引用是否自洽? |
| 资源账本 | `createResourceSystem` | 灵石 / 信用点 / 零花钱:收多少、付得起吗、上限多少、这批是哪来的? |
| 分流裁决 | `createTriage` | 这一件留还是不留?自动回收 / 自动分解的规则顺序与读数 |
| 周期 | `createCycleSystem` | 每天 / 每赛季换一种环境:今天是什么、还有多久换、接下来几天分别是什么 |
| 抉择 | `createChoiceSystem` | 事件选项 / 任务分支:能不能选、按权重掷哪种后果、效果由谁解释、没选时用哪条 |
| 图鉴 | `createCodex` | 见过什么、懂到什么程度:照面累计升档、概率升档、用过才算真懂、只记见过的最好一件 |
| 世界记忆 | `createStageMemory` | 区域繁荣 / 阵营好感:多路门槛取先到、有资格才升档、不打交道会回落 |
| 经济读数 | `createEconomyReadings` | 哪一样不对劲:进/出比值的判词(瓶颈·健康·过剩·闲置)、分期读、带"没把握"标记 |

### 战斗:副本的下半场

战斗只吃属性系统的输出。读哪几个键由你指定 —— 本值叫"火力/装甲/结构值"或"专注力/耐心/精力"都能直接指过去:

```ts
const combat = createCombatEngine({
  keys: { attack: 'power', defense: 'armor', hp: 'hull', maxHp: 'hullMax', speed: 'thrust' },
  damageFn: ctx => Math.max(1, ctx.attack * ctx.mult - ctx.defense)   // 减法型?整条公式归你
})
```

技能上的效果标记(`stun` / `drain` / `pierce` / `multi`…)库里**不认识**,只原样交给你解释:

```ts
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

```ts
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

```ts
const plan = planIdle(8 * 3600_000, { stepMs: 60_000, capMs: 6 * 3600_000, efficiency: 0.9 })
// cappedMs 6h · effectiveMs 5.4h · steps 324 · overflowMs 2h
const gained = runIdle(plan, 0, (total, i, stepMs) => total + stepMs)
```

### 存档:形状修复 + 版本迁移

两个模块,**都不碰存储介质**(localStorage / 文件 / 云 / 内存由你接 —— 于是浏览器、容器、服务端同一套):

```ts
import { defineSaveFormat, encodeSave, decodeSave, asFiniteNumber, asStringArray } from 'wanxiang-engine'

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

```ts
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

```ts
import { composeCraftRate, overReachFactor, proficiencyFromExp, stageNameOf } from 'wanxiang-engine'

const FORMULA = {
  baseRate: 0.95,                                          // 各项皆满、不越级时的上限 —— 剩下的留给天意
  mastery: { floor: 0.22, span: 0.78 },                     // 配方掌握度
  lore: { floor: 0.42, span: 0.58 },                        // 材料认知度
  skill: { floor: 0.3, span: 0.7 },                         // 技艺水平(调用方先归一到 0~1)
  overReach: { table: [1, 0.6, 0.35, 0.18], decay: 0.45 }   // 越级:表内查表,表外指数衰减
}

composeCraftRate({ mastery: 0.6, lore: 0.8, skill: 0.5, overReach: 1 }, FORMULA)
proficiencyFromExp(5400, 600)   // 90 —— 双曲饱和:逼近上限而不到顶
stageNameOf(92, [{ min: 85, name: '通玄' }, { min: 0, name: '生疏' }])
```

为什么不是"够级就成"的硬门槛:硬门槛把"我准备得怎么样"压成一个布尔值,于是知识、材料、技艺、越级
这四条本可各自权衡的线全被一条线吞掉。这里四区相乘、**各有下限** —— 任何一项弱都不会把成功率归零,
但四项全弱时自然低到不该开炉;"赌一把"于是始终是玩家的选择。

### 资源账本:钱、材料、点数

```ts
import { createResourceSystem } from 'wanxiang-engine'

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

```ts
import { evalGoal, goalProgress, type GoalEnv } from 'wanxiang-engine'

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

```ts
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
| 名字(境界 / 装备 / 属性 / 副本 / 技能 / 性格……) | 各处定义的 `name`;属性可用 `attributeDefs({ rename })` |
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
| **经济体检**(哪个资源是瓶颈 / 烂在手里) | `createEconomyReadings({ bands?, labels? })` —— 进/出比值的判词(默认阈值 0.7 / 3 / 10)、分期读、带 `note` 的"没把握"标记;出为 0 时比值是无穷而不是 1 |
| 首领节奏(循环刷 / 一次通关) | `dungeons.bossRhythm: 'cycle' \| 'once'` |
| **敌人数值曲线完全自己定** | `dungeons.enemyPower.scaleFn(tier)`(或给整表 `tierFactors`) |
| **遭遇调度完全自己定** | `dungeons.encounterFn(ctx, rng)`(给出 region/progress/bossDue/pool;返回 `null` 即交回默认逻辑) |
| **奖励数额完全自己定** | `dungeons.victoryRewards[].amount(tier)`(概率仍生效) |
| **整场奖励完全自己接管** | `dungeons.rewardFn(ctx, rng)`(默认奖励已算好放在 `ctx.defaultRewards` 里,可以先看再决定;`null` 即交回默认) |
| **区域多条前置**("两条线都通才开"/"任一即可") | `requireCleared: string \| string[]` + `requireMode: 'all' \| 'any'` |
| **战斗读哪几个键** | `BattleConfig.keys: { attack, defense, hp, maxHp, speed }` —— 本值叫火力/装甲/结构值也能直接指过去 |
| **战斗伤害公式完全自己定** | `BattleConfig.damageFn(ctx, rng)`(减法型/除算型/查表型都行;给了它,地板与修正都归你) |
| **技能的效果标记怎么解释** | `BattleConfig.skillEffectFn(ctx, rng)` —— 库不认识 `stun/drain/pierce/multi`,只把标签交过来;返回 `true` 即"这次出手归我" |
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
| **大数实现**(数值超过 double) | `Numeric<T>` 适配器 —— 公式一行不用改 |
| **资源有哪些 / 叫什么 / 上限多少**(货币、材料、点数) | `createResourceSystem({ resources })`:键名与展示名分开,`cap` / `floor` 逐个给;上限还能随账本变(`capFn`) |
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

## 题材无关性

同一套内核已经装出三款题材(修仙 / 星港科幻 / 日常学习),对照表如下:

| 引擎概念(机制词) | 修仙 | 武侠 | 日常 · 学习 |
| --- | --- | --- | --- |
| `worlds[].realms` 有序名字 | 人间界 → 仙界 | 江湖 → 庙堂 | 小学 → 中学 → 高中 |
| `layerNames` 小层 | 一层 … 圆满 | 一式 … 大成 | 第一周 … 期末 |
| `exp` 成长需求 | 修为 | 功力 | 理解(作业量) |
| `attributes` 本值 | 攻 / 防 / 血 | 攻 / 防 / 内力 | **专注力 / 耐心 / 精力** |
| `breakthrough` 进阶 | 渡劫 | 破境 | 升学 |
| `lifespan`(可选) | 寿元 | 寿元 | **不配** —— 没有生死就不该编一个 |
| `equipment` 槽位/品质/词条 | 兵器 · 道袍 | 刀剑 · 软甲 | **文具 · 耳机 · 书桌** |
| `dungeons` 区域与首领 | 秘境 · 妖王 | 门派 · 掌门 | **图书馆 · 期末考试** |
| `skills` 技能树 | 功法 | 招式与内功 | **学科**(数学/语文) |
| `crafting` 炼制 | 炼丹 | 铸兵 | **做饭**(菜谱 + 厨艺) |
| `companions` 伙伴与性子 | 灵兽 | 同门 | **同桌与窗台的猫** |
| `deck` 随机内容 | 际遇 | 奇遇 | **日常小事** |
| `goals` 目标条件 | 任务与成就 | 悬赏 | **作业与全勤** |
| `idle` 离线账 | 闭关 | 打坐 | **睡觉 / 自动自习** |

一句话:**名字随便换,机制键不动**。

## 内容包

三份现成的内容包可以直接对照,也都从包名起就能取到:

| 内容包 | 题材 | 看点 |
| --- | --- | --- |
| `presets/xiuxian` | 仙侠 | 四界二十一境、九档品质、六层装备、六个区域的完整链条 |
| `presets/demo` | 星港科幻 | 舱位等级、舰载模块、火力/装甲/结构值 —— 换皮不换机制 |
| `presets/daily` | 书桌与日常 | 学段与周次、专注力/精力、文具与书桌、图书馆与期末考试(**没有战斗世界观**的题材) |

三者的**机制键完全一致**,名字没有一处相同,而都能跑完「修炼 → 进阶 → 掉装 → 装配 → 打副本 → 通关拿奖励」。
这不是文档里的承诺,是 `src/presets/presets.spec.ts` 里的判据。

## 装配时的校验

内容表之间全是引用,写错一处往往不报错、只是"某张图永远掉不出东西"。`defineGame` 因此在装配时逐条对账:

- 装备模板指向不存在的槽位 / 套装;词条挂在未登记的属性键上、限定了不存在的部位;
- 区域引用了不存在的敌人或首领;前置区域不存在;区域链条成环;推荐等级超出境界范围;
- 属性键重复、`appliesTo` 指向未登记的键;成长曲线分段点越界。

错误会直接挡住装配并指名道姓;警告(某层某部位没有内容、首领没标 `boss: true`)只是提示,
发版前可以用 `defineGame(config, { strict: true })` 把它们也变成错误。

> 实战例子:接入一款真实作品的内容时,这份校验抓出过一个敌人 id 重复 —— 同一个敌人被写了两遍,
> 而敌人表按 id 建索引,于是本该打低层的玩家一直在撞高层数值的怪。写内容的人不会自己发现,玩家也只会觉得"这怪怎么这么硬"。

## 质量与判据

"能不能用"在库里是被机械判据钉住的,而不是靠文档承诺:

| 判据 | 钉住的事 | 在哪 |
| --- | --- | --- |
| 用例 | 16 个模块的行为,147 个用例(零运行时依赖,`bun install && bun test` 即可跑) | `src/**/*.spec.ts` |
| 与源工程对账 | 21 境 × 10 层的名目/寿元/修为/三维/成功率、200 组来源下的词条合并、掉落池与装备结算**逐条相同** | [`docs/parity.md`](./docs/parity.md) |
| 产物自检 | 编译后的 `dist` 能被 **Node** ESM 直接 import(而不是 bun/vite 的宽容解析) | `scripts/verify-dist.mjs` |
| 发布包自检 | 真 `npm pack` → 摊进临时项目的 `node_modules/` → 按**包名与子路径** import,并装配三份内容包 | `scripts/verify-dist.mjs` |
| 公开面判据 | 50 个运行时导出 + 90 个公开类型一字不差,少一个就红 | `src/publicApi.spec.ts` |

## 边界与兼容性

这一版收的是**逻辑内核**,不是整套游戏框架。以下按设计留在使用方:
界面、存储介质与账号云同步、音频与美术资源、服务端接口。
存档的**版本迁移与形状修复**在库内,但写到哪里、要不要加密由你决定。

**兼容性**:零运行时依赖;纯 ESM + `.d.ts`;Node ≥ 20 / Bun / Deno / Vite / webpack 直接可用,
不需要任何构建器插件。库不依赖 Vue / Pinia / 浏览器 API —— 纯函数 + 数据驱动,服务端跑批量模拟也能直接用。

## 版本与发布

- 当前版本 **0.1.7**(tag `v0.1.7`)。尚未发布到 npm,按 tag 引用:见[安装](#安装)。
- 完整变更记录见 [CHANGELOG](./CHANGELOG.md),版本口径也写在那里:
  **攒批发布** —— 几十个改动攒一版是常态,期间它们记在「未发布」一节里;tag 是给外面的人
  一个可 pin 的阶段性节点,不是改动的日记。版本跟着实际分量走,真有里程碑才跳 minor 并写清为什么;
  0.x 期间**破坏性变更也可能发生在 patch 里**,但一定写清楚怎么改。
  **公开面即承诺**;数值曲线不承诺不变,但没有显式配置时**默认行为逐位不变**。

## 开发

```bash
cd packages/engine
bun install && bun run check   # 类型检查 + 用例 + 出 dist + 产物/发布包自检 + 跑示例
bun run test                   # 只跑用例
bun run build                  # 只出 dist(含 .d.ts)
bun run examples               # 跑一遍 examples/ 下的示例
```

这个目录**不依赖它外面的工程**:源码里没有 `@/` 之类的别名,也不 import 工程里的任何模块,
`bun install && bun run check` 就能跑。它已经独立成仓库
(<https://github.com/pplmx/wanxiang-engine>),同步方式、接进自己项目的四种写法、
以及"它真的能独立"的自检,见[开发文档](./docs/development.md)。

## 目录

```
packages/engine/
  src/
    numeric.ts      数值适配层(默认 number,大数库可插拔)
    rng.ts          可复现随机(mulberry32,与源工程可交换种子对账)
    attributes.ts   属性登记表 + 合并规则 + 最终属性结算
    realms.ts       世界/境界/小层 + 修为/进阶/寿元/基础属性
    equipment.ts    槽位/品质/模板/词条/套装 + 生成与解析
    dungeons.ts     区域链/敌人/遭遇/首领门槛/通关奖励
    combat.ts       回合制解算(副本的下半场)
    skills.ts       技能/功法:等级曲线、消耗、满级分支
    crafting.ts     炼制:成功率四乘区与熟练度曲线
    goals.ts        目标/成就条件(判定与进度视图)
    deck.ts         随机内容池(区间/标签/一次性/权重/保底)
    companions.ts   伙伴与性格系数
    idle.ts         离线时长账
    save.ts         defineSaveFormat / 迁移链 / 编解码
    saveShape.ts    形状修复原语
    config.ts       defineGame / validateGame(交叉校验)
    presets/        仙侠 / 星港 / 日常学习三份内容包
  examples/         可跑示例
  docs/             对账与开发文档
```

## 许可

[MIT](https://opensource.org/licenses/MIT) —— 可以自由使用、修改、分发,商用也可以,
只需保留版权声明与许可文本。
