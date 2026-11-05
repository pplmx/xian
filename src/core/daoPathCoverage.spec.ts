/**
 * 六大构筑流派在终局都该有自己的道途 —— 护盾流没有。
 *
 * ## 现状:六个流派、七条道途,却对不上
 *
 * 构筑判定只认六种形状(`core/buildSim` 的 `BUILD_PROFILES`):
 *
 *   背水(lowHpDamage / lowHpReduction / executeDamage)
 *   罡盾(shieldOnStart / shieldPower / damageReduction)
 *   反震(counterRate / counterDamage)
 *   连击(comboRate / comboDamage / speed)
 *   沐泽(lifesteal / regenPerRound / overhealShield)
 *   锋芒(fullHpDamage / firstStrike / dodgeRate / critRate)
 *
 * 而终局有七条道途(`data/endgame` 的 `DAO_PATHS`),逐条对回去:
 *
 *   剑道   → 锋芒 ✓
 *   长生道 → 沐泽 ✓
 *   连珠道 → 连击 ✓
 *   借势道 → 反震 ✓
 *   血河道 → 背水 ✓
 *   天机道 → 不对应任何流派
 *   杀伐道 → 不对应任何流派
 *
 * **罡盾流一条也对不上。**剑道还带着 `damageReduction: -0.1` —— 对护盾流是反向的;
 * 长生道的 `shieldCapRatio` 只放宽护盾上限,不打护盾这张牌。
 *
 * 道途的定位写在界面里:「选方向」。那么一个走罡盾流到终局的玩家,道途七选一,
 * 没有一条是为他这条路准备的 —— 选哪条都等于把构筑的一半丢掉。
 *
 * ## 判据守什么
 *
 * 一条:**每个构筑流派都至少有一条道途在打它的核心词条**。
 *
 * 认「核心词条」而不是「流派名」:两边各有一套命名(流派叫罡盾、道途叫镇岳),
 * 名字对不上不能当判据,而词条键是同一个事实。判据取每个流派权重最高的
 * 那两项词条,要求某条道途的 `rules` 里含有其中至少一项。
 *
 * 它不规定道途该叫什么、该多强 —— 那是设计的事;它只钉住"这条路在终局有人接"。
 */
import { describe, expect, it } from "vite-plus/test";
import { DAO_PATHS } from "@/data/endgame";

describe("终局道途 · 护盾流有人接", () => {
  /**
   * 护盾流的核心词条 —— 见 core/buildSim 的罡盾流。
   *
   * 这些键是「打护盾这张牌」的全部说法:起手给盾、盾更厚、溢出成盾、盾的上限。
   * 判据问的是**七条道途里有没有一条的主加成落在这个集合里**。
   */
  const SHIELD_KEYS = ["shieldOnStart", "shieldPower", "overhealShield"] as const;

  /** 一条道途对它自己玩家那一侧的全部加成(含 playerExtraMods 一层) */
  function playerSide(path: (typeof DAO_PATHS)[number]): Record<string, number> {
    const out: Record<string, number> = {};
    const rules = path.rules as Record<string, unknown>;
    for (const [k, v] of Object.entries(rules)) {
      if (k === "playerExtraMods") {
        for (const [k2, v2] of Object.entries((v ?? {}) as Record<string, number>)) {
          if (typeof v2 === "number") out[k2] = v2;
        }
      } else if (typeof v === "number") {
        out[k] = v;
      }
    }
    return out;
  }

  it("至少有一条道途主打护盾 —— 七条里现在一条也没有", () => {
    const carriers = DAO_PATHS.filter((path) => {
      const own = playerSide(path);
      return SHIELD_KEYS.some((k) => (own[k] ?? 0) > 0);
    });
    expect(
      carriers.map((p) => p.name),
      "罡盾流走到终局没有自己的路 —— 道途是「选方向」,而这条路七选一都是丢掉构筑",
    ).not.toEqual([]);
  });

  it("护盾/护持类道途的文案说的是护盾", () => {
    const carriers = DAO_PATHS.filter((path) => {
      const own = playerSide(path);
      return SHIELD_KEYS.some((k) => (own[k] ?? 0) > 0);
    });
    for (const path of carriers) {
      expect(path.ruleText.join(""), `${path.name} 的文案该说到护盾/护持`).toMatch(/盾|护/);
    }
  });

  it("反空转:道长表非空,道途也有规则", () => {
    expect(DAO_PATHS.length).toBeGreaterThan(0);
    for (const p of DAO_PATHS) {
      expect(Object.keys(playerSide(p)).length, `${p.name} 玩家侧一个加成都没有`).toBeGreaterThan(
        0,
      );
    }
  });
});
