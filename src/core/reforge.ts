/**
 * 装备重铸与词条封存
 *
 * 灵石的长期 sink,直接连接 Build:
 * - **重铸**:把**未封存**的词条推倒重来 —— 条数按品质区间重掷(至少给一条新的),
 *   数值全部重掷;品质、阶数、强化等级都不动。**不限次数**。
 * - **封存**:付费永久锁定一个词条,重铸不会碰它;每一件至少留一个可重掷位。
 *
 * 成本只与**装备阶数**和**封存数**挂钩(见 data/constants 的注释):
 * 想保住好词条就得付溢价 —— 「洗得越多越贵」由「你保护了多少」表达,
 * 而不是由一个与装备无关的次数计数器表达。
 *
 * 原则:不为消耗而消耗——每一笔花销都在改变构筑,而非购买数值。
 */
import type { AffixDef, EquipmentInstance, GNum } from "@/types";
import { add, gnZero } from "@/utils/gnum";
import { rng } from "@/utils/random";
import { AFFIXES, affixDef } from "@/data/affixes";
import { equipmentTemplate } from "@/data/equipment";
import { qualityDef } from "@/data/qualities";
import {
  BLUEPRINT_MASTERY_PER_REFORGE,
  BLUEPRINT_ROLL_BONUS_MAX,
  INSCRIBE_ROLL_FLOOR_MAX,
  REFORGE_DUST_BASE,
  REFORGE_ROLL_FLOOR_CAP,
  REFORGE_SEAL_LOAD,
  REFORGE_STONE_BASE,
  SEAL_STONE_BASE,
} from "@/data/constants";
import { stoneByTier } from "./formulas";
import { noteSmithingUsed, studyBlueprint } from "./loreService";
import { track } from "./progress";
import { ENGINE_WORLD } from "./engineWorld";
import { useInventoryStore } from "@/stores/inventory";
import { useLoreStore } from "@/stores/lore";
import { useResourcesStore } from "@/stores/resources";
import { notify } from "./notify";
import { formatPercent } from "@/utils/format";

export interface ReforgeCost {
  stone: GNum;
  dust: number;
}

/**
 * 铭纹给**新词条**的掷点下限:0~30%,随熟练度线性抬高。
 *
 * 只兜底,不改抽取池:铭纹高只保证洗出来的东西不总是谷底,不能凭空指定词条。
 * 30% 封顶是因为掷点仍要留出大头随机空间 —— 若保底再高,"洗练"会从赌搭配
 * 退化成按次数领固定数值。合法熟练度本就落在 0~100;非法值一律按尚未入门处理,
 * 不许把 NaN 漏进装备词条。
 */
export function inscribeRollFloor(level: number): number {
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(1, level / 100)) * INSCRIBE_ROLL_FLOOR_MAX;
}

/**
 * 器谱给**当前装备模板**新词条的掷点保底。
 *
 * 器谱是逐模板的深耕:常洗一把剑,不会因此看懂别的刀。它给的是额外保底,
 * 与全局铭纹相加,但两者合计仍有上限 —— 否则反复洗同一件就能把随机掷点
 * 推到必然高值,重铸会从搭配赌局退化成固定领数。
 */
export function blueprintRollBonus(mastery: number): number {
  if (!Number.isFinite(mastery)) return 0;
  return Math.max(0, Math.min(1, mastery)) * BLUEPRINT_ROLL_BONUS_MAX;
}

/** 重铸新词条实际吃的掷点保底 = 铭纹 + 当前模板器谱(封顶) */
export function effectiveReforgeRollFloor(inscribeLevel: number, blueprintMastery: number): number {
  return Math.min(
    REFORGE_ROLL_FLOOR_CAP,
    inscribeRollFloor(inscribeLevel) + blueprintRollBonus(blueprintMastery),
  );
}

/**
 * 重铸成本:灵石 = stoneByTier(阶数) × (1 + 封存数 × REFORGE_SEAL_LOAD);
 * 器灵尘 = REFORGE_DUST_BASE × (1 + 封存数)。
 *
 * 没有次数项,也没有上限:同一件、同一封存数,第一次与第两百次一个价。
 * 无可重铸余地(全封存)时返回 null —— 这是唯一的"不能再炼"。
 */
