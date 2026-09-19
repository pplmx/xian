/**
 * 用引擎的**通用体检**跑本作那张真表(21 境 × 10 层)。
 *
 * 本作本来是拿自己的 `inflationAudit` 管数值的 —— 那份要内容建模(区域强度、装备成型度档位),
 * 结论更细,但也就更贵。引擎那份(`createProgressionAudit`)**不认识题材**:强度、内容强度、
 * 价格曲线都由调用方给。这里用它做两件事:
 *
 *   一 **交叉核对**:同一张表,两条独立实现算出来的结构必须对得上 —— 格数、换界落点、
 *      层内倍率(与常数表 `EXP_SUB_GROWTH` 对账);
 *   二 **把这张表的形状钉住**:换界那一格需求**回落**(层内复利比跨大境界陡)是已知形状,
 *      不是事故 —— 但哪天有人改了曲线,这条要红,逼他显式面对(而不是悄悄变了没人知道)。
 *
 * 这也是"第一个定制用户"该有的样子:库里的通用件,本作不是供着,而是真的拿来用。
 */
import { describe, expect, it } from 'vitest'
import { createProgressionAudit } from 'wanxiang-engine'
import { EXP_SUB_GROWTH, WORLD_STEP_EXP_MULT } from '@/data/constants'
import { MAX_MAJOR, REALMS, WORLDS } from '@/data/realms'
import { gnumNumeric } from './engineNumeric'
import { ENGINE_WORLD } from './engineWorld'

/** 大数层要显式把 GNum 适配器交进去 —— 引擎默认只认 number */
const audit = createProgressionAudit({ realms: ENGINE_WORLD.realms }, gnumNumeric)

describe('通用曲线体检 × 本作真表', () => {
  it('格数与换界落点与数据表逐项对得上', () => {
    const summary = audit.summary()
    // 21 境 × 10 层
    expect(summary.steps).toBe(REALMS.length * ENGINE_WORLD.realms.layerNames.length)
    expect(REALMS.length).toBe(MAX_MAJOR + 1)

    // 换界那三格:仙界 / 神界 / 混沌海的起点(与 WORLDS 的 start 一致)
    const starts = WORLDS.slice(1).map(w => w.start)
    const entries = audit.steps.filter(s => s.isWorldEntry)
    expect(entries.map(s => s.major)).toEqual(starts)
    for (const entry of entries) {
      expect(entry.layer).toBe(0)
      expect(entry.label).toBe(ENGINE_WORLD.realms.label(entry.major, 0))
      expect(entry.label.startsWith(REALMS[entry.major]!.name)).toBe(true)
    }
    console.log(`\n换界三格:${entries.map(s => `${s.label}(需求 ×${s.costStep.toFixed(2)} · 面板 ×${s.powerStep.toFixed(2)})`).join(' · ')}`)
  })

  it('步长与常数表逐项对账:层内 ×1.32、界末圆满 ×1.32×2、跨大境界与换界各有各的口径', () => {
    const sys = ENGINE_WORLD.realms
    // 层号 > 0 的格子 = "同一大境界内的小层"(落点是第 1~9 层);层号 = 0 的格子 = 跨大境界。
    // 两种步长的口径不同,所以要按落点分层看,不能混在一起断言。
    const within = audit.steps.filter(s => s.layer > 0)
    const plain = within.filter(s => !sys.isWorldStep(s.major, s.layer))
    const worldEnds = within.filter(s => sys.isWorldStep(s.major, s.layer))

    for (const step of plain) expect(step.costStep).toBeCloseTo(EXP_SUB_GROWTH, 6)
    expect(worldEnds.length).toBe(WORLDS.length - 1) // 三个界末的"圆满"
    // 界末的圆满被抬成一道墙(常数表的 WORLD_STEP_EXP_MULT):抬的是**这一层**,不是整个境界
    for (const step of worldEnds) expect(step.costStep).toBeCloseTo(EXP_SUB_GROWTH * WORLD_STEP_EXP_MULT, 6)

    const summary = audit.summary()
    expect(summary.biggestCostStep.isWorldEntry).toBe(false)
    // 排除第一格(它是起点,没有"上一步"可言)
    const majors = audit.steps.filter((s, index) => index > 0 && s.layer === 0 && !s.isWorldEntry)
    expect(majors.length).toBe(REALMS.length - WORLDS.length)
    console.log(
      `\n步长三层:层内普通 ${plain.length} 步 ×${EXP_SUB_GROWTH} · ` +
        `界末圆满 ${worldEnds.length} 步 ×${(EXP_SUB_GROWTH * WORLD_STEP_EXP_MULT).toFixed(2)} · ` +
        `跨大境界 ${majors.length} 步(最大 ×${Math.max(...majors.map(s => s.costStep)).toFixed(2)}) · ` +
        `换界 3 步(都 <1)`
    )
    console.log(`最大跳变 ${summary.biggestCostStep.label} 需求 ×${summary.biggestCostStep.costStep.toFixed(2)}`)
  })

  it('换界的形状:面板一定涨,需求按已知形状回落(回落是记录在案的设计,不是事故)', () => {
    const entries = audit.steps.filter(s => s.isWorldEntry)
    expect(entries.length).toBe(3)
    for (const entry of entries) {
      // 换界必须变强:面板(攻/防/血之和)不许下降
      expect(entry.powerStep).toBeGreaterThan(1)
      // 需求回落:层内复利(1.32^9 ≈ 12.4)比跨大境界那一下更陡。
      // 这条是**已知形状** —— 改了曲线(层内倍率、跨境界倍率、换界那一档)就要重新面对它。
      expect(entry.costStep).toBeLessThan(1)
    }
    console.log(`\n换界需求倍数:${entries.map(s => `第 ${s.major} 境 ×${s.costStep.toFixed(3)}`).join(' · ')}`)
  })

  it('读数行一行一格;面板强度取的是"本值之和"这条兜底口径', () => {
    const lines = audit.lines()
    expect(lines.length).toBe(audit.steps.length)
    // 兜底口径 = baseStats 所有键相加(引擎不认识键名);本作的面板是三维,故第一格 = 攻+防+血
    const first = audit.steps[0]!
    const stats = ENGINE_WORLD.realms.baseStats(0, 0)
    const sum = Object.values(stats).reduce<number>((acc, value) => acc + gnumNumeric.toNumber(value), 0)
    expect(first.power).toBeCloseTo(sum, 6)
    expect(first.label).toBe(ENGINE_WORLD.realms.label(0, 0))
    console.log(`\n第一格 ${first.label}:面板强度 ${first.power.toExponential(3)}(三维之和)`)
  })
})
