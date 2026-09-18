# 万象引擎 (wanxiang-engine)

等级(境界)、属性、装备、副本四套系统的**可配置内核**。
换一套名字与内容,就能搭出自己的放置 / RPG 游戏 —— 机制不用重写。

它从《云隐修仙录》里抽出来,并保留了一份**逐数字对账**的判据(见下文"为什么不只是另写一套")。

```bash
bun packages/engine/examples/minimal.ts   # 换皮后的完整一圈:修炼 → 掉装 → 打副本 → 通关
```

## 30 秒上手

```ts
import { attributeDefs, defineGame, createRng, emptyProgress } from 'wanxiang-engine'

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
    templates: [{ id: 'w1', name: '青竹剑', slot: 'weapon', tier: 1, base: { attack: 10 } }],
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
console.log(game.realms.label(0, 2))                       // 引气·三重
console.log(game.attributes.name('critRate'))              // 会心率

const loot = game.equipment.generate(rng, { tier: 1 })
const item = game.equipment.resolve(loot)
console.log(item.quality.name, item.template?.name, item.affixLines.map(l => l.desc))

const progress = emptyProgress()
const encounter = game.dungeons.nextEncounter('r1', progress, rng)
const foe = game.dungeons.snapshot(encounter.enemyId)
const stats = game.attributes.compute({ base: game.realms.baseStats(state.major, state.layer), flat: item.flats, modSources: [item.mods] })
const battle = game.combat.resolve(
  { id: 'p', name: '我', hp: stats.final.maxHp!, maxHp: stats.final.maxHp!, attack: stats.final.attack!, defense: stats.final.defense!, speed: 1, mods: stats.mods },
  { id: foe.id, name: foe.name, hp: foe.hp, maxHp: foe.hp, attack: foe.attack, defense: foe.defense, speed: foe.speed, mods: foe.mods, skills: foe.skills },
  rng
)
console.log(battle.win ? '胜' : '败', battle.rounds, '回合')
```

## 四套系统各管什么

| 系统 | 入口 | 回答的问题 |
| --- | --- | --- |
| 等级 | `game.realms` | 有哪些境界/层?升一层要多少修为?进阶成功率多少、寿元多少、基础属性多高? |
| 属性 | `game.attributes` | 词条怎么合并(递减、软阈值)?本值 × 平铺 × 百分比 × 另乘 之后是多少? |
| 装备 | `game.equipment` | 这一层这一部位掉什么?这一件是什么品质、哪几条词条?装配后汇总多少? |
| 副本 | `game.dungeons` | 哪些图开着?这次遇到谁?打几次出首领?通关给什么? |

战斗解算(`game.combat`)是副本的下半场:一场遭遇要分得出胜负。它同样只吃属性系统的输出。

## 「只改名字」到底改哪儿

| 想改的东西 | 改配置的哪一处 | 不改的东西 |
| --- | --- | --- |
| 属性叫什么 | `attributes.defs[].name`(`attributeDefs({ rename: {...} })`) | `key`(机制键,公式与存档都认它) |
| 等级体系叫什么 | `realms.worlds[].realms` 与 `layerNames`、`labelFormat` | 序号 `major` / `layer` |
| 装备叫什么 | `equipment.templates[].name`、`slots[].name`、`qualities[].name`、`affixes[].name` | id 与部位键 |
| 副本叫什么 | `dungeons.regions[].name`、`enemies[].name` | id、层级、前置关系 |

两份现成的内容包可以对照着看:

- `src/presets/xiuxian.ts` —— 仙侠:四界二十一境、九档品质、六层装备、六个区域
- `src/presets/demo.ts` —— 星港:舱位等级、舰载模块、火力/装甲/结构值、三个星区

两者的**机制键完全一致**,名字没有一处相同,而都能跑完「修炼 → 进阶 → 掉装 → 装配 → 打副本 → 通关拿奖励」。
这不是文档里的承诺,是 `src/presets/presets.spec.ts` 里的判据。

## 装配时会替你抓的错

内容表之间全是引用,写错一处往往不报错、只是"某张图永远掉不出东西"。`defineGame` 因此在装配时逐条对账:

- 装备模板指向不存在的槽位 / 套装;词条挂在未登记的属性键上、限定了不存在的部位
- 区域引用了不存在的敌人或首领;前置区域不存在;区域链条成环;推荐等级超出境界范围
- 属性键重复、`appliesTo` 指向未登记的键;成长曲线分段点越界

错误会直接挡住装配并指名道姓;警告(某层某部位没有内容、首领没标 `boss: true`)只是提示,
发版前可以用 `defineGame(config, { strict: true })` 把它们也变成错误。

> 实战例子:这份校验在接入本作内容时抓出了 `e_meteorbeast` 的 id 重复 —— 17 层与 25 层各写了一次,
> 因为敌人表按 id 建索引,星陨荒原的玩家一直在撞 25 层数值的怪(见 `src/core/dataIntegrity.spec.ts`)。

## 为什么不只是"另写一套"

抽出来的引擎与《云隐修仙录》本体之间有一份 **parity(对账)判据**:`src/core/engineParity.spec.ts`
用本作的真实数据装配同一套系统,然后逐条比:

- 等级:21 个境界 × 10 层的**名目、寿元、修为需求、基础三维、进阶成功率**逐条相同
- 属性:200 组随机来源下,`mergeMods` 的合并结果(含递减与软阈值)**逐键相同**
- 装备:每层每部位的掉落池**逐 id 相同**、词条数值逐条相同、
  同一件装备的平铺与词条结算与 `resolveEquipStats` **逐项相同**
- 副本:区域/敌人表逐条相同,解锁口径与 `unlockClosure` 在若干存档状态下一致

换句话说:本作可以逐步把自己的实现换成这套库,而玩家看到的数字不变。

## 目录

```
packages/engine/
  src/
    numeric.ts      数值适配层(默认 number,大数库可插拔)
    rng.ts          可复现随机(mulberry32,与本体同源)
    attributes.ts   属性登记表 + 合并规则 + 最终属性结算
    realms.ts       世界/境界/小层 + 修为/进阶/寿元/基础属性
    equipment.ts    槽位/品质/模板/词条/套装 + 生成与解析
    dungeons.ts     区域链/敌人/遭遇/首领门槛/通关奖励
    combat.ts       回合制解算(副本的下半场)
    config.ts       defineGame / validateGame(交叉校验)
    presets/        仙侠与星港两份内容包
  examples/minimal.ts
```

## 边界

这一版收的是**逻辑内核**,不是整套游戏框架。以下按设计留在使用方:

界面、存档与版本迁移、离线收益结算、账号与云同步、音频与美术资源。

引擎不依赖 Vue / Pinia / 浏览器 API,纯函数 + 数据驱动,服务端跑批量模拟也能直接用。

## 命令

```bash
bun run test:engine            # 只跑公共库的用例
bun run build:engine           # 出 dist(含 .d.ts),可发包
bunx vitest run src/core/engineParity.spec.ts   # 与本体对账
```

## 许可

与仓库根目录一致(CC BY-NC 4.0)。
