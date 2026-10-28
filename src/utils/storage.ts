/**
 * 存档底层工具 —— localStorage 安全读写 / 导出导入 / 损坏保护
 * 所有落盘内容均经 AES 加密(见 utils/crypto.ts),读取时兼容旧版明文
 */

import type { StateTree } from "pinia";
import { decryptSave, encryptSave, readSaveText } from "./crypto";

export const SAVE_PREFIX = "xuanshu.";
/**
 * 更名前的存储前缀 —— **别删**。
 *
 * 玩家的进度按 `前缀 + store id` 落在 localStorage 里,改前缀等于换了一套键:
 * 不迁移的话,老玩家打开游戏会看到"新号"。故 `migrateLegacyPrefix()` 在启动时
 * 把旧前缀下的分片原样搬到新前缀(值本身就是密文,搬过去照样能解)。
 */
export const LEGACY_SAVE_PREFIX = "yunyin.";
/** 更名前导出文件里写的游戏标识(`buildExportPayload` 曾经写的就是它) */
export const LEGACY_GAME_ID = "yunyin-xiuxian";
export const SAVE_VERSION = 2;

/** 参与持久化的 store id 列表(导出/导入/重置的键清单) */
export const PERSISTED_STORES = [
  "game",
  "player",
  "resources",
  "inventory",
  "cultivation",
  "dongfu",
  "adventure",
  "quests",
  "settings",
  "loadouts",
  "endgame",
  "lore",
  /**
   * 节奏遥测(store id 是 pacingTelemetry,分片键取 'pacing')。
   *
   * 此前它不在清单里 —— 于是玩家点「清空存档」之后,这片遥测仍留在本机;
   * 导出也不含它。清单是导出/导入/清档/损坏扫描的唯一范围,漏一个就等于
   * 存档少一块(且没有任何提示)。审计 saveRoundTrip 现在从源码倒推这份清单。
   */
  "pacing",
  /**
   * 异常留档(store id 是 diag)。
   *
   * 单独一片的理由与 pacing 相同:它不是游戏进度,却必须随「导出存档」一起走 ——
   * 玩家报问题时,那份导出文件是他唯一会交出来的东西。
   */
  "diag",
  /** 坊市:货架与寄卖随存档,离线照走 */
  "market",
  /** 坊市悬赏板:当前一版收购订单随存档 */
  "bounty",
  /** 收徒:已收弟子与游历任务随存档 */
  "apprentice",
] as const;

/**
 * 分片的中文名 —— 只在说人话的地方用(如「哪一片坏了」)。
 *
 * 与 PERSISTED_STORES 放在一起:清单改了这个也得跟着改,
 * 否则界面上会出现一个叫「resources」的东西。
 */
export const STORE_NAMES: Record<string, string> = {
  game: "开局",
  player: "角色",
  resources: "资源",
  inventory: "背包",
  cultivation: "修炼",
  dongfu: "洞府",
  adventure: "历练",
  quests: "任务与成就",
  settings: "设置",
  loadouts: "构筑",
  endgame: "终局",
  lore: "认知",
  pacing: "节奏遥测",
  diag: "异常留档",
  market: "坊市",
  bounty: "悬赏板",
  apprentice: "收徒",
};

export function storageKey(storeId: string): string {
  return SAVE_PREFIX + storeId;
}

const SAVE_KEY_PREFIXES = [SAVE_PREFIX, LEGACY_SAVE_PREFIX] as const;

/** 本作存储键:当前/改名前的分片,以及由它们派生的坏档备份 */
function isSaveOwnedKey(key: string): boolean {
  return SAVE_KEY_PREFIXES.some(
    (prefix) => key.startsWith(prefix) || key.startsWith(`corrupt.${prefix}`),
  );
}

/** 即使 Storage 枚举不可用,这些由分片清单派生的键也一定能尝试删除 */
function knownSaveKeys(): string[] {
  const keys: string[] = [];
  for (const id of PERSISTED_STORES) {
    for (const prefix of SAVE_KEY_PREFIXES) {
      keys.push(prefix + id, `corrupt.${prefix}${id}`);
    }
  }
  return keys;
}

