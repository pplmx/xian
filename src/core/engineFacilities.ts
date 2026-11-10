/**
 * 设施(洞府建筑)对库的接入 —— 内容(`data/buildings`)与口径仍住在本作,库只给骨架。
 *
 * 搬过来的是三件容易写歪的事:
 *   · **能不能升**:门槛不止一条(境界 / 已至顶层 / 受洞府等级所限),而判定的先后
 *     就是界面上先出现哪句话 —— 顺序与文案仍写在下面(内容),库只保证"能升"与
 *     "要花什么"出自同一次判定;
 *   · **等级上限取小**:自身上限与 `(洞府等级 + 1) × 每级抬升` 取小,且只封升级、不改已有等级;
 *   · **每小时产出**:速率写在这里的 `perHour`(灵田、藏经阁),零头怎么留、什么时候进位
 *     由库的 `accrue` 管 —— 一秒一次取整会把 1.5 悟道点/小时、2.4 玄铁/小时全部抹平。
 */
import type { BuildingId, GNum, StatMods } from "@/types";
import type { UpgradeInfo } from "wanxiang-engine";
import { accrue, createFacilitySystem } from "wanxiang-engine";
import { BUILDINGS, buildingDef, libraryWudaoPerHour } from "@/data/buildings";
import {
  BUILDING_LEVELS_PER_MANSION,
  FIELD_HERB_PER_HOUR,
  FIELD_ORE_PER_HOUR,
} from "@/data/constants";
import { RESOURCE_LABELS } from "@/data/resourceNames";
import { realmDef } from "@/data/realms";
import { buildingCost } from "./formulas";

/** 藏经阁每小时悟道点的唯一实现住在 data/buildings(卡片文案与产出同源) —— 此处转发,调用方零改动 */
export { libraryWudaoPerHour };

export interface FacilityCtx {
  /** 玩家当前境界 —— 只有"境界门槛"用得上它 */
  major: number;
}

/**
 * 建筑效果与产出都与境界无关,故这两条读法不需要门槛信息。
 * 若哪天某座建筑的产出要看境界,得把 `major` 一路传进来(别让它悄悄算成 0)。
 */
const CTX_NO_REALM: FacilityCtx = { major: 0 };

/**
 * 其余建筑的等级上限 = (洞府等级 + 1) × 每级抬升 —— 只写一处。
 *
 * 每级抬升的数值住在 `data/constants`(`BUILDING_LEVELS_PER_MANSION`)而不是这里:
 * 洞府卡面要印「其余建筑等级上限 +N/级」,而 data 层不许反过来 import core
 * (见 `layeringAudit.spec` 的分层纪律)。数值在 data、换算在 core,
 * 卡面与判定读的是同一枚常数 —— 改常数,两边一起变。
 */
export function buildingLevelCapOf(mansionLevel: number): number {
  return (mansionLevel + 1) * BUILDING_LEVELS_PER_MANSION;
}

/** 这一座的等级上限(洞府自己不受"由洞府决定"的那条限制) */
export function capOfBuilding(id: BuildingId, levels: Record<string, number>): number {
  const def = buildingDef(id);
  if (!def) return 0;
  if (def.id === "mansion") return def.maxLevel;
  return Math.min(def.maxLevel, buildingLevelCapOf(levels.mansion ?? 0));
}

/**
 * 被洞府档住时,「还差多少」的那一笔账 —— 洞府要升到几级才放开这一次升级。
 *
 * 界面上原本只有一句「受洞府等级所限」:它说清了原因,却**答不了下一步**。
 * 玩家卡在这里手上有灵石也升不动,而这一句里没有「升哪一座、还差几级」。
 * 按 AGENTS 的「决策信息完整」,置灰的同时要把差多少列出来 —— 资源不足那一档
 * 早就这么做了(「尚差 X 石」),洞府辖限这一档漏着。
 *
 * 只回答**升到几级洞府**这一件事,不回答洞府自己升不升得动(那是另一行的判定);
 * 也不含「够不够钱」—— 调用方各自叠加,免得两个口径混成一句。
 *
 * 洞府已至顶层仍被档住时返回 null:这一档在本作的口径里不该出现
 * (洞府 4 级 → 其余上限 25 级,高于任何一座自身上限),真出现了也不编一个
 * 不可能达到的级数 —— 宁可不说话,不给假路标。
 */
export function mansionShortfallOf(
  id: BuildingId,
  levels: Record<string, number>,
): { mansionLevel: number; needMansionLevel: number } | null {
  const def = buildingDef(id);
  if (!def || def.id === "mansion") return null;
  const level = Math.max(0, Math.floor(levels[id] ?? 0));
  if (level >= def.maxLevel) return null; // 自身已至顶,不关洞府的事
  const mansion = Math.max(0, Math.floor(levels.mansion ?? 0));
  if (buildingLevelCapOf(mansion) > level) return null; // 没被档住
  /*
   * 要升的这一次是 level → level+1:洞府上限必须**严格大于** level,
   * 即 (m+1) × N > level。解出最小的 m。用 `Math.floor(level / N)` 而不是
   * 逐个试:两者等价(都让整除边界落到下一级),但一次除法少一处循环。
   */
  const needMansionLevel = Math.floor(level / BUILDING_LEVELS_PER_MANSION);
  if (needMansionLevel > (buildingDef("mansion")?.maxLevel ?? Infinity)) return null;
  return { mansionLevel: mansion, needMansionLevel };
}

