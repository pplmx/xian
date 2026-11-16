/**
 * 那份 24k 行的流水账，开头得有一条「怎么查」。
 *
 * ## 由来（第 446 轮）
 *
 * `docs/development.md` 现在是 24809 行、332 条「第 N 轮」记录，而它**开头直接
 * 就是「环境」** —— 没有一个字说这份文档该怎么读。
 *
 * 这不是新发现：`designToc.spec`（第 140 轮）早给过同一条判断 ——
 *
 * ```text
 *   给人看的文档，弱点往往不是数字（那些早被 docs-check 与各类 spec 钉着），
 *   而是**导航与结构**。
 * ```
 *
 * 那一次它给 `design.md`（当时 6300 行）补了目录。而 `development.md` 是它的四倍，
 * 却一直是「进来就开始读环境配置」。
 *
 * 两份文档的差别在于**组织方式**：`design.md` 按主题分节，目录有用；
 * `development.md` 按轮次累积，369 项目录没人看。故这里补的不是目录，是**搜法**。
 *
 * ## 判据
 *
 * ① 文档开头有那段「怎么查」，且它给出的四条搜法与文档实际形态对得上；
 * ② 它说明「轮次号偶有跳号」—— 这条最容易让人以为文档缺了记录；
 * ③ 反差：它**不该**试图按轮次列目录（那会立刻过时且没人读）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DOC = readFileSync(resolve(__dirname, "../../docs/development.md"), "utf-8");
/** 只看开头 —— 导引必须在前 60 行内，否则等于没有 */
const HEAD = DOC.split("\n").slice(0, 60).join("\n");

describe("开发文档 · 开头那条「怎么查」", () => {
  it("① 开头有搜法，且四条都在", () => {
    expect(HEAD, "开头没有「这份文档怎么查」那段").toContain("流水账而不是手册");
    for (const how of ["某个数的来历", "查过没有", "为什么这么写", "还剩什么该做"]) {
      expect(HEAD, `少了「${how}」那一条搜法`).toContain(how);
    }
  });

  it("② 它说明轮次号会跳号 —— 否则读者以为文档缺记录", () => {
    expect(HEAD, "没提跳号这件事").toContain("跳号");
    /*
     * 而且那个说法要**真的对**:文档里确实有跳号（第 95 → 99）。
     * 若哪天有人把缺的补全了，这条提醒就该删 —— 故这里量一次实际情况。
     */
    const rounds = [...DOC.matchAll(/^### 第 (\d+) 轮/gm)].map((m) => Number(m[1]));
    const uniq = [...new Set(rounds)].sort((a, b) => a - b);
    let gaps = 0;
    for (let i = 1; i < uniq.length; i += 1) if (uniq[i]! !== uniq[i - 1]! + 1) gaps += 1;
    expect(
      gaps,
      "现在没有跳号了 —— 那句「偶有跳号」已经过时，请连同这条判据一起改",
    ).toBeGreaterThan(0);
  });

  it("③ 反差：不要按轮次列目录", () => {
    /*
     * 332 条轮次、每轮一个标题 —— 列成目录会立刻过时，而且没人会去点。
     * 这条守的是「补的是搜法，不是目录」这个决定本身。
     */
    const bullets = HEAD.split("\n").filter((l) => /^\s*[-*]\s*第 \d+ 轮/.test(l));
    expect(bullets, "开头开始按轮次列目录了 —— 那份清单会立刻过时").toEqual([]);
  });
});
