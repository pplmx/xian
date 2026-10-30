/**
 * 玄枢图 —— 全站册目的唯一事实源。
 *
 * 底栏只容得下五个最常用的去处;洞府营造、坊市、天界、器魂这些同样常开的页面
 * 若只藏在人物页的入口卡里,玩家得先记住「谁把谁收在哪」。这里把已开的十七册
 * 按「修行 / 道场 / 行旅 / 身外 / 天机」归卷,顶栏的玄枢图与册目说明同读一份。
 */
export interface NavigationEntry {
  /** 路由名,与 router/index.ts 的 name 对齐 */
  name: string;
  /** 册名,显示在玄枢图里 */
  label: string;
  /** 一句话说明这一册回答什么问题 */
  description: string;
  /** 水墨图标名,必须已登记在 ui/inkIcons */
  icon: string;
  /** 路由地址 */
  to: string;
  /** 所属分卷 */
  sectionLabel: string;
}

export interface NavigationSection {
  id: string;
  label: string;
  hint: string;
  entries: readonly NavigationEntry[];
}

type EntrySeed = Omit<NavigationEntry, "sectionLabel">;

function section(
  id: string,
  label: string,
  hint: string,
  entries: readonly EntrySeed[],
): NavigationSection {
  return {
    id,
    label,
    hint,
    entries: entries.map((entry) => ({ ...entry, sectionLabel: label })),
  };
}

export const NAVIGATION_SECTIONS: readonly NavigationSection[] = [
  section("practice", "修行", "此刻的道躯与修为", [
    {
      name: "home",
      label: "洞府总览",
      description: "今日天时、主线与日课",
      icon: "mountain",
      to: "/",
    },
    {
      name: "cultivation",
      label: "修炼",
      description: "吐纳、破境与渡劫",
      icon: "flame",
      to: "/cultivation",
    },
    {
      name: "character",
      label: "道躯",
      description: "属性、灵根与传承",
      icon: "circle-user",
      to: "/character",
    },
  ]),
  section("estate", "道场", "家业、人事与周转", [
    {
      name: "dongfu",
      label: "营造",
      description: "建筑、灵脉与家底",
      icon: "home",
      to: "/dongfu",
    },
    {
      name: "apprentice",
      label: "门庭",
      description: "弟子差事与归来",
      icon: "user",
      to: "/apprentice",
    },
    {
      name: "market",
      label: "坊市",
      description: "灵石、药材与寄卖",
      icon: "gem",
      to: "/market",
    },
  ]),
  section("journey", "行旅", "山河、地界与所往", [
    {
      name: "adventure",
      label: "历练",
      description: "地界、秘境与战斗",
      icon: "swords",
      to: "/adventure",
    },
    {
      name: "world",
      label: "人间",
      description: "本世山河与路线",
      icon: "trees",
      to: "/world",
    },
    {
      name: "codex",
      label: "界域志",
      description: "境界、典籍与术数",
      icon: "scroll",
      to: "/codex",
    },
  ]),
  section("belongings", "身外", "器、药、魂与藏珍", [
    {
      name: "inventory",
      label: "行囊",
      description: "装备、丹药与材料",
      icon: "backpack",
      to: "/inventory",
    },
    {
      name: "collection",
      label: "藏珍",
      description: "法宝、灵兽与成就",
      icon: "book",
      to: "/collection",
    },
    {
      name: "souls",
      label: "器魂",
      description: "凝炼、装配与形意",
      icon: "sparkles",
      to: "/souls",
    },
  ]),
  section("fate", "天机", "跨世的道途与选择", [
    {
      name: "celestial",
      label: "天界",
      description: "道途、远征与试炼",
      icon: "cloud",
      to: "/celestial",
    },
    {
      name: "build",
      label: "构筑",
      description: "流派、词条与模拟",
      icon: "hammer",
      to: "/build",
    },
    {
      name: "titles",
      label: "名号",
      description: "身份、称号与灵兽",
      icon: "crown",
      to: "/titles",
    },
    {
      name: "legacy",
      label: "轮回录",
      description: "历世、道果与遗产",
      icon: "watch",
      to: "/legacy",
    },
    {
      name: "settings",
      label: "设置",
      description: "声音、主题与存档",
      icon: "settings",
      to: "/settings",
    },
  ]),
] as const;

export const NAVIGATION_ENTRIES: readonly NavigationEntry[] = NAVIGATION_SECTIONS.flatMap(
  (group) => group.entries,
);

export interface NavigationPosition {
  /** 所属分卷 */
  section: NavigationSection;
  /** 当前册目 */
  entry: NavigationEntry;
  /** 分卷在玄枢图中的零基序号 */
  sectionIndex: number;
  /** 册目在本卷中的零基序号 */
  entryIndex: number;
}

const POSITION_BY_NAME = new Map<string, NavigationPosition>(
  NAVIGATION_SECTIONS.flatMap((section, sectionIndex) =>
    section.entries.map((entry, entryIndex) => [
      entry.name,
      { section, entry, sectionIndex, entryIndex },
    ]),
  ),
);

/** 路由名 → 卷次、册次与册目本身。所有「第几卷 / 第几册」都从这里取。 */
export function navigationPositionOf(
  name: string | symbol | null | undefined,
): NavigationPosition | undefined {
  return typeof name === "string" ? POSITION_BY_NAME.get(name) : undefined;
}
