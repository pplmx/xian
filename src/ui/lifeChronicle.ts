/**
 * 行年 —— 把散在四处「何时得来的」收成一本按年岁读的谱。
 *
 * ## 起因:同一类事实,记了三处,却读不出一处
 *
 * 第 7 轮给图鉴补了道历(收录时第几世、活到几岁),第 27 轮给称号补上,
 * 第 34 轮给灵兽补上 —— 三处都用 `ui/codexMoment` 那一份历法与文案。
 *
 * 于是一个玩了七世的玩家,手上现成有两百多条「第 N 世 · M 岁得到 X」,
 * 但它们**分躺在三个册子里**:图鉴按品类排、名号页按名录排、灵兽谱按品阶排 ——
 * 那是那三册各自的正事(找某一件东西时,按品类才好翻)。
 *
 * 可"我这一世都做了什么"是另一件事,而那件事现在没有一页在讲。
 *
 * ## 做什么
 *
 * 只做一件事:把这四处**已经记下的**道历按「第几世 → 多少岁」排成一条年谱。
 * 这一层是纯装配 —— 不读 store、不读墙钟、不写任何状态(与 ui/enemyLore、
 * ui/eventDesk 同规:`buildLifeChronicle` 只收参数,`describeXxx` 是纯函数)。
 *
 * 不新记任何东西。凡是还没记道历的,一律不往里塞(见下方「不编」)。
 *
 * ## 为什么按「世」分卷
 *
 * 道历的两个读数本来就是一粗一细:`世`跨世不变,`岁`在每一世里从零数。故年谱
 * 天然是「世 → 卷,岁 → 行」——这一层分组不是排版偏好,是那一对读数自己的形状。
 *
 * ## 不编
 *
 * 旧档里已收录的条目没有道历(那三处的用例各自钉着「不补造」)。它们进不了年谱,
 * 由 `chronicleLegacyCount` 数出几笔、页面上照实说一句。把不知道的时刻编出来
 * 比空着更坏:玩家会拿它当真的。
 *
 * ## 历世那一卷从哪来
 *
 * 前几世没有逐笔的道历 —— 那时玩家还没见过这些东西。但每一世**都**有一份归档
 * (`data/samsara` 的 LifeRecord:终点境界、终寿、命题结局)。故旧世那一卷写的是
 * 那一世的终局一笔,不假装记得那一世某年某月做过什么。
 */
import type { LifeRecord } from "@/data/samsara";
import { cnNumber } from "@/utils/format";
import { artifactDef } from "@/data/artifacts";
import { equipmentTemplate } from "@/data/equipment";
import { eventDef } from "@/data/events";
import { gongfaDef } from "@/data/gongfa";
import { petDef } from "@/data/pets";
import { pillDef } from "@/data/pills";
import { talentDef } from "@/data/talents";
import { titleDef } from "@/data/titles";
import type { CodexMoment } from "./codexMoment";

/** 一笔行年的来路 —— 四类的印不重字,页面上靠它认出这是哪一册的账 */
export const CHRONICLE_KIND_LABELS = {
  collection: "册",
  title: "名",
  pet: "兽",
  life: "世",
} as const;

export type ChronicleKind = keyof typeof CHRONICLE_KIND_LABELS;

export interface ChronicleEntry {
  /** 稳定键:同一条记录在同一册里只出现一次,也给列表渲染当 key */
  id: string;
  kind: ChronicleKind;
  kindLabel: string;
  /** 第几世(1 起) */
  life: number;
  /** 这一世活到几岁 */
  age: number;
  /** 得的是什么(条目名 / 称号名 / 灵兽名 / 那一世的终局境界) */
  name: string;
  /** 它落在哪一册、或那一世怎么了 */
  note: string;
}

/** 三张道历表 + 历世归档 + 此刻是第几世。全部由调用方递进来,本模块不读 store */
export interface ChronicleInput {
  /** 图鉴收录时刻,键为 `${category}:${id}`(见 stores/quests 的 collectedMoment) */
  collectionMoments: Record<string, CodexMoment | null | undefined>;
  /** 称号得手的道历 */
  titleMoments: Record<string, CodexMoment | null | undefined>;
  /** 灵兽结缘的道历 */
  petMoments: Record<string, CodexMoment | null | undefined>;
  /** 历世归档(见 data/samsara 的 LifeRecord) */
  lives: readonly LifeRecord[];
  /** 此刻是第几世 */
  lifeNow: number;
}

/** 图鉴七类的名字与它在年谱里的说法 —— 与 collection 页的分册同名 */
const COLLECTION_CATEGORY_TEXT: Record<string, { name: string; note: string }> = {
  equip: { name: "装备", note: "收进藏珍阁" },
  gongfa: { name: "功法", note: "参入功法册" },
  pill: { name: "丹药", note: "录进丹方册" },
  artifact: { name: "法宝", note: "收进法宝录" },
  pet: { name: "灵兽", note: "记入灵兽谱" },
  event: { name: "际遇", note: "写进际遇录" },
  talent: { name: "天赋", note: "刻进宿慧" },
};

