import { computed } from "vue";
import { breakthroughInfo } from "@/core/breakthrough";
import { useInventoryStore } from "@/stores/inventory";

/**
 * 导航层要报的两件事：背包有新货、此刻可以破境。
 *
 * 手机底栏与桌面书脊都从这一处取，避免宽屏换了一套壳之后提醒忽然消失，
 * 也避免两边各算一套「大概够了吧」。
 */
export function useNavigationSignals() {
  const bagNewCount = computed(() => useInventoryStore().newItemCount);
  const canBreakthrough = computed(() => breakthroughInfo().ready);
  return { bagNewCount, canBreakthrough };
}
