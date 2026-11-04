/**
 * 逆旅契进履历 —— 「被记住」是这份契约**唯一**的回报,而它此前没被记住。
 *
 * ## 缺口:契约把回报押在履历上,履历却不记它
 *
 * `data/lifeTrials.ts` 的文件头把这份设计讲得很清楚:
 *
 *   花道果 → 为这一世签一份只加难度的契 → 本世历练全程生效
 *          → 转世时记入履历 → 记录不进任何计算
 *
 * 为什么回报只能是「记录」——四条给收益的路(属性/资源/宿慧/道果)全被出口空间
 * 审计堵死,「剩下的只有『这一世确实与众不同,且它被记住了』」。
 *
 * `core/reincarnation` 照做了,写进 `LifeRecord.trialId`,注释同样是这句:
 *
 *   // 逆旅契入履历 —— 这是契约唯一的回报:被记住,且不进任何计算
 *
 * 而**历世履历那一屏从头到尾没读过这一栏**。`LegacyView` 的 `lifeRows` 只取
 * 境界名、寿数、命题与宿慧 —— 玩家花了 24~xx 枚道果买下一世的逆境,
 * 转世后翻履历,看到的与从没签过契的那一世**一模一样**。
 *
 * 于是这份契约在玩家眼里确确实实没有任何回报:它唯一承诺的东西没兑现。
 *
 * ## 做法:只加一行,不进任何计算
 *
 * 把 `trialId` 翻成那一契的名与印,在历世履历那一行补一句。
 * 纯读,不改存档、不改结算 —— 与文件头那条「记录不进任何计算」逐字对齐。
 *
 * 老存档的 `LifeRecord` 没有这一栏(见 types 里的可选标记),读出来是空,渲染不出那一行。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { lifeTrialArchive } from "./lifeTrialArchive";
import { LIFE_TRIALS } from "@/data/lifeTrials";

describe("逆旅契履历 · 读得出是哪一契", () => {
  it("签过的契读得出名字与印", () => {
    const first = LIFE_TRIALS[0]!;
    const row = lifeTrialArchive(first.id);
    expect(row).not.toBeNull();
    expect(row!.name).toBe(first.name);
    expect(row!.seal).toBe(first.seal);
  });

  it("六契逐一都读得出 —— 不是只认第一张", () => {
    for (const def of LIFE_TRIALS) {
      const row = lifeTrialArchive(def.id);
      expect(row, `${def.id} 读不出`).not.toBeNull();
      expect(row!.name).toBe(def.name);
    }
  });

  it("没签过契(旧档缺这一栏)→ 空,不编一个名字出来", () => {
    expect(lifeTrialArchive(null)).toBeNull();
    expect(lifeTrialArchive(undefined)).toBeNull();
    expect(lifeTrialArchive("")).toBeNull();
  });

  it("认不得的 id → 空,不印出一句残缺的契文", () => {
    expect(lifeTrialArchive("tr_no_such")).toBeNull();
  });

  it("别把代价也算进履历 —— 那是签约那一刻的事,履历只记「曾立此契」", () => {
    const row = lifeTrialArchive(LIFE_TRIALS[0]!.id);
    expect(JSON.stringify(row)).not.toMatch(/cost|paid/);
  });
});

describe("逆旅契履历 · 只是读", () => {
  it("不 import store / core / DOM —— 与其余读法同一条纪律", () => {
    const src = readSource("src/ui/lifeTrialArchive.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/from ["']@\/stores\//);
    expect(src).not.toMatch(/from ["']@\/core\//);
  });

  it("真接线:历世履历把 trialId 翻出来渲染", () => {
    const view = readSource("src/views/LegacyView.vue");
    expect(view, "履历要读逆旅契").toContain("lifeTrialArchive(");
    expect(view, "要有稳定落点").toContain("data-life-trial");
  });

  it("反空转:履历真的用到了 LifeRecord 的这一栏", () => {
    const view = readSource("src/views/LegacyView.vue");
    expect(view).toMatch(/trialId/);
  });
});
