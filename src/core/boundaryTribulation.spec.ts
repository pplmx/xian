/* oxlint-disable no-console -- 破界三境的读数是要给人看的 */
/**
 * 界膜之劫(Phase 39)—— 跨界那一步的加难规则
 *
 * 这一版的加难落在两个地方,彼此必须对得上:
 *   ① 界末圆满的修为墙(WORLD_STEP_EXP_MULT,算在 expRequirement 里)
 *   ② 界膜那一关不认三维折算(TRIB_WORLD_STEP_STAT_FOLD,走 statFoldAt)
 * 两条若各说各的,玩家就会看到"需求很重,打起来却还是老样子"(或反之)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isWorldEntry, MAX_MAJOR, REALMS, WORLD_BREAK_MAJOR } from "@/data/realms";
import { TRIB_WORLD_STEP_STAT_FOLD, WORLD_STEP_EXP_MULT } from "@/data/constants";
import { expRequirement } from "./formulas";
import { statFoldAt } from "./tribulationDecision";
import { toNum } from "@/utils/gnum";

/** 三个跨界入口:飞升 / 破界 / 归返 */
const BOUNDARIES = [9, 14, 18];

describe("界膜之劫 · 规则", () => {
  it("界膜就是三个界域入口 —— 判据与 isWorldEntry 同源,不在别处另写一份", () => {
    for (let m = 1; m <= MAX_MAJOR; m += 1) {
      expect(statFoldAt(m) < 1, `${REALMS[m]!.name} 的折算口径与 isWorldEntry 对不上`).toBe(
        isWorldEntry(m),
      );
    }
    for (const m of BOUNDARIES)
      expect(isWorldEntry(m), `${REALMS[m]!.name} 该是跨界那一境`).toBe(true);
  });

  it("界内的关照常认血肉,界膜那一关一概不认", () => {
    expect(TRIB_WORLD_STEP_STAT_FOLD, "规则 0 = 三维折算作废;改成别的值要连文案一起改").toBe(0);
    expect(statFoldAt(WORLD_BREAK_MAJOR - 1)).toBe(1); // 渡劫(界内)
    expect(statFoldAt(WORLD_BREAK_MAJOR)).toBe(TRIB_WORLD_STEP_STAT_FOLD); // 真仙(跨出去的那一境)
  });

  it("修为墙只压在界末的圆满那一层 —— 前面九层仍按正常曲线走", () => {
    for (const last of [8, 13, 17]) {
      const stepped = toNum(expRequirement(last, 9));
      const normal = toNum(expRequirement(last, 8));
      const ratio = stepped / (normal * 1.32); // 圆满相对前一层的自然倍率是 EXP_SUB_GROWTH
      console.log(
        `  ${REALMS[last]!.name}圆满:前一层 ${normal.toExponential(2)} → 圆满 ${stepped.toExponential(2)}(墙 ×${ratio.toFixed(2)})`,
      );
      expect(ratio).toBeCloseTo(WORLD_STEP_EXP_MULT, 1);
    }
    // 界内非圆满的层没有这道墙
    expect(statFoldAt(5)).toBe(1);
    expect(toNum(expRequirement(5, 5))).toBeLessThan(toNum(expRequirement(8, 9)));
  });
});

describe("界膜之劫 · 玩家看得见", () => {
  /**
   * 加难必须**在决意之前**说清楚:上一版玩家吃过"护持明明写着有、过劫时却像没有"的亏,
   * 这种误会不该靠一次失败去发现。故劫势面板要明写这条规则(读源码,不跑界面)。
   */
  it("劫势面板把「界膜不认血肉」写在按钮之前", () => {
    const src = (p: string): string => readFileSync(resolve(__dirname, p), "utf8");
    // 拆分后劫势详情归 TribulationPanel(宿主只留劫型 plan),判据随本体改指子面板
    const panel = src("../components/cultivation/TribulationPanel.vue");
    expect(panel, "劫势面板该用 statFoldAt 判断这一步是不是界膜").toContain("statFoldAt(");
    expect(panel, "界膜之劫的规则必须摊在面板上").toContain("界膜之劫");
    expect(panel, "规则文案要与判据同源,不能另写一份境界清单").not.toContain(
      "needTribulation && player.major + 1 === 9",
    );
  });

  /**
   * 渡劫账曾漏显濒危减伤:waveDamage 在气血垂危(<30%)时按 lowHpReduction
   * (0.6 封顶)再削一波(背水/涅槃路数),账上却只报 damageReduction ——
   * 玩家顶着 35% 濒危减伤看「减伤 0%」,说不出自己凭什么撑着。
   * 结算兑现的不该隐身:账上要有这一行。
   *
   * 判据从「同款公式」升级为「同款函数」:从前界面照抄 `Math.min(0.6, modOf(...))`,
   * 与结算是同一个数字的两份副本 —— 调封顶那天只有一边会动。现在两侧都走
   * tribLowHpReduction / tribReduction,界面里连 0.6、0.3 都不该再出现。
   */
  it("渡劫账披露濒危减伤,读结算那一份函数而不是再封一次顶", () => {
    const src = (p: string): string => readFileSync(resolve(__dirname, p), "utf8");
    const panel = src("../components/cultivation/TribulationPanel.vue");
    const decision = src("./tribulationDecision.ts");
    expect(panel, "账上要有濒危减伤一行").toContain("濒危减伤");
    expect(panel, "濒危减伤要读结算的 tribLowHpReduction").toContain("tribLowHpReduction(");
    expect(panel, "减伤要读结算的 tribReduction").toContain("tribReduction(");
    expect(panel, "界面里不许再出现封顶字面量(第二份副本)").not.toMatch(/Math\.min\(\s*0\.6/);
    expect(panel, "濒危触发线要读同一枚常数,不写死 30%").toContain("TRIB_LOW_HP_TRIGGER");
    expect(decision, "结算的封顶口径只此一处").toContain("TRIB_LOW_HP_REDUCTION_CAP");
  });
});
