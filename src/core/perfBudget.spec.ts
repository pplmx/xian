/**
 * 运行时帧预算判定 —— 判据的**判据**。
 *
 * 这一份专治一类退化:判定写在脚本里、只能靠正则扫文本验。实测踩过两次 ——
 * 前面加 `false && ` 让条件恒假、把 `failures.push(...)` 换成一行注释,
 * 两次旧判据都照样绿。抽成纯函数之后,「哪种读数该红」直接由用例回答。
 */
import { describe, expect, it } from "vite-plus/test";
import { judgePerf, type PerfBudget, type FrameStats } from "./perfBudget";

const BUDGET: PerfBudget = {
  maxFrameMs: 100,
  longFramesMax: 2,
  interactiveMaxFrameMs: 300,
  scrollMaxFrameMs: 50,
};

const frame = (max: number, over50ms = 0, frames = 180): FrameStats => ({
  frames,
  max,
  p95: max,
  median: 17,
  over50ms,
});

const reading = (patch: Partial<Parameters<typeof judgePerf>[0]> = {}) => ({
  name: "inventory",
  max: 17,
  over50ms: 0,
  interactive: null as FrameStats | null,
  ...patch,
});

describe("运行时帧预算 · 判定", () => {
  it("静置段正常时不报", () => {
    expect(judgePerf(reading(), BUDGET)).toEqual([]);
  });

  it("静置段最差帧超预算要报", () => {
    const out = judgePerf(reading({ max: 140 }), BUDGET);
    expect(out.length).toBe(1);
    expect(out[0]).toContain("最差帧 140ms");
  });

  it("静置段长帧超预算要报", () => {
    const out = judgePerf(reading({ over50ms: 5 }), BUDGET);
    expect(out.length).toBe(1);
    expect(out[0]).toContain("长帧");
  });

  it("崩溃短路其余判定 —— 一个崩溃的页面不该再报十条帧率", () => {
    const out = judgePerf(reading({ crashed: "RENDERER_CRASH", max: 999 }), BUDGET);
    expect(out).toEqual(["inventory: 崩溃 (RENDERER_CRASH)"]);
  });

  it("页面异常短路其余判定", () => {
    const out = judgePerf(reading({ errors: ["TypeError: x"], max: 999 }), BUDGET);
    expect(out).toEqual(["inventory: 页面异常 (TypeError: x)"]);
  });

  it("gate=false 时只报崩溃与异常 —— 非参与视图不该因帧率被拦", () => {
    expect(judgePerf(reading({ max: 999 }), BUDGET, false)).toEqual([]);
    expect(judgePerf(reading({ crashed: "X" }), BUDGET, false)).not.toEqual([]);
  });
});

/**
 * 交互段 —— 本轮补上的那一段。
 *
 * 从前采样器在交互开始前就停了,于是「翻批/开弹窗卡不卡」从来没被量过。
 * 补上之后当场量出背包页 100~267ms 的交互长帧,其余视图 ≤34ms。
 */
describe("运行时帧预算 · 交互段", () => {
  it("交互段超预算要报", () => {
    const out = judgePerf(reading({ interactive: frame(400) }), BUDGET);
    expect(out.length).toBe(1);
    expect(out[0]).toContain("交互段最差帧 400ms");
  });

  it("交互段在预算内不报 —— 实测背包页 267ms 必须过", () => {
    expect(judgePerf(reading({ interactive: frame(267, 8) }), BUDGET)).toEqual([]);
  });

  it("没有交互流程的视图不参与判定 —— 0 帧是「没量」不是「很快」", () => {
    // 两种写法都得放过:null 与 frames=0。但**不是因为它们快**,是因为没量到。
    expect(judgePerf(reading({ interactive: null }), BUDGET)).toEqual([]);
    expect(judgePerf(reading({ interactive: frame(0, 0, 0) }), BUDGET)).toEqual([]);
  });

  it("交互段与静置段各有各的预算 —— 不许拿静置那条去判交互", () => {
    /*
     * 这条是分开判的**理由**:同样 267ms,按静置判是红的(>100),按交互判是绿的(≤300)。
     * 若有人把交互段并回静置那条,背包页会天天红 —— 于是只能放宽静置预算,
     * 而静置那条守的正是「页面自己不动时别卡」。
     */
    expect(judgePerf(reading({ max: 267 }), BUDGET).length).toBe(1);
    expect(judgePerf(reading({ interactive: frame(267) }), BUDGET).length).toBe(0);
  });
});

/**
 * 滚动段 —— 与交互段分开的那一段。
 *
 * 为什么单独一段:交互段里有批量展开与开弹窗(实测背包页 100~267ms),滚动的成本
 * 比它小一个量级,混在一起永远被掩盖。而「长页面滚起来卡不卡」测的是合成与滚动
 * 容器,与「翻批重渲染卡不卡」是两件事 —— 分开才看得出是哪件坏。
 *
 * 实测基线:六个长页(可滚 231~1093px)来回滚 16 次全部 17ms / 零长帧;
 * 扩到全部 17 个视图仍是 80 帧 / 17ms / 零长帧。
 */
describe("运行时帧预算 · 滚动段", () => {
  it("滚动段超预算要报", () => {
    const out = judgePerf(reading({ scroll: frame(120) }), BUDGET);
    expect(out.length).toBe(1);
    expect(out[0]).toContain("滚动段最差帧 120ms");
  });

  it("滚动段实测值(17ms)当然过", () => {
    expect(judgePerf(reading({ scroll: frame(17) }), BUDGET)).toEqual([]);
  });

  it("页面不够长(没滚)不参与判定 —— 0 帧是「没量」不是「很快」", () => {
    expect(judgePerf(reading({ scroll: null }), BUDGET)).toEqual([]);
    expect(judgePerf(reading({ scroll: frame(0, 0, 0) }), BUDGET)).toEqual([]);
  });

  it("滚动段与交互段各有各的预算 —— 不许合并成一档", () => {
    /*
     * 同样 100ms:按滚动判是红的(>50),按交互判是绿的(≤300)。
     * 若有人把滚动并回交互那条,滚动掉的帧会被 300ms 的门放过去。
     */
    expect(judgePerf(reading({ scroll: frame(100) }), BUDGET).length).toBe(1);
    expect(judgePerf(reading({ interactive: frame(100) }), BUDGET).length).toBe(0);
  });
});

describe("运行时帧预算 · 深清单 DOM", () => {
  it("超限要报,并指名是哪一册", () => {
    const out = judgePerf(
      reading({ peakDom: [{ label: "法宝全册峰值", nodes: 1200, limit: 1100 }] }),
      BUDGET,
    );
    expect(out).toEqual(["inventory: 法宝全册峰值 DOM 1200 > 1100"]);
  });

  it("恰好等于上限不算超", () => {
    expect(
      judgePerf(reading({ peakDom: [{ label: "x", nodes: 1100, limit: 1100 }] }), BUDGET),
    ).toEqual([]);
  });

  it("多条深清单各自判定", () => {
    const out = judgePerf(
      reading({
        peakDom: [
          { label: "A", nodes: 9, limit: 1 },
          { label: "B", nodes: 2, limit: 1 },
          { label: "C", nodes: 1, limit: 1 },
        ],
      }),
      BUDGET,
    );
    expect(out.length).toBe(2);
  });
});
