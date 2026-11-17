/**
 * 逆旅契的第三条玩法面：可用物品。
 *
 * ## 由来（第 473 轮）
 *
 * `trialMotivation.spec` 给的边界里，可动空间有五项：
 *
 * ```text
 * 可动(Rule Space)  CombatRules · 历练路线 · 可用物品 · 解锁顺序 · 本世目标
 * 不可动            StatMods · Economy(资源) · DaoFruit · Insight(宿慧)
 * ```
 *
 * 第 470 轮动了「历练路线」（断径契：这一世只走三段）。
 * 这一轮动「可用物品」——**本世不得祭用任何法宝**。
 *
 * ## 为什么这是纯逆境
 *
 * 法宝被动经 `inventory.equipMods` 汇入面板（`artifactValue(def, level).passive`），
 * 即真实的战力来源。不用它 = 少一块面板，而敌人一分不减。
 *
 * 与已有的 `lt_zejian`（独行）命题不同：那是**命题**（破了只是所得落空），
 * 这是**契约**（花道果签的，记入履历）。两者可以并存 —— 一个说「这一世我要做什么」，
 * 一个说「这一世我放弃什么」。
 *
 * ## 判据
 *
 * ① 有一份契声明「禁用某类物品」，且那类物品是已存在的类别；
 * ② 反差：它不填 rules、也不填 routeStages —— 三种玩法面各管各的；
 * ③ 生效后，法宝的被动真的不计入面板（这是行为，不是声明）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LIFE_TRIALS } from "@/data/lifeTrials";

/*
 * 注:需要 Pinia 的那两条（签契成功 + 禁令生效、反差）放在
 * `lifeTrialService.spec` 里 —— 它本来就用 Pinia，而
 * `layeringAudit.spec` 的 `CORE_PINIA_SPECS` 基线只许减不许加。
 * 本文件保持无 Pinia，只量数据与源码形状。
 */
describe("逆旅契 · 第三条玩法面：可用物品", () => {
  it("① 有一份契声明禁用某类物品", () => {
    const itemTrials = LIFE_TRIALS.filter((t) => t.bannedItemKind !== undefined);
    expect(itemTrials.length, "没有一份契约禁用物品 —— 可动空间第三项还是没动").toBeGreaterThan(0);
    for (const t of itemTrials) {
      expect(
        ["artifact", "pill"].includes(t.bannedItemKind!),
        `${t.name} 禁用了不存在的类别 ${t.bannedItemKind}`,
      ).toBe(true);
    }
  });

  it("② 反差：三种玩法面各管各的 —— 不填 rules / routeStages", () => {
    const itemTrials = LIFE_TRIALS.filter((t) => t.bannedItemKind !== undefined);
    for (const t of itemTrials) {
      expect(Object.keys(t.rules ?? {}), `${t.name} 既禁物品又改战斗规则`).toEqual([]);
      expect(t.routeStages, `${t.name} 既禁物品又压路线`).toBeUndefined();
    }
  });

  it("④ 签下时就把已装的法宝卸下 —— 否则契约说了不许，实际还在加成", () => {
    /*
     * ## 这条是被 ③ 逼出来的
     *
     * ③ 只拦「按住那一刻之后的装上」。而玩家完全可能**先装着法宝再签契** ——
     * 那时 `equippedArtifacts` 里已经有东西，而契约一句话都不会让它们失效：
     * 面板照样加成，破题判定也不会响（`noteTaboo` 只在「祭用」时调）。
     *
     * 于是出现一个荒谬状态：屏幕上写着「本世不得祭用任何法宝」，
     * 而玩家正带着两件在打。
     *
     * 故 `signLifeTrial` 签下之后要把已装的卸下 —— 那是「不祭」的自然含义。
     */
    /*
     * 这一步落在**界面**（`RebirthDialog`），不在 `signLifeTrial` 里 ——
     * `layeringAudit.spec` 要求「core 对 store 的依赖只许收拢」，
     * 为它多引一个 store 会撞上那条基线（实测 161 → 162 红）。
     * 而「改玩家身上带着什么」本来就是界面这一层的事：
     * core 声明「本世不得祭用」，界面据此执行。
     */
    const src = readFileSync(
      resolve(__dirname, "../components/character/RebirthDialog.vue"),
      "utf-8",
    )
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const at = src.indexOf("function signTrial");
    expect(at, "signTrial 定位不到 —— 判据会空转").toBeGreaterThan(0);
    const body = src.slice(at, at + 1600);
    expect(body, "签下后没有清掉已装法宝 —— 契约说不许用，而它们还在面板上加成").toMatch(
      /bannedItemKind === "artifact"[\s\S]{0,120}equippedArtifacts = \[\]/,
    );
  });

  it("③ 装上法宝这条路真的被拦住了（行为，不是声明）", () => {
    /*
     * 这一条量的是**行为**。判据读 `lifeTrialBansItem` 的唯一出口，
     * 并要求界面那一侧真的用它拦住了「装上」。
     *
     * 为什么必须读源码而不是只读数据:第 470 轮那条 `routeStages` 曾经
     * 只写进数据、生成器没接，判据全绿而路线一点没变。
     */
    const svc = readFileSync(resolve(__dirname, "./lifeTrialService.ts"), "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(svc, "没有 lifeTrialBansItem 这个唯一出口").toContain(
      "export function lifeTrialBansItem",
    );
    expect(svc, "出口没有读 bannedItemKind").toContain("bannedItemKind");

    const panel = readFileSync(
      resolve(__dirname, "../components/inventory/ArtifactPanel.vue"),
      "utf-8",
    )
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    expect(panel, "法宝面板没有查这条禁令 —— 界面照装不误").toContain(
      'lifeTrialBansItem("artifact")',
    );
    /*
     * 反差：只拦「装上」不拦「收回」—— 收回正是守戒。
     */
    const at = panel.indexOf('lifeTrialBansItem("artifact")');
    const around = panel.slice(Math.max(0, at - 400), at + 100);
    expect(around, "禁令把「收回」也拦了 —— 那会把玩家锁在破题状态里").toMatch(
      /!wearing|wearing\s*\)/,
    );
  });
});
