/* eslint-disable no-console */
/**
 * 消融实验 —— 带几只伙伴的手感:一只够不够、第二只还剩多少价值。
 *
 * `companions.spec.ts` 钉的是语义(中性值必须由作品给、性格系数是绝对取值、系数怎么合由作品定);
 * 这一份量的是**内容作者的取舍**:一只伙伴与三只伙伴差多少、"叠同一类系数"会不会被摊薄、
 * 以及"性格系数"与"伙伴自身词条"是两套账(前者是绝对系数、后者走属性合并)。
 *
 * 三条量出来的结论:
 *   ① **"同键要不要叠"是一个开关,而且两种口径差很多**:默认 `override` 下带三只加运气的
 *      只有最后一只生效(0.02);开 `add-relative` 则各自"相对中性"的那一份相加(0.08)。
 *      同一个开关对倍率类与加法类都成立(1.05 与 0.06 各自加);
 *   ② **性格系数与伙伴词条是两套账**:`effectsOf` 给的是"与中性基线合并后的绝对值",
 *      `modsOf` 给的是"要过属性合并的那组词条"—— 前者直接读,后者会吃递减与软阈值;
 *   ③ **中性值少一个键就直接报错**:这是刻意的 —— 中性值靠猜会出现"没带伙伴反而更穷",
 *      所以"少写一个键"必须当场炸,而不是拿 0 当默认(0 对倍率是灾难性的)。
 */
import { describe, expect, it } from 'vitest'
import { createCompanionSystem } from './companions.js'

const neutral = { exploreDurMult: 1, dangerMult: 1, dropLuck: 0, lossReduction: 0 }

const system = createCompanionSystem({
  neutral,
  traits: [
    { id: 'greedy', name: '贪宝', mods: { dropLuck: 0.06, dangerMult: 1.05 } },
    { id: 'steady', name: '慢稳', mods: { exploreDurMult: 1.1, lossReduction: 0.02 } },
    { id: 'swift', name: '轻捷', mods: { exploreDurMult: 0.94, dropLuck: 0.02 } }
  ],
  companions: [
    { id: 'fox', name: '青羽灵狐', traitId: 'greedy', mods: { luck: 0.05 } },
    { id: 'turtle', name: '玄武', traitId: 'steady', mods: { defensePct: 0.03, luck: 0.02 } },
    { id: 'crane', name: '白鹤', traitId: 'swift', mods: { luck: 0.03 } }
  ]
})

