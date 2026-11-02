/**
 * 仙路旅途 —— 21 境刻度的纯判据。
 *
 * 里程碑:#1 人间界首(炼气)、#5 仙界首(真仙)、#9 神界首(神人)、#10 混沌海首(混沌真灵)。
 * 三态切分以「当前境」为界:已至 < 当前 ≤ 未至;越界值(负数/超顶)照 realmDef 修正。
 */
import { describe, expect, it } from "vite-plus/test";
import { REALMS, WORLDS, isWorldEntry } from "@/data/realms";
import { realmLadderPoints, realmLadderWorlds, realmOrdinalText } from "./realmLadder";

describe("realmLadder · 三态", () => {
  it("第 1 境(major=0):只是当前境,前无已至", () => {
    const pts = realmLadderPoints(0);
    expect(pts[0]!.state).toBe("now");
    expect(pts.every((p, i) => i === 0 || p.state === "future")).toBe(true);
  });

  it("跨度中间:已至 < 当前 < 未至 各占其一", () => {
    const pts = realmLadderPoints(5);
    expect(pts[4]!.state).toBe("done");
    expect(pts[5]!.state).toBe("now");
    expect(pts[6]!.state).toBe("future");
  });

  it("走到顶(major=MAX):最后一件亦点亮,不会越界把「now」推出刻度", () => {
    const pts = realmLadderPoints(REALMS.length - 1);
    expect(pts[REALMS.length - 1]!.state).toBe("now");
    expect(pts[REALMS.length - 1]!.index).toBe(REALMS.length - 1);
  });

  it("越界修正:负数/超顶都夹回而不再成片点亮", () => {
    const neg = realmLadderPoints(-3);
    expect(neg[0]!.state).toBe("now");
    const over = realmLadderPoints(999);
    expect(over[over.length - 1]!.state).toBe("now");
  });
});

describe("realmLadder · 界首与界段", () => {
  it("界首标记与数据同源:四界各在首境立界门", () => {
    const starts = WORLDS.map((w) => w.start);
    const saw = realmLadderPoints(0)
      .filter((p) => p.worldStart)
      .map((p) => p.index);
    expect(saw).toEqual(starts);
    // 界首确为数据所称的界首(自洽)
    for (const s of starts) expect(isWorldEntry(s)).toBe(true);
  });

  it("界段中心落在自己那一段之内", () => {
    const worlds = realmLadderWorlds();
    for (const w of worlds) {
      const centerIdx = (w.centerPct / 100) * REALMS.length;
      expect(centerIdx).toBeGreaterThan(w.start);
      expect(centerIdx).toBeLessThan(w.end + 1);
    }
    expect(worlds.length).toBe(WORLDS.length);
  });
});

describe("realmLadder · 「第 N / M 境」读数", () => {
  /*
   * 这枚读数在四处出现(修行页首屏、修行页章首、人物页、修炼圆盘),
   * 从前各写一遍 `player.major + 1` 与分母。分母还有过两个变体:
   * REALMS.length 与 points.length(后者是 REALMS.map(...) 的长度),
   * 今天相等,改 REALMS 或改圆盘取数时就会分叉。
   */
  it("首境从 1 数起,末境不越过总数", () => {
    expect(realmOrdinalText(0)).toBe(`第 1 / ${REALMS.length} 境`);
    expect(realmOrdinalText(REALMS.length - 1)).toBe(`第 ${REALMS.length} / ${REALMS.length} 境`);
  });

  it("圆盘的分母与读数同源 —— points 就是从 REALMS 映射出来的", () => {
    // 这条钉的是「两个分母今后也不会分叉」:圆盘若改取别的数组,这里会红
    expect(realmLadderPoints(0)).toHaveLength(REALMS.length);
    expect(realmOrdinalText(5)).toContain(`/ ${realmLadderPoints(5).length} 境`);
  });

  it("脏档被夹回合法区间:不印「第 0 境」,也不印超过总数的序号", () => {
    expect(realmOrdinalText(-3)).toBe(`第 1 / ${REALMS.length} 境`);
    expect(realmOrdinalText(99)).toBe(`第 ${REALMS.length} / ${REALMS.length} 境`);
    expect(realmOrdinalText(Number.NaN)).toBe(`第 1 / ${REALMS.length} 境`);
    expect(realmOrdinalText(Number.POSITIVE_INFINITY)).toBe(
      `第 ${REALMS.length} / ${REALMS.length} 境`,
    );
  });
});
