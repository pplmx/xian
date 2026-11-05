/**
 * 引擎暂停时,所有时限都要一起顺延 —— 漏一个就是「暂停吃掉了时间」。
 *
 * ## 这条原则
 *
 * 这个游戏里每个「有时限」的状态都存**绝对时刻**(`expiresAt` / `endsAt` / `readyAt`),
 * 不存「已经过了多少」。这是「关掉页面再回来还在走」能成立的前提
 * (见 `ui/exploreSessionResume.spec`)。
 *
 * 但它带出一个反过来的要求:引擎**暂停**时(开局引导、弹窗、切后台),
 * 墙钟仍在走,而这些绝对时刻不会自己等 —— 暂停多久,时限就被吃掉多久。
 *
 * `shiftTimedState` 的注释把代价写得很清楚:
 *
 * > Duration clocks (held time / revival / prosperity idle) use "since" stamps.
 * > If they stay put, a pause eats revive hours and inflates 已守.
 *
 * 于是引擎恢复时统一做一次顺延。
 *
 * ## 缺口:这一层没有判据
 *
 * 顺延覆盖了 **8 个字段**,分散在四个地方(`player` / `cultivation` / `adventure` /
 * `earlyGame`),而这些函数**一条用例都没有**。
 *
 * 漏掉任何一个的代价是静默的:玩家在弹窗里待了五分钟,那个五分钟的 buff 就白少了
 * 五分钟;卦象本来还剩两分钟,变成已经过期。没人会来报 —— 玩家只会觉得「运气不好」。
 *
 * 而这类字段还会继续长(每加一个新机制就可能多一个时限状态)。故判据守的**不是
 * 现在这 8 个字段**,而是「新增时限状态时,别忘了把它接进顺延」这件事。
 *
 * ## 判据口径
 *
 * 两条:
 *   一 引擎暂停时必须调用**全部四处**顺延,少一处就是半个游戏在暂停里流血;
 *   二 顺延函数必须真的按 `pausedMs` 平移(不是传进去就完事)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const ENGINE = "src/core/engine.ts";

describe("引擎暂停 · 所有时限一起顺延", () => {
  it("四处顺延都要调到", () => {
    const src = readSource(ENGINE)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    /*
     * 找暂停恢复那一段(以 pausedMs 为线索),看四处是否齐全。
     * 不按整文件找 —— 否则函数被挪到别处、或只在一处调用,判据照样绿。
     */
    const block = src.match(/pausedMs[\s\S]{0,700}?\n  \}/)?.[0] ?? "";
    expect(block, "定位不到暂停恢复那段 —— 判据会空转").not.toBe("");
    const required: [string, string][] = [
      ["shiftBuffEnds(", "修为 buff 的 endsAt"],
      ["usePlayerStore().shiftTimedState(", "卜卦 / 区域事件 / 突破准备 / 顿悟冷却 / 镇压 since"],
      ["useAdventureStore().shiftTimedState(", "历练会话"],
      ["shiftEarlyGameWindows(", "开局引导的时间窗"],
    ];
    const missing = required.filter(([call]) => !block.includes(call)).map(([, what]) => what);
    expect(
      missing,
      `暂停恢复时漏了顺延:${missing.join(" / ")} —— 暂停多久,那些时限就被吃掉多久`,
    ).toEqual([]);
  });

  it("顺延函数真的按 pausedMs 平移,不是传进去就完事", () => {
    // player:每个时限字段都要出现 + pausedMs
    const player = readSource("src/stores/player.ts");
    const shift =
      player.match(/function shiftTimedState\(pausedMs: number\)[\s\S]*?\n    \}/)?.[0] ?? "";
    expect(shift, "定位不到 shiftTimedState").not.toBe("");
    for (const field of ["expiresAt", "endsAt", "readyAt"]) {
      expect(shift, `${field} 没有按 pausedMs 平移`).toContain(`${field}: `);
      expect(shift, `${field} 没有 + pausedMs`).toMatch(new RegExp(`${field}:[^\\n]*\\+ pausedMs`));
    }
    expect(shift, "顿悟冷却没顺延").toMatch(/enlightenmentAt\.value \+= pausedMs/);

    // cultivation:所有 buff 一起平移
    const cult = readSource("src/stores/cultivation.ts");
    expect(cult, "buff 的 endsAt 要按 pausedMs 平移").toMatch(
      /endsAt:\s*b\.endsAt\s*\+\s*pausedMs/,
    );
  });

  it("反空转:beginPause/endPause 仍存在,顺延是在恢复那一刻做的", () => {
    const src = readSource(ENGINE);
    expect(src, "暂停恢复的入口要在").toMatch(/pausedMs/);
    expect(src, "顺延要在恢复时发生").toMatch(/shiftBuffEnds\(pausedMs\)/);
  });
});
