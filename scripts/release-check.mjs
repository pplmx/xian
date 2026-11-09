#!/usr/bin/env bun
/**
 * 发版前体检 —— `bun run release:check`。
 *
 * 判据在 core/releaseCheck.ts(纯函数,有单测);这里只做三件本地才能做的事:
 * 读版本、看 git 状态、数一数自上次 tag 以来有多少提交动过"只在 tag 上跑"的路径。
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkRelease } from "../src/core/releaseCheck.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/*
 * 只在 tag 流线上跑、本地门看不到的路径。
 *
 * `package.json` 必须在内 —— 打包配置(`build.asar` / `build.win.icon` /
 * `build.appId` / `build.files`)全写在它的 `build` 字段里,而那些**只有打包时生效**。
 * v0.0.2 栽的就是其中一处:`build.win.icon` 指着一枚 48×48 的 favicon,
 * electron-builder 要 ≥256,本地全绿、`--win` 当场失败。
 *
 * 它也会带来噪音(依赖升级同样改这个文件),但这条只是 `!` 提醒不是拦截,
 * 而漏掉它的代价是「本地绿、发不出去」。宁可多看一行。
 */
const TAG_ONLY = ["android", "electron", ".github/workflows/build.yml", "package.json"];

const git = (args) =>
  execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

const pkg = await Bun.file(join(ROOT, "package.json")).json();
const version = String(pkg.version ?? "");

const dirty = git(["status", "--porcelain"]).length > 0;
const tagExists = git(["tag", "-l", `v${version}`]).length > 0;
const notesExists = existsSync(join(ROOT, "docs", "release-notes", `v${version}.md`));
// 正文里的绝对链接按 tag 写死(见 docs/development.md 的「发版」):复制上一版最容易忘改,
// 改漏了 Release 页就是一片碎图
let staleNoteTags = [];
if (notesExists) {
  const text = await Bun.file(join(ROOT, "docs", "release-notes", `v${version}.md`)).text();
  const tags = new Set([...text.matchAll(/\/v(\d+\.\d+\.\d+)\//g)].map((m) => `v${m[1]}`));
  staleNoteTags = [...tags].filter((t) => t !== `v${version}`);
}

// 上一次 tag(按版本号排序取最后一个);一个都没有时退化成"整份历史都算新"
let lastTag = "";
try {
  const tags = git(["tag", "-l", "v*", "--sort=-v:refname"]).split("\n").filter(Boolean);
  lastTag = tags[0] ?? "";
} catch {
  lastTag = "";
}
let tagOnlyCommits = 0;
try {
  const range = lastTag ? `${lastTag}..HEAD` : "HEAD";
  tagOnlyCommits = Number(git(["rev-list", "--count", range, "--", ...TAG_ONLY])) || 0;
} catch {
  tagOnlyCommits = 0;
}

const verdict = checkRelease({
  version,
  notesExists,
  dirty,
  tagExists,
  tagOnlyCommits,
  staleNoteTags,
});

console.log(`发版体检 · 版本 v${version}${lastTag ? `(上次 ${lastTag})` : "(仓库里还没有 tag)"}`);
for (const b of verdict.blockers) console.log(`  ✗ ${b}`);
for (const w of verdict.warnings) console.log(`  ! ${w}`);
if (verdict.ok) {
  console.log("  可以打 tag。接下来:");
  for (const step of verdict.next) console.log(`    ${step}`);
} else {
  console.log("  先解决上面这些,再打 tag。");
}
process.exit(verdict.ok ? 0 : 1);
