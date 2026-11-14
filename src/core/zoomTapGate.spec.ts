/**
 * 200% 缩放档量了触控尺寸，却**没判它**。
 *
 * ## 由来（第 204 轮，查第 202 轮为什么没被拦住）
 *
 * 第 202 轮修了日课去处链接（200% 缩放下 37×15）。这条线索值得追到底:
 * `layout-check.mjs` 明写着「可点元素高度下限 28px」，为什么没拦住？
 *
 * 答案是三段事实:
 *
 * ```text
 * ① 28px 门在 measurePage() 里量（`smallTargets` 那个字段）
 * ② 200% 缩放档走 measureZoomScale() → 它**确实**调了 measurePage()
 * ③ 但 zoomProblems() 只判五项:溢出 / 外壳滚偏 / 越界 / 主值行折行 / 竖排 + 短标签折行
 *    —— **没有判 smallTargets**
 * ```
 *
 * 也就是说:那个数**量了、扔了**。日课链接在 195 档是 37×15，一路全绿。
 *
 * 而整站巡游（taskPageTour）用的视口表 VIEWPORTS 里没有 195；它是独立任务，
 * 只走 `zoomProblems` 这条判据链。于是**没有任何一条门看过它**。
 *
 * ## 这条判据守什么
 *
 * `zoomProblems()` 必须包含 `smallTargets` 那一条。不钉文案，只核那个字段名出现在
 * 缩放档的失败清单里。
 *
 * ## 故障注入
 *
 * 把 `zoomProblems` 里 `smallTargets` 那条 push 删掉 → 「而且它真的会被报成一条问题」红。
 * 只删 push、留着字段名 → 第一条绿、第三条红（这正是要防的「读了下标但不用」）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const LAYOUT = "scripts/layout-check.mjs";

/** 取出 `function zoomProblems(...) { … }` 的正文（按花括号配平） */
function zoomProblemsBody(src: string): string | null {
  const start = src.indexOf("function zoomProblems(");
  if (start < 0) return null;
  const open = src.indexOf("{", start);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

describe("200% 缩放档 · 触控尺寸有没有被判", () => {
  it("判据的前提还在 —— 那三样都在", () => {
    const src = readSource(LAYOUT);
    for (const anchor of ["function zoomProblems(", "measureZoomScale", "smallTargets"]) {
      expect(src, `判据的前提没了：${anchor} —— 判据该跟着改，不是删掉`).toContain(anchor);
    }
  });

  it("缩放档的失败清单里判了 smallTargets", () => {
    const body = zoomProblemsBody(readSource(LAYOUT));
    expect(body, "找不到 zoomProblems 的函数体").not.toBeNull();
    expect(
      body!.includes("smallTargets"),
      "200% 缩放档量了可点元素尺寸（measurePage 的 smallTargets），却没把它算进失败清单 —— " +
        "那个数被扔掉了。日课去处链接在 195 档是 37×15，一路全绿",
    ).toBe(true);
  });

  it("而且它真的会被报成一条问题（不是只读了下标）", () => {
    /*
     * 防空转的第二层:光是函数体里出现 `smallTargets` 不够 ——
     * 得有一处 `problems.push(` 带着它。
     */
    const body = zoomProblemsBody(readSource(LAYOUT))!;
    const pushes = [...body.matchAll(/problems\.push\(([\s\S]{0,220}?)\);/g)].map((m) => m[1]!);
    const withSmall = pushes.filter((p) => p.includes("smallTargets"));
    expect(
      withSmall.length,
      "smallTargets 在函数体里出现了，但没有被 push 成一条失败 —— 那它还是不判",
    ).toBeGreaterThan(0);
  });
});
