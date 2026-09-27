/* eslint-disable no-console -- 消融/判据的产物是它打印出来的读数 */
/**
 * 可消耗增益的时长上限 —— **落地判据**(ISS-232 的平衡决定)。
 *
 * 背景:丹药的叠法是"加上",吃得比时长勤就能攒(20 分钟一颗、连吃 24 小时余 12 小时;
 * 10 分钟一颗余 48 小时)。那等于把"限时加速"按材料成本换成"半常驻",
 * 而"什么时候吃"这个决策随之消失。2026-09-19 的决定:给**凡丹药能给的增益**加上限,
 * 取"单颗时长的 2 倍"(见 core/engineBuffs 的 `CONSUMABLE_BUFF_CAP_MULT`)。
 *
 * 这份用例钉三件事(它查的是**真实内容** `data/pills` × `data/buffs`,不是造出来的样本):
 *   ① 每一味带状态的丹:反复服用也攒不过上限 —— 且**确实贴近**上限(不是"没生效");
 *   ② 到顶之后再服一点也加不上去 —— 界面据此提示"这一颗白费了";
 *   ③ 不归它管的状态(闭关 / 重伤 / 事件祝福)一律没有上限,免得上限被无意扩大。
 *
 * 新增一味丹只要挂上 `buffId`,① 就自动替它守着 —— 这正是"口径写在装配层"的用意。
 */
import { describe, expect, it } from 'vitest'
import { PILLS } from '@/data/pills'
import { buffDef } from '@/data/buffs'
import { applyBuff, activeBuffsOf, buffCapSec, buffOverflowOf, buffStackHints, buffStackSize } from './engineBuffs'
import type { BuffInstance } from '@/types'

const MIN_MS = 60_000

/** 打印出来的那几味丹只取前几条,免得刷屏 */
const pillBuffs = PILLS.filter(p => !!p.buffId)

/** 每 `gapMin` 分钟服一次,连服 100 次,返回 [余量秒, 上限秒] */
function hoard(defId: string, gapMin: number): { remainSec: number; capSec: number } {
  let list: BuffInstance[] = []
  const end = 99 * gapMin * MIN_MS
  for (let i = 0; i < 100; i += 1) list = applyBuff(list, defId, i * gapMin * MIN_MS)
  const active = activeBuffsOf(list, end).find(b => b.def.id === defId)
  return { remainSec: active?.remainingSec ?? 0, capSec: buffCapSec(defId) ?? 0 }
}

describe('丹药增益有上限(ISS-232 的落地判据)', () => {
  it('每一味带状态的丹:反复服用也攒不过上限,而且确实贴着上限', () => {
    // 防空转:内容表被挪走、buffId 全丢了,这条判据就变成空跑
    expect(pillBuffs.length).toBeGreaterThanOrEqual(8)

    const rows: string[] = []
    for (const pill of pillBuffs) {
      const { remainSec, capSec } = hoard(pill.buffId!, 1)
      expect(capSec, `${pill.id} 的增益应当有上限`).toBeGreaterThan(0)
      // ① 封顶:攒不过上限(1 秒容差 —— 剩余时间以毫秒在走)
      expect(remainSec).toBeLessThanOrEqual(capSec + 1)
      // ② 且确实攒到了上限附近:否则"没上限"也会通过,判据就成了摆设
      expect(remainSec).toBeGreaterThan(capSec * 0.9)
      rows.push(`${pill.name} ${(remainSec / 60).toFixed(0)}/${(capSec / 60).toFixed(0)} 分`)
    }
    console.log(`  每分钟一味,连服 100 次后:${rows.slice(0, 6).join(' · ')} …(共 ${rows.length} 味)`)
  })

  it('贴着上限再服:界面分三档说清楚(足额 / 只延续到顶 / 完全白费)', () => {
    const defId = pillBuffs[0]!.buffId!
    const cap = buffCapSec(defId)!
    const durationSec = buffDef(defId)!.durationSec
    expect(cap).toBe(durationSec * 2) // 上限就是"单颗的 2 倍"这个口径

    const remainAt = (list: readonly BuffInstance[], now: number): number =>
      activeBuffsOf(list, now).find(b => b.def.id === defId)?.remainingSec ?? 0

    // ① 足额兑现:刚服 / 服完还离上限很远
    const first = applyBuff([] as BuffInstance[], defId, 0)
    expect(buffOverflowOf(first, defId, 0)).toBe('none')
    expect(remainAt(first, 0)).toBeCloseTo(durationSec, 6)

    // ② 只延续到顶:此刻余 2400 秒(上限 3600),再服会越过上限 —— 药力被削掉一截
    const at1200 = 1200_000
    const two = applyBuff(first, defId, at1200)
    expect(remainAt(two, at1200)).toBeCloseTo(2400, 6)
    expect(buffOverflowOf(two, defId, at1200)).toBe('partial')
    const three = applyBuff(two, defId, at1200)
    expect(remainAt(three, at1200)).toBeCloseTo(cap, 6) // 被削到上限为止

    // ③ 完全白费:已经顶死时再服,一点也加不上去(界面说"这一颗白费了")
    expect(buffOverflowOf(three, defId, at1200)).toBe('full')
    const four = applyBuff(three, defId, at1200)
    expect(remainAt(four, at1200)).toBeCloseTo(remainAt(three, at1200), 6)

    // 反向:空列表不该误报(否则提示就成了狼来了)
    expect(buffOverflowOf([], defId, 0)).toBe('none')
  })

  it('不归它管的状态没有上限:闭关 / 重伤 / 事件祝福', () => {
    for (const defId of ['retreat', 'injury', 'bless_qingfeng']) {
      expect(buffCapSec(defId), `${defId} 不该有上限`).toBeUndefined()
      expect(buffOverflowOf([], defId, 0)).toBe('none')
    }
  })
})

