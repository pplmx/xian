/**
 * 道龄 —— 「这一号人物,你陪他走了多久」。
 *
 * ## 缺口:一条从没被读过的存档事实
 *
 * `game.totalPlaySec` 是「**活跃游玩**时长」的存档事实,而且语义被刻意钉死过
 * (见 core/engine 的注释):缺席时段只走离线那本账,**不进**它 ——
 * 挂机一晚不换天、不白得八小时。它同时是天时、值日宿与际遇概率的派生源
 * (DEC-120:序号只由游戏内时长决定)。
 *
 * 而这条事实**从来没有被展示过**:全仓对它只有一处读取
 * (ExpeditionPanel 的星宿对齐),界面上一个字都没有。
 *
 * 于是玩家玩了三个月,看不到任何「我陪这一号人物走过多久」的读数 ——
 * 而这恰恰是放置类游戏最该有的那种感觉:角色是你养出来的,时间是你投进去的。
 *
 * ## 为什么放在「修行画像」而不是顶栏
 *
 * 顶栏是**此刻**的读数(灵石、灵气、寿元),每一秒都在变。
 * 道龄是**累计**事实,变了也没有意义去盯着 —— 它属于「这一号人物是谁」那一页。
 * 与「行年」把散落的道历收成一册同一条取向:累计的东西集中在一处读。
 *
 * ## 只说人话,不报精确到秒
 *
 * 秒级读数在累计语境里是噪音:玩了 37 小时的玩家不关心多出来的 12 分钟。
 * 故按量级取整,并给一句随量级变化的说法 ——
 * 一炷香的陪伴与三个月的陪伴,不该是同一个句子。
 */
import { formatDuration } from "@/utils/format";

/** 刚开号到「一个时辰」之内 —— 还没有值得报的累计 */
const JUST_STARTED_SEC = 60;
/** 一天 */
const DAY_SEC = 86400;

/** 非负有限值;坏值一律当 0 */
function safeSeconds(totalSec: unknown): number {
  if (typeof totalSec !== "number" || !Number.isFinite(totalSec)) return 0;
  return Math.max(0, Math.floor(totalSec));
}

/**
 * 道龄的说法 —— 按量级取整。
 *
 *   一分钟内  ——「才开卷」(不报数:刚建的号报「47 秒」没有意义)
 *   一天内    —— 读小时(3 小时 / 3 小时 12 分)
 *   一天以上  —— 读天,四舍五入(5 天 20 小时 → 6 天)
 *
 * 一天以上不再带小时:累计语境里「37 天 4 小时」与「37 天」是同一件事。
 */
export function companionTimeText(totalSec: unknown): string {
  const sec = safeSeconds(totalSec);
  if (sec < JUST_STARTED_SEC) return "才开卷";
  if (sec < DAY_SEC) return formatDuration(sec);
  const days = Math.round(sec / DAY_SEC);
  return `${days} 天`;
}

/**
 * 这一行前面的标签 —— 随量级换词。
 *
 * 「道龄」是这张画像的正式说法;刚开始那一档说「初入此世」更贴合。
 * 两个词都短(≤6 字),进得去画像那一行。
 */
export function companionTimeLabel(totalSec: unknown): string {
  const sec = safeSeconds(totalSec);
  if (sec < JUST_STARTED_SEC) return "初入此世";
  if (sec < DAY_SEC) return "道龄";
  return "伴道";
}
