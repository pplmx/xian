import {
  NAVIGATION_ENTRIES,
  NAVIGATION_SECTIONS,
  navigationPositionOf,
  type NavigationChapter,
  type NavigationEntry,
} from "./navigation";

export interface AtlasSearchResult {
  key: string;
  entry: NavigationEntry;
  /** 有值表示这是册内分册;没值表示整册入口 */
  chapter?: NavigationChapter;
  label: string;
  description: string;
  to: string;
}

/** 当前路由落在哪一卷；未入册时回第一卷，玄枢图打开后总有可跳之处。 */
export function atlasSectionIdForRoute(name: string | symbol | null | undefined): string {
  return navigationPositionOf(name)?.section.id ?? NAVIGATION_SECTIONS[0]!.id;
}

/**
 * 玄枢图打开后的首焦点。
 *
 * 桌面有实体指针与键盘,直接落到寻册口最省一步;触屏若也这么做,开图瞬间会弹起
 * 软键盘并遮住五卷与当前卷册。触屏先落当前卷签,既保留可见焦点,也让寻册只隔一次
 * Shift+Tab / 轻点。
 */
export function atlasInitialFocusOf(finePointer: boolean): string {
  return finePointer ? "[data-atlas-search]" : '[data-atlas-volume][aria-selected="true"]';
}

/**
 * 五卷快引的键盘游标。
 *
 * 左/右循环，Home/End 落到两端；其余按键原样返回，交给浏览器处理。
 * 单独抽成纯函数，避免组件里再手写一套与卷数绑死的分支。
 */
export function atlasJumpIndex(current: number, key: string, count: number): number {
  if (count <= 0) return -1;
  const index = Math.max(0, Math.min(count - 1, Number.isFinite(current) ? current : 0));
  if (key === "ArrowLeft") return (index - 1 + count) % count;
  if (key === "ArrowRight") return (index + 1) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return index;
}

function searchText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("zh-CN").replace(/\s+/g, " ").trim();
}

/**
 * 玄枢图寻册 —— 同一份十七册目录与册内分册的另一种读法。
 *
 * 玩家记不住正式册名:底栏叫「背包」,册页写「行囊」;人物页在玄枢图里叫「道躯」。
 * 因此关键词跟着册目与分册一起维护,搜索只做归一化与逐词包含,不另建路由表。
 * 分册命中优先落到 `?tab=`,没有分册命中时再落到整册;多个词以空格分开时要求
 * 全部命中,例如「天机 道果」仍能落到轮回录。
 */
export function atlasSearchResults(query: string): AtlasSearchResult[] {
  const tokens = searchText(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return [];
  const matches = (parts: readonly string[]): boolean => {
    const haystack = searchText(parts.join(" "));
    return tokens.every((token) => haystack.includes(token));
  };
  const results: AtlasSearchResult[] = [];

  for (const entry of NAVIGATION_ENTRIES) {
    const chapterHits = entry.chapters.filter((chapter) =>
      matches([chapter.id, chapter.label, chapter.description, ...chapter.keywords]),
    );
    if (chapterHits.length > 0) {
      for (const chapter of chapterHits) {
        results.push({
          key: `${entry.name}:${chapter.id}`,
          entry,
          chapter,
          label: chapter.label,
          description: chapter.description,
          to: `${entry.to}?tab=${encodeURIComponent(chapter.id)}`,
        });
      }
      continue;
    }

    if (
      matches([
        entry.name,
        entry.label,
        entry.shortLabel,
        entry.description,
        entry.sectionLabel,
        ...entry.keywords,
      ])
    ) {
      results.push({
        key: entry.name,
        entry,
        label: entry.label,
        description: entry.description,
        to: entry.to,
      });
    }
  }

  return results;
}

/** 寻册结果的当前游标播报：视觉提示与 aria-live 共用同一句。 */
export function atlasSearchStatusOf(
  result: AtlasSearchResult | undefined,
  index: number,
  total: number,
): string {
  if (!result || total <= 0) return "";
  const ordinal = `${Math.max(0, Math.min(total - 1, index)) + 1}/${total} 处`;
  const chapter = result.chapter ? ` · ${result.chapter.label}` : "";
  return `找到 ${total} 处 · 第 ${ordinal}：${result.entry.sectionLabel}卷 · ${result.entry.label}${chapter}，回车前往`;
}

type AtlasShortcutEvent = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">;

/** Ctrl+K(Windows/Linux)与 ⌘K(macOS)共用一条寻册命令。 */
export function isAtlasShortcut(event: AtlasShortcutEvent): boolean {
  return (
    event.key.toLocaleLowerCase("en-US") === "k" &&
    !event.altKey &&
    (event.ctrlKey || event.metaKey)
  );
}

/** 书脊上的提示跟平台走,别在 Windows 上摆一枚按不出的 ⌘。 */
export function atlasShortcutHintOf(platform: string): string {
  return /mac|iphone|ipad|ipod/i.test(platform) ? "⌘ K" : "Ctrl K";
}
