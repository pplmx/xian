/**
 * 问卦的扣费顺序 —— 先摇出卦，再扣悟道点。
 *
 * ## 由来（第 266 轮）
 *
 * `core/divinationService.ts` 里原本是这个顺序:
 *
 * ```ts
 * resources.spendSmall("wudao", DIVINATION_COST);
 * const reading = drawHexagram(rand);
 * ```
 *
 * 而 `drawHexagram` 里有一条断言:
 *
 * ```ts
 * if (!reading) throw new Error("摇卦失败:六爻未成卦");
 * ```
 *
 * 今天不可达（`castLines` 必然给六个 0/1），但**它是断言，不是保证**。一旦哪天
 * `castLines` 改了或卦表变了，那一抛就发生在扣费之后:玩家少了悟道点、没拿到卦，
 * 页面还白屏。
 *
 * 换过来的代价是零（两行顺序）。这类「先扣钱、后办事」的顺序问题在别处也一样危险，
 * 故锁成判据。
 *
 * ## 为什么只能用源码层判据
 *
 * 想用行为测（注入一个「让摇卦失败」的 rand）做不到:`castLines` 只用
 * `rand.chance(0.5)` 取布尔，无论怎么注入，六爻都会成卦 —— 那条 `throw` 是
 * **结构上不可达**的，不是「某种输入下会失败」。故这里只能查顺序，
 * 并在注释里写明：它守的是「结构上不留下这个窗口」。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const SRC = readSource("src/core/divinationService.ts");

describe("问卦的扣费顺序", () => {
  it("先摇出卦，再扣悟道点", () => {
    const spendAt = SRC.indexOf('spendSmall("wudao"');
    const drawAt = SRC.indexOf("drawHexagram(rand)");
    expect(spendAt, "找不到 spendSmall —— 扣费写法变了").toBeGreaterThan(0);
    expect(drawAt, "找不到 drawHexagram —— 摇卦写法变了").toBeGreaterThan(0);
    expect(spendAt, "扣费在摇卦之前 —— 摇卦抛错时悟道点会被白扣").toBeGreaterThan(drawAt);
  });

  it("「卦在身」与「悟道点不足」两条早退都在扣费之前", () => {
    const activeAt = SRC.indexOf("if (player.activeDivination)");
    const shortAt = SRC.indexOf('hasSmall("wudao"');
    const spendAt = SRC.indexOf('spendSmall("wudao"');
    expect(activeAt, "找不到「卦在身」那条早退").toBeGreaterThan(0);
    expect(shortAt, "找不到「悟道点不足」那条早退").toBeGreaterThan(0);
    // 两条早退都必须先于扣费 —— 否则「拒绝」也会扣钱
    expect(activeAt, "「卦在身」的早退排在扣费之后 —— 拒绝时也会扣钱").toBeLessThan(spendAt);
    expect(shortAt, "「悟道点不足」的早退排在扣费之后 —— 拒绝时也会扣钱").toBeLessThan(spendAt);
  });

  it("落状态在扣费之后 —— 扣了钱却没卦，比没扣更糟", () => {
    const spendAt = SRC.indexOf('spendSmall("wudao"');
    const setAt = SRC.indexOf("player.setDivination(");
    expect(setAt, "找不到 setDivination —— 落状态写法变了").toBeGreaterThan(0);
    expect(setAt, "落状态排在扣费之前 —— 中途失败会留下「没付钱的卦」").toBeGreaterThan(spendAt);
  });
});
