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
  /** 书口签上的短名,只用于窄条导航,不替代完整册名 */
  shortLabel: string;
  /** 一句话说明这一册回答什么问题 */
  description: string;
  /** 水墨图标名,必须已登记在 ui/inkIcons */
  icon: string;
  /** 路由地址 */
  to: string;
  /** 所属分卷 */
  sectionLabel: string;
  /** 玩家会怎么说这一册 —— 只供玄枢图寻册,不另造导航事实 */
  keywords: readonly string[];
  /** 这一册内可直达的分册;没有分册的页面留空 */
  chapters: readonly NavigationChapter[];
}

export interface NavigationChapter {
  /** 路由 query 里的 tab 值 */
  id: string;
  /** 书口签上的分册名 */
  label: string;
  /** 分册回答什么问题 */
  description: string;
  /** 玩家会怎么找这一分册 */
  keywords: readonly string[];
}

export interface NavigationSection {
  id: string;
  label: string;
  hint: string;
  entries: readonly NavigationEntry[];
}

type EntrySeed = Omit<NavigationEntry, "sectionLabel">;

export const INVENTORY_CHAPTERS = [
  {
    id: "equip",
    label: "装备",
    description: "九处装配、换装与共鸣",
    keywords: ["装备", "武器", "防具", "换装", "共鸣"],
  },
  {
    id: "pill",
    label: "丹药",
    description: "丹匣、药效与开炉",
    keywords: ["丹药", "丹方", "开炉", "药效", "炼丹"],
  },
  {
    id: "material",
    label: "材料",
    description: "灵草、矿材与杂项",
    keywords: ["材料", "灵草", "矿材", "素材"],
  },
  {
    id: "artifact",
    label: "法宝",
    description: "随身法宝与器魂",
    keywords: ["法宝", "器魂", "器灵"],
  },
] as const satisfies readonly NavigationChapter[];

export const COLLECTION_CHAPTERS = [
  {
    id: "achievement",
    label: "成就",
    description: "功名条件与达成进度",
    keywords: ["成就", "功名", "奖赏", "达成"],
  },
  {
    id: "collection",
    label: "收藏",
    description: "图鉴、灵材与见闻",
    keywords: ["收藏", "图鉴", "灵材", "见闻"],
  },
] as const satisfies readonly NavigationChapter[];

export const CODEX_CHAPTERS = [
  {
    id: "realm",
    label: "界域",
    description: "四界二十一境的境界谱",
    keywords: ["界域", "境界", "境界谱", "修为"],
  },
  {
    id: "classics",
    label: "典籍",
    description: "功法名目与残页",
    keywords: ["典籍", "功法", "残页", "秘籍"],
  },
  {
    id: "yi",
    label: "周易",
    description: "六十四卦与在身卦象",
    keywords: ["周易", "问卦", "卦象", "六十四卦"],
  },
  {
    id: "ziwei",
    label: "紫微",
    description: "命盘、星曜与宫位",
    keywords: ["紫微", "命盘", "星曜", "斗数"],
  },
  {
    id: "xiang",
    label: "星象",
    description: "天时、星图与星象",
    keywords: ["星象", "天象", "星图"],
  },
  {
    id: "qimen",
    label: "奇门",
    description: "八门、九星与择门",
    keywords: ["奇门", "八门", "九星", "择门"],
  },
] as const satisfies readonly NavigationChapter[];

export const CELESTIAL_CHAPTERS = [
  {
    id: "dao",
    label: "道途",
    description: "七道择一与本世道途",
    keywords: ["道途", "七道", "选道", "天道"],
  },
  {
    id: "exped",
    label: "远征",
    description: "在途远征、择路与归来",
    keywords: ["远征", "出征", "择路", "归来"],
  },
  {
    id: "trial",
    label: "试炼",
    description: "每日天道与试炼",
    keywords: ["试炼", "每日", "天道", "挑战"],
  },
  {
    id: "marks",
    label: "道痕",
    description: "天界道痕与终局记录",
    keywords: ["道痕", "天界", "终局"],
  },
] as const satisfies readonly NavigationChapter[];

export const TITLES_CHAPTERS = [
  {
    id: "title",
    label: "名号",
    description: "称号、佩戴与取得进度",
    keywords: ["名号", "称号", "头衔", "佩戴", "身份"],
  },
  {
    id: "pet",
    label: "灵兽",
    description: "灵兽名谱、伴行与结契",
    keywords: ["灵兽", "宠物", "伴行", "结契"],
  },
] as const satisfies readonly NavigationChapter[];

export const LEGACY_CHAPTERS = [
  {
    id: "samsara",
    label: "轮回",
    description: "本世命题、宿慧与随世所知",
    keywords: ["轮回", "转世", "宿慧", "道果", "本世"],
  },
  {
    id: "journey",
    label: "征程",
    description: "修行节点与宿敌",
    keywords: ["征程", "节点", "宿敌", "历练"],
  },
  {
    id: "fate",
    label: "缘迹",
    description: "未了奇缘与行迹",
    keywords: ["缘迹", "奇缘", "行迹", "旧缘"],
  },
  {
    id: "record",
    label: "纪录",
    description: "跨世纪录与旧世归档",
    keywords: ["纪录", "记录", "旧世", "归档"],
  },
] as const satisfies readonly NavigationChapter[];

