/**
 * 前期节奏遥测 —— 互动密度的算法与「防扰民红线」。
 *
 * ## 为什么补这一份
 *
 * `stores/pacingTelemetry` 是 18 个 store 里**唯一一个被 0 个 spec 引用**的
 * (其余都有同名 spec 或几十处间接引用)。而它算的不是装饰性数字:
 *
 * - `p90` 间隔 < 30s 视为「事件过密,弹窗会互相抢注意力」;
 * - `burstCount > 6 次/30 分钟` 视为「连弹风暴」。
 *
 * 两条都是**告警线**。算错不会崩、不会红、界面上也看不出异常 ——
 * 只是告警永远不响,或者响得不是时候。这类「静默算错」正是最该有判据的地方。
 *
 * ## 本轮修掉的两个缺陷
 *
 * 注释一直写着 `burstCount` = 「60 秒内连续出现 ≥2 个**需要处理**事件的**簇数**」,
 * 而实现统计的是**相邻间距 < 60s 的对数**,且把 `ambient` 也算了进去:
 *
 * ```text
 * 5 个连发 modal   → 报 4(应为 1 簇)
 * 4 个纯 ambient   → 报 3(应为 0 —— ambient 是无感知的后台事件)
 * ```
 *
 * `ambient` 是素材自动收集、生产这类**不抢注意力**的事件,计进「连弹风暴」
 * 只会让红线提前触发,把真正的风暴淹掉。
 */
import { describe, expect, it, beforeEach } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { usePacingTelemetry, type InteractionKind } from "@/stores/pacingTelemetry";

/** 在「现在」往前 `ageMinutes` 分钟起,生成 `n` 个间隔 `gapMs` 的事件 */
const series = (
  n: number,
  gapMs: number,
  ageMinutes: number,
  kind: InteractionKind = "modal",
): { type: string; kind: InteractionKind; label: string; at: number }[] => {
  const base = Date.now() - ageMinutes * 60 * 1000;
  return Array.from({ length: n }, (_, i) => ({
    type: "t",
    kind,
    label: "自检",
    at: base + i * gapMs,
  }));
};

describe("节奏遥测 · 连弹簇的口径", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("5 个连发算 1 簇,不是 4 —— burstCount 数的是簇不是「对数」", () => {
    /*
     * 缺陷本体。改前实现是 `gap < 60s ? count + 1 : count`,于是 n 个连发报 n-1,
     * 而它自己的注释写的是「簇数」。
     */
    const s = usePacingTelemetry();
    s.enabled = true;
    s.clear();
    s.$patch({ events: series(5, 10_000, 5) });
    const r = s.buildReport()!;
    expect(r.total, "5 个事件都在 30 分钟内").toBe(5);
    expect(r.burstCount, "5 个连发该算 1 簇").toBe(1);
    expect(r.maxConsecutive, "最长连续段该是 5").toBe(5);
  });

  it("两簇分别计数:3 个连发 + 隔 5 分钟再 2 个连发 = 2 簇", () => {
    const s = usePacingTelemetry();
    s.enabled = true;
    s.clear();
    const first = series(3, 10_000, 12);
    const second = series(2, 10_000, 7);
    s.$patch({ events: [...first, ...second] });
    const r = s.buildReport()!;
    expect(r.burstCount, "两段各成一簇").toBe(2);
    expect(r.maxConsecutive, "最长那一段是 3").toBe(3);
  });

  it("分开的事件不算簇,但 maxConsecutive 仍是 1", () => {
    /*
     * 单发事件没有「簇」,但「最大连续弹窗次数」按语义应当是 1(它确实弹了一次)。
     * 两个量别混:一个是簇数,一个是簇内最长长度。
     */
    const s = usePacingTelemetry();
    s.enabled = true;
    s.clear();
    s.$patch({ events: series(3, 180_000, 15) });
    const r = s.buildReport()!;
    expect(r.burstCount, "每 3 分钟一个,不构成簇").toBe(0);
    expect(r.maxConsecutive, "没有连发时最长连续是 1").toBe(1);
  });

  it("ambient 不许计入连弹簇 —— 它不抢注意力", () => {
    /*
     * `ambient` 是素材自动收集、生产这类后台事件。改前它和 modal 一样被计入,
     * 于是「后台在跑」会被报成「连弹风暴」,把真正的风暴淹掉。
     */
    const s = usePacingTelemetry();
    s.enabled = true;
    s.clear();
    s.$patch({ events: series(4, 10_000, 5, "ambient") });
    const r = s.buildReport()!;
    expect(r.burstCount, "纯 ambient 连发不该算簇").toBe(0);
    expect(r.maxConsecutive, "纯 ambient 没有「连续弹窗」").toBe(0);
    // 但它仍要出现在总量与分类里 —— 不计入簇不等于不统计
    expect(r.total, "ambient 仍要计入总量").toBe(4);
    expect(r.byKind.ambient, "ambient 仍要按类计数").toBe(4);
  });

  it("notify 算「需要处理」吗 —— 与 ambient 区别对待", () => {
    /*
     * 注释把三类分开写:modal 是「需要玩家立即处理」,notify 是「提示型,
     * 不需要立即处理」,ambient 是「无感知」。而「连弹风暴」说的是**需要处理**的事件。
     *
     * 这里守当前口径:notify 计入(它仍会占用一次阅读),ambient 不计入。
     * 若将来口径要改成「只算 modal」,这条判据会红,提醒改的人一并改注释。
     */
    const s = usePacingTelemetry();
    s.enabled = true;
    s.clear();
    s.$patch({ events: series(3, 10_000, 5, "notify") });
    const r = s.buildReport()!;
    expect(r.burstCount, "notify 连发该算一簇(它仍占用阅读)").toBe(1);
  });
});

