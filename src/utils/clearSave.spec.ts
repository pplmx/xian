import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { LEGACY_SAVE_PREFIX, clearAllSave, dropPendingWrites, storageKey } from "./storage";

afterEach(() => {
  dropPendingWrites();
  vi.unstubAllGlobals();
});

function installStorage(
  disk: Map<string, string>,
  removeItem: (key: string) => void = (key) => void disk.delete(key),
): { clearCalls: () => number } {
  let clearCalls = 0;
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => disk.get(k) ?? null,
    setItem: (k: string, v: string) => void disk.set(k, v),
    removeItem,
    key: (i: number) => [...disk.keys()][i] ?? null,
    get length() {
      return disk.size;
    },
    clear: () => {
      clearCalls += 1;
      disk.clear();
    },
  });
  return { clearCalls: () => clearCalls };
}

describe("清档 · 只清本作键域", () => {
  it("坏档备份与改名前的分片也要清掉,但不碰同源其他数据", () => {
    const disk = new Map([
      [storageKey("player"), "current"],
      [`corrupt.${storageKey("player")}`, "corrupt-current"],
      [`${LEGACY_SAVE_PREFIX}player`, "legacy"],
      [`corrupt.${LEGACY_SAVE_PREFIX}player`, "corrupt-legacy"],
      ["blog.draft", "keep-me"],
    ]);
    installStorage(disk);

    expect(clearAllSave(), "本作的分片与坏档备份都清掉后应回报成功").toBe(true);
    expect(
      [...disk.keys()].filter((k) => k.includes("player")),
      "改名前的分片或坏档备份仍在,重置就没有兑现「彻底抹去」",
    ).toEqual([]);
    expect(disk.get("blog.draft"), "同源其他站点的数据不属于本作,清档不许误删").toBe("keep-me");
  });

  it("单键删除被静默拒绝时,不许用整表 clear 误伤同源数据", () => {
    const disk = new Map([
      [storageKey("player"), "still-here"],
      ["blog.draft", "keep-me"],
    ]);
    const storage = installStorage(disk, () => undefined);

    expect(clearAllSave(), "单键没删掉就不能回报清档成功").toBe(false);
    expect(storage.clearCalls(), "整表 clear 会删掉同源其他站点的数据").toBe(0);
    expect(disk.get("blog.draft"), "清档失败也不许误删同源其他数据").toBe("keep-me");
  });

  it("Storage 枚举失效时,不能把「看不见残留」当成已经清干净", () => {
    const disk = new Map([
      [storageKey("player"), "current"],
      ["blog.draft", "keep-me"],
    ]);
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => disk.get(k) ?? null,
      setItem: (k: string, v: string) => void disk.set(k, v),
      removeItem: (k: string) => void disk.delete(k),
      key: () => null,
      get length() {
        return disk.size;
      },
      clear: () => disk.clear(),
    });

    expect(clearAllSave(), "枚举结果不可信时,清档结果也不能回报成功").toBe(false);
    expect(disk.has(storageKey("player")), "已知分片仍应尽力删除").toBe(false);
    expect(disk.get("blog.draft"), "枚举失效也不许误删同源其他数据").toBe("keep-me");
  });
});
