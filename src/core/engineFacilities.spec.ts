/**
 * 洞府设施的三条契约 —— 文件头列了,此前没有判据。
 *
 * ## 缺口(第 111~112 轮实测)
 *
 * 扫「文件头列了多条契约但连 spec 都没有」的模块,`engineFacilities.ts`(189 行)
 * 是其中之一。它的文件头写着「搬过来的是三件容易写歪的事」:
 *
 * ```text
 *   · 能不能升:门槛不止一条(境界 / 已至顶层 / 受洞府等级所限),而判定的先后
 *     就是界面上先出现哪句话 —— 顺序与文案仍写在下面(内容),
 *     库只保证「能升」与「要花什么」出自同一次判定;
 *   · 等级上限取小:自身上限与 (洞府等级 + 1) × 每级抬升取小,且只封升级、不改已有等级;
 *   · 每小时产出:速率写在这里的 perHour(灵田、藏经阁),零头怎么留、
 *     什么时候进位由库的 accrue 管 —— 一秒一次取整会把 1.5 悟道点/小时、
 *     2.4 玄铁/小时全部抹平。
 * ```
 *
 * ## 为什么这三条容易写歪
 *
 * 第一条是**顺序**问题:若先判洞府等级再判自身顶层,一个已至顶的建筑会在界面上
 * 显示「受洞府等级所限」,而真正的理由是它已经满了。
 *
 * 第二条是**取小**问题:少了 `Math.min`,一个刚建的洞府就能把灵田升到顶。
 *
 * 第三条是**取整**问题:1.5 悟道点/小时若每秒取整,一小时只得 0 或 3600 ——
 * 这是最隐蔽的一种,因为小数值看起来「差不多」。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";
import { BUILDING_LEVELS_PER_MANSION } from "@/data/constants";

const SRC = readFileSync(join(ROOT, "src/core/engineFacilities.ts"), "utf8");

describe("洞府设施 · 三条契约", () => {
  it("① 等级上限取小 —— 自身上限与洞府抬升取 Math.min", () => {
    expect(
      /Math\.min\(\s*def\.maxLevel\s*,/.test(SRC),
      "找不到 Math.min(def.maxLevel, …) —— 上限不再是两者取小,新洞府能一步升到顶",
    ).toBe(true);
    expect(
      SRC.includes("BUILDING_LEVELS_PER_MANSION"),
      "每级抬升的常量不见了 —— 洞府等级与实际上限脱钩",
    ).toBe(true);
    expect(
      BUILDING_LEVELS_PER_MANSION,
      "每级抬升不再是正数 —— 洞府升级不会抬高任何设施的上限",
    ).toBeGreaterThan(0);
  });

  it("② 洞府自身不受这条限制:它的上限就是 def.maxLevel", () => {
    /*
     * 「洞府」这个建筑本身是**基准**:若它也按 (洞府等级 + 1) × 抬升 取小,
     * 就会自己限制自己 —— 洞府 0 级时上限是 0,永远升不上去。
     *
     * 源码里那句是 `if (def.id === "mansion") return def.maxLevel;`。
     */
    expect(
      /if\s*\(\s*def\.id\s*===\s*"mansion"\s*\)\s*return\s+def\.maxLevel/.test(SRC),
      "洞府自身没有豁免上限取小 —— 洞府 0 级时上限会是 0,永远升不上去",
    ).toBe(true);
  });

  it("③ 每小时产出走 accrue,不在这里取整", () => {
    /*
     * 契约说「零头怎么留、什么时候进位由库的 accrue 管」。
     * 判据查两件事:
     * - `accrue` 真的被用了;
     * - 源码里没有 `Math.floor(...perHour...)` 这类**在速率层面**取整的写法。
     *   (取整只能发生在 accrue 内部或最后的资源入账处。)
     */
    expect(SRC.includes("accrue"), "找不到 accrue —— 零头处理不见了").toBe(true);

    const rateRounding = SRC.split("\n")
      .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
      .filter((l) => /Math\.(floor|round|ceil)\([^)]*[Pp]erHour/.test(l));
    expect(
      rateRounding,
      "在速率层面就取整了 —— 1.5 悟道点/小时会被抹成 1 或 2:" + rateRounding.join(" / "),
    ).toEqual([]);
  });

  it("④ 判定顺序:先看自身顶层,再看洞府等级", () => {
    /*
     * 「判定的先后就是界面上先出现哪句话」。源码里:
     *
     * ```ts
     * if (level >= def.maxLevel) return null;   // 自身已至顶,不关洞府的事
     * ```
     *
     * 这一句必须在「受洞府等级所限」之前 —— 否则一个已满的建筑会被告知
     * 「先把洞府升上去」,而升了也没用。
     */
    /*
     * 只在这些函数**内部**找,不能直接 `indexOf` 全文 ——
     * 第一版就是这么写的,结果先匹配到了第 56 行 `capOfBuilding` 里的
     * `buildingLevelCapOf(levels.mansion ?? 0)`,报了一个假的位置错误。
     */
    const fnStart = SRC.indexOf("export function mansionShortfallOf(");
    expect(fnStart, "找不到 mansionShortfallOf —— 判定顺序无从谈起").toBeGreaterThan(0);
    const nextFn = SRC.indexOf("export function", fnStart + 10);
    const body = SRC.slice(fnStart, nextFn > 0 ? nextFn : undefined);

    const ownMax = body.indexOf("if (level >= def.maxLevel) return null");
    expect(ownMax, "找不到「自身已至顶」那条判定").toBeGreaterThan(0);

    // 「受洞府等级所限」的判定必须在它之后
    const mansionLimit = body.indexOf("buildingLevelCapOf(mansion)");
    expect(mansionLimit, "找不到「受洞府等级所限」那条判定").toBeGreaterThan(0);
    expect(
      mansionLimit,
      "「受洞府等级所限」的判定在「自身已至顶」之前 —— 已满的建筑会被告知去升洞府",
    ).toBeGreaterThan(ownMax);
  });

  it("反空转:源码读得到,四条契约的关键 token 都在", () => {
    expect(SRC.length, "engineFacilities.ts 读不到").toBeGreaterThan(3000);
    for (const token of ["createFacilitySystem", "accrue", "def.maxLevel", "perHour"]) {
      expect(SRC.includes(token), `源码里找不到 ${token} —— 结构变了,这条判据要重写`).toBe(true);
    }
  });
});
