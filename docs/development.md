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
> `vp staged` 和 `bun run type-check`,commit-msg 拦下把 bullet 写成字面量 `\n-`
> 的提交信息,是本仓库自己的提交流水闸;
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
| `bun run test` | 全量用例(全量 508 个 spec;本作自己那部分 428 个) |
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
| 用例 | 全量 508 个 spec(本作自己那部分 428 个),按 9 个系统分类归档 —— 新 spec 没登记分类,`test:report` 会红。文档只记 spec **文件数**(静态可数,由 `docs-check` 核对);**用例条数不写进文档** —— 它每次都随加删用例变,记在文档里只会逼人频繁改、且改漏就打红,而它的真实数 `test:report` 每次都会自己打出来 |
| 门禁接线 | CI 里跑的每个 `bun scripts/*.mjs` 都必须在 package.json 或 verify 里有对等入口(反之 verify 点名的脚本必须真存在),由 `src/core/gateWiring.spec.ts` 守着 —— 「本地静态门过了,CI 静态门就过」这句话从此不是注释 |
| 数值对账 | 四套系统迁移到万象引擎时,与**迁移前冻结的旧口径**逐位相等(见 [engine.md](./engine.md)) |
| 数据自审 | 内容表的头注释计数与真实数组长度比对、敌人 / 区域 / 模板引用闭合、文本与词表覆盖 |
| 样式无尸体 | 样式表里每条带连字符的类选择器都得有人用(`src/ui/deadStyle.spec.ts`)。放行三类源码里查不到全名的:Vue `<Transition name>` 生成的过渡类、`is-${state}` 拼接的状态类、BEM `--变体`;排版角色词(`.t-card / .t-entry / .t-item / .t-body / .t-note`)整词豁免,但至少得有一个真在用 |
| 标点一致 | 同一页模板里不许同时出现全角与半角的中文括号或逗号(`src/ui/copyPunctuation.spec.ts`)。全站两种写法都有人用(中文半角逗号 265 处 / 全角 178 处),判据只要求**一篇之内自洽** —— 全角在竖排与题签里是正当写法,不禁止。扫描面 = 可见文本 + 标签属性值(两处玩家都读得到),注释与 `{{ }}` / `${}` 里的代码逗号不在其内。同一份判据还钉住:乘号只写 ×(不用 ASCII x)、中文与手写数字之间留一个空格(「买 1」而不是「买1」)、中文散文里的省略号写「……」(紧贴中文才算;`…+N` 与 `万/亿/兆…` 这类清单收尾是图形标记,不受此限) |
| 排版与冒烟 | 全量路由 × 五档视口的渲染审计(`scripts/layout-check.mjs`)、界面冒烟(`ui-smoke.mjs`,逐页点按钮 + 四条专场景:旧档迁移、存储写满、挂机稳定、导入存档,外加「找到控件却一个都没点成」这条下限)、Service Worker 离线层(`offline-check.mjs`)。前两者**并发**跑(每个视口与每件事各是一个独立任务,`--jobs` 或 `LAYOUT_JOBS` / `UI_SMOKE_JOBS` 调路数,默认按核数、上限 8)—— 一轮从约 17 分钟压到约 5 分钟 |
| 读源一种写法 | 界面契约测试读文件只走 `@/test/readSource`(`src/ui/specReadSource.spec.ts` 守)。`readSource` 里带着「`src/style.css` 要走 readStyleCss() 拼装」这条分支 —— 直接读那份拿到的只是按路由拆过的残卷,而断言照样会绿。目录遍历同理由 `walkFiles(dir, 谓词)` 承担:八份各自的 `walk` 只差一行扩展名判断,而那正是最容易抄错的(`.spec.ts` 少个 s、把 `.d.ts` 当源码),故把差异摊成具名谓词 `isSourceFile` / `isTypeScriptOrVue` / `isVueFile` / `isSpecFile` / `isSourceOrScript` |
| 首屏预算 | 冷启动解码字节 / FCP / 楷体换上三条上限(`scripts/first-paint.mjs`,自带静态服务与 4G 限速) |
| 文档与实现一致 | `scripts/docs-check.mjs`(已并入 `bun run check`):文档里引用的 `bun run` 脚本必须真存在、反引号路径与相对链接必须存在、「全量 N 个 spec」必须等于真实文件数 —— 实测抓到过一次 25% 的漂移(文档写着 199 个 spec 时,实际已是 294) |
| 内联详情与浮层 | 「点一下看细节」有两种正当形态,选错的那一种不会报错。**就近展开**(说明块紧跟所点的控件:收徒任务格、洞府建筑行、修炼「来路」)保持内联 —— 眼睛不用离开原地;而**离得远的那种**(人物页四组行藏之后的来源明细)必须走 `BaseModal`。判别方法只有一个,而且只能靠真浏览器:点完之后量 `getBoundingClientRect()`,看面板是否落在 `window.innerHeight` 之内。实测过失败的那一处:390×844、页面先滚 260px、点第一组的行,面板落在 top=1158(视口 844),而当时排版门核的是「点开→有来源行→能合上」—— 三项全绿,玩家什么都看不到。排版门现已加「打开后必须落在视口内」这条,失败时会把 top 与视口高度一起打出来 |
| 静态扫描的假阳性 | 用正则扫界面容易「抓到」一批并不存在的问题,本仓实测过的几类:① 遍历使用 —— `VEINS` / `PETS` 的 id 在代码里搜不到字面量,但由 `v-for` 逐条渲染;② 文件内自用 —— `COMBO_ARTS` 这类导出只在本文件被读,「仅文件内使用的导出」全仓有七百多个,批量删不可行;③ 值域巧合 —— 「界面里与数据常量同值的裸数字」命中 438 处,几乎全是无关的巧合;④ 选择器两半都不存在 —— 旧章首查询用的是已删掉的 `.section-title`,但它是**金丝雀**(哪天有人抄回旧组件就会红),不是空转;⑤ 逐行回看找祖先 —— 装饰 SVG 的 `aria-hidden` 常挂在几十行之上的容器上,回看窗口太窄会误判,写成标签栈又会在单行多标签/自闭合标签上算错。结论:扫描只用来**找线索**,判据必须能指名到具体行与具体理由 |
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
| 冷启动解码字节 | 2681KB(楷体 1783KB) | 1161KB(楷体 41KB) | 1500KB |
| FCP | 692ms | 1304ms | 1400ms |
| 楷体换上(swap 那一刻) | 2255ms | 2937ms | 3400ms |
| 首屏楷体请求 | — | 41KB(1 片) | 160KB |
| 最大 JS 单块 | — | 397KB(`player`) | 500KB |
| 构建时长 | 32s | 26s | 90s |

