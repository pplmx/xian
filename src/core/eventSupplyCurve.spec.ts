/**
 * 随机事件按境界的供给 —— 第 9 境掉下去是**换池**,不是断层。
 *
 * ## 上一轮我把它读错了(第 135 轮)
 *
 * 把「第 m 境能碰到几个事件」算出来,看到这样一条曲线:
 *
 * ```text
 *   境  0   1   2   3   4   5   6   7   8   9  10  11  12  13  14 …  20
 *   数 62  67  68  61  61  60  55  48  44  28  30  32  33  33  37 …  51
 *                                          ↑
 *                                   8 → 9 掉 36%
 * ```
 *
 * 当时判定「中段有断层」,并写了判据把它钉住。**那个判断是错的。**
 *
 * ## `data/events` 的文件头早就写清了取法
 *
 * ```text
 *   上限按这条事件**自身的规模**取,不按它有多稀有:
 *
 *     1    筑基       山野小物     —— 蚁穴藏珍(一窝灵蚁能咬伤的只有筑基)
 *     2    金丹       凡俗乡野     —— 乞丐、山下集市、倾覆货车
 *     3~4  元婴~化神  散修之间     —— 商人的仙缘、无主药园、藏宝图
 *     5~7  炼虚~大乘  上古遗迹     —— 千年灵芝、地火炉窟、寒冰棺椁
 *     8    渡劫       通天之物     —— 无字石门、观星台;人间界的尽头
 *     —    不设       天地自然     —— 灵泉、流星、心魔、问道石:规模不随境界变
 *
 *   界外(仙界起)另有一池自己的内容(ev_xianmen_yize 起,minRealm 9+),
 *   故人间界的事件一律收在 8 以内:**境界带的两头都要堵**。
 * ```
 *
 * 所以第 8 → 9 的落差是**人间界封顶、界外另起一池**造成的,是设计本身。
 * 「元婴修士被一窝蚂蚁咬成重伤」正是文件头举的反例 —— 那条规则防的就是它。
 *
 * ## 这条判据现在守什么
 *
 * ```text
 * ① 每一境都有事件可碰(下限)
 * ② **人间界段(0~8)** 相邻两境落差不超过四成 —— 同一池里不该有断崖
 * ③ **换池那一处(8 → 9)** 允许落差,但新池必须够深 —— 界外池不许太薄
 * ④ 把曲线与边界分布打进测试输出,供后续补内容时参考
 * ```
 *
 * ② 与 ③ 分开写,是这个文件最重要的一件事:**同一池内的均匀** 与
 * **跨池的换挡** 是两种形状,不能用同一条阈值去卡。
 */
import { describe, expect, it } from "vite-plus/test";
import { EVENTS } from "@/data/events";
import { WORLD_BREAK_MAJOR } from "@/data/realms";

/** 第 m 境能碰到的事件数 */
function eventsAt(major: number): number {
  return EVENTS.filter(
    (e) => (e.minRealm ?? 0) <= major && (e.maxRealm ?? Number.MAX_SAFE_INTEGER) >= major,
  ).length;
}

/** 人间界的最后一境(渡劫),由 `data/realms` 的 WORLD_BREAK_MAJOR 推 */
const MORTAL_END = WORLD_BREAK_MAJOR - 1;
/** 最高境界:21 境即 0~20 */
const TOP = 20;

