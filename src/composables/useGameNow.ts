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
 *   finalStats 重算 ≈ 9.6us/次(2026-11-09 复量,原记 7.4);
 *   currentTribulationPlan(逐波推演整段雷)≈ 17.8us/次 —— **但它不是每秒跑的**,
 *   只有打开突破卡(`BreakthroughCard.vue` 的 computed)才算一次;
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

/**
 * **这个模块返回的是毫秒,不是秒。**
 *
 * ## 名字曾经在骗人（第 416 轮）
 *
 * 那两个导出原先叫 `gameNowMs` / 局部变量 `gameNowSec` —— 而它们返回的是
 * `gameNow()` 即 `Date.now()` 的**毫秒**。第 412 轮我在 `RetreatCard` 里信了那个
 * 名字，写成 `enlightenmentCooldownMs(gameNowSec.value * 1000)`，于是：
 *
 * ```text
 *   真实 now      1794838638298
 *   传进去的       1794838638298000
 *   剩余 ≈ −1.79e15 → 夹成 0 → v-if 恒假 → 那一行从没出现过
 * ```
 *
 * 而当时五条判据全绿 —— 它们查的是「有没有那一行」「插值形态」「用没用
 * `gameNowSec`」，**连「用对了钟」那条都把名字当成了单位**。
 *
 * 故改名为 `gameNowMs` / `nowMs`，并把单位写进函数名与这段注释。
 * **名字里断言了单位，就必须真的是那个单位。**
 */
export function gameNowMs(): Ref<number> {
  const now = ref(gameNow());
  gameClock(() => {
    now.value = gameNow();
  }, 1000);
  return now;
}

/**
 * 组合式：挂载即起表、卸载即收表（`useGameClock` 同壳）。
 *
 * 值同样是**毫秒**（`gameNow()` 即 `Date.now()`）。调用方一般只拿它当
 * 「每秒变一次」的响应式依赖，读数是次要的 —— 但若要读，别当成秒。
 */
export function useGameNow(): Ref<number> {
  const now = ref(gameNow());
  useGameClockImpl(() => {
    now.value = gameNow();
  }, 1000);
  return now;
}

// 组合式壳从 useGameClock 引:onMounted/onUnmounted 只能在组件 setup 里注册,
// 命令式核心(gameNowMs)不在组件环境也能用(测试/脚本读数)。
import { useGameClock as useGameClockImpl } from "./useGameClock";
