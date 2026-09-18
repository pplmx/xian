# 万象引擎 (wanxiang-engine)

等级(境界)、属性、装备、副本四套系统的**可配置内核**。
换一套名字与内容,就能搭出自己的放置 / RPG 游戏 —— 机制不用重写。

它从《云隐修仙录》里抽出来,并保留了一份**逐数字对账**的判据(见下文"为什么不只是另写一套")。

**它现在是一份可以单独成 repo 的包**:零运行时依赖,自带测试配置与用例,
复制出去 `bun install && bun test && bun build` 就能独立迭代(见"单独成库")。

> 独立仓库:<https://github.com/pplmx/wanxiang-engine>
> 本目录是它的**上游**:宿主仓库(云隐修仙录)在这里开发,再按下面的方式同步过去。

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

放置类游戏的另一半是**离线推进**:`planIdle` 只算时长账 ——
过去多久、其中多少计入上限(`cappedMs`)、再乘效率(`effectiveMs`)、拆成多少步(`steps`)、
余量与"被上限吃掉"的各是多少。每一步产出什么由你的游戏决定(`runIdle` 按步折叠):

```ts
const plan = planIdle(8 * 3600_000, { stepMs: 60_000, capMs: 6 * 3600_000, efficiency: 0.9 })
// cappedMs 6h · effectiveMs 5.4h · steps 324 · overflowMs 2h
const gained = runIdle(plan, 0, (total, i, stepMs) => total + stepMs)
```

## 存档:形状修复 + 版本迁移

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

- **迁移是链,不是分支**:版本 1 的档一路走到当前版本,每一跳只做那一跳的事;
  缺的那一跳按"形状没变"处理(不打断整条链)。版本号缺失/损坏时按**最老**的一版补起。
- **未来的版本不许猜**:读到比当前更高的版本就拒绝并说明 —— 猜错的代价是把新档写坏,
  而写坏比读不到严重得多。失败有三种名字(`parse` / `future` / `shape`),界面才说得清
  "是文件选错了、该升级了、还是真损坏"。

`revive` 里用的 `asArray` / `asRecord` / `asFiniteNumber` / `asNumberRecord` / `asStringArray`
是配套的**形状修复原语**:形状不对就用兜底值,而不是抛错。`asArray` 的自定义判据拿到的元素
保证不是 null/undefined —— 判据里那次"忘了写 `!!x &&`"正是白屏的常见起因。

## 技能 / 功法:等级曲线、消耗、满级分支

```ts
const skills = createSkillSystem({
  skills: [
    {
      id: 'sword',
      name: '青锋诀',
      kind: '主修', // 引擎只当标签,不当规则
      maxLevel: 9,
      baseMods: { attackPct: 0.05 }, // 入门就会的
      perLevelMods: { attackPct: 0.03 }, // 练出来的
      costs: [
        { key: 'wudao', base: 10, growth: 1.5 }, // 基数 × 倍率^等级
        { key: 'page', base: 0, levelStep: 2, discountable: false } // 线性项,且不吃折扣
      ],
      branches: [{ id: 'fast', name: '疾锋', mods: { speed: 0.05 } }] // 满级再择一条路
    }
  ]
})

skills.modsAt('sword', 3) // 第 N 级 = 基础 + 每级 × (N-1)
skills.costAt('sword', 2, { discount: 0.2 })
skills.sourcesOf([{ skillId: 'sword', level: 9, branchId: 'fast' }]) // 每部功法一份来源
```

三处刻意的设计:

- **基础与每级分开写**:调平衡时才分得清"它本来就这么强"与"练满才有这么强"。
- **折扣是按项选的**(`discountable`):现实里一组消耗常常只有一部分打折
  (本作是"悟道点可折、残页不打折")。一刀切地乘到所有项上,省几行配置、换一处静默漂移。
- **装配汇总返回一组来源,而不是一个加总**:作品侧通常还要过自己的合并规则(递减、软上限),
  加总就把那层信息丢了。

## 炼制:成功率是四个乘区相乘

