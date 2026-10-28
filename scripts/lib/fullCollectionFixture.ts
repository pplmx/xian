/**
 * 全收集规模夹具 —— 给图鉴的运行时门逼出终局体量。
 *
 * 默认后期档几乎没有收藏,量到的只是九张空册;真正会让 DOM 膨胀的是全收集后
 * 九册同时铺满。这里直接按内容表造已收录、已认知、已择道的状态,不另维护一份
 * 手抄 id 清单。只用于自检,不参与游戏运行。
 */
import { ARTIFACTS, ARTIFACT_MAX_LEVEL } from "../../src/data/artifacts";
import { EQUIPMENT_TEMPLATES } from "../../src/data/equipment";
import { EVENTS } from "../../src/data/events";
import { GONGFA } from "../../src/data/gongfa";
import { GONGFA_BRANCHES } from "../../src/data/gongfaBranches";
import { LORE_MAX, MATERIALS } from "../../src/data/materials";
import { PETS } from "../../src/data/pets";
import { PILLS } from "../../src/data/pills";
import { QUALITIES } from "../../src/data/qualities";
import { TALENTS } from "../../src/data/talents";

const idsOf = (rows: readonly { id: string }[]): string[] => rows.map((row) => row.id);

export const FULL_COLLECTION_COUNTS = {
  equip: EQUIPMENT_TEMPLATES.length,
  gongfa: GONGFA.length,
  branch: GONGFA_BRANCHES.length,
  pill: PILLS.length,
  material: MATERIALS.length,
  artifact: ARTIFACTS.length,
  pet: PETS.length,
  event: EVENTS.length,
  talent: TALENTS.length,
  total:
    EQUIPMENT_TEMPLATES.length +
    GONGFA.length +
    GONGFA_BRANCHES.length +
    PILLS.length +
    MATERIALS.length +
    ARTIFACTS.length +
    PETS.length +
    EVENTS.length +
    TALENTS.length,
} as const;

/** 每个 category 的七册二态收藏;灵材与悟道由各自的深度表推出来 */
export function fullCollectionSlices() {
  const now = Date.now();
  const maxQuality = Math.max(...QUALITIES.map((quality) => quality.rank));
  const maxTier = Math.max(...EQUIPMENT_TEMPLATES.map((item) => item.tier));
  const pickedBranches = new Map<string, string>();
  for (const branch of GONGFA_BRANCHES) {
    if (!pickedBranches.has(branch.gongfaId)) pickedBranches.set(branch.gongfaId, branch.id);
  }

  return {
    quests: {
      counters: {},
      achieved: [],
      achievedTiers: {},
      mainIdx: 0,
      daily: { date: "", base: {}, done: [] },
      titlesOwned: [],
      collections: {
        equip: idsOf(EQUIPMENT_TEMPLATES),
        gongfa: idsOf(GONGFA),
        pill: idsOf(PILLS),
        artifact: idsOf(ARTIFACTS),
        pet: idsOf(PETS),
        event: idsOf(EVENTS),
        talent: idsOf(TALENTS),
      },
      collectedAt: {},
      lastCollectionViewAt: now,
      petCompanions: idsOf(PETS),
    },
    lore: {
      materialLore: Object.fromEntries(MATERIALS.map((material) => [material.id, LORE_MAX])),
      materialSeen: Object.fromEntries(MATERIALS.map((material) => [material.id, 99])),
      recipeLore: Object.fromEntries(PILLS.map((pill) => [pill.id, 1])),
      blueprintLore: Object.fromEntries(EQUIPMENT_TEMPLATES.map((item) => [item.id, 1])),
      skillExp: {},
      enemyLore: {},
      enemySeen: {},
      equipLore: Object.fromEntries(
        EQUIPMENT_TEMPLATES.map((item) => [item.id, { q: maxQuality, t: maxTier, u: 1 }]),
      ),
      studyFrac: 0,
      seeded: true,
    },
    cultivation: {
      learned: Object.fromEntries(GONGFA.map((gongfa) => [gongfa.id, gongfa.maxLevel])),
      mainGongfa: null,
      subGongfa: [],
      buffs: [],
      gongfaBranch: Object.fromEntries(pickedBranches),
    },
    inventory: {
      items: [],
      equipped: {},
      pills: {},
      artifacts: ARTIFACTS.map((artifact) => ({
        defId: artifact.id,
        level: ARTIFACT_MAX_LEVEL,
      })),
      equippedArtifacts: [],
    },
  };
}
