/* eslint-disable no-console */
/**
 * 成长体检 —— 读数口径(跳变怎么算、跨界怎么单列、碾压怎么判)。
 *
 * 这份用例钉的是**口径**,不是某份内容的数字:换题材会换掉表里的数,但"相邻格的倍数"
 * "跨界不混进最大跳变""玩家/内容 ≥ 阈值才算碾"这些算法不该跟着变。
 */
import { describe, expect, it } from 'vitest'
import { createProgressionAudit } from './progression.js'
import { createRealmSystem, type RealmSystemConfig } from './realms.js'

/** 一张小心构造的表:普通格涨 2 倍,跨界那一格涨 100 倍(用来验"跨界单列") */
const ladder = (): RealmSystemConfig => ({
  worlds: [
    { id: 'low', name: '下界', realms: ['一段', '二段'] },
    { id: 'high', name: '上界', realms: ['三段'] }
  ],
  layerNames: ['一', '二'],
  labelFormat: '{realm}·{layer}',
  exp: { base: 100, layerGrowth: 2, realmGrowth: 100, lateRealmGrowth: 100, worldStepMult: 1 },
  combat: { base: { attack: 10 }, layerGrowth: 2, realmGrowth: 3, lateRealmGrowth: 3 },
  breakthrough: { layerBase: 0.9, layerDecay: 0.1, majorBase: 0.6, majorDecay: 0.1, min: 0.1, max: 0.9 }
})

const sys = () => createRealmSystem(ladder())

