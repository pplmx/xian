/* oxlint-disable no-console -- 对账表是给人看的 */
/**
 * 时制对账 —— 古语可以说,但必须与现代时长对得上
 *
 * 玩家提醒的那句:「一些丹药写的是时辰,实际却按现在的 24 小时算,有的小问题;
 * 一个时辰是两小时,一刻是 15 分钟。」查下来确实如此,而且不止一处:
 *
 *   · 聚灵丹写「半个时辰内修炼倍增」,实际 1800 秒 = **30 分钟**
 *     (半个时辰是一个小时 —— 差一倍);修速药力因此被读大一倍。
 *   · 修为丹阶梯写「半时 / 一时 / 二时」:字面像"半个时辰 / 一个时辰",
 *     实际按小时算 —— 一整套差一倍。
 *   · 闭关提示写「静坐一炷香(5 分钟)」:一炷香是 30 分钟。
 *
 * 改法分两层:
 *   一 立表:data/timeUnits 收下道门时制(一盏茶 10 分 · 一刻 15 分 ·
 *      一炷香 30 分 · 半个时辰 1 小时 · 一个时辰 2 小时),落不在表上的值
 *      说「将近 X / X 有余」并附分钟数 —— 古语可以模糊,模糊必须写在明处;
 *   二 立判据:**凡是文案里出现了时制词,就折成秒与数据对账**。
 *      数值一改忘了改文案,这里立刻红(而不是等玩家发现"写的和做的不一样")。
 *
 * 第二轮追加:丹药与增益的 desc 不再写时长(那片数值改成由 pillFuncText 现算),
 * 于是第二条判据的落点从 desc 挪到了**现算行** —— 见文末「时制对账 · 文案与数据」。
 */
import { describe, expect, it } from "vite-plus/test";
import { PILLS } from "./pills";
import { BUFFS, buffDef } from "./buffs";
import { KE_SEC, SHICHEN_SEC, classicalDuration, parseClassicalDuration } from "./timeUnits";
import { pillFuncText } from "@/ui/itemText";
import { formatDuration } from "@/utils/format";

/** 从文案里取出括号中的现代时长(分钟/小时),折成秒 */
function modernSecondsIn(text: string): number | null {
  const m = /(\d+(?:\.\d+)?)\s*(分钟|小时|秒)/.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] === "小时" ? n * 3600 : m[2] === "分钟" ? n * 60 : n;
}

describe("道门时制 · 表本身", () => {
  it("一炷香 = 半时辰的一半?不 —— 表就是这么定的,且古语与秒可以互推", () => {
    const sec = (s: string): number => parseClassicalDuration(s)?.sec ?? -1;
    expect(sec("半个时辰")).toBe(3600);
    expect(sec("一个时辰")).toBe(SHICHEN_SEC);
    expect(sec("两个时辰")).toBe(2 * SHICHEN_SEC);
    expect(sec("一刻")).toBe(KE_SEC);
    expect(sec("六刻")).toBe(6 * KE_SEC);
    expect(sec("一炷香")).toBe(1800);
    expect(sec("一盏茶")).toBe(600);
    // 近似说法标出来:判据据此放宽到"一刻之内且方向对"
    expect(parseClassicalDuration("将近一刻")?.exact).toBe(false);
    expect(parseClassicalDuration("一刻")?.exact).toBe(true);
    // 一个时辰 = 两小时 = 八刻
    expect(SHICHEN_SEC).toBe(2 * 3600);
    expect(SHICHEN_SEC / KE_SEC).toBe(8);
  });

  it("古今对照写法:确切值用古语 + 分钟;落不在表上的说清与最近一档的关系", () => {
    console.log(
      "\n  " +
        [600, 900, 1800, 3600, 5400, 7200, 10800, 21600, 540, 1080]
          .map((s) => `${s}s=${classicalDuration(s)}`)
          .join(" · "),
    );
    expect(classicalDuration(1800)).toBe("一炷香(30 分钟)");
    expect(classicalDuration(3600)).toBe("半个时辰(1 小时)");
    expect(classicalDuration(7200)).toBe("一个时辰(2 小时)");
    expect(classicalDuration(10800)).toBe("一个半时辰(3 小时)");
    expect(classicalDuration(540)).toBe("将近一刻(9 分钟)");
    expect(classicalDuration(1080)).toBe("一刻有余(18 分钟)");
  });
});

describe("时制对账 · 文案与数据", () => {
  /**
   * 这一条原来是「凡 desc 里写了时制,折出的秒数必须等于真实时长」——
   * 它守的是两本账**暂时**一致。现在 desc 只剩风味(见 data/buffs.ts / pills.ts
   * 的文件头),时长只有一处出口:界面上的现算行。于是判据跟着改成两截:
   *   一 desc 里不许再出现时制词(手抄只能从这一处回潮);
   *   二 现算行必须报出与 expSecs / buff.durationSec 同源的那一段时长。
   */
  it("丹药与增益的说明不再写时长", () => {
    const offenders = [...PILLS, ...BUFFS]
      .filter((d) => parseClassicalDuration(d.desc) !== null || modernSecondsIn(d.desc) !== null)
      .map((d) => `${d.name}:${d.desc}`);
    expect(offenders, "说明里又写上了时长 —— 它该由现算行说").toEqual([]);
    expect(PILLS.length + BUFFS.length, "两张表都空了,判据形同虚设").toBeGreaterThanOrEqual(100);
  });

  it("丹药的现算行报出的时长,与 expSecs / buff 的持续秒数同源", () => {
    const rows: string[] = [];
    let checked = 0;
    for (const def of PILLS) {
      // 真实时长:即时丹看 expSecs;增益丹看它 buff 的持续秒数
      const actual =
        def.instant?.expSecs ?? (def.buffId ? buffDef(def.buffId)?.durationSec : undefined);
      if (!actual) continue;
      checked += 1;
      const text = pillFuncText(def);
      // 即时丹走 formatDuration(「15分0秒」),增益丹说「持续 N 分钟」—— 各按各的口径对
      const expected = def.instant?.expSecs
        ? formatDuration(actual)
        : `${Math.round(actual / 60)} 分钟`;
      rows.push(`${def.name}:现算行须含「${expected}」· 实际 ${actual}s`);
      expect(text, `${def.name} 的现算行没报出时长(${actual}s):${text}`).toContain(expected);
    }
    console.log(`\n  丹药现算行对账(共 ${checked} 味):`);
    for (const r of rows) console.log("    " + r);
    expect(checked, "一味带时长的丹药都没扫到 —— 判据形同虚设").toBeGreaterThan(20);
  });

  it("增益的时长只在 buff 本体上:现算行读的是 durationSec", () => {
    let checked = 0;
    for (const def of BUFFS) {
      expect(def.durationSec, `增益「${def.name}」没有时长`).toBeGreaterThan(0);
      checked += 1;
    }
    expect(checked, "增益表空了,判据形同虚设").toBeGreaterThanOrEqual(38);
  });
});
