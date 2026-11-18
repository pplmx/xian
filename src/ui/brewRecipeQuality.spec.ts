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
 * ## 这一轮:清单行收成单行之后,品阶名反而更要紧
 *
 * 行上现在只剩「叫什么、多好、多难、几成把握」四段。品阶名若退到图标色上,
 * 单行里就只剩颜色这一条线索;而单行正是**扫读**的形态 —— 第二属性最吃亏的地方。
 *
 * ## 判据守什么
 *
 * ① 丹方行里出现品阶名(`qualityDef(...).name`),不是只有颜色;
 * ② 品阶名与「N 阶」(丹方阶位)**并列** —— 两者含义不同,不许用一个顶替另一个;
 * ③ 详情浮层里同样两样都在(它是行被点开之后的完整账);
 * ④ 反空转:品阶色仍在图标上,文字是补充线索,不是替代。
 *
 * 不要求盖 `QualitySeal` 章:图标已经是形状线索,单行里再加一枚章会把
 * 这一屏的密度推高,而这一屏本来就挤(见模板里那段极窄档注释)。文字最省地方。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const BREW = "src/components/inventory/BrewingDialog.vue";

describe("开炉炼丹 · 丹方行要读得出品阶", () => {
  it("① 丹方行里有品阶名,不是只有图标色", () => {
    const src = readSource(BREW);
    // 取册上那一行:从方子行按钮起,到那一行结束,足够覆盖方名 / 品阶 / 阶位 / 把握
    const row = src.match(/data-recipe-row="row\.def\.id"[\s\S]{0,2600}/)?.[0] ?? "";
    expect(row, "定位不到丹方行 —— 判据会空转").not.toBe("");
    expect(row, "丹方行要写出品阶名 —— 只有图标色的话,良品与精品在纸面上几乎一样").toContain(
      "qualityDef(row.def.quality).name",
    );
  });

  it("② 品阶名与丹方阶位并列 —— 两者不是一回事", () => {
    const src = readSource(BREW);
    const row = src.match(/data-recipe-row="row\.def\.id"[\s\S]{0,2600}/)?.[0] ?? "";
    expect(row, "定位不到丹方行 —— 判据会空转").not.toBe("");
    // 丹方阶位仍在(它是「这一方多难」),品阶名另加(它是「这一炉多好」)
    expect(row, "丹方阶位不许被品阶名顶替").toMatch(/\{\{\s*row\.able\.rank\s*\}\}\s*阶/);
    expect(row, "品阶名要另起一处").toContain("qualityDef(row.def.quality).name");
  });

  it("③ 详情浮层里两样都在 —— 它是行被点开之后的完整账", () => {
    const src = readSource(BREW);
    const detail = src.match(/data-recipe-row-detail[\s\S]{0,3000}/)?.[0] ?? "";
    expect(detail, "定位不到详情浮层 —— 判据会空转").not.toBe("");
    expect(detail, "详情浮层也要写出品阶名").toContain("qualityDef(detailRow.def.quality).name");
    expect(detail, "详情浮层也要写出丹方阶位").toMatch(/\{\{\s*detailRow\.able\.rank\s*\}\}\s*阶/);
  });

  it("④ 反空转:品阶色仍保留 —— 文字是补充线索", () => {
    const src = readSource(BREW);
    expect(src, "图标上的品阶色不许删").toContain("qualityDef(row.def.quality).color");
    expect(src, "详情浮层的图标色同样不许删").toContain("qualityDef(detailRow.def.quality).color");
  });
});
