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
