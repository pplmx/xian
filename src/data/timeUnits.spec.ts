/* eslint-disable no-console -- 对账表是给人看的 */
/**
 * 时制对账 —— 古语可以说,但必须与现代时长对得上
 *
 * 玩家提醒的那句:「一些丹药写的是时辰,实际却按现在的 24 小时算,有的小问题;
 * 一个时辰是两小时,一刻是 15 分钟。」查下来确实如此,而且不止一处:
 *
 *   · 聚灵丹写「半个时辰内修炼倍增」,实际 1800 秒 = **30 分钟**
 *     (半个时辰是一个小时 —— 差一倍);修速药力因此被读大一倍。
 *   · 修为丹阶梯写「半时 / 一时 / 二时」:字面像"半个时辰 / 一个时辰",
 *     实际按小时算 —— 一整套差一倍。
 *   · 闭关提示写「静坐一炷香(5 分钟)」:一炷香是 30 分钟。
 *
 * 改法分两层:
 *   一 立表:data/timeUnits 收下道门时制(一盏茶 10 分 · 一刻 15 分 ·
 *      一炷香 30 分 · 半个时辰 1 小时 · 一个时辰 2 小时),落不在表上的值
 *      说「将近 X / X 有余」并附分钟数 —— 古语可以模糊,模糊必须写在明处;
 *   二 立判据:**凡是文案里出现了时制词,就折成秒与数据对账**。
 *      数值一改忘了改文案,这里立刻红(而不是等玩家发现"写的和做的不一样")。
 */
import { describe, expect, it } from 'vitest'
import { PILLS } from './pills'
import { BUFFS, buffDef } from './buffs'
import { KE_SEC, SHICHEN_SEC, classicalDuration, parseClassicalDuration } from './timeUnits'

/** 从文案里取出括号中的现代时长(分钟/小时),折成秒 */
function modernSecondsIn(text: string): number | null {
  const m = /(\d+(?:\.\d+)?)\s*(分钟|小时|秒)/.exec(text)
  if (!m) return null
  const n = Number(m[1])
  return m[2] === '小时' ? n * 3600 : m[2] === '分钟' ? n * 60 : n
}

describe('道门时制 · 表本身', () => {
  it('一炷香 = 半时辰的一半?不 —— 表就是这么定的,且古语与秒可以互推', () => {
    const sec = (s: string): number => parseClassicalDuration(s)?.sec ?? -1
    expect(sec('半个时辰')).toBe(3600)
    expect(sec('一个时辰')).toBe(SHICHEN_SEC)
    expect(sec('两个时辰')).toBe(2 * SHICHEN_SEC)
    expect(sec('一刻')).toBe(KE_SEC)
    expect(sec('六刻')).toBe(6 * KE_SEC)
    expect(sec('一炷香')).toBe(1800)
    expect(sec('一盏茶')).toBe(600)
    // 近似说法标出来:判据据此放宽到"一刻之内且方向对"
    expect(parseClassicalDuration('将近一刻')?.exact).toBe(false)
    expect(parseClassicalDuration('一刻')?.exact).toBe(true)
    // 一个时辰 = 两小时 = 八刻
    expect(SHICHEN_SEC).toBe(2 * 3600)
    expect(SHICHEN_SEC / KE_SEC).toBe(8)
  })

  it('古今对照写法:确切值用古语 + 分钟;落不在表上的说清与最近一档的关系', () => {
    console.log(
      '\n  ' +
        [600, 900, 1800, 3600, 5400, 7200, 10800, 21600, 540, 1080].map(s => `${s}s=${classicalDuration(s)}`).join(' · ')
    )
    expect(classicalDuration(1800)).toBe('一炷香(30 分钟)')
    expect(classicalDuration(3600)).toBe('半个时辰(1 小时)')
    expect(classicalDuration(7200)).toBe('一个时辰(2 小时)')
    expect(classicalDuration(10800)).toBe('一个半时辰(3 小时)')
    expect(classicalDuration(540)).toBe('将近一刻(9 分钟)')
    expect(classicalDuration(1080)).toBe('一刻有余(18 分钟)')
  })
})

describe('时制对账 · 文案与数据', () => {
  it('丹药:凡文案里写了时制,折出的秒数必须等于它的真实时长', () => {
    const rows: string[] = []
    let checked = 0
    for (const def of PILLS) {
      const claimed = parseClassicalDuration(def.desc)
      const modern = modernSecondsIn(def.desc)
      // 只审"文案落了时长"的那几味
      if (claimed === null && modern === null) continue
      checked += 1
      // 真实时长:即时丹看 expSecs;增益丹看它 buff 的持续秒数
      const actual = def.instant?.expSecs ?? (def.buffId ? buffDef(def.buffId)?.durationSec : undefined)
      rows.push(
        `${def.name}:文案 ${claimed ? `${claimed.sec}s${claimed.exact ? '' : '(约)'}` : '-'} / 现代 ${modern ?? '-'}s · 实际 ${actual ?? '-'}s`
      )
      expect(actual, `${def.name} 的文案写了时长,数据里却没有时长可比`).toBeDefined()
      if (claimed) {
        if (claimed.exact) expect(claimed.sec, `${def.name} 的古语与实际不符(${def.desc})`).toBe(actual)
        else expect(Math.abs(claimed.sec - actual!), `${def.name} 的"将近/有余"跑出了最近那一档(${def.desc})`).toBeLessThanOrEqual(KE_SEC)
      }
      if (modern !== null) expect(modern, `${def.name} 括号里的现代时长与实际不符(${def.desc})`).toBe(actual)
    }
    console.log(`\n  丹药文案对账(共 ${checked} 味):`)
    for (const r of rows) console.log('    ' + r)
    expect(checked, '一味带时长的丹药都没扫到 —— 判据形同虚设').toBeGreaterThan(5)
  })

  it('增益:文案里的时制同样要与 buff 的持续秒数一致', () => {
    let checked = 0
    for (const def of BUFFS) {
      const claimed = parseClassicalDuration(def.desc)
      if (claimed === null) continue
      checked += 1
      if (claimed.exact) {
        expect(claimed.sec, `${def.name} 的古语与实际时长不符(${def.desc} / ${def.durationSec}s)`).toBe(def.durationSec)
      } else {
        expect(Math.abs(claimed.sec - def.durationSec), `${def.name} 的"将近/有余"跑出了最近那一档`).toBeLessThanOrEqual(KE_SEC)
      }
    }
    console.log(`  增益文案对账:${checked} 条含时制`)
  })
})
