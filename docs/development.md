# 开发

## 环境

[Bun](https://bun.sh) 1.4.3(与 `package.json` 的 `packageManager` 一致,CI 与 Docker 都按它装;过低会被 `scripts/env-check.mjs` 拦下)。
TypeScript、Vite、Vitest 等都在 `package.json` 里,`vp install` 一次就够。

> `vue-tsc` 钉在 3.3.11:3.3.12 的模板类型检查有回归(把普通 `Record` 常量当 ref,
> 对 `ELEMENTS[e].name` / `STORE_NAMES[id]` 误报 `.value` 与索引类型错误)。
> 待上游修复后再放开。

```bash
vp install
vp dev            # 开发服务器(vite --host)
vp build          # 类型检查 + 生产构建
vp preview        # 预览构建结果
```

### 运行时策略

这个仓库同时有 Bun、Node 两组环境变量,各自管一段,别混淆:

| 角色 | 谁来当 | 承担的事 |
| --- | --- | --- |
| 包管理器 + 脚本执行器 | **Bun** 1.4.3 | 装依赖、锁文件(`bun.lock`)、跑 `package.json` 脚本;`packageManager: bun@1.4.3` 明确的正是这一层 |
| 工具链兼容基准 | **Node** ≥ 24 | `engines.node` 表达的是"跑 Vue / Vite / vue-tsc / Oxlint 这条工具链至少要 Node 24",**不是**「应用跑在 Node 上」(CI 的 `setup-vp` 就装 Node 24) |
| 生产运行时 | **浏览器** | Web / PWA 的最终宿主 |
| 平台运行时 | **Electron / Capacitor** | 把同一份 Web 产物包进 Windows 桌面与 Android 的壳 |

`engines.node >= 24` 与 `packageManager: bun@1.4.3` 并存**不矛盾**:一个约束
「工具链要跑在 ≥24 的 Node 上」,一个约束「安装与脚本托管交给 Bun」,管的是两层。
只要包管理走 Bun、工具链跑在 ≥24 的 Node 上即可。

> **`prepare: vp config --no-agent` 为什么每次 install 都跑**:它在 clone 后把仓库里
> **已跟踪**的钩子(`.vite-hooks/pre-commit`、`.vite-hooks/commit-msg`)
> 注册进 git —— 设 `core.hooksPath` 并生成 `.vite-hooks/_` 分派器。pre-commit 跑
> `vp staged` 和 `bun run type-check`,commit-msg 跑 commitlint,是本仓库自己的提交流水闸;
> 少了它,clone 后这些门会悄悄失效。每次 install 重跑只是幂等的本地注册,代价是毫秒级,
> 换来"钩子永远在"——所以**保留在 lifecycle 里**,不要为了让 install 少一步而拆掉。
> (这些钩子只影响本地提交,CI 用 `vp install` 另跑 `check`+`test`,不依赖它。)

### 用 bun 还是用 vp

**默认用 `vp`**。它统一接管 dev / build / test / lint / fmt / check:
`bun dev`、`bun preview`、`bun run test` 这些只是薄封装,最终都落到 `vp`;
直接用 `vp …` 少一层跳转、行为一致。具体分工:

| 层 | 入口 | 说明 |
| --- | --- | --- |
| 工具链入口(推荐) | `vp …` | `vp dev` / `vp build` / `vp test` / `vp lint` / `vp fmt` / `vp check` / `vp run verify`,全部经 Vite+ |
| 脚本托管 | `bun run <script>` | 跑 `package.json` 里的自定义脚本(`shots`、`test:report`、`check:engine` 等非标准步骤);`bun dev` / `bun preview` / `bun run test` 是薄封装,vp 优先 |
| 别用 | `bun test`、`bunx` 等 | `bun test` 不读本仓库路径别名,整片报找不到模块;统一交给 `vp test` |

> 想要一整套常用命令时,直接用 `vp`;只有跑仓库自定义脚本(不在 vp 命令表里的)才退到
> `bun run`。个别脚本内部仍会 `exec vp`(如 `build` = `vue-tsc -b && vp build`),那是最小薄封装,不是双入口。

**机器上的 `vp` 必须与仓库钉的那一版同版。** 仓库在 `package.json` 的 `catalog` 里把
`vite-plus`(CLI)与 `vite`(它内嵌的 core)一起钉在同一个版本,两条**必须同版** ——
只升一条,`vp build` 会当场拒绝:

```text
error: Failed to resolve vite command: GenericFailure, Expected
@voidzero-dev/vite-plus-core@1.4.0, but found ...@1.3.0
```

而机器上那份 `vp`(mise / 全局安装)与 catalog 不同版时,报的是同一条错 —— 真实处境
是「机器比仓库新」,而错误信息里的 `vp migrate` 是**升级仓库工具链**的动作,照做会把
整条链搬走。`bun run check` 开头的 `scripts/env-check.mjs` 会把两边版本都打出来提醒;
`src/core/gateWiring.spec.ts` 守着 catalog 自己那两条别写歪。修法二选一:用仓库自己那份
(`./node_modules/.bin/vp …`,与 CI 完全一致),或把机器上的 vp 降到 catalog 那一版。

## 命令一览

| 命令 | 作用 |
| --- | --- |
| `bun run test` | 全量用例(全量 414 个 spec;本作自己那部分 334 个) |
| `bun run test:report` | 一次完整测试 + 按系统分类的摘要 + 文档例数核对:未登记分类、文档里的例数与本次运行不符都会直接红并列出(CI 与发布闸用它替代 `test`,少跑一遍测试) |
| `bun run check` | 环境自检(`scripts/env-check.mjs`)+ 类型检查(`vue-tsc -b`)+ Oxlint(`vp lint`,类型感知 + 模板级规则由 vite.config 的 lint 块配置)+ 文档自检(`scripts/docs-check.mjs`) |
| `bun run lint` | 只跑 Oxlint(经 Vite+ 的 `vp lint`) |
| `bun run check:first-paint` | 首屏预算:冷启动解码字节 / FCP / 楷体换上(`scripts/first-paint.mjs`) |
| `bun run check:ui` | 六个浏览器门的本地入口:构建时长 → 首屏 → 帧率 → 排版 → 冒烟 → 离线(先 `bunx playwright install chromium`;一轮约五分钟,故**不进** verify / pre-commit,只在发版前与改界面后跑) |
| `bun run shots` | 从当前构建重拍 README / 文档的界面图(默认写 `images/app/*.webp`;`--theme dark` / `--device desktop` / `--out <目录>` 可选) |
| `bun run build:favicon` | 重出 `public/favicon.ico`:从 `public/icons/icon-512.png`(与安装图标同一枚)缩出 16/32/48 三档,装成一枚(判据见 `src/ui/favicon.spec.ts`) |
| `bun run test:engine` | 只跑公共库(万象引擎)的用例 |
| `bun run build:engine` | 出公共库的 dist |
| `bun run check:engine` | 库的产物自检:编译 → 从 dist import → 跑完整一圈 → 发布包真装一遍 → 宿主引用方式 → 独立仓与本仓同树 |
| `bun run check:engine:standalone` | 库的独立成库自检:复制到临时目录后独立编译 / 跑用例 / 跑示例 |
| `vp run verify` | 一键整链:确认 → 全量测试 → 例数对账 → 生产构建 → 引擎同树 → 独立仓模拟(cache:false 每次都真跑;提交/推送前跑它,最不会漏的就是后两项) |
| `vp check` | Vite+ 内置:全仓格式 + lint + 类型一次过(不是 `bun run check` 脚本) |

> **别用 `bun test`。** 那是 Bun 自带的测试器,不读本仓库的路径别名(`@/…`),
> 会整片报"找不到模块"。要用 `bun run test`(即 Vitest)。

## 测试与判据

这个仓库的取向是:**能用机械判据回答的,不靠自觉。**

| 判据 | 钉住的事 |
| --- | --- |
| 用例 | 全量 414 个 spec(本作自己那部分 334 个),按 9 个系统分类归档 —— 新 spec 没登记分类,`test:report` 会红。文档只记 spec **文件数**(静态可数,由 `docs-check` 核对);**用例条数不写进文档** —— 它每次都随加删用例变,记在文档里只会逼人频繁改、且改漏就打红,而它的真实数 `test:report` 每次都会自己打出来 |
| 门禁接线 | CI 里跑的每个 `bun scripts/*.mjs` 都必须在 package.json 或 verify 里有对等入口(反之 verify 点名的脚本必须真存在),由 `src/core/gateWiring.spec.ts` 守着 —— 「本地静态门过了,CI 静态门就过」这句话从此不是注释 |
| 数值对账 | 四套系统迁移到万象引擎时,与**迁移前冻结的旧口径**逐位相等(见 [engine.md](./engine.md)) |
| 数据自审 | 内容表的头注释计数与真实数组长度比对、敌人 / 区域 / 模板引用闭合、文本与词表覆盖 |
| 排版与冒烟 | 全量路由 × 五档视口的渲染审计(`scripts/layout-check.mjs`)、界面冒烟(`ui-smoke.mjs`,逐页点按钮 + 四条专场景:旧档迁移、存储写满、挂机稳定、导入存档,外加「找到控件却一个都没点成」这条下限)、Service Worker 离线层(`offline-check.mjs`)。前两者**并发**跑(每个视口与每件事各是一个独立任务,`--jobs` 或 `LAYOUT_JOBS` / `UI_SMOKE_JOBS` 调路数,默认按核数、上限 8)—— 一轮从约 17 分钟压到约 5 分钟 |
| 首屏预算 | 冷启动解码字节 / FCP / 楷体换上三条上限(`scripts/first-paint.mjs`,自带静态服务与 4G 限速) |
| 文档与实现一致 | `scripts/docs-check.mjs`(已并入 `bun run check`):文档里引用的 `bun run` 脚本必须真存在、反引号路径与相对链接必须存在、「全量 N 个 spec」必须等于真实文件数 —— 实测抓到过一次 25% 的漂移(文档写着 199 个 spec 时,实际已是 294) |
| 门禁自检 | 门本身也要被查:九道门失败时必须非零退出、冒烟与排版门的具名场景被删时必须红(`src/core/gateWiring.spec.ts`);排版门的五档视口与 200% 缩放档不许缩水(`layoutMeasure.spec.ts`);盘上的 spec 一条用例都没跑、或压根没被跑到,都算失败(`test:report`);只在 tag 上跑的路径(发版流水线、Android 签名、Release 正文)有静态判据(`releasePipeline.spec.ts`),发版体检 `bun run release:check` 的命令与接线也有判据 —— 「门在跑」不等于「有保护」:失败时不出声的门,只是把绿勾借给了没人看着的东西 |
| 平衡审计 | 经济闭环、战力膨胀、修为收入、曲线节奏各有模拟器与阈值断言(`*Sim.spec` / `*Audit.spec`) |
| 库的发布面 | 万象引擎另有三条:产物能被 Node import、发布包真装一遍并按包名 import、独立成库后仍能编译跑用例 |

## 首屏与构建时长

首屏传多少字节、第几毫秒看得见字、构建跑多快,各有上限。

### 构建

生产构建就是 `bun run build`(类型检查 + `vp build`)。曾经为了 Chrome 51 / Android 7
那批老内核,发布路径还要多跑一遍 legacy 兜底(本机 32s 的构建里 26s 花在这一步)——
对个人项目纯属死重,已整条拆除:没有 `build:release`,也没有 `XIAN_LEGACY` 开关。

构建器对超过 500KB 的 JS 块只发警告、不会失败,警告看久了就等同于不存在。现在
`crypto-js` 单独成 `vendor-crypto` 块(约 18KB),`player` 从 504KB 降到 486KB,
首屏总字节只多约 1KB;加密库是最稳定的一层,内容更新时还能继续命中浏览器缓存。
`layout-check` 会把任一块 JS 超过 500,000 字节、或 `vendor-crypto` 丢失判红。

### 首屏预算(实测:4G 档、390×844、冷缓存)

| 读数 | 改前 | 现在 | 上限 |
| --- | --- | --- | --- |
| 冷启动解码字节 | 2681KB(楷体 1783KB) | 1244KB(楷体 236KB) | 1500KB |
| FCP | 692ms | 1108ms | 1400ms |
| 楷体换上(swap 那一刻) | 2255ms | 2490ms | 3400ms |
| 楷体子集总字节 | — | 236KB(5 片) | 600KB |
| 最大 JS 单块 | — | 486KB(`player`) | 500KB |
| 构建时长 | 32s | 20s | 90s |

> 2026-10-06 重校准:楷体换上上限 2800 → 3400 —— 旧值按"本机无 preload 2159ms"
> 定的,而 CI 量的是随代码量增长的排版,迁移前后稳定落在
> ~2942-2952ms(9c739b9 迁移前就 2942),预算比实测还低,Pages 连红数推。
> 反「整份 1.8MB 打进来」的量级守卫改由**楷体子集字节断言(≤600KB)**确定性承担,
> 与机器快慢无关;时序这条只守"字体加载奇慢"。

两处改动:

1. **楷体按需分片**。原先一份 1.8MB 的子集在冷启动时整份下载,而首屏真正用到的字不过
   一两百个。现在按**用法频次**切成二十来片(每片一段 `unicode-range`,声明由
   `scripts/fonts/build-kai-font.py` 生成到 `src/assets/fonts/kai-subset.css`),
   浏览器只取「页面上真出现的字」所落的那几片:首屏 5 片 / 236KB;而「玩家起了个生僻名」
   这种时候也只多拽一小片,不是一千多 KB 的储备整段。片多大是取舍(片越小越省字节、
   请求越多),取 180 字/片是实测的口径。
2. **不打 preload**。同一份产物只改 `index.html` 里那一条链接、各量 3 遍取中位:
   不打 → FCP 1020ms · 楷体换上 2159ms;打 → FCP 1120ms · 楷体换上 2223ms。
   提前拽第一片(31KB)没让楷体更早到(后面几片该来还得来),反而把首帧推后约 100ms ——
   抢的是首屏 JS 的带宽。故只留 `font-display: swap`;`bun scripts/first-paint.mjs --variant preload`
   可随时复量这个 A/B。

三条首屏读数接在两条流水线的浏览器自检段(`bun scripts/first-paint.mjs`);构建时长接在
**构建那一步本身**(`bun scripts/build-timed.mjs`,把构建跑一遍并计时,超上限即红 ——
只拦「成倍长回去」,上限按本机读数四到五倍给,CI 机器慢也吃得下)。

### 运行时(帧率 / 长任务)

首屏只管「第一屏多快」,不管「玩起来卡不卡」。放置游戏的心跳每秒改一批响应式状态
(`stores/{player,resources,dongfu,cultivation}` 等),视图若在内容变多时开始整块
重渲染,帧间隔就会拉长 —— 这一维此前没有门。`bun scripts/perf-profile.mjs`(npm 脚本
`check:perf`)补上:对每个游戏视图,在 390×844 移动视口 + 后期档(神人境 + 成套装备)下
采几秒 rAF 帧间隔,量最差帧、>50ms 长帧、DOM 节点数,断言不崩溃、无页面异常
(见 `scripts/perf-profile.mjs` 文件头的量法说明与预算)。

> 与排版/冒烟的分工:那边量「点不点得动、排版对不对」,这边专门量 jank。运行时门
> 是**回归门**不是基准 —— 预算按本机读数留数倍余量(见下文),红的是「成倍长回去」,
> 不是机器抖动。

背包视图按**真实规模**量(`--bigbag N`,默认 300 件):这类放置游戏 jank 的真实来源是
玩家攒下几百件装备后,背列表随每秒心跳整块重渲染。小包 2-3 件量不出列表成本,故默认
压到 300 件(远超在线能攒的典型规模,仍 60fps;`--bigbag 0` 或 `PERF_BIGBAG` 可调)。
夹具模板直接从真实 14 阶装备表生成,浏览器端再对账「实际入包 300 件」——
曾有两件法宝 id 被误当装备,300 件里一半被清洗,门却把 150 件当成 300 件量绿。
背包按 32 件一批、**一次只留当前批**:滚到底点「再看」滑到下一批,「前一批」回看;
首帧不再把 300 张装备卡一次塞进 DOM,`perf-profile` 同时守住背包 DOM ≤ 700。
32 只是单帧渲染窗口,不是持有上限;完整清单仍在同一排序里,逐批前后可达。

坊市同样吃整只背包:寄卖横条与贡器候选都按 32 件一批,窗口最多保留两批 64 条。
运行时门会真的点开贡器弹窗,把两处都逐页翻到末页再回翻一批,守住峰值 DOM ≤ 1100 ——
只点一次会把「后续还能继续长」漏掉;每次前翻都用条目指纹核对新增件数确实等于按钮
承诺并累计全程见过的条目,末页必须覆盖整份清单 —— 续开按钮提前消失、后半包静默
截断都会红;回翻则核对窗口起点确实回退且有旧条目返回。视图表也与 router 逐页对账,
坊市、收徒两页不再漏在门外。

坊市页本身也按「此刻能做什么」收口:卷首市桥图只报货、赏、寄三摊方位,今日行市
再把可买/总格、可交/开单、寄卖/格数与最近归账收成一张总账,三栏可直接切册。可买、
可交、开单数与逐单「尚差」共用 `core/marketOverview` 的同一份判据;切册后顶栏时钟
只报当前这一册的换货、换榜或寄售进度,不再让悬赏页继续挂着货架倒计时。

天界页把四册先收进同一张天门总账:道途报是否已定,远征报已破/总数与在途战次,
试炼报首破数与今日天道状态,道痕报卷内则数与余量;卷首星图只给四册方位,整图
`aria-hidden`。四栏可直接切册,先手按在途远征、未择道途、今日天道、可启程道源
依次带路,但不替玩家开战。道途正文把代价、章法与剑意分层,熔炉与器魂仍走原入口;
远征、试炼与道痕继续按激活册互斥挂载,逐项缺口与倒计时仍由各面板自报。总账由
`core/celestialOverview` 一处汇总,结构与事实源由 `celestialDesk.spec` 守住。

续开后的键盘焦点也走同一条账:核心函数按「续开前已看到哪件 / 续开后开到哪件」算出
新露出第一件在当前窗口里的索引,背包、坊市、图鉴统一按它聚焦;回翻则落到当前页首件。
运行时门会核对 `document.activeElement` 确实属于新批 —— 焦点被旧批首件抢回同样报红。

修行页的主修 / 辅修 / 秘术三册终局共 66 部。门内的 `max-h-72` 只裁视觉、不裁 DOM,
故每门按 12 部一批、最多保留 24 部;续开聚焦新露出的第一行,回翻落当前窗首行。
换门就是换一份书册,窗口回首批且焦点留在页签;装配会改门内排序,若详情正开着,
窗口按目标新位置所在批重开,关闭后焦点仍还给同一部。全习得夹具实测三册依次
12→24→28 / 12→23 / 12→15,修行页首屏 DOM 434、全流程峰值 533;195 宽下分页入口、
窗口读数与整页排版同过一道门。

名号与灵兽两册同样不再整册铺开:69 条终局清单各按 12 条一批、最多保留 24 条,
续开、滑窗、回翻与焦点走同一套长列表规则。名号按「佩戴中 → 已拥有」排,灵兽按
「当前相伴 → 已结缘 → 品阶」排;换佩或换伴会改变排序,因此窗口回到首批并聚焦新选,
不把刚点中的那一项挪到当前窗口之外。运行时门用全拥有夹具真走两册到底,并在 195 宽下
核对入口、窗口读数与每一批的新首条焦点。

部位候选同样按 12 件一批、最多保留 24 件。大行囊里同一槽位可能有几十件,弹窗先报
「共 N 件 · 现看 a–b」,续开与回翻都走同一套窗口;换装后佩戴件会跳到顶部,故窗口
立即回到首批并聚焦新佩戴件,不让玩家刚点中的那件从 DOM 与焦点链里消失。
运行时门从 300 件后期背包点开武器槽,逐批核到末页再回翻;195 宽下另把候选续到第二批,
检查分页读数、入口与整扇弹窗没有挤压或溢出。

法宝全册共 45 张密卡,按 6 件一批、最多保留 12 件。卡上有名、描述、被动、神通、
下一重收益、两种代价与两个动作,分批后全流程峰值 DOM 403;逐批翻完仍能核对全 45 件,
末页回翻与续开焦点走同一套规则。随身不改排序但仍把焦点留在原卡;炼化会改祭炼等级,
若卡片因此越过当前窗口,窗口按它新位置所在批次重开后仍把焦点送回同一件。195 宽下两枚动作与分页入口
改为整宽纵排,运行时门逐批翻到末页再回翻,并真按一次随身与炼化。

开炉丹方现有 54 张,同样按 6 张一批、最多保留 12 张。卡上有代价、成品、把握、双成率、
存货、短板与「炼制 / 连炼」两枚动作;整册只放在 `max-h-64` 里滚动仍会一次进 DOM,
故改为显式续开。搜索换词只重置窗口、不把焦点抢出输入框;炼制耗料会改变「可炼优先」的排序,
若目标因此越过窗口,按新位置所在批次重开后仍把焦点送回同一张方。运行时门逐批翻到末页再回翻,
并在 195 宽下核对搜索重置与炼制后的焦点。

词条转移的候选是整包装备的横切面:一条不限部位与品质门槛的词条,能落到其余全部藏品上。
候选按 12 件一批、最多保留 24 件;换源词条即换整份清单,窗口回到首批。续开聚焦新露出的
第一件,回翻落当前页首件;195 宽下候选的三段读数不许被压成竖排,续开/回翻入口、候选行与
面板本身也不许挤出边界。300 件后期背包实测 299 件候选逐批开完(24 批),峰值 DOM 948。

收藏图鉴另用一份**全收集夹具**:九册共 809 条全部已收,灵材、丹方、器谱、法宝祭炼
与悟道分支也已点亮;每部功法各择一条悟道,让全部分支可见。夹具直接从内容表生成,
不手抄 id。运行时门会真的切到「收藏」,每册每窗最多 48 枚(两批 24),把九册都逐页
翻到末页再回翻一批 —— 首次进入实测 297 DOM,全流程峰值 585,不再随 809 条整页铺开。
预算守住峰值 ≤ 1100,既不让终局图鉴一次铺满,也不把未识的「???」放出
`UNKNOWN_CAP` 之外。续开/回看入口紧接已收批次、排在问号墙之前;新得若藏在后续批次,
按钮会报「含新得 N」,不让页签亮点在册内失去落点。

天界道痕满卷固定为 60 则,行内同时有忆战、重写与旧纪入口。此前面板条件误写成
`celTab === 'dao'`,导致道途册混进整卷履历、点「道痕」反而空白;现在道途与道痕
严格互斥,`?tab=marks` 深链也直接落册。道痕列按 12 则一批、最多保留 24 则,
续开聚焦新露出的第一则,回翻落当前窗首则;新痕从头部挤入时窗口回首批。195 宽下
分页入口、60 则可达性与 28px 触控面一起过门。满卷夹具实测逐批 12→24(4 批、滑 3 次),
道痕页首屏 DOM 281、全流程峰值 364。

门庭页卷首「今日门庭」总账先报候差、在途、最近归来与一键派发,最近归期直接带弟子名
和差事名;正文值日簿候差在前、在途按归期续列,任务进度与归来产出都从同一套结算函数
现算。运行时门用 1 名在途 + 1 名闲置夹具核对卷首、最近归期、任务进度与派发后的
2/0 换口,避免按钮、计数与逐单状态各说一套。

器魂页卷首同报「装配 / 闲置 / 可凝」;可凝不再只数行囊资格,而是按道源还能开几炉
折算。天界入口、器魂卷首与凝炼台共用 `core/soulOverview` 的同一份账,付不起时直接
列「尚差 N 道源」,不会在入口先写一句 N 件可凝、点进去才看见按钮全灰。
现在卷首先给三席阵图,再把「此刻器魂」收成一条先手:有闲置先装配,三席满先取舍,
有可凝件按道源是否够开炉带路,没有可凝件才回行囊。三席正文仍由 `soulAt` 唯一判断,
两处门径保留散置形意与凝炼台,章法退到页尾但原器即毁、炉费与席数仍完整交代;
器魂页的结构与事实源由 `src/ui/soulDesk.spec.ts` 与 `src/core/soulOverview.spec.ts`
守住。

藏珍页卷首用九册藏珍格同报功名与藏珍总进度,功名状只列最近三枚,藏珍谱只报九册
整体与新得 / 将满;两者仍共用 `collectionProgressOverviewFromCodex` 与
`nearestAchievementRows`,九册单字印与格内读数由 `ui/collectionDesk` 搬运,不在
组件里重数条目。九册正文继续保留来源、尽收、分批窗口与回翻;结构与事实源由
`src/ui/collectionDesk.spec.ts` 守住。

基线(2026-10-30 实测,本机 + 无头 chromium,后期档,`--seconds 3`):

| 视图 | 最差帧 | 长帧(>50ms) | DOM 节点 |
| --- | --- | --- | --- |
| home / adventure / character | 17ms | 0 | 298–383 |
| cultivation(全习得三册,逐门到底并回翻) | 17ms | 0 | 434 / 峰值 533 |
| **inventory(300 件装备,逐页到底并回翻;法宝、丹方、部位候选与词条转移再翻到末页)** | 17ms | 0 | 678 / 峰值 681 · 法宝 403 · 丹方 611 · 部位候选 990 · 词条转移 948 |
| codex / souls / titles / settings / build / legacy / dongfu / world | 17ms | 0 | 207–507 |
| celestial(道痕满卷 60 则,逐批到底并回翻) | 17ms | 0 | 281 / 峰值 364 |
| collection(全收集九册,逐册到底并回翻) | 17ms | 0 | 297 / 峰值 585 |
| market(300 件,三册切换后寄卖/贡器都逐页到底并回翻) | 17ms | 0 | 396 / 峰值 917 |
| apprentice(门庭卷首 + 在途进度) | 17ms | 0 | 246 |

并做过规模加压验证:背包塞进 **1000 件装备**仍 60fps、最差帧 17ms、零长帧、峰值 682 DOM ——
单批窗口不随总件数膨胀,极端规模 + 引擎每秒 tick 也不会把整张清单重新铺开。全 17 个游戏
视图稳定 ~60fps、零长帧、无崩溃。预算:`最差帧 ≤ 100ms`、`长帧 ≤ 2`、背包 DOM ≤ 700、
修行功法峰值 DOM ≤ 700、天界道痕峰值 DOM ≤ 700、法宝全册峰值 DOM ≤ 1100、丹方全册峰值 DOM ≤ 1100、
部位候选峰值 DOM ≤ 1100、词条转移峰值 DOM ≤ 1100、坊市峰值 DOM ≤ 1100、
收藏续开峰值 DOM ≤ 1100(前两项环境变量 `PERF_MAX_FRAME_MS` /
`PERF_LONG_FRAMES` 可调)。改动过会
显著影响单次渲染量的代码后,这些数要跟着重校,连同本表一起。

### 显示心跳的粒度(为什么秒针能走、`totalPlaySec` 仍是 5 秒一盖)

倒计时的秒针要每秒走,而 `totalPlaySec` 由引擎按 `ACTIVE_STAMP_MS`(5 秒)盖章 ——
两者靠 `composables/useGameNow` 解耦:显示自起 1s 表、读 `gameNow()`,结算链照旧读各自口径。

> 当初把「不解耦」的理由写成「`finalStats` 是全库最重的 computed,每秒重算受不了」。
> **2026-10-23 实测把这条推翻了**(本机,神仙期满装 + 闭关状态,bun/vitest 内 `performance.now`):
>
> | 读数 | 实测 |
> | --- | --- |
> | 每次 `totalPlaySec` 变化后读 `finalStats.mods` + `cultPerSec` + `qiRegenPerSec` | ≈7.4µs |
> | `currentTribulationPlan`(逐波推演整段雷)同条件 | ≈18.5µs |
> | 修行页 1s 心跳的真浏览器帧率(`perf-profile --view cultivation`) | 最差帧 17ms · p95 17ms · 零长帧 |
>
> 每秒重算本身不贵。解耦的真理由是**语义**:`totalPlaySec` 是「已游玩时长」这一存档事实,
> 它的盖章节流同时服务 `lastActiveAt` 落盘 —— 让落盘节奏决定秒针怎么走,是两个不相干的
> 东西被一根线串起来。**推论**:以后若还要论证「某个每秒重算太贵」,先量,别沿用这条旧印象。

推送到 `main` 会走 GitHub Actions 同一道闸:类型检查、Oxlint、用例全绿后才部署 Web / PWA 与镜像(CI 用 `voidzero-dev/setup-vp` 装 Vite+ 工具链,Node 24)。

## 项目结构

```text
packages/engine/          # 公共库:万象引擎(等级/属性/装备/副本四套系统的可配置内核)
src/
├── data/                 # 内容层:纯静态声明式定义(59 个模块)
│   ├── realms.ts             # 4 界域 · 21 境界
│   ├── regions.ts            # 44 区域
│   ├── enemies.ts            # 132 敌人
│   ├── equipment.ts          # 294 装备模板(一阶一名)
│   ├── affixes.ts            # 113 词条
│   ├── gongfa.ts             # 63 功法
│   ├── gongfaBranches.ts     # 141 悟道分支
│   ├── pills.ts              # 68 丹药
│   ├── artifacts.ts          # 45 法宝
│   ├── souls.ts              # 6 类 6 阶器魂
│   ├── xiangxiu.ts           # 28 星宿 · 四象
│   ├── ziwei.ts              # 12 宫 · 14 主星
│   ├── yijing.ts             # 8 卦 · 64 重卦
│   ├── qimen.ts              # 奇门八门
│   ├── daolu.ts              # 道侣
│   ├── endgame.ts            # 道途 / 天界 / 试炼
│   ├── mutators.ts           # 8 变数
│   └── constants.ts          # 全局平衡参数
├── core/                 # 逻辑层(各模块与其同名 spec,另有 *Sim.ts 平衡模拟器)
│   ├── engine.ts             # 在线心跳驱动(1000ms)
│   ├── offline.ts            # 离线收益结算
│   ├── combat.ts             # 回合制战斗预解算
│   ├── formulas.ts           # 数值公式(转发到万象引擎)
│   ├── statsCalc.ts          # 属性聚合(词条递减 + 软阈值)
│   ├── equipGen.ts           # 装备实例生成
│   ├── exploration.ts        # 历练状态机
│   ├── loot.ts               # 掉落总入口
│   ├── progress.ts           # 任务成就横向总线
│   ├── worldGen.ts           # 终局世界生成(三重审计门)
│   └── *Service.ts           # 各系统服务
├── stores/               # Pinia 状态(18 个,除瞬态 `ui` 外 17 个自动持久化)
├── views/                # 19 个页面
├── components/           # 68 个组件(9 组)
├── ui/                   # 图标、词条名、图鉴与提示等展示层数据
├── utils/                # GNum 大数(m×10^e)/ 格式化 / 随机 / 存档底层
├── composables/          # useNow 等
├── types/                # 领域类型定义
└── router/               # 路由与首次流程守卫
```

## 发版

**发版是一个显式动作 —— 推 tag。** 构建 Electron 与 Android 产物、发布 Release 的流水线只在 tag 上触发:

```bash
# 1. 先提 package.json 的版本号(它决定 APK 的 versionName / versionCode)
# 2. 本地体检:缺正文、工作区不干净、tag 重名都会被拦下
bun run release:check
# 3. 打 tag 并推上去(版本号以 package.json 为准,这里只是例子)
git tag vX.Y.Z
git push origin main vX.Y.Z
```

`bun run release:check` 只答本地能答的四件事(版本与正文对得上、工作区干净、tag 没被用过、正文里的绝对链接指的都是本版 tag —— 复制上一版正文时最容易漏改那几处图链),
外加一条提醒:自上次 tag 以来若有提交动过 `android/`、`electron/` 或发版流水线,它会把条数
摆出来 —— 那几条路径**本地永远绿、只有 tag 跑得到**,打完 tag 要看真跑结果。

这条流水线第一件事是核对 tag 与 package.json 是否同一个版本(判据看的是两者**相等**,
不是某个具体版本号),对不上直接红掉 —— 免得发出「Release 页上的版本、与装到手机上的
versionName 不是同一个」的包。

**Release 正文写在仓库里,不写在页面上。** `docs/release-notes/` 下与 tag 同名的文件
(如 `docs/release-notes/v0.0.1.md`)就是那一版的正文:release job 优先取它,没有则退回
GitHub 自动生成的提交清单。理由很实在 —— 手改页面上的正文会被下一次流水线重跑冲掉,
落在仓库里才跟得住版本、也才过得了文档门。那份文件里的链接一律写绝对地址(图片与链接
渲染在 Release 页上,相对路径解析不到仓库内容)。

## 多端构建

```bash
bun run build:electron   # Windows 桌面客户端(Electron,输出 pkg/*.zip)
bun run build:android    # 同步 Web 产物到 Android 工程(Capacitor)
bun run build:apk        # 直接出 Release APK
```

> **关于 Android 签名**:签名私钥文件(`android/release.keystore`)作为历史遗留随仓库分发,
> 它只提供「用同一把钥匙签出的 APK」这一致性,**不构成官方性与防伪** —— 任何克隆仓库的人
> 理论上都能用它签出包。因此签名口令绝不入库:CI 由 GitHub Secrets
> (`KEYSTORE_STORE_PASSWORD` / `KEYSTORE_KEY_PASSWORD`)注入,本地出包请临时 `export` 这两个环境变量
> (或建一个不入库的 `android/keystore.local.properties`)。

安装与部署(Web / PWA、Android、Windows 桌面、Docker、反向代理)见 [deployment.md](./deployment.md)。

## 与公共库的协作

四套数值系统的规则在独立仓库 [万象引擎](https://github.com/pplmx/wanxiang-engine) 里,
本仓库的 `packages/engine` 是它的上游。**选一处开发,别两边同时改**:

```bash
bun run sync:engine                                    # 本作 → 库(一键,等义于下行)
git subtree push --prefix=packages/engine engine main  # 本作 → 库
git subtree pull --prefix=packages/engine engine main  # 库 → 本作
```

改完库先推独立仓(`bun run sync:engine` 一行)。漏推时 `bun run check:engine` 会红(本仓与独立仓必须同树),而且报错信息里就把补救命令打印出来。
两边都改会让 `subtree push` 拒绝执行,那时先 `pull` 合回来。细节与对账清单见 [engine.md](./engine.md)。

## 设计规范

配色、版式、字体子集与动效见 [design.md](./design.md)。

## 更名(2026-09):《云隐修仙录》→《玄枢录》

一次改名要动的远比"标题字符串"多。这次的处置**写在这里,免得下一次改名再摸索一遍**:

| 层 | 位置 | 这次怎么处理 |
| --- | --- | --- |
| 展示名 | 界面标题、`index.html`(title / keywords / og)、`manifest.webmanifest`、`privacy.html`、Android `strings.xml`、Electron `productName`、README 与 `docs/` | 全量替换为《玄枢录》,副题 `玄之又玄 · 众妙之门` |
| 世界内名称 | 山名(云隐山 → 玄枢山)、默认道号(云隐散人 → 玄枢散人)、背景主题曲名、碑文 | 一并替换 —— 它们和标题是同一个意象 |
| 存储前缀 | `utils/storage.SAVE_PREFIX`:`yunyin.` → `xuanshu.` | **带迁移**:`migrateLegacyPrefix()` 启动时把旧键搬到新键(新键已存在则不动),搬完删旧键 |
| 导出文件标识 | 载荷里的 `game` 字段与文件名 | 写新标识;`validateImportPayload` **同时认旧标识**,老玩家手上的 `.save` 不作废 |
| 包名与产物名 | `package.json` name / Electron appId / Windows 产物名、Docker 服务与镜像名、Service Worker 缓存版本 | 全部换成 `xuanshu`(缓存版本换名顺带把老缓存甩掉) |
| 加密口令 | `utils/crypto.SAVE_SECRET` | **刻意不动**:它是密钥材料,一改所有老档都解不开 |
| Android applicationId 与 Java 包名 | `capacitor.config.ts` / `android/` | **这次不动**:换了等于换一个 App,老安装不能覆盖升级、WebView 里的本地存档也会另起一份。要换得单独做一次并盯住构建 |

这三条由 `src/core/rebrand.spec.ts` 钉住:对外文字里不许再出现旧标题、旧前缀会被迁移、
旧导出文件仍能导入。以后再改名,照着这张表走一遍即可。

## 待办 · 下一步

**只剩发版这一步(其余已就绪)**:

```bash
bun run release:check     # 版本 0.0.2 / 正文就位 / 无旧 tag 图链 / 工作区干净 → 放行
git tag v0.0.2
git push origin main v0.0.2
```

打完后盯流水线三项 —— 这三条**本地永远看不到**:Android 签名、Electron 打包、Release 正文
(正文取自仓库里的 `docs/release-notes/v0.0.2.md`)。

**已补上的守卫**:「镇压灵石收益与境界无关」改为源码层判据 —— `suppress.ts` 不许出现
`.major` / `.realm` / `finalStats`(境界只要根本不是输入,产出就不可能被它影响)。行为判据试过
两次都不可靠:同文件里先跑一次结算会污染基准(180 vs 204),两次结算塞进同一 it 又串单例。
注入 `player.major` 实测:判据当场变红。

已完成的近期项,留档备查:掉落期望读数(`expectedMaterialsPerRun` / `expectedEquipmentTripsPerRun`,
显示在派发前的模式行)、洗练的「约 N 次」、镇压收益的界面说明。
