# 开发与集成

## 接进你自己的项目

```bash
# 一 · 装发布版压缩包(推荐;每次发版都作为 release 附件挂上去)
bun add https://github.com/pplmx/wanxiang-engine/releases/download/v0.1.22/wanxiang-engine-0.1.22.tgz
npm  i https://github.com/pplmx/wanxiang-engine/releases/download/v0.1.22/wanxiang-engine-0.1.22.tgz

# 二 · 本地路径依赖
#    package.json: "wanxiang-engine": "file:../packages/engine"
bun run build              # 在 packages/engine 里先出一次产物

# 三 · 自己打一份再装(离线 / 内网分发用这条)
cd packages/engine && npm pack        # 得到 wanxiang-engine-0.1.22.tgz(就是上面那个附件)
npm i ./wanxiang-engine-0.1.22.tgz

# 四 · monorepo 工作区
#    把 packages/engine 加进根 package.json 的 workspaces 即可
```

装**发布版压缩包**这条不跑任何脚本:包里已经是产物(`prepack` 在**打包时**把 `dist` 编译好),
所以消费者那边不需要 `typescript`,也不需要允许任何安装脚本。

**为什么不把 `bun add github:...#v0.1.22` 当首选**(实测过,不是猜测):

* 那条路要在**安装现场**编译,而构建工具不该是运行时依赖;
* **bun** 默认拦掉依赖的安装脚本 —— 装完包里没有 `dist`,`import 'wanxiang-engine'` 直接报
  "Cannot find package";把包加进 `trustedDependencies` 放行之后,git 依赖**也不带
  devDependencies**,于是 `tsc: command not found`);
* **npm** 装得进去,但拿到的同样是**没有产物的源码**(构建脚本只在打包时跑),所以
  "两个包管理器行为一致"这句不成立 —— 一致的是:**git tag 这条现在两边都不该用**。

压缩包这条路没有这些问题:**包里已经是产物**,不跑任何脚本,谁装都一样。
仓库里仍然刻意**不提交 dist** —— 它只在 `npm pack` / 发布时生成,作为 release 附件发出去。

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

## 发版(五步,一步都不能省)

版本口径见 [CHANGELOG](../CHANGELOG.md) 开头:**攒批发布、默认只加 patch** ——
初期攒到几十个改动再发一个版本是常态,发出来的 tag 是给外面的使用者一个可 pin 的点。

```bash
# 1 · 改版本号(只加 patch,除非有对外口径变化)
$EDITOR package.json                     # 例:"version": "0.1.22" → "0.1.23"(只加 patch)
# 2 · CHANGELOG 的「未发布」那一节定稿成带日期的一节(## 0.1.22 — YYYY-MM-DD)
$EDITOR CHANGELOG.md
# 3 · 同步文档里的版本引用(README 的安装块与版本块、本文件的安装块与 npm pack 例)
#     漏了会红:`bun run check` 里的「版本引用自检」按 package.json 逐处核对
# 4 · 推两个仓库
git push origin main
git subtree push --prefix=packages/engine engine main    # 或在独立仓库里直接推
# 5 · 打 tag + 发 release(gh 的 --target 用完整 SHA,别用分支名)
gh release create v0.1.22 --target "$(git -C packages/engine rev-parse main)" --title v0.1.22 --notes-file ...
# 6 · 把打包产物挂成 release 附件 —— 使用者装的就是它(README 的首选安装方式就是这个 URL)
cd packages/engine && npm pack && gh release upload v0.1.22 wanxiang-engine-0.1.22.tgz --clobber
gh api repos/pplmx/wanxiang-engine/releases/tags/v0.1.22     # 核对 tag、包内版本与附件
```

第 6 步**忘了也不要紧**:`.github/workflows/release.yml` 会在 release 发布时自动做同一件事
(checkout 该 tag → `bun run check` → `npm pack` → `gh release upload` → 核对附件名),
所以它是一根保险丝 —— 本地那条是快路径,workflow 那条保证"迟早会挂上"。
要重传某个旧 tag 的附件,手动触发这个 workflow 并填 tag 即可。

两条经验,都是真踩过的:

- **`--target` 要写完整 SHA**:写分支名时,`gh` 打出来的 tag 可能落在旧提交上(而这个错误要到
  有人按 tag 装库时才现形);
- **别忘了把 tgz 传上去**:README 的安装命令指向 release 附件,而这个 URL 里有两个版本号 ——
  「版本引用自检」会盯住它们(含 `/download/vX.Y.Z/` 那一段),但附件本身得真的存在:
  少了它,使用者拿到的是 404,而我们所有本地闸门照样全绿(`gh api` 那一行就是为这个核对的);
- **别用 `gh run list` + sleep 轮询 CI**:慢且没必要 —— 判据在本地就能跑(`bun run check`),
  CI 只是把同一件事在干净环境里再做一遍;真要等,等一个具体对象(某次 run 的结论),不要盲等。

## 维护期(0.1.22 起)