describe('消融实验 —— 带几只伙伴的手感', () => {
  /** 同一份内容、只换合并口径 */
  const additive = createCompanionSystem({
    neutral,
    stack: 'add-relative',
    traits: [
      { id: 'greedy', name: '贪宝', mods: { dropLuck: 0.06, dangerMult: 1.05 } },
      { id: 'steady', name: '慢稳', mods: { exploreDurMult: 1.1, lossReduction: 0.02 } },
      { id: 'swift', name: '轻捷', mods: { exploreDurMult: 0.94, dropLuck: 0.02 } }
    ],
    companions: [
      { id: 'fox', name: '青羽灵狐', traitId: 'greedy', mods: { luck: 0.05 } },
      { id: 'turtle', name: '玄武', traitId: 'steady', mods: { defensePct: 0.03, luck: 0.02 } },
      { id: 'crane', name: '白鹤', traitId: 'swift', mods: { luck: 0.03 } }
    ]
  })

  it('同键要不要叠是个开关:override 取最后一只,add-relative 各自相对中性相加', () => {
    const one = system.effectsOf('fox')
    const three = system.activeMods(['fox', 'turtle', 'crane'])
    const threeAdd = additive.activeMods(['fox', 'turtle', 'crane'])
    console.log(`  一只贪宝:dropLuck ${one.dropLuck}`)
    console.log(`  三只一起(override):dropLuck ${three.dropLuck} · 时长 ${three.exploreDurMult} · 危险 ${three.dangerMult}`)
    console.log(`  三只一起(add-relative):dropLuck ${threeAdd.dropLuck} · 时长 ${threeAdd.exploreDurMult} · 危险 ${threeAdd.dangerMult}`)

    // ① 默认 override:同一个键只留最后一只的
    expect(one.dropLuck).toBeCloseTo(0.06, 9)
    expect(three.dropLuck).toBeCloseTo(0.02, 9) // 白鹤的
    // add-relative:追加法类的相对份相加(0.06 + 0.02 = 0.08),倍率类同样(相对 1 的份相加)
    expect(threeAdd.dropLuck).toBeCloseTo(0.08, 9)
    expect(threeAdd.dangerMult).toBeCloseTo(1.05, 9)
    expect(threeAdd.exploreDurMult).toBeCloseTo(1 + (1.1 - 1) + (0.94 - 1), 9)
    // 同一个开关对两类键都成立:时长 1.04、损失减免 0.02
    expect(threeAdd.lossReduction).toBeCloseTo(0.02, 9)
    // 防空转:override 下顺序一变结果就变(证明是"覆盖"而不是"取最大/最小")
    const reversed = system.activeMods(['crane', 'turtle', 'fox'])
    expect(reversed.dropLuck).toBeCloseTo(0.06, 9)
    expect(reversed.dropLuck).not.toBe(three.dropLuck)
    // 而 add-relative 与顺序无关(加法交换律):这也是两种口径的一条实用差别
    expect(additive.activeMods(['crane', 'turtle', 'fox'])).toEqual(threeAdd)
  })

  it('性格系数与伙伴词条是两套账:一套直接读,一套要去过属性合并', () => {
    const effects = system.effectsOf('fox')
    const mods = system.modsOf('fox')
    console.log(`  性格系数(与中性基线合并后):${JSON.stringify(effects)}`)
    console.log(`  伙伴自身词条(要过属性合并):${JSON.stringify(mods)}`)

    // ② 性格系数是"完整的绝对值组"(含中性键),读的时候不必反推基线
    expect(Object.keys(effects).sort()).toEqual(Object.keys(neutral).sort())
    expect(effects.dropLuck).toBeCloseTo(0.06, 9)
    // 而伙伴词条只带它自己那几项 —— 它们会吃递减与软阈值,所以不能当"最终值"直接读
    expect(mods).toEqual({ luck: 0.05 })
    // 没有性格的伙伴:系数就是中性基线(而不是空对象)
    expect(system.effectsOf(null)).toEqual(neutral)
    expect(system.modsOf(null)).toEqual({})
    // 防空转:两套账确实不同(否则"分开读"没有意义)
    expect(effects).not.toEqual(mods)
  })

  it('中性值少一个键当场炸:0 对倍率是灾难性的', () => {
    // ③ "没带伙伴反而更穷"的根源就是把倍率的中性值猜成了 0 —— 所以这里直接抛错
    expect(() =>
      createCompanionSystem({
        neutral: { dropLuck: 0, lossReduction: 0 } as never, // 少了两个倍率键
        traits: [{ id: 'x', mods: { dropLuck: 0.1, exploreDurMult: 1.1 } }], // 用到了没有中性值的键
        companions: []
      })
    ).toThrow()
    // 完整的中性值则一切正常
    expect(() => createCompanionSystem({ neutral, traits: [], companions: [] })).not.toThrow()
    // 防空转:错误信息里点名了缺哪个键(否则使用者得自己猜)
    try {
      createCompanionSystem({
        neutral: { dropLuck: 0, lossReduction: 0 } as never,
        traits: [{ id: 'x', mods: { dropLuck: 0.1, exploreDurMult: 1.1 } }],
        companions: []
      })
    } catch (error) {
      const message = String((error as Error).message)
      console.log(`  少写两个倍率键时报的错:${message}`)
      expect(message).toMatch(/exploreDurMult/)
    }
  })

  it('伙伴自身词条永远相加(与性格系数的口径互不影响)', () => {
    const merged = system.activeMods(['fox', 'turtle'])
    const single = system.activeMods(['fox'])
    console.log(`  只带灵狐:${JSON.stringify(single)} · 灵狐 + 玄武:${JSON.stringify(merged)}`)

    // 性格系数层面(override):不同的键各生效 —— 时长来自玄武、危险来自灵狐
    expect(merged.exploreDurMult).toBeCloseTo(1.1, 9)
    expect(merged.dangerMult).toBeCloseTo(1.05, 9)
    // 而"伙伴自身词条"这一层永远是相加(两套账各管一段)
    expect(merged.luck).toBeCloseTo(0.05 + 0.02, 9)
    // 同一只伙伴带两次不会翻倍(按 id 去重)
    expect(system.activeMods(['fox', 'fox'])).toEqual(single)
    // modsOf 只给"每只一份":要不要再过属性合并(递减/软阈值)由作品定
    const modsOfFox = system.modsOf('fox')
    const modsOfTurtle = system.modsOf('turtle')
    expect(modsOfFox).toEqual({ luck: 0.05 })
    expect(modsOfTurtle).toEqual({ defensePct: 0.03, luck: 0.02 })
    // 防空转:两套读数确实给出了不同的形状
    expect(Object.keys(merged)).toContain('lossReduction')
    expect(Object.keys(modsOfFox)).not.toContain('lossReduction')
  })
})
