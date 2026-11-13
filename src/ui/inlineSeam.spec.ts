/**
 * 句中内联控件 —— 闭标签后的换行会在标点前漏出一个空格。
 *
 * ## 由来（真渲染抓到的两处）
 *
 * 真仙导览弹窗与「本世之界」的说明各有一句把一枚行内元素嵌在句中:
 *
 * ```text
 * 玄铁、功法残页、灵石……皆可献入 天道熔炉 ,熔作道源。
 * 舍 道果 可立即换一方天地…; 待 兵解转世 ,也会另开一片天地…
 * ```
 *
 * 那一对空格不是文案,是 Vue 模板的排版:行内元素前后的**换行 + 缩进**
 * 编译成一个空格。中文里逗号前不留空白,而这一对空格恰好在逗号前 ——
 * 是本仓「中文与标点之间不留空白」这条纪律的可见违例。
 *
 * ## 为什么只认「闭标签 + 标点」这一种形状
 *
 * 第一版判的是两侧接缝（开标签前也查），扫出五十余处 —— 全是**误报**:
 * 「字数 ⏎ <span>{{ n }}</span>」这种换行，渲染出来是「字数 5」，
 * 中文与阿拉伯数字之间那一个空格正是本仓明写要留的（见 `copyPunctuation.spec`
 * 同族的空格纪律）。**开标签那一侧的空格几乎总是对的**；
 * 真正会印错的只有闭标签之后紧跟标点那一侧：中文里标点前从不留空白。
 *
 * 故判据只认一个形状：
 *
 * ```text
 * <INLINE …>…</INLINE>\n    ,…       ← 红（闭标签与标点被换行隔开）
 * <INLINE …>…</INLINE>,…             ← 绿（同一行）
 * ```
 *
 * 这一条同时守住了「不要为了排版去分两行写一句中文」这件事：把标点并到
 * 闭标签那一行即可，句子其余部分怎么折行都行。
 */
import { describe, expect, it } from "vite-plus/test";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { ROOT, isVueFile, walkFiles } from "@/test/readSource";

/** 会被当成行内的标签 —— 它们夹在句中时,前后换行缩进会变成真空格 */
const INLINE_TAGS = ["button", "a", "b", "em", "strong", "span", "small", "code", "i"];

/** 中文标点（后半）—— 出现在它们之前的空白一定是排版漏出来的 */
const CLOSING_PUNCT = "[,。、；：,.;:）)」』】》]";

const CLOSE_RE = new RegExp(`</(?:${INLINE_TAGS.join("|")})>\\s*$`);
const PUNCT_FIRST = new RegExp(`^\\s*${CLOSING_PUNCT}`);

export interface SeamHit {
  line: number;
  text: string;
}

/**
 * 找出「闭标签独占行尾、下一行以标点起头」的接缝。
 *
 * 只看模板 —— `<script>` 里的字符串拼接不是这条判据的对象。
 * 返回的行号是模板内的行序（与文件头偏移无关），报错时足够定位。
 */
export function seamHits(src: string): SeamHit[] {
  const tpl = /<template>([\s\S]*)<\/template>/.exec(src)?.[1] ?? "";
  const lines = tpl.split("\n");
  const hits: SeamHit[] = [];
  for (let i = 0; i < lines.length - 1; i += 1) {
    const line = lines[i]!;
    const next = lines[i + 1]!;
    if (CLOSE_RE.test(line) && PUNCT_FIRST.test(next)) {
      hits.push({ line: i + 1, text: `${line.trim()} ⏎ ${next.trim()}` });
    }
  }
  return hits;
}

const FILES = walkFiles(resolve(ROOT, "src"), isVueFile).map((full) => ({
  path: full.slice(ROOT.length + 1).replace(/\\/g, "/"),
  src: readFileSync(full, "utf8"),
}));

describe("句中内联控件 · 闭标签后的换行不许把标点推后", () => {
  it("没有一处让标点落在闭标签的下一行", () => {
    const bad = FILES.flatMap((f) =>
      seamHits(f.src).map((hit) => `${f.path}:${hit.line}  ${hit.text}`),
    );
    expect(bad, "这些句子在标点前会多出一个空格 —— 把标点并到闭标签那一行末尾").toEqual([]);
  });

  it("判据确实扫得到东西(防空转)", () => {
    expect(FILES.length, "模板语料是空的 —— walkFiles 或 isVueFile 坏了").toBeGreaterThan(50);

    const bad = `<template>
  <p>
    皆可献入<button type="button">天道熔炉</button>
    ,熔作道源。
  </p>
</template>`;
    expect(seamHits(bad), "闭标签 + 标点折行的反例没认出来").toHaveLength(1);

    // 正当写法:标点并在闭标签那一行
    const good = `<template>
  <p>
    皆可献入
    <button type="button">天道熔炉</button>,熔作道源。
  </p>
</template>`;
    expect(seamHits(good), "标点并在同一行被误伤了").toEqual([]);

    // 正当写法:闭标签后换行接的是一句**新话**,不是标点
    const newSentence = `<template>
  <p>
    <span>甲</span>
    乙丙丁。
  </p>
</template>`;
    expect(seamHits(newSentence), "闭标签后接新句被误伤了").toEqual([]);

    // 正当写法:块级元素之间的空白根本不渲染
    const blocky = `<template>
  <div>
    <p>上文</p>
    <p>,这里只是举例</p>
  </div>
</template>`;
    // 这条**会**被认出来 —— 可它是块级之间,虚警。故判据要求闭标签是行内标签:
    expect(seamHits(blocky), "行内闭标签才算接缝(块级之间不该被认)").toHaveLength(0);
  });
});
