/**
 * 九项技艺 —— 宿慧里权重最大的一项，界面上最看不见
 *
 * ## 缺口（量出来的）
 *
 * `samsaraService.loreInsight` 把宿慧折成五项，其中**技艺那一项权重最大**:
 *
 * ```text
 *   认得灵材      每味 3 点（通晓再 +5）
 *   通晓丹方      每张 4 点
 *   读通器谱      每张 1 点
 *   九项技艺      熟练度之和（0~900）÷ 20 → 最高 45 点
 *   洞悉敌手      每种 2 点
 * ```
 *
 * 而技艺在界面上只有两处**局部**显示:
 *   `EquipReforgePanel`  —— 只报「铭纹」一项（重铸要用它）
 *   `EquipmentDetailDialog` —— 装备详情里顺带列几条
 *
 * 修仙录「随身所知」四行里有三行（灵材 / 丹方 / 器谱 / 敌手），**没有技艺那一行**。
 * 于是玩家看不到「我这世练出了什么手艺」，也不知道它是宿慧的主要来源。
 *
 * ## 补什么:第五行「技艺进度」
 *
 * 与已有四行同构:抬头报总体（九项熟练度之和 ÷ 20 = 折多少宿慧），
 * 逐行报九项各自的境地（生疏 → 大成）与「离下一境地还差多少」。
 *
 * 三条口径:
 *
 *   · **报境地名,不报裸数字**。`crafting.ts` 的注释写着「用叙事分档代替裸数字,
 *     避免玩家把技艺读成等级」;这一行沿用同一份 `skillStageName` / `SKILL_STAGES`,
 *     不在界面另切一套桶。
 *   · **报「折多少宿慧」,不报「熟练度之和」**。后者是内部量,前者才是玩家关心的。
 *     折算仍走 `samsaraService.INSIGHT_SKILL_DIV`,不在这里再除一遍。
 *   · **不排「谁高谁低」的顺序**。技艺没有强弱之分（各有各的用处）,
 *     按 `SKILLS` 原序排,与丹房、重铸面板里的顺序一致。
 *
 * ## 只列动过的技艺
 *
 * 九项全零时整块不出 —— 与器谱进度、敌手谱同一条纪律:没动过的不点名。
 */
import { describe, expect, it } from "vite-plus/test";
import { DAO_NAMES } from "@/data/crafting";
import { skillInsightDesk } from "./skillInsightDesk";
import { INSIGHT_SKILL_DIV } from "@/data/samsara";

