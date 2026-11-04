/**
 * 那一块章 —— 显示哪几枚,由这里决定。
 *
 * ## 为什么需要它
 *
 * `.combat-combatant__chips` 那块原先的条件是:
 *
 *   `v-if="battle && (battle.isBoss || isNemesisFoe || shownTraits.length)"`
 *
 * 它列的是**每一枚章的条件之或**。于是每加一枚章,都得记着回来把条件也改一遍 ——
 * 漏改时没有任何东西会报错:组件照样编译、类型全对、单测全绿,只是屏幕上没有。
 *
 * 连续两轮踩了同一个坑(第 42 轮的「旧仇已雪」、第 43 轮的「初见」),两次都是
 * 真浏览器探针量到 `chipsWrap: 0` 才发现。
 *
 * 修法不是"下次记得",是让条件的来源**只有一个**:块显示与否 = `chipsOf(...)` 的
 * 结果非空;块内渲染的也是同一个数组。两者在构造上不可能不一致。
 *
 * ## 不做的事
 *
 * 不管样式、不管顺序之外的东西。这只是把"该显示哪几枚"这件事从一个模板表达式里
 * 挪出来,好让它可测、且能被两处共用。
 */

/** 面板上关于这只敌人的全部可显示事实 —— 由调用方从各处算好传进来 */
export interface ChipFacts {
  isBoss: boolean;
  /** 宿敌章的文案(不到门槛或已雪耻时是空串) */
  nemesis: string;
  /** 敌人自带词条的 id 列表 */
  traits: readonly string[];
  firstSight: boolean;
  /** 雪耻那句(未雪耻时是空串) */
  avenged: string;
}

/** 一枚章:上面渲染什么,取决于 id */
export interface CombatChip {
  /** 稳定标识 —— `boss` / `nemesis` / `trait:<id>` / `firstSight` / `avenged` */
  id: string;
  /** 若是词条章,这里是词条 id(其余为 undefined) */
  traitId?: string;
}

/**
 * 该显示哪几枚章,按固定顺序(首领 → 宿敌 → 词条 → 初见 → 雪耻)。
 *
 * 顺序是刻意的:**身份**(首领、宿敌)在左,「**这一场的新鲜事**」（初见、雪耻）在右。
 * 中间的词条是这一场的对手属性,夹在两边身份之间最自然。
 *
 * 空字符串与空白字符串不算内容 —— 不因为没有文案就占一行。
 */
export function chipsOf(facts: ChipFacts): CombatChip[] {
  const chips: CombatChip[] = [];
  if (facts.isBoss) chips.push({ id: "boss" });
  if (facts.nemesis.trim()) chips.push({ id: "nemesis" });
  for (const t of facts.traits) {
    if (t) chips.push({ id: `trait:${t}`, traitId: t });
  }
  if (facts.firstSight) chips.push({ id: "firstSight" });
  if (facts.avenged.trim()) chips.push({ id: "avenged" });
  return chips;
}
