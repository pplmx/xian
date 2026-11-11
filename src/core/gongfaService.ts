/**
 * 功法服务 —— 参悟 / 习得 / 升级
 */
import { rng } from "@/utils/random";
import { GONGFA, GONGFA_TYPE_NAMES, gongfaDef } from "@/data/gongfa";
import { qualityDef } from "@/data/qualities";
import { COMPREHEND_PAGE_COST } from "@/data/constants";
import { GONGFA_SYSTEM } from "./engineWorld";
import { gongfaAffinity, rootElements } from "./linggenAffinity";
import { collect, isCollected, track } from "./progress";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { useCultivationStore } from "@/stores/cultivation";
import type { ElementId, GongfaDef } from "@/types";
import { useDongfuStore } from "@/stores/dongfu";
import { notify } from "./notify";

/**
 * 功法习得漏斗 —— 人物状态、图鉴与修习计数是同一笔获得事实。
 * 只有真正从「未习得」变为「已习得」时才记两本账,重复调用保持幂等。
 */
export function learnGongfa(id: string): boolean {
  if (!gongfaDef(id)) return false;
  const cultivation = useCultivationStore();
  if (!cultivation.learn(id)) return false;
  collect("gongfa", id);
  track("gongfaLearned");
  return true;
}

/**
 * 旧档补账:统一入口上线前,有些路径只写了 cultivation.learned。
 * 以「是否已录图鉴」为迁移标记,只补缺的一条并补一次计数;重复启动不再增加。
 */
export function syncLearnedGongfa(): number {
  const cultivation = useCultivationStore();
  let repaired = 0;
  for (const id of Object.keys(cultivation.learned)) {
    if (!gongfaDef(id) || isCollected("gongfa", id)) continue;
    collect("gongfa", id);
    track("gongfaLearned");
    repaired += 1;
  }
  return repaired;
}

/**
 * 随机习得一部功法(事件/掉落)。
 *
 * 返回**那一部**而不只是名字:调用方要靠它取品阶(提示条上的印)与其它事实,
 * 让调用方再去 `GONGFA.find(name)` 反查一遍就是第二本账 —— 名字不是主键。
 */
export function learnRandomGongfa(specificId?: string): GongfaDef | null {
  const player = usePlayerStore();
  const cultivation = useCultivationStore();
  if (specificId) {
    const def = gongfaDef(specificId);
    if (def && learnGongfa(specificId)) return def;
    return null;
  }
  const pool = GONGFA.filter((g) => g.minRealm <= player.major + 1 && !cultivation.learned[g.id]);
  if (pool.length === 0) return null;
  // Phase 32.2:同源功法更容易参悟到(倾向,非独占)——
  // 无对应灵根者权重仍为原值,任何功法都拿得到,只是撞见的概率不同。
  const elements = rootElements(player.linggen?.roots);
  /*
   * 权重再乘一个**就近因子** —— 只按品阶与灵根倾向加权是不够的。
   *
   * `pool` 只按 `minRealm <= major + 1` 过滤,境界 20 时全开(92 部全部可抽);
   * 而品阶权重让入门功法占优:实测境 20 时**低品阶合计 76.0%**,
   * 其中境界 0 的十九部入门功法独占 **56.8%** —— 玩家参悟十次,五六次撞见入门货。
   *
   * 法宝掉落 (`core/loot` 的 `artifactDropWeight`) 早就有同类机制:
   * 「越贴近当前层级越容易被抽中」,并且刻意用**加法**而不是指数衰减,
   * 免得把旧内容彻底关掉。这里照同一口径来。
   */
  const picked = rng.weighted(pool, (g) => gongfaDrawWeight(g, elements, player.major));
  return learnGongfa(picked.id) ? picked : null;
}

