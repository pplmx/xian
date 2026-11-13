/**
 * 轮回台账的三行数 —— 加起来必须是总数，且两个弹窗读同一份。
 *
 * ## 由来（第 160 轮，转世这条线）
 *
 * 转世是本作最重的那次循环，也是玩家最在意「带走了什么」的地方。它的台账有 36 项，
 * 分三档：随魂（完整留下）/ 折损（只留一部分）/ 归尘（随皮囊散去）。
 *
 * 两个弹窗都读同一份台账（`ui/reincarnationDesk` 的 `samsaraBalance`），
 * 而它们把第一行**读成了两个不同的量**:
 *
 * ```text
 * ReincarnationDialog（往生三程的确认页）  balance.full    → 12
 * RebirthDialog（人物页「兵解往生」入口）   balance.keep    → 16
 * ```
 *
 * `keep = full + partial`（12 + 4）。于是同一个存档，两个屏读到的账是:
 *
 * ```text
 * 兵解往生   随魂 16 · 折损 4 · 归尘 20     ← 16+4+20 = 40，而副题写「36 项」
 * 往生三程   随魂 12 · 折损 4 · 归尘 20     ← 36，对得上
 * ```
 *
 * 「折损」那一行本来就单独报了那 4 项，第一行再加一遍就是把同一批东西数了两次。
 * 玩家看到的是「总账 36 项，三行加起来 40」—— 一个不可能成立的和。
 *
 * ## 判据
 *
 * ① `keep` 这个字段本身不许再参与「随魂」那一行 —— 它是「留下来的总数」，
 *    不是「完整留下的数」，两个弹窗要的是后者;
 * ② 三行相加必须等于 `total`（任何一份台账，任何一世）;
 * ③ 两个弹窗读**同一个字段** —— 一个是 `keep`、一个是 `full` 就是这条错的形状。
 */
import { describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { readSource } from "@/test/readSource";
import { samsaraBalance, samsaraLedger } from "@/ui/reincarnationDesk";

const REBIRTH = readSource("src/components/character/RebirthDialog.vue");
const REINCARNATION = readSource("src/components/character/ReincarnationDialog.vue");

describe("轮回台账 · 三行数必须加起来等于总数", () => {
  it("三档相加 = total（逐档都不重复计入）", () => {
    setActivePinia(createPinia());
    const balance = samsaraBalance(samsaraLedger());
    expect(
      balance.full + balance.partial + balance.reset,
      "随魂 + 折损 + 归尘 不等于总项数 —— 有一档被数了两遍",
    ).toBe(balance.total);
    // 语义上「完整留下」与「只留一部分」是互斥的，故 keep 该是两档之和、
    // 而不是与其中一档相等（把这层关系写下来，免得下次又把 keep 当 full 用）
    expect(balance.keep).toBe(balance.full + balance.partial);
    expect(balance.partial, "这一档非空，keep 与 full 才有区分意义").toBeGreaterThan(0);
  });

  it("两个弹窗读同一个字段 —— 「随魂」那一行不许一个读 keep、一个读 full", () => {
    /*
     * 判的是那件事：两张屏的「随魂」是同一个量。实现上允许它们各自写
     * `balance.full`（或都写一个共用常量），但不允许一边 `keep` 一边 `full`。
     */
    const readsKeep = /keepCount|balance\.keep/.test(REBIRTH);
    const readsFull = /balance\.full|keepFullCount/.test(REBIRTH);
    const otherFull = /balance\.full/.test(REINCARNATION);
    expect(otherFull, "确认页读的应是「完整留下」那一档").toBe(true);
    expect(
      readsKeep && !readsFull,
      "「兵解往生」那一行读的是 keep（完整+折损），与确认页的 full 不是同一个量",
    ).toBe(false);
  });

  it("判据确实扫得到东西（防空转）", () => {
    expect(REBIRTH.length, "读不到兵解往生页").toBeGreaterThan(1000);
    expect(REINCARNATION.length, "读不到往生三程页").toBeGreaterThan(1000);
  });
});
