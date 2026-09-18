# 变更记录

本文件按"对使用者有影响"的口径记录:接口新增/变更/移除、默认行为变化、判据口径变化。
内部重构(不改接口与数值)不占条目。

## 版本口径(0.x 期间)

- **版本放慢,但按需要走**:默认只加 patch(0.1.5 → 0.1.6 → …),**不为了发版而发版** ——
  几处小改动可以攒在同一版里;真有里程碑(API 稳定到能做 1.0 的准备、或对外口径变了)才跳 minor,
  并在本节写清为什么。要的不是"永远停在 0.1",是**编号跟着实际分量走**:起步阶段改动密,
  但编号别起飞。
- **公开面就是承诺**:`src/index.ts` 导出的东西(51 个运行时导出 + 100+ 个公开类型)被
  `src/publicApi.spec.ts` 逐字钉住。增删都要显式改那份清单,顺带就是一次"这是不是破坏性变更"的自问。
- 0.x 期间不保证 API 稳定:**破坏性变更也在 patch 里发生**,但一定在本文件写明"怎么改";
  数值曲线本身不承诺不变(换题材本来就要调),而**默认值与旧行为**在未显式配置时保持逐位一致。
- 编号对齐说明:`v0.1.2`–`v0.1.5` 四份发布原本被编成 0.2.0–0.5.0(同一天内连跳四次),
  已按上面的口径重新对齐 —— 那几条 tag 只存在了几个小时、没有任何使用者。

## 0.1.5 — 2026-09-19

**资源层被第一个真实使用场景磨了一遍。** 本作(第一款拿库定制的游戏)把自己的资源层接到库上时,
一上来照出两个缺口 —— 这一版都补了:

- **大数台账**:台账值走 `Numeric<T>`,但收支条目此前只收 `number` —— 于是"灵石"这种
  1e40 量级的资源根本加不进去。现在 `ResourceEntry<T>.amount` 收 `number | T`,
  `AppliedEntry<T>.applied` 与 `ResourceSummary<T>` 也随台账走;
- **整数资源**:`ResourceDef.integer` —— 材料 / 点数是整数(「灵草 ×2.5」没人看得懂),
  货币常常带小数;取整发生在夹取之后,口径由定义里那一个布尔值定;
- `gainSmall` 这类"只动一个键"的调用不再要求传全量台账(`Partial` 即可)。

顺带把口径写进文档:**收支条目用普通数字,台账用 T** —— 与 `victoryRewards[].amount`
等既有约定一致,大数实现者不必在每个调用点都构造一遍 T。

## 0.1.4 — 2026-09-19

**补上最后一块地基:资源账本(`resources`)。**

等级、属性、装备、副本、战斗、技能、炼制、伙伴、目标、内容池、离线时长账、存档 —— 这些库里都有,
唯独"灵石 / 信用点 / 零花钱"这一层没有,于是每个拿库的人都要在库外面重写钱包、上限、买得起买不起。这一版补上它。

- `createResourceSystem({ resources })`:`ResourceDef { key, name?, cap?, floor? }` ——
  键名与展示名分开,上下限逐个给;**上限还能随账本变化**(`capFn`:洞府升级 / buff 加成);
- `create(initial)` / `of` / `numberOf` / `normalize(raw)`:建账、读数,以及**形状修复** ——
  存档里坏了那一格按定义兜回来(缺的补 0、非数的当 0、越界夹回、未知键原样留着),不让整个档报废;
- `pay(ledger, costs, { partial? })`:默认**整笔要么全成、要么不动**,失败时返回缺口
  (`[{ key, short }]`);要"先付得起的部分"就显式开 `partial`;
- `grant` / `apply(ledger, entries)`:逐条落账,上下限在**落账时**夹取(而不是事后修补);
  坏条目被跳过并记进 `rejected`,不让一条脏数据炸掉整场结算;
