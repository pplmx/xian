/**
 * 横向对账的**覆盖审计** —— 哪些「该比的维度」还没有判据在比。
 *
 * ## 为什么需要它
 *
 * 第 43~60 轮里反复出现同一个形状:
 *
 * ```text
 * 43  修为奖励没和同境界的邻居比      → 肥 66%
 * 44  材料奖励没和同格子的邻居比      → dust 高 5 倍
 * 55  功法基座没和同席位同品阶的比    → 肥两倍
 * 58  灵兽没先算可行域                → 连撞七八轮
 * 60  weaken 族没查「同族不倒退」     → t12 与 t25 一样
 * ```
 *
 * 每次的根因都不是「某条判据写错了」,而是**某个维度上根本没有判据**。
 * 而判据的覆盖天然是分块的:这一族查了增长,那一族查了封顶,
 * 中间那条「不倒退」谁都没管。
 *
 * 于是「哪些维度还没被判据覆盖」本身成了一个需要被测量的东西。
 *
 * ## 口径
 *
 * 本模块只做一件事:**把「内容表 × 可比较维度」列成一张清单**,
 * 每格标注是否有判据在管(通过扫描 spec 文件名 + 标题关键字判断)。
 *
 * 它不判断某条判据写得好不好 —— 那由判据自己负责。它只回答
 * 「这一维有没有人看着」。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";

/**
 * 扫描 `src/core/*.spec.ts`,返回「文件名 → 全部 it/describe 标题」。
 *
 * 只读标题不读断言体:断言写成什么样是判据自己的事,这里只问
 * 「有没有人写了这一维的用例」。
 */
export function specTitles(): Map<string, string[]> {
  const dir = join(ROOT, "src/core");
  const out = new Map<string, string[]>();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".spec.ts")) continue;
    const text = readFileSync(join(dir, file), "utf8");
    const titles: string[] = [];
    /*
     * 标题有两种写法:双引号字面量与**模板字符串**。后者在参数化用例里很常见
     * (`it(`${type} 族相邻档增长率不低于 …`)`) —— 第一版只匹配双引号,
     * 于是「法宝 / 族内相邻档增长率」被误报成「没有判据在管」,而它其实一直都在。
     *
     * 模板串里 `${…}` 的表达式部分取不到值(不执行代码),但**字面量部分**已经够用:
     * 判据要问的是「有没有人写过这一维」,标题里的 `相邻档增长率` 就是那一维的名字。
     */
    for (const m of text.matchAll(/\b(?:it|describe)\(\s*(?:"([^"]{2,120})"|`([^`]{2,120})`)/g)) {
      titles.push(m[1] ?? m[2]!);
    }
    out.set(file, titles);
  }
  return out;
}

/**
 * 找出「有可比较格子、却没有任何 spec 标题提到这一维」的项。
 *
 * `wanted` 是待查清单:每项给出表名、维度名,以及一组**关键字** ——
 * 任一 spec 标题同时命中全部关键字,即认为这一维有人看着。
 *
 * 关键字匹配是粗粒度的,但它足够回答「这一维有没有人管」这个问题 ——
 * 更细的判断(写得对不对)归各个判据自己。
 */
export function unguarded(
  wanted: readonly { table: string; dimension: string; keywords: readonly string[] }[],
  titles = specTitles(),
): { table: string; dimension: string }[] {
  const allTitles = [...titles.values()].flat();
  return wanted
    .filter(({ keywords }) => {
      const hit = allTitles.some((title) => keywords.every((k) => title.includes(k)));
      return !hit;
    })
    .map(({ table, dimension }) => ({ table, dimension }));
}
