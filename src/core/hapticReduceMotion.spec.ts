/**
 * 「减少动效」必须一并关掉触感 —— 而那个相与没有判据守。
 *
 * ## 由来（第 328 轮）
 *
 * `docs/usage.md` 的「触感」那一节:
 *
 * > 设置页「声息」一章有独立的**触感开关**，与音效各管各的……
 * > 另外，**开了「减少动效」也会一并关掉触感**:那个开关的语义是「别给我动的东西」，
 * > 而震动比动画更直接作用在身体上。**两处要一起开才会震**，设置页在冲突时会明写这一句。
 *
 * 实现是 `stores/ui.ts` 里的一行:
 *
 * ```ts
 * pulseHaptics(hapticTierOf(rank), {
 *   enabled: settings.hapticsOn && !settings.reduceMotion,
 * });
 * ```
 *
 * ## 为什么需要判据
 *
 * `haptics.spec` 的「开关关掉就不震」测的是 `pulseHaptics(…, { enabled: false })` ——
 * **它验证 `pulseHaptics` 遵守 `enabled`，但没验证那个 `enabled` 是怎么算出来的。**
 *
 * 于是把 `&& !settings.reduceMotion` 删掉，全部测试照样绿:
 *
 * ```text
 * 类型系统      `settings.reduceMotion` 存在，删掉那半段是「少用了一个变量」，不报错
 * 浏览器巡游    震动在测试环境里观察不到
 * 既有判据      见上 —— 只守 pulseHaptics 那一层
 * ```
 *
 * 而它的后果是**对身体的作用**：一个明确说过「别给我动的东西」的人，
 * 拿到神品时手机会震三下。
 *
 * ## 判据
 *
 * ① `stores/ui.ts` 里那个 `enabled` 仍在（防空转）;
 * ② 它**同时**读 `hapticsOn` 与 `reduceMotion`（相与）;
 * ③ `reduceMotion` 是**取反**参与的（`!settings.reduceMotion`）—— 不然语义就反了。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const UI = readSource("src/stores/ui.ts");

describe("触感 · 减少动效一并关掉", () => {
  it("那处 enabled 还在（防空转）", () => {
    expect(UI.length, "stores/ui.ts 读出来是空的 —— 路径变了").toBeGreaterThan(500);
    expect(UI, "找不到 pulseHaptics —— 触感接线被删了或改名了").toContain("pulseHaptics(");
    expect(UI, "找不到 enabled: —— 那个开关的算法变了").toContain("enabled:");
  });

  it("enabled 同时读 hapticsOn 与 reduceMotion", () => {
    const line = UI.split("\n").find((l) => l.includes("enabled:") && l.includes("hapticsOn"));
    expect(line, "找不到同时含 enabled 与 hapticsOn 的那一行 —— 算法搬走了").toBeDefined();
    expect(line!, "触感开关没读 reduceMotion —— 开了「减少动效」照样会震").toContain(
      "reduceMotion",
    );
  });

  it("reduceMotion 取反参与 —— 它的语义是「别给我动的东西」", () => {
    const line = UI.split("\n").find((l) => l.includes("enabled:") && l.includes("hapticsOn"));
    expect(line!, "reduceMotion 没有取反 —— 那会变成「开了减少动效才震」，语义正好反了").toMatch(
      /!\s*settings\.reduceMotion/,
    );
  });
});
