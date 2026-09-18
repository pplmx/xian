/** 瞬态 UI 状态 —— Toast / 各类 Modal(不持久化) */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { OfflineSummary } from '@/types'

export interface Toast {
  id: number
  text: string
  kind: 'info' | 'success' | 'warn' | 'rare'
}

/**
 * 数值详情 —— 点任意大数后弹出来的那一页。
 *
 * rows 的约定:第一行是"这个数本身",后面可以跟"所需 / 还需 / 每秒"这类同族读数;
 * note 放一句人话(如"按当前速率还需 3 天 2 时")—— 一行字的解释比再堆一个数字有用。
 */
export interface NumberDetailView {
  title: string
  /**
   * 一行一个读数。`value` 走数值格式化(缩写 + 点开看精确值);
   * `text` 用于**本来就不是数**的那一行 —— 如"预计还要多久"(时长),
   * 它没有精确值可展开,但有话直说反而最有用。
   */
  rows: { label: string; value?: import('@/types').GNum | number; text?: string; hint?: string }[]
  note?: string
}

export interface BreakthroughView {
  success: boolean
  fromLabel: string
  toLabel: string
  isMajor: boolean
  tribulationLog: string[]
  message: string
}

/** 上一世的回顾(Phase 32.5)—— 轮回界面第一屏要说清楚"你刚刚过完了怎样的一生" */
export interface LifeReview {
  /** 刚结束的是第几世(1 起) */
  index: number
  realmLabel: string
  age: number
  /** 本世立的题;未立题为 null */
  themeId: string | null
  themeResult: 'done' | 'unfinished' | 'broken' | null
  /** 命题进度(未立题为 0/0) */
  themeCur: number
  themeNeed: number
  /** 本世所得宿慧(阅历 + 达成命题) */
  insightGained: number
}

export interface ReincarnationView {
  daoFruitGained: number
  talentChoices: string[]
  extraTalents: string[]
  prevRealmLabel: string
  /** 上一世回顾 */
  review: LifeReview
  /** 转世之后的宿慧总量 */
  insightAfter: number
  /** 转世之后所处的轮回阶 */
  stageId: string
  stageName: string
  stageDesc: string
  /** 这一世的经历是否让你进了一阶 */
  stageAdvanced: boolean
  /** 距下一阶还差多少宿慧(已在顶阶为 null) */
  toNextStage: number | null
  /** 睁眼即认得的灵材数 */
  knownMaterials: number
  /** 可立的命题(id);空数组表示此阶无题可立 */
  themeChoices: string[]
  /** 是否可从全部已开命题中自选(百世老修) */
  themeFree: boolean
}

let toastSeq = 1

export const useUiStore = defineStore('ui', () => {
  const toasts = ref<Toast[]>([])
  const offlineSummary = ref<OfflineSummary | null>(null)
  const breakthrough = ref<BreakthroughView | null>(null)
  const equipDetailUid = ref<string | null>(null)
  const artifactDetailId = ref<string | null>(null)
  const gongfaDetailId = ref<string | null>(null)
  const buffDetailId = ref<string | null>(null)
  /**
   * 数值详情浮层(点任意大数即可打开)。
   *
   * 为什么走全局:数值散落在修炼页/人物页/图鉴/战报各处,而"展开详情"不该改它们的排版
   * (窄屏加行必炸)。故只在被点的那个数上做个记号,详情统一由 App 挂的浮层呈现 ——
   * 与 buffDetailId / gongfaDetailId 同一套做法。
   */
  const numberDetail = ref<NumberDetailView | null>(null)
  const deathDialog = ref(false)
  const reincarnation = ref<ReincarnationView | null>(null)
  const corruptedNotice = ref<string[]>([])

  function toast(text: string, kind: Toast['kind'] = 'info'): void {
    const id = toastSeq
    toastSeq += 1
    toasts.value = [...toasts.value.slice(-4), { id, text, kind }]
    const ttl = kind === 'rare' ? 4200 : 2600
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, ttl)
  }

  /** 手动关闭某条提示(点按 toast 即收,不等超时) */
  function dismissToast(id: number): void {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return {
    toasts,
    offlineSummary,
    breakthrough,
    equipDetailUid,
    artifactDetailId,
      gongfaDetailId,
      buffDetailId,
      numberDetail,
    deathDialog,
    reincarnation,
    corruptedNotice,
    toast,
    dismissToast
  }
})
