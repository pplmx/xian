/**
 * 道途与打法的相性 —— 择道之前那一层「合不合」。
 *
 * 守的是**判据的来路**:相性不是手写的「剑道适合爆发流」那种分类,
 * 而是拿道途的 `rules.playerExtraMods` 与流派的核心词条逐键比对。
 * 换一条道途、加一种流派,结论自己会跟着变 —— 这条性质才是这层值钱的地方。
 */
import { describe, expect, it } from "vite-plus/test";
import { DAO_PATHS } from "@/data/endgame";
import { BUILD_PROFILES } from "@/core/buildSim";
import { BUILD_IDS, affinityFor, buildNameOf, daoAffinity } from "./daoAffinity";

describe("道途相性 · 判据读的是同一份 mods", () => {
  it("道途给了流派赖以立身的词条 → 合", () => {
    const aff = daoAffinity(
      { shieldOnStart: 0.4, shieldPower: 0.5 },
      { shieldOnStart: 0.3, shieldPower: 0.14 },
    );
    expect(aff.verdict).toBe("fits");
    expect(aff.notes).toContain("shieldOnStart");
  });

  it("道途拿走了流派赖以立身的词条 → 冲", () => {
    // 剑道对罡盾流:damageReduction -0.1 正是双减伤流的立身之本
    const aff = daoAffinity({ damageReduction: 0.12, shieldPower: 0.5 }, { damageReduction: -0.1 });
    expect(aff.verdict).toBe("clashes");
    expect(aff.notes).toContain("damageReduction");
  });

  it("拿走优先于加成 —— 方向相反比「没加成」严重", () => {
    const aff = daoAffinity(
      { critRate: 0.1, damageReduction: 0.2 },
      { critRate: 0.1, damageReduction: -0.1 },
    );
    expect(aff.verdict, "有加成但也有冲突,该判冲").toBe("clashes");
  });

  it("只有一项加成 → 中性(一项不够说「同向」)", () => {
    const aff = daoAffinity({ critRate: 0.1, speed: 0.2 }, { critRate: 0.1 });
    expect(aff.verdict).toBe("neutral");
  });

  it("道途没有 playerExtraMods → 中性,不硬凑", () => {
    expect(daoAffinity({ critRate: 0.1 }, undefined).verdict).toBe("neutral");
    expect(daoAffinity({ critRate: 0.1 }, {}).verdict).toBe("neutral");
  });
});

describe("道途相性 · 八道 × 六派都在表里", () => {
  it("每条道途对每个流派都答得出一个评级", () => {
    for (const dao of DAO_PATHS) {
      for (const b of BUILD_IDS) {
        const aff = affinityFor(dao.id, b);
        expect(["fits", "neutral", "clashes"]).toContain(aff.verdict);
      }
    }
  });

  it("不认识的 id 退回中性,不抛", () => {
    expect(affinityFor("nope", "gangdun").verdict).toBe("neutral");
    expect(affinityFor("sword", "nope").verdict).toBe("neutral");
  });

  it("六派都有展示名,且与构筑页同源", () => {
    for (const id of BUILD_IDS) expect(buildNameOf(id)).toBeTruthy();
    expect(buildNameOf("gangdun")).toBe("罡盾流");
    expect(buildNameOf("nope")).toBeNull();
  });

  it("至少有一对是真的「合」、一对是真的「冲」—— 否则这层等于空转", () => {
    const verdicts = new Set<string>();
    for (const dao of DAO_PATHS)
      for (const b of BUILD_IDS) verdicts.add(affinityFor(dao.id, b).verdict);
    expect(verdicts.has("fits"), "一条「合」都没有,标了也没用").toBe(true);
    expect(verdicts.has("clashes"), "一条「冲」都没有,标了也没用").toBe(true);
  });

  it("剑道对罡盾流是冲 —— 这是数据本身说出来的,不是分类表写的", () => {
    const sword = DAO_PATHS.find((d) => d.id === "sword")!;
    const gangdun = BUILD_PROFILES.find((b) => b.id === "gangdun")!;
    // 形象化的回归:剑道带 damageReduction -0.1,而罡盾流靠减伤与护盾立身
    expect(sword.rules.playerExtraMods?.damageReduction).toBeLessThan(0);
    expect(gangdun.mods.damageReduction).toBeGreaterThan(0);
    expect(affinityFor("sword", "gangdun").verdict).toBe("clashes");
  });
});