库的**功能边界**写在 README 的「到哪儿为止」一节里;这一节写的是**流程** ——
以后什么情况才动它、动之前跑什么、动完看哪几条证据。

**什么情况才动**(按优先级):

1. **真错**:行为与文档或判据说的不一致(先补一条会红的判据,再修);
2. **判据漏洞**:某一类腐烂没人盯着 —— 已经补过三处:文档片段只编不跑、文档里的命令与路径
   没人核对、相对链接没人点(这一条刚补,当场抓到 `docs/development.md` 里一个指向
   `./CHANGELOG.md` 的死链,它在仓库根上);
3. **文档与实现不一致**:十八道自检会先替你抓一遍;
4. **新增能力层不在列** —— 要新玩法请在库外组合(见 README 的边界与[组装指南](./assembly.md))。

**动之前跑什么**(都在这个目录下):

```bash
bun run check     # 类型 + 用例 + 出产物 + 18 道自检(含发布包自检:真装一遍 + 文档片段真跑)
bun run tuning    # 31 份消融的读数(只有改了数值或曲线时才需要)
```

**动完之后看哪几条证据**(每一项都得是当场跑出来的,不能是"应该没问题"):

| 证据 | 怎么看 |
| --- | --- |
| 库自己 | `bun run check` 全绿 —— 用例数 / 文件数 / 自检数会印在最后几行 |
| 独立仓能自己站住 | 推 main 之后等那次 CI 的结论(`gh run watch <id>`,等一个具体对象,别盲等) |
| 发布包真的可用 | `npm pack` 出来的 tgz 装进空项目跑一遍;发版时 release 保险丝会再验一次 |
| 宿主(第一个定制用户) | 上游工程那道门里的"静态检查 + 单元测试"与"构建"两步 |

**发版**:仍走上面那五步 + 附件,但**只在攒够一批**时才发 —— 几份判据或文档改动不值得占一个版本号。

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
| `bun run check:engine` | 产物入口齐全、能被 Node import、换皮世界跑通一圈、坏配置被拦住、发布包内容与"真装一遍"(含使用者侧的 `tsc --strict`)、工程侧 65 处引用全走公开入口 |
| `bun run check:engine:standalone` | 整份目录复制到临时目录(不带 dist 与 node_modules)后,独立编译、独立跑用例、独立 import 产物、跑示例,并断言源码里没有任何工程侧引用 |

库这一侧还有一条与"公开面"有关的判据:**每个运行时导出都必须在代码位置上被真正用过**
(`scripts/verify-dist.mjs`)—— 注释、import 行、字符串字面量里的名字都不算。这条是审计出来的:
75 个导出里曾有 9 个只在 `publicApi.spec.ts` 的名字清单里露过面(`clamp` / `formatAmount` /
`numberNumeric` / `mulberry32` / `seedFromString` / `randomRng` / 两张默认表 / `progressText`),
现已各配一条判据([`src/publicBehavior.spec.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/src/publicBehavior.spec.ts)),并让自检常驻。

文档里的代码块也有判据:**块前面一行写 `<!-- compile-check -->` 就会进自检** ——
它被抽出来,在"真装了一遍发布包"的临时项目里用 `tsc --strict` 编一遍,**再用 bun 真跑一遍**。
编过不等于跑得对(默认值不对、空表崩掉、导出少一个,编译期都看不出来),而文档承诺的是
"照抄能用" —— 所以两道都要过;真跑这一步只在有 bun 的环境里做,没有时如实说"没跑"。
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
| **每个运行时导出都有人在代码位置用过**(同文件的「公开面行为判据自检」+ [`src/publicBehavior.spec.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/src/publicBehavior.spec.ts)) | 导出级 | 9 个导出只在名字清单里露过面,改名会红、行为写错不会 |
| **定制表里写出来的旋钮真的存在**(同文件的「定制表旋钮自检」) | 文档承诺级 | 表里写着 `costFn`、源码里却已改名 —— 读者照着写,然后对着编译错误怀疑自己 |
| **每条 `throw` 都有人真的触发过**(同文件的「报错口径自检」) | 报错级 | 23 处抛错里曾有 15 处零触发:报错成了死代码、文案悄悄漂移(而使用者看到的第一句话往往就是它) |
| **数字基线**([`src/baseline.spec.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/src/baseline.spec.ts)) | 数值级 | 三份内容包与一批吃默认值的配置被压成摘要写死:曲线或默认值一变就红;有意改时要显式更新摘要 + 在 CHANGELOG 写清为什么 |

**不承诺**的是"每个导出都有一行示例":`clamp` / `asRecord` / `progressText` 这类小工具
单独写一段没有真实循环可讲,示例会从"能读的小循环"稀释成"导出清单朗读";它们的判据在各自模块的
用例里。内容包(`presets/`)另算出处:要么被示例 import,要么出现在 README / 本目录的装配片段里 ——
[`examples/from-zero.ts`](https://github.com/pplmx/wanxiang-engine/blob/main/examples/from-zero.ts) 那份**故意不引用任何内容包**,正是要证明"自己写一份也能用"。