export const MARKET_CHAPTERS = [
  {
    id: "shelf",
    label: "货架",
    description: "今日货架与购置",
    keywords: ["货架", "商店", "购买", "买货"],
  },
  {
    id: "bounty",
    label: "悬赏",
    description: "收购订单与交货",
    keywords: ["悬赏", "收购", "订单", "交货"],
  },
  {
    id: "sell",
    label: "售出",
    description: "寄卖旧物与即时回收",
    keywords: ["售出", "寄卖", "回收", "卖货"],
  },
] as const satisfies readonly NavigationChapter[];

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
      shortLabel: "洞府",
      description: "今日天时、主线与日课",
      icon: "mountain",
      to: "/",
      keywords: ["首页", "总览", "今日", "主线", "日课"],
      chapters: [],
    },
    {
      name: "cultivation",
      label: "修炼",
      shortLabel: "修炼",
      description: "吐纳、破境与渡劫",
      icon: "flame",
      to: "/cultivation",
      keywords: ["修行", "练功", "境界", "突破", "破境", "渡劫", "功法"],
      chapters: [],
    },
    {
      name: "character",
      label: "道躯",
      shortLabel: "道躯",
      description: "属性、灵根与传承",
      icon: "circle-user",
      to: "/character",
      keywords: ["人物", "属性", "灵根", "战斗", "战力", "成就"],
      chapters: [],
    },
  ]),
  section("estate", "道场", "家业、人事与周转", [
    {
      name: "dongfu",
      label: "营造",
      shortLabel: "营造",
      description: "建筑、灵脉与家底",
      icon: "home",
      to: "/dongfu",
      keywords: ["洞府", "建筑", "灵脉", "家", "离线"],
      chapters: [],
    },
    {
      name: "apprentice",
      label: "门庭",
      shortLabel: "门庭",
      description: "弟子差事与归来",
      icon: "user",
      to: "/apprentice",
      keywords: ["弟子", "门人", "差事", "派遣"],
      chapters: [],
    },
    {
      name: "market",
      label: "坊市",
      shortLabel: "坊市",
      description: "灵石、药材与寄卖",
      icon: "gem",
      to: "/market",
      keywords: ["交易", "商店", "货架", "悬赏", "寄卖", "买", "卖"],
      chapters: MARKET_CHAPTERS,
    },
  ]),
  section("journey", "行旅", "山河、地界与所往", [
    {
      name: "adventure",
      label: "历练",
      shortLabel: "历练",
      description: "地界、秘境与战斗",
      icon: "swords",
      to: "/adventure",
      keywords: ["战斗", "秘境", "地图", "出发", "历练"],
      chapters: [],
    },
    {
      name: "world",
      label: "人间",
      shortLabel: "人间",
      description: "本世山河与路线",
      icon: "trees",
      to: "/world",
      keywords: ["山河", "凡界", "人间", "地界", "换界", "路线"],
      chapters: [],
    },
    {
      name: "codex",
      label: "界域志",
      shortLabel: "界域",
      description: "境界、典籍与术数",
      icon: "scroll",
      to: "/codex",
      keywords: ["图鉴", "境界", "典籍", "周易", "紫微", "星象", "奇门"],
      chapters: CODEX_CHAPTERS,
    },
  ]),
  section("belongings", "身外", "器、药、魂与藏珍", [
    {
      name: "inventory",
      label: "行囊",
      shortLabel: "行囊",
      description: "装备、丹药与材料",
      icon: "backpack",
      to: "/inventory",
      keywords: ["背包", "行囊", "装备", "丹药", "材料", "物品", "道具"],
      chapters: INVENTORY_CHAPTERS,
    },
    {
      name: "collection",
      label: "藏珍",
      shortLabel: "藏珍",
      description: "法宝、灵兽与成就",
      icon: "book",
      to: "/collection",
      keywords: ["图鉴", "法宝", "灵兽", "宠物", "成就", "收藏"],
      chapters: COLLECTION_CHAPTERS,
    },
    {
      name: "souls",
      label: "器魂",
      shortLabel: "器魂",
      description: "凝炼、装配与形意",
      icon: "sparkles",
      to: "/souls",
      keywords: ["器灵", "法宝", "魂魄", "凝炼", "装备"],
      chapters: [],
    },
  ]),
  section("fate", "天机", "跨世的道途与选择", [
    {
      name: "celestial",
      label: "天界",
      shortLabel: "天界",
      description: "道途、远征与试炼",
      icon: "cloud",
      to: "/celestial",
      keywords: ["天界", "远征", "试炼", "道途", "天道", "神仙"],
      chapters: CELESTIAL_CHAPTERS,
    },
    {
      name: "build",
      label: "构筑",
      shortLabel: "构筑",
      description: "流派、词条与模拟",
      icon: "hammer",
      to: "/build",
      keywords: ["流派", "配置", "build", "契合", "词条", "构筑"],
      chapters: [],
    },
    {
      name: "titles",
      label: "名号",
      shortLabel: "名号",
      description: "身份、称号与灵兽",
      icon: "crown",
      to: "/titles",
      keywords: ["称号", "身份", "头衔", "灵兽", "宠物", "名号"],
      chapters: TITLES_CHAPTERS,
    },
    {
      name: "legacy",
      label: "轮回录",
      shortLabel: "轮回",
      description: "历世、道果与遗产",
      icon: "watch",
      to: "/legacy",
      keywords: ["转世", "轮回", "道果", "宿慧", "前世", "历世"],
      chapters: LEGACY_CHAPTERS,
    },
    {
      name: "settings",
      label: "设置",
      shortLabel: "设置",
      description: "声音、主题与存档",
      icon: "settings",
      to: "/settings",
      keywords: ["存档", "音乐", "音效", "主题", "隐私", "导入", "导出"],
      chapters: [],
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
