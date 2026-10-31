import {
  NAVIGATION_ENTRIES,
  NAVIGATION_SECTIONS,
  navigationPositionOf,
  type NavigationEntry,
} from "./navigation";

/** 当前路由落在哪一卷；未入册时回第一卷，玄枢图打开后总有可跳之处。 */
export function atlasSectionIdForRoute(name: string | symbol | null | undefined): string {
  return navigationPositionOf(name)?.section.id ?? NAVIGATION_SECTIONS[0]!.id;
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
 * 玄枢图寻册 —— 同一份十七册目录的另一种读法。
 *
 * 玩家记不住正式册名:底栏叫「背包」,册页写「行囊」;人物页在玄枢图里叫「道躯」。
 * 因此关键词跟着册目一起维护,搜索只做归一化与逐词包含,不另建路由表。多个词以空格
 * 分开时要求全部命中,例如「天机 道果」仍能落到轮回录。
 */
export function atlasSearchEntries(query: string): NavigationEntry[] {
  const tokens = searchText(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return [];
  return NAVIGATION_ENTRIES.filter((entry) => {
    const haystack = searchText(
      [
        entry.name,
        entry.label,
        entry.shortLabel,
        entry.description,
        entry.sectionLabel,
        ...entry.keywords,
      ].join(" "),
    );
    return tokens.every((token) => haystack.includes(token));
  });
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
