/**
 * 存档迁移 —— `migrateResourcesSlice`(ISS-306 灵草五品)
 *
 * 旧档的灵草是单标量,分品后一律认凡品平账;五档缺档补 0;
 * 已删除的「灵草→灵石」兑换额度残留(herbExchangeUsed / herbExchangeRealm)一并清掉。
 * 幂等:已迁移的新档再跑一遍,数字不变。
 */
import { describe, expect, it, vi } from "vite-plus/test";
import {
  applyImportPayload,
  blockSaveWrites,
  clearAllSave,
  migrateResourcesSlice,
  persistConfig,
  preflightScan,
  storageKey,
  type ExportPayload,
} from "./storage";

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

describe("损坏分片隔离 · 原档不能在没有备份时消失", () => {
  it("备份读回一致后,才移除损坏的原分片", () => {
    const disk = new Map([[storageKey("player"), "不是 JSON"]]);
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => disk.get(k) ?? null,
      setItem: (k: string, v: string) => void disk.set(k, v),
      removeItem: (k: string) => void disk.delete(k),
      clear: () => disk.clear(),
      key: () => null,
      length: 0,
    });

    expect(preflightScan()).toEqual(["player"]);
    expect(disk.get(`corrupt.${storageKey("player")}`)).toBe("不是 JSON");
    expect(disk.has(storageKey("player"))).toBe(false);
    vi.unstubAllGlobals();
  });

  it("备份写入被静默吞掉时,损坏原片继续留在原键等下次重试", () => {
    const disk = new Map([[storageKey("player"), "不是 JSON"]]);
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => disk.get(k) ?? null,
      setItem: () => undefined,
      removeItem: (k: string) => void disk.delete(k),
      clear: () => disk.clear(),
      key: () => null,
      length: 0,
    });

    expect(preflightScan()).toEqual(["player"]);
    expect(disk.get(storageKey("player")), "备份没写成却删原键,原档就永久丢了").toBe("不是 JSON");
    expect(disk.has(`corrupt.${storageKey("player")}`)).toBe(false);
    vi.unstubAllGlobals();
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

    // 导入与清档走的是**直写**路径(不经节流层),必须同样被挡住 ——
    // 否则只读页仍能把写者刚存下的档整片换掉
    expect(clearAllSave(), "只读页不许清档").toBe(false);
    expect(() => applyImportPayload({} as ExportPayload), "只读页不许导入").toThrow(/只读/);

    vi.unstubAllGlobals();
  });
});

describe("只读页 · 被拦下的写入要说一声", () => {
  /*
   * 只读页上的操作在内存里「成功」,但永远不落盘。上一轮之前它们是静默的 ——
   * 玩家要等到刷新才发现白忙。判据:拦下第一笔写入时通知订阅者,同一阵操作只喊
   * 一次(一次点击常连写几个分片),换到窗口之后再说下一次。
   */
  it("拦下时通知一次,同一窗口内不重复喊", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const mod = await import("./storage");
      const seen: string[] = [];
      mod.onBlockedSaveWrite((key) => seen.push(key));
      mod.blockSaveWrites();

      mod.persistConfig("game").storage.setItem("xuanshu.game", "{}");
      expect(seen, "第一笔被拦下的写入要喊一声").toEqual(["xuanshu.game"]);

      mod.persistConfig("player").storage.setItem("xuanshu.player", "{}");
      expect(seen, "同一阵操作(同一次点击连写多片)只喊一次").toHaveLength(1);

      vi.setSystemTime(new Date("2026-01-01T00:00:06Z"));
      mod.persistConfig("game").storage.setItem("xuanshu.game", "{}");
      expect(seen, "过了窗口再拦下一笔,要再说一声").toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("写者页的写入不触发通报 —— 这条判据不误伤正常存档", async () => {
    vi.resetModules();
    const mod = await import("./storage");
    const seen: string[] = [];
    mod.onBlockedSaveWrite((key) => seen.push(key));
    mod.persistConfig("game").storage.setItem("xuanshu.game", "{}");
    expect(seen).toEqual([]);
  });

  it("退订之后不再收到通报", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-02-01T00:00:00Z"));
      const mod = await import("./storage");
      let count = 0;
      const off = mod.onBlockedSaveWrite(() => {
        count += 1;
      });
      mod.blockSaveWrites();
      mod.persistConfig("game").storage.setItem("xuanshu.game", "{}");
      expect(count).toBe(1);
      off();
      vi.setSystemTime(new Date("2026-02-01T00:00:09Z"));
      mod.persistConfig("game").storage.setItem("xuanshu.game", "{}");
      expect(count, "退订后不该再喊").toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
