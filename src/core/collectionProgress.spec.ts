import { describe, expect, it } from "vite-plus/test";
/*
 * 只在判据里引一次 ui/codex —— 为的是守住 `STAGE_DEPTH_BY_KEY` 那份手写表。
 * 生产代码里 core 不引 ui（分层由 uiLayering / importCycles 守），
 * 而这里是一次性核对:表里的数必须与真实数组长度相等。
 */
import {
  ARTIFACT_STAGE_NAMES,
  BRANCH_STAGE_NAMES,
  EQUIP_STAGE_NAMES,
  PET_STAGE_NAMES,
  PILL_STAGE_NAMES,
} from "@/ui/codex";
import { LORE_STAGE_NAMES } from "@/data/materials";
import {
  collectionProgressOverview,
  recentCollects,
  collectionStagePeak,
  collectionProgressOverviewFromCodex,
  type CollectionProgressCategory,
} from "./collectionProgress";

function category(
  key: string,
  known: number,
  total: number,
  newCount = 0,
): CollectionProgressCategory {
  return { key, name: key, known, total, newCount };
}

describe("藏珍谱 · 从同一份图鉴条目派生", () => {
  it("汇总已录、总数与新得，并把越界读数夹回合法范围", () => {
    const overview = collectionProgressOverview([
      category("equip", 3, 10, 2),
      category("gongfa", 99, 20, 99),
      category("empty", -2, 0, 1),
    ]);
    expect(overview).toMatchObject({ known: 23, total: 30, newCount: 22 });
    expect(overview.rows[1]).toMatchObject({
      known: 20,
      total: 20,
      newCount: 20,
      ratio: 1,
      remaining: 0,
      complete: true,
    });
    expect(overview.rows[2]).toMatchObject({
      known: 0,
      total: 0,
      newCount: 0,
      ratio: 0,
      complete: false,
    });
  });

  it("新得不超过三册时按册目顺序列出，并全部默认展开", () => {
    const overview = collectionProgressOverview([
      category("equip", 0, 10),
      category("gongfa", 2, 10, 1),
      category("pill", 5, 10),
      category("pet", 1, 10, 1),
    ]);
    expect(overview.newRows.map((row) => row.key)).toEqual(["gongfa", "pet"]);
    expect(overview.initialOpenKeys).toEqual(["gongfa", "pet"]);
  });

  it("新得跨册时先报新得最多的册，再按收录比例与原序排", () => {
    const overview = collectionProgressOverview([
      category("equip", 1, 10, 1),
      category("gongfa", 4, 10, 4),
      category("pill", 2, 10, 2),
      category("pet", 3, 10, 3),
    ]);
    expect(overview.newRows.map((row) => row.key)).toEqual(["gongfa", "pet", "pill", "equip"]);
    expect(overview.initialOpenKeys).toEqual(["gongfa", "pet", "pill"]);
  });

  it("新得数相同时按收录比例降序，比例相同再守原册序", () => {
    const overview = collectionProgressOverview([
      category("equip", 1, 10, 1),
      category("gongfa", 3, 10, 1),
      category("pill", 1, 20, 1),
      category("pet", 2, 10, 1),
    ]);
    expect(overview.newRows.map((row) => row.key)).toEqual(["gongfa", "pet", "equip", "pill"]);
  });

  it("新得跨四册时只默认展开前三册，余册仍留在新得清单里", () => {
    const overview = collectionProgressOverview([
      category("equip", 1, 10, 1),
      category("gongfa", 1, 10, 1),
      category("pill", 1, 10, 1),
      category("pet", 1, 10, 1),
    ]);
    expect(overview.newRows.map((row) => row.key)).toEqual(["equip", "gongfa", "pill", "pet"]);
    expect(overview.initialOpenKeys).toEqual(["equip", "gongfa", "pill"]);
  });

  it("无新得时只开最接近收齐的一册，按比例、缺口、原序排", () => {
    const overview = collectionProgressOverview([
      category("equip", 2, 10),
      category("gongfa", 8, 10),
      category("pill", 4, 5),
      category("pet", 0, 10),
      category("event", 10, 10),
    ]);
    /*
     * 原先这里还断言 `overview.nearestRows` 的排序（["pill","gongfa","equip"]）。
     * 第 465 轮删掉了那个字段 —— 它只用于挑出 `initialOpenKeys` 的第一项，
     * 没有任何外部消费者（`CollectionView` 只读 newRows 与 initialOpenKeys）。
     *
     * 排序规则没有丢：`initialOpenKeys` 取的就是「将满榜」的第一项，
     * 故下面这条断言等价于「排序后 pill 排第一」。
     */
    expect(overview.initialOpenKeys).toEqual(["pill"]);
  });

  it("空册和已尽册不进入将满榜；全空时不擅自展开", () => {
    const overview = collectionProgressOverview([
      category("equip", 0, 10),
      category("gongfa", 10, 10),
      category("empty", 0, 0),
    ]);
    expect(overview.initialOpenKeys).toEqual([]);
  });

  it("新得数不能超过已录数，也不能为负", () => {
    const overview = collectionProgressOverview([category("equip", 2, 10, -3)]);
    expect(overview.newRows).toEqual([]);
    expect(overview.newCount).toBe(0);
  });

  it("从图鉴条目汇总时以 stage ≥ 1 计已录，新得也只算已录条目", () => {
    const overview = collectionProgressOverviewFromCodex(
      [
        {
          key: "equip",
          name: "装备图鉴",
          entries: [
            { id: "seen", stage: 1 },
            { id: "unknown", stage: 0 },
            { id: "mastered", stage: 3 },
          ],
        },
        {
          key: "pet",
          name: "灵兽册",
          entries: [{ id: "companion", stage: 2 }],
        },
      ],
      (_key, id) => id === "unknown" || id === "mastered",
    );

    expect(overview).toMatchObject({ known: 3, total: 4, newCount: 1 });
    expect(overview.newRows.map((row) => row.key)).toEqual(["equip"]);
  });

  it("最薄那一册 —— 与「最接近集齐」是相反的一端", () => {
    /*
     * ## 两个读数各答一句话（第 558 轮）
     *
     * ```text
     *   nearestRows   按 ratio 降序   「哪一册再补一点就满了」—— 对收尾有用
     *   thinnest      按 ratio 升序   「我该去补哪一册」      —— 此前没人答
     * ```
     *
     * 玩家翻到图鉴卷首时更常问的是后者。
     */
    const overview = collectionProgressOverview([
      { key: "equip", name: "器谱", known: 90, total: 100, newCount: 0 },
      { key: "pill", name: "丹谱", known: 2, total: 80, newCount: 0 },
      { key: "event", name: "事迹", known: 40, total: 50, newCount: 0 },
    ]);
    expect(overview.thinnest?.key, "最薄的是丹谱（2/80）").toBe("pill");
    expect(overview.thinnest?.remaining, "它还剩 78 件 —— 这一格要说得出").toBe(78);

    /* 已集齐的册子不是「薄」 */
    const allDone = collectionProgressOverview([
      { key: "equip", name: "器谱", known: 100, total: 100, newCount: 0 },
      { key: "pill", name: "丹谱", known: 80, total: 80, newCount: 0 },
    ]);
    expect(allDone.thinnest, "全部集齐时不该再指一册「最薄」").toBeNull();

    /* 空册不参与 —— 分母是零，没有「薄」可言 */
    const withEmpty = collectionProgressOverview([
      { key: "empty", name: "空册", known: 0, total: 0, newCount: 0 },
      { key: "pill", name: "丹谱", known: 1, total: 10, newCount: 0 },
    ]);
    expect(withEmpty.thinnest?.key, "空册（0/0）不该被选成最薄").toBe("pill");
  });

  it("最快能补完的那一册 —— 与「最薄」成对，是同一批里排序相反的那一个", () => {
    /*
     * ## `nearestRows` 算过但没显示（第 559 轮）
     *
     * 它此前只用来决定 `initialOpenKeys`（自动展开哪一格），
     * 而「哪一册快集齐了」这个信息从未显示给玩家。
     *
     * 与 `thinnest` 成对:
     * ```text
     *   thinnest   ratio 升序   「我该去补哪一册」—— 缺口最大的
     *   nearest    ratio 降序   「哪一册快集齐了」—— 差得最少的
     * ```
     */
    const overview = collectionProgressOverview([
      { key: "equip", name: "器谱", known: 90, total: 100, newCount: 0 },
      { key: "pill", name: "丹谱", known: 2, total: 80, newCount: 0 },
      { key: "event", name: "事迹", known: 40, total: 50, newCount: 0 },
    ]);
    expect(overview.nearest?.key, "最快补完的是器谱（90/100）").toBe("equip");
    expect(overview.nearest?.remaining, "它只差 10 件").toBe(10);
    expect(overview.thinnest?.key, "而最薄的是丹谱 —— 两个读数在两端").toBe("pill");

    /* 已集齐的册子不是「快」—— 它是已经满了 */
    const allDone = collectionProgressOverview([
      { key: "equip", name: "器谱", known: 100, total: 100, newCount: 0 },
      { key: "pill", name: "丹谱", known: 40, total: 80, newCount: 0 },
    ]);
    expect(allDone.nearest?.key, "集齐那册不该被选成「最快」").toBe("pill");
  });

  it("最近收录 —— 与「这一册里什么最好」是两个问题", () => {
    /*
     * ## 为什么要它（第 565 轮）
     *
     * `quests.collectedAt` 记着每一条**首次收录**的时刻，而它此前只用来判
     * 「是不是新得的」（`isEntryNew`，与「上次打开图鉴」比），**从没用来排序**。
     * 九柜一律按 `byBest`（品阶 / 深度）排 —— 那是「该看哪一条」的答案，
     * 而不是「我刚刚收了什么」。
     */
    const cats = [
      {
        key: "pill",
        name: "丹谱",
        entries: [
          { id: "a", stage: 1, name: "回灵丹" },
          { id: "b", stage: 1, name: "聚气散" },
          { id: "c", stage: 0, name: "九转还魂丹" },
        ],
      },
    ];
    const at: Record<string, number> = { "pill:a": 100, "pill:b": 300, "pill:c": 500 };

    const top = recentCollects(cats, (k, id) => at[`${k}:${id}`] ?? 0, 3);
    expect(top.length, "只该有两条已收录的").toBe(2);
    expect(top[0]!.id, "聚气散收录得更晚，该排第一").toBe("b");
    expect(top[0]!.name).toBe("聚气散");
    expect(top[0]!.categoryName).toBe("丹谱");
    /* 未收录那条不参与 —— 即使它的时刻最大 */
    expect(
      top.some((r) => r.id === "c"),
      "未收录的不该出现在「最近收录」里",
    ).toBe(false);

    /* 没记时刻的（0）视为没记，不当成 1970 年 */
    const partial = recentCollects(cats, () => 0, 3);
    expect(partial, "一条时刻都没有时该返回空").toEqual([]);

    /* 同一时刻按名字排 —— 排序要稳定 */
    const tie = recentCollects(cats, () => 200, 3);
    expect(
      tie.map((r) => r.id),
      "同一时刻该按名字定序",
    ).toEqual(["a", "b"]);
  });

  it("取两条时的顺序 —— 先最近，再往前，且不重复", () => {
    const cats = [
      {
        key: "pill",
        name: "丹谱",
        entries: [
          { id: "a", stage: 1, name: "甲丹" },
          { id: "b", stage: 1, name: "乙丹" },
          { id: "c", stage: 1, name: "丙丹" },
        ],
      },
    ];
    const at: Record<string, number> = { "pill:a": 100, "pill:b": 300, "pill:c": 200 };
    const two = recentCollects(cats, (k, id) => at[`${k}:${id}`] ?? 0, 2);
    expect(two.length, "应该正好取到两条").toBe(2);
    expect(two[0]!.name, "第一条必须是最新的那件").toBe("乙丹");
    expect(two[1]!.name, "第二条是上一件").toBe("丙丹");
    expect(two[0]!.id, "两件不能是同一条").not.toBe(two[1]!.id);
    const one = recentCollects(
      [{ key: "pill", name: "丹谱", entries: [{ id: "a", stage: 1, name: "甲丹" }] }],
      () => 100,
      2,
    );
    expect(one.length, "只有一件时不该凑出两件").toBe(1);
  });

  it("参到什么程度 —— 录了 80 条与 80 条全通晓是两个世界", () => {
    /*
     * 九柜此前只报 known / total。而每一条还有自己的收录深度：
     * 录了 80 条、其中 0 条通晓，与 80 条全通晓，界面说同一句话。
     */
    const cats = [
      {
        key: "pill",
        name: "丹谱",
        entries: [
          { id: "a", stage: 1 },
          { id: "b", stage: 3 },
          { id: "c", stage: 3 },
          { id: "d", stage: 0 },
        ],
      },
      { key: "branch", name: "悟道", entries: [{ id: "x", stage: 0 }] },
    ];
    const out = collectionStagePeak(cats);
    expect(out.length, "一条都没录的那一册不该出现").toBe(1);
    expect(out[0]!.known, "已录 3 条").toBe(3);
    expect(out[0]!.peakCount, "其中 2 条到了顶档").toBe(2);
    expect(out[0]!.key, "册的 key 要带出来 —— 界面靠它对回柜面").toBe("pill");
    /* 全都没录 → 空数组，不是一排 0 */
    expect(collectionStagePeak([cats[1]!]), "一条都没录时该返回空").toEqual([]);
  });

  it("只收到「已录」的玩家，通顶数是 0 —— 顶档取自册的定义，不是玩家进度", () => {
    /*
     * ## 这条守的是第 238 轮修掉的那个语义错误
     *
     * 早前的实现从玩家已录条目里取最大 stage 当顶档。后果:
     *
     * ```text
     * 一位新玩家收了 20 味丹，全部只到「已录」（stage 1）
     * → 最大 stage = 1，于是「stage >= 1」的都算通顶
     * → 界面显示「通顶 20」
     * → 而他一条都没通晓（通晓是第 4 档）
     * ```
     *
     * 现在顶档取自 `STAGE_DEPTH_BY_KEY`（丹谱 4 档 → 顶档 stage 3），
     * 二十味只到「已录」的丹，通顶数必须是 0，未通顶 20 条。
     */
    const fresh = collectionStagePeak([
      {
        key: "pill",
        name: "丹谱",
        entries: Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, stage: 1 })),
      },
    ]);
    expect(fresh.length).toBe(1);
    expect(fresh[0]!.known, "二十味全都收录了").toBe(20);
    expect(fresh[0]!.peakCount, "但一条都没通晓 —— 通顶必须是 0").toBe(0);
  });

  it("六册的档数手写表与真实 stage 数组长度一致 —— 防将来漂移", () => {
    /*
     * `STAGE_DEPTH_BY_KEY` 是手写的六项表。若某一册的 `*_STAGE_NAMES` 将来增删一档，
     * 这张表不会自动跟着变，通顶判据会静默错一档 ——
     * 比如把「已得方」当成「通晓」报给玩家。
     *
     * 这里不读那张私有表，而是**问它的行为**:给每册喂一条「按真实数组长度算出的
     * 顶档」条目，它必须被判为通顶；再喂低一档的，必须不算。
     */
    const realDepths: [string, string, readonly string[]][] = [
      ["equip", "装备谱", EQUIP_STAGE_NAMES],
      ["artifact", "法宝录", ARTIFACT_STAGE_NAMES],
      ["pill", "丹谱", PILL_STAGE_NAMES],
      ["pet", "灵兽谱", PET_STAGE_NAMES],
      ["branch", "悟道录", BRANCH_STAGE_NAMES],
      ["material", "灵材谱", LORE_STAGE_NAMES],
    ];
    for (const [key, name, arr] of realDepths) {
      const topIndex = arr.length - 1;
      const atTop = collectionStagePeak([{ key, name, entries: [{ id: "x", stage: topIndex }] }]);
      expect(atTop.length, `${name}: 到了真实顶档却没被算进通顶表`).toBe(1);
      expect(atTop[0]!.peakCount, `${name}: 真实顶档 ${topIndex} 应算作通顶`).toBe(1);

      /* 低一档的不算通顶 —— 若表里的 depth 比真实小，这条会红 */
      if (topIndex >= 2) {
        const below = collectionStagePeak([
          { key, name, entries: [{ id: "x", stage: topIndex - 1 }] },
        ]);
        expect(
          below[0]!.peakCount,
          `${name}: 第 ${topIndex - 1} 档不该算通顶（顶档是 ${topIndex}）`,
        ).toBe(0);
      }
    }
  });

  it("二态册不参与通顶 —— 收 / 未收没有中间档", () => {
    /*
     * 功法阁 / 见闻志 / 天赋鉴三册是二态的：收进册子里就是全部，
     * 没有「收录到第几层」可言。它们若也报通顶，那个数就等于 known ——
     * 界面会说「通顶 30 / 已录 30」，是一句废话。
     */
    const out = collectionStagePeak([
      {
        key: "gongfa",
        name: "功法阁",
        entries: [
          { id: "g1", stage: 1 },
          { id: "g2", stage: 1 },
        ],
      },
      { key: "event", name: "见闻志", entries: [{ id: "e1", stage: 1 }] },
      { key: "pill", name: "丹谱", entries: [{ id: "p1", stage: 3 }] },
    ]);
    expect(
      out.map((r) => r.key),
      "只有丹谱（有档位的那六册之一）该出现在通顶表里",
    ).toEqual(["pill"]);
  });
});
