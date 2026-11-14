/**
 * 已经跨过雏形线时，「再补 ___」那句话要换掉。
 *
 * ## 由来（第 196 轮，顺着上一轮「进度满了但文案还说差」扫）
 *
 * `components/build/BuildDiscovery` 里:
 *
 * ```ts
 * const closestGap = computed(() => Math.max(0, STYLE_EMERGENCE_AFFINITY - closest.value.affinity));
 * const closestGapText = computed(() =>
 *   closestGap.value > 0 ? `${formatPercent(closestGap.value, 0)} 契合` : "最后一步",
 * );
 * ```
 *
 * 而模板里那一整句是:
 *
 * ```text
 * 最近的是「背水流」。再补 {closestGapText}，核心词条平均跨过 25% 便会成路。
 * ```
 *
 * 于是 `closestGap === 0`（**已经跨过雏形线**）时，读出来是:
 *
 * ```text
 * 最近的是「背水流」。再补 最后一步，核心词条平均跨过 25% 便会成路。
 * ```
 *
 * ## 为什么这算缺陷
 *
 * 两处不通:
 *
 * 1. **「再补最后一步」读不通** —— 补是补一个量，而「最后一步」不是量;
 * 2. 更要紧的是**句子的前提错了** —— 那时已经跨过 25% 了，而这句话还在说
 *    「跨过便会成路」，把玩家说成还没成路。
 *
 * 与上一轮同一个形状:读数到了边界，而文案仍停在边界之前的样子。
 *
 * ## 这条判据守什么
 *
 * ① `closestGap === 0` 时不能落到「最后一步」那个词 —— 它属于「差一点点」,不属于「已经到」;
 * ② 那一整句在到边界之后要换一句说得通的话。
 *
 * 不钉新文案 —— 该说什么由写的人定。
 *
 * ## 故障注入
 *
 * 把「最后一步」加回 `closestGapText` → 「不该用在已经跨过界的地方」红。
 * 删掉 `v-else-if="hasTrace"` 那一支 → 「到边界之后换掉」红。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { stripComments } from "@/test/stripComments";
import { STYLE_EMERGENCE_AFFINITY } from "@/core/buildDetect";

const VIEW = "src/components/build/BuildDiscovery.vue";

describe("构筑 · 已经跨过雏形线时的那句话", () => {
  it("判据的前提还在 —— 那三样都还在", () => {
    const src = stripComments(readSource(VIEW));
    for (const anchor of ["closestGap", "STYLE_EMERGENCE_AFFINITY"]) {
      expect(src, `判据的前提没了：${anchor} —— 判据该跟着改，不是删掉`).toContain(anchor);
    }
    expect(STYLE_EMERGENCE_AFFINITY, "雏形线不该是 0 —— 它是这句文案的边界").toBeGreaterThan(0);
  });

  it("「最后一步」不该用在已经跨过界的地方", () => {
    const src = stripComments(readSource(VIEW));
    expect(
      src,
      "「最后一步」被当成了「gap === 0」的说法 —— 而 gap === 0 意味着**已经跨过**，" +
        "那句话却还在说「再补 ⋯ 跨过便会成路」，把已经成路的玩家说成还没成路",
    ).not.toContain("最后一步");
  });

  it("到边界之后那一整句换掉（不是只换一个词）", () => {
    /*
     * 防空转的第二层:只把「最后一步」换成别的词还不够 —— 外面那句
     * 「再补 ___，核心词条平均跨过 25% 便会成路」本身就与「已经跨过」矛盾。
     * 故核:模板里那一句有按「有没有到线」分岔的两支。
     */
    const src = stripComments(readSource(VIEW));
    const idx = src.indexOf("最近的是");
    expect(idx, "找不到那句话").toBeGreaterThan(-1);
    const block = src.slice(Math.max(0, idx - 200), idx + 700);
    /*
     * 第一版只查 `v-if=`—— 而模板里本来就有 `v-if="hasTrace"`（另一件事），
     * 于是删掉新的那支它照样绿（实测）。
     * 收紧成:分岔条件必须**真的提到 closestGap**。
     */
    expect(
      block,
      "那句话只有「有没有词条」这一支 —— 到线之后仍然说「再补 ⋯ 跨过便会成路」，" +
        "而玩家已经跨过了",
    ).toMatch(/closestGap\s*>\s*0|closestGap\s*===?\s*0|closestGap\.value\s*>\s*0/);
  });
});
