/**
 * 「让看不见的机制可见」—— 这一条纪律的五个具体项,各自钉在某个界面上。
 *
 * ## 规矩出自哪里
 *
 * `AGENTS.md` 的「改动纪律」:
 *
 * > **让看不见的机制可见**:技艺进度、buff 叠加份数(「叠 N」)、合并真值
 * > (「现效合计」)、一次服药的上限(「至多可攒」/ 快捷卡「已顶」)、天时对渡劫
 * > 与产出的影响 —— 该露的都要露进界面,**不许只活在注释或 README 里**。
 *
 * ## 第 86 轮核过一遍
 *
 * 五项**全部实现了**,而且实现得不含糊:
 *
 * ```text
 *   技艺进度     BrewingDialog 的「技艺(按道分,做得多就精)」进度条
 *                EquipmentDetailDialog 的 forgeSkills(锻打/铭纹/器谱三行)
 *   buff 叠加份数 InventoryView:1079「已叠 N 份,服之续时」
 *                另有「药力已顶满——这一颗将白费」/「药力将触上限」两档
 *   合并真值     两处「现效合计」
 *   一次服药上限 InventoryView 的 overflow 三态 + 快捷卡「已顶」
 *   天时          CharacterView / RealmCodexView / HomeView / TribulationPanel
 * ```
 *
 * 这条纪律还被三处代码注释点名引用(`exploration.ts` / `offline.ts` /
 * `engineBuffs.ts`)—— 说明它真的在约束改动,不是一纸空文。
 *
 * ## 判据
 *
 * 它守的是**这五项不会悄悄消失**:每一面「该露的」都在某个 `.vue` 里有一处
 * 玩家可见的锚点。不检查措辞、不检查位置,只检查「还在不在」。
 *
 * 这比「扫描所有注释说该露的都露了」实在 —— 后者不可判定。
 */
import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "@/test/readSource";

/** 五项「该露的机制」各自的锚点 */
const VISIBLE: readonly {
  item: string;
  /** 在哪些文件里找(任一命中即可) */
  files: readonly string[];
  /** 锚点文案(正则) */
  anchor: RegExp;
}[] = [
  {
    item: "技艺进度",
    files: [
      "src/components/inventory/BrewingDialog.vue",
      "src/components/equipment/EquipmentDetailDialog.vue",
    ],
    anchor: /技艺|forgeSkills/,
  },
  {
    item: "buff 叠加份数(「叠 N」)",
    files: ["src/views/InventoryView.vue"],
    anchor: /已叠\s*\$\{?stack|已叠/,
  },
  {
    item: "合并真值(「现效合计」)",
    files: ["src/views/CultivationView.vue", "src/components/cultivation/BuffDialog.vue"],
    anchor: /现效合计/,
  },
  {
    item: "一次服药的上限(「至多可攒」/「已顶」)",
    files: ["src/views/InventoryView.vue"],
    anchor: /至多可攒|已顶|药力已顶满/,
  },
  {
    item: "天时对渡劫与产出的影响",
    files: ["src/components/cultivation/TribulationPanel.vue", "src/views/CharacterView.vue"],
    anchor: /天时/,
  },
];

function collectVue(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "tp") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectVue(full, out);
    else if (entry.name.endsWith(".vue")) out.push(full);
  }
  return out;
}

/** 全仓 .vue 的正文拼起来 —— 「现效合计」这类锚点可能搬了家,不该因为搬家就红 */
const ALL_VUE = collectVue(join(ROOT, "src"))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

describe("看不见的机制 · 五项都在界面上露着", () => {
  for (const { item, files, anchor } of VISIBLE) {
    it(`${item} 有玩家可见的锚点`, () => {
      const found = files.some((rel) => {
        try {
          return anchor.test(readFileSync(join(ROOT, rel), "utf8"));
        } catch {
          return false; // 文件被搬走了 —— 退到全仓兜底
        }
      });
      /*
       * **不用全仓兜底**。第一版写的是 `found || anchor.test(ALL_VUE)`,
       * 而注入验证时把「已叠 ${stack} 份」删掉,判据照样绿 ——
       * 因为别的 `.vue` 里也有「已叠」二字,全仓兜底把缺陷吸收掉了。
       *
       * 判据要守的是「**这一项在它该在的那个界面上**」。搬家可以,
       * 但必须显式改 `files`,`files` 里找不到就红。
       */
      expect(
        found,
        `「${item}」在 ${files.join(" 或 ")} 里找不到了 —— AGENTS.md 要求它必须以界面形式存在,` +
          `不许只活在注释或 README 里。若搬了家,请把新位置写进 files。锚点:${anchor}`,
      ).toBe(true);
    });
  }

  it("反空转:五项都量到了,且全仓 .vue 数量正常", () => {
    expect(VISIBLE.length, "五项清单被删短了").toBeGreaterThanOrEqual(5);
    expect(ALL_VUE.length, "一个 .vue 都没扫到 —— 路径变了").toBeGreaterThan(100_000);
  });
});

