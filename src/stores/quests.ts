/** 任务 / 成就 / 称号 / 图鉴 / 计数器 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { CounterKey } from '@/types'
import { persistConfig } from '@/utils/storage'
import { MAIN_QUESTS } from '@/data/quests'
import { ACHIEVEMENTS } from '@/data/achievements'
import { artifactDef } from '@/data/artifacts'
import { equipmentTemplate } from '@/data/equipment'
import { eventDef } from '@/data/events'
import { gongfaDef } from '@/data/gongfa'
import { petDef } from '@/data/pets'
import { pillDef } from '@/data/pills'
import { talentDef } from '@/data/talents'
import { titleDef } from '@/data/titles'
import { asFiniteNumber, asNumberRecord, asObjectOrNull, asRecord, asStringArray } from '@/utils/saveShape'
import type { StoredDaily } from '@/core/engineDailies'
import { dailyShapeOf, dailyStateOf, rolloverDailyBoard } from '@/core/engineDailies'

export type CollectionCategory = 'equip' | 'gongfa' | 'pill' | 'artifact' | 'pet' | 'event' | 'talent'

function uniqueKnown(ids: string[], exists: (id: string) => boolean): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (!exists(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export const useQuestsStore = defineStore(
  'quests',
  () => {
    const counters = ref<Partial<Record<CounterKey, number>>>({})
    const achieved = ref<string[]>([])
    const mainIdx = ref(0)
    const daily = ref<{ date: string; base: Partial<Record<CounterKey, number>>; done: string[] }>({
      date: '',
      base: {},
      done: []
    })
    const titlesOwned = ref<string[]>([])
    const collections = ref<Record<CollectionCategory, string[]>>({
      equip: [],
      gongfa: [],
      pill: [],
      artifact: [],
      pet: [],
      event: [],
      talent: []
    })
    /** 图鉴收录时刻,键为 `${category}:${id}`(旧档已收录条目无记录) */
    const collectedAt = ref<Record<string, number>>({})

    /** 存档修复:计数/图鉴表被写坏会让成就判定与图鉴页在渲染期抛错 */
    function sanitize(): void {
      counters.value = asNumberRecord(counters.value, 0)
      achieved.value = uniqueKnown(asStringArray(achieved.value), id => ACHIEVEMENTS.some(a => a.id === id))
      const maxIdx = Math.max(0, MAIN_QUESTS.length - 1)
      mainIdx.value = Math.min(Math.floor(asFiniteNumber(mainIdx.value, 0, 0)), maxIdx)
      const d = asObjectOrNull<{ date?: unknown; base?: unknown; done?: unknown }>(daily.value)
      daily.value = {
        date: typeof d?.date === 'string' ? d.date : '',
        base: asNumberRecord(d?.base, 0),
        done: asStringArray(d?.done)
      }
      titlesOwned.value = uniqueKnown(asStringArray(titlesOwned.value), id => !!titleDef(id))
      const cats = asRecord<string[]>(collections.value)
      collections.value = {
        equip: uniqueKnown(asStringArray(cats.equip), id => !!equipmentTemplate(id)),
        gongfa: uniqueKnown(asStringArray(cats.gongfa), id => !!gongfaDef(id)),
        pill: uniqueKnown(asStringArray(cats.pill), id => !!pillDef(id)),
        artifact: uniqueKnown(asStringArray(cats.artifact), id => !!artifactDef(id)),
        pet: uniqueKnown(asStringArray(cats.pet), id => !!petDef(id)),
        event: uniqueKnown(asStringArray(cats.event), id => !!eventDef(id)),
        talent: uniqueKnown(asStringArray(cats.talent), id => !!talentDef(id))
      }
      const keptKeys = new Set<string>()
      for (const [cat, ids] of Object.entries(collections.value)) {
        for (const id of ids) keptKeys.add(`${cat}:${id}`)
      }
      const nextAt: Record<string, number> = {}
      for (const [key, ts] of Object.entries(asNumberRecord(collectedAt.value, 0))) {
        if (keptKeys.has(key) && ts > 0) nextAt[key] = Math.floor(ts)
      }
      collectedAt.value = nextAt
    }

    const currentMainQuest = computed(() => MAIN_QUESTS[mainIdx.value])

    function counter(key: CounterKey): number {
      return counters.value[key] ?? 0
    }

    function inc(key: CounterKey, n = 1): void {
      counters.value = { ...counters.value, [key]: (counters.value[key] ?? 0) + n }
    }

    function hasAchieved(id: string): boolean {
      return achieved.value.includes(id)
    }

    /** 整份写回成就表(解锁的判定与去重在 core/engineUnlocks) */
    function setAchieved(ids: readonly string[]): void {
      achieved.value = [...ids]
    }

    function advanceMain(): void {
      mainIdx.value += 1
    }

    /** 整份写回主线下标(链的推进结果一次落账) */
    function setMainIndex(index: number): void {
      mainIdx.value = Math.max(0, Math.floor(index))
    }

    function ownTitle(id: string): boolean {
      if (titlesOwned.value.includes(id)) return false
      titlesOwned.value = [...titlesOwned.value, id]
      return true
    }

    function collect(category: CollectionCategory, id: string): boolean {
      const list = collections.value[category]
      if (list.includes(id)) return false
      collections.value = { ...collections.value, [category]: [...list, id] }
      collectedAt.value = { ...collectedAt.value, [`${category}:${id}`]: Date.now() }
      return true
    }

    /**
     * 换期:把此刻的计数器记成本期基准。
     * 幂等由库保证(同一期再叫一次不会把当天已攒的进度清掉 —— 心跳每次都问"该换期了吗")。
     */
    function rolloverDaily(period: string): void {
      daily.value = dailyShapeOf(rolloverDailyBoard(dailyStateOf(daily.value), counters.value, period))
    }

    /** 整份写回每日账(结算结果一次落账) */
    function setDailyState(state: StoredDaily): void {
      daily.value = state
    }

    return {
      counters,
      achieved,
      mainIdx,
      daily,
      titlesOwned,
      collections,
      collectedAt,
      currentMainQuest,
      counter,
      inc,
      hasAchieved,
      setAchieved,
      advanceMain,
      setMainIndex,
      ownTitle,
      collect,
      rolloverDaily,
      setDailyState,
      sanitize
    }
  },
  { persist: persistConfig('quests') }
)
