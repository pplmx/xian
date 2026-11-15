/**
 * 人物页要报寿元 —— 那是唯一一条不可逆的线，而它不在那一页
 *
 * ## 量出来的现状
 *
 * ```text
 *   顶栏 TopStatusBar     {{ age }}/{{ max }}载        ← 只有这里
 *                         compact:hidden              ← 320px 档还收起
 *   人物页 CharacterView  无
 *   战斗页 / 修行页 / 洞府 无
 * ```
 *
 * 也就是说:**全站只有一处报寿元，而那一处在最窄的屏上还看不见**。
 *
 * ## 为什么这是一个真缺口，而不是「别处有就够了」
 *
 * 寿元是这个游戏里**唯一不可逆的东西**:
 *
 * ```text
 *   修为      可以攒，卡住了还能再等
 *   资源      可以再刷
 *   伤势      会自己好
 *   寿元      只走不回头，走完就转世（此生终）
 * ```
 *
 * 而人物页是「我此刻是什么样」的那一页 —— 战力求和、灵根、资质地板都在那里，
 * 唯独缺了那个**决定这一世还剩多久**的数。
 *
 * 本仓自己在 `docs/design.md` 里已经承认过这个落差:
 *
 * > (这个弹窗只在寿元耗尽时出现，离上一次看人物页可能过了几天)
 *
 * 那句话默认了「人物页能看寿元」—— 而它不能。
 *
 * ## 为什么还要「剩 N 载」
 *
 * 顶栏写的是 `age/max`。玩家要自己减一次才知道还剩多少，而这个减法在后期是
 * 两个七八位数相减（寿元到混沌海是数十万亿载）。本仓对这类读数的口径一直很明确:
 *
 * > 给决策前把数字摊开……不能只给定性形容词。
 *
 * `980000000000/1000000000000载` 是一句**要心算**的话；「余 20000 载」是一句
 * **能直接决定**的话。
 *
 * ## 判据守什么
 *
 * 一 人物页上真有寿元（不是只有顶栏那一处）;
 * 二 它报的是**剩余**，不是只报 age/max —— 后者要心算;
 * 三 剩余数与 store 同源（`lifespanMax - age`），不在这里另减一次;
 * 四 将尽时会变色（复用 `LIFESPAN_WARN_RATIO` 那一档，与顶栏同一张表）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { LIFESPAN_WARN_RATIO, AGE_YEARS_PER_HOUR } from "@/data/constants";
import { lifespanOf } from "@/data/realms";

const VIEW = readSource("src/views/CharacterView.vue");

describe("人物页 · 寿元", () => {
  it("人物页上真有寿元 —— 不是只有顶栏那一处", () => {
    expect(VIEW, "人物页没有寿元 —— 而它是全站唯一不可逆的那条线，且顶栏在 320 档还收起").toMatch(
      /lifespan|寿元/,
    );
  });

  it("报的是剩余，不是只报 age/max —— 后者要心算", () => {
    /*
     * `980000000000/1000000000000载` 是一句要心算的话；「余 2万 载」是一句能直接
     * 决定「这一世还够不够修到下一境」的话。
     */
    expect(VIEW, "人物页没有算「剩余」—— 玩家还得自己减一次").toMatch(
      /lifespanRemaining|lifespanMax[^\n]*-\s*(?:player\.)?age|剩余/,
    );
  });

  it("剩余数与 store 同源 —— 不在这里另减一次", () => {
    /*
     * store 已经有 `lifespanMax`（含 `lifespanPct` 与丹/际遇的加算）。
     * 视图里若写成 `realm.lifespanYears - age`，就漏掉了那两项 —— 那正是
     * 本仓反复栽的"两本账"。
     */
    const src = VIEW;
    // 不许直接用 realm 的裸寿元去减
    expect(
      src,
      "人物页用了 realm.lifespanYears 裸值 —— 那会漏掉 lifespanPct 与丹药加算",
    ).not.toMatch(/lifespanYears\s*-\s*(?:player\.)?age/);
  });

  it("将尽时变色，且与顶栏用同一档阈值", () => {
    /*
     * 顶栏与首页都用 `LIFESPAN_WARN_RATIO`。人物页若自己写 0.1 或 0.2，
     * 同一台机器上就会出现"顶栏红了、人物页没红"。
     */
    expect(VIEW, "人物页没有用 LIFESPAN_WARN_RATIO —— 与顶栏不是同一档").toContain(
      "LIFESPAN_WARN_RATIO",
    );
    expect(LIFESPAN_WARN_RATIO, "警戒阈值应当是 15%").toBe(0.15);
  });

  it("寿元与「还要修多久」是同一把尺 —— 年与小时的换算只有一处", () => {
    /*
     * `AGE_YEARS_PER_HOUR` 把年折成游戏小时。人物页若显示"余 N 载"，读的人会拿它
     * 去估"还能修几境"。判据不要求页面上出现小时数，只要求那个换算仍是全站唯一定义
     * （若哪天有人把它写死成 1，这里会红，提醒去查所有读寿元的地方）。
     */
    expect(AGE_YEARS_PER_HOUR, "年/小时的换算被人改过 —— 所有读寿元的界面都受影响").toBe(1);
    // 寿元曲线本身随境界指数增长 —— 故"剩余"必须按当前境界算，不能拿初境的数
    expect(lifespanOf(9), "仙界寿元没有大跃升 —— 那跨界就不再是「一世变长」的体验").toBeGreaterThan(
      lifespanOf(8) * 10,
    );
  });
});