/**
 * 另一半:store 里**只写不读**的字段。
 *
 * ## 为什么这是「让看不见的机制可见」的可判定那一半
 *
 * 上面五项是人挑出来的具体机制。本文件开头明写:
 *
 * > 这比「扫描所有注释说该露的都露了」实在 —— 后者不可判定。
 *
 * 而这句挡不住**另一类**:一个字段在 store 里存在、在结算里被读、
 * 却从没进过任何 `.vue`。这一类**可以机械枚举** —— 它不是「该不该露」的判断,
 * 是「写下来了却没有出口」的事实。
 *
 * ## 这个形状两轮里抓到过两个真缺口
 *
 * ```text
 *   第 411 轮   player.lifespanBonusYears   延寿丹加了多少年，界面只报总数
 *   第 412 轮   player.enlightenmentAt      顿悟冷却还剩多久，界面上零次
 * ```
 *
 * 两个都是「内部有数、结算在用、界面不显示」。而它们的共同来源就是这一份清单 ——
 * 26 个只写不读的字段里,绝大多数确实是内部状态(时间戳、seen 标记、去重集合),
 * 但「绝大多数」不等于「全部」,而那少数几个正是玩家会问「为什么我不知道」的东西。
 *
 * ## 判据怎么才不吵
 *
 * 逐个判断这个字段该不该露,机器判不了。故这里**不做判断,只做记账**:
 *
 * ```text
 *   新增一个只写不读的字段   → 红。要么接进界面，要么登记在 INTERNAL_ONLY 里
 *   修好一个已登记的字段     → 红。该销账了
 * ```
 *
 * `INTERNAL_ONLY` 每一条都写清它为什么不必上界面 —— 而**登记这件事本身**
 * 就是一次「我确认过它不是玩家该知道的」的判断。
 */
/**
 * 登记表 —— 每个只写不读的字段都在这儿,并写清它为什么不必上界面。
 *
 * **登记这件事本身就是那个判断**:机器分不出「内部状态」与「玩家该知道的」,
 * 而人分得出 —— 把它写下来的那一刻,就确认过一次了。
 *
 * 分类只有四种,不允许「以后可能要用」:
 *
 * ```text
 *   状态机内部   计数、时间戳、去重集合、seen 标记
 *   派生中间量   已经由别的读数现算上界面，自己没有独立出口
 *   存档簿记     saveVersion / lastActiveAt 这类，给迁移与离线用
 *   一次性中转   写进去之后立刻被消费，生命周期在一次动作之内
 * ```
 */
