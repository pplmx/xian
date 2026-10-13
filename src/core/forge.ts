/**
 * 炼器服务 —— 强化 / 分解 / 法宝升阶
 */
import type { EquipmentInstance, GNum } from "@/types";
import { qualityDef } from "@/data/qualities";
import { equipmentTemplate } from "@/data/equipment";
import {
  artifactDef,
  ARTIFACT_MAX_LEVEL,
  ARTIFACT_UP_STONE_TIER,
  ARTIFACT_UP_WUDAO_BASE,
} from "@/data/artifacts";
import { EQUIP_MAX_LEVEL_BASE } from "@/data/constants";
import { stoneByTier, upgradeCost } from "./formulas";
import { add, gnZero, isZero } from "@/utils/gnum";
import { formatGN } from "@/utils/format";
import { refundRateText, salvageOf } from "./salvage";
import { modOf } from "./statsCalc";
import { noteSmithingUsed } from "./loreService";
import { track } from "./progress";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { useInventoryStore } from "@/stores/inventory";
import { useLoreStore } from "@/stores/lore";
import { useDongfuStore } from "@/stores/dongfu";
import { notify } from "./notify";

export function equipLevelCap(): number {
  return EQUIP_MAX_LEVEL_BASE + useDongfuStore().forgeCapBonus;
}

export function equipUpgradeCost(uid: string): { dust: number; stone: GNum } | null {
  const inventory = useInventoryStore();
  const player = usePlayerStore();
  const inst = inventory.findItem(uid);
  if (!inst || inst.level >= equipLevelCap()) return null;
  const q = qualityDef(inst.quality);
  return upgradeCost(inst.level, inst.tier, q.rank, modOf(player.finalStats.mods, "forgeDiscount"));
}

/**
 * 「连强到顶」的总账预览(纯读,不改任何状态):从当前级一路算到满级,
 * 与 upgradeEquipmentAll 的逐级累计同算法 —— 折扣取当前 forgeDiscount(批量内不变),
 * 让玩家按下前看清一次点到头究竟要吃多少,而不是只看下一级。已满级返回 "max"。
 */
export function upgradeRestCost(uid: string): { count: number; dust: number; stone: GNum } | "max" {
  const inventory = useInventoryStore();
  const player = usePlayerStore();
  const inst = inventory.findItem(uid);
  if (!inst) return "max";
  const cap = equipLevelCap();
  if (inst.level >= cap) return "max";
  const q = qualityDef(inst.quality);
  const discount = modOf(player.finalStats.mods, "forgeDiscount");
  let count = 0;
  let dust = 0;
  let stone = gnZero();
  for (let lv = inst.level; lv < cap; lv += 1) {
    const c = upgradeCost(lv, inst.tier, q.rank, discount);
    count += 1;
    dust += c.dust;
    stone = add(stone, c.stone);
  }
  return { count, dust, stone };
}

/**
 * 单次强化的校验与结算(静默)。
 * 返回本次消耗;到顶/非背包返回 "max",器灵尘或灵石不足返回 "broke"。
 * 单点强化与「连强到顶」共用这一步 —— 两条路一处记账,不会各自漂移。
 */
function applyOneUpgrade(uid: string): { dust: number; stone: GNum } | "max" | "broke" {
  const inventory = useInventoryStore();
  const resources = useResourcesStore();
  const inst = inventory.findItem(uid);
  const cost = equipUpgradeCost(uid);
  if (!inst || !cost) return "max";
  if (!resources.hasSmall("dust", cost.dust) || !resources.hasStone(cost.stone)) return "broke";
  resources.spendSmall("dust", cost.dust);
  resources.spendStone(cost.stone);
  // 记账:这件装备花掉的强化成本(分解时按八成返还)——折扣是当时的,只有账本记得住
  const invested = inst.invested ?? { dust: 0, stone: gnZero() };
  inventory.replaceItem({
    ...inst,
    level: inst.level + 1,
    invested: { dust: invested.dust + cost.dust, stone: add(invested.stone, cost.stone) },
  });
  track("upgrades");
  // 强化过也算「亲手用过」——图鉴那一档由玩家自己推进,不看运气
  useLoreStore().noteEquipUsed(inst.templateId);
  // 炼器也算上手一味矿材:矿石从此能推到「通晓」、锻造技艺照常涨(见 noteSmithingUsed)
  noteSmithingUsed(inst.tier, true);
  return { dust: cost.dust, stone: cost.stone };
}

export function upgradeEquipment(uid: string): boolean {
  const res = applyOneUpgrade(uid);
  if (res === "max") {
    notify("已达强化上限", "warn");
    return false;
  }
  if (res === "broke") {
    notify("器灵尘或灵石不足", "warn");
    return false;
  }
  const inst = useInventoryStore().findItem(uid)!;
  const t = equipmentTemplate(inst.templateId);
  notify(`「${t?.name}」强化至 +${inst.level}`, "success");
  return true;
}

export interface UpgradeBatchResult {
  /** 实际强化了几档 */
  count: number;
  dust: number;
  stone: GNum;
  ended: "max" | "broke" | "unchanged";
}

/**
 * 连强到顶:一次点到器灵尘/灵石见底或满级,不再逐级点。
 * 合一条总账(与 decomposeBatch 同款:批量不逐档弹提示,免得连弹 10 条把位挤没)。
 */
