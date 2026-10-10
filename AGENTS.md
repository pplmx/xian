<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at <https://viteplus.dev/guide/>.

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

本仓库是「玄枢录」——文字修仙放置游戏。这份文件是往界面、数据、提交、发版里加东西时要遵守的本地约定；设计契约不重抄，数值与设计细则是 `docs/design.md`、`docs/development.md` 的权威（炼丹见 `docs/alchemy.md`）。

> 原先另有一份只差大小写的 `agents.md`，已合并进本文件：两份「约定」并存就是两本账；而且名字只差大小写的两个文件在 Windows / macOS 上根本没法同时检出，而 agent 读的通常是 `AGENTS.md` —— 那份「操作纪律」等于没人读。

## 界面：丹青双眼，别抄他作的「皮」

- `docs/design.md` 是配色唯一权威：强色只有朱砂（行动）与石青（信息）；文字不叠透明度；同色底最多 6%；纸上的墨只有三档。
- 借鉴另一个项目（yunyin-xiuxian）时，学它的**装配规则与交互**，不照搬它的**界面语言**。例：功法门类是对应槽位的规则，不是装饰标签；不引入实心彩色胶囊、也不加第三个强色当导航主色。分类/导航用「墨字 + 淡底 + 朱砂小印」。
- 移动端优先：按 390px 与 200% 缩放防折行，窄屏只留关键信息，详情进弹窗 / aria-label。

## 功法：主 / 辅 / 秘是装配规则

- `main`（主修，占唯一主修席）、`sub`（辅修，占辅修席）、`secret`（秘术，装配时也占**辅修席**）既是书目门类，也决定装配槽位。
- 同一部功法在书目与装配上可能叫法不同，文案要把席位说穿：秘术列表写「在辅修席」、弹窗按钮写「放入 / 移出辅修席」。
- 五行、品阶、悟道分支不是第四类分类：五行是灵根倾向提示，品阶只管栏内排序与名字染色，悟道是满级后的一次性选择（转世保留）。

## 改动纪律：不做两本账

- **界面上出现的每个数字都与结算同源**。奖励文案 = `grantReward`/`rewardTextAtTier` 同一套换算（灵石按掉落层级折实）；加成真值 = 引擎合并（buffMods / finalStats，人物页「丹药与增益」行同源）；进度 = 发赏判定（evalCond / 库的 goals）。文案里不许手写会被常数改动的数字 ——「改常数就撒谎」。
- **决策信息完整**：按钮「付不起 / 不可行」要置灰，灰的同时把差多少列出来（尚差 灵石 X · 尘 Y）；给决策前把数字摊开（奖励、代价、把握、生效时长、成功率），不能只给定性形容词（「皆有裨益」「更容易」不算数）。
- **让看不见的机制可见**：技艺进度、buff 叠加份数（「叠 N」）、合并真值（「现效合计」）、一次服药的上限（「至多可攒」/ 快捷卡「已顶」）、天时对渡劫与产出的影响 —— 该露的都要露进界面，不许只活在注释或 README 里。

## 文案与叙事契约

- 中文一律简体（避传统 順/帶/有边 等字；`kaiFontCoverage.spec` 机械守）。
- 丹药 / 增益的叙事：作用载体是服用者自身（概念契约见 `docs/alchemy.md`）。名为「稳炉 / 控火 / 淬炼」者先反问「这药吃进谁嘴里」—— 说不通就是叙事该改，不是机制该改。

## 提交

- 功能**最小完备**就提交，不攒大坨；单个小完备增量可独立提交。
- 先写用例（RED）→ 最小实现（GREEN）：新功能必带测试；纯逻辑进 `core` 并可直接测，视图只做薄接线。
- commitlint 走 conventional（类型：feat/fix/refactor/test/docs/chore/…）。
- commit message 用 bullet 一条条说明改了什么、为什么，不写一句话流水账。

## 测试与事实源

- `vp check`（oxfmt / oxlint / ts / rumdl）+ `vp test` 必过才能提交。
- 界面结构决策由 `uiLayering.spec.ts` 钉住（判据=回归守卫，改 UI 后若该文件断言挂，是回归不是噪音）；配色/对比由 `src/ui/palette.spec.ts` 钉住。
- 文案、排序、数值一律引数据源/核心算法，不重造：词条文案用 `@/ui/statNames` 的 `modsText`，别自己另拼一份；栏内排序（品阶降序→准入境界→名）与界面同源。

## 发版

- 发版是显式动作：**提 `package.json` 的版本 → 打同名 tag → `git push origin main vX.Y.Z`**。构建 Electron / APK 并发布 Release 的流水线只在 tag 上触发，细节与判据见 `docs/development.md` 的「发版」。
- **Release 正文写在仓库里，不写在页面上**：`docs/release-notes/` 下与 tag 同名的文件就是那一版的正文（release job 优先取它，没有则退回自动生成的提交清单）。手改页面上的正文会被下一次流水线重跑冲掉。
- **只在 tag 流水线上跑的路径**（`android/`、`electron/`、`.github/workflows/build.yml`）改过之后，本地门全绿不等于发得出去 —— 用一次 tag 真跑通它。本仓两次发版都栽在「本地永远绿、只有 CI 才执行到」的代码上（Android 签名口令的 Groovy 遮蔽、Electron 的隐式发 Release）。
- 引擎与宿主是两条版本线：万象引擎的 tag 与 Release 属于 engine 仓，别在宿主仓给它打 tag。

## 跨仓吸收纪律（读参考仓时）

- **只读对比，不照抄**：产出带 `file:line` 证据的候选短名单，不做任何改动。
- **吸收三道关**，过了才吸收：
  ① 结构化适配 —— 与本仓架构、口径、已测不变式合不合；
  ② 契约冲突 —— 与 `pillValue.spec` 九条、`docs/alchemy.md`、既有单测冲不冲；
  ③ ROI 与迁移成本 —— 核心小改 / 纯 UI / 仅文案，成本是否配得上收益。
- 没过的记一句「为什么不」；真的更好、真的适合、迁移可控，才吸收。
