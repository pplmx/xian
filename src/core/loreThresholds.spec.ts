/**
 * 敌人认知的门槛 —— 「首领也够得着洞悉」这件事,得有人守着。
 *
 * ## 缺口(第 123 轮实测)
 *
 * 第 122 轮查出 `data/names.ts` 是唯一没有判据引用的数据表,补上了。这轮用同样的办法
 * 扫 `src/core/` 的 170 个模块:43 个没有同名 spec,其中 38 个被别的 spec 读过,
 * **5 个完全没人读**(与第 89 轮 `moduleCoverage.spec` 记录的 PORT_ONLY 清单一致)。
 *
 * 逐个看下来,`engineCodex` / `loreThresholds` 这一对值得管 —— 前者是图鉴对库的定制,
 * 后者是「分几档、门槛多少」的本作口径。两者都没有判据,而它们守着一处**曾经失效过**的设计:
 *
 * ```text
 *   首领认知原本用「普通门槛 ×2」= [0, 2, 10, 28]
 *   而首领一条命只打一次(已靖后不复现)
 *   → 「知其路数」(10 次)与「洞悉」(28 次)对首领永远够不着
 *   → 专为首领写的两层情报(残血变阵 / 本相)没人看得到
 * ```
 *
 * 修法是两件配套的事:
 *
 * ```text
 *   loreThresholds.ts     首领门槛单独定档 [0, 1, 2, 3]
 *   regionRevival.ts      妖气复聚让「已靖」地界的旧主归来(每 72 小时一轮)
 * ```
 *
 * **两件事必须同时成立**,少一件门槛就还是够不着。而没有判据时,
 * 任一件被改回去都不会有人发现。
 *
 * ## 判据
 *
 * ① 门槛递增、首档为 0、层数与名字一致;
 * ② 首领门槛严格小于普通门槛 —— 它按「见到它的机会」定档,不按复杂度;
 * ③ **可达性**:首领在复聚节律下的洞悉耗时落在一个合理区间(数天到数周);
 * ④ 反空转。
 */
import { describe, expect, it } from "vite-plus/test";
import {
  ENEMY_LORE_BOSS_THRESHOLDS,
  ENEMY_LORE_LOSS_WEIGHT,
  ENEMY_LORE_MAX,
  ENEMY_LORE_STAGE_NAMES,
  ENEMY_LORE_THRESHOLDS,
} from "./loreThresholds";
import { REVIVE_AFTER_HOURS } from "./engineMemory";

