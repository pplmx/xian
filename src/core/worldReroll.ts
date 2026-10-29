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
 * ## 口径:定价按余额走,而不是一个固定数
 *
 * 第一版钉死 15 枚,当场就踩了 fruitOutlets 论证过的那条:固定定价 + 无上限余额,
 * 出口迟早变成随手可点的按钮(第 20 世手里几千枚道果时,15 枚什么都算不上)。
 * 「抬价只能延后,不能解决」—— 所以这里定价**跟着余额走**:一成半,最少 15 枚。
 *
 *   - 余额 100 → 15 枚(取地板);余额 1000 → 150 枚。攒得越多,换一次越贵。
 *   - 连换多次是等比衰减(每次只剩 85%),永远不会变成免费按钮。
 *   - **先掷后扣**:生成器有 200 次上限,掷不出新世界时一分不扣。
 *   - 扣款只走 player.spendDaoFruit —— 与逆旅契同一条出口,余额真的下降。
 */

/** 起步价:首世一轮金丹道果的零头,不至于开局就换得起 */
export const WORLD_REROLL_FLOOR = 15;
/** 按余额抽成 —— 一成半:攒得越多换一次越贵,出口永远不是免费按钮 */
export const WORLD_REROLL_RATE = 0.15;

/**
 * 这一次换世界要几枚道果(纯函数,给界面与结算共用)。
 *
 * 脏值(坏档里的 NaN / Infinity)一律落回起步价 —— 价格本身不能变成 NaN,
 * 否则 `余额 < 价` 与 `余额 - 价` 都会跟着失效。真正的拒绝在 rerollWorldByFruit 里。
 */
export function worldRerollCost(daoFruit: number): number {
  if (!Number.isFinite(daoFruit)) return WORLD_REROLL_FLOOR;
  return Math.max(WORLD_REROLL_FLOOR, Math.floor(Math.max(0, daoFruit) * WORLD_REROLL_RATE));
}

export interface WorldRerollQuote {
  cost: number;
  /** 还差多少枚;付得起时为 0 */
  shortfall: number;
  /** 为什么不能换;null 表示可以换 */
  blockedBy: "busy" | "poor" | null;
}

/**
 * 换界按钮与结算共用的门槛报价。
 *
 * 界面此前自己拼「余额够不够 + 是否历练中」,于是同时缺钱又历练中时会报
 * 「尚差 N 枚」,把更硬的拦截原因藏掉。这里一次给出价钱、短差与主拦截,
 * 界面负责把两个原因都念出来,结算按同一个 blockedBy 拒绝。
 */
export function worldRerollQuote(daoFruit: number, sessionActive: boolean): WorldRerollQuote {
  const cost = worldRerollCost(daoFruit);
  if (!Number.isFinite(daoFruit)) return { cost, shortfall: cost, blockedBy: "poor" };
  const shortfall = Math.max(0, cost - daoFruit);
  if (sessionActive) return { cost, shortfall, blockedBy: "busy" };
  if (shortfall > 0) return { cost, shortfall, blockedBy: "poor" };
  return { cost, shortfall: 0, blockedBy: null };
}

export type WorldRerollResult =
  /** 掷到新世界,道果已扣 */
  | "ok"
  /** 正在历练:换天地会把这一趟的路断掉 —— 先走完再来 */
  | "busy"
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
  /** 是否有一趟历练在途中(setMortalWorld 会清空本世路线进度,途中换界等于把路抽走) */
  sessionActive: boolean;
}

/**
 * 花道果换一方天地。
 *
 * 顺序是「先掷、再扣」:掷不出来就什么都不发生,不会出现「扣了钱没换到东西」。
 */
export function rerollWorldByFruit(deps: RerollDeps): WorldRerollResult {
  // 余额与历练闸走同一份报价:界面报什么原因,结算就拒什么原因
  const quote = worldRerollQuote(deps.daoFruit, deps.sessionActive);
  if (quote.blockedBy) return quote.blockedBy;
  /*
   * 上面已挡住历练途中换界:setMortalWorld 会清空路线,而这一趟还没结算。
   * 与「掷不出就不扣」同一个口径:不制造说不清的损失。
   */
  const next = deps.reroll();
  if (!next) return "unavailable";
  return deps.spendFruit(quote.cost) ? "ok" : "poor";
}
