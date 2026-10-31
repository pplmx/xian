export interface ArtifactDeskFact {
  equipped: boolean;
  /** 还有下一重可炼;封顶件为 false。 */
  hasUpgrade: boolean;
  /** 只对 hasUpgrade 为 true 的件有意义。 */
  affordable: boolean;
}

export interface ArtifactDeskSummary {
  total: number;
  carried: number;
  stored: number;
  slots: number;
  emptySlots: number;
  ready: number;
  short: number;
  maxed: number;
}

export interface ArtifactPlacementPlan {
  action: "equipped" | "unequipped" | "replaced" | "blocked";
  removedId: string | null;
  removedIndex: number | null;
}

/**
 * 法宝册的卷首总账。随身、可炼、欠料与满重全部从同一批卡片事实归并,
 * 页面不再自己数第二遍;slots 也收口为可读的非负整数。
 */
export function artifactDeskSummary(
  facts: readonly ArtifactDeskFact[],
  slots: number,
): ArtifactDeskSummary {
  const carried = facts.filter((fact) => fact.equipped).length;
  const availableSlots = Math.max(0, Math.floor(slots));
  return {
    total: facts.length,
    carried,
    stored: Math.max(0, facts.length - carried),
    slots: availableSlots,
    emptySlots: Math.max(0, availableSlots - carried),
    ready: facts.filter((fact) => fact.hasUpgrade && fact.affordable).length,
    short: facts.filter((fact) => fact.hasUpgrade && !fact.affordable).length,
    maxed: facts.filter((fact) => !fact.hasUpgrade).length,
  };
}

/**
 * 下一件法宝该入位、收回,还是替下最早随身的一件。
 * 卡片预告、成功回执与 store 的实动都读这一份计划,不再各自猜会让位的是谁。
 */
export function planArtifactPlacement(
  equipped: readonly string[],
  candidateId: string,
  slots: number,
): ArtifactPlacementPlan {
  if (!candidateId) {
    return { action: "blocked", removedId: null, removedIndex: null };
  }

  const carried = equipped.filter(Boolean);
  const candidateIndex = carried.indexOf(candidateId);
  if (candidateIndex >= 0) {
    return {
      action: "unequipped",
      removedId: candidateId,
      removedIndex: candidateIndex,
    };
  }

  const capacity = Math.max(0, Math.floor(slots));
  if (carried.length < capacity) {
    return { action: "equipped", removedId: null, removedIndex: null };
  }
  if (capacity > 0 && carried[0]) {
    return { action: "replaced", removedId: carried[0], removedIndex: 0 };
  }
  return { action: "blocked", removedId: null, removedIndex: null };
}