/**
 * 列出所有归本作所有的键。
 *
 * `complete=false` 表示 Storage 枚举本身失败:此时仍返回清单里已知的键用于清理,
 * 但调用方不能把「没找到残留」当成「已经清干净」。
 */
function scanSaveKeys(): { keys: string[]; complete: boolean } {
  const keys = new Set(knownSaveKeys());
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      // length 内的 key() 不该返回 null;若个别 WebView 静默坏了,不能当成枚举完整
      if (key === null) return { keys: [...keys], complete: false };
      if (isSaveOwnedKey(key)) keys.add(key);
    }
  } catch {
    return { keys: [...keys], complete: false };
  }
  return { keys: [...keys], complete: true };
}

function hasSaveKeyLeftover(): boolean {
  const scan = scanSaveKeys();
  if (!scan.complete) return true;
  return scan.keys.some((key) => {
    try {
      return localStorage.getItem(key) !== null;
    } catch {
      // 读不了不等于已经删掉:清档结果不确定时不能回报成功
      return true;
    }
  });
}

/** 只删除本作键域并复核;待写队列与失败状态由调用方决定何时处理 */
function clearOwnedSaveKeys(): boolean {
  if (writesBlocked) return false;
  for (const key of scanSaveKeys().keys) {
    try {
      localStorage.removeItem(key);
    } catch {
      // 单键失败不阻断其余键,残留由下面的复核如实回报
    }
  }
  return !hasSaveKeyLeftover();
}

/** 写入后立刻读回;吞写、写错值或读失败都按「没落盘」处理 */
function writeVerified(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return localStorage.getItem(key) === value;
  } catch {
    return false;
  }
}

/**
 * 导入前快照本作键域。键清单里的缺席项也记成 null,
 * 这样中途失败时能把新写进去、旧档里本来没有的分片删掉。
 */
function snapshotOwnedSaveKeys(): Map<string, string | null> | null {
  const backup = new Map<string, string | null>();
  for (const key of scanSaveKeys().keys) {
    try {
      backup.set(key, localStorage.getItem(key));
    } catch {
      return null;
    }
  }
  return backup;
}

