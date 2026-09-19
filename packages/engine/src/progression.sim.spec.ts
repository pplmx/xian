/* eslint-disable no-console -- 消融实验的产物就是它打印出来的刻度 */
/**
 * 曲线体检的**刻度** —— 三份内容包各自读出来是什么样。
 *
 * 为什么偏偏是 `progression` 缺这一份:38 个模块里,该量的都量了(参数一拧、玩家看到什么),
 * 唯独曲线体检自己没量过 —— 而它恰恰是使用者最需要"刻度感"的那一层:
 * "层内 ×1.32 算陡吗""3 倍才算碾压是什么概念""这一境整体涨 5 倍正常吗"。
 * 没有这份刻度,体检给出一串数字,读者却不知道哪个数需要紧张。
 *
 * 量三件事(都用库自带的内容包,不另编数据 —— 换成你的表,读数跟着变,口径不变):
 *   ① **跳变**:需求与面板最陡的一格(跨界那几格单列,它本来就该跳);
 *   ② **段长**:每个大境界 / 每个界域整体涨了多少倍(排期问的是这个);
 *   ③ **碾压**:把区域表接成内容强度后,第一次碾压出现在哪一格、一共几格,
 *      以及阈值从 3 拧到 2 / 5 时结论怎么变(这一条最容易被误读成"内容没问题")。
 */
import { describe, expect, it } from 'vitest'
import { defineGame } from './config.js'
import { dungeonContentPower } from './dungeons.js'
import { compareProgression, createProgressionAudit } from './progression.js'
import { DAILY } from './presets/daily.js'
import { DEMO } from './presets/demo.js'
import { XIUXIAN } from './presets/xiuxian.js'

/** 拿一份内容包装配,并把"内容强度"接成区域表 —— 体检的两半就都到位了 */
function audited(config: typeof XIUXIAN, crushRatio?: number) {
  const game = defineGame(config)
  return {
    game,
    audit: createProgressionAudit({
      game,
      contentPower: dungeonContentPower({ dungeons: game.dungeons, attributes: game.attributes }),
      crushRatio
    })
  }
}

const packs = [
  { id: 'xiuxian', name: '仙侠', config: XIUXIAN },
  { id: 'demo', name: '星港', config: DEMO },
  { id: 'daily', name: '日常', config: DAILY }
] as const

/** 倍数印成人能读的样子:上亿就别写一长串数字了 */
const x = (n: number): string => `×${n >= 1e6 ? n.toExponential(2) : n.toFixed(1)}`

