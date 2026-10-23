/**
 * 游戏钟域的秒级心跳读数 —— 盯着的倒计时显示专用。
 *
 * 由来:闭关剩余 / BuffDialog / 在身之卦这几处倒计时此前拿 `totalPlaySec`
 * 当心跳,而引擎只在 `ACTIVE_STAMP_MS`(5 秒)才 `addPlayTime` 一次 ——
 * 「04分58秒」的秒针纹丝不动、每 5 秒跳 5 格,盯着看的玩家只觉得卡。
 *
 * 为什么把显示心跳与 `totalPlaySec` 解耦(而不是干脆把 ACTIVE_STAMP_MS 改成 1s):
 * 当初的理由写的是「finalStats 是全库最重的 computed,每秒重算受不了」——
 * **这条理由经实测站不住**,已按真账改写(2026-10-23 本机实测,神仙期满装 +
 * 闭关状态,每次 totalPlaySec 变化后读 finalStats/cultPerSec/qiRegen):
 *
 *   finalStats 重算 ≈ 7.4us/次;currentTribulationPlan(逐波推演整段雷)≈ 18.5us/次;
 *   修行页 1s 心跳下的真浏览器帧率:最差帧 17ms、p95 17ms、零长帧(perf-profile)。
 *
 * 也就是说「每秒重算」本身并不贵。真正要解耦的是**语义**,不是成本:
 * `totalPlaySec` 是「已游玩时长」这一存档事实,它的盖章节流(ACTIVE_STAMP_MS)同时
 * 服务于 lastActiveAt 的落盘节奏;把它当显示心跳,等于让落盘节流去决定秒针怎么走 ——
 * 两个不相干的东西被一根线串起来。显示另有自己的钟(gameNow(),暂停冻结、恢复顺延),
 * 与结算判定同源,这才是该有的分工。
 *
 * 语义:自起 1s 表、读 `gameNow()`(暂停冻结、恢复顺延)—— 与结算判定
 * 用的是**同一个时刻函数**,显示因此不会比判定先归零(暂停时两者一起冻结,
 * 恢复时 shiftWallClocks 已把在途截止顺延,读数从冻结点接着走)。
 * 结算链(activeDivination 过期判定等)照旧走各自的判定口径,不读本 composable。
 *
 * 「墙钟域」(坊市/弟子)不适用:那两处按墙钟结算,见 MarketView / ApprenticeView 注释。
 */
import { ref, type Ref } from "vue";
import { gameNow } from "@/core/enginePause";
import { gameClock } from "./useGameClock";

/** 命令式:起一枚 1s 心跳,返回响应式读数(调用方择时收表时用返回的 stop 之外的值即可) */
export function gameNowSeconds(): Ref<number> {
  const now = ref(gameNow());
  gameClock(() => {
    now.value = gameNow();
  }, 1000);
  return now;
}

/** 组合式:挂载即起表、卸载即收表(useGameClock 同壳) */
export function useGameNow(): Ref<number> {
  const now = ref(gameNow());
  useGameClockImpl(() => {
    now.value = gameNow();
  }, 1000);
  return now;
}

// 组合式壳从 useGameClock 引:onMounted/onUnmounted 只能在组件 setup 里注册,
// 命令式核心(gameNowSeconds)不在组件环境也能用(测试/脚本读数)。
import { useGameClock as useGameClockImpl } from "./useGameClock";