> 2026-10-06 重校准:楷体换上上限 2800 → 3400 —— 旧值按"本机无 preload 2159ms"
> 定的,而 CI 量的是随代码量增长的排版,迁移前后稳定落在
> ~2942-2952ms(9c739b9 迁移前就 2942),预算比实测还低,Pages 连红数推。
> 反「整份 1.8MB 打进来」的量级守卫改由**首屏楷体请求字节断言(≤160KB)**确定性承担,
> 与机器快慢无关;时序这条只守"字体加载奇慢"。

四处改动:

1. **楷体按需分片**。原先一份 1.8MB 的子集在冷启动时整份下载,而首屏真正用到的字不过
   一两百个。现在按**用法频次**切成二十来片(每片一段 `unicode-range`,声明由
   `scripts/fonts/build-kai-font.py` 生成到 `src/assets/fonts/kai-subset.css`),
   浏览器只取「页面上真出现的字」所落的那几片。开卷页真正落在 `font-kai` 上的
   42 个字(含紧接的建号章号)固定放进第一片,再补一档高频字;首屏只取 1 片 / 41KB;
   而「玩家起了个生僻名」
   这种时候也只多拽一小片,不是一千多 KB 的储备整段。片多大是取舍(片越小越省字节、
   请求越多),取 180 字/片是实测的口径。`kaiFontCoverage.spec.ts` 会核这组首屏字
   没有掉出第一片。
2. **不打 preload**。同一份产物只改 `index.html` 里那一条链接、各量 3 遍取中位:
   不打 → FCP 1360ms · 楷体换上 2858ms;打 → FCP 1456ms · 楷体换上 2681ms。
   预载虽让字体早到,却把首帧推后约 100ms —— 抢的仍是首屏 JS 与渲染的带宽。
   故只留 `font-display: swap`;`bun scripts/first-paint.mjs --variant preload`
   可随时复量这个 A/B。
3. **浮层按需装载**。装备详情、事件、转世、归来等九扇浮层只在事件发生时出现,却合计带着
   各自的数据链;原先静态挂在 `App.vue`,所有玩家打开首页都要先下完。现在它们由
   `defineAsyncComponent` 拆成独立分块,并等正文所用楷体落定后再挂载,避免在慢网下与首条
   路由、字体切片抢带宽。浮层状态仍在 store 中,晚一拍挂载不会漏掉事件。
4. **样式先于模块预载排队**。Vite 默认把入口 CSS 放在几十条 `modulepreload` 之后;
   4G 冷启动时预载 JS 会先占满连接池,首帧只能等样式最后一个到。构建插件只调换
   `<link rel="stylesheet">` 与模块标签的顺序,不删预载、不改依赖;实测 FCP 提前约 80ms。
   `layout-check` 直接查构建产物,防止插件顺序变化后静默退回。

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
首帧不再把 300 张装备卡一次塞进 DOM;候选弹窗会叠在整页之上,故 `perf-profile`
把背包首帧与交互峰值拆开记,分别守住首帧 DOM ≤ 800、弹窗峰值 DOM ≤ 1100。
32 只是单帧渲染窗口,不是持有上限;完整清单仍在同一排序里,逐批前后可达。

坊市同样吃整只背包:三册只挂当前一册,不再用 `v-show` 把另外两册留在 DOM;寄卖横条与
贡器候选都按 32 件一批,窗口最多保留两批 64 条,实测交互峰值从 1111 降到 791。
运行时门会真的点开贡器弹窗,把两处都逐页翻到末页再回翻一批,守住峰值 DOM ≤ 1100 ——
只点一次会把「后续还能继续长」漏掉;每次前翻都用条目指纹核对新增件数确实等于按钮
承诺并累计全程见过的条目,末页必须覆盖整份清单 —— 续开按钮提前消失、后半包静默
截断都会红;回翻则核对窗口起点确实回退且有旧条目返回。视图表也与 router 逐页对账,
坊市、收徒两页不再漏在门外。

坊市页本身也按「此刻能做什么」收口:卷首市桥图只报货、赏、寄三摊方位,今日行市
只报一条先手,紧接的三摊册口再报可买/总格、可交/开单、寄卖/格数与最近归账,
并直接切册。今日行市、册口与当前摊面同住一张开口续卷;三册正文再共用
`LedgerHeader` 的长账内章首,依次报「本架货目」「本期赏单」「寄卖与即时柜」,
章内可买、可交、寄卖真值与总格仍直读 `marketPulse`、当前面板对象与
`MARKET_CONSIGN_SLOTS`,不再借 `SectionTitle` 另起自动编号。正文不再另套卡壳;
可买、可交、开单数与逐单「尚差」共用 `core/marketOverview` 的同一份判据。
兵刃摊签另有可收起的买前验货:本件战力、当前同槽战力、平铺三围差、词条全文、
固有与共鸣当前件数都直接复用换装比较与装备解析,展开前后 `aria-expanded` 与
`aria-controls` 同指一份验货帖,不把详情拖到买回行囊之后。
真浏览器门 `taskMarketRegisterFold` 在 390 核对三摊并读、三册章号 / 题名 / 真值
与正文件数同源、方向键 / Home / End 同步焦点与唯一 tabpanel,并展开兵刃验货核对
战力、对照与词条落在同一账线;在 195 核对单列、验货头与三围退单列、章内真值
不竖排且无横向可滚,在 1280 核对三摊并读、章首与正文并读、验货与摊签并读及货架两列。
切册后顶栏时钟只报当前这一册的换货、换榜或寄售进度,不再让悬赏页继续挂着货架倒计时。

