/* eslint-disable no-console */
/**
 * 消融实验 —— 世界记忆的"两路门槛"与"多久不打交道就回落"。
 *
 * `memory.spec.ts` 钉的是语义(两路门槛取先到、没资格停在最低档、回落是"到点即回落");
 * 这一份量的是**刻度**:内容作者定"打几场算稳定""守多少小时算繁荣""多久不打交道就回落"时
 * 要看的数字,以及**落差的代价** —— 掉档会丢掉多少产出系数。
 *
 * 三条量出来的结论:
 *   ① **两路门槛是"谁先到算谁"**:一场胜都没打、光守着也可能升档(小时先到),
 *      打了足够多场没守够也会升档(计数先到)—— 两条线各自独立,不是"都要满足";
 *      而档位是**分级取**的:差一点只掉一档(够不上繁荣仍是安生),不是掉回最低档;
 *   ② **回落是硬开关,不是渐变**:闲置一到点,直接回到最低档(系数从 1.15 掉回 1.0),
 *      中间没有过渡 —— 所以界面上"还有多少小时"要给准;
 *   ③ **没资格与太久没来是两回事**:`eligible: false` 停在最低档但**不标 `decayed`**
 *      (是"没谈成",不是"忘了"),界面上的说法不同。
 */
import { describe, expect, it } from 'vitest'
import { createStageMemory } from './memory.js'

const HOUR = 3600_000

/** 一块地界的三档:太平 → 安生 → 繁荣 */
const memory = createStageMemory({
  stages: [
    { id: 'wild', name: '荒芜', mult: 1 },
    { id: 'settled', name: '安生', at: { count: 3, hours: 12 }, mult: 1.05 },
    { id: 'flourish', name: '繁荣', at: { count: 10, hours: 48 }, mult: 1.15 }
  ],
  decayAfterHours: 72
})

describe('消融实验 —— 世界记忆的升档与回落', () => {
  it('两路门槛取先到:守够时间也能升,打够场次也能升', () => {
    const rows = [
      { label: '什么都没做', input: {} },
      { label: '打了 3 场、没守', input: { count: 3 } },
      { label: '守了 12 小时、没打', input: { hours: 12 } },
      { label: '打了 10 场、没守', input: { count: 10 } },
      { label: '守了 48 小时、没打', input: { hours: 48 } },
      { label: '两样都差一点(9 场 / 47 小时)', input: { count: 9, hours: 47 } }
    ]
    console.log('  投入 → 档位(系数)')
    for (const row of rows) {
      const state = memory.stateOf({ idleHours: 0, ...row.input })
      console.log(`  ${row.label.padEnd(24, ' ')} → ${state.name}(×${state.mult})`)
    }

    // ① 两条线各自独立:任一条到就升档
    expect(memory.stateOf({ count: 3 }).id).toBe('settled')
    expect(memory.stateOf({ hours: 12 }).id).toBe('settled')
    expect(memory.stateOf({ count: 10 }).id).toBe('flourish')
    expect(memory.stateOf({ hours: 48 }).id).toBe('flourish')
    // 差一点只掉一档:够不上"繁荣"的门槛,但"安生"的门槛早够了 —— 档位是分级取,不是全有全无
    expect(memory.stateOf({ count: 9, hours: 47 }).id).toBe('settled')
    // 而两样都从零开始,才停在最低档
    expect(memory.stateOf({ count: 2, hours: 11 }).id).toBe('wild')
    // 防空转:门槛确实有高低之分(否则"取先到"是句空话)
    expect(memory.stateOf({ count: 3 }).mult).toBeLessThan(memory.stateOf({ hours: 48 }).mult)
  })

  it('回落是硬开关:闲置 71 小时还在,72 小时一到就回最低档', () => {
    const rows = [0, 24, 71, 72, 96].map(idleHours => ({
      idleHours,
      state: memory.stateOf({ count: 10, hours: 48, idleHours })
    }))
    console.log('  闲置多久 → 档位')
    for (const row of rows) {
      console.log(`  ${String(row.idleHours).padStart(3, ' ')} 小时 → ${row.state.name}(×${row.state.mult})${row.state.decayed ? ' · 已回落' : ''}`)
    }

    // ② 边界是"到点即回落":71 小时还在繁荣,72 小时直接回荒芜
    expect(rows.find(r => r.idleHours === 71)!.state.id).toBe('flourish')
    expect(rows.find(r => r.idleHours === 72)!.state.id).toBe('wild')
    expect(rows.find(r => r.idleHours === 72)!.state.decayed).toBe(true)
    // 落差就是系数差:1.15 → 1.00(一刻钟的差别,产出差一成半)
    expect(rows.find(r => r.idleHours === 71)!.state.mult).toBe(1.15)
    expect(rows.find(r => r.idleHours === 72)!.state.mult).toBe(1)
    // 防空转:中间没有过渡档(不是"逐级掉")
    expect(memory.stages.length).toBe(3)
    expect(new Set(rows.map(r => r.state.id)).size).toBe(2)
  })

  it('"没资格"与"太久没来"要分开说', () => {
    const noQualification = memory.stateOf({ count: 10, hours: 48, eligible: false })
    const forgotten = memory.stateOf({ count: 10, hours: 48, idleHours: 100 })
    console.log(`  没资格:${noQualification.name}(decayed=${noQualification.decayed}) · 太久没来:${forgotten.name}(decayed=${forgotten.decayed})`)

    // ③ 两条路径都停在最低档,但标记不同 —— 界面说法不同("还没谈成" / "荒了")
    expect(noQualification.id).toBe('wild')
    expect(noQualification.decayed).toBe(false)
    expect(forgotten.id).toBe('wild')
    expect(forgotten.decayed).toBe(true)
    // 防空转:两份输入除了这两个开关以外完全一样(计数与小时都够进繁荣)
    expect(memory.stateOf({ count: 10, hours: 48 }).id).toBe('flourish')
  })

  it('钟的起点取最晚:几路时间谁新算谁,倒计时也随之给准', () => {
    const now = 1_000 * HOUR
    const touched = memory.touchedAt(now - 90 * HOUR, now - 3 * HOUR, now - 40 * HOUR)
    expect(touched).toBe(now - 3 * HOUR) // 取最新的一次
    console.log(`  三次打交道的时刻取最新 → 距现在 ${memory.hoursBetween(touched, now)} 小时`)
    expect(memory.hoursBetween(touched, now)).toBe(3)

    // 还没到回落线 → 界面上的"还有多久"是个正数
    expect(memory.hoursUntil(touched, now, 72)).toBe(69)
    // 已经过了线 → 给 0(不许出现负数,否则界面会显示"还有 -18 小时")
    expect(memory.hoursUntil(touched, now + 100 * HOUR, 72)).toBe(0)
    // 从没打过交道(from = 0)→ 不算"够钟",避免"新地界一上来就判荒"
    expect(memory.idleBeyond(0, now, 72)).toBe(false)
    expect(memory.idleBeyond(now - 100 * HOUR, now, 72)).toBe(true)
    // 防空转:正好压线不算过线(边界写法)
    expect(memory.idleBeyond(now - 72 * HOUR, now, 72)).toBe(false)
  })
})
