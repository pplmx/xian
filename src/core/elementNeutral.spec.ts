/**
 * 「五行只定亲近之路,不分高低」—— 这句话得有人守着。
 *
 * ## 缺口
 *
 * 道躯页的灵根注里写着这句(「灵根倍率作用于修行所得；五行只定亲近之路,不分高低」)。
 * 它是对玩家的一句**承诺**:选哪一系灵根不会让谁更强,只决定哪些路更顺。
 *
 * 但全部判据里没有任何一条守着它:`characterDossier.spec` 查的是同一句里的
 * 「灵根倍率作用于修行所得」与五行牌面的 `v-for`,后半句没人管。
 *
 * 也就是说,哪天有人把五行接进战力计算(比如「火系攻击 +5%」),文案会当场变成谎话,
 * 而所有门都会是绿的。
 *
 * ## 实测口径(写这条时的真实状态)
 *
 * `src/core/combat.ts` 与 `src/core/statsCalc.ts` 里 `element` 出现 **0 次** ——
 * 五行完全不进战斗、不进属性面板。它只在这四处起作用:
 *   - `core/breakthrough` 的渡劫减免(`reliefFelt`)
 *   - `components/cultivation/GongfaDialog` 的功法亲和(`gongfaAffinity`)
 *   - `core/eventEngine` 的奇遇亲和(`fortuneAffinity`)
 *   - `components/cultivation/TribulationPanel` 的雷劫提示(`reliefElements`)
 *
 * 四处都是「倾向 / 减免 / 更顺」,没有一处是「更强」。这正是文案说的那件事。
 *
 * ## 判据守什么
 *
 * 战斗与属性合并这两条链上不许出现五行。它不禁止五行在别处出现(亲和、减免、
 * 文案、图标都该有);它只禁止五行变成**数值高低的来源**。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("五行只定倾向,不定高低", () => {
  it("战斗解算里不许出现五行", () => {
    const combat = readSource("src/core/combat.ts");
    const hits = combat.match(/\belement|elements|ElementId|rootElements|affinity/gi) ?? [];
    expect(
      hits,
      "战斗解算里出现了五行 —— 文案「五行只定亲近之路,不分高低」会变成谎话:" + hits.join(", "),
    ).toEqual([]);
  });

  it("属性合并里不许出现五行", () => {
    /*
     * statsCalc 负责把各来源的 mods 合成面板值。五行一旦在这里出现,
     * 就意味着某系灵根会给出更高的攻击/气血 —— 那正是「分高低」。
     */
    const calc = readSource("src/core/statsCalc.ts");
    const hits = calc.match(/\belement|elements|ElementId|rootElements|affinity/gi) ?? [];
    expect(hits, `属性合并里出现了五行:${hits.join(", ")}`).toEqual([]);
  });

  it("文案仍在页上(收进注也不许丢)", () => {
    const view = readSource("src/views/CharacterView.vue");
    expect(view, "「五行只定亲近之路,不分高低」这句话没了 —— 它是玩家理解灵根的唯一依据").toContain(
      "五行只定亲近之路",
    );
  });
});
