/**
 * 图鉴 · 收录深度与正文要一起走。
 *
 * ## 由来（第 533 轮）
 *
 * 查「数据坏了时界面显示的是空还是一句错话」，先量了九册 999 条:
 *
 * ```text
 *   空名 0 · 空描述 215
 * ```
 *
 * 215 条看着像缺口，而再按 `stage` 分一次:
 *
 * ```text
 *   已收录（stage > 0）却描述为空: 0 条
 *   215 条全是未收录的
 * ```
 *
 * **故那不是缺陷** —— 未收录的条目本来就不该有正文（图鉴的 `???` 纪律:
 * 没见过的不能提前剧透）。
 *
 * ## 而它此前没有判据
 *
 * 这条不变量（「收录深度 > 0 就该有正文」）成立，但**没有任何 spec 在守**。
 * 它是「收录」与「正文」两处数据的一致性 —— 而两处数据迟早会分叉。
 *
 * ## 判据
 *
 * ① 收录深度 > 0 的条目必有正文;
 * ② 反差：未收录的条目正文可以为空 —— 不许为它补一句「尚未收录」占位;
 * ③ 反差：名字任何时候都不许为空（那会让界面出现一个无名的格子）。
 */
import { describe, expect, it, beforeEach } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { collectionCodex, describeArtifact } from "@/ui/codex";
import { ARTIFACTS } from "@/data/artifacts";

describe("图鉴 · 收录深度与正文一起走", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("① 收录深度 > 0 的条目必有正文", () => {
    /*
     * ## 为什么直接调 `describeArtifact` 而不是遍历图鉴
     *
     * 遍历图鉴只能看到「开局状态」—— 那时一条都没收录，`stage > 0` 全不成立，
     * 判据**恒过、注入也测不出来**（实测：往 `desc` 里塞空字符串它照样绿）。
     *
     * 故直接调构造函数，把 `collected = true` 喂进去 —— 那才是「已收录」的样子。
     */
    const bad: string[] = [];
    for (const a of ARTIFACTS) {
      for (const stage of [0, 1, 2]) {
        const e = describeArtifact(a, stage, true);
        if (e.stage > 0 && (!e.desc || e.desc.trim() === "")) {
          bad.push(`${a.id}(stage=${e.stage})`);
        }
      }
    }
    expect(
      bad,
      "这些条目已经收录却一行正文都没有 —— 界面会显示一个已解开的空壳：" + bad.join("、"),
    ).toEqual([]);
    /* 反空转：至少有一条走到了 stage > 0 */
    const anyCollected = ARTIFACTS.some((a) => describeArtifact(a, 0, true).stage > 0);
    expect(anyCollected, "没有任何条目走到 stage > 0 —— 判据空转").toBe(true);
  });

  it("② 反差：未收录的条目**可以**有正文 —— 本作有意不遮挡简介", () => {
    /*
     * ## 这一条改过一次（第 534 轮）
     *
     * 第一版写的是「未收录的条目正文可以为空」，言下之意是「有空的是常态」。
     * 而实测:
     *
     * ```text
     *   未收录 999 条，其中带正文 784 条（78%）
     * ```
     *
     * **大多数未收录条目都有正文。** 而 `CollectionView` 第 657 行写着:
     *
     * ```text
     *   成就谱不再把未达成者遮成「???」:名称、条件与可量化进度全部摊开。
     * ```
     *
     * 故本作的做法是**摊开简介、遮住深度**:
     *
     * ```text
     *   desc      一段简介 —— 未收录也给（那是「世上还有这么一件东西」）
     *   stage    收录深度 —— 未收录是 0，深度内容不展开
     *   hint     下一步做什么
     * ```
     *
     * 判据② 改成守这件事:未收录条目**不许全被遮住**（那与设计相反），
     * 也不许全摊开（那 depth 就没意义了）。
     */
    const unseen = collectionCodex()
      .flatMap((c) => c.entries)
      .filter((e) => e.stage === 0);
    expect(unseen.length, "一条未收录的都没有 —— 判据②空转").toBeGreaterThan(0);
    const filled = unseen.filter((e) => e.desc && e.desc.trim() !== "");
    expect(
      filled.length,
      "所有未收录条目都被遮成空白 —— 而本作的设计是「摊开简介、遮住深度」",
    ).toBeGreaterThan(0);
    /*
     * 第二个断言原本写成 `toBeLessThanOrEqual(unseen.length)` —— 那恒真，等于没守。
     * 真正该守的是「深度内容不提前给」:未收录的条目**不许有**深度徽记（badge）。
     */
    const badged = unseen.filter((e) => e.badge && e.badge.trim() !== "");
    expect(
      badged.length,
      "未收录的条目带了深度徽记 —— 那「遮住深度」这条就不成立了：" +
        badged.map((e) => e.id).join("、"),
    ).toBe(0);
  });

  it("③ 反差：名字任何时候都不许为空", () => {
    const bad: string[] = [];
    for (const cat of collectionCodex()) {
      for (const e of cat.entries) {
        if (!e.name || e.name.trim() === "") bad.push(`${cat.key}/${e.id}`);
      }
    }
    expect(bad, "这些条目没有名字 —— 界面上会出现一个无名的格子：" + bad.join("、")).toEqual([]);
  });
});
