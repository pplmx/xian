# 开发

## 环境

[Bun](https://bun.sh) 1.4.2(与 `package.json` 的 `packageManager` 一致,CI 与 Docker 都按它装;过低会被 `scripts/env-check.mjs` 拦下)。
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
| 包管理器 + 脚本执行器 | **Bun** 1.4.2 | 装依赖、锁文件(`bun.lock`)、跑 `package.json` 脚本;`packageManager: bun@1.4.2` 明确的正是这一层 |
| 工具链兼容基准 | **Node** ≥ 22.18 | `engines.node` 表达的是"跑 Vue / Vite / vue-tsc / Oxlint 这条工具链至少要 Node 22.18",**不是**「应用跑在 Node 上」(CI 的 `setup-vp` 就装 Node 22) |
| 生产运行时 | **浏览器** | Web / PWA 的最终宿主 |
| 平台运行时 | **Electron / Capacitor** | 把同一份 Web 产物包进 Windows 桌面与 Android 的壳 |

`engines.node >= 22.18` 与 `packageManager: bun@1.4.2` 并存**不矛盾**:一个约束
「工具链要跑在 ≥22.18 的 Node 上」,一个约束「安装与脚本托管交给 Bun」,管的是两层。
只要包管理走 Bun、工具链跑在 ≥22.18 的 Node 上即可。

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

## 命令一览

| 命令 | 作用 |
| --- | --- |
| `bun run test` | 全量用例(全量 333 个 spec / 3158 例;本作自己那部分 253 个 / 2563 例) |
| `bun run test:report` | 一次完整测试 + 按系统分类的摘要 + 文档例数核对:未登记分类、文档里的例数与本次运行不符都会直接红并列出(CI 与发布闸用它替代 `test`,少跑一遍测试) |
| `bun run check` | 环境自检(`scripts/env-check.mjs`)+ 类型检查(`vue-tsc -b`)+ Oxlint(`vp lint`,类型感知 + 模板级规则由 vite.config 的 lint 块配置)+ 文档自检(`scripts/docs-check.mjs`) |
| `bun run lint` | 只跑 Oxlint(经 Vite+ 的 `vp lint`) |
| `bun run check:first-paint` | 首屏预算:冷启动解码字节 / FCP / 楷体换上(`scripts/first-paint.mjs`) |
| `bun run shots` | 从当前构建重拍 README / 文档的界面图(默认写 `images/app/*.webp`;`--theme dark` / `--device desktop` / `--out <目录>` 可选) |
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
| 用例 | 全量 333 个 spec / 3158 例(本作自己那部分 253 个 / 2563 例),按 9 个系统分类归档 —— 新 spec 没登记分类,`test:report` 会红;例数由 `test:report` 对照本次运行实录核对,加删用例忘了改文档也会红 |
| 数值对账 | 四套系统迁移到万象引擎时,与**迁移前冻结的旧口径**逐位相等(见 [engine.md](./engine.md)) |
| 数据自审 | 内容表的头注释计数与真实数组长度比对、敌人 / 区域 / 模板引用闭合、文本与词表覆盖 |
| 排版与冒烟 | 全量路由 × 五档视口的渲染审计(`scripts/layout-check.mjs`)、界面冒烟(`ui-smoke.mjs`)、Service Worker 离线层(`offline-check.mjs`)。前两者**并发**跑(30 / 15 个独立任务,`--jobs` 或 `LAYOUT_JOBS` / `UI_SMOKE_JOBS` 调路数,默认按核数、上限 8)—— 一轮从约 17 分钟压到约 5 分钟 |
| 首屏预算 | 冷启动解码字节 / FCP / 楷体换上三条上限(`scripts/first-paint.mjs`,自带静态服务与 4G 限速) |
| 文档与实现一致 | `scripts/docs-check.mjs`(已并入 `bun run check`):文档里引用的 `bun run` 脚本必须真存在、反引号路径与相对链接必须存在、「全量 N 个 spec」必须等于真实文件数 —— 实测抓到过一次 25% 的漂移(文档写着 199 个 spec / 2044 例时,实际已是 289 / 2647) |
| 平衡审计 | 经济闭环、战力膨胀、修为收入、曲线节奏各有模拟器与阈值断言(`*Sim.spec` / `*Audit.spec`) |
| 库的发布面 | 万象引擎另有三条:产物能被 Node import、发布包真装一遍并按包名 import、独立成库后仍能编译跑用例 |

## 首屏与构建时长

首屏传多少字节、第几毫秒看得见字、构建跑多快,各有上限。

### 构建

生产构建就是 `bun run build`(类型检查 + `vp build`)。曾经为了 Chrome 51 / Android 7
那批老内核,发布路径还要多跑一遍 legacy 兜底(本机 32s 的构建里 26s 花在这一步)——
对个人项目纯属死重,已整条拆除:没有 `build:release`,也没有 `XIAN_LEGACY` 开关。

### 首屏预算(实测:4G 档、390×844、冷缓存)

| 读数 | 改前 | 现在 | 上限 |
| --- | --- | --- | --- |
| 冷启动解码字节 | 2681KB(楷体 1783KB) | 1124KB(楷体 236KB) | 1500KB |
| FCP | 692ms | 1020ms | 1400ms |
| 楷体换上(swap 那一刻) | 2255ms | 2159ms | 3400ms |
| 楷体子集总字节 | — | 236KB(5 片) | 600KB |
| 构建时长 | 32s | 16s | 90s |

> 2026-10-06 重校准:楷体换上上限 2800 → 3400 —— 旧值按"本机无 preload 2159ms"
> 定的,而 CI 量的是随代码量增长的排版,迁移前后稳定落在
> ~2922-2952ms(9c739b9 迁移前就 2922),预算比实测还低,Pages 连红数推。
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

推送到 `main` 会走 GitHub Actions 同一道闸:类型检查、Oxlint、用例全绿后才部署 Web / PWA 与镜像(CI 用 `voidzero-dev/setup-vp` 装 Vite+ 工具链,Node 22)。

## 项目结构

```text
packages/engine/          # 公共库:万象引擎(等级/属性/装备/副本四套系统的可配置内核)
src/
├── data/                 # 内容层:纯静态声明式定义(57 个模块)
│   ├── realms.ts             # 4 界域 · 21 境界
│   ├── regions.ts            # 44 区域
│   ├── enemies.ts            # 132 敌人
│   ├── equipment.ts          # 288 装备模板(一阶一名)
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
├── core/                 # 逻辑层(136 个模块 + 218 个 spec,另有 *Sim.ts 平衡模拟器)
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
├── components/           # 38 个组件(8 组)
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
# 2. 打 tag 并推上去(版本号以 package.json 为准,这里只是例子)
git tag vX.Y.Z
git push origin main vX.Y.Z
```

这条流水线第一件事是核对 tag 与 package.json 是否同一个版本,对不上直接红掉 ——
免得发出「Release 页写着 v1.35.0、装到手机上却是 1.34.0」的包(数字只是示例,
判据看的是两者**相等**,不是某个具体版本)。

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
