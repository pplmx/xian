/**
 * 有一味丹方，永远炼不出来 —— 因为要求比建筑上限还高。
 *
 * ## 由来（第 490 轮）
 *
 * 「从玩家的一个具体行为出发」：我在金仙（境 11）想炼一炉丹。
 *
 * ```text
 *   炼丹术  = 洞府「丹房」的建筑等级（stores/dongfu.ts:83）
 *   丹房上限 = maxLevel 10（data/buildings.ts）
 *   金仙道体丹 = 需炼丹术 11 级
 * ```
 *
 * 这条路径走到第二行就断了：**那味丹没有配方之外的第二条获取途径**，
 * 而配方它永远够不着。
 *
 * ## 而这味丹是上一轮我自己写的
 *
 * 第 487 轮给四个单薄境界各补一味增益丹，金仙那味写成了 `alchemyLevel: 11`
 * —— 当时数的是「境界 11 → 炼丹术 11」，把**境界编号**与**技艺等级**当成了同一个刻度。
 * 丹房最高 10 级，于是它从写下的那一刻就是死内容。
 *
 * > 断言「加进去了」很容易（PILLS.length +1），
 * > 断言「加得进去、也拿得到」需要顺着一条真实路径走到底。
 *
 * ## 判据
 *
 * ① 每一条丹方的 `alchemyLevel` 都不超过丹房的 `maxLevel`；
 * ② 反差：那上限要从建筑表里现算，不是写死一个 10 —— 将来丹房能升到 12，
 *    这条判据得跟着放宽，而不是继续拦着；
 * ③ 反差：也不许把丹方全压到很低 —— 至少有一条用到接近上限的等级，
 *    否则「技艺升级」这件事就没有终局意义。
 */
import { describe, expect, it } from "vite-plus/test";
import { PILLS } from "@/data/pills";
import { BUILDINGS } from "@/data/buildings";

/** 丹房的等级上限 —— 现算，不写死 */
function alchemyMaxLevel(): number {
  const b = BUILDINGS.find((x) => x.id === "alchemy");
  expect(b, "建筑表里找不到丹房 —— 判据会空转").toBeDefined();
  const max = (b as { maxLevel?: number }).maxLevel;
  expect(max, "丹房没有 maxLevel 字段 —— 判据读不到上限").toBeGreaterThan(0);
  return max!;
}

describe("丹方 · 技艺等级要真的够得着", () => {
  it("① 没有一条丹方要求超过丹房上限", () => {
    const max = alchemyMaxLevel();
    const unreachable = PILLS.filter((p) => p.recipe && (p.alchemyLevel ?? 0) > max).map(
      (p) => `${p.name}(境${p.minRealm}): 需 ${p.alchemyLevel} 级，而丹房最高 ${max} 级`,
    );
    expect(
      unreachable,
      "这些丹方永远炼不出来 —— 技艺等级够不着：" + unreachable.join("；"),
    ).toEqual([]);
  });

  it("② 反差：上限是现算的，不是写死一个数", () => {
    /*
     * 这一条不是在测产品，是在测①自己的口径。
     * 若哪天丹房能升到 12 级，① 应当自动放宽 —— 而它只有从建筑表读上限才做得到。
     */
    const max = alchemyMaxLevel();
    expect(max, "丹房上限读出来是 0 或负数").toBeGreaterThan(0);
    for (const p of PILLS.filter((x) => x.recipe)) {
      expect(typeof (p.alchemyLevel ?? 0), `${p.name} 的 alchemyLevel 不是数字`).toBe("number");
    }
  });

  it("③ 反差：至少有一条用到接近上限的等级 —— 否则技艺升级没有终局意义", () => {
    const max = alchemyMaxLevel();
    const top = Math.max(...PILLS.filter((p) => p.recipe).map((p) => p.alchemyLevel ?? 0));
    expect(
      top,
      `全表最高只要求 ${top} 级，而丹房能升到 ${max} 级 —— 升满没有回报`,
    ).toBeGreaterThanOrEqual(max - 1);
  });
});
