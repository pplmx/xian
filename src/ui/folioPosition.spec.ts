/**
 * 册目读法 —— 「第几册」一句话里只有一种数字。
 *
 * 判据五组:
 *   一 一句话不混排:有汉字的地方不再出现两位阿拉伯数字;
 *   二 册次与行号分得开:行号仍是两位数字(那是计量),册次走序数词;
 *   三 边界:第 1 册、第 10 册、第 17 册(全作十七页)各读对;
 *   四 坏值:「未入册」而非空串,不让导航骨架塌一块;
 *   五 真接线:星图与顶栏读同一份,不各拼一句。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { folioBookMark, folioPositionMark, folioVolumeMark } from "./folioPosition";

describe("册目读法 · 一句话一种数字", () => {
  it("位置标记里不出现两位阿拉伯数字", () => {
    for (let section = 0; section < 5; section += 1) {
      for (let entry = 0; entry < 17; entry += 1) {
        const mark = folioPositionMark(section, entry);
        expect(mark, `卷${section + 1} 第${entry + 1}册 读成了 «${mark}»`).not.toMatch(/\d{2}/);
        expect(mark, "整句里不该有阿拉伯数字").not.toMatch(/[0-9]/);
      }
    }
  });

  it("同一句里卷次与册次都是汉字,不再前后不一", () => {
    expect(folioPositionMark(2, 2)).toBe("卷三 · 第三册");
    // 反例守卫:不能是「卷三 · 第 03 册」那种半截汉字半截数字
    expect(folioPositionMark(2, 2)).not.toContain("0");
  });
});

describe("册目读法 · 册次与行号分开", () => {
  it("册次读序数词", () => {
    expect(folioBookMark(0)).toBe("第一册");
    expect(folioBookMark(9)).toBe("第十册");
    expect(folioBookMark(10)).toBe("第十一册");
    expect(folioBookMark(16)).toBe("第十七册");
  });

  it("卷次读「卷 N」", () => {
    expect(folioVolumeMark(0)).toBe("卷一");
    expect(folioVolumeMark(4)).toBe("卷五");
  });

  it("行号不归这里管 —— 列表里的 01/02 仍是两位数字", () => {
    // 这条是反向守卫:本模块只出「第 N 册 / 卷 N」,绝不产出纯数字
    for (let i = 0; i < 5; i += 1) {
      expect(folioBookMark(i)).not.toMatch(/^[0-9]/);
      expect(folioVolumeMark(i)).not.toMatch(/^[0-9]/);
    }
    // 而界面上成百条的行号仍是阿拉伯数字(这条钉住「别把它也汉字化」)
    const artifact = readSource("src/components/inventory/ArtifactPanel.vue");
    expect(artifact, "法宝谱的行号仍是两位数字").toContain('padStart(2, "0")');
  });
});

describe("册目读法 · 边界与坏值", () => {
  it("十七册全都能读,且互不相同", () => {
    const marks = Array.from({ length: 17 }, (_, i) => folioBookMark(i));
    expect(new Set(marks).size, "十七册读出了重复的字").toBe(17);
    for (const m of marks) {
      expect(m).toMatch(/^第[一二三四五六七八九十]+册$/);
    }
  });

  it("没有位置时读「未入册」,不是空串", () => {
    expect(folioPositionMark(null, 2)).toBe("未入册");
    expect(folioPositionMark(1, null)).toBe("未入册");
    expect(folioPositionMark(undefined, undefined)).toBe("未入册");
    expect(folioPositionMark(1, 2), "有位置时不该读未入册").not.toBe("未入册");
  });

  it("负数与 NaN 也读「未入册」", () => {
    expect(folioBookMark(Number.NaN)).toBe("未入册");
    expect(folioBookMark(-1)).toBe("未入册");
    expect(folioVolumeMark(Number.NaN)).toBe("卷首");
    expect(folioVolumeMark(-3)).toBe("卷首");
  });
});

describe("册目读法 · 真接线", () => {
  it("星图与顶栏读同一份,不各拼一句", () => {
    const atlas = readSource("src/components/common/NavigationAtlas.vue");
    const top = readSource("src/components/common/TopStatusBar.vue");
    expect(atlas, "星图要读共享的册目读法").toContain("folioPositionMark(");
    expect(top, "顶栏要读同一份").toContain("folioBookMark(");
    // 两处都不许再自己 padStart 拼册次
    expect(atlas, "星图不该自己拼两位册次").not.toMatch(/第 \$\{String\(position\.entryIndex/);
    expect(top, "顶栏不该自己拼两位册次").not.toMatch(
      /String\(position\.value\.entryIndex \+ 1\)\.padStart/,
    );
  });

  it("星图册目清单的册次也读汉字 —— 十七册是体例,不是计量", () => {
    const atlas = readSource("src/components/common/NavigationAtlas.vue");
    // 册目清单里那一枚不该再是 padStart(2,"0")
    const block = atlas.slice(
      atlas.lastIndexOf("<span", atlas.indexOf("atlas-entry__ordinal")),
      atlas.indexOf("</span>", atlas.indexOf("atlas-entry__ordinal")),
    );
    expect(block, "册目清单的册次不该再补零成两位数字").not.toContain('padStart(2, "0")');
    expect(block, "册次读汉字").toContain("cnNumber");
  });

  it("卷首水印上一轮已改汉字,本轮的读法要与它同一套", () => {
    const masthead = readSource("src/components/common/FolioPageHeader.vue");
    expect(masthead, "卷首都走同一条转写").toContain("folioOrdinalMark(");
    // 两处实现都读 utils/format 的 cnNumber,不各写一份数字表
    const pos = readSource("src/ui/folioPosition.ts");
    expect(pos).toContain("cnNumber");
    expect(pos).not.toMatch(/["']零一二三四五六七八九["']/);
  });
});