天界页把四册先收进同一张天门总账:道途报是否已定,远征报已破/总数与在途战次,
试炼报首破数与今日天道状态,道痕报卷内则数与余量;卷首星图只给四册方位,整图
`aria-hidden`。四栏可直接切册,先手按在途远征、未择道途、今日天道、可启程道源
依次带路,但不替玩家开战。道途正文收成一册两章,壹「道途与门径」把代价、章法与
剑意分层,贰「两处门径」只留熔炉与器魂;两章共用章首,章内读数取当前道途与器魂
槽位真值。远征、试炼与道痕继续按激活册互斥挂载,逐项缺口与倒计时仍由各面板自报。总账由
`core/celestialOverview` 一处汇总,结构与事实源由 `celestialDesk.spec` 守住。

远征册的两章现在始终在场:没有在途远征时,壹「在途远征」给出可见空态;贰「特殊
规则世界」的章首只报 `CELESTIAL_WORLDS` 与虚门状态,不再在面板里另算一份可启程界数。
特殊世界与虚界同住一组 `.celestial-world-row` 开口账行,390 单列、960px 起两栏;
道痕册也改用统一章首直报 `marks.length / MAX_MARKS`,今昔对照、主卷和空态不再套卡壳。
真浏览器门 `taskCelestialInnerVolumes` 在 390 核三册章序与章内真值,在 1280 核门径与
世界账行并读,在 195 核章内读数不挤成竖排且整页无横向可滚。

天界试炼域现在收成一册「天界试炼续卷」:今日天道、变数、八场试炼与挑战书四章
沿同一卷面续排,外层与门印不再套同权卡。八场试炼仍逐项读 `TRIALS`,先收成四列
两行的八门印谱;每枚门印只报门字、场名与最佳回合,点印或方向键把唯一一份证道帖
换成该场说明、规则、门票与首破赏,主键整章只留一枚。挑战书的择界 / 叠变数 / 立契 /
命名再收成四程立契约台:程签报当前界、已叠数、契名与题名,当前只摊一程;约文、
已选规则正文、验价与验约 / 立约主键都留在台下,变数满员置灰也照旧。真浏览器门
`taskCelestialTrialFold` 在 390 核对四章顺序、八门互异、单选态与证道帖联动、方向键
移印、四程单选与约文同步、章内读数归石青和唯一朱砂主键;1280 核对八门同排与
左四程 / 右一程,195 核对印谱两列、四程单列且整帖与动作不越纸。结构判据由
`src/ui/celestialDesk.spec.ts` 守住。

天界战报浮层另收成一册「证道战卷」,四章固定为战果、战局、逐场与此战之判。
场签从裸数字芯片改成 roving tablist:方向键与 Home / End 必须同步选中场、焦点、
对阵与回放,逐场账行也标出同一当前场;关动效时回放直接落满,重播键仍守 28px 触达面。
真浏览器门 `taskCelestialBattleScroll` 用七杀试炼真打一场,在 390 / 960 / 195 三档
核对四章顺序、卷身只留上下账线、场签与日志零卡壳、无横向裁切;960 核对场签同排与
对阵左 / 战报右,195 核对场签单列。源码契约同样由 `src/ui/celestialDesk.spec.ts`
守住。

三生录的画像、四册册口与当前正文现在同住一张开口续卷,`LegacyChapterRail`
在每枚册口先报本世、节点、未了与纪录真值,方向键 / Home / End 同步移动焦点、
选中态、地址和唯一 tabpanel。真浏览器门 `taskLegacyRegisterFold` 在 390 核验
2×2 册口、续卷顺序、两本账上下续排与四处读数同源,在 195 核验单列和整页无挤压,
在 1280 核验四列并读及轮回主账 / 旧世归档的并读几何;结构与响应式契约由
`src/ui/legacyDesk.spec.ts` 守住。

界域志六册现在共用一张开口长账与一枚 `FolioChapterHead`:卷次、题名和读法由
`realmCodexChapters()` 沿导航顺序装配,章内真值仍直读页面原有数据表、store 与 core
派生值。`data-realm-codex-folio` 只换 `data-chapter`,典籍、周易、紫微、星象与奇门
不再导入 `SectionTitle`,也不再逐段套 `card-ink`;章首后以 `realm-codex-section`
和分段线续排,重复条目退成账行。390 / 195 先把真值放到题名下方,620px 起回到右侧;
典籍题名与释文、八卦三栏、奇门两列在 620px 起并读,220 CSS px 以下谱格、宫位、宿名、
门位与命格长读数全部退单列;两处长表展开键仍守 28px 触达下限。真浏览器巡页逐册核对
章序、章号、题名、读法、真值、连续账边框与 `card-ink`,在 390 / 195 / 1280 三档分别
核单列、极窄档与右侧真值,并展开六十四卦与二十八宿后再量一次溢出。结构与事实源由
`src/ui/realmCodexDesk.spec.ts`、`src/core/uiLayering.spec.ts` 与
`scripts/layout-check.mjs` 守住。

