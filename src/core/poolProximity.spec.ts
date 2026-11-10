/**
 * 「按境界开放的池子」的共同口径 —— 四条路各写各的，但必须守同两件事。
 *
 * ## 由来
 *
 * 第 61~70 轮里同一个坑在四条路上分别被踩了一次:
 *
 * ```text
 * 第 67 轮  际遇给丹    权重只按品阶,不看境界        → 境 20 有 37% 拿到灵品及以下
 * 第 68 轮  掉落给丹    同一个公式,漏改              → 境 20 有 52% 是过时品阶
 * 第 69 轮  参悟功法    只有品阶 × 灵根倾向           → 境 20 有 56.8% 撞见入门功法
 * 第 70 轮  随机赠灵兽  干脆 rng.pick 均匀抽          → 境 0 有 24% 白捡天品
 * ```
 *
 * 正确的形态早写在 `core/loot` 的 `artifactDropWeight` 里(加法窗口、不把旧内容关死),
 * 只是没人把它当成口径。口径现已在 `docs/design.md` 立下,这个 spec 负责钉住它。
 *
 * ## 两条口径
 *
 * ① **旧内容不许被关死** —— 差再大,权重也不归零。
 * ② **新内容要有可见的优先** —— 同境界的权重必须明显高于远古内容。
 *
 * 这两条互相拉扯:只守①会让池子永远平摊(第 70 轮的毛病),
 * 只守②会把旧内容关死(图鉴就补不齐了)。判据要同时钉两头。
 */
import { describe, expect, it } from "vite-plus/test";
import { artifactDropWeight } from "./loot";
import { GONGFA } from "@/data/gongfa";
import { gongfaDrawWeight } from "./gongfaService";
import { PILLS } from "@/data/pills";
import { qualityDef } from "@/data/qualities";
import { randomEventPill, randomGiftPets, EVENT_PILL_NEAR_DECAY } from "./eventEngine";
import { randomDropPill } from "./loot";
import type { ArtifactDef } from "@/types";

/** 径路 1:法宝掉落 —— 加法窗口 W=5 / B=4 */
const artifactWeight = (tier: number, fromTier: number, quality: ArtifactDef["quality"]): number =>
  artifactDropWeight({ quality, fromTier } as Parameters<typeof artifactDropWeight>[0], tier);

/**
 * 径路 3:丹药两条路共用的一式(品阶基数 × 境界差倒数)。
 *
 * 衰减系数**从实现读**(`PILL_NEAR_DECAY`),不在这里写死 ——
 * 第一版我抄了个 `0.5`,后来把实现调到 `2`,判据还在按 `0.5` 算,当场红给我看。
 * 这正是第 67 / 70 轮踩过的同一个坑。
 */
const pillWeight = (rank: number, minRealm: number, major: number): number =>
  100 / (1 + rank * 2) / (1 + Math.max(0, major - minRealm) * EVENT_PILL_NEAR_DECAY);

