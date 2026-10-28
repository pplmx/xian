/**
 * 凡界路线的骨架与事件节奏模板。
 *
 * 单独放在纯数据模块里:存档修形要校验 id,不该为了读一张常量表
 * 把生成器、战斗模拟与构筑识别整条依赖链接进每个 store 用例。
 */

export interface RouteShape {
  id: string;
  name: string;
  /** 层级序列;长度即段数 */
  tiers: readonly number[];
}

/**
 * 路线骨架模板。
 *
 * 上一轮的审计钉出:层级递进曾硬编码为 `2 + i * 3`,六世的推进节奏
 * 一模一样 —— 玩家的重复感主要来自这里,而不是敌人换没换。
 *
 * 但**不能改成纯随机**:`2 → 19 → 3 → 17` 虽然「新」,玩家却无法
 * 形成合理的空间认知。故取「有限模板 + 参数扰动 + 历史去重」。
 */
export const ROUTE_SHAPES: readonly RouteShape[] = [
  { id: "shallow", name: "浅入", tiers: [1, 5, 10, 14, 17, 20] },
  { id: "brisk", name: "短促", tiers: [2, 7, 12, 18] },
  { id: "even", name: "匀进", tiers: [2, 5, 8, 11, 14, 17] },
  { id: "longtail", name: "长尾", tiers: [2, 4, 6, 9, 13, 19] },
  { id: "lateclimb", name: "前缓后陡", tiers: [2, 3, 5, 9, 14, 20] },
  { id: "earlyclimb", name: "前陡后缓", tiers: [2, 7, 12, 15, 17, 18] },
  { id: "weave", name: "深浅交错", tiers: [3, 8, 6, 13, 10, 18] },
  { id: "short_weave", name: "短程交错", tiers: [3, 9, 6, 15, 12] },
  { id: "steady", name: "稳起", tiers: [4, 6, 10, 13, 17, 20] },
];

export interface RhythmArchetype {
  id: string;
  name: string;
  /** 相对密度曲线,生成时按段数重采样 */
  curve: readonly number[];
}

/**
 * 事件节奏原型。
 *
 * `222222` 不是「事件少」,是**没有节奏设计**。这些原型让玩家能感觉到
 * 「这一世前面平静,后面突然密集」,而不是「又一段每处两个」。
 */
export const RHYTHM_ARCHETYPES: readonly RhythmArchetype[] = [
  { id: "flat", name: "平稳", curve: [2, 2, 2, 2, 2, 2] },
  { id: "front", name: "前紧后松", curve: [4, 3, 3, 2, 1, 1] },
  { id: "back", name: "前松后紧", curve: [1, 1, 2, 3, 3, 4] },
  { id: "mid", name: "中段高压", curve: [1, 2, 4, 4, 2, 1] },
  { id: "twin", name: "双峰", curve: [3, 1, 4, 1, 3, 1] },
  { id: "finale", name: "终局堆积", curve: [1, 1, 2, 2, 3, 5] },
];