设置页现在只有一张 `data-settings-register` 开口续卷,六章依次为
`sound / sight / conduct / archive / trail / index`。每章共用同一枚序印、眉题、标题、
右侧状态与分段线,不再导入 `SectionTitle` 或 `LedgerHeader`,也不再套
`settings-console__grid`;后三章由 `data-settings-afterword` 以 `display:contents`
接回同一网格。620px 起声息与观照并读、行止跨栏,存续横跨整册、留痕与卷末并读;
960px 起前三章各占四列,存续占七列并跨两行,留痕与卷末叠在右侧五列。220 CSS px
以下章态、控制读数、选项、存续动作与留痕动作全部退单列,动作仍守 28px 触达下限。
声息、观照与行止的六组选择共用 `InkChoice`:14 枚按钮各自报 `aria-pressed`,
每枚至少 40px 高,220 CSS px 以下逐枚占满整行;设置页不再出现原生 checkbox。
真浏览器巡页在 390 / 195 / 1280 同时核对六章顺序与章名、六组账签顺序与单选事实、
40px 触达高度、章首无重叠或横向溢出、每章零圆角 / 零投影 / 透明底、四边不同时成框,
并量桌面存续与右侧两章的并读几何;手机页眉还会点开灵石精确值,核对弹窗与资源账同源;
结构与事实源由 `src/ui/settingsDesk.spec.ts`、`src/core/uiLayering.spec.ts` 与
`scripts/layout-check.mjs` 守住。

开卷两页现在也收进同一套章首语法。欢迎页的 `data-opening-gate-register` 只有
`gate / rules` 两章,建号页的 `data-opening-create-register` 只有
`name / roots / vow` 三章,五章共用 `FolioChapterHead` 的序印、眉题、题名、读法与
章内真值;道号实时报 `N / 8 字`,灵根章首直读当前等级,定卷章首随落印状态改口。
旧 `opening-gate__layout`、`opening-create__sheet` 与分区题头已撤,外层最多留一条
上下账线,章内不再套卡。390 真浏览器门核对两册章序、章首五项齐全、章内零四边框 /
零圆角 / 零投影、主入口仍在山门章、验根盘仍在验根章;1280 核对欢迎双栏与建号
留名 / 验根 / 定卷三章并读、定卷主入口在首屏,200% 档继续沿既有缩放门量重掷入口与
横向溢出。结构与事实源由
`src/ui/openingDesk.spec.ts` 与 `scripts/layout-check.mjs` 守住。

续开后的键盘焦点也走同一条账:核心函数按「续开前已看到哪件 / 续开后开到哪件」算出
新露出第一件在当前窗口里的索引,背包、坊市、图鉴统一按它聚焦;回翻则落到当前页首件。
运行时门会核对 `document.activeElement` 确实属于新批 —— 焦点被旧批首件抢回同样报红。

修行页的主修 / 辅修 / 秘术三册终局共 68 部。门内的 `max-h-72` 只裁视觉、不裁 DOM,
故每门按 12 部一批、最多保留 24 部;续开聚焦新露出的第一行,回翻落当前窗首行。
换门就是换一份书册,窗口回首批且焦点留在页签;装配会改门内排序,若详情正开着,
窗口按目标新位置所在批重开,关闭后焦点仍还给同一部。全习得夹具实测三册依次
12→24→28 / 12→23 / 12→15,修行页首屏 DOM 591、全流程峰值 690;195 宽下分页入口、
窗口读数与整页排版同过一道门。

修行页卷首以下现在收成一册「行功续卷」:修行、下一步、随身、功法四章由
`ui/cultivationDesk` 的同一份章序装配,破境、闭关、状态、速服与书目都在这一册里续排,
不再逐段套 `card-ink`。真浏览器门 `taskCultivationFold` 在 390 档核对恰好四章、章名与
顺序、零卡壳、章内读数归石青、修为进度归石青,以及已启用的行动主键归朱砂且宽度不超过
账行 72%;行动行本身不许整行铺底。结构判据由 `src/ui/cultivationDesk.spec.ts` 守住。

洞府卷首、当前道途与修行内观台不再借固定书口色:三者都读主题 `paper` / `ink` 阶梯,
日间落浅纸、夜间落深纸。修行页的周天盘回到默认 `paper` tone,不再局部覆盖成暗场色组。
真浏览器门 `taskThemeStageSurfaces` 在同一份存档上原地切 `data-theme`,分别核对三处舞台
的计算底色确实等于对应主题 token、日夜亮度跨度足够、正文在两端都保持 AA;全站渐变压字
另由像素采样门复核。同一道门还核对当前道途确实渲染成带目的册的链接,不能只剩进度读数;
`src/core/goal.spec.ts` 逐类钉住突破、构筑、历练、材料与装备目标的目的路由。源码级契约由
`src/ui/homeDesk.spec.ts` 与
`src/ui/cultivationDesk.spec.ts` 守住。

道躯页现在也是一册「三章续卷」:道躯总案、行藏周天、卷末云笈由
`src/ui/characterDesk.ts` 的同一份章序装配。行藏四组必须完整覆盖 `STAT_NAMES`,
逐项只报非零 `finalStats.mods`,行内值、来源数与软上限都由同一份账现算;点开一行,
`finalStats.breakdown` 的每笔来源就在原册里铺成带占比条的拆卷。旧的两列小字卡、
`card-ink` 与展开后仍挂着的一句「点一行」都不许回来。真浏览器门在 390 核对三章顺序、
四组行藏、零卡壳、来源拆卷开合与 28px 触达高度,再切到 1280 核对前两组真的并排;
结构与全属性键覆盖由 `src/ui/characterDesk.spec.ts`、`characterDossier.spec.ts` 守住。

