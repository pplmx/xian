/**
 * 环境自检 —— 包管理器必须是 package.json 声明的版本(及以上)。
 *
 * 为什么值得一道判据:package.json 的 `packageManager` 钉死了 `bun@x.y.z`,
 * 但能跑起脚本的机器不止本地与 GitHub Actions 两台 —— Cloudflare 构建机就曾带着
 * bun 1.2.15 装依赖,撞在 catalog: 协议上(见 commit ae8005b)。那种错会以
 * "安装失败"的形态在最远的一环才炸出来,排查要绕一大圈。这里在最早处拦下:
 * 版本不达标,一句话说明该升级谁、目标是多少,而不是让下游去猜。
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

console.log(`环境自检通过:bun ${actual} >= ${required}(packageManager 一致)`);
