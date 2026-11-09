/**
 * 历世履历的灵根徽记 —— 「转世就是灵根重生」这件事，旧账里要读得到。
 *
 * ## 缺口：数据与界面各缺一半
 *
 * 转世灵根那一轮（`docs/superpowers/specs/2026-09-14-reincarnation-linggen-visibility`）
 * 写了两个交付：转世弹窗里看见来世灵根、历世履历里回望每世牌面。前者做完了，
 * 后者停在了「计划」上 —— `LifeRecord` 里根本没有灵根字段，`recordLife` 归档时
 * 只取境界、寿数、命题、宿慧与逆旅契。
 *
 * 于是玩家转过十世，翻历世履历，每一行都只有「旧境 X · 寿 N 载」：
 * 每一世睁眼抽到的是天灵根还是杂灵根，一栏都没记。转世那一刻看得见，
 * 之后再也看不见 —— 而「历世履历」这一屏的全部意义就是回望。
 *
 * ## 只翻成可显示的一行
 *
 * 本模块只做「存档字段 → 一行徽记」：不读 store、不改状态、不参与任何结算，
 * 与 `ui/lifeTrialArchive` 同一条纪律（`deadExportAudit` 与
 * `layeringAudit` 都盯着这条）。
 *
 * 五行牌面（单字与色）取自 `data/linggen` 的 `ELEMENTS`，与人物页、创角页、
 * 转世确认页共用同一份 —— 灵根是同一件事，牌面不该有第二套。
 *
 * ## 不编
 *
 * 老存档没有这一栏，返回 null，履历上就不出那一行。
 * 坏档（品阶名不是字、根不是数组）同样返回 null，不印半行残章。
 * 认不得的五行 id 只丢那一枚，余下的照常印 —— 一条死 id 不该让整行消失，
 * 与 `ui/lifeChronicle` 处理死条目 id 同一条规矩。
 */
import type { ElementId, SpiritRoot } from "@/types";
import { ELEMENTS } from "@/data/linggen";
import type { LifeRecord } from "@/data/samsara";

/** 一枚灵根徽记：字、色、资质与读屏说法 */
export interface LifeLinggenRoot {
  element: ElementId;
  /** 牌面上的单字（金 / 木 / 水 / 火 / 土 / 雷 …） */
  char: string;
  /** 该系的语义色（取自 data/linggen，不在这里另造一套） */
  color: string;
  /** 资质；坏值为 null —— 徽记仍印，只是不编一个数 */
  aptitude: number | null;
  /** 读屏一句话：`水系 · 资质 63`；没有资质时只说哪一系 */
  spoken: string;
}

/** 历世履历上一世要印的灵根 */
export interface LifeLinggenRow {
  /** 品阶名，如「真灵根」 */
  grade: string;
  roots: LifeLinggenRoot[];
}

/** 存档里那一栏的形状（`LifeRecord.linggen`，可选 —— 老存档没有） */
type Raw = LifeRecord["linggen"];

function elementOf(id: unknown): ElementId | null {
  if (typeof id !== "string") return null;
  return id in ELEMENTS ? (id as ElementId) : null;
}

function rootOf(raw: SpiritRoot): LifeLinggenRoot | null {
  const element = elementOf(raw?.element);
  if (!element) return null;
  const meta = ELEMENTS[element];
  const aptitude =
    typeof raw.aptitude === "number" && Number.isFinite(raw.aptitude)
      ? Math.trunc(raw.aptitude)
      : null;
  return {
    element,
    char: meta.char,
    color: meta.color,
    aptitude,
    spoken: aptitude === null ? `${meta.char}系` : `${meta.char}系 · 资质 ${aptitude}`,
  };
}

/**
 * 把存档里的 `LifeRecord.linggen` 翻成履历可显示的一行。
 *
 * 没有这一栏（老存档）、或形状坏到读出「这不是一份灵根」时返回 null ——
 * 履历上就不出那一行。品阶名是存档里的事实，只要它是字就照说；
 * 根坏了几枚只丢那几枚。
 */
export function lifeLinggen(raw: Raw | null | undefined): LifeLinggenRow | null {
  if (!raw || typeof raw !== "object") return null;
  const grade = (raw as { gradeName?: unknown }).gradeName;
  if (typeof grade !== "string" || grade.trim() === "") return null;
  const rootsRaw = (raw as { roots?: unknown }).roots;
  if (!Array.isArray(rootsRaw)) return null;
  const roots: LifeLinggenRoot[] = [];
  for (const item of rootsRaw) {
    const root = rootOf(item as SpiritRoot);
    if (root) roots.push(root);
  }
  return { grade: grade.trim(), roots };
}

/**
 * 徽记那一行的读屏文本 —— 圆章是纯视觉的（「水雷」连读不成话，色值更念不出），
 * 故模板里把徽记整组 `aria-hidden`，由这一句把牌面说全。
 *
 * 与人物页灵根牌的 `title` 同一口径（`水系 · 资质 63`），只在开头补品阶名，
 * 让读屏听到的是「真灵根，水系 · 资质 63，木系 · 资质 44」这种完整一句。
 * 根一枚都不剩时只说品阶名 —— 品阶是存档里的事实，仍要说。
 */
export function linggenSpoken(row: LifeLinggenRow): string {
  const parts = row.roots.map((root) => root.spoken);
  return parts.length === 0 ? row.grade : `${row.grade}，${parts.join("，")}`;
}