/**
 * 参悟功法时的抽取权重 —— 品阶降权 × 灵根倾向 × **就近因子**。
 *
 * ## 为什么需要「就近因子」
 *
 * 池子只按 `minRealm <= major + 1` 过滤,境界 20 时 92 部全部可抽;
 * 而只按品阶与灵根加权的话,入门功法会占掉大半:实测境 20 时
 * **低品阶合计 76.0%,其中境界 0 的十九部独占 56.8%** ——
 * 玩家参悟十次,五六次撞见入门货。
 *
 * 法宝掉落(`core/loot` 的 `artifactDropWeight`)早就有同类机制:
 * 「越贴近当前层级越容易被抽中」,用加法而非指数衰减,免得把旧内容彻底关掉。
 * 这里照同一口径。
 *
 * 参数 `窗口 12 / 强度 1.5` 是实测调出来的:
 *
 * ```text
 *          低品阶占比  境0功法占比
 *   原式     76.0%       56.8%
 *   W3 K1    71.5%       53.5%
 *   W12 K1.5 33.5%       25.1%
 * ```
 *
 * 低境界不受影响(境 5 仍是 86.7% 低品阶),因为那时大家的 minRealm 本来就接近。
 */
export function gongfaDrawWeight(
  def: GongfaDef,
  elements: readonly ElementId[],
  major: number,
): number {
  const qualityWeight = 100 / (1 + qualityDef(def.quality).rank * 1.5);
  const distance = Math.max(0, major - def.minRealm);
  const proximity = 1 + Math.max(0, 12 - distance) * 1.5;
  return qualityWeight * gongfaAffinity(def.element, elements) * proximity;
}

/** 藏经阁参悟:消耗残页随机习得 */
export function comprehendGongfa(): boolean {
  const resources = useResourcesStore();
  if (!resources.hasSmall("page", COMPREHEND_PAGE_COST)) {
    notify("功法残页不足", "warn");
    return false;
  }
  const player = usePlayerStore();
  const cultivation = useCultivationStore();
  const pool = GONGFA.filter((g) => g.minRealm <= player.major + 1 && !cultivation.learned[g.id]);
  if (pool.length === 0) {
    notify("当前境界的功法已尽数参悟", "info");
    return false;
  }
  resources.spendSmall("page", COMPREHEND_PAGE_COST);
  const learnt = learnRandomGongfa();
  if (learnt) {
    // 高品功法盖这一档的印:参悟出天品与参悟出凡品,分量不该一样
    // 门类要说穿(与奇遇那一条同口径):主修占唯一主修席、秘术装配时也占辅修席
    notify(
      `残卷拼合,你参悟出《${learnt.name}》· ${GONGFA_TYPE_NAMES[learnt.type]}`,
      "rare",
      learnt.quality,
    );
    return true;
  }
  return false;
}

/** 指定层数升到下一层的消耗。计划与实际共用这一处公式。 */
function gongfaUpgradeCostAt(id: string, lv: number): { wudao: number; page: number } | null {
  const def = gongfaDef(id);
  if (!def || !lv || lv >= def.maxLevel) return null;
  // 寒冥灵脉:参悟悟道点折扣(Phase 30.3)。折扣已在 store 里按唯一入口封过顶 ——
  // 这里再 `Math.min(0.5, …)` 一遍就是同一个上限的第二份副本,改上限只动一边。
  const discount = useDongfuStore().insightDiscount;
  // 消耗曲线由公共库算(见 core/engineWorld 的 GONGFA_SYSTEM):
  // 悟道点 = 基数 × 倍率^等级 ×(1-折扣);残页 = 等级 ×(1 + 品质序 × 0.5),下限 1
  const costs = GONGFA_SYSTEM.costAt(id, lv, { discount });
  return {
    wudao: costs.find((c) => c.key === "wudao")?.amount ?? 0,
    page: costs.find((c) => c.key === "page")?.amount ?? 0,
  };
}

/** 功法升级消耗 */
export function gongfaUpgradeCost(id: string): { wudao: number; page: number } | null {
  return gongfaUpgradeCostAt(id, useCultivationStore().learned[id] ?? 0);
}

export interface GongfaUpgradePlan {
  fromLevel: number;
  toLevel: number;
  count: number;
  wudao: number;
  page: number;
  ended: "max" | "broke" | "notlearned";
}

