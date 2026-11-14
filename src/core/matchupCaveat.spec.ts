/**
 * 对战模拟那个百分比旁边的免责 —— 它防的是「把这个数当结果」。
 *
 * ## 由来（第 301 轮）
 *
 * `BuildView.vue` 的构筑对战表会给每一类对手报一个胜率百分比:
 *
 * ```html
 * <span class="build-matchup__rate tabular">{{ formatPercent(row.winRate, 0) }}</span>
 * ```
 *
 * 而紧接的一段写着:
 *
 * ```text
 * 每类各打 {{ MATCHUP_SAMPLE_RUNS }} 场估算，读的是「哪面吃亏」的方向，
 * 不是精确胜率；四墙（首领 / 高爆发 / 真伤 / 疾影）通吃，才称万金油。
 * ```
 *
 * 这句话做三件事:
 *
 * ```text
 * ① 报样本量      「每类各打 N 场」—— 让玩家知道这个数的置信度来自哪里
 * ② 划清性质      「方向，不是精确胜率」—— 它不是「我打这一场会赢」的概率
 * ③ 给出判据      「四墙通吃，才称万金油」—— 什么才算强，不看单个胜率
 * ```
 *
 * 没有第 ② 句，玩家会把 62% 读成「我打两次能赢一次」；没有第 ③ 句，
 * 他会以为某一类 90% 就是最强。
 *
 * ## 为什么需要判据
 *
 * ```text
 * 类型系统      模板里的一段字，管不到
 * 浏览器巡游    layout-check / ui-smoke 都不看文案内容
 * 既有判据      零（「不是精确胜率」全仓只有一处，就是它自己）
 * ```
 *
 * 删掉它，那张表照样渲染、颜色照样分档、按钮照样能点 —— **不会有任何门红**。
 *
 * ## 判据
 *
 * ① 对战表与胜率渲染都还在（防空转）;
 * ② 「不是精确胜率」那句还在;
 * ③ 样本量是**现算**的（`MATCHUP_SAMPLE_RUNS`），不是手写的数字;
 * ④ 「四墙通吃」那条判据还在，且四类都点到。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const SRC = readSource("src/views/BuildView.vue");

/** 只取那段免责 —— 同一页别处也有 `formatPercent(` 调用。 */
function caveatBlock(): string {
  const start = SRC.indexOf("build-matchup__rate");
  expect(start, "找不到对战胜率那一段 —— 它被删了或被改名").toBeGreaterThan(0);
  const end = SRC.indexOf("</article>", start);
  expect(end, "找不到这一段的结束 —— 解析会越界").toBeGreaterThan(start);
  return SRC.slice(start, end);
}

describe("对战模拟 · 百分比旁边必须说明它是什么", () => {
  it("胜率渲染与样本量说明都在（防空转）", () => {
    const block = caveatBlock();
    expect(block.length, "这一段太短 —— 切片错位置了").toBeGreaterThan(300);
    expect(block, "这段里没有胜率渲染 —— 找错地方了").toContain("formatPercent(");
  });

  it("「不是精确胜率」那句还在", () => {
    const block = caveatBlock();
    expect(block, "「不是精确胜率」不见了 —— 玩家会把 62% 读成「打两次赢一次」:").toContain(
      "不是精确胜率",
    );
  });

  it("样本量是现算的，不是手写的数字", () => {
    const block = caveatBlock();
    expect(block, "样本量没有读 MATCHUP_SAMPLE_RUNS —— 手写的数字会在改常数时撒谎").toContain(
      "MATCHUP_SAMPLE_RUNS",
    );
  });

  it("「四墙通吃」那条判据还在，四类都点到", () => {
    const block = caveatBlock();
    expect(block, "「四墙通吃，才称万金油」不见了 —— 玩家会以为某一类高就是最强").toContain(
      "才称万金油",
    );
    const walls = ["首领", "高爆发", "真伤", "疾影"];
    const missing = walls.filter((w) => !block.includes(w));
    expect(missing, "四墙没有点全 —— 少一类，那条判据就残缺:" + missing.join(" / ")).toEqual([]);
  });
});
