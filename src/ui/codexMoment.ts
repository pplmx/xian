/**
 * 道历 —— 把「收录于 2026-11-04 14:32」换成本作自己的时间说法。
 *
 * ## 问题:全作只有这一处露出现实世界的钟
 *
 * 界面上其余每一个时间字样都在世界内:寿元多少**载**、此去多少**时辰**、
 * 第 N 世、若干**年**后。唯独图鉴每一条的页脚写着 Ubuntu 的系统日期 ——
 * 「收录时间 2026-11-04 14:32」。它一眼就把人从道历里拽出来:
 * 你在修仙,而这一页在报机房时间。
 *
 * 时区还会让它**说错**:同一份存档,在东八区打开是 11 月 4 日,在 UTC 打开是 11 月 3 日,
 * 而「收录时间」听着像一件已经写在册上的事。
 *
 * ## 道历怎么算
 *
 * 本作有三样世界内的时间事实,而且都已存在:
 *   **第几世**(`player.reincarnation.count + 1`)
 *   **这一世活到几岁**(`player.age`)
 *   **所在境界**(`player.major`)
 *
 * 道历给出的是「**第 N 世 · M 岁**」—— 那是玩家真正能对上号的时间:
 * 「我在第三世四十二岁那年把它录入册的」。它不需要发明一套纪元年号
 * (那会与「第 N 世 + 年岁」变成两套并行的历法,两本账),也不需要时区。
 *
 * ## 旧账怎么办
 *
 * 旧档里已收录的条目**没有**这一对读数(从前只记了墙钟毫秒)。照实说
 * 「早年收录」—— 与从前那句「早年收录,未记时日」同一条诚实口径,
 * 只是不再补一个现实日期。
 *
 * ## 为什么不干脆删掉这一行
 *
 * 「何时得到它的」是这个册子里唯一与**你**有关的时间线索:其余都是物自身的属性。
 * 删掉就等于图鉴只剩物,没有拿到它的那一刻。
 */

/** 一条收录记录的世界内读数 */
export interface CodexMoment {
  /** 第几世(1 起) */
  life: number;
  /** 这一世活到几岁(取整) */
  age: number;
}

/**
 * 道历的一句话。
 *
 * 写法固定为「第 N 世 · M 岁」:两段之间用中点,与页脚其它读数的分隔符同一套
 * (见 collection 页脚的「收录时间」一格)。数字一律整数:年岁本来就是整数口径
 * (见 utils/format 的 yearsShown),世数天然是整数。
 *
 * 缺一边(旧档 / 坏值)就整句不出 —— 半句「第 3 世 · 岁」比不写更糟。
 */
export function codexMomentText(moment: CodexMoment | null | undefined): string {
  if (!moment) return "早年收录";
  const life = finiteInt(moment.life);
  const age = finiteInt(moment.age);
  // NaN 与越界一律当「没这一边」:NaN < 1 与 NaN < 0 都是 false,
  // 只写比较就等于让一个坏值印出「第 NaN 世」
  if (!Number.isFinite(life) || !Number.isFinite(age)) return "早年收录";
  if (life < 1 || age < 0) return "早年收录";
  return `第 ${life} 世 · ${age} 岁`;
}

function finiteInt(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return Number.NaN;
  return Math.floor(value);
}