describe("随机事件的境界供给", () => {
  it("① 每一境都有事件可碰,下限不许破", () => {
    const thin: string[] = [];
    for (let m = 0; m <= TOP; m += 1) {
      const n = eventsAt(m);
      // 下限取 20:低于这个数,一境之内很快就会反复撞同一批事件
      if (n < 20) thin.push(`第 ${m} 境只有 ${n} 个`);
    }
    expect(thin, "某些境界的事件供给太薄 —— 一境之内会很快撞同一批:" + thin.join("、")).toEqual([]);
  });

  it("② 人间界段(0~8)内部相邻两境落差不超过四成 —— 同一池里不该有断崖", () => {
    /*
     * 只查 1 ~ MORTAL_END 这一段。跨到界外那一步(8 → 9)由 ③ 单独管,
     * 因为它是**换池**,形状本来就该不一样。
     */
    const drops: string[] = [];
    for (let m = 1; m <= MORTAL_END; m += 1) {
      const prev = eventsAt(m - 1);
      const cur = eventsAt(m);
      if (prev === 0) continue;
      const drop = (prev - cur) / prev;
      if (drop > 0.4) {
        drops.push(`第 ${m - 1} → ${m}:${prev} → ${cur}(跌 ${(drop * 100).toFixed(0)}%)`);
      }
    }
    expect(
      drops,
      "人间界段里相邻境界的事件供给跌得太狠 —— 同一池内不该有断崖:" + drops.join("、"),
    ).toEqual([]);
  });

  it("③ 换池之后:界外**独占**的事件要够多,不能全靠通用事件兜着", () => {
    /*
     * 换池那一步的落差是设计。但只看「第 9 境总共几个」会看漏一件事:
     * 那 28 个里绝大部分是**通用**事件(不设 minRealm/maxRealm,任何境都能出现)。
     *
     * 实测:
     *
     * ```text
     *   第 9 境   总 28   界外独占  4   通用 24
     *   第 12 境  总 33   界外独占  9   通用 24
     *   第 15 境  总 42   界外独占 18   通用 24
     *   第 20 境  总 51   界外独占 27   通用 24
     * ```
     *
     * 「通用 24」是恒定的 —— 它与境界无关。真正随境界增长的只有那一列**独占**。
     * 所以「界外内容够不够」该量的是**独占事件的供给曲线**,不是总数。
     *
     * 下界取 3:第 9 境现在只有 4 个,再少就几乎全靠通用事件撑场面了。
     */
    const outerAt = (m: number): number =>
      EVENTS.filter((e) => (e.minRealm ?? 0) >= MORTAL_END + 1 && (e.minRealm ?? 0) <= m).length;

    const thin: string[] = [];
    for (let m = MORTAL_END + 1; m <= TOP; m += 1) {
      if (outerAt(m) < 3) thin.push(`第 ${m} 境只有 ${outerAt(m)} 个界外独占事件`);
    }
    expect(
      thin,
      "界外某些境界几乎没有自己的事件 —— 全靠通用事件兜着,飞升后内容不会变:" + thin.join("、"),
    ).toEqual([]);

    // 且独占供给要随境界**单调不减** —— 越往后越该有自己的东西
    for (let m = MORTAL_END + 2; m <= TOP; m += 1) {
      expect(
        outerAt(m),
        `第 ${m} 境的界外独占事件(${outerAt(m)})比第 ${m - 1} 境(${outerAt(m - 1)})还少`,
      ).toBeGreaterThanOrEqual(outerAt(m - 1));
    }

    // 反空转:界外池与通用池都要非空
    expect(outerAt(TOP), "界外独占事件总数太少").toBeGreaterThan(20);
    const universal = EVENTS.filter(
      (e) => (e.minRealm ?? 0) === 0 && e.maxRealm === undefined,
    ).length;
    expect(universal, "一个通用事件都没有 —— 这条判据的「通用」概念不存在了").toBeGreaterThan(5);
  });

  it("④ 记录:曲线与边界分布", () => {
    /*
     * 这条不是判据,是**把现状写进测试输出** —— 跑测试时能看到边界集中在哪,
     * 下次要补内容时就知道该动哪儿。
     */
    const zeroMin = EVENTS.filter((e) => (e.minRealm ?? 0) === 0);
    const withMax = zeroMin.filter((e) => e.maxRealm !== undefined);
    const maxes = new Map<number, number>();
    for (const e of withMax) maxes.set(e.maxRealm!, (maxes.get(e.maxRealm!) ?? 0) + 1);
    const maxList = [...maxes.entries()].sort((a, b) => a[0] - b[0]);
    const worldPool = EVENTS.filter((e) => (e.minRealm ?? 0) >= MORTAL_END + 1);

    process.stdout.write(
      `\n—— 随机事件 ${EVENTS.length} 个,按境界的供给 ——\n` +
        Array.from({ length: TOP + 1 }, (_, m) => {
          const mark = m === MORTAL_END + 1 ? "   ← 换池(人间界封顶 8,界外从此起)" : "";
          return `  ${String(m).padStart(2)}: ${String(eventsAt(m)).padStart(2)}${mark}`;
        }).join("\n") +
        `\n\n开局事件(minRealm 0)${zeroMin.length} 个,其中 ${withMax.length} 个有 maxRealm:\n` +
        maxList.map(([k, v]) => `  maxRealm ${k}: ${v} 个`).join("\n") +
        `\n\n界外池(minRealm ≥ ${MORTAL_END + 1})${worldPool.length} 个。\n` +
        `> 「8 → 9 掉三成」是**换池**,不是断层:人间界按自身规模封顶在 8,\n` +
        `> 界外另起一池(见 data/events 文件头的「境界带 · 上限怎么取」)。\n`,
    );

    expect(zeroMin.length, "开局事件少了").toBeGreaterThan(30);
    expect(withMax.length, "开局事件几乎都没有上界 —— 境界带设计变了").toBeGreaterThan(20);
    expect(maxList.length, "maxRealm 的取值太单一").toBeGreaterThan(3);
    expect(worldPool.length, "界外池太薄").toBeGreaterThan(10);
  });

  it("反空转:事件表非空,境界范围与 data/realms 对得上", () => {
    expect(EVENTS.length, "事件表空了").toBeGreaterThan(50);
    expect(eventsAt(0), "第 0 境一个事件都没有").toBeGreaterThan(0);
    expect(MORTAL_END, "人间界的最后一境不是 8 —— 判据的段落划分要跟着改").toBe(8);
    expect(TOP, "最高境界改了 —— 这条判据的循环上界要跟着改").toBe(20);
  });
});
