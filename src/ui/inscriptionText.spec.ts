/**
 * 器名与器铭 —— 高级感的差别落在「一起看，却各有句法」上。
 *
 * 由来（`docs/design.md` 的「器」一节）：圣遗物与装备在颜色语义上是同一类，
 * 差别不在色，而在名字的**句法**。所以器名与器铭不是单个字，而是一句对仗名：
 *   器名 —— 放在详情页题名与图鉴名旁，对应物之形（剑、袍、符）；
 *   器铭 —— 对应这件东西的出身（哪一界、什么器类、哪一句铭文）。
 *
 * 两处判据：
 *   一 核心 —— `inscriptionFor` 的字段名就是展示口径，不许在界面里另拼一份；
 *   二 界面 —— 器评帖卷首、坊市验货、图鉴、详情题名四处都要能读到同一份器铭，
 *      且不得自己再拼第二份（改一处改所有露面处）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const source = readSource;

describe("器铭 · 露面处与唯一来源", () => {
  it("器评帖卷首报铭名、铭文与成色，且读 core/inscription 的同一份快照", () => {
    const dialog = source("src/components/equipment/EquipmentDetailDialog.vue");

    expect(dialog, "器评帖要读器铭").toContain("inscriptionFor");
    expect(dialog, "铭文一句直接取快照里的那一句（器类与界域已在眉题报过）").toContain(
      "inscription.verse.text",
    );
    expect(dialog, "卷首的器铭要有稳定落点供真浏览器复核").toContain("data-equipment-inscription");
    expect(dialog, "成色是这一件的读数，要有自己的落点").toContain(
      "data-equipment-inscription-temper",
    );
  });

  it("坊市验货签读同一份器铭 —— 买之前就该看见它的出身", () => {
    const shelf = source("src/ui/marketShelf.ts");
    const view = source("src/views/MarketView.vue");

    expect(shelf, "验货账要带器铭").toContain("inscriptionFor");
    expect(view, "验货签要把它摊在词条之上").toContain("data-market-equipment-inscription");
  });

  it("器铭不参与选件：它只描述这一件，不替玩家做决定", () => {
    const section = source("src/core/inscription.ts");
    // 一句话判据：器铭模块不许 import 战力、排序或任何"挑哪一件"的模块
    expect(section, "器铭不许依赖战力判据").not.toContain("equipBest");
    expect(section, "器铭不许依赖收纳规则").not.toContain("smartKeep");
    expect(section, "器铭不进任何结算，只读这一件的事实").not.toMatch(
      /from "@\/core\/(forge|reforge|salvage|equipBest|smartKeep)"/,
    );
  });

  it("器铭不重复器首已有的信息：器类与界域只在眉题出现一次", () => {
    const section = source("src/core/inscription.ts");
    const dialog = source("src/components/equipment/EquipmentDetailDialog.vue");
    expect(section, "铭里不再带器类(眉题已报槽位)").not.toContain("EQUIP_SLOT_NAMES");
    expect(section, "铭里不再带界域(眉题已报层级所属)").not.toContain("worldNameOfTier");
    expect(dialog, "眉题仍报槽位与界域").toContain("EQUIP_SLOT_NAMES[template.slot]");
    expect(dialog, "眉题仍报层级所属界域").toContain("worldNameOfTier(inst.tier)");
  });
});
