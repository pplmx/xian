/**
 * 建筑卡面数字单源 —— mods 与 effectText 不许各写一份
 *
 * 起因:同一文件的相邻两行,一边写「修炼速度 卡面 +4%」,一边写
 * `cultivationSpeed: lv * 0.04`。数字差一倍、一方改一方忘 —— 卡面撒谎
 * 而没有任何门会红。灵脉轮(veinText)把同样的问题收掉后,建筑轮照旧。
 *
 * 判据两条:
 *   ① 源审计:数据表里不许再手写 `+${lv * 数字}%` 这种百分比字面量
 *     (它必然与 mods 里的 /100 版本相邻双写);
 *   ② 行为一致:卡面每一行出现的百分数,与该建筑 mods(lv) 的对应词条逐位相等
 *     (formatSignedPercent 同口径),挡「改表不改卡」的一半。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { BUILDINGS } from '@/data/buildings'
import { STAT_NAMES } from '@/ui/statNames'
import { formatSignedPercent } from '@/utils/format'
import type { AnyStatKey } from '@/types'

describe('建筑卡面 · mods 与 effectText 数字单源', () => {
  it('数据表不许再手写 +${lv * N}% 这类百分比字面量(现改读 mods)', () => {
    const src = readFileSync(resolve(__dirname, '../data/buildings.ts'), 'utf8')
    // 百分比字面量「+${lv * 4}%」这类,在单源之后就该绝迹
    expect(src, '卡面百分比不能再用 lv 手乘,应读 mods/常量').not.toMatch(/\$\{[^}]*lv \* 1?0?\.?\d+[^}]*\} *%/)
  })

  it('卡面每一行的百分数 = mods(lv) 的对应词条(逐级抽查)', () => {
    for (const b of BUILDINGS) {
      if (!b.mods) continue
      for (const lv of [1, 2, 5, Math.max(1, Math.floor(b.maxLevel / 2))]) {
        const mods = b.mods(lv)
        const text = b.effectText(lv).join('\n')
        for (const [key, raw] of Object.entries(mods)) {
          if (!raw) continue
          const label = STAT_NAMES[key as AnyStatKey]
          if (!label) continue
          const pct = formatSignedPercent(raw as number)
          expect(
            text,
            `${b.name} Lv${lv}:「${label}」卡面应显示 ${pct}(与 mods 一致),实际没有这行`
          ).toContain(pct)
          expect(text, `${b.name} Lv${lv}:「${label}」该读出词条名`).toContain(label)
        }
      }
    }
  })
})
