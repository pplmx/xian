/**
 * 事件叙事 · 正文不许重复,长度要够讲故事。
 *
 * ## 为什么补这一条
 *
 * 第 96、97 两轮在文案上找到了问题(丹药十三味「服之+效果」、装备四条「带扣是 X」),
 * 第 98 轮又核了「描述对不对得上机制」,第 99~101 轮把内容/UI/玩法三层都过了一遍。
 *
 * **但事件正文一直没有判据。** 第 101 轮实测:
 *
 * ```text
 *   200 条事件,正文零重复
 *   长度 17~78 字,均值 33
 * ```
 *
 * 质量本来就很好 —— 补判据不是为了修,是**为了不让它退化**。
 *
 * ## 三条
 *
 * ① 正文互不相同 —— 两条事件叙述同一段话,玩家读第二遍就会跳过;
 * ② 每条正文至少 12 字 —— 少于此就只剩「你捡到一样东西」,那不如不给事件;
 * ③ 开头三字不许出现四次以上 —— 与 `pillProse` / `equipProse` 同一形状,
 *    但这里必须**排除同一地点的系列事件**:
 *
 * ```text
 *   一滴未凝   混沌之滨,一滴本源悬在半空…
 *   断碑白泽   混沌之滨的断碑旁卧着一头白泽…
 *   北冥化鹏   混沌之滨,一头巨鲲正于虚无之海中蜕变…
 *   九日栖枝   混沌之滨长出过一株枯木…
 * ```
 *
 * 四条都以「混沌之滨」起头,而那是**同一个地点** —— 系列事件共用开场是设计,
 * 不是套路。所以 ③ 的阈值放到 5,且把已知的系列前缀列出来。
 */
import { describe, expect, it } from "vite-plus/test";
import { EVENTS } from "@/data/events";

/** 同一地点的系列事件共用开场 —— 这些前缀允许高频出现 */
const SERIES_PREFIXES = ["混沌之滨", "九幽", "天外天", "剑冢"] as const;

/** 取事件正文 */
function textOf(e: (typeof EVENTS)[number]): string {
  return (e as unknown as { text?: string }).text ?? "";
}

describe("事件叙事 · 正文质量", () => {
  it("① 正文互不相同", () => {
    const seen = new Map<string, string[]>();
    for (const e of EVENTS) {
      const t = textOf(e);
      if (t.length < 10) continue;
      const list = seen.get(t) ?? [];
      list.push(e.title);
      seen.set(t, list);
    }
    const dupes = [...seen.entries()]
      .filter(([, titles]) => titles.length > 1)
      .map(([t, titles]) => `「${t.slice(0, 20)}…」→ ${titles.join("、")}`);
    expect(
      dupes,
      "有事件共用同一段正文 —— 玩家读到第二遍就会跳过:" + dupes.slice(0, 4).join(" / "),
    ).toEqual([]);
  });

  it("② 每条正文至少 12 字", () => {
    /*
     * 12 字是下限:「你捡到一样东西」8 字,那不如不给事件。
     * 实测最短 17 字,留 5 字余量。
     */
    const tooShort = EVENTS.filter((e) => {
      const t = textOf(e);
      return t.length > 0 && t.length < 12;
    }).map((e) => `${e.title}(${textOf(e).length} 字)`);
    expect(tooShort, "这些事件正文太短,讲不成一个画面:" + tooShort.join("、")).toEqual([]);
  });

  it("③ 同一开头三字不许出现五次以上(系列事件除外)", () => {
    const counts = new Map<string, string[]>();
    for (const e of EVENTS) {
      const t = textOf(e);
      if (t.length < 3) continue;
      const key = t.slice(0, 3);
      // 已知的地点系列前缀不参与统计
      if (SERIES_PREFIXES.some((p) => t.startsWith(p))) continue;
      const list = counts.get(key) ?? [];
      list.push(e.title);
      counts.set(key, list);
    }
    const over = [...counts.entries()]
      .filter(([, titles]) => titles.length >= 5)
      .map(([k, titles]) => `「${k}」×${titles.length}(${titles.slice(0, 3).join("、")}…)`);
    expect(over, "这些事件的开头三字用得太多 —— 换个模板也算套路:" + over.join("、")).toEqual([]);
  });

  it("反空转:事件表规模正常,正文覆盖率够", () => {
    expect(EVENTS.length, "事件表空了").toBeGreaterThan(100);
    const withText = EVENTS.filter((e) => textOf(e).length > 0).length;
    expect(
      withText / EVENTS.length,
      `只有 ${withText}/${EVENTS.length} 条事件有正文 —— 判据量到的样本太少`,
    ).toBeGreaterThan(0.8);
    expect(SERIES_PREFIXES.length, "系列前缀清单空了").toBeGreaterThan(0);
  });
});
