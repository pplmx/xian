/**
 * 战斗解算 · 行为指纹 —— 重构 `packages/engine/src/combat.ts` 的安全网。
 *
 * ## 为什么放在宿主侧
 *
 * 引擎仓与 `packages/engine` 必须同树(`check:engine` 第 ⑧ 步),任何往
 * `packages/engine/src` 里加文件的动作,都得先 `bun run sync:engine` 推到独立仓
 * 才能提交。而**这条判据只验公开行为、不碰引擎内部**,放在宿主同样成立 ——
 * 宿主本来就是引擎的使用者,`import` 走的是包名公开入口。
 *
 * ## 为什么需要它
 *
 * 战斗引擎有几十条语义判据(护盾 / 反击 / 追击 / 三处主权 / 逐位对账),但它们
 * 各自只看一个点。把 `combat.ts` 里 548 行的 `resolve(内部 63 个箭头函数)拆成
 * 几个模块时,最危险的不是"某条判据挂了",而是**判据全绿、整体数值却变了** ——
 * 少一次护盾夹取、多一层四舍五入,几十条点判据一条都照不到。
 *
 * 这里钉的是**指纹**:九组参数覆盖纯数值 / 碾压 / 打不动 / 闪避 / 暴击减伤 /
 * 护盾 / 吸血回复 / 1e200 超大数,每组跑完把
 * `胜负 | 回合数 | 双方血量 | 事件条数 | 事件类型序列` 打成一行,与重构前记下的
 * 那份逐字比对。重构不改行为时它恒绿;改了就当场红。
 *
 * 要改 GOLDEN 请先确认**行为确实该变**(比如调了默认公式),而不是重构顺手改的。
 */
import { describe, expect, it } from "vite-plus/test";
import { createCombatEngine, createRng, type Combatant } from "wanxiang-engine";

/** 造一个参战者:本值走 stats,百分比词条走 mods(引擎两套分开读) */
const mk = (over: {
  id?: string;
  stats?: Record<string, number>;
  mods?: Record<string, number>;
}): Combatant<number> => ({
  id: over.id ?? "x",
  name: over.id ?? "x",
  stats: { hp: 100, maxHp: 100, attack: 10, defense: 5, speed: 1, ...over.stats },
  mods: (over.mods ?? {}) as Combatant<number>["mods"],
});

const CASES: {
  name: string;
  cfg: Parameters<typeof createCombatEngine>[0];
  p: Combatant<number>;
  e: Combatant<number>;
  seed: number;
}[] = [
  { name: "势均力敌", cfg: {}, p: mk({}), e: mk({ id: "e" }), seed: 1 },
  {
    name: "碾压",
    cfg: {},
    p: mk({ stats: { attack: 500, hp: 9999, maxHp: 9999 } }),
    e: mk({ id: "e", stats: { hp: 30, maxHp: 30, defense: 0 } }),
    seed: 2,
  },
  {
    name: "打不动",
    cfg: { maxRounds: 3, minDamageRatio: 0 },
    p: mk({ stats: { attack: 1, hp: 1000, maxHp: 1000 } }),
    e: mk({ id: "e", stats: { hp: 1000, maxHp: 1000, defense: 0 } }),
    seed: 3,
  },
  {
    name: "闪避",
    cfg: { variance: 0 },
    p: mk({}),
    e: mk({ id: "e", mods: { dodgeRate: 0.5 } }),
    seed: 4,
  },
  {
    name: "暴击减伤",
    cfg: { variance: 0 },
    p: mk({ mods: { critRate: 0.5, critDamage: 0.5 } }),
    e: mk({ id: "e", mods: { damageReduction: 0.3 } }),
    seed: 5,
  },
  {
    name: "护盾",
    cfg: { variance: 0, shield: {} },
    p: mk({ mods: { shieldOnStart: 0.5 } }),
    e: mk({ id: "e", mods: { shieldOnStart: 0.3 } }),
    seed: 6,
  },
  {
    name: "吸血回复",
    cfg: { variance: 0 },
    p: mk({ mods: { lifesteal: 0.2, regen: 5 } }),
    e: mk({ id: "e", stats: { hp: 300, maxHp: 300 } }),
    seed: 7,
  },
  {
    // 不配 maxRounds:双方都极硬,必然跑满**默认**上限 —— 这一组专门盯默认值
    name: "默认回合上限",
    cfg: { variance: 0, minDamageRatio: 0.05 },
    p: mk({ stats: { attack: 10, hp: 1e6, maxHp: 1e6, defense: 1e6 } }),
    e: mk({ id: "e", stats: { attack: 10, hp: 1e6, maxHp: 1e6, defense: 1e6 } }),
    seed: 9,
  },
  {
    name: "超大数值",
    cfg: { variance: 0 },
    p: mk({ stats: { attack: 1e200, hp: 1e200, maxHp: 1e200 } }),
    e: mk({ id: "e", stats: { attack: 1e200, hp: 1e200, maxHp: 1e200, defense: 1e200 } }),
    seed: 8,
  },
];

