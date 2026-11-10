/**
 * 流派组合技(Phase 21)—— 主副体系凑成特定搭配时激活的真正组合规则
 * 不是新职业:只是两条道路交汇处的一式神通,引擎按 comboArt 键触发
 */

export interface ComboArtDef {
  id: string;
  /** 参与组合的两个流派 id(不限主副次序) */
  pair: [string, string];
  name: string;
  desc: string;
  /** 结构性代价说明(构筑有得必有失) */
  costText: string;
}

export const COMBO_ARTS: ComboArtDef[] = [
  {
    id: "xuangang",
    pair: ["gangdun", "fanzhen"],
    name: "玄罡反震",
    desc: "护盾被击破的刹那,碎光化作一次强化反击(每场至多两次)",
    costText: "依赖护盾节奏,真伤之敌可绕过罡盾使其无从触发",
  },
  {
    id: "kuze",
    pair: ["muze", "beishui"],
    name: "枯泽回春",
    desc: "气血低于三成时,一切治疗增效五成",
    costText: "此时每次受疗,护盾亦随之消散一半——生机与灵光不可兼得",
  },
  {
    id: "fenglian",
    pair: ["fengmang", "lianji"],
    name: "锋连诀",
    /*
     * 文案同步:原来是「满血会心必定衔接一记追击」,而 `combat.ts` 的判定是
     * `selfPct > 0.9` —— 挨超过一成伤害就永远触发不了。第 78 轮去掉了满血限制,
     * 文案里那句「满血」也就不成立了。
     *
     * `costText` 同样要改:原来写「机会只在开局一线」,而那是**旧机制**的描述
     * (只有开局那几回合还算满血)。新机制下机会在整场,代价改成「一场只此一次」。
     */
    desc: "会心一击时衔接一记追击(每场限一次)",
    costText: "一场只此一次,且要靠会心才等得到",
  },
];

/** 依主副流派查激活的组合技(次序不限,副体系须足够成形) */
export function matchComboArt(
  primaryId: string,
  secondaryId: string | undefined,
): ComboArtDef | null {
  if (!secondaryId) return null;
  return (
    COMBO_ARTS.find(
      (art) =>
        (art.pair[0] === primaryId && art.pair[1] === secondaryId) ||
        (art.pair[0] === secondaryId && art.pair[1] === primaryId),
    ) ?? null
  );
}

/** 组合技激活所需的副体系契合度 */
export const COMBO_SECONDARY_MIN = 0.45;
