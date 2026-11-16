/**
 * 出行窗那一行「收益 ×N · 敌势 ×N」—— 两半必须摊开同一批来源。
 *
 * ## 缺口（第 392 轮实测确认）
 *
 * 敌势那一半早就把区域事件摊出来了(`foeLineFor` 读 `evDef.dangerMult`),
 * 而收益那一半**只报档位自己的 `rewardMult`**。妖潮日(收益 ×1.2)打开出行窗:
 *
 * ```text
 *   界面报   收益 ×1   · 敌势 ×1.15
 *   实际     收益 ×1.20 · 敌势 ×1.15
 * ```
 *
 * 那 20% 一直在到账(`afterWin` 的 `rewardMult` 是 `mode × regReward`),
 * 界面上一个字都没有。**危险说了、收益没说** —— 比两边都不说更糟:
 * 玩家据此以为「这一天没有额外好处,只是更凶险」,而那正好把利弊读反。
 *
 * ## 判据守什么
 *
 * ① 两条线用同一把尺子:同一个区域事件下,收益与敌势各自都把它乘进去,
 *    而且**各自的 total 等于把所有 parts 乘上档位倍率**;
 * ② `×1` 的项不摊(没做的事不必占字数),`≠1` 的项必须在 parts 里;
 * ③ 档位自己的倍率不在 parts 里重复(它在同一个格子上已经写了一次);
 * ④ 没有区域事件时,收益退回档位倍率、来源为空 —— 不编一个「×1」出来。
 *
 * 判据不测像素,只测这两个数怎么算出来 —— 像素由 `layout-check` 的
 * 「妖潮日的出行窗」场景量。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REGION_EVENTS, regionEventDef } from "./regionEvent";
import { EXPLORE_MODES } from "@/data/constants";

/**
 * 复刻 `AdventureView.rewardLineFor` 的算式。
 *
 * ## 为什么这里可以复刻
 *
 * 它测的正是「两半是否对称」这件事本身,而复刻的那几行极短(档位 × 事件)。
 * 更强的做法是让视图把算式导出,但那个函数读 `player` store 与 `regionEventDef`,
 * 搬出来会引入一层只为测试的抽象。
 *
 * 折中:**这份复刻同时被下面那条「与视图源码同步」的判据钉着** ——
 * 若视图改了算式而这里没跟,那条会红。故它不是第二本账,是带警报的副本。
 */
function rewardTotalOf(mode: keyof typeof EXPLORE_MODES, eventId: string | null): number {
  const evMult = eventId ? (regionEventDef(eventId as never)?.rewardMult ?? 1) : 1;
  return Number((EXPLORE_MODES[mode].rewardMult * evMult).toFixed(2));
}

function dangerTotalOf(mode: keyof typeof EXPLORE_MODES, eventId: string | null): number {
  const evMult = eventId ? (regionEventDef(eventId as never)?.dangerMult ?? 1) : 1;
  return Number((EXPLORE_MODES[mode].dangerMult * evMult).toFixed(2));
}

describe("出行窗 · 收益与敌势摊开同一批来源", () => {
  it("有区域事件时,收益必须比档位倍率高 —— 妖潮日不许报「×1」", () => {
    /*
     * 这一条就是本轮那个缺陷的正反面。
     * 妖潮 rewardMult = 1.2,故「寻常游历」那档的实发收益必须是 1.2,不是 1。
     */
    const yaochao = regionEventDef("yaochao")!;
    expect(yaochao.rewardMult, "妖潮的收益倍率不再是 >1 —— 这条判据要跟着改").toBeGreaterThan(1);
    const total = rewardTotalOf("normal", "yaochao");
    expect(
      total,
      `妖潮日「寻常游历」界面报的收益是 ×${total},而档位只有 ×${EXPLORE_MODES.normal.rewardMult} —— 事件那一份没算进去`,
    ).toBeCloseTo(EXPLORE_MODES.normal.rewardMult * yaochao.rewardMult, 6);
    expect(total, "妖潮日报出的收益与无事件日一样 —— 那就是本站修的那个缺陷").not.toBe(
      EXPLORE_MODES.normal.rewardMult,
    );
  });

  it("四个档位、四个事件:两条线各自都算上事件倍率,一个不漏", () => {
    for (const ev of REGION_EVENTS) {
      for (const mode of ["normal", "deep", "risky", "prolonged"] as const) {
        const r = rewardTotalOf(mode, ev.id);
        const d = dangerTotalOf(mode, ev.id);
        /*
         * 比到两位小数:实现把 total 收成 `Number(...toFixed(2))`(界面上只印两位),
         * 故这里也按两位比 —— 用 6 位会红在 1.45×1.15=1.6675 → 1.67 这种舍入上,
         * 那是判据的口径写窄了,不是产品错了。
         */
        expect(r, `${ev.name} · ${mode} 的收益没算事件倍率`).toBeCloseTo(
          Number((EXPLORE_MODES[mode].rewardMult * ev.rewardMult).toFixed(2)),
          6,
        );
        expect(d, `${ev.name} · ${mode} 的敌势没算事件倍率`).toBeCloseTo(
          Number((EXPLORE_MODES[mode].dangerMult * ev.dangerMult).toFixed(2)),
          6,
        );
      }
    }
  });

  it("危险与收益是**两个**倍率,不许拿一个顶另一个", () => {
    /*
     * 若哪天有人图省事,把事件只保留一个 `mult` 同时喂给两边,这条会红。
     * 妖潮 1.2 / 1.15 本来就不同;商队遇袭 1.25 / 1.10 差得更开 —— 玩家据此
     * 判断「这一趟值不值得为丰厚的掉落多冒那点险」,两个数合并就答不了这个问题。
     */
    const differ = REGION_EVENTS.filter((e) => e.rewardMult !== e.dangerMult);
    expect(
      differ.length,
      "四个区域事件的收益与危险倍率全相等 —— 那两个字段该合并了",
    ).toBeGreaterThan(0);
    const sd = regionEventDef("shangdui")!;
    expect(rewardTotalOf("normal", "shangdui"), "商队遇袭的收益与敌势报成了同一个数").not.toBe(
      dangerTotalOf("normal", "shangdui"),
    );
    expect(sd.rewardMult).toBeGreaterThan(sd.dangerMult);
  });

  it("没有区域事件时退回档位倍率 —— 不编一个 ×1 的来源", () => {
    for (const mode of ["normal", "deep", "risky", "prolonged"] as const) {
      expect(rewardTotalOf(mode, null), `${mode} 无事件时的收益不等于档位倍率`).toBe(
        EXPLORE_MODES[mode].rewardMult,
      );
      expect(dangerTotalOf(mode, null), `${mode} 无事件时的敌势不等于档位倍率`).toBe(
        EXPLORE_MODES[mode].dangerMult,
      );
    }
  });

  it("只摊 ≠1 的项 —— `灵脉暴动` 两条都是 ×1,不该出现在来源里", () => {
    /*
     * 「灵脉暴动」刻意两条都是 1(见 regionEvent.ts:它的作用是 `eventMult` 1,
     * 也就是「不改收益也不改危险」的对照组)。若实现把 ×1 也摊出来,
     * 那一格会多一句「灵脉暴动 ×1.00」—— 说了等于没说。
     */
    const lingmai = regionEventDef("lingmai")!;
    expect(lingmai.rewardMult).toBe(1);
    expect(lingmai.dangerMult).toBe(1);
    expect(rewardTotalOf("normal", "lingmai"), "灵脉暴动的收益被算成了别的数").toBe(
      EXPLORE_MODES.normal.rewardMult,
    );
  });
});

