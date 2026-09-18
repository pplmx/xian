import { describe, expect, it } from 'vitest'
import { createEconomyReadings } from './economy.js'

const readings = createEconomyReadings()
/** 本作的口径:判词换成中文 */
const chinese = createEconomyReadings({
  labels: { tight: '瓶颈', healthy: '健康', surplus: '过剩', idle: '闲置' }
})

describe('经济读数 —— 哪一样不对劲', () => {
  it('比值 = 进 / 出;出为 0 时是无穷 —— "只进不出"不能显示成"刚刚好"', () => {
    expect(readings.ratioOf(10, 5)).toBe(2)
    expect(readings.ratioOf(0, 5)).toBe(0)
    expect(readings.ratioOf(5, 0)).toBe(Number.POSITIVE_INFINITY)
    // 进出都为 0(死资源:既无来源也无去路)也是无穷 —— 那是"纯噪音",不是"平衡"
    expect(readings.ratioOf(0, 0)).toBe(Number.POSITIVE_INFINITY)
  })

  it('判词分档(默认 0.7 / 3 / 10):低了瓶颈、高了过剩、再高纯噪音', () => {
    const verdict = (income: number, sink: number) => readings.read([{ key: 'x', income, sink }])[0]!.verdictId
    expect(verdict(6, 10)).toBe('tight') // 0.6
    expect(verdict(7, 10)).toBe('healthy') // 0.7 —— 恰好压线算健康
    expect(verdict(30, 10)).toBe('healthy') // 3.0 —— 恰好压线算健康
    expect(verdict(31, 10)).toBe('surplus')
    expect(verdict(100, 10)).toBe('surplus') // 10 —— 压线仍是过剩
    expect(verdict(101, 10)).toBe('idle')
    expect(verdict(10, 0)).toBe('idle') // 只进不出
    expect(verdict(0, 10)).toBe('tight') // 只出不进
  })

  it('阈值与判词名都可换(默认是档位 id,作品换成自己的说法)', () => {
    const strict = createEconomyReadings({ bands: { healthy: 1 } })
    expect(strict.read([{ key: 'x', income: 2, sink: 1 }])[0]!.verdictId).toBe('surplus')
    expect(strict.labels.healthy).toBe('healthy') // 没给名字就用 id
    // 判词是给界面看的:换成中文之后,读数里直接就是中文
    expect(chinese.read([{ key: 'herb', income: 100, sink: 1 }])[0]!.verdict).toBe('闲置')
    expect(readings.read([{ key: 'herb', income: 100, sink: 1 }])[0]!.verdict).toBe('idle')
  })

  it('"没把握就明说":带 note 的读数被单独挑出来(既不算健康也不算事故)', () => {
    const list = readings.read([
      { key: 'stone', income: 100, sink: 100 },
      { key: 'wudao', income: 50, sink: 1, note: '界外出口未入模型 —— 读数待补' }
    ])
    const report = readings.summary(list)
    expect(report.healthy).toEqual(['stone'])
    expect(report.idle).toEqual(['wudao'])
    expect(report.noted).toEqual(['wudao']) // 单独一栏:这条读数不作数
  })

  it('分期读数:同一个口径跑多段,只把各段的瓶颈与闲置挑出来', () => {
    const series = readings.series([
      { label: '人间界·三层', flows: [{ key: 'stone', income: 100, sink: 100 }, { key: 'herb', income: 1, sink: 10 }] },
      { label: '仙界·一层', flows: [{ key: 'stone', income: 5000, sink: 100 }, { key: 'herb', income: 100, sink: 5 }] }
    ])
    expect(series.map(p => p.label)).toEqual(['人间界·三层', '仙界·一层'])
    expect(series[0]!.tight).toEqual(['herb'])
    expect(series[0]!.idle).toEqual([])
    expect(series[1]!.idle).toEqual(['stone', 'herb'])
    // 每一段各自的明细也在(界面要能点开看)
    expect(series[0]!.flows[0]!.ratio).toBe(1)
  })
})
