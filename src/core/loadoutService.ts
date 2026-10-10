/**
 * 构筑服务 —— 捕获当前整套 Build / 一键切换
 */
import type { EquipSlot, Loadout } from "@/types";
import { uid } from "@/utils/id";
import { equipmentTemplate } from "@/data/equipment";
import { artifactSlotsFor } from "@/data/artifacts";
import { artifactSlotBonus } from "./heritageEffects";
import { gongfaDef } from "@/data/gongfa";
import { usePlayerStore } from "@/stores/player";
import { useInventoryStore } from "@/stores/inventory";
import { useCultivationStore } from "@/stores/cultivation";
import { useDongfuStore } from "@/stores/dongfu";
import { useLoadoutsStore, MAX_LOADOUTS } from "@/stores/loadouts";
import { detectBuild } from "./buildDetect";
import { notify } from "./notify";

/** 保存当前构筑为快照 */
export function captureLoadout(name: string): Loadout | null {
  const inventory = useInventoryStore();
  const cultivation = useCultivationStore();
  const player = usePlayerStore();
  const loadouts = useLoadoutsStore();
  if (loadouts.list.length >= MAX_LOADOUTS) {
    notify(`构筑最多保存 ${MAX_LOADOUTS} 套,请先删去一套`, "warn");
    return null;
  }
  const detected = detectBuild(player.finalStats.mods);
  const loadout: Loadout = {
    id: uid(),
    name: name.trim().slice(0, 8) || detected?.style.name || "无名构筑",
    seal: detected?.style.seal ?? "道",
    mainGongfa: cultivation.mainGongfa,
    subGongfa: [...cultivation.subGongfa],
    artifactIds: [...inventory.equippedArtifacts],
    equipment: { ...inventory.equipped },
    savedAt: Date.now(),
  };
  loadouts.add(loadout);
  notify(`构筑「${loadout.name}」已存入行囊`, "success");
  return loadout;
}

/** 一键切换构筑;缺失的部件跳过并汇报 */
export function applyLoadout(id: string): boolean {
  const inventory = useInventoryStore();
  const cultivation = useCultivationStore();
  const dongfu = useDongfuStore();
  const player = usePlayerStore();
  const loadouts = useLoadoutsStore();
  const loadout = loadouts.list.find((l) => l.id === id);
  if (!loadout) return false;
  let missing = 0;

  // 装备
  for (const slot of Object.keys(loadout.equipment) as EquipSlot[]) {
    const itemUid = loadout.equipment[slot];
    if (!itemUid) continue;
    const item = inventory.findItem(itemUid);
    if (item && equipmentTemplate(item.templateId)?.slot === slot) {
      inventory.equip(itemUid, slot);
    } else {
      missing += 1;
      inventory.unequip(slot);
    }
  }
  // 功法
  if (
    loadout.mainGongfa &&
    cultivation.learned[loadout.mainGongfa] &&
    gongfaDef(loadout.mainGongfa)
  ) {
    cultivation.equipMain(loadout.mainGongfa);
  } else if (loadout.mainGongfa) {
    missing += 1;
  }
  const subCap = dongfu.subGongfaSlots;
  const learnedSubs = loadout.subGongfa.filter((g) => cultivation.learned[g]);
  // 缺失只算「没学/没了」:已习得但超装着上限的只是「装不下」,不是「缺失」——
  // 把超上限的也算成缺失,玩家会以为部件丢了。
  missing += loadout.subGongfa.length - learnedSubs.length;
  const subOverCap = Math.max(0, learnedSubs.length - subCap);
  cultivation.subGongfa = learnedSubs.slice(0, subCap);
  // 法宝
  const artifactCap =
    artifactSlotsFor(player.major) + artifactSlotBonus(player.reincarnation.heritage);
  const owned = new Set(inventory.artifacts.map((a) => a.defId));
  const ownedArts = loadout.artifactIds.filter((a) => owned.has(a));
  missing += loadout.artifactIds.length - ownedArts.length;
  const artOverCap = Math.max(0, ownedArts.length - artifactCap);
  inventory.equippedArtifacts = ownedArts.slice(0, artifactCap);

  const overCap = subOverCap + artOverCap;
  notify(
    missing > 0
      ? `已切换至「${loadout.name}」(${missing} 处部件缺失,已跳过${
          overCap > 0 ? `;另有 ${overCap} 处超装着上限未上` : ""
        })`
      : overCap > 0
        ? `已切换至「${loadout.name}」(${overCap} 处超装着上限未上)`
        : `已切换至「${loadout.name}」`,
    "success",
  );
  return true;
}

export function deleteLoadout(id: string): void {
  useLoadoutsStore().remove(id);
}
