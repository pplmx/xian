/**
 * 突破成功率撞到天花板时，那截被吃掉的数要说得出来。
 *
 * ## 缺口（第 393 轮实测确认）
 *
 * `clampRate` 把成功率封在 `BT_MAX_RATE`（98%）。这条封顶本身是设计
 * （「余下的是天意」，见 `data/constants`），问题是**它的代价从来没被说出来**：
 *
 * ```text
 *   小进阶基础率   71% ~ 95%   （BT_SUB_BASE_RATE 0.95 / BT_SUB_DECAY 0.03）
 *   封顶           98%
 * ```
 *
 * 于是**从第一层起**，任何两个 `breakthroughRate` 来源就触顶：
 *
 * ```text
 *   天命 +5% + 圆融 +3%        裸算 103%  → 实发 98%   溢出 5pp
 *   …再叠聚气丹 +8%            裸算 111%  → 实发 98%   溢出 13pp
 *   …再叠静坐 +8%              裸算 119%  → 实发 98%   溢出 21pp
 * ```
 *
 * 而面板只印一个 `rateText`。玩家看到「98%」以为自己堆到顶了，看不出
 * **为此付的天赋位、那一炉丹、那 3 分钟坐等已经白花**。
 *
 * 这正是 `AGENTS.md`「让看不见的机制可见」那一条：
 * 封顶是一条真规则，而它的代价此前只活在 `clampRate` 那一行里。
 *
 * ## 判据守什么
 *
 * ① 溢出量算得对：`rateOverflow = max(0, 裸算 − 封顶后)`；
 * ② 判定仍读**封顶后**的数（预览与结算同源，不许为了报数把判定改了）；
 * ③ 零溢出时不许硬凑一句话（没撞天花板就不该有一条「多出的 0% 不计」）；
 * ④ 视图真的把这句印出来，且封顶数字读常量、不手写。
 *
 * 封顶**值**不在这里断言 —— 那是 `data/constants` 的事，改它不该让这条红。
 * 这条只问「差额有没有被算出来、有没有说出口」。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { clampRate } from "./formulas";
import { BT_MAX_RATE } from "@/data/constants";

/**
 * 复刻 `breakthroughInfo` 末尾那两行。
 *
 * 与 `adventureRewardLine.spec` 同一条纪律：这几行短到可以抄，
 * 而「抄的那份会不会与视图分叉」由下面那条读源码的判据兜着。
 */
function overflowOf(raw: number): { rate: number; raw: number; overflow: number } {
  const rate = clampRate(raw);
  return { rate, raw, overflow: Math.max(0, raw - rate) };
}

