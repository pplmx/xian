/**
 * 破境卡的「代价」一栏 —— 两个都属于「说了，但不是据实说的」。
 *
 * ## 由来（第 157 轮，走开局的第二个决定）
 *
 * 新建号第一屏就撞见这张卡。它是**唯一**一个玩家会主动按下去、而且**可能亏**的动作：
 * 17 项词条、一次灵气、外加可能一无所获。卡上那行代价写着:
 *
 * ```text
 * 突破不成损修为 18%、身负 重伤(修炼速度 -50% · 攻击 -20% · 防御 -20%,
 * 持续 一百五十 秒,可引气静养平复)(破境返还词条可减修为损,首败跬步传承可全免)
 * ```
 *
 * 读起来全都对 —— 但细看有两处**不据实**。
 *
 * ### 一 · 18% 是「什么也没有时」的数
 *
 * 真正的扣法是 `core/breakthrough` 的 `BT_FAIL_EXP_LOSS * (1 - breakRefundOf(mods))`:
 *
 * ```text
 * refund  0（裸身）   → 18.0%
 * refund 10%（天赋「圆融」/ 功法分支） → 16.2%
 * refund 20%          → 14.4%
 * refund 30%          → 12.6%
 * ```
 *
 * 而卡上把那句可减免的话放在**最后一行括号里**，主句仍印 18%。
 * 本仓纪律是「界面上出现的每个数字都与结算同源」—— 这句 18% 是结算的一半
 * （它只是乘法的左项），印在玩家面前的那个数该是**他自己身上那一份**。
 *
 * ### 二 · 「一百五十 秒」是同一句里唯一一处不走 formatDuration 的时长
 *
 * 全站时长都走 `formatDuration`（刻意的取舍写在那个函数头上:整分钟不写「0 秒」）。
 * 而这里走 `cnNumber(150) + "秒"` ——「一百五十 秒」，中间还多一格。
 * 同一个失败,结算弹窗里写「伤势 2分30秒」(见 `core/breakthrough` 的 `nextStep`),
 * 卡上写「一百五十 秒」:同一件事两处两种读法。
 *
 * ## 判据
 *
 * ① 主句的百分比必须来自**结算那份乘法**（`BT_FAIL_EXP_LOSS × (1 − refund)`），
 *    且随 `breakRefund` 变;
 * ② 时长必须走 `formatDuration`,不许 `cnNumber(...)` 拼秒数。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

/** 抹掉注释 —— 注释里**举例**说明旧写法时，那段字不是玩家看得见的文案 */
function stripComments(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}
import { BT_FAIL_EXP_LOSS } from "@/data/constants";
import { breakthroughFailLoss } from "./breakthrough";

const CARD_RAW = readSource("src/components/cultivation/BreakthroughCard.vue");
const CARD = stripComments(CARD_RAW);

describe("破境卡的代价行 · 据实说", () => {
  it("失败损修为的比例随破境返还变 —— 那个数由 core 给，不在视图里写死", () => {
    /*
     * 打桩：`breakRefund` 是 finalStats.mods 的一项，故这里直接量纯函数。
     * 判据落在**函数**上，视图那一侧另有一条「必须调它」。
     */
    expect(breakthroughFailLoss(0)).toBeCloseTo(BT_FAIL_EXP_LOSS, 10);
    expect(breakthroughFailLoss(0.1)).toBeCloseTo(BT_FAIL_EXP_LOSS * 0.9, 10);
    expect(breakthroughFailLoss(0.3)).toBeCloseTo(BT_FAIL_EXP_LOSS * 0.7, 10);
    // 与结算同一个封顶（`breakRefundOf` 的上限是 0.8），不许各封各的
    expect(breakthroughFailLoss(0.95)).toBeCloseTo(BT_FAIL_EXP_LOSS * 0.2, 10);
    expect(breakthroughFailLoss(-1), "负的返还不该变成「倒贴」").toBeCloseTo(BT_FAIL_EXP_LOSS, 10);
  });

  it("视图读的是那个函数，不是把 BT_FAIL_EXP_LOSS 直接印上去", () => {
    /*
     * 判据认的是**那件事**：卡上的百分比来自 `breakthroughFailLoss(...)` 的结果，
     * 而**不是** `BT_FAIL_EXP_LOSS` 本身。故不钉模板变量叫什么名字 ——
     * 名字是排版层的自由，钉死它会在一次无害重命名上误报（本仓栽过：
     * `闭关后每秒` 被钉成契约，后来连那句错的文案一起守住了）。
     */
    expect(CARD, "代价行要读结算那份乘法").toContain("breakthroughFailLoss(");
    expect(CARD, "主句不许直接把 BT_FAIL_EXP_LOSS 印出来 —— 那是「裸身」时的数").not.toMatch(
      /突破不成损修为[^<]{0,40}BT_FAIL_EXP_LOSS/,
    );
  });

  it("时长走 formatDuration，不许 cnNumber 拼出一百五十秒", () => {
    /*
     * 判的是「这个时长经 `formatDuration` 出去」，不钉它读哪个来源 ——
     * 读 `injuryDef.durationSec` 与读共用的 `INJURY_DURATION` 都对，两者是同一个数。
     * 钉死其中一种，会在一次无害的来源调整上误报（`闭关后每秒` 那一族）。
     */
    expect(CARD, "伤势时长要走 formatDuration").toMatch(/formatDuration\([^)]*INJURY_DURATION/);
    expect(CARD, "不许再用 cnNumber 拼秒数").not.toMatch(/cnNumber\(INJURY_DURATION\)/);
  });

  it("判据确实扫得到东西（防空转）", () => {
    expect(CARD_RAW.length, "读不到破境卡").toBeGreaterThan(1000);
    expect(CARD.length, "抹注释之后不该把整份文件抹空").toBeGreaterThan(800);
  });
});
