/**
 * 存档封装 —— 版本、迁移链、编解码。**不含存储介质**:localStorage / 文件 / 云
 * 由使用方自己接(这样才能同时用在浏览器、容器与服务器上)。
 *
 * 两条铁律,都是从"老玩家的档必须进得来"这条要求倒推的:
 *
 *   一 **迁移是链,不是分支**。版本 1 的档要能一路走到当前版本,
 *      中途每一跳只做那一跳该做的事;缺失的那一跳按"形状没变"处理(而不是跳过整条链)。
 *   二 **未来的版本不许猜**。读到比当前更高的版本,拒绝加载并说明原因 ——
 *      猜错的后果是把新档写坏,而写坏比读不到严重得多。
 */
import { asRecord } from './saveShape.js'

/** 存档封套:版本 + 存档时刻 + 数据。savedAt 用于离线结算(知道"离开多久") */
export interface SavePayload {
  version: number
  savedAt: number
  data: unknown
}

/**
 * 一份存档格式。
 *
 * `migrations[n]` 的语义是"把版本 n 的数据升到版本 n+1";
 * 缺哪一跳就按那一跳没改形状处理。`revive` 在迁移之后跑,负责最后的形状修复 ——
 * 它返回 null 表示这份存档不可用(坏得修不回来),调用方据此走兜底。
 */
export interface SaveFormat<T> {
  readonly currentVersion: number
  readonly migrations?: Readonly<Record<number, (data: unknown) => unknown>>
  readonly revive?: (data: unknown) => T | null
  /**
   * 自定义编解码(**可选**):想压缩、加密、或换一层封套时给这一对。
   *
   * 默认就是 `JSON.stringify` / `JSON.parse`。给了它们之后:
   *   · `encode(payload)` 的返回值原样作为"存档文本"交给使用方落盘;
   *   · `decode(text)` 的返回值当**已经是解析好的封套对象**,后续的版本检查、
   *     迁移链与形状修复一律照旧 —— 编解码与迁移互不干涉。
   *
   * `decode` 抛错会被当作"内容不是存档"(reason: 'parse'),所以加密实现里
   * 解密失败不必自己兜异常,直接抛即可。
   */
  readonly codec?: {
    encode: (payload: SavePayload) => string
    decode: (text: string) => unknown
  }
}

export function defineSaveFormat<T>(format: SaveFormat<T>): SaveFormat<T> {
  if (!Number.isInteger(format.currentVersion) || format.currentVersion < 1) {
    throw new Error('存档格式:currentVersion 必须是 ≥1 的整数')
  }
  return format
}

/** 按链式迁移把数据从 fromVersion 带到当前版本(缺失的跳按"形状没变"处理) */
export function runMigrations(data: unknown, fromVersion: number, format: SaveFormat<unknown>): unknown {
  let cur = data
  // 版本号不认识(缺失/NaN/负数)时按**最老**的一版处理:一步一步补上来,
  // 而不是"跳过整条链" —— 后者会让旧档悄悄缺字段,而缺字段是读档期白屏的常见起因
  const start = Number.isFinite(fromVersion) ? Math.max(1, Math.floor(fromVersion)) : 1
  for (let v = start; v < format.currentVersion; v += 1) {
    const step = format.migrations?.[v]
    if (step) cur = step(cur)
  }
  return cur
}

export type SaveDecodeResult<T> =
  | { ok: true; state: T; version: number; fromVersion: number; migrated: boolean; savedAt: number }
  | { ok: false; reason: 'parse' | 'future' | 'shape'; message: string }

/** 编码成一段文本(落盘/导出的内容就是这个) */
export function encodeSave<T>(state: T, format: SaveFormat<T>, now: number = Date.now()): string {
  const payload: SavePayload = { version: format.currentVersion, savedAt: now, data: state }
  return format.codec ? format.codec.encode(payload) : JSON.stringify(payload)
}

/**
 * 解码 + 迁移 + 形状修复。
 *
 * 三种失败各自有名字,调用方才能给玩家说清是哪一种:
 *   parse  —— 内容不是存档(损坏/选错文件);
 *   future —— 来自更新的版本(该升级,而不是丢档);
 *   shape  —— 迁移之后仍然修不好(真损坏)。
 */
export function decodeSave<T>(text: string, format: SaveFormat<T>): SaveDecodeResult<T> {
  let parsed: unknown
  try {
    parsed = format.codec ? format.codec.decode(text) : JSON.parse(text)
  } catch {
    return { ok: false, reason: 'parse', message: format.codec ? '存档内容解不开(编解码失败)' : '存档内容不是有效 JSON' }
  }
  return decodeSavePayload(parsed, format)
}

/** 同上,但输入已经是解析过的对象(例如从容器存储里读回来的一坨 JSON) */
export function decodeSavePayload<T>(parsed: unknown, format: SaveFormat<T>): SaveDecodeResult<T> {
  const payload = asRecord<unknown>(parsed)
  const version = typeof payload.version === 'number' && Number.isFinite(payload.version) ? Math.floor(payload.version) : 1
  const savedAt = typeof payload.savedAt === 'number' && Number.isFinite(payload.savedAt) ? payload.savedAt : 0
  if (version > format.currentVersion) {
    return { ok: false, reason: 'future', message: `存档版本 ${version} 来自更新的版本(本作最高 ${format.currentVersion})` }
  }
  const migrated = runMigrations(payload.data, version, format as SaveFormat<unknown>)
  const state = format.revive ? format.revive(migrated) : (migrated as T)
  if (state === null || state === undefined) {
    return { ok: false, reason: 'shape', message: '存档内容修补不回来' }
  }
  return { ok: true, state, version: format.currentVersion, fromVersion: version, migrated: version < format.currentVersion, savedAt }
}
