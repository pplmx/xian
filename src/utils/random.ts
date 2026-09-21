/**
 * 统一随机服务 —— 支持注入种子,保证概率逻辑可测试
 */

import { mulberry32 as engineMulberry32, pickWeighted } from 'wanxiang-engine'

export type RandFn = () => number

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
export const mulberry32 = (seed: number): RandFn => engineMulberry32(seed)

export class RandomService {
  /** 显式声明 + 构造体内赋值:参数属性(`constructor(private rand)`)不是可擦除语法,过不了 erasableSyntaxOnly */
  private readonly rand: RandFn

  constructor(rand: RandFn = Math.random) {
    this.rand = rand
  }

  next(): number {
    return this.rand()
  }

  /** [min, max] 闭区间整数 */
  int(min: number, max: number): number {
    return Math.floor(this.rand() * (max - min + 1)) + min
  }

  /** [min, max) 浮点数 */
  float(min: number, max: number): number {
    return this.rand() * (max - min) + min
  }

  /** 概率判定 */
  chance(p: number): boolean {
    return this.rand() < p
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.rand() * arr.length)]!
  }

  /** Weighted pick — same kernel as wanxiang-engine's `pickWeighted`. */
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T {
    return pickWeighted(items, weightOf, () => this.rand())
  }
}

/** 全局默认随机实例 */
export const rng = new RandomService()
