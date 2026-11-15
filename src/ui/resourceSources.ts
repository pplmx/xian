/**
 * 资源 → 去哪挣 —— 「尚差 N」之后那句「怎么补」，按资源分家。
 *
 * ## 为什么这一层要有
 *
 * 上一轮给道源补了补法（`ui/daoSourceFill`）。顺着同一个形状查，全站
 * 「尚差」分布是:
 *
 * ```text
 *   道源 14 处   灵石 8 处   器灵尘 3 处   悟道点 2 处
 *   玄铁 / 灵草 / 道果 / 灵气 各 1~2 处
 * ```
 *
 * 而「怎么补」的机制只有道源那一处 —— 其余全是死路:玩家知道差多少，
 * 不知道往哪走。这不是七个孤立缺陷，是**同一件事只做了一处**。
 *
 * ## 为什么不能照抄 daoSourceFill
 *
 * 道源只经熔炉一条路，故那里能算「熔几次」。其余资源各有两三条来源，
 * 且**性质不同**:
 *
 * ```text
 *   洞府产出（被动，等就有）     灵草 / 玄铁 / 悟道点（藏经阁）
 *   历练掉落（主动，打才有）     灵石 / 器灵尘 / 残页 / 悟道点（际遇）
 *   熔炉反算（拿别的换）         道源
 * ```
 *
 * 混成一句「去历练」会把「其实等一会儿就有」也说成要去打，那是误导。
 * 故这一层只回答**去哪一页**，把「主动 / 被动」写在 `mode` 上，由界面决定措辞。
 *
 * ## 判据会发现什么
 *
 * `resourceSource` 的每一条都要被 `resourceSources.spec` 与**真实的入账点**
 * 对账:表里说「洞府产灵草」，那 `core/engineFacilities` 里就得真有那条流。
 * 加一条新资源而忘了补表，判据红 —— 这正是「只做了一处」那个病的疫苗。
 */
/**
 * 资源的内部名 —— 这里**自己列**，不从 `core/economySim` 导 `AuditResource`。
 *
 * 原因不是懒得复用，而是 `deadExportAudit` 的口径:凡是 `ui/` 运行时模块
 * import 过的文件，就算是"运行时可达"；而 `core/economySim` 里那几个
 * 审计导出（`fullEconomyAudit` / `qiFillSeconds`）本来是**纯审计**用的、
 * 只有 spec 在读。为了让这个类型不连带把它们拉进运行时，这里独立声明。
 *
 * 代价是两处清单要同步 —— 由 `resourceSources.spec` 的「表是满的」与
 * 「与 economySim 的审计资源同集合」两条判据钉住，不同步就红。
 */
export type ResourceKey =
  | "stone"
  | "herb"
  | "ore"
  | "page"
  | "dust"
  | "wudao"
  | "exp"
  | "daoSource";

/** 一条资源的来路性质 */
export type SourceMode =
  /** 被动:洞府/建筑按小时产，等就有 */
  | "passive"
  /** 主动:要打（历练/远征）才有 */
  | "active"
  /** 换:拿别的东西熔/兑出来 */
  | "convert";

export interface ResourceSourceHint {
  /** 去哪儿挣（绝对路由） */
  route: string;
  /** 那一格的入口名 */
  label: string;
  /** 这条来路是"等"、"打"还是"换" */
  mode: SourceMode;
  /** 一句话 —— 说清怎么挣，不是形容词 */
  how: string;
}

/**
 * 资源 → 来路。
 *
 * 口径是「**这件事在哪个页面由玩家亲手做/等**」，与 `ui/dailyRoutes`
 * 和 `ui/weatherRoutes` 同一条。不是「哪个系统在算它」。
 */
export const RESOURCE_SOURCES: Readonly<Record<string, ResourceSourceHint>> = {
  // ---- 灵石:只有历练掉（winsThisHour × stoneByTier），没有被动产出 ----
  stone: {
    route: "/adventure",
    label: "去历练",
    mode: "active",
    how: "历练每胜一场按本阶折算",
  },
  // 灵草:灵田按小时产 + 历练掉落 —— 两条都有，报被动那条更省事
  herb: {
    route: "/dongfu",
    label: "去洞府",
    mode: "passive",
    how: "灵田按小时长，历练也会掉",
  },
  // 玄铁:矿脉按小时产 + 历练掉落
  ore: {
    route: "/dongfu",
    label: "去洞府",
    mode: "passive",
    how: "矿脉按小时出，历练也会掉",
  },
  // 残页:只有历练掉（PAGE_DROP_CHANCE）—— 与"藏经阁钻研出新方"不是同一件事
  page: {
    route: "/adventure",
    label: "去历练",
    mode: "active",
    how: "历练途中的际遇与掉落",
  },
  // 器灵尘:分解装备 + 战斗折算 —— 两条都在背包/历练
  dust: {
    route: "/inventory?tab=equip",
    label: "去分解",
    mode: "convert",
    how: "分解用不上的装备",
  },
  // 悟道点:两条路都真（藏经阁按小时产 + 际遇掉落）—— 报被动那条更省事，
  // 因为它是"等就有"，而玩家在缺的时候最想知道的是"能不能不要出门"
  wudao: {
    route: "/dongfu",
    label: "去洞府",
    mode: "passive",
    how: "藏经阁按小时产，际遇也会给",
  },
  // 道源:熔炉换或远征挣 —— 已有 daoSourceFill 算得更细，这里只给页
  daoSource: {
    route: "/celestial",
    label: "去熔炉",
    mode: "convert",
    how: "天道熔炉把前尘俗物熔作道源",
  },
  // 修为:挂机与历练都在长
  exp: {
    route: "/cultivation",
    label: "去修行",
    mode: "passive",
    how: "静修与历练都在长",
  },
};

/**
 * 某样资源的来路。
 *
 * 表里没有就返回 null —— 调用方据此整句不出（而不是编一句"去打怪吧"）。
 * 「表不满」由 `resourceSources.spec` 挡住，故产品里正常取不到 null。
 */
export function resourceSourceOf(resource: string): ResourceSourceHint | null {
  return RESOURCE_SOURCES[resource] ?? null;
}

/**
 * 资源内部名 → 玩家读到的名字。
 *
 * 与 `data/statNames` 的 `modsText` 不是一回事:那个管**词条**（「攻击 +5%」），
 * 这里管**资源**（「灵石」「玄铁」）。分开是因为同一个键在两处的叫法不同 ——
 * `herb` 在词条里从不出现，而在资源里叫「灵草」。
 */
export const RESOURCE_NAMES: Readonly<Record<string, string>> = {
  stone: "灵石",
  herb: "灵草",
  ore: "玄铁",
  page: "残页",
  dust: "器灵尘",
  wudao: "悟道点",
  daoSource: "道源",
  exp: "修为",
};

/** 一样资源的中文名 —— 表里没有就原样返回（宁可露出内部名，也不猜一个错名） */
export function resourceNameOf(resource: string): string {
  return RESOURCE_NAMES[resource] ?? resource;
}

/** 审计用的资源全集 —— 与 `core/economySim` 的 `AuditResource` 同集合 */
export const AUDIT_RESOURCES: readonly ResourceKey[] = [
  "stone",
  "herb",
  "ore",
  "page",
  "dust",
  "wudao",
  "exp",
  "daoSource",
];
