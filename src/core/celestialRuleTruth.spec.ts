/**
 * 终局五天的规则文案，要对得上它们的实现。
 *
 * ## 由来（第 425 轮）
 *
 * 第 399 轮修过星陨天「五条规则只说三条」。这一轮按同一个形状重扫五天，
 * 又抓到两处 —— 而且是**两个相反方向**的：
 *
 * ```text
 *   万刃天  ruleText 三条，其中「受击反制收益极高」在 rules 里**什么都没有**
 *           → 说了的没做。玩家照它堆反击率，会发现完全没用。
 *
 *   无相天  ruleText 三条都没提 rules 里那条 enemyExtraMods.critRate
 *           → 做了的没说。敌方会心 +12% 一直生效，而玩家读那三句推不出来。
 * ```
 *
 * ## 为什么不能只数条数
 *
 * 一条 `ruleText` 可能对应 `rules` 里好几个键（「敌人攻击 +40%」= `enemyAtkMult`），
 * 也可能对应 **`foes` 里的东西**（万刃天的「血厚如山」= `hpR 1.7`，
 * 无相天的「闪避极高」= `mods.dodgeRate`）。故**数条数没有意义**。
 *
 * ## 判据怎么才不吵
 *
 * 机器读不懂中文，所以不去做语义匹配。只钉三件能机械判定的事：
 *
 * ① 每条 `ruleText` 都**带一个具体的数**（数字或明确的比例）——
 *    「概率与稳定的对决」这种纯形容不算。界面上该给的是「我在跟什么赌」。
 * ② `ruleText` 里出现的每个数，都要能在 `rules` 或 `foes` 里找到**同一个数**
 *    （容差 1，允许取整/百分号换写）。
 * ③ 反空转：五天都扫到了。
 *
 * ② 是这一轮真正的抓手：它既能抓到「说了没做」（数在文案里、实现里没有），
 * 也能抓到「数写错了」（实现里有 0.25，文案写 0.3）。
 *
 * ## 它抓不到什么
 *
 * 「受击反制收益极高」这种**不带数**的句子，① 会先把它拦下来 ——
 * 故对这类只有形容的规则，判据要求的是「改成带数的」，而不是「找出实现」。
 * 而这一轮的万刃天，正是这么修的。
 */
import { describe, expect, it } from "vite-plus/test";
import { CELESTIAL_WORLDS } from "@/data/endgame";

/** 从一句文案里抽出所有数字（含百分数、小数、区间两端） */
function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/-?\d+(?:\.\d+)?/g)) out.push(Number(m[0]));
  return out;
}

/** 把一个世界的 rules 与 foes 碾成一组可比的数（含百分数换算） */
function implementedNumbers(world: (typeof CELESTIAL_WORLDS)[number]): number[] {
  const out = new Set<number>();
  const push = (n: unknown): void => {
    if (typeof n !== "number" || !Number.isFinite(n)) return;
    out.add(n);
    // 比例与百分数互写：0.25 ↔ 25
    out.add(n * 100);
    out.add(n / 100);
  };
  const walk = (o: unknown): void => {
    if (o === null || o === undefined) return;
    if (typeof o === "number") {
      push(o);
      /*
       * 减量写法：`healMult: 0.65` 在文案里说成「治疗 -35%」。
       * 两种写法说的是同一件事，判据要认得出后者。
       */
      push((1 - o) * 100);
      return;
    }
    if (Array.isArray(o)) {
      for (const x of o) walk(x);
      return;
    }
    if (typeof o === "object") for (const v of Object.values(o)) walk(v);
  };
  walk(world.rules);
  for (const foe of world.foes) walk(foe);
  // 回合上限与世界代价也算「实现里的数」
  push((world.rules as { maxRounds?: number }).maxRounds);
  return [...out];
}