export function reforgeCost(inst: EquipmentInstance): ReforgeCost | null {
  // 「无可重掷」仅指"确有词条且全封存";0 词条的凡品(quality affixes 允许掷 0 条)
  // 不是不能再炼 —— 重铸的意义正是让它从零出词条。若此处对空词条返回 null,
  // 这件就永远没法获得任何词条了。
  if (inst.affixes.length > 0 && reforgeableAffixIds(inst).length === 0) return null;
  const sealed = (inst.sealedAffixIds ?? []).length;
  const load = 1 + sealed * REFORGE_SEAL_LOAD;
  return {
    stone: stoneByTier(inst.tier, REFORGE_STONE_BASE * load),
    dust: Math.round(REFORGE_DUST_BASE * load),
  };
}

/** 可被重铸(未封存)的词条 id 列表 */
export function reforgeableAffixIds(inst: EquipmentInstance): string[] {
  const sealed = new Set(inst.sealedAffixIds ?? []);
  return inst.affixes.map((a) => a.id).filter((id) => !sealed.has(id));
}

/**
 * 重铸**新词条**可抽池 —— 与引擎 `equipment.rerollAffixes` 的筛法同口径:
 * 部位匹配、品质门槛通过,且排除封存项。当前未封存的旧词条会先被丢弃,
 * 但同一个 id 仍可能重新抽到,所以它们不排除。
 */
export function reforgeAffixPool(inst: EquipmentInstance): AffixDef[] {
  const template = equipmentTemplate(inst.templateId);
  const quality = qualityDef(inst.quality);
  if (!template || !quality) return [];
  const sealed = new Set(inst.sealedAffixIds ?? []);
  return AFFIXES.filter(
    (a) =>
      !sealed.has(a.id) &&
      (a.slots === undefined || a.slots.includes(template.slot)) &&
      (a.minRank === undefined || quality.rank >= a.minRank),
  );
}

/**
 * 一件装备还能封存几个词条 —— 至少要留一个可重掷位。
 * 判据与界面共用这一处,免得两边各算一遍(封存上限变了,有一边忘了跟)。
 */
export function sealCapacity(inst: EquipmentInstance): number {
  return Math.max(0, inst.affixes.length - 1);
}

/**
 * 重铸:把未封存的词条全部推倒重来。
 *
 * 「重铸」此前是**换掉一条**词条,条数不动 —— 而一件 3 条的凡品与一件 6 条的神品,
 * 差的从来不只是数值,是**能凑出几种搭配**。所以重铸要连条数一起重掷:
 *   新条数 = 品质区间内随机,但不少于「封存数 + 1」(每次重铸都至少给你一条新的);
 *   封存的原样留着,其余全部换成新词条、新掷点。
 * 品质、阶数、强化等级一概不动 —— 重铸的是一件的「词条构成」,不是它的出身。
 */
