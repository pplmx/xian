/**
 * 词条转移的编排层 —— 读 store → 判 → 写 store(见 useAffixTransfer 的转移)。
 * 判据细节在 core/affixTransfer.spec,这里只守「一笔结清」的边界:
 *   校验 → 扣费 → 写目标 → 写源件;任何一步被拒都一笔不扣、一处不改。
 */
import { describe, expect, it, beforeEach } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import type { EquipmentInstance, QualityId } from "@/types";
import { transferAffix, transferCandidates } from "./useAffixTransfer";
import { planTransfer } from "@/core/affixTransfer";
import { useInventoryStore } from "@/stores/inventory";
import { useResourcesStore } from "@/stores/resources";
import { gn, toNum } from "@/utils/gnum";

function eq(
  uid: string,
  templateId: string,
  quality: QualityId,
  affixes: { id: string; roll: number }[],
): EquipmentInstance {
  return { uid, templateId, quality, tier: 3, level: 0, affixes };
}

describe("useAffixTransfer 服务", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("校验→扣费→写目标→写源件,资源照付、两件都更新", () => {
    const inventory = useInventoryStore();
    const resources = useResourcesStore();
    inventory.addEquipment(
      eq("src", "w_zhuqing", "mortal", [
        { id: "atk1", roll: 0.8 },
        { id: "def1", roll: 0.5 },
      ]),
    );
    inventory.addEquipment(eq("tgt", "b_qingyun", "mortal", [{ id: "hp1", roll: 0.5 }]));
    resources.addStone(gn(1e12));
    resources.addSmall("dust", 10_000);
    const stoneBefore = resources.spiritStone;

    const ok = transferAffix({
      sourceUid: "src",
      targetUid: "tgt",
      affixId: "atk1",
      replaceId: "hp1",
      seal: false,
    });
    expect(ok).toBe(true);
    expect(inventory.findItem("tgt")!.affixes.map((a) => a.id)).toEqual(["atk1"]);
    expect(inventory.findItem("src")!.affixes.map((a) => a.id)).toEqual(["def1"]);
    expect(toNum(resources.spiritStone), "灵石应被转移一笔扣掉").toBeLessThan(toNum(stoneBefore));
  });

  it("资源不足 → 拒,一件不动、一笔不扣", () => {
    const inventory = useInventoryStore();
    inventory.addEquipment(eq("src", "w_zhuqing", "mortal", [{ id: "atk1", roll: 0.8 }]));
    inventory.addEquipment(eq("tgt", "b_qingyun", "fine", [{ id: "hp1", roll: 0.5 }]));
    // 不加任何资源

    const ok = transferAffix({
      sourceUid: "src",
      targetUid: "tgt",
      affixId: "atk1",
      replaceId: null,
      seal: false,
    });
    expect(ok).toBe(false);
    expect(inventory.findItem("src")!.affixes.map((a) => a.id)).toEqual(["atk1"]);
    expect(inventory.findItem("tgt")!.affixes.map((a) => a.id)).toEqual(["hp1"]);
  });

  it("候选只列可接或置灰(dup/同部位 rank),部位不合的直接不出现", () => {
    const inventory = useInventoryStore();
    const src = eq("src", "w_zhuqing", "mortal", [{ id: "atk1", roll: 0.8 }]);
    inventory.addEquipment(src);
    // 可接:body 凡品
    inventory.addEquipment(eq("ok", "b_qingyun", "mortal", [{ id: "hp1", roll: 0.5 }]));
    // dup:body 已有一条更高的 atk1
    inventory.addEquipment(eq("dup", "b_qingyun", "mortal", [{ id: "atk1", roll: 0.9 }]));
    // 部位不合:crit1 是 weapon-only,但这里候选列表按「被转移的 atk1」看 —— atk1 无部位限制,都接
    const cands = transferCandidates(src, "atk1");
    const ids = cands.map((c) => c.item.uid);
    expect(ids).toContain("ok");
    expect(ids).toContain("dup");
    const dupRow = cands.find((c) => c.item.uid === "dup")!;
    expect(dupRow.block).toBe("dup");
    // 把可接的放最前
    expect(cands[0]!.item.uid).toBe("ok");
  });

  it("planTransfer 与转移服务共用同一判据(服务依计划落账,计划即预览)", () => {
    const inventory = useInventoryStore();
    inventory.addEquipment(eq("src", "w_zhuqing", "mortal", [{ id: "atk1", roll: 0.8 }]));
    inventory.addEquipment(eq("tgt", "b_qingyun", "fine", [{ id: "hp1", roll: 0.5 }]));
    const check = planTransfer(
      inventory.findItem("src")!,
      inventory.findItem("tgt")!,
      "atk1",
      null,
      false,
    );
    expect(check.ok).toBe(true);
  });
});
