/**
 * 奇缘进度 —— 八条缘,走到第几段了没人告诉玩家
 *
 * ## 缺口:链进度是存档里的一等状态,却一个字都不显示
 *
 * `data/chains.ts` 有 8 条奇缘链、21 个阶段事件;进度存在
 * `player.eventChains`(每条链 → 已完成的段数),由 `eventEngine` 的
 * `pickChainStageEvent` 消费 —— 上一程结了哪一段缘,下一程才轮得到它。
 *
 * 而**界面上没有任何地方显示它**:玩家走「青石问路」走到第 2 段时,
 * 既看不出自己正走在一条缘上,也不知道这条缘还有几段、下回该去哪儿撞见它。
 * 奇缘恰恰是这一作最难得的叙事内容(无缘在续时它根本不出现),
 * 走了一半却看不见进度,等于把它当成一次性随机事件。
 *
 * ## 只列**动过**的缘,未开始的不点名
 *
 * 八条缘的 `hint` 是线索(「青石上的老者,问的从来不是答案」)——
 * 没碰过的缘把名字与线索摆出来,等于提前告诉玩家「还有这八条路可走」,
 * 与图鉴的 `???` 纪律冲突。故只列 `eventChains[id] > 0` 的,
 * 其余只报「另有 N 条缘未起」。
 *
 * ## 「已了」与「在续」要分开
 *
 * 走到最后一段 = 这条缘了了(不会再出现在抽取里);停在中间 = 在续。
 * 两种状态对玩家的意思完全不同:一个可以放下,一个要留个心眼。
 *
 * ## 这一层只算,不读 store
 *
 * 进度表由调用方传入(`player.eventChains`),故判据不必搭 Pinia。
 */
import { describe, expect, it } from "vite-plus/test";
import { chainLedger } from "./chainLedger";

/** 造一份链定义(与 `CHAINS` 同形,只取用得上的字段) */
const chains = [
  { id: "c_a", name: "青石问路", hint: "青石上的老者", stages: ["a1", "a2", "a3"] },
  { id: "c_b", name: "湖中剑影", hint: "湖心的影子", stages: ["b1", "b2"] },
  { id: "c_c", name: "灵狐衔恩", hint: "你救过的那只灵狐", stages: ["c1", "c2", "c3"] },
] as Parameters<typeof chainLedger>[0];

describe("奇缘进度 · 纯函数", () => {
  it("只列动过的缘 —— 未开始的不点名", () => {
    const ledger = chainLedger(chains, { c_a: 1 });
    expect(ledger.rows.map((r) => r.id)).toEqual(["c_a"]);
    expect(ledger.unstarted).toBe(2);
  });

  it("在续的缘报出「已完成几段 / 共几段」", () => {
    const ledger = chainLedger(chains, { c_a: 1 });
    const row = ledger.rows[0]!;
    expect(row.done).toBe(1);
    expect(row.total).toBe(3);
    expect(row.finished).toBe(false);
    expect(row.nextStage).toBe(2);
  });

  it("走完的缘标成「已了」,不再是「还差几段」", () => {
    const ledger = chainLedger(chains, { c_b: 2 });
    const row = ledger.rows[0]!;
    expect(row.finished, "两段全走完就是已了").toBe(true);
    expect(row.done).toBe(2);
    expect(row.total).toBe(2);
    expect(row.nextStage).toBeNull();
  });

  it("在续的排前面 —— 还等着你的那条才是下一步", () => {
    const ledger = chainLedger(chains, { c_a: 3, c_b: 1 });
    expect(
      ledger.rows.map((r) => r.id),
      "c_b 在续,c_a 已了",
    ).toEqual(["c_b", "c_a"]);
  });

  it("同在续时,「只差一段」的排前面 —— 离收束最近", () => {
    const ledger = chainLedger(chains, { c_a: 1, c_c: 2 });
    // c_c 差 1 段,c_a 差 2 段
    expect(ledger.rows.map((r) => r.id)).toEqual(["c_c", "c_a"]);
  });

  it("报出名字与线索 —— 玩家要认得是哪条缘", () => {
    const ledger = chainLedger(chains, { c_a: 1 });
    expect(ledger.rows[0]!.name).toBe("青石问路");
    expect(ledger.rows[0]!.hint).toBe("青石上的老者");
  });

  it("进度越界的坏值夹回合法区间 —— 不印「4 / 3 段」", () => {
    const ledger = chainLedger(chains, { c_a: 99, c_b: -5 });
    const a = ledger.rows.find((r) => r.id === "c_a")!;
    expect(a.done, "超出总段数的夹到总段数").toBe(3);
    expect(a.finished).toBe(true);
    // 负数 / 未开始都不该出现在榜上
    expect(ledger.rows.some((r) => r.id === "c_b")).toBe(false);
  });

  it("非有限值当作未开始", () => {
    const ledger = chainLedger(chains, { c_a: Number.NaN, c_b: Number.POSITIVE_INFINITY });
    expect(ledger.rows).toEqual([]);
    expect(ledger.unstarted).toBe(3);
  });

  it("表里没有的链 id 忽略 —— 不印一个查不到名字的进度", () => {
    const ledger = chainLedger(chains, { c_unknown: 2 });
    expect(ledger.rows).toEqual([]);
    expect(ledger.unstarted, "三条定义都没动过").toBe(3);
  });

  it("一条都没动过时整块不出", () => {
    const ledger = chainLedger(chains, {});
    expect(ledger.rows).toEqual([]);
    expect(ledger.started).toBe(0);
    expect(ledger.unstarted).toBe(3);
  });

  it("**只把「此刻真能走」的算作在续** —— 境界不够的不算", () => {
    /*
     * `pendingChainStages` 是「链未结 + 境界够 + 尚未抽到过」。境界不够的缘
     * 玩家这阵子撞不见,把它算成「在续」会让人白等。
     * 故榜上每行带一个 `reachable` 标记,由调用方传入的那份 pending 集合决定 ——
     * 这一层不自己判境界(那是引擎的口径,见 core/eventEngine.pendingChainStages)。
     */
    const ledger = chainLedger(chains, { c_a: 1, c_b: 1 }, { reachable: new Set(["c_a"]) });
    const a = ledger.rows.find((r) => r.id === "c_a")!;
    const b = ledger.rows.find((r) => r.id === "c_b")!;
    expect(a.reachable).toBe(true);
    expect(b.reachable, "境界不够/尚未轮到的标 false").toBe(false);
    expect(ledger.active, "只有真能走的那条算「在续」").toBe(1);
  });

  it("未了但够不着的排在能走的之后", () => {
    const ledger = chainLedger(chains, { c_a: 1, c_b: 1 }, { reachable: new Set(["c_b"]) });
    expect(
      ledger.rows.map((r) => r.id),
      "c_b 此刻能走,排前",
    ).toEqual(["c_b", "c_a"]);
  });

  it("统计:起了几条、了了几条", () => {
    const ledger = chainLedger(chains, { c_a: 3, c_b: 1, c_c: 2 });
    expect(ledger.started).toBe(3);
    expect(ledger.finished).toBe(1);
  });
});
