/**
 * 此刻最该做的一件事 —— 跨页那一句话。
 *
 * ## 问题:引导只活在修行页
 *
 * 修行页卷首有一个「当前阶段」(见 core/cultivationStage):关隘已开 / 修为已满 /
 * 带伤行功 / 闭关 / 普通吐纳。但那**只讲突破这一件事**,而且只在修行页。
 *
 * 玩家点开洞府、法宝、灵兽、际遇,卷首各自只报本页的账 —— 没有一处回答
 * 「我现在该去做什么」。放置游戏里这恰恰是最贵的一句话:玩家回来时常常忘了
 * 上次打算干嘛,而界面上全是数字,没有一句「先做这个」。
 *
 * ## 这一句为什么只能是"一件事"
 *
 * 列三条建议等于没建议 —— 玩家还是要自己排优先级。故这里按**卡住了什么**
 * 排序,只吐一条。排在前面的是「不做就推进不了」,排在后面的是「做了更好」。
 *
 * ## 为什么是纯函数
 *
 * 建议的排序规则一旦掺进 store,就没法直接测「修为满了且条件齐时,挑的是破境
 * 而不是去洞府收菜」这类判断。故这里只收一份离散状态,不 import 任何 store。
 *
 * ## 不与修行页那句重复
 *
 * `cultivationStage` 说的是「本境修为到了哪一步」,这里说的是「整个道途下一步去哪」。
 * 两者可以同时出现在不同页:修行页那句在卷首正文,这一句在眉批位置,
 * 且当两者讲的是同一件事(破境)时,这里**不说**(见 `suppress` 的注释)。
 */

/** 那一句话指向的去处 —— 路由名与动作名分开,便于两处各自演进 */
export type NextStepRoute =
  | "cultivation"
  | "adventure"
  | "dongfu"
  | "inventory"
  | "titles"
  | "legacy"
  | "collection"
  | "souls";

export interface NextStep {
  /** 稳定标识,便于判据与埋点 */
  id: string;
  /** 一句话,不超过一行 */
  text: string;
  /** 该去哪一页 */
  route: NextStepRoute;
}

/** 推导这一句要用的离散状态 —— 与 store 的形状解耦,由调用方映射 */
export interface NextStepInput {
  /** 当下大境界 */
  major: number;
  /** 修为是否已到本境尽头 */
  expFull: boolean;
  /** 破境条件是否齐全 */
  breakthroughReady: boolean;
  /** 破境未齐时的缺口(一句人话,来自既有 reason) */
  breakthroughReason: string;
  /** 是否正在历练中(有未了结的这一程) */
  exploring: boolean;
  /** 有没有待处理的际遇(挂着的抉择) */
  pendingEvent: boolean;
  /** 洞府里有没有买得起的升级(可收的账) */
  dongfuAffordable: boolean;
  /** 行囊里有没有可装备的更好之物 */
  betterEquipAvailable: boolean;
  /** 法宝位有空且手里有法宝没上阵 */
  artifactSeatOpen: boolean;
  /** 有没有未领的成就/任务赏 */
  rewardReady: boolean;
  /** 已到终局(此生道途已定) */
  endgameReached: boolean;
}

/**
 * 按「卡住了什么」排序,只吐一条。
 *
 * 顺序的意思:
 *   1. 挂着的际遇 —— 它挡着历练往前走,不做完连挂机都白挂
 *   2. 正在历练 —— 这一程没了结,别的都排在它后面
 *   3. 破境条件齐 —— 这是当前境界唯一的前进方向
 *   4. 终点已至 —— 该考虑转世,而不是继续攒
 *   5. 未领的赏 —— 已经到手的东西不领等于没收
 *   6. 可收的洞府账 —— 稳赚的那一笔
 *   7. 法宝空位 —— 手里有货没上阵,等于白拿
 *   8. 更好的装备 —— 有就用
 *   9. 修为未满 —— 回去吐纳
 *
 * 一条都不成立时返回 null:那时界面上说什么都是废话,不如不说。
 */
export function nextStepOf(input: NextStepInput): NextStep | null {
  if (input.pendingEvent) {
    return { id: "event", text: "有一桩际遇正等你决断", route: "adventure" };
  }
  if (input.exploring) {
    return { id: "explore", text: "这一程尚未了结,先走完它", route: "adventure" };
  }
  if (input.expFull && input.breakthroughReady) {
    /*
     * 与修行页那句**不重复**:那一页的卷首正文已经写着「修为圆满,破境条件已齐」。
     * 但别的页上看不到那句话,故这里仍要说 —— 只是措辞指向「去哪」而不是「是什么」。
     */
    return { id: "breakthrough", text: "关隘已开,可去破境", route: "cultivation" };
  }
  if (input.endgameReached) {
    return { id: "endgame", text: "此生道途已定,可谋来世", route: "legacy" };
  }
  if (input.rewardReady) {
    return { id: "reward", text: "有已得的赏未领", route: "collection" };
  }
  if (input.dongfuAffordable) {
    return { id: "dongfu", text: "洞府有可收的一笔", route: "dongfu" };
  }
  if (input.artifactSeatOpen) {
    return { id: "artifact", text: "法宝有空位,手里还有未上阵的", route: "inventory" };
  }
  if (input.betterEquipAvailable) {
    /*
     * 措辞只说得出「未上阵」这一件事 —— 判据那边用的是「行囊里有没穿上的」,
     * 而不是一次真正的换装模拟。说「更合手」会超出它知道的范围。
     */
    return { id: "equip", text: "行囊里有未上阵的一件", route: "inventory" };
  }
  if (input.expFull && input.breakthroughReason.trim()) {
    const reason = input.breakthroughReason.trim();
    return { id: "gate", text: `修为已满,还需过「${reason}」`, route: "cultivation" };
  }
  return null;
}

/**
 * 这一句该不该在**当前页**上说。
 *
 * 指向本页的建议是废话:玩家已经站在那儿了。只有指向别处的才值得占一行。
 */
export function nextStepForPage(step: NextStep | null, page: NextStepRoute): NextStep | null {
  if (!step) return null;
  return step.route === page ? null : step;
}
