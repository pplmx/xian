/**
 * 统一随机服务 —— 支持注入种子,保证概率逻辑可测试
 */

import { mulberry32 as engineMulberry32, pickWeighted } from "wanxiang-engine";

export type RandFn = () => number;

/**
 * 伪随机数生成器(测试用种子)—— **实现搬进了公共库**,这里保留同名转发。
 *
 * 为什么必须是一份实现:引擎那侧的 `createRng(seed)` 与本作的 `RandomService(mulberry32(seed))`
 * 是**同一串数**按两条路在用(同种子对账、把本作的随机服务直接喂给引擎函数)。
 * 两处各留一份拷贝的话,谁顺手改一点,所有"同种子重演"的判据都会静默错位 ——
 * 而错位的现象只是"某一局的结果跟以前不一样",查起来极贵。
 *
 * 「两条路同序列」由 `core/engineParity.spec.ts` 的随机源那一节逐点钉着。
 */
export const mulberry32 = (seed: number): RandFn => engineMulberry32(seed);

export class RandomService {
  /** 显式声明 + 构造体内赋值:参数属性(`constructor(private rand)`)不是可擦除语法,过不了 erasableSyntaxOnly */
  private readonly rand: RandFn;

  constructor(rand: RandFn = Math.random) {
    this.rand = rand;
  }

  next(): number {
    return this.rand();
  }

  /** [min, max] 闭区间整数 */
  int(min: number, max: number): number {
    return Math.floor(this.rand() * (max - min + 1)) + min;
  }

  /** [min, max) 浮点数 */
  float(min: number, max: number): number {
    return this.rand() * (max - min) + min;
  }

  /** 概率判定 */
  chance(p: number): boolean {
    return this.rand() < p;
  }

  /**
   * 从数组里取一个。
   *
   * **边界**:`rand() === 1` 时下标等于 `length`,**越界**,返回 `undefined` ——
   * 而签名说它返回 `T`。`Math.random()` 的值域是 `[0, 1)`,永远不会是 1,
   * 故所有走默认随机源的调用都安全;但**注入的随机源**可以返回 1
   * (测试桩、固定种子的探针都这么干过),那时这里的非空断言就是在撒谎。
   *
   * 2026 年为此栽过三轮回溯:探针把 `Math.random` 钉成 `1`,于是 `offerThemes`
   * 收进了一个 `undefined`,下游 `e.id` 当场炸,而堆栈指向另一个函数。
   * 探针侧已改钉 `0.5`(见 core/rngBoundary.spec);这里保留该行为不改 ——
   * 改它会悄悄改变所有既有概率逻辑的下标分布。
   */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.rand() * arr.length)]!;
  }

  /** Weighted pick — same kernel as wanxiang-engine's `pickWeighted`. */
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T {
    return pickWeighted(items, weightOf, () => this.rand());
  }
}

/** 全局默认随机实例 */
export const rng = new RandomService();
