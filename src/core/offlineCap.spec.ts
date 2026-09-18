/**
 * 离线结算封顶一致性 —— 镇压区域被动收益受洞府离线上限约束。
 *
 * 回归点:离线结算此前把完整 dtSec 传给 settleSuppressedRegions(见 offline.ts),
 * 镇压收益绕过 mansion 离线封顶 —— 60h 缺席、洞府 0 级(cap 8h)时仍按 60h 全额
 * 结算(且装备 0.4/h × 60h 洪水)。修后按 capSec 结算。
 *
 * 注意:改做断言的是离线总结中「镇压诸域仍有余韵」一行的灵石数,而非 spiritStone
 * 总额——总额还含 track('offlineClaims') 触发的成就奖励(境界成就等),与镇压无关。
 * 每个 `it` 独立 pinia,避免多次结算互相污染。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { settleOffline } from './offline'
import { studyTick } from './loreService'
import { useLoreStore } from '@/stores/lore'
import { useGameStore } from '@/stores/game'
import { usePlayerStore } from '@/stores/player'
import { useDongfuStore } from '@/stores/dongfu'
import { useResourcesStore } from '@/stores/resources'
import { useAdventureStore } from '@/stores/adventure'
import { useUiStore } from '@/stores/ui'
import { todayWeather } from './weather'
import { gn, mulN, toNum } from '@/utils/gnum'
import { OFFLINE_EFFICIENCY } from '@/data/constants'

const GAP_HOURS = 60

/** 解析 formatGN 输出(1,411 / 1.5万 / 1.2亿)为数值 */
function parseGNFmt(s: string): number {
  const m = /([\d.,]+)\s*(万|亿|兆|京)?/.exec(s)
  const base = parseFloat(m![1]!.replace(/,/g, ''))
  const mult = m![2] === '万' ? 1e4 : m![2] === '亿' ? 1e8 : m![2] === '兆' ? 1e12 : m![2] === '京' ? 1e16 : 1
  return base * mult
}

function suppressionStoneAfterOffline(mansionLevel: number): number {
  const game = useGameStore()
  const player = usePlayerStore()
  const dongfu = useDongfuStore()
  game.markStarted()
  game.lastActiveAt = Date.now() - GAP_HOURS * 3600 * 1000 // 60h 前最后在线
  player.major = 3
  player.suppressedRegions = ['qingyun']
  dongfu.setLevel('mansion', mansionLevel)
  settleOffline(Date.now())
  const line = useUiStore().offlineSummary?.notes.find(n => n.startsWith('镇压诸域仍有余韵'))
  expect(line, '镇压区域离线应有镇压提示').toBeDefined()
  const m = /灵石 \+([\d.,]+\s*万?亿?兆?京?)/.exec(line!)
  expect(m, '镇压提示应含灵石数').not.toBeNull()
  return parseGNFmt(m![1]!)
}

describe('离线结算封顶一致性', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('洞府 0 级(cap 8h):60h 缺席的镇压收益按 8h 结算,而非 60h', () => {
    const stone = suppressionStoneAfterOffline(0)
    // 8h 封顶:stoneByTier(tier1, 150×8×0.98) = 1411;60h 全额为 10584
    expect(stone).toBeGreaterThan(1000)
    expect(stone).toBeLessThan(2000)
  })

  it('洞府 4 级(cap 72h → capSec 60h):镇压收益随封顶抬升到 60h 量级', () => {
    const stone = suppressionStoneAfterOffline(4)
    // 60h 封顶:stoneByTier(tier1, 150×60×0.98) ≈ 10584
    expect(stone).toBeGreaterThan(8000)
    expect(stone).toBeLessThan(13000)
  })
})

