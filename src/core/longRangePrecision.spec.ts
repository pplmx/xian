/**
 * 长程读数按量级取精度 —— 「约 520 天 20 小时」是虚假精度。
 *
 * ## 由来（第 177 轮）
 *
 * 补上「至大道尽头约 N」这一格之后,第一版直接用了 `formatDuration`:
 *
 * ```text
 * 按此刻行速,至大道尽头约 520天20小时
 * ```
 *
 * 那个「20 小时」有两个问题:
 *
 * 1. **虚假精度** —— 数在「数百天」量级,报到小时是假精确。玩家不会因此
 *    更清楚这条路有多长,只会以为这个数很准。
 * 2. **它每刷新一次就变** —— 分母是「此刻行速」,而速度会因 buff 到期、
 *    灵气涨落而变;一天里那 20 小时会来回跳。一个**看起来精确却在抖**的数
 *    比一个明确粗粒度的数更误导。
 *
 * ## 分档口径
 *
 * ```text
 * < 1 天     交给 formatDuration（秒/分/小时都对人有意义）
 * 1 天 ~ 100 天   报「N 天」—— 天是这个量级的自然单位
 * >= 100 天       报「约 N 天」,百位取整（190 天报「约 200 天」）
 * ```
 *
 * 百位取整是刻意的:到了这个量级,个位与十位都没有决策价值 ——
 * 玩家要判断的是「这是几个月的事,还是几年的事」。
 *
 * ## 判据
 *
 * ① 100 天以上只报百位（个位与十位必须是 0）;
 * ② 不许出现「小时 / 分 / 秒」这类更细的单位;
 * ③ 一天以内仍走 `formatDuration`（那里细粒度是有意义的）;
 * ④ 到顶与速度不可用时不报数字。
 */
import { describe, expect, it } from "vite-plus/test";
import { apexEtaText } from "./apexEta";
import { MAX_MAJOR } from "@/data/realms";
import { SUB_LEVELS } from "@/data/constants";

describe("长程读数 · 按量级取精度", () => {
  it("数百天量级只报「约 N 天」，不报小时", () => {
    const text = apexEtaText(0, 0, 1.5); // 炼气一层、慢速 → 数百天
    expect(text, "数百天却报到了小时 —— 虚假精度").not.toMatch(/小时|分|秒/);
    expect(text, "该说「约」").toMatch(/约\s*\d+\s*天/);
  });

  it("百位取整：个位与十位必须是 0", () => {
    const text = apexEtaText(0, 0, 1.5);
    const n = Number(/约\s*(\d+)\s*天/.exec(text)?.[1]);
    expect(Number.isFinite(n), `读数里没有天数量: «${text}»`).toBe(true);
    expect(n, `「约 ${n} 天」不是百位取整 —— 这个量级的个位没有决策价值`).toBe(
      Math.round(n / 100) * 100,
    );
  });

  it("一天以内仍用细粒度（那里秒/分/小时有意义）", () => {
    /*
     * 造一个「很快就要到顶」的场景:末境最后一层、速度极高。
     * 这时读数会落到小时/分一级。
     */
    const text = apexEtaText(MAX_MAJOR, SUB_LEVELS - 2, 1e30);
    expect(text, "快到了就该给细粒度").toMatch(/小时|分|秒|天/);
  });

  it("到顶时不给数字", () => {
    const text = apexEtaText(MAX_MAJOR, SUB_LEVELS - 1, 1e30);
    expect(text, "到顶该说「已至」").toMatch(/已至/);
    expect(text, "到顶不该出现「约 N 天」").not.toMatch(/约\s*\d+\s*天/);
  });

  it("速度不可用时不印数字（也不印 Infinity）", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const text = apexEtaText(3, 0, bad);
      expect(text, `速度 ${bad} 时印出了数字: «${text}»`).not.toMatch(/\d/);
    }
  });

  it("文案带「按此刻行速」—— 这个数会随换装备而变", () => {
    const text = apexEtaText(0, 0, 1.5);
    expect(text, "没有「按此刻」的限定 —— 许诺精确到达日就是撒谎").toMatch(/按此刻|照此刻/);
  });
});
