import { ref, watch, type Ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { NavigationChapter } from "@/ui/navigation";

function tabFromQuery(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * 分册选中态与 `?tab=` 共用一条路。
 *
 * 玄枢图可以直接把「周易」「灵兽」「悬赏」寻到分册,页面内换签后地址也要跟着走;
 * 否则刷新或从历史返回时又会落回第一册。分册清单由 navigation.ts 提供,这里只做
 * 查询串与选中态的薄接线。
 */
export function useRouteTab<const C extends readonly NavigationChapter[]>(
  chapters: C,
  fallback: C[number]["id"],
): Ref<C[number]["id"]> {
  type Tab = C[number]["id"];
  const route = useRoute();
  const router = useRouter();
  const allowed = new Set(chapters.map((chapter) => chapter.id));
  const fromQuery = tabFromQuery(route.query.tab);
  const tab = ref<Tab>((allowed.has(fromQuery) ? fromQuery : fallback) as Tab) as Ref<Tab>;

  watch(
    () => route.query.tab,
    (value) => {
      const next = tabFromQuery(value);
      // 回到无 query 的分册页(或地址里的 tab 写坏)时也要回默认册;
      // 否则从「奇门」点回 /codex 会继续停在奇门,与地址和导航落点不一致。
      tab.value = (allowed.has(next) ? next : fallback) as Tab;
    },
  );

  watch(tab, (next) => {
    if (tabFromQuery(route.query.tab) === next) return;
    void router.replace({
      query: {
        ...route.query,
        tab: next,
      },
    });
  });

  return tab;
}
