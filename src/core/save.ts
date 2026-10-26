/**
 * 存档服务 —— 导出 / 导入 / 重置 / 迁移
 */
import {
  applyImportPayload,
  buildExportPayload,
  clearAllSave,
  LEGACY_GAME_ID,
  migrateInventorySlice,
  SAVE_VERSION,
  validateImportPayload,
  type ExportPayload,
} from "@/utils/storage";
import { encryptSave, readSaveText } from "@/utils/crypto";
import { realmLabel } from "@/data/realms";
import { defineSaveFormat, runMigrations } from "wanxiang-engine";
import { useGameStore } from "@/stores/game";
import { engine } from "./engine";

/**
 * 本作的存档格式:版本链由公共库执行(见 packages/engine 的 save / runMigrations)。
 *
 * 版本 1 → 2 那一跳把法宝从「单法宝位」改成「多法宝位」;缺的跳按"形状没变"处理。
 * 这里只写**这一款游戏**的那几跳与目标版本,链的走法归库。
 */
const EXPORT_FORMAT = defineSaveFormat<Record<string, unknown>>({
  currentVersion: SAVE_VERSION,
  migrations: {
    1: (data) => {
      const d = { ...(data as Record<string, unknown>) };
      if (typeof d.inventory === "object" && d.inventory !== null) {
        d.inventory = migrateInventorySlice(d.inventory as Record<string, unknown>);
      }
      return d;
    },
  },
});

/** 迁移旧版本存档(链式) */
function migrate(payload: ExportPayload): ExportPayload {
  const data = runMigrations(payload.data, payload.version, EXPORT_FORMAT as never) as Record<
    string,
    unknown
  >;
  const migrated: ExportPayload = { ...payload, version: SAVE_VERSION, data: { ...data } };
  // 导入 = 从这份快照继续:lastActiveAt 重戳为现在的时刻。
  // 快照里吞着的是导出那一刻的时间戳,直接沿用会把「导入旧备份」误算成
  // 「缺勤数月」——离线资源按 8h 封顶、年龄却按全程流,先死处理
  if (migrated.data.game && typeof migrated.data.game === "object") {
    migrated.data.game = {
      ...(migrated.data.game as Record<string, unknown>),
      lastActiveAt: Date.now(),
    };
  }
  return migrated;
}

export function exportSaveText(): string {
  // 导出为密文,防手改;导入时兼容旧版明文 JSON
  return encryptSave(JSON.stringify(buildExportPayload()));
}

/** 导入存档文本(密文或旧版明文皆可);成功返回 null,失败返回错误信息 */
export function importSaveText(text: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readSaveText(text.trim()));
  } catch {
    return "文件内容无法解析(既非本游戏密文,也非有效 JSON)";
  }
  const error = validateImportPayload(parsed);
  if (error) return error;
  try {
    applyImportPayload(migrate(parsed as ExportPayload));
  } catch (e) {
    // 原子导入已回滚旧档,写明「原档还在」,免得玩家以为存档没了
    return e instanceof Error ? e.message : "写入存档失败,浏览器存储可能不可用";
  }
  return null;
}

/**
 * 这份文件**为什么**不能被当作存档导入;能导入时返回 null。给确认前的那道门用。
 *
 * 存在的理由只有一个:让"检视"与"导入"说同一句话。两处各写一套判据,
 * 就会出现「弹窗说能导、点下去说不行」这种自相矛盾 —— 而那正是这次的 bug。
 * 这里只做**无副作用的一半**(解析 + 门槛),不写库,故可以在选择文件时调用。
 */
export function importRejectReason(text: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readSaveText(text.trim()));
  } catch {
    return "文件内容无法解析(既非本游戏密文,也非有效 JSON)";
  }
  /**
   * `validateImportPayload` 用 **null 表示通过**,所以这里不能写
   * `validateImportPayload(parsed) ?? "无法导入"` —— `??` 会把"通过"当成空值
   * 兜底成错误文案,于是合法存档被判成不能导入(实测踩过:自证用例当场红)。
   * 通过时要返回 null,故原样返回。
   */
  return validateImportPayload(parsed);
}

export interface ImportInspect {
  name: string;
  realmLabel: string;
  version: number;
  exportedAt: number;
  /** 备份版本高于当前游戏:确认前就该亮出来,别等点完「用这份替换」才弹错 */
  tooNew: boolean;
}

/**
 * 只读检视一份待导入的存档(不落库):把「这是谁的档、什么版本、什么时候导的」
 * 摆到确认框里 —— 整体替换进度是不可逆动作,玩家签之前该知道这份备份的底细。
 *
 * 门槛查的是**「这是不是本作的档」**,不是导入校验的全套。两件事得分清:
 *   · 确认框该不该开:取决于"这份东西有没有可能就是我的存档";
 *   · 点下去会不会成功:那要 `data.player` / `data.game` 都在。
 *
 * 从前这里只查 `version` 与 `exportedAt`,于是「并非《玄枢录》的存档文件」
 * 也会被展示成「无名散修 · 炼气·一层」加一个可点的「用这份替换」——
 * 玩家读到的是"这是一份像样的存档",点下去才被告知根本不是本作的档。
 * 从别的游戏拷来的 .save、拿 JSON 手工拼出来的东西,都会走到这条路上。
 *
 * 但也不能直接套 `validateImportPayload`:`buildExportPayload` 只打包**存在**
 * 的分片,刚建号还没写过档时导出里可以没有 `data.player` —— 那是本作自己会产出的
 * 东西,不该被挡在确认框外(实测:收紧成全套校验后,saveRoundTrip 那条正例当场红)。
 * 故门槛取两者交集:必须是本作的标识(认更名前的旧标识),且版本号可读。
 *
 * 返回 null 表示"这份东西不该进确认框",由调用方按导入路径的报错处理。
 */
