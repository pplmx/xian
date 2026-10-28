/**
 * 旧版存档迁移 —— 老玩家的档必须进得来
 *
 * 存档版本从 1 走到 2 时改过一件事:法宝从「单法宝位」(`equippedArtifact`)换成
 * 「多法宝位」(`equippedArtifacts`)。这条路有两个入口,此前都没有用例:
 *
 *   · 启动时:`migrateLocalSchema` 就地升级本机分片,并把旧**明文**档转成密文;
 *   · 导入时:`save.ts` 的 migrate 按 version 走链式升级。
 *
 * 迁移写坏的后果不是报错,而是**悄悄少一件东西**:法宝位空了、旧字段留在档里
 * 反复参与后续迁移。故这里把三件事都钉住:值搬过去了、旧字段清掉了、幂等。
 *
 * 故障注入:让 migrateInventorySlice 丢掉旧值(或保留 equippedArtifact),第一条红;
 * 让 migrateLocalSchema 只迁移不加密(去掉 encryptSave),密文那条红。
 */
import { describe, expect, it, beforeEach, vi } from "vite-plus/test";
import { createApp } from "vue";
import { createPinia, setActivePinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import {
  LEGACY_SAVE_PREFIX,
  clearAllSave,
  dropPendingWrites,
  flushSaveWrites,
  migrateInventorySlice,
  migrateLegacyPrefix,
  migrateLocalSchema,
  preflightScan,
  saveWriteFailure,
  storageKey,
} from "@/utils/storage";
import { decryptSave, readSaveText } from "@/utils/crypto";
import { importSaveText } from "./save";
import { useInventoryStore } from "@/stores/inventory";
import { useGameStore } from "@/stores/game";
import { usePlayerStore } from "@/stores/player";

function installStorage(): Map<string, string> {
  const disk = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => disk.get(k) ?? null,
    setItem: (k: string, v: string) => void disk.set(k, v),
    removeItem: (k: string) => void disk.delete(k),
    clear: () => disk.clear(),
    key: () => null,
    length: 0,
  });
  return disk;
}

function installDroppingStorage(): {
  disk: Map<string, string>;
  allowWrites: (ok: boolean) => void;
} {
  const disk = new Map<string, string>();
  let dropping = false;
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => disk.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (!dropping) disk.set(k, v);
    },
    removeItem: (k: string) => void disk.delete(k),
    clear: () => disk.clear(),
    key: (i: number) => [...disk.keys()][i] ?? null,
    get length() {
      return disk.size;
    },
  });
  return {
    disk,
    allowWrites: (ok) => {
      dropping = !ok;
    },
  };
}

function bootStores(): void {
  const pinia = createPinia();
  pinia.use(piniaPluginPersistedstate);
  createApp({ render: () => null }).use(pinia);
  setActivePinia(pinia);
}

const LEGACY_V1 = {
  items: [{ uid: "u1", templateId: "w_zhuqing", quality: "fine", tier: 1, level: 0, affixes: [] }],
  equipped: { weapon: "u1" },
  pills: {},
  artifacts: [{ defId: "af_youming", level: 2 }],
  equippedArtifact: "af_youming",
};

describe("迁移 · v1 单法宝位 → v2 多法宝位", () => {
  it("旧值搬进新字段,旧字段清掉", () => {
    const next = migrateInventorySlice(structuredClone(LEGACY_V1));
    expect(next.equippedArtifacts, "旧法宝没搬过来 —— 玩家的法宝位会空着").toEqual(["af_youming"]);
    expect("equippedArtifact" in next, "旧字段留在档里,会反复参与后续迁移").toBe(false);
    expect(next.items, "其它字段不该被动").toEqual(LEGACY_V1.items);
  });

  it("已经是新形状的原样返回(幂等)", () => {
    const v2 = { equippedArtifacts: ["af_a", "af_b"], items: [] };
    const first = migrateInventorySlice(structuredClone(v2));
    expect(first).toEqual(v2);
    expect(migrateInventorySlice(structuredClone(first)), "跑第二遍不该变样").toEqual(v2);
  });

  it("旧字段是空串/垃圾时,新字段该是空数组而不是垃圾", () => {
    expect(migrateInventorySlice({ equippedArtifact: "" }).equippedArtifacts).toEqual([]);
    expect(migrateInventorySlice({ equippedArtifact: 42 }).equippedArtifacts).toEqual([]);
    expect(migrateInventorySlice({}).equippedArtifacts).toEqual([]);
  });
});

