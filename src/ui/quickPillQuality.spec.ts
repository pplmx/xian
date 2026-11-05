/**
 * 修行页的丹药速服行 —— 品阶不能只藏在一枚 16px 图标的前景色里。
 *
 * ## 复现:同一屏三行,三个品阶,只有图标色在说
 *
 * `CultivationView` 的「以药辅道」快捷行,一件丹药是这样画的:
 *
 * ```html
 * <GameIcon :name="p.def!.icon" :size="16" :style="{ color: qualityDef(p.def!.quality).color }" />
 * <span class="cultivation-pill-row__name">{{ p.def!.name }}</span>
 * <span>存 {{ p.count }} · {{ quickPillBrief(p.def!) }}</span>
 * <span>{{ 服用 / 续时 / 已顶 }}</span>
 * ```
 *
 * 品名、存量、增益、状态四样都在,唯独**品阶一个字都没有** —— 只由那枚 16px 图标的
 * 前景色承担。夹具里同一屏的三行恰好是:
 *
 * ```text
 * 大还丹  玄品
 * 聚灵丹  精品
 * 回灵丹  良品
 * ```
 *
 * 而 `QualitySeal.vue` 的文件头把这条说死了:
 *
 *   > 九档品阶的颜色里,良品(jade)与精品(qing)同属青绿系,纸面上几乎难分;
 *   > 而色弱玩家更是一条色带都读不出档。
 *
 * 图标还多一层亏:它是**丹药形状**(丹丸 / 药葫芦 / 茶叶),颜色附着在图形上是
 * 第二属性 —— 扫读一串丹名时视线落在字上,落在图标上的机会很少。
 *
 * ## 为什么这一处值得单独修
 *
 * 这是玩家**每天都会点**的地方:服丹、续药、看顶没顶。全站其余带丹药的地方
 * (开炉炼丹、灵草坊、行囊)都有品质线索,唯独这个最常点的快捷行没有 ——
 * 属于「最常看的那一处,恰恰最省」。
 *
 * ## 判据守什么
 *
 * 两条:
 *   一 速服行里有品阶名(文字线索);
 *   二 品阶色仍保留 —— 文字是补充线索,不是替代。
 *
 * 不要求盖 `QualitySeal` 章:这一行只有 46px 高、四样信息已在同一行,
 * 再插一枚章会把名称挤窄。文字是最省地方的那条线索(与炼丹页同一取舍)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const VIEW = "src/views/CultivationView.vue";

describe("修行页 · 丹药速服行要读得出品阶", () => {
  it("速服行里有品阶名", () => {
    const src = readSource(VIEW);
    const row = src.match(/data-quick-pill[\s\S]{0,1800}/)?.[0] ?? "";
    expect(row, "定位不到速服行 —— 判据会空转").not.toBe("");
    expect(row, "速服行要写出品阶名 —— 只有图标色的话,良品与精品在纸面上几乎一样").toMatch(
      /qualityDef\(p\.def!?\.quality\)\.name/,
    );
  });

  it("品阶名与品名并列在名称那一行,不另起一行", () => {
    const src = readSource(VIEW);
    const row = src.match(/data-quick-pill[\s\S]{0,1800}/)?.[0] ?? "";
    /*
     * 行高 46px、已装四样信息;品阶名必须进名称那一行(与品名同处),
     * 不能另开一段把行高撑起来。
     */
    const nameLine = row.match(/cultivation-pill-row__name[\s\S]{0,700}/)?.[0] ?? "";
    expect(nameLine, "品阶名要落在名称那一行里").toContain("qualityDef(p.def!.quality).name");
  });

  it("反空转:图标品阶色仍保留 —— 文字是补充线索", () => {
    const src = readSource(VIEW);
    expect(src, "图标上的品阶色不许删").toContain("qualityDef(p.def!.quality).color");
  });
});
