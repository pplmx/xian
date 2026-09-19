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
import { applyBuff, activeBuffsOf, buffCapSec, buffOverflowOf } from './engineBuffs'
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