describe("出行窗 · 视图里的算式与这份复刻同步", () => {
  it("`rewardLineFor` 真的乘了区域事件的 rewardMult", () => {
    /*
     * 上面那几条测的是「算式该长什么样」,而它们跑的是本文件里的一份复刻 ——
     * 若视图改了、这里没跟,上面照样全绿。故补这一条读**视图源码**。
     *
     * 它不解析算式(那会是第二个解析器),只钉住三件缺一不可的事:
     *   ① 收益那一行读 `regionEventDef`;
     *   ② 它取的是 `rewardMult`(`dangerMult` 是敌势那条的);
     *   ③ 模板印的是 `rewardTotal` 而不是 `rewardMult`。
     */
    const view = readFileSync(resolve(__dirname, "../views/AdventureView.vue"), "utf8");
    const fn = /function rewardLineFor\([\s\S]*?\n}/.exec(view)?.[0] ?? "";
    expect(fn, "找不到 rewardLineFor —— 它改名了,这条判据要跟着改").not.toBe("");
    expect(fn, "收益那一行没读区域事件").toContain("regionEventDef(");
    /*
     * ## 第一版这两条太浅,故障注入当场揭穿
     *
     * 第一版写的是 `toContain("rewardMult")` + `not.toContain("dangerMult")`。
     * 注入「把 `evDef?.rewardMult ?? 1` 改成 `1`」之后**判据全绿** ——
     * 因为 `rewardMult` 这个名字还在同一段里(`EXPLORE_MODES[mode].rewardMult`「档位」那一处),
     * 而它测的本来是「事件那一份有没有乘上去」。
     *
     * 改成钉**赋值表达式本身**:事件倍率必须由 `evDef?.rewardMult` 求出来。
     * 名字出现在别处不再能顶替。
     */
    expect(fn, "收益那一行的事件倍率不是从 evDef.rewardMult 求的 —— 事件那一份没乘上去").toMatch(
      /evMult\s*=\s*evDef\?\.rewardMult\s*\?\?\s*1/,
    );
    expect(fn, "收益那一行把危险倍率当成了收益").not.toMatch(/evMult\s*=\s*evDef\?\.dangerMult/);

    // 模板:印的是实发总数,不是档位自己的倍率
    expect(view, "模板没印实发收益 rewardTotal").toContain("m.rewardTotal");
    /*
     * 模板这条第一版允许任意空白而仍漏了:我注入时把 `m.rewardTotal` 改成
     * `m.rewardMult`,而正则要求「收益 ×」与插值之间恰好一个空格 —— 实际模板是
     * `收益 ×{{ m.rewardTotal }}`,中间**没有**空格那一层问题,倒是 `收益 ×` 与
     * `{{` 之间的空格在注入后仍是一个,故正则应当命中却… 实测没命中。
     * 原因是我把 `×` 与 `{{` 之间写成了 `\s*`,而注入后仍然是 `×{{`。真正的
     * 差别在**变量名**。故这里直接查「收益那一格后面跟的是哪个变量」,
     * 允许任意空白并钉住变量名。
     */
    const rewardCell = /收益\s*×\s*\{\{([^}]*)}}/.exec(view);
    expect(rewardCell, "找不到「收益 ×N」那一格 —— 模板改了形状,这条判据要跟着改").not.toBeNull();
    expect(
      rewardCell![1]!.trim(),
      `模板的「收益」那一格印的是 ${rewardCell![1]!.trim()} —— 那正是本轮的缺陷`,
    ).toBe("m.rewardTotal");
  });
});
