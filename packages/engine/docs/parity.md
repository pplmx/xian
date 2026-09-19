# 逐数字对账

这份库不是"另写一套近似的东西"。它从一个在运营的放置游戏里抽出来,并保留了一份 **parity(对账)判据**:
用那个工程的真实数据装配同一套系统,然后逐条比(判据在源工程的 `src/core/engineParity.spec.ts`)。

## 比什么

- **等级**:21 个境界 × 10 层的名目、寿元、修为需求、基础三维、进阶成功率逐条相同;
- **属性**:200 组随机来源下,`mergeMods` 的合并结果(含递减与软阈值)逐键相同;
- **装备**:每层每部位的掉落池逐 id 相同、词条数值逐条相同、同一件装备的平铺与词条结算
  与 `resolveEquipStats` 逐项相同;
- **副本**:区域/敌人表逐条相同,解锁口径与 `unlockClosure` 在若干存档状态下一致。

换句话说:本作可以逐步把自己的实现换成这套库,而玩家看到的数字不变。

## 已经换过去的部分

| 源工程侧 | 现在由谁算 |
| --- | --- |
| `core/formulas.ts` 的 `expRequirement` / `baseCombatStats` / `breakthroughBaseRate` / `isWorldStepLayer` | 库(经 `core/engineWorld.ts`,用 GNum 适配器装配) |
| `core/statsCalc.ts` 的 `mergeMods` / `mergeModsDetailed` / `isSoftCapped` / `modDepth` | 库的属性系统(递减阶梯仍取自源工程的 `data/constants.DIMINISH_WEIGHTS`,以配置显式传入 —— 平衡口径只有一处) |
| `core/equipGen.ts` 的 `generateEquipment` / `qualityWeightAt` 与池子查询 | 库的装备系统(判据连**随机流状态**都比:同一种子下生成同一件之外,还要消耗同样多的随机数) |
| 首领门槛与节奏(`winsUntilBoss`)、读档补票不变量(`prereqClosure`) | 库的副本系统(在线、离线自动挑战与界面提示共用这一处) |

仍留在应用侧的是内容数据,以及那些**依赖本作大数战力表**的数值解析(如 `resolveEquipStats`
走 GNum,与库里的 number 投影差在双精度末位)。

## 怎么证明,而不是靠"我改了"

1. `engineParity.spec.ts` 里留着**迁移前冻结的旧公式**(`refExpRequirement` 等),与库的结果做
   `toEqual`(GNum 精确相等)—— 21 境 × 10 层逐个过;
2. 另有一节「迁移接线」直接断言 `formulas.expRequirement(major, sub)` 与
   `ENGINE_WORLD.realms.expCost(major, sub)` 是同一份结果,并再次与冻结口径对账;
3. 源工程的全量用例、`vue-tsc`、ESLint 与生产构建全绿 —— 玩家侧的数字一位没动。

至此四套系统(等级 / 属性 / 装备 / 副本)的**规则**都由库承担。

## 库这一侧的"数字不变"判据

上面那些对账跑在**源工程**里(`src/core/engineParity.spec.ts` 与那一批 `engine*Parity.spec.ts`,
源码不在本仓库 —— 见 <https://github.com/pplmx/xian>),单独把这个库拿走就看不见了。
所以库自己也留了一条**数字基线**([`src/baseline.spec.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/src/baseline.spec.ts)):把三份内容包与一批
"吃默认值"的配置算出来的数字压成摘要写死 —— 等级表逐格、属性合并、装备层 1~12 的
模板/品质/词条、敌人快照、默认首领节奏、一场完整对局、体检四档分界、离线默认效率。

它证明的不是"与源工程相同"(那在源工程那边证),而是**库自己的数字不会悄悄变**:
一次重构、一次"顺手调一下默认值",摘要就会变。有意改的时候要显式更新摘要并在 CHANGELOG
写清为什么 —— 顺手就是一次"这是不是对使用者有影响的改动"的自问。
