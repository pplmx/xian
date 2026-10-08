<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

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

本仓库是「玄枢录」——文字修仙放置游戏。下面是往界面、数据、提交里加东西时应遵守的本地约定；数值与设计细则是 `docs/design.md`、`docs/development.md` 的权威。

## 界面：丹青双眼，别抄他作的「皮」

- `docs/design.md` 是配色唯一权威：强色只有朱砂（行动）与石青（信息）；文字不叠透明度；同色底最多 6%；纸上的墨只有三档。
- 借鉴另一个项目（yunyin-xiuxian）时，学它的**装配规则与交互**，不照搬它的**界面语言**。例：功法门类是对应槽位的规则，不是装饰标签；不引入实心彩色胶囊、也不加第三个强色当导航主色。分类/导航用「墨字 + 淡底 + 朱砂小印」。
- 移动端优先：按 390px 与 200% 缩放防折行，窄屏只留关键信息，详情进弹窗 / aria-label。

## 功法：主 / 辅 / 秘是装配规则

- `main`（主修，占唯一主修席）、`sub`（辅修，占辅修席）、`secret`（秘术，装配时也占**辅修席**）既是书目门类，也决定装配槽位。
- 同一部功法在书目与装配上可能叫法不同，文案要把席位说穿：秘术列表写「在辅修席」、弹窗按钮写「放入 / 移出辅修席」。
- 五行、品阶、悟道分支不是第四类分类：五行是灵根倾向提示，品阶只管栏内排序与名字染色，悟道是满级后的一次性选择（转世保留）。

## 提交

- 功能**最小完备**就提交，不攒大坨；单个小完备增量可独立提交。
- commitlint 走 conventional（类型：feat/fix/refactor/test/docs/chore/…）。
- commit message 用 bullet 一条条说明改了什么、为什么，不写一句话流水账。

## 测试与事实源

- `vp check`（oxfmt / oxlint / ts / rumdl）+ `vp test` 必过才能提交。
- 界面结构决策由 `uiLayering.spec.ts` 钉住（判据=回归守卫，改 UI 后若该文件断言挂，是回归不是噪音）；配色/对比由 `src/ui/palette.spec.ts` 钉住。
- 文案、排序、数值一律引数据源/核心算法，不重造：词条文案用 `@/ui/statNames` 的 `modsText`，别自己另拼一份；栏内排序（品阶降序→准入境界→名）与界面同源。
