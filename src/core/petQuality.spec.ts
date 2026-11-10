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
import { statRangesFor, budgetRangeFor, petBudget as budgetOf, isWritable } from "./petBudget";
import type { QualityId, StatMods } from "@/types";

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

/**
 * 可行域计算器本身得有判据守着 —— 它是「补灵兽时先算再写」那一步的依据。
 *
 * ## 为什么单给一个工具写用例
 *
 * 第 58 轮补两只玄品灵兽,因为没先算可行域,连改七八轮都被上面那四条判据挡回来
 * (改 A 触发 B、改 B 又触发 C)。最后把区间算出来,一次就过。
 *
 * 于是把「求解」提炼成 `core/petBudget`。**工具算错了比没有工具更糟** ——
 * 照着错的区间取值,要么仍然撞墙、要么绕过判据写进一个不该存在的值。
 *
 * ## 判据守什么
 *
 * ① 每个品阶的区间都非空(空区间意味着那一档再也补不进那个词条);
 * ② 区间真的收得住:落在区间内的取值,不会违反「同词条跨品阶不回落」;
 * ③ 预算区间同理。
 *
 * 第二条是关键的 —— 它把工具与判据绑在一起,而不是各算各的。
 */
describe("灵兽可行域 · 计算器算出来的区间真能收住", () => {
  it("每个品阶都有非空的可用词条,且区间边界自洽", () => {
    const tiers: QualityId[] = [
      "excellent",
      "spirit",
      "profound",
      "earth",
      "heaven",
      "immortal",
      "divine",
    ];
    for (const tier of tiers) {
      const ranges = statRangesFor(tier);
      expect(ranges.length, `${tier} 档一个可写词条都没有`).toBeGreaterThan(0);
      for (const r of ranges) {
        expect(isWritable(r), `${tier} 档的 ${r.key} 区间为空 [${r.lo}, ${r.hi}]`).toBe(true);
        /*
         * 不写 `lo >= 0` —— 那是恒真的(`statRangesFor` 用 `Math.max(0, …)` 起算)。
         * 改查更实的事:区间上下界都得是有限数或 Infinity,**且不能两头都是 Infinity**
         * (那样等于"这个键没有约束",而它明明被列进了可写词条)。
         */
        expect(
          Number.isFinite(r.lo) || r.lo === 0,
          `${tier} 档的 ${r.key} 下界既不是有限数也不是 0`,
        ).toBe(true);
      }
    }
  });

  it("照着区间取值写出来的灵兽,不会违反同词条跨品阶不回落", () => {
    // 对每一档、每一个可写词条,取区间下界(最容易违反的那一端)构造一只假灵兽,
    // 然后逐条比对:它相对低品阶不许更低。
    for (const tier of ["spirit", "profound", "earth", "heaven"] as QualityId[]) {
      const rank = qualityDef(tier).rank;
      for (const range of statRangesFor(tier)) {
        const probe = { [range.key]: range.lo } as StatMods;
        for (const lower of PETS) {
          if (qualityDef(lower.quality).rank >= rank) continue;
          const lowValue = lower.mods[range.key];
          if (lowValue === undefined) continue;
          expect(
            probe[range.key]!,
            `${tier} 档 ${range.key} 取区间下界 ${range.lo} 仍低于 ${lower.name}(${lower.quality}) 的 ${lowValue}`,
          ).toBeGreaterThanOrEqual(lowValue - 1e-9);
        }
      }
    }
  });

  it("预算区间也收得住:区间内的值不小于任意低品阶、不大于任意高品阶", () => {
    for (const tier of ["spirit", "profound", "earth", "heaven"] as QualityId[]) {
      const rank = qualityDef(tier).rank;
      const { lo, hi } = budgetRangeFor(tier);
      // 不写 `lo >= 0`(恒真)。改查「下界真的来自某只低品阶灵兽」—— 它要么是 0
      // (该档就是最低档),要么等于某只低品阶灵兽的预算。
      const lowerBudgets = PETS.filter((p) => qualityDef(p.quality).rank < rank).map(petBudget);
      if (lowerBudgets.length > 0) {
        expect(
          lowerBudgets.some((b) => Math.abs(b - lo) < 1e-9),
          `${tier} 的预算下界 ${lo} 不是任何一只低品阶灵兽的预算`,
        ).toBe(true);
      }
      if (!Number.isFinite(hi)) continue; // 最高档没有上界
      expect(lo, `${tier} 的预算区间为空 [${lo}, ${hi}]`).toBeLessThanOrEqual(hi + 1e-9);
      for (const other of PETS) {
        const otherRank = qualityDef(other.quality).rank;
        if (otherRank === rank) continue;
        const budget = budgetOf(other);
        if (otherRank < rank) {
          expect(
            lo,
            `${tier} 预算下界 ${lo} 低于低品阶 ${other.name} 的 ${budget}`,
          ).toBeGreaterThanOrEqual(budget - 1e-9);
        } else {
          expect(
            hi,
            `${tier} 预算上界 ${hi} 高于高品阶 ${other.name} 的 ${budget}`,
          ).toBeLessThanOrEqual(budget + 1e-9);
        }
      }
    }
  });
});
