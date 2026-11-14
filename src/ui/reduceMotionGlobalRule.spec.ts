/**
 * 「减少动效」那条**全局 CSS** 规则本身要有人守。
 *
 * ## 由来（第 217 轮，查设置项是否真的生效）
 *
 * 实测（在浏览器里拨开关）:
 *
 * ```text
 * 关闭    .app-shell 没有 reduce-motion 类，动画时长 4.5s
 * 打开    有该类，动画时长 1e-05s（两套机制各自一条全局规则）
 * ```
 *
 * 两套机制:
 *
 * ```css
 * @media (prefers-reduced-motion: reduce) { * { … } }   ← 系统偏好
 * .reduce-motion * { … }                                 ← 应用内开关
 * ```
 *
 * 都作用于 `*`（含 `::before` / `::after`）、都带 `!important`，
 * 故组件不必逐个接 —— 这是省事且正确的设计。
 *
 * ## 但已有判据只守了 JS 那一层
 *
 * ```text
 * uiLayering.spec       判 CombatPanel 必须读 settings.reduceMotion（战报回放要跳过）
 * settingsWiring.spec   判它接进了 CombatPanel / GauntletPanel
 * ```
 *
 * 两条都在守「**JS 那一层**」。而那条 `.reduce-motion *` 全局规则若被删，
 * **两条都不会红** —— 于是所有 CSS 动画（呼吸、脉冲、浮层入场）在
 * 「已勾选减少动效」的玩家屏幕上照旧跑。
 *
 * ## 这条判据守什么
 *
 * ① `.reduce-motion *` 规则在（含伪元素两条）;
 * ② 四条声明齐全（`animation-duration` / `animation-delay` /
 *    `animation-iteration-count` / `transition-duration`）;
 * ③ 都带 `!important` —— 不带的话优先级压不过组件自己的动画声明;
 * ④ 系统偏好那条同款也在（两套机制都得有）。
 *
 * ## 故障注入
 *
 * 把 `.reduce-motion` 那组里的 `animation-duration` 去掉 `!important` → 第二条红。
 * 整块删掉 → 第一、二条同时红（点名「找不到 `.reduce-motion *`」）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

const CSS = "src/style.css";

/** 取出 `.reduce-motion *…` 那个规则的正文 */
function reduceMotionRule(css: string): string | null {
  const m = /\.reduce-motion\s*\*,[\s\S]{0,200}?\{([\s\S]*?)\}/.exec(css);
  return m ? m[1]! : null;
}

describe("减少动效 · 那条全局 CSS 规则", () => {
  it("规则在，且覆盖元素与两个伪元素", () => {
    const css = stripComments(readSource(CSS));
    expect(css, "找不到 `.reduce-motion *` —— 应用内开关不再压任何 CSS 动画").toContain(
      ".reduce-motion *",
    );
    expect(css, "少了 ::before 那一支").toMatch(/\.reduce-motion \*::before/);
    expect(css, "少了 ::after 那一支").toMatch(/\.reduce-motion \*::after/);
  });

  it("四条声明齐全，且都带 !important", () => {
    const css = stripComments(readSource(CSS));
    const rule = reduceMotionRule(css);
    expect(rule, "取不到那条规则的正文").not.toBeNull();
    for (const prop of [
      "animation-duration",
      "animation-delay",
      "animation-iteration-count",
      "transition-duration",
    ]) {
      const re = new RegExp(`${prop}\\s*:[^;]*!important`);
      expect(
        re.test(rule!),
        `${prop} 没有带 !important —— 不带的话压不过组件自己的动画声明，" +
          "那条规则等于不存在`,
      ).toBe(true);
    }
  });

  it("系统偏好那条也在（两套机制都得有）", () => {
    const css = stripComments(readSource(CSS));
    /*
     * 判那件事:`@media (prefers-reduced-motion: reduce)` 里也有一组同样的声明。
     * 不钉它必须与 `.reduce-motion` 逐字相同 —— 只核「这个媒体查询里带 !important 的
     * animation-duration 确实存在」。
     */
    /*
     * 找 `*` 那一支 —— 文件里有两个 `prefers-reduced-motion` 媒体查询:
     * 一个是 `.ink-choice__option` 的局部过渡,一个才是全局的那条。
     * 第一版取「第一个媒体查询」，抓到的是局部那个，于是判据红得没道理（实测）。
     */
    const media =
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\*,\s*\*::before,\s*\*::after\s*\{([\s\S]{0,400}?)\}\s*\}/.exec(
        css,
      );
    expect(
      media,
      "没有 `prefers-reduced-motion: reduce` 那条 —— 系统里勾了减少动效的玩家不会得到任何响应",
    ).not.toBeNull();
    expect(
      /animation-duration\s*:[^;]*!important/.test(media![1]!),
      "媒体查询里没有带 !important 的 animation-duration",
    ).toBe(true);
  });
});
