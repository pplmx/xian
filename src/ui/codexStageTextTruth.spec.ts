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

  it("② 反差：未收录的条目正文可以为空", () => {
    /*
     * 这一条守的是①的边界。图鉴的 `???` 纪律要求没见过的不能提前剧透 ——
     * 故未收录条目描述为空是对的，不许为它补一句占位话。
     */
    const unseen = collectionCodex()
      .flatMap((c) => c.entries)
      .filter((e) => e.stage === 0);
    expect(unseen.length, "一条未收录的都没有 —— 判据②空转").toBeGreaterThan(0);
    const filled = unseen.filter((e) => e.desc && e.desc.trim() !== "");
    /*
     * 允许一部分未收录条目带正文（有的册子是「先给一句引子」），
     * 但不许**全部**都带 —— 那说明 `???` 纪律被绕过了。
     */
    expect(
      filled.length,
      "所有未收录条目都带正文 —— 那图鉴就不再是「没见过的不剧透」了",
    ).toBeLessThan(unseen.length);
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
