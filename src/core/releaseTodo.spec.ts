/**
 * 「待办 · 下一步」里的版本号 —— 它指着的那个 tag 必须还没打。
 *
 * ## 缺口(第 132 轮实测)
 *
 * 跑 `bun run release:check` 之前先读了 `docs/development.md` 的「待办 · 下一步」,
 * 它写着:
 *
 * ```bash
 * bun run release:check     # 版本 0.0.2 / …
 * git tag v0.0.2
 * git push origin main v0.0.2
 * ```
 *
 * 而实际状态是:
 *
 * ```text
 *   已有 tag        v0.0.1 / v0.0.2 / v0.0.3
 *   package.json    0.0.3
 *   v0.0.3 之后     194 个提交
 * ```
 *
 * **待办指向了两个版本之前的 tag。** `release:check` 自己会拦(`tag v0.0.3 已经存在`),
 * 所以照它做的人不会真的发错 —— 但会先撞一次墙,而墙上的字说的是「换版本号」,
 * 与「待办里写的那个 tag 早已发过」是两件事。
 *
 * ## 判据
 *
 * ① 待办那一节里出现的 `git tag` 目标,不许是已经存在的 tag;
 * ② 那一节里提到的版本号,必须与 `package.json` 的 `version` 一致 ——
 *    因为待办说的是「下一步做什么」,而下一步就是「把当前版本发出去」。
 *
 * ② 看起来像同义反复(待办写 package.json 的版本,当然一致),但它守的是**漂移**:
 *    发版那一步会把 `package.json` 改掉,若待办没跟着改,两者立刻分叉。
 *    第 132 轮之前它们差了整整两个版本。
 *
 * 编年史里提到旧版本是**正当的**(记录某次事故),故只在「待办」这一节里查。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";

/** 从 `## 待办 · 下一步` 切到下一个 `## ` 之前 */
function todoSection(): string {
  const doc = readFileSync(join(ROOT, "docs/development.md"), "utf8");
  const start = doc.indexOf("## 待办 · 下一步");
  expect(start, "`docs/development.md` 里找不到「## 待办 · 下一步」").toBeGreaterThan(0);
  const rest = doc.slice(start + 1);
  /*
   * 切到下一个 `## ` 或 `### ` —— 两处都要找。
   *
   * 第一版只找 `\n## `,而「待办 · 下一步」是**最后一节**、后面没有 `## `,
   * 于是切片一路吃到文件末尾(153936 字符),把第 114 轮那段历史记录里的
   * `git tag v0.0.2` 也当成「待办让人去打的 tag」报了出来。
   */
  const candidates = [rest.indexOf("\n## "), rest.indexOf("\n### ")].filter((i) => i > 0);
  const next = candidates.length > 0 ? Math.min(...candidates) : -1;
  return next > 0 ? rest.slice(0, next) : rest;
}

const PKG = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string };

/** 本仓已有的 tag(拿不到时返回空 —— 不因此判失败) */
function existingTags(): string[] {
  try {
    return execSync("git tag", { cwd: ROOT, encoding: "utf8" })
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

describe("「待办 · 下一步」与真实版本状态", () => {
  it("① 待办里的 `git tag` 目标不许是已存在的 tag", () => {
    const section = todoSection();
    /*
     * 具体版本号与 `vX.Y.Z` 占位符都要认。
     *
     * 第 132 轮把待办从「打 v0.0.2」改成「打 vX.Y.Z」—— 后者才是长期正确的写法
     * (等到真要发时就该换成具体号,那时这条判据才起作用)。
     * 第一版只匹配 `v[\d.]+`,于是改成占位符之后判据自己红了,而文档比之前更对。
     */
    const targets = [...section.matchAll(/git tag\s+(v[\d.]+)/g)].map((m) => m[1]!);
    const usesPlaceholder = /git tag\s+vX\.Y\.Z/.test(section);
    expect(
      targets.length > 0 || usesPlaceholder,
      "待办里既没有具体的 `git tag vX.Y.Z` 也没有占位符 —— 读到的人不知道该打什么",
    ).toBe(true);
    if (usesPlaceholder) return;

    const tags = existingTags();
    const stale = targets.filter((t) => tags.includes(t));
    expect(
      stale,
      "待办让人去打的 tag 已经存在了 —— 照它做会先撞一次墙:" +
        stale.join("、") +
        `(已有:${tags.join(" / ") || "读不到"})`,
    ).toEqual([]);
  });

  it("② 待办里写的版本号与 package.json 一致", () => {
    const section = todoSection();
    /*
     * 只查「版本 X.Y.Z」这种**明确指向当前版本**的写法,不查任何出现过的版本号 ——
     * 待办里可以有「v0.0.2 的产物跑出三项缺失」这种历史记录。
     */
    const mentioned = [...section.matchAll(/版本\s+(\d+\.\d+\.\d+)/g)].map((m) => m[1]!);
    if (mentioned.length > 0) {
      expect(
        new Set(mentioned),
        `待办里写的版本 ${mentioned.join("、")} 与 package.json 的 ${PKG.version} 不一致 —— ` +
          "发版改了 package.json 却没改待办,两者就分叉了",
      ).toEqual(new Set([PKG.version]));
    }
    // 版本占位符形态也允许(下一版用),但那时不该同时出现具体版本
    const placeholder = /vX\.Y\.Z/.test(section);
    expect(
      mentioned.length > 0 || placeholder,
      "待办里既没有具体版本号也没有 vX.Y.Z 占位符 —— 读到的人不知道该发哪一版",
    ).toBe(true);
  });

  it("③ 待办里提到的 release-notes 文件名,若写具体版本则必须存在", () => {
    const section = todoSection();
    const names = [...section.matchAll(/docs\/release-notes\/(v[\d.]+)\.md/g)].map((m) => m[1]!);
    for (const v of names) {
      expect(() => readFileSync(join(ROOT, "docs/release-notes", `${v}.md`), "utf8")).not.toThrow();
    }
  });

  it("反空转:待办那一节真的有内容,package.json 的版本号可解析", () => {
    const section = todoSection();
    expect(section.length, "待办那一节几乎是空的").toBeGreaterThan(200);
    expect(PKG.version, "package.json 的版本号不是 x.y.z").toMatch(/^\d+\.\d+\.\d+$/);
  });
});
