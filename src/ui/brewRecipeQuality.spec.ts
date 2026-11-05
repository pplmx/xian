/**
 * 开炉炼丹的丹方行 —— 品阶只在图标色上,而玩家正是靠它选炼哪一炉。
 *
 * ## 复现:九档品阶,行上只写「1 阶」
 *
 * 丹方行上的两个字是 `{{ r.able.rank }} 阶`,而 `rank` 是 `craftability.ts` 里的
 * **丹方阶位**(`/** 丹方阶位 *\/`)—— 与丹药的品阶是两个维度。品阶在界面上只体现为
 * 那枚 18px 图标的前景色:
 *
 * ```html
 * <GameIcon :name="r.def.icon" :size="18" :style="{ color: qualityDef(r.def.quality).color }" />
 * <span>{{ r.def.name }}</span>
 * <span>{{ r.able.rank }} 阶</span>
 * ```
 *
 * `data/pills.ts` 里九档品阶全都用上了(mortal / fine / excellent / … / divine),
 * 于是出现这种事:
 *
 * ```text
 * 聚气散  凡品     ← 名字只差一个字
 * 聚气丹  良品     ← 品阶差两档,而界面上读不出区别
 * ```
 *
 * ## 为什么这一处要紧
 *
 * 这一屏是玩家**决定炼哪一炉**的地方。他要判断的是「这一炉炼出来值不值」,
 * 而品阶正是那件事的一半(另一半是把握)。`QualitySeal` 的文件头把通用理由写死了:
 *
 *   > 九档品阶的颜色里,良品(jade)与精品(qing)同属青绿系,纸面上几乎难分;
 *   > 而色弱玩家更是一条色带都读不出档。章是**形状线索**。
 *
 * 图标色还多一层亏:图标本身是**方子形状**(丹炉 / 药壶 / 茶叶…),它的颜色是
 * 附着在图形上的第二属性 —— 扫读一串方名时,视线落在字上而不是图标上。
 *
 * ## 判据守什么
 *
 * 两条:
 *   一 丹方行里出现品阶名(`qualityDef(...).name`),不是只有颜色;
 *   二 品阶名与「N 阶」(丹方阶位)**并列** —— 两者含义不同,不许用一个顶替另一个。
 *
 * 不要求盖 `QualitySeal` 章:图标已经是形状线索,行内再加一枚章会把这一屏的
 * 密度推高,而这一屏本来就挤(见模板里那段极窄档注释)。文字是最省地方的那条线索。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const BREW = "src/components/inventory/BrewingDialog.vue";

describe("开炉炼丹 · 丹方行要读得出品阶", () => {
  it("丹方行里有品阶名,不是只有图标色", () => {
    const src = readSource(BREW);
    // 取丹方行那一块:从 v-for 起,到该行的动作块之前,足够覆盖方名 / 阶位 / 品阶
    const row = src.match(/v-for="r in filteredRecipePage\.visible"[\s\S]{0,4000}/)?.[0] ?? "";
    expect(row, "定位不到丹方行 —— 判据会空转").not.toBe("");
    expect(row, "丹方行要写出品阶名 —— 只有图标色的话,良品与精品在纸面上几乎一样").toMatch(
      /qualityDef\(r\.def\.quality\)\.name/,
    );
  });

  it("品阶名与丹方阶位并列 —— 两者不是一回事", () => {
    const src = readSource(BREW);
    // 丹方阶位仍在(它是「这一方多难」),品阶名另加(它是「这一炉多好」)
    expect(src, "丹方阶位不许被品阶名顶替").toMatch(/\{\{\s*r\.able\.rank\s*\}\}\s*阶/);
    expect(src, "品阶名要另起一处").toContain("qualityDef(r.def.quality).name");
  });

  it("反空转:品阶色仍保留 —— 文字是补充线索", () => {
    const src = readSource(BREW);
    expect(src, "图标上的品阶色不许删").toContain("qualityDef(r.def.quality).color");
  });
});
