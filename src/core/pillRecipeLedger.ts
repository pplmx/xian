/**
 * 丹方册的排法 —— 按境界排队,不是按「可炼优先 → 阶位」排队。
 *
 * ## 为什么换这一种排法
 *
 * 开炉弹窗的清单此前一个平面:现在料够的置顶,其余按丹方阶位从易到难。
 * 那是「我今天能炼哪几炉」的排法,而玩家站在丹炉前问的是另一个问题:
 *
 * ```text
 *   我这境界该炼什么 / 下一境还差哪几张方子
 * ```
 *
 * 平面清单答不了这个 —— 阶位与境界是两个轴,混在一个序列里之后,
 * 「炼气能炼的三张」与「混沌海才用得上的两张」隔着几十行。
 *
 * ## 分组依据是 `minRealm`
 *
 * 每味丹药的 `minRealm` 就是「这张方子写给谁看」(见 docs/alchemy.md 的法则 I:
 * 可炼难度契约,每张方可炼方在**它自己的准入境界**处 overReach ≤ 1)。
 * 故按它分组既不是新造的第二套分档,也正好是玩家问的那句话。
 *
 * 组内次序:已得的在前(现在就能开炉),再按阶位从易到难、同名序兜底。
 * 未得的排在已得之后 —— 它们是「这一境还有几张没到手」,不是动作。
 *
 * ## 未得方只报占位,不报内容
 *
 * 名字与代价都是**得到之后**才知道的东西(见图鉴的 `???` 纪律:
 * `ui/codex` 的收录深度,未收录即无名无阶)。这一册照同一条口径:
 * 未得的行只留一个占位与「未得」,回答的是「一共多少、缺在哪一境」,
 * 不提前把方名与配方摊开。总册数由这里给出,界面不许另数一遍。
 */
import type { PillDef } from "@/types";
import { PILLS } from "@/data/pills";
import { REALMS, MAX_MAJOR, isWorldEntry, worldOf } from "@/data/realms";
import { recipeCraft } from "@/data/crafting";

/** 丹方册里的一行 */
export interface RecipeLedgerEntry {
  def: PillDef;
  /** 丹方阶位(1~9)—— 说的是「这一方多难」,不是品阶 */
  rank: number;
  /** 得没得方。未得的只有占位,不报代价与把握 */
  known: boolean;
}

/** 一境一章 */
export interface RecipeRealmGroup {
  /** 大境界序号 —— 界面拿它当稳定落点(`data-recipe-group`) */
  major: number;
  /** 境名(炼气 / 筑基 …) */
  realmName: string;
  /** 所属界域(人间界 / 仙界 …) */
  worldName: string;
  /** 是不是所在界域的第一境 —— 章首把界域名一起报出来 */
  worldFirst: boolean;
  entries: RecipeLedgerEntry[];
  /** 这一境已得几张 */
  known: number;
  /** 这一境一共几张可炼方 */
  total: number;
}

export interface RecipeLedger {
  groups: RecipeRealmGroup[];
  /** 全册已得张数 */
  known: number;
  /** 全册可炼方张数 */
  total: number;
  /** 本无方的丹药:只掉落,不进这一册 */
  noRecipe: number;
}

/** 一张可炼方的阶位;无方之丹不给读,调用方先滤 */
function rankOf(def: PillDef): number {
  return recipeCraft(def)?.rank ?? 1;
}

/**
 * 组内次序:已得在前 → 阶位从易到难 → 准入境界(同组内恒等)→ 名。
 *
 * 「已得在前」不是口味:未得的那几张此刻点不动,排在动作前面会让每一境
 * 的头几行都读不成动作。
 */
function byLedgerOrder(a: RecipeLedgerEntry, b: RecipeLedgerEntry): number {
  return (
    Number(b.known) - Number(a.known) ||
    a.rank - b.rank ||
    a.def.name.localeCompare(b.def.name, "zh")
  );
}

/**
 * 全册:按境界从低到高分组。
 *
 * `masteryOf` 只回答「这张方到手了没有」(与 `core/craftability.knownRecipes`
 * 同一份 `lore.recipeMastery`)—— 这一册不重算掌握度,那件事归 lore store。
 */
export function recipeLedger(masteryOf: (id: string) => number): RecipeLedger {
  const craftable = PILLS.filter((def) => def.recipe !== undefined);
  const buckets = new Map<number, RecipeLedgerEntry[]>();
  for (const def of craftable) {
    const major = Math.max(0, Math.min(MAX_MAJOR, Math.trunc(def.minRealm)));
    const entry: RecipeLedgerEntry = {
      def,
      rank: rankOf(def),
      // 掌握度 > 0 才算得方 —— 与 knownRecipes 同一条判据,不另立门槛
      known: masteryOf(def.id) > 0,
    };
    const list = buckets.get(major);
    if (list) list.push(entry);
    else buckets.set(major, [entry]);
  }

  const groups: RecipeRealmGroup[] = [];
  for (let major = 0; major <= MAX_MAJOR; major += 1) {
    const entries = buckets.get(major);
    if (!entries || entries.length === 0) continue;
    entries.sort(byLedgerOrder);
    const world = worldOf(major);
    groups.push({
      major,
      realmName: REALMS[major]?.name ?? `第 ${major} 境`,
      worldName: world.name,
      worldFirst: isWorldEntry(major),
      entries,
      known: entries.filter((entry) => entry.known).length,
      total: entries.length,
    });
  }

  return {
    groups,
    known: craftable.filter((def) => masteryOf(def.id) > 0).length,
    total: craftable.length,
    noRecipe: PILLS.length - craftable.length,
  };
}

/**
 * 默认展开哪一境 —— 玩家此刻所在的境界。
 *
 * 那一刻他要决定的是「这一境还差哪几张方、现在能开哪几炉」,故不给「全合着」
 * (那等于让他每次先点一下才看得见自己在哪),也不全展开(二十一境同时铺开
 * 就是回到那个平面长清单)。
 *
 * 当前境一张可炼方都没有时,往下找最近的一境;都没有才返回 `null`。
 */
export function defaultOpenMajor(
  groups: readonly RecipeRealmGroup[],
  major: number,
): number | null {
  if (groups.length === 0) return null;
  const here = Math.max(0, Math.min(MAX_MAJOR, Math.trunc(major)));
  let best: RecipeRealmGroup | null = null;
  for (const group of groups) {
    if (group.major <= here) best = group;
  }
  return (best ?? groups[0]!).major;
}
