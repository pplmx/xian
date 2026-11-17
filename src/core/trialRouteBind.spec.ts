/**
 * 逆旅契的下一批，该动玩法面而不是只动战斗。
 *
 * ## 由来（第 470 轮）
 *
 * `trialMotivation.spec` 自己诊断出这个问题:
 *
 * ```text
 * 契约不是纯罚款:它真的让玩家需要换打法(首尾构筑最大拉开 63.8pp)。
 * 但改变只发生在战斗内部,一世的结构没变 ——
 * 同样的区域、同样的顺序、同样的目标。
 * 故要提高动机,该扩的是玩法面(历练/物品/顺序/目标),不是补奖励
 * ```
 *
 * 同一份判据还给了边界:
 *
 * ```text
 * 可动(Rule Space)   CombatRules · 历练路线 · 可用物品 · 解锁顺序 · 本世目标
 * 不可动             StatMods · Economy · DaoFruit · Insight
 * ```
 *
 * 现有四份契(孤行/疾行/残躯/逆锋)**全部只填 `rules`**(CombatRules)。
 * 这一轮加第五份,它不碰战斗规则,只改**这一世走几段路**。
 *
 * ## 为什么「缩短路线」是纯逆境
 *
 * `isPurelyAdverse` 守的是「不许让战斗变容易」。而少走两段路:
 * - 少拿两段的敌人与首领掉落;
 * - 而每段的强度**不变** —— 所以同样的层级要在更少的段里爬完。
 *
 * 它不是奖励,也不是减难,是一世的形状变了。
 *
 * ## 判据
 *
 * ① 新契带上 `routeStages` 字段,且值域合法(2..6 —— 少于 2 不成路线,多于 6 是加长);
 * ② 反差:它**不填 rules** —— 若哪天有人给它塞一条战斗规则,说明它退回了老路;
 * ③ 契约生效后,世界路线真的变短,且层级上限不被拉低(短而硬,不是短而软)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LIFE_TRIALS } from "@/data/lifeTrials";
import { generateMortalWorld } from "./mortalWorldGen";
import { enemyDef } from "@/data/enemies";

describe("逆旅契 · 新的一批该动玩法面", () => {
  it("① 有一份只改路线长度的契，值域合法", () => {
    const routeTrials = LIFE_TRIALS.filter((t) => t.routeStages !== undefined);
    expect(routeTrials.length, "没有一份契约改路线长度 —— 玩法面还是没动").toBeGreaterThan(0);
    for (const t of routeTrials) {
      expect(t.routeStages!, `${t.name} 的 routeStages 越界`).toBeGreaterThanOrEqual(2);
      expect(t.routeStages!, `${t.name} 的 routeStages 越界`).toBeLessThanOrEqual(6);
    }
  });

  it("② 反差：它不填 rules —— 动了战斗规则就退回老路", () => {
    const routeTrials = LIFE_TRIALS.filter((t) => t.routeStages !== undefined);
    for (const t of routeTrials) {
      const ruleKeys = Object.keys(t.rules ?? {});
      expect(
        ruleKeys,
        `${t.name} 既改路线又改战斗规则 —— 这一批要证明的是「不碰 CombatRules 也能改玩法」`,
      ).toEqual([]);
    }
  });

  it("③ 生效后路线真的变短，且层级上限没被拉低", () => {
    const t = LIFE_TRIALS.find((x) => x.routeStages !== undefined)!;
    const before = generateMortalWorld(9973);
    const after = generateMortalWorld(9973, t.routeStages);
    expect(after.chain.length, "路线没变短").toBeLessThan(before.chain.length);
    expect(after.chain.length, "段数与契上写的不符").toBe(
      Math.min(t.routeStages!, before.chain.length),
    );
    /*
     * 短而硬:终点层级必须原样保留 —— 否则是「短而软」。
     */
    const topBefore = Math.max(...before.chain.map((p) => p.tier));
    const topAfter = Math.max(...after.chain.map((p) => p.tier));
    expect(topAfter, "压段顺手把终点也拉低了 —— 那不是变难，是变简单").toBe(topBefore);
  });

  it("⑤ 历练页那句「本世每一场历练都按此算」不许套在改路线的契上", () => {
    /*
     * 第 470 轮之前，那一行是硬编码的后半句:
     *
     * ```html
     * <p>{{ activeTrial.ruleText }} —— 本世每一场历练都按此算。</p>
     * ```
     *
     * 对四份战斗契都对。而断径契**一场都不改**，它改的是这一世有几段路 ——
     * 套上那句之后，玩家读到的是「路线只有三段，而且每一场都按此算」，
     * 后者纯属虚构。
     *
     * 故改成 `trialScopeText(def)`，只看数据:有战斗规则说「每一场」，
     * 只压路线说「这几段路」。
     */
    const src = readFileSync(resolve(__dirname, "../views/AdventureView.vue"), "utf-8");
    expect(src, "历练页又把后半句写死了 —— 改路线的契会被读成「每一场都按此算」").toContain(
      "trialScopeText(activeTrial)",
    );
    expect(src, "那句硬编码的「每一场」还在模板里").not.toMatch(
      /activeTrial\.ruleText \}\} —— 本世每一场历练都按此算/,
    );
  });

  it("④ 压段之后，敌人与首领仍与所在段的层级相称", () => {
    /*
     * ## 这一条是被自己的第一版实现逼出来的
     *
     * 最初的做法是「生成完之后截尾」，随后又改成「截尾 + 把层级重摊到原跨度上」。
     * 后者的实测:
     *
     * ```text
     *   后: 落霞谷(2) 青云山麓(11) 古战场遗迹(17)
     *   青云山麓 t11: 敌差[7,8,8] 首领差 10
     *   古战场遗迹 t17: 敌差[10,9,11] 首领差 11
     * ```
     *
     * 终点保住了，但敌人与首领是按**原层级**挑的 —— 这正是第 461/462 轮
     * 修掉的那个形状(名与实不符)，被我重新制造了一遍。
     *
     * 故段数必须**进生成器**:层级表先压,再挑地界/敌人/首领。
     * 这一条守着它不许退回事后改 data 的做法。
     */
    const t = LIFE_TRIALS.find((x) => x.routeStages !== undefined)!;
    const bad: string[] = [];
    for (const seed of [9973, 1234, 777, 31, 606]) {
      for (const p of generateMortalWorld(seed, t.routeStages).chain) {
        for (const e of p.enemies) {
          const gap = Math.abs((enemyDef(e)?.tier ?? 0) - p.tier);
          if (gap > 4) bad.push(`seed ${seed} 的「${p.name}」(t${p.tier}) 里 ${e} 差了 ${gap} 级`);
        }
        const bg = Math.abs((enemyDef(p.boss)?.tier ?? 0) - p.tier);
        if (bg > 5) bad.push(`seed ${seed} 的「${p.name}」(t${p.tier}) 首领差了 ${bg} 级`);
      }
    }
    expect(bad, "压段把敌人/首领与层级的对应打散了：" + bad.slice(0, 3).join("；")).toEqual([]);
  });
});
