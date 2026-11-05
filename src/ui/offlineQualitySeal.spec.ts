/**
 * 离线归来的拾得装备 —— 高品阶要盖得出章,不能只靠颜色。
 *
 * ## 复现:这一个月里最值得高兴的那几件,回来时只剩一个字色
 *
 * `OfflineRewardDialog` 的「拾得装备」那一块,每一件是这样画的:
 *
 * ```html
 * <span :style="{ color: qualityDef(eq.quality).color }">天·雾隐长枪</span>
 * ```
 *
 * 也就是说:**品阶只体现为文字颜色**。
 *
 * 而全站其余每一处都要盖 `QualitySeal`。它的文件头把理由写死了:
 *
 *   > 九档品阶的颜色里,良品(jade)与精品(qing)同属青绿系,纸面上几乎难分;
 *   > 而色弱玩家更是一条色带都读不出档。章是**形状线索**:天/仙/神这类高档位,
 *   > 名字首字盖一枚小章,扫一眼格子就知道「这几件不一样」。
 *
 * 离线归来恰恰是**最该有这条线索**的地方:
 *
 *   · 它是玩家离开几小时/几天之后看到的第一屏;
 *   · 「拾得装备」是这一屏里唯一可能出现高品阶的段落(其余都是资源流水);
 *   · 而且它们是一串平铺的名字,颜色差之毫厘,扫读时几乎分辨不出。
 *
 * 玩家挂着机去睡觉,回来发现捡了件神品 —— 那一瞬间的喜悦,现在被压成了一行
 * 稍深一点的枣红色字。
 *
 * ## 判据守什么
 *
 * 一条:`OfflineRewardDialog` 里拾得装备的每一件都要盖品阶章。
 * 不规定尺寸与排布(那是版式的事),只要求那个「不靠颜色单打」的线索在场。
 *
 * 顺带守一条反向:`not.toContain` 式的「只剩颜色」写法不许回来 ——
 * 若有人把章删了、只留 style 里的 color,这一条会红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const DIALOG = "src/components/offline/OfflineRewardDialog.vue";

describe("离线归来 · 拾得装备要盖得出品阶章", () => {
  it("拾得装备那一块里有 QualitySeal", () => {
    const src = readSource(DIALOG);
    expect(src, "离线弹窗里要盖上品阶章 —— 只靠颜色分不出档").toContain("QualitySeal");
  });

  it("章盖在拾得装备的每一件上,不是只盖一次", () => {
    const src = readSource(DIALOG);
    /*
     * 「拾得装备」那一块的循环是 v-for="(eq, i) in savedEquipment"。
     * 章必须在这个循环里 —— 只 import 不渲染,或渲染在块外,都不算数。
     */
    const block = src.match(/savedEquipment[\s\S]{0,900}?<\/li>/)?.[0] ?? "";
    expect(block, "定位不到拾得装备那一块 —— 判据会空转").not.toBe("");
    expect(block, "拾得装备的每一件都要带章").toMatch(
      /QualitySeal[\s\S]{0,200}:quality="eq\.quality"/,
    );
  });

  it("反空转:品阶色仍要有 —— 章是补充线索,不是替代", () => {
    const src = readSource(DIALOG);
    expect(src, "品阶色与章两者都在,才是「颜色 + 形状」双线索").toContain(
      "qualityDef(eq.quality).color",
    );
  });
});
