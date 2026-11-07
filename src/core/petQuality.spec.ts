/**
 * 灵兽品质 ↔ 效果匹配 —— 「名头配得上数值」这件事,数据可证,不靠品味。
 *
 * 与法宝品阶阶梯同款规矩(见 loot.spec 的「至宝榜必为神品」):用户问
 * 「灵兽品质与效果是否匹配上」,这里落成两条机械不变量,改数据即红:
 *
 *   1. 总预算不回落:任意两宠,品阶高者的词条预算(= Σ|mods|)≥ 品阶低者。
 *      抓的是「神品比仙品弱一截」这类名头与数值解耦 —— 混沌饕餮曾以总预算 0.24
 *      输给应龙 0.40(比同品鲲鹏 0.45 少近一半),重配后 0.42。
 *   2. 同键跨品不回落:同一词条键,品阶高者数值 ≥ 品阶低者同键数值。
 *      抓的是单轴倒挂 —— 螭龙幼子(天)修速 0.06 输给摇光鹿(玄)0.08;
 *      御雷猴(玄)攻击 0.06 输给赤火雀(精)0.08。
 *
 * 尺子只压「高品不弱于低品」这一个方向。同品内部专精不同(金蟾聚财、摇光鹿
 * 修速),总预算允许拉开 —— 那是取舍,不是失配。
 */
import { describe, expect, it } from "vite-plus/test";
import { PETS } from "@/data/pets";
import { QUALITIES, qualityDef } from "@/data/qualities";
import type { AnyStatKey, PetDef } from "@/types";

/** 粗略会计:Σ|词条数值|。不引 ruleBudget —— 那把尺子的 KEY_REFS 只覆盖战斗词条 */
const petBudget = (p: PetDef): number =>
  Object.values(p.mods).reduce((s, v) => s + Math.abs(v ?? 0), 0);

describe("灵兽品质 ↔ 效果匹配(预算)", () => {
  it("每只灵兽都有词条效果,不是纯观赏位", () => {
    for (const p of PETS) {
      expect(Object.keys(p.mods).length, `${p.name} 无效果词条`).toBeGreaterThan(0);
    }
  });

  it("总预算随品阶不回落:高品阶单只 ≥ 任意低品阶单只", () => {
    for (const hi of PETS) {
      for (const lo of PETS) {
        const hr = qualityDef(hi.quality).rank;
        const lr = qualityDef(lo.quality).rank;
        if (hr <= lr) continue;
        expect(
          petBudget(hi),
          `${hi.name}(${hi.quality},预算 ${petBudget(hi)}) < ${lo.name}(${lo.quality},预算 ${petBudget(lo)})`,
        ).toBeGreaterThanOrEqual(petBudget(lo) - 1e-9);
      }
    }
  });

  /**
   * 同品阶内不许「全面压过」—— 两只同为神品,一只在每个词条上都更高,另一只就没有
   * 存在理由。灵兽位只有一个,玩家凭什么带那只全面更弱的?
   *
   * 上面两条都只跨品阶比较,同品阶内部从没被查过。实测抓到的两对:
   *
   * | 被压过 | 压过它的 | 逐条 |
   * | --- | --- | --- |
   * | 鲲鹏(41%) | 海蜃鲸(67%) | 历练 25→36 · 际遇 12→22 · 闪避 8→9,且**性格同为 cautious** |
   * | 玄冥玄武(44%) | 镇岳尊(76%) | 防御 18→28 · 气血 18→28 · 减伤 8→14 |
   *
   * 鲲鹏是《逍遥游》那个意象,却成了海蜃鲸的严格下位 —— 不是取舍,是没配平。
   *
   * 判据只查**同品阶**:跨品阶的高下是设计(高品就该更强),同品阶内的全面压过
   * 不是。也不查「预算相同」—— 同品内部专精不同,总预算允许拉开。
   */
  it("同品阶内不许一只在每个词条上都压过另一只", () => {
    const dominated: string[] = [];
    for (let qr = 0; qr < QUALITIES.length; qr += 1) {
      const group = PETS.filter((p) => qualityDef(p.quality).rank === qr);
      for (const a of group) {
        for (const b of group) {
          if (a.id === b.id) continue;
          const bKeys = Object.keys(b.mods) as AnyStatKey[];
          // a 必须覆盖 b 的全部词条,并且逐条 ≥ b
          if (!bKeys.every((k) => a.mods[k] !== undefined)) continue;
          const allGe = bKeys.every((k) => a.mods[k]! >= b.mods[k]! - 1e-9);
          const anyGt = bKeys.some((k) => a.mods[k]! > b.mods[k]! + 1e-9);
          if (allGe && anyGt) {
            dominated.push(
              `${b.name}(预算 ${petBudget(b).toFixed(2)}) 被同品阶的 ${a.name}(${petBudget(a).toFixed(2)}) 在每个词条上压过`,
            );
          }
        }
      }
    }
    expect(dominated, "同品阶的灵兽被全面压过 —— 灵兽位只有一个,它没有存在理由").toEqual([]);
  });

  it("同一词条键跨品阶不回落:高品阶数值 ≥ 低品阶同键数值", () => {
    for (const hi of PETS) {
      for (const lo of PETS) {
        const hr = qualityDef(hi.quality).rank;
        const lr = qualityDef(lo.quality).rank;
        if (hr <= lr) continue;
        const shared = Object.keys(lo.mods).filter((k) => hi.mods[k as AnyStatKey] !== undefined);
        for (const k of shared) {
          const key = k as AnyStatKey;
          expect(
            hi.mods[key]!,
            `${hi.name}(${hi.quality}) 的 ${k} ${hi.mods[key]} < ${lo.name}(${lo.quality}) 的 ${lo.mods[key]}`,
          ).toBeGreaterThanOrEqual(lo.mods[key]! - 1e-9);
        }
      }
    }
  });
});
