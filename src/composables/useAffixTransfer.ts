/**
 * 词条转移的编排层 —— 读 store → 调 core/affixTransfer 的纯函数 → 写 store。
 *
 * xian 的分层约定:core 只留纯逻辑(不 import store),「读 state → 判 → 写 state」
 * 的编排收进调用方边缘。本文件把 yunyin affixTransfer 里读 store 的那几段搬到这里:
 *   · transferCandidates —— 读行囊,筛目标件;
 *   · transferShort —— 读资源,算还差哪一样;
 *   · transferAffix —— 全链路:校验 → 扣费 → 写目标 → 写源件。
 * 界面只用本文件的函数;判据仍以 core/affixTransfer 的 planTransfer / targetBlock 为准。
 */
import type { EquipmentInstance } from "@/types";
import {
  planTransfer,
  targetBlock,
  type TransferCandidate,
  type TransferCost,
  type TransferRequest,
  type TransferShort,
} from "@/core/affixTransfer";
import { affixDef } from "@/data/affixes";
import { equipmentTemplate } from "@/data/equipment";
import { qualityDef } from "@/data/qualities";
import { playSfx } from "@/core/audio";
import { notify } from "@/core/notify";
import { transferBlockText, TRANSFER_NEEDS_TEXT } from "@/ui/affixTransferText";
import { useInventoryStore } from "@/stores/inventory";
import { useResourcesStore } from "@/stores/resources";

/** 缺哪一样资源(null = 付得起) —— 主按钮的禁用态与服务同一处 */
export function transferShort(cost: TransferCost): TransferShort {
  const resources = useResourcesStore();
  if (!resources.hasStone(cost.stone)) return "stone";
  if (!resources.hasSmall("dust", cost.dust)) return "dust";
  return null;
}

/**
 * 能接这一条的目标件:可选在前 → 已装备在前 → 与源件同部位在前 → 品质高、阶高在前。
 * 部位不合的件不列出;已有这条且不更低的、同部位但品质不够的,列出置灰(写明原因)。
 */
export function transferCandidates(
  source: EquipmentInstance,
  affixId: string,
): TransferCandidate[] {
  const inventory = useInventoryStore();
  const sourceSlot = equipmentTemplate(source.templateId)?.slot;
  const sameSlot = (item: EquipmentInstance): boolean =>
    equipmentTemplate(item.templateId)?.slot === sourceSlot;
  return inventory.items
    .map((item) => ({
      item,
      worn: inventory.equippedUids.has(item.uid),
      block: targetBlock(source, item, affixId),
    }))
    .filter(
      (c): c is TransferCandidate =>
        c.block === null || c.block === "dup" || (c.block === "rank" && sameSlot(c.item)),
    )
    .sort((a, b) => {
      if ((a.block === null) !== (b.block === null)) return a.block === null ? -1 : 1;
      if (a.worn !== b.worn) return a.worn ? -1 : 1;
      if (sameSlot(a.item) !== sameSlot(b.item)) return sameSlot(a.item) ? -1 : 1;
      const dq = qualityDef(b.item.quality).rank - qualityDef(a.item.quality).rank;
      if (dq !== 0) return dq;
      return b.item.tier - a.item.tier || a.item.uid.localeCompare(b.item.uid);
    });
}

/** 服务:全部校验 → 扣费 → 写目标 → 写源件。同步执行,任何一步被拒都一笔不扣、一处不改 */
export function transferAffix(req: TransferRequest): boolean {
  const inventory = useInventoryStore();
  const resources = useResourcesStore();
  const source = inventory.findItem(req.sourceUid);
  const target = inventory.findItem(req.targetUid);
  if (!source || !target) {
    playSfx("warn");
    notify("目标或源件已不在行囊", "warn");
    return false;
  }
  const check = planTransfer(source, target, req.affixId, req.replaceId, req.seal);
  if (!check.ok) {
    playSfx("warn");
    notify(transferBlockText(check.block, req.affixId), "warn");
    return false;
  }
  const short = transferShort(check.plan.cost);
  if (short) {
    playSfx("warn");
    notify(TRANSFER_NEEDS_TEXT[short], "warn");
    return false;
  }
  resources.spendStone(check.plan.cost.stone);
  resources.spendSmall("dust", check.plan.cost.dust);
  inventory.replaceItem(check.plan.target);
  inventory.replaceItem(check.plan.source);
  playSfx("success"); // 词条易地,一声落地
  notify(`「${affixDef(req.affixId)?.name ?? req.affixId}」已易地而至`, "success");
  return true;
}
