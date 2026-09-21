# 与万象引擎的关系

本作的等级(境界)、属性、装备、副本四套系统的**规则**不在本仓库里实现 ——
它们属于独立内核 [万象引擎 `wanxiang-engine`](https://github.com/pplmx/wanxiang-engine)
(本仓库的 `packages/engine` 是它的上游,用 `git subtree` 同步)。
应用侧留下的是内容数据,以及依赖本作 GNum 大数战力表的数值解析。

## 为什么可以换掉:逐数字对账

迁移不是"重写了一版差不多的",而是**同一个数字一位不变**。判据在
[`src/core/engineParity.spec.ts`](../src/core/engineParity.spec.ts):用本作的真实数据装配同一套系统,
与**迁移前冻结的旧公式**逐条比。

## 已迁移的部分

| 已迁移 | 走哪儿 | 判据 |
| --- | --- | --- |
| 等级曲线(修为需求 / 基础三维 / 进阶率 / 跨界加价) | `src/core/engineWorld.ts` + `core/formulas` 转发 | 迁移前冻结的旧公式做 `toEqual` 精确相等,21 境 × 10 层逐个过 |
| 词条合并(递减 × 软阈值) | `core/statsCalc` 转发到库的属性系统 | 200 组随机来源下与冻结旧口径逐键、逐来源明细相等 |
| 装备生成(掉落池 / 品质窗口 / 词条筛选) | `core/equipGen` 转发到库的装备系统 | 6 档层级 × 40 种子逐字段相等,且**随机流消耗一致**(否则后续掉落整体错位) |
| 副本规则(首领门槛与节奏 / 读档补票不变量) | `core/exploration` + `stores/adventure` 走库的副本系统 | 门槛逐胜场对冻结旧口径;补票不变量含"保留历史 id、幂等"两组断言 |
| 离线时长账(上限 / 效率 / 步数 / 余量) | `core/offline` 走库的闲置模块 `planIdle` | 五档洞府上限 × 0~200 小时逐点与冻结旧式子相同(含"是否被截"的 1 秒容差) |
| 存档形状修复与版本迁移链 | `utils/saveShape` 转出库的实现;`core/save` 的迁移链走库的 `runMigrations` | 老档迁移值搬过去 / 旧字段清掉 / 幂等由 `saveMigration.spec` 端到端钉着;库侧另有形状原语与链式迁移的独立用例 |
| 功法(等级曲线 / 升级消耗 / 满级分支) | `core/engineWorld` 的 `GONGFA_SYSTEM`;`stores/cultivation` 与 `core/gongfaService` 转发 | 63 部功法 × 每级 × 三档折扣逐键 / 逐项与冻结旧口径相等(含"悟道点打折、残页不打折") |
| 炼制(成功率四乘区 / 越级惩罚 / 熟练度曲线) | `core/craftability` 与 `data/crafting` 的纯式走库的 crafting | 四维网格(掌握 × 认知 × 技艺 × 越级)逐点精确相等;真实丹方的材料表与技艺权重逐条相等 |
| 任务 / 成就的达成判据与进度 | `core/progress.evalCond` 与 `core/questProgress` 走库的 goals | 全部真实条件(主线 / 每日 / 成就)× 若干状态与冻结旧判据逐个相同;品质型条件的"不与等级同路"也被钉住 |
| 灵兽性格与词条 | `core/engineWorld` 的 `COMPANION_SYSTEM`;`core/petPersonality` 与 `stores/player` 的灵兽加成转发 | 14 只灵兽的性格系数逐项、自身词条逐只与冻结旧表相同;无灵兽 / 未知 id 一律中性 |
| 资源收支与上下限(灵石 / 材料 / 灵气) | `stores/resources` 的动作转发到 `core/engineResources`(库的资源账本 + GNum 适配器) | `engineResourceParity.spec` 用**迁移前冻结的旧实现**当尺子:灵石收付逐位相等(1e40 不压成 double)、材料取整与不为负、灵气 QI_BANK_MULT 倍软顶,全网格比对 |
| 背包持有(容量 / 占位 / 装配联动) | `stores/inventory` 的背包部分转发到 `core/engineHolding`(库的持有层) | `engineHoldingParity.spec` 冻结旧实现逐位比:容量边界、满了收不进、删件顺带卸下全部槽位、替换同 uid、装配表 |
| 重铸(洗练词条 / 封存) | `core/reforge` 的重掷走库的 `equipment.rerollAffixes`(封存映射成 `keep`) | `engineReforgeParity.spec` 用旧循环当尺子:五组种子 × 四类装备,词条与掷点逐条相同,**随机源消耗数也相同**(否则整局之后的序列会错位) |
| 智能收纳(自动去留裁决与读数) | `core/smartKeep` 的规则链与挤位次序走库的 `createTriage` / `compareBy`(判据与文案仍是本作内容) | `engineTriageParity.spec` 冻结旧 if 链:十件样件 × 六套开关,`keep` 与**理由文案**逐字相同;读数(按理由分组)与挤位次序也逐项对得上 |
| 天时(每日确定性环境) | `core/weather` 的周期序号、种子派生与池子切换走库的 `createCycleSystem`(本作自己的种子公式与"清和 30%"抽取规则通过 `seedOf` / `pick` 原样保留) | `engineCycleParity.spec` 冻结旧实现逐日比:人间界 60 天、各界 × 每个境界各 12 天,天时 id 逐日相同;换界域换池子;另测库多出来的"还有多久换"与"明日天时"(界面已用) |
| 事件结算(掷后果 / 效果解释 / 超时兜底) | `core/eventEngine` 的 `resolveEventChoice` 与 `autoResolveEvent` 走库的 `createChoiceSystem`(效果的语义仍由本作的 `applyEffect` 解释) | `engineChoiceParity.spec` 冻结旧实现:前 40 个事件的每个选项 × 20 颗种子,**掷中的后果与之后消耗的随机数**都逐次相同;三级兜底在两种玩家状态下与旧实现一致 |
| 敌人认知与装备见闻(图鉴) | `stores/lore` 的升档判定与"各取其高"走库的 `createCodex`(档位表与门槛仍住在本作 `core/loreThresholds`) | `engineCodexParity.spec` 冻结旧实现:普通怪与首领各 60 次交手的累计与档位逐次相同(含"一次只进一层")、装备见闻的品质 / 层级 / 用过三格逐个相同 |
| 区域兴衰与妖气复聚(世界记忆) | `core/worldMemory` 的档位判定与"钟"走库的 `createStageMemory`(档位表与门槛搬进 `core/engineMemory`,系数写在同一张表里) | `engineMemoryParity.spec` 冻结旧实现:胜场 × 守时 × 闲置时长 × 是否镇压过的全网格逐点相同;复聚的钟与倒计时、"从没打过交道不算够钟"也逐点一致 |
| 经济体检读数(瓶颈 / 过剩 / 闲置) | `core/economySim` 的比值与判词走库的 `createEconomyReadings`(判词名仍是本作的中文口径) | `engineEconomyParity.spec` 冻结旧实现:21 个时代 × 每条资源流的比值与判词逐条相同;边界(出为 0、进为 0、恰好压在 0.7 / 3 / 10)逐点一致;"没把握就写 note"的约定还在 |
| 装备入账漏斗(收 / 拒 / 腾位 / 折算) | `core/loot.acquireEquipment` 的四条去路走库的 `createIntake`(见闻、裁决、腾位与折算仍由本作给函数) | `engineIntakeParity.spec` 冻结旧口径:四条文案与去向(自动回收 / 行囊已满 / 收纳腾位 / 顺利入包)一一对应,含"见闻在裁决之前"与 `forceKeep` 跳过裁决;`loot.spec` 33 例照旧全绿 |
| 战斗奖励结算(本次所得与账本同源) | `core/loot.afterWin` 的灵石落账与回执走库的 `createSettlement`(数值与概率仍是本作口径) | `engineSettlementParity.spec` 冻结算法与随机值:回执 = 冻结公式算出的那一笔;无别的进项时,**账本增量恰好等于回执**(首领档因保底装备带出成就奖励,只比公式) |
| 战斗掉落表(这几件东西给不给、给几份) | `core/loot.afterWin` 的五类掉落判定走库的 `createDropTable`(基础概率、装备 90% 上限、首领保底与"翻倍=多抽一次装备"都是本作口径) | `engineDropsParity.spec` 冻结整段旧判定:四档战斗 × 两颗种子下,**随机调用逐条相同**(方法 + 参数 + 先后)、战报文案与拾获件数逐条相同;另钉"叠过 1 钳到 1、装备封 0.9"、"保底不改掷骰次数"、"残页翻份数 / 装备多抽一次"三组数字 |
| 状态(增益 / 减益)的施加、剪过期、清负面与**读取** | `core/engineBuffs` 转发到库的 `createBuffSystem`(内容仍是 `data/buffs`,`{defId}` ↔ 库 `{id}` 与秒/毫秒的换算只在这一层);读取走库的 `active`(到期即散,与剪枝共用同一判据),时钟由心跳推进(store 的 `buffClock`) | `engineBuffsParity.spec` 冻结迁移前的 `addBuff` / `pruneBuffs` / `clearNegativeBuffs` / 效果来源:五组状态 × 五种 id 下 `endsAt` **逐毫秒**相同,连加三次的累计一致,剪枝边界与"有没有变化"的返回值一致;写入 ISS-231 的**有意修正** —— 已过期但还没被心跳剪掉的那一条不再算进属性(旧写法多算一秒) |
| 洞府建筑(能不能升 / 上限 / 费用 / 每小时产出) | `core/engineFacilities` 转发到库的 `createFacilitySystem` 与 `accrue`(内容仍是 `data/buildings`,门槛文案与顺序、费用曲线、产出速率都是本作口径) | `engineFacilitiesParity.spec` 冻结迁移前的两块实现:七座建筑 × 五组等级 × 四档境界下**门槛文案、下一级与费用逐位相同**(灵石用 `formatExact` 比大数);产出侧五组等级 × 七档时长 + 连推 600 拍,累加器与发出去的整数**逐位相同** |
| 灵脉投资点(投点 / 上限 / 换主脉) | `core/engineVeins` 转发到库的 `createPointPool`(内容仍是 `data/veins`;总容量 100、主脉 70、副脉 30 与三句提示语都是本作口径) | `engineVeinParity.spec` 冻结迁移前的服务实现:五条动作脚本下**每一步的成败、点数、主脉与灵石余额逐位相同**,提示语的文案与顺序也逐条相同;另写明一处**有意修正** —— "点了却没灵石"时主脉不再被悄悄认下(旧写法会) |
| 每日任务(今日增量结算与换期) | `core/engineDailies` 转发到库的 `createTaskBoard`(内容仍是 `data/quests` 的 `DAILY_TASKS`,文案与报酬都是本作口径) | `engineDailyParity.spec` 冻结迁移前的逐条判定与换期:七组每日账 × 计数下**结算出哪几条、按什么顺序、结算后的 `done` 列表**全同,首页读数同源;另钉两条口径(计数器不清零、换期幂等)与一处**有意修正**(增量夹到 ≥ 0:回档那天不再显示负进度) |
| 本世计(开世基准与本世增量) | `core/samsaraService` 的 `countersDelta` / 分支数 / 雪耻数改走库的 `deltaSince` / `deltaOf`,`beginLife` 的基准改用 `snapshotOf`(与每日任务同一份原语) | `engineLifeParity.spec` 冻结迁移前的开世与本世增量:基准逐键、倒挂与缺键逐点相同,命题读数同源;并收掉 ISS-234 —— **立誓一世一次**(已经立过就不再重打基准,转世流程先撤旧题再立新题),旧写法重进来一次会把这一世已攒的进度抹掉 |
| 主线任务链(一次结算连推几节) | `core/engineChain` 转发到库的 `createChain`(内容仍是 `data/quests` 的 `MAIN_QUESTS`,判据仍是 `progress.evalCond`,守卫仍是 5 节) | `engineChainParity.spec` 冻结迁移前的 `while (guard < 5)` 循环:五组玩家状态下推进后的下标与走过节数逐点相同;另钉"一口气满足十几节时被守卫截在 5 节,且回报 `capped`"(迁移前只是悄悄停下,内容写歪没人知道),并走一遍真路径验奖励与提示文案顺序 |
| 认知检定里的照面保底(软保底) | `core/loreService` 的 `discernChance` / `natureChance` 改走库的 `softChance`(基础概率、每步涨幅与上下限仍是本作口径) | `enginePityParity.spec` 冻结迁移前的两条公式:三档阶位 × 三档技艺 × 六档照面次数(药性另有门槛前后五档)下概率**逐点相同**;另钉"涨幅封顶"与"概率夹在 4%~90% / 2%~75%"两条 —— 不封顶的话后期概率会被抬到 1,"越看越眼熟"就成了"第 N 次必认出" |
| 成就解锁(62 枚,含品质型 / 状态型 / 境界型) | `core/engineUnlocks` 转发到库的 `createUnlockRegistry`(内容与判据仍是 `data/achievements` + `progress.evalCond`,去重从 store 的一行 `includes` 收进库) | `engineUnlockParity.spec` 冻结迁移前的扫描与显式解锁:四组玩家状态下**新解锁的条目与顺序**、成就表、提示语与顺序全同;另钉"重复扫描不重复发奖""状态型成就每拍来敲门也只发一次""认不出的 id 不当成解锁"三条 |
| 炼丹执行(开炉 / 扣料 / 成败 / 双成) | `core/engineCraft` 转发到库的 `createRecipeRunner`(成功率仍由 `core/craftability` 算,花费与保料仍是本作口径,双成上限 0.8 写进配置) | `engineCraftParity.spec` 冻结迁移前的 `craftPill`:成功 / 双成 / 失败 / 不知此方 / 材料不足五格下,**回报、扣掉的灵草与灵石、背包、计数器、技艺经验与配方熟练度、提示语、掷骰数**全同;另钉"没开炉不扣料不掷骰"与"失败保草不保石"两条 |
| 曲线体检(相邻格跳变 / 换界那几格 / 面板与需求谁更陡) | `engineProgressionAudit.spec` 用库的 `createProgressionAudit` 跑本作那张**真表**(21 境 × 10 层,大数走 GNum 适配器) | 与数据表、常数表逐项对账:格数 = `REALMS.length × 10`;换界三格落在 `WORLDS` 的 `start`(9 / 14 / 18)且面板必涨;层内普通步 ×1.32(`EXP_SUB_GROWTH`)、界末圆满 ×2.64(= ×`WORLD_STEP_EXP_MULT`,与"把圆满抬成一道墙"的设计对上)、跨大境界最大 ×1.56;换界那三格需求**回落**(×0.78 / ×0.19)— 这条是记录在案的已知形状,改曲线就要重新面对 |
| 随机源(种子 → 同一串数) | `utils/random` 的 `mulberry32` 改成**库实现的同名转发**(`RandomService` 照旧包在它上面,注入式构造一行没改) | `engineParity.spec` 的「随机源同序列」一节:7 颗种子 × 每颗 40 个数逐个相同,`int/float/chance/pick/weighted` 也同源且**消耗位置一致**;字符串种子经 `seedFromString` 后同样相同。这条判据守的是"两边可以交换种子对账"那句话 —— 以前本作自己抄了一份 PRNG,两份拷贝一旦分叉,所有"同种子重演"都会静默错位 |

资源这一层是**库的第一个真实使用场景**:接上去的过程照出两个缺口(收支条目原本只收 `number`、
材料不会取整),库那边因此补了大数台账与 `integer` 定义 —— "我们自己就是第一个定制用户"这条,
在这里第一次真的兑现了。

## 怎么引用

本作自己也只是一个使用者 —— 库是**一份普通依赖**,写法与别人装了包再用完全一样:

```ts
import { emptyProgress } from 'wanxiang-engine'
```

接线只有三件事(都在仓库里,不靠"记得"):

| 这一层 | 是什么 |
| --- | --- |
| `package.json` | `"workspaces": ["packages/*"]` + `"wanxiang-engine": "workspace:*"` —— 依赖是真的,`bun install` 建软链,工具链与 node 侧脚本都看得见它 |
| `vite.config.ts` / `tsconfig.app.json` | 把包名指到 `packages/engine/src` 的**开发加速通路**:改库立刻热更新,不必先 build;去掉它也能用(那时解析 `dist`) |
| `scripts/engine-dist.mjs` | 三条判据守着:**只经公开入口引用**(内部别名 / 深层导入 / 相对路径钻内部各一条断言)、**依赖声明存在且指回仓库内的库**、以及**由 node 解析裸包名与子路径**(vite/tsc 自己的别名绿了不算数) |

当前状态:65 处引用全部走公开入口;node 侧解析出 79 个导出 + 子路径 `presets/minimal`。

## 同步与自检

```bash
# 选一处开发,别两边同时改 —— 两边都改会让 subtree 拒绝推送
git subtree push --prefix=packages/engine engine main   # 本作 → 库
git subtree pull --prefix=packages/engine engine main   # 库 → 本作
```

| 命令 | 钉住的事 |
| --- | --- |
| `bun run check:engine` | 产物入口齐全、能被 Node import、换皮世界跑通一圈、坏配置被拦住、发布包内容与"真装一遍"、宿主引用方式 |
| `bun run check:engine:standalone` | 整份目录复制到临时目录(不带 dist 与 node_modules)后独立编译、跑用例、import 产物、跑示例,并断言源码里没有任何宿主引用 |

库自身的说明、定制清单与已知边界见 [`packages/engine/README.md`](../packages/engine/README.md)。