- 每条收支都能带 `source`;`audit(entries)` 按资源与按来源各汇总一份(收入 / 支出 / 净额),
  明细恒等于合计 —— 这条由用例钉着;
- `produce(ledger, steps, perStep)`:按步产出,**逐步**夹上限,直接接 `idle` 的步数账
  (一次乘完再加是算不出"挂机中途到顶"的);
- 落账是纯函数:入参账本不被就地改;数值走 `Numeric<T>`,大数实现照旧可插。

**同一版里,战斗补了两个小口子**(写"组合技示例"时探出来的):
`shieldbreak` 事件(护盾被击破的那一刻,否则钩子只能去猜)、`gainShield` 收负数(扣盾,
表达"濒死治疗增幅但护盾消散一半"这类有得有失)。

**附赠一份探路示例** `examples/combo-arts.ts`:用库的钩子把三种真实战斗的机制
(破盾反震 / 满血会心追击 / 濒死治疗换护盾)各写一遍 —— **一行规则都没进库**,只用了
"破盾了 / 会心了 / 每回合结束"三个落点。它同时回答"库的接口够不够表达真实战斗"这个问题。

判据:新增 8 条资源用例(买不起不扣、上下限夹取、动态上限、逐步产出、审计恒等、形状修复、
纯函数与坏条目),战斗 21 → 23;示例进类型检查与两份自检。

## 0.1.3 — 2026-09-19

**给"内容驱动"的东西一套接口形状,但不实现它们的规则。**

- `BattleConfig.tickFn(ctx, rng)`:每回合结束叫一次。流血 / 中毒 / 灼烧、增益层数递减、冷却、
  首领的阶段阈值检查都有了落点;`ctx` 给的是同一套原语(出手 / 落账 / 加盾 / 治疗 / 定身 / 日志)
  加一个本场抽屉 `state`;
- `BattleConfig.onEvent(ctx, event, rng)`:引擎每记完一条事件交给你看一眼 ——
  会心即追加一记、破盾时触发法宝、挨打时回一口,都在这一个钩子里;
- **防递归**:钩子自己引发的出手与日志不会再触发 `onEvent`(否则"会心追加一记、那一记又会心"
  会指数膨胀)。判据里有一条专门盯着这件事。

**三样留在作品那一侧**(库只给形状,不给规则):**流派组合技**、**法宝自动触发**、**首领阶段** ——
它们绑内容,塞进库里等于把某个游戏的设计当成通用规则。README 给了三者的写法。

判据:战斗用例 18 → 21(回合钩子按层数累计掉血、事件反应不级联、不配钩子时结算与从前逐位一致)。

## 0.1.2 — 2026-09-19

**战斗从"够用的骨架"加厚一档** —— 护盾池、反击、追击、技能标签的通行解释,
全部**默认关闭**:不配,行为与 0.1.x 逐位一致。这四样是从一款在运营作品的战斗里抽出来的骨架
(护体灵光 / 顺势反击 / 追击 / 多段震慑…),与题材无关。

- `BattleConfig.shield`:护盾先于生命挨打、总量按 `capRatio`(默认 50%)夹取;
  开局盾读 `mods.shieldOnStart`,溢出治疗按 `mods.overhealShield` 转成护盾(键名可配);
- `BattleConfig.followups`:反击与追击各读一对词条(默认 `counterRate`/`counterDamage`、
  `comboRate`/`comboDamage`),概率触发一记打折出手(默认 0.5 / 0.6 倍),
  且这一记**不会**再引发反击与追击;
- `BattleConfig.skillEffects`:给 `multi / stun / drain / shield / bleed / pierce` 一套通行语义,
  段数、概率、比例都可配;**不配就一个标签都不解释**(连 `pierce` 也不算),继续交给 `skillEffectFn`;
- `SkillEffectContext` 新增 `shieldOf` / `gainShield` / `heal`;`strike` 支持倍率、自定义标签与穿甲;
  新增事件类型 `counter` / `combo` / `shield`;`BattleResult` 增加 `playerShield` / `enemyShield`。

