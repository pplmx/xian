import { describe, expect, it } from "vite-plus/test";
import { collectionProgressOverview, type CollectionProgressCategory } from "./collectionProgress";

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
    expect(overview.nearestRows.map((row) => row.key)).toEqual(["pill", "gongfa", "equip"]);
    expect(overview.initialOpenKeys).toEqual(["pill"]);
  });

  it("空册和已尽册不进入将满榜；全空时不擅自展开", () => {
    const overview = collectionProgressOverview([
      category("equip", 0, 10),
      category("gongfa", 10, 10),
      category("empty", 0, 0),
    ]);
    expect(overview.nearestRows).toEqual([]);
    expect(overview.initialOpenKeys).toEqual([]);
  });

  it("新得数不能超过已录数，也不能为负", () => {
    const overview = collectionProgressOverview([category("equip", 2, 10, -3)]);
    expect(overview.newRows).toEqual([]);
    expect(overview.newCount).toBe(0);
  });
});
