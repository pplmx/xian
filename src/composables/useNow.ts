/** 每秒刷新的当前时间(供倒计时类 UI 使用) —— 守卫收口到 useGameClock(暂停冻结) */
import { ref, type Ref } from "vue";
import { useGameClock } from "./useGameClock";

export function useNow(intervalMs = 1000): Ref<number> {
  const now = ref(Date.now());
  useGameClock(() => {
    // Heart stopped (reset confirm / import): keep the last reading so
    // countdowns do not run to 0 while settle is skipped.
    now.value = Date.now();
  }, intervalMs);
  return now;
}