export function reforgeEquipment(uid: string, quiet = false): boolean {
  const inventory = useInventoryStore();
  const resources = useResourcesStore();
  const inst = inventory.findItem(uid);
  if (!inst) return false;
  const cost = reforgeCost(inst);
  if (!cost) {
    if (!quiet) notify("此物已无重铸余地", "warn");
    return false;
  }
  if (!resources.hasStone(cost.stone) || !resources.hasSmall("dust", cost.dust)) {
    if (!quiet) notify("灵石或器灵尘不足", "warn");
    return false;
  }

  resources.spendStone(cost.stone);
  resources.spendSmall("dust", cost.dust);

  /*
   * 重掷本身交给库(见 packages/engine 的 equipment.rerollAffixes)——
   * 池子怎么筛、权重怎么算、条数从哪来,与"掉出来的时候"共用同一处实现,
   * 免得"掉出来的"与"洗出来的"有两套口径。
   * 封存(sealedAffixIds)是本作的字段,这里翻译成库的 `keep`。
   */
  const template = equipmentTemplate(inst.templateId);
  const sealed = inst.sealedAffixIds ?? [];
  const kept = inst.affixes.filter((a) => sealed.includes(a.id));
  const lore = useLoreStore();
  const blueprintBefore = lore.blueprintMastery(inst.templateId);
  const rollFloor = effectiveReforgeRollFloor(lore.skillLevel("inscribe"), blueprintBefore);
  const affixes = ENGINE_WORLD.equipment
    .rerollAffixes(inst.affixes, {
      rng,
      quality: qualityDef(inst.quality),
      tier: inst.tier,
      slot: template?.slot,
      keep: sealed,
    })
    // 封存项保持原对象与原掷点;新词条只抬下限,不额外消耗随机源。
    .map((affix) =>
      sealed.includes(affix.id) ? affix : { ...affix, roll: Math.max(affix.roll, rollFloor) },
    );
  const before = inst.affixes.length;
  const sealedNote = kept.length > 0 ? `(封存 ${kept.length} 条未动)` : "";
  const countNote =
    before === affixes.length ? `${affixes.length} 条` : `${before} → ${affixes.length} 条`;

  inventory.replaceItem({ ...inst, affixes, reforgeCount: (inst.reforgeCount ?? 0) + 1 });
  track("upgrades");
  // 重铸也是炼器:每次上手一味矿材,矿石通晓与锻造技艺照常推进(见 noteSmithingUsed)
  noteSmithingUsed(inst.tier, true);
  // 重铸更是刻纹 —— 铭纹技艺此前定义了却从没人涨过(玩家反馈「铭纹熟练度老版本为0,
  // 新版本没看到新系统」),真正「刻纹引灵」的活儿就该长这门手艺
  lore.addSkillExp("inscribe", 10 * (1 + inst.tier * 0.2));
  // 成功重铸也是照着这张器谱走了一遍:同模板的掌握度只增不减
  const blueprintAfter = studyBlueprint(inst.templateId, BLUEPRINT_MASTERY_PER_REFORGE);

  if (!quiet) {
    const blueprintNote =
      blueprintBefore < 1 && blueprintAfter >= 1
        ? ` · 「${template?.name ?? "此器"}」器谱已读通`
        : ` · 器谱 ${formatPercent(blueprintAfter, 0)}`;
    notify(`重铸而成:词条 ${countNote}${sealedNote}${blueprintNote}`, "success");
  }
  return true;
}

/** 封存成本:第 n 次封存 = 基础 × n(灵石按装备层级换算) */
export function sealCost(inst: EquipmentInstance): GNum | null {
  const sealed = inst.sealedAffixIds ?? [];
  // 至少留一个可随机位,封满则不可再封
  if (sealed.length >= sealCapacity(inst)) return null;
  return stoneByTier(inst.tier, SEAL_STONE_BASE * (sealed.length + 1));
}

/** 封存一个词条:重铸永不替换之 */
export function sealAffix(uid: string, affixId: string): boolean {
  const inventory = useInventoryStore();
  const resources = useResourcesStore();
  const inst = inventory.findItem(uid);
  if (!inst) return false;
  if (!inst.affixes.some((a) => a.id === affixId)) return false;
  if ((inst.sealedAffixIds ?? []).includes(affixId)) return false;
  const cost = sealCost(inst);
  if (!cost) {
    notify("至少须留一个词条随天意流转", "warn");
    return false;
  }
  if (!resources.hasStone(cost)) {
    notify("灵石不足", "warn");
    return false;
  }
  resources.spendStone(cost);
  inventory.replaceItem({ ...inst, sealedAffixIds: [...(inst.sealedAffixIds ?? []), affixId] });
  const name = affixDef(affixId)?.name ?? "词条";
  notify(`「${name}」已封存,重铸不移`, "success");
  return true;
}

/**
 * 解除封存(解锁):把 affixId 从 sealedAffixIds 移除,该词条重回可重掷位。
 *
 * 解锁语义判断:锁是花过的沉没成本 —— 封存付费时已结清,解开只是**放弃对这条槽位的
 * 保护**(它从此又能被重铸洗掉),既不收费也不退款。就是「降低保护」的反向操作,
 * 与封存共用同一份 sealedAffixIds 事实源,不另写一套账。
 * 该词条本就未封存时 no-op(返回 false,不动实例)。
 * 不触碰「至少留一可重掷位」的封存上限:那是封存侧加封时的校验,解锁只会减封存,
 * 天然不违反上限、也无需在这里重算成本。
 */
