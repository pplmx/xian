/**
 * 半损坏档不许把玩家挡在门外
 *
 * 存档会被手改、会在旧版本里缺字段、会只坏一片。各 store 自己那层已有 sanitize
 * (见 storeResilience),但**导入这条路**此前没有端到端验证:导入 → 落盘 →
 * 重新水合 → sanitize,四个环节串起来跑一遍,才叫「这份档进得了游戏」。
 *
 * 判据只有两条,却把「不许炸」与「不许撒谎」都覆盖了:
 *
 *   一 要么明确拒绝(返回错误信息),要么接受 —— 接受之后**水合不许抛**,
 *      且读出来的状态是能用的(数字字段是数字、数组字段是数组);
 *   二 明确拒绝时,本机现有存档必须原样留着(不能一半写进去)。
 *
 * 实测的七种坏法:分片为 null / 数组 / 空对象、字段全垃圾,一律被修成形进得去;
 * 分片为字符串或数字、game 缺失,一律被导入前校验挡下 —— 两条路都不炸。
 */
import { describe, expect, it, vi, beforeEach } from "vite-plus/test";
import { createApp } from "vue";
import { createPinia, setActivePinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import {
  PERSISTED_STORES,
  clearAllSave,
  dropPendingWrites,
  flushSaveWrites,
  persistConfig,
  preflightScan,
  saveWriteFailure,
  storageKey,
  SAVE_VERSION,
} from "@/utils/storage";
import { importSaveText, inspectImportText, importRejectReason } from "./save";
import { useGameStore } from "@/stores/game";
import { usePlayerStore } from "@/stores/player";
import { useInventoryStore } from "@/stores/inventory";
import { useCultivationStore } from "@/stores/cultivation";
import { MAX_MAJOR } from "@/data/realms";

function installStorage(): void {
  const disk = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => disk.get(k) ?? null,
    setItem: (k: string, v: string) => void disk.set(k, v),
    removeItem: (k: string) => void disk.delete(k),
    clear: () => disk.clear(),
    key: () => null,
    length: 0,
  });
}

/** 真 pinia + 真持久化插件:让「落盘 → 水合」这条路完整跑起来 */
function bootStores(): void {
  const pinia = createPinia();
  pinia.use(piniaPluginPersistedstate);
  createApp({ render: () => null }).use(pinia);
  setActivePinia(pinia);
}

/** 一份包着坏数据的合法信封 */
function envelope(data: Record<string, unknown>): string {
  return JSON.stringify({ game: "xuanshu", version: 2, exportedAt: Date.now(), data });
}

const NASTY: { name: string; data: Record<string, unknown> }[] = [
  { name: "player 是 null", data: { game: { started: true }, player: null } },
  { name: "player 是数组", data: { game: { started: true }, player: [] } },
  { name: "player 是空对象", data: { game: {}, player: {} } },
  {
    name: "字段全是垃圾",
    data: {
      game: { started: "yes", lastActiveAt: "x" },
      player: { major: "3", exp: "x", linggen: 5, reincarnation: "no" },
    },
  },
  {
    name: "背包分片形状不对",
    data: {
      game: { started: true },
      player: { major: 3 },
      inventory: { items: "x", equipped: 5, artifacts: null, equippedArtifacts: {} },
      cultivation: { learned: "no", subGongfa: 7 },
    },
  },
];

const REJECTED: { name: string; data: Record<string, unknown> }[] = [
  { name: "player 是字符串", data: { game: { started: true }, player: "x" } },
  { name: "player 是数字", data: { game: { started: true }, player: 42 } },
  { name: "game 缺失", data: { player: { major: 3 } } },
];