const fingerprint = (): string =>
  CASES.map((c) => {
    const engine = createCombatEngine(c.cfg);
    const r = engine.resolve(c.p, c.e, createRng(c.seed));
    const kinds = r.events.map((ev) => ev.kind).join(",");
    return `${c.name}|win=${r.win}|rounds=${r.rounds}|php=${Number(r.playerHp)}|ehp=${Number(r.enemyHp)}|n=${r.events.length}|${kinds}`;
  }).join("\n");

const GOLDEN = [
  `势均力敌|win=true|rounds=16|php=1.0844298760096285|ehp=0|n=32|hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,end`,
  `碾压|win=true|rounds=1|php=9999|ehp=0|n=2|hit,end`,
  `打不动|win=false|rounds=3|php=980.2609549929698|ehp=996.9978911169619|n=7|hit,hit,hit,hit,hit,hit,end`,
  `闪避|win=false|rounds=15|php=0|ehp=53.333333333333314|n=31|hit,hit,dodge,hit,hit,hit,dodge,hit,hit,hit,hit,hit,hit,hit,dodge,hit,dodge,hit,dodge,hit,dodge,hit,dodge,hit,hit,hit,dodge,hit,hit,hit,end`,
  `暴击减伤|win=true|rounds=14|php=13.333333333333327|ehp=0|n=28|hit,hit,crit,hit,crit,hit,hit,hit,crit,hit,crit,hit,hit,hit,crit,hit,crit,hit,crit,hit,hit,hit,hit,hit,crit,hit,hit,end`,
  `护盾|win=true|rounds=20|php=23.33333333333335|ehp=0|n=44|shield,shield,hit,hit,hit,hit,hit,hit,hit,hit,shieldbreak,hit,hit,hit,hit,hit,hit,hit,shieldbreak,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,end`,
  `吸血回复|win=false|rounds=19|php=0|ehp=173.33333333333334|n=57|hit,hit,hit,lifesteal,hit,hit,lifesteal,hit,hit,lifesteal,hit,hit,lifesteal,hit,hit,lifesteal,hit,hit,lifesteal,hit,hit,lifesteal,hit,hit,lifesteal,hit,hit,lifesteal,hit,hit,lifesteal,hit,hit,lifesteal,hit,hit,lifesteal,hit,hit,lifesteal,hit,hit,lifesteal,hit,hit,lifesteal,hit,hit,lifesteal,hit,hit,lifesteal,hit,hit,lifesteal,hit,end`,
  `默认回合上限|win=false|rounds=30|php=999985|ehp=999985|n=61|hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,hit,end`,
  `超大数值|win=false|rounds=1|php=0|ehp=5e+199|n=3|hit,hit,end`,
].join("\n");

describe("战斗解算 · 行为指纹(重构安全网)", () => {
  it("九组参数下的胜负/血量/事件序列逐字不变", () => {
    expect(fingerprint()).toBe(GOLDEN);
  });
});
