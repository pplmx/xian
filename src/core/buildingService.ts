/**
 * 洞府建筑服务 —— 升级
 */
import type { BuildingId, GNum } from "@/types";
import { buildingDef } from "@/data/buildings";
import { add, gnZero, gte, subClamp } from "@/utils/gnum";
import { formatGN } from "@/utils/format";
import { buildingUpgradeInfoOf } from "./engineFacilities";
import { track } from "./progress";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { useDongfuStore } from "@/stores/dongfu";
import { notify } from "./notify";

export interface BuildingUpgradePreview {
  /** 预览指向的下一级 */
  nextLevel: number;
  /**
   * 升级到 nextLevel 会变的那些效果行 —— 与卡面同读 effectText,只报会变的那部分,
   * 不抄第二份文案:字面不变的行走(如「炉子只管出丹多寡」)、尚未触发的档
   * (如每 3 级才涨的强化上限)都不该当成「增益」搬上来。
   */
  lines: string[];
  /** 首建(0→1):还没有当前效果,预览=整张下一级效果 */
  built: boolean;
}

/**
 * 升级/建造的「下一级会怎样」预览。卡面已显当前效果与代价,这里只补赢得什么:
 * 取 effectText(nextLevel) 与 effectText(level) 逐行比对,留下字面变掉的行 ——
 * 与 effectText 同一事实源,门槛、档位一致,不会出现「卡面印的出不去」。
 */
export function buildingUpgradePreview(id: BuildingId, level: number): BuildingUpgradePreview {
  const def = buildingDef(id)!;
  const next = level + 1;
  if (next > def.maxLevel) return { nextLevel: next, lines: [], built: level === 0 };
  const cur = level > 0 ? def.effectText(level) : [];
  const nxt = def.effectText(next);
  const lines = nxt.filter((line, i) => line !== cur[i]);
  return { nextLevel: next, lines, built: level === 0 };
}

export interface BuildingUpgradeInfo {
  canUpgrade: boolean;
  reason: string;
  stone: GNum;
  ore: number;
  nextLevel: number;
}

export function buildingUpgradeInfo(id: BuildingId): BuildingUpgradeInfo {
  const dongfu = useDongfuStore();
  const player = usePlayerStore();
  // 门槛、上限与费用出自库的同一次判定(core/engineFacilities 里是本作的顺序与文案)
  const info = buildingUpgradeInfoOf(id, dongfu.levels, player.major);
  const stone = (info.costs.find((c) => c.key === "stone")?.amount ?? gnZero()) as GNum;
  const ore = (info.costs.find((c) => c.key === "ore")?.amount ?? 0) as number;
  const nextLevel = info.nextLevel;
  // 付不起要先置灰、把差多少列出来(纪律:「付不起置灰 + 列差多少」)。
  // 境界/顶层/洞府辖限已由库的 info.can/reason 判定;这里只补资源这一层 ——
  // 石头不足写「尚差 X 石」,玄铁不足写「Y 铁」(两臂同用简称,与卡片按钮一致),
  // 双缺用「 · 」粘连成一句。
  // BuildingCard 按钮直显 reason,不再让玩家点下去才被弹一句宽泛 toast。
  if (info.can) {
    const resources = useResourcesStore();
    const stoneShort = gte(resources.spiritStone, stone)
      ? gnZero()
      : subClamp(stone, resources.spiritStone);
    const oreShort = Math.max(0, ore - resources.ore);
    if (stoneShort.m > 0 || oreShort > 0) {
      const parts: string[] = [];
      if (stoneShort.m > 0) parts.push(`尚差 ${formatGN(stoneShort)} 石`);
      if (oreShort > 0) parts.push(`${oreShort} 铁`);
      return { canUpgrade: false, reason: parts.join(" · "), stone, ore, nextLevel };
    }
  }
  return { canUpgrade: info.can, reason: info.reason, stone, ore, nextLevel };
}

export function upgradeBuilding(id: BuildingId): boolean {
  const dongfu = useDongfuStore();
  const resources = useResourcesStore();
  const def = buildingDef(id)!;
  const info = buildingUpgradeInfo(id);
  if (!info.canUpgrade) {
    notify(info.reason, "warn");
    return false;
  }
  if (!resources.hasStone(info.stone) || !resources.hasSmall("ore", info.ore)) {
    notify("灵石或玄铁不足", "warn");
    return false;
  }
  resources.spendStone(info.stone);
  resources.spendSmall("ore", info.ore);
  dongfu.setLevel(id, info.nextLevel);
  track("buildingUpgrades");
  notify(`${def.name}升至 ${info.nextLevel} 级`, "success");
  return true;
}

export interface BuildingUpgradeBatchResult {
  levelsGained: number;
  stone: GNum;
  ore: number;
}

/**
 * 连升 count 级(默认 5):一级级走与单升同一判定,到顶或料尽即止 ——
 * 账是逐级的那笔,只是合一条汇报。取有界批量而非「一口气到顶」:玄铁是全局共用
 * 的硬料,连升不该有机会把兜里的玄铁一把烧光(连炼×5 / 灵脉+5 同一种有界手感)。
 */
export function buildingUpgradeN(id: BuildingId, count = 5): BuildingUpgradeBatchResult {
  const dongfu = useDongfuStore();
  const resources = useResourcesStore();
  const def = buildingDef(id)!;
  let levelsGained = 0;
  let stone = gnZero();
  let ore = 0;
  while (levelsGained < count) {
    const info = buildingUpgradeInfo(id);
    if (!info.canUpgrade) break;
    // 双闸:buildingUpgradeInfo 已把资源差算进 canUpgrade,这里再兜一道(中途见底也停)
    if (!resources.hasStone(info.stone) || !resources.hasSmall("ore", info.ore)) break;
    resources.spendStone(info.stone);
    resources.spendSmall("ore", info.ore);
    const from = dongfu.levels[id] ?? 0;
    dongfu.setLevel(id, info.nextLevel);
    levelsGained += (dongfu.levels[id] ?? 0) - from;
    stone = add(stone, info.stone);
    ore += info.ore;
  }
  if (levelsGained > 0) {
    // 连升一批升了几级就计几笔 —— 与逐级的 upgradeBuilding 每级 track 同口径,
    // 否则「累计升级建筑 N 次/成就」被连升按钮系统性拖慢(升 5 级只算 1 次)。
    track("buildingUpgrades", levelsGained);
    const parts = [`${def.name}连升 ${levelsGained} 级 → ${dongfu.levels[id] ?? 0} 级`];
    parts.push(`${formatGN(stone)} 石`);
    if (ore > 0) parts.push(`${ore} 铁`);
    notify(parts.join(" · "), "success");
  } else {
    notify(buildingUpgradeInfo(id).reason || "无法升级", "warn");
  }
  return { levelsGained, stone, ore };
}