describe("节奏遥测 · 间隔分位数与告警线", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("事件不足 3 个时不给报告 —— 两个点算不出分布", () => {
    const s = usePacingTelemetry();
    s.enabled = true;
    s.clear();
    s.$patch({ events: series(2, 10_000, 5) });
    expect(s.buildReport(), "两个事件就报密度,是编数字").toBeNull();
  });

  it("30 分钟外的事件不进报告", () => {
    const s = usePacingTelemetry();
    s.enabled = true;
    s.clear();
    // 3 个很旧的 + 3 个新的
    const old = series(3, 10_000, 90);
    const fresh = series(3, 10_000, 5);
    s.$patch({ events: [...old, ...fresh] });
    const r = s.buildReport()!;
    expect(r.total, "只有 30 分钟内的算数").toBe(3);
  });

  it("连发时 p90 应当很小 —— 那正是「事件过密」的信号", () => {
    /*
     * `p90 < 30s` 是注释里写明的告警线。这条不核「阈值有没有被读」,
     * 而是核**算出来的 p90 确实反映密度**:5 个每 10 秒一个,间隔全是 10s。
     */
    const s = usePacingTelemetry();
    s.enabled = true;
    s.clear();
    s.$patch({ events: series(6, 10_000, 5) });
    const r = s.buildReport()!;
    expect(r.avgInterval, "平均间隔该是 10 秒").toBe(10_000);
    expect(r.minInterval, "最短间隔该是 10 秒").toBe(10_000);
    expect(r.p90, "间隔全相同时 p90 也是 10 秒").toBe(10_000);
    expect(r.p90, "10 秒 < 30 秒告警线 —— 这一个样本应当触发「过密」").toBeLessThan(30_000);
  });

  it("关掉开关时不记录 —— 遥测不该在玩家不知情时一直攒", () => {
    const s = usePacingTelemetry();
    s.enabled = false;
    s.clear();
    s.record("t", "modal", "自检");
    expect(s.events.length, "开关关着却还在记录").toBe(0);
  });

  it("队列只留最近 120 条 —— 遥测不该无限长", () => {
    const s = usePacingTelemetry();
    s.enabled = true;
    s.clear();
    for (let i = 0; i < 200; i += 1) s.record("t", "modal", `第${i}次`);
    expect(s.events.length, "队列没有上限 —— 存档会被遥测撑大").toBeLessThanOrEqual(120);
  });
});

describe("节奏遥测 · 坏档不许崩", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("坏项被剔除,好的留下", () => {
    const s = usePacingTelemetry();
    s.$patch({
      events: [
        null,
        { type: "t", kind: "modal", label: "好", at: Date.now() },
        { kind: "bad" },
      ] as never,
    });
    expect(() => s.sanitize(), "sanitize 自己崩了").not.toThrow();
    expect(s.events.length, "坏项没被剔干净").toBe(1);
    expect(s.events[0]!.label).toBe("好");
  });

  it("整份 events 被写坏成非数组时收成空数组", () => {
    const s = usePacingTelemetry();
    s.$patch({ events: "坏了" as never });
    expect(() => s.sanitize()).not.toThrow();
    expect(Array.isArray(s.events)).toBe(true);
    expect(s.events.length).toBe(0);
  });

  it("坏档之后 record 仍能用 —— 它直接 slice 数组", () => {
    /*
     * `record()` 里是 `events.value.slice(-119)`,数组被写成非数组时会抛错。
     * sanitize 之后必须恢复正常。
     */
    const s = usePacingTelemetry();
    s.enabled = true;
    s.$patch({ events: null as never });
    s.sanitize();
    expect(() => s.record("t", "modal", "自检")).not.toThrow();
    expect(s.events.length).toBe(1);
  });
});
