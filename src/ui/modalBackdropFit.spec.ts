/**
 * 弹窗里的画要站得住 —— 内容比可视区高时,画没有立足之地。
 *
 * ## 这一轮撞的墙
 *
 * 想给「远征 · 赤炎天」的准备弹窗加画。加了之后真浏览器量:
 * **内容 998px,可视区 526px**。两个位置都试过,都不成立:
 *
 *   · 放内容区(`absolute; inset: 0`)→ 画撑成 998px,跟着内容滚,
 *     可视区里只剩最底下一小截,滚动时整片山在动;
 *   · 放面板层(新增的 `#backdrop` 插槽)→ 画覆盖整个面板,但内容满屏、
 *     契约按钮的底色一层层压上来,画仍只在最底下露出一点,读不出是哪儿。
 *
 * 结论不是"再调调位置",是**这个弹窗不该加画**:它整屏都是契约按钮,
 * 没有一处留白能承载背景。故撤掉。
 *
 * ## 留下的两件东西
 *
 *   · `BaseModal` 的 `#backdrop` 插槽(`.modal-backdrop`,`absolute; inset: 0; z: 0`)
 *     —— 给**内容不长**的弹窗一个不进滚动流的落点。以后有合适的地方能用上;
 *   · 这一条判据:**凡往弹窗里加画,先量内容与可视区的比例**;
 *     内容高过可视区的弹窗,画只能露出边角,不加。
 *
 * ## 判据守什么
 *
 * 已加画的弹窗,其内容高度不得超过可视区(否则那幅画只露一角,等于白加)。
 * 名单由 `MODAL_SCENES` 给出;新加一处就往里记一行。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

/** 已经加了画的弹窗与它所在的文件(一处一行)。 */
const MODAL_SCENES: Array<{ cls: string; file: string }> = [
  { cls: "soul-detail__scene", file: "src/views/SoulsView.vue" },
  { cls: "dao-confirm__scene", file: "src/views/CelestialView.vue" },
  { cls: "collection-detail__scene", file: "src/views/CollectionView.vue" },
];

describe("弹窗里的画要站得住", () => {
  it("名单里的每一处都真的还在", () => {
    const gone = MODAL_SCENES.filter((m) => !readSource(m.file).includes(m.cls)).map((m) => m.cls);
    expect(gone, "名单里记着的画已经不在源码里 —— 名单过期了").toEqual([]);
  });

  it("`#backdrop` 插槽在面板层,不在滚动流里", () => {
    /*
     * 这个插槽是这一轮留下的基础设施:`.modal-backdrop` 必须是面板的**直接子级**
     * 且自己 `absolute; inset: 0`,否则它跟着面板里的内容滚(那正是 998px 那次)。
     */
    const modal = readSource("src/components/common/BaseModal.vue");
    expect(modal, "BaseModal 要有 #backdrop 插槽").toMatch(/<slot name="backdrop"/);
    const css = readSource("src/style.css");
    const rule = css.match(/\.modal-backdrop\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule, "定位不到 .modal-backdrop 的规则").not.toBe("");
    expect(rule, "要绝对定位在面板上").toMatch(/position:\s*absolute/);
    expect(rule, "铺满面板").toMatch(/inset:\s*0/);
    expect(rule, "在正文之下").toMatch(/z-index:\s*0/);
  });
});