/** 把原分片逐键写回并复核;删除或写入被静默吞掉都不能算回滚成功 */
function restoreOwnedSaveKeys(backup: Map<string, string | null>): boolean {
  for (const [key, raw] of backup) {
    try {
      if (raw === null) localStorage.removeItem(key);
      else localStorage.setItem(key, raw);
    } catch {
      // 下面统一复核;这里继续尽力恢复其余键
    }
  }
  for (const [key, raw] of backup) {
    try {
      if (localStorage.getItem(key) !== raw) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * 刷盘间隔 —— 存档写入从「每次变更」改为「定期批量」。
 *
 * 起因是玩家反馈手机越玩越烫。实测引擎跑起来后仅 game/player/resources
 * 三片就是**每秒 3 次** localStorage 写入(真实游玩加上 adventure、dongfu、
 * quests 会到 4~6 次),每次都要 JSON 序列化 + 全片 AES 加密 + 主线程同步
 * 磁盘写。挂机一天约 26 万次 —— crypto-js 是纯 JS 实现,localStorage.setItem
 * 在 Android WebView 上又是同步落盘,两者叠加就是持续发热。
 *
 * 丢数据的风险很低且能自愈:引擎是时间戳驱动的,少写几秒只意味着
 * lastActiveAt 稍旧,下次进游戏由离线结算把这段时间补回来
 */
export const SAVE_FLUSH_MS = 5000;

/** 待落盘的分片(明文 JSON;加密推迟到 flush,避免每次变更都跑一遍 AES) */
const pending = new Map<string, string>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * 写盘失败的状态。
 *
 * 此前失败是**静默**的:catch 里什么也不做,随后 pending.clear() 把这一批丢掉 ——
 * 玩家可能玩了几小时、存了好几个 store,一次容量不足就把这段时间全抹了,
 * 而界面上没有任何迹象(设置页仍显示「存档版本 v2」)。写不进去是要紧事:
 * 它意味着从现在到修好为止的所有进度都不会进档,玩家至少该有机会先导出备份。
 */
let writeFailure: { at: number; keys: string[] } | null = null;
type WriteFailureHandler = (failure: { at: number; keys: string[] } | null) => void;
/** 可以有多个订阅方(App 弹提示、设置页显示状态)—— 故用集合而非单个回调 */
const writeFailureHandlers = new Set<WriteFailureHandler>();

function emitWriteFailure(failure: { at: number; keys: string[] } | null): void {
  for (const handler of writeFailureHandlers) handler(failure);
}

function clearSaveWriteFailure(): void {
  if (writeFailure === null) return;
  writeFailure = null;
  emitWriteFailure(null);
}

function restoreSaveWriteFailure(failure: { at: number; keys: string[] } | null): void {
  writeFailure = failure;
  if (failure !== null) emitWriteFailure(failure);
}

/** 订阅写盘失败/恢复(注册方负责提示玩家);解构处返回退订函数 */
export function subscribeSaveWriteFailure(handler: WriteFailureHandler): () => void {
  writeFailureHandlers.add(handler);
  return () => {
    writeFailureHandlers.delete(handler);
  };
}

/** 此刻的写盘失败状态(界面读它显示警告);从未失败过则为 null */
export function saveWriteFailure(): { at: number; keys: string[] } | null {
  return writeFailure;
}

/**
 * 只读页(多标签的后来者)对存储层的闸。
 *
 * 判定在 `core/singleWriter`:同一份存档同时只该有一个写者,否则两个页面会按各自的
 * 节流节奏把 `xuanshu.*` 分片轮流覆盖,后落盘的那份赢 —— 玩家在前台练的进度会被
 * 另一页的旧状态盖回去,而且两边都毫无提示。
 *
 * 闸放在这一层而不是各调用点:持久化插件、离线结算、导入、清档都从这里过,
 * 一处开关管全部;只读页的读路径(导出、界面读档)不受影响。
 */
let writesBlocked = false;

/**
 * 只读页里「写入被拦下」的通报。
 *
 * 只读页的操作不会报错 —— 买下、派遣、突破在内存里都照常成功,只是永远不落盘。
 * 玩家要等到刷新才发现白忙一场。故拦下第一笔写入时喊一声,让他当场知道这一步没存上。
 * 一声就够:一次操作往往连写好几个分片,同窗口内不再重复。
 */
type BlockedWriteListener = (key: string) => void;
const blockedWriteListeners = new Set<BlockedWriteListener>();
const BLOCKED_NOTICE_WINDOW_MS = 5000;
let lastBlockedNoticeAt = 0;

/** 订阅「只读页拦下了一笔写入」;返回退订函数 */
export function onBlockedSaveWrite(listener: BlockedWriteListener): () => void {
  blockedWriteListeners.add(listener);
  return () => {
    blockedWriteListeners.delete(listener);
  };
}

function announceBlockedWrite(key: string): void {
  const now = Date.now();
  if (now - lastBlockedNoticeAt < BLOCKED_NOTICE_WINDOW_MS) return;
  lastBlockedNoticeAt = now;
  for (const listener of blockedWriteListeners) listener(key);
}

/** 把本页切成只读:丢弃待写队列、停掉刷盘、此后所有写入(含删除)都是空操作 */
export function blockSaveWrites(): void {
  writesBlocked = true;
  pending.clear();
  if (flushTimer !== undefined) {
    clearTimeout(flushTimer);
    flushTimer = undefined;
  }
}

/**
 * 直写路径的闸 —— 导入与清档不走节流层(它们要立刻覆盖磁盘、且可能失败回滚),
 * 故单靠 `writesBlocked` 拦不住;这两个入口必须自己问一句。
 * 只读页里清档若静默返回,玩家会以为档已经没了 —— 所以这里抛错,由调用方说清楚。
 */
function assertWritable(): void {
  if (writesBlocked) throw new Error("本页为只读(已在另一处打开),不会改动存档");
}

/** 立即把待落盘内容写出去;单个分片失败时留在队列里等下一次重试 */
export function flushSaveWrites(): void {
  if (flushTimer !== undefined) {
    clearTimeout(flushTimer);
    flushTimer = undefined;
  }
  if (writesBlocked || pending.size === 0) return;
  const failed: string[] = [];
  for (const [key, plain] of pending) {
    try {
      // 加密只在这里做一次,而不是每次 store 变更都做
      const encoded = encryptSave(plain);
      // 个别 WebView 会静默吞写:不复核就会删掉队列,把没落盘的一批当成成功
      if (!writeVerified(key, encoded)) failed.push(key);
    } catch {
      // 单键失败不阻断其余键;失败的那一片留在队列里,下次再写
      failed.push(key);
    }
  }
  for (const key of pending.keys()) {
    if (!failed.includes(key)) pending.delete(key);
  }
  if (failed.length > 0) {
    const first = writeFailure === null;
    writeFailure = { at: Date.now(), keys: failed };
    if (first) emitWriteFailure(writeFailure);
    // 自动重试:玩家清一点空间、或系统短暂拒绝之后,不用等下一次变更才有机会落盘
    if (flushTimer === undefined) flushTimer = setTimeout(flushSaveWrites, SAVE_FLUSH_MS);
    return;
  }
  if (writeFailure !== null) {
    writeFailure = null;
    emitWriteFailure(null);
  }
}

/** 丢弃待落盘内容 —— 清档/导入前必须调用,否则排队的旧数据会把新状态覆盖回去 */
export function dropPendingWrites(): void {
  if (flushTimer !== undefined) {
    clearTimeout(flushTimer);
    flushTimer = undefined;
  }
  pending.clear();
}

function restorePendingWrites(backup: Map<string, string>): void {
  pending.clear();
  for (const [key, value] of backup) pending.set(key, value);
  if (pending.size > 0 && flushTimer === undefined && !writesBlocked) {
    flushTimer = setTimeout(flushSaveWrites, SAVE_FLUSH_MS);
  }
}

/**
 * 节流存储层:变更先入队,到点批量加密落盘。
 *
 * getItem 必须优先读队列,否则「刚写又读」会拿到磁盘上的旧值
 */
const THROTTLED_STORAGE = {
  getItem: (key: string): string | null => {
    const queued = pending.get(key);
    if (queued !== undefined) return queued;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (writesBlocked) {
      announceBlockedWrite(key);
      return;
    }
    pending.set(key, value);
    if (flushTimer === undefined) flushTimer = setTimeout(flushSaveWrites, SAVE_FLUSH_MS);
  },
  removeItem: (key: string): void => {
    pending.delete(key);
    if (writesBlocked) return;
    try {
      localStorage.removeItem(key);
    } catch {
      // 存储不可用时忽略
    }
  },
};

// 页面离开/切后台时立刻落盘 —— 手机上 beforeunload 常不触发,pagehide 才可靠。
// 注册在模块内,不依赖引擎是否启动;测试环境无 DOM,故两者都要判
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushSaveWrites);
  window.addEventListener("beforeunload", flushSaveWrites);
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushSaveWrites();
  });
}

