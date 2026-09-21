/**
 * Heartbeat pause flag — kept in its own module so UI / early-game windows
 * can read it without importing the engine (which would cycle:
 * engine → earlyGameService → engine).
 *
 * Expiry that is stamped as wall-clock must use `gameNow()`, not `Date.now()`:
 * while paused, "now" freezes at pause start so a reset-confirm dialog cannot
 * dissolve a hexagram, clear a region event, or flip breakthrough prep to ready.
 */
import { readonly, ref } from 'vue'

const pausedRef = ref(false)
let pauseStartedAt = 0

export const enginePaused = readonly(pausedRef)

export function setEnginePaused(value: boolean): void {
  if (value) {
    if (!pausedRef.value) pauseStartedAt = Date.now()
    pausedRef.value = true
    return
  }
  pausedRef.value = false
  pauseStartedAt = 0
}

/** Wall clock for in-flight expiry: frozen at pause start. */
export function gameNow(): number {
  return pausedRef.value && pauseStartedAt > 0 ? pauseStartedAt : Date.now()
}

export function pauseElapsedMs(now = Date.now()): number {
  if (!pausedRef.value || pauseStartedAt <= 0) return 0
  return Math.max(0, now - pauseStartedAt)
}
