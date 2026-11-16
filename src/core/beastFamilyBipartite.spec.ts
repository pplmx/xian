/**
 * 族类与形是**一对一**的，而那个数（29）与「合计多少条」此前没人守。
 *
 * ## 缺口（第 405 轮，从旧结论里翻出来的）
 *
 * `docs/design.md` 有一段讲「敌人与灵兽的形按族类发」，里面写着：
 *
 * ```text
 *   29 族对 29 枚形，146 条（132 名敌人 + 14 只灵兽）各归其族
 * ```
 *
 * 而本轮实测：
 *
 * ```text
 *   族类 29  ✓（这一项是对的）
 *   敌人 140，灵兽 44，合计 184    ← 不是 132 + 14 = 146
 * ```
 *
 * 两个分量都过时了，而那个**求和停在旧值上** —— 这正是 `scriptCounts.spec`
 * 记过的同一个形状：
 *
 * > `69 条` 那两处尤其典型：那是「称号 + 灵兽」的和。两个数各自变过
 * > （称号 30→29、灵兽 40→44），和却停在 69 —— **合计最容易停在旧值上**，
 * > 因为改单个表时没人会顺手去加一遍。
 *
 * 同一段里还有「132 只敌人只用了 19 枚形」「46 只挤在一枚骷髅里」——
 * 实测现在是「26 枚形」「最挤的 demon×18」。三组数，一组都没跟上。
 *
 * ## 判据守什么
 *
 * ① 族类与形**一一对应**：每族的 `icon` 互不相同，且族类数 = 形数。
 *    这条比数字对账更重要 —— 它是 `inkIcons.spec` 那条「一枚形只能出现在一个族类上」
 *    的**另一侧**（那条查「形不重复」，这条查「族不缺形」）。
 * ② 每个敌人与每只灵兽的 `family` 都指向一个真实族类。
 * ③ 文档里那句「N 族对 N 枚形」的 N，与 `BEAST_FAMILIES` 的实际族数相同。
 *
 * ③是给「数据增删而文档不动」准备的。**故意不钉「184 条」那个合计** ——
 * 那个数会随内容定期变，钉住它每加一只敌人就要改文档与判据两处。
 * 而①②保证了「合计」随时可以自己算出来。
 *
 * 不钉合计，那这段文档的「184」还会烂吗？会 —— 所以文档里那个数**改成了
 * 由表头那句「当下」明示它是快照**，而 ①（族数 = 形数）与 ②（引用都在）
 * 两条判据保证「族的数」永远是真值。**能自动算出来的数，不钉；算不出来的，钉。**
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BEAST_FAMILIES } from "@/data/beastFamilies";
import { ENEMIES } from "@/data/enemies";
import { PETS } from "@/data/pets";
import { ROOT } from "@/test/readSource";

const FAMILY_IDS = Object.keys(BEAST_FAMILIES);

describe("族类与形 · 一一对应，且文档里的那个数对得上", () => {
  it("每族各有自己的形，族类数 = 形数", () => {
    /*
     * 「一枚形只出现在一个族类上」由 `inkIcons.spec` 守；这条守另一侧：
     * 每一族都**真的有**一枚形，且形名互不相同。
     *
     * 两条合起来才等于「一一对应」—— 只有前者时，两族可以共用一枚形里的一族缺失。
     */
    const icons = FAMILY_IDS.map((id) => BEAST_FAMILIES[id as keyof typeof BEAST_FAMILIES].icon);
    const withoutIcon = FAMILY_IDS.filter(
      (id) => !BEAST_FAMILIES[id as keyof typeof BEAST_FAMILIES].icon,
    );
    expect(withoutIcon, "这些族类没有形 —— 它们的成员会落到兜底图标上").toEqual([]);
    expect(new Set(icons).size, `族类 ${icons.length} 个，形只有 ${new Set(icons).size} 枚`).toBe(
      icons.length,
    );
    // 防空转
    expect(FAMILY_IDS.length, "族类少得离谱 —— 判据的前提不成立了").toBeGreaterThan(10);
  });

  it("每个敌人与每只灵兽的 family 都指向真实族类", () => {
    const known = new Set(FAMILY_IDS);
    const badEnemies = ENEMIES.filter((e) => !known.has(e.family as string)).map((e) => e.name);
    const badPets = PETS.filter((p) => !known.has(p.family as string)).map((p) => p.name);
    expect(badEnemies, `这些敌人的 family 不存在，形会落到兜底：${badEnemies.join("、")}`).toEqual(
      [],
    );
    expect(badPets, `这些灵兽的 family 不存在：${badPets.join("、")}`).toEqual([]);
  });

  it("docs/design.md 里「N 族对 N 枚形」的 N 与实际族数相同", () => {
    const doc = readFileSync(join(ROOT, "docs/design.md"), "utf8");
    /*
     * 只找那一个句式。找不到就红 —— 说明那句话被改写或删了，
     * 这条判据要跟着改，而不是静默通过。
     */
    const m = /(\d+) 族对 (\d+) 枚形/.exec(doc);
    expect(m, "docs/design.md 里找不到「N 族对 N 枚形」那句话 —— 判据要跟着改写").not.toBeNull();
    expect(
      Number(m![1]),
      `文档写「${m![1]} 族」，而 BEAST_FAMILIES 里是 ${FAMILY_IDS.length} 族`,
    ).toBe(FAMILY_IDS.length);
    expect(Number(m![2]), `文档写「${m![2]} 枚形」，而与族数不等 —— 一一对应就不成立`).toBe(
      Number(m![1]),
    );
  });
});
