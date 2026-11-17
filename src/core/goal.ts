/**
 * Phase 29 修行目标 —— 给玩家"现在应该干什么"的轻量上下文
 *
 * 核心原则:
 * - 给方向,不替玩家做决定
 * - 不引入新资源/新系统,只复用现有状态
 * - 从前期教学自然过渡到 Build 游戏
 *
 * 类型:
 * - breakthrough  修为接近突破 → "尝试突破XX"
 * - equipment     装备槽有空位 → "寻一件XX法器"
 * - explore       区域未涉足   → "深入XX"
 * - material      材料不足     → "采集XX"
 * - build         流派未成形   → "凑出XX流" (中期核心目标)
 */
import type { PlayerStore } from "@/stores/player";
import { lifeTrialDef } from "@/data/lifeTrials";
import { useAdventureStore } from "@/stores/adventure";
import { useResourcesStore } from "@/stores/resources";
import { useInventoryStore } from "@/stores/inventory";
import { detectBuild } from "./buildDetect";
import { WORLD_BREAK_MAJOR } from "@/data/realms";
import { CELESTIAL_WORLDS } from "@/data/endgame";
import { realmLabel } from "@/data/realms";
import { REGIONS } from "@/data/regions";
import { EQUIP_SLOT_NAMES } from "@/data/equipment";
import { SUB_LEVELS } from "@/data/constants";
import type { EquipSlot } from "@/types";

export type GoalType =
  | "breakthrough"
  | "equipment"
  | "explore"
  | "material"
  | "build"
  /*
   * 终局三支（第 428 轮补）。
   *
   * 前五个各守一件「当下该做的小事」；而真仙以上、六支全不命中的玩家
   * 此前拿到的是 `null` —— 首页那张卡整块不渲染，界面对他说的唯一一句话是
   * 「你没有下一步」。而那三样（道途 / 远征 / 天道秘境）本来就是这一作
   * 最重的内容，只是 `goal` 此前一条都不认识。
   */
  | "path"
  | "expedition"
  | "endgame";

export interface GoalDestination {
  to: string;
  label: string;
}

export interface Goal {
  type: GoalType;
  text: string;
  /** 进度(0~1),可选 */
  progress?: number;
  /** 建议下一步(可选) */
  hint?: string;
  /** 想去哪(可选):有去向则该卡渲染成可点跳转,免得只给方向不给入口 */
  destination?: GoalDestination;
}

/**
 * 实体装备槽(排除 artifact —— 法宝是独立系统 equippedArtifacts,装备模板从不落此槽,
 * 见 equipGen.generateEquipment 的 t.slot !== 'artifact')。按有意义的优先级排列:
 * 武器占攻、衣袍护身居先;灵符是真槽(有整套模板),一并纳入。
 * 空槽扫描按此顺序挑第一个,保证建议具体且不来回跳。
 */
const GEAR_SLOTS: EquipSlot[] = [
  "weapon",
  "head",
  "body",
  "wrist",
  "belt",
  "boots",
  "necklace",
  "ring",
  "talisman",
];

/**
 * 灵草的低位线:野外唯一被消耗的材料(丹方 4~30 一味),10 约等于两炉最廉丹方的余量,
 * 既不至于一采就闪烁,也远低于"炼不出一炉"的绝望水位。ore 目前只进不花,不作提示对象。
 */
const MATERIAL_LOW_HERB = 10;

