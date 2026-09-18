# 变更记录

本文件按"对使用者有影响"的口径记录:接口新增/变更/移除、默认行为变化、判据口径变化。
内部重构(不改接口与数值)不占条目。

## 0.1.0

首个版本 —— 从《云隐修仙录》抽出的可配置数值内核,零运行时依赖。

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

- `lifespan` 改为可选:日常/学习/经营这类没有生死的题材不必编一个寿元数(省略即无限)
- 技能的效果标记不再只是"带着走":`BattleConfig.skillEffectFn` 让作品自己解释
  `stun / drain / pierce / multi`(库不认识这些词);ctx 给的是引擎自己那条路上的原语
  (默认出手 `strike`、只算不落账 `damage`、落账 `applyDamage`、跳过下次出手 `skipNextTurn`、
  本场共用抽屉 `state`),返回 `true` 表示这次出手由调用方处理完。不配则与既有行为逐位一致;
  新增事件类型 `skip`(某方这一回合没出手)
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
