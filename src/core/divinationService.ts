/**
 * 问卦的动作层 —— 扣悟道点、落卦象状态。
 *
 * 与 core/divination(纯函数)分开:那边只算卦,这边才碰存档与资源,
 * 免得 stores/player 为了取卦力反手 import 一个又会 import 自己的模块。
 */
import type { RandomService } from "@/utils/random";
import { rng } from "@/utils/random";
import { DIVINATION_COST, drawHexagram, readingMinutes, type HexagramReading } from "./divination";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";

export interface DivinationOutcome {
  ok: boolean;
  /** 未成卦的原因(已成卦则 undefined) */
  reason?: string;
  reading?: HexagramReading;
}

/**
 * 已有卦在身时不再受卦(一事不二卜),等它自己过去。
 * 卦是"此一时的时机":故有代价、有时限、不叠加。
 */
export function askDivination(rand: RandomService = rng): DivinationOutcome {
  const player = usePlayerStore();
  const resources = useResourcesStore();
  if (player.activeDivination) return { ok: false, reason: "卦在身,一事不二卜 —— 待此卦自过。" };
  if (!resources.hasSmall("wudao", DIVINATION_COST)) {
    return { ok: false, reason: `悟道点不足(需 ${DIVINATION_COST} 点)。` };
  }
  /*
   * 先摇出卦，再扣费。
   *
   * 反过来写过一版：先 `spendSmall` 再 `drawHexagram`。`drawHexagram` 里有一条
   * 「六爻未成卦」的断言（`readingOfLines` 返回 null 时抛），今天不可达
   * （`castLines` 必然给 6 个 0/1），但它是断言不是保证 —— 一旦哪天 `castLines`
   * 改了或表变了，那一抛就发生在扣费之后:玩家少了悟道点，没拿到卦，页面还白屏。
   *
   * 换过来的代价是零（两行顺序），而「先扣钱、后办事」这类顺序问题在别处也一样危险。
   */
  const reading = drawHexagram(rand);
  resources.spendSmall("wudao", DIVINATION_COST);
  const now = Date.now();
  player.setDivination({
    hexagram: reading.hexagram.name,
    upper: reading.upper.id,
    lower: reading.lower.id,
    changed: reading.changed?.name ?? null,
    changing: reading.changing,
    changingAt: reading.changingAt,
    lines: reading.lines,
    castAt: now,
    expiresAt: now + readingMinutes(reading) * 60_000,
  });
  return { ok: true, reading };
}
