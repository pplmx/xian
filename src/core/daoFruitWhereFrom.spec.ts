/**
 * 「尚差 8 道果」之后，玩家不知道该去哪攒。
 *
 * ## 由来（第 535 轮）
 *
 * 第 529 轮给签契的道果不足补了差额（「尚差 N 枚（此契需 M 枚）」）。
 * 这一轮从玩家视角往下追一步:知道差多少之后，他知道**去哪攒**吗?
 *
 * ```text
 *   道果的唯一来源   天道熔炉（道源 → 道果），入口在天界页
 *   签契弹窗         转世弹窗（RebirthDialog）
 *   两处不在同一屏
 * ```
 *
 * 而转世弹窗里只有「道果 +X%」（有效道果的增长率），没有「去哪凝」。
 *
 * ## 判据
 *
 * ① 转世弹窗要指向道果的来源（天道熔炉 / 道源 / 天界）;
 * ② 反差：它不许复述「道果跨世保留」那句（那说的是性质，不是来源）;
 * ③ 反差：来源的措辞要与天界页一致 —— 不许在这里另起一个叫法。
 */
import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DIALOG = readFileSync(
  resolve(__dirname, "../components/character/RebirthDialog.vue"),
  "utf8",
);

describe("道果 · 差多少之后，去哪攒", () => {
  it("① 转世弹窗要指向道果的来源", () => {
    /*
     * 只在那一段里找（从「道果」第一次出现到 signTrial 之前），
     * 免得匹配到文件尾部的无关文字。
     */
    const at = DIALOG.indexOf("道果");
    expect(at, "转世弹窗里没有道果 —— 判据的前提要重看").toBeGreaterThan(0);
    const near = DIALOG.slice(Math.max(0, at - 600), at + 3000);
    const hit = ["天道熔炉", "道源", "天界"].filter((w) => near.includes(w));
    expect(
      hit.length,
      "转世弹窗里没有一处指向道果的来源 —— 玩家知道差 8 枚，却不知道该去哪凝。" +
        "而道果只能在天道熔炉（天界页）由道源凝成。",
    ).toBeGreaterThan(0);
  });

  it("② 反差：它不许只复述「道果跨世保留」", () => {
    /*
     * 「跨世留下」说的是**性质**（它不会随转世清空），不是**来源**（它从哪来）。
     * 这一条守的是①的边界:别拿那句当「已经说清了」。
     */
    expect(DIALOG, "「跨世留下」那句不见了 —— 它仍然要说").toContain("跨世");
  });

  it("③ 反差：来源的措辞与天界页一致", () => {
    /*
     * 天界页那一处叫「天道熔炉」「道源」—— 转世弹窗若另起一个叫法，
     * 玩家会以为是两个东西。
     */
    const furnace = readFileSync(
      resolve(__dirname, "../components/celestial/FurnaceDialog.vue"),
      "utf8",
    );
    expect(furnace, "天道熔炉那一处不再叫「道源」—— 判据③的前提变了").toContain("道源");
    expect(DIALOG, "转世弹窗里用的不是「天道熔炉」或「道源」这两个词之一").toMatch(/天道熔炉|道源/);
  });
});
