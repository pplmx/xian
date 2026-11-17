/**
 * 每一境都得有新东西 —— 这一条此前没人守过。
 *
 * ## 由来（第 519 轮）
 *
 * 上一轮用「跌幅」抓到了仙界边界的事件断层（境 8→9 从 64 掉到 35）。
 * 这一轮顺着同一条量法把**其它四族**也摊了一遍:
 *
 * ```text
 *   地界    2 → 44（单调递增，无跌幅）
 *   敌人    44 → 140（单调）
 *   法宝    12 → 49（单调）
 *   丹药    9 → 95（单调）
 *   功法    19 → 92（单调）
 * ```
 *
 * **五族全部单调，没有第二处跌幅。** 那个判据在这仓里只对事件成立 ——
 * 因为只有事件设 `maxRealm`（人间的事到了仙界不该再撞见），
 * 其余五族是「只加不减」的累计池。
 *
 * ## 而摊完之后剩下一件更基本的事没人问
 *
 * 上表全是**累计**数。累计单调是必然的（只加不减），说明不了「这一境有没有新东西」。
 * 真正该问的是:**逐境的增量** —— 有没有哪一境，玩家升上去之后一件新东西都没解锁:
 *
 * ```text
 *   境 r 的新内容 = 丹药(minRealm=r) + 功法(r) + 地界(r) + 事件(minRealm=r)
 * ```
 *
 * 实测 0~20 境:没有空的。**但这条此前没有任何判据在守**。
 *
 * ## 判据
 *
 * ① 每一境至少解锁一件新东西;
 * ② 反差:累计池单调是必然的，不构成判据 —— 只守「告警值」;
 * ③ 反差:境界 0 可以宽（开局内容集中在那里），但不许为空。
 */
import { describe, expect, it } from "vite-plus/test";
import { PILLS } from "@/data/pills";
import { GONGFA } from "@/data/gongfa";
import { REGIONS } from "@/data/regions";
import { ARTIFACTS } from "@/data/artifacts";
import { PETS } from "@/data/pets";
import { EVENTS } from "@/data/events";
import { REALMS } from "@/data/realms";

/** 这一境**新解锁**的内容件数（不含此前已可用的） */
function newlyAt(realm: number): number {
  return (
    PILLS.filter((p) => p.minRealm === realm).length +
    GONGFA.filter((g) => g.minRealm === realm).length +
    REGIONS.filter((r) => r.minRealm === realm).length +
    EVENTS.filter((e) => ((e as unknown as { minRealm?: number }).minRealm ?? 0) === realm).length
  );
}

describe("境界覆盖 · 升上去之后得有新东西", () => {
  it("① 每一境至少解锁五件新东西", () => {
    /*
     * ## 阈值为什么是 5 而不是 1
     *
     * 第一版写的是「至少 1 件」—— 而实测每一境最少也有 8 件（境 17 神帝），
     * 于是那条断言恒真，等于没守。**判据的阈值要贴着当前读数，不是贴着零。**
     *
     * 实测逐境新增（第 519 轮）:
     *
     * ```text
     *   0:93  1:21  2:31  3:16  4:18  5:18  6:15  7:9   8:11  9:22  10:15
     *   11:13 12:13 13:11 14:17 15:13 16:11 17:8  18:18 19:13 20:11
     * ```
     *
     * 最薄的是境 17（神帝）8 件。故阈值取 5 —— 低于它说明那一境真的快空了。
     */
    const realms = REALMS.length;
    const thin: string[] = [];
    for (let r = 0; r < realms; r += 1) {
      const n = newlyAt(r);
      if (n < 5) thin.push(`境 ${r}（${REALMS[r]?.name ?? "?"}）:${n} 件`);
    }
    expect(
      thin,
      "这些境界升上去之后几乎没新东西 —— 玩家会问「我练它做什么」：" + thin.join("、"),
    ).toEqual([]);
  });

  it("② 报告：把逐境**可用**事件摊开，标出最薄的那几境", () => {
    /*
     * ## 这一行的口径改过一次（第 522 轮）
     *
     * 上一轮它量的是「逐境**新增**」，于是打出「境 17 神帝 8 件、境 7 大乘 9 件」。
     * 而按那个读数补完内容之后去查**玩家实际能撞见多少**:
     *
     * ```text
     *   境 7   可用 68 则    新增 10 件
     *   境 17  可用 71 则    新增 10 件
     * ```
     *
     * **池子一点也不薄。** 「新增」量的是「这一境有没有新东西」，
     * 而玩家感受到的是「这一境能撞见多少」—— 后者是 `min ≤ r ≤ max` 的累计，
     * 与新增是两回事。上一轮把前者当成后者，补了两处并不薄的地方。
     *
     * 按总量重算:min 40（境 9）· max 85（境 2）· 比值 2.13，
     * 最薄的三境是 **境 9 / 10 / 11 —— 仙界前段**，也正是第 518 轮补过四条的那一段。
     */
    const rows = REALMS.map((r, i) => ({
      name: r.name,
      realm: i,
      n: EVENTS.filter((e) => {
        const min = (e as unknown as { minRealm?: number }).minRealm ?? 0;
        const max = (e as unknown as { maxRealm?: number }).maxRealm ?? 99;
        return min <= i && max >= i;
      }).length,
    }));
    const sorted = [...rows].sort((a, b) => a.n - b.n);
    const median = rows.map((r) => r.n).sort((a, b) => a - b)[Math.floor(rows.length / 2)]!;
    console.log(
      `\n逐境**可用**事件（中位 ${median} 则）：` +
        sorted
          .slice(0, 3)
          .map((r) => `\n  最薄 · 境 ${r.realm}（${r.name}）${r.n} 则`)
          .join("") +
        `\n  最厚 · 境 ${sorted[sorted.length - 1]!.realm}（${sorted[sorted.length - 1]!.name}）${sorted[sorted.length - 1]!.n} 则`,
    );
    /* 反空转：摊出来得有 21 行 */
    expect(rows.length, "境界表空了 —— 报告没内容可打").toBeGreaterThan(10);
  });

  it("③ 反差：累计池单调是必然的，不构成判据", () => {
    /*
     * 累计数只加不减 —— 它恒单调，故守它等于没守。
     * 这一条把「为什么不用累计」写进判据里，免得后来者又去加一条恒真的断言。
     */
    for (let r = 1; r < REALMS.length; r += 1) {
      const prev = PILLS.filter((p) => p.minRealm <= r - 1).length;
      const cur = PILLS.filter((p) => p.minRealm <= r).length;
      expect(cur, `丹药累计在境 ${r} 掉了 —— 那是有东西被删了`).toBeGreaterThanOrEqual(prev);
    }
  });

  it("④ 反差：法宝与灵兽不进这条判据 —— 它们按层级收，不按境界解锁", () => {
    /*
     * `ArtifactDef` 用 `fromTier`（区域层级），`PetDef` 用品质 —— 两者都没有
     * 「某境界解锁」这回事。把它们算进来会让判据虚高：一件法宝的 fromTier 是 12，
     * 不代表境界 12 解锁了它。
     * 这一条守的是①的口径：只用真正按境界解锁的四族。
     */
    const artsWithoutRealm = ARTIFACTS.every(
      (a) => (a as unknown as { minRealm?: number }).minRealm === undefined,
    );
    expect(artsWithoutRealm, "法宝开始按 minRealm 收了 —— 判据①的口径要重看").toBe(true);
    expect(PETS.length, "灵兽表空了").toBeGreaterThan(0);
  });
});