修行画像续成同一册章首语法里的两章小传。`identityService` 不再维护手抄的机缘标题,
而是逐条读 `eventDef(id)` 的题名与事件原文;灵兽根因也改为姓名、说明、性格名与
性格说明四项同源结果。真浏览器门 `taskIdentityFolio` 用三条机缘、青羽灵狐与
214 / 38 / 9 三数夹具,在 390 核对两章顺序与章名、四项根因、机缘原文、灵兽身份、
三数、风险判词、「不提供数值加成」、零 `card-ink`、无横向溢出与三数并读;
再切到 195 核对根因值、灵兽身份与三数都收成单列,并走同一道 200% 弹窗缩放判据。
`src/core/identityService.spec.ts` 守住每一种机缘都不掉回泛称、灵兽不再只写随行,
`src/ui/characterDossier.spec.ts` 守住两章数量、同源读口与断点源码契约。

兵解前的往生帖也续在同一册章首语法里:此刻、随魂、交割与最后一笔四章共用
`FolioChapterHead`,内层面板只留分栏与行线,不再各套四边卡与第二张纸底。
`characterDossier.spec.ts` 守住四章数量与去卡壳源码契约;真浏览器门
`taskRebirthFolio` 在 390 核对四枚章首、内层零四边框、道果 / 天赋 / 主损失与全账,
再切到 195 核对摘要、门槛与去留行收成单列且不压窄账目名。

往生帖之后的辞世、回照、择生三程也续在同一册章首语法里。三程路签由
`ReincarnationStageRail` 共用,辞世、回照与择生分别核对 1 / 3 / 至少 5 枚
`FolioChapterHead`;命题、宿慧、交割、灵根、道号、天姿与落印说明只保留开口账线,
旧 `reincarnation-sheet` 与第二张纸底不得回来。章首版式随 `FolioChapterHead` 组件
自身加载,避免读档即身故、人物页样式尚未载入时退成块级长文。`characterDossier.spec.ts`
守住章节数量、去卡壳、组件自带版式与三程共用路签的源码契约;`taskReincarnation` 在 390
三程真走一遍,核对章序、内层零四边框、全账展开、置灰门与 200% 收口。

流派页成路后现在收成一册「铸道续卷」:道途阶梯、下一步、五维形状、实战面、
构筑快照与可选旧筑对照沿同一组 `FolioChapterHead` 续排,原有的 `data-build-stage`
/ `next` / `shape` / `battle` / `loadouts` / `compare` 运行时落点全部保留。390 档核对
五章稳定章序、章名、章首读数、零 `card-ink` 与下一步首屏位置;620 档阶梯与下一步
先并读、五维续整行;1280 档前三章同顶并读,实战章再以整行接续。旧案、实战、快照与
旧筑的四边卡壳退役,阶段、缺口、星级、对局与留存仍分别直读
`buildStageMeter`、`buildCoreGaps`、`ratePower`、`playerMatchups` 与
`measureResilience`。结构由 `src/ui/buildDesk.spec.ts` /
`src/ui/buildDiscovery.spec.ts` 守住,真浏览器排版由 `taskBuildFormed` 复核。

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

行囊四签现在同住一册「行囊续卷」:装备三章(今日检点、九佩、藏品)、丹药两章
(丹房、丹匣)、材料两章(炉材、账材)与法宝一章由 `src/ui/inventoryDesk.ts` 的
同一份章序装配。八章共用 `FolioChapterHead` 的章号、题名、读法与章内真值;
丹药和材料格走 `ItemCell` 的 `ledger` 模式,只留账页分栏线,不再另套四边卡与底色。
九席仍是九个真实的 `data-equip-slot`,藏品仍走原来的 `inventoryWindow` 分批窗口、
`data-inventory-prev` 回翻与焦点链;换装候选和数量仍分别直读 `equipUpgrades` 与同一份
行囊事实。丹方数、丹味与总枚数、两组材料类数、法宝库存与随身数也都直读当前汇总。
卷首容量只留视觉总印,精确件数只在检点账出现一次。运行时门在 390、1280 与 195
三档核对四签八章的章序、题名及真值,九席齐全、零旧卡壳、数据属性同源、主行动不宽于
账行 72%,以及两章并读、章内真值下移与横向溢出。结构与事实源由
`src/ui/inventoryDesk.spec.ts` 与 `src/ui/folioSpread.spec.ts` 守住。

法宝全册共 46 条连续账行,按 6 件一批、最多保留 12 件。卷首先用 `artifactDeskSummary`
把随身位、可炼、欠料与满重收成同一张阵账:夹具摆两件随身时,运行时门要核对席位
2/2、全册 45 件,且「可炼 + 欠料 + 满重」必须正好等于 45;三个读数与账行属性不同源
即红。账行上有名、描述、被动、神通、下一重收益、两种代价与两个动作,分批后全流程
峰值 DOM 667;逐批翻完仍能核对全 45 件,末页回翻与续开焦点走同一套规则。随身不改
排序但仍把焦点留在原账行;炼化会改祭炼等级,若账行因此越过当前窗口,窗口按它新位置
所在批次重开后仍把焦点送回同一件。195 宽下两枚动作、三行账与分页入口改为纵排,
运行时门逐批翻到末页再回翻,并真按一次随身与炼化。

开炉丹方现有 54 张,同样按 6 张一批、最多保留 12 张。卡上有代价、成品、把握、双成率、
存货、短板与「炼制 / 连炼」两枚动作;整册只放在 `max-h-64` 里滚动仍会一次进 DOM,
故改为显式续开。搜索换词只重置窗口、不把焦点抢出输入框;炼制耗料会改变「可炼优先」的排序,
若目标因此越过窗口,按新位置所在批次重开后仍把焦点送回同一张方。运行时门逐批翻到末页再回翻,
并在 195 宽下核对搜索重置与炼制后的焦点。

