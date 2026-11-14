/**
 * 删档必须二次确认 —— 一个按钮不该抹掉两百天的修行。
 *
 * ## 由来（第 198 轮，查存档安全）
 *
 * 设置页有三个存档按钮:
 *
 * ```text
 * 导出存档
 * 导入存档
 * 散尽修为，重入轮回(清空存档)
 * ```
 *
 * 第三个是不可逆的。实测点它之后弹出:
 *
 * ```text
 * 重置游戏
 * 此举将彻底抹去本机的一切修行痕迹，包括转世收获，且无法恢复。
 * 这一按会抹掉:已历世数 第 2 世 · 此世境界 真仙·四层 · 随魂道果 12 枚
 * [再想想] [道心已决]
 * ```
 *
 * **这一层做得很扎实** —— 有二次确认、列出了具体损失、放弃项在最前。
 *
 * ## 那为什么还要判据
 *
 * 因为**没有判据守着它**。`dataTextAudit` 与 `uiLayering` 提到过「道心已决」
 * 这几个字，但那是查文案与分层，不是查「删档有没有确认」。
 *
 * 而这是一件**只要有人顺手改一次就会永久失去玩家存档**的事。它该有一条判据。
 *
 * ## 这条判据守什么
 *
 * ① `confirmReset` 只能从确认弹窗那一支调到（不能直接挂在按钮上）;
 * ② 确认弹窗里列出的损失**从存档现状读**（不是写死的六个字）;
 * ③ 弹窗里有「放弃」那一支（不是只有「确定」）。
 *
 * 不钉具体文案 —— 「再想想」「道心已决」这类话该由写的人定。
 *
 * ## 故障注入
 *
 * 把触发按钮的 `@click="openReset"` 换成 `@click="confirmReset"` → 「不直接清档」红。
 * 删掉「再想想」那颗按钮 → 「有一支放弃」红。
 * 把列损失的三处变量换成写死的字 → 「不是一句套话」红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";

const VIEW = "src/views/SettingsView.vue";

describe("删档 · 二次确认", () => {
  it("判据的前提还在 —— 那三样都还在", () => {
    const src = stripComments(readSource(VIEW));
    for (const anchor of ["confirmReset", "resetConfirm", "resetGame("]) {
      expect(src, `判据的前提没了：${anchor} —— 判据该跟着改，不是删掉`).toContain(anchor);
    }
  });

  it("清档不是一步到位 —— 中间横着一个确认弹窗", () => {
    const src = stripComments(readSource(VIEW));
    /*
     * 判那件事:`resetGame(` 只能出现在 `confirmReset` 这个函数里 ——
     * 若有人把 `@click="resetGame"` 直接挂到设置页那颗按钮上，
     * 一次误触就抹掉整份存档。
     */
    const calls = [...src.matchAll(/resetGame\(/g)].length;
    expect(calls, "resetGame( 出现了不止一处 —— 有地方绕过了确认").toBe(1);

    const fnStart = src.indexOf("function confirmReset(");
    expect(fnStart, "找不到 confirmReset").toBeGreaterThan(-1);
    const callAt = src.indexOf("resetGame(", fnStart);
    expect(callAt, "resetGame( 不在 confirmReset 里").toBeGreaterThan(fnStart);
    // 该函数到下一个顶层 `}` 之间
    const fnEnd = src.indexOf("\n}", fnStart);
    expect(callAt, "resetGame( 在 confirmReset 之外").toBeLessThan(fnEnd);
  });

  it("那颗按钮只打开弹窗，不直接清档", () => {
    const src = stripComments(readSource(VIEW));
    /*
     * 找设置页那颗「清空存档」按钮 —— 它的 @click 必须是打开弹窗那个 handler，
     * 不能是 `resetGame` / `confirmReset`。
     */
    const btn =
      /@click="(resetConfirm\.value = true|openReset)[^"]*"[\s\S]{0,200}?(重入轮回|清空存档)/.exec(
        src,
      );
    const btnAlt = /(重入轮回|清空存档)[\s\S]{0,400}?@click="([\w.]+)"/.exec(src);
    const handler = btn ? "openReset" : btnAlt?.[2];
    expect(handler !== undefined, "找不到「清空存档」那颗按钮 —— 判据要跟着改").toBe(true);
    expect(
      ["confirmReset", "resetGame"].includes(handler ?? ""),
      `那颗按钮直接调了 ${handler} —— 一次误触就抹掉整份存档，中间没有确认`,
    ).toBe(false);
  });

  it("确认弹窗列出的是这份存档的具体损失，不是一句套话", () => {
    const src = stripComments(readSource(VIEW));
    /*
     * 判那件事:弹窗里列损失的那几行，值来自 store 读数（模板里的 `{{ … }}` 或
     * 绑定的 computed），不是写死的字。
     */
    const idx = src.indexOf("这一按会抹掉");
    expect(idx, "找不到列损失的那一段").toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 900);
    expect(
      block,
      "列损失的那一段没有读任何变量 —— 玩家看到的是一句套话，「要失去什么」并不具体，" +
        "而具体才是让人停下来的东西",
    ).toMatch(/\{\{|:\s*[a-zA-Z_$][\w$]*\s*=/);
  });

  it("弹窗里有一支「放弃」", () => {
    const src = stripComments(readSource(VIEW));
    const idx = src.indexOf("这一按会抹掉");
    expect(idx, "找不到列损失的那一段").toBeGreaterThan(-1);
    const block = src.slice(Math.max(0, idx - 600), idx + 1200);
    /*
     * 「放弃」那一支:它要么就地 `resetConfirm = false`，要么调一个这么做的小函数
     * （实测是 `closeReset`）。不钉文案（「再想想」还是别的），只核这两点:
     * 弹窗 footer 里有两个按钮，且其中一个**不是** `confirmReset`。
     */
    const footer = /<template #footer>([\s\S]{0,400}?)<\/template>/.exec(block);
    expect(footer, "弹窗没有 footer —— 判据要跟着改").not.toBeNull();
    const clicks = [...(footer?.[1] ?? "").matchAll(/@click="(\w+)"/g)].map((m) => m[1]!);
    expect(
      clicks.length,
      "footer 里只有一颗按钮 —— 只有「确定」的确认框是陷阱",
    ).toBeGreaterThanOrEqual(2);
    const cancel = clicks.filter((c) => c !== "confirmReset");
    expect(cancel.length, "footer 里除了「确定」没有别的出口").toBeGreaterThanOrEqual(1);

    /*
     * 而那个出口真的关上弹窗:`closeReset` 得把 `resetConfirm` 置回 false。
     */
    const src2 = stripComments(readSource(VIEW));
    for (const name of cancel) {
      const fn = new RegExp(
        `function ${name}\\(\\)[^{]*\\{[^}]*resetConfirm\\.value\\s*=\\s*false`,
      ).test(src2);
      expect(fn, `${name}() 没有把 resetConfirm 关掉 —— 那颗按钮点了不会退出弹窗`).toBe(true);
    }
  });
});
