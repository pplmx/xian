import { onMounted, onUnmounted, ref } from "vue";

/** 当前环境是否满足一条媒体查询；无 window / 无 matchMedia 时安全回落 false。 */
export function mediaMatches(query: string): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(query).matches
  );
}

/**
 * 跟随一条媒体查询的响应式结果。
 *
 * 只留给「不同屏宽下该不该挂载」这类结构性差异；纯视觉换肤继续交给 CSS，
 * 避免把同一套断点抄成两份事实。
 */
export function useMediaQuery(query: string) {
  const matches = ref(mediaMatches(query));
  let list: MediaQueryList | undefined;

  const sync = (event?: MediaQueryListEvent): void => {
    matches.value = event?.matches ?? list?.matches ?? mediaMatches(query);
  };

  onMounted(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    list = window.matchMedia(query);
    sync();
    list.addEventListener("change", sync);
  });

  onUnmounted(() => {
    list?.removeEventListener("change", sync);
  });

  return matches;
}
