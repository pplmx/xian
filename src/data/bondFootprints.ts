/**
 * 足迹 —— 她开口之前的那些征兆。
 *
 * ## 缺的是什么（第 409 轮）
 *
 * `bondIntent` 让「她为什么会开口」有了代码上的真实答案：ripeness 由经历累积、
 * 满了才说。而 `bondCausality.spec` 量过一件更尴尬的事：
 *
 * ```text
 *   她开口前的足迹数        0
 * ```
 *
 * 也就是说 **她会突然说话**。玩家看到的是「沈青璃忽然停下：往北那条路……」，
 * 而在此之前一条线索都没有 —— 那正是这个 spec 自己判为 `abrupt`（突兀）的那一档。
 *
 * `bondCausality.spec` 结尾已经写明了该做什么：
 *
 * > 该做的是在累积途中留下轻量记忆,让玩家自己把节点串起来:
 * >   「她又问起北境的消息。」
 * >   「你注意到她仍在留意北方。」
 * >   「她终于停下脚步。」
 * >   「往北那条路……我想去看看。」
 *
 * 并写明**素材已经就位**：十位道侣各有所求，四句话都能从 `pursuit` 派生 ——
 * 缺的是机制，不是内容。
 *
 * ## 这条模块就是那个机制
 *
 * 按 ripeness 分三档，各吐一句。第四句是 `intentFor` 已有的 `line`（开口那句），
 * 不在这里重复。
 *
 * ```text
 *   0.00 ~ 0.33   她提了一句     「她又提起「寻找失踪的师尊」。」
 *   0.33 ~ 0.66   一直惦记        「你注意到她仍在留意「寻找失踪的师尊」这件事。」
 *   0.66 ~ 门槛   快要开口        「她似乎有话要说，终究没说。」
 * ```
 *
 * ## 为什么必须由 ripeness 派生，而不是另记一本账
 *
 * 若足迹单独存一份计数器，就会有「足迹走到第 3 句、而她还没开口」这种
 * 对不上的状态 —— 那正是本仓反复禁止的「两本账」。故这里**只读 ripeness**，
 * 是纯函数：同一份意图在任何时刻算出来的足迹都一样。
 *
 * 也因此它不必存进存档 —— 没有状态可存。
 *
 * ## 「终究没说」那一档的边界
 *
 * 只在她**还没开口**时给。已开口过（`raised > 0`）而后来被忽略、又攒回来时，
 * 第三档不该再说「终究没说」—— 她说过了。故 `spoken` 为真时这一档跳过，
 * 退回到「一直惦记」。
 */
import type { BondIntent } from "./bondIntent";
import { TEMPER_RESERVE } from "./bondIntent";
import type { Temperament } from "./daolu";

/** 足迹的档位 —— 越小越含蓄 */
export type FootprintTier = "mentioned" | "dwelling" | "hesitating";

export interface Footprint {
  tier: FootprintTier;
  text: string;
}

/**
 * 三档的分界，按**门槛的百分比**取，而不是按绝对的 ripeness。
 *
 * 理由:不同性格的门槛不一样（谨慎 1.4 / 激进 0.8）。若按绝对值分段，
 * 一个门槛 0.8 的激进角色会在 ripeness=0.6 时就说「快要开口」，
 * 而门槛 1.4 的谨慎角色在同一个 ripeness 上还只是「一直惦记」——
 * 同样是 0.6，两个人的处境差得远。**按自己门槛的完成度分，才对得上。**
 */
const TIER_RATIOS = [0.34, 0.67] as const;

/** 这一档的「所求」用引号括起来显得太生硬 —— 用一个短前缀替代整句引用 */
function shortPursuit(pursuit: string): string {
  /*
   * `pursuit` 是完整的一句（「寻找十年前失踪的师尊」），直接塞进引号里
   * 会变成「她又提起「寻找十年前失踪的师尊」」—— 引号套引号，读着别扭。
   *
   * 不另造一份短文案（那会变成两本账，改了 pursuit 这边不跟），
   * 而是**去掉动词前缀**，只留她惦记的那个东西。取不到就整句照用。
   */
  const stripped = /^(寻找|走遍|把那|找到|查清|复原|补全|弄清|活得)/.exec(pursuit);
  if (!stripped) return pursuit;
  const rest = pursuit.slice(stripped[0].length);
  // 去掉后太短（<4 字）就说明原句本身就是短语，照原样用
  return rest.length >= 4 ? rest : pursuit;
}

/**
 * 此刻她留下的那些足迹（按含蓄到急切排序，最新的在末尾）。
 *
 * 纯函数：只读 `intent.ripeness`、`intent.responses`、`intent.raised` 与性格。
 * 不看时间、不掷骰、不写任何状态。
 */
export function footprintsOf(intent: BondIntent | null, temper: Temperament): Footprint[] {
  if (!intent || intent.settled) return [];

  const bar =
    TEMPER_RESERVE[temper] * (1 + intent.responses.filter((r) => r === "ignore").length * 0.4);
  if (bar <= 0) return [];
  // 完成度：她离「开口」还有多远。1.0 就是开口的那一刻。
  const progress = intent.ripeness / bar;
  const object = shortPursuit(intent.wish);

  const out: Footprint[] = [];
  if (progress <= 0) return out;

  out.push({ tier: "mentioned", text: `她又提起「${object}」。` });
  if (progress >= TIER_RATIOS[0]) {
    out.push({ tier: "dwelling", text: `你注意到她仍在留意「${object}」这件事。` });
  }
  /*
   * 「快要开口」只在**还没开过口**时给。
   *
   * 已开口而被忽略、又攒回来的那一趟，玩家见过她说出口的样子，
   * 再说「终究没说」是错的 —— 她说过了。此时停在「一直惦记」即可。
   */
  if (progress >= TIER_RATIOS[1] && intent.raised === 0 && !intent.settled) {
    out.push({ tier: "hesitating", text: "她似乎有话要说，终究没说。" });
  }
  return out;
}
