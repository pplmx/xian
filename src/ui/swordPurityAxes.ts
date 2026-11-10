/**
 * 剑意纯度的两侧读数 —— 报了「1/4 层」,没报**差哪三项**。
 *
 * ## 缺口
 *
 * `core/daoDepth` 的 `SwordPurity` 每项都产出 `{ name, ok }`,类型注释里就写着
 * 「供 UI 解释『为什么是这几层』」。而天界页的剑意面板只印**通过的那些**:
 *
 * ```text
 * 当前剑意 1/4 层
 * 主流派成形（契合 ≥60%）      ← 只列 ok 的那一项
 * ```
 *
 * 玩家看到 1/4,想知道差哪三项、每一项为什么没过 —— 界面上一个字都没有,
 * 不通过时退回一句「尚无一纯」。而这一屏正是他决定「要不要先卸一件法宝、
 * 要不要停掉吸血功法」的地方。
 *
 * 这是本仓点名的「只说不行」:报了结果,没报怎么来的。
 *
 * ## 与师承那处同构
 *
 * `ui/mentorBehaviorAxes` 解决的是同一个形状的问题(报了 0.35,看不到是什么扣的),
 * 那里用的是「相亲 / 相左」两侧并列,**报行为不报权重**。
 * 剑意这四项全是行为(主流派成形 / 无副体系 / 法宝不过一件 / 不修回血之术),
 * 完全同构,故照抄那套形状:一侧叫「已达」,一侧叫「未达」。
 *
 * ## 三条口径
 *
 * - **两侧都出**,但空侧整行不出 —— 全达标时不印一条空的「未达」;
 * - **只报项名,不报判定阈值** —— 阈值随平衡动,「看重什么」不动;
 * - **顺序与判定一致** —— 直接读 `SwordPurity.checks`,不在这里重排、不重写判定。
 */
import type { SwordPurity } from "@/core/daoDepth";

export interface PurityAxes {
  /** 已达的项名(顺序与判定一致) */
  toward: string[];
  /** 未达的项名 —— 这一半此前是无声的 */
  against: string[];
}

/**
 * 把 `SwordPurity.checks` 摊成两列。
 *
 * 入参就是 `core/daoDepth` 那一份,不重算、不重排:
 * 判据在 core,展示只看 `ok`。
 */
export function purityAxes(purity: SwordPurity | null | undefined): PurityAxes | null {
  if (!purity) return null;
  const toward: string[] = [];
  const against: string[] = [];
  for (const check of purity.checks) {
    // 名字是 core 给的人话,这里不改写 —— 两处各写一套措辞迟早分叉
    (check.ok ? toward : against).push(check.name);
  }
  return { toward, against };
}

/**
 * 一句总结:已达标几项、差哪几项。
 *
 * 给读屏与窄屏用(`aria-label` 或单行摘要)—— 两列并排在 195 宽会折成四行,
 * 故另给一句能一行说完的。**不重复项名**:两列已经把它们说全了。
 */
export function purityAxesSummary(axes: PurityAxes | null): string {
  if (!axes) return "";
  const passed = axes.toward.length;
  const total = passed + axes.against.length;
  if (total === 0) return "";
  if (axes.against.length === 0) return `${total} 项剑意皆纯,已至 ${passed}/${total} 层`;
  if (passed === 0) return `剑意未纯:${total} 项尚无一项达成`;
  return `已达 ${passed} 项,另 ${axes.against.length} 项未达`;
}
