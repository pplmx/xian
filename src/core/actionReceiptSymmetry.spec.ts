/**
 * 「三条失败都有话说，成功那条没有」—— 这个形状在本仓出现过两次。
 *
 * ## 由来（第 191 轮）
 *
 * 上一轮修了市场购入（`MarketView.buySlot`）。这一轮按同一条线扫，
 * **收徒是同一个形状**:
 *
 * ```ts
 * function doRecruit(): void {
 *   const r = appr.recruit(player.major);
 *   if (r === "full") notify(`槽位已满…`, "warn");
 *   else if (r === "poor") notify("灵石不足,收徒不成", "warn");
 *   // ← 成功那条没有
 * }
 * ```
 *
 * 实测:点「收徒 6,114 石」后页面变了（多一名弟子），而 toast 是空的。
 *
 * ## 为什么这个形状会重复
 *
 * 写这类函数时，人的注意力在**失败路径**上（那才是要想清楚的地方:
 * 灵石不够说什么、槽位满了说什么）。成功路径看起来「界面上自然就变了」，
 * 于是被漏掉。
 *
 * 但对玩家来说恰好相反:成功是他**付了钱**的那一次。失败还有界面上的
 * 禁灰与差额作为线索，成功则只有「某处多了点什么」。
 *
 * ## 这条判据守什么
 *
 * 扫全仓所有「按结果码分支 + notify」的函数:若它列出了**两个以上**失败码分支
 * 却没有任何成功码分支，就点名。
 *
 * 只认 `r === "…"` 这种可机械识别的形状 —— 判据不追求覆盖所有反馈形态,
 * 它只挡这个已经重复过两次的具体形状。
 *
 * ## 故障注入
 *
 * 删掉 `ApprenticeView.doRecruit` 的 `else if (r === "ok")` 分支 → 当场点名那个函数。
 * 把 `FAILURE_CODES` 清空 → 「地基」那条红（它认不出形状了）。
 */
import { describe, expect, it } from "vite-plus/test";
import { walkFiles, isSourceFile, readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

/** 明确表示失败的返回码 */
const FAILURE_CODES = new Set([
  "poor",
  "full",
  "bagfull",
  "expired",
  "sold",
  "missing",
  "absent",
  "none",
  "blocked",
  "capped",
  "locked",
  "cooling",
  "dead",
]);

interface Finding {
  file: string;
  fn: string;
  failures: string[];
}

/**
 * 找出「有 ≥2 条失败码分支、但没有任何成功码分支」的函数。
 *
 * 成功码取 `ok` —— 本仓的返回码命名基本一致（`buy` / `recruit` / `consign` 都是）。
 * 不把「非失败码」一律当成功:那样会误判 `missing` 之类的变体。
 */
function findOneSidedReceipts(src: string, file: string): Finding[] {
  const out: Finding[] = [];
  // 按函数切块:`function name(...) { … }` 到下一个顶层 `}`
  /*
   * 结尾按**缩进**判（`\n  }`）—— 样本与真实代码都是缩进过的。
   * 第一版写成 `\n\}`，于是「地基」那几条样本（前面有缩进）一个都匹配不到。
   */
  for (const m of src.matchAll(/function (\w+)\([^)]*\)[^{]*\{([\s\S]*?)\n\s*\}/g)) {
    const fn = m[1]!;
    const body = m[2]!;
    const codes = [...body.matchAll(/r\s*===\s*"([\w]+)"/g)].map((x) => x[1]!);
    if (codes.length === 0) continue;
    const failures = [...new Set(codes.filter((c) => FAILURE_CODES.has(c)))];
    const successes = codes.filter((c) => c === "ok");
    if (failures.length >= 2 && successes.length === 0) {
      out.push({ file, fn, failures });
    }
  }
  return out;
}

describe("「失败都有话说，成功没有」这个形状", () => {
  it("扫到了足够多的分支函数（防空转）", () => {
    let scanned = 0;
    for (const f of walkFiles("src", isSourceFile)) {
      const src = stripComments(readSource(f));
      scanned += [...src.matchAll(/r\s*===\s*"\w+"/g)].length;
    }
    expect(scanned, "一个结果码分支都没扫到 —— 判据空转").toBeGreaterThan(10);
  });

  it("没有任何函数只给失败发回执", () => {
    const findings: Finding[] = [];
    for (const f of walkFiles("src", isSourceFile)) {
      const src = stripComments(readSource(f));
      findings.push(...findOneSidedReceipts(src, f.replace(/^.*\/src\//, "src/")));
    }
    expect(
      findings,
      "这些函数列了两条以上失败码，却没有一条成功码 —— " +
        "玩家付了钱/花了资源的那一次反倒没有回执。" +
        "（这个形状已经在市场购入与收徒上各出现一次）:" +
        findings.map((x) => `${x.file} ${x.fn}() 只有 ${x.failures.join("/")}`).join(" / "),
    ).toEqual([]);
  });

  it("判据自己认得出这个形状（地基）", () => {
    const bad = `
      function doThing(): void {
        const r = svc.go();
        if (r === "poor") notify("没钱", "warn");
        else if (r === "full") notify("满了", "warn");
      }`;
    expect(findOneSidedReceipts(bad, "x").length, "认不出「只给失败发回执」").toBe(1);

    const good = `
      function doThing(): void {
        const r = svc.go();
        if (r === "poor") notify("没钱", "warn");
        else if (r === "full") notify("满了", "warn");
        else if (r === "ok") notify("成了", "success");
      }`;
    expect(findOneSidedReceipts(good, "x").length, "把写了成功分支的也报出来").toBe(0);

    // 只有一条失败分支的不算:那不是这个形状，可能是别的意思
    const oneFailure = `
      function doThing(): void {
        const r = svc.go();
        if (r === "poor") notify("没钱", "warn");
      }`;
    expect(findOneSidedReceipts(oneFailure, "x").length, "一条失败也算 —— 太宽").toBe(0);
  });
});
