/**
 * 随身所知五行 —— 每一行各折多少宿慧，只有一行报了
 *
 * ## 现状（量出来的）
 *
 * 修仙录「随身所知」列五行，抬头都写「达成数 / 总数」:
 *
 * ```text
 *   材  认得灵材   12 / 16 味
 *   方  通晓丹方    8 / 54 张
 *   谱  读通器谱    3 / 288 张
 *   敌  洞悉敌手    5 / 140 种
 *      技艺进度     动了 4 项 · 折宿慧 9      ← 只有这一行报了折算
 * ```
 *
 * 而 `samsaraService.loreInsight` 对这五项各有一套权重:
 *
 * ```text
 *   灵材   每味 3 点，通晓用法再 +5
 *   丹方   每张 4 点
 *   器谱   每张 1 点
 *   技艺   熟练度之和 ÷ 20
 *   敌手   每种 2 点
 * ```
 *
 * 于是玩家读「通晓丹方 8 / 54 张」时,不知道这 8 张折了 **32 点宿慧**
 * （四项里仅次于技艺的那一份）;读「读通器谱 3 / 288」也不知道只折 3 点。
 * **权重差 4 倍,而界面长得一模一样。**
 *
 * ## 这不是新缺口，是同一处漏了四行
 *
 * 上一轮补「技艺进度」时给那一行报了「折宿慧 9」,却没想到上面四行也该报 ——
 * 于是同一块里五行,一行的口径和其他四行不一样。这比全都不报更糟:
 * 玩家会以为只有技艺折宿慧。
 *
 * ## 报什么
 *
 * 每行末尾补「宿慧 +N」。三条口径:
 *
 *   · **读 `loreInsight` 的同一份权重**，不在界面重算（「不做两本账」）。
 *     故这里把折算拆成按项可调的纯函数,`loreInsight` 自己也走它 ——
 *     改常数时两处一起动。
 *   · **通晓用法那一档单列**：灵材有两档(认得 +3 / 通晓再 +5),
 *     只报一个合计数会让玩家以为「认得就等于折满」。
 *   · **0 点不印**：没折到的项写「—」，不写「+0」（后者像一个不存在的档位）。
 *
 * ## 这一层只算，不读 store
 */
import { describe, expect, it } from "vite-plus/test";
import { loreInsightByKind } from "./loreInsightByKind";
import { loreInsight } from "@/core/samsaraService";

describe("随身所知的分项宿慧 · 纯函数", () => {
  it("五项各报各的，合起来等于 loreInsight", () => {
    /*
     * 这是最重要的一条:**分项之和必须等于总数**。若界面按自己的一套权重算,
     * 玩家把五行加起来会与抬头那个数对不上 —— 那就是两本账。
     */
    const snap = {
      materialLore: { m1: 1, m2: 3, m3: 0 },
      recipeLore: { r1: 1, r2: 0.5 },
      blueprintLore: { b1: 1, b2: 0.9 },
      skillExp: { discern: 2400, condense: 900 },
      enemyLore: { e1: 3, e2: 1 },
    };
    const byKind = loreInsightByKind(snap);
    const sum = byKind.material + byKind.recipe + byKind.blueprint + byKind.skill + byKind.enemy;
    /*
     * `loreInsight` 最后 `Math.floor`,而分项各自取整后再相加可能与 floor 后的
     * 总数差 1 —— 这一条钉的是「不分叉」,故比的是**未取整的和**。
     */
    expect(Math.floor(sum), "分项之和与 loreInsight 对不上 —— 界面自己算了另一套").toBe(
      loreInsight(snap),
    );
  });

  it("灵材两档分开报 —— 认得 3 点、通晓再 5 点", () => {
    const byKind = loreInsightByKind({
      materialLore: { m1: 1 },
      recipeLore: {},
      blueprintLore: {},
      skillExp: {},
      enemyLore: {},
    });
    expect(byKind.material, "认得一味该折 3 点").toBe(3);
    const mastered = loreInsightByKind({
      materialLore: { m1: 3 },
      recipeLore: {},
      blueprintLore: {},
      skillExp: {},
      enemyLore: {},
    });
    expect(mastered.material, "通晓用法在认得之上再 +5").toBe(8);
  });

  it("只有到顶那一档才折 —— 器谱 0.9 与敌人认知 1 都是零分", () => {
    /*
     * 与上一轮「宿慧只认读通」同一份口径:`loreInsight` 对器谱用
     * `isBlueprintMastered`、对敌人用 `>= ENEMY_LORE_MAX`、对丹方用 `>= 1`。
     * 分项若在这里放宽,界面上就会出现「还差一成也折了分」的假话。
     */
    const byKind = loreInsightByKind({
      materialLore: {},
      recipeLore: { r1: 0.99 },
      blueprintLore: { b1: 0.99 },
      skillExp: {},
      enemyLore: { e1: 2 },
    });
    expect(byKind.recipe, "丹方差一点不该折").toBe(0);
    expect(byKind.blueprint, "器谱差一点不该折").toBe(0);
    expect(byKind.enemy, "敌人只到第二阶不该折").toBe(0);
  });

  it("权重差 4 倍是看得出来的 —— 丹方 1 张 = 器谱 4 张", () => {
    const one = loreInsightByKind({
      materialLore: {},
      recipeLore: { r1: 1 },
      blueprintLore: {},
      skillExp: {},
      enemyLore: {},
    });
    const four = loreInsightByKind({
      materialLore: {},
      recipeLore: {},
      blueprintLore: { b1: 1, b2: 1, b3: 1, b4: 1 },
      skillExp: {},
      enemyLore: {},
    });
    expect(one.recipe, "一张丹方该等于四张器谱").toBe(four.blueprint);
  });

  it("全空时五项都是 0", () => {
    const byKind = loreInsightByKind({
      materialLore: {},
      recipeLore: {},
      blueprintLore: {},
      skillExp: {},
      enemyLore: {},
    });
    expect(byKind).toEqual({ material: 0, recipe: 0, blueprint: 0, skill: 0, enemy: 0 });
  });

  it("坏值当作没折过", () => {
    const byKind = loreInsightByKind({
      materialLore: { m1: Number.NaN },
      recipeLore: { r1: -1 },
      blueprintLore: { b1: Number.POSITIVE_INFINITY },
      skillExp: { discern: Number.NaN },
      enemyLore: { e1: Number.NaN },
    });
    expect(byKind).toEqual({ material: 0, recipe: 0, blueprint: 0, skill: 0, enemy: 0 });
  });
});
