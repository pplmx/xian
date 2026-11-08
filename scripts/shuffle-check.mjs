/* 打乱用例顺序跑一遍 —— 抓「靠书写顺序在工作」的测试 */
import { spawnSync } from "node:child_process";

/*
 * ## 为什么值得单独一道门
 *
 * `bun run test` 按文件书写顺序跑,全绿是常态。而本仓的测试共享几处**模块级状态**
 * (`caveEvent` / `enlightenmentEvent` / `saveReader`),还有一批 describe 靠
 * 「文件里前一个 describe 建好了 pinia」在工作。这些在书写顺序下都不会露馅 ——
 * 打乱之后才现形。
 *
 * 实测:第一次跑这个检查时打乱顺序红了 41 条,分散在 7 个文件;连着修了两轮
 * (Round 27 / 28)才让十种种子全部稳定。**那些失败一次都没在常规门禁里出现过。**
 *
 * ## 为什么用固定种子
 *
 * 随机种子会让这道门自己变成"偶发红"。固定成 1 之后,同一份代码永远同一顺序 ——
 * 红了就是真问题,而不是运气。要换顺序验证更广时手动 `--sequence.seed=N` 跑。
 *
 * ## 为什么不进 pre-commit
 *
 * 一轮 43 秒(本机实测)。提交前那一下已经有 `vp run verify`,再塞 43 秒不值得;
 * 它的位置是 CI 与 `check:all`。
 */
const started = Date.now();
const res = spawnSync(
  "bunx",
  ["vitest", "run", "--sequence.shuffle", "--sequence.seed=1", "--reporter=dot"],
  { stdio: "inherit", shell: false },
);
const seconds = Math.round((Date.now() - started) / 1000);
if (res.status !== 0) {
  console.error(
    `\n✗ 按打乱顺序跑时有用例失败 —— 它们依赖执行顺序,在常规 \`bun run test\` 里看不出来。` +
      `\n  多半是模块级状态没重置(见 core/singleWriter 的 resetSaveReader、` +
      `core/earlyGameService 的 resetCaveEvent / resetEnlightenmentEvent),` +
      `\n  或者某个 describe 忘了 setActivePinia。`,
  );
  process.exit(1);
}
console.log(`✓ 打乱用例顺序(${seconds} 秒)全部通过 —— 没有靠书写顺序工作的用例`);