describe("技艺进度 · 纯函数", () => {
  it("只列动过的技艺 —— 全零不点名", () => {
    const desk = skillInsightDesk({});
    expect(desk.rows).toEqual([]);
    expect(desk.insight).toBe(0);
  });

  it("报的是境地名，不是裸数字", () => {
    /*
     * `crafting.ts` 的注释:「用叙事分档代替裸数字,避免玩家把技艺读成『等级』」。
     * 这一行必须沿用同一份分档。
     */
    const desk = skillInsightDesk({ condense: 6000 });
    expect(desk.rows.length).toBe(1);
    expect(desk.rows[0]!.stage, "该报境地名").toMatch(/生疏|初识|入门|小成|娴熟|精通|通玄|大成/);
  });

  it("按 SKILLS 原序排，不按熟练度高低排 —— 技艺无强弱之分", () => {
    /*
     * 取一对**顺序相反**的数据:`discern` 在 SKILLS 里最早、`inscribe` 最晚。
     * 让 `inscribe` 练得多、`discern` 练得少 —— 若按熟练度排,inscribe 会跑到前面;
     * 按原序则 discern 仍在前面。数据要刻意挑成这样,否则「两种排法恰好一致」
     * 会让判据测不出东西(第一版就是这么写错的)。
     */
    const desk = skillInsightDesk({ inscribe: 6000, discern: 100 });
    expect(
      desk.rows.map((r) => r.id),
      "先练的在后、后练的在前 —— 说明排的是熟练度不是原序",
    ).toEqual(["discern", "inscribe"]);
  });

  it("折算宿慧读 samsaraService 那个除数，不在这里重算", () => {
    /*
     * 这一条钉的是「不做两本账」:熟练度之和 ÷ INSIGHT_SKILL_DIV 是
     * `loreInsight` 的口径,界面只报结果。若界面自己写死 20,
     * 改平衡时两边必然分叉。
     */
    /*
     * 验「同一份除数」而不是「>= 0」（后者对这个值域恒真，
     * `tautologyGuard.spec` 会抓出来）。做法：用 `INSIGHT_SKILL_DIV` 现算一份期望值，
     * 与界面给的那个数比 —— 若界面自己写死了别的除数，这条立刻红。
     */
    const desk = skillInsightDesk({ condense: 600 });
    const levelSum = desk.rows.reduce((sum, r) => sum + r.level, 0);
    expect(desk.insight, "界面折算与 INSIGHT_SKILL_DIV 对不上 —— 说明它自己又除了一遍").toBe(
      Math.floor(levelSum / INSIGHT_SKILL_DIV),
    );
  });

  it("单项也报「离下一境地还差多少」", () => {
    /*
     * 不用 `>= 0` —— 那对这个值域恒真（`skillStageProgress` 已经 clamp 过），
     * `tautologyGuard.spec` 会把它当成恒真断言抓出来（实测踩过）。
     * 改成验**两个方向都能被违反**的形状：低段位与高段位的进度必须不同，
     * 且都落在 0~1 之间。
     */
    const low = skillInsightDesk({ condense: 100 }).rows[0]!;
    const high = skillInsightDesk({ condense: 5000 }).rows[0]!;
    expect(low.nextStage, "低段位该有下一境地").toBeTruthy();
    expect(high.nextStage, "同样有下一境地（技艺无练满）").toBeTruthy();
    expect(low.progress, "两档进度不该相同 —— 否则这条判据测不出东西").not.toBe(high.progress);
    // 进度是比率：上界能被违反（>1 就是算错），下界同理（<0 也是算错）
    for (const p of [low.progress, high.progress]) {
      expect(p <= 1, `进度 ${p} 超过 1 —— 比率算错`).toBe(true);
      expect(p >= 0, `进度 ${p} 小于 0 —— 比率算错`).toBe(true);
    }
  });

  it("坏值（负 / NaN）当作没练过", () => {
    const desk = skillInsightDesk({ condense: -100, smithing: Number.NaN });
    expect(desk.rows).toEqual([]);
  });

  it("不认识的技艺 id 忽略 —— 不印一个查不到名字的行", () => {
    const desk = skillInsightDesk({ not_a_skill: 500 });
    expect(desk.rows).toEqual([]);
  });

  it("每行都报得出所属的道 —— 与炼丹界面同一份数据,不能一处报一处不报", () => {
    /*
     * `data/crafting` 的每门技艺都有 `dao`(识材道 / 炼丹道 / 灵火道 / 炼器道),
     * 而 `BrewingDialog` 早就把它显示成了「道」那一列。宿慧这一页原先只报技艺名 ——
     * 同一份数据,两个界面一个报一个不报。
     *
     * 这条守两件事:
     * ① 每一行都带上 `daoName`;
     * ② 那个名字来自 `DAO_NAMES`,不是另拼一份 —— 两处各拼一份迟早分叉。
     */
    const desk = skillInsightDesk({ discern: 400, condense: 400, smithing: 400 });
    expect(desk.rows.length).toBeGreaterThan(0);
    for (const row of desk.rows) {
      expect(row.daoName, `${row.name} 没有报出所属的道`).toBeTruthy();
      expect(
        Object.values(DAO_NAMES),
        `${row.name} 的道名「${row.daoName}」不在 DAO_NAMES 里 —— 是不是另拼了一份`,
      ).toContain(row.daoName);
    }
    // 四条道都要能出现,不许只认得其中一条
    const all = skillInsightDesk({
      discern: 400,
      herbLore: 400,
      pairing: 400,
      condense: 400,
      temper: 400,
      nurture: 400,
      flame: 400,
      smithing: 400,
      inscribe: 400,
    });
    const daos = new Set(all.rows.map((r) => r.daoName));
    expect(daos.size, "九门技艺只报出了 " + daos.size + " 条道").toBe(
      Object.keys(DAO_NAMES).length,
    );
  });

  it("报得出九项里有几项动过", () => {
    const desk = skillInsightDesk({ condense: 600, smithing: 300, inscribe: 100 });
    expect(desk.activeCount).toBe(3);
  });
});
