# 开发与集成

## 接进你自己的项目

```bash
# 一 · 按 tag 装(推荐;别跟 main,库还在长)
bun add github:pplmx/wanxiang-engine#v0.1.18

# 二 · 本地路径依赖
#    package.json: "wanxiang-engine": "file:../packages/engine"
bun run build              # 在 packages/engine 里先出一次产物

# 三 · 打包成 tgz 再装
cd packages/engine && npm pack        # 得到 wanxiang-engine-0.1.18.tgz
npm i ./wanxiang-engine-0.1.18.tgz

# 四 · monorepo 工作区
#    把 packages/engine 加进根 package.json 的 workspaces 即可
```

装 git 依赖时,包会**自己跑一次 `prepare` 把 `dist` 编译出来** —— 这就是 `package.json` 里那行
`"prepare": "tsc -p tsconfig.build.json"` 的用处。否则别人装到的是一份没有产物的源码,
`import 'wanxiang-engine'` 会直接找不到入口。仓库里刻意**不提交 dist**,只让它在安装/发布时生成。

## 本目录与独立仓库的关系

本库的**上游**在一个更大的游戏工程里(那个工程的 `packages/engine` 子目录),
<https://github.com/pplmx/wanxiang-engine> 是它拆出来的独立仓库(也就是本仓库)。
**选一处开发即可,不要两边同时改**:

```bash
# 走法一(推荐):在独立仓库里开发
git clone git@github.com:pplmx/wanxiang-engine.git && cd wanxiang-engine
bun install && bun run check

# 走法二:在上游工程里开发,再推过去
cd <上游工程>
git subtree push --prefix=packages/engine git@github.com:pplmx/wanxiang-engine.git main
```

两边都改会分叉 —— `git subtree push` 遇到分叉会直接拒绝,那时先
`git subtree pull --prefix=packages/engine git@github.com:pplmx/wanxiang-engine.git main` 合回来。

拆库本身(如果要再拆一次):

```bash
# 一 · git subtree 拆出去(保留这段历史)
git subtree split -P packages/engine -b engine-main
git push git@github.com:<你>/wanxiang-engine.git engine-main:main

# 二 · 直接复制(不要历史)
cp -r packages/engine ../wanxiang-engine && cd ../wanxiang-engine && git init
```

## 常跑的命令

```bash
cd packages/engine
bun install          # 只装 typescript + vitest + @types/node(开发依赖)
bun run check        # 类型检查 + 用例 + 出 dist + 产物自检 + 发布包自检 + 跑示例
bun run build        # 只出 dist(含 .d.ts)
bun run examples     # 跑 examples/ 下的示例
bun run type-check:examples   # 只查示例的类型(走 tsconfig.examples.json)
```

`bun run check` 里的**发布包自检**做的不只是"装上能跑":它真 `npm pack`、摊进临时项目,
再按包名 import 一次(含内容包子路径),**用包名导出的东西从零装一份新题材的世界并跑通一圈**
(不碰任何内容包 —— 内容包是样例,要证明的是"自己写一份也能用"),
然后**用一个 `.mts` 消费者跑 `tsc --strict`** ——
`moduleResolution` 会试 `bundler` 与 `node16` 两种。多加这一步是因为踩过一次:
`companions.d.ts` 里一句 `from './attributes'` 漏了 `.js`,库自己怎么跑都正常,
而 `node16` 的使用者一编译就红(TS2835)。同一条纪律也做成了静态判据:源码里的相对导入必须带 `.js`。

示例是跑在 Node/Bun 上的命令行程序,所以单独一份 `tsconfig.examples.json` 给它们开 Node 类型;
**库源码那份 tsconfig 刻意不引 Node 类型** —— 免得谁顺手在 `src` 里用了 `process` / `Buffer`
还一路绿灯(库必须能在浏览器里跑)。这条差别是 CI 抓出来的:在上游工程里因为根目录已经有
`@types/node` 而看不出来,搬到独立仓库里一装就红。

上游工程那边还有两条守着"拆得干净"的判据(它们在工程侧,独立仓库里跑不了):

| 命令 | 钉住的事 |
| --- | --- |
| `bun run check:engine` | 产物入口齐全、能被 Node import、换皮世界跑通一圈、坏配置被拦住、发布包内容与"真装一遍"(含使用者侧的 `tsc --strict`)、工程侧 59 处引用全走公开入口 |
| `bun run check:engine:standalone` | 整份目录复制到临时目录(不带 dist 与 node_modules)后,独立编译、独立跑用例、独立 import 产物、跑示例,并断言源码里没有任何工程侧引用 |

库这一侧还有一条与"公开面"有关的判据:**每个运行时导出都必须在代码位置上被真正用过**
(`scripts/verify-dist.mjs`)—— 注释、import 行、字符串字面量里的名字都不算。这条是审计出来的:
75 个导出里曾有 9 个只在 `publicApi.spec.ts` 的名字清单里露过面(`clamp` / `formatAmount` /
`numberNumeric` / `mulberry32` / `seedFromString` / `randomRng` / 两张默认表 / `progressText`),
现已各配一条判据(`src/publicBehavior.spec.ts`),并让自检常驻。

文档里的代码块也有判据:**块前面一行写 `<!-- compile-check -->` 就会进自检** ——
它被抽出来,在"真装了一遍发布包"的临时项目里用 `tsc --strict` 编一遍。
文档腐烂最常见的方式是"片段停在两个版本前",而读者是照着抄的人;没标的不查,
因为很多片段本来就是节选。

只要有一处"顺手用了工程侧的别名或配置",`check:engine:standalone` 就会红 ——
而这种依赖待在同一个仓库里是看不出来的。

## 示例要覆盖到什么程度(两道判据各管一段)

示例不是宣传材料,是**判据** —— 它进类型检查、进独立成库自检(`搬到临时目录后照样跑`),
也进公开面的"有人真用过"审计。但"覆盖到什么程度"要说清,否则审计一次换一种口径:

| 判据 | 管什么 | 拦住的典型事故 |
| --- | --- | --- |
| **每个模块至少有一份示例走到**(`scripts/verify-dist.mjs` 的「示例覆盖自检」) | 模块级 | `realms` 与 `numeric` 曾整块零示例 —— 一个是等级体系的正门、一个是换大数实现的口子 |
| **每个运行时导出都有人在代码位置用过**(同文件的「公开面行为判据自检」+ `src/publicBehavior.spec.ts`) | 导出级 | 9 个导出只在名字清单里露过面,改名会红、行为写错不会 |

**不承诺**的是"75 个导出逐个都有一行示例":`clamp` / `asRecord` / `progressText` 这类小工具
单独写一段没有真实循环可讲,示例会从"能读的小循环"稀释成"导出清单朗读";它们的判据在各自模块的
用例里。内容包(`presets/`)另算出处:要么被示例 import,要么出现在 README / 本目录的装配片段里 ——
`examples/from-zero.ts` 那份**故意不引用任何内容包**,正是要证明"自己写一份也能用"。
