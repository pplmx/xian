/**
 * 功法服务 —— 参悟 / 习得 / 升级
 */
import { rng } from "@/utils/random";
import { GONGFA, gongfaDef } from "@/data/gongfa";
import { qualityDef } from "@/data/qualities";
import { COMPREHEND_PAGE_COST } from "@/data/constants";
import { GONGFA_SYSTEM } from "./engineWorld";
import { gongfaAffinity, rootElements } from "./linggenAffinity";
import { collect, isCollected, track } from "./progress";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { useCultivationStore } from "@/stores/cultivation";
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

/** 随机习得一部功法(事件/掉落),返回功法名;无可学返回 null */
export function learnRandomGongfa(specificId?: string): string | null {
  const player = usePlayerStore();
  const cultivation = useCultivationStore();
  if (specificId) {
    const def = gongfaDef(specificId);
    if (def && learnGongfa(specificId)) return def.name;
    return null;
  }
  const pool = GONGFA.filter((g) => g.minRealm <= player.major + 1 && !cultivation.learned[g.id]);
  if (pool.length === 0) return null;
  // Phase 32.2:同源功法更容易参悟到(倾向,非独占)——
  // 无对应灵根者权重仍为原值,任何功法都拿得到,只是撞见的概率不同。
  const elements = rootElements(player.linggen?.roots);
  const picked = rng.weighted(
    pool,
    (g) => (100 / (1 + qualityDef(g.quality).rank * 1.5)) * gongfaAffinity(g.element, elements),
  );
  return learnGongfa(picked.id) ? picked.name : null;
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
  const name = learnRandomGongfa();
  if (name) {
    notify(`残卷拼合,你参悟出《${name}》`, "rare");
    return true;
  }
  return false;
}

/** 功法升级消耗 */
export function gongfaUpgradeCost(id: string): { wudao: number; page: number } | null {
  const cultivation = useCultivationStore();
  const def = gongfaDef(id);
  const lv = cultivation.learned[id];
  if (!def || !lv || lv >= def.maxLevel) return null;
  // 寒冥灵脉:参悟悟道点折扣(Phase 30.3)
  const discount = Math.min(0.5, useDongfuStore().insightDiscount);
  // 消耗曲线由公共库算(见 core/engineWorld 的 GONGFA_SYSTEM):
  // 悟道点 = 基数 × 倍率^等级 ×(1-折扣);残页 = 等级 ×(1 + 品质序 × 0.5),下限 1
  const costs = GONGFA_SYSTEM.costAt(id, lv, { discount });
  return {
    wudao: costs.find((c) => c.key === "wudao")?.amount ?? 0,
    page: costs.find((c) => c.key === "page")?.amount ?? 0,
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

export interface GongfaUpgradeBatch {
  count: number;
  wudao: number;
  page: number;
  ended: "max" | "broke" | "notlearned";
}

/**
 * 修到顶:一次修到圆满或悟道点/残页见底,不再逐层点。
 * 合一条总账(与连强/连投同款:批量不逐层弹,免得把 toast 位挤没)。
 */
export function upgradeGongfaAll(id: string): GongfaUpgradeBatch {
  const cultivation = useCultivationStore();
  const def = gongfaDef(id);
  let count = 0;
  let wudao = 0;
  let page = 0;
  let ended: GongfaUpgradeBatch["ended"] = "notlearned";
  // 上限定死:每层必耗料或到顶,循环必然终止;安全闸防病理匀速为 0 的残页档
  for (let i = 0; i < 200; i += 1) {
    const res = applyOneGongfaUpgrade(id);
    if (res === "max") {
      ended = "max";
      break;
    }
    if (res === "broke") {
      ended = "broke";
      break;
    }
    count += 1;
    wudao += res.wudao;
    page += res.page;
  }
  const lv = cultivation.learned[id] ?? 0;
  if (count > 0) {
    notify(`《${def?.name}》修至第 ${lv} 层,耗 ${wudao} 悟道点 · ${page} 残页`, "success");
  } else if (ended === "broke") {
    notify("悟道点或残页不足,修习中止", "warn");
  }
  return { count, wudao, page, ended };
}
