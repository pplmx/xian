/** 图鉴收录时间打点测试 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useQuestsStore } from '@/stores/quests'
import { usePlayerStore } from '@/stores/player'
import { petCodex } from '@/ui/codex'
import { DAILY_TASKS, MAIN_QUESTS } from '@/data/quests'
import { MAX_MAJOR } from '@/data/realms'

describe('图鉴收录', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('首次收录记下时间戳,重复收录不覆盖', () => {
    const quests = useQuestsStore()
    const before = Date.now()
    expect(quests.collect('gongfa', 'gf-test')).toBe(true)
    const stamp = quests.collectedAt['gongfa:gf-test']
    expect(stamp).toBeGreaterThanOrEqual(before)

    expect(quests.collect('gongfa', 'gf-test')).toBe(false)
    expect(quests.collectedAt['gongfa:gf-test']).toBe(stamp)
  })

  it('不同类别互不串扰', () => {
    const quests = useQuestsStore()
    quests.collect('equip', 'same-id')
    quests.collect('pill', 'same-id')
    expect(quests.collections.equip).toContain('same-id')
    expect(quests.collections.pill).toContain('same-id')
    expect(quests.collectedAt['equip:same-id']).toBeDefined()
    expect(quests.collectedAt['pill:same-id']).toBeDefined()
  })

  it('sanitize 后图鉴/名号只留表内且去重,分子不再虚高', () => {
    const quests = useQuestsStore()
    quests.$patch({
      titlesOwned: ['ti_churu', 'ti_churu', 'not-a-title'],
      collections: {
        ...quests.collections,
        gongfa: ['m_taixuan', 'm_taixuan', 'not-a-gongfa']
      }
    } as never)
    quests.sanitize()
    expect(quests.titlesOwned).toEqual(['ti_churu'])
    expect(quests.collections.gongfa).toEqual(['m_taixuan'])
  })
})

/**
 * 主线任务链是游戏的脊梁:它曾只铺到化神(第 5 个大境界)。
 * 扩界后若忘了往下铺,玩家在 16 个新境界里会失去全部主线指引。
 */
describe('图鉴新得', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('收录时刻落在「上次打开图鉴」之后才算新得;打开图鉴后即清', () => {
    const quests = useQuestsStore()
    quests.collectedAt = { 'pill:r_qingxin': 100 }
    quests.lastCollectionViewAt = 50
    expect(quests.isEntryNew('pill', 'r_qingxin'), '界后收录应挂新').toBe(true)
    expect(quests.isEntryNew('pill', 'not-collected'), '无时间戳不挂新').toBe(false)

    quests.markCollectionSeen()
    expect(quests.isEntryNew('pill', 'r_qingxin'), '打开过图鉴后不再挂新').toBe(false)
  })

  it('收录发生在打开图鉴之前 → 不是新得', () => {
    const quests = useQuestsStore()
    quests.collectedAt = { 'pill:r_qingxin': 100 }
    quests.lastCollectionViewAt = 200
    expect(quests.isEntryNew('pill', 'r_qingxin')).toBe(false)
  })

  it('旧档播种:老档无 lastCollectionViewAt(=0)且已有收录 → 清洗把界抬到此刻,已收录不算新得', () => {
    const quests = useQuestsStore()
    quests.$patch({
      // sanitize 会按 collections 的 keptKeys 裁剪 collectedAt,故两处都要给真数据
      collections: { pill: ['r_qingxin'] },
      collectedAt: { 'pill:r_qingxin': Date.now() },
      lastCollectionViewAt: 0
    } as never)
    quests.sanitize()
    expect(quests.lastCollectionViewAt).toBeGreaterThan(0)
    expect(quests.isEntryNew('pill', 'r_qingxin'), '已收录的不该满页假新').toBe(false)
    // 播种之后新收的仍挂新(界停在播种时刻,后续不会二次播种把真新抹平)
    quests.collectedAt = { ...quests.collectedAt, 'pill:r_anding': Date.now() + 3_600_000 }
    expect(quests.isEntryNew('pill', 'r_anding')).toBe(true)
  })

  it('坏值归一:lastCollectionViewAt 写成负数/NaN 会洗回 0 再由播种抬成正数', () => {
    const quests = useQuestsStore()
    quests.lastCollectionViewAt = -5 as never
    quests.sanitize()
    expect(quests.lastCollectionViewAt).toBeGreaterThan(0)
  })
})

describe('主线任务链覆盖', () => {
  it('每一个大境界都有对应的主线节点,且最后一个落在当前最高境界', () => {
    const questRealms = MAIN_QUESTS.filter(q => q.cond.type === 'realm').map(q => (q.cond as { major: number }).major)
    for (let major = 1; major <= MAX_MAJOR; major += 1) {
      expect(questRealms, `第 ${major} 个大境界没有主线节点`).toContain(major)
    }
    expect(Math.max(...questRealms), '主线终点未抵达当前最高境界').toBe(MAX_MAJOR)
  })

  it('主线 id 全局唯一,奖励/描述不缺', () => {
    expect(new Set(MAIN_QUESTS.map(q => q.id)).size).toBe(MAIN_QUESTS.length)
    for (const q of MAIN_QUESTS) {
      expect(q.name.length).toBeGreaterThan(0)
      expect(q.desc.length).toBeGreaterThan(0)
    }
  })

  it('每日任务仍为三条(扩界不得挤占日课)', () => {
    expect(DAILY_TASKS.length).toBeGreaterThanOrEqual(3)
  })
})

/**
 * 灵兽册深浅的存档侧:曾相伴必须由**玩家自己做过的事**撑起,
 * 不能凭空猜。setPet 唤伴即记档,暂别不清档 —— 换谁、放谁,册上都留名。
 */
describe('灵兽册相伴档', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('唤作伴的入册,暂别不除名', () => {
    const quests = useQuestsStore()
    const player = usePlayerStore()
    expect(quests.petCompanions).toEqual([])
    player.setPet('pet_qingyu')
    expect(quests.petCompanions).toEqual(['pet_qingyu'])
    player.setPet(null)
    expect(quests.petCompanions).toEqual(['pet_qingyu'])
  })

  it('换伴不丢旧记录,重复唤不重复记', () => {
    const quests = useQuestsStore()
    const player = usePlayerStore()
    player.setPet('pet_qingyu')
    player.setPet('pet_xuegui')
    player.setPet('pet_qingyu')
    expect(new Set(quests.petCompanions)).toEqual(new Set(['pet_qingyu', 'pet_xuegui']))
  })

  it('sanitize 清理表内外的灵兽 id', () => {
    const quests = useQuestsStore()
    quests.$patch({ petCompanions: ['pet_qingyu', 'not-a-pet'] } as never)
    quests.sanitize()
    expect(quests.petCompanions).toEqual(['pet_qingyu'])
  })

  it('灵兽册深浅跟随真实相伴:收→唤→暂别', () => {
    const quests = useQuestsStore()
    const player = usePlayerStore()
    quests.collect('pet', 'pet_qingyu')
    expect(petCodex().entries.find(e => e.id === 'pet_qingyu')?.stage).toBe(1)
    player.setPet('pet_qingyu')
    const top = petCodex().entries.find(e => e.id === 'pet_qingyu')!
    expect(top.stage).toBe(3)
    expect(top.badge).toBe('伴')
    player.setPet(null)
    expect(petCodex().entries.find(e => e.id === 'pet_qingyu')?.stage).toBe(2)
  })
})
