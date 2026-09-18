<div align="center">
  <img src="images/app/1.png" alt="云隐修仙录" title="云隐修仙录" width="720" />

  **一念修行 · 云深不知处**

  一款文字版修仙放置游戏 —— 水墨国风,四界二十一境,
  后台预解算的回合制战斗,断网也能接着修。

  [![Release](https://img.shields.io/github/v/release/pplmx/xian?style=flat&logo=github&label=Release)](https://github.com/pplmx/xian/releases/latest)
  [![CI](https://github.com/pplmx/xian/actions/workflows/deploy.yml/badge.svg)](https://github.com/pplmx/xian/actions/workflows/deploy.yml)
  [![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0)
  [![在线试玩](https://img.shields.io/badge/%E5%9C%A8%E7%BA%BF%E8%AF%95%E7%8E%A9-yunyin.wenzi.games-8b5cf6)](https://yunyin.wenzi.games)
</div>

## 目录

- [这是什么](#这是什么)
- [游戏特色](#游戏特色)
- [截图](#截图)
- [快速开始](#快速开始)
- [多端安装](#多端安装)
- [发版](#发版)
- [Docker 部署](#docker-部署)
- [公共库:万象引擎](#公共库万象引擎)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [设计规范](#设计规范)
- [质量与判据](#质量与判据)
- [交流](#交流)
- [许可证](#许可证)

## 这是什么

从凡人引气入体开始,一路修到混沌道祖 —— **四界二十一境**,每境九层至圆满,突破要渡劫。
历练是派遣式的:派出去、等一段时间、回来看遭遇与掉落;战斗在后台一次算完再回放,所以
**关掉页面、断网、隔一晚再回来**,该发生的事一件不少。

三条贯穿全程的取向:

- **离线是常态,不是补丁**:挂机收益、自动挑战、读档补票都按"玩家可能一周没上线"设计;
- **后台算完再回放**:在线、离线、批量模拟共用同一份结算,不会出现"两次算不一样";
- **规则与数值分开**:四套数值系统已抽成独立内核(见[万象引擎](#公共库万象引擎)),
  本作只写内容。

## 游戏特色

**四界二十一境,渡劫而上。** 人间界(炼气 → 渡劫)、仙界(真仙 → 大罗)、神界(神人 → 神帝)、
混沌海(混沌真灵 → 混沌道祖),每境九层至圆满,突破需渡劫 —— 5 类天劫(雷鸣 / 逆流 / 裂魂 / 铁躯 / 重压)
各有克制之法。11 种灵根(五行 + 风雷冰光暗 + 混沌)与 33 种天赋决定这一世修炼的快慢与难关。

**63 部功法,141 条分支。** 主修、辅修、秘术三类可同时装配;练至圆满开启悟道分支,
同一部功法因此走出完全不同的流派 —— 加什么、舍什么,是这一世自己的选择。

**44 个区域、132 种敌人,排着队等你。** 历练是派遣式的:定好时长出发,回来看遭遇,首领通关解锁下一区;
途中穿插 81 个随机事件 + 11 类机缘,以及道侣、灵兽、天时与灵脉各自的变数。

**搭配,而不是单堆。** 10 个装备槽位、288 种模板(一阶一名)、113 条词条、9 级品质;
同类词条按 1 / 0.75 / 0.5 / 0.25 递减,攻击生命速度等超过软阈值后收益衰减 ——
把同一种堆满不如凑出组合。器魂是另一层:飞升后数值归零,6 类 × 6 阶器魂占 3 个槽位,改的是路数。

**技艺不足不是"不能炼",而是炼出什么样的成品。** 9 门技艺(识材 / 辨药 / 配伍 / 凝丹 / 淬药 / 养丹 /
控火 / 锻打 / 铭纹)各自成长,进炉之前你有得选:凑材料、换配比、还是赌一把。50 种丹药、45 件法宝。

**灵兽、道侣与师尊:让这一世不一样,而不是更快。** 14 只灵兽每界至少两只可挑,性子会改历练中的遭遇走向;
10 位道侣与 4 位师尊各有目标与理念 —— 它们不进效率链,只让你在同一个世界里活出不同的样子。

**轮回之后,重开不是从零。** 寿元耗尽入轮回,5 个阶段逐世积累"见识";17 种人生主题决定这一世的开局与禁忌。
真仙之后还有 4 条道途、4 重天界远征、3 种试炼、6 种契约、8 类变数,组合出每个周期都不同的规则宇宙。

**图鉴与目标:看得见的进度。** 灵材谱、悟道录、敌人志、典籍志逐条解锁;62 个成就、32 个主线任务
与 29 枚称号贯穿全程,每日任务负责给当天的方向 —— 打开游戏永远知道下一步做什么。

**国风音画。** Tone.js 播放 FluidR3 真实乐器采样:古筝主旋律、琵琶对答、木鱼点击、太鼓鼓点、
编钟突破、编磬提示;界面是水墨色系,三端同一份配色与字体(见[设计规范](#设计规范))。

## 游戏系统一览

| 系统 | 说明 |
| --- | --- |
| 境界 | 4 界域 × 21 境 × (九层 + 圆满),突破渡劫,5 类天劫 |
| 灵根 | 11 种(五行 + 风雷冰光暗 + 混沌),影响修速、劫难减免、功法契合 |
| 天赋 | 33 种,分凡赋 / 灵赋 / 天赋 / 道赋四等 |
| 功法 | 63 部（主修 / 辅修 / 秘术），圆满后开启 141 条悟道分支 |
| 历练 | 44 区域 × 132 敌人,派遣制会话,81 事件 + 11 机缘,首领解锁下一区 |
| 战斗 | 后台完整预解算再回放,速度 / 暴击 / 护盾 / 吸血 / 反击 / 控制 / 组合技 |
| 装备 | 10 槽位 · 32 阶 × 9 部位 = 288 模板(一阶一名)× 113 词条 × 9 品质,词条递减 + 软阈值 |
| 器魂 | 飞升后数值归零,6 类 × 6 阶器魂占 3 个槽位,改路数而非堆数值 |
| 洞府 | 7 建筑离线产出 + 4 条灵脉投资分红 |
| 技艺 | 9 门(识材 / 辨药 / 配伍 / 凝丹 / 淬药 / 养丹 / 控火 / 锻打 / 铭纹)独立成长 |
| 炼制 | 50 丹药 + 45 法宝,技艺水平决定成品品相而非成败 |
| 灵兽 | 14 只,每界至少两只可挑,出战加成与性子各异 |
| 术数 | 星象 28 宿 · 紫微 12 宫 14 主星 · 周易 64 重卦 · 奇门八门 |
| 人缘 | 10 位道侣 + 4 位师承,只给方向与叙事,不进效率链 |
| 轮回 | 5 阶段积累见识，17 种人生主题定开局与禁忌 |
| 终局 | 4 道途 + 4 天界远征 + 3 试炼 + 6 契约 + 8 变数 + 短期秘境 / 天道熔炉 |
| 任务 | 32 主线任务 + 每日任务 + 62 成就 + 29 称号 + 图鉴(灵材谱 / 悟道录 / 敌人志 / 典籍志) |

## 截图

| | |
| --- | --- |
| ![界面](images/1.png) | ![界面](images/2.png) |

更多界面见 [images/app/](images/app)(启动页、主页、修行、历练、装备等)。

## 快速开始

需要 [Bun](https://bun.sh) 1.2+。

```bash
bun install          # 安装依赖
bun dev              # 开发服务器
bun run build        # 类型检查 + 生产构建
bun preview          # 预览构建结果
```

**测试与自检**(以下命令各有分工,CI 走的是同一套):

```bash
bun run test           # 全量用例:199 个 spec 文件 / 2044 个用例
bun run test:report    # 按系统分类的测试摘要(数值 / 战斗 / 流派 / 曲线 / 经济 / 终局 / 决策…)
bun run check          # 类型检查(vue-tsc)+ ESLint
bun run test:engine    # 只跑公共库(万象引擎)的用例
bun run build:engine   # 出公共库的 dist
bun run check:engine   # 库的产物自检:编译 → 从 dist import → 跑完整一圈 → 发布包真装一遍
bun run check:engine:standalone  # 库的独立成库自检:复制到临时目录后独立编译 / 跑用例 / 跑示例
```

> 注意用 `bun run test`,不要用 `bun test` —— 后者会调 Bun 自带的测试器而不是 Vitest,
> 且不读本仓库的路径别名,会整片报"找不到模块"。

界面与离线相关还有三条脚本判据:`scripts/layout-check.mjs`(全量路由 × 五档视口的排版审计)、
`scripts/ui-smoke.mjs`(冒烟)、`scripts/offline-check.mjs`(Service Worker 离线层)。

## 多端安装

- **Web / PWA**:部署 `dist/`(或走下方 Docker 镜像),移动浏览器打开即玩,可「添加到主屏幕」。
  Service Worker 会缓存静态资源,**首次在线打开后断网重开也能进游戏**(发版更新即时生效,不卡旧版本)。
  **iOS 上请务必「添加到主屏幕」**:Safari 会在网页七天没被打开后清掉它的本地数据(存档与离线缓存一起没),
  已安装的 Web App 不受这条规则约束 —— 游戏检测到这种情况会在主页提示一次,设置页里也常驻可查。
- **Android**:CI 会把签好的 APK 作为 `android-apk` 产物上传;本地出包在
  `android/app/build/outputs/apk/release/yunyin-<版本号>.apk`。覆盖安装需签名一致 ——
  自己构建的包与官方签名不同,要先卸载旧版。
- **Windows 桌面(Electron)**:`pkg/yunyin-<版本号>-win.zip`,解压后运行其中的 `云隐修仙录.exe`;
  未签名 exe 被杀毒软件误报是通病,加入白名单即可。

```bash
bun run build:electron   # Windows 桌面客户端(Electron)
bun run build:android    # 同步 Web 产物到 Android 工程(Capacitor)
bun run build:apk        # 直接出 Release APK
```

> **关于 Android 签名**:签名私钥文件(`android/release.keystore`)作为历史遗留随仓库分发,
> 它只提供「用同一把钥匙签出的 APK」这一致性,**不构成官方性与防伪** —— 任何克隆仓库的人
> 理论上都能用它签出包。因此签名口令绝不入库:CI 由 GitHub Secrets
(`KEYSTORE_STORE_PASSWORD` / `KEYSTORE_KEY_PASSWORD`)注入,本地出包请临时 `export` 这两个环境变量
(或建一个不入库的 `android/keystore.local.properties`)。请以本仓库 release 页与 Docker 镜像为准。

## 发版

推送到 `main` 会走同一道闸:类型检查、ESLint、单元测试全绿后才部署 Web / PWA 到 Pages、推送 Docker 镜像。

**发版是一个显式动作 —— 推 tag。** 构建 Electron 与 Android 产物、发布 Release 的流水线只在 tag 上触发:

```bash
# 1. 先提 package.json 的版本号(它决定 APK 的 versionName / versionCode)
# 2. 打 tag 并推上去
git tag v1.34.0
git push origin main v1.34.0
```

这条流水线第一件事是核对 tag 与 package.json 是否同一个版本,对不上直接红掉 ——
免得发出「Release 页写着 v1.34.0、装到手机上却是 1.33.0」的包。

## Docker 部署

```bash
# 方式一:使用预构建镜像(推荐)
docker run -d -p 8080:80 ghcr.io/pplmx/xian:latest

# 方式二:指定版本 / 提交
docker run -d -p 8080:80 ghcr.io/pplmx/xian:<version>
docker run -d -p 8080:80 ghcr.io/pplmx/xian:<commit-sha>

# 方式三:本地构建
docker build -t yunyin-xiuxian .
docker run -d -p 8080:80 yunyin-xiuxian
```

访问 `http://localhost:8080` 即可开始游戏。镜像推 `linux/amd64` 与 `linux/arm64` 两种架构,
标签为 `latest` / `<版本号>` / `<提交 sha>`。反向代理、docker-compose、子路径部署与故障排查见
[README.Docker.md](README.Docker.md)。

## 公共库:万象引擎

等级(境界)、属性、装备、副本四套系统已经从本作里**抽成独立内核** —— 不依赖 Vue / Pinia / 浏览器 API,
换一套名称与内容就能搭出自己的游戏:境界叫什么、装备叫什么、属性叫什么、副本叫什么,全都在配置里。

> 独立仓库:<https://github.com/pplmx/wanxiang-engine>(版本 `v0.1.0`)
> 本作自己也按包名引用它:源码里写的是 `from 'wanxiang-engine'`,
> 开发期由 Vite / TS 的解析配置指向 `packages/engine` 源码;`bun run check:engine`
> 会守住"只经公开入口引用、别名不许复活"这条。

```jsonc
// 别人引用它的方式(任选;推荐按 tag 引用,别跟 main)
"wanxiang-engine": "github:pplmx/wanxiang-engine#v0.1.0"
"wanxiang-engine": "file:packages/engine"
//   cd packages/engine && npm pack   →   npm i ./wanxiang-engine-0.1.0.tgz
```

本作与独立仓库之间同步(**选一处开发,别两边同时改**):

```bash
git subtree push --prefix=packages/engine engine main   # 本作 → 库
git subtree pull --prefix=packages/engine engine main   # 库 → 本作
```

**本作的成长曲线、词条合并、装备生成、副本规则、功法、炼制、任务判据、灵兽性格、离线账与存档迁移
都已经由这个库承担**,应用侧留下的是内容数据与依赖本作 GNum 战力表的数值解析。
每一项迁移都留着一份**与迁移前冻结口径逐位对账**的判据(21 境 × 10 层的名目 / 寿元 / 修为 / 三维 / 成功率、
200 组来源下的词条合并、6 档层级 × 40 种子的装备生成且随机流一致……)——
清单与判据见 [docs/engine.md](docs/engine.md),库自身的说明见
[packages/engine/README.md](packages/engine/README.md)。

## 技术栈

| 技术 | 版本 | 用途 |
| --- | --- | --- |
| Vue 3 | 3.5 | 组合式 API + `<script setup>` |
| TypeScript | 6.0 | strict 严格类型检查 |
| Vite | 8 | 构建与开发服务器(legacy 插件兜旧 WebView) |
| Pinia | 3 | 状态管理(15 个 store,绝大部分自动持久化) |
| Tailwind CSS | 3.4 | 水墨色系语义色与暗色主题 |
| Vue Router | 4 | 客户端路由(hash 模式) |
| Tone.js | 15 | FluidR3 乐器采样播放(BGM + SFX) |
| CryptoJS | 4 | 存档 AES 加密 |
| lucide-vue-next | 0.577 | 图标库 |
| Vitest | 5 | 单元测试与平衡审计(199 个 spec / 2044 例) |
| Electron | 39 | Windows 桌面客户端打包 |
| Capacitor | 8 | Android 客户端打包 |

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

## 设计规范

一句话:**水墨色系、竖版文字风格、移动端优先**,三端共用同一份字体与配色变量。
细节(配色变量怎么同时喂给透明度与 `color-mix`、内置楷体子集的取舍、动效与无障碍)见
[docs/design.md](docs/design.md)。

## 质量与判据

"这东西是对的"在本作里尽量由机械判据回答,而不是靠自觉:

| 判据 | 钉住的事 |
| --- | --- |
| 用例 | 199 个 spec 文件 / 2044 个用例,按 9 个系统分类归档(`bun run test:report` 少登记一类就红) |
| 数值对账 | 四套系统迁移到万象引擎时,与**迁移前冻结的旧口径**逐位相等(见 [docs/engine.md](docs/engine.md)) |
| 数据自审 | 各内容表的头注释计数与真实数组长度比对、敌人 / 区域 / 模板的引用闭合、文本与词表覆盖 |
| 排版与冒烟 | 全量路由 × 五档视口的渲染审计、界面冒烟、Service Worker 离线层各有一条脚本判据 |
| 平衡审计 | 经济闭环、战力膨胀、修为收入、曲线节奏各有模拟器与阈值断言 |
| 库的发布面 | 万象引擎另有三条:产物能被 Node import、发布包真装一遍按包名 import、独立成库后仍能编译跑用例 |

推送到 `main` 会走 GitHub Actions 同一道闸:类型检查、ESLint、用例全绿后才部署。

## 交流

- QQ 群:[920930589](https://qm.qq.com/q/2BVaTTwDkI)
- 在线试玩:[yunyin.wenzi.games](https://yunyin.wenzi.games)
- 问题与建议:开 [issue](https://github.com/pplmx/xian/issues)

## 许可证

本项目采用 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.zh-hans) 许可协议:
允许自由共享和演绎,但 **未经作者书面授权,禁止用于任何商业目的**。详见 [LICENSE](LICENSE)。

**第三方资源**:内置的楷体子集取自 [霞鹜文楷 LXGW WenKai](https://github.com/lxgw/LxgwWenKai),
按 SIL OFL 1.1 分发(协议全文随产物一起放在 `public/fonts/OFL.txt`)。它的授权与本项目的
CC BY-NC 4.0 各自独立 —— 该字体允许商用,但再分发时请保留协议文本与字体名。
