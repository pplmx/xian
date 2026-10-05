import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { mulberry32, RandomService } from "@/utils/random";
import { rollLinggen, LINGGEN_GRADES } from "./linggenGen";

describe("灵根生成", () => {
  it("灵根品阶全集与 gradeName 的产出一一咬合 —— 轮换动画不许与真值漂移", () => {
    // 创角鉴定有轮换闪现动画(SpiritRootReveal 从 LINGGEN_GRADES 取),真实判定
    // 走 gradeName()。两边若各存一份清单(曾真这么飘过),新增品阶时轮换会漏
    // 新名、或改了判定名动画还显示旧名。故钉死:gradeName 的所有可能返回值
    // ∪ 判定条件里的字面量 ⊆ LINGGEN_GRADES 的名字集合 —— 枚举每条分支。
    const names = LINGGEN_GRADES.map((g) => g.name);
    for (let i = 0; i < 500; i += 1) {
      const p = rollLinggen(new RandomService(mulberry32(i)));
      expect(names, `rollLinggen 产出了品阶表里没有的「${p.gradeName}」`).toContain(p.gradeName);
    }
    // 判定函数内部的字面量分支(混沌/变异/天/异/真/上/伪/杂)也在表内 ——
    // 用源码审计守:凡 gradeName 里人写的「X灵根」都必须能在表中找到
    const src = readFileSync(new URL("./linggenGen.ts", import.meta.url), "utf8");
    const literals = [...src.matchAll(/return '([^']*灵根)'/g)].map((m) => m[1]);
    for (const lit of literals) {
      expect(names, `gradeName 里的分支「${lit}」不在品阶表里`).toContain(lit);
    }
  });

  it("灵根数量与资质范围合法", () => {
    const rng = new RandomService(mulberry32(2024));
    for (let i = 0; i < 300; i += 1) {
      const p = rollLinggen(rng);
      expect(p.roots.length).toBeGreaterThanOrEqual(1);
      expect(p.roots.length).toBeLessThanOrEqual(5);
      for (const r of p.roots) {
        expect(r.aptitude).toBeGreaterThanOrEqual(40);
        expect(r.aptitude).toBeLessThanOrEqual(100);
      }
      expect(p.growthMult).toBeGreaterThan(0.3);
      expect(p.growthMult).toBeLessThanOrEqual(4.5);
      expect(p.gradeName.length).toBeGreaterThan(1);
    }
  });

  it("转世资质保底生效", () => {
    const rng = new RandomService(mulberry32(7));
    for (let i = 0; i < 100; i += 1) {
      const p = rollLinggen(rng, 30);
      for (const r of p.roots) {
        expect(r.aptitude).toBeGreaterThanOrEqual(70);
      }
    }
  });

  it("元素不重复", () => {
    const rng = new RandomService(mulberry32(13));
    for (let i = 0; i < 200; i += 1) {
      const p = rollLinggen(rng);
      const els = p.roots.map((r) => r.element);
      expect(new Set(els).size).toBe(els.length);
    }
  });
});
