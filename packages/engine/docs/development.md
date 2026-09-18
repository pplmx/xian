# 开发与集成

## 接进你自己的项目

```bash
# 一 · 按 tag 装(推荐;别跟 main,库还在长)
bun add github:pplmx/wanxiang-engine#v0.1.5

# 二 · 本地路径依赖
#    package.json: "wanxiang-engine": "file:../packages/engine"
bun run build              # 在 packages/engine 里先出一次产物

# 三 · 打包成 tgz 再装
cd packages/engine && npm pack        # 得到 wanxiang-engine-0.1.5.tgz
npm i ./wanxiang-engine-0.1.5.tgz

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

示例是跑在 Node/Bun 上的命令行程序,所以单独一份 `tsconfig.examples.json` 给它们开 Node 类型;
**库源码那份 tsconfig 刻意不引 Node 类型** —— 免得谁顺手在 `src` 里用了 `process` / `Buffer`
还一路绿灯(库必须能在浏览器里跑)。这条差别是 CI 抓出来的:在上游工程里因为根目录已经有
`@types/node` 而看不出来,搬到独立仓库里一装就红。

上游工程那边还有两条守着"拆得干净"的判据(它们在工程侧,独立仓库里跑不了):

| 命令 | 钉住的事 |
| --- | --- |
| `bun run check:engine` | 产物入口齐全、能被 Node import、换皮世界跑通一圈、坏配置被拦住、发布包内容与"真装一遍"、工程侧 25 处引用全走公开入口 |
| `bun run check:engine:standalone` | 整份目录复制到临时目录(不带 dist 与 node_modules)后,独立编译、独立跑用例、独立 import 产物、跑示例,并断言源码里没有任何工程侧引用 |

只要有一处"顺手用了工程侧的别名或配置",`check:engine:standalone` 就会红 ——
而这种依赖待在同一个仓库里是看不出来的。