/**
 * pinia-plugin-persistedstate 序列化器。
 *
 * serialize 只做 JSON,**不加密** —— 加密推迟到 flushSaveWrites。
 * deserialize 端无需区分:readSaveText 是 `decryptSave(raw) ?? raw`,
 * 明文(来自待刷队列)与密文(来自磁盘)都能解析
 */
export const SAVE_SERIALIZER = {
  serialize: (data: StateTree): string => JSON.stringify(data),
  deserialize: (raw: string): StateTree => JSON.parse(readSaveText(raw)) as StateTree,
};

/** 各 store 统一的持久化配置 */
export function persistConfig(storeId: string): {
  key: string;
  serializer: typeof SAVE_SERIALIZER;
  storage: typeof THROTTLED_STORAGE;
} {
  return { key: storageKey(storeId), serializer: SAVE_SERIALIZER, storage: THROTTLED_STORAGE };
}

/**
 * 启动前扫描:发现损坏的存档直接移到备份键,避免白屏
 * @returns 被隔离的 store id 列表
 */
export function preflightScan(): string[] {
  const corrupted: string[] = [];
  for (const id of PERSISTED_STORES) {
    const key = storageKey(id);
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      JSON.parse(readSaveText(raw));
    } catch {
      corrupted.push(id);
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null && writeVerified(`corrupt.${key}`, raw)) {
          // 备份读回一致后才删原片;写不进时留下唯一副本,下次启动再试
          try {
            localStorage.removeItem(key);
          } catch {
            // 备份已经在,原片删不掉最多重复隔离,不能反过来丢原档
          }
        }
      } catch {
        // 存储不可用时放弃备份,仅保证游戏可启动
      }
    }
  }
  return corrupted;
}

