/**
 * 触感 —— 第五个感官。
 *
 * ## 缺口:四个感官都分层了,手没感觉
 *
 * 品阶报喜在本作已经分了四层:
 *
 *   颜色与边框(`ui/qualityTier`)       灵/玄/地 一档、天仙 一档、神 一档
 *   全屏那道光(`ui/flashTier`)         1.1s / 1.35s / 1.6s
 *   管钟那一响(`ui/rareSfx`)            D5 / F5 / A5 + 低八度
 *   提示条那枚印(`ui/achievementSeal`)   色与单字取自品质表
 *
 * 而**手**什么都没收到。手机是拿在手里的设备 —— 拿到一件神品时,眼睛看到印、
 * 耳朵听到钟、手指却毫无知觉。这是五感里唯一空着的那一个。
 *
 * ## 档位不另立一份
 *
 * 三档的边界只存在于 `ui/rareSfx` 的 `rareSfxOf(rank)`(rank ≥ 8 神、≥ 6 天仙、
 * 其余灵玄地)。这里直接复用那个函数,不重写一遍 rank 比较 —— 两处各写一份,
 * 改档位那天就会有一处忘记,「声音说神品、手感到天品」正是本仓最忌的分家。
 *
 * ## 为什么型样用「段数 + 间隔」而不是一次长震
 *
 * 单次长震在任何设备上读起来都一样,分不出厚薄;而**点几下、点多久**能分出:
 * 灵品一下、天仙两下、神品三下且末一下最重。与声音那边「同一口钟敲在更高的地方」
 * 是同一个思路 —— 同一族反馈里的层级,不是三种不同的电子音。
 *
 * ## 各档都要短
 *
 * 震动持续超过 ~200ms 会在手掌里变成「嗡嗡」而不是「一记」。神品给到三段共
 * 约 120ms,已经够重;再长就成了打扰。
 */
import { rareSfxOf, type RareSfxTier } from "@/ui/rareSfx";

/** 触感档位 —— 与声音同一族,名字也照抄,免得两处各起一套叫法 */
export type HapticTier = RareSfxTier;

/**
 * 各档的震动型样(毫秒数组,`navigator.vibrate` 的语义:奇数位=震,偶数位=停)。
 *
 *   rare      一下 12ms
 *   rareHigh  两下 14 + 停 40 + 16ms
 *   rareTop   三下 16 + 停 35 + 18 + 停 30 + 30ms,末一下最重
 */
const PATTERNS: Record<HapticTier, readonly number[]> = {
  rare: [12],
  rareHigh: [14, 40, 16],
  rareTop: [16, 35, 18, 30, 30],
};

/** 这一档的震动型样 */
export function hapticPatternFor(tier: HapticTier): number[] {
  return [...(PATTERNS[tier] ?? PATTERNS.rare)];
}

/** 品质 rank → 档位。直接借声音那条界,不另写一份。 */
export function hapticTierOf(rank: number | undefined): HapticTier {
  return rareSfxOf(rank);
}

/**
 * 这台设备有没有触感 —— `navigator.vibrate` 在 iOS Safari 上不存在,
 * 桌面浏览器通常也没有。这不是错误,是这个设备没有这个感官。
 */
export function hapticsSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof (navigator as { vibrate?: unknown }).vibrate === "function"
  );
}

/**
 * 震一下。
 *
 * `enabled` 由调用方传入(设置里的 `hapticsOn` **且** 没开「减少动效」),
 * 这里不读 store —— 与 `ui/rareSfx`、`ui/flashTier` 同规:纯函数收参数,
 * 方便直接测,也免得一个纯反馈模块绑死到 Pinia 上。
 *
 * 不支持就静默降级:不抛错、不打日志 —— 玩家的设备没有这个感官,
 * 不是需要他知道的事。
 */
export function pulseHaptics(tier: HapticTier, opts: { enabled: boolean }): void {
  if (!opts.enabled) return;
  if (!hapticsSupported()) return;
  try {
    (navigator as { vibrate: (p: number[]) => boolean }).vibrate(hapticPatternFor(tier));
  } catch {
    // 有的浏览器在无用户手势时会抛 —— 反馈丢了不影响玩,静默跳过
  }
}