词条转移的候选是整包装备的横切面:一条不限部位与品质门槛的词条,能落到其余全部藏品上。
候选按 12 件一批、最多保留 24 件;换源词条即换整份清单,窗口回到首批。续开聚焦新露出的
第一件,回翻落当前页首件;195 宽下候选的三段读数不许被压成竖排,续开/回翻入口、候选行与
面板本身也不许挤出边界。300 件后期背包实测 299 件候选逐批开完(24 批),峰值 DOM 978。

收藏图鉴另用一份**全收集夹具**:九册共 809 条全部已收,灵材、丹方、器谱、法宝祭炼
与悟道分支也已点亮;每部功法各择一条悟道,让全部分支可见。夹具直接从内容表生成,
不手抄 id。运行时门会真的切到「收藏」,先核对九柜三列、柜面新得和只开一屉,再把
每册逐页翻到末页并回翻一批。每册每窗最多 48 枚(两批 24);合上的柜屉只留空壳,
柜内正文用 `v-if` 离场,因此切柜不会把已翻开的九册继续堆在 DOM 里。首次进入实测
465 DOM、全流程峰值 715,不再随 809 条整页铺开。预算守住峰值 ≤ 1100,既不让终局图鉴
一次铺满,也不把未识的「???」放出 `UNKNOWN_CAP` 之外。续开/回看入口紧接已收批次、
排在问号墙之前;新得若藏在后续批次,按钮会报「含新得 N」,不让柜面朱记在册内失去落点。

天界道痕满卷固定为 60 则,行内同时有忆战、重写与旧纪入口。此前面板条件误写成
`celTab === 'dao'`,导致道途册混进整卷履历、点「道痕」反而空白;现在道途与道痕
严格互斥,`?tab=marks` 深链也直接落册。道痕列按 12 则一批、最多保留 24 则,
续开聚焦新露出的第一则,回翻落当前窗首则;新痕从头部挤入时窗口回首批。195 宽下
分页入口、60 则可达性与 28px 触控面一起过门。满卷夹具实测逐批 12→24(4 批、滑 3 次),
道痕页首屏 DOM 281、全流程峰值 364。

门庭页的「今日门庭」总账、值日簿与门规同住一张开口续卷,三章共用
`FolioChapterHead` 的壹 / 贰 / 叁、读法与章内真值;首章用的共享 `LedgerPulse`
切成无账首态,只留账格,不再与后两章各用一套章节头。整册只留上下账线与章间线。
总账先报候差、在途、最近归来与一键派发,最近归期直接带弟子名和差事名;四门存底把
唯一目标或同分门与一令齐发的目标对齐。值日簿候差在前、在途按归期续列,任务进度与
归来产出都从同一套结算函数现算;候差弟子先选签、展开票面,再由票尾确认钮派出。
运行时门用 1 名在途 + 2 名闲置夹具核对卷首、最近归期、选签不暗派、确认单签后的
2/1、再次一令齐发后的 3/0 换口;390 核对三枚专属章首与首章无残留账首,1280 核对
首章通栏、值日簿与门规左右并读,195 核对章内真值退行与整页不溢出,避免按钮、计数、
逐单状态与章节骨架各说一套。

器魂页卷首同报「装配 / 闲置 / 可凝」;可凝不再只数行囊资格,而是按道源还能开几炉
折算。天界入口、器魂卷首与凝炼台共用 `core/soulOverview` 的同一份账,付不起时直接
列「尚差 N 道源」,不会在入口先写一句 N 件可凝、点进去才看见按钮全灰。
题签只留道源读数,正文收成一册三章「器魂续卷」:壹「三席阵账」把总账、先手与精确
席位放在同一章,贰「两处门径」承接散置形意与凝炼台,叁「器魂章法」退到卷尾。三章
共用 `FolioChapterHead` 的章号、章名、读法与章内读数,整册只留上下账线和章节线;
阵账仍是 `LedgerPulse`,两处门径与章法不再借 `SectionTitle` 另起一层卡壳。390 宽三章
续排且首屏仍能看见可落子的席位,620 宽两扇门径并读,960 宽门径与章法左右并读;
320 以下先手动作退到标题下方,195 宽三席退成三行、章内读数退到章名下方。有闲置先
装配,三席满先取舍,有可凝件按道源是否够开炉带路,没有可凝件才回行囊。三席仍由
`soulAt` 唯一判断,原器即毁、炉费与席数仍完整交代;结构由 `src/ui/soulDesk.spec.ts`
守住,事实源仍由 `src/core/soulOverview.spec.ts` 守住,真浏览器排版由
`taskSoulListOverflow` 的 390 / 620 / 1280 / 195 四档复核。

藏珍页用两扇阁门取代横页签:功名榜与藏珍阁各是一册两章,门面直接报功名进度或
藏珍总量 / 新得。功名榜的行动章先列最近三策,卷目章把方向收成三列榜牌,只展开一路
卷轴;藏珍阁的行动章摆九柜,柜面报单字印、册名、已录 / 总数与唯一状态,卷目章只抽开
一屉。两侧仍共用 `collectionProgressOverviewFromCodex`、`nearestAchievementRows`
与 `ui/collectionDesk` 的单字印 / 柜格搬运,不在组件里重数条目。`FolioChapterHead`
统一章号、眉题、题名、读法与章内真值,卷目章沿同一卷面续排。390 / 620 宽单列续读,
960 宽才让行动章与卷目章左右并读,195 宽把章内读数退到章名下方、九柜与方向榜退两列。
合上的方向卷轴与柜屉不保留正文,只给 `aria-controls` 留空壳;结构与事实源由
`src/ui/collectionDesk.spec.ts` 守住,真浏览器排版由 `taskCollectionRegister` 的
390 / 620 / 1280 / 195 四档复核。