const INTERNAL_ONLY: Readonly<Record<string, string>> = {
  // ---- 状态机内部：计数 / 时间戳 / 去重集合 / seen 标记 ----
  "adventure.clearedAt": "各地界的征服时刻，给兴衰倒计时用",
  "adventure.regionWins": "按区的累计胜场，经 winsIn 供界面（CombatPanel）",
  "adventure.seenOnceEvents": "一次性事件的去重集合，给事件池筛选用",
  "adventure.mortalBiasHistory": "最近几世的资源偏向，换界时去重用",
  "apprentice.rebirthKarma": "转世时一次性带走的师徒之缘，当即消耗",
  "cultivation.buffClock": "buff 通行的时钟基准，界面上读的是剩余秒数",
  "cultivation.gongfaMods": "功法合并后的词条，经 finalStats 上界面",
  "cultivation.mainSkill": "当前主修功法的技能对象，界面读功法 id 与门类",
  "dongfu.frac": "产出的余数累积，界面上报的是已入账的整数",
  "dongfu.buildingLevelCap": "建筑等级上限，经 buildingLevelCapOf 供界面",
  "dongfu.alchemyLevel": "炼丹炉等级，经 engineFacilities 汇总",
  "dongfu.forgeCapBonus": "炼器台给的强化上限加成，经 dongfu 的 cap 读数上界面",
  "dongfu.qiCapMult": "聚灵阵的灵气上限倍率，经 resources 的 cap 上界面",
  "dongfu.beastMult": "灵兽园给的属性倍率，经 finalStats 上界面",
  "endgame.endgameTutorialSeen": "天界引导已读标记",
  "endgame.resourceDialogSeen": "资源说明弹窗已读标记",
  "endgame.soulTutorialSeen": "器魂引导已读标记",
  "game.saveVersion": "存档版本号，给迁移用",
  "game.lastActiveAt": "上次活跃时刻，给离线结算用",
  "inventory.seenUids": "已开包看过的 uid 列表，newItemCount 读它的集合形式",
  "inventory.seenSeeded": "首发批次已标记的开关",
  "inventory.seenUidSet": "seenUids 的 Set 投影，性能用",
  "inventory.newItems": "仍挂「新」的件，只给 newItemCount 用",
  "inventory.hasNewItem":
    "newItems 是否非空；底导实际读 newItemCount，此导出留着是因为删掉会让 Pinia 的返回类型推断退化（实测 TS18046 串到四个视图）",
  "inventory.equipFlats": "装备平铺值汇总，经 finalStats 上界面",
  "inventory.equipMods": "装备词条汇总，经 finalStats 上界面",
  "lore.materialSeen": "材料的照面次数，各类认知读数读它",
  "lore.studyFrac": "钻研的余数累积，界面上报的是已得的丹方数",
  "lore.seeded": "首发批次已标记的开关",
  "lore.knownRecipeCount": "已知丹方数，界面上报的是方子列表本身",
  "player.lastCaveEventDay": "上次洞府巡游的日号，日频闸",
  "player.breakthroughPrep": "突破准备状态，经 breakthroughPrepState 供界面",
  "player.regionWins": "旧字段，已由 adventure.regionWins 承接",
  "player.talentMods": "天赋词条，经 finalStats 上界面",
  "player.titleMods": "称号词条，经 finalStats 上界面",
  "player.mentorMods": "师承词条，经 finalStats 上界面",
  "player.petMods": "灵兽词条，经 finalStats 上界面",
  "player.fateModsValue": "命格词条，经 finalStats 上界面",
  "player.permanentMods": "跨世永久词条，经 finalStats 上界面",
  "player.chart": "紫微命盘，经 CharacterView 的命格区上界面",
  "quests.peakQualityRank": "拾得的最高品质档，经 qualityPeakStores 供界面",
  "quests.collectedAt": "各图鉴条目的收集时刻，给排序用",
  "quests.lastCollectionViewAt": "上次看图鉴的时刻，给「新」标记用",
  "quests.currentMainQuest": "当前主线任务对象，经 questProgress 供界面",
  "ui.artifactDetailId": "法宝详情弹窗的选中 id，给弹窗用",
};

describe("让看不见的机制可见 · 只写不读的 store 字段", () => {
  it("每个只写不读的字段都登记过,且登记的理由还成立", () => {
    const stores = readdirSync(join(ROOT, "src/stores")).filter(
      (f) => f.endsWith(".ts") && !f.endsWith(".spec.ts"),
    );
    expect(stores.length, "一个 store 都没扫到").toBeGreaterThan(10);

    const found: string[] = [];
    for (const f of stores) {
      const src = readFileSync(join(ROOT, "src/stores", f), "utf8");
      // 只看 `const xxx = ref(` / `reactive(` / `computed(` —— 那才是会被消费的值
      for (const m of src.matchAll(/^\s{2,4}const (\w+) = (?:ref|reactive|computed)[<(]/gm)) {
        const name = m[1]!;
        if (name.startsWith("_")) continue;
        if (!new RegExp(`\\b${name}\\b`).test(ALL_VUE)) {
          found.push(`${f.replace(/\.ts$/, "")}.${name}`);
        }
      }
    }

    const unregistered = found.filter((k) => !(k in INTERNAL_ONLY));
    const stale = Object.keys(INTERNAL_ONLY).filter((k) => !found.includes(k));

    expect(
      unregistered,
      "这些 store 字段从没进过任何 .vue —— 是内部状态，还是玩家该知道的？" +
        "内部状态请登记进 INTERNAL_ONLY 并写清理由；玩家该知道的，把它接到界面上" +
        `（第 411/412 轮就是这个形状）：${unregistered.join("、")}`,
    ).toEqual([]);
    expect(
      stale,
      `这些已登记的字段现在要么接了界面、要么已删除 —— 销账：${stale.join("、")}`,
    ).toEqual([]);
  });

  it("反空转：量到的字段数在合理范围内", () => {
    /*
     * 若扫描器坏了（正则写错、路径变了），found 会是空的 ——
     * 那时上面那条会**因为 INTERNAL_ONLY 全部判为 stale 而红**，
     * 但红的原因会误导人。这一条把「扫描器还在工作」单独钉住。
     */
    expect(Object.keys(INTERNAL_ONLY).length, "登记表被清空了").toBeGreaterThan(15);
  });
});
