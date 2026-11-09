/**
 * 文档里引用的常量值,与代码同源。
 *
 * `docs/design.md` 有几处把常量的**具体数值**写进了正文 —— 那是给读者看的
 * 事实(「每重境界有十个小层(SUB_LEVELS = 10)」)。这类句子有个静默腐化路径:
 * 常数一改,正文里的数字就成了谎言,而**没有任何地方会报错**。
 *
 * 本仓已经在 `palette.spec` 里为「对比度表格」做过同一件事(文档写下的每个数字
 * 都要对得上现算值)。这一份把同样的口径推广到「正文里引用的常量赋值」。
 *
 * 判据只核**用反引号标出的 `NAME = 值` 形态** —— 那是本文档里"这是一个常量赋值"
 * 的书写约定;散在行文里的普通数字不在此列(它们多半是历史读数或举例)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SUB_LEVELS } from "@/data/constants";
import { AFTERMATH_CHANCE } from "./worldMemory";
import { NAME_MAX } from "@/utils/nameLimit";

const ROOT = resolve(__dirname, "../..");
const DESIGN = readFileSync(resolve(ROOT, "docs/design.md"), "utf-8");

describe("首屏预算表的「上限」列与脚本里的默认值同源", () => {
  it("六个上限都对得上 —— 改一处不许漏另一处", () => {
    /*
     * `docs/development.md` 的「首屏预算」表有六行「上限」。每个上限在脚本里都有一份
     * 默认值,而**没有任何东西保证两者一致** —— 改了脚本忘了改文档(或反过来),
     * 读者按文档判断"还有多少余量"时拿到的就是过时的数。
     *
     * 两处脚本都写着「要改上限请连同那里的表一起改」(见 `build-timed.mjs` 的文件头),
     * 但那是一句约定,不是判据。这条把六个数逐个对账。
     */
    const DESIGN_DEV = readFileSync(resolve(ROOT, "docs/development.md"), "utf-8");
    const FIRST_PAINT = readFileSync(resolve(ROOT, "scripts/first-paint.mjs"), "utf-8");
    const BUILD_TIMED = readFileSync(resolve(ROOT, "scripts/build-timed.mjs"), "utf-8");
    const LAYOUT = readFileSync(resolve(ROOT, "scripts/layout-check.mjs"), "utf-8");

    /** 从 `?? 1500)` 这种默认值里取数 */
    const defaultOf = (src: string, envName: string): number => {
      const m = new RegExp(`${envName} \\?\\? (\\d+)`).exec(src);
      expect(m, `脚本里找不到 ${envName} 的默认值`).toBeTruthy();
      return Number(m?.[1] ?? 0);
    };

    const budget: Record<string, number> = {
      bytes: defaultOf(FIRST_PAINT, "FIRST_PAINT_BUDGET_KB"),
      fcp: defaultOf(FIRST_PAINT, "FIRST_PAINT_BUDGET_FCP"),
      fontSwap: defaultOf(FIRST_PAINT, "FIRST_PAINT_BUDGET_FONT"),
      fontBytes: defaultOf(FIRST_PAINT, "FIRST_PAINT_BUDGET_FONT_KB"),
      build: defaultOf(BUILD_TIMED, "BUILD_BUDGET_S"),
    };
    /*
     * layout-check 的单块上限是内联的 `chunk.bytes > 500_000`(字节,十进制 500K)。
     * 文档把这一行写成「500KB」—— 十进制下两者一致,故判据比的是十进制 KB。
     */
    const chunkLimit = /chunk\.bytes\s*>\s*([\d_]+)/.exec(LAYOUT);
    expect(chunkLimit, "layout-check 里找不到单块上限（`chunk.bytes > N`）").toBeTruthy();
    budget.chunk = Math.round(Number((chunkLimit?.[1] ?? "0").replace(/_/g, "")) / 1000);

    /** 文档表里「上限」列的六个数,按行名取 */
    const rowLimit = (label: string): number => {
      const m = new RegExp(`\\| ${label}[^|]*\\|[^|]*\\|[^|]*\\| (\\d+)(KB|ms|s) \\|`).exec(
        DESIGN_DEV,
      );
      expect(m, `文档预算表里找不到「${label}」这一行`).toBeTruthy();
      return Number(m![1]);
    };

    const rows: [string, number, string][] = [
      ["冷启动解码字节", rowLimit("冷启动解码字节"), "bytes"],
      ["FCP", rowLimit("FCP"), "fcp"],
      ["楷体换上", rowLimit("楷体换上"), "fontSwap"],
      ["首屏楷体请求", rowLimit("首屏楷体请求"), "fontBytes"],
      ["最大 JS 单块", rowLimit("最大 JS 单块"), "chunk"],
      ["构建时长", rowLimit("构建时长"), "build"],
    ];
    for (const [label, shown, key] of rows) {
      expect(
        shown,
        `文档说「${label}」上限 ${shown},而脚本里是 ${budget[key]} —— 改上限时把表一起改`,
      ).toBe(budget[key]);
    }
  });
});

describe("文档正文里的常量赋值与代码同源", () => {
  it("design.md 写的常量值都对得上", () => {
    /*
     * 2026-11-09 核过:三处引用当时都准确。补判据是为了让**下一次改常数的人**
     * 立刻知道正文里还有一句要跟着改,而不是等到读者发现数字对不上。
     */
    const actual: Record<string, number> = {
      SUB_LEVELS,
      AFTERMATH_CHANCE,
      NAME_MAX,
    };

    const found: string[] = [];
    // `NAME = 数字` —— 反引号包住,等号两侧可带空格
    for (const m of DESIGN.matchAll(/`([A-Z][A-Z0-9_]{2,})\s*=\s*([0-9]+(?:\.[0-9]+)?)`/g)) {
      const [, name, shown] = m;
      if (!(name! in actual)) continue; // 文档提到的其他常量不在本判据管辖
      found.push(name!);
      expect(
        Number(shown),
        `docs/design.md 写 ${name} = ${shown},而代码里是 ${actual[name!]} —— 改常数时把正文一起改`,
      ).toBe(actual[name!]);
    }

    // 防空转:一处都没扫到时,上面的循环等于没跑
    expect(found.length, "design.md 里一处「`常量 = 值`」都没扫到 —— 写法变了?").toBeGreaterThan(0);
  });
});
