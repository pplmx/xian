/**
 * 顿悟的两个战斗向选项 —— 谁都不该是唯一解
 *
 * 顿悟是「三选一」:池子里有两条战斗向的(锤炼筋骨 / 凝气护体),一条让你打得更疼,
 * 一条让你更耐打。玩家两边都该想点一下,那才叫选。
 *
 * 但这两条原先是**同一个意思、差 3.4 倍的分量**:
 *   · 锤炼筋骨 = 伤害增幅 +15% —— 纯乘数,输出 ×1.15;
 *   · 凝气护体 = 防御加成 +12% —— 它不走乘法,走 `攻击²/(攻击+防御)` 那条曲线。
 *     攻防比一变,实际减伤就变:玩家防御 = 敌人攻击的一半时只有 3.8%,
 *     防御等于攻击时才 5.7%。**名义 12%,到手三四个点。**
 *
 * 于是「二选一」实际只有一个值得点 —— 面板写着两件事,数字上只有一件。
 *
 * 判据不看 12/15 这两个名义值(那正是会撒谎的地方),而是**拿真引擎打一场**,
 * 把两个选项各自换算成同一把尺子上的倍数:
 *   输出倍数   = 带 buff 打出的总伤害 / 不带
 *   生存倍数   = 不带时承受的总伤害 / 带 buff 承受的
 * 两个都是「某一侧流量的乘数」,可以直接比。
 *
 * 每条用例都先自证「这判据认得出坏样本」:防御加成那一路、以及一个离谱的增伤,
 * 必须真的落在带外 —— 否则带宽只是装饰。
 */
import { describe, expect, it } from "vite-plus/test";
import { createCombatEngine, createRng } from "wanxiang-engine";
import { buffDef } from "@/data/buffs";
import { ENLIGHTENMENT_OPTIONS } from "@/data/earlyGame";
import type { BuffDef, StatMods } from "@/types";

/** 打固定回合数,谁都不死 —— 量的是流量,不是胜负 */
const ROUNDS = 40;
/** 血做成极大值:40 回合打不掉,于是「剩余血量」直接读出双方各自造成的总伤害 */
const BIG = 1e9;

/**
 * 一对固定的对手。攻 1000 / 防 500 对 攻 600 / 防 600 ——
 * 玩家防御是敌人攻击的八成,这是从中期战斗里取的常见一档,
 * 也正是「防御加成最不值钱」的那一段(见下方自证里那三个数)。
 *
 * `defenseMul` 只给自证用:百分比词条(防御加成)在真实链路里是**由 finalStats
 * 折进基础防御**的(属性定义上的 `appliesTo`),战斗层拿到的是折好的 `stats.defense`。
 * 所以量「防御加成 +12%」不能把 defensePct 塞进 mods —— 引擎根本不会读它
 * (它只在属性解析那一层起作用),那样量出来是 ×1.000,是个假数。
 */
function measure(mods: StatMods, defenseMul = 1): { dealt: number; taken: number } {
  const engine = createCombatEngine({
    maxRounds: ROUNDS,
    variance: 0,
    minDamageRatio: 0,
    critMultiplier: 1,
  });
  const me = {
    id: "p",
    name: "我",
    stats: { hp: BIG, maxHp: BIG, attack: 1000, defense: 500 * defenseMul, speed: 1 },
    mods,
  };
  const foe = {
    id: "e",
    name: "敌",
    stats: { hp: BIG, maxHp: BIG, attack: 600, defense: 600, speed: 1 },
    mods: {},
  };
  const r = engine.resolve(me, foe, createRng(7));
  return { dealt: BIG - Number(r.enemyHp), taken: BIG - Number(r.playerHp) };
}

/** 战斗向的顿悟选项(选项 → 它挂的 buff 定义) */
function combatOptions(): { label: string; def: BuffDef }[] {
  return ENLIGHTENMENT_OPTIONS.filter((o) => o.type === "combat" && o.buffId).map((o) => ({
    label: o.label,
    def: buffDef(o.buffId!)!,
  }));
}

/**
 * 选项在**真实结算**里的两个倍数。
 *
 * 增伤那一路量「输出」,减伤那一路量「承受」——侧不同,但都是乘数,量纲一致。
 */
function effectOf(def: BuffDef): { offense: number; survivability: number } {
  const base = measure({});
  const buffed = measure(def.mods);
  return {
    offense: buffed.dealt / base.dealt,
    survivability: base.taken / buffed.taken,
  };
}

/** 「同量级」的带宽:1.10 ~ 1.25 倍,且两者相差不超过 0.05 */
const BAND = [1.1, 1.25] as const;
const MAX_GAP = 0.05;

