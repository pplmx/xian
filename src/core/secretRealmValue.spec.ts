/**
 * 秘境的性价比不许单调递减 —— 贵三倍的秘境至少得给得多一点。
 *
 * ## 缺口(第 94 轮实测)
 *
 * 秘境的收益是这样算的(`core/secretRealm` 的 `secretLayerReward`):
 *
 * ```text
 *   tier   = tierOfMajor(player.major)      ← 只由**玩家境界**决定,与秘境无关
 *   层数   = SECRET_LAYERS                  ← 全局常量 3,所有秘境相同
 *   每层   = stoneByTier(tier, (12 + 6×layer) × rewardMult)
 * ```
 *
 * 也就是说:**同境界玩家进任何秘境,层级与层数都一样**,差别只在 `rewardMult`。
 * 而入口代价从 30 一路涨到 200(6.7 倍),`rewardMult` 却只在 1.2~1.8 之间打转。
 *
 * 实测每单位代价的收益:
 *
 * ```text
 *   星辰古殿  成本  30  每成本 3.36   ← 最划算
 *   剑冢幻境  成本  60  每成本 1.56
 *   铁壁万壑  成本 120  每成本 0.81
 *   陨星荒原  成本 200  每成本 0.54   ← 最不划算,差 6.2 倍
 * ```
 *
 * **玩家没有任何理由去高级秘境** —— 低级秘境又便宜又划算。
 * 而高级秘境的 `minMajor` 门槛更高、规则更难,它们本该是升级选项。
 *
 * ## 修法:倍率按代价的平方根
 *
 * ```text
 *   rewardMult = 1.4 × sqrt(cost / 30)      (以星辰古殿为基准)
 * ```
 *
 * 平方根而不是线性:线性会让末段倍率到 9.33(总收益翻 9 倍,那又会把高级秘境
 * 变成唯一答案)。平方根让**总收益单调递增、每成本缓慢下降**:
 *
 * ```text
 *              修前          修后
 *   每成本    3.36→0.54    3.36→1.30    (差 6.2 倍 → 2.6 倍)
 *   总收益    101→108      101→260      (基本不动 → 单调递增)
 * ```
 *
 * ## 判据
 *
 * ① 总收益随代价单调递增 —— 贵的秘境必须给得更多,否则没人去;
 * ② 每成本收益不比最划算的那个低太多(不低于 1/3)—— 防止「高级秘境纯坑」;
 * ③ 层数与层级对所有秘境一致 —— 这是收益公式的前提,变了要重算这条判据。
 */
import { describe, expect, it } from "vite-plus/test";
import { SECRET_LAYERS, SECRET_REALMS } from "@/data/secretRealms";

/** 一个秘境的入口代价(凡境用灵石、天界用道源) */
function costOf(def: (typeof SECRET_REALMS)[number]): number {
  return "stone" in def.cost ? def.cost.stone : def.cost.daoSource;
}

/**
 * 一次完整秘境的总战利(不含层间结算的灵石差价,只看 `rewardMult` 的乘数部分)。
 *
 * `Σ_{layer=1..SECRET_LAYERS} (12 + 6×layer) × rewardMult` —— 与
 * `core/secretRealm` 的 `secretLayerReward` 同式。
 */
function totalReward(def: (typeof SECRET_REALMS)[number]): number {
  let sum = 0;
  for (let layer = 1; layer <= SECRET_LAYERS; layer += 1) {
    sum += (12 + 6 * layer) * def.rewardMult;
  }
  return sum;
}

describe("秘境 · 性价比不许单调递减", () => {
  it("① 总收益随代价单调递增", () => {
    const sorted = [...SECRET_REALMS].sort((a, b) => costOf(a) - costOf(b));
    expect(sorted.length, "秘境太少 —— 判据量不出趋势").toBeGreaterThanOrEqual(10);

    const drops: string[] = [];
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      // 代价相同的两个秘境不强求收益相等,只在代价真涨了时才比
      if (costOf(cur) <= costOf(prev)) continue;
      if (totalReward(cur) < totalReward(prev)) {
        drops.push(
          `${prev.name}(代价 ${costOf(prev)}, 总收益 ${totalReward(prev).toFixed(0)}) → ` +
            `${cur.name}(代价 ${costOf(cur)}, 总收益 ${totalReward(cur).toFixed(0)})`,
        );
      }
    }
    expect(drops, "更贵的秘境反而给得更少 —— 玩家没有理由去:" + drops.join("、")).toEqual([]);
  });

  it("② 最贵的秘境,每成本收益不低于最划算那个的三分之一", () => {
    /*
     * ① 只要求「总收益递增」,一个把倍率涨得极慢的方案也能过 ——
     * 那时每成本会一路跌到接近零。这条守住下界。
     *
     * 三分之一这条线:目前实测是 1.30 / 3.36 ≈ 0.39。留一点余量到 1/3。
     */
    const perCost = SECRET_REALMS.map((d) => ({
      name: d.name,
      value: totalReward(d) / costOf(d),
    })).sort((a, b) => b.value - a.value);
    const best = perCost[0]!;
    const worst = perCost[perCost.length - 1]!;
    expect(
      worst.value / best.value,
      `最贵的「${worst.name}」每成本只有「${best.name}」的 ` +
        `${((worst.value / best.value) * 100).toFixed(0)}% —— 高级秘境纯粹是坑`,
    ).toBeGreaterThan(1 / 3);
  });

  it("③ 前提:层数是全局常量 —— 若哪天按秘境分层,上面两条要重算", () => {
    /*
     * 这条不是挑刺,是**声明前提**。若将来 SECRET_LAYERS 变成按秘境取值,
     * 「同层级同代价下只差 rewardMult」这个基础就不成立了,
     * 上面两条的算法(假设层数相同)会给出错误结论。
     */
    expect(SECRET_LAYERS, "层数不再是 3 —— 收益公式变了,重读上面两条判据").toBe(3);
    // 每个秘境的定义里都没有 own layer 字段
    for (const d of SECRET_REALMS) {
      expect("layers" in d, `${d.name} 开始自带层数了 —— 上面两条判据的「同层数」前提没了`).toBe(
        false,
      );
    }
  });

  it("反空转:代价与倍率的取值范围正常", () => {
    for (const d of SECRET_REALMS) {
      expect(costOf(d), `${d.name} 代价为 0 —— 判据里的除零`).toBeGreaterThan(0);
      expect(d.rewardMult, `${d.name} 倍率不在合理区间`).toBeGreaterThan(1);
      expect(d.rewardMult, `${d.name} 倍率过高 —— 收益会失控`).toBeLessThanOrEqual(5);
    }
  });
});
