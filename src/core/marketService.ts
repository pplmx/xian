/**
 * 坊市货架生成与定价 —— 拿 player 境界与 stoneByTier 现算,故在 core 层。
 *
 * 与掉落同源的纪律:装备的品质用引擎的掷骰(ENGINE_WORLD.equipment.rollQuality,
 * 与掉落同一把尺),价格全走 stoneByTier —— 不另立一套经济口径,
 * 免得坊市价格与掉落/强化/重铸对不上账。
 */
import type { EquipmentInstance, GNum } from "@/types";
import { gn, gnZero, mulN } from "@/utils/gnum";
import { stoneByTier } from "./formulas";
import { PILLS, pillDef } from "@/data/pills";
import { mulberry32, RandomService } from "@/utils/random";
import { generateEquipment } from "./equipGen";
import { qualityDef } from "@/data/qualities";
import { ENGINE_WORLD } from "./engineWorld";
import {
  MARKET_SLOTS,
  MARKET_REFRESH_SECONDS,
  MARKET_PILL_MARKUP,
  MARKET_MAT_STONE_UNITS,
  MARKET_MAT_COUNT,
  MARKET_EQUIP_STONE_BASE,
  MARKET_EQUIP_STONE_PER_RANK,
  MARKET_KIND_WEIGHTS,
  MARKET_CONSIGN_STONE_BASE,
  MARKET_CONSIGN_STONE_PER_RANK,
  MARKET_SELL_PILL_FACTOR,
  MARKET_SELL_MAT_STONE_UNITS,
  type MarketEquipSlot,
  type MarketKind,
  type MarketSlot,
  type MarketStock,
} from "@/data/market";

/** 现境界拿得到的可售丹药(须有炼制石耗才能定价)—— 坊市货架与悬赏募丹共用这一池 */
export function salePills(major: number): typeof PILLS {
  return PILLS.filter((p) => p.recipe?.stoneBase != null && p.minRealm <= major);
}

/** 一货架里骰一个此刻拿得到的门类(权重仅对可行门类生效) */
function pickKind(rng: RandomService, feasible: MarketKind[]): MarketKind {
  if (feasible.length === 1) return feasible[0]!;
  return rng.weighted(feasible, (k) => MARKET_KIND_WEIGHTS[k]);
}

/** 货架某格的确定性装备种子 —— 上货与预览/购买共用,保证同一件 */
function equipSeed(stockedAt: number, idx: number): number {
  return (Math.floor(stockedAt / 1000) * 31 + idx) >>> 0;
}

/**
 * 撞款重滚的种子步长。
 *
 * 相邻槽位的种子差恒为 1(idx 系数 31 只影响跨上货时刻),若直接把 idx+shift 当种子,
 * 2 号槽 shift=1 会与 3 号槽同种子 —— 两格摆出同一件,比撞款更糟。
 * 故偏移走独立大步长(质数,远大于槽位数),任何 (idx, shift) 组合都不会落进
 * 其他槽位无偏移的种子邻域。
 */
const SEED_SHIFT_STRIDE = 7919;

/** 第 shift 次重滚的装备种子 —— buildSlot 撞款时与 marketEquipInstance 共用这一支 */
function equipSeedShifted(stockedAt: number, idx: number, shift: number): number {
  return (equipSeed(stockedAt, idx) + shift * SEED_SHIFT_STRIDE) >>> 0;
}