function finiteInt(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : Number.NaN;
}

/**
 * 图鉴条目的名字 —— 按册子里的 id 取它的**真名**。
 *
 * 年谱写给人读,一行里印出 `m_taixuan` 这种内部 id 就白写了。各册的名字本来
 * 就各有取数函数(`data/*` 的 `*Def`),这里只按品类路由过去,不另建一份名录 ——
 * 名录建第二份,改内容时必有一份忘改。
 *
 * 认不出的条目(旧档里的死 id)退回 id 本身:照实说出它是个什么键,
 * 好过编一个名字,也好过整行消失。
 */
function collectionName(category: string, id: string): string {
  switch (category) {
    case "equip":
      return equipmentTemplate(id)?.name ?? id;
    case "gongfa":
      return gongfaDef(id)?.name ?? id;
    case "pill":
      return pillDef(id)?.name ?? id;
    case "artifact":
      return artifactDef(id)?.name ?? id;
    case "pet":
      return petDef(id)?.name ?? id;
    case "event":
      return eventDef(id)?.title ?? id;
    case "talent":
      return talentDef(id)?.name ?? id;
    default:
      return id;
  }
}

/**
 * 一份道历读成两个合法的整数,读不出就给 null。
 *
 * 世从 1 起、岁从 0 起 —— 与 `ui/codexMoment` 的「早年收录」同一条越界口径:
 * 那边判 life < 1 或 age < 0 就不出这句,这里同样把这种值当"没有"。
 */
function readMoment(moment: CodexMoment | null | undefined): { life: number; age: number } | null {
  if (!moment || typeof moment !== "object") return null;
  const life = finiteInt(moment.life);
  const age = finiteInt(moment.age);
  if (!Number.isFinite(life) || !Number.isFinite(age)) return null;
  if (life < 1 || age < 0) return null;
  return { life, age };
}

/** 把三张道历表摊成一串待排序的行 —— 道历读不出的直接跳过 */
function momentRows(input: ChronicleInput): ChronicleEntry[] {
  const rows: ChronicleEntry[] = [];

  for (const [key, raw] of Object.entries(input.collectionMoments)) {
    const moment = readMoment(raw);
    if (!moment) continue;
    // 键形如 `${category}:${id}`;品类认不得的(旧档坏键)照实不编,故跳过
    const cut = key.indexOf(":");
    if (cut <= 0) continue;
    const category = key.slice(0, cut);
    const text = COLLECTION_CATEGORY_TEXT[category];
    if (!text) continue;
    rows.push({
      id: `collection:${key}`,
      kind: "collection",
      kindLabel: CHRONICLE_KIND_LABELS.collection,
      life: moment.life,
      age: moment.age,
      name: collectionName(category, key.slice(cut + 1)),
      note: text.note,
    });
  }

  for (const [id, raw] of Object.entries(input.titleMoments)) {
    const moment = readMoment(raw);
    if (!moment) continue;
    rows.push({
      id: `title:${id}`,
      kind: "title",
      kindLabel: CHRONICLE_KIND_LABELS.title,
      life: moment.life,
      age: moment.age,
      name: titleDef(id)?.name ?? id,
      note: "受一枚名号",
    });
  }

  for (const [id, raw] of Object.entries(input.petMoments)) {
    const moment = readMoment(raw);
    if (!moment) continue;
    rows.push({
      id: `pet:${id}`,
      kind: "pet",
      kindLabel: CHRONICLE_KIND_LABELS.pet,
      life: moment.life,
      age: moment.age,
      name: petDef(id)?.name ?? id,
      note: "与此兽结缘",
    });
  }

  return rows;
}

/**
 * 历世那一卷:每一世只写终局一笔。
 *
 * 那一世逐笔的道历并不存在(道历是后来才补上的账),故这里不编 —— 只报
 * `LifeRecord` 自己写着的三件事:终点境界、终寿、所得宿慧。
 */
function lifeRows(input: ChronicleInput): ChronicleEntry[] {
  return input.lives
    .filter((record) => Number.isFinite(record?.index) && record.index >= 1)
    .map((record) => ({
      id: `life:${record.index}`,
      kind: "life" as const,
      kindLabel: CHRONICLE_KIND_LABELS.life,
      life: Math.trunc(record.index),
      age: Math.max(0, finiteInt(record.age) || 0),
      name: record.realmLabel,
      note: `终寿 ${Math.max(0, finiteInt(record.age) || 0)} 岁`,
    }));
}

/**
 * 排成一条年谱:先按世、再按岁。
 *
 * 同一世同一岁的几笔之间**不编先后** —— 那几年里哪个先发生,存档里根本没记。
 * 同岁时退到稳定键(种类 + id)定序,保证同一份输入恒得同一份输出(不随机、不抖)。
 */
export function buildLifeChronicle(input: ChronicleInput): ChronicleEntry[] {
  return [...lifeRows(input), ...momentRows(input)].sort(
    (a, b) => a.life - b.life || a.age - b.age || a.id.localeCompare(b.id),
  );
}