export function upgradeEquipmentAll(uid: string): UpgradeBatchResult {
  let count = 0;
  let dust = 0;
  let stone = gnZero();
  let ended: UpgradeBatchResult["ended"] = "broke";
  // 上限定死:每档必耗料或到顶,循环必然终止;给个安全闸防极端成本为 0 的病理档
  for (let i = 0; i < 200; i += 1) {
    const res = applyOneUpgrade(uid);
    if (res === "max") {
      ended = "max";
      break;
    }
    if (res === "broke") {
      ended = "broke";
      break;
    }
    count += 1;
    dust += res.dust;
    stone = add(stone, res.stone);
  }
  if (count === 0) {
    // 一步都没强成(多半按钮被灰拦着,这里兜底防手滑空点):照单点那分支的措辞报
    notify(ended === "max" ? "已达强化上限" : "器灵尘或灵石不足", "warn");
    return { count, dust, stone, ended: "unchanged" };
  }
  const inst = useInventoryStore().findItem(uid);
  const name = inst ? equipmentTemplate(inst.templateId)?.name : undefined;
  notify(
    ended === "broke"
      ? `「${name ?? "此器"}」连强至 +${inst?.level},料尽止`
      : `「${name ?? "此器"}」连强至 +${inst?.level}(满)`,
    "success",
  );
  return { count, dust, stone, ended };
}

export function decomposeEquipment(uid: string, opts: { quiet?: boolean } = {}): boolean {
  const inventory = useInventoryStore();
  const resources = useResourcesStore();
  const inst = inventory.findItem(uid);
  if (!inst || inst.locked) return false;
  const gain = salvageOf(inst);
  inventory.removeEquipment(uid);
  resources.addSmall("dust", gain.dust);
  resources.addStone(gain.stone);
  track("decomposed");
  if (!opts.quiet) {
    notify(
      isZero(gain.stone)
        ? `分解得器灵尘×${gain.dust}`
        : `分解得器灵尘×${gain.dust} · 退灵石 ${formatGN(gain.stone)}(${refundRateText()})`,
      "info",
    );
  }
  return true;
}

export interface DecomposeBatch {
  count: number;
  dust: number;
  stone: GNum;
}

/** 批量分解的账目文案:批量路径只有这一处措辞,免得各写各的 */
export function batchYieldText(b: DecomposeBatch): string {
  return isZero(b.stone)
    ? `得器灵尘×${b.dust}`
    : `得器灵尘×${b.dust} · 退灵石 ${formatGN(b.stone)}`;
}

/**
 * 批量分解:逐件结算、**不逐件弹提示** —— 提示窗只留最近 5 条,
 * 逐件弹会把「一共拆了多少、拿回多少」的总账顶掉。调用方自己按总量报一次。
 */
export function decomposeBatch(items: readonly EquipmentInstance[]): DecomposeBatch {
  const total: DecomposeBatch = { count: 0, dust: 0, stone: gnZero() };
  for (const it of items) {
    if (!decomposeEquipment(it.uid, { quiet: true })) continue;
    const gain = salvageOf(it);
    total.count += 1;
    total.dust += gain.dust;
    total.stone = add(total.stone, gain.stone);
  }
  return total;
}

/** 行囊中勾选品质的未锁定装备(预告与下手用同一套筛选,所见即所得) */
function decomposeTargets(ranks: readonly number[]): EquipmentInstance[] {
  const wanted = new Set(ranks);
  return useInventoryStore().bagItems.filter(
    (it) => !it.locked && wanted.has(qualityDef(it.quality).rank),
  );
}

/** 分解预告:会拆几件、拿回什么 —— 弹窗上写的数就是真下手的数 */
export function decomposePreview(ranks: readonly number[]): DecomposeBatch {
  const total: DecomposeBatch = { count: 0, dust: 0, stone: gnZero() };
  for (const it of decomposeTargets(ranks)) {
    const gain = salvageOf(it);
    total.count += 1;
    total.dust += gain.dust;
    total.stone = add(total.stone, gain.stone);
  }
  return total;
}

/** 一键分解:行囊中勾选品质 rank 的未锁定装备,按一次总账报出来,返回分解件数 */
export function decomposeByRanks(ranks: readonly number[]): number {
  const got = decomposeBatch(decomposeTargets(ranks));
  if (got.count > 0) notify(`已分解 ${got.count} 件装备,${batchYieldText(got)}`, "info");
  return got.count;
}

export function artifactUpCost(defId: string): { wudao: number; stone: GNum } | null {
  const inventory = useInventoryStore();
  const owned = inventory.artifacts.find((a) => a.defId === defId);
  const def = artifactDef(defId);
  if (!owned || !def || owned.level >= ARTIFACT_MAX_LEVEL) return null;
  return {
    wudao: Math.ceil(
      ARTIFACT_UP_WUDAO_BASE *
        Math.pow(1.6, owned.level) *
        (1 + qualityDef(def.quality).rank * 0.3),
    ),
    stone: stoneByTier(def.fromTier, ARTIFACT_UP_STONE_TIER * (1 + owned.level)),
  };
}

export function upgradeArtifact(defId: string): boolean {
  const inventory = useInventoryStore();
  const resources = useResourcesStore();
  const cost = artifactUpCost(defId);
  const def = artifactDef(defId);
  if (!cost || !def) {
    notify("此法宝已臻圆满", "warn");
    return false;
  }
  if (!resources.hasSmall("wudao", cost.wudao) || !resources.hasStone(cost.stone)) {
    notify("悟道点或灵石不足", "warn");
    return false;
  }
  resources.spendSmall("wudao", cost.wudao);
  resources.spendStone(cost.stone);
  inventory.levelUpArtifact(defId);
  notify(`「${def.name}」炼化精进`, "success");
  return true;
}
