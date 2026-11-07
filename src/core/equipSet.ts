/**
 * 装备共鸣(Phase 31.0 S5)
 *
 * 不是数值堆叠式的套装(2件+10%):同组多件触发**机制效果**,
 * 成为 Build 组件(如:铁壁 = 首次致命伤保留 1 点气血)。
 * 组内装备要求件数宽松(挂载中的同 set 件数 ≥2 即共鸣)。
 */
import type { EquipmentInstance, StatMods } from "@/types";
import type { EquipmentInstance as EngineEquipmentInstance } from "wanxiang-engine";
import { equipmentTemplate } from "@/data/equipment";
import type { EquipSetDef } from "@/data/equipSets";
import { equipSetDef } from "@/data/equipSets";
import { ENGINE_WORLD } from "./engineWorld";
import { toEngineInstance } from "./equipGen";

// 内容住在 data/equipSets(装配与查询都要读),这里原样转出,调用方不必改 import
export type { EquipSetDef } from "@/data/equipSets";
export { EQUIP_SETS, equipSetDef } from "@/data/equipSets";

/** astral 共鸣:开战时护盾 = 最大生命的 5%(并入快照盾 mod,共三层同一常量) */
export const ASTRAL_SET_SHIELD = 0.05;

/*
 * 后段三套的机制数值 —— 与 astral 同一套做法:并进快照 mods,由 combat 现成的
 * 读取点直接生效(不新开引擎接口)。
 *
 * 每一套必须是**独一份的机制**:此前五套只挂两个 hook,28 阶的神铠与 2 阶的铁壁
 * 是同一个「致命伤保命」,31 阶的混沌与 8 阶的星斗是同一个「开战 +5% 盾」——
 * 玩家越到后期凑齐一套越难,拿到的却和早期一模一样。判据见 equipSet.spec。
 */

/** sunder(仙甲,23 阶):开战即破敌一层护甲 —— 并入 armorPen,由 combat 的 mitigation 读 */
export const SUNDER_SET_ARMOR_PEN = 0.12;

/** thorns(神铠,28 阶):受击时反震 —— 并入反击率与反击威力,由 combat 的 strike 读 */
export const THORNS_SET_COUNTER_RATE = 0.15;
export const THORNS_SET_COUNTER_DAMAGE = 0.2;

/** primordial(混沌,31 阶):开战即凝一层本源盾 —— 并入 shieldOnStart + shieldPower */
export const PRIMORDIAL_SET_SHIELD = 0.1;
export const PRIMORDIAL_SET_SHIELD_POWER = 0.15;

/**
 * 生效中的共鸣 → 该并进快照的 mods。**单一出处**。
 *
 * 玩家快照(playerSnap)与换装推演(lab)都调它:两处各写一份就会漂 ——
 * 推演说这套能过、实战过不去,是最难查的那类账。astral 原先就是两处各写一遍,
 * 加后段三套时若不收拢,要同步的就不止一处。
 */
const SET_HOOK_MODS: Partial<Record<EquipSetDef["hook"], StatMods>> = {
  astral: { shieldOnStart: ASTRAL_SET_SHIELD },
  sunder: { armorPen: SUNDER_SET_ARMOR_PEN },
  thorns: { counterRate: THORNS_SET_COUNTER_RATE, counterDamage: THORNS_SET_COUNTER_DAMAGE },
  primordial: {
    shieldOnStart: PRIMORDIAL_SET_SHIELD,
    shieldPower: PRIMORDIAL_SET_SHIELD_POWER,
  },
};

/** 已装配件上生效的全部「并入型」共鸣 mods(铁壁是保命钩子，不走 mods) */
export function setHookMods(equipped: readonly EquipmentInstance[]): StatMods {
  const out: Record<string, number> = {};
  for (const [hook, mods] of Object.entries(SET_HOOK_MODS) as [
    EquipSetDef["hook"],
    StatMods | undefined,
  ][]) {
    if (!mods) continue;
    if (!hasActiveSet([...equipped], hook)) continue;
    // 同键相加:两套都给 shieldOnStart 时要叠加,不是后一套顶掉前一套
    const add = mods as Record<string, number | undefined>;
    for (const key of Object.keys(add)) {
      const v = add[key];
      if (v === undefined) continue;
      out[key] = (out[key] ?? 0) + v;
    }
  }
  return out as StatMods;
}

/**
 * 已装备件 → 库的装配输入(槽位 → uid + uid → 实例)。
 *
 * 「同组几件、哪些 hook 生效」这条规则由库的装备系统算
 * (见 ENGINE_WORLD.equipment.resolveLoadout);本文件只留**内容**:
 * 共鸣叫什么、机制文案是什么、hook 是哪一个。
 */
function loadoutOf(equipped: EquipmentInstance[]): {
  loadout: { equipped: Record<string, string | undefined> };
  byUid: Map<string, EngineEquipmentInstance>;
} {
  const byUid = new Map<string, EngineEquipmentInstance>(
    equipped.map((it) => [it.uid, toEngineInstance(it)]),
  );
  const slots: Record<string, string> = {};
  for (const it of equipped) {
    const tpl = equipmentTemplate(it.templateId);
    if (tpl) slots[tpl.slot] = it.uid;
  }
  return { loadout: { equipped: slots }, byUid };
}

/** 已装备件中,同 set 的件数统计 */
export function setCounts(equipped: EquipmentInstance[]): Map<string, number> {
  const { loadout, byUid } = loadoutOf(equipped);
  const stats = ENGINE_WORLD.equipment.resolveLoadout(loadout, byUid);
  return new Map(stats.sets.map((s) => [s.id, s.pieces]));
}

/** 当前激活的共鸣(件数达标)列表 */
export function activeSets(equipped: EquipmentInstance[]): EquipSetDef[] {
  const { loadout, byUid } = loadoutOf(equipped);
  const stats = ENGINE_WORLD.equipment.resolveLoadout(loadout, byUid);
  const out: EquipSetDef[] = [];
  for (const set of stats.sets) {
    const def = equipSetDef(set.id);
    // 库给出的 active 里带着生效的 hook;本作的共鸣定义恰好一条 hook,对上才算激活
    if (def && set.active.some((a) => a.hook === def.hook)) out.push(def);
  }
  return out;
}

/** 是否已激活指定机制(供战斗引擎查) */
export function hasActiveSet(equipped: EquipmentInstance[], hook: EquipSetDef["hook"]): boolean {
  return activeSets(equipped).some((s) => s.hook === hook);
}