export function unsealAffix(uid: string, affixId: string): boolean {
  const inventory = useInventoryStore();
  const inst = inventory.findItem(uid);
  if (!inst) return false;
  const sealed = inst.sealedAffixIds ?? [];
  if (!sealed.includes(affixId)) return false;
  inventory.replaceItem({ ...inst, sealedAffixIds: sealed.filter((id) => id !== affixId) });
  const name = affixDef(affixId)?.name ?? "词条";
  notify(`「${name}」已解除封存,回到可重掷位`, "success");
  return true;
}

// ---------- 自动重铸(玩家反馈:一键重铸多次,洗到指定词条就停) ----------

/** 自动重铸的停止条件:出现「id 命中且 roll ≥ minRoll(未给则任意值)」即收手 */
export interface ReforgeTarget {
  affixId: string;
  /** 要求的最低 roll(0~1;不填 = 只要出现这个词条就行) */
  minRoll?: number;
}

/** 这件装备当前是否命中任一目标;命中返回那一条 */
export function refRoleMatches(
  inst: EquipmentInstance,
  targets: readonly ReforgeTarget[],
): { id: string; roll: number } | null {
  for (const t of targets) {
    const hit = inst.affixes.find(
      (a) => a.id === t.affixId && (t.minRoll === undefined || a.roll >= t.minRoll),
    );
    if (hit) return { id: hit.id, roll: hit.roll };
  }
  return null;
}

export type AutoReforgeStop = "target" | "budget" | "broke" | "frozen" | "unreachable";

export interface AutoReforgeOutcome {
  /** 实际洗了几次 */
  rolls: number;
  /** 这几次的灵石账 */
  stone: GNum;
  /** 这几次的器灵尘账 */
  dust: number;
  stop: AutoReforgeStop;
  /** 命中目标的那一条(null = 没洗到,撞了预算/没钱/无位可洗/目标不可达) */
  hit: { id: string; roll: number } | null;
  /** 收手时这件装备的词条 id 全表 */
  affixIds: string[];
}

/**
 * 自动重铸:至多重铸 maxRolls 次,洗出任一目标词条(可带最低 roll)即停。
 * 逐次与手动连点完全等价 —— 每洗一次照常消耗与长技艺,只是提示合成一条。
 * 停法:
 * - target  洗出目标,收手;
 * - budget  洗满预算也没出,收手(不硬刷);
 * - broke   灵石/器灵尘见底,收手;
 * - frozen  这件已无位可洗(全封存)或已不存在;
 * - unreachable 目标被封存/不在池里,或要求 100% 掷点,原则上永远撞不上。
 */
export function autoReforge(
  uid: string,
  targets: readonly ReforgeTarget[],
  maxRolls: number,
): AutoReforgeOutcome {
  const inventory = useInventoryStore();
  const resources = useResourcesStore();
  let stone = gnZero();
  let dust = 0;
  // 一个目标都没给:收手,不烧预算 —— 面板上按钮禁用只是挡层,服务本身不当
  if (targets.length === 0) {
    return { rolls: 0, stone, dust, stop: "budget", hit: null, affixIds: [] };
  }
  // 装备已含目标词条:分文不动,直接收手 —— 别花一次重铸把已到手的条件洗没
  const initial = inventory.findItem(uid);
  if (initial) {
    const hit = refRoleMatches(initial, targets);
    if (hit)
      return {
        rolls: 0,
        stone,
        dust,
        stop: "target",
        hit,
        affixIds: initial.affixes.map((a) => a.id),
      };
    const freshIds = new Set(reforgeAffixPool(initial).map((a) => a.id));
    const canHit = targets.some(
      (target) => freshIds.has(target.affixId) && (target.minRoll ?? 0) < 1,
    );
    if (!canHit) {
      return {
        rolls: 0,
        stone,
        dust,
        stop: "unreachable",
        hit: null,
        affixIds: initial.affixes.map((a) => a.id),
      };
    }
  }
  for (let i = 0; i < maxRolls; i += 1) {
    const inst = inventory.findItem(uid);
    const cost = inst && reforgeCost(inst);
    if (!inst || !cost) return { rolls: i, stone, dust, stop: "frozen", hit: null, affixIds: [] };
    if (!resources.hasStone(cost.stone) || !resources.hasSmall("dust", cost.dust)) {
      return {
        rolls: i,
        stone,
        dust,
        stop: "broke",
        hit: null,
        affixIds: inst.affixes.map((a) => a.id),
      };
    }
    if (!reforgeEquipment(uid, true)) {
      return {
        rolls: i,
        stone,
        dust,
        stop: "frozen",
        hit: null,
        affixIds: inst.affixes.map((a) => a.id),
      };
    }
    stone = add(stone, cost.stone);
    dust += cost.dust;
    const after = inventory.findItem(uid);
    if (!after) return { rolls: i + 1, stone, dust, stop: "frozen", hit: null, affixIds: [] };
    const hit = refRoleMatches(after, targets);
    if (hit)
      return {
        rolls: i + 1,
        stone,
        dust,
        stop: "target",
        hit,
        affixIds: after.affixes.map((a) => a.id),
      };
  }
  const last = inventory.findItem(uid);
  return {
    rolls: maxRolls,
    stone,
    dust,
    stop: "budget",
    hit: null,
    affixIds: last ? last.affixes.map((a) => a.id) : [],
  };
}

