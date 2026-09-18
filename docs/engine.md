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

资源这一层是**库的第一个真实使用场景**:接上去的过程照出两个缺口(收支条目原本只收 `number`、
材料不会取整),库那边因此补了大数台账与 `integer` 定义 —— "我们自己就是第一个定制用户"这条,
在这里第一次真的兑现了。

## 怎么引用

本作自己也只是一个使用者 —— 源码里写的是包名(开发期由 Vite / TS 的解析配置指向 `packages/engine` 源码):

```ts
import { emptyProgress } from 'wanxiang-engine'
```

`bun run check:engine` 会守住这条:宿主源码里**只经公开入口引用**,内部别名、深层导入、
相对路径钻内部三类做法各有一条断言拦着(当前 25 处引用全部合规)。

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
