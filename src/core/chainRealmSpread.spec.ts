/**
 * 九条奇缘里，五条起于人间界，界外四界（仙界/神界×2/混沌海）各一条起头。
 *
 * ## 由来（第 517 轮）
 *
 * 按「把一族内容摊在玩家实际经历的境界轴上」这条量法（它是本仓
 * 第 500~502 轮连着抓出三处缺口的那一条），把八条奇缘的**首程门槛**摊开:
 *
 * ```text
 *   青石问路 / 湖中剑影 / 灵狐衔恩 / 古树藏卷 / 夜灯照路   minRealm 0   五条
 *   云海故碑                                        minRealm 9   一条
 *   代天一行                                        minRealm 14  一条
 *   本源一滴                                        minRealm 18  一条
 * ```
 *
 * 而 `data/chains` 的文件头写着「四个界域各有其缘」——
 * 那句话是真的（每界都有），但它没说的是**每界有几条**。
 *
 * ## 这算不算缺口
 *
 * 摊开看:玩家走到仙界之后，奇缘的选择面从 5 条掉到 1 条。
 * 而这不是「缺内容」那么简单的判断 —— 一条奇缘要走三程，
 * 补一条就是三个事件加一份链定义。**故这一轮先把分布judged 成可见事实，不擅自补。**
 *
 * 判据的作用是:以后有人要加链时，他知道现状是「界外各一条」；
 * 如果有人把某界补到两条，这条判据会要求他同时更新这里写的数。
 *
 * ## 判据
 *
 * ① 九条奇缘的首程门槛摊得出来，且与 `data/events` 同源;
 * ② 每个界域至少有一条（`data/chains` 那句「各有其缘」要成立）;
 * ③ 反差:链条自身不另存门槛 —— 门槛只写在首程事件上（注释已声明）。
 */
import { describe, expect, it } from "vite-plus/test";
import { CHAINS } from "@/data/chains";
import { EVENTS } from "@/data/events";
import { worldOf, REALMS } from "@/data/realms";

/** 首程事件的 minRealm → 它属于哪一界 */
function chainWorld(chain: (typeof CHAINS)[number]): string | null {
  const first = EVENTS.find((e) => e.id === chain.stages[0]);
  if (!first) return null;
  const minRealm = (first as unknown as { minRealm?: number }).minRealm ?? 0;
  /*
   *  就是**大境界索引**（与 REALMS 同轴），故直接喂给 worldOf。
   * 第一版我写成 worldOf(tierMajor(minRealm + 1))，那是把「境界」当成了「区域层级」——
   * 于是四条界外奇缘全被算成人间界。判据②当场红，报出「仙界、神界、混沌海一条都没有」，
   * 而那句话是错的。**判据自己写窄了，不是产品缺内容**（第 281 轮那类）。
   */
  return worldOf(minRealm).name;
}

describe("奇缘 · 摊在界域轴上", () => {
  it("① 九条奇缘的首程门槛都摊得出来", () => {
    const rows: { name: string; world: string | null }[] = [];
    for (const c of CHAINS) {
      rows.push({ name: c.name, world: chainWorld(c) });
    }
    /*
     * 第 517 轮补了第九条（自察一簿，神界），故这个数从 8 变 9。
     * 这条断言的作用就是:数量一变，写死的地方必须被看见。
     */
    expect(rows.length, "奇缘数量变了 —— 这条判据的前提要重看").toBe(9);
    const unknown = rows.filter((r) => r.world === null);
    expect(
      unknown.map((r) => r.name),
      "这些奇缘的首程事件找不到",
    ).toEqual([]);
  });

  it("② 每个界域至少有一条 —— 文件头那句「各有其缘」要成立", () => {
    /*
     * 实际分布（第 517 轮量出，写在这里作为「此刻的事实」）:
     *
     * ```text
     *   人间界   5 条（青石问路 / 湖中剑影 / 灵狐衔恩 / 古树藏卷 / 夜灯照路）
     *   仙界     1 条（云海故碑）
     *   神界     2 条（代天一行 / 自察一簿）   ← 第 517 轮补的
     *   混沌海   1 条（本源一滴）
     * ```
     *
     * 判据只要求「≥ 1」——「五条对一条」是内容规模的事，不是缺陷。
     * 若要补，补一条是三程事件加一份链定义，属于**产品决定**，不该由判据替人拍板。
     */
    const byWorld = new Map<string, string[]>();
    for (const c of CHAINS) {
      const w = chainWorld(c);
      if (!w) continue;
      const list = byWorld.get(w) ?? [];
      list.push(c.name);
      byWorld.set(w, list);
    }
    /*
     * 四个界域（人间界 / 仙界 / 神界 / 混沌海）—— 从 realms 里取，不手写。
     */
    const worlds = new Set(REALMS.map((r) => worldOf(REALMS.indexOf(r)).name));
    const missing = [...worlds].filter((w) => !byWorld.has(w));
    expect(missing, `这些界域一条奇缘都没有：${missing.join("、")}`).toEqual([]);
  });

  it("③ 反差：链条自身不另存门槛", () => {
    /*
     * `data/chains` 的文件头写着「每条的起点门槛写在第一程事件的 minRealm 上,
     * 链条自身不另存一份」。这一条守那句话 —— 免得后来者加一个 `minRealm` 字段，
     * 于是门槛有了两处来源（本仓最忌讳的两本账）。
     */
    for (const c of CHAINS) {
      expect(
        (c as unknown as { minRealm?: number }).minRealm,
        `${c.name} 自己存了一份门槛 —— 与首程事件那份必有一处会撒谎`,
      ).toBeUndefined();
    }
  });
});
