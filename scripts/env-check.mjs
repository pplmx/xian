/**
 * 环境自检 —— 包管理器与 Vite+ 都必须是仓库钉住的那一版(及以上)。
 *
 * 为什么值得一道判据:package.json 的 `packageManager` 钉死了 `bun@x.y.z`,
 * 但能跑起脚本的机器不止本地与 GitHub Actions 两台 —— Cloudflare 构建机就曾带着
 * bun 1.2.15 装依赖,撞在 catalog: 协议上(见 commit ae8005b)。那种错会以
 * "安装失败"的形态在最远的一环才炸出来,排查要绕一大圈。这里在最早处拦下:
 * 版本不达标,一句话说明该升级谁、目标是多少,而不是让下游去猜。
 *
 * 第二道(bun 之后):**Vite+ 的 CLI 版本**。仓库在 package.json 的 catalog 里把
 * `vite-plus` 与 `vite` 一起钉在某个版本(两条必须同版),而机器上的 `vp` 可能来自
 * mise / 全局安装 —— 版本一旦比 catalog 新,`vp build` 会当场拒绝:
 *
 *   error: Failed to resolve vite command: GenericFailure, Expected
 *   @voidzero-dev/vite-plus-core@1.4.0, but found @voidzero-dev/vite-plus-core@1.3.0
 *
 * 报错里那句「Run vp migrate」是给**升级仓库**的人看的,照做会把整条工具链搬走;
 * 真实处境是「机器上的 vp 比仓库新」。故这里在最早处把两边的版本都摆出来,
 * 一句话说清该对齐哪一边,而不是让人对着 GenericFailure 猜。
 *
 * 只比**主次版本**:补丁版不改变 CLI 与 core 的契约(实测 1.3.0 的 CLI 认 1.3.x 的 core)。
 *
 * 用法:`bun scripts/env-check.mjs`(已并入 `bun run check`,跑在最前面)。
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8"));
const declared = pkg.packageManager ?? "";

if (!declared.startsWith("bun@")) {
  console.error(
    `package.json 的 packageManager 必须是 \`bun@x.y.z\`,实际:${declared || "(未声明)"}`,
  );
  process.exit(1);
}
const required = declared.slice("bun@".length);

// 本脚本只经 `bun scripts/env-check.mjs` 跑,`process.versions.bun` 就在;
// 留一层 node 直跑的兜底(那种时候 spawn 一个 bun 来问版本)。
let raw = (process.versions.bun ?? "").trim();
if (!raw) {
  try {
    raw = execFileSync("bun", ["--version"], { encoding: "utf-8" }).trim();
  } catch {
    console.error("找不到 bun —— 本仓库的包管理与脚本都走它,请先安装 Bun。");
    process.exit(1);
  }
}

const actual = raw.replace(/^v/, "").split("-")[0];
const parse = (v) => v.split(".").map((n) => Number.parseInt(n, 10));
const [aMaj, aMin, aPat] = parse(actual);
const [rMaj, rMin, rPat] = parse(required);

if ([aMaj, aMin, aPat, rMaj, rMin, rPat].some(Number.isNaN)) {
  console.error(`版本号解析失败:bun 实际 ${raw},要求 >= ${required}`);
  process.exit(1);
}

const ok =
  aMaj > rMaj || (aMaj === rMaj && aMin > rMin) || (aMaj === rMaj && aMin === rMin && aPat >= rPat);

if (!ok) {
  console.error(
    `bun 版本过旧:需要 >= ${required}(package.json 的 packageManager 声明),实际 ${raw}。\n` +
      `  本地:mise / brew / npm 等按你装 bun 的方式升级;\n` +
      `  CI:setup-vp 会按 packageManager 安装,这里红了先看 workflow 有没有手抄旧版本。`,
  );
  process.exit(1);
}

/**
 * 仓库钉住的 vite-plus 版本 —— catalog 是唯一事实源(`vite` 与 `vite-plus` 必须同版,
 * 后者是 CLI、前者是它内嵌的 core;不同版就是上面那条 GenericFailure)。
 */
const catalog = pkg.catalog ?? {};
const pinnedCli = catalog["vite-plus"] ?? "";
const pinnedCore = (catalog.vite ?? "").replace(/^npm:@voidzero-dev\/vite-plus-core@/, "");

if (!pinnedCli || !pinnedCore) {
  console.error(
    "package.json 的 catalog 里必须同时钉 `vite-plus`(CLI)与 `vite`(它内嵌的 core)。\n" +
      `  实际:vite-plus=${pinnedCli || "(缺)"} · vite=${pinnedCore || "(缺)"}`,
  );
  process.exit(1);
}

const majorMinor = (v) => v.split(".").slice(0, 2).join(".");
if (majorMinor(pinnedCli) !== majorMinor(pinnedCore)) {
  console.error(
    `catalog 里 vite-plus 与 vite 不同版:${pinnedCli} vs ${pinnedCore}。\n` +
      "  这两条必须同版 —— CLI 会按自己的版本去要同版的 core,差一个次版本就 GenericFailure。",
  );
  process.exit(1);
}

/** 机器上的 `vp` 报的版本(取不到就跳过这一道:不是每台机器都把 vp 放进 PATH) */
let cliRaw = "";
try {
  cliRaw = execFileSync("vp", ["--version"], { encoding: "utf-8", timeout: 10_000 });
} catch {
  cliRaw = "";
}
const cliVersion = /^vp v?([\d.]+)/m.exec(cliRaw)?.[1] ?? "";

/**
 * 版本错位只**告警**,不挡门。
 *
 * 仓库自己是好的:`bun run build` / `bun run check` 都经 bun 注入的
 * `node_modules/.bin`,解析到的永远是 catalog 那一版。坏的只有「人直接敲 `vp`」
 * 这一条路 —— 那是机器的事,不是仓库的事。判据若在此处 exit 1,就等于让一台机器的
 * 全局 CLI 版本把整个仓库锁成不可提交,而修它还要动仓库之外的安装。
 * 故这里说清处境与两条出路,然后放行。
 */
if (cliVersion && majorMinor(cliVersion) !== majorMinor(pinnedCli)) {
  console.warn(
    `\n环境提醒:机器上的 vp 是 ${cliVersion},仓库钉的是 ${pinnedCli} —— 直接敲 \`vp build\` 会 GenericFailure。\n` +
      `  \`bun run …\` 走的仍是仓库自己那份,不受影响。想直接敲 vp 的话,选一条:\n` +
      `    ① 用仓库自己那份(与 CI 完全一致):\`./node_modules/.bin/vp build\`;\n` +
      `    ② 把机器上的 vp 降到 ${pinnedCli}(mise / 全局安装按你的方式改)。\n` +
      `  别去跑 \`vp migrate\` —— 那是升级仓库工具链的动作,不是修这台机器的版本错位。\n`,
  );
}

console.log(
  `环境自检通过:bun ${actual} >= ${required}(packageManager 一致)` +
    (cliVersion
      ? ` · vp ${cliVersion}${majorMinor(cliVersion) === majorMinor(pinnedCli) ? ` 与 catalog ${pinnedCli} 同版` : ` 与 catalog ${pinnedCli} 不同版(仅告警)`}`
      : " · 未探测到 vp,跳过 CLI 版本核对"),
);
