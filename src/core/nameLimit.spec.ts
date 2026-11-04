/**
 * 起名的上限 —— 四个地方都是八个字,但各写了一次。
 *
 * ## 现状
 *
 *   `stores/player.ts`   PLAYER_NAME_MAX = 8   ← 第 37 轮收进来的
 *   创建页               读 PLAYER_NAME_MAX       ← 同上
 *   `BuildView.vue`       `maxlength="8"`         ← 手写
 *   `loadoutService.ts`   `.slice(0, 8)`          ← 手写
 *   `TrialPanel.vue`      `maxlength="8"`         ← 手写
 *   `ReincarnationDialog` `maxlength="8"`         ← 手写(道号草稿)
 *
 * 六处、四个 8。语义是同一个:「给玩家输入的名字一个上限,好让它在窄屏上放得下」。
 *
 * ## 为什么这不是吹毛求疵
 *
 * 第 37 轮刚吃过一次:创建页两道(页面 + slice)、store 一道都没有 —— 契约活在错误的地方。
 * 那次修完之后,`PLAYER_NAME_MAX` 成了 store 里的公开常数,但**别的名字没用它**。
 *
 * 于是同一个「八」在四处各写一遍。哪天有人挪了顶栏的字号、或把某处上限放宽到十,
 * 另外三处不会跟着动 —— 而它们看上去是一件事(都是名字),改的人不会想到要去搜四个文件。
 *
 * ## 收成什么
 *
 * 一个 `NAME_MAX = 8`(放 `utils/` 或 `data/` 里 — 它是本作的输入约定,不是某个 store 的)。
 * 四个名字场景都读它。`PLAYER_NAME_MAX` 保留为它的别名,**不动第 37 轮刚建立的接口** ——
 * 那批调用方已经在读了,再改一遍收益不抵风险。
 *
 * ## 存名字的那一侧也要读
 *
 * `loadoutService` 那处 `slice(0, 8)` 是**真正的写入边界**(页面那侧只是输入框限制,
 * 绕过它直接调函数时靠这一处)。它读同一个常数。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

/** 用到「名字上限」的那几处 —— 一处写成路径 + 期望读到的常数名 */
const NAME_SITES = [
  { file: "src/views/BuildView.vue", kind: "maxlength" },
  { file: "src/components/celestial/TrialPanel.vue", kind: "maxlength" },
  { file: "src/components/character/ReincarnationDialog.vue", kind: "maxlength" },
  { file: "src/core/loadoutService.ts", kind: "slice" },
] as const;

describe("起名的上限 · 一个常数", () => {
  it("常数只有一处定义,且 PLAYER_NAME_MAX 是它的别名", () => {
    const src = readSource("src/utils/nameLimit.ts");
    expect(src, "该有一个 NAME_MAX").toMatch(/export const NAME_MAX\s*=\s*8/);
    const player = readSource("src/stores/player.ts");
    expect(player, "PLAYER_NAME_MAX 不该再手写一个 8").not.toMatch(
      /export const PLAYER_NAME_MAX\s*=\s*8/,
    );
    expect(player, "它该是 NAME_MAX 的别名").toMatch(/export const PLAYER_NAME_MAX\s*=\s*NAME_MAX/);
  });

  it("四处名字场景都读同一个常数", () => {
    for (const site of NAME_SITES) {
      const src = readSource(site.file);
      if (site.kind === "maxlength") {
        expect(src, `${site.file} 的 maxlength 该读 NAME_MAX`).toContain("NAME_MAX");
        expect(src, `${site.file} 不该再手写 maxlength="8"`).not.toMatch(/maxlength="8"/);
      } else {
        expect(src, `${site.file} 的裁剪该读 NAME_MAX`).toContain("NAME_MAX");
        expect(src, `${site.file} 不该再手写 slice(0, 8)`).not.toMatch(/slice\(0,\s*8\)/);
      }
    }
  });

  it("还有没有别的地方手写这个 8 —— 一处都不许留", () => {
    /*
     * 这条是兜底:上面那份清单是手工维护的,漏了新加的就查不到。
     * 这里扫全仓的 `maxlength="8"` 与 `slice(0, 8)`,一处都不许有。
     */
    const offenders: string[] = [];
    for (const file of [
      "src/views/BuildView.vue",
      "src/views/CreateView.vue",
      "src/components/celestial/TrialPanel.vue",
      "src/components/character/ReincarnationDialog.vue",
      "src/core/loadoutService.ts",
      "src/stores/player.ts",
    ]) {
      const src = readSource(file);
      if (/maxlength="8"/.test(src)) offenders.push(`${file} → maxlength="8"`);
      if (/slice\(0,\s*8\)/.test(src)) offenders.push(`${file} → slice(0, 8)`);
    }
    expect(offenders, "这些地方还手写着那个 8").toEqual([]);
  });
});

describe("起名的上限 · 别名不改变行为", () => {
  it("PLAYER_NAME_MAX 仍是 8 —— 第 37 轮的接口不变", async () => {
    const { PLAYER_NAME_MAX } = await import("@/stores/player");
    const { NAME_MAX } = await import("@/utils/nameLimit");
    expect(PLAYER_NAME_MAX).toBe(8);
    expect(PLAYER_NAME_MAX).toBe(NAME_MAX);
  });
});
