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
bun add github:pplmx/wanxiang-engine#v0.1.18
# 或
npm  i github:pplmx/wanxiang-engine#v0.1.18
```

<!-- compile-check: 这段是"装上就能跑"的导入示例,自检会拿发布包把它编一遍 -->
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
**想直接抄起点**:[`examples/from-zero.ts`](./examples/from-zero.ts) 不引用任何内容包,一百多行装完一个世界。
**要动手搭自己的系统,先看[组装指南](./docs/assembly.md)**:它按"要做一个 X 类的游戏该接哪些模块"
列了四条配方,每条都指到能跑的示例或判据用例。
它装配一个自己的小世界,然后走完「修炼 → 进阶 → 掉装 → 装配 → 遭遇 → 通关结算」:

<!-- compile-check -->
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

库按"一层回答一个问题"切开,`src/` 下 36 个模块文件各是一层(另有 3 份内容包)。
按**你要做的事**分组:

| 这一组 | 回答什么 | 代表入口 |
| --- | --- | --- |
| 成长底盘 | 境界/层数、每级要多少、进阶怎么算、基础属性多高、词条怎么合 | `game.realms` / `game.attributes` |
| 装备与产出 | 掉什么、什么品质、哪几条词条、这一场给不给、给几份 | `game.equipment` / `createDropTable` |
| 副本与战斗 | 哪些图开着、这次遇到谁、打几次出首领、这场谁赢 | `game.dungeons` / `game.combat` |
| 技艺与配方 | 练到第几级加多少、四个乘区各贡献多少、开炉之后实际发生什么 | `createSkillSystem` / `createRecipeRunner` |
| 账与回执 | 收多少、付得起吗、上限多少、这批是哪来的、这笔到底给了多少 | `createResourceSystem` / `createSettlement` |
| 时间与节奏 | 过去多久、多少计入上限、今天是什么环境、这条状态过期了吗、今日任务 | `planIdle` / `createCycleSystem` / `createBuffSystem` / `createTaskBoard` |
| 抽取与收集 | 该抽什么、越抽越容易、见过多少、收不下怎么办 | `drawFrom` / `createPityCounter` / `createCodex` / `createIntake` |
| 设施与投资 | 这一座几级、还能不能再升、投点往哪投、换位会不会作废 | `createFacilitySystem` / `createPointPool` |
| 内容与存档 | 内容之间自洽吗、老档怎么升上来、形状坏了怎么补 | `defineGame` / `defineSaveFormat` |
| 可复现 | 数值超过 double 怎么办、同一颗种子跑两遍一样吗 | `Numeric<T>` / `createRng` |

每一层的"回答的问题"、最小用法与注意事项,都在 **[模块速查与定制点](./docs/usage.md)** ——
那份文档里还有一张"想改什么、改哪里"的定制表(近一百个可改点)。

## 定制:想改什么,改哪里

库里"写死的"只有**结构**(有序的名字串、曲线的形状、区间与权重);凡是"具体长什么样"的,
都留了配置字段或钩子 —— 名字、曲线、阈值、文案、键名、随机源、存档介质全归你。

只有两条不变式,其余都能改:**机制键是接口,展示名是你的**(`attack` 一直叫 `attack`,
但它显示成"攻击力""火力"还是"专注力"由你定);**引擎要的字段都是结构,不是题材**
(它要的是"一串有序的世界名""每层的成长曲线",不是"你得叫它境界 / 装备")。

逐项对照表(近一百个可改点)见 [模块速查 · 定制](./docs/usage.md#定制想改什么改哪里);
"照着装配一套完整玩法"的四条配方与坑清单见 [组装指南](./docs/assembly.md)。
调数值之前先看 [**调参实测参考**](./docs/tuning.md):文首是**一页索引**(「你要调的东西 →
在哪一节 → 一句话结论」,26 行),后面是每份消融的推导、表格与复现命令 ——
离线上限、保底、掉落倍率、内容池权重、状态叠加这些"配错了也看不出来"的地方,都在那里量成了数字。

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
| 用例 | 公开面的行为,521 个用例 / 71 个文件(零运行时依赖,`bun install && bun run test` 即可跑) | `src/**/*.spec.ts` |
| 与源工程对账 | 21 境 × 10 层的名目/寿元/修为/三维/成功率、200 组来源下的词条合并、掉落池与装备结算**逐条相同** | [`docs/parity.md`](./docs/parity.md) |
| 产物自检 | 编译后的 `dist` 能被 **Node** ESM 直接 import(而不是 bun/vite 的宽容解析) | `scripts/verify-dist.mjs` |
| 发布包自检 | 真 `npm pack` → 摊进临时项目的 `node_modules/` → 按**包名与子路径** import,并装配三份内容包 | `scripts/verify-dist.mjs` |
| 公开面判据 | 75 个运行时导出 + 203 个公开类型一字不差,少一个就红 | `src/publicApi.spec.ts` |

## 边界与兼容性

这一版收的是**逻辑内核**,不是整套游戏框架。以下按设计留在使用方:
界面、存储介质与账号云同步、音频与美术资源、服务端接口。
存档的**版本迁移与形状修复**在库内,但写到哪里、要不要加密由你决定。

**兼容性**:零运行时依赖;纯 ESM + `.d.ts`;Node ≥ 20 / Bun / Deno / Vite / webpack 直接可用,
不需要任何构建器插件。库不依赖 Vue / Pinia / 浏览器 API —— 纯函数 + 数据驱动,服务端跑批量模拟也能直接用。

## 版本与发布

- 当前版本 **0.1.18**(tag `v0.1.18`)。尚未发布到 npm,按 tag 引用:见[安装](#安装)。
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
    index.ts        公开入口(对外承诺的就是这里导出的东西,清单钉在 publicApi.spec.ts)
    numeric.ts      数值适配层(默认 number,大数库可插拔)
    rng.ts          可复现随机(mulberry32,与源工程可交换种子对账)
    counters.ts     计数器基准快照(生涯 / 本期共用一份计数)
    attributes.ts   属性登记表 + 合并规则 + 最终属性结算
    buffs.ts        状态(时效增益):叠时长、过期即散、按分类清除
    realms.ts       世界/境界/小层 + 修为/进阶/寿元/基础属性
    equipment.ts    槽位/品质/模板/词条/套装 + 生成与解析
    holding.ts      持有:容量、占位、替换
    dungeons.ts     区域链/敌人/遭遇/首领门槛/通关奖励
    combat.ts       回合制解算(副本的下半场)
    skills.ts       技能/功法:等级曲线、消耗、满级分支
    crafting.ts     炼制:成功率四乘区与熟练度曲线
    recipes.ts      配方执行:开炉 → 扣料 → 成败 → 双成(与成功率互补)
    facilities.ts   设施:升级门槛 / 上限 / 每小时产出与零头
    points.ts       投资点:总容量与主副两档上限、换位不作废已投
    resources.ts    资源账本:收支、上下限、来源明细
    triage.ts       分流裁决:留还是不留,以及为什么
    intake.ts       入库漏斗:先见证、按规则拒收、满了腾位、折算
    settlement.ts   结算回执:实际入账是唯一来源
    drops.ts        掉落表:概率归一、保底、抽数与份数
    pity.ts         抽取保底:软保底曲线(涨幅封顶)与第 N 次必出
    economy.ts      经济读数:进/出比值与判词
    cycles.ts       周期:每日 / 每赛季的确定性轮换
    choices.ts      抉择:事件选项、加权后果、超时兜底
    tasks.ts        周期任务板:按计数增量结算、换期幂等
    chain.ts        顺序任务链:一次连推多节、守卫与到链尾
    unlocks.ts      一次性解锁:成就 / 里程碑的登记簿(只记一次)
    goals.ts        目标/成就条件(判定与进度视图)
    codex.ts        图鉴:照面累计升档、只记见过的最好一件
    memory.ts       世界记忆:档位门槛与不打交道就回落
    deck.ts         随机内容池(区间/标签/一次性/权重/保底)
    companions.ts   伙伴与性格系数
    idle.ts         离线时长账
    save.ts         defineSaveFormat / 迁移链 / 编解码
    saveShape.ts    形状修复原语
    config.ts       defineGame / validateGame(交叉校验)
    presets/        仙侠 / 星港 / 日常学习三份内容包
  examples/         可跑示例(从零装配 / 快速上手 / 最小循环 / 战斗组合技 / 一梯三界 / 书桌与日常 / 自习室的一天 / 星屑集册 / 一角点心铺 / 行商十二日 / 药庐二十四炉 / 战斗接管 / 拳赛接管)
  docs/
    usage.md        模块速查与定制点(每层回答什么、想改什么改哪里)
    assembly.md     组装指南:四条配方 + 坑清单 + 验收清单
    tuning.md       调参实测参考:消融实验量出来的刻度(离线上限 / 保底 / 权重 / 叠加……)
    parity.md       与源工程的对账口径
    development.md  开发、同步与"接进你自己项目"的四种写法
```

## 许可

[MIT](https://opensource.org/licenses/MIT) —— 可以自由使用、修改、分发,商用也可以,
只需保留版权声明与许可文本。
