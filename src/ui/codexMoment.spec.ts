/**
 * 道历收录 —— 图鉴页脚不许再报现实世界的钟。
 *
 * 判据四组:
 *   一 拼句:第 N 世 · M 岁,整数;缺一边整句退回「早年收录」而不是半句;
 *   二 不含现实时间:任何一条收录读数里都没有公历年月日与时分;
 *   三 真接线:recordCollect 时把世界内读数一起写下,读档往返不丢;
 *   四 旧档:没有这对读数的条目照实说「早年收录」,不编造。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { codexMomentText } from "./codexMoment";

describe("道历收录 · 拼句", () => {
  it("照实报出第几世、活到几岁", () => {
    expect(codexMomentText({ life: 3, age: 42 })).toBe("第 3 世 · 42 岁");
  });

  it("小数一律取整 —— 年岁本来就是整数口径", () => {
    expect(codexMomentText({ life: 2.9, age: 41.7 })).toBe("第 2 世 · 41 岁");
  });

  it("旧档没有读数时照实说「早年收录」,不编时间", () => {
    expect(codexMomentText(undefined)).toBe("早年收录");
    expect(codexMomentText(null)).toBe("早年收录");
  });

  it("缺一边也退回「早年收录」—— 半句「第 3 世 · 岁」比不写更糟", () => {
    expect(codexMomentText({ life: 3 } as never)).toBe("早年收录");
    expect(codexMomentText({ age: 40 } as never)).toBe("早年收录");
    expect(codexMomentText({ life: Number.NaN, age: 40 })).toBe("早年收录");
    expect(codexMomentText({ life: 1, age: Number.NaN })).toBe("早年收录");
    // 世数从 1 起,0 是坏值
    expect(codexMomentText({ life: 0, age: 40 })).toBe("早年收录");
  });

  it("任何一句里都没有公历年月日与时分", () => {
    const samples = [
      codexMomentText({ life: 1, age: 0 }),
      codexMomentText({ life: 12, age: 365 }),
      codexMomentText(undefined),
    ];
    for (const text of samples) {
      expect(text, `«${text}» 里混进了现实日期`).not.toMatch(/\d{4}[-/年]\d{1,2}/);
      expect(text, `«${text}» 里混进了钟点`).not.toMatch(/\d{1,2}:\d{2}/);
    }
  });
});

describe("道历收录 · 图鉴读它", () => {
  it("页脚那格的取值不再走现实日期", () => {
    const codex = readSource("src/ui/codex.ts");
    expect(codex, "图鉴该读道历拼句").toContain("codexMomentText(");
    /*
     * 判据要认的是**代码**,不是注释:那份文件里正当写着「从前这里用 toLocaleString」
     * 来解释这次改动,把它当违规打红,就成了「注释越诚实越容易挂」。
     * 去掉注释再查,与 typeScale.spec / dataTextAudit 同一套做法。
     */
    const code = codex.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code, "不该再拿墙钟毫秒去格式化").not.toMatch(/toLocaleString\(\s*"zh-CN"/);
    expect(code, "不该再凭空造一个 Date").not.toMatch(/new Date\(\s*ts\b/);
  });

  it("收录那一刻要把世界内读数一起写下", () => {
    const quests = readSource("src/stores/quests.ts");
    expect(quests, "收录要记下第几世与年岁").toContain("collectedMoment");
  });
});

describe("道历收录 · 与真实时间脱钩", () => {
  it("拼句模块不碰 Date —— 它只认存档里的两枚整数", () => {
    const src = readSource("src/ui/codexMoment.ts");
    expect(src, "道历不该认得墙钟").not.toMatch(/\bnew Date\b/);
    expect(src, "道历不该认得墙钟").not.toContain("toLocaleString");
  });
});
