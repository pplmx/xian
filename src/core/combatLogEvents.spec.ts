/**
 * 战报要把每一类事件都说出来 —— 闪避、会心、打断、相位。
 *
 * ## 由来（第 212 轮，接上一轮那条线）
 *
 * 上一轮补了相位那句（`【X】狂化!`）。这一轮去看**其余几类即时事件**:
 *
 * ```ts
 * push("crit",  side, `${aName}${verb},会心一击!${tName}受创甚重。`, dmg);
 * push(opts.isSkill ? "skill" : "atk", side, `${aName}${verb},击中${tName}。`, dmg);
 * push("dodge", side, `${aName}施展${label},却被${tName}身形一晃避开。`);
 * push("info",  side, `${name}气血逆涌,这一招被生生打断。`);
 * ```
 *
 * 实测（把 rng 钉成 0 逼出必暴击 / 必闪避）:
 *
 * ```text
 * 会心一击  81 条
 * 身形一晃  41 条
 * ```
 *
 * **机制与文本都对。** 而全仓 spec 里对 `身形一晃` / `会心一击` 零覆盖 ——
 * 与上一轮的相位那句同一种缺口。
 *
 * ## 为什么这算一条判据而不是四条
 *
 * 它们说的是同一件事:**战报读得出刚才发生了什么**。分开写会让「加一类事件忘了加文本」
 * 仍然漏过去；合在一起则要求「每一类事件都至少有一种可读的文本」。
 *
 * ## 这条判据守什么
 *
 * 用 rng 钉死的战斗，逐类核那些文本真的出现在日志里:
 *
 * ① 普通命中（`击中`）
 * ② 会心（`会心一击`）
 * ③ 闪避（`避开` 或 `晃开`）
 * ④ 相位（`label` 那一声，见 `phaseAnnounce.spec` —— 这里只核它有）
 *
 * 不钉措辞 —— 换一种说法也行，只要那件事说得出来。
 *
 * ## 故障注入
 *
 * 删掉 `push("dodge", …)` → 「闪避说得出来」红。
 * 把 `push("crit", …)` 的文案换成普通命中的文案 → 「会心一击说得出来」红。
 * 删掉那行 `push(opts.isSkill ? …)` → 「普通命中说得出来」红。
 */
import { describe, expect, it } from "vite-plus/test";
import { resolveCombat } from "./combat";
import { RandomService } from "@/utils/random";
import { gn } from "@/utils/gnum";
import type { CombatantSnap } from "@/types";

function snap(
  name: string,
  isPlayer: boolean,
  mods: Record<string, number> = {},
  phases?: CombatantSnap["phases"],
): CombatantSnap {
  return {
    name,
    icon: "x",
    isPlayer,
    speed: 10,
    attack: gn(100),
    defense: gn(10),
    maxHp: gn(5_000),
    mods,
    skills: [],
    ...(phases ? { phases } : {}),
  };
}

/** rng 恒为 0 —— `chance()` 恒真，于是暴击 / 闪避必出 */
const always = () => new RandomService(() => 0);

/**
 * rng 恒为 0.99 —— `chance()` 恒假，于是**不会暴击、不会闪避**。
 *
 * 第一版核「普通命中」时也用了 `always()`，于是每一击都是会心，
 * 战报里根本没有「击中」那一支（实测前五行全是「会心一击」）。
 * 那不是产品问题，是**构造把要测的那一支排除了**。
 */
const never = () => new RandomService(() => 0.99);

function logTexts(r: ReturnType<typeof resolveCombat>): string[] {
  return r.log.map((l) => l.text ?? "").filter(Boolean);
}

describe("战报 · 每一类事件都要说得出", () => {
  it("前提:那几场战斗都打起来了", () => {
    const r = resolveCombat(snap("我", true), snap("敌", false), always());
    expect(r.rounds, "战斗没打起来 —— 前提要重做").toBeGreaterThan(0);
    expect(logTexts(r).length, "战报是空的").toBeGreaterThan(2);
  });

  it("普通命中说得出来", () => {
    /* 用 `never()`：不暴击、不闪避，于是每一击都该走「击中」那一支 */
    const r = resolveCombat(snap("我", true), snap("敌", false), never());
    const hit = logTexts(r).some((t) => /击中/.test(t));
    expect(
      hit,
      "战报里没有任何一条普通的命中描述 —— 玩家看不出双方在打什么。战报开头是:" +
        logTexts(r).slice(0, 3).join(" / "),
    ).toBe(true);
  });

  it("会心一击说得出来", () => {
    const r = resolveCombat(snap("我", true, { critRate: 1 }), snap("敌", false), always());
    const crit = logTexts(r).some((t) => /会心/.test(t));
    expect(
      crit,
      "暴击触发了，而战报里没有「会心一击」一类的话 —— 玩家看到一个更大的数字，" +
        "却不知道那是暴击还是普通伤害",
    ).toBe(true);
  });

  it("闪避说得出来", () => {
    const r = resolveCombat(snap("我", true), snap("敌", false, { dodgeRate: 0.9 }), always());
    const dodge = logTexts(r).some((t) => /避开|晃开|闪开/.test(t));
    expect(
      dodge,
      "闪避触发了，而战报里没有一条说「这一下没打中」—— 玩家看到" +
        "「祭出一记爪击」却没有任何结果，会以为界面漏了一行",
    ).toBe(true);
  });

  it("相位那一声也在（与 phaseAnnounce.spec 同一件事，这里只核有）", () => {
    const boss = snap("首领", false, {}, [
      { hpThreshold: 0.5, modChanges: { damageBonus: 0.5 }, label: "狂化" },
    ]);
    const r = resolveCombat(snap("我", true), boss, always());
    const phase = logTexts(r).some((t) => /狂化/.test(t));
    expect(phase, "相位触发了而战报里没有那一句").toBe(true);
  });
});
