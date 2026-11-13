/**
 * 日课的「去 XX」必须落到**那一件事所在的分册**，不是落到那本书的封面。
 *
 * ## 由来（第 185 轮，查 200% 缩放下的完整操作链）
 *
 * 首页八条日课各带一个去处链接。实测它们的 href 只有三个值:
 *
 * ```text
 * 去历练 / 去斩将 / 去历练 / 去历练   → #/adventure
 * 去服药 / 去开炉 / 去强化             → #/inventory
 * 去破境                              → #/cultivation
 * ```
 *
 * 而 `#/inventory` 默认落在**「装备」**那一册（`useRouteTab(INVENTORY_CHAPTERS, "equip")`）。
 * 于是「去服药」点进去，玩家看到的是装备页 —— 还得再点一次「丹药」。
 * 「去开炉」「去强化」同理。
 *
 * 这不是坏掉，是**少了最后一步**:链接说了去哪件事，却没把玩家送到那件事面前。
 * 而 `useRouteTab` 本来就支持 `?tab=`，也没有任何东西阻止 href 带上它。
 *
 * ## 这条判据守什么
 *
 * 日课的去处若指向一个有分册的页面，href 必须带 `?tab=`，且那个 tab id
 * 必须是该页章节目录里真实存在的（写错一个字母会静默落回默认册）。
 *
 * ## 口径
 *
 * 只核**多分册**的页面（背包四册、修行、天界…）。单册页面不需要参数 ——
 * 给单册页加 `?tab=` 是噪音。
 */
import { describe, expect, it } from "vite-plus/test";
import { DAILY_ROUTES, dailyRouteOf } from "@/ui/dailyRoutes";
import {
  INVENTORY_CHAPTERS,
  CELESTIAL_CHAPTERS,
  COLLECTION_CHAPTERS,
  TITLES_CHAPTERS,
  LEGACY_CHAPTERS,
  MARKET_CHAPTERS,
  CODEX_CHAPTERS,
} from "@/ui/navigation";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

/**
 * 有分册的页面 → 它的章节 id 集合。
 *
 * **七处** —— 与 `grep useRouteTab src/views/*.vue` 的清单逐一对齐。
 * 第一版只列了三个库(背包 / 天界 / 藏珍),而实际有七个页面用 `useRouteTab`;
 * 名字 / 轮回 / 坊市 / 修仙录那四处的去处若不带 `?tab=`,这条判据看不见。
 */
const CHAPTERS: Record<string, readonly string[]> = {
  "/inventory": INVENTORY_CHAPTERS.map((c) => c.id),
  "/celestial": CELESTIAL_CHAPTERS.map((c) => c.id),
  "/collection": COLLECTION_CHAPTERS.map((c) => c.id),
  "/titles": TITLES_CHAPTERS.map((c) => c.id),
  "/legacy": LEGACY_CHAPTERS.map((c) => c.id),
  "/market": MARKET_CHAPTERS.map((c) => c.id),
  "/codex": CODEX_CHAPTERS.map((c) => c.id),
};

describe("日课去处 · 必须落到那一册，不是那本书的封面", () => {
  it("指向多分册页面的去处，href 都带了 ?tab=", () => {
    const offenders: string[] = [];
    for (const [key, route] of Object.entries(DAILY_ROUTES)) {
      const base = route.route.split("?")[0]!;
      if (!(base in CHAPTERS)) continue;
      if (!route.route.includes("?tab=")) {
        offenders.push(
          `${key}: «${route.route}» —— ${base} 有 ${CHAPTERS[base]!.length} 册，要指明哪一册`,
        );
      }
    }
    expect(
      offenders,
      "这些日课去处只送到书的封面 —— 玩家点「去服药」看到的是装备页，还得自己再点一次",
    ).toEqual([]);
  });

  it("带上的 tab id 必须真的在那一页的章节目录里", () => {
    const offenders: string[] = [];
    for (const [key, route] of Object.entries(DAILY_ROUTES)) {
      const [base, query] = route.route.split("?");
      const m = /(?:^|&)tab=([\w-]+)/.exec(query ?? "");
      if (!m) continue;
      const allowed = CHAPTERS[base!];
      if (!allowed) continue; // 单册页面不管
      if (!allowed.includes(m[1]!)) {
        offenders.push(
          `${key}: «tab=${m[1]}» 不在 ${base} 的章节里（${allowed.join(" / ")}）—— 写错会静默落回默认册`,
        );
      }
    }
    expect(offenders, "tab id 写错了 —— 玩家点进去会落回默认册，而看不出哪里不对").toEqual([]);
  });

  it("每一条日课都有去处（防空转 + 防漏）", () => {
    const count = Object.keys(DAILY_ROUTES).length;
    expect(count, "日课去处表太短 —— 是不是漏了新的计数器").toBeGreaterThanOrEqual(15);
    for (const key of Object.keys(DAILY_ROUTES)) {
      const r = dailyRouteOf(key as never);
      /*
       * 去处可以就是首页 `/` —— `offlineClaims`（收洞府产出）那一条
       * 确实就在首页做,把它指到别处才是错的。故只要求「是一条应用内路径」。
       */
      expect(r, `${key} 的去处是 null —— 那个日课永远只能靠玩家自己想起来`).not.toBeNull();
      expect(r!.route, `${key} 没有去处`).toMatch(/^\//);
      expect(r!.label, `${key} 的去处没有文案`).toBeTruthy();
    }
  });

  it("那张分册表覆盖了**所有**用 useRouteTab 的页面", () => {
    /*
     * 这一条是防空转的第三层:分册表若漏了一页,针对那一页的检查就静默不发生。
     * 第一版就漏了四处（`grep useRouteTab src/views/*.vue` 有七个结果,表里只有三个）。
     *
     * 做法:从视图源码里读出「哪些路由用了 useRouteTab」,再与表对齐。
     */
    const views = readSource("src/router/index.ts");
    void views;
    const used: string[] = [];
    for (const f of [
      "src/views/CelestialView.vue",
      "src/views/CollectionView.vue",
      "src/views/InventoryView.vue",
      "src/views/LegacyView.vue",
      "src/views/MarketView.vue",
      "src/views/RealmCodexView.vue",
      "src/views/TitlesView.vue",
    ]) {
      if (/useRouteTab\(/.test(stripComments(readSource(f)))) used.push(f);
    }
    expect(used.length, "一个用 useRouteTab 的视图都没扫到").toBeGreaterThan(3);
    expect(
      Object.keys(CHAPTERS).length,
      `有 ${used.length} 个页面用 useRouteTab（${used.map((f) => f.split("/").pop()).join(" / ")}),` +
        `而分册表只有 ${Object.keys(CHAPTERS).length} 项 —— 漏掉的那几页不会被检查`,
    ).toBe(used.length);
  });

  it("`useRouteTab` 确实认 ?tab=（否则带上也没用）", () => {
    /*
     * 这条是**前提**:若哪天 `useRouteTab` 不再读 query，
     * 上面两条就变成「加了个没人读的参数」—— 看起来更完整，实际更糟。
     */
    const src = stripComments(readSource("src/composables/useRouteTab.ts"));
    expect(src, "useRouteTab 不读 route.query.tab —— 那 ?tab= 就是装饰").toMatch(
      /route\.query\.tab/,
    );
  });
});
