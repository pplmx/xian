/**
 * 品阶不许只靠颜色 —— 全站一条常驻判据。
 *
 * ## 为什么把这条从「逐处修」升成「全站守」
 *
 * 前面三轮各修了一处,都是同一个病:
 *
 * | 轮 | 位置 | 当时的问题 |
 * | --- | --- | --- |
 * | 7 | 离线归来的拾得装备 | 品阶只在文字色上 |
 * | 8 | 开炉炼丹的丹方行 | 九档品阶只藏在 18px 图标色里 |
 * | 9 | 修行页的丹药速服行 | 全站最常点的一处,品阶一个字都没有 |
 *
 * 三次都是**逐个看**发现的 —— 靠注意力,而注意力会漏。第 9 轮改用统计(数每个
 * 文件里 `QualitySeal` 与品阶名的出现次数)才把范围收干净。这条判据就是把那次
 * 统计固下来:以后再多一处只上颜色的品阶,不用等谁想起来去查,这里直接红。
 *
 * ## 判据口径
 *
 * 凡模板里用了 `qualityDef(...).color` 的文件,必须**同时**满足其一:
 *
 *   一 用了 `QualitySeal`(形状线索);
 *   二 用了 `qualityDef(...).name`(文字线索);
 *   三 在本文件的**白名单**里,且写明理由。
 *
 * ## 为什么白名单里只有两处
 *
 * **QualitySeal.vue** —— 它就是那个章本身,`tone` 是它的实现细节,不需要再给自己盖章。
 *
 * **CombatPanel.vue** —— 战报走的是另一套三重线索:`data-log-quality="rare"|"top"`
 * 决定竖线粗细(1px / 3px)与字重,颜色只是第三条。它在战报那种一行一句、逐条滚动的
 * 语境里比盖章更合适 —— 盖章会让每一行都长出一枚章,战报就碎了。
 * 这一条由 `uiLayering.spec` 的「品阶要能盖过它」那段单独守着。
 *
 * 白名单只放这两处。再来一个想进白名单的,得先回答:它凭什么不盖、不写?
 */
import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = "src";

/** 只有这两处可以不盖也不写,理由见文件头 */
const ALLOW: Record<string, string> = {
  "components/common/QualitySeal.vue": "它就是章本身;tone 是实现细节,不必给自己盖章",
  "components/adventure/CombatPanel.vue":
    "战报走 data-log-quality + 竖线粗细 + 字重三重线索,盖章会让逐行滚动的战报碎掉",
};

function walkVue(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules") continue;
      walkVue(full, out);
    } else if (name.endsWith(".vue")) {
      out.push(full);
    }
  }
  return out;
}

/** 去掉注释,避免注释里提到 `qualityDef(x).color` 就算数 */
function stripComments(src: string): string {
  return src.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("品阶不许只靠颜色", () => {
  it("每个用到品阶色的界面文件,都要有第二条线索", () => {
    const offenders: string[] = [];
    let scanned = 0;
    for (const file of walkVue(SRC)) {
      const rel = relative(SRC, file).replace(/\\/g, "/");
      const src = stripComments(readFileSync(file, "utf8"));
      // 只用「读品阶色」这个动作认人,不用文件名
      if (!/qualityDef\([^)]*\)\.color/.test(src)) continue;
      scanned += 1;
      if (ALLOW[rel]) continue;
      const hasSeal = src.includes("QualitySeal");
      const hasName = /qualityDef\([^)]*\)\.name/.test(src);
      if (!hasSeal && !hasName) offenders.push(`${rel}(章:${hasSeal} 名:${hasName})`);
    }
    // 防空转:扫到的数量对不上,说明辨认规则坏了
    expect(scanned, "一个用品质色的文件都没扫到 —— 辨认规则写错了").toBeGreaterThanOrEqual(6);
    expect(
      offenders,
      `这些文件把品阶只画成了一个颜色 —— 色弱读不出,良品与精品在纸面上也几乎一样。` +
        `补一枚 QualitySeal 章或写出 qualityDef(...).name,确有必要则加进本文件的白名单并写明理由:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("白名单不腐烂 —— 列进去的文件必须真的还在用品质色", () => {
    const stale: string[] = [];
    for (const rel of Object.keys(ALLOW)) {
      const src = readFileSync(join(SRC, rel), "utf8");
      if (!/qualityDef\([^)]*\)\.color/.test(src)) stale.push(rel);
    }
    expect(
      stale,
      `这些文件已经不再用品质色,白名单该删掉它们(留着的白名单会掩盖将来新加的违规):\n  ${stale.join("\n  ")}`,
    ).toEqual([]);
  });

  it("反空转:判据认得出「只有颜色」的坏样本", () => {
    const bad = `<GameIcon :style="{ color: qualityDef(x.quality).color }" />`;
    const good = `<QualitySeal :quality="x.quality" /><span :style="{ color: qualityDef(x.quality).color }" />`;
    const named = `<span :style="{ color: qualityDef(x.quality).color }">{{ qualityDef(x.quality).name }}</span>`;
    const check = (s: string) => s.includes("QualitySeal") || /qualityDef\([^)]*\)\.name/.test(s);
    expect(check(bad), "只有颜色的样本没被判出来").toBe(false);
    expect(check(good), "盖章的样本被误判").toBe(true);
    expect(check(named), "写品阶名的样本被误判").toBe(true);
  });
});
