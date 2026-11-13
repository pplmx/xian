/**
 * 灵草的「凡品」和丹药的「凡品」不是同一套档 —— 同屏出现时必须能分开。
 *
 * ## 由来（第 188 轮，玩家视角可用性测试）
 *
 * 炼丹弹窗里同时出现两套档名:
 *
 * ```text
 * 灵草栏    凡品 200 · 灵品 0 · 仙品 0 · 神品 0 · 道品 0     ← 灵草五品
 * 丹方卡    聚气散 / 凡品 / 1 阶                              ← 丹药九档
 * ```
 *
 * 两套都用「凡品 / 灵品 / 仙品 / 神品」这几个词，而**位次完全不同**:
 *
 * ```text
 * 灵草五品   凡文(1) 灵(2) 仙(3) 神(4) 道(5)          ← 按境界带切
 * 丹药九档   凡良精(1-3) 灵玄地(4-6) 天仙神(7-9)      ← 按品质切
 * ```
 *
 * 于是「灵品」在灵草里是第 2 档、在丹药里是第 4 档。玩家在同一屏看到
 * 「灵品 0」和一张「灵品」丹方，很容易以为那个 0 说的是这张丹方。
 *
 * ## 这条判据守什么
 *
 * 炼丹弹窗里，**灵草那一栏的档名必须带「草」字**（`凡品灵草` 而不是裸 `凡品`），
 * 或另有一处把它与丹药的档名区分开的限定词。
 *
 * 只约束这一个弹窗 —— 别的页面上两套档名不同屏，不需要限定。
 * 而这一屏是**它们唯一同时出现的地方**，也正是玩家要据此判断「我够不够料」的地方。
 *
 * ## 故障注入
 *
 * 删掉那一行的 `<span>灵草</span>` 前置标签 → 「有前置标签」那条红。
 * 把丹方卡的 `灵草×N` 改成 `×N` → 「自带后缀」那条红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";
import { HERB_GRADE_SHORT, HERB_GRADE_NAMES } from "@/data/herbGrades";
import { HERB_GRADES } from "@/data/herbGrades";

const DIALOG = "src/components/inventory/BrewingDialog.vue";

describe("炼丹弹窗 · 两套档名必须分得开", () => {
  it("两套档名确实有重名（判据的前提）", () => {
    /*
     * 前提自检:若哪天灵草改了命名、不再与品质重名，这条判据就该删掉而不是留着空转。
     * 品质九档的档名从 `data/purity`（或等价处）来；这里只核灵草那侧的字。
     */
    const herbWords = HERB_GRADES.map((g) => HERB_GRADE_SHORT[g]);
    for (const w of ["凡品", "灵品", "仙品", "神品"]) {
      expect(herbWords, `灵草不再用「${w}」——判据的前提没了`).toContain(w);
    }
  });

  it("全名带「草」字，简称不带 —— 故弹窗里必须用全名", () => {
    for (const g of HERB_GRADES) {
      expect(HERB_GRADE_NAMES[g], `第 ${g} 品全名该带「草」`).toContain("草");
      expect(HERB_GRADE_SHORT[g], `第 ${g} 品简称不该带「草」`).not.toContain("草");
    }
  });

  it("那一行有「灵草」前置标签 —— 裸简称靠它才不撞车", () => {
    /*
     * 口径修正（第 188 轮）:第一版要求「每项都带『草』字」，而实测那一行是:
     *
     * ```text
     * 灵草   凡品 200 · 灵品 0 · 仙品 0 · 神品 0 · 道品 0   · 灵石 3亿
     * ^^^^^^ 这一枚前置标签就是限定词
     * ```
     *
     * 有它，裸简称「凡品」就不会与同屏丹药的「凡品」混起来 —— 整行读作
     * 「灵草：凡品 200」。**判据要判的是「能不能分开」，不是「每项都带后缀」。**
     *
     * 而丹方卡那一处写的是 `凡品灵草×4`（自带后缀），也清楚。
     * 两处各有各的分法，故只核「那一行有标签」。
     */
    const src = stripComments(readSource(DIALOG));
    const idx = src.indexOf("HERB_GRADE_SHORT[g]");
    expect(idx, "找不到灵草那一行的渲染").toBeGreaterThan(-1);
    const block = src.slice(Math.max(0, idx - 700), idx);
    expect(
      block,
      "灵草那一行没有「灵草」标签 —— 裸简称「凡品」会和同屏丹药的「凡品」撞车",
    ).toContain("灵草");
  });

  it("丹方卡那一处自带「灵草」后缀 —— 两处各有各的分法", () => {
    /*
     * 丹方卡写的是 `凡品灵草×4`（简称 + 后缀），而灵草那一行是
     * `灵草 · 凡品 200`（前置标签 + 裸简称）。
     *
     * 两种写法都对 —— 判据要判的是「读的人能不能把这句和丹药的档名分开」，
     * 不是「必须用同一种写法」。故这条核**后缀那一处**：它不能丢掉那个「灵草」。
     */
    const src = stripComments(readSource(DIALOG));
    const idx = src.indexOf("HERB_GRADE_SHORT[r.cost.herbGrade]");
    expect(idx, "找不到丹方卡里的灵草代价").toBeGreaterThan(-1);
    const tail = src.slice(idx, idx + 120);
    expect(tail, "丹方卡的灵草代价丢了「灵草」后缀 —— 「凡品×4」读不出是草还是丹").toContain(
      "灵草",
    );
  });
});
