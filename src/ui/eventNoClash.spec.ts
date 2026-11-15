/**
 * 顿悟撞车 —— 惊喜不该在玩家正处理别的事时砸下来。
 *
 * ## 复现:一扇弹窗处理到一半,另一扇叠上来
 *
 * `core/engine.ts` 的心跳里,**无条件**调一次:
 *
 * ```ts
 * // Phase 28: 悟道顿悟触发(修炼时随机)
 * mayTriggerEnlightenment();
 * ```
 *
 * 而 `mayTriggerEnlightenment()` 只看两件事:5 分钟冷却、境界存在感。它**不问
 * 界面上此刻开着什么**。
 *
 * `EnlightenmentModal` 与 `CaveEventModal` 挂在 `App.vue` 的全局图层 —— 那里
 * 的注释自己写着「挂在全局才不会漏掉窗口期」。于是:
 *
 *   · 玩家正开着兵解往生(1265 行、三程要走),顿悟叠上来;
 *   · 玩家正看突破结果,洞府事件叠上来;
 *   · 玩家正在确认重置/导入,机缘卷叠在确认窗上。
 *
 * `BaseModal` 没有全局互斥,两扇都会渲染 —— 后开的那扇压在前一扇上面,
 * 而前一扇的焦点管理与 Esc 还在管着自己,谁也说不清此刻在哪个上下文。
 *
 * ## 为什么这一处值得改
 *
 * 顿悟与洞府事件是**惊喜**,惊喜的价值在于「它来找你」。但在玩家正读一屏
 * 1265 行的往生契约时砸下来,它就从惊喜变成了打断:那一签的倒计时在跑、
 * 玩家又不敢扔下手上的事,两边都做不踏实。
 *
 * 而「机缘卷」的窗口本身是有时限的(见 `totalSeconds` / `remaining`)——
 * 撞车时玩家要么仓促择签,要么眼睁睁看它散掉。两种都不好。
 *
 * ## 判据守什么
 *
 * 两条:
 *   一 触发前要问一句「界面正忙着吗」,忙着就**这一拍不触发**(不是丢弃:
 *      心跳每拍都会再来问,空下来自然会触发);
 *   二 那个「忙着吗」由上层告诉 core,core 不 import ui store
 *      (与 `core/uiPort`、`core/enginePause` 同一套理由)。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const SERVICE = "src/core/earlyGameService.ts";

describe("顿悟 · 别在玩家正处理别的事时砸下来", () => {
  it("复用已有的浮层栈,不另立一份「界面忙」标志", () => {
    /*
     * ui/modalStack 已经是「最上面那一层」的唯一出处(BaseModal 压栈/出栈,
     * Esc 与安卓返回键两个消费者)。再维护一个「界面忙不忙」就是两本账。
     * 故这里钉的是**复用**:触发函数要读 hasOpenModal,而不是自建 flag。
     */
    const stack = readSource("src/ui/modalStack.ts");
    expect(stack, "浮层栈要能回答「有没有浮层占着屏幕」").toContain("hasOpenModal");
    const src = readSource(SERVICE);
    expect(src, "触发函数要读浮层栈,不自建标志").toContain("hasOpenModal");
    expect(src, "不许再自建一份 Busy 标志").not.toMatch(/from ["']@\/core\/uiBusy["']/);
  });

  it("顿悟触发前先问一句界面忙不忙 —— 两个入口都不许绕过那道闸", () => {
    /*
     * ## 这条判据在第 364 轮改了形状，理由值得记
     *
     * 它原来钉的是 `mayTriggerEnlightenment` 的函数体里要有 `hasOpenModal`。
     * 而第 364 轮给顿悟加了**第二个入口**（闭关出关），于是那道闸被抽成
     * `enlightenmentGateOpen()` 由两个入口共用 —— 旧判据当场红，
     * 因为它找的那个字符串搬到了函数外面。
     *
     * **判据红得对，但它守的东西变了**:从"这个函数里写着 hasOpenModal"
     * 变成"两个入口都过同一道闸"。故改成:
     *
     * ```text
     *   一 闸门本身要读浮层栈（hasOpenModal）
     *   二 两个入口都要调那道闸 —— 谁绕过谁就把叠窗放回来
     * ```
     *
     * 这比原来那条更严:原来只钉住一个入口，现在钉住两个。
     */
    const src = readSource(SERVICE);
    const gate = src.match(/function enlightenmentGateOpen[\s\S]{0,900}?\n}/)?.[0] ?? "";
    expect(gate, "定位不到那道闸 —— 判据会空转").not.toBe("");
    expect(gate, "闸门里要检查浮层是否占着屏幕 —— 否则玩家开着往生契约时顿悟会叠上来").toContain(
      "hasOpenModal",
    );

    for (const entry of ["mayTriggerEnlightenment", "mayTriggerRetreatEnlightenment"]) {
      const fn = src.match(new RegExp(`export function ${entry}[\\s\\S]{0,600}?\\n}`))?.[0] ?? "";
      expect(fn, `定位不到入口 ${entry} —— 判据会空转`).not.toBe("");
      expect(fn, `入口 ${entry} 绕过了那道闸 —— 界面忙时顿悟会叠上来`).toContain(
        "enlightenmentGateOpen",
      );
    }
  });

  it("core 不 import ui store —— 与 uiPort / enginePause 同一套理由", () => {
    const src = readSource(SERVICE).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src, "猜测触发不该直接够到 ui store").not.toMatch(/from ["']@\/stores\/ui["']/);
  });

  it("洞府事件也走同一道闸", () => {
    /*
     * 两扇机缘卷都挂在全局图层、都可能在任意页面弹出(同在 earlyGameService)。
     * 只挡顿悟、放过洞府事件,等于挡了一半。
     */
    const src = readSource(SERVICE);
    const fn = src.match(/export function mayTriggerCaveEvent[\s\S]{0,700}/)?.[0] ?? "";
    expect(fn, "定位不到洞府事件触发 —— 判据会空转").not.toBe("");
    expect(fn, "洞府事件也要过同一道闸").toContain("hasOpenModal");
  });
});