describe('曲线体检的刻度 —— 三份内容包', () => {
  it('跳变与段长:最陡的一格、每境每界涨多少', () => {
    console.log('\n不掺任何数据,直接读三份内容包的曲线:')
    for (const pack of packs) {
      const { game, audit } = audited(pack.config)
      const summary = audit.summary()
      const byMajor = audit.segments()
      const byWorld = audit.segments('world')
      const spans = byMajor.map(s => s.costSpan)
      console.log(
        `  [${pack.name}] ${summary.steps} 格 / ${byMajor.length} 境 / ${byWorld.length} 界 · ` +
          `需求最陡 ${summary.biggestCostStep.label} ×${summary.biggestCostStep.costStep.toFixed(2)} · ` +
          `面板最陡 ${summary.biggestPowerStep.label} ×${summary.biggestPowerStep.powerStep.toFixed(2)} · ` +
          `每境跨度 ${Math.min(...spans).toFixed(1)}~${Math.max(...spans).toFixed(1)} 倍 · ` +
          `每界跨度 ${byWorld.map(s => x(s.costSpan)).join(' / ')}`
      )
      console.log(
        `        换界那几格:${summary.worldSteps.map(s => `${s.label} 需求 ×${s.costStep.toFixed(2)} / 面板 ×${s.powerStep.toFixed(2)}`).join(' · ') || '(没有换界)'}`
      )

      // 口径判据:段数 = 境界数 / 界域数;段内格数之和 = 总格数;面板单调不减
      expect(byMajor.length).toBe(game.realms.realms.length)
      expect(byWorld.length).toBe(game.realms.worlds.length)
      expect(byMajor.reduce((n, s) => n + s.cells, 0)).toBe(summary.steps)
      const powers = audit.steps.map(s => s.power)
      expect([...powers].sort((a, b) => a - b)).toEqual(powers)
      // "最陡的一格"不许落在换界落点上(那样每份表的结论都会是"换界最陡",段内谁陡就看不出来)
      expect(summary.biggestCostStep.isWorldEntry).toBe(false)
    }
  })

  it('碾压:第一次碾压出现在哪一格,以及阈值拧大拧小会怎样', () => {
    console.log('\n把区域表接成"内容强度"之后(玩家强度 = 属性系统的战力评分):')
    for (const pack of packs) {
      const byRatio = new Map([2, 3, 5].map(crushRatio => [crushRatio, audited(pack.config, crushRatio).audit]))
      const rows = [...byRatio.entries()].map(([crushRatio, audit]) => {
        const summary = audit.summary()
        const first = summary.firstCrush
        return {
          crushRatio,
          first: first ? `${first.label}(玩家/内容 ${first.ratio!.toFixed(1)})` : '一次都没有',
          crushed: summary.crushing
        }
      })
      console.log(
        `  [${pack.name}] ` +
          rows
            .map(r => `阈值 ${r.crushRatio}:首次 ${r.first} · 共 ${r.crushed} 格`)
            .join(' | ')
      )

      const strict = byRatio.get(2)!
      const mid = byRatio.get(3)!
      const loose = byRatio.get(5)!
      // 阈值越严(更容易判"碾"),被碾的格数只会更多 —— 这条口径错了,读出来的结论会反着走
      expect(strict.summary().crushing).toBeGreaterThanOrEqual(mid.summary().crushing)
      expect(loose.summary().crushing).toBeLessThanOrEqual(mid.summary().crushing)
      // "第一次碾压"要么没有,要么一定是那一档阈值下最早的一格
      const firstCrush = strict.summary().firstCrush
      if (firstCrush) {
        const idx = strict.steps.indexOf(firstCrush)
        expect(idx).toBeGreaterThanOrEqual(0)
        expect(strict.steps.slice(0, idx).every(s => s.verdict !== 'crush')).toBe(true)
        expect(strict.steps.filter(s => s.verdict === 'crush').length).toBe(strict.summary().crushing)
      }
    }
  })

  it('对照读数:把"后段更平"这一处改动量成倍数(调参第二步的读法)', () => {
    // 拿仙侠包做一次真实的口径改动:晚段倍率 1.7 → 1.2(只动一个数,别的都不动)
    const before = audited(XIUXIAN).audit
    const gentler = defineGame({
      ...XIUXIAN,
      realms: { ...XIUXIAN.realms, exp: { ...XIUXIAN.realms.exp, lateRealmGrowth: 1.2 } }
    })
    const after = createProgressionAudit({
      game: gentler,
      contentPower: dungeonContentPower({ dungeons: gentler.dungeons, attributes: gentler.attributes })
    })
    const diff = compareProgression(before, after)

    // 段内跨度看 costSpan;**跨进这一段那一步**看 entryCostStep —— 晚段倍率动的是后者
    const changed = diff.rows.filter(
      r => Math.abs(r.spanRatio - 1) > 1e-9 || Math.abs(r.afterEntryStep / r.beforeEntryStep - 1) > 1e-9
    )
    console.log(
      `\n晚段倍率 1.7 → 1.2:变的只有 ${changed.length} 段 —— ` +
        changed
          .map(r => `${r.name} 段内 ${x(r.beforeSpan)}(没动)· 进门 ×${r.beforeEntryStep.toFixed(2)} → ×${r.afterEntryStep.toFixed(2)}`)
          .join(' · ')
    )
    console.log(
      `  全程跨度 ${x(diff.totalSpan.before)} → ${x(diff.totalSpan.after)}(×${diff.totalSpan.ratio.toExponential(2)})· ` +
        `被碾格数 ${diff.crushing.before} → ${diff.crushing.after} · 段数对得上:${!diff.mismatched}`
    )

    // 判据:改的只是晚段那一档,所以"变了的段"必须少于总段数(不是整张表一起动);
    // 而且段数与对齐没变(同一张境界表)
    expect(changed.length).toBeGreaterThan(0)
    expect(changed.length).toBeLessThan(diff.rows.length)
    expect(diff.mismatched).toBe(false)
  })
})