export interface ReforgeOddsOptions {
  /** 玩家要求的最低掷点(0~1);不给 = 只求这条词条出现 */
  minRoll?: number;
  /** 当前铭纹给新词条的掷点下限(0~1),会把低于它的门槛直接盖过去 */
  rollFloor?: number;
}

/**
 * 洗到指定词条(并达到最低掷点)的平均重铸次数 —— 「约 N 次」读数用。
 *
 * 条数按品质区间均匀重掷;封存项占掉的名额不参与重掷,故计算的是实际补几个新词条。
 * 每次从**真实新词条池**里按权重抽 k 条。
 * 目标命中率 ≈ k × 目标权重 / 池总权重 × 掷点过线率。
 * 掷点过线率读当前铭纹保底:门槛低于保底时必过;高于保底时仍是原始均匀掷点
 * 直接过线(引擎取 max(掷点, 保底),不是把剩余区间重新铺满)。
 *
 * 只给次数、不给概率:概率会被后续平衡调整打脸,次数是玩家真正在算的东西。
 * 结果下限 1 —— 「不到一次」不存在。
 */
export function expectedReforgesFor(
  inst: EquipmentInstance,
  affixId: string,
  odds: ReforgeOddsOptions = {},
): number | null {
  const pool = reforgeAffixPool(inst);
  const target = pool.find((a) => a.id === affixId);
  if (!target) return null;
  const band = qualityDef(inst.quality)?.affixes;
  if (!band || band.length < 2) return null;
  const sealed = new Set(inst.sealedAffixIds ?? []);
  const kept = inst.affixes.filter((a) => sealed.has(a.id)).length;
  const minCount = Math.max(0, Math.floor(band[0]!));
  const maxCount = Math.max(minCount, Math.floor(band[1]!));
  let draws = 0;
  for (let count = minCount; count <= maxCount; count += 1) {
    draws += Math.max(1, count - kept);
  }
  draws /= maxCount - minCount + 1;
  if (!(draws > 0)) return null;
  const totalWeight = pool.reduce((sum, a) => sum + Math.max(0, a.weight), 0);
  if (!(totalWeight > 0) || !(target.weight > 0)) return null;

  const rawMinRoll = odds.minRoll ?? 0;
  if (!Number.isFinite(rawMinRoll) || rawMinRoll >= 1) return null;
  const minRoll = Math.max(0, rawMinRoll);
  const rawFloor = odds.rollFloor ?? 0;
  const rollFloor = Number.isFinite(rawFloor) ? Math.max(0, Math.min(1, rawFloor)) : 0;
  const appearanceChance = Math.min(1, (draws * target.weight) / totalWeight);
  const rollChance = minRoll <= rollFloor ? 1 : 1 - minRoll;
  const hitChance = appearanceChance * rollChance;
  if (!(hitChance > 0)) return null;
  return Math.max(1, Math.round((1 / hitChance) * 10) / 10);
}
