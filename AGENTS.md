<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at <https://viteplus.dev/guide/>.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

# 项目约定（玄枢录）

本仓库是「玄枢录」——文字修仙放置游戏。这份文件是往界面、数据、提交、发版里加东西时要遵守的本地约定；设计契约不重抄，数值与设计细则是 `docs/design.md`、`docs/development.md` 的权威（炼丹见 `docs/alchemy.md`）。

> 原先另有一份只差大小写的 `agents.md`，已合并进本文件：两份「约定」并存就是两本账；而且名字只差大小写的两个文件在 Windows / macOS 上根本没法同时检出，而 agent 读的通常是 `AGENTS.md` —— 那份「操作纪律」等于没人读。

## 界面：丹青双眼，别抄他作的「皮」

- `docs/design.md` 是配色唯一权威：强色只有朱砂（行动）与石青（信息）；文字不叠透明度；同色底最多 6%；纸上的墨只有三档。
- 借鉴另一个项目（yunyin-xiuxian）时，学它的**装配规则与交互**，不照搬它的**界面语言**。例：功法门类是对应槽位的规则，不是装饰标签；不引入实心彩色胶囊、也不加第三个强色当导航主色。分类/导航用「墨字 + 淡底 + 朱砂小印」。
- 移动端优先：按 390px 与 200% 缩放防折行，窄屏只留关键信息，详情进弹窗 / aria-label。

## 功法：主 / 辅 / 秘是装配规则

- `main`（主修，占唯一主修席）、`sub`（辅修，占辅修席）、`secret`（秘术，装配时也占**辅修席**）既是书目门类，也决定装配槽位。
- 同一部功法在书目与装配上可能叫法不同，文案要把席位说穿：秘术列表写「在辅修席」、弹窗按钮写「放入 / 移出辅修席」。
- 五行、品阶、悟道分支不是第四类分类：五行是灵根倾向提示，品阶只管栏内排序与名字染色，悟道是满级后的一次性选择（转世保留）。

## 改动纪律：不做两本账

- **界面上出现的每个数字都与结算同源**。奖励文案 = `grantReward`/`rewardTextAtTier` 同一套换算（灵石按掉落层级折实）；加成真值 = 引擎合并（buffMods / finalStats，人物页「丹药与增益」行同源）；进度 = 发赏判定（evalCond / 库的 goals）。文案里不许手写会被常数改动的数字 ——「改常数就撒谎」。
- **决策信息完整**：按钮「付不起 / 不可行」要置灰，灰的同时把差多少列出来（尚差 灵石 X · 尘 Y）；给决策前把数字摊开（奖励、代价、把握、生效时长、成功率），不能只给定性形容词（「皆有裨益」「更容易」不算数）。
- **让看不见的机制可见**：技艺进度、buff 叠加份数（「叠 N」）、合并真值（「现效合计」）、一次服药的上限（「至多可攒」/ 快捷卡「已顶」）、天时对渡劫与产出的影响 —— 该露的都要露进界面，不许只活在注释或 README 里。

## 文案与叙事契约

- 中文一律简体（避传统 順/帶/有边 等字；`kaiFontCoverage.spec` 机械守）。
- 丹药 / 增益的叙事：作用载体是服用者自身（概念契约见 `docs/alchemy.md`）。名为「稳炉 / 控火 / 淬炼」者先反问「这药吃进谁嘴里」—— 说不通就是叙事该改，不是机制该改。

## 提交

- 小改动攒批合并提交：单次增删合计 100 行以下的改动**不单开 commit**，同一主题/打磨轮的若干小改动攒进一次提交（body 每条 bullet 一项）；只有净变更明显超出百行的改动才单独一次提交。
- 先写用例（RED）→ 最小实现（GREEN）：新功能必带测试；纯逻辑进 `core` 并可直接测，视图只做薄接线。
- commitlint 走 conventional（类型：feat/fix/refactor/test/docs/chore/…）。
- commit message 用 bullet 一条条说明改了什么、为什么，不写一句话流水账。
- **提交前核对暂存区**：`git add` 之后、`git commit` 之前跑一次
  `git diff --cached --name-only`，逐行确认都在本次意图之内。工作区里他人/既有的
  未提交改动必须先 `git stash push -- <那几条路径>` 挪走，不要靠「我只 add 了自己的文件」
  这个假设。踩过一次：`AdventureView.vue` 的 58 行业务改动被带进一个 tests 提交，
  已推送无法改写，只能留一条名不副实的提交记录。

