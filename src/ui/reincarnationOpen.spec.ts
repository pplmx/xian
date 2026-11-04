/**
 * 转世开局 · 边界与防御(静态那一层)。
 *
 * **这份判据测不到那条异常本身** —— 它只守外围:入口仍共用、防御没被退回、
 * 不可逆边界没被放松。异常要靠真浏览器走「往生帖 → 三程」才看得见,
 * 而那两轮都没走通(见下)。这一点写在文件名与注释里,免得后来的人
 * 以为这里已经守住了崩溃。
 *
 * ## 怎么发现的
 *
 * 第 29、30 两轮都在试着给「转世的代价清单」补一条浏览器判据。走到
 * 「点兵解 → 三程」那一步时,页面抛了:
 *
 *   TypeError: Cannot read properties of undefined (reading 'id')
 *
 * 它出现在 `prepareReincarnation()` 里,而那个函数的每一处 `.id` 都看着有防御
 * (`lifeForge(...)?.id`、`stageAfter = stageAt(...)` 保证非空、`offerThemes` 返回数组)。
 * 单测一条都没红 —— 因为**单测从来不走「点兵解」这条路**:它们直接调
 * `prepareReincarnation()`,用的是自己造的完整夹具。
 *
 * ## 这一份判据守什么(以及守不住什么)
 *
 * 守:入口仍共用、那两处防御没被退回、三程末才落定的边界没放松。
 *
 * 守不住:**它不会因为那条异常复现而红** —— 那是浏览器层的事。
 * 两轮里试过的路(往生帖 → 三程)最终卡在同一个 TypeError 上,
 * 而夹具怎么调都绕不开它,故没有留下那条判据。
 *
 * 若要真守住,得先把那个异常查清 —— 那本身就是下一轮的事:
 * 沿着真实存档的形状走一遍 prepareReincarnation,看是哪一处取值落空。
 *
 * ## 为什么单测抓不到
 *
 * 转世是**不可逆**操作,所以界面把它拆成「往生帖 → 三程」两道确认。
 * 单测绕过了这两道门,直接调终点函数 —— 于是"门"这一侧的代码路径
 * (包括两道门之间传的那份状态)从来没有被任何单测走过。
 * 这是不可逆操作在测试上的固有盲区,只有真浏览器能补。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

describe("转世开局 · 不变的边界", () => {
  it("prepareReincarnation 仍被往生帖与三程共用一个入口", () => {
    // 两个弹窗共用同一个入口 —— 若哪天分叉成两份,那段异常路径会变成两条
    for (const file of [
      "src/components/character/RebirthDialog.vue",
      "src/components/character/ReincarnationDialog.vue",
    ]) {
      expect(readSource(file), `${file} 该调同一个入口`).toContain("prepareReincarnation()");
    }
  });

  it("那条异常涉及的取值处都写了防御 —— 修的时候别把它拆掉", () => {
    const src = readSource("src/core/reincarnation.ts");
    // 这两处已经用了可选链,是真修好之后的样式;判据守住它们不被退回
    expect(src, "锻造阶段的取值要允许为空").toContain("lifeForge(player.major)?.id ?? null");
    // 阶位取值来自 stageAt,它保证非空(见 data/samsara 的实现)
    expect(src, "阶位取自 stageAt").toContain("stageAt(");
  });

  it("转世的不可逆边界没被放松 —— 三程末才是真落定", () => {
    const dlg = readSource("src/components/character/ReincarnationDialog.vue");
    // 第一程与第二程都只读;只有第三程的 confirm 会落账
    expect(dlg, "第三程才落定").toContain("data-reincarnation-confirm");
    expect(dlg, "第二程的推进只切 step").toMatch(
      /data-reincarnation-review-next[\s\S]{0,120}step = 'choice'/,
    );
  });
});