describe("敌人认知门槛 · 首领也够得着洞悉", () => {
  it("① 门槛递增、首档为 0、层数与名字一致", () => {
    for (const [label, list] of [
      ["普通", ENEMY_LORE_THRESHOLDS],
      ["首领", ENEMY_LORE_BOSS_THRESHOLDS],
    ] as const) {
      expect(list[0], `${label}门槛的首档必须是 0(见一面就该「眼熟」)`).toBe(0);
      for (let i = 1; i < list.length; i += 1) {
        expect(
          list[i]!,
          `${label}门槛不是递增的:第 ${i} 档 ${list[i]} 不大于第 ${i - 1} 档 ${list[i - 1]}`,
        ).toBeGreaterThan(list[i - 1]!);
      }
      expect(
        list.length,
        `${label}门槛有 ${list.length} 档,而阶段名有 ${ENEMY_LORE_STAGE_NAMES.length} 个`,
      ).toBe(ENEMY_LORE_STAGE_NAMES.length);
    }
    expect(ENEMY_LORE_MAX, "认知层上限与阶段数不符").toBe(ENEMY_LORE_STAGE_NAMES.length - 1);
  });

  it("② 首领门槛严格低于普通门槛 —— 按「见到它的机会」定档,不按复杂度", () => {
    /*
     * 这是那次修复的核心。首领一条命只打一次,若门槛与普通敌人同档(或加倍),
     * 高层情报就永远够不着。判据要求**每一档都严格更低**,不只是最后一档。
     */
    /*
     * 从**第 2 档**起要求严格更低。
     *
     * 第 1 档两边都是 1:「见一面就该眼熟」对杂兵与首领一视同仁,这一档不必更低。
     * 第一版从 i=1 起就要求严格更低,当场误报 —— 那是把「每一档都要更低」
     * 当成了设计,而实际的设计是「**高层**要够得着」。
     */
    for (let i = 2; i < ENEMY_LORE_THRESHOLDS.length; i += 1) {
      expect(
        ENEMY_LORE_BOSS_THRESHOLDS[i]!,
        `第 ${i} 档:首领门槛 ${ENEMY_LORE_BOSS_THRESHOLDS[i]} 不小于普通门槛 ` +
          `${ENEMY_LORE_THRESHOLDS[i]} —— 首领只打一次,高层认知会永远够不着`,
      ).toBeLessThan(ENEMY_LORE_THRESHOLDS[i]!);
    }
    // 第 1 档允许相等,但不许比普通门槛还高
    expect(
      ENEMY_LORE_BOSS_THRESHOLDS[1]!,
      "首领的「眼熟」门槛比普通敌人还高 —— 见一面还不够认识它",
    ).toBeLessThanOrEqual(ENEMY_LORE_THRESHOLDS[1]!);
    /*
     * 也守一下「不许把首领门槛调到 0」:每档都为 0 时,见一面就全知,
     * 那等于把三层情报压成一层 —— 门槛存在就没意义了。
     */
    expect(
      ENEMY_LORE_BOSS_THRESHOLDS[ENEMY_LORE_BOSS_THRESHOLDS.length - 1],
      "首领的洞悉门槛是 0 —— 见一面就全知,三层情报被压成一层",
    ).toBeGreaterThan(0);
  });

  it("③ 可达性:首领洞悉耗时落在数天到数周之间", () => {
    /*
     * 这条把两处配套的东西接起来:`loreThresholds` 的档位与 `engineMemory` 的复聚周期。
     *
     * ```text
     *   洞悉需 3 战 × 每战间隔 72 小时 = 216 小时 ≈ 9 天
     * ```
     *
     * 上界取 6 周(1008 小时):再长就不是「这一世能做完的内容」。
     * 下界取 2 天(48 小时):再短就失去「隔几天才见一面」的分量,
     * 等于把首领当杂兵刷。
     */
    const needs = ENEMY_LORE_BOSS_THRESHOLDS[ENEMY_LORE_BOSS_THRESHOLDS.length - 1]!;
    expect(needs, "首领洞悉不需要任何交手 —— 门槛形同虚设").toBeGreaterThan(0);

    const hours = needs * REVIVE_AFTER_HOURS;
    expect(
      hours,
      `首领洞悉需 ${needs} 战 × ${REVIVE_AFTER_HOURS}h = ${hours}h(${(hours / 24).toFixed(1)} 天)` +
        ` —— 太短意味着复聚周期被压得没有分量`,
    ).toBeGreaterThanOrEqual(48);
    expect(
      hours,
      `首领洞悉需 ${hours}h(${(hours / 24).toFixed(1)} 天)—— 超过六周,这一世做不完`,
    ).toBeLessThanOrEqual(1008);
  });

  it("④ 战败加权仍是正数,且不至于一败顶全档", () => {
    /*
     * `ENEMY_LORE_LOSS_WEIGHT = 3` —— 败在它手里一次抵三次胜。
     *
     * 上界:若加权大于普通门槛的最高档,那么「一败」就能跳过全部阶段,
     * 三层情报一次给完,分层就没意义了。
     */
    expect(ENEMY_LORE_LOSS_WEIGHT, "战败加权不是正数 —— 输了反而不记").toBeGreaterThan(1);
    const topNormal = ENEMY_LORE_THRESHOLDS[ENEMY_LORE_THRESHOLDS.length - 1]!;
    expect(
      ENEMY_LORE_LOSS_WEIGHT,
      `战败加权 ${ENEMY_LORE_LOSS_WEIGHT} 大于等于普通洞悉门槛 ${topNormal} —— 一败就跳过全部分层`,
    ).toBeLessThan(topNormal);
  });

  it("反空转:四组数据都读得到且形态正常", () => {
    expect(ENEMY_LORE_STAGE_NAMES.length, "阶段名空了").toBeGreaterThanOrEqual(3);
    expect(ENEMY_LORE_THRESHOLDS.length, "普通门槛空了").toBeGreaterThanOrEqual(3);
    expect(ENEMY_LORE_BOSS_THRESHOLDS.length, "首领门槛空了").toBeGreaterThanOrEqual(3);
    expect(REVIVE_AFTER_HOURS, "复聚周期不是正数").toBeGreaterThan(0);
    // 名字不许有空串 —— 空串会让界面上的档位名变成一片空白
    for (const n of ENEMY_LORE_STAGE_NAMES) {
      expect(n.trim(), "阶段名里有空串").not.toBe("");
    }
  });
});