## 动手之前：先查判据档案

`docs/development.md` 里有 **149 条「第 N 轮」结论**与 392 条表格记录，其中相当一部分是
**「查过了，那不是缺陷」**。不先查就动手，会系统性地重复别人的工作 ——

```text
第 223 轮  查出前两轮「修」的冒烟脚本问题，文档第 145 行早有结论「这是设计选择」
第 231 轮  查出「中文半角逗号 2160 处」，文档第 6110 行早有结论「那不是缺陷」
第 232 轮  以为六个词条没去处，源码里就在「百艺」组
```

三次都是**同一个动作缺失**：动手前没搜。

故改任何东西之前，先搜两处:

```text
docs/development.md · docs/design.md     149 条「第 N 轮」结论 + 392 条表格记录
ls src/core/*.spec.ts 等                  422 个 core spec，文件名就是它们守的题目
```

第三处是 `docs/development.md` 的 `## 待办 · 下一步` —— 作者自己认为接下来该做什么。
但它**基本是空的**，而且读它不是为了找未完成项:

> **别把「文档里的未勾选项」当成未完成。** 一份计划里 6 个未勾选项，逐个核下来
> **全是已实现的验收标准**，只是没人回填勾选。**判「是否实现」只能读代码，不能看勾选框。**

它真正的用处是另一半:知道哪些已经被**判明「不该做」**（比如「人物页历世卡」——
注释里给了落点重复的三条理由），免得再提一次。

spec 文件名比文档更全 —— 文档只记「值得记的那一条」，而 spec 是**每一件被守的事**。
第 234 轮查「修为溢出会不会浪费」时，文档里只搜到灵气那条（第 233 轮）；
`ls src/core/*.spec.ts | grep banking` 才看见 `realmBanking.spec.ts` 早把修为与灵气
两样都判过了（六条）。

两处都搜不到，再动手。

## 什么时候**不加**判据

搜到「没有判据守」不等于「该补一条」。`core/dataIntegrity.spec` 的文件头写着一段判断:

> 属性键**拼错**这一类不在此处 —— 类型系统已经拦住了:往 `StatMods` 写
> `{ alchemyYieldX: 0.2 }` 时 vue-tsc 直接报「did not exist in type …
> Did you mean 'alchemyYield'?」(实测)。**故不要再加一份正则启发式，那只会漏且吵。**

补判据之前先问:这件事是不是已经有人管了?

```text
类型系统      键拼错、字段缺失、联合类型漏一支        → vue-tsc 已经在拦
真浏览器巡游  布局溢出、控件过小、点击无反应            → layout-check / ui-smoke 在拦
既有判据      搜两处文档 + spec 文件名            → 先搜，多数已有人守
```

三条都不管，才轮到你写。**加一条判据的成本不只是它本身，还有它以后每次都要维护、
每次误报都要有人去分辨。**

### 说「X 不存在」之前，先查它可能存在的那几种写法

这一批里，「查一个入口就断言整类」犯了**六次**:

```text
第 281 轮  grep codex.ts          → 而名号页 TitlesView 里就有
第 296 轮  grep CombatPanel       → 而历练页 AdventureView 里就有
第 298 轮  grep "ui/folioArrival" → 而判据里写的是 "./folioArrival"
更早       head -6 截断           → 而第 785 行就有
更早       只查 mods 一条路径      → 而另一条路径上有
第 435 轮  只搜 *.vue             → 报「15 个文案函数没人用」，
                                    而 clearRateText 被 core/compare.ts 用着
```

**六次里没有一次是产品的问题，全是搜索写窄了。** 而它们的共同后果是:
一个错误的「不存在」被写进文档，后来者会信它。

