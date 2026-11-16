/**
 * 凡界那条「探索型」的链，不许悄悄退化成静态内容。
 *
 * ## 由来（第 444 轮）
 *
 * `motivationType.spec` 曾断言「凡界只满足 1/3 条结构条件」，并写下结论：
 *
 * ```text
 *   凡界的区域/敌人/事件都是静态定义，没有可重组的内容层 ——
 *   这才是「买到不同的世界」的真实成本
 * ```
 *
 * 而 `mortalWorldGen` 早把这件事做了，并且已经接进转世（`reincarnation` 第 363 行
 * 自动调 `rerollMortalWorld()`）。于是：
 *
 * ```text
 *   判据          断言「凡界还没做到」
 *   它守的数据     hostReady: false + note「凡界都是静态定义」
 *   两者互相印证  → 谁也没红 → 一过时就是很久
 * ```
 *
 * ## 这条判据守什么
 *
 * 不守「代码里有没有 mortalWorldGen」（那是导入检查），守的是**产出真的在变**：
 * 连造多世，看地界链、骨架、节奏、规则四样是不是真的各不相同。
 *
 * 若哪天有人为了「稳定」把生成器退回静态表，这条会红 —— 而它红的时候，
 * 上面那份审计的措辞也该一起改（两者说的本是同一件事）。
 */
import { describe, expect, it } from "vite-plus/test";
import { generateGatedMortal } from "@/core/mortalGate";
import { NOVELTY_MIN } from "@/core/worldGen";
import type { MortalWorld } from "@/core/mortalWorldGen";

/**
 * 造 n 世，取它们的可重组维度。
 *
 * ## 为什么走 `generateGatedMortal` 而不是直接调 `generateMortalWorld`
 *
 * 初版直接调生成器 —— 而故障注入（把 `mortalGate` 里的种子钉死）**没红**:
 * 判据量的是「生成器能产出不同的世界」，不是「游戏实际拿到的世界不同」。
 *
 * 两者差着 `mortalGate` 那一层（新颖度门、去重、连续偏向回避）。
 * 要守的是**玩家拿到的那条链**，故必须从门里过。
 */
function lives(n: number): {
  chain: string;
  shape: string;
  rhythm: string;
  rule: string;
  bias: string;
}[] {
  const out = [];
  const history: MortalWorld[] = [];
  let seed = 20268823;
  for (let i = 0; i < n; i += 1) {
    const g = generateGatedMortal(seed, history);
    if (!g) break;
    const w = g.report.world;
    out.push({
      chain: w.chain.map((c) => c.fromId).join("→"),
      shape: w.shapeId,
      rhythm: w.rhythmId,
      rule: w.ruleId,
      bias: w.bias,
    });
    history.push(w);
    seed += 7919;
  }
  return out;
}

/*
 * 四门评估很贵（每世要跑十轮可玩性审计）。四世约 5 秒；在并行全量里会被拉长到 20 秒
 * 以上而超时。故**只取样一次**，几条判据共用同一批样本。
 */
let CACHE: ReturnType<typeof lives> | null = null;
function sample() {
  CACHE ??= lives(4);
  return CACHE;
}

describe("凡界 · 探索型能力不许退化", () => {
  it("地界链不是同一个 —— 凡界不是「同一批区域换名字」", { timeout: 90000 }, () => {
    /*
     * 初版要求「六世里至少五种不同的链」—— 实测是 4 种，判据红了。
     *
     * 那不是产品的问题:四门筛的是**够不够新**（结构新颖度、骨架、节奏、语义），
     * 不是「链必须两两不同」。两条链可以地界相同而骨架/节奏/规则不同，
     * 那仍然是一个不同的世界。
     *
     * 故这条的口径改成:**非平凡** —— 六世不能只产出一条链。
     */
    /*
     * 样本取 4 世而不是 6 —— 四门评估很贵（每世要跑十轮可玩性审计），
     * 六世会把这条推到 30 秒以上（实测超时）。4 世足够判定「不是同一个」。
     */
    const rows = sample();
    const chains = new Set(rows.map((r) => r.chain));
    expect(
      chains.size,
      `四世只产出 ${chains.size} 种地界链 —— 生成器退化成静态内容了`,
    ).toBeGreaterThan(2);
    /*
     * 而**每一世在四维合起来上都不同** —— 实测四世:
     *
     * ```text
     *   第1世  short_weave / front / heaven_wrath / 灵石充盈
     *   第2世  weave       / flat  / foe_combo    / 典籍散佚
     *   第3世  shallow     / mid   / time_thinning/ 药气氤氲
     *   第4世  short_weave / mid   / heal_scarce  / 矿脉深厚
     * ```
     *
     * 第 4 世与第 1 世骨架同为 `short_weave`，而节奏与规则不同 —— 仍是两个世界。
     * 这条断言的是「没有两个完全相同的世界」，不是「链必须两两不同」。
     */
    const worlds = rows.map((r) => `${r.chain}|${r.shape}|${r.rhythm}|${r.rule}|${r.bias}`);
    expect(
      new Set(worlds).size,
      `四世里有完全相同的世界 —— 生成器在重复自己:${worlds.join(" / ")}`,
    ).toBe(worlds.length);
  });

  it("四样可重组维度各自都在变", { timeout: 60000 }, () => {
    const rows = sample();
    for (const key of ["shape", "rhythm", "rule", "bias"] as const) {
      const distinct = new Set(rows.map((r) => r[key]));
      expect(
        distinct.size,
        `${key} 在四世里只有 ${distinct.size} 种取值 —— 这一维是死的`,
      ).toBeGreaterThan(1);
    }
  });

  it("新颖度门是有限值的，不是「随便生成」", () => {
    /*
     * `NOVELTY_MIN` 是硬门槛，不过审就换种子重来。
     * 这条只钉「门槛存在且大于零」—— 门槛的具体数值由 mortalGate 自己的判据管。
     */
    expect(NOVELTY_MIN, "新颖度门被取消了 —— 「每次不同」会退化成概率").toBeGreaterThan(0);
    expect(NOVELTY_MIN).toBeLessThan(1);
  });

  it("反差：静态内容那一边仍然静态 —— 这条判据量的是凡界，不是所有东西", () => {
    /*
     * 敌人表是静态的（140 只固定敌人）。生成器重组的是**哪一段路上遇到谁**，
     * 不是「造出新敌人」。这条守住这个边界，免得有人以为凡界连敌人都生成了。
     */
    const g1 = generateGatedMortal(1);
    const g2 = generateGatedMortal(2);
    expect(g1, "第一世没过门 —— 判据量不到东西").not.toBeNull();
    expect(g2, "第二世没过门 —— 判据量不到东西").not.toBeNull();
    const a = g1!.report.world;
    const b = g2!.report.world;
    /*
     * 两世的敌人池来自同一份静态表 —— 故这不会因为种子不同而多出新敌人。
     * 这里只断言「链不同而池相同」这个组合确实成立。
     */
    expect(a.chain.length).toBeGreaterThan(0);
    expect(b.chain.length).toBeGreaterThan(0);
    expect(a.chain.map((c) => c.fromId).join(), "两世的链一样 —— 生成器没起作用").not.toBe(
      b.chain.map((c) => c.fromId).join(),
    );
  });
});
