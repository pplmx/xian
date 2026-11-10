/**
 * 界面上的数字必须与结算同源。
 *
 * ## 规矩出自哪里
 *
 * `AGENTS.md` 的「改动纪律」第一条:
 *
 * > **界面上出现的每个数字都与结算同源**。奖励文案 = `grantReward`/`rewardTextAtTier`
 * > 同一套换算;文案里不许手写会被常数改动的数字 ——「改常数就撒谎」。
 *
 * `docs/development.md` 里也有同一条:「**别在视图里再写一遍 12/18/24**,
 * 改一处就分叉。故把阶梯摊成一张表,判定与读数同读它。」
 *
 * ## 缺口是什么(第 85 轮实测)
 *
 * 自动重铸的「保留阈值上限」在**三处各写了一遍**:
 *
 * ```text
 *   EquipReforgePanel.vue  <input type="range" max="1">     滑块能拉到多高
 *   core/reforge.ts        (target.minRoll ?? 0) < 1        能不能命中
 *   EquipReforgePanel.vue  「阈值已到 100%」                 提示文案
 * ```
 *
 * 三处指同一件事,却各写各的字面量。已提出 `REFORGE_ROLL_MAX`,三处同读它。
 *
 * ## 判据
 *
 * 这是一条**结构性**判据,不试图穷举「哪些数字该同源」——那不可判定。
 * 它只钉住已经发现的那几处:**这几个具体的位置不许再出现字面量**。
 *
 * 每加一条进 `PINNED`,都是在说「这里曾经分叉过」。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";
import { REFORGE_ROLL_MAX } from "@/data/constants";

/**
 * 已经被钉住的「同一概念、多处字面量」。
 *
 * 每条给出:文件、不许再出现的模式、该引用的常量。
 */
const PINNED: readonly {
  file: string;
  /** 不许出现的字面量写法(正则) */
  forbidden: RegExp;
  /** 该改成引用的常量名 */
  constant: string;
  why: string;
}[] = [
  {
    file: "src/components/equipment/EquipReforgePanel.vue",
    forbidden: /max="1"(?=\s|$)/,
    constant: "REFORGE_ROLL_MAX",
    why: '滑块上限曾经写死 max="1",与 core/reforge.ts 的 < 1 各写一份',
  },
  {
    file: "src/components/equipment/EquipReforgePanel.vue",
    forbidden: /阈值已到 100%/,
    constant: "REFORGE_ROLL_MAX",
    why: "提示文案曾经写死「100%」,改阈值就会撒谎",
  },
  {
    file: "src/core/reforge.ts",
    forbidden: /\(target\.minRoll \?\? 0\) < 1\b/,
    constant: "REFORGE_ROLL_MAX",
    why: "命中判定曾经写死 < 1",
  },
];

describe("界面数字 · 不许与结算分叉", () => {
  for (const pin of PINNED) {
    it(`${pin.file} 不再写死 ${pin.constant}`, () => {
      const text = readFileSync(join(ROOT, pin.file), "utf8");
      expect(
        pin.forbidden.test(text),
        `${pin.file} 又写死了字面量(${pin.why})—— 改成引用 ${pin.constant}`,
      ).toBe(false);
      // 同时确认它真的引用了常量(否则删掉字面量也可能只是猜了个新数)
      expect(
        text.includes(pin.constant),
        `${pin.file} 没有引用 ${pin.constant} —— 字面量删了但没接上同源`,
      ).toBe(true);
    });
  }

  it("REFORGE_ROLL_MAX 仍是满掷点(1)", () => {
    /*
     * 这条防的是「有人把常量改了却忘了改滑块步进」:
     * 滑块 `step=0.05` 能拉到 1,若常量改成 0.5,界面就会有一个永远够不着的上限区段。
     */
    expect(REFORGE_ROLL_MAX, "掷点上限不再是 1 —— 滑块步进与文案都要一起复查").toBe(1);
  });

  it("反空转:PINNED 不为空,且每条都指向真实存在的文件", () => {
    expect(PINNED.length, "PINNED 空了 —— 这份判据不再守任何东西").toBeGreaterThanOrEqual(3);
    for (const pin of PINNED) {
      const text = readFileSync(join(ROOT, pin.file), "utf8");
      expect(text.length, `${pin.file} 是空的`).toBeGreaterThan(100);
    }
  });
});