export function inspectImportText(text: string): ImportInspect | null {
  try {
    const parsed = JSON.parse(readSaveText(text.trim())) as Partial<
      ExportPayload & { data?: { player?: { name?: unknown; major?: unknown; sub?: unknown } } }
    >;
    if (typeof parsed !== "object" || parsed === null) return null;
    // 与导入路径同一处常量:认更名前导出的旧标识,老玩家那份 .save 不该因改名作废
    const game = (parsed as { game?: unknown }).game;
    if (game !== "xuanshu" && game !== LEGACY_GAME_ID) return null;
    if (typeof parsed.version !== "number" || typeof parsed.exportedAt !== "number") return null;
    const tooNew = parsed.version > SAVE_VERSION;
    const player = parsed.data?.player;
    const major = typeof player?.major === "number" ? player.major : 0;
    const sub = typeof player?.sub === "number" ? player.sub : 0;
    return {
      name: typeof player?.name === "string" && player.name ? player.name : "无名散修",
      realmLabel: realmLabel(major, sub),
      version: parsed.version as number,
      exportedAt: parsed.exportedAt,
      tooNew,
    };
  } catch {
    return null;
  }
}

/**
 * 封存写盘:页面即将卸载时,丢弃一切后续 localStorage 写入。
 * persist 插件的 $subscribe 走 Vue 调度器(微任务批量刷盘)——清档/导入之后、卸载之前,
 * 排队中的持久化仍会执行并把内存状态回写进 localStorage(实测栈:persistState → flushJobs)。
 * 拦截 mutation 源头不可穷尽,直接在写盘层截断
 * 注意:必须在「导入写盘完成之后」调用——它会把 setItem 置为 noop,先调用会吞掉导入的写入
 */
export function sealStorageWrites(): void {
  const noop = (): undefined => undefined;
  // 主路径:改写 Storage.prototype。它是普通 JS 对象,defineProperty 行为可预期,
  // 且对所有 Storage 实例生效
  try {
    Object.defineProperty(Storage.prototype, "setItem", {
      value: noop,
      configurable: true,
      writable: true,
    });
  } catch {
    // 原型被冻结时降级到下面的实例路径
  }
  // 备用路径:直接改实例。仅在原型改写失败时才有意义——
  // Storage 是 WebIDL legacy platform object,带命名属性 setter,部分 WebView
  // (实测 Android WebView 91)会把这次 defineProperty 解释成「存一条 key 为
  // setItem 的记录」,原方法毫发无损,封存静默失效。因此它不能作为唯一手段
  try {
    Object.defineProperty(window.localStorage, "setItem", { value: noop, configurable: true });
  } catch {
    // 存储不可用时无事可做
  }
}

/**
 * 清空全部存档并回到欢迎页。
 * 顺序:停引擎(去掉 beforeunload 写档)→ 封存写盘(丢弃排队刷盘)→ 清档 → 重载
 *
 * 不碰 location.hash:改 hash 会先触发一次 SPA 路由导航,守卫与新页面挂载期间
 * 内存里的 store 仍是旧状态,persist 订阅会把刚清掉的分片回写。实测 Android
 * WebView 上封存失效时,game 分片被写回 started:true 而 player 分片没被写回,
 * 重载后就卡在主页、角色是默认的无名散修。清档后 game.started 为 false,
 * 守卫会把任何路由都弹回 welcome,目标页无需在这里指定
 */
export function resetGame(): boolean {
  engine.stop();
  sealStorageWrites();
  // 只读页(多标签后来者)不许清档:清掉的会是另一页正在用的档
  if (!clearAllSave()) return false;
  // 内存兜底:reload 是异步的,卸载前页面仍在跑。万一两条封存路径都失效,
  // 排队刷盘写回的也是 started:false,守卫照样把人送回 welcome
  try {
    useGameStore().started = false;
  } catch {
    // Pinia 未激活时(理论上不会走到)忽略
  }
  window.location.reload();
  return true;
}

/**
 * 重载(导入存档后调用)。封存写盘,防止排队刷盘在卸载前覆盖刚导入的分片。
 * 同样不碰 hash:导入只写了 localStorage,内存 store 还是旧存档,
 * 一旦触发 SPA 导航引发回写,覆盖的正是刚导入的数据
 */
export function reloadGame(): void {
  engine.stop();
  sealStorageWrites();
  window.location.reload();
}
