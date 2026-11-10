/**
 * 事件标签的供给要跟得上抽取频率 —— 否则玩家反复撞见同一条。
 *
 * ## 缺口(第 92 轮实测)
 *
 * 凡界路线按区域标签抽事件,而标签的事件池大小**差了一个量级**:
 *
 * ```text
 *   sword    2 条   ← 300 世里被抽中 401 次
 *   ice      2 条   ← 345 次
 *   thunder  5 条   ← 366 次
 *   fire     5 条   ← 404 次
 *   general 81 条   ← 221 次
 * ```
 *
 * `sword` 与 `ice` 是**抽得最勤、池子最浅**的两个:400 次抽取只有 2 条事件可落,
 * 玩家在同一世里就会反复看到同样的两条。
 *
 * 已各补两条(到 4 条),与 `thunder` / `fire` 的 5 条同量级。
 *
 * ## 判据
 *
 * 不要求「所有标签一样多」—— `general` 81 条是通用池,本来就该厚。
 * 守的是**专有标签不能薄到失去变化**:凡界路线会用到的标签,每条至少 4 条事件。
 *
 * 这条线画在 4:一条路线 6 段、每段 1~4 个标签,玩家一世里会撞见同一标签
 * 三到五次;池子 3 条时第三次就必然重复,4 条还能撑。
 */
import { describe, expect, it } from "vite-plus/test";
import { EVENTS } from "@/data/events";

/** 凡界路线会用到的专有标签 —— 与 `mortalRouteShapes` 的区域标签同源 */
const MORTAL_TAGS = [
  "sword",
  "ice",
  "fire",
  "thunder",
  "water",
  "forest",
  "mountain",
  "ruin",
  "dark",
  "sky",
] as const;

/** 专有标签至少要有几条事件 */
const MIN_PER_TAG = 4;

describe("事件标签 · 供给要跟得上抽取", () => {
  it("凡界专有标签每条至少 4 条事件", () => {
    const thin: string[] = [];
    for (const tag of MORTAL_TAGS) {
      const count = EVENTS.filter((e) => e.tags.includes(tag)).length;
      if (count < MIN_PER_TAG) thin.push(`${tag}(${count} 条)`);
    }
    expect(thin, `这些标签的事件池太薄 —— 一条路线会反复抽到同一条:${thin.join("、")}`).toEqual([]);
  });

  it("没有任何标签薄于 2 条", () => {
    /*
     * 比上一条更宽:连界外标签(`immortal` / `god` / `chaos`)也算。
     * 1 条事件的标签等于「这个标签只对应一个固定事件」——
     * 那它不该做成标签,该直接点名。
     */
    const allTags = new Set<string>();
    for (const e of EVENTS) for (const t of e.tags) allTags.add(t);

    const oneOff: string[] = [];
    for (const tag of allTags) {
      const count = EVENTS.filter((e) => e.tags.includes(tag)).length;
      if (count < 2) oneOff.push(`${tag}(${count} 条)`);
    }
    expect(
      oneOff,
      "这些标签只对应一条事件 —— 抽中它等于抽中那条,不如直接点名:" + oneOff.join("、"),
    ).toEqual([]);
  });

  it("反空转:确实有足够多的标签与事件", () => {
    const allTags = new Set<string>();
    for (const e of EVENTS) for (const t of e.tags) allTags.add(t);
    expect(allTags.size, "标签太少 —— 判据量不出供给").toBeGreaterThanOrEqual(10);
    expect(EVENTS.length, "事件表太小").toBeGreaterThan(50);
    // 上一条判据用到的标签都真的存在
    for (const tag of MORTAL_TAGS) {
      expect(
        EVENTS.some((e) => e.tags.includes(tag)),
        `MORTAL_TAGS 里的「${tag}」在事件表里一次都没出现 —— 名单过期了`,
      ).toBe(true);
    }
  });
});