历练页的「今日行旅」「眼下可往」「秘境」与「行旅之则」共用一张四章开口续卷:
整册只留上下账线与分段线,秘境以嵌入态去掉自己的四边卡;每处地界的身份 / 主行动、
镇压服务账、路况判据与地点说明依次落在同一行。620px 让秘境与规则并读,960px 起
山河主册占右侧大栏、其余三章沿左栏续排;手机单列,195 宽把行动入口退成独立行、
节点移到账行上方、章态退到章名下一行;430px 以下收起重复正文的装饰罗盘并收薄
章首,保证 390 首屏仍能看见出发键。首个可行项仍由统一准入与镇压态现算,结构与
事实源由 `src/ui/adventureDesk.spec.ts` 守住。

名号与灵兽页的双契总览、当前与来路、全谱共用一张连续纸面:卷首只留两条契约索引,
名号与灵兽各收成一册两章,`FolioChapterHead` 统一章号、眉题、题名、读法与章内
真值。正文以「今 / 次 / 伴 / 谱」边栏续排,不再三层各包一张卡。359px 以下仍把双契
并排,只收起册次与长注;279px 以下才退单册,让 320 先看见双契与当前,200% 缩放仍能
操作。960px 起当前章与全谱章左右并读,220px 以下章内真值退到章名下方。两册仍只循环
`titlePage.visible` / `petPage.visible`,续开、回翻、换佩与唤伴继续把焦点送回新选行。
进度夹取与「佩 / 藏 / 未」「伴 / 契 / 未」行态由 `ui/titlesDesk` 统一搬运,结构与
事实源由 `src/ui/titlesDesk.spec.ts` 守住。

洞府正文收成一册两章:壹「七作营造」只走 `headless` 共享此刻账,家底、眼前一锤与
离线存续都在章首之下;贰「山门续账」接七作四章、家业与灵脉,不再各自套入口卡。
两章共用 `FolioChapterHead` 的章号、眉题、题名、读法与章内真值,整册只留上下账线
和章间线,旧通用节题与首章共享账首都已撤掉。每条建筑账行只露当前首项、下一级首项
和一枚行内主升级键;等级、进度与已营计数走石青信息层,主键只用朱砂短笔与淡底标出
真正可动的那一下,完整效果、灵兽/藏经阁联动与连升总账仍由同一个 `aria-expanded`
详情展开。`BuildingLedgerRow` 继续直读 `buildingUpgradeInfo`、
`buildingUpgradeBatchCost` 与 `upgradeBuilding`,不另算一套可升或价格。章序从
`ui/dongfuDesk` 的同一份建筑表装配;离线存续由同一模块的 `offlineCapTiers`
把 `offlineCapHours` 摊成过去 / 现档 / 未来三态,并保证唯一现档。结构与事实源由
`src/ui/dongfuDesk.spec.ts` 守住;390 真渲染门同时核对两章顺序、壹 / 贰章首与
章内真值、首章无共享账首、零 `.section-title`、续账至少五章、恰好七条账行、
续账里零 `card-ink`,主键不宽于账行 72%、建筑行不整行铺色、离线刻度唯一现档且
不铺实心档块,以及首枚可用营造键仍在底栏以上;195(200% 缩放档)再核对离线
刻度退成单列纵轨且无横向溢出。

基线(2026-11-01 实测,本机 + 无头 chromium,后期档,`--seconds 3`):

| 视图 | 最差帧 | 长帧(>50ms) | DOM 节点 |
| --- | --- | --- | --- |
| home / adventure / character | 17ms | 0 | 419–519 |
| cultivation(全习得三册,逐门到底并回翻) | 17ms | 0 | 591 / 峰值 690 |
| **inventory(300 件装备,逐页到底并回翻;法宝、丹方、部位候选与词条转移再翻到末页)** | 17ms | 0 | 672 / 峰值 984 · 法宝 624 · 丹方 725 · 部位候选 984 · 词条转移 978 |
| codex / souls / titles / settings / build / legacy / dongfu / world | 17ms | 0 | 346–772 |
| celestial(道痕满卷 60 则,逐批到底并回翻) | 17ms | 0 | 434 / 峰值 517 |
| collection(全收集九册,逐册到底并回翻) | 17ms | 0 | 465 / 峰值 715 |
| market(300 件,三册切换后寄卖/贡器都逐页到底并回翻) | 17ms | 0 | 389 / 峰值 781 |
| apprentice(门庭卷首 + 在途进度) | 17ms | 0 | 459 |

并做过规模加压验证:背包塞进 **1000 件装备**仍 60fps、最差帧 17ms、零长帧、峰值 682 DOM ——
单批窗口不随总件数膨胀,极端规模 + 引擎每秒 tick 也不会把整张清单重新铺开。全 17 个游戏
视图稳定 ~60fps、零长帧、无崩溃。预算:`最差帧 ≤ 100ms`、`长帧 ≤ 2`、背包首帧 DOM ≤ 800、
背包弹窗峰值 DOM ≤ 1100、
修行功法峰值 DOM ≤ 700、天界道痕峰值 DOM ≤ 700、法宝全册峰值 DOM ≤ 1100、丹方全册峰值 DOM ≤ 1100、
部位候选峰值 DOM ≤ 1100、词条转移峰值 DOM ≤ 1100、坊市峰值 DOM ≤ 1100、
收藏续开峰值 DOM ≤ 1100(前两项环境变量 `PERF_MAX_FRAME_MS` /
`PERF_LONG_FRAMES` 可调)。**DOM 一律数 `body *`**:预算问的是页面上有多少节点,
`head` 里的 `modulepreload` 与字体 `link` 是构建产物、数量随 chunk 拆分变
(实测一次重构让它们多一条,修行页峰值就从 700 跳到 701,而界面一个节点都没多)。改动过会
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
├── data/                 # 内容层:纯静态声明式定义(62 个模块)
│   ├── realms.ts             # 4 界域 · 21 境界
│   ├── regions.ts            # 44 区域
│   ├── enemies.ts            # 132 敌人
│   ├── equipment.ts          # 294 装备模板(一阶一名)
│   ├── affixes.ts            # 113 词条
│   ├── gongfa.ts             # 63 功法
│   ├── gongfaBranches.ts     # 141 悟道分支
│   ├── pills.ts              # 68 丹药
│   ├── artifacts.ts          # 46 法宝
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
├── components/           # 69 个组件(9 组)
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