/** 纯函数:根据玩家状态生成当前目标 */
export function generateCurrentGoal(
  player: PlayerStore,
  /**
   * 终局状态 —— **由调用方传入**，不在这里 import endgame store（第 428 轮）。
   *
   * `core/goal` 的既有约束是「只读传入的 player，不新增 store 依赖」
   * （见 `layeringAudit.spec` 第 178 行）。终局那三支确实要读 `daoPath` 与
   * `daoSource`，但那是**调用方的事** —— 由它把两个数递进来，这个函数仍是纯的。
   *
   * 不传时按「未到终局」处理（老调用方与用例都不必改）。
   */
  endgame?: { daoPath: string | null; daoSource: number },
): Goal | null {
  // 1. 死后无目标
  if (player.dead) return null;

  /*
   * 1.5 签了「执念契」的一世，下一步就是自己立下的那句话（第 475 轮）。
   *
   * 排在**修为突破之前**:契约是花道果立的，它比系统建议的「去突破」更该被看见 ——
   * 否则玩家签完之后抬头仍是原来自动生成的那一条，「本世目标」这条玩法面等于没动。
   *
   * 只读 `player.reincarnation.trial.trialId` 再查静态表，**不新增 store 依赖**
   * （`core/goal` 的既有约束，见 `layeringAudit.spec`）。
   *
   * 它只改「做什么」：回报仍是履历，不发放宿慧/资源（那四条出口判据守着）。
   */
  const signedTrial = player.reincarnation.trial;
  const vowGoal = signedTrial ? lifeTrialDef(signedTrial.trialId)?.vowGoal : undefined;
  if (vowGoal) {
    /*
     * `type` 此刻没有消费者（`HomeView` 的注释说它「从被造出来起就只是类型标注」），
     * 故这里给 `"explore"` 只是取一个形状合法的值 —— 它不改变任何渲染。
     * 真要分「契约目标」与「系统建议」时，该加的是新的一支而不是借用。
     */
    return {
      type: "explore",
      text: vowGoal,
      hint: "这是你自己立下的一句话 —— 本世只此一件",
    };
  }

  /*
   * 2. 修为接近突破(最高优先级)—— **但到顶之后就没有突破了**。
   *
   * 原先这两支对已至大道尽头的玩家照样触发:`Math.min(sub + 1, SUB_LEVELS - 1)` 把
   * 「下一层」钳成了**当前这一层**,于是末境圆满的玩家看到「尝试突破「混沌道祖·圆满」」
   * —— 让玩家去突破一个自己正待着的境界。修为攒满在末境是常态(越到后面越容易满),
   * 所以这条不是罕见边界,而是终局玩家每天都会看到的那一句。
   *
   * 到顶之后跳过这两支,落到下面「还能做什么」的实际目标上。
   */
  const atApex = player.atMaxRealm;
  if (!atApex) {
    if (player.expProgress >= 0.85) {
      const next = realmLabel(player.major, Math.min(player.sub + 1, SUB_LEVELS - 1));
      return {
        type: "breakthrough",
        text: `尝试突破「${next}」`,
        progress: player.expProgress,
        hint: "修为已近圆满,服用凝神丹或静坐调息可提升成功率",
        destination: { to: "/cultivation", label: "去修炼" },
      };
    }
    if (player.expProgress >= 0.5) {
      const next = realmLabel(player.major, Math.min(player.sub + 1, SUB_LEVELS - 1));
      return {
        type: "breakthrough",
        text: `向「${next}」迈进`,
        progress: player.expProgress,
        destination: { to: "/cultivation", label: "去修炼" },
      };
    }
  }

  // 3. 检测 Build 完整度(中期核心目标)
  const build = detectBuild(player.finalStats.mods);
  if (build) {
    const style = build.style.name;
    const core = Math.min(build.coreValues.length, build.coreTotal);
    // 分母按这一路的核心词条数走(见 detectBuild 的 coreTotal):写死一个数会让
    // 核心词条少的那几路永远停在半路,进度条也就只是在骗人。
    const total = Math.max(1, build.coreTotal);
    /*
     * 凑齐了就该换一句话。
     *
     * 从前无论凑没凑齐都写「继续寻找关键装备」—— 而进度条已经 100% 时
     * 那句话指向的下一步**不存在**。玩家会去找,找不到,然后怀疑是不是漏了什么。
     *
     * 进度条说满了、提示语说还差,这两句在打架;而这一仓的纪律里写着
     * 「界面上出现的每个数字都与结算同源」。
     *
     * 凑齐之后说什么:`stageName` 已经分「雏形 / 成形 / 大成」三档
     * （见 core/buildDetect),直接用它的读数,不在这里另造一套分档。
     */
    const done = core >= total;
    return {
      type: "build",
      text: done ? `「${style}」流派已${build.stageName}` : `完善「${style}」流派`,
      progress: Math.min(1, core / total),
      hint: done
        ? `${total}/${total} 个核心词条已齐 —— 这一路的装备不再有缺口,可以换一路或去推地界`
        : `当前已凑出 ${core}/${total} 个核心词条,继续寻找关键装备`,
      destination: { to: "/build", label: "去构筑" },
    };
  }

  // 4. 低优先级:历练/材料/装备(未涉足且可入的地界向前,推前线推进永远优先;
  //    材料与装备同门 —— 供应/装填补缺 —— 都只在"已通关过至少一地界"后才提示,
  //    免得开局就叠在 explore 上重复"去历练"。)
  const adventure = useAdventureStore();
  /**
   * 「深入」只指**没涉足过**的地界:复聚的旧地界(见 core/regionRevival)不算 ——
   * 它在表序上排在前面,若算进来,一位推到仙界的玩家会被告知「深入青云山麓」。
   * 旧主的重逢由历练页自己说(那一行有「妖气复聚」与"再历一程即可复靖")。
   */
  const nextRegion = REGIONS.find(
    (r) =>
      adventure.unlocked.includes(r.id) &&
      !adventure.cleared.includes(r.id) &&
      !adventure.revived.includes(r.id),
  );
  if (nextRegion) {
    return {
      type: "explore",
      text: `深入「${nextRegion.name}」`,
      hint: "增长阅历,也寻些机缘与材料",
      destination: { to: "/adventure", label: "去历练" },
    };
  }
  const hasClearedAny = adventure.cleared.length > 0;

  // 5. 材料不足 → 采集:灵草见底便指向最高层级的已通关地界(取材收益最大)。
  //    材料在装备之前 —— 断粮卡丹方是"阻断",空槽是"可选的战力余量"。
  const resources = useResourcesStore();
  if (hasClearedAny && resources.herb < MATERIAL_LOW_HERB) {
    const best = [...REGIONS]
      .filter((r) => adventure.cleared.includes(r.id))
      .sort((a, b) => b.tier - a.tier)[0];
    if (best) {
      return {
        type: "material",
        text: `去「${best.name}」采集灵草`,
        progress: Math.min(1, resources.herb / MATERIAL_LOW_HERB),
        hint: "丹药原料所剩无几,历练途中常有灵草可采",
        destination: { to: "/adventure", label: "去历练" },
      };
    }
  }

  // 6. 装备槽有空位 → 寻法器:指第一个空槽,进度 = 已填槽占比(填满即自解)。
  const inventory = useInventoryStore();
  const emptySlot = GEAR_SLOTS.find((slot) => !inventory.equipped[slot]);
  if (hasClearedAny && emptySlot) {
    const filled = GEAR_SLOTS.filter((slot) => inventory.equipped[slot]).length;
    const slotName = EQUIP_SLOT_NAMES[emptySlot];
    return {
      type: "equipment",
      text: `寻一件${slotName}`,
      progress: filled / GEAR_SLOTS.length,
      hint: `还缺一件${slotName},历练所得的装备里常有`,
      destination: { to: "/inventory?tab=equip", label: "去行囊" },
    };
  }

  /*
   * 7. 终局:前面六支全不命中时，玩家其实还有事可做 —— 只是那些事
   *    **都不在 `goal` 分得清的维度里**（第 428 轮补）。
   *
   * ## 那个空档
   *
   * 六支各自守着一件「当下该做的小事」:突破、构筑、推地界、采料、补装备。
   * 而一位走到真仙以上、地界推完、装备齐、材料足的玩家**六支全不命中**,
   * `generateCurrentGoal` 返回 `null` —— 首页那张卡 `v-else-if="currentGoal"`
   * 整块不渲染。
   *
   * 实测复现过:
   *
   * ```text
   *   adv.cleared = 全部区域 · herb 充足 · 九个装备槽全填 · major 12
   *   → 目标: null（首页那张卡整块不显示）
   * ```
   *
   * ## 为什么这一支不是「凑数」
   *
   * 那个阶段的人**确实有下一步**,而且是这一作最重的那几样:道途、远征、
   * 每日天道、秘境、历世试炼。只是它们都挂在真仙之后,而 `goal` 此前
   * 一条都不认识 —— 于是「没事可做」成了界面对终局玩家说的唯一一句话。
   *
   * ## 门槛读同一个常量
   *
   * `WORLD_BREAK_MAJOR`,与 `endgameUnlocked()` 同一个 —— 不另写一个 9。
   * 两支的顺序是「先看有没有该打的远征,再看有没有该刷的天道,最后才泛指」:
   * 泛指那一句是兜底,它只在**真的什么都指不出**时才出现。
   */
  if (player.major >= WORLD_BREAK_MAJOR && endgame) {
    /*
     * 道途未定 —— 这是真仙之后第一个不可逆的选择,也是最该被推到头上的那一步。
     * 它排在最前:没有道途,远征与每日天道都开不了（见 `core/expedition` 的守卫）。
     */
    if (!endgame.daoPath) {
      return {
        type: "path",
        text: "立下此世的道途",
        hint: "七道各有一得,也各有代价;落子后须待转世再选",
        destination: { to: "/celestial", label: "去天界" },
      };
    }
    /*
     * 有可打的远征就先去 —— 「已备道源」这句话读 `entryCost`,
     * 与远征页自己的可负担判定同源（不在首页另算一笔）。
     */
    const affordable = CELESTIAL_WORLDS.filter((w) => endgame.daoSource >= w.entryCost).length;
    if (affordable > 0) {
      /*
       * **不写「N 界已备」**（第 430 轮改）。
       *
       * 那句话原样是 `${affordable} 界已备道源`,读起来像「可以在备得起的那几个里挑」——
       * 而实测五个世界的 `entryCost` **全都是 20**（赤炎天/星陨天/万刃天/无生天/无相天）,
       * 于是 N 只可能是 0 或 5,中间那 1~4 永远不会出现。
       *
       * 一句「5 界已备」其实在说「你有 20 道源」。**报门槛比报个数有用**:
       * 玩家要知道的是「还差多少」,而「几个界备得起」在代价全同时是个假选择。
       *
       * 代价**不是硬编码 20** —— 它从数据取（`CELESTIAL_WORLDS[].entryCost` 的最小值）,
       * 这样哪天五个世界定了不同的价,这句话仍然对。
       */
      const cheapest = Math.min(...CELESTIAL_WORLDS.map((w) => w.entryCost));
      return {
        type: "expedition",
        text: `道源已备，可叩天门（每界 ${cheapest} 起）`,
        hint: "择契、看路 —— 远征给的是道源与道痕",
        destination: { to: "/celestial", label: "去远征" },
      };
    }
    // 都没得打时，最后泛指一句：这一作在终局**仍然有每日可做的事**，
    // 而「没有目标」不是其中任何一项
    return {
      type: "endgame",
      text: "今日天道与秘境尚可一探",
      hint: "道源不足时，天道熔炉可献祭闲置资财",
      destination: { to: "/celestial", label: "去天界" },
    };
  }
  return null;
}
