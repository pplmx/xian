/**
 * 初次相逢 —— 这一只凶物是不是头一回遇见。
 *
 * ## 为什么不直接查「照面次数」
 *
 * 照面次数记在 `lore.enemySeen`(`enemySeenOf(id)`),看着正好可以用:
 * 大于 0 就是见过。但它**记在写战报之后** —— `exploration` 里先
 * `adventure.recordBattle(view)`,后 `noteEnemy(...)`。战斗界面读的是那份战报,
 * 那时候照面次数已经 +1 了,拿它判"初见"永远得到 false。
 *
 * 故判定要在**结算那一刻**取,并把结果记进战报(`LastBattleView.firstSight`)。
 * 这个函数就是那一刻用的:纯的、只看输入的照面次数。
 *
 * ## 为什么单独一个小函数
 *
 * 判定与登记分开 —— 登记(`noteEnemy`)有自己的权重(胜 +1、败只加一点),
 * 而判定只问"之前有没有"。混在一起会让"计次"与"是否初见"互相纠缠。
 */

/**
 * 头一回遇见 —— `seenBefore` 是**这一场之前**的照面次数。
 *
 * 三种输入的区别:
 *   `undefined`   —— 从来没记过这一只(旧档、第一次出场的敌人)。算初见。
 *   `0`           —— 记过,但一次也没有。算初见。
 *   正数          —— 见过。不算初见(打输只记一点点,那也是正数)。
 *
 * `NaN` / `Infinity` 单独挡掉:它们不该被判成初见 —— 印错了比不印更糟,
 * 而屏幕上多一枚假的「初见」章会让人以为世界记错了账。
 */
export function isFirstSight(seenBefore: number | undefined): boolean {
  if (seenBefore === undefined) return true;
  if (!Number.isFinite(seenBefore)) return false;
  return seenBefore <= 0;
}
