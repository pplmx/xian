/** 天道契约(Phase 21)—— 玩家主动签下的不公平规则,风险换道源 */
import type { PactDef } from "@/types";
import { PACT_END_HP_FLOOR } from "@/data/constants";

/**
 * 不立契约时的道源倍率。
 *
 * 界面那张选项表里「不立契约」一行也写着倍率(「道源 ×1.0」),它必须与
 * 结算同源 —— 结算里没有 pact 时走 `pact?.sourceMult ?? 1`,这里就写成 1。
 * 两处各写一个字面量,改口径时必有一处撒谎。
 */
export const NO_PACT_MULT = 1;

export const PACTS: PactDef[] = [
  {
    id: "xue",
    name: "血契",
    seal: "血",
    desc: "此行不得回血,伤势只进不出",
    ruleText: "一切治疗无效",
    rules: { healMult: 0 },
    sourceMult: 2.2,
  },
  {
    id: "can",
    name: "天残契",
    seal: "残",
    desc: "残躯入界,以七成气血开每一场",
    ruleText: "每场开局气血 70%",
    rules: { playerStartHpPct: 0.7 },
    sourceMult: 1.7,
  },
  {
    id: "ji",
    name: "疾战契",
    seal: "疾",
    desc: "天不予时,拖过廿五回合即败",
    ruleText: "回合上限 25",
    rules: { maxRounds: 25 },
    sourceMult: 2.0,
  },
  {
    id: "gu",
    name: "孤剑契",
    seal: "孤",
    desc: "只携一件法宝,余者封于界外",
    ruleText: "仅第一件法宝随身",
    special: "soloArtifact",
    sourceMult: 1.6,
  },
  {
    id: "wushang",
    name: "无伤契",
    seal: "完",
    desc: `每场战罢气血须存 ${PACT_END_HP_FLOOR * 100}% 以上,否则契毁人出`,
    // 文案的百分比与判定阈值共读 PACT_END_HP_FLOOR:改那一枚,这句话跟着改
    ruleText: `每场战后气血 ≥${PACT_END_HP_FLOOR * 100}%`,
    special: "endHp80",
    sourceMult: 3.0,
  },
  {
    id: "ni",
    name: "逆命契",
    seal: "逆",
    desc: "封印你最擅长的道路,以余技破界",
    ruleText: "主流派核心词条尽数封印",
    special: "sealCore",
    sourceMult: 4.0,
  },
  {
    id: "duanyuan",
    name: "断源契",
    seal: "缺",
    desc: "天地灵机被截,护盾难凝",
    ruleText: "护盾上限减半(50%)",
    rules: { shieldCapRatio: 0.5 },
    sourceMult: 1.8,
  },
  {
    id: "jilei",
    name: "殛雷契",
    seal: "雷",
    desc: "天雷封界,每一记皆重三分 —— 挨打更疼,却只得些许道源",
    ruleText: "敌方攻击 +20%",
    rules: { enemyAtkMult: 1.2 },
    sourceMult: 1.9,
  },
  {
    id: "huitian",
    name: "晦天契",
    seal: "晦",
    desc: "天机晦暗,敌将会心之兆频现 —— 与棘手的暴击周旋,换些许道源",
    ruleText: "敌方会心率 +25%",
    rules: { enemyExtraMods: { critRate: 0.25 } },
    sourceMult: 1.8,
  },
  {
    id: "yinying",
    name: "蔽影契",
    seal: "影",
    desc: "妖影幢幢,敌踪若有若无 —— 与缥缈的闪避周旋,换些许道源",
    ruleText: "敌方闪避 +18%",
    rules: { enemyExtraMods: { dodgeRate: 0.18 } },
    sourceMult: 1.8,
  },
  {
    id: "zhuefeng",
    name: "追风契",
    seal: "疾",
    desc: "敌如飞蝗,掠影而过 —— 与风一般的速度周旋,换些许道源",
    ruleText: "敌方速度 +20%",
    rules: { enemyExtraMods: { speed: 0.2 } },
    sourceMult: 1.9,
  },
  {
    id: "shihun",
    name: "噬魂契",
    seal: "噬",
    desc: "敌如饿鬼,吸食气血而战 —— 与难缠的吸血周旋,换些许道源",
    ruleText: "敌方吸血 +15%",
    rules: { enemyExtraMods: { lifesteal: 0.15 } },
    sourceMult: 1.8,
  },
  {
    id: "liandie",
    name: "连叠契",
    seal: "连",
    desc: "敌如狂潮,连叠不绝 —— 与滔滔的连击周旋,换些许道源",
    ruleText: "敌方连击率 +18%",
    rules: { enemyExtraMods: { comboRate: 0.18 } },
    sourceMult: 1.8,
  },
];

export function pactDef(id: string): PactDef | undefined {
  return PACTS.find((p) => p.id === id);
}

/**
 * 契约规则的一整句 —— 规则本体 + 道源倍率。
 *
 * 倍率从前在 `ruleText` 里又写了一遍(「一切治疗无效 · 道源 ×2.2」),与
 * `sourceMult: 2.2` 是同一个数。调平衡时改了 `sourceMult`,那句文案就原地撒谎,
 * 而它正是玩家签契约前唯一会读的一行。
 *
 * 现在只留 `sourceMult` 一份:后半句由它现算。`ruleText` 回归「规则本体」。
 */
export function pactRuleLine(def: PactDef): string {
  // 倍率保留一位小数:1.6 / 2.0 / 2.2 都写成「×2.0」这种样式,与既有文案一致
  return `${def.ruleText} · 道源 ×${def.sourceMult.toFixed(1)}`;
}
