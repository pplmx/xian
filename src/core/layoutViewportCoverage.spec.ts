/**
 * 一档视口不叫「守住了」—— 但也不能要求 1098 条断言全跑九档。
 *
 * ## 由来（第 179 轮）
 *
 * 第 178 轮发现:上一轮补的「至大道尽头约 N」那条断言只写在 390 分支里,
 * 而 375 / 320 上的折行与溢出不会被发现。补成三档之后,故障注入证明它真在守。
 *
 * 但顺着这条线查下去会撞上一个**取舍**:
 *
 * ```text
 * layout-check 有 122 个任务、9 个视口、1098 条带 [390] 标签的断言
 * 若要求全部跑九档,门的时间会从 ~5 分钟变成 ~45 分钟
 * ```
 *
 * 所以不能一刀切。真正要区分的是两类断言:
 *
 * - **通用项**（横向可滚、触控尺寸、像素对比度）—— 页面巡游已经在九档各跑一遍;
 * - **中文读数**（一句带汉字与数字的长文案）—— 它在窄屏最容易折行、溢出、被压掉,
 *   而这类断言通常只写在 390 分支里。
 *
 * 上面第 178 轮那条就属于第二类。它的原始形态是「一档 + 无声明」,
 * 而**没有任何东西会提醒下一个写这类断言的人**。
 *
 * ## 这条判据守什么
 *
 * 扫 `scripts/layout-check.mjs` 里**读中文文案再量宽高**的断言块,要求它:
 *
 * ① 至少出现两档宽度（`setViewportSize` 循环或用 `VIEWPORTS`）;
 * ② 或者显式声明「为什么一档够」（注释里写 `单档足够` 并给理由）。
 *
 * 判据不追求穷举:它只盯着一个可机械识别的形态 ——
 * **取了 `textContent` 又量了 `getBoundingClientRect`,然后断言宽度/越界**。
 * 这类断言在窄屏上出错的方式是一样的（挤成两行、顶出容器）。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";

const SRC = "scripts/layout-check.mjs";

/**
 * 源码里那些「读中文文案 + 量几何」的断言块（按 `page.evaluate` 分段）。
 *
 * 分段要点:**下一块的起点必须严格在本块 `evaluate` 之后**。
 * 第一版写成 `indexOf("await page.evaluate(", m.index + 10)` —— 而本块的
 * `await page.evaluate(` 就在 `const x = ` 之后 12 个字符处，于是切出来的
 * block 只有十来个字符，一块都判不出来（实测 267 块全是 0 命中）。
 */
function textGeometryBlocks(src: string): { start: number; text: string }[] {
  const out: { start: number; text: string }[] = [];
  const calls = [...src.matchAll(/await page\.evaluate\(/g)].map((x) => x.index!);
  const marker = /const \w+ = await page\.evaluate\(/g;
  let m: RegExpExecArray | null;
  while ((m = marker.exec(src)) !== null) {
    // 本块自己的 evaluate 位置 —— 取**严格大于**它的下一个
    const own = calls.find((i) => i >= m!.index)!;
    const next = calls.find((i) => i > own);
    const end = next === undefined ? Math.min(src.length, m.index + 3000) : next;
    out.push({ start: m.index, text: src.slice(m.index, end) });
  }
  return out;
}

/** 这一块是不是「读文案 + 量几何」 */
function readsTextAndGeometry(block: string): boolean {
  const readsText = /textContent|innerText/.test(block);
  const readsGeom = /getBoundingClientRect|scrollWidth|clientWidth|offsetWidth/.test(block);
  return readsText && readsGeom;
}

/** 这一块声明了多档视口（或显式说明单档够） */
function declaresCoverage(block: string): boolean {
  if (/setViewportSize/.test(block)) return true;
  if (/for \(const vp of/.test(block)) return true;
  if (/单档足够/.test(block)) return true;
  return false;
}

describe("layout-check · 中文读数类断言必须声明视口覆盖", () => {
  it("每一块「读文案 + 量几何」的断言都有多档或显式豁免", () => {
    const src = readSource(SRC);
    const blocks = textGeometryBlocks(src).filter((b) => readsTextAndGeometry(b.text));
    expect(blocks.length, "一块都没扫到 —— 判据空转或 layout-check 结构变了").toBeGreaterThan(5);

    /*
     * 这一条不要求全部通过 —— 存量断言是既有取舍（1098 条带 390 标签）。
     * 它要求的是:**新加的这类断言不能悄悄地只写一档**。
     * 故用「基线 + 只许减」的方式:把存量数记下来，新增让它红。
     */
    const undeclared = blocks.filter((b) => !declaresCoverage(b.text));
    expect(
      undeclared.length,
      `有 ${undeclared.length} 块「读文案 + 量几何」的断言只跑一档且没说明为什么够 —— ` +
        `第 178 轮的教训:上一轮那条只守了 390,375/320 上的折行与溢出全漏。` +
        `改成 setViewportSize 循环三档，或在注释里写「单档足够」并给理由`,
    ).toBeLessThanOrEqual(UNDECLARED_BASELINE);
  });

  it("第 178 轮补的那条确实是多档的（回归样本）", () => {
    /*
     * 拿一条**已知改对**的断言当样本:若哪天有人把它改回一档,这一条会红。
     * 这比只看总数更直接 —— 总数不变也可能是「一条改对、另一条改坏」。
     */
    const src = readSource(SRC);
    const idx = src.indexOf("data-cultivation-apex-eta");
    expect(idx, "那格读数不见了").toBeGreaterThan(-1);
    const block = src.slice(idx - 1500, idx + 3000);
    expect(block, "「至大道尽头」那条又退回单档了").toMatch(/setViewportSize/);
  });

  it("判据自己认得出那两种形态（地基）", () => {
    expect(
      readsTextAndGeometry(`const a = await page.evaluate(() => {
        const el = document.querySelector("[data-x]");
        const r = el.getBoundingClientRect();
        return { text: el.textContent, w: r.width };
      });`),
      "认不出「读文案 + 量几何」",
    ).toBe(true);
    expect(
      readsTextAndGeometry(`const a = await page.evaluate(() => document.title);`),
      "把普通 evaluate 也当成读数断言",
    ).toBe(false);
    expect(declaresCoverage("await page.setViewportSize({ width: 320, height: 568 });")).toBe(true);
    expect(declaresCoverage("// 单档足够:这一格是纯图标，没有文字")).toBe(true);
    expect(declaresCoverage("const r = el.getBoundingClientRect();"), "无声明却当成有").toBe(false);
  });
});

/**
 * 存量基线 —— **只许减**。
 *
 * 实测 43 块。为什么不是 0:
 *
 * 1. 这条判据是**启发式**的（「读了 textContent 又量了 rect」），
 *    而这 43 块里大部分根本与宽度无关 —— 它们量几何只是为了**定位**
 *    （比如「取这一行所在的位置，再读它的序号」），不是断言宽高;
 * 2. 1098 条带 `[390]` 标签的断言是既有取舍，一把改成九档会让门从
 *    ~5 分钟变成 ~45 分钟，那是另一种失职。
 *
 * 故基线记在这里，**新增会让它红**。要降这个数,就一次改对一块并在
 * 注释里写「多档」或「单档足够」的理由。
 */
const UNDECLARED_BASELINE = 43;
