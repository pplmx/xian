/**
 * 共同事件的「还差几个情境」—— 一直在攒，却从没露过面。
 *
 * ## 缺口（第 410 轮，从 bondCausality 那条 `abrupt` 追出来的）
 *
 * `daoluService` 里有两个数：
 *
 * ```text
 *   opportunities   每遇到一个历练情境 +1（首胜、败北、击破首领、踏入新地界…）
 *   nextEventAt     攒到这个数就抽一件共同事件，并弹一句「她似乎有话要说」
 * ```
 *
 * 实测：**这两个数在任何 `.vue` 里都没出现过**。
 *
 * 于是玩家在历练里打了很多场、什么也没等到时，分不清：
 *
 * ```text
 *   还差两场      →  等一等就有
 *   这段关系已经无事了  →  等也白等
 * ```
 *
 * **这两件事在界面上长得一模一样** —— 而那正是玩家会得出「这游戏坏了」的时刻。
 *
 * ## 判据
 *
 * ① `bondEventGap()` 真的读出那两个数（不是另算一份）；
 * ② 已有人待决事件时返回 null —— 那时该看的是那件事，不是进度；
 * ③ 她不在时（fallen / departed）返回 null；
 * ④ 界面真的把它印出来了（判据读源码，钉住接线）；
 * ⑤ 反差：把读数改成一个常量，界面那一行就会永远显示同一个数 —— 判据要能看出它没跟着走。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const VIEW = readFileSync(resolve(__dirname, "../components/character/BondDialog.vue"), "utf-8");

describe("共同事件 · 离下一次还差几个情境", () => {
  it("界面真的把它印出来了", () => {
    /*
     * 这一条守接线 —— `bondEventGap` 写好了但没接进界面，是本仓一类老问题
     * （第 388 轮「素行之向没有 UI」）。`uiReachability.spec` 只查模块级可达，
     * 查不出「函数可达而这一句没上界面」，故这里直接读模板。
     */
    expect(VIEW, "道侣弹窗里没有印「下一次际遇」那一行").toMatch(/data-bond-event-gap/);
    expect(VIEW, "那一行没有读 eventShort").toMatch(/eventShort/);
    /*
     * 反差：那一行的**正文里必须有那个数**。
     *
     * 初版这条写的是 `/eventShort\s*>\s*0/` —— 而那个比较在 `v-if` 里本来就存在,
     * 于是「把正文改成写死的『还差几个历练情境』」这一注入**测不出来**(实测过)。
     * 同一个形状在前几轮也撞到过:钉住的是一个名字的出现,不是那个值被用到了正文里。
     *
     * 现在直接要求「还差 {{ eventShort }}」这种插值形态。
     */
    expect(VIEW, "那一行的正文里没有那个数 —— 它不会跟着玩家的历练进度变").toMatch(
      /还差\s*\{\{\s*eventShort\s*\}\}/,
    );
  });

  it("读数取自那两个真数，不是另算一份", () => {
    /*
     * 与 `bondCausality` 那条同源：`opportunities` / `nextEventAt` 是结算写的那两个字段。
     * 这条钉的是**函数体里读的是它们**，而不是重新推一个近似值出来。
     * （扫描的是 daoluService 里 bondEventGap 的函数体。）
     */
    const src = readFileSync(resolve(__dirname, "daoluService.ts"), "utf-8");
    const start = src.indexOf("export function bondEventGap");
    expect(start, "找不到 bondEventGap —— 判据要跟着改名").toBeGreaterThan(0);
    const body = src.slice(start, start + 600);
    expect(body, "bondEventGap 没有读 opportunities").toMatch(/b\.opportunities/);
    expect(body, "bondEventGap 没有读 nextEventAt").toMatch(/b\.nextEventAt/);
  });

  it("无待决事件时才给进度 —— 已有一件事在等你时必须让位", () => {
    /*
     * 这一条读源码判分支，不做运行时构造:
     * 造一个带 pendingEventId 的 bond 要走一整套 store 初始化，
     * 而这一条要守的只是**那个守卫还在不在**。
     */
    const src = readFileSync(resolve(__dirname, "daoluService.ts"), "utf-8");
    const start = src.indexOf("export function bondEventGap");
    const body = src.slice(start, start + 600);
    expect(body, "bondEventGap 没有排除「已有人待决」的情形").toMatch(/pendingEventId/);
    expect(body, "bondEventGap 没有排除她已不在的情形").toMatch(/fallen|departed/);
  });

  it("没有道侣时返回 null —— 空关系不该显示进度", () => {
    /*
     * 这一条**不调运行时**:`bondEventGap` 要读 player store,而 core spec 带 Pinia
     * 会撞 `layeringAudit` 的上限(119),不该为一条判据破线。
     *
     * 改成读源码判形状:函数体里必须有 `if (!b || ...) return null` 这一句,
     * 且返回的是 `{ have, need }` 而不是裸数字 —— 裸数字在界面上没法写成
     * 「还差 N 个」(要两个数才能减)。
     */
    const src = readFileSync(resolve(__dirname, "daoluService.ts"), "utf-8");
    const start = src.indexOf("export function bondEventGap");
    expect(start, "找不到 bondEventGap").toBeGreaterThan(0);
    const body = src.slice(start, start + 700);
    expect(body, "没有「无道侣时返回 null」那一句").toMatch(/return null/);
    expect(body, "返回的不是 { have, need } —— 界面上要减两次，裸数字不够用").toMatch(
      /return\s*\{\s*have:/,
    );
    // 反差：不能返回百分比。机会点不是线性进度条（每次事件后门槛会推远）
    expect(body, "返回了百分比/比率 —— 门槛会推远，百分比会误导").not.toMatch(/pct|percent/i);
  });
});