describe('离线结算同源吃天时(ISS-027 续)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('灵雨日离线修炼速率高于清和日(天时并入 cultPerSec,离线不再掉加成)', () => {
    // 找一个清和日(无修炼加成)与灵雨日(+10%),同一角色同一时长下对比
    const game = useGameStore()
    let lingyuDay = -1
    let qingheDay = -1
    for (let d = 0; d < 60; d += 1) {
      game.$patch({ totalPlaySec: d * 86400 })
      const id = todayWeather().id
      if (id === 'lingyu' && lingyuDay < 0) lingyuDay = d
      if (id === 'qinghe') qingheDay = d
    }
    expect(lingyuDay).toBeGreaterThanOrEqual(0)
    expect(qingheDay).toBeGreaterThanOrEqual(0)

    function offlineExpOnDay(day: number): number {
      const g = useGameStore()
      const p = usePlayerStore()
      g.markStarted()
      // 短离线(10s)只修一次修炼,修为远未触及 expReq 封顶,差值才可比
      g.lastActiveAt = Date.now() - 10 * 1000
      g.$patch({ totalPlaySec: day * 86400 })
      p.initCharacter('离修', { roots: [] } as never)
      const before = toNum(p.exp)
      settleOffline(Date.now())
      return toNum(p.exp) - before
    }
    const expLingyu = offlineExpOnDay(lingyuDay)
    const expQinghe = offlineExpOnDay(qingheDay)
    // 灵雨修炼 +10%:离线修为增益应显著高于无加成日(留余量,防修复方 double-count)
    expect(expLingyu).toBeGreaterThan(expQinghe * 1.05)
  })

  /**
   * 扩界冒烟:离线结算此前只在元婴期(major 3)验过。
   * 高界的修为/灵气量级跨了十几个数量级,若某处仍按旧口径算,离线一结算就现形。
   */
  it('混沌道祖离线结算不崩:修为有增、数值有限', () => {
    const game = useGameStore()
    const player = usePlayerStore()
    game.markStarted()
    game.lastActiveAt = Date.now() - GAP_HOURS * 3600 * 1000
    player.major = 20
    player.sub = 9

    const before = toNum(player.exp)
    const summary = settleOffline(Date.now())

    expect(summary, '高界离线应产出总结').not.toBeNull()
    expect(toNum(player.exp), '高界离线修为未增长').toBeGreaterThan(before)
    expect(Number.isFinite(toNum(player.exp))).toBe(true)
  })

  /**
   * 高界离线的**全产线**体检:修为、灵气、洞府、镇压、藏经阁都在同一次结算里跑。
   * 只验修为是不够的 —— 镇压产出按 capSec 结算、洞府产出按 effSec,两处量级不同,
   * 谁在高界算出负数/NaN,总结里会直接现形。
   */
  it('混沌道祖离线:五条产线的读数全部有限且非负', () => {
    const game = useGameStore()
    const player = usePlayerStore()
    game.markStarted()
    game.lastActiveAt = Date.now() - GAP_HOURS * 3600 * 1000
    player.major = 20
    player.sub = 9
    // 开一条镇压线(混沌海地界),让镇压产出也进这次结算
    player.suppressRegion('hongmengbenyuan')
    player.suppressQualified.push('hongmengbenyuan')

    const summary = settleOffline(Date.now())!
    expect(summary).not.toBeNull()
    const numeric: Record<string, number> = {
      exp: toNum(summary.exp),
      stone: toNum(summary.stone),
      herb: summary.herb,
      ore: summary.ore,
      wudao: summary.wudao
    }
    for (const [k, v] of Object.entries(numeric)) {
      expect(Number.isFinite(v), `${k} 非有限值`).toBe(true)
      expect(v, `${k} 为负`).toBeGreaterThanOrEqual(0)
    }
    for (const line of summary.notes) expect(line).not.toContain('NaN')
    for (const e of summary.equipment) expect(e.name).not.toContain('NaN')
  })

  /**
   * 归来卷轴要写得出「妖气复聚」那一行(见 core/regionRevival)。
   *
   * 刚回来的玩家眼前是这扇卷轴(弹窗),提示条正在跟它抢注意力 —— 而「我靖过的地界
   * 怎么旧主又回来了」是这一屏最容易被当成丢档或 bug 的一件事,必须在账目里说清,
   * 并顺手给出"该怎么办"(再历一程即可复靖)。
   */
  it('挂久了归来:已靖的地界妖气复聚,卷轴账目里写得出来', () => {
    const game = useGameStore()
    const adventure = useAdventureStore()
    game.markStarted()
    // 超过妖气复聚的期限(72 小时)才谈得上"归来时旧主已回"
    const awayHours = 100
    game.lastActiveAt = Date.now() - awayHours * 3600 * 1000
    // 离开前青云山麓已靖(钟停在那一刻),此后一直没回来
    adventure.cleared = ['qingyun']
    adventure.clearedAt = { qingyun: Date.now() - awayHours * 3600 * 1000 }

    const summary = settleOffline(Date.now())!

    const joined = summary.notes.join(' | ')
    expect(joined, '归来账目里没提妖气复聚').toContain('妖气复聚')
    expect(joined, '复聚那一行没说该怎么办').toContain('复靖')
    expect(adventure.revived).toContain('qingyun')
    expect(adventure.cleared).not.toContain('qingyun')
  })

  /**
   * 「比率」体检的第二处与第三处:洞府产出与藏经阁钻研同样走 effSec(= 时长 × 0.9)。
   * 与修为那条同理 —— 只看"有没有产出"看不出折扣是否被某处吞掉或被重复施加。
   * 做法:同一份状态跑两遍,一遍走离线结算,一遍直接调在线函数并传 effSec,比对读数。
   */
  it('洞府与藏经阁的离线折扣与在线同源:进度读数等于「直接传 effSec」那一遍', () => {
    /**
     * 为什么比 frac/studyFrac 而不比资源总额:离线结算里的 track('offlineClaims')
     * 会触发成就奖励(其中就有灵草/玄铁这类),总额因此天然高于"纯产出"那一遍 ——
     * 那是设计,不是折扣被吞。洞府的 frac 与藏经阁的 studyFrac 只由这条产线写,
     * 拿它们比才真正隔离出「折扣口径是否同源」。
     */
    // 取一个除不尽的时长:整份产出会被 floor 进资源,余数才留在 frac 上 ——
    // 而余数正是这条产线的指纹(整数时长下 frac 恒为 0,断言会失去意义)
    const gapHours = 0.37
    const setup = (): void => {
      setActivePinia(createPinia())
      const game = useGameStore()
      const player = usePlayerStore()
      const dongfu = useDongfuStore()
      const lore = useLoreStore()
      game.markStarted()
      player.major = 9
      dongfu.levels.field = 3
      dongfu.levels.library = 2
      lore.recipeLore = { p_jvqidan: 0.2 }
      game.lastActiveAt = Date.now() - gapHours * 3600 * 1000
    }
    const readFrac = (): { herb: number; ore: number; wudao: number; study: number } => ({
      herb: useDongfuStore().frac.herb,
      ore: useDongfuStore().frac.ore,
      wudao: useDongfuStore().frac.wudao,
      study: useLoreStore().studyFrac
    })

    setup()
    settleOffline(Date.now())
    const offline = readFrac()

    setup()
    const capSec = Math.min(gapHours * 3600, useDongfuStore().offlineCapHours * 3600)
    const effSec = capSec * OFFLINE_EFFICIENCY
    useDongfuStore().produce(effSec)
    studyTick(effSec)
    const direct = readFrac()

    expect(offline.herb, `灵草进度:离线 ${offline.herb} vs 直接 ${direct.herb}`).toBeCloseTo(direct.herb, 6)
    expect(offline.ore).toBeCloseTo(direct.ore, 6)
    expect(offline.wudao).toBeCloseTo(direct.wudao, 6)
    expect(offline.study, '藏经阁钻研进度:离线与直接传 effSec 应一致').toBeCloseTo(direct.study, 6)
    expect(offline.herb, '进度不该为 0,否则断言形同虚设').toBeGreaterThan(0)
  })

  /**
   * 修为与灵气**不限时** —— 玩家那句话:「很长时间不登录,灵气/修为也不变化。」
   *
   * 旧口径把它们也按洞府上限切掉(洞府 0 级只结算 8 小时),于是挂一周回来几乎没动。
   * 现在两条账分开:
   *   被动修行(修为 / 灵气):按**真实离线时长**全额结算,不打折也不封顶 ——
   *     修行是身体自己在做的事,不该因为没开 App 就白丢;
   *   产出与派遣(材料 / 钻研 / 历练 / 镇压):仍受洞府上限约束,保留 0.9 挂机折扣。
   * 修为不封顶撑不破后面的境界:它只是"积余",境界仍要一关一关亲手突破;
   * 灵气另有 10 倍容量的银行顶兜着。
   */
  it('修为与灵气不限时:挂 N 天,就按 N 天全额入账(洞府等级不影响这两条)', () => {
    const gapHours = 24 * 7 // 挂一周 —— 远超任何洞府档位的上限
    for (const mansionLevel of [0, 4]) {
      setActivePinia(createPinia())
      const game = useGameStore()
      const player = usePlayerStore()
      const dongfu = useDongfuStore()
      const resources = useResourcesStore()
      game.markStarted()
      player.major = 3
      player.sub = 0
      dongfu.setLevel('mansion', mansionLevel)
      resources.$patch({ qi: 0 })
      game.lastActiveAt = Date.now() - gapHours * 3600 * 1000
      const rate = player.cultPerSec
      const qiRate = player.qiRegenPerSec
      const before = toNum(player.exp)
      const summary = settleOffline(Date.now())
      expect(summary, `洞府 ${mansionLevel} 级:离线未结算`).not.toBeNull()
      // 修为:全额(无 0.9 折扣、无洞府上限)
      const gained = toNum(player.exp) - before
      expect(gained / toNum(mulN(gn(rate), gapHours * 3600)), `洞府 ${mansionLevel} 级:修为被打了折或被封顶`).toBeCloseTo(1, 3)
      // 灵气:同样按真实时长回充(到银行顶为止 —— 这里是 10 倍容量)
      expect(summary!.qi, `洞府 ${mansionLevel} 级:灵气没按时长入账`).toBeGreaterThan(0)
      const bankCap = player.qiBankCapValue
      const expectedQi = Math.min(qiRate * gapHours * 3600, bankCap)
      expect(summary!.qi, `洞府 ${mansionLevel} 级:灵气入账量`).toBeCloseTo(expectedQi, 0)
      // 「不限时」的实际效力是"到顶为止":灵气另有 10 倍容量的银行顶兜着,不会无限膨胀
      if (mansionLevel === 0) expect(expectedQi, '一周的回气量本该顶到银行上限,否则这条判据没验到顶').toBeCloseTo(bankCap, 0)
      // 而**产出**仍受洞府上限:0 级只结算 8 小时
      if (mansionLevel === 0) expect(summary!.capped, '洞府 0 级时产出应受 8 小时上限约束').toBe(true)
      expect(summary!.cappedSeconds).toBeLessThanOrEqual(dongfu.offlineCapHours * 3600 + 1)
    }
  })
})
