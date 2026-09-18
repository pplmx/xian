/**
 * 本世计对账 —— "基准快照"搬进库之后,开世基准与本世增量一位不差。
 *
 * 与 engineParity 同一条纪律:`legacy*` 是**迁移前那段实现的原样冻结**
 * (`core/samsaraService` 的 `countersDelta` 与 `beginLife`),与现在的实现用同一组
 * 计数器各跑一遍,比三件事:开世基准(各计数器的快照 + 分支数 + 雪耻数)、本世增量、
 * 以及命题进度的读数。
 *
 * 另说明一处**有意加固**(见 ISS-234):立誓是"一世一次"的事,而迁移前 `beginLife`
 * 是无条件重打基准 —— 重进来一次(连点确认、恢复流程)就会把这一世已经攒下的进度
 * 抹掉。现在"已经立过题就直接返回",转世流程则**先撤上一世的题**再立新题。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { CounterKey } from '@/types'
import { LIFE_THEMES } from '@/data/lifeThemes'
import { beginLife, vowProgress } from './samsaraService'
import { deltaSince, snapshotOf } from 'wanxiang-engine'
import { usePlayerStore } from '@/stores/player'
import { useQuestsStore } from '@/stores/quests'

type Counters = Partial<Record<CounterKey, number>>

/** 迁移前的开世(冻结):无条件打基准 */
function legacyBeginLife(counters: Counters, baseBranches: number, baseAvenged: number) {
  return { base: { ...counters }, baseBranches, baseAvenged }
}

/** 迁移前的本世增量(冻结) */
function legacyCountersDelta(key: CounterKey, base: Counters, counters: Counters): number {
  return Math.max(0, (counters[key] ?? 0) - (base[key] ?? 0))
}

const NOW = 1_758_000_000_000
/** 计数型命题(挑斩敌 400 那条,免得几下就顶到目标) */
const theme = LIFE_THEMES.find(t => t.metric.kind === 'counter' && t.metric.key === 'kills')!
const themeMetric = theme.metric as { kind: 'counter'; key: CounterKey; n: number }
const counterKey = themeMetric.key
const branchTheme = LIFE_THEMES.find(t => t.metric.kind === 'branch')!
const branchNeed = (branchTheme.metric as { kind: 'branch'; n: number }).n

const setCounters = (patch: Counters): void => {
  useQuestsStore().counters = { ...patch }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('本世计对账 —— 开世基准与本世增量', () => {
  it('开世基准:各计数器的快照与冻结口径逐键相同', () => {
    for (const counters of [
      {},
      { kills: 400, explores: 60 },
      { kills: 0, pillsUsed: 3, tribulations: 1, breakthroughs: 9 }
    ]) {
      setCounters(counters)
      const mine = snapshotOf(useQuestsStore().counters as Record<string, number>)
      expect(mine, JSON.stringify(counters)).toEqual(legacyBeginLife(counters, 0, 0).base)
    }
  })

  it('立题:基准、时刻、分支数与雪耻数都按同一刻的账记下', () => {
    setCounters({ kills: 400, explores: 60 })
    beginLife(theme.id, NOW)
    const vow = usePlayerStore().reincarnation.vow!
    expect(vow.themeId).toBe(theme.id)
    expect(vow.at).toBe(NOW)
    expect(vow.base).toEqual(legacyBeginLife({ kills: 400, explores: 60 }, 0, 0).base)
    expect(vow.baseBranches).toBe(0)
    expect(vow.baseAvenged).toBe(0)
    expect(vow.broken).toBe(false)
  })

  it('本世增量:与冻结口径逐点相同(含倒挂与缺键)', () => {
    const base: Counters = { kills: 400, explores: 12 }
    for (const counters of [
      { kills: 400, explores: 12 },
      { kills: 407, explores: 60 },
      { kills: 100, explores: 1 },
      {},
      { pillsUsed: 5 }
    ]) {
      for (const key of ['kills', 'explores', 'pillsUsed', 'tribulations'] as CounterKey[]) {
        expect(
          deltaSince(base as Record<string, number>, counters as Record<string, number>, key),
          `${key} · ${JSON.stringify(counters)}`
        ).toBe(legacyCountersDelta(key, base, counters))
      }
    }
  })

  it('命题读数经库算:计数型命题的"本世多少 / 要多少 / 成了吗"与冻结口径同源', () => {
    setCounters({ [counterKey]: 400 })
    beginLife(theme.id, NOW)
    // 立题那一刻的基准就是 400:本世增量从 0 起算
    expect(vowProgress()).toEqual({ cur: 0, need: themeMetric.n, done: false })
    useQuestsStore().inc(counterKey, 120)
    expect(vowProgress()).toEqual({ cur: 120, need: themeMetric.n, done: false })
    useQuestsStore().inc(counterKey, 999)
    expect(vowProgress()?.done).toBe(true)
    // 与冻结口径:cur = max(0, 当前 − 基准)
    const cur = legacyCountersDelta(counterKey, { [counterKey]: 400 }, useQuestsStore().counters)
    expect(vowProgress()?.cur).toBe(cur)
  })

  it('分支型命题的增量也走同一份原语(不再各处手写减法)', () => {
    setCounters({})
    beginLife(branchTheme.id, NOW)
    expect(vowProgress()).toEqual({ cur: 0, need: branchNeed, done: false })
  })

  it('没立题的两种情形:没选主题与 id 认不出,都只是撤题', () => {
    const player = usePlayerStore()
    beginLife(theme.id, NOW)
    expect(player.reincarnation.vow).not.toBeNull()
    beginLife(null)
    expect(player.reincarnation.vow).toBeNull()
    beginLife(theme.id, NOW)
    beginLife('根本没有这道题')
    expect(player.reincarnation.vow).toBeNull()
  })
})

describe('立誓一世一次(有意加固)—— 重进来一次不该把本世进度抹掉', () => {
  it('同一世第二次立题:不再重打基准(旧写法会把基准挪到此刻)', () => {
    setCounters({ [counterKey]: 400 })
    beginLife(theme.id, NOW)
    const base = snapshotOf(useQuestsStore().counters as Record<string, number>)
    // 这一世打了 120 只怪,这时流程又被重进了一次
    useQuestsStore().inc(counterKey, 120)
    const countersNow = useQuestsStore().counters as Record<string, number>
    beginLife(theme.id, NOW + 60_000)
    expect(usePlayerStore().reincarnation.vow!.base).toEqual(base)
    expect(usePlayerStore().reincarnation.vow!.at).toBe(NOW)
    // 本世进度照旧算得出 120 —— 迁移前的写法会在这里归零
    expect(vowProgress()).toEqual({ cur: 120, need: themeMetric.n, done: false })
    expect(snapshotOf(countersNow)[counterKey]).toBe(520) // 计数器自己没被动过
  })

  it('转世流程:先撤上一世的题,再按新一刻的账立新题', () => {
    const player = usePlayerStore()
    setCounters({ [counterKey]: 400 })
    beginLife(theme.id, NOW)
    // 转世:counters 涨到 500,撤旧题 → 立新题(base 必须是 500,不是 400)
    useQuestsStore().inc(counterKey, 100)
    player.setVow(null)
    beginLife(theme.id, NOW + 86_400_000)
    const vow = player.reincarnation.vow!
    expect(vow.at).toBe(NOW + 86_400_000)
    expect(vow.base[counterKey]).toBe(500)
    expect(vowProgress()).toEqual({ cur: 0, need: themeMetric.n, done: false })
  })
})