/**
 * 数一数有几笔没记道历。
 *
 * 三张表里"有这条记录、却没有那一刻"的笔数 —— 页面上照实说一句「其中 N 笔
 * 早年所得,未记道历」。旧档读进来就是这个样子,空着不说会让人以为谱子漏了。
 */
export function chronicleLegacyCount(input: ChronicleInput): number {
  const count = (table: ChronicleInput["titleMoments"]): number =>
    Object.values(table).filter((raw) => readMoment(raw) === null).length;
  return count(input.collectionMoments) + count(input.titleMoments) + count(input.petMoments);
}

export interface ChronicleGroup {
  /** 第几世 */
  life: number;
  /** 本卷的几笔,仍是年岁次第(可能只是前面一段,见 renderChronicleRow) */
  rows: ChronicleEntry[];
  /** 本卷共有几笔 —— 与 `rows.length` 不同时,界面要说出还有几笔没铺 */
  total: number;
  /** 是不是此刻这一世 */
  current: boolean;
}

/**
 * 每卷首批铺几行。
 *
 * 年谱在后期是很长的:一个玩到真仙的号,此世光图鉴就有两百多条。
 * 全铺进第一帧会让这一册比同页其余几册重一个量级(本仓的长列表一贯按批续开,
 * 见 core/listRender)。故先铺 8 行,余下的显式续开。
 */
export const CHRONICLE_ROW_BATCH = 8;

/**
 * 取本卷此刻该铺的那几行。
 *
 * 卷内分页与卷间分页是两件事:卷间按「世」走(`groupChronicleByLife`),
 * 卷内按「行」走(这里)。两者都用 `listWindow`,不另写一套夹取。
 */
export function renderChronicleRow(
  group: ChronicleGroup,
  limit: number,
): { rows: ChronicleEntry[]; shown: number; hidden: number; total: number } {
  const shown = Math.max(
    0,
    Math.min(group.rows.length, Number.isFinite(limit) ? Math.trunc(limit) : group.rows.length),
  );
  return {
    rows: group.rows.slice(0, shown),
    shown,
    hidden: Math.max(0, group.total - shown),
    total: group.total,
  };
}

/** 按世分卷,卷次从新到旧(此刻这一世排在最前),卷内仍按年岁 */
export function groupChronicleByLife(
  rows: readonly ChronicleEntry[],
  lifeNow = Number.POSITIVE_INFINITY,
): ChronicleGroup[] {
  const byLife = new Map<number, ChronicleEntry[]>();
  for (const row of rows) {
    const bucket = byLife.get(row.life);
    if (bucket) bucket.push(row);
    else byLife.set(row.life, [row]);
  }
  return [...byLife.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([life, list]) => ({
      life,
      rows: [...list].sort((a, b) => a.age - b.age || a.id.localeCompare(b.id)),
      total: list.length,
      current: life === lifeNow,
    }));
}

export interface ChronicleHeadline {
  /** 此刻这一世留下几笔 */
  count: number;
  /** 这一世走到第几年 —— 没有笔时为 null */
  earliestAge: number | null;
  latestAge: number | null;
  text: string;
}

/**
 * 卷首一句 —— 只报**此刻这一世**的账。
 *
 * 别的世的笔数在「旧世」那一卷里,卷首若报总数,读起来像"这一世做了 N 件事"。
 */
export function chronicleHeadline(
  rows: readonly ChronicleEntry[],
  lifeNow: number,
): ChronicleHeadline {
  const mine = rows.filter((row) => row.life === lifeNow);
  if (mine.length === 0) {
    return {
      count: 0,
      earliestAge: null,
      latestAge: null,
      text: "此世尚未留下可记之年 —— 从下一件入册之物起笔。",
    };
  }
  const ages = mine.map((row) => row.age);
  const earliest = Math.min(...ages);
  const latest = Math.max(...ages);
  const span =
    earliest === latest ? `${cnNumber(latest)}岁` : `${cnNumber(earliest)}至${cnNumber(latest)}岁`;
  return {
    count: mine.length,
    earliestAge: earliest,
    latestAge: latest,
    text: `此世 ${mine.length} 笔，自${span}。`,
  };
}

/**
 * 一行的说法:多少岁、得的是什么、落在哪一册。
 *
 * 岁数写汉字 —— 与全作的「第几世」「几岁」同一套写法(`utils/format` 的 cnNumber),
 * 也因为年谱读起来是叙事,不是读数。
 */
export function chronicleRowText(entry: ChronicleEntry): string {
  const age = cnNumber(Math.max(0, finiteInt(entry.age) || 0));
  const parts = [`${age}岁`, entry.name, entry.note].filter(Boolean);
  return parts.join(" · ");
}

export type ChronicleKindCount = Record<ChronicleKind, number>;

/** 按类摊开数一遍 —— 合计恒等于总笔数,页面上不许两边各算一遍 */
export function countChronicleByKind(rows: readonly ChronicleEntry[]): ChronicleKindCount {
  const counts: ChronicleKindCount = { collection: 0, title: 0, pet: 0, life: 0 };
  for (const row of rows) counts[row.kind] += 1;
  return counts;
}