describe('成长体检 —— 跳变、跨界与碾压', () => {
  it('逐格读数:相邻格倍数,第一格恒为 1', () => {
    const audit = createProgressionAudit({ realms: sys() })
    const first = audit.steps[0]!
    expect(first.label).toBe('一段·一')
    expect(first.costStep).toBe(1)
    expect(first.powerStep).toBe(1)
    // 同一个大境界里的小层:需求 ×2、面板 ×2
    const same = audit.steps[1]!
    expect(same.costStep).toBeCloseTo(2, 10)
    expect(same.powerStep).toBeCloseTo(2, 10)
    // 格子数 = 每个境界的小层数之和
    expect(audit.steps.length).toBe(2 + 2 + 2)
    console.log(`  ${audit.steps.map(s => `${s.label} 需求×${s.costStep.toFixed(1)}`).join(' · ')}`)
  })

  it('换界单列:跳变记在落点上,最大跳变只在普通格里挑', () => {
    const audit = createProgressionAudit({ realms: sys() })
    const summary = audit.summary()
    // 换界那一格:上界的头一格(跳变记在落点),需求跳 50 倍
    const world = summary.worldSteps
    expect(world.length).toBe(1)
    expect(world[0]!.label).toBe('三段·一')
    expect(world[0]!.costStep).toBeCloseTo(50, 6)
    expect(audit.steps.find(s => s.label === '三段·一')!.isWorldEntry).toBe(true)
    expect(audit.steps.find(s => s.label === '二段·二')!.isWorldStep).toBe(true) // 走完它才换界
    // 而"最大跳变"里不该出现它 —— 它是设计,不是事故
    expect(summary.biggestCostStep.isWorldEntry).toBe(false)
    expect(summary.biggestCostStep.label).toBe('二段·一') // 境内跨大境界那一下(×50)
    console.log(`  换界:${world[0]!.label} 需求 ×${world[0]!.costStep.toFixed(0)};普通格最大 ${summary.biggestCostStep.label} ×${summary.biggestCostStep.costStep.toFixed(2)}`)
  })

  it('碾压判定:玩家 ÷ 内容 ≥ 阈值才算碾(默认 3),<1 是撞墙', () => {
    const realms = sys()
    // 内容强度:前两格很强(玩家打不动),后面越来越弱(玩家碾压)
    const content = (major: number, layer: number): number => {
      const index = major * 2 + layer
      return index < 2 ? 1000 : 5
    }
    const audit = createProgressionAudit({ realms, contentPower: content })
    const verdicts = audit.steps.map(s => s.verdict)
    expect(verdicts.slice(0, 2)).toEqual(['wall', 'wall']) // 玩家/内容 < 1
    expect(verdicts.slice(2).every(v => v === 'crush')).toBe(true)
    const summary = audit.summary()
    expect(summary.firstCrush?.label).toBe('二段·一')
    expect(summary.crushing).toBe(4)
    console.log(`  判决:${audit.steps.map(s => `${s.label}=${s.verdict}(${s.ratio!.toFixed(2)})`).join(' · ')}`)

    // 阈值可改:把碾压线抬到 100,同一份内容立刻"谁也没被碾"
    const strict = createProgressionAudit({ realms, contentPower: content, crushRatio: 100 })
    expect(strict.steps.some(s => s.verdict === 'crush')).toBe(false)
    expect(strict.crushRatio).toBe(100)
  })

  it('不给内容强度就不判碾压:宁可少报,不要瞎报', () => {
    const audit = createProgressionAudit({ realms: sys() })
    expect(audit.steps.every(s => s.verdict === undefined)).toBe(true)
    expect(audit.steps.every(s => s.ratio === undefined)).toBe(true)
    expect(audit.summary().firstCrush).toBeUndefined()
    expect(audit.summary().crushing).toBe(0)
  })

  it('强度与价格都能自己接管;不给强度就用面板之和兜底', () => {
    const realms = sys()
    const custom = createProgressionAudit({
      realms,
      power: (major, layer) => 1 + major * 2 + layer, // 手写的强度曲线
      costOf: (_major, layer) => 10 * (layer + 1) // 手写的价格曲线
    })
    expect(custom.steps[0]!.cost).toBe(10)
    expect(custom.steps[1]!.cost).toBe(20)
    expect(custom.steps[0]!.power).toBe(1)
    expect(custom.steps[1]!.power).toBe(2)

    // 兜底口径:baseStats 的所有键相加(引擎不认识键名,只求和)
    const panel = createProgressionAudit({ realms })
    const stats = realms.baseStats(0, 0)
    expect(panel.steps[0]!.power).toBeCloseTo(Number(stats.attack ?? 0), 6)
    console.log(`  兜底口径:${panel.steps[0]!.label} 面板强度 ${panel.steps[0]!.power}`)
  })

  it('读数行:一行一格,onlySteps 只留跳变明显的那些', () => {
    const audit = createProgressionAudit({ realms: sys() })
    const all = audit.lines()
    expect(all.length).toBe(audit.steps.length)
    expect(all[0]).toContain('一段·一')
    const jumpy = audit.lines({ onlySteps: true })
    expect(jumpy.length).toBeLessThan(all.length)
    expect(jumpy.some(line => line.includes('三段·一'))).toBe(true) // 换界那一行一定在
    console.log(`  ${jumpy.join('\n  ')}`)
  })

  it('按段读数:每大境界一段(默认),也能按界域切', () => {
    const audit = createProgressionAudit({ realms: sys() })
    const byMajor = audit.segments()
    expect(byMajor.map(s => s.name)).toEqual(['一段', '二段', '三段'])
    expect(byMajor.map(s => s.cells)).toEqual([2, 2, 2])
    expect(byMajor.reduce((n, s) => n + s.cells, 0)).toBe(audit.steps.length)
    // 段跨度 = 段末 ÷ 段首:每一段都是"一层 ×2、二层 ×2" → 段末/段首 = 2
    for (const seg of byMajor) expect(seg.costSpan).toBeCloseTo(2, 10)
    // 段内单步最大 = 2;而**跨进来**那一步单独给:第二段 ×50(跨大境界),第三段 ×50(换界)
    expect(byMajor.map(s => s.entryCostStep)).toEqual([1, 50, 50])
    expect(byMajor.map(s => s.maxCostStep)).toEqual([2, 2, 2])
    console.log(`  按境界:${byMajor.map(s => `${s.name}×${s.costSpan.toFixed(1)}(进门 ×${s.entryCostStep})`).join(' · ')}`)

    // 按界域切:下界两段合成一段(4 格),上界一段(2 格)
    const byWorld = audit.segments('world')
    expect(byWorld.map(s => s.name)).toEqual(['下界', '上界'])
    expect(byWorld.map(s => s.cells)).toEqual([4, 2])
    // 段首→段末:一段·一 100 → 二段·二 20000(层间 ×2、境内跨大境界 ×50)→ ×200
    expect(byWorld[0]!.costSpan).toBeCloseTo(200, 6)
    expect(byWorld[1]!.costSpan).toBeCloseTo(2, 10)   // 三段两格之间只有层间 ×2
    expect(byWorld[1]!.entryCostStep).toBeCloseTo(50, 10) // 换界那一步
    console.log(`  按界域:${byWorld.map(s => `${s.name}×${s.costSpan.toFixed(1)}(进门 ×${s.entryCostStep})`).join(' · ')}`)
  })
})
