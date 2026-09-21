/** 每秒刷新的当前时间(供倒计时类 UI 使用) */
import { onMounted, onUnmounted, ref, type Ref } from 'vue'
import { enginePaused } from '@/core/enginePause'

export function useNow(intervalMs = 1000): Ref<number> {
  const now = ref(Date.now())
  let timer: number | undefined
  onMounted(() => {
    timer = window.setInterval(() => {
      // Heart stopped (reset confirm / import): keep the last reading so
      // countdowns do not run to 0 while settle is skipped.
      if (enginePaused.value) return
      now.value = Date.now()
    }, intervalMs)
  })
  onUnmounted(() => {
    if (timer !== undefined) window.clearInterval(timer)
  })
  return now
}