/**
 * 整座洞府是否已尽善:七座建筑俱已至顶 —— 洞府(枢纽)自己也要在顶档。
 * 判据与卡面的「N/M 级」同源(逐座比 capOfBuilding 的同一个 cap),不另起一套数法。
 */
export function allDongfuMaxed(levels: Record<string, number>): boolean {
  return BUILDINGS.every((b) => (levels[b.id] ?? 0) >= capOfBuilding(b.id, levels));
}

/** 每小时的产出:内容写"每小时多少",库负责按秒推进与留零头 */
const PER_HOUR: Partial<Record<BuildingId, (level: number) => Record<string, number>>> = {
  field: (lv) => ({ herb: lv * FIELD_HERB_PER_HOUR, ore: lv * FIELD_ORE_PER_HOUR }),
  library: (lv) => ({ wudao: libraryWudaoPerHour(lv) }),
};

const FACILITIES = createFacilitySystem<StatMods, FacilityCtx, GNum | number>({
  facilities: BUILDINGS.map((def) => {
    const perHour = PER_HOUR[def.id];
    return {
      id: def.id,
      name: def.name,
      maxLevel: def.maxLevel,
      cap: (levels) => capOfBuilding(def.id, levels),
      capReason: "受洞府等级所限",
      // 顺序即界面的说法:先报"境界不够",再报"已至顶层"(与迁移前同一顺序)
      blocked: (_levels, level, ctx) =>
        ctx.major < def.unlockRealm
          ? `需 ${realmDef(def.unlockRealm).name} 境`
          : level >= def.maxLevel
            ? "已至顶层"
            : undefined,
      costs: (level) => {
        const costs: Array<{ key: "stone" | "ore"; amount: number | GNum }> = [
          { key: "stone", amount: buildingCost(def.costBase, level) },
        ];
        // 快赢·首级免玄铁(ISS-303):从 0 级升 1 级不掏玄铁。
        // 玄铁在 0~2 境是前期唯一卡建筑的资源(ratio≈0.3),首级豁免
        // 让玩家先把门面立起来,又不改 3 境后的曲线(那里玄铁本就过剩)。
        if (level > 0) costs.push({ key: "ore", amount: def.costOre * (level + 1) });
        return costs;
      },
      ...(def.mods ? { mods: (level: number) => def.mods!(level) } : {}),
      ...(perHour ? { perHour } : {}),
    };
  }),
});

/** "能不能升、为什么、下一级是几级、要花什么" —— 费用键仍是本作的两个(灵石 / 玄铁) */
export function buildingUpgradeInfoOf(
  id: BuildingId,
  levels: Record<string, number>,
  major: number,
): UpgradeInfo<GNum | number> {
  return FACILITIES.upgradeInfo(levels, id, { major });
}

/** 建筑带来的属性来源(顺序即 BUILDINGS 顺序)—— 喂给本作的属性汇总 */
export function buildingModSources(levels: Record<string, number>): StatMods[] {
  return FACILITIES.modsOf(levels, CTX_NO_REALM);
}

/** 各建筑合计的每小时产出 */
export function buildingRates(levels: Record<string, number>): Record<string, number> {
  return FACILITIES.ratesOf(levels, CTX_NO_REALM);
}

/** 会按小时产出的三种资源(顺序即展示顺序);名称走 RESOURCE_LABELS,不另起一套 */
const HOUR_STREAMS = ["herb", "ore", "wudao"] as const;
/** 灵田/玄铁用「株/块」,与 BuildingLedgerRow 的 effectText 同字(悟道点不嵌单位) */
const HOUR_UNIT: Partial<Record<string, string>> = { herb: "株", ore: "块" };

/**
 * 「每时藏收」的中文条目(buildingRates 同源,不手写会被常数改动的数字):
 * 只列真有产出的流,零流不上行。物理量与名字都引单一来源 —— 算出来的正是
 * 结算(离线/实时 accrue)实际发的那些。
 */
export function hourlyYieldText(levels: Record<string, number>): string[] {
  const rates = buildingRates(levels);
  const parts: string[] = [];
  for (const key of HOUR_STREAMS) {
    const v = rates[key] ?? 0;
    if (v <= 0) continue;
    const num = (Math.round(v * 10) / 10).toString().replace(/\.0$/, "");
    const unit = HOUR_UNIT[key] ?? "";
    parts.push(`${RESOURCE_LABELS[key]} ${num}${unit ? ` ${unit}` : ""}`);
  }
  return parts;
}

/** 按秒推进产出:速率来自建筑等级,零头留在累加器里(见库的 `accrue`) */
export function produceOf(
  frac: Readonly<Record<string, number>>,
  levels: Record<string, number>,
  sec: number,
): ReturnType<typeof accrue> {
  return accrue(frac, buildingRates(levels), sec);
}
