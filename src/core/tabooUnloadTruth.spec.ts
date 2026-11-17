/**
 * 一段注释说「签契之后会把已经装着的法宝卸下」—— 而代码里没有这一步。
 *
 * ## 由来（第 516 轮）
 *
 * 顺着上一轮「类型支持但实现没接」的办法查同一对枚举（`LifeTaboo` /
 * `bannedItemKind` 都是 `"artifact" | "pill"`），两档都有实现，这条线是完整的。
 *
 * 而在 `lifeTrialService.signLifeTrial` 里读到一段注释:
 *
 * ```text
 *   签下「不祭法宝」这类契之后,把已经装着的那几件卸下(第 473 轮)。
 *
 *   不卸的话会出现一个荒谬状态:屏幕上写着「本世不得祭用任何法宝」,
 *   而玩家正带着两件在面板上加成 —— noteTaboo 只在祭用那一刻判定,
 *   已经装着的不会触发它,于是契约说了不许,实际一分好处都没少。
 *
 *   卸下是「不祭」的自然含义,不是惩罚:法宝还在行囊里,收回即守戒。
 * ```
 *
 * 而整个函数里 `unequip` 与 `equippedArtifacts` **一次都没出现**
 * （用 `signLifeTrial.toString()` 实测检过）。
 *
 * ## 而 `ArtifactPanel` 的说法与它**相反**
 *
 * ```text
 *   只拦「装上」,不拦「收回」:收回正是守戒,拦住它就等于把玩家锁在破题状态里。
 *   已装的旧档不在这里被强制卸下 —— 那会改变玩家上一刻的战力,
 *   且契约是「不祭」,从这一件起不祭即可。
 * ```
 *
 * 后者的理由更硬（改变已发生的战力是更坏的体验），故**代码是对的，注释过期了**。
 *
 * ## 判据
 *
 * ① 注释里说「会做某件事」，代码里就得真有那一步;
 * ② 反差:注释里说「不做某事」时，代码里确实不做（这条也要成立）;
 * ③ 反差:两类禁物（法宝 / 丹药）的判定语义一致 —— 都不回溯卸下已在身的。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { signLifeTrial } from "@/core/lifeTrialService";
import { stripComments } from "@/test/stripComments";

describe("逆旅契 · 注释说的行为，代码里得有", () => {
  it("① 说「签下之后把已经装着的卸下」，代码里就得有待卸动作", () => {
    const src = readFileSync(resolve(__dirname, "lifeTrialService.ts"), "utf8");
    /*
     * 取 `signLifeTrial` 的函数体（从它的声明到文件里下一个顶层 `export`）。
     */
    const start = src.indexOf("export function signLifeTrial");
    expect(start, "找不到 signLifeTrial").toBeGreaterThan(0);
    const rest = src.slice(start);
    const nextExport = rest.indexOf("\nexport ", 10);
    const body = nextExport > 0 ? rest.slice(0, nextExport) : rest;

    /* 跨行匹配 —— 注释里「签下」与「卸下」常不在同一行 */
    /* 词集放宽：「卸下 / 取下 / 收下 / 摘掉」都是「把已装着的拿掉」 */
    const commentSaysUnload = /签下[\s\S]{0,80}?(?:卸下|取下|摘掉|强行收起)/.test(body);
    /*
     * ## 这一行改过两次
     *
     * 第一版直接 `/unequip|equippedArtifacts/.test(body)` —— 而它恒为真,
     * 因为**这段注释自己就写着「与库存相关的调用一个都没有」这类话**。
     * 判据拿注释里的词当成了代码里的证据（第 510 轮那个毛病）。
     *
     * 第二版我在本文件里写了一份 `stripComments` —— 而仓里**早已有一份**
     * （`@/test/stripComments`，由 `stripCommentsParity.spec` 守着「只许有一份」）。
     * 那正是第 510 轮记的「先查有没有现成的工具」。
     */
    const codeOnly = stripComments(body);
    const codeUnloads = /unequip|equippedArtifacts/.test(codeOnly);
    /*
     * 两者要么都有、要么都没有。只有一个，就是注释或实现有一方在撒谎。
     */
    expect(
      commentSaysUnload === codeUnloads,
      commentSaysUnload
        ? "注释说「签下之后把已经装着的卸下」，而代码里没有这一步"
        : "反了：注释没说卸下，代码却在卸 —— 那注释漏了一句",
    ).toBe(true);
  });

  it("② 反差：「只拦装上不拦收回」这条要真的成立", () => {
    /*
     * `ArtifactPanel.toggleArtifact` 是唯一拦装备的地方。
     * 它必须只在「要装上」时拦，不许在「要收回」时拦 ——
     * 拦住收回等于把玩家锁在破题状态里。
     */
    const panel = readFileSync(
      resolve(__dirname, "../components/inventory/ArtifactPanel.vue"),
      "utf8",
    );
    expect(panel, "ArtifactPanel 不再拦禁令了 —— 那弃器契就形同虚设").toMatch(
      /lifeTrialBansItem\("artifact"\)/,
    );
    expect(panel, "拦禁令时没有区分「已装/未装」—— 收回也会被拦").toMatch(/!wearing\s*&&/);
  });

  it("③ 反差：两档禁物的语义一致 —— 都不回溯清掉已在身的", () => {
    /*
     * 法宝侧不卸（ArtifactPanel 的注释写明理由）；丹药侧也不必「倒掉已持有的丹」。
     * 两档都只禁**使用**，不清库存 —— 否则「签契」就变成了一种惩罚。
     */
    const svc = readFileSync(resolve(__dirname, "lifeTrialService.ts"), "utf8");
    expect(svc, "signLifeTrial 直接清丹药库存 —— 那签契就是惩罚").not.toMatch(
      /signLifeTrial[\s\S]{0,2000}?pills\s*=\s*\{\}/,
    );
    /* 反空转：函数本身要存在 */
    expect(typeof signLifeTrial).toBe("function");
  });
});
