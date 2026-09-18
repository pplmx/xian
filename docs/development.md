# 开发

## 环境

[Bun](https://bun.sh) 1.2+(本仓库的包管理、测试与脚本都走它)。
TypeScript、Vite、Vitest 等都在 `package.json` 里,`bun install` 一次就够。

```bash
bun install
bun dev            # 开发服务器(vite --host)
bun run build      # 类型检查 + 生产构建
bun preview        # 预览构建结果
```

## 命令一览

| 命令 | 作用 |
| --- | --- |
| `bun run test` | 全量用例(199 个 spec / 2044 例) |
| `bun run test:report` | 按系统分类的测试摘要;有未登记分类会直接红并列出文件 |
| `bun run check` | 类型检查(`vue-tsc -b`)+ ESLint |
| `bun run lint` | 只跑 ESLint |
| `bun run test:engine` | 只跑公共库(万象引擎)的用例 |
| `bun run build:engine` | 出公共库的 dist |
| `bun run check:engine` | 库的产物自检:编译 → 从 dist import → 跑完整一圈 → 发布包真装一遍 → 宿主引用方式 |
| `bun run check:engine:standalone` | 库的独立成库自检:复制到临时目录后独立编译 / 跑用例 / 跑示例 |

> **别用 `bun test`。** 那是 Bun 自带的测试器,不读本仓库的路径别名(`@/…`),
> 会整片报"找不到模块"。要用 `bun run test`(即 Vitest)。

## 测试与判据

这个仓库的取向是:**能用机械判据回答的,不靠自觉。**

| 判据 | 钉住的事 |
| --- | --- |
| 用例 | 199 个 spec / 2044 个用例,按 9 个系统分类归档 —— 新 spec 没登记分类,`test:report` 会红 |
| 数值对账 | 四套系统迁移到万象引擎时,与**迁移前冻结的旧口径**逐位相等(见 [engine.md](./engine.md)) |
| 数据自审 | 内容表的头注释计数与真实数组长度比对、敌人 / 区域 / 模板引用闭合、文本与词表覆盖 |
| 排版与冒烟 | 全量路由 × 五档视口的渲染审计(`scripts/layout-check.mjs`)、界面冒烟(`ui-smoke.mjs`)、Service Worker 离线层(`offline-check.mjs`) |
| 平衡审计 | 经济闭环、战力膨胀、修为收入、曲线节奏各有模拟器与阈值断言(`*Sim.spec` / `*Audit.spec`) |
| 库的发布面 | 万象引擎另有三条:产物能被 Node import、发布包真装一遍并按包名 import、独立成库后仍能编译跑用例 |

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
│   ├── pills.ts              # 50 丹药
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
├── core/                 # 逻辑层(110 个模块 + 165 个 spec,另有 *Sim.ts 平衡模拟器)
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
# 2. 打 tag 并推上去
git tag v1.34.0
git push origin main v1.34.0
```

这条流水线第一件事是核对 tag 与 package.json 是否同一个版本,对不上直接红掉 ——
免得发出「Release 页写着 v1.34.0、装到手机上却是 1.33.0」的包。

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
git subtree push --prefix=packages/engine engine main   # 本作 → 库
git subtree pull --prefix=packages/engine engine main   # 库 → 本作
```

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
