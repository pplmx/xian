/**
 * 换一方天地 —— 道果的第二个出口。
 *
 * ## 为什么是「换世界」而不是加战力
 *
 * core/fruitOutlets.spec.ts 把这件事的条件写在判据里了:道果必须**真的被花掉**
 * (余额无上限而定价固定,只进不出的出口终会被淹没),而出口的发放物**不得属于
 * StatMods 命名空间,也不得是可兑换成它的资源** —— 否则「道果 → 战力 → 更快凝道果」
 * 那条回路又接回去了。
 *
 * 于是出口选「选择权」而不是「力量」:重掷本世之界。玩家拿到的是**另一条路线、
 * 另一处所钟、另一套地貌构成**,不是更高的数。
 *
 * ## 口径
 *
 *   - 定价固定 15 枚:大约是首世一轮金丹的量级的零头,又明显高于单次转世收益,
 *     不至于每世随手重掷到满意为止。
 *   - **先掷后扣**:生成器有 200 次上限,掷不出新世界时一分不扣。
 *   - 扣款只走 player.spendDaoFruit —— 与逆旅契同一条出口,余额真的下降。
 */

/** 重掷一次要几枚道果 */
export const WORLD_REROLL_FRUIT = 15;

export type WorldRerollResult =
  /** 掷到新世界,道果已扣 */
  | "ok"
  /** 道果不够 —— 一个字节也没动 */
  | "poor"
  /** 这一世还没有世界,或生成器掷不出新世界 —— 一个字节也没动 */
  | "unavailable";

/** 出口需要的那三件事 —— 由调用方给,core 不碰 store(见 layeringAudit 的基线) */
export interface RerollDeps {
  /** 当前道果余额 */
  daoFruit: number;
  /** 扣款:成功返回 true(与 player.spendDaoFruit 同形) */
  spendFruit: (n: number) => boolean;
  /** 重掷本世之界:掷不出返回 null(具体世界类型由调用方的服务决定) */
  reroll: () => object | null;
}

/**
 * 花道果换一方天地。
 *
 * 顺序是「先掷、再扣」:掷不出来就什么都不发生,不会出现「扣了钱没换到东西」。
 */
export function rerollWorldByFruit(deps: RerollDeps): WorldRerollResult {
  if (deps.daoFruit < WORLD_REROLL_FRUIT) return "poor";
  const next = deps.reroll();
  if (!next) return "unavailable";
  return deps.spendFruit(WORLD_REROLL_FRUIT) ? "ok" : "poor";
}