```ts
import { composeCraftRate, overReachFactor, weightedSkill, averageLore, proficiencyFromExp, stageNameOf } from 'wanxiang-engine'

const FORMULA = {
  baseRate: 0.95, // 各项皆满、不越级时的上限 —— 剩下的留给天意
  mastery: { floor: 0.22, span: 0.78 }, // 配方掌握度
  lore: { floor: 0.42, span: 0.58 }, // 材料认知度
  skill: { floor: 0.3, span: 0.7 }, // 技艺水平(调用方先归一到 0~1)
  overReach: { table: [1, 0.6, 0.35, 0.18], decay: 0.45 } // 越级:表内查表,表外指数衰减
}

composeCraftRate({ mastery: 0.6, lore: 0.8, skill: 0.5, overReach: 1 }, FORMULA)
proficiencyFromExp(5400, 600) // 90 —— 双曲饱和:逼近上限而不到顶
stageNameOf(92, [{ min: 85, name: '通玄' }, { min: 0, name: '生疏' }])
```

为什么不是"够级就成"的硬门槛:硬门槛把"我准备得怎么样"压成一个布尔值,于是
知识(记得多少配方)、材料(认不认得方中之物)、技艺(练到什么程度)、越级(方子高出我多少)
这四条本可各自权衡的线,全被一条线吞掉。这里的写法是四区相乘、**各有下限** ——
任何一项弱都不会把成功率归零,但四项全弱时自然低到不该开炉;"赌一把"于是始终是玩家的选择。

配套两条:熟练度用双曲饱和(技艺没有"练满",想留口子就在上层按阈值判),
分档给裸数字起名字(玩家读名字,不读数字)。

## 任务 / 成就:一条判据,两种用法

```ts
import { evalGoal, goalProgress, type GoalEnv } from 'wanxiang-engine'

const cond = { type: 'counter', key: 'kills', value: 10 } as const
const env: GoalEnv = {
  counter: key => counters[key] ?? 0, // 引擎不认识你的存档,只向环境提问
  level: () => player.major,
  subLevel: () => player.sub,
  custom: key => flags[key] === true
}

evalGoal(cond, env)            // 达成与否 —— 界面与发赏共用这一份
goalProgress(cond, env)        // { done, ratio, current, target }
```

条件有五种:`counter`(计数)、`level`(等级)、`position`(大阶 + 小阶)、`rank`(品阶)、
`custom`(交给作品判)。**"达成与否"只有一处实现**:界面显示"还差 3 个敌人"与发赏时的判定
读同一个函数 —— 否则迟早出现"界面说成了、领赏时不算",而玩家只会当成吞奖励。

进度视图只对**可量化**的条件给比例(比例封顶 1、目标为 0 时不除零);
等级/位阶这类只有"到没到",`ratio` 为 null —— 界面就不画条,不硬编一个读数。

## 接进你自己的项目

包内自带 `dist` 的编译与入口声明,但**还没有发到 npm**(发布是显式动作)。三种接法任选:

```bash
# 一 · 本地路径依赖(最快)
#    package.json: "wanxiang-engine": "file:../packages/engine"
#    先出一次产物:
bun run build:engine          # 在本仓库根目录;或 cd packages/engine && bun run build

# 二 · 打包成 tgz 再装
cd packages/engine && npm pack     # 得到 wanxiang-engine-0.1.0.tgz
npm i ./wanxiang-engine-0.1.0.tgz

# 三 · monorepo 工作区
#    把 packages/engine 加进根 package.json 的 workspaces 即可
```

包里有什么、别人装得上、装上真能跑,由 `bun run check:engine` 守着:
它先按发布口径编译,再**从 dist import**(不经过仓库别名、不经过 src),用内容包走完
修炼 → 进阶 → 掉装 → 装配 → 副本 → 通关奖励,并断言坏配置会被交叉校验挡住。
这一条已接进 CI(deploy / build / 发版三条流水线)。

《云隐修仙录》自己也是这样引用它的:源码里写的就是 `from 'wanxiang-engine'`
(开发期由 Vite/TS 解析配置指到本目录的源码,拆库后换成真依赖即可,源码不用改);
那条自检还会断言宿主**只经公开入口引用**、不得出现内部别名或深层路径。

依赖为零,不需要任何构建器插件:库是纯 ESM + `.d.ts`,Vite / webpack / Node / Bun / Deno 直接可用。

## 单独成库(单独迭代)

这一份目录**不依赖宿主仓库**:源码里没有 `@/` 之类的别名,也不 import 宿主任何模块;
自带 `vitest.config.ts` 与 `package.json` 的 `devDependencies`,复制出去就能独立开发。

