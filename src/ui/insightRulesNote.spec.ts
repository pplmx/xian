/**
 * 器谱进度那一块，得说清「读到几分」与「折多少宿慧」是两件事
 *
 * ## 缺口（我上一轮自己造成的）
 *
 * `DominantView` 的「随身所知」里有三块相关读数:
 *
 * ```text
 *   宿慧阶梯   1 / 340        ← 宿慧总额与下一阶门槛
 *   读通器谱   0 / 288 张     ← 到顶那一档
 *   器谱进度   读懂 12 张 · 读通 3 张 · 近读通 2 张
 *              雾隐长枪 90% 再 5 次
 *              迷雾纱   50% 再 25 次
 * ```
 *
 * 而 `samsaraService.loreInsight` 折算宿慧时,器谱那一项用的是
 * **`isBlueprintMastered(v)` —— 满掌握(100%)才计一分,90% 是零分**。
 * 敌人认知同理(要 `>= ENEMY_LORE_MAX`)、丹方同理(`>= 1`)。
 *
 * 于是玩家读到「雾隐长枪 90%」时,最自然的推断是「攒了不少宿慧」,实际**一分没有**。
 * 那一块是我在「器谱进度」那轮加的,当时只想着「让玩家看见连续值」,
 * 没接上它和宿慧之间的关系。
 *
 * ## 补什么:一句「分数不算宿慧,读通才算」
 *
 * 不改进度读数(90% 是诚实的),只在那一块点明折算口径 ——
 * 与 `enemyLoreLedger` 的「洞悉才计」同一条纪律,只是那处也没写明。
 *
 * 措辞要**指向行动**而不是只说规则:玩家真正想知道的是「那我该砸哪张」,
 * 而答案正是进度块本身已经按「差几次」排好序的首行。
 *
 * ## 判据只钉「说清了」
 *
 * 不钉具体措辞(那会锁死文案),钉三件事:提到宿慧、提到「读通/满」这个门槛、
 * 且不是一句泛泛的「详见说明」。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { insightRulesNote } from "./insightRulesNote";

const view = () => readSource("src/views/LegacyView.vue");

describe("宿慧折算的口径 · 纯函数", () => {
  it("说明里必须点名「宿慧」——不点名的规则等于没说", () => {
    expect(insightRulesNote()).toContain("宿慧");
  });

  it("说明里必须点出「读通 / 满」这个门槛", () => {
    /*
     * 这是整句话的重点:90% 与 100% 在宿慧上是 0 与 1 的差别,
     * 不是「多一点少一点」。
     */
    expect(insightRulesNote()).toMatch(/读通|满|到顶/);
  });

  it("指出只算到顶那一档 —— 与 loreInsight 的 isBlueprintMastered 同源", () => {
    /*
     * `samsaraService.loreInsight` 对器谱要求满掌握、对敌人要求 `>= ENEMY_LORE_MAX`、
     * 对丹方要求 `>= 1`。三者都是「到顶才计」,故这一句说的是同一条纪律。
     */
    expect(insightRulesNote()).toMatch(/只算|才算|不计/);
  });

  it("指向行动,不只是陈述规则", () => {
    expect(insightRulesNote()).toMatch(/下一锤|该砸|先砸|优先/);
  });

  it("不写「详见说明」这类把人推走的话", () => {
    expect(insightRulesNote()).not.toMatch(/详见|另见|参见/);
  });
});

describe("随身所知 · 把口径接在器谱进度上", () => {
  it("器谱进度那一块里有宿慧口径,且给出稳定落点", () => {
    const src = view();
    const at = src.indexOf("data-legacy-blueprint-desk");
    expect(at, "找不到器谱进度 —— 判据会空转").toBeGreaterThan(0);
    /*
     * 看落点之后的一小段:块首有一大段说明注释,截太宽只会读到注释
     * (上一轮在 offlineChainNote 上踩过这个坑)。
     */
    const noteAt = src.indexOf("data-legacy-insight-rule");
    expect(noteAt, "器谱进度上要有宿慧口径").toBeGreaterThan(at);
    const near = src.slice(noteAt, noteAt + 400);
    expect(near, "要走那个纯函数").toContain("insightRulesNote(");
  });
});
