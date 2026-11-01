/**
 * Host ↔ standalone sync gate — `packages/engine` and wanxiang-engine `main`
 * must be the same tree.
 *
 * Forgetting `git subtree push` is silent: this repo stays green, the
 * standalone repo still serves last week's code. Comparing trees makes that
 * fail here, with the push command printed.
 *
 * Wired into `bun run check:engine`. Override the remote with
 * ENGINE_SYNC_REMOTE / ENGINE_SYNC_REF if you are not using the public repo.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";

const ROOT = resolve(import.meta.dirname, "..");
const REMOTE = process.env.ENGINE_SYNC_REMOTE ?? "https://github.com/pplmx/wanxiang-engine.git";
const REF = process.env.ENGINE_SYNC_REF ?? "main";

function git(args, opts = {}) {
  const out = execFileSync("git", args, { cwd: ROOT, encoding: "utf8", ...opts });
  return typeof out === "string" ? out.trim() : "";
}

console.log("⑧ 独立仓与 packages/engine 同树");

try {
  git(["fetch", "--depth=1", REMOTE, REF], { stdio: "inherit" });
} catch (err) {
  throw new Error(
    `拉不到独立仓 ${REMOTE} (${REF})。` +
      "离线开发可暂设 ENGINE_SYNC_REMOTE 指向你已经 fetch 过的 remote 名。",
    { cause: err },
  );
}

/*
 * 比工作树,不比 HEAD:pre-commit 跑在提交落盘之前,若只看 HEAD,修好
 * engine 树的下一次提交仍会被上一版 HEAD 拦住。临时索引只用来求树哈希,
 * 不污染开发者正在准备的暂存区。
 */
const tempRoot = mkdtempSync(join(tmpdir(), "xian-engine-sync-"));
const tempIndex = join(tempRoot, "index");
const tempEnv = { ...process.env, GIT_INDEX_FILE: tempIndex };
let local;
try {
  git(["read-tree", "HEAD"], { env: tempEnv });
  git(["add", "-A", "--", "packages/engine"], { env: tempEnv });
  const workingTree = git(["write-tree"], { env: tempEnv });
  local = git(["rev-parse", `${workingTree}:packages/engine`]);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
const remote = git(["rev-parse", "FETCH_HEAD^{tree}"]);
assert.equal(
  local,
  remote,
  `本仓 packages/engine 与独立仓 ${REF} 不是同一棵树\n` +
    `  本仓:   ${local}\n` +
    `  独立仓: ${remote}\n` +
    "推过去(一键):\n" +
    "  bun run sync:engine  (旧写法 git subtree push --prefix=packages/engine engine main 仍可用)",
);
console.log(`   同树 ${local.slice(0, 12)}(独立仓 ${REF})`);