/**
 * 「修到顶」本轮总账(纯读):按现有悟道点与残页能修几层、共耗多少、停在料尽还是圆满。
 * 预告与实际动作都只读这一份计划。
 */
export function planGongfaUpgradeAll(id: string): GongfaUpgradePlan {
  const resources = useResourcesStore();
  const def = gongfaDef(id);
  const fromLevel = useCultivationStore().learned[id] ?? 0;
  if (!def || fromLevel <= 0) {
    return {
      fromLevel,
      toLevel: fromLevel,
      count: 0,
      wudao: 0,
      page: 0,
      ended: "notlearned",
    };
  }
  let level = fromLevel;
  let wudao = 0;
  let page = 0;
  let wudaoLeft = Math.max(0, resources.wudao);
  let pageLeft = Math.max(0, resources.page);
  while (level < def.maxLevel) {
    const cost = gongfaUpgradeCostAt(id, level);
    if (!cost || wudaoLeft < cost.wudao || pageLeft < cost.page) break;
    level += 1;
    wudao += cost.wudao;
    page += cost.page;
    wudaoLeft -= cost.wudao;
    pageLeft -= cost.page;
  }
  return {
    fromLevel,
    toLevel: level,
    count: level - fromLevel,
    wudao,
    page,
    ended: level >= def.maxLevel ? "max" : "broke",
  };
}

/**
 * 单层进修的校验与结算(静默)。返回本次消耗;到顶/未习得返回 "max",
 * 悟道点或残页不足返回 "broke"。单点进修与「修到顶」共用这一步 —— 一处记账。
 */
function applyOneGongfaUpgrade(id: string): { wudao: number; page: number } | "max" | "broke" {
  const resources = useResourcesStore();
  const cultivation = useCultivationStore();
  const cost = gongfaUpgradeCost(id);
  if (!cost) return "max";
  if (!resources.hasSmall("wudao", cost.wudao) || !resources.hasSmall("page", cost.page))
    return "broke";
  resources.spendSmall("wudao", cost.wudao);
  resources.spendSmall("page", cost.page);
  cultivation.upgrade(id);
  return { wudao: cost.wudao, page: cost.page };
}

export function upgradeGongfa(id: string): boolean {
  const res = applyOneGongfaUpgrade(id);
  const def = gongfaDef(id);
  if (res === "max") return false;
  if (res === "broke") {
    notify("悟道点或残页不足", "warn");
    return false;
  }
  const cultivation = useCultivationStore();
  notify(`《${def?.name}》修炼至第 ${cultivation.learned[id]} 层`, "success");
  return true;
}

export type GongfaUpgradeBatch = GongfaUpgradePlan;

/**
 * 修到顶:一次修到圆满或悟道点/残页见底,不再逐层点。
 * 合一条总账(与连强/连投同款:批量不逐层弹,免得把 toast 位挤没)。
 */
export function upgradeGongfaAll(id: string): GongfaUpgradeBatch {
  const plan = planGongfaUpgradeAll(id);
  const def = gongfaDef(id);
  let count = 0;
  let wudao = 0;
  let page = 0;
  for (let i = 0; i < plan.count; i += 1) {
    const res = applyOneGongfaUpgrade(id);
    if (typeof res === "string") break;
    count += 1;
    wudao += res.wudao;
    page += res.page;
  }
  const ended = count === plan.count ? plan.ended : "broke";
  const batch: GongfaUpgradeBatch = {
    fromLevel: plan.fromLevel,
    toLevel: plan.fromLevel + count,
    count,
    wudao,
    page,
    ended,
  };
  const cultivation = useCultivationStore();
  const lv = cultivation.learned[id] ?? 0;
  if (count > 0) {
    notify(`《${def?.name}》修至第 ${lv} 层,耗 ${wudao} 悟道点 · ${page} 残页`, "success");
  } else if (ended === "broke") {
    notify("悟道点或残页不足,修习中止", "warn");
  }
  return batch;
}
