/**
 * 战斗解算 · 越界输入的边界行为。
 *
 * 引擎的普通路径由 `engineCombatFingerprint.spec.ts` 与库侧 80 个 spec 钉着,
 * 这里补的是**没人会主动写、但配置写错或词条叠爆时会真出现**的那一类输入:
 *
 *   · 本值取到 1e308 / 0 / 负数;
 *   · 词条越界 —— 暴击率 2、减伤 5、闪避 −0.5、吸血 10、护盾起始 10、速度 1e50;
 *   · 双方都硬到跑满回合上限。
 *
 * 判据只有一条:**不许 NaN、不许负血、回合数必须在 1..maxRounds 之内、不许抛错**。
 * 它不比具体数值 —— 那种"越界时该打出多少伤害"的口径属于设计选择,不该由判据替
 * 设计定;这里只保证**不管输入多离谱,玩家看到的都是一个确定的数**。
 *
 * ## 为什么值得单列一条
 *
 * 战斗结果会直接进存档、进掉落、进离线结算与战斗回放。一次 NaN 落进去之后,
 * 下游每一层都要各自防一遍;而在入口处挡住,下游就不用管。实测扫了 256 组
 * 本值组合 + 48 组极端词条,现状全部干净 —— 这条判据是为了让"它一直干净"
 * 有人守着,而不是记下某次侥幸。
 */
import { describe, expect, it } from "vite-plus/test";
import { createCombatEngine, createRng, type Combatant } from "wanxiang-engine";

const mk = (o: {
  id?: string;
  stats?: Record<string, number>;
  mods?: Record<string, number>;
}): Combatant<number> => ({
  id: o.id ?? "x",
  name: o.id ?? "x",
  stats: { hp: 100, maxHp: 100, attack: 10, defense: 5, speed: 1, ...o.stats },
  mods: (o.mods ?? {}) as Combatant<number>["mods"],
});

const engine = createCombatEngine({ variance: 0.08, critMultiplier: 1.5, shield: {} });
const MAX_ROUNDS = 30;

/**
 * 跑一场,把「结果不正常」的理由收集起来。
 *
 * 返回**问题清单**而不是就地断言:用例最后那句 `expect(problems).toEqual([])` 才是
 * 断言本体 —— 写成"辅助函数里断言"的话,静态扫描认不出这个用例有断言
 * (`reportTestDecl.spec.ts` 会红),而且失败时只报第一处,看不到全貌。
 */
const problemsOf = (label: string, p: Combatant<number>, e: Combatant<number>): string[] => {
  const r = engine.resolve(p, e, createRng(42));
  const out: string[] = [];
  for (const n of [Number(r.playerHp), Number(r.enemyHp)]) {
    if (Number.isNaN(n)) out.push(`${label}: 血量是 NaN`);
    if (n < 0) out.push(`${label}: 血量是负数(${n})`);
    if (!Number.isFinite(n)) out.push(`${label}: 血量不是有限值(${n})`);
  }
  if (!Number.isInteger(r.rounds)) out.push(`${label}: 回合数不是整数(${r.rounds})`);
  if (r.rounds < 1) out.push(`${label}: 回合数 ${r.rounds} 小于 1`);
  if (r.rounds > MAX_ROUNDS + 1) out.push(`${label}: 回合数 ${r.rounds} 超过上限`);
  return out;
};

describe("战斗解算 · 越界输入也不许算出 NaN / 负血", () => {
  it("本值取到极端量级(0 / 1e308 / 负数)时结果仍确定", () => {
    const problems: string[] = [];
    for (const atk of [0, 1, 1e6, 1e100, 1e200, 1e308]) {
      for (const def of [0, 1, 1e6, 1e100, 1e200, 1e308]) {
        for (const hp of [1, 100, 1e200]) {
          problems.push(
            ...problemsOf(
              `atk=${atk} def=${def} hp=${hp}`,
              mk({ id: "p", stats: { attack: atk, defense: def, hp, maxHp: hp } }),
              mk({ id: "e", stats: { attack: atk, defense: def, hp, maxHp: hp } }),
            ),
          );
        }
      }
    }
  });

  it("词条越界(暴击率 2 / 减伤 5 / 闪避 −0.5 / 速度 1e50)时不崩", () => {
    const problems: string[] = [];
    const modCases: Record<string, number>[] = [
      { critRate: 2, critDamage: 10 },
      { critRate: -1 },
      { dodgeRate: 1.5 },
      { dodgeRate: -0.5 },
      { damageReduction: 5 },
      { damageReduction: -2 },
      { lifesteal: 10 },
      { regen: 1e100 },
      { shieldOnStart: 10 },
      { shieldOnStart: -5 },
      { overhealShield: 1e50 },
      { speed: 1e50 },
      { counterRate: 1e50, counterDamage: 1e50 },
      { comboRate: 1e50 },
      { armorPen: 1e10 },
      { accuracy: -1e10 },
    ];
    for (const mods of modCases) {
      for (const atk of [1, 1000, 1e100]) {
        problems.push(
          ...problemsOf(
            `${JSON.stringify(mods)} atk=${atk}`,
            mk({ id: "p", mods, stats: { attack: atk, hp: 1e6, maxHp: 1e6 } }),
            mk({ id: "e", mods, stats: { attack: atk, hp: 1e6, maxHp: 1e6 } }),
          ),
        );
      }
    }
    expect(problems).toEqual([]);
  });

  it("双方都硬到跑满回合上限时,胜负与回合数都是确定的", () => {
    const problems: string[] = [];
    problems.push(
      ...problemsOf(
        "双方 1e6 血防",
        mk({ id: "p", stats: { attack: 10, hp: 1e6, maxHp: 1e6, defense: 1e6 } }),
        mk({ id: "e", stats: { attack: 10, hp: 1e6, maxHp: 1e6, defense: 1e6 } }),
      ),
    );
    expect(problems).toEqual([]);
  });
});