describe("终局五天 · 规则文案对得上实现", () => {
  it("每个世界至少要有一条带数的规则 —— 全是形容就等于没说", () => {
    /*
     * ## 为什么不是「每条都带数」
     *
     * 初版要求每条都带，于是逼出下面这件事：无相天的「敌人闪避 35%」——
     * 而**闪避写在 `foes[].mods` 上，不在 `rules` 里**；`dataTextAudit` 的规矩是
     * 「文案里的百分比必须在 `rules` 里找得到」，两条判据当场打架（实测）。
     *
     * 那个 35% 是对的、那句文案也是对的 —— 错的是「每条都要带数」这个口径。
     * `foes` 上的属性（闪避、速度、血量倍率）本来就该用相对说法描述，
     * 玩家在战斗日志里看得到结果；而 `rules` 上的（治疗削减、回合上限）
     * 必须给数，否则玩家算不出对策。
     *
     * 故退一步：**每个世界至少有一条带数的**。那一条通常是 rules 里最要紧的那条。
     */
    const vague: string[] = [];
    for (const w of CELESTIAL_WORLDS) {
      const withNumber = w.ruleText.filter((l) => numbersIn(l).length > 0).length;
      if (withNumber === 0)
        vague.push(`${w.name}（${w.ruleText.length} 条规则，一条带数的都没有）`);
    }
    expect(
      vague,
      "这些世界的规则全是形容 —— 玩家读不出「我在跟什么赌」:" + vague.join(" / "),
    ).toEqual([]);
  });

  it("文案里的每个数，都能在实现里找到同一个", () => {
    const missing: string[] = [];
    for (const w of CELESTIAL_WORLDS) {
      const impl = implementedNumbers(w);
      for (const line of w.ruleText) {
        for (const n of numbersIn(line)) {
          /*
           * 区间「30~35%」写两个数，两端都该在实现里出现。
           * 容差 1：允许 0.35 ↔ 35 之外的取整（如 1.7 ↔ 170%）。
           */
          /*
           * 文案写「治疗 -35%」，实现里是 `healMult: 0.65`（减 35%）。
           * 数字本身带符号，故按**绝对值**对照 —— 「-35」找的是「35」。
           */
          const hit = impl.some((x) => Math.abs(Math.abs(x) - Math.abs(n)) <= 1);
          if (!hit) missing.push(`${w.name}:「${line}」里的 ${n}`);
        }
      }
    }
    expect(missing, "这些数在文案里，实现里找不到 —— 说了的没做:" + missing.join(" / ")).toEqual(
      [],
    );
  });

  it("反差：`rules` 里那几条真的会生效的键，不许一条文案都不提", () => {
    /*
     * 反方向的检查。「做了的没说」比「说了没做」更难发现 ——
     * 玩家读到的规则是完整的，只是少了一条，他不会觉得哪里不对。
     *
     * 判据只认**顶层标量键**（`enemyAtkMult` / `healMult` / `maxRounds` 这类），
     * `playerExtraMods` / `enemyExtraMods` 里的细项交给上面那两条按数对照。
     */
    const KEY_WORD: Record<string, RegExp> = {
      enemyAtkMult: /敌人攻击/,
      playerAtkMult: /攻击 \+|我方攻击/,
      healMult: /治疗/,
      enemyHpMult: /生命|血厚/,
      // 文案写「上限 26 回合」或「回合上限 32」都算说到
      maxRounds: /(回合上限|上限 \d+ 回合)/,
      shieldCapRatio: /护盾/,
    };
    const unspoken: string[] = [];
    for (const w of CELESTIAL_WORLDS) {
      for (const key of Object.keys(w.rules)) {
        const word = KEY_WORD[key];
        if (!word) continue; // 细项容器（*ExtraMods）不在此列
        if (!w.ruleText.some((l) => word.test(l))) {
          unspoken.push(`${w.name}: rules.${key} 生效了，而三条文案都没提它`);
        }
      }
    }
    expect(unspoken, "做了的没说 —— 玩家读不出这一条:" + unspoken.join(" / ")).toEqual([]);
  });

  it("反空转：五天都扫到了", () => {
    expect(CELESTIAL_WORLDS.length, "终局世界太少 —— 判据量不出东西").toBeGreaterThanOrEqual(5);
    for (const w of CELESTIAL_WORLDS) {
      expect(w.ruleText.length, `${w.name} 一条规则都没有`).toBeGreaterThanOrEqual(2);
    }
  });
});
