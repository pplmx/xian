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
