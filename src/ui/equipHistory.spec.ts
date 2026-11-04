/**
 * 一件器物的经历 —— 它被炼过几重、洗过几次、封存过几条。
 *
 * ## 缺口:账都记着,器评帖里却一条都读不到
 *
 * 每件装备身上早就有四笔账(见 types 的 EquipmentInstance):
 *
 *   `level`          强化等级   —— 器评帖**只**印了这一笔(`+N`),且只是眉题上一枚角标
 *   `reforgeCount`   重铸次数   —— 只有重铸面板那一行「已重铸 N 次」读它
 *   `sealedAffixIds` 封存词条   —— 同上,只在重铸面板
 *   `invested`       累计投入   —— 只在分解返还与器魂警告里露面
 *
 * 于是玩家点开一件跟了自己几百场的旧器,看到的是「品质 + 词条 + 器铭」这一套
 * 出厂信息 —— 而它**经历过什么**,在详情页里一句都没有。器铭讲的是「它生来是谁」
 * (见 core/inscription),这里该讲「它后来成了什么」,两件事,两处。
 *
 * ## 为什么这不是数值的第五种写法
 *
 * 这一行**不给任何加成、不参与任何判定**,只把已经记下的四笔账说成人话。
 * 与器铭同一条纪律:描述这一件,不替玩家做决定。故它读的每一个数都是既有字段,
 * 一个都不新增 —— 加字段就要迁移存档,而这条信息一行都不缺。
 *
 * ## 诚实口径
 *
 *   · 什么都没做过 —— 整行不出(而不是印一句「尚无经历」占地方)
 *   · 旧档没有 invested 的老件 —— 只说等级与重铸次数,不补造投入
 *   · 坏值(负数、NaN、重铸次数比词条还多)—— 夹回合法范围,不印出荒唐数
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { equipHistory, equipHistoryText } from "./equipHistory";
import { gn } from "@/utils/gnum";
import type { EquipmentInstance } from "@/types";

const inst = (over: Partial<EquipmentInstance> = {}): EquipmentInstance => ({
  uid: "u1",
  templateId: "w_zhuqing",
  quality: "heaven",
  tier: 10,
  level: 0,
  affixes: [
    { id: "a1", roll: 0.8 },
    { id: "a2", roll: 0.9 },
    { id: "a3", roll: 0.7 },
  ],
  ...over,
});

describe("器物的经历 · 没做过就整行不出", () => {
  it("全新的一件:无等级、无重铸、无封存 —— 一句都不说", () => {
    const history = equipHistory(inst());
    expect(history.lines, "全新件不该有行迹").toEqual([]);
    expect(equipHistoryText(inst())).toBe("");
  });

  it("只有投入而没有等级/重铸的账(旧档坏账)也不编一句话", () => {
    // 投入是「花了多少」,不是「做过什么」;没做过工序就不算经历
    const history = equipHistory(inst({ invested: { dust: 500, stone: gn(120) } }));
    expect(history.lines).toEqual([]);
  });
});

describe("器物的经历 · 四笔账各说各的", () => {
  it("强化等级说得出第几重", () => {
    expect(equipHistoryText(inst({ level: 7 }))).toContain("第 7 重");
  });

  it("重铸次数说得出洗过几次", () => {
    expect(equipHistoryText(inst({ reforgeCount: 3 }))).toContain("重铸 3 次");
  });

  it("封存条数说得出封了几条", () => {
    expect(equipHistoryText(inst({ sealedAffixIds: ["a2"] }))).toContain("封存 1/2");
  });

  it("几笔账并排时用同一个分隔,不各写一种", () => {
    const text = equipHistoryText(inst({ level: 3, reforgeCount: 2, sealedAffixIds: ["a2"] }));
    expect(text).toContain("·");
    // 三笔都在
    expect(text).toContain("第 3 重");
    expect(text).toContain("重铸 2 次");
    expect(text).toContain("封存 1/2");
  });
});

describe("器物的经历 · 坏值不撒谎", () => {
  it("负的等级/重铸次数当成没做过,不印出「第 -3 重」", () => {
    const text = equipHistoryText(inst({ level: -3, reforgeCount: -2 }));
    expect(text).toBe("");
  });

  it("NaN 与小数的等级被夹成合法整数", () => {
    expect(equipHistoryText(inst({ level: Number.NaN }))).toBe("");
    expect(equipHistoryText(inst({ level: 3.7 }))).toContain("第 3 重");
  });

  it("封存条数超过词条总数时夹到上限 —— 不印出「封存 5/2」", () => {
    const text = equipHistoryText(inst({ sealedAffixIds: ["a1", "a2", "a3", "a4", "a5"] }));
    expect(text).toContain("封存 2/2");
    expect(text).not.toContain("5/2");
  });

  it("单条词条的件封不了任何一条 —— 封存那笔整句不出", () => {
    const one = inst({ affixes: [{ id: "a1", roll: 0.5 }], sealedAffixIds: ["a1"] });
    expect(equipHistoryText(one)).toBe("");
  });
});

describe("器物的经历 · 只是描述", () => {
  it("不 import store / core / DOM —— 与器铭同一条纪律", () => {
    const src = readSource("src/ui/equipHistory.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/from ["']@\/stores\//);
    expect(src).not.toMatch(/from ["']@\/core\//);
  });

  it("不给加成:导出的只有读数与文案", () => {
    const src = readSource("src/ui/equipHistory.ts");
    expect(src, "不许碰词条合并").not.toContain("mergeMods");
    expect(src, "不许碰结算").not.toMatch(/finalStats|applyDamage/);
  });

  it("真接线:器评帖读它,并有稳定落点", () => {
    const view = readSource("src/components/equipment/EquipmentDetailDialog.vue");
    expect(view, "器评帖要读经历").toContain("equipHistoryText(");
    expect(view, "要有稳定落点").toContain("data-equipment-history");
  });
});
