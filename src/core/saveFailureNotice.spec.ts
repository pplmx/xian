/**
 * 存档写不进去时，玩家必须收到一句话。
 *
 * ## 由来（第 205 轮，查存档安全）
 *
 * `App.vue` 里有一段处理:
 *
 * ```ts
 * const warnSaveFailure = (): void => {
 *   ui.toast("存档写入失败 —— 浏览器存储可能已满,建议先导出备份", "warn");
 * };
 * unsubscribeSaveFailure = subscribeSaveWriteFailure((failure) => {
 *   if (failure) warnSaveFailure();
 *   else ui.toast("存档已恢复写入", "info");
 * });
 * // 启动迁移可能在 App 订阅之前就已经写失败;别因错过那一次回调而静默带病运行。
 * if (saveWriteFailure() !== null) warnSaveFailure();
 * ```
 *
 * **做得很好** —— 连「订阅晚于失败」那个时序洞都补上了。
 *
 * ## 但它没有判据
 *
 * `importCorruption.spec` 与 `saveMigration.spec` 都测了**状态**
 * （`saveWriteFailure()` 返回什么），而**没有一条测「玩家会不会收到那句话」**。
 * 而后者是 `App.vue` 的职责，不是 store 的。
 *
 * 静默的存档失败是这一作最坏的一种 bug:玩家玩得正兴起，而他从此的进度都不进档。
 *
 * ## 这条判据守什么
 *
 * ① `App.vue` 订阅了写入失败;
 * ② 失败时要弹一句话（不是只 log）;
 * ③ 恢复时也要说一声（否则玩家不知道该不该继续担心）;
 * ④ 启动时补一次 —— 因为启动迁移可能在订阅之前就失败过。
 *
 * 不钉文案内容，只核「有三处 toast，且其中一处是恢复」。
 *
 * ## 故障注入
 *
 * 删掉恢复那句 `ui.toast("存档已恢复写入")` → 「失败与恢复各有一句话」红。
 * 删掉启动时那句 `if (saveWriteFailure() !== null) warnSaveFailure()` → 「启动时补一次」红。
 * 把 `warnSaveFailure` 改成只 `console.warn` → 「warnSaveFailure 自己必须 toast」红。
 * 把 `onBlockedSaveWrite` 的回调改成空函数 → 「只读页也要说一声」红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

const APP = "src/App.vue";

describe("存档写入失败 · 要让玩家知道", () => {
  it("判据的前提还在 —— 订阅与那两个函数", () => {
    const src = stripComments(readSource(APP));
    for (const anchor of ["subscribeSaveWriteFailure", "saveWriteFailure"]) {
      expect(src, `判据的前提没了：${anchor} —— 判据该跟着改，不是删掉`).toContain(anchor);
    }
  });

  it("失败与恢复各有一句话", () => {
    const src = stripComments(readSource(APP));
    /*
     * 判那件事:订阅回调里，失败与恢复两条分支各自 `ui.toast(`。
     * 数 toast 不够 —— 得确认它们落在那个订阅里。
     */
    const idx = src.indexOf("subscribeSaveWriteFailure(");
    expect(idx, "找不到订阅").toBeGreaterThan(-1);
    const tail = src.slice(idx, idx + 700);
    const toasts = [...tail.matchAll(/ui\.toast\(/g)].length;
    expect(
      toasts,
      "订阅里只有 " +
        toasts +
        " 处 toast —— 失败与恢复都该说一声。静默的存档失败意味着：玩家玩得正兴起，" +
        "而他从此的进度都不进档",
    ).toBeGreaterThanOrEqual(2);
  });

  it("启动时补一次 —— 订阅可能来得比失败晚", () => {
    const src = stripComments(readSource(APP));
    /*
     * 防空转的第二层:光有订阅不够。启动迁移可能在 App 订阅之前就写失败过，
     * 那时回调已经错过了。故启动时要主动读一次当前状态。
     */
    const idx = src.indexOf("subscribeSaveWriteFailure(");
    const tail = src.slice(idx, idx + 900);
    expect(
      tail,
      "订阅之后没有主动补读一次 `saveWriteFailure()` —— 启动迁移若在订阅之前就失败过，" +
        "那一次回调永远收不到，玩家带着一个不会存盘的游戏继续玩",
    ).toMatch(/if\s*\(\s*saveWriteFailure\(\)/);
  });

  it("只读页也要说一声 —— 那是另一种静默失败", () => {
    /*
     * 多标签页时，后开的那个是**只读**的:操作在内存里都「成功」，只是不落盘。
     * 不吭声的话，玩家刷新后才发现白忙 —— 与写盘失败是同一类静默失败，
     * 只是原因不同（一个是存储满，一个是这一页不该写）。
     *
     * 故这条判据要求:订阅了 `onBlockedSaveWrite`，并在回调里 toast。
     */
    const src = stripComments(readSource(APP));
    /*
     * 定位**调用处**而不是 import 行 —— 第一版用 `indexOf` 命中了 import，
     * 于是后面找 `=>` 时抓到的是别的箭头函数（实测断言里出现了 `{turnDirection.value}`）。
     */
    const at = src.lastIndexOf("onBlockedSaveWrite(");
    expect(
      at,
      "没有订阅「写被拦下」—— 多标签页时后开的那一页是只读的，而玩家会以为操作成功了",
    ).toBeGreaterThan(-1);
    /*
     * 只看**回调函数体**，不看后面 400 字符 ——
     * 第一版取固定窗口，于是扫到了后面 `settleReturn` 那几句 `notify(`，
     * 把回调改成空函数判据照样绿（实测）。
     */
    const open = src.indexOf("(", at);
    const arrow = src.indexOf("=>", open);
    expect(arrow, "回调不是箭头函数 —— 判据要跟着改").toBeGreaterThan(-1);
    const braceStart = src.indexOf("{", arrow);
    expect(braceStart, "回调不是块体 —— 判据要跟着改").toBeGreaterThan(-1);
    let depth = 0;
    let braceEnd = -1;
    for (let i = braceStart; i < src.length; i += 1) {
      if (src[i] === "{") depth += 1;
      else if (src[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          braceEnd = i;
          break;
        }
      }
    }
    expect(braceEnd, "回调体没闭合").toBeGreaterThan(braceStart);
    const body = src.slice(braceStart, braceEnd + 1);
    expect(
      body,
      "订阅了写被拦下，却在回调里不吭声 —— 只读页的操作在内存里都「成功」，" +
        "玩家刷新后才发现白忙",
    ).toMatch(/\.toast\(|notify\(/);
  });

  it("失败那条不是 log 了事 —— warnSaveFailure 自己必须 toast", () => {
    /*
     * 第一版只核「订阅窗口里有一处 toast」→ 而恢复那条也算，
     * 于是把 `warnSaveFailure` 改成 `console.warn` 之后判据照样绿（实测）。
     * 收紧成:那个函数**自己**要 toast。
     */
    const src = stripComments(readSource(APP));
    const at = src.indexOf("const warnSaveFailure");
    expect(at, "找不到 warnSaveFailure").toBeGreaterThan(-1);
    const fnEnd = src.indexOf("};", at);
    const fn = src.slice(at, fnEnd);
    expect(
      fn,
      `warnSaveFailure 只 console 了 —— 玩家看不见。«${fn.replace(/\s+/g, " ").trim().slice(0, 80)}»`,
    ).toMatch(/ui\.toast\(/);
  });
});