## 0.1.1 — 2026-09-18

**许可改为 MIT**

- 从 CC BY-NC 4.0(禁止商用)改为 [MIT](https://opensource.org/licenses/MIT):可以自由使用、修改、
  分发,商用也可以,只需保留版权声明与许可文本。这是**放宽**,不是收紧 ——
  已经按旧协议拿到的副本仍按旧协议,从这一版起拿到的是 MIT;
- 版权人署名统一为 `Mystvio`(此前是作品名)。

**文档**

- 对外文字(README / docs / CHANGELOG / 许可)里不再出现"从某部作品抽出来"的出处,
  只保留"与一个在运营的放置游戏逐数字对账"这个事实;`presets/xiuxian` 的注释改为
  "一套现成的仙侠名目"。

## 0.1.0 — 2026-09-18

首个版本 —— 可配置的数值内核,零运行时依赖。
公开发布:`v0.1.0`(GitHub tag / release),`npm install wanxiang-engine` 尚未发布 —— 现在
可以按 tag 引用:`github:pplmx/wanxiang-engine#v0.1.0`。

**文档与示例**

- README 重做成正式项目的结构(徽章 / 目录 / 分层),长篇内容下沉到
  `docs/parity.md`(与源工程逐数字对账)与 `docs/development.md`(开发与集成);
  发布包改为一并附上 `CHANGELOG.md` 与 `docs/`。
- 新增 `examples/quickstart.ts` —— README「快速开始」那一节的可跑版本,并接进判据:
  示例参与类型检查,`bun run examples` 会被 `bun run check` 与"独立成库自检"各跑一遍。
  文档里贴的代码若有一天跑不通,这四条会先红,而不是等使用者抄过去才发现。

**四套系统**

- `realms` 等级/境界:世界分段、层数、修为与进阶曲线、寿元、基础属性
- `attributes` 属性:词条登记、递减(1/0.75/0.5/0.25)、软阈值、本值×平铺×百分比×另乘
- `equipment` 装备:槽位/品质/模板/词条/套装,生成、解析、装配汇总(含机制 hook)
- `dungeons` 副本:区域链、解锁、首领节奏(cycle/once)、读档补票不变量;`combat` 回合制解算

**通用层**

- `numeric` 数值适配层(默认 number,大数实现可插拔)与 `rng` 可复现随机
- `config` 装配与交叉校验(引用、重复、成环),`strict` 可把警告升级为错误
- `idle` 离线时长账(上限/效率/步数/余量)、`save` 存档封装与迁移链、`saveShape` 形状修复
- `skills` 技能/功法(等级曲线、消耗曲线、满级分支)
- `crafting` 炼制(成功率四乘区、越级惩罚、熟练度曲线)
- `goals` 目标条件(判定与进度视图)、`deck` 内容牌堆(区间/标签/一次性/权重)

**内容包**

- `presets/xiuxian` 仙侠(四界二十一境)、`presets/demo` 星港(科幻换皮)、
  `presets/daily` 书桌与日常(学习/日常题材,含学科、伙伴、做饭三份配套配置)

**通用性**

- **内容还没写全时不再随机炸掉**:装配时 `EQUIP_SLOT_EMPTY` / `EQUIP_TIER_SLOT_GAP` 只是警告,
  但"掷到一个一件模板都没有的槽位"以前会直接抛错(战斗中随机崩)。现在掷槽位时只在该层
  **真的有内容**的槽位里掷(该层没内容就按既有的退档规则拿低层的顶上);
  `opts.slot` 点名的槽位若为空,仍然大声报错并指名道姓
- `lifespan` 改为可选:日常/学习/经营这类没有生死的题材不必编一个寿元数(省略即无限)
- 技能的效果标记不再只是"带着走":`BattleConfig.skillEffectFn` 让作品自己解释
  `stun / drain / pierce / multi`(库不认识这些词);ctx 给的是引擎自己那条路上的原语
  (默认出手 `strike`、只算不落账 `damage`、落账 `applyDamage`、跳过下次出手 `skipNextTurn`、
  本场共用抽屉 `state`),返回 `true` 表示这次出手由调用方处理完。不配则与既有行为逐位一致;
  新增事件类型 `skip`(某方这一回合没出手)
- **补齐公开面**:`CombatKeys` / `DamageContext` / `SkillEffectContext` / `BattleEventKind`、
  `RealmExpConfig` / `RealmCombatConfig` / `RealmBreakthroughConfig`、`ProficiencyConfig`
  现在都能从公开入口取到 —— 以前它们只在内部模块里,使用者写钩子时标不上类型
- **日常学习内容包也能装了**:`package.json` 的 `exports` 补上 `./presets/daily`
  (此前只声明了 `./presets/xiuxian` 与 `./presets/demo`,那份"与战斗无关"的题材
  在仓库里跑得通、装到别人那儿却 import 不到)
- `crafting.levers` 改成**任意个数与名字**的乘区表(原来是写死的掌握/认知/技艺三区),
  每区可给自定义曲线;越级惩罚改为可选(不配就没有越级这回事)
- 几处"写死的曲线"开成钩子:`realms.exp.costFn`、`realms.combat.statsFn`、
  `skills.costs[].amount`、`dungeons.victoryRewards[].amount`、`dungeons.rewardFn`
  (后者是**整场奖励完全接管**:默认奖励先算好放进 `ctx.defaultRewards`,可以先看再决定;
  返回 `null` 即交回默认。数额收普通数字,引擎按数值层转成 `T`)
- **战斗的本值改为一张表 + 可配键名**:`Combatant.stats`、`EnemySnapshot.stats`
  (取代原先固定的 `hp/maxHp/attack/defense/speed` 字段),`BattleConfig.keys` 指定读哪几个键 ——
  本值叫"火力/装甲/结构值"或"专注力/耐心/精力"都行。战斗不再就地改动传入对象(内部拷一份)。
- 牌堆的标签语义可配:`DeckContext.match: 'any' | 'all'`(默认 any)与 `excludeTags`
- 又开三处:`realms.breakthrough.rateFn`(自己定进阶成功率)、
  `dungeons.enemyPower.scaleFn`(自己定敌人数值曲线)、
  `attributes.diminish`(递减算法本身:`ranked` 默认 / `max` / `sum` / 自定义 `fold`,
  且明细仍恒等于合计)
- 两处结构放宽:**逐境层数可不同**(`RealmEntry.layers`,新增 `layersOf` / `maxLayerOf`,
  `maxLayer` 语义改为"所有境界里最多的层数")与**区域多条前置**
  (`requireCleared: string | string[]` + `requireMode: 'all' | 'any'`;
  校验与成环检测同步跟上,补票也按同一语义)
- 再开五处:`SkillDef.modsFn(level)`、`EquipmentPowerConfig.levelBonusFn(level)`、
  `EquipmentConfig.affixCountFn` / `affixWeightFn`、`CompanionConfig.stack`、以及
  `drawMany` 的 `guarantee: { tag, min }`(保底)
- 目标条件可组合:`{ type: 'all' | 'any', of: [...] }`(可嵌套,进度给 `parts`);
  遭遇调度可接管:`DungeonConfig.encounterFn(ctx, rng)`(返回 null 即用默认节奏)
- 又开三处:`BattleConfig.damageFn`(伤害公式)、`SaveFormat.codec`(存档编解码)、
  `AffixDef.valueCurve`(词条取值曲线)

**已验证**

- 库内用例覆盖各系统;产物自检从 `dist` 导入并跑通"修炼→进阶→掉装→装配→副本→通关→离线→存档"
- 发布包内容(`npm pack --dry-run`)由脚本校验:只发 dist 与说明,不含源码目录