describe("按境界开放的池子 · 共同口径", () => {
  describe("① 旧内容不许被关死", () => {
    it("法宝:跨 20 阶的旧法宝权重仍大于 0", () => {
      const w = artifactWeight(32, 1, "mortal");
      expect(w, "远古法宝的权重归零了 —— 图鉴里的旧格子再也点不亮").toBeGreaterThan(0);
    });

    it("丹药:跨 19 境的入门丹权重仍大于 0", () => {
      const w = pillWeight(qualityDef("mortal").rank, 0, 20);
      expect(w, "入门丹在后期权重归零了").toBeGreaterThan(0);
    });

    it("功法:境界差 20 的入门功法权重仍大于 0", () => {
      const entry = GONGFA.find((g) => g.minRealm === 0);
      expect(entry, "找不到境界 0 的功法").toBeDefined();
      const w = gongfaDrawWeight(entry!, [], 20);
      expect(w, "入门功法在后期权重归零了").toBeGreaterThan(0);
    });

    it("灵兽:低品阶始终留在随机赠池里", () => {
      // 境 20 的池子里仍应有精品及以下的灵兽
      const pool = randomGiftPets(new Set<string>(), 20);
      const low = pool.filter((p) => qualityDef(p.quality).rank <= qualityDef("excellent").rank);
      expect(low.length, "高境界的赠池里把低品阶灵兽全踢掉了").toBeGreaterThan(0);
    });
  });

  describe("② 新内容要有可见的优先", () => {
    it("法宝:同阶法宝的权重明显高于跨 20 阶的旧物", () => {
      const near = artifactWeight(32, 32, "heaven");
      const far = artifactWeight(32, 12, "heaven");
      expect(near / far, "同阶与旧物的权重差太小 —— 新法宝等于没加").toBeGreaterThan(2);
    });

    it("丹药:同境丹的权重高于入门丹", () => {
      /*
       * 比的是「同境的神品丹」与「入门凡品丹」—— 取**际遇**那条路的系数,
       * 因为只有全池(72 味、含神品)才量得出这个比值;掉落池只有 15 味、没有神品,
       * 那条路的系数本来就取得小(0.5),拿它量会得出「永远不达标」的假结论。
       *
       * 品阶降权对凡品给 33.3、对神品只给 5.88(差 5.7 倍),境界差衰减要压过这个
       * 初始差距才能让同境丹真的更常见。实测 K=2 时是 2.41 倍,阈值取 2。
       */
      const near = pillWeight(qualityDef("divine").rank, 20, 20);
      const far = pillWeight(qualityDef("mortal").rank, 0, 20);
      expect(near / far, "同境丹与入门丹的权重差太小 —— 境界差衰减没压过品阶降权").toBeGreaterThan(
        2,
      );
    });

    it("功法:境界差越大,权重越低(同品阶比较)", () => {
      /*
       * 不比「境 20 的某部」对「境 0 的某部」—— 那两批的品阶分布不同
       * (境 20 只有 3 部神品、境 0 有 19 部凡品良品),单点比会混进品阶效应。
       *
       * 改比**同一个品阶**下,近的比远的高。这直接量「就近因子有没有生效」。
       */
      const divine = GONGFA.filter((g) => g.quality === "divine" && g.minRealm <= 20);
      expect(divine.length, "神品功法太少 —— 判据选不出样本").toBeGreaterThan(1);
      const near = divine.reduce((best, g) => {
        const w = gongfaDrawWeight(g, [], 20);
        return w > best ? w : best;
      }, 0);
      // 同一批里挑一个境界差最大的
      const far = divine.reduce((worst, g) => {
        const w = gongfaDrawWeight(g, [], 20);
        return w < worst ? w : worst;
      }, Infinity);
      expect(near / far, "同品阶内,近境界的功法没有比远境界的更容易抽到").toBeGreaterThan(1.2);
    });
  });

  describe("③ 丹药两条路必须用同一式", () => {
    it("际遇给丹与掉落给丹的品阶分布同口径", () => {
      /*
       * 这两条路各自有一份权重公式(一处 `100/(1+rank×2)`,一处 `pillDropWeight`)。
       * 只要品阶基数或衰减系数有一个不同,「打的」和「捡的」品阶分布就会分叉 ——
       * 而玩家看不出这是两条路。
       *
       * 这里不比函数实现(它们本来就分在两处),比的是**抽样出来的分布**:
       * 在同一境界各抽 300 次,高品阶的占比不能相差太多。
       */
      const count = 300;
      const share = (ids: (string | null)[]): number => {
        let high = 0;
        let total = 0;
        for (const id of ids) {
          if (!id) continue;
          const def = PILLS.find((p) => p.id === id);
          if (!def) continue;
          total += 1;
          if (qualityDef(def.quality).rank >= qualityDef("earth").rank) high += 1;
        }
        return total === 0 ? 0 : high / total;
      };
      const fromEvent = Array.from({ length: count }, () => randomEventPill(20));
      const fromDrop = Array.from({ length: count }, () => randomDropPill(20));
      expect(share(fromEvent), "际遇给丹的高品阶占比为 0 —— 抽样没生效").toBeGreaterThan(0);
      expect(share(fromDrop), "掉落给丹的高品阶占比为 0 —— 抽样没生效").toBeGreaterThan(0);
      /*
       * 两条路的池子不同(际遇用全池 72 味、掉落只用 15 味掉落专属),
       * 所以占比不可能完全一致。这里守的是「不许差一个量级」——
       * 实测修后是 0.21,阈值取 0.35(池子差异本身就贡献了一部分)。
       */
      expect(
        Math.abs(share(fromEvent) - share(fromDrop)),
        "际遇给丹与掉落给丹的高品阶占比差得太多 —— 两条路的衰减参数分叉了",
      ).toBeLessThan(0.35);
    });
  });
});
