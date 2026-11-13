/**
 * 大道熔真 —— 走到尽头之后,修为往哪里去。
 *
 * ## 它修的是什么
 *
 * 修为是这一作唯一的主动投入方向:攒修为 → 突破 → 变强 → 打更难的 → 攒更快。
 * 而满级那一下,这个闭环的**入口被关死**了:`player.gainExp` 之后会被
 * `subClamp` 夹在需求值上,修为再也涨不上去。同时引擎仍在每秒算
 * `cultPerSec`(末境约 5.7e13/秒)并交给一个无处可去的加法 —— 界面上
 * 「此刻行速」还亮着这个数,而它什么也不产生。
 *
 * 于是终局的主循环**不是放缓,是断掉**:玩家打开游戏,修速在跳,进度条不动,
 * 没有一件事因为「又玩了一天」而变。
 *
 * ## 为什么接天界熔炉,而不是新做一套
 *
 * 天界已经有一条「把凡间所得熔作道源」的现成路径(`furnaceConvert`,
 * 玄铁 / 残页 / 灵草 / 器灵尘四料)。满级之后的修为是**同一种东西**:
 * 收不进去的余量。故接进同一条经济,不新增货币、不新增面板语言。
 *
 * 与那四料的关键差别:**它不需要玩家点**。修为是每分每秒自动涨的,
 * 要玩家每秒回来按一次不叫玩法。故这里是「自动入炉」:满级之后,超出需求的
 * 修为按固定比例就地炼成道源,不落在 `exp` 上。
 *
 * ## 一条硬约束:不许变成白给
 *
 * 末境修速 5.7e13/秒,若按 1:1 换,一天就是 4.9e18 道源 —— 道果体系当场崩。
 * 故折算按**需求值**定标:一秒的修为相对当年修满这一境所需的 `expReq` 很小,
 * 换算成道源的速度与「一世修满所获道果」同量级,不会把转世的经济压平。
 * 具体比例见 `APEX_CULT_TO_DAO_RATIO`,判据由 `apexCultivation.spec` 守着。
 *
 * ## 与转世的关系
 *
 * 它**不取代转世**:道果的大头仍来自兵解(`daoFruitGain`),这里只是让
 * 「修满之后继续玩」这件事有产出。它是终局的地板,不是终局的全部。
 */

/**
 * 满级修为 → 道源的折算率:**每一份 `expReq` 换多少道源**。
 *
 * ## 这个数是怎么定出来的(不是拍的)
 *
 * 末境实测:修速 5.7e13/秒,`expReq` 约 1.1e20,故**一天攒 0.045 份**。
 * 故「一份换 N 枚」等价于「一天得 0.045N 枚」。
 *
 * 拿三笔既有收益当标尺:
 *   · 兵解转世一次(修到末境)= 696 道果 = **69600 道源**;
 *   · 天界熔炉一次献祭(玄铁满仓)约数十到数百道源;
 *   · 一趟远征/试炼的赏 —— 同量级。
 *
 * 取 **1100**:一天约 **49 道源**,与「熔一炉玄铁」同量级,玩家当天就能看见;
 * 而修满一世(307 天)共约 **15100 道源 = 151 道果**,只有转世的 22% ——
 * **打不过转世**,不会被拿来替代它,也不会让转世显得亏。
 *
 * 此前定 1(一天 0.045 枚、21 天才一枚),实测玩家一整天看不到任何回报 ——
 * 那等于这条路不存在。定标的第一要求是**可感知**,第二才是别破坏平衡。
 */
export const APEX_CULT_TO_DAO_RATIO = 1100;

/**
 * 满级之后,把这一拍的修为炼作道源。
 *
 * 返回这一拍炼出的道源数(0 表示没到一枚,或本来就不在终局)。
 * 调用方是引擎的心跳 —— 与 `gainExp` 同一个位置,不另起一条计时线。
 *
 * 为什么用**余数累积**而不是每次都向下取整:末境一拍(1 秒)的修为只有一份
 * `expReq` 的 5e-7,单拍永远取整成 0。若不留余数,这条路永远不会产出
 * —— 判据会全绿而玩家一点道源都拿不到。故把不足一枚的部分存在上一笔里。
 */
let remainCult = 0;

export function apexCultivationTick(gained: number, expReq: number): number {
  if (!Number.isFinite(gained) || gained <= 0) return 0;
  if (!Number.isFinite(expReq) || expReq <= 0) return 0;
  /*
   * 余数**只在这个模块里累积**,不落盘:满级修为是每拍现算的,掉一次线
   * 就重来,不必为它新开一个存档字段(那会是一份没有玩家的账)。
   */
  remainCult += (gained / expReq) * APEX_CULT_TO_DAO_RATIO;
  const whole = Math.floor(remainCult);
  if (whole <= 0) return 0;
  remainCult -= whole;
  return whole;
}

/** 测试与转世时复位余数 —— 转世之后修为归零,这份余数不该带进下一世 */
export function resetApexCultRemainder(): void {
  remainCult = 0;
}

/**
 * 还差多久炼出下一枚道源 —— 给界面报「约 22 天得 1 道源」。
 *
 * 为什么必须报:满级之后修速那一格仍在跳(每秒 5.7e13),而进度条不动。
 * 没有这一句,玩家只看到「数字在涨、什么也没发生」—— 那正是这条路被
 * 当成不存在的原因。天数由**当前修速**现算,不是常数。
 *
 * @param cultPerSec 当前每秒修为
 * @param expReq     当前境界的修为需求
 * @returns 一句人话;算不出来时给空串(调用方不渲染)
 */
export function apexFurnaceEta(cultPerSec: number, expReq: number): string {
  if (!Number.isFinite(cultPerSec) || cultPerSec <= 0) return "";
  if (!Number.isFinite(expReq) || expReq <= 0) return "";
  const secs = expReq / cultPerSec / APEX_CULT_TO_DAO_RATIO;
  if (!Number.isFinite(secs) || secs <= 0) return "";
  if (secs < 60) return `${Math.round(secs)} 秒`;
  if (secs < 3600) return `${Math.round(secs / 60)} 分钟`;
  if (secs < 86400) return `${Math.round(secs / 3600)} 小时`;
  const days = secs / 86400;
  return days >= 10 ? `${Math.round(days)} 天` : `${days.toFixed(1)} 天`;
}
