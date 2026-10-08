/**
 * 词条转移的**纯判据** —— 把一条词条从源件抽出,原样落到目标件。
 *
 * 只测 core/affixTransfer 的纯函数(targetBlock / planTransfer / expectedRollsToHit):
 * 判据不改行囊、不算资源,界面与服务都只认它。读 store 的编排(transferAffix 等)
 * 在 composables/useAffixTransfer 及其 spec 里测,这里不绑 Pinia。
 */
import { describe, expect, it } from "vite-plus/test";
import { createRng } from "wanxiang-engine";
import type { EquipmentInstance, QualityId } from "@/types";
import { planTransfer, targetBlock, expectedRollsToHit } from "./affixTransfer";
import { ENGINE_WORLD } from "./engineWorld";
import { qualityDef } from "@/data/qualities";

function eq(
  uid: string,
  templateId: string,
  quality: QualityId,
  affixes: { id: string; roll: number }[],
): EquipmentInstance {
  return { uid, templateId, quality, tier: 3, level: 0, affixes };
}

// 源件:武器,带任意部位可吃的 atk1 + 一条 def1(不被转,验证"源件只少一条")
const SRC = eq("src", "w_zhuqing", "mortal", [
  { id: "atk1", roll: 0.8 },
  { id: "def1", roll: 0.5 },
]);
// 目标:道袍(body),凡品满一条
const TGT_FULL = eq("tgt", "b_qingyun", "mortal", [{ id: "hp1", roll: 0.5 }]);
// 目标:良品(可两条),未满
const TGT_ROOM = eq("tgt", "b_qingyun", "fine", [{ id: "hp1", roll: 0.5 }]);

describe("targetBlock 接不接", () => {
  it("同件 / 无此词条 / 无件形", () => {
    expect(targetBlock(SRC, SRC, "atk1")).toBe("same");
    const t = eq("t", "b_qingyun", "mortal", []);
    expect(targetBlock(SRC, t, "ghost")).toBe("noAffix");
  });

  it("部位不符 → slot;品质不够 → rank", () => {
    // crit1 只许 weapon/jewelry,落 body 上 = 部位不符
    const crit = eq("c", "w_zhuqing", "mortal", [{ id: "crit1", roll: 0.6 }]);
    expect(targetBlock(crit, TGT_FULL, "crit1")).toBe("slot");
    // atk2 要求 minRank≥2,凡品(rank0)接不下
    const atk2s = eq("s", "w_zhuqing", "mortal", [{ id: "atk2", roll: 0.6 }]);
    expect(targetBlock(atk2s, TGT_FULL, "atk2")).toBe("rank");
  });

  it("同 id 已有且不低于 → dup;更高则可", () => {
    const weaker = eq("w", "b_qingyun", "mortal", [{ id: "atk1", roll: 0.9 }]);
    expect(targetBlock(SRC, weaker, "atk1")).toBe("dup");
    const lower = eq("l", "b_qingyun", "mortal", [{ id: "atk1", roll: 0.5 }]);
    expect(targetBlock(SRC, lower, "atk1")).toBeNull();
  });
});

describe("planTransfer 落地", () => {
  it("同 id 只能覆盖它自己:顶替的是别的 id,即便目标那条更低也被拦(dup)", () => {
    const lower = eq("t", "b_qingyun", "mortal", [{ id: "atk1", roll: 0.5 }]);
    const r = planTransfer(SRC, lower, "atk1", "ghost_id", false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.block).toBe("dup");
    // 顶替它自己(唯一合法落位)→ 放行,只是数值变成源件的
    const ok = planTransfer(SRC, lower, "atk1", "atk1", false);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.plan.moved).toEqual({ id: "atk1", roll: 0.8 });
  });

  it("noLanding:落位 id 不在目标上", () => {
    const r = planTransfer(SRC, TGT_FULL, "atk1", "ghost_id", false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.block).toBe("noLanding");
  });

  it("满条须先顶替(full);未满可新增", () => {
    const full = planTransfer(SRC, TGT_FULL, "atk1", null, false);
    expect(full.ok).toBe(false);
    if (!full.ok) expect(full.block).toBe("full");
    const room = planTransfer(SRC, TGT_ROOM, "atk1", null, false);
    expect(room.ok).toBe(true);
    if (room.ok) {
      expect(room.plan.target.affixes.map((a) => a.id)).toEqual(["hp1", "atk1"]);
      expect(room.plan.moved).toEqual({ id: "atk1", roll: 0.8 });
      expect(room.plan.sealMode).toBe("none");
      expect(room.plan.replaced).toBeNull();
      expect(room.plan.source.affixes.map((a) => a.id)).toEqual(["def1"]);
    }
  });

  it("递减属性同键不叠加(stack);顶替同键那条则放行", () => {
    // fm 系列是 fullHpDamage(递减键),且只许武器。profound(rank4) 才接得住 minRank4 的 fm2。
    const srcFm2 = eq("s", "w_zhuqing", "profound", [{ id: "fm2", roll: 0.6 }]);
    const hasFm1 = eq("t", "w_zhuqing", "profound", [
      { id: "fm1", roll: 0.5 },
      { id: "def1", roll: 0.5 },
    ]);
    const stacked = planTransfer(srcFm2, hasFm1, "fm2", "def1", false);
    expect(stacked.ok).toBe(false);
    if (!stacked.ok) expect(stacked.block).toBe("stack");
    const replaced = planTransfer(srcFm2, hasFm1, "fm2", "fm1", false);
    expect(replaced.ok).toBe(true);
  });

  it("封存沿袭:顶替已封存的条,新条沿用封存;计数 +1", () => {
    const sealedTgt = eq("t", "b_qingyun", "mortal", [{ id: "hp1", roll: 0.5 }]);
    sealedTgt.sealedAffixIds = ["hp1"];
    const r = planTransfer(SRC, sealedTgt, "atk1", "hp1", false);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.sealMode).toBe("inherit");
      expect(r.plan.target.sealedAffixIds).toContain("atk1");
      expect(r.plan.target.transferCount).toBe(1);
      expect(r.plan.cost.sealStone).toBeNull();
    }
  });
});

/**
 * 定价对账 —— 转移价 = 引擎真实洗练的期望命中次数的打折,故估计器(expectedRollsToHit)
 * 必须跟得上引擎的抽选口径。本测试用引擎 rerollAffixes 实测命中率,与解析预期比对:
 * 换洗练规则(池子/权重/条数)不更新估计器时,这里当场红。取数带至少打了个折扣的安全余量。
 */
describe("定价对账 · expectedRollsToHit 与引擎实际抽选同源", () => {
  it("实测命中率落在解析预期 ±25% 带内", () => {
    const inst = eq("w", "w_zhuqing", "excellent", []);
    const target = "atk1";
    const kept: string[] = [];
    const p = 1 / expectedRollsToHit(inst, target, kept);
    expect(p).toBeGreaterThan(0);
    const q = qualityDef(inst.quality);
    let hits = 0;
    const N = 1500;
    for (let i = 0; i < N; i += 1) {
      const affixes = ENGINE_WORLD.equipment.rerollAffixes(inst.affixes, {
        rng: createRng(1000 + i),
        quality: q,
        tier: inst.tier,
        slot: "weapon",
        keep: [],
      });
      if (affixes.some((a) => a.id === target)) hits += 1;
    }
    const measured = hits / N;
    expect(measured, "实测命中率应贴近解析预期").toBeGreaterThan(p * 0.75);
    expect(measured).toBeLessThan(p * 1.25);
  });
});