/** v1 → v2:单法宝位升级为多法宝位(幂等,顺带清理残留旧字段) */
export function migrateInventorySlice(data: Record<string, unknown>): Record<string, unknown> {
  const hasNew = "equippedArtifacts" in data;
  const hasLegacy = "equippedArtifact" in data;
  if (hasNew && !hasLegacy) return data;
  const next = { ...data };
  if (!hasNew) {
    const legacy = data.equippedArtifact;
    next.equippedArtifacts = typeof legacy === "string" && legacy ? [legacy] : [];
  }
  delete next.equippedArtifact;
  return next;
}

/**
 * (迁移前)灵草五品:旧版灵草是单标量,拆成五档后一律认凡品。
 *
 * ISS-306:老玩家攒下的草本来就是新手村时期采的,分品时全数作凡品(1)平账;
 * 五档表可能缺档(旧档根本没这个形),逐档补 0;顺带清掉已删除的灵草→灵石
 * 兑换额度残留(herbExchangeUsed / herbExchangeRealm)。
 */
export function migrateResourcesSlice(data: Record<string, unknown>): Record<string, unknown> {
  const next = { ...data };
  const legacy = next.herb;
  const existing = next.herbs;
  const herbs: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (typeof existing === "object" && existing !== null) {
    for (const k of [1, 2, 3, 4, 5]) {
      const v = (existing as Record<string, unknown>)[String(k)];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) herbs[k] = Math.floor(v);
    }
  }
  if (typeof legacy === "number" && Number.isFinite(legacy) && legacy > 0) {
    herbs[1] = (herbs[1] ?? 0) + Math.floor(legacy);
  }
  next.herbs = herbs;
  delete next.herb;
  delete next.herbExchangeUsed;
  delete next.herbExchangeRealm;
  return next;
}

/**
 * 本地存档结构升级(在 Pinia 水合之前执行);顺带把旧明文档一次性转为密文
 */
export function migrateLocalSchema(): void {
  try {
    migrateLegacyPrefix();
  } catch {
    // 前缀迁移失败不该阻断下面的分片升级
  }
  let queued = false;
  for (const [key, fn] of [
    ["inventory", migrateInventorySlice],
    ["resources", migrateResourcesSlice],
  ] as const) {
    try {
      const storeKey = storageKey(key);
      const raw = localStorage.getItem(storeKey);
      if (raw === null) continue;
      const data = JSON.parse(readSaveText(raw)) as Record<string, unknown>;
      const migrated = fn(data);
      const plain = JSON.stringify(migrated);
      // 已经是密文且形状没变的分片不重写,避免每次启动都跑一遍 AES 与同步写盘
      if (decryptSave(raw) !== null && plain === JSON.stringify(data)) continue;
      /*
       * 迁移结果先入待写队列再刷盘。个别 WebView 会静默吞掉 setItem:
       * 若这里只做一次直写就继续启动,Pinia 会按盘上的旧形状水合,下一次
       * store 落盘就把迁移前才有的字段(如 v1 单法宝位)覆盖掉。
       * 队列同时服务「读己所写」,所以写盘失败时内存仍拿得到迁移后的值。
       */
      THROTTLED_STORAGE.setItem(storeKey, plain);
      queued = true;
    } catch {
      // 单个坏分片不阻断其它分片升级;损坏隔离仍由 preflightScan 负责
    }
  }
  if (queued) flushSaveWrites();
}

