/**
 * 立题那一刻 —— 只说「做到给多少宿慧」,不说「做到之后你记住什么」。
 *
 * ## 复现
 *
 * 转世三程的第三程要立题。每张命题卡片显示这些东西:
 *
 * ```text
 * 结丹                    做到 +22 宿慧
 * 这一世,先把丹结了再说别的。
 * 本世修至金丹
 * ```
 *
 * 而 `data/lifeThemes` 里每条命题都还有一个 `legacy` —— 它的注释写着
 * 「**达成后随神魂不灭的所得(叙事,实际收益是宿慧)**」:
 *
 * ```text
 * 你记得结丹那一刻气机是怎么盘拢的——往后每一世都少走一段弯路。
 * 山川的形貌刻进了神魂,哪条谷通往哪片林,你再不会迷路。
 * 草木的名字从此跟着你走,下一世睁眼便叫得出来。
 * ```
 *
 * 这三句全都不在选择卡片上 —— 它们只在**达成之后**的回照里出现一次
 * (`reviewTheme.legacy`)。
 *
 * ## 为什么这一处值得修
 *
 * 1. **决策信息不完整。** 选命题是一次不可逆的选择(这一世就这一条),而卡片只给了
 *    「+N 宿慧」这个数字。`legacy` 说的正是「做到之后你会得到什么」—— 那是决策的
 *    另一半依据。本仓 `AGENTS.md` 的「决策信息完整」写的正是这件事。
 *
 * 2. **它是这 17 条命题里写得最好的部分。** 「你记得结丹那一刻气机是怎么盘拢的」
 *    比「+22 宿慧」有分量得多 —— 而玩家在**选择的那一刻**看不到它,只在已经做完
 *    之后才读到。等于把最好的文案放在了最不需要它的位置。
 *
 * 3. 同一屏上,禁忌(`taboo`)是显示了的(「忌:服食丹药 —— 一世守之」),说明
 *    「代价要说」这条已经做到;缺的是**回报那一半**。
 *
 * ## 判据守什么
 *
 * 一条:命题选择卡片要显示 `legacy`,且文案取自 `lifeThemeDef`(不在这里另写一份)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const DIALOG = "src/components/character/ReincarnationDialog.vue";

describe("立题 · 要说清做到之后你会记住什么", () => {
  it("选择卡片里出现 legacy", () => {
    const src = readSource(DIALOG).replace(/<!--[\s\S]*?-->/g, "");
    // 找命题卡片那一块
    const block = src.match(/reincarnation-theme-choice[\s\S]{0,2200}?<\/button>/)?.[0] ?? "";
    expect(block, "定位不到命题卡片 —— 判据会空转").not.toBe("");
    expect(
      block,
      "命题卡片只给了「+N 宿慧」,没给 legacy —— 玩家在立题那一刻读不到「做到之后你记住什么」",
    ).toMatch(/legacy/);
  });

  it("反空转:誓言、目标、禁忌仍在(不是拿 legacy 换掉别的)", () => {
    const src = readSource(DIALOG).replace(/<!--[\s\S]*?-->/g, "");
    const block = src.match(/reincarnation-theme-choice[\s\S]{0,2600}?<\/button>/)?.[0] ?? "";
    expect(block, "誓言不能丢").toContain("t.vow");
    expect(block, "判据目标不能丢").toContain("t.goal");
    expect(block, "禁忌不能丢").toContain("TABOO_NAMES");
  });

  it("达成后的回照仍要显示 legacy —— 两处都该有", () => {
    const src = readSource(DIALOG);
    const hits = (src.match(/\.legacy/g) ?? []).length;
    expect(hits, "legacy 只在达成后显示过 —— 选择时也要有").toBeGreaterThanOrEqual(2);
  });
});