describe("突破成功率 · 封顶吃掉的那一截", () => {
  it("常见堆法真的会撞天花板 —— 这不是罕见边界", () => {
    /*
     * 这一条是整条的**前提**：若哪天基础率被调低到撞不上，那么「报不报溢出」
     * 就不重要了，下面的判据也就失去意义。故先钉住「撞得上」这个事实。
     */
    const base = 0.95; // BT_SUB_BASE_RATE
    // 天命 +5% 与圆融 +3% 是两个常见天赋
    expect(
      base + 0.05 + 0.03,
      "基础率 + 两个常见天赋已经不再触顶 —— 这条判据的前提变了，要重新审视",
    ).toBeGreaterThan(BT_MAX_RATE);
  });

  it("溢出 = 裸算 − 封顶后，且不为负", () => {
    for (const raw of [0.6, 0.9, 0.97, 0.98, 1.03, 1.19, 1.4]) {
      const r = overflowOf(raw);
      expect(r.rate, `裸算 ${raw} 没被封顶`).toBeLessThanOrEqual(BT_MAX_RATE);
      /*
       * 下限这一侧不断言 `>= 0` —— 那是恒真的（`clampRate` 的下界是 0.15，永远为正），
       * 写出来只是一句注释。真要能被违反，得问「没触顶时它就该等于裸算」：
       */
      if (raw <= BT_MAX_RATE) {
        expect(r.rate, `裸算 ${raw} 没触顶，却被改成了 ${r.rate}`).toBe(raw);
      }
      expect(r.overflow, `裸算 ${raw} 的溢出算错了`).toBeCloseTo(Math.max(0, raw - r.rate), 10);
      if (raw <= BT_MAX_RATE) {
        expect(r.overflow, `裸算 ${raw} 没触顶却报了溢出`).toBe(0);
      }
    }
  });

  it("判定读**封顶后**的数 —— 报数不许把判定改了", () => {
    /*
     * `rate` 是判定与预览共用的那一个（`attemptBreakthrough` 里 `rng.chance(info.rate)`）。
     * 若为了让界面报「裸算 119%」而把 `rate` 改成裸值，成功率就会被悄悄抬高 ——
     * 那是把一条披露改成了一次平衡改动。`rateRaw` 是**额外**给的，不是替换。
     */
    const r = overflowOf(1.19);
    expect(r.rate, "判定用的那个数被改成了裸值").toBe(BT_MAX_RATE);
    expect(r.raw, "裸值没被留下来 —— 那就报不出差额").toBe(1.19);
    expect(r.overflow, "溢出没算").toBeCloseTo(1.19 - BT_MAX_RATE, 10);
  });

  it("源码层：breakthroughInfo 同时给出三个数，且 rate 仍走 clampRate", () => {
    const src = readFileSync(resolve(__dirname, "./breakthrough.ts"), "utf8");
    const fn = /export function breakthroughInfo\([\s\S]*?\n}/.exec(src)?.[0] ?? "";
    expect(fn, "找不到 breakthroughInfo —— 它改名了，这条判据要跟着改").not.toBe("");
    expect(fn, "`rate` 不再走 clampRate —— 判定被改了").toMatch(
      /const rate = clampRate\(rateRaw\)/,
    );
    expect(fn, "没把裸值交出来").toContain("rateRaw,");
    expect(fn, "没算出溢出").toMatch(/rateOverflow:\s*Math\.max\(0,\s*rateRaw - rate\)/);
  });

  it("界面真的印出来，且封顶数字读常量、不手写", () => {
    const vue = readFileSync(
      resolve(__dirname, "../components/cultivation/BreakthroughCard.vue"),
      "utf8",
    );
    /*
     * 只在 `rateOverflow > 0` 时出 —— 没撞天花板就不该有一条「多出的 0% 不计」。
     * 那正是本仓反复修的「边界处文案不换」的**反方向**:这里是「边界之前不多话」。
     */
    expect(vue, "溢出没有按条件渲染 —— 零溢出时也会多一句").toMatch(
      /v-if="btInfo\.rateOverflow > 0"/,
    );
    expect(vue, "没把裸值印出来").toContain("btInfo.rateRaw");
    expect(vue, "没把溢出量印出来").toContain("btInfo.rateOverflow");
    /*
     * 「封顶 98%」不许手写 —— 改 `BT_MAX_RATE` 那天，手写的那个数就开始撒谎。
     * 这是 `AGENTS.md` 那条「文案里不许手写会被常数改动的数字」。
     */
    expect(vue, "封顶数字是手写的，没有读 BT_MAX_RATE").toContain("BT_MAX_RATE");
    /*
     * 扫**只看模板那一段**，不看注释。
     *
     * 第一版扫的是整个 .vue，而我在那段注释里正写着「基础率 71~95%、封顶 98%」——
     * 判据被自己的注释判红。本仓早记过这条（「注释里的字也会触发判据」），
     * 而这里的正解不是改写注释（那段背景正是读者要知道的），是**把扫描面收窄到模板**。
     */
    /*
     * 去掉 HTML 注释（`<!-- … -->`）再扫 —— 我那段说明就写在模板里，
     * 而它正引用着「封顶 98%」这个事实。注释里引用旧值是正当的，
     * **代码里留一份**才是分叉。
     */
    const tpl = vue.slice(0, vue.indexOf("<script")).replace(/<!--[\s\S]*?-->/g, "");
    expect(tpl, "模板里还留着一个手写的 98%").not.toMatch(/封顶\s*98%/);
  });
});