function buildSlot(
  kind: MarketKind,
  idx: number,
  major: number,
  rng: RandomService,
  usedPills: Set<string>,
  usedEquipKeys: Set<string>,
  now: number,
): MarketSlot {
  if (kind === "pill") {
    const pool = salePills(major).filter((p) => !usedPills.has(p.id));
    const def = (pool.length > 0 ? rng.pick(pool) : salePills(major)[0])!;
    usedPills.add(def.id);
    return {
      kind: "pill",
      idx,
      pillId: def.id,
      count: 1,
      price: mulN(gn(def.recipe!.stoneBase), MARKET_PILL_MARKUP),
      sold: false,
    };
  }
  if (kind === "material") {
    const matId: "herb" | "ore" = rng.chance(0.5) ? "herb" : "ore";
    return {
      kind: "material",
      idx,
      matId,
      count: MARKET_MAT_COUNT,
      price: mulN(stoneByTier(major, MARKET_MAT_STONE_UNITS), MARKET_MAT_COUNT),
      sold: false,
    };
  }
  const minQualityRank = ENGINE_WORLD.equipment.rollQuality(major, rng, { tier: major }).rank;
  // 按「预览即购得的同一件」的真实品质档标价 —— 若按品质下限标价、实际却滚得更高,
  // 「坊市买入 → 悬赏贡器」会因贡器按实档结算而套利。
  //
  // 同款去重:两槽独立随机抽到同一模板是正常概率,但货架摆两件同名同品的货,
  // 读起来像出了 bug。撞款则 shift+1 重滚;shift 写进 slot,预览/购买用同一公式
  // 再生同一件 —— 确定性同源不破。旧档 slot 无 seedShift → 视为 0 → 原公式。
  let seedShift = 0;
  let inst = generateEquipment(major, new RandomService(mulberry32(equipSeed(now, idx))), {
    minQualityRank,
  });
  const sameKey = (e: EquipmentInstance): string => `${e.templateId}:${e.quality}`;
  for (let tries = 0; tries < MARKET_SLOTS && usedEquipKeys.has(sameKey(inst)); tries += 1) {
    seedShift += 1;
    inst = generateEquipment(
      major,
      new RandomService(mulberry32(equipSeedShifted(now, idx, seedShift))),
      {
        minQualityRank,
      },
    );
  }
  usedEquipKeys.add(sameKey(inst));
  const rank = qualityDef(inst.quality).rank;
  return {
    kind: "equipment",
    idx,
    tier: major,
    minQualityRank,
    ...(seedShift > 0 ? { seedShift } : {}),
    price: stoneByTier(major, MARKET_EQUIP_STONE_BASE + rank * MARKET_EQUIP_STONE_PER_RANK),
    sold: false,
  };
}

/** 生成一整架新货;stockedAt 取调用时刻,装备再生以此为种子锚 */
export function generateMarketStock(major: number, rng: RandomService, now: number): MarketStock {
  const feasible: MarketKind[] = ["material", "equipment"];
  if (salePills(major).length > 0) feasible.unshift("pill");

  const usedPills = new Set<string>();
  const usedEquipKeys = new Set<string>();
  const slots: MarketSlot[] = [];
  for (let idx = 0; idx < MARKET_SLOTS; idx += 1) {
    slots.push(buildSlot(pickKind(rng, feasible), idx, major, rng, usedPills, usedEquipKeys, now));
  }
  return { goods: slots, stockedAt: now };
}

/** 货架里某件装备的确定性实例 —— 预览与购买同源同一物(uid 除外,不落库、不进渲染) */
export function marketEquipInstance(slot: MarketEquipSlot, stockedAt: number): EquipmentInstance {
  return generateEquipment(
    slot.tier,
    new RandomService(mulberry32(equipSeedShifted(stockedAt, slot.idx, slot.seedShift ?? 0))),
    { minQualityRank: slot.minQualityRank },
  );
}

/** 货架还剩多久刷新(秒);已过期返回 0 */
export function marketRemainingSec(stockedAt: number, now: number): number {
  return Math.max(0, stockedAt + MARKET_REFRESH_SECONDS * 1000 - now) / 1000;
}

/** 寄卖一件装备可得(恒低于坊市购入同档,无搬砖套利) */
export function consignPrice(tier: number, qualityRank: number): GNum {
  return stoneByTier(tier, MARKET_CONSIGN_STONE_BASE + qualityRank * MARKET_CONSIGN_STONE_PER_RANK);
}

/** 即时售一枚丹药可得(购入倍率 2.5,售出 1.2,双向不成环) */
export function pillSellPrice(pillId: string): GNum {
  const def = pillDef(pillId);
  return def && def.recipe?.stoneBase
    ? mulN(gn(def.recipe.stoneBase), MARKET_SELL_PILL_FACTOR)
    : gnZero();
}

/** 即时售一批材料(与货架同单位数)可得;每单位价低于购入 */
export function materialSellPrice(major: number): GNum {
  return mulN(stoneByTier(major, MARKET_SELL_MAT_STONE_UNITS), MARKET_MAT_COUNT);
}
