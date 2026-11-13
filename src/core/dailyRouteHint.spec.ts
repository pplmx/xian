/**
 * 日课要说出「去哪儿做」—— 首页八行，八个不可点的条目。
 *
 * ## 由来（第 163 轮）
 *
 * 首页「今日日课」把八笔的进度与赏格都摊开了，做得很好。而它们是八个
 * 不可点的 `<li>`（实测 `clickable: false` × 8）:
 *
 * ```text
 * 01 今日击败 15 个敌人   得 灵石 249.9万   0/15
 * 04 今日炼成 2 枚丹药     得 悟道点×6       0/2
 * 05 今日强化装备 3 次     得 器灵尘×12      0/3
 * ```
 *
 * 新玩家读完知道**要做什么**，却不知道**去哪儿做**：「击败敌人」在历练页、
 * 「炼成丹药」在背包的丹药册、「强化装备」也在背包。
 *
 * 而首页别处没有这个问题 —— 门径那两格都是 `RouterLink`，写着「入府 →」「踏天 →」。
 * 日课是首页**唯一**一组「给了任务却不给路」的条目。
 *
 * ## 判据
 *
 * ① 映射表是**满的**：每个 `CounterKey` 都有去处（TS 类型已经强制，这里再钉一次
 *    实际取值 —— 免得有人填了空串对付类型）；
 * ② 每条去处是一条**真实注册的路由**（拼错 `/adventur` 不会报错，只会点不动）；
 * ③ 首页那一行把它印出来，且那一行可点。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource, walkFiles, isSourceFile } from "@/test/readSource";
import { DAILY_ROUTES, dailyRouteOf } from "@/ui/dailyRoutes";
import { DAILY_TASKS } from "@/data/quests";

const HOME = readSource("src/views/HomeView.vue");

/**
 * 路由表里真实注册的那些 path —— 从 router 源码里读，不手抄。
 *
 * `walkFiles` 的第二个参数是**谓词**（收完整路径），不是 glob；
 * 第一版按 glob 的直觉写成了 `f.includes("router")`，结果一个文件都没走到，
 * 判据红在「没读到路由表」上 —— 那条红是判据自己的毛病，不是产品的。
 */
function registeredRoutes(): Set<string> {
  const out = new Set<string>();
  for (const file of walkFiles("src", isSourceFile)) {
    if (!file.includes("router")) continue;
    const src = readSource(file);
    for (const m of src.matchAll(/path:\s*"([^"]+)"/g)) out.add(m[1]!);
  }
  return out;
}

describe("日课 · 去哪儿做", () => {
  it("每个计数器都有去处，且不是空串对付类型", () => {
    for (const [key, hint] of Object.entries(DAILY_ROUTES)) {
      expect(hint.route, `${key} 没有 route`).toMatch(/^\//);
      expect(hint.label, `${key} 没有 label`).toMatch(/\S/);
    }
  });

  it("每一笔实际排定的日课都查得到去处", () => {
    const missing = DAILY_TASKS.filter((t) => !dailyRouteOf(t.counterKey));
    expect(
      missing.map((t) => `${t.id}(${t.counterKey})`),
      "这些日课报得出任务，却报不出去哪儿做",
    ).toEqual([]);
  });

  it("去处都是真实注册的路由 —— 拼错一条，点下去什么也不会发生", () => {
    const routes = registeredRoutes();
    expect(routes.size, "没读到路由表").toBeGreaterThan(5);
    const bad = Object.entries(DAILY_ROUTES)
      .filter(([, hint]) => hint.route !== "/" && !routes.has(hint.route))
      .map(([key, hint]) => `${key} → ${hint.route}`);
    expect(bad, "这些去处没有对应的路由").toEqual([]);
  });

  it("首页那一行真的把它印出来，并且可点", () => {
    /*
     * 判那件事:日课行里有指向 `dailyRouteOf(...)` 的链接，且标签用它的 label。
     * 不钉具体标签名 —— 换成 `RouterLink` 还是 `<a>` 都行，要点是「有路可走」。
     */
    expect(HOME, "首页要读那张表").toMatch(/dailyRouteOf|dailyRoutes|DAILY_ROUTES/);
    expect(HOME, "那一行要带着 label 印出来").toMatch(/hint\.label|route\.label|\.label\s*\}\}/);
  });
});
