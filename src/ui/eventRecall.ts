/**
 * 见过第二次 —— 重复遇到同一事件时那一句话。
 *
 * ## 为什么需要它
 *
 * 九十五个事件里只有八个标了 `once`,其余八十七个可以反复出现(见 data/events)。
 * 第二次、第五次遇到时,标题、正文、选项一字不差 —— 玩家的体感是「怎么又是这个」,
 * 而界面上什么都不认账,仿佛这是第一次。
 *
 * 而 `adventure.eventMemories` 里**已经记着**每一次的结果:完成次数 `times`、
 * 上次选择 `lastChoiceIdx`。两样都躺在那儿,界面上一次都没用过。
 *
 * ## 与既有「余波」的分工
 *
 * 事件弹窗里已经有一块 `aftermath`(见 core/worldMemory):它同样讲"你来过",
 * 但有两条限制 —— `times >= 2` 才亮(即第三次起),且只按 `AFTERMATH_CHANCE = 0.2`
 * 抽。于是**第二次遭遇完全没有标记**,第三次起也有八成不亮。
 *
 * 这一句补的正是那一格:它**必出**(不掷骰),且从第二次起就有。两句话的分工是:
 *   余波 —— 世界那侧的、偶发的、带情绪的("痕迹依旧温存")
 *   这一句 —— 你自己那侧的、每次都有的、只陈述事实("上一次你走的是……")
 * 两条可以同时出现在同一屏,不冲突:一条是景,一条是账。
 *
 * ## 只说一句话,不做变体内容
 *
 * 给八十七个事件各写两三套变体,是两百多份文案,而且每一份都要与选项语义对得上。
 * 那是内容工程。而「**承认这是重复**」这一件事,一句就够 ——
 * 它改的是玩家对重复的体感:从「系统没记住」变成「世界记得」。
 *
 * ## 口径
 *
 * 这句是描述,不影响抽取、不影响奖励、不含数字 —— 与器铭、契语、道记同一条。
 * 次数用的是**这一次**的序号(已经完成过 2 次时,这是第 3 次),因为玩家读的是
 * 「我现在正在经历的是第几回」,不是「我以前来过几回」。
 */

/** 与 `EventMemory` 同形,但不 import 它 —— 本模块只管措辞,不依赖存储形状 */
export interface RecallMemory {
  times: number;
  lastChoiceIdx: number;
}

const ORDINALS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

/**
 * 第 N 次 —— 十以后用阿拉伯数字。
 *
 * 与 `utils/format.cnNumber` 同一条边界(那边也只到 9999 且用于数量词)。
 * 这里不 import 它:事件重复次数超过十的情形极少,而这句是**叙事**,不是读数 ——
 * 两个数字系统混在一句话里会读着别扭,故十一以后照实写「11 次」。
 */
function ordinal(n: number): string {
  return n >= 0 && n <= 10 ? ORDINALS[n]! : String(n);
}

/**
 * 那一句话。第一次遇到、或者记忆坏掉时返回空串 —— 调用方据此决定要不要渲染。
 *
 * @param memory      这件事的记忆(没有则传 null)
 * @param choiceLabel 按索引取当时的选项文案;取不到返回 undefined
 */
export function recallText(
  memory: RecallMemory | null | undefined,
  choiceLabel: (index: number) => string | undefined,
): string {
  if (!memory) return "";
  const times = Number.isFinite(memory.times) ? Math.floor(memory.times) : 0;
  if (times < 1) return "";

  // 这一次是第几次
  const thisTime = times + 1;
  const idx = memory.lastChoiceIdx;
  const label = Number.isFinite(idx) ? choiceLabel(Math.floor(idx)) : undefined;

  /*
   * 认得上一次的选择,就说完整一句;认不得就只说次数。
   * 不说「上一次走的是……」然后留半句 —— 那比不说更糟。
   */
  if (label) {
    return `你想起上一次,自己走的是「${label}」;这已是第${ordinal(thisTime)}次。`;
  }
  return `这已是第${ordinal(thisTime)}次。`;
}
