/**
 * 倍数的写法 —— 同一个 ×1.2,不许两处印成两个样子。
 *
 * 判据六组:
 *   一 两位精度:1.005 进到 1.01,1.004 退到 1;
 *   二 削尾零:1.20 → 1.2、1.00 → 1、2.10 → 2.1;
 *   三 带 ×:multText 前缀必在,multNumberText 必不在;
 *   四 坏值给破折号,不印 NaN;
 *   五 只做格式:不 import 任何 store / core;
 *   六 真接线:转世确认页那处直接插值改用共享写法。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { multText } from "./multText";

describe("倍数的写法 · 两位精度", () => {
  it("第三位四舍五入 —— 但 1.005 这类二进制表示会是 1.0049…,故向下", () => {
    /*
     * `1.005 * 100 = 100.49999999999999`,Math.round 给 100 —— 这是 IEEE 754
     * 的既定行为,不是本函数的缺陷。判据照实写,不假装它进得上去。
     * 真需要「逢五进一」的场合得用十进制字符串,而倍率用不上那个精度。
     */
    expect(multText(1.005)).toBe("×1");
    expect(multText(1.006)).toBe("×1.01");
    expect(multText(1.004)).toBe("×1");
  });

  it("不丢精度到一位 —— 1.02 与 1.03 是两个值", () => {
    expect(multText(1.02)).toBe("×1.02");
    expect(multText(1.03)).toBe("×1.03");
  });
});

describe("倍数的写法 · 削尾零", () => {
  it("1.20 与 1.2 同数,只印一个", () => {
    expect(multText(1.2)).toBe("×1.2");
    expect(multText(1.2)).toBe(multText(1.2));
  });

  it("整数不带小数点", () => {
    expect(multText(1)).toBe("×1");
    expect(multText(2)).toBe("×2");
  });

  it("2.10 削成 2.1,不是 2.10 也不是 2", () => {
    expect(multText(2.1)).toBe("×2.1");
  });

  it("三位小数四舍五入后照削", () => {
    expect(multText(1.234)).toBe("×1.23");
    expect(multText(1.999)).toBe("×2");
  });
});

describe("倍数的写法 · 带 ×", () => {
  /*
   * 曾经还有一个 `multNumberText`(不带 × 的那一半),但它没有任何调用方 ——
   * 死导出审计当场报了。按本仓纪律:接进游戏,或删掉。这里删掉,
   * 等真有地方需要「不带 × 的倍数」时再加(那时它会有调用方)。
   */
  it("每个值都带 × 前缀", () => {
    for (const n of [1, 1.2, 2.5, 10, 0]) {
      expect(multText(n).startsWith("×"), `«${multText(n)}» 少了 ×`).toBe(true);
    }
  });
});

describe("倍数的写法 · 坏值", () => {
  it("NaN / Infinity 给破折号,不印 NaN", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(multText(bad), `${bad} 印出来了`).toBe("—");
    }
  });

  it("0 与负数照常印(它们是合法倍率)", () => {
    expect(multText(0)).toBe("×0");
    expect(multText(-1.5)).toBe("×-1.5");
  });
});

describe("倍数的写法 · 只做格式", () => {
  it("不 import 任何 store 或 core", () => {
    const src = readSource("src/ui/multText.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/from ["']@\/stores\//);
    expect(src).not.toMatch(/from ["']@\/core\//);
  });
});

describe("倍数的写法 · 真接线", () => {
  it("转世确认页那处直接插值改用共享写法", () => {
    /*
     * 它原先是 `×${view.nextLinggen.growthMult}` —— 值是 round2 过的数字,
     * 于是 1.2 印成 ×1.2,而人物页同一份值印成 ×1.20。两处说的是同一个数。
     */
    const dlg = readSource("src/components/character/ReincarnationDialog.vue");
    expect(dlg, "该用共享写法").toContain("multText(");
    expect(dlg, "不许再直接插值").not.toMatch(/×\$\{view\.nextLinggen\.growthMult\}/);
  });

  it("人物页那两处也用同一份 —— 两处不许各写一遍 toFixed(2)", () => {
    for (const file of [
      "src/components/character/CharacterSigil.vue",
      "src/views/CharacterView.vue",
    ]) {
      const src = readSource(file);
      expect(src, `${file} 该用共享写法`).toContain("multText(");
      expect(src, `${file} 不该自己 toFixed(2)`).not.toMatch(/growthMult\.toFixed\(2\)/);
    }
  });
});
