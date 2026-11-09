/**
 * 器谱进度 —— 二百八十八张谱,只报「读通 N 张」是不够的
 *
 * ## 缺口:连续掌握度只报了到顶那一档
 *
 * 器谱的掌握度是 **0~1 的连续值**(见 `core/blueprintMastery`),每成功重铸一次
 * 增一档,满掌握才算「读通」。而修仙录「随身所知」那一行只印:
 *
 * ```text
 *   读通器谱   0 / 288 张
 * ```
 *
 * 玩家因此读不出三件真会影响决策的事:
 *
 *   · **哪些快读通了**(差一两次的那几张,再砸一锤就落地)
 *   · **下一锤该砸哪张**(288 张里挑「最接近的」,现在只能凭记忆)
 *   · 自己到底读到了几分(0.9 与 0.1 在「0/288」里长得一模一样)
 *
 * 与敌手谱同一个形状:一个分档/连续系统,界面只报了终点。
 *
 * ## 只列**读过**的,未读的一律不点名
 *
 * `blueprintLore[id]` 为 0 或缺失 = 一张还没研读过的谱。把它们列出来既没用
 * (288 行),也泄漏「还有哪些谱存在」—— 与图鉴的 `???` 纪律一致。
 *
 * ## 「还差几次」读引擎那一份
 *
 * 差几次由 `blueprintReforgesUntilMastered(mastery, perReforge)` 给 ——
 * 它向上取整并扣浮点余量(0.98 不会被算成两次),非法增量返回 Infinity。
 * 界面不许自己写 `Math.ceil((1 - x) / step)`:`Infinity` 那一档会让界面印出
 * 「还差 Infinity 次」,而那是「这张谱的增量坏了」的意思,得单独处理。
 */
import { describe, expect, it } from "vite-plus/test";
import { blueprintProgress } from "./blueprintProgress";

/** 造一份器谱掌握度表 */
const lore = (record: Record<string, number>) => record;

/** 最小的谱定义(只需要 id 与名字) */
const defs = [
  { id: "bp_a", name: "青锋谱" },
  { id: "bp_b", name: "重剑谱" },
  { id: "bp_c", name: "软藤谱" },
];

describe("器谱进度 · 纯函数", () => {
  it("只列读过的 —— 未读的不点名", () => {
    const p = blueprintProgress(lore({ bp_a: 0.5, bp_b: 0 }), defs);
    expect(p.rows.map((r) => r.id)).toEqual(["bp_a"]);
  });

  it("按「差几次」从少到多排 —— 下一锤该砸哪张，排在第一位", () => {
    const p = blueprintProgress(lore({ bp_a: 0.2, bp_b: 0.9, bp_c: 0.6 }), defs, {
      perReforge: 0.1,
    });
    // 0.9 → 差 1 次;0.6 → 差 4;0.2 → 差 8
    expect(p.rows.map((r) => r.id)).toEqual(["bp_b", "bp_c", "bp_a"]);
    expect(p.rows[0]!.untilMastered).toBe(1);
  });

  it("已读通的排在最后 —— 它们不再需要锤", () => {
    const p = blueprintProgress(lore({ bp_a: 1, bp_b: 0.9 }), defs, { perReforge: 0.1 });
    expect(p.rows.map((r) => r.id)).toEqual(["bp_b", "bp_a"]);
    expect(p.rows[1]!.mastered).toBe(true);
    expect(p.rows[1]!.untilMastered).toBe(0);
  });

  it("报出掌握度的百分数 —— 0.9 与 0.1 不该长得一样", () => {
    const p = blueprintProgress(lore({ bp_a: 0.9 }), defs, { perReforge: 0.1 });
    expect(p.rows[0]!.percent).toBe(90);
  });

  it("**增量坏掉时不印 Infinity** —— 那是「这张谱不会涨」,要单独标", () => {
    /*
     * `blueprintReforgesUntilMastered` 在 `perReforge <= 0` 或非有限时返回
     * `Infinity`,注释写着「界面不能把『不会增长』冒充成『已读通』」。
     * 这里同样不能印「还差 Infinity 次」—— 那既不是数也不是人话。
     */
    const p = blueprintProgress(lore({ bp_a: 0.5 }), defs, { perReforge: 0 });
    expect(p.rows[0]!.untilMastered).toBeNull();
    expect(p.rows[0]!.stalled).toBe(true);
  });

  it("读通的不会被当成「停滞」", () => {
    const p = blueprintProgress(lore({ bp_a: 1 }), defs, { perReforge: 0 });
    expect(p.rows[0]!.mastered).toBe(true);
    expect(p.rows[0]!.stalled).toBe(false);
  });

  it("汇总:读过几张、读通几张、其中几张已近读通", () => {
    /*
     * 「近读通」的门槛取 5 次而不是 2:真实增量是 0.02(五十锤才读通一张),
     * 差 2 次等于 96% 以上 —— 那种谱几乎见不到,汇总会永远是 0,等于没做。
     */
    const p = blueprintProgress(lore({ bp_a: 1, bp_b: 0.9, bp_c: 0.5 }), defs, { perReforge: 0.1 });
    expect(p.known).toBe(3);
    expect(p.mastered).toBe(1);
    // 差 ≤ 5 次的算「近读通」:0.9 差 1 算、0.5 差 5 也算
    expect(p.nearlyDone).toBe(2);
  });

  it("坏值(负数 / NaN / 超 1)按引擎同一套夹回,不排进榜", () => {
    const p = blueprintProgress(lore({ bp_a: -1, bp_b: Number.NaN, bp_c: 2 }), defs, {
      perReforge: 0.1,
    });
    // 负值与 NaN → 0(未读过,不列);2 夹到 1(已读通)
    expect(p.rows.map((r) => r.id)).toEqual(["bp_c"]);
    const c = p.rows.find((r) => r.id === "bp_c")!;
    expect(c.mastered).toBe(true);
  });

  it("查不到定义的谱不列 —— 不印一个没有名字的 id", () => {
    const p = blueprintProgress(lore({ bp_unknown: 0.5 }), defs);
    expect(p.rows).toEqual([]);
  });

  it("一张都没读过时整块不出", () => {
    const p = blueprintProgress(lore({}), defs);
    expect(p.rows).toEqual([]);
    expect(p.known).toBe(0);
  });

  it("同差几次时按 id 稳定排 —— 顺序不随刷新变", () => {
    const p = blueprintProgress(lore({ bp_c: 0.9, bp_a: 0.9, bp_b: 0.9 }), defs, {
      perReforge: 0.1,
    });
    expect(p.rows.map((r) => r.id)).toEqual(["bp_a", "bp_b", "bp_c"]);
  });
});
