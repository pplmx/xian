/**
 * 事件密度不能只是一排点。
 *
 * ## 由来（第 466 轮）
 *
 * `MortalWorldView` 的每一段地界上有这么一处：
 *
 * ```html
 * <span class="world-stage__density" aria-hidden="true">
 *   <span v-for="n in p.eventLevel" :key="n" />
 * </span>
 * ```
 *
 * 它画的是事件密度（1~5 个点）。而整块都是 `aria-hidden="true"` ——
 * **读屏、禁用视觉渲染、纯文本导出下，这条信息完全丢失**。
 *
 * 而 `docs/design.md` 第 631 行写着这一栏要给「每段地名、镇守、事件密度」；
 * `mortalWorldService` 的文件头那句「不向玩家暴露算法：骨架模板名与事件密度**数字**」
 * 说的是不报具体数字与内部名词，**不是不报这件事**。
 *
 * 两句话在这里交汇成了现状：点了，但没说话。
 *
 * ## 判据
 *
 * ① 密度那个容器旁边必须有把同一件事说成话的元素（`.sr-only`）；
 * ② 反差：`aria-hidden` 仍在点阵上 —— 点是装饰，话才是信息，别把两者混成一块；
 * ③ `densityText` 对 1~5 五档都有说法，且各不相同。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const VIEW = readFileSync(resolve(__dirname, "../views/MortalWorldView.vue"), "utf-8");

describe("事件密度 · 不能只是一排点", () => {
  it("① 点阵旁边有一句 sr-only 把同一件事说成话", () => {
    const at = VIEW.indexOf("world-stage__density");
    expect(at, "找不到密度那处 —— 判据会空转").toBeGreaterThan(0);
    /*
     * 只看它后面的一小段：那句说明必须紧挨着，不能飘到页面别处去 ——
     * 飘过去的话，读屏用户听到的是一句没有指代的话。
     */
    const around = VIEW.slice(at, at + 400);
    expect(around, "密度只有点、没有可读的那句话").toMatch(/class="sr-only"/);
    expect(around, "sr-only 里没有调用 densityText").toContain("densityText");
  });

  it("② 反差：点阵本身仍是 aria-hidden —— 点是装饰，话才是信息", () => {
    const at = VIEW.indexOf('class="world-stage__density"');
    const tagEnd = VIEW.indexOf(">", at);
    const openTag = VIEW.slice(at, tagEnd);
    expect(openTag, "点阵不再 aria-hidden 了 —— 读屏会念出五个空 span").toContain("aria-hidden");
  });

  it("③ 五档都有说法，且两两不同", () => {
    /*
     * 直接读源码里的 `densityText`，把它抽出来跑一遍 —— 这里不 mock 组件，
     * 因为要验的正是「五个分支各有各的话」。
     */
    const body = VIEW.slice(VIEW.indexOf("function densityText"), VIEW.indexOf("const meter"));
    const pairs = [...body.matchAll(/level <= (\d)\) return "([^"]+)"/g)].map((m) => [
      Number(m[1]),
      m[2]!,
    ]) as [number, string][];
    expect(pairs.length, "densityText 的分支数不对").toBe(4);
    const sayings = pairs.map(([, t]) => t);
    const fallback = /return "([^"]+)";\s*\}\s*$/.exec(body)?.[1] ?? "";
    expect(fallback, "最高档那句没找到").not.toBe("");
    const all = [...sayings, fallback];
    expect(new Set(all).size, "有两档说的是同一句话 —— 那这一档就白设了").toBe(all.length);
  });
});