故在写「没有 / 不存在 / 零命中」之前，先把它可能存在的写法列出来:

```text
同一个模块   路径式 ui/xxx · 相对式 ./xxx · 别名 @/ui/xxx
同一个功能   组件 · 页面 · core · store · ui/ ── 五层都可能藏着
同一处字串   注释里的、被注释掉的、下一行的、拼接起来的
```

**不要用 `head`。** 数清楚再说话；`head -6` 截掉的第 785 行曾经让我差点写出一条
假缺陷。

**也不要只读文件头。** 第 323 轮我读了 `core/dataHeaderAudit.spec` 的文件头
（「各 data/*.ts 的头注释…」），就断言「手册里的数字没人守」—— 而那个文件的第三与第五条
瞄的正是 `docs/usage.md` 本身，而文件头那段简介没提这件事、变量名又叫 `readme`。

```text
文件头写的      这个文件「主要」在做什么
文件里写的      这个文件「全部」在做什么
```

**判「有没有人管这件事」，要 grep 那个文件里有没有你关心的那个目标的名字**，
而不是读它的简介。

> 判「有」是读完一处就够了；判「没有」要把所有可能的写法都过一遍。
> 两者的成本差一个数量级 —— 而「没有」这句话的杀伤力也大一个数量级。

### 已经挖空的那几条线索（不必重走）

第 200~320 轮把下列方向逐条查过。**每条都写了「查完的结论」**，再查一遍不会有新信息。

```text
设计文案无判据         三处盲点已补(resetDisclosure / adventurePreviewCaveat /
                       matchupCaveat)，第四处(trialForecast)早有六条 → 挖空
手写清单 vs 产品漂移    找到并修了两处(daoFruitOutlets 漏登记、fruitOutlets 的 hasHost
                       过时)，而仓里对此已有更彻底的解法($state 倒推)→ 见 samsaraAudit.spec
事件池越玩越薄         一次性事件只占 5.4%(8/148)，且那 8 条全是神兽发放 → 池子不变薄
奇缘链死链             21 个 stage 对应 21 个事件，comm 差集为空，且有运行时驱动
断缘机制               选项旁标「断此缘」，存档用负哨兵分「走完 / 走断」三态
战斗界面无胜算         是设计：普通历练无「打不打」决策点；历练页给的是「相性」不是「胜率」
灵兽性格无数值         错——名号页 petTraitText 报四个数，我第 281 轮查错了文件
存档膨胀               17 个落盘 store，两个会长数组都自带上限，配额不足有回滚
交互延迟               store 层零 watch（全走 computed），且有 ui-smoke / layout-check /
                       perf-profile 三道真浏览器门
事件效果完整性         12 种 EventEffect 全有 case；第 13 种会被 vue-tsc 两处 TS2366 拦住
文档↔代码互指          docs-check 查「文档点名的路径存在」、docRefExistence 查反向
区域是一次性内容        妖气复聚(regionRevival):已靖地界放置 72 小时旧主归来，13 条判据
                       守着。44 处区域按 72 小时节律循环，不是 1.5 小时就吃完
第 7 境耗时是尖峰        660 现实小时，比 m6(193h) 高 2.4 倍、比 m8(353h) 也高。
                       而 progressionSim.spec 第 62 行明写 `m8 < m7` 是断言，
                       注释「渡劫是飞升入口，不是普通凡尘境界」—— 有意设计
一世的时间分配          挂机 39.8% / 历练 60.2% / 闭关 9000 vs 9050(刻意近似平手)。
                       见 timeAllocation.spec，它同时回答"区域够不够""闭关值不值"
```

第 424~431 轮又查空了几条，一并记在这里：

```text
数据层的空容器         data/ 下唯一一个空常量是 classics 的 PLANNED_SCHOOLS，
                       它已在 deadExportAudit 里登记、注释写明「有意为空」。
                       灵脉的寒冥是 perPoint:{}，但走 insightDiscountOf 那条独立通道
                       （见 veinChannelCoverage.spec）—— 空不等于漏
灵兽 / 天赋的 mods     44 只灵兽、34 项天赋，无一条 mods 为空
称号与成就的来源       29 称号 ↔ 29 个成就发放，无一悬空；66 个成就的 19 个计数器
                       全有 track()
离线时的在途状态       秘境 / 远征 / 道侣 / 器魂 / 历练全在途，60h 离线后只有
                       age / bond / exp / 区域战绩 / 连胜变 —— 见 offlineScope.spec
四档历练的性价比       1.000 → 0.966 → 0.905 → 0.923（单调下降），而 exploreModes.spec
                       明写「凶险升得比奖励快，长挂不是白嫖」—— 是设计
操作频率上限           全仓只有顿悟有冷却；其余操作无频率限制，符合放置游戏
TODO / 未实现标记      全仓 0 处；只有 rebirthRoi.ts 一处「暂未计入」的说明
转世弹窗 722 字        是分层排版：先给影响最大的几笔，再「展开去留全账」
                       （见 ReincarnationDialog 的 hint 与 heritageOpen）
```

第 436~437 轮从**定义侧**反查了一遍数据层，结论也记在这里：

```text
数值常量没人用         data/ 里 223 个数字常量，全仓只有定义处 0 个
字段名从不上界面       data/ 的 interface 字段里，剔掉函数参数名之后只有一个真候选
                       （族类 name，第 436 轮已接上）—— 其余 `covers` 那类是有意的文档字段
枚举值有空洞吗         族类 29/29 用到、tier 32/32、Boss 原型 8/8、StatKey 45/45、
                       技能 effect 是**可选**字段（57 个普通攻击是正常，不是漏）
                       —— 且这些点早已有人守：beastFamilyBipartite / bossArchetypes /
                       statGroupCoverage 三份判据（第 437 轮核过，10 条全绿）
选项等价（选了等于没选）  129 个多选项事件，0 个的选项后果完全相同
```

> **「从定义侧反查」这条方法的边界**：它找得到「定义了但没人用」，
> 找不到「行为不对」。而前者在这一仓里已经很少了 —— 第 436 轮那一个（族类名）
> 是这套筛子跑了两轮才筛出来的唯一一个。**再往这个方向查，回报会很低。**
>
> 第 440 轮又验了一条同类的（见下），一并记在这里。

第 440 轮:历练「可打性」那一句读数的完整口径

```text
疑点    界面报「单场 96%」，而一趟 420 场、一败即终 —— 0.96^420 ≈ 0，
        玩家会不会以为能跑完？
结论    早就处理了。core/tripViability 的 surviveChance 就是 rate^battles 的连乘
        （第 170 行 `alive *= rate`），文案分三档：
          ≥50%  → 「单场 96% · 打满全程 78%」
          <50%  → 「单场 96% · 多半走不完 · 预计只赢 X/Y 场」
          必败   → 「单场必败 · 整趟会在第一场结束」
        打不过首领那一档还有单独一句（「攒到第 10 胜就断」）—— 那正是最容易被
        单场胜率骗过去的情形。12 条判据里第 77 行明写 `surviveChance ≈ p^40`。
四档耗时  105/210/420/840 场 = 30/60/120/240 分钟（每场 12s，与档位无关）
性价比    产出/风险 1.000 → 0.966 → 0.905 → 0.923（见 exploreModes 那条）
```

> 这一轮的教训与第 437 轮同形：**我先在心里构造了一个「看起来显然的缺陷」，
> 再去查 —— 而它早被处理过，且处理得比我想到的更细。**

第 442 轮:终局玩家的修为条会不会变成空转的进度条

```text
疑点    道祖圆满之后 expReq 仍是 1.1e20（有值），atMaxRealm 已为 true，
        突破永远不可用 —— 那个修为条会不会一直涨却永远涨不满？
结论    不会。CultivationView 有专门的 atMaxRealm 分支（第 85/91/117 行）：
          修为格 →「大道熔真」+「余修尽数入炉 · 约 X 得 1 道源」
          灵气格 →「已存满 · 满溢炼作道源」/「未存满 · 存满后溢出入炉」
        两处注释还写明为什么换措辞（「修炼 +15% 对满级玩家毫无意义」）。
        终局玩家看到的每个数都还有所指。
顺带    major=20 且 sub=NaN 时 atMaxRealm=false（NaN >= 9 恒假）—— 防御是对的
```

第 443 轮:突破卡那个 `nextTribulationPreview(true, …)` 是不是绕过了宿慧门槛

```text
疑点    BreakthroughCard 第 443 行 nextTribulationPreview(true, rollTribulation(...), ...)
        第一个参数是「是否已解锁天数可窥」，而这里**硬编码传了 true** ——
        看着像把「熟知天界」这一阶宿慧绕过了，所有人都能提前看劫型
实际    没有绕。真正的门在同文件第 436 行：
          if (!stageAt(totalInsight()).heavenInsight) return null;
        传 true 是「已经过门之后再传」—— 两个参数一个管「给不给」，一个管「怎么给」
顺带    同处还有到顶守卫 player.atMaxRealm → null（第 441 行），注释写明
        「此前没传，major+1 越界又被钳回末境，于是终局玩家看到下一个大关是某劫」
```

> 按那条纪律：先在源码里找「这件事的注释」，再找「它的判据」，最后才动手量。
> 这次我省了前两步，直接量了概率表 —— 量得对，但白量。
>
> 第 443 轮又是同一个动作缺失：**我看到 `true` 就断定门槛被绕过，
> 而没有先往上找二十行看那个函数外面有没有门。**
> 一个函数参数为常量，可能是「绕过」，也可能是「已经过门」。**差别在外面那几行。**
>
> 这一批的共同点:**每一条我都先当成缺口，查到一半发现早有裁决或本来就不是问题。**
> 第 424 轮寒冥灵脉那次最典型 —— `perPoint: {}` 看起来是确定的缺陷，
> 而它走的是另一条量纲完全不同的通道。**看到「空的 / 缺的 / 不显示的」，先查它是不是有第二条路。**
>
> 上面前三条是第 372~379 轮陆续撞到的 —— **每一条我都先当成缺口，查到一半发现早有裁决**。
> 而它们的裁决分别在 `core/regionRevival.ts` 的文件头、`progressionSim.spec` 第 62 行、
> 以及本文件的这一节里。**先在源码里找「这件事的注释」，再在 spec 里找「它的判据」，
> 最后才去量** —— 顺序反了就会像这三轮一样，量完才发现白量。

**外加一条已写进本文件的方法**（见上一节）:**说「X 不存在」之前，先查它可能存在的那几种写法。**

而两类**明确不该加判据**的，也在上一节末尾列过了（叙事文案的专有名词、不可测的不变式）。

#### 「叙述性数字」不是「结构数声明」—— 而判据分不出时态

`docs/` 里有两类数字写法，`docNumeralForms.spec` 只该管第一类:

```text
结构数声明    「三十顶名号」「四十只灵兽」「44 个区域」
              —— 说的是**此刻**，随时会被内容增删打脸。判据该管。
叙述性数字    「后补的两种之前，四种摊在四十只上，平均每种十只」
              —— 说的是**那一刻**，是一句历史陈述。判据若管，会误伤。
```

**那个 spec 只扫「N 顶 / N 只」这类带量词的结构数声明**，碰不到叙述性数字 ——
**那个边界划得对，不要为了「覆盖率」去扩大它。**

而写出这类文档时有个更省事的做法:**能不带数字就不带。**
第 352 轮把源码注释里八处过时的「三十顶」改成了「全部名号」—— 那句话要说的本是
「要先滚很长一段」，不是「有 30 个」。**去掉数字之后它变准了，将来数字再变也不用回来改。**

> 附带一个我重复踩了四次的坑:写「这八处数字过时了」时，我会把那八个数原样抄进文档，
> 于是当场被 `docNumeralForms` 抓住。**要讲一个过时的数，用「N 顶」这类占位说法，
> 不要写它本人。**

### 一个已被验空的形状：裸字符串键 + 静默兜底

第 134~158 轮补了五条判据，它们有同一个形状:

```text
一个「键」没有类型约束（裸 string，或 Record<string, …> 的键）
+ 一条查不到时的兜底（return false / ?? 0 / if (!x) return 中性值）
= 配错了不会报错，只会静默地少一件事
```

```text
轮次  判据                      守什么
134   counterWiring             声明了 CounterKey 但没人 track()
136   rewardRefIntegrity        奖励里发不存在的称号 / 丹药
142   heritageRefIntegrity      HeritageId = string，拼错的 id 让天赋永不生效
143   styleAffinityCoverage     新流派没补克制矩阵，评级静默变 3 星
158   regionDifficultyOrder     区域在列表里放错位置，难度曲线回头
```

**这一族已经查空**（DaoNoteBook / worldClears / SkillId / TRAIT_NAMES / ECO_LEVEL_NAMES
逐个核过，全被类型系统或既有判据覆盖）。再遇到这个形状时可以直接对照上表，
不必重走一遍。

而它旁边还有两个**明确不该加**的类别:

```text
叙事文案的专有名词   「自炼气一路走到混沌道祖」是写作，不是断言。绑到 REALMS[0].name
                     会让它变成机器拼装的模板 —— 而这一句的全部价值就在「有人写」

不可测的不变式       法宝「重排不动强度」要求比较同 tier 的不同品质，而数据里每个 tier
                     的品质是唯一的。构造假数据只能测「我以为的公式」，不是测产品
```

## 测试与事实源

- `vp check`（oxfmt / oxlint / ts / rumdl）+ `vp test` 必过才能提交。
- 界面结构决策由 `uiLayering.spec.ts` 钉住（判据=回归守卫，改 UI 后若该文件断言挂，是回归不是噪音）；配色/对比由 `src/ui/palette.spec.ts` 钉住。
- 文案、排序、数值一律引数据源/核心算法，不重造：词条文案用 `@/ui/statNames` 的 `modsText`，别自己另拼一份；栏内排序（品阶降序→准入境界→名）与界面同源。

## 发版

- 发版是显式动作：**提 `package.json` 的版本 → 打同名 tag → `git push origin main vX.Y.Z`**。构建 Electron / APK 并发布 Release 的流水线只在 tag 上触发，细节与判据见 `docs/development.md` 的「发版」。
- **Release 正文写在仓库里，不写在页面上**：`docs/release-notes/` 下与 tag 同名的文件就是那一版的正文（release job 优先取它，没有则退回自动生成的提交清单）。手改页面上的正文会被下一次流水线重跑冲掉。
- **只在 tag 流水线上跑的路径**（`android/`、`electron/`、`.github/workflows/build.yml`）改过之后，本地门全绿不等于发得出去 —— 用一次 tag 真跑通它。本仓**三次**发版都栽在「本地永远绿、只有 CI 才执行到」的代码上（Android 签名口令的 Groovy 遮蔽、Electron 的隐式发 Release、Windows 打包图标 48×48 不足 256）。第三次（v0.0.2）的教训最具体：`build.win.icon` 指着为省流量刻意缩成 16/32/48 的 favicon，而 electron-builder 要 ≥256 —— **一份配置同时承担两个用途**时，两边的约束会打架。修完补了判据（`releasePipeline.spec` 解析图标尺寸），并在本地真跑了一遍 `electron-builder --win` 才提交。
- 引擎与宿主是两条版本线：万象引擎的 tag 与 Release 属于 engine 仓，别在宿主仓给它打 tag。

## 跨仓吸收纪律（读参考仓时）

- **只读对比，不照抄**：产出带 `file:line` 证据的候选短名单，不做任何改动。
- **吸收三道关**，过了才吸收：
  ① 结构化适配 —— 与本仓架构、口径、已测不变式合不合；
  ② 契约冲突 —— 与 `pillValue.spec` 九条、`docs/alchemy.md`、既有单测冲不冲；
  ③ ROI 与迁移成本 —— 核心小改 / 纯 UI / 仅文案，成本是否配得上收益。
- 没过的记一句「为什么不」；真的更好、真的适合、迁移可控，才吸收。
