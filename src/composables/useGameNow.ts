/**
 * 游戏钟域的秒级心跳读数 —— 盯着的倒计时显示专用。
 *
 * 由来:闭关剩余 / BuffDialog / 在身之卦这几处倒计时此前拿 `totalPlaySec`
 * 当心跳,而引擎只在 `ACTIVE_STAMP_MS`(5 秒)才 `addPlayTime` 一次 ——
 * 「04分58秒」的秒针纹丝不动、每 5 秒跳 5 格,盯着看的玩家只觉得卡。
 *
 * 为什么不直接把 ACTIVE_STAMP_MS 改成 1s:`totalPlaySec` 的依赖链上有
 * weatherMods → finalStats(全库最重的 computed,人物/战斗/炉前全读它),
 * 心跳提到 1s 等于让它每秒重算 —— 结算链的粒度不该为显示买单。
 *
 * 语义:自起 1s 表、读 `gameNow()`(暂停冻结、恢复顺延)—— 与结算判定
 * 用的是**同一个时刻函数**,显示因此不会比判定先归零(暂停时两者一起冻结,
 * 恢复时 shiftWallClocks 已把在途截止顺延,读数从冻结点接着走)。
 * 结算链(activeDivination 过期判定等)不读它,照旧走 totalPlaySec ——
 * 显示最多领先判定一个盖章周期(≤5s),对「过时自散」这类后台行为无感。
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
