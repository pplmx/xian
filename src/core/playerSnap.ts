/** 构建玩家战斗快照 */
import type { ArtifactDef, CombatantSnap } from "@/types";
import { artifactDef } from "@/data/artifacts";
import { COMBO_SECONDARY_MIN, matchComboArt } from "@/data/comboArts";
import { usePlayerStore } from "@/stores/player";
import { useCultivationStore } from "@/stores/cultivation";
import { useInventoryStore } from "@/stores/inventory";
import { useEndgameStore } from "@/stores/endgame";
import { modOf } from "./statsCalc";
import { detectBuild } from "./buildDetect";
import { stackedMods, swordPurity, SWORD_LAYER_MODS } from "./daoDepth";
import { hasActiveSet, setHookMods } from "./equipSet";

/**
 * 构建玩家战斗快照。
 *
 * celestial=true 时走天界口径(Phase 33.3):凡界装备**照常作数**,器魂是叠加上去的
 * 一层(equipMods 与 soulMods 各自成源一并纳入,同键递减,见 stores/player.ts 的
 * celestialStats 与 Phase 33 注释)。此前的「凡器数值尽去、只余器魂」二选一旧口径
 * 已废弃,这里与实现对齐。
 * 基础三维不变(天界敌人本就按它等比缩放,已互相抵消)
 */
export function buildPlayerSnap(celestial = false): CombatantSnap {
  const player = usePlayerStore();
  const cultivation = useCultivationStore();
  const inventory = useInventoryStore();
  const endgame = useEndgameStore();
  const stats = celestial ? player.celestialStats : player.finalStats;
  const artifacts = inventory.currentArtifacts
    .map((a) => ({ def: artifactDef(a.defId), level: a.level }))
    .filter((x): x is { def: ArtifactDef; level: number } => x.def !== undefined);

  const build = detectBuild(stats.mods);
  // 流派组合技:主副体系凑对且副体系足够成形
  const comboArt =
    build?.secondary && build.secondary.affinity >= COMBO_SECONDARY_MIN
      ? (matchComboArt(build.style.id, build.secondary.style.id)?.id ?? undefined)
      : undefined;
  // 剑道·剑意:道途越纯,剑意越盛(全局生效)
  let mods = stats.mods;
  if (endgame.daoPath === "sword") {
    const purity = swordPurity(stats.mods, artifacts.length, build);
    mods = stackedMods(stats.mods, SWORD_LAYER_MODS, purity.layers);
  }
  // Phase 31 S5:astral 共鸣(同套 2 件 → 开战时护盾+5%)——并入盾 mod,与词条/功法
  // 同走 shieldOnStart 一条道,combat 开战盾逻辑(read mods.shieldOnStart)直接生效,
  // powerRating/战报随 mods 透明展示。不进 finalStats:机制钩子不改面板与流派检测。
  /*
   * 全部「并入型」共鸣:astral(星斗,8 阶开战 +5% 盾)· sunder(仙甲,23 阶破甲)·
   * thorns(神铠,28 阶反震)· primordial(混沌,31 阶本源盾)。
   *
   * 并进快照 mods,由 combat 现成的读取点直接生效 —— 不新开引擎接口。
   * 表在 equipSet 的 SET_HOOK_MODS 里是**单一出处**,换装推演(lab)读同一张表,
   * 两处不会漂。
   *
   * 四套此前共用两个 hook(28 阶神铠 = 2 阶铁壁、23 阶仙甲与 31 阶混沌 = 8 阶星斗),
   * 玩家越到后期凑齐一套越难,拿到的却和早期一模一样。现在各有一套真机制。
   */
  mods = stackedMods(mods, setHookMods(inventory.equippedItems), 1);

  return {
    name: player.name,
    icon: "user",
    isPlayer: true,
    attack: stats.attack,
    defense: stats.defense,
    maxHp: stats.maxHp,
    speed: 1 + modOf(stats.mods, "speed"),
    mods,
    skills: cultivation.mainSkill ? [cultivation.mainSkill] : [],
    artifacts,
    comboArt,
    // Phase 31 S5:铁壁共鸣(同套 2 件 → 首次致命伤保命)
    ironwallBrace: hasActiveSet(inventory.equippedItems, "ironwall"),
  };
}
