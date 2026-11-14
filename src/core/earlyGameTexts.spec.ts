/**
 * 连胜奖励与韧性判词 —— 两个会讲给玩家的文案函数，此前一条判据都没有。
 *
 * ## 由来（第 235 轮，查「判据覆盖的盲区」）
 *
 * 扫了全仓 1364 个 `export function`，其中 **96 个在 422 个 spec 里一次都没被提到**。
 * 把范围收窄到「名字以 Text/Line/Label/Desc 结尾、且直接面向玩家」的，只剩四个:
 *
 * ```text
 * core/apprenticeService.ts:apprenticeReapText
 * core/buildAdvisor.ts:starsText
 * core/earlyGameService.ts:streakRewardText
 * core/resilience.ts:resilienceText
 * ```
 *
 * 前两个抽查过:一个是拼星级、一个拼徒儿收获，都还能接受。后两个带数字与阈值，
 * 风险高些，这一轮给它们补上。
 *
 * ## 为什么这两个值得判
 *
 * `streakRewardText(streak, stone, wudao)` 拼的是「连胜 N 场 · 灵石 +X · 悟道点 +Y」。
 * 而它有两处 `> 0` 的判断 —— 若两个奖励都为 0，它只吐出「连胜 N 场」，
 * 玩家会以为**连胜什么都没给**。这是文案在撒谎（或者说：在沉默）。
 *
 * `resilienceText` 是三档阈值（0.75 / 0.45）。阈值若被改动而文案没跟上，
 * 玩家会看到「道基浑厚」配一个很低的保留率 —— 而这两件事在界面上是并排的。
 *
 * ## 故障注入
 *
 * 把 `if (stone > 0)` 那道判断删掉（永远拼灵石）→ 「某一项为 0 时」与
 * 「两项都为 0 时」两条同时红。
 * 把韧性的 `>= 0.75` 改成 `> 0.75` → 「阈值边界落在声明的那一侧」红。
 */
import { describe, expect, it } from "vite-plus/test";
import { streakRewardText } from "./earlyGameService";
import { resilienceText } from "./resilience";
import type { ResilienceReport } from "./resilience";

describe("连胜奖励文案", () => {
  it("连胜场次一定说出来", () => {
    const t = streakRewardText(3, 0, 0);
    expect(t, `连胜场次没出现在文案里 —— «${t}»`).toContain("连胜 3 场");
  });

  it("灵石与悟道点都说了各自的数量", () => {
    const t = streakRewardText(5, 1200, 8);
    expect(t, `没写灵石 —— «${t}»`).toContain("灵石");
    expect(t, `没写悟道点 —— «${t}»`).toContain("悟道点");
    // 数字要真的出现（经 formatNum 折过，故只核量级前缀）
    expect(t).toMatch(/灵石 \+\d/);
    expect(t).toMatch(/悟道点 \+\d/);
  });

  it("某一项为 0 时，那一项不出现在文案里", () => {
    const onlyStone = streakRewardText(2, 500, 0);
    expect(onlyStone, `悟道点为 0 却写了它 —— «${onlyStone}»`).not.toContain("悟道点");
    const onlyWudao = streakRewardText(2, 0, 6);
    expect(onlyWudao, `灵石为 0 却写了它 —— «${onlyWudao}»`).not.toContain("灵石");
  });

  it("两项都为 0 时，文案仍说出连胜（不吐空串、不撒谎说没奖励）", () => {
    /*
     * 这一条钉的是边界:两个 `> 0` 都不成立时，函数只剩「连胜 N 场」。
     * 它**不该**变成空串，也不该编出一个「奖励 +0」。
     */
    const t = streakRewardText(7, 0, 0);
    expect(t.trim(), "两项都为 0 时吐了空串").not.toBe("");
    expect(t, `两项都为 0 时编了个 +0 —— «${t}»`).not.toMatch(/\+0\b/);
    expect(t).toContain("连胜 7 场");
  });

  it("只有一段时不带分隔符", () => {
    const t = streakRewardText(1, 0, 0);
    expect(t.trim(), `单段文案带了多余分隔符 —— «${t}»`).not.toMatch(/·\s*$/);
  });
});

describe("韧性判词", () => {
  const report = (retention: number): ResilienceReport => ({ retention }) as ResilienceReport;

  it("三档阈值各自给出不同的话", () => {
    const high = resilienceText(report(0.9));
    const mid = resilienceText(report(0.6));
    const low = resilienceText(report(0.2));
    expect(new Set([high, mid, low]).size, "三档判词有重复 —— 阈值分级没意义了").toBe(3);
  });

  it("阈值边界落在声明的那一侧（0.75 / 0.45 都是 >=）", () => {
    expect(resilienceText(report(0.75)), "0.75 该算高档").toContain("道基浑厚");
    expect(resilienceText(report(0.749)), "0.749 不该算高档").not.toContain("道基浑厚");
    expect(resilienceText(report(0.45)), "0.45 该算中档").toContain("尚有余地");
    expect(resilienceText(report(0.449)), "0.449 不该算中档").not.toContain("尚有余地");
  });

  it("每一档都说了「这意味着什么」，不只是形容词", () => {
    /*
     * 与仓库纪律同一条:判词要能指导决策。三档各举一个具体的后果。
     */
    expect(resilienceText(report(0.9))).toMatch(/战力|机会/);
    expect(resilienceText(report(0.6))).toMatch(/副体系|谨慎/);
    expect(resilienceText(report(0.2))).toMatch(/依赖|自缚/);
  });

  it("极端值不吐空串", () => {
    for (const r of [0, 1, 1.5, -0.2]) {
      expect(resilienceText(report(r)).trim(), `retention=${r} 时吐了空串`).not.toBe("");
    }
  });
});
