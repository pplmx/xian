/**
 * 转世时「先归档、再清空」—— 顺序反了，这一世的道侣就不留痕。
 *
 * ## 由来（第 182 轮，查跨世代延续）
 *
 * 转世账目（`core/samsaraAudit`）对「道友」写的是:
 *
 * ```text
 * mode: partial
 * detail: 关系归档入履历(archiveBond)，人不留下；留的是曾同行这件事
 * ```
 *
 * 实现分两步:`archiveBond()` 产出一条记录并顺手 `setBond(null)` 清空,
 * 然后 `player.recordBond(rec)` 写进履历。
 *
 * **顺序是全部**:`archiveBond()` 读的是 `player.bond`,而它自己会把它置 null。
 * 若有人把 `player.rebirth()` 提到前面（它可不认 `bond` 以外的东西,
 * 未来若有人「顺手」在那里也清一次），或者把归档挪到 `rebirth` 之后,
 * 归档读到的就是 null —— **这一世与谁同行，一点痕迹都不留**,
 * 而界面上不会有任何异常:履历里只是少了一条。
 *
 * ## 这条判据守什么
 *
 * ① `confirmReincarnation` 里 `archiveBond()` 在 `player.rebirth(` 之前;
 * ② 归档紧接着就 `recordBond`（否则记录产出了却没写进履历）;
 * ③ 前提自检:那两个符号都还叫这个名字（免得不小心把「判据过时」
 *    误读成「产品坏了」—— 见 `dailySettleOrder.spec` 那条同款）。
 *
 * ## 一个我错过的判据
 *
 * 动手写这条之前，我先用 `player.rebirth()` 单独测了一遍，发现道侣原样留着，
 * 差点报成缺陷。**是我的测法绕过了整条流程** —— 归档在 `confirmReincarnation`
 * 里，不在 `rebirth` 里。这条判据因此按**函数内的相对位置**判，
 * 而不是去复现一条不完整的调用链。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

const SRC = "src/core/reincarnation.ts";

describe("转世 · 先归档再清空", () => {
  it("判据的前提还在 —— 那两个符号都还叫这个名字", () => {
    const src = stripComments(readSource(SRC));
    for (const name of ["archiveBond(", "player.rebirth(", "recordBond("]) {
      expect(src, `判据的前提没了：${name} —— 判据该跟着改，不是删掉`).toContain(name);
    }
  });

  it("archiveBond 在 player.rebirth 之前 —— 反过来这一世的道侣就不留痕", () => {
    const src = stripComments(readSource(SRC));
    const archiveAt = src.indexOf("archiveBond(");
    const rebirthAt = src.indexOf("player.rebirth(");
    expect(archiveAt, "找不到 archiveBond 调用").toBeGreaterThan(-1);
    expect(rebirthAt, "找不到 player.rebirth 调用").toBeGreaterThan(-1);
    expect(
      archiveAt,
      "archiveBond 排在 player.rebirth 之后 —— 那时 bond 已被清掉，归档只能拿到 null，" +
        "这一世与谁同行一点痕迹都不留，而且界面上不会有任何异常",
    ).toBeLessThan(rebirthAt);
  });

  it("归档之后紧接着写进履历（产出了却不写，等于没归档）", () => {
    const src = stripComments(readSource(SRC));
    const archiveAt = src.indexOf("archiveBond(");
    const recordAt = src.indexOf("recordBond(");
    expect(recordAt, "找不到 recordBond 调用").toBeGreaterThan(-1);
    expect(recordAt, "recordBond 排在 archiveBond 之前 —— 那时还没有记录可写").toBeGreaterThan(
      archiveAt,
    );
    /*
     * 而且必须**紧邻**:中间隔了几十行也行，但若跨过一个函数边界就说明
     * 它们不在同一条流程里了。这里用「同一段 400 字符内」当尺度 ——
     * 足够容纳一句注释与一个 if，又不至于把另一个函数也算进来。
     */
    expect(recordAt - archiveAt, "归档与写履历隔得太远 —— 确认它们还在同一条流程里").toBeLessThan(
      400,
    );
  });
});