/**
 * 更名迁移:把旧前缀下的分片搬到新前缀。
 *
 * 只在"新键不存在"时搬(玩家若已经在新闻名版本里玩过,新档优先);
 * 值是密文,原样搬过去即可解开 —— 加密密钥(`utils/crypto.SAVE_SECRET`)刻意没有随名字改。
 * 搬完删掉旧键:它们不会再被读,留着只会让"清空存档"看起来没清干净。
 */
export function migrateLegacyPrefix(): number {
  let moved = 0;
  try {
    const legacy: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LEGACY_SAVE_PREFIX)) legacy.push(key);
    }
    for (const oldKey of legacy) {
      const target = SAVE_PREFIX + oldKey.slice(LEGACY_SAVE_PREFIX.length);
      const value = localStorage.getItem(oldKey);
      const targetValue = localStorage.getItem(target);
      if (value !== null && targetValue === null) {
        // 写入可能被静默吞掉。旧键是唯一副本,确认新键读回一致前不能删。
        if (!writeVerified(target, value)) {
          try {
            localStorage.removeItem(target);
          } catch {
            // 清掉可能写坏的新键只是尽力而为;旧键无论如何都先留着
          }
          continue;
        }
        moved += 1;
      } else if (value !== null && !isReadableSaveValue(targetValue)) {
        /*
         * 新键存在但坏到连隔离都写不进去备份时,启动前缀迁移不能再删旧键。
         * 下次存储恢复后,preflightScan 先备份/移走坏新键,这条旧档仍可搬过去。
         */
        continue;
      }
      localStorage.removeItem(oldKey);
    }
  } catch {
    // 配额不足 / 隐私模式禁写:交给 preflightScan 与后续兜底,别在这里炸启动
  }
  return moved;
}

function isReadableSaveValue(raw: string | null): boolean {
  if (raw === null) return false;
  try {
    JSON.parse(readSaveText(raw));
    return true;
  } catch {
    return false;
  }
}

export interface ExportPayload {
  game: string;
  version: number;
  exportedAt: number;
  data: Record<string, unknown>;
}

export function buildExportPayload(): ExportPayload {
  // 先尽力刷盘,让正常路径导出的是磁盘上的最新一版
  flushSaveWrites();
  const data: Record<string, unknown> = {};
  for (const id of PERSISTED_STORES) {
    /*
     * 刷盘可能刚失败(存储满/被 WebView 拒绝),此时最新一版仍在 pending 里。
     * 必须走节流层的「读己所写」,否则玩家按提示导出的备份会悄悄退回上一版 ——
     * 而这正是写盘失败后最需要保住的东西。
     */
    const raw = THROTTLED_STORAGE.getItem(storageKey(id));
    if (raw !== null) {
      try {
        data[id] = JSON.parse(readSaveText(raw));
      } catch {
        // 跳过损坏分片
      }
    }
  }
  return { game: "xuanshu", version: SAVE_VERSION, exportedAt: Date.now(), data };
}

/** 校验导入数据结构,返回错误信息;null 表示通过 */
export function validateImportPayload(obj: unknown): string | null {
  if (typeof obj !== "object" || obj === null) return "存档内容不是有效对象";
  const p = obj as Partial<ExportPayload>;
  // 更名前导出的存档里写的是旧标识 —— 认它,老玩家手上那份 .save 不该因为改名而作废
  if (p.game !== "xuanshu" && p.game !== LEGACY_GAME_ID) return "并非《玄枢录》的存档文件";
  if (typeof p.version !== "number") return "存档缺少版本号";
  if (p.version > SAVE_VERSION) return "存档版本高于当前游戏版本,无法导入";
  if (typeof p.data !== "object" || p.data === null) return "存档数据段缺失";
  const data = p.data as Record<string, unknown>;
  if (typeof data.player !== "object" || typeof data.game !== "object") {
    return "存档缺少关键数据(player/game)";
  }
  return null;
}

