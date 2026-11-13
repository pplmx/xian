/**
 * 建筑卡的「现 / 将」两格 —— 必须是**同一件事**的前后，不是两件事。
 *
 * ## 由来（第 158 轮，洞府页）
 *
 * 炼器台 4 → 5 级那一行，真浏览器读到的是:
 *
 * ```text
 * 现  强化上限 +2
 * 将  升至 5 级 · 炼器省耗 +20%
 * ```
 *
 * 玩家要判断的是「花 4197 石 + 75 玄铁，**比现在多得到什么**」——
 * 而这两句说的不是同一件事：上面报的是强化上限，下面报的是省耗。
 *
 * ### 根因不是文案，是索引对错了位
 *
 * ```ts
 * const currentLines = computed(() => level > 0 ? props.def.effectText(level) : []);
 * const primaryCurrent = computed(() => currentLines.value[0] ?? props.def.desc);
 * const preview = computed(() => buildingUpgradePreview(id, level, cap)); // 只留**会变**的行
 * const primaryPreview = computed(() => preview.value.lines[0] ?? "");
 * ```
 *
 * `preview.lines` 是 `effectText(toLevel)` 里**字面变掉的那些行**（见
 * `core/buildingService` 的 `buildingUpgradePreview`）。而 `currentLines[0]`
 * 永远是「整张效果表的第一行」。两者各自取第一个，于是只要**第一行这一级不变**，
 * 就必然错位 —— 炼器台恰好是「强化上限每 2 级才涨 1」：
 *
 * ```text
 * lv 4  强化上限 +2（不变）  炼器省耗 +16%（涨 4%）
 * lv 5  强化上限 +2（同左）  炼器省耗 +20%  ← 变的只有第二行
 * ```
 *
 * 凡「某几行隔几级才动」的建筑都会踩，不只是炼器台。
 *
 * ## 判据
 *
 * ① 「将」那一格标的必须是**同一项**在升级后的值 —— 不是「第一个变了的项」；
 * ② 该项若这一级不变，就不许把它当事由（那时该报**真的**变了的项）；
 * ③ 三座建筑（含炼器台）逐级扫一遍：每一级「现 / 将」的两格必须同项。
 */
import { describe, expect, it } from "vite-plus/test";
import { buildingDef } from "@/data/buildings";
import { readSource } from "@/test/readSource";
import type { BuildingDef } from "@/types";

const ROW = readSource("src/components/dongfu/BuildingLedgerRow.vue");

/** 取 `effectText` 的「项名」—— 去掉数字与符号，只留这一项在说什么 */
function labelOf(line: string): string {
  return line
    .replace(/[+\-−]?\d[\d.,]*/g, "")
    .replace(/[×%]/g, "")
    .trim();
}

/**
 * 升级前后的「同一项」应在哪一行 —— 按**项名**配对，不按索引。
 *
 * 这正是修法：`effectText` 的行序是稳定的（同一座的同一项永远在同一位置），
 * 故按项名取「当前那一行」与「升级后那一行」，两格必然说的是同一件事。
 */
function pairedLines(def: BuildingDef, level: number, toLevel: number): [string, string][] {
  const cur = def.effectText(level);
  const nxt = def.effectText(toLevel);
  const out: [string, string][] = [];
  for (let i = 0; i < nxt.length; i += 1) {
    const nextLine = nxt[i]!;
    const curLine = cur[i];
    // 只有「这一级真的变了」的项才值得进预览
    if (curLine !== undefined && curLine === nextLine) continue;
    out.push([curLine ?? "", nextLine]);
  }
  return out;
}

describe("建筑卡的现 / 将 · 必须同项", () => {
  it("炼器台 4 → 5 级:变的是省耗，就该报省耗；强化上限不变，不许拿来当由头", () => {
    const forge = buildingDef("forge")!;
    const pairs = pairedLines(forge, 4, 5);
    expect(pairs.length, "炼器台 4→5 应当有一项真的变了").toBeGreaterThan(0);
    for (const [cur, next] of pairs) {
      expect(labelOf(cur), `现/将 不同项:«${cur}» 对 «${next}»`).toBe(labelOf(next));
    }
    // 具体到这一级:变的是「炼器省耗」，不是「强化上限」
    expect(
      pairs.some(([, n]) => n.includes("炼器省耗")),
      "4→5 的增益应是省耗",
    ).toBe(true);
    expect(
      pairs.some(([, n]) => n.includes("强化上限")),
      "强化上限 4→5 没变，不该出现在增益里",
    ).toBe(false);
  });

  it("逐级扫全部建筑:每一级的「现 / 将」都同项（不止炼器台会踩）", () => {
    const problems: string[] = [];
    for (const id of ["forge", "array", "library", "alchemy", "field", "beast"] as const) {
      const def = buildingDef(id);
      if (!def) continue;
      for (let lv = 1; lv < def.maxLevel; lv += 1) {
        for (const [cur, next] of pairedLines(def, lv, lv + 1)) {
          // 首建（cur 为空）不适用：那时「现」是 desc，本来就不是同一项
          if (cur === "") continue;
          if (labelOf(cur) !== labelOf(next)) {
            problems.push(`${def.name} ${lv}→${lv + 1}:现 «${cur}» / 将 «${next}»`);
          }
        }
      }
    }
    expect(problems, "这些级的「现 / 将」报的不是同一件事").toEqual([]);
  });

  it("视图取的是**配过对**的那一行，不是各自取第 0 个", () => {
    /*
     * 判的是那件事：`primaryPreview` 不能是 `preview.lines[0]` 这种「取第一个」，
     * 而必须与 `primaryCurrent` 指同一项。实现方式不钉死（可以在 core 里配、
     * 也可以在视图里配），只钉「不许各取各的下标」。
     */
    expect(ROW, "当前那一项要能被预览认出来（同一份配对）").toMatch(
      /primaryPreview|primaryPair|pairedPrimary/,
    );
    expect(ROW, "「将」那一格不许再是「第一个变了的项」—— 那会与「现」的那一项错位").not.toMatch(
      /primaryPreview\s*=\s*computed\(\(\)\s*=>\s*preview\.value\.lines\[0\]/,
    );
  });
});