describe("半损坏档 · 进得了游戏,或者被明确拒绝", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installStorage();
    dropPendingWrites();
    clearAllSave();
  });

  for (const variant of NASTY) {
    it(`${variant.name}:导入通过,且水合后可读、字段是能用的类型`, () => {
      expect(importSaveText(envelope(variant.data)), "这类坏法应当被修成形,而不是拒绝").toBeNull();
      let playerMajor: number | null = null;
      expect(() => {
        bootStores();
        const player = usePlayerStore();
        const inventory = useInventoryStore();
        const cultivation = useCultivationStore();
        player.sanitize();
        inventory.sanitize();
        cultivation.sanitize();
        playerMajor = player.major;
        // 读一遍计算属性:白屏往往发生在渲染期,而不是 setState 那一刻
        void player.finalStats;
        void player.expReq;
        expect(Array.isArray(inventory.items), "背包该被修成数组").toBe(true);
        expect(typeof player.expReq, "修为需求该是能算的数").not.toBe("string");
      }, "水合/修形不该抛").not.toThrow();
      // 「能用的数」= 整数字段、落在境界表范围内(字符串 '3' 这种垃圾该被修掉而不是带进来)
      expect(Number.isInteger(playerMajor), `境界被修成了 ${String(playerMajor)},不是整数`).toBe(
        true,
      );
      expect(playerMajor!, "境界越界").toBeGreaterThanOrEqual(0);
      expect(playerMajor!, "境界越界").toBeLessThanOrEqual(MAX_MAJOR);
      // 坏档扫描也不该被这几种坏法绊倒
      expect(() => preflightScan()).not.toThrow();
    });
  }

  for (const variant of REJECTED) {
    it(`${variant.name}:明确拒绝,且本机现有存档原样留着`, () => {
      bootStores();
      useGameStore().markStarted();
      const before = localStorage.getItem(storageKey("game"));
      const err = importSaveText(envelope(variant.data));
      expect(err, "这类坏法应当在导入前就被挡下").not.toBeNull();
      expect(localStorage.getItem(storageKey("game")), "被拒绝的导入不该动现有存档").toBe(before);
    });
  }

  it("整段不是存档(纯文本/空串)也只报错不炸", () => {
    for (const text of ["这不是存档", "", "{}", "[]"]) {
      const err = importSaveText(text);
      expect(err, `「${text}」应当被拒绝`).not.toBeNull();
      expect(PERSISTED_STORES.length).toBeGreaterThan(0);
    }
  });

  it("导入旧备份:lastActiveAt 重戳为现在,归来不因快照里的旧时间戳老化到死", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    try {
      const writes = new Map<string, string>();
      vi.stubGlobal("localStorage", {
        getItem: (k: string) => writes.get(k) ?? null,
        setItem: (k: string, v: string) => void writes.set(k, v),
        removeItem: (k: string) => void writes.delete(k),
        clear: () => writes.clear(),
        key: () => null,
        length: 0,
      });
      // 一份 30 天前导出的旧备份(lastActiveAt 还是那时的时刻)
      const err = importSaveText(
        envelope({
          game: { started: true, lastActiveAt: 1_000_000 - 2_592_000_000, totalPlaySec: 0 },
          player: { major: 0, age: 146, lifespanBonusYears: 0 },
        }),
      );
      expect(err).toBeNull();
      // 重新水合后,lastActiveAt 应是「现在」,而不是快照里吞下去的旧时刻
      bootStores();
      expect(useGameStore().lastActiveAt).toBe(1_000_000);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("导入写盘中途失败:回滚,旧档原样保留(不清成半档)", () => {
    // 配额不足的存储:resources 分片写不进,其余照常
    const writes = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => writes.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (k === storageKey("resources")) throw new DOMException("quota", "QuotaExceededError");
        writes.set(k, v);
      },
      removeItem: (k: string) => void writes.delete(k),
      clear: () => writes.clear(),
      key: () => null,
      length: 0,
    });
    // 先有份旧档(直接铺两张分片)
    writes.set(storageKey("game"), "OLD_GAME");
    writes.set(storageKey("player"), "OLD_PLAYER");
    const err = importSaveText(
      envelope({
        game: { started: true },
        player: { major: 3 },
        resources: { spiritStone: { m: 1, e: 4 } },
      }),
    );
    // 失败(写不进去),而且旧档被原样救回 —— 不能被清到一半
    expect(err, "写盘失败应当报错").not.toBeNull();
    expect(writes.get(storageKey("game")), "回滚后旧 game 分片原样保留").toBe("OLD_GAME");
    expect(writes.get(storageKey("player")), "回滚后旧 player 分片原样保留").toBe("OLD_PLAYER");
  });

  it("旧档清不干净时明确拒绝导入,不能留下新旧混合档", () => {
    const before = new Map([
      [storageKey("game"), "OLD_GAME"],
      [storageKey("player"), "OLD_PLAYER"],
      [storageKey("inventory"), "OLD_INVENTORY"],
    ]);
    const writes = new Map(before);
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => writes.get(k) ?? null,
      setItem: (k: string, v: string) => void writes.set(k, v),
      // 个别 WebView 会静默拒绝删除：清档回报失败，导入不能继续盖写
      removeItem: () => undefined,
      clear: () => writes.clear(),
      key: () => null,
      length: 0,
    });

    const err = importSaveText(
      envelope({
        game: { started: true, lastActiveAt: Date.now() },
        player: { major: 7 },
      }),
    );

    expect(err, "旧档没清干净就不能回报导入成功").not.toBeNull();
    expect(
      Object.fromEntries(writes),
      "清档失败后仍盖写 game/player，会留下新角色配旧背包的混合档",
    ).toEqual(Object.fromEntries(before));
  });

  it("导入写盘失败回滚时,待写最新进度与旧警告也回来", () => {
    const writes = new Map([
      [storageKey("game"), "OLD_GAME"],
      [storageKey("player"), "OLD_PLAYER"],
    ]);
    let rejectAll = true;
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => writes.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (rejectAll || k === storageKey("resources")) {
          throw new DOMException("quota", "QuotaExceededError");
        }
        writes.set(k, v);
      },
      removeItem: (k: string) => void writes.delete(k),
      clear: () => writes.clear(),
      key: () => null,
      length: 0,
    });
    const { storage, serializer, key } = persistConfig("player");
    storage.setItem(key, serializer.serialize({ major: 9 }));
    flushSaveWrites();
    expect(saveWriteFailure(), "先制造一次真实的待写失败").not.toBeNull();
    rejectAll = false;

    const err = importSaveText(
      envelope({
        game: { started: true },
        player: { major: 3 },
        resources: { spiritStone: { m: 1, e: 4 } },
      }),
    );

    expect(err, "导入写盘失败应当报错").not.toBeNull();
    expect(storage.getItem(key), "回滚后旧档回来了,却丢掉导入前尚未落盘的最新进度").toBe(
      serializer.serialize({ major: 9 }),
    );
    expect(saveWriteFailure(), "导入回滚后旧写盘警告不能凭空消失").not.toBeNull();
    expect(writes.get(storageKey("game")), "磁盘上的旧档也应原样恢复").toBe("OLD_GAME");

    dropPendingWrites();
    clearAllSave();
  });

  it("setItem 静默不落盘时也不能回报导入成功", () => {
    const before = new Map([
      [storageKey("game"), "OLD_GAME"],
      [storageKey("player"), "OLD_PLAYER"],
      [storageKey("resources"), "OLD_RESOURCES"],
    ]);
    const writes = new Map(before);
    let dropNextResourcesWrite = true;
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => writes.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (k === storageKey("resources") && dropNextResourcesWrite) {
          dropNextResourcesWrite = false;
          return;
        }
        writes.set(k, v);
      },
      removeItem: (k: string) => void writes.delete(k),
      clear: () => writes.clear(),
      key: () => null,
      length: 0,
    });

    const err = importSaveText(
      envelope({
        game: { started: true },
        player: { major: 3 },
        resources: { spiritStone: { m: 1, e: 4 } },
      }),
    );

    expect(err, "写入被静默吞掉时,导入不能回报成功").not.toBeNull();
    expect(
      Object.fromEntries(writes),
      "识别出静默丢写后,应把旧档完整恢复,而不是留下缺 resources 的半档",
    ).toEqual(Object.fromEntries(before));
  });
});

