/** 天道契约(Phase 21)—— 玩家主动签下的不公平规则,风险换道源 */
import type { PactDef } from "@/types";

export const PACTS: PactDef[] = [
  {
    id: "xue",
    name: "血契",
    seal: "血",
    desc: "此行不得回血,伤势只进不出",
    ruleText: "一切治疗无效 · 道源 ×2.2",
    rules: { healMult: 0 },
    sourceMult: 2.2,
  },
  {
    id: "can",
    name: "天残契",
    seal: "残",
    desc: "残躯入界,以七成气血开每一场",
    ruleText: "每场开局气血 70% · 道源 ×1.7",
    rules: { playerStartHpPct: 0.7 },
    sourceMult: 1.7,
  },
  {
    id: "ji",
    name: "疾战契",
    seal: "疾",
    desc: "天不予时,拖过廿五回合即败",
    ruleText: "回合上限 25 · 道源 ×2.0",
    rules: { maxRounds: 25 },
    sourceMult: 2.0,
  },
  {
    id: "gu",
    name: "孤剑契",
    seal: "孤",
    desc: "只携一件法宝,余者封于界外",
    ruleText: "仅第一件法宝随身 · 道源 ×1.6",
    special: "soloArtifact",
    sourceMult: 1.6,
  },
  {
    id: "wushang",
    name: "无伤契",
    seal: "完",
    desc: "每场战罢气血须存八成,否则契毁人出",
    ruleText: "每场战后气血 ≥80% · 道源 ×3.0",
    special: "endHp80",
    sourceMult: 3.0,
  },
  {
    id: "ni",
    name: "逆命契",
    seal: "逆",
    desc: "封印你最擅长的道路,以余技破界",
    ruleText: "主流派核心词条尽数封印 · 道源 ×4.0",
    special: "sealCore",
    sourceMult: 4.0,
  },
  {
    id: "duanyuan",
    name: "断源契",
    seal: "缺",
    desc: "天地灵机被截,护盾难凝",
    ruleText: "护盾上限减半(50%) · 道源 ×1.8",
    rules: { shieldCapRatio: 0.5 },
    sourceMult: 1.8,
  },
  {
    id: "jilei",
    name: "殛雷契",
    seal: "雷",
    desc: "天雷封界,每一记皆重三分 —— 挨打更疼,却只得些许道源",
    ruleText: "敌方攻击 +20% · 道源 ×1.9",
    rules: { enemyAtkMult: 1.2 },
    sourceMult: 1.9,
  },
  {
    id: "huitian",
    name: "晦天契",
    seal: "晦",
    desc: "天机晦暗,敌将会心之兆频现 —— 与棘手的暴击周旋,换些许道源",
    ruleText: "敌方会心率 +25% · 道源 ×1.8",
    rules: { enemyExtraMods: { critRate: 0.25 } },
    sourceMult: 1.8,
  },
];

export function pactDef(id: string): PactDef | undefined {
  return PACTS.find((p) => p.id === id);
}
