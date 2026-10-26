/**
 * 存档迁移 —— `migrateResourcesSlice`(ISS-306 灵草五品)
 *
 * 旧档的灵草是单标量,分品后一律认凡品平账;五档缺档补 0;
 * 已删除的「灵草→灵石」兑换额度残留(herbExchangeUsed / herbExchangeRealm)一并清掉。
 * 幂等:已迁移的新档再跑一遍,数字不变。
 */
import { describe, expect, it, vi } from "vite-plus/test";
import { blockSaveWrites, migrateResourcesSlice, persistConfig } from "./storage";

describe("存档迁移 · 灵草五品(ISS-306)", () => {
  it("旧标量 herb 全数折成凡品(1),其余四品清零", () => {
    const out = migrateResourcesSlice({ herb: 42, stone: 1 } as Record<string, unknown>);
    expect(out.herbs).toEqual({ 1: 42, 2: 0, 3: 0, 4: 0, 5: 0 });
    expect("herb" in out).toBe(false);
    expect(out.stone).toBe(1); // 其余字段原样保留
  });

  it("新形五档照搬,缺档补 0,并与旧标量叠加(若两者都在)", () => {
    const out = migrateResourcesSlice({ herb: 5, herbs: { 1: 3, 3: 7 } } as Record<
      string,
      unknown
    >);
    expect(out.herbs).toEqual({ 1: 8, 2: 0, 3: 7, 4: 0, 5: 0 });
  });

  it("清除 herbExchange 残留字段(已删除的草→石 兑换额度)", () => {
    const out = migrateResourcesSlice({
      herb: 1,
      herbExchangeUsed: 120,
      herbExchangeRealm: 2,
    } as Record<string, unknown>);
    expect("herbExchangeUsed" in out).toBe(false);
    expect("herbExchangeRealm" in out).toBe(false);
  });

  it("幂等:已迁移的档再跑一遍,数字不变", () => {
    const once = migrateResourcesSlice({ herb: 42 } as Record<string, unknown>);
    const twice = migrateResourcesSlice(once);
    expect(twice).toEqual(once);
  });
});

describe("只读页 · 写盘的总闸", () => {
  /*
   * 多标签的后来者由 core/singleWriter 判成只读,闸落在存储层:持久化插件、离线结算、
   * 导入、清档都从这里过,一处开关管全部。判据:切成只读之后,写入与删除都不落盘 ——
   * 否则那页仍会把旧状态盖回写者刚存下的进度(这正是要防的事)。
   */
  it("切成只读之后,setItem 与 removeItem 都不落盘", () => {
    const disk = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => disk.get(k) ?? null,
      setItem: (k: string, v: string) => {
        disk.set(k, v);
      },
      removeItem: (k: string) => {
        disk.delete(k);
      },
      key: (i: number) => [...disk.keys()][i] ?? null,
      get length() {
        return disk.size;
      },
      clear: () => disk.clear(),
    });

    blockSaveWrites();

    const storage = persistConfig("game").storage;
    storage.setItem("xuanshu.game", "{}");
    expect(disk.size, "只读页不许写盘").toBe(0);

    disk.set("xuanshu.game", "existing");
    storage.removeItem("xuanshu.game");
    expect(disk.get("xuanshu.game"), "只读页也不许删盘上的东西").toBe("existing");

    vi.unstubAllGlobals();
  });
});
