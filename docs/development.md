# 开发

## 环境

[Bun](https://bun.sh) 1.2+(本仓库的包管理、测试与脚本都走它)。
TypeScript、Vite、Vitest 等都在 `package.json` 里,`bun install` 一次就够。

```bash
bun install
bun dev            # 开发服务器(vite --host)
bun run build      # 类型检查 + 生产构建(现代目标:日常开发与 CI 门用这一条)
bun run build:release  # 发布构建:多带一份 legacy 兜底(见「首屏与构建时长」)
bun preview        # 预览构建结果
```

## 命令一览

| 命令 | 作用 |
| --- | --- |
| `bun run test` | 全量用例(全量 301 个 spec / 2823 例;本作自己那部分 221 个 / 2229 例) |
| `bun run test:report` | 一次完整测试 + 按系统分类的摘要 + 文档例数核对:未登记分类、文档里的例数与本次运行不符都会直接红并列出(CI 与发布闸用它替代 `test`,少跑一遍测试) |
| `bun run check` | 类型检查(`vue-tsc -b`)+ ESLint |
| `bun run lint` | 只跑 ESLint |
| `bun run build:release` | 发布构建(`XIAN_LEGACY=1`):每个 chunk 再走一遍 legacy 兜底 |
| `bun run check:legacy` | 发布产物自检:legacy 那一套真的出得来吗(`scripts/legacy-artifacts.mjs`) |
| `bun run check:first-paint` | 首屏预算:冷启动解码字节 / FCP / 楷体换上(`scripts/first-paint.mjs`) |
| `bun run test:engine` | 只跑公共库(万象引擎)的用例 |
| `bun run build:engine` | 出公共库的 dist |
| `bun run check:engine` | 库的产物自检:编译 → 从 dist import → 跑完整一圈 → 发布包真装一遍 → 宿主引用方式 → 独立仓与本仓同树 |
| `bun run check:engine:standalone` | 库的独立成库自检:复制到临时目录后独立编译 / 跑用例 / 跑示例 |

> **别用 `bun test`。** 那是 Bun 自带的测试器,不读本仓库的路径别名(`@/…`),
> 会整片报"找不到模块"。要用 `bun run test`(即 Vitest)。

## 测试与判据

这个仓库的取向是:**能用机械判据回答的,不靠自觉。**

| 判据 | 钉住的事 |
| --- | --- |
| 用例 | 全量 301 个 spec / 2823 例(本作自己那部分 221 个 / 2229 例),按 9 个系统分类归档 —— 新 spec 没登记分类,`test:report` 会红;例数由 `test:report` 对照本次运行实录核对,加删用例忘了改文档也会红 |
| 数值对账 | 四套系统迁移到万象引擎时,与**迁移前冻结的旧口径**逐位相等(见 [engine.md](./engine.md)) |
| 数据自审 | 内容表的头注释计数与真实数组长度比对、敌人 / 区域 / 模板引用闭合、文本与词表覆盖 |
| 排版与冒烟 | 全量路由 × 五档视口的渲染审计(`scripts/layout-check.mjs`)、界面冒烟(`ui-smoke.mjs`)、Service Worker 离线层(`offline-check.mjs`) |
| 首屏预算 | 冷启动解码字节 / FCP / 楷体换上三条上限(`scripts/first-paint.mjs`,自带静态服务与 4G 限速);发布产物还要核 legacy 那一套出得来(`legacy-artifacts.mjs`) |
| 文档与实现一致 | `scripts/docs-check.mjs`(已并入 `bun run check`):文档里引用的 `bun run` 脚本必须真存在、反引号路径与相对链接必须存在、「全量 N 个 spec」必须等于真实文件数 —— 实测抓到过一次 25% 的漂移(文档写着 199 个 spec / 2044 例时,实际已是 289 / 2647) |
| 平衡审计 | 经济闭环、战力膨胀、修为收入、曲线节奏各有模拟器与阈值断言(`*Sim.spec` / `*Audit.spec`) |
| 库的发布面 | 万象引擎另有三条:产物能被 Node import、发布包真装一遍并按包名 import、独立成库后仍能编译跑用例 |

## 首屏与构建时长

两条规矩:**要发出去的那一份才带 legacy**,以及**首屏传多少字节、第几毫秒看得见字,各有上限**。

### 日常构建与发布构建

legacy(`@vitejs/plugin-legacy`,给 Chrome 51 / Android 7 的兜底)只在 `XIAN_LEGACY=1` 时打
(`bun run build:release`)。改之前它每次都打:本机 32s 的构建里 26s(82%、106 次调用)花在
这一步,而开发、PR 门、单元测试跑的都是现代浏览器,legacy 产物一个字节都不会被请求。

- 日常与 CI 门:`bun run build`(现代目标,本机约 16s);
- 发布路径(Pages 部署、Electron、APK):`bun run build:release`,并跟一条
  `bun run check:legacy` 当场核 legacy 与现代化两份产物都在、`index.html` 的 `nomodule`
  兜底装载也接上了 —— 否则「老内核打开一片白屏」这种事会藏在绿着的门后面。

### 首屏预算(实测:4G 档、390×844、冷缓存)

| 读数 | 改前 | 现在 | 上限 |
| --- | --- | --- | --- |
| 冷启动解码字节 | 2681KB(楷体 1783KB) | 1124KB(楷体 236KB) | 1500KB |
| FCP | 692ms | 1020ms | 1400ms |
| 楷体换上(swap 那一刻) | 2255ms | 2159ms | 2800ms |
| 构建时长(现代 / 发布) | 32s / 41s | 16s / 41s | 90s / 240s |

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
**构建那一步本身**(`bun scripts/build-timed.mjs [--release]`,把构建跑一遍并计时,超上限
即红 —— 只拦「成倍长回去」,上限按本机读数四到五倍给,CI 机器慢也吃得下);`build.yml`
另有 `legacy-artifacts` 作业真打一次发布产物再核。

推送到 `main` 会走 GitHub Actions 同一道闸:类型检查、ESLint、用例全绿后才部署 Web / PWA 与镜像。

## 项目结构

```text
packages/engine/          # 公共库:万象引擎(等级/属性/装备/副本四套系统的可配置内核)
src/
├── data/                 # 内容层:纯静态声明式定义(51 个模块)
│   ├── realms.ts             # 4 界域 · 21 境界
│   ├── regions.ts            # 44 区域
│   ├── enemies.ts            # 132 敌人
│   ├── equipment.ts          # 288 装备模板(一阶一名)
│   ├── affixes.ts            # 113 词条
│   ├── gongfa.ts             # 63 功法
│   ├── gongfaBranches.ts     # 141 悟道分支
│   ├── pills.ts              # 63 丹药
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
├── core/                 # 逻辑层(122 个模块 + 192 个 spec,另有 *Sim.ts 平衡模拟器)
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
├── stores/               # Pinia 状态(15 个,绝大部分自动持久化)
├── views/                # 17 个页面
├── components/           # 34 个组件(8 组)
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
