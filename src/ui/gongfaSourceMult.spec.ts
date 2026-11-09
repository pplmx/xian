/**
 * 功法弹窗 · 「同源」要说得出几倍
 *
 * ## 缺口:人物页刚把「亲近」说成数,决策现场仍然只有一个词
 *
 * 灵根牌面那块(`ui/elementGains`)现在逐系报出 `gongfaWeight` / `fortuneWeight`
 * 与渡劫通道。但玩家**真正做决定的地方**是功法弹窗 —— 在那里挑一门来参悟。
 * 那里只有一个「同源」小章,`title` 写着「藏经阁参悟时更易撞见」,没有数。
 *
 * 于是同一件事在两处深浅不一:人物页读得到 ×2.2,决策现场读不到。
 * 而本仓的决策信息纪律说的正是「给决策前把数字摊开」。
 *
 * ## 判据取的是同一个函数,不是另算一遍
 *
 * `sameRoot` 已经是 `gongfaAffinity(...) > 1` —— 判据直接取自参悟权重函数,
 * 标签与实际权重不可能分叉。这里沿用同一条路:**倍率也读 `gongfaAffinity`**,
 * 不按元素去 `ELEMENT_AFFINITY` 里手抄 2.2。
 *
 * ## 措辞仍守着「更容易遇到」
 *
 * `elementNeutral.spec` 的承诺是五行不分高低;`gongfaAffinity` 是倾向(更容易撞见,
 * 不是更强),无此灵根时返回 1(路没被关掉)。故文案只能说「参悟权重」,
 * 不许说「更强 / 伤害更高」。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const dlg = () => readSource("src/components/cultivation/GongfaDialog.vue");

describe("功法弹窗 · 同源章上要印倍率", () => {
  it("倍率读 gongfaAffinity,不手抄常数", () => {
    const src = dlg();
    expect(src, "弹窗要读那个参悟权重函数").toContain("gongfaAffinity(");
    // 不许把 2.2 / 2.6 / 3 这类字面倍率写进视图
    const code = src.replace(/<!--[\s\S]*?-->/g, "");
    expect(code, "不许把字面倍率写进弹窗").not.toMatch(/2\.2\b|2\.6\b/);
  });

  it("「同源」那一格印出倍率,而不只有一个词", () => {
    const src = dlg();
    const at = src.indexOf("同源");
    expect(at, "找不到同源那一格 —— 判据会空转").toBeGreaterThan(0);
    const near = src.slice(Math.max(0, at - 400), at + 900);
    expect(near, "同源那一格要印出倍率").toMatch(/sameRootMult|multText\(/);
  });

  it("倍率走 multText —— 与人物页牌面折算同一套写法", () => {
    const src = dlg();
    expect(src, "倍率的写法要与人物页同源").toContain("multText");
  });

  it("措辞说「参悟权重 / 更容易撞见」,不许说成更强", () => {
    const src = dlg();
    const at = src.indexOf("同源");
    const near = src.slice(Math.max(0, at - 400), at + 900).replace(/<!--[\s\S]*?-->/g, "");
    for (const banned of ["更强", "伤害更高", "攻击提升", "战力提升"]) {
      expect(near, `同源写成了数值高低(「${banned}」)—— 五行不分高低`).not.toContain(banned);
    }
    expect(near, "要说清是参悟权重 / 更容易撞见").toMatch(/参悟|撞见|权重/);
  });

  it("非同源时不许印一个 ×1 —— 那会让人以为同源没有好处", () => {
    /*
     * `sameRoot` 已经把非同源挡在 `v-if` 外,倍率那一格与它同一档。
     * 这条守的是「别为了顺手把 ×1 也印出来」:×1 在非同源那一档是**没有加成**,
     * 印出来反而像「加成为 1 倍」这个不存在的档位。
     */
    const src = dlg();
    expect(src.indexOf("sameRootMult"), "找不到倍率那个 computed").toBeGreaterThan(0);
    // 计算里可以直接 > 1,但不许在模板把 ×1 无条件印出:倍率格必须挂在 sameRoot 之下
    const tpl = src.slice(0, src.indexOf("<script"));
    const tplAt = tpl.indexOf("sameRootMult");
    if (tplAt > 0) {
      const near = tpl.slice(Math.max(0, tplAt - 500), tplAt + 300);
      expect(near, "倍率格要挂在 sameRoot 之下(v-if),不许无条件印").toMatch(/v-if="sameRoot/);
    }
  });
});
