/**
 * 破题要在按下之前说，不是按下之后。
 *
 * ## 由来（第 471 轮）
 *
 * `samsaraService.noteTaboo` 的注释写得很清楚:
 *
 * > 不等到转世才结算:玩家应当在按下那一刻就知道自己的话没说到底,
 * > 而不是几个时辰后被一句总结告知。
 *
 * 它确实做到了「按下那一刻」—— `usePill` 第 104 行调它,当场弹一条
 * 「【破题】你曾立誓…」。但那是**按下之后**。
 *
 * 而同文件里另有一处口径完全相反的先例:
 *
 * > 服前把叠层/将顶摊明 —— `usePill` 在 full 也照吃,不能等服后 toast
 * > 才明白,决策就地可见。(`InventoryView` 的 `currentPillHint`)
 *
 * 「这一颗会白费」在服前说了,而「这一颗会让你这一世立的话落空」
 * 只在服后说 —— 后者是**更重的损失**,却排在更后面。
 *
 * ## 判据
 *
 * ① 有命题禁忌时,丹药详情里必须给出一句含「破题」的提示(服前);
 * ② 反差:没有禁忌时不许多出那句话 —— 否则每颗丹上都挂一句无关警告;
 * ③ 反差:那句话必须读到**命题本身**(vow),不是一句通用的「有禁忌」。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/*
 * 去掉注释再扫 —— 这段代码里**引用**「破题」来说明问题的地方很多
 * (注释里就有三处),而引用不是实现。第 445 轮踩过同一个坑。
 */
const VIEW = readFileSync(resolve(__dirname, "../views/InventoryView.vue"), "utf-8")
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "");

describe("立下的命题 · 破题要在按下之前说", () => {
  it("① 丹药详情里有一句服前警告，且提到「破题」", () => {
    expect(VIEW, "丹药详情里找不到服前警告").toContain("currentPillHint");
    /*
     * 警告文案必须落在那一块里 —— 不只是页面某处出现「破题」二字。
     */
    const at = VIEW.indexOf("const currentPillHint");
    expect(at, "currentPillHint 定位不到 —— 判据会空转").toBeGreaterThan(0);
    const block = VIEW.slice(at, at + 2000);
    /*
     * 不许只判「块里出现过这个词」—— 注释里提到它会让判据空转(实测)。
     * 要求它出现在一条 return 的文案里，且该 return 由命题禁忌把关。
     */
    expect(block, "服前警告里没有「破题」这一档 —— 最重的损失没在按下之前说").toMatch(
      /return\s*\{[^\n]*破题/,
    );
  });

  it("② 反差：没有禁忌时不许挂那句话", () => {
    /*
     * 判据读的是 `vowTabooOf` 这类查询的结果，而不是无条件返回一句。
     * 这里守的是「有条件的」这个形状:必须先取当前命题的禁忌，再决定说不说。
     */
    const at = VIEW.indexOf("const currentPillHint");
    const block = VIEW.slice(at, at + 2000);
    expect(block, "警告没有先查命题禁忌 —— 它会对每一颗丹都说话").toMatch(/taboo|vow/i);
  });

  it("③ 反差：说到命题本身，不是一句通用警告", () => {
    const at = VIEW.indexOf("const currentPillHint");
    const block = VIEW.slice(at, at + 2000);
    /*
     * 通用警告只需「本世有禁忌」；而这里要求它把**立的那句话**读出来，
     * 与 noteTaboo 的 toast 同一个口径（那里读的是 `def.vow`）。
     */
    expect(block, "那句话没有引到命题本身").toMatch(/return\s*\{[^\n]*vowTaboo\.vow/);
  });
});