describe("迁移 · 启动时就地升级本机分片", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installStorage();
    dropPendingWrites();
    clearAllSave();
  });

  it("旧明文档被升级并转成密文", () => {
    localStorage.setItem(storageKey("inventory"), JSON.stringify(LEGACY_V1));
    migrateLocalSchema();
    const raw = localStorage.getItem(storageKey("inventory"))!;
    expect(raw, "迁移后的分片必须落密文").not.toContain("af_youming");
    const back = JSON.parse(decryptSave(raw)!);
    expect(back.equippedArtifacts).toEqual(["af_youming"]);
    expect("equippedArtifact" in back).toBe(false);
  });

  it("分片是垃圾时不动它、也不抛(交由损坏扫描兜底)", () => {
    localStorage.setItem(storageKey("inventory"), "这不是 JSON");
    expect(() => migrateLocalSchema()).not.toThrow();
    expect(localStorage.getItem(storageKey("inventory"))).toBe("这不是 JSON");
  });

  it("其它分片还是明文的老档,也读得出来(迁移只碰 inventory,但读取要认明文)", () => {
    // v1 那个年代所有分片都是明文;迁移只把 inventory 转密文,其余的仍以明文留在盘上。
    // 于是每一次启动都要靠 readSaveText 的「明文明文回退」把它们读回来 ——
    // 上上一轮修的解密误判(明文被当密文解出乱码)正好会在这里咬人。
    localStorage.setItem(storageKey("player"), JSON.stringify({ major: 6, age: 300 }));
    localStorage.setItem(storageKey("inventory"), JSON.stringify(LEGACY_V1));
    migrateLocalSchema();
    bootStores();
    expect(usePlayerStore().major, "明文 player 分片没读回来").toBe(6);
    expect(useInventoryStore().equippedArtifacts).toEqual(["af_youming"]);
  });

  it("总迁移写盘失败时,内存仍读迁移值,恢复后不会把法宝写丢", () => {
    const { disk, allowWrites } = installDroppingStorage();
    disk.set(storageKey("inventory"), JSON.stringify(LEGACY_V1));
    allowWrites(false);

    migrateLocalSchema();
    expect(saveWriteFailure(), "启动迁移写失败也要进入全局存档警告").not.toBeNull();
    bootStores();
    const inventory = useInventoryStore();
    expect(
      inventory.equippedArtifacts,
      "磁盘没写成时仍按旧形状加载,法宝位会空着,下一次刷盘就把旧法宝覆盖掉",
    ).toEqual(["af_youming"]);

    inventory.sanitize();
    allowWrites(true);
    flushSaveWrites();
    const stored = JSON.parse(decryptSave(disk.get(storageKey("inventory"))!)!);
    expect(stored.equippedArtifacts).toEqual(["af_youming"]);
  });

  it("坏的新前缀键无法隔离时,旧前缀仍是下一次启动可救的唯一副本", () => {
    const { disk, allowWrites } = installDroppingStorage();
    const oldKey = `${LEGACY_SAVE_PREFIX}player`;
    const newKey = storageKey("player");
    const validLegacy = JSON.stringify({ major: 6, age: 300 });
    disk.set(newKey, "这不是 JSON");
    disk.set(oldKey, validLegacy);
    allowWrites(false);

    expect(preflightScan()).toEqual(["player"]);
    expect(disk.get(newKey), "坏档写不进备份时应保留原键").toBe("这不是 JSON");
    migrateLegacyPrefix();
    expect(disk.get(oldKey), "新键坏到隔离都失败,却把仍可读的旧档删了,这份进度就永久丢了").toBe(
      validLegacy,
    );

    allowWrites(true);
    preflightScan();
    migrateLegacyPrefix();
    expect(JSON.parse(readSaveText(disk.get(newKey)!))).toEqual({ major: 6, age: 300 });
    expect(disk.has(oldKey)).toBe(false);
  });
});

describe("迁移 · 导入一份 v1 存档", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installStorage();
    dropPendingWrites();
    clearAllSave();
  });

  it("导得进来,法宝位有东西,旧字段不残留", () => {
    const payload = {
      game: "xuanshu",
      version: 1,
      exportedAt: Date.now(),
      data: {
        game: { started: true },
        player: { major: 3 },
        inventory: structuredClone(LEGACY_V1),
      },
    };
    expect(importSaveText(JSON.stringify(payload)), "v1 存档应当能导入").toBeNull();

    const raw = localStorage.getItem(storageKey("inventory"))!;
    const stored = JSON.parse(decryptSave(raw)!);
    expect(stored.equippedArtifacts, "导入后旧法宝位没搬过来").toEqual(["af_youming"]);
    expect("equippedArtifact" in stored).toBe(false);

    bootStores();
    const inventory = useInventoryStore();
    const game = useGameStore();
    expect(inventory.artifacts.map((a) => a.defId)).toEqual(["af_youming"]);
    expect(inventory.$state, "旧字段不该出现在运行时状态里").not.toHaveProperty("equippedArtifact");
    expect(game.started, "导入后应当已开局").toBe(true);
  });
});
