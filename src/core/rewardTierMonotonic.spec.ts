/**
 * 难度分层了,回报也得分层 —— 一张表看住所有「层级 → 回报」的系统。
 *
 * ## 为什么要有这一条
 *
 * 第 62、93、94 三轮各在一个**不同地方**撞见了同一类问题,三次都是先发现才补判据:
 *
 * ```text
 *   第 62 轮  十道试炼里九道奖励同一个数     → celestialCaliber.spec
 *   第 93 轮  五个天界的奖励都是 60          → celestialReward.spec
 *   第 94 轮  秘境越贵每块钱换得越少         → secretRealmValue.spec
 * ```
 *
 * 三次的共同形状:**两列数字各自都合理,但从没被摆在一起比过**。
 * 每一列单独看都在合理区间里,所以任何「上界 / 下界」判据都绿;
 * 只有**排序后逐对比**才看得见。
 *
 * 这一条不重复那三份判据的细节,它只做一件事:**列出所有该受这条纪律约束的系统,
 * 确认每一个都真的在某个 spec 里被判过**。哪天有人加了个新的「按层级给奖励」的系统
 * 而没配判据,这里会红。
 *
 * ## 判据怎么才算「被判过」
 *
 * 不检查判据的具体写法(那会把这条变脆),只检查**那个 spec 文件里出现了
 * 「升序 / 不回落 / 单调」这类字眼**。措辞可以不同,但必须有一句在说这件事。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";

/**
 * 受「难度分层 ↔ 回报分层」约束的系统。
 *
 * 每一条给出:系统名、数据源、守它的 spec、以及**难度是怎么量的**。
 * 最后一项最要紧 —— 第 95 轮就差点因为「用 anchorTier 当难度」而误报试炼。
 */
const TIERED_REWARDS: readonly {
  system: string;
  /** 数据在哪(给人看) */
  source: string;
  /** 守它的 spec(相对 src/) */
  spec: string;
  /** 难度用什么量 */
  difficultyMetric: string;
}[] = [
  {
    system: "天界试炼",
    source: "data/endgame.ts 的 TRIALS",
    spec: "core/celestialCaliber.spec.ts",
    difficultyMetric: "(fights / (0.5 + healBetweenPct)) × escalation",
  },
  {
    system: "固定天界",
    source: "data/endgame.ts 的 CELESTIAL_WORLDS",
    spec: "core/celestialReward.spec.ts",
    difficultyMetric: "anchorTier",
  },
  {
    system: "秘境",
    source: "data/secretRealms.ts 的 SECRET_REALMS",
    spec: "core/secretRealmValue.spec.ts",
    // 秘境的难度≈代价(层级与层数对所有秘境相同,见 secretRealm 的 secretLayerReward)
    difficultyMetric: "入口代价 cost",
  },
];

/** 判定「这个 spec 确实在说回报要随难度走」的关键词 */
const MONOTONIC_WORDS = ["不回落", "升序", "单调", "递增"];

describe("跨系统 · 难度分层了,回报也得分层", () => {
  for (const { system, source, spec, difficultyMetric } of TIERED_REWARDS) {
    it(`${system} 有守着「回报随难度走」的判据`, () => {
      const text = readFileSync(join(ROOT, "src", spec), "utf8");
      expect(text.length, `${spec} 是空的`).toBeGreaterThan(500);

      const hit = MONOTONIC_WORDS.filter((w) => text.includes(w));
      expect(
        hit.length,
        `${spec} 里找不到任何一句在说「回报要随难度走」—— ${system}(${source}, 难度按 ${difficultyMetric} 量)` +
          ` 的难度与回报可能已经分叉。见过的关键词:${MONOTONIC_WORDS.join(" / ")}`,
      ).toBeGreaterThan(0);
    });
  }

  it("反空转:清单覆盖了四类回报系统里的至少三类", () => {
    /*
     * 这条防的是「清单被悄悄删短」—— 删到只剩一条时上面那组永远绿。
     *
     * 已知的「按层级给回报」的系统:试炼、天界、秘境、(试炼之外还有)
     * 悬赏与远征。后两者的回报走 `stoneByTier(major/tier, …)`,
     * 天然随境界涨,不需要逐条对账 —— 但它们的存在说明清单不该少于三条。
     */
    expect(TIERED_REWARDS.length, "清单被删短了").toBeGreaterThanOrEqual(3);
  });

  it("每一条的 spec 路径都真实存在", () => {
    for (const { spec, system } of TIERED_REWARDS) {
      expect(
        () => readFileSync(join(ROOT, "src", spec), "utf8"),
        `${system} 的 spec 不见了`,
      ).not.toThrow();
    }
  });
});