它已经独立成仓库(`pplmx/wanxiang-engine`)。开发有两种走法,**选一处开发即可,不要两边同时改**:

```bash
# 走法一(推荐):在独立仓库里开发
git clone git@github.com:pplmx/wanxiang-engine.git && cd wanxiang-engine
bun install && bun run check

# 走法二:在宿主仓库里开发,再推过去
cd <宿主仓库>
git subtree push --prefix=packages/engine git@github.com:pplmx/wanxiang-engine.git main
```

两边都改会分叉 —— `git subtree push` 遇到分叉会直接拒绝,那时先 `git subtree pull --prefix=packages/engine git@github.com:pplmx/wanxiang-engine.git main` 合回来。

```bash
cd packages/engine
bun install          # 只装 typescript + vitest(开发依赖)
bun run check        # 类型检查 + 跑自己的用例 + 出 dist
bun run build        # 只出 dist(含 .d.ts)
```

要变成独立仓库,两条路:

```bash
# 一 · git subtree 拆出去(保留这段历史)
git subtree split -P packages/engine -b engine-main
git push git@github.com:<你>/wanxiang-engine.git engine-main:main

# 二 · 直接复制(不要历史)
cp -r packages/engine ../wanxiang-engine && cd ../wanxiang-engine && git init
```

宿主仓库这边有一条**机械判据**守着"它真的能独立"(`bun run check:engine:standalone`):
把整份目录复制到临时目录(不带 dist 与 node_modules),在那里独立编译、独立跑用例、
独立 import 一次产物装配出换皮世界;并断言源码里没有任何宿主引用。
只要有一处"顺手用了宿主的别名或配置",这条就会红 —— 而这种依赖待在同一个仓库里是看不出来的。

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

### 而且已经开始换了

本作的成长曲线已经改成**经库计算**:`src/core/formulas.ts` 的
`expRequirement` / `baseCombatStats` / `breakthroughBaseRate` / `isWorldStepLayer`
现在转发到 `src/core/engineWorld.ts`(用 GNum 适配器装配的库世界)。

词条合并规则也换过去了:`src/core/statsCalc.ts` 的
`mergeMods` / `mergeModsDetailed` / `isSoftCapped` / `modDepth`
现在由库的属性系统计算(递减阶梯仍取自本作的 `data/constants.DIMINISH_WEIGHTS`,
在配置里显式传入 —— 平衡口径仍只有一处)。

装备的**生成**也换过去了:`src/core/equipGen.ts` 的
`generateEquipment` / `qualityWeightAt`(以及池子查询)现在由库的装备系统执行 ——
「哪一层掉哪几件」「品质怎么掷」「词条怎么筛」都是通用规则。
判据连**随机流状态**都比:同一种子下生成同一件之外,还要消耗同样多的随机数,
否则后面的掉落会整体错位。

装备的**数值解析**(`resolveEquipStats`)仍留在本作:它用的是本作的层级战力表
(`core/tierScale.powerScale`,GNum),而库那边同一张表以 number 投影进去,
差在双精度末位 —— 「玩家看到的数字一位不变」这条线要求解析走 GNum。

副本的**规则**也换过去了:首领门槛与节奏(`winsUntilBoss`,本作是
「攒够 10 胜出一位首领、击败即通关、此后不再出」的 `once` 节奏)由库回答,
在线、离线自动挑战与界面提示共用这一处;读档补票的不变量
(`prereqClosure`:前置已通 → 此地已开,只补该补的、保留不认识的历史 id、幂等)
也从 `data/regions` 搬进了库,由 store 在读档修形口调用。

这件事能被证明,而不是靠"我改了":

1. `engineParity.spec.ts` 里留着**迁移前冻结的旧公式**(`refExpRequirement` 等三个),
   与库的结果做 `toEqual`(GNum 精确相等)—— 21 境 × 10 层逐个过;
2. 另有一节「迁移接线」直接断言 `formulas.expRequirement(major, sub)` 与
   `ENGINE_WORLD.realms.expCost(major, sub)` 是同一份结果,并再次与冻结口径对账;
3. 全量 1922 个用例、`vue-tsc`、ESLint 与生产构建全绿 —— 玩家侧的数字一位没动。

至此四套系统(等级 / 属性 / 装备 / 副本)的**规则**都已由库承担;
留在应用侧的是内容数据与那些**依赖本作大数战力表**的数值解析。

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