describe("顿悟 · 两个战斗向选项同量级", () => {
  const opts = combatOptions();

  it("战斗向的选项恰好两条(池子变了,判据要跟着改)", () => {
    expect(opts.map((o) => o.label).sort()).toEqual(["凝气护体", "锤炼筋骨"]);
  });

  it("两条各挂一个**纯乘数**词条 —— 实际收益不许取决于玩家自己的攻防比", () => {
    // 「防御加成」这类百分比词条走除法曲线,战况一变收益就变;赠礼该是可预期的
    const PURE_MULTIPLIER = new Set(["damageBonus", "damageReduction"]);
    for (const { label, def } of opts) {
      const keys = Object.keys(def.mods);
      expect(keys, `「${label}」挂了不止一个词条,倍数就没法比`).toHaveLength(1);
      expect(
        PURE_MULTIPLIER.has(keys[0]!),
        `「${label}」挂的是 ${keys[0]},它不是纯乘数 —— 实际收益会随攻防比漂`,
      ).toBe(true);
    }
  });

  it("两条的时长相同 —— 不然「同量级」是在比不同时长的东西", () => {
    const durations = new Set(opts.map((o) => o.def.durationSec));
    expect(durations.size).toBe(1);
  });

  it("各自的倍数都落在 1.10~1.25,且两者相差不超过 0.05", () => {
    const rows = opts.map(({ label, def }) => {
      const e = effectOf(def);
      return { label, ...e, mult: def.mods.damageBonus ? e.offense : e.survivability };
    });
    // 把量出来的数摊在测试输出里:改数值时先看这张表,比看报错快
    console.log(
      [
        "  选项        输出倍数   生存倍数",
        ...rows.map((r) => {
          return `  ${r.label}      ×${r.offense.toFixed(3)}     ×${r.survivability.toFixed(3)}`;
        }),
      ].join("\n"),
    );
    for (const r of rows) {
      expect(
        r.mult,
        `「${r.label}」的实际倍数 ${r.mult.toFixed(3)} 不在 ${BAND.join("~")} 带内`,
      ).toBeGreaterThanOrEqual(BAND[0]);
      expect(
        r.mult,
        `「${r.label}」的实际倍数 ${r.mult.toFixed(3)} 超出 ${BAND[1]}`,
      ).toBeLessThanOrEqual(BAND[1]);
    }
    const [a, b] = rows.map((r) => r.mult) as [number, number];
    expect(
      Math.abs(a - b),
      `两个选项差了 ${Math.abs(a - b).toFixed(3)} 倍——选择退化成唯一解`,
    ).toBeLessThanOrEqual(MAX_GAP);
  });
});

describe("判据自证 · 认得出该出局的写法", () => {
  it("防御加成 12% 出局 —— 名义 12%,到手五个半点", () => {
    /*
     * 这就是被换掉的那一版。它同时是「为什么不能用防御加成」的证明。
     *
     * 关键在于**怎么量**:百分比词条由 finalStats 按 `appliesTo` 折进基础防御
     * (玩家面板上的防御已经是折好的),战斗层只读 `stats.defense`。
     * 所以这里抬基础防御 12%,而不是把 defensePct 塞进 mods —— 塞进去引擎不读,
     * 量出来是 ×1.000,那是个假数(第一版就这么写错了,注入时才看出来)。
     */
    const base = measure({});
    const buffed = measure({}, 1.12);
    const survivability = base.taken / buffed.taken;
    // 12% 防御加成本该值 12%,实际只有 5.45% —— 而且攻防比越悬殊,它越不值钱
    expect(survivability).toBeCloseTo(1.055, 2);
    expect(survivability).toBeLessThan(BAND[0]);
  });

  it("离谱的增伤也出局 —— 带宽不是只拦一边", () => {
    const e = effectOf({
      id: "big",
      name: "离谱",
      kind: "blessing",
      durationSec: 600,
      desc: "",
      mods: { damageBonus: 0.5 },
      icon: "sword",
    } as BuffDef);
    expect(e.offense).toBeGreaterThan(BAND[1]);
  });

  it("空 buff 的两个倍数都是 1 —— 量出来的不是常数", () => {
    const e = effectOf({
      id: "none",
      name: "空",
      kind: "blessing",
      durationSec: 600,
      desc: "",
      mods: {},
      icon: "sword",
    } as BuffDef);
    expect(e.offense).toBeCloseTo(1, 6);
    expect(e.survivability).toBeCloseTo(1, 6);
  });
});
