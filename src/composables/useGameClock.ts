/**
 * 带引擎暂停守卫的游戏时钟 —— 手写 setInterval 的收口处。
 *
 * useNow 只服务「每秒刷一个 now」的倒计时页;本作还有一批各自带回调的手写
 * setInterval(事件轮询、战报逐条回放、灵根轮换),它们此前都不判 enginePaused ——
 * 心跳停着(重置确认 / 导入确认)时照跑不误。这里把「cb 每 tick、暂停冻结」的
 * 口径收成一个出处,与 useNow 同一条语义(useNow 里那条守卫就是它的原型):
 * 游戏的心跳停了,挂在它上面的一切读取与轮询都跟着停。
 *
 * 两个出口对应两种用法:
 *   useGameClock(cb, ms) —— 组合式:挂载即起表、卸载即收表(轮询类弹窗用);
 *   gameClock(cb, ms)    —— 命令式:返回 stop(),由调用方择时起停(回放/动画用)。
 *
 * 「墙钟域」不许走这里:坊市货架/寄卖与弟子跑腿按墙钟结算(离线照算,App.vue
 * 归来一拍即收也是墙钟口径)—— 暂停几分钟不该让货架晚一点换新、弟子晚一步归来,
 * 那两处保留手写 Date.now() 的 interval,语义见 MarketView / ApprenticeView 各自注释。
 */
import { onMounted, onUnmounted } from "vue";
import { enginePaused } from "@/core/enginePause";

/** 命令式游戏时钟:起一枚暂停可冻结的 interval,返回收表函数 */
export function gameClock(cb: () => void, intervalMs = 1000): () => void {
  const timer = setInterval(() => {
    // 心跳停着(重置确认 / 导入确认)就冻结:与 useNow 同一条口径
    if (enginePaused.value) return;
    cb();
  }, intervalMs);
  return () => clearInterval(timer);
}

/** 组合式游戏时钟:挂载即起表、卸载即收表 */
export function useGameClock(cb: () => void, intervalMs = 1000): void {
  let stop: (() => void) | undefined;
  onMounted(() => {
    stop = gameClock(cb, intervalMs);
  });
  onUnmounted(() => stop?.());
}
