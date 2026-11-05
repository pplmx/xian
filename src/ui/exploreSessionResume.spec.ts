/**
 * 关掉页面再回来,这一趟历练要接着走 —— 不许重来。
 *
 * ## 为什么这一条最要紧
 *
 * 最长的一档历练是**四小时**(`长线云游`)。四小时里玩家必然关掉页面、锁屏、
 * 换设备 —— 一天里打开十几次是常态。
 *
 * 而这个游戏是「放置」类:它的核心承诺是**你不在的时候世界仍在转动**。
 * 若会话在刷新后重置,四小时的积累就白费,玩家也不会来报 —— 他只会觉得
 * 「这游戏一关就没了」,然后不再打开。
 *
 * ## 现状是对的,判据守的是它的机制
 *
 * 真浏览器实测(开始「深入探寻」→ 等 6 秒 → 刷新):
 *
 * ```text
 * 刷新前  余 59分54秒   距此地之主还差 10 胜
 * 刷新后  余 59分47秒   距此地之主还差  9 胜
 * ```
 *
 * 计时器继续倒、进度继续推进 —— 不只是「恢复」,而是**在关着的那段时间里也照跑**。
 *
 * 之所以能做到,是因为 `AdventureSession` 存的是**绝对时间戳**
 * (`startedAt` / `endsAt` / `nextBattleAt`),不是「已经过了多少」。刷新只换掉了
 * 「现在几点」的读取方,时间戳本身没动,于是 `now >= nextBattleAt` 立刻为真,
 * 该打的仗照打。
 *
 * 反过来:哪天有人把它改成「每 tick 累加 elapsed」,实测那条会红 —— 而静态门、
 * 类型检查、其余 500 多个 spec 全绿。
 *
 * ## 判据口径
 *
 * 一条:会话的三个时间字段必须是绝对时间戳(由 `Date.now()` 一类的 `now` 赋),
 * 不许出现「累加 elapsed / remaining--」这类相对计法。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const CORE = "src/core/exploration.ts";

describe("历练会话 · 关掉页面也要接着走", () => {
  it("会话时间用绝对时间戳,不是相对计时", () => {
    const src = readSource(CORE)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    /*
     * 逐个检查**每一处**赋值,而不是「文件里存在一处合规的」——
     * 前者才是判据。上一版只 toMatch 了一次,于是把 136 行改成常量 0 时,
     * 406/439/595 那几行仍满足正则,判据全绿(实测)。
     */
    const assignments = [...src.matchAll(/(nextBattleAt|endsAt|startedAt):\s*([^,\n}]+)/g)];
    expect(assignments.length, "一处会话时间赋值都没扫到 —— 判据会空转").toBeGreaterThanOrEqual(3);
    const bogus = assignments.filter(([, , value]) => {
      const v = value!.trim();
      // 合规写法:以 now 开头,或调用 nextBattleTime(...)
      return !/^now\b/.test(v) && !v.startsWith("nextBattleTime(");
    });
    expect(
      bogus.map(([, f, v]) => `${f} = ${v!.trim()}`),
      "这些会话时间不是由 now 推出的 —— 刷新后「关着的那段时间」会丢",
    ).toEqual([]);
    // 禁的是相对累加:那会让刷新丢掉「关着的那段时间」
    expect(src, "不许把会话时长写成相对累加(elapsed += …)—— 刷新后关着的那段时间会丢").not.toMatch(
      /(elapsed|remaining)\s*[-+]=\s*/,
    );
  });

  it("到期判定拿绝对时间比,不靠 tick 计数", () => {
    const src = readSource(CORE)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src, "战斗到期要拿 now 与 nextBattleAt 比").toMatch(/now\s*>=\s*s\.nextBattleAt/);
  });

  it("反空转:会话仍然只存一份(挂在 adventure store 的 persist 里)", () => {
    const store = readSource("src/stores/adventure.ts");
    expect(store, "会话要落盘 —— 否则刷新必丢").toContain('persist: persistConfig("adventure")');
    expect(store, "session 要在这个 store 里").toContain(
      "const session = ref<AdventureSession | null>",
    );
  });
});
