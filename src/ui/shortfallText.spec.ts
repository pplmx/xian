/**
 * 差额一句话 —— 被拦下时要说得清差多少。
 *
 * 判据四组:
 *   一 拼法:一样不写多余分隔、多样用「 · 」、全空给空串;
 *   二 前缀保留:先说是哪一样没成,再说差多少(只报差额要靠上下文猜);
 *   三 只拼句子:本模块不做减法,差额由调用方从同一份代价算出 —— 与置灰那一侧同源;
 *   四 真接线:几处「只说不许」的资源拦截都改用它。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { blockedBy, shortfallText } from "./shortfallText";

describe("差额一句话 · 拼法", () => {
  it("只缺一样时不写多余分隔", () => {
    expect(shortfallText([{ name: "石", amount: "320" }])).toBe("尚差 石 320");
  });

  it("缺几样时用中点连起来", () => {
    const text = shortfallText([
      { name: "器灵尘", amount: "120" },
      { name: "灵石", amount: "3.4万" },
    ]);
    expect(text).toBe("尚差 器灵尘 120 · 灵石 3.4万");
    expect(text.endsWith("·")).toBe(false);
  });

  it("一样都不缺时给空串 —— 没差额就不该拦人", () => {
    expect(shortfallText([])).toBe("");
  });

  it("空名目或空数额的行被丢掉,不印「尚差  120」", () => {
    const text = shortfallText([
      { name: "", amount: "120" },
      { name: "灵石", amount: "" },
      { name: "器灵尘", amount: "8" },
    ]);
    expect(text).toBe("尚差 器灵尘 8");
    expect(text).not.toContain("  ");
  });
});

describe("差额一句话 · 前缀", () => {
  it("先说是哪一样没成,再说差多少", () => {
    expect(blockedBy("灵石不足", [{ name: "灵石", amount: "320" }])).toBe(
      "灵石不足 —— 尚差 灵石 320",
    );
  });

  it("没有差额时只留前缀,不加一个空的破折号", () => {
    expect(blockedBy("此路不通", [])).toBe("此路不通");
    expect(blockedBy("此路不通", [])).not.toContain("——");
  });
});

describe("差额一句话 · 只拼句子", () => {
  it("模块不做减法、不 import 资源 store —— 差额由调用方从同一份代价算", () => {
    const src = readSource("src/ui/shortfallText.ts");
    expect(src, "不该 import 任何 store").not.toMatch(/from ["']@\/stores\//);
    expect(src, "不该 import 数值库 —— 它不做减法").not.toMatch(/from ["']@\/utils\/gnum/);
  });
});

describe("差额一句话 · 真接线", () => {
  it("洞府升级不再留一句走不到的死兜底", () => {
    // 去注释再查:清理时在原地留了一条解释性注释,它不该被当成"又长回来了"
    const src = readSource("src/core/buildingService.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src, "那条永远走不到的分支已清掉").not.toMatch(/notify\(\s*"灵石或玄铁不足"/);
  });

  it("四处资源拦截都换成了 blockedBy —— 文案不再只有「不足」两个字", () => {
    /*
     * 这几处都在**动作层**:按钮那一侧通常已置灰,故它们其实是第二层兜底。
     * 但兜底也不是白写的 —— 并发(同一帧里别处花掉了灵石)、离线结算、
     * 一键连强跑到料尽,都会真走到这里,而那时玩家唯一的信息就是这一句。
     * 故判据核的是"这四处都改用了带差额的拼法",不依赖能否在界面上点出来。
     */
    const sites: [string, RegExp][] = [
      ["src/core/forge.ts", /blockedBy\(\s*"强化不成"/],
      ["src/core/forge.ts", /blockedBy\(\s*"祭炼不成"/],
      ["src/core/reforge.ts", /blockedBy\(\s*"重铸不成"/],
      ["src/core/reforge.ts", /blockedBy\(\s*"封存不成"/],
      ["src/core/endgameService.ts", /blockedBy\(\s*"灵石不足"/],
    ];
    for (const [file, pattern] of sites) {
      const src = readSource(file);
      expect(src, `${file} 里这一处拦截要报差额`).toMatch(pattern);
    }
  });

  it("几处资源拦截都说得出差多少", () => {
    for (const file of ["src/core/forge.ts", "src/core/reforge.ts", "src/core/endgameService.ts"]) {
      const src = readSource(file);
      expect(src, `${file} 的资源拦截要报差额`).toContain("blockedBy(");
    }
  });
});
