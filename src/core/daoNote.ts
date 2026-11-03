/**
 * 道记 —— 悟道择路那一刻的落款。
 *
 * ## 解决的问题:择道是一次终身不改的决定,却只留下一枚标签
 *
 * 「道分歧路,一经择定终身不改」—— 界面上把这句话写得极重,而做完之后留下的
 * 只有一个词(「杀伐」)挂在功法名旁。玩家几十小时后回头,只看见一枚标签:
 * 什么时候走上这条道的、那一世走到哪一境、几条路里放弃了哪几条,全都不在了。
 *
 * 道记补的正是这一段:择道当时记下**几岁、什么境界、哪几条路没走**,
 * 此后每次看这部功法,那行落款都还在。
 *
 * ## 为什么存进存档,而器铭不存
 *
 * 器铭只由 uid 推得,重算一次就有,存它等于存一份可以重算的副本。
 * 道记记的却是**当时的世界状态**(年岁、境界、同门分支),那些事后算不出来 ——
 * 所以它必须是真数据,并且要随存档走、随导出导入走。
 *
 * ## 不写「哪一世」
 *
 * 世数在 `player.reincarnation.count` 里另有记账,道记再抄一份就成了两本账。
 * 转世后这一行的前半句仍成立(那一年、那一境、放弃了哪几条),后半句由界面
 * 去问世数 —— 它比这里清楚。
 *
 * ## 不进任何结算
 *
 * 道记不给词条、不改概率、不参与排序。它是一行题跋,和器铭、契语同一条纪律:
 * 描述「你是怎样走到这里的」,不替玩家做决定。
 */

/** 一次择道的落款 */
export interface DaoNote {
  /** 择道那一刻的修士年岁(年,整数;见 player.age 的口径) */
  age: number;
  /** 择道那一刻的大境界(REALMS 下标) */
  major: number;
  /** 择道那一刻的小层(0~9,9 为圆满) */
  sub: number;
  /** 这一部功法当时可选、而**没有**走的那几条(分支 id,保持原表顺序) */
  forgone: string[];
}

/** 某部功法一支道记(存档形状:功法 id → 落款) */
export type DaoNoteBook = Record<string, DaoNote>;

/** 世界给的输入:落款记的是择道那一刻的处境 */
export interface DaoNoteInput {
  age: number;
  major: number;
  sub: number;
  /** 当时可选的其余分支 id(不含被选中的那一条) */
  forgone: readonly string[];
}

/** 上限:一部功法至多留这么多条没走的路(分支最多的功法有 4 条) */
const MAX_FORGONE = 8;

function finiteInt(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;
}

/**
 * 造一枚落款。
 *
 * 数值一律钳到合理区间:年岁取整且不为负、境界与层数各自夹回值域 ——
 * 坏档 / 极端夹具造出来的 -3 岁、第 20 层不该印在题跋上。
 */
export function makeDaoNote(input: DaoNoteInput, maxMajor: number): DaoNote {
  const forgone: string[] = [];
  const seen = new Set<string>();
  for (const id of input.forgone) {
    if (typeof id !== "string" || !id || seen.has(id)) continue;
    seen.add(id);
    forgone.push(id);
    if (forgone.length >= MAX_FORGONE) break;
  }
  return {
    age: finiteInt(input.age),
    major: Math.min(finiteInt(input.major), Math.max(0, finiteInt(maxMajor))),
    sub: Math.min(finiteInt(input.sub), 9),
    forgone,
  };
}

/**
 * 落款的中文句 —— 界面与图鉴共用这一句,不各拼一份。
 *
 * 形如「一百二十岁 · 金丹圆满时择此道,舍『守御』『归一』未行」。
 * 境界名与小层名由调用方传进来(它们住在 data/realms,本模块只做拼句),
 * 于是这里不认识境界表,换名也不会散成两处。
 */
export function daoNoteLine(
  note: DaoNote,
  names: { ageText: string; realmText: string; branchName: (id: string) => string },
): string {
  const head = `${names.ageText} · ${names.realmText}时择此道`;
  const forsook = note.forgone
    .map((id) => names.branchName(id))
    .filter(Boolean)
    .map((name) => `『${name}』`);
  if (forsook.length === 0) return `${head},别无旁路`;
  return `${head},舍${forsook.join("")}未行`;
}

/**
 * 存档修形:坏值一律丢掉,而不是让一个坏道记把功法册渲染坏。
 *
 * 与 store 里其它 sanitize 同一套口径:认得的留下、认不得的丢,
 * 宁可少一行题跋,也不要印出一行「undefined 岁 · undefined时择此道」。
 */
export function sanitizeDaoNotes(
  raw: unknown,
  isValidBranch: (branchId: string) => boolean,
  maxMajor: number,
): DaoNoteBook {
  if (!raw || typeof raw !== "object") return {};
  const out: DaoNoteBook = {};
  for (const [gongfaId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!gongfaId || !value || typeof value !== "object") continue;
    const row = value as Partial<DaoNote>;
    const forgone = Array.isArray(row.forgone)
      ? row.forgone.filter((id): id is string => typeof id === "string" && isValidBranch(id))
      : [];
    out[gongfaId] = makeDaoNote(
      {
        age: finiteInt(row.age),
        major: finiteInt(row.major),
        sub: finiteInt(row.sub),
        forgone,
      },
      maxMajor,
    );
  }
  return out;
}