/**
 * BuffDialog 的「现效合计」行 —— 干净的数:
 *
 * I2 的代价契约只兜住了「炼丹成本」那一边,叠加这件事本身要玩家自己算
 * (聚灵+星驰+御风+本源 ≈ +265%,见 pillValue.spec)。这里把"合并后真值"摊开:
 * 这个词条除了我自己,还有别的来源在供(叠加或对冲)时,才值得给一行。
 */
describe('buffStackHints:现效合计行的原料', () => {
  it('独一份的词条不给行 —— 只有自己不算叠加', () => {
    expect(buffStackHints({ cultivationSpeed: 0.3 }, { cultivationSpeed: 0.3 })).toEqual([])
  })

  it('两味修速同刻在效,给一行且取合并真值', () => {
    // 自己的 +30% 之外,另有来源供了 +30% → 合计 +60%
    expect(buffStackHints({ cultivationSpeed: 0.3 }, { cultivationSpeed: 0.6, qiCapPct: 0.2 })).toEqual([
      { key: 'cultivationSpeed', owned: 0.3, total: 0.6 }
    ])
  })

  it('对冲:别人的负值把净合下拉,照实报', () => {
    const rows = buffStackHints({ cultivationSpeed: 0.3 }, { cultivationSpeed: -0.1 })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ key: 'cultivationSpeed', owned: 0.3, total: -0.1 })
  })

  it('没查进别的键:只检查自己身上有的词条', () => {
    expect(buffStackHints({ cultivationSpeed: 0.3 }, { qiCapPct: 0.5 })).toEqual([])
  })
})

/**
 * 主屏「叠 N」角标 —— 与 buffStackHints 同一台账:
 * 弹窗里报合并后的真值,胶囊上报"在叠的份数"。
 * `others` 必须是**不含自己**的列表,免得把自己数进去。
 */
describe('buffStackSize:主屏「叠 N」角标', () => {
  it('没人共享 → 1,不挂角标', () => {
    expect(buffStackSize({ cultivationSpeed: 0.3 }, [])).toBe(1)
    expect(buffStackSize({ cultivationSpeed: 0.3 }, [{ qiCapPct: 0.2 }])).toBe(1)
  })

  it('一人共享 → 2,多人共享 → 份数+1', () => {
    expect(buffStackSize({ cultivationSpeed: 0.3 }, [{ cultivationSpeed: 0.6 }])).toBe(2)
    expect(buffStackSize({ cultivationSpeed: 0.3 }, [{ cultivationSpeed: 0.6 }, { qiRegen: 0.5, cultivationSpeed: 0.1 }])).toBe(3)
  })

  it('自己没词条(空增益)不误报叠加', () => {
    expect(buffStackSize({}, [{ cultivationSpeed: 0.6 }])).toBe(1)
    expect(buffStackSize({}, [])).toBe(1)
  })
})
