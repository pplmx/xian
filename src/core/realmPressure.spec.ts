import { describe, expect, it } from "vite-plus/test";
import { REALMS } from "@/data/realms";
import { applyRealmPressure, realmPressure, REALM_PRESSURE_CAP_GAP } from "./realmPressure";
import { makeEnemySnap, mortalFoeOriginFromParts, resolveCombat } from "./combat";
import type { CombatantSnap, EnemyDef } from "@/types";
import { mulN, ratio } from "@/utils/gnum";
import { RandomService, mulberry32 } from "@/utils/random";

const DEF: EnemyDef = {
  id: "pressure_dummy",
  name: "试压石人",
  icon: "x",
  family: "puppet",
  tier: 8,
  hpMult: 1,
  atkMult: 1,
  defMult: 1,
  speed: 1,
  skills: [],
};

describe("境界压制 · 差境越多越重，但有封顶", () => {
  it("同境与高境无压制；低一小境立即生效", () => {
    expect(realmPressure(3, 3)).toMatchObject({ active: false, gap: 0, enemyScale: 1 });
    expect(realmPressure(4, 3)).toMatchObject({ active: false, gap: 0, enemyScale: 1 });
    expect(realmPressure(2, 3)).toMatchObject({ active: true, gap: 1 });
  });

  it("用真实境界名报出差了几境：金丹打元婴是一境，打化神是两境", () => {
    const toYuanying = realmPressure(2, 3);
    expect(toYuanying.playerRealmName).toBe(REALMS[2]!.name);
    expect(toYuanying.targetRealmName).toBe(REALMS[3]!.name);
    expect(toYuanying.gap).toBe(1);
    expect(toYuanying.summary).toContain("金丹");
    expect(toYuanying.summary).toContain("元婴");
    expect(toYuanying.summary).toContain("境界差 1");

    const toHuashen = realmPressure(2, 4);
    expect(toHuashen.gap).toBe(2);
    expect(toHuashen.enemyScale).toBeGreaterThan(toYuanying.enemyScale);
    expect(toHuashen.damageBonus).toBeGreaterThan(toYuanying.damageBonus);
    expect(toHuashen.damageReduction).toBeGreaterThan(toYuanying.damageReduction);
  });

  it("高更多境按封顶档处理，不再无限叠成不可玩硬墙", () => {
    const capped = realmPressure(0, 20);
    expect(capped.gap).toBe(20);
    expect(capped.effectiveGap).toBe(REALM_PRESSURE_CAP_GAP);
    expect(capped.capped).toBe(true);
    expect(capped.enemyScale).toBeCloseTo(1.6, 9);
    expect(capped.damageBonus).toBeCloseTo(0.8, 9);
    expect(capped.damageReduction).toBeCloseTo(0.3, 9);
    expect(realmPressure(1, 20)).toEqual(
      expect.objectContaining({
        enemyScale: capped.enemyScale,
        damageBonus: capped.damageBonus,
        damageReduction: capped.damageReduction,
      }),
    );
  });
});

describe("境界压制接进敌人来源账", () => {
  it("压制是来源明细的一项，增伤减伤从同一份 readout 写入", () => {
    const pressure = realmPressure(2, 4);
    const base = mortalFoeOriginFromParts(8, [{ label: "地界凶险", ratio: 1.1 }]);
    const origin = applyRealmPressure(base, pressure);
    expect(origin.parts.at(-1)).toMatchObject({
      label: "境界压制",
      ratio: pressure.enemyScale,
      damageBonus: pressure.damageBonus,
      damageReduction: pressure.damageReduction,
    });
    expect(origin.ratio).toBeCloseTo(base.ratio * pressure.enemyScale, 9);
    expect(origin.damageBonus).toBeCloseTo(pressure.damageBonus, 9);
    expect(origin.damageReduction).toBeCloseTo(pressure.damageReduction, 9);
    expect(origin.note).toContain("境界压制不封路");
  });

  it("无压制时原样返回，不凭空多一项来源", () => {
    const base = mortalFoeOriginFromParts(8, [{ label: "地界凶险", ratio: 1.1 }]);
    expect(applyRealmPressure(base, realmPressure(8, 8))).toBe(base);
  });

  it("敌人快照真的吃增伤减伤；三维倍率由同一 total 乘给造敌口", () => {
    const pressure = realmPressure(2, 4);
    const base = mortalFoeOriginFromParts(8, [{ label: "地界凶险", ratio: 1.1 }]);
    const origin = applyRealmPressure(base, pressure);
    const plain = makeEnemySnap(DEF, 8, 1.1, base);
    const pressed = makeEnemySnap(DEF, 8, 1.1 * pressure.enemyScale, origin);
    expect(ratio(pressed.attack, plain.attack)).toBeCloseTo(pressure.enemyScale, 9);
    expect(pressed.mods.damageBonus).toBeCloseTo(pressure.damageBonus, 9);
    expect(pressed.mods.damageReduction).toBeCloseTo(pressure.damageReduction, 9);
  });

  it("压制不是硬门槛：战力高过被压后的敌人，跨五境仍能赢；再高也按五境封顶", () => {
    const capped = realmPressure(2, 20);
    const base = mortalFoeOriginFromParts(8, [{ label: "地界凶险", ratio: 1.1 }]);
    const origin = applyRealmPressure(base, capped);
    const enemy = makeEnemySnap(DEF, 8, base.ratio * capped.enemyScale, origin);
    // 快照三维都取“被压制后的敌人”1.5 倍：这是“低境但战力强”的直接对照，
    // 不是在面板境界上给它开门。它必须还打得过，才叫压制而非硬锁。
    const strong: CombatantSnap = {
      name: "越境者",
      icon: "user",
      isPlayer: true,
      attack: mulN(enemy.attack, 1.5),
      defense: mulN(enemy.defense, 1.5),
      maxHp: mulN(enemy.maxHp, 1.5),
      speed: 1.05,
      mods: {},
      skills: [],
    };
    expect(resolveCombat(strong, enemy, new RandomService(mulberry32(7))).win).toBe(true);
    expect(realmPressure(2, 10)).toEqual(
      expect.objectContaining({
        effectiveGap: REALM_PRESSURE_CAP_GAP,
        enemyScale: capped.enemyScale,
        damageBonus: capped.damageBonus,
        damageReduction: capped.damageReduction,
      }),
    );
  });
});
