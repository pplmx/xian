/**
 * 「混沌道祖一层:天品八成 / 仙品一成半 / 神品一两个百分点」—— 注释里的数字没人守。
 *
 * ## 断言在哪里
 *
 * `data/constants.ts` 在 `QUALITY_WEIGHTS` 上方写着:
 *
 * > Phase 37 随强度阶梯一起收紧了高端:天品 4 → 2.5 · 仙品 1 → 0.5 · 神品 0.2 → 0.05,
 * > 叠上窗口与层级加成后,混沌道祖一层的掉落约 **天品八成 / 仙品一成半 / 神品一两个百分点**
 * > (旧口径:神品 0.1%、且凡品良品还在掉)。「手枪」是可以有的,但得自己攒出来。
 *
 * ## 实测:注释是准的
 *
 * 20k 次 `generateEquipment(32)`(混沌道祖对应 `maxTierForMajor(20)` = 32):
 *
 * ```text
 * 地品 0.53% · 天品 81.38% · 仙品 16.41% · 神品 1.67%
 * ```
 *
 * 三个数与注释「八成 / 一成半 / 一两个百分点」逐一吻合。
 *
 * ## 为什么需要判据
 *
 * 这段注释是**调参者的唯一依据**:以后想动 `QUALITY_WEIGHTS` 或 `QUALITY_TIER_SHIFT`,
 * 第一件事就是读这几行,看「改了之后高端还剩多少」。可它没有任何东西守着 ——
 * 常数一改,注释里的数字立刻过期,而没有任何判据会红。
 *
 * 更糟的是这些数字**看起来像事实**:没有人会去怀疑一段写着精确百分比的注释。
 *
 * ## 判据守什么
 *
 * 一条:按注释说的口径实测一遍,三个数必须落在注释给的区间里。
 *
 * 区间取宽(八成 = 70~90%、一成半 = 8~25%、一两点 = 0.5~3%),因为这是**抽样**
 * 不是精确值 —— 判据守的是「注释与实现没分家」,不是「小数点后两位一致」。
 */
import { describe, expect, it } from "vite-plus/test";
import { generateEquipment } from "@/core/equipGen";
import { RandomService, mulberry32 } from "@/utils/random";
import { maxTierForMajor } from "@/data/regions";

/** 混沌道祖 = 第 20 大境(0 起) */
const CHAOS_ANCESTOR_MAJOR = 20;
const SAMPLES = 20000;

function distribution(tier: number): Record<string, number> {
  const rng = new RandomService(mulberry32(20260101));
  const cnt: Record<string, number> = {};
  for (let i = 0; i < SAMPLES; i++) {
    const q = generateEquipment(tier, rng).quality;
    cnt[q] = (cnt[q] ?? 0) + 1;
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(cnt)) out[k] = v / SAMPLES;
  return out;
}

describe("混沌道祖一层的掉落分布 · 注释里的数要能对上", () => {
  it("天品约八成、仙品约一成半、神品一两个百分点", () => {
    const tier = maxTierForMajor(CHAOS_ANCESTOR_MAJOR);
    expect(tier, "混沌道祖的最高 tier 变了 —— 注释里的口径要跟着复核").toBe(32);
    const d = distribution(tier);
    expect(
      d.heaven ?? 0,
      `天品 ${((d.heaven ?? 0) * 100).toFixed(1)}% —— 注释写「八成」`,
    ).toBeGreaterThan(0.7);
    expect(
      d.heaven ?? 0,
      `天品 ${((d.heaven ?? 0) * 100).toFixed(1)}% —— 注释写「八成」`,
    ).toBeLessThan(0.9);
    expect(
      d.immortal ?? 0,
      `仙品 ${((d.immortal ?? 0) * 100).toFixed(1)}% —— 注释写「一成半」`,
    ).toBeGreaterThan(0.08);
    expect(
      d.immortal ?? 0,
      `仙品 ${((d.immortal ?? 0) * 100).toFixed(1)}% —— 注释写「一成半」`,
    ).toBeLessThan(0.25);
    expect(
      d.divine ?? 0,
      `神品 ${((d.divine ?? 0) * 100).toFixed(2)}% —— 注释写「一两个百分点」`,
    ).toBeGreaterThan(0.005);
    expect(
      d.divine ?? 0,
      `神品 ${((d.divine ?? 0) * 100).toFixed(2)}% —— 注释写「一两个百分点」`,
    ).toBeLessThan(0.03);
  });

  it("注释说的「凡品良品还在掉」也成立 —— 高阶不该再掉凡良", () => {
    const tier = maxTierForMajor(CHAOS_ANCESTOR_MAJOR);
    const d = distribution(tier);
    expect(d.mortal ?? 0, "混沌道祖还能掉凡品 —— 与「旧口径」那段对比不成立").toBe(0);
    expect(d.fine ?? 0, "混沌道祖还能掉良品").toBe(0);
  });

  it("反空转:低阶仍以凡良为主(判据不是因为它本来就高才绿)", () => {
    const d = distribution(1);
    expect((d.mortal ?? 0) + (d.fine ?? 0), "一阶不掉凡良 —— 取样或生成器出问题了").toBeGreaterThan(
      0.8,
    );
  });
});