/**
 * 将导入数据加密写入 localStorage(调用方负责随后 reload)。
 *
 * 原子性:先清空现有存档、再逐片写入,确保完全覆盖;但写入中途失败
 * (配额不足是移动端的家常便饭)时,**回滚到旧档**而不是留下半清的存档 ——
 * 「game 分片还在、player 分片没了」的主页空角色正是这半清状态造出来的。
 */
export function applyImportPayload(payload: ExportPayload): void {
  assertWritable();
  // 一 快照本作键域、待写最新值与失败状态。读不全就不开始破坏性写入。
  const backup = snapshotOwnedSaveKeys();
  if (backup === null) {
    throw new Error("读取原存档失败,已取消导入");
  }
  const pendingBackup = new Map(pending);
  const failureBackup =
    writeFailure === null ? null : { at: writeFailure.at, keys: [...writeFailure.keys] };
  // 二 清空现有存档。清不干净就不写入新档 —— 否则会留下新角色配旧背包的混合档。
  if (!clearOwnedSaveKeys()) {
    const restored = restoreOwnedSaveKeys(backup);
    throw new Error(
      restored
        ? "清空原存档失败,已回滚,原存档未改动"
        : "清空原存档失败,且恢复原存档失败;请勿刷新页面,先尝试导出备份",
    );
  }
  dropPendingWrites();
  clearSaveWriteFailure();
  // 三 逐片写入导入数据
  const failed: string[] = [];
  for (const id of PERSISTED_STORES) {
    const slice = payload.data[id];
    if (slice === undefined) continue;
    try {
      const key = storageKey(id);
      const encoded = encryptSave(JSON.stringify(slice));
      // 个别 WebView 的 setItem 会静默不落盘:不复核就会把半档当成导入成功
      if (!writeVerified(key, encoded)) failed.push(id);
    } catch {
      failed.push(id);
    }
  }
  // 四 任一失败:把快照里的旧档救回来,再向上抛,让调用方说「原档还在」
  if (failed.length > 0) {
    // 先清掉写了一半的导入分片;backup 里本来没有的键会在 restore 时删掉
    clearOwnedSaveKeys();
    const restored = restoreOwnedSaveKeys(backup);
    restorePendingWrites(pendingBackup);
    restoreSaveWriteFailure(failureBackup);
    throw new Error(
      restored
        ? `写入存档失败(${failed.join("/")}),原存档已保留`
        : `写入存档失败(${failed.join("/")}),且原存档恢复失败;请勿刷新页面,先尝试导出备份`,
    );
  }
}

export function clearAllSave(): boolean {
  /*
   * 只清本作键域,绝不调用 localStorage.clear():本作会与博客等同源页面共享
   * localStorage,整表清理会把别的站点的数据一起抹掉。
   * 清掉的范围包括改名前的 yunyin.* 分片与 corrupt.* 坏档备份 —— 它们同样是
   * 「本机修行痕迹」,重置文案承诺彻底抹去,不能只清当前分片。
   */
  // removeItem 在个别 WebView 上会静默失效;清不干净就如实回报失败
  if (!clearOwnedSaveKeys()) return false;
  /*
   * 只有确认清干净之后才丢弃待写队列 —— 反过来先丢、删除却失败时,
   * 玩家刚玩出来、还没落盘的最新一版会当场退回磁盘上的旧档,而清档
   * 本身又没有成功,等于双重损失。同步执行期间刷盘定时器不会插进来。
   */
  dropPendingWrites();
  // 清档后没有待写内容,旧的「写盘失败」警告已无意义;失败路径则原样保留
  clearSaveWriteFailure();
  return true;
}