/**
 * 「确认框说什么」与「点下去会怎样」必须是同一句话。
 *
 * 这是一条**自相矛盾**的回归:确认框里的底细(`inspectImportText`)与真正导入
 * (`importSaveText`)各写了一套判据 —— 前者只查 `version` 与 `exportedAt`,
 * 后者走 `validateImportPayload`(要求 game / data.player / data.game 齐全)。
 * 于是从别的游戏拷来的 .save 会被展示成「无名散修 · 炼气·一层」加一个可点的
 * 「用这份替换」,玩家点完才被告知"并非《玄枢录》的存档文件"。
 *
 * 判据:凡检视说"这是个像样的档",导入就必须**至少**过得了校验那一关;
 * 凡校验明确拒绝,检视就必须返回 null(版本更高是唯一例外 —— 那种档是本作的,
 * 值得在框里摊开版本号再拒绝,玩家据此知道该升级游戏)。
 */
describe("导入 · 确认框与导入路径同源", () => {
  const CASES: { label: string; text: string }[] = [
    { label: "别的游戏的档", text: JSON.stringify({ game: "other", version: 1, exportedAt: 1 }) },
    { label: "缺 game 标识", text: JSON.stringify({ version: 1, exportedAt: 1, data: {} }) },
    { label: "根本不是 JSON", text: "这不是存档" },
    { label: "空串", text: "" },
  ];

  it("不是本作的档,确认框一律不开 —— 不许给玩家一个必败的「替换」按钮", () => {
    for (const c of CASES) {
      expect(
        importRejectReason(c.text),
        `${c.label}:应当是校验拒绝的(这条用例的前提)`,
      ).not.toBeNull();
      expect(
        inspectImportText(c.text),
        `${c.label}:校验已拒绝,确认框却仍把底细摊出来 —— 点下去必然失败`,
      ).toBeNull();
    }
  });

  it("本作的档即使缺分片也进确认框 —— 那是导出侧会产出的形状", () => {
    /**
     * 这条与上一条是一对:`buildExportSnapshot` 只打包**存在**的分片,
     * 刚建号还没写过档时 data.player 可以缺席。那是本作自己会产出的东西,
     * 挡在确认框外就成了"自己的存档自己导不回来"。
     * 实测:把门槛收紧成全套 validateImportPayload 时,saveRoundTrip 那条正例当场红。
     */
    const noPlayer = JSON.stringify({
      game: "xuanshu",
      version: SAVE_VERSION,
      exportedAt: 1_700_000_000_000,
      data: { game: { started: true } },
    });
    const info = inspectImportText(noPlayer);
    expect(info, "本作的档缺 player 分片,仍该开确认框").not.toBeNull();
    expect(info!.name, "缺名字时说「无名散修」,不编一个").toBe("无名散修");
    expect(info!.tooNew).toBe(false);
  });

  it("版本更高的档仍进确认框 —— 它是本作的档,该让玩家看见版本号再决定", () => {
    const future = JSON.stringify({
      game: "xuanshu",
      version: SAVE_VERSION + 1,
      exportedAt: 1_700_000_000_000,
      data: { player: { name: "未来人", major: 3, sub: 1 }, game: { started: true } },
    });
    const inspected = inspectImportText(future);
    expect(inspected, "版本更高不该被当成「不是存档」").not.toBeNull();
    expect(inspected!.tooNew).toBe(true);
    expect(inspected!.name).toBe("未来人");
  });

  it("自证:同一份「看着像档」的输入,两条路给的结论必须一致", () => {
    // 这条防的是"两处又被写成两套判据" —— 若哪天有人把 inspect 改回只看
    // version/exportedAt,上面第一条会红;这里再钉一次正例,免得判据被改成"永远 null"
    const real = JSON.stringify({
      game: "xuanshu",
      version: SAVE_VERSION,
      exportedAt: 1_700_000_000_000,
      data: { player: { name: "正常人", major: 2, sub: 3 }, game: { started: true } },
    });
    expect(importRejectReason(real), "这份档该过校验").toBeNull();
    const inspected = inspectImportText(real);
    expect(inspected, "过了校验的档,确认框必须给得出底细").not.toBeNull();
    expect(inspected!.name).toBe("正常人");
    expect(inspected!.tooNew).toBe(false);
  });
});
