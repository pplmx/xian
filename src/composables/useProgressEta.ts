import { computed, type ComputedRef } from "vue";
import { toNum } from "@/utils/gnum";
import type { GNum } from "@/types";

/**
 * 进度型读数的 ETA 详情 —— 修为(现值/本境需求/修炼速度)与灵气(现值/标称容量/回复速度)
 * 是同一副骨架的两份实例,从前在 CultivationView 里各写一套 detail computed 群
 * (capRow/banked/remainRow/etaRow + etaText 分支),结构完全同构、迟早分叉。
 * 这里把**骨架**收成一份:行序(上限 → 积余? → 还需 → 预计)、满态/窄缝态/无速率
 * 三条 ETA 分支、积余行的 >0 出现条件。
 *
 * 纪律:**一句用户文案都不住在这里** —— label/hint/满态话术全部由调用方传入
 * (静态串或 getter;凡引 reactive 状态的 hint 必须 getter,否则境界一升详情就撒谎)。
 * 判据(如 QI_BANK_MULT 读常量)也都钉在调用侧,本文件不新增任何扫描面。
 */
export interface ProgressRow {
  label: string;
  value?: GNum | number;
  text?: string;
  hint?: string;
}

/** 静态串或 getter:凡依赖 reactive 状态的文案,调用方必须给 getter */
export type ProgressCopy = string | (() => string);

export interface ProgressEtaSpec {
  /** 详情首行的「数」:上限(本境需求 / 标称容量) */
  cap: () => GNum | number;
  /** 每秒增速;决定 ETA 折算与「无速率」分支 */
  rate: () => number;
  /** 是否已到满态(修为 expFull / 灵气贴住标称容量)—— 满态直接给 fullText */
  isFull: () => boolean;
  /** 未满时的差值(修为走 subClamp 大数口径 / 灵气走 cap−current)—— ETA = 差 ÷ 速率 */
  gap: () => number;
  /** 「还需/还差」行的「数」(展示口径各自定,不必与 gap 同一折法) */
  remain: () => GNum | number;
  /** 详情首行:上限 */
  capRow: { label: string; hint: ProgressCopy };
  /** 可选积余行:>0 才出现(修为跨境界积余 / 灵气容量外积余) */
  banked?: { value: () => GNum | number; label: string; hint: ProgressCopy };
  /** 还需/还差行 */
  remainRow: { label: string; hint: ProgressCopy };
  /** 预计行(text 由本组 etaText 供给) */
  etaRow: { label: string; hint: ProgressCopy };
  /** 满态 ETA 文案(修为「已满 —— 下一步是突破」/ 灵气「已满」) */
  fullText: string;
  /** 未满但差 ≤0 的窄缝态(修为「就要满了」;灵气无此态,不传即并进满态) */
  almostText?: string;
  /** 无速率时的人话(「当前无修为进项」/「当前无回复」) */
  rateEmptyText: string;
  /** 秒数折算成人话(调用方给,守 format 纪律;两处同款 `约 ${formatDuration(sec)}`) */
  formatEta: (sec: number) => string;
  /** TapNumber 的一句人话(note),可无 */
  note?: () => string | undefined;
}

export interface ProgressEta {
  /** TapNumber 的 rows(精确值之后的同族读数,按 上限→积余?→还需→预计 定序) */
  rows: ComputedRef<ProgressRow[]>;
  /** ETA 人话(预计行 text;宿主主行也可直接读,如修为「还剩 X% · …」) */
  etaText: ComputedRef<string>;
  note: ComputedRef<string | undefined>;
}

const copy = (v: ProgressCopy): string => (typeof v === "function" ? v() : v);

export function useProgressEta(spec: ProgressEtaSpec): ProgressEta {
  /** 已满/窄缝/无速率三支都不给假时长,说人话;只有真在等才折算 秒数 */
  const etaText = computed(() => {
    if (spec.isFull()) return spec.fullText;
    const g = spec.gap();
    if (g <= 0) return spec.almostText ?? spec.fullText;
    if (spec.rate() <= 0) return spec.rateEmptyText;
    return spec.formatEta(g / spec.rate());
  });
  const rows = computed<ProgressRow[]>(() => [
    { label: spec.capRow.label, value: spec.cap(), hint: copy(spec.capRow.hint) },
    // 积余行按实判出现:大数积余(GNum)转数值判 >0,数字积余直接判
    ...(spec.banked
      ? (() => {
          const v = spec.banked!.value();
          return (typeof v === "number" ? v : toNum(v)) > 0
            ? [{ label: spec.banked!.label, value: v, hint: copy(spec.banked!.hint) }]
            : [];
        })()
      : []),
    { label: spec.remainRow.label, value: spec.remain(), hint: copy(spec.remainRow.hint) },
    { label: spec.etaRow.label, text: etaText.value, hint: copy(spec.etaRow.hint) },
  ]);
  const note = computed(() => spec.note?.());
  return { rows, etaText, note };
}
