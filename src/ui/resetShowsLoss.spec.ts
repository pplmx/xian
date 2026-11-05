/**
 * 重置存档 —— 说清「无法恢复」还不够,要摊开「会失去什么」。
 *
 * ## 复现:最重的不可逆操作,只给了一句定性的话
 *
 * 设置页的重置确认框现在是这样:
 *
 * ```text
 * 重置游戏
 *
 * 此举将彻底抹去本机的一切修行痕迹,包括转世收获,且无法恢复。
 *
 *              [再想想]  [道心已决]
 * ```
 *
 * 话说得对,也确实点破了「包括转世收获」与「无法恢复」。但它**没摊开数字**:
 * 玩家点下去之前,不知道自己这一按会抹掉第几世、什么境界、多少道果。
 *
 * ## 为什么这一处要紧
 *
 * 本仓 `AGENTS.md` 的「决策信息完整」那条写着:
 *
 *   > 给决策前把数字摊开(奖励、代价、把握、生效时长、成功率),不能只给定性
 *   > 形容词(「皆有裨益」「更容易」不算数)。
 *
 * 而重置是**代价最大、且完全不可逆**的那一个 —— 它比任何一次突破、任何一次
 * 转世都彻底(转世还留随魂,重置连随魂都不留)。
 *
 * 更要紧的是**它出现在一个平时不做决策的页面里**:设置页大多数开关是「改了还能
 * 改回来」的,而这一颗是地雷。在一列可逆开关中间放一个不可逆的重磅动作,
 * 只给一句定性的话,玩家很容易按「设置页的常规节奏」滑过去。
 *
 * ## 判据守什么
 *
 * 一条:重置确认里要出现**将被抹去的具体读数**(至少两样)。
 *
 * 不规定是哪两样、怎么排版 —— 只要求它不再只是一句形容词。
 * 具体的读数由 `player` / `reincarnation` 现取,不手抄。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const VIEW = "src/views/SettingsView.vue";

describe("重置存档 · 要摊开会失去什么", () => {
  it("重置确认里有具体读数,不只是「一切修行痕迹」", () => {
    const src = readSource(VIEW);
    const modal = src.match(/:open="resetConfirm"[\s\S]{0,2200}?<\/BaseModal>/)?.[0] ?? "";
    expect(modal, "定位不到重置确认框 —— 判据会空转").not.toBe("");
    /*
     * 起码要报两样会被抹掉的东西。数的是**插值表达式**的次数:
     * 定性的话不会有 {{ }},有读数的才有。
     */
    const reads = (modal.match(/\{\{[^}]+\}\}/g) ?? []).length;
    expect(
      reads,
      `重置确认里只有 ${reads} 处读数 —— 最重的不可逆操作不该只给一句「彻底抹去」,要摊开会失去什么`,
    ).toBeGreaterThanOrEqual(2);
  });

  it("读数从 player / 轮回那里现取,不手抄", () => {
    const src = readSource(VIEW);
    expect(src, "要用玩家存档念出「将失去什么」").toMatch(
      /from ["']@\/stores\/player["']|usePlayerStore/,
    );
    // 禁的是把数字写死
    const modal = src.match(/:open="resetConfirm"[\s\S]{0,2200}?<\/BaseModal>/)?.[0] ?? "";
    expect(modal, "重置确认里不许出现硬编码的世数 / 境界名").not.toMatch(/第\s*\d+\s*世/);
  });

  it("反空转:「无法恢复」这句话仍在 —— 补读数不是把警示换掉", () => {
    const src = readSource(VIEW);
    const modal = src.match(/:open="resetConfirm"[\s\S]{0,2200}?<\/BaseModal>/)?.[0] ?? "";
    expect(modal, "不可恢复的警示要留着").toContain("无法恢复");
  });
});
