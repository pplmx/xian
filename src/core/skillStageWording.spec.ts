/**
 * 「离小成 0%」—— 这句话说的是「已经小成了」。
 *
 * ## 由来（第 161 轮，三生录的「技艺进度」）
 *
 * 历世页把九项技艺摆成一张表，每行末尾是:
 *
 * ```text
 * 识材   识材道   入门   离小成 0%
 * 配药   炼丹道   入门   离小成 0%
 * ```
 *
 * 展示档里七行**整整齐齐全是「离小成 0%」**。而 `skillStageProgress` 的语义是
 * **本境地内已走完多少**（0 = 刚进这一境地，1 = 已到下一境地）:
 *
 * ```text
 * lv 25  入门 → 小成   progress 0%     ← 刚进「入门」，离小成**最远**
 * lv 39  入门 → 小成   progress 93%    ← 快到「小成」了
 * ```
 *
 * 于是「离小成 0%」被读成「还差 0% 就到小成」—— **意思正好反过来**。
 * 七项全 0% 那一屏，玩家会以为九项技艺都已经练满了。
 *
 * ## 这是个措辞错，不是算错
 *
 * `progress` 的值完全正确，炼丹页也用它（那里只印一个孤零零的 `0%`，
 * 配一根进度条，读不出歧义）。错的是这个句式:**「离 X N%」在中文里
 * 天然读作「离 X 还差 N%」**，而这里 N 是「已经走了多少」。
 *
 * ## 判据
 *
 * ① 历世页的技艺行不许出现「离〈境地〉 N%」这种句式;
 * ② 它要报的是**已走过的比例**或**还差多少**,两者都行,但读法必须自洽;
 * ③ 进度值的来源不许换（仍走 `skillStageProgress`），只是换个说法。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { skillStageProgress, skillStageName, skillNextStageName } from "@/data/crafting";
import { skillInsightDesk } from "@/ui/skillInsightDesk";

const LEGACY = readSource("src/views/LegacyView.vue");

describe("历世技艺行 · 「离 X 0%」说的是已经练成了", () => {
  it("进度 0% 是「刚进这一境地」，不是「快要到了」", () => {
    // 这两条把语义钉死：0% 在最左端，越接近下一境地越接近 100%
    expect(skillStageProgress(25), "刚进「入门」").toBe(0);
    expect(skillStageProgress(39), "「入门」快到顶").toBeGreaterThan(0.9);
    expect(skillStageName(25)).toBe("入门");
    expect(skillNextStageName(25)).toBe("小成");
  });

  it("整屏技艺都是「离小成 0%」时，它们其实一项都没练", () => {
    /*
     * 复现展示档那一屏:七项技艺 exp 很小、level 落在「入门」的下沿。
     * 这正是「整整齐齐全是 0%」的来历 —— 也是玩家会误读成「全练满了」的那一屏。
     */
    /*
     * exp 200 恰好把熟练度推到 25 —— 「入门」的起点（实测:level 25、
     * stage 入门、nextStage 小成）。这时 progress 是 0（浮点上是 2e-16），
     * 界面按 0 位小数印出来就是「0%」。
     */
    const desk = skillInsightDesk({
      discern: 200,
      herbLore: 200,
      pairing: 200,
      condense: 200,
      temper: 200,
      nourish: 200,
      flame: 200,
    } as never);
    const atFloor = desk.rows.filter((r) => r.progress < 1e-6);
    expect(atFloor.length, "这一屏该有多项落在境地起点").toBeGreaterThan(1);
    /*
     * 关键:它们都还**没**到下一境地。若界面写「离 X 0%」，
     * 玩家读到的与这行断言的事实相反。
     */
    for (const row of atFloor) {
      expect(row.nextStage, "这一行确实还有下一境地").not.toBeNull();
      expect(row.stage, "它还在境地起点上").toBe("入门");
    }
  });

  it("历世页不再用「离〈境地〉 N%」这个句式", () => {
    expect(
      LEGACY,
      "「离 X N%」在中文里读作「离 X 还差 N%」，而 N 是已走过的比例 —— 意思反了",
    ).not.toMatch(/离\{\{\s*row\.nextStage\s*\}\}/);
  });

  it("仍读同一份进度（只换说法，不换数据源）", () => {
    expect(LEGACY, "进度仍走 skillInsightDesk 的 progress").toMatch(
      /skillInsightDesk|row\.progress/,
    );
  });
});
