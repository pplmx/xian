/**
 * 读档补票 —— 「前置已靖 → 此地已开」是**不变量**,不是一次性事件。
 *
 * 起因(玩家反馈:仙界之后的下一处永远刷不出来):
 * 解锁一直是事件式的 —— 只在击败某地之主的那一刻,把 requireCleared === 此地 的下游
 * 写进 adventure.unlocked(exploration.clearRegionAndUnlockNext)。而 v1.34 的境界扩界
 * 是后来才发的:人间界 20 处是老内容,仙界 21 起那 24 处是新长的,云海仙门的
 * requireCleared = 鸿蒙裂隙。
 *
 * 于是**扩界前就通关过人间界**的存档:鸿蒙裂隙显示「已靖」→ 首领不再复现
 * (bossDue 只认 adventure.cleared,markCleared 第二次返回 false 就早退)→
 * 那个 unlock() 再没有第二次机会 → 云海仙门永远挂着「需先击败鸿蒙裂隙之主」。
 * 代价是仙界/神界/混沌海 24 处地界、12 大境界对这份存档整体不可达。
 *
 * 判据口径:补票发生在读档修形口(adventure.sanitize,由 engine.start →
 * sanitizeOfflineInputs 调用),玩家下次启动自动生效;正常的「击败即开放 + toast」
 * 链路一行未动。故这里测的是「一份既成存档读进来之后,该开的是不是开着」。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAdventureStore } from '@/stores/adventure'
import { MORTAL_REGIONS, REGIONS, regionDef } from '@/data/regions'
import { canEnterRegion } from './mortalWorldService'
import { startExploration } from './exploration'

/** 扩界前那份存档的形状:人间界 20 处全清,unlocked 里也只有人间界 */
const MORTAL_IDS = MORTAL_REGIONS.map(r => r.id)

describe('读档补票 · 区域解锁链', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('扩界前的通关档:读档后云海仙门自己开了(不再等一次永远不来的首领战)', () => {
    const adventure = useAdventureStore()
    adventure.cleared = [...MORTAL_IDS]
    adventure.unlocked = [...MORTAL_IDS]
    adventure.sanitize()
    expect(adventure.unlocked).toContain('yunhai')
    expect(canEnterRegion('yunhai')).toBe(true)
  })

  it('补的是"该补的",不是整张表:云海仙门之后仍锁着(前置未靖)', () => {
    const adventure = useAdventureStore()
    adventure.cleared = [...MORTAL_IDS]
    adventure.unlocked = [...MORTAL_IDS]
    adventure.sanitize()
    expect(adventure.unlocked).not.toContain('zhexian')
    expect(adventure.unlocked).not.toContain('hongmengbenyuan')
  })

  it('链式补齐:前置刚补上、而它自己也已靖 → 再补它后面那一处', () => {
    const adventure = useAdventureStore()
    adventure.cleared = [...MORTAL_IDS, 'yunhai']
    adventure.unlocked = [...MORTAL_IDS]
    adventure.sanitize()
    expect(adventure.unlocked).toContain('yunhai')
    expect(adventure.unlocked).toContain('zhexian')
  })

  it('前置未靖就不开:只清到仙府,鸿蒙裂隙还没打 → 云海仙门照旧锁着', () => {
    const adventure = useAdventureStore()
    adventure.cleared = MORTAL_IDS.filter(id => id !== 'hongmeng')
    adventure.unlocked = [...MORTAL_IDS]
    adventure.sanitize()
    expect(adventure.unlocked).not.toContain('yunhai')
  })

  it('新号开荒不被吞:空 cleared 的档仍只有青云山麓', () => {
    const adventure = useAdventureStore()
    adventure.cleared = []
    adventure.unlocked = ['qingyun']
    adventure.sanitize()
    expect(adventure.unlocked).toEqual(['qingyun'])
  })

  it('幂等:反复读档不会越补越多,也不会把已开的收回去', () => {
    const adventure = useAdventureStore()
    adventure.cleared = [...MORTAL_IDS, 'yunhai']
    adventure.unlocked = [...MORTAL_IDS]
    adventure.sanitize()
    const once = [...adventure.unlocked]
    adventure.sanitize()
    expect(adventure.unlocked).toEqual(once)
  })

  it('不认识的历史 id 保留:补票不是"按表重算",不吞玩家的旧记录', () => {
    const adventure = useAdventureStore()
    adventure.cleared = [...MORTAL_IDS, 'place_removed_long_ago']
    adventure.unlocked = [...MORTAL_IDS, 'place_removed_long_ago']
    adventure.sanitize()
    expect(adventure.unlocked).toContain('place_removed_long_ago')
    expect(adventure.unlocked).toContain('yunhai')
  })

  it('坏形状也能救回来:unlocked 被写成非数组时,先修形再补票', () => {
    const adventure = useAdventureStore()
    adventure.cleared = [...MORTAL_IDS]
    adventure.unlocked = 'nonsense' as never
    adventure.sanitize()
    expect(Array.isArray(adventure.unlocked)).toBe(true)
    expect(adventure.unlocked).toContain('yunhai')
  })

  it('补票之后真能走一程:startExploration 认这处地界', () => {
    const adventure = useAdventureStore()
    adventure.cleared = [...MORTAL_IDS]
    adventure.unlocked = [...MORTAL_IDS]
    adventure.sanitize()
    expect(regionDef('yunhai')).toBeDefined()
    expect(startExploration('yunhai', 'normal')).toBe(true)
    expect(adventure.session?.regionId).toBe('yunhai')
  })

  it('表本身守着这条链:每处地界(除青云)都有前置,且前置真实存在', () => {
    for (const r of REGIONS) {
      if (r.id === 'qingyun') continue
      expect(r.requireCleared, `${r.name}(${r.id})没有前置 —— 它靠什么开?`).toBeTruthy()
      expect(regionDef(r.requireCleared!), `${r.id} 的前置 ${r.requireCleared} 不存在`).toBeDefined()
    }
  })
})