### 判据不许空转：`fileAt` 与裸 `FILES.find`

`uiLayering.spec` 里有 200+ 处「按路径取一份源文件再断言」的写法。裸的 `FILES.find(...)`
在文件改名或删除之后返回 `undefined`，而 `expect(x?.src).not.toContain("…")` 对
`undefined` **永远通过** —— 于是「把坏代码删干净」与「把整个文件删掉」在判据眼里没有分别。

故 `uiLayering.spec` 里所有查找都走 `fileAt(path)`：找不到就当场抛错，并说明
「这个组件/视图可能被改名或删除，该改守新的那个或删掉它」。`core/assertionLiveness.spec`
守着这条：那两个文件里不许再出现裸的 `FILES.find`。

这是 2026 年那次 `EquipmentCard.vue` 事故的另一半 —— 那次是 `.toContain`（红得早），
换成 `.not.toContain` 就会一直绿着。

### 语义落点与布局落点

模板里的 `data-*` 分两类，判据只该覆盖第一类：

- **语义落点** —— 名字里带 `empty` / `warning` / `state` / `total` / `progress` 的，意味着某处存在一个
  状态需要被断言。这类落点没被判据读过，就等于那件事没人守。
- **布局落点** —— 名字是分区名（`data-dongfu-court`、`data-adventure-masthead`……），只给样式与
  调试用，不读是正常的。

2026 年盘过一次：780 个落点里 271 个从未被读。绝大多数是后一类，但混着
`data-lifespan-warning` —— 它管的是玩家的生死，而它从没被任何判据核过。
补它的判据时**两侧都量**：寿元将尽的要变朱砂、充裕的不许变；只核「出现过」
会漏掉「谁的寿元都被标红」这种更坏的情形。

### 转世三程的弹窗链（写判据时踩过的坑）

点「轮 回」进的是**往生帖**（`data-rebirth-folio`）→ 点页脚 `data-rebirth-enter` → 三程
（`ReincarnationDialog`，第一程 `data-reincarnation-begin`、第二程 `data-reincarnation-review-next`、
第三程 `data-reincarnation-confirm`）。「落印之前」那一章在**第三程**里。

这几处踩过六个坑，记下来免得再走：两个弹窗是**先后关系**而不是包含关系；它们都 teleport 到
body，`page.locator(...)` 的作用域在这儿不稳，页内在 `querySelector` 上点更可靠；
两处按钮文案都含「进入第」，按文案认会点同一颗。

还有一条**已查明**的异常（2026 年第 32 轮结案）：

`TypeError: Cannot read properties of undefined (reading 'id')`，点 `data-rebirth-enter` 时出现。

**根因是探针，不是代码**：探针用 `Math.random = () => 1` 钉死随机源，而 `rng.pick` 取的是
`arr[Math.floor(rand() * arr.length)]` —— `rand() === 1` 时下标正好等于 `arr.length`，**越界**，
返回 `undefined`。`Math.random()` 的值域是 `[0, 1)`，永远不会是 1；探针违反了这个前提。
于是 `offerThemes` 收进一个 `undefined`，下游 `x.id` 当场炸，而堆栈指向了另一个函数。

**怎么查出来的**：第 29–31 三轮回荡在「读源码猜」上（猜了六种全错）。第 32 轮改成
**运行日志取证**——在被怀疑的函数里打一行入参，构建后跑一次，日志显示数据完全正常
（`criticalSamsaraRows in: [12,4,20]`）。数据正常而仍然崩，就只剩「崩的根本不在那里」一种可能。
反查打包产物，堆栈里的 `ie` 是 `prepareReincarnation`。

**为什么不全局换成 0.5**：试过，当场三十余条红——`Math.random = () => 1` 在 46 处探针里是
**刻意**的（让随机选择落到数组最后一项，断言据此写死）。全局改动会打破整屏的对比度与货架判据。
故只改该改的，其余保留。

**留给后人的**：`rng.pick` 的签名 `pick<T>(arr): T` 在撒谎——它可能返回 `undefined`，
非空断言把越界藏起来了。默认随机源下安全，谁注入自定义随机源谁就会撞上。这条已写进
`src/utils/random.ts` 的注释，并由 `core/rngBoundary.spec` 钉住。

**第 33 轮把那条判据补上了**，路径终于走通。还差最后一块拼图：链上**没有**
`data-reincarnation-begin` —— 那个落点属于第一程（`step === "death"`），而第一程的条件是
`ui.deathDialog && !view`，点过兵解之后 `view` 就有了，第一程不再渲染。兵解直接把人送到
第二程（`review`）。所以正确的链是 `[data-rebirth-enter] → [data-reincarnation-review-next]`，
两跳到底。

另记一条阈值经验：清单与「踏入轮回」的距离按**屏数**算，不拍像素数。1257px 在 844 高的屏上
约一屏半，第三程本来就长（命题、天赋、灵根、道号都在这一屏），滚一屏半是正常的；
要拦的是「被挤到好几屏之外」。故取三屏为界。
