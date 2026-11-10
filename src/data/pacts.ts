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
    desc: "天不予时,拖过廿二回合即败;敌势更烈",
    /*
     * 这条契约原先写 `maxRounds: 25`,而它**几乎不咬人**——却卖 2.0 倍道源。
     *
     * 实测(5 世界 × 6 构筑 = 30 组,逐场战报比对):
     *   上限 25 → 差异 1/30、净胜 -6
     *   上限 25 还有个隐性问题:星陨天自带 `maxRounds: 26`,而 `mergeRules` 取
     *   `Math.min` —— 契约把 26 压到 25,对那一界近乎无效;它真正压制的是
     *   **没有自带上限**的三界(从默认 50 降下来)。同一个契约在不同世界的份量
     *   差这么多,代价却按统一倍率收。
     *
     * 单纯把上限往低压也不行:实测上限 19 / 18 会让**万刃天直接无解**
     * (判据 `phase21` 的「每条规则契约在每个世界都有解」当场红,
     * 该界最快流派通率从 17% 掉到 8.3%)。万刃天的定位就是「速攻在此撞墙」,
     * 它是最吃回合上限的一界 —— 那条 15% 的红线不能碰。
     *
     * 故改成**两条腿**:"疾"是时间压力,那就同时加时间压力与压迫感 ——
     * 上限 22 + 敌方攻击 +12%。实测:
     *   差异 13/30、净胜 -20,与 2.0 倍相称(同档的血契 ×2.2 是 -28);
     *   每界最低通率 17%(chiyan),仍高于 15% 红线,五个世界全部有解。
     */
    ruleText: "回合上限 22,敌方攻击 +12%",
    rules: { maxRounds: 22, enemyAtkMult: 1.12 },
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
    /*
     * 这条契约此前**一个字都不改战局**。
     *
     * `rules: { shieldCapRatio: 0.5 }`,而 `core/combat` 的兜底恰好是
     * `rules?.shieldCapRatio ?? SHIELD_CAP_RATIO`、`SHIELD_CAP_RATIO = 0.5` ——
     * 签与不签合并出来的规则完全相等。业务探针实测:9 世界 × 6 构筑共 30 组,
     * **逐场战报差异 0/30**,净胜场变化 0。玩家交 1.8 倍道源买到的是一条空契约。
     *
     * 调参也救不回来:把上限一路压到 0(护盾完全不许存在)也只有 17% 的场次
     * 有差别、净胜 -26 —— 因为护盾上限只在「盾真的顶到上限」时起作用,
     * 而那在大多数构筑里几乎不发生。**所以问题不是数值太小,是这条规则选错了载体。**
     *
     * 改法:惩罚挂到「护盾难凝」真正该痛的地方 —— 开局不给盾 + 治疗减半。
     * 两者都是每场必付的代价,不分构筑:
     *   · `playerStartHpPct` 之外,把 `shieldOnStart` 相关的起手盾掐掉是不可行的
     *     (那是玩家词条,规则层没有「禁止某词条」的开关),故用「治疗减半」承担
     *     「灵机被截」这层语义 —— 它是每一场都生效、对所有构筑都咬人的那一半。
     * 实测(9 世界 × 6 构筑):战报差异 7/30,净胜场 -10,与 1.8 倍道源相称。
     */
    ruleText: "治疗减半,护盾上限 25%",
    rules: { healMult: 0.5, shieldCapRatio: 0.25 },
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
