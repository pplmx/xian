/**
 * 0~1 夹取 —— 一件小事,但脏值会静默吃掉整条 CSS。
 *
 * `Math.max(0, Math.min(1, NaN))` 是 `NaN`;把它拼进 `width: NaN%`,
 * 浏览器会把那条样式整条丢掉:进度条不出现,控制台干净。坏档与除零都会
 * 造出这种值,所以「脏值归零」是这条判据真正要守的东西。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, walkFiles } from "@/test/readSource";
import { clampPercent, percentWidth, unitRatio } from "./unitRatio";

describe("unitRatio · 夹到 0~1", () => {
  it("区间内的值原样通过", () => {
    expect(unitRatio(0)).toBe(0);
    expect(unitRatio(0.42)).toBe(0.42);
    expect(unitRatio(1)).toBe(1);
  });

  it("越界按边界夹", () => {
    expect(unitRatio(-3)).toBe(0);
    expect(unitRatio(17)).toBe(1);
    expect(unitRatio(-0.001)).toBe(0);
    expect(unitRatio(1.001)).toBe(1);
  });

  it("脏值归零 —— 不许把 NaN 放给 CSS", () => {
    expect(unitRatio(Number.NaN)).toBe(0);
    expect(unitRatio(Number.POSITIVE_INFINITY)).toBe(0);
    expect(unitRatio(Number.NEGATIVE_INFINITY)).toBe(0);
    // 反证:裸夹取确实会把 NaN 放过去(这就是这条判据存在的理由)
    expect(Math.max(0, Math.min(1, Number.NaN))).toBeNaN();
  });

  it("结果可以直接当比例用 —— 拼出来不会是 NaN%", () => {
    for (const dirty of [Number.NaN, Number.POSITIVE_INFINITY, -1, 2]) {
      const css = `${unitRatio(dirty) * 100}%`;
      expect(css).not.toContain("NaN");
      expect(Number.parseFloat(css)).toBeGreaterThanOrEqual(0);
      expect(Number.parseFloat(css)).toBeLessThanOrEqual(100);
    }
  });
});

describe("percentWidth · 比例到 CSS 宽度", () => {
  it("把 0~1 变成能直接塞进 style 的百分比字符串", () => {
    expect(percentWidth(0)).toBe("0%");
    expect(percentWidth(0.5)).toBe("50%");
    expect(percentWidth(1)).toBe("100%");
  });

  it("越界夹到 0~100%", () => {
    expect(percentWidth(1.4)).toBe("100%");
    expect(percentWidth(-0.3)).toBe("0%");
  });

  it("脏值给 0%,不给 NaN% —— 后者会让浏览器丢掉整条样式", () => {
    // 反面证据:不夹取时拼出来的是什么
    const bare = (v: number) => `${v * 100}%`;
    expect(bare(Number.NaN), "裸拼就是 NaN%,那条 width 会被整条丢弃").toBe("NaN%");
    expect(percentWidth(Number.NaN)).toBe("0%");
    expect(percentWidth(Number.POSITIVE_INFINITY)).toBe("0%");
    expect(percentWidth(Number.NEGATIVE_INFINITY)).toBe("0%");
  });
});

describe("百分比宽度 · 只有一个出处", () => {
  it("界面里不再自己乘 100 拼 %", () => {
    /*
     * `unitRatio(x) * 100` 再拼 `%` 这个组合,此前在 ProgressBar 与
     * NameBeastSwitch 各写过一遍。两次都对,但它们各自都在重复同一个决定:
     * 乘多少、带不带百分号、脏值怎么办。第三次写的时候,很可能只有两处里
     * 有一处记得夹取 —— 于是某条进度条在坏档下消失,而另一条正常。
     */
    const offenders: string[] = [];
    for (const file of walkFiles(resolve(ROOT, "src"), (n) => n.endsWith(".vue"))) {
      const src = readFileSync(file, "utf8");
      if (/unitRatio\([^)]*\)\s*\*\s*100/.test(src)) offenders.push(file);
    }
    expect(offenders, "这些文件又自己拼了一遍百分比宽度 —— 改用 percentWidth").toEqual([]);
    // 防空转:确认确实扫到了组件文件
    expect(walkFiles(resolve(ROOT, "src"), (n) => n.endsWith(".vue")).length).toBeGreaterThan(50);
  });
});

describe("clampPercent · 百分数刻度的那把尺", () => {
  it("夹到 0~100,脏值归零", () => {
    expect(clampPercent(0)).toBe(0);
    expect(clampPercent(42.5)).toBe(42.5);
    expect(clampPercent(100)).toBe(100);
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(-3)).toBe(0);
    // 与 unitRatio 同病:裸夹取会让 NaN 穿过去,拼成 "NaN%"
    expect(Number.isNaN(Math.max(0, Math.min(100, Number.NaN))), "裸夹取拦不住 NaN").toBe(true);
    expect(clampPercent(Number.NaN)).toBe(0);
    expect(clampPercent(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampPercent(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it("两个刻度不能混用 —— 混了不报错,只是画错", () => {
    // 把 0~1 的比例喂给 clampPercent:得到 0.5%,而不是 50%
    expect(clampPercent(0.5)).toBe(0.5);
    expect(percentWidth(0.5)).toBe("50%");
  });

  it("界面里不再手写 0~100 的夹取", () => {
    /*
     * 例外:settingVolume。音量是「刻度」而不是「进度」——那里的 Infinity
     * 表示「超出上限」,应当夹到满格 100;而 clampPercent 把非有限值一律归零,
     * 因为「进度条没有进度可画」。两种语义不同,不能合并(settingsDesk.spec 钉着它)。
     */
    const EXEMPT = ["ui/settingsDesk.ts"];
    const offenders: string[] = [];
    for (const file of walkFiles(
      resolve(ROOT, "src"),
      (n) => n.endsWith(".ts") || n.endsWith(".vue"),
    )) {
      if (file.endsWith("unitRatio.ts") || file.endsWith(".spec.ts")) continue;
      if (EXEMPT.some((e) => file.endsWith(e))) continue;
      const src = readFileSync(file, "utf8");
      // 注释里引用它来解释「从前的写法」不算
      const body = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      if (/Math\.max\(\s*0\s*,\s*Math\.min\(\s*100\s*,/.test(body)) offenders.push(file);
    }
    expect(offenders, "这些文件又手写了一遍 0~100 夹取 —— 改用 clampPercent").toEqual([]);
  });
});
