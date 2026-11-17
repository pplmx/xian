/**
 * 破题警告：法宝那一半。
 *
 * ## 由来（第 472 轮）
 *
 * 第 471 轮给丹药补了「按下之前说」——`activeVowTaboo()` 查本世立的题，
 * 若忌服丹则在丹药详情里先警告。
 *
 * 而 `LifeTaboo` 是**两种**:`"pill" | "artifact"`。第 471 轮只补了前一半。
 *
 * ```text
 *   data/lifeThemes.ts:190   "lt_zejian"（独行）"这一世不借法宝之力"
 *                            → taboo: "artifact"
 *   exploration.ts:399       装上法宝后 noteTaboo("artifact")  ← 按下之后
 *   ArtifactPanel.vue        祭炼随身 按钮前一个字都没有       ← 缺的那一半
 * ```
 *
 * 两半的分量不同:服一颗丹药破题,玩家损失一颗丹;而法宝那一条要求
 * 「整世未祭一件法宝」—— 装上第一件就破题,而那是整世的主要战力来源。
 *
 * ## 判据
 *
 * ① 法宝面板在「祭炼随身」旁有服前警告，且提到「破题」；
 * ② 反差：只在**未装**时警告 —— 收回法宝不该被警告（那正是守戒）；
 * ③ 反差：文案读到命题本身（vow）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PANEL = readFileSync(resolve(__dirname, "../components/inventory/ArtifactPanel.vue"), "utf-8")
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "");

describe("立下的命题 · 法宝那一半也要在按下之前说", () => {
  it("① 法宝面板里有一句服前警告，且提到「破题」", () => {
    expect(PANEL, "法宝面板里找不到破题警告").toContain("activeVowTaboo");
    expect(PANEL, "警告里没有「破题」这一档").toMatch(/破题/);
  });

  it("② 反差：只在未装时警告 —— 收回法宝是守戒，不该警告", () => {
    /*
     * 按钮文案在 `row.equipped ? "收回法宝" : "祭炼随身"` 之间切换。
     * 警告必须跟着「祭炼」那一支，或者显式排除已装的情形 ——
     * 否则玩家收回法宝时读到「装上即破题」，是反的。
     */
    /*
     * 定位要落在**模板里那一处** `v-if`，而不是 import 行 ——
     * `indexOf("activeVowTaboo")` 先命中的是 `import { activeVowTaboo }`（实测）。
     */
    const at = PANEL.indexOf("artifactVowWarn");
    expect(at, "artifactVowWarn 定位不到 —— 判据会空转").toBeGreaterThan(0);
    const around = PANEL.slice(Math.max(0, at - 600), at + 200);
    expect(around, "警告没有判断「是否已装」—— 收回法宝时也会读到它").toMatch(/!row\.equipped/);
  });

  it("③ 反差：说到命题本身，不是一句通用警告", () => {
    const at = PANEL.indexOf("activeVowTaboo");
    const around = PANEL.slice(at, at + 800);
    expect(around, "那句话没有引到命题本身").toMatch(/\.vow/);
  });
});
