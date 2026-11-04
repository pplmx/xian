/**
 * 收尾播报的「此行所得」—— 与面板上的「本次所得」读同一份账。
 *
 * ## 缺口:上一轮把尘接到了面板,却漏了结语
 *
 * 器灵尘(自动折算掉的那件装备换来的)上一轮已经进了会话账目
 * (`AdventureSession.dustGain`),面板的「本次所得」也报出来了。
 *
 * 但**收尾那条播报没跟上**。`core/exploration` 结束历练时那句:
 *
 *     此行太乙雷池历练圆满,胜 4 场 · 负 1 场,际遇 1 次;
 *     得灵石 120万、修为 340万、悟道点 12、拾获 3 件
 *
 * 报了灵石、修为、悟道点、拾获件数 —— 唯独没有尘。
 * 于是同一份账在"结束时"与"面板上"两处说法不同:
 * 玩家打完一趟看到面板写着 `器灵尘 +340`,结语里一个字都没有。
 *
 * ## 为什么抽成函数,而不是在 exploration 里拼字符串
 *
 * 拼字符串的写法没法测:`haul` 是模板字面量,判据只能靠正则去截一段文本,
 * 而那正是本仓反复说的「文案里手写数字,改常数就撒谎」。
 * 抽成纯函数后,判据直接喂一份账、断言读出的话 —— 与 `sessionRecordText` 同构。
 *
 * ## 报什么、不报什么
 *
 * 与既有那几项同一条口径:**只有真发生了才报**。0 尘不写「器灵尘 0」,
 * 正如 `wudaoGain` 为 0 时不写悟道点 —— 一趟什么都没折算,那句话就是噪音。
 */
import { describe, expect, it } from "vite-plus/test";
import { sessionHaulText } from "./adventureText";

const base = {
  stone: "120万",
  exp: "340万",
  wudaoGain: 0,
  itemGain: 0,
  dustGain: 0,
};

describe("此行所得 · 尘也要报", () => {
  it("折算过装备 → 结语里说得出尘", () => {
    const text = sessionHaulText({ ...base, dustGain: 340 });
    expect(text).toContain("器灵尘");
    expect(text).toContain("340");
  });

  it("没折算 → 一个字都不提尘(与悟道点同一条口径)", () => {
    const text = sessionHaulText({ ...base, wudaoGain: 0, dustGain: 0 });
    expect(text).not.toContain("器灵尘");
    expect(text).not.toContain("悟道点");
  });

  it("灵石与修为每趟都报 —— 这两个是必给的", () => {
    const text = sessionHaulText(base);
    expect(text).toContain("灵石");
    expect(text).toContain("修为");
  });

  it("拾获 0 件不报「拾获 0 件」", () => {
    expect(sessionHaulText({ ...base, itemGain: 0 })).not.toContain("拾获");
  });

  it("四样都发生时,四样都在,顺序稳定可读", () => {
    const text = sessionHaulText({ ...base, wudaoGain: 12, itemGain: 3, dustGain: 340 });
    for (const part of ["灵石", "修为", "悟道点", "拾获", "器灵尘"]) {
      expect(text, `缺了「${part}」`).toContain(part);
    }
    // 顺序:灵石 → 修为 → 悟道点 → 拾获 → 器灵尘(由"每趟都给"到"偶发")
    const order = ["灵石", "修为", "悟道点", "拾获", "器灵尘"].map((p) => text.indexOf(p));
    expect(order, `顺序漂了:${text}`).toEqual([...order].sort((a, b) => a - b));
  });
});

describe("此行所得 · 坏值不撒谎", () => {
  it("NaN / 负数一律当 0,不印出「NaN」或「-5」", () => {
    for (const bad of [Number.NaN, -5, Number.POSITIVE_INFINITY]) {
      const text = sessionHaulText({
        ...base,
        wudaoGain: bad,
        itemGain: bad,
        dustGain: bad,
      });
      expect(text).not.toMatch(/NaN|Infinity|-\d/);
    }
  });
});

describe("此行所得 · 只是文案", () => {
  it("不 import store / core / DOM —— 与 sessionRecordText 同一条纪律", async () => {
    const { readSource } = await import("@/test/readSource");
    const src = readSource("src/ui/adventureText.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/from ["']@\/stores\//);
    expect(src).not.toMatch(/from ["']@\/core\//);
  });

  it("真接线:收尾播报改用它,不再自己拼一份", async () => {
    const { readSource } = await import("@/test/readSource");
    const src = readSource("src/core/exploration.ts");
    expect(src, "收尾要读同一份口径").toContain("sessionHaulText(");
    // 旧写法:手拼 haul 的模板字面量
    expect(src).not.toMatch(/const haul = `得灵石/);
  });
});
