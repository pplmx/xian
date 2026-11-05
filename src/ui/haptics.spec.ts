/**
 * 触感 —— 第五个感官,此前一个都没有。
 *
 * ## 缺口:四个感官都分层了,手没感觉
 *
 * 品阶报喜在本作已经分了四层:
 *
 *   颜色与边框(`ui/qualityTier`)   灵/玄/地 一档、天仙 一档、神 一档
 *   全屏那道光(`ui/flashTier`)     1.1s / 1.35s / 1.6s
 *   管钟那一响(`ui/rareSfx`)        D5 / F5 / A5 + 低八度
 *   提示条那枚印(`ui/achievementSeal`) 色与单字取自品质表
 *
 * 而**手**什么都没收到。手机是拿在手里的设备 —— 拿到一件神品时,眼睛看到印、
 * 耳朵听到钟、手指却毫无知觉。这是五感里唯一空着的那一个。
 *
 * ## 为什么单独一个开关,不挂到音效上
 *
 * 想关掉声音的人未必想关震动(深夜戴耳机),想关震动的人未必想关声音
 * (手机放桌上)。两件事绑在一个开关上,玩家就只能在两者之间二选一。
 * 故 `hapticsOn` 与 `sfxOn` 各自独立,默认都为开。
 *
 * ## 为什么也要尊重「减少动效」
 *
 * `reduceMotion` 的语义是「别给我动的东西」。震动比动画更直接作用在身体上,
 * 关掉动效的人几乎不会想要它。故两个开关任一关掉,都不震。
 *
 * ## 不支持就静默降级
 *
 * `navigator.vibrate` 在 iOS Safari 上不存在、在桌面浏览器上通常也没有。
 * 这不是错误,是「这个设备没有这个感官」—— 静默跳过,不抛错、不报警。
 */
import { describe, expect, it } from "vite-plus/test";
import { rareSfxOf } from "@/ui/rareSfx";
import {
  hapticPatternFor,
  hapticsSupported,
  hapticTierOf,
  pulseHaptics,
  type HapticTier,
} from "@/ui/haptics";

describe("触感 · 品阶分层", () => {
  it("三档与声音/光同一条界:rank 小于 6 / 6 到 7 / 8", () => {
    // 与 ui/rareSfx 的 tierOfQualityRank 同界,这里只锁「档位名 → 震动型样」
    const tiers: HapticTier[] = ["rare", "rareHigh", "rareTop"];
    for (const t of tiers) {
      const pattern = hapticPatternFor(t);
      expect(pattern.length, `${t} 该有一段型样`).toBeGreaterThan(0);
      for (const ms of pattern) {
        expect(Number.isFinite(ms), `${t} 的时长要有限`).toBe(true);
        // 写成「必须是正数」而不是「大于等于 0」—— 后者连 0 都放行,而 0 段
        // 在 vibrate 的型样里等于占位不发,档位就白分了
        expect(ms, `${t} 的每一段都该真的震/真的停`).toBeGreaterThan(0);
      }
    }
  });

  it("档位越高,总震动时长不更短 —— 与光/声同一条『越重越长』", () => {
    const total = (t: HapticTier): number => hapticPatternFor(t).reduce((a, b) => a + b, 0);
    expect(total("rareHigh")).toBeGreaterThanOrEqual(total("rare"));
    expect(total("rareTop")).toBeGreaterThanOrEqual(total("rareHigh"));
  });

  it("神品有独有的型样 —— 不能与灵品同一段", () => {
    expect(hapticPatternFor("rareTop")).not.toEqual(hapticPatternFor("rare"));
  });
});

describe("触感 · 与声音同一条界,不许各写一份", () => {
  it("hapticTierOf 对整段 rank 的答案与 rareSfxOf 逐位相同", () => {
    // 两处若各写一份 rank 比较,改档位那天就会有一处分叉 ——
    // 「声音说神品、手感到天品」正是本仓最忌的分家
    for (let rank = -1; rank <= 12; rank += 1) {
      expect(hapticTierOf(rank), `rank ${rank} 处两处分叉了`).toBe(rareSfxOf(rank));
    }
  });

  it("坏档(undefined / NaN / Infinity)落到最低那档,不炸", () => {
    for (const bad of [undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => hapticTierOf(bad)).not.toThrow();
    }
    expect(hapticTierOf(Number.POSITIVE_INFINITY)).toBe(rareSfxOf(Number.POSITIVE_INFINITY));
  });
});

describe("触感 · 设备能力与开关", () => {
  it("不支持 vibrate 时静默降级,不抛错", () => {
    // 测试环境(Node/jsdom)默认没有 navigator.vibrate
    const before = hapticsSupported();
    expect(typeof before).toBe("boolean");
    // 无论支持与否,调用都不该抛
    expect(() => pulseHaptics("rareTop", { enabled: true })).not.toThrow();
  });

  it("开关关掉就不震", () => {
    // 用一个替身记录调用次数
    const calls: number[][] = [];
    const original = (globalThis as { navigator?: { vibrate?: (p: number[]) => boolean } })
      .navigator;
    const fake = { vibrate: (p: number[]) => (calls.push(p), true) };
    Object.defineProperty(globalThis, "navigator", { value: fake, configurable: true });
    try {
      pulseHaptics("rareTop", { enabled: false });
      expect(calls.length, "关掉开关后不该震").toBe(0);
      pulseHaptics("rareTop", { enabled: true });
      expect(calls.length, "开着开关该震一次").toBe(1);
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        value: original,
        configurable: true,
      });
    }
  });
});
