/**
 * 仙路旅途 —— 21 境刻度的纯判据。
 *
 * 里程碑:#1 人间界首(炼气)、#5 仙界首(真仙)、#9 神界首(神人)、#10 混沌海首(混沌真灵)。
 * 三态切分以「当前境」为界:已至 < 当前 ≤ 未至;越界值(负数/超顶)照 realmDef 修正。
 */
import { describe, expect, it } from "vite-plus/test";
import { REALMS, WORLDS, isWorldEntry } from "@/data/realms";
import { realmLadderPoints, realmLadderWorlds } from "./realmLadder";

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
