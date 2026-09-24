/**
 * 灵兽品质 ↔ 效果匹配 —— 「名头配得上数值」这件事,数据可证,不靠品味。
 *
 * 与法宝品阶阶梯同款规矩(见 loot.spec 的「至宝榜必为神品」):用户问
 * 「灵兽品质与效果是否匹配上」,这里落成两条机械不变量,改数据即红:
 *
 *   1. 总预算不回落:任意两宠,品阶高者的词条预算(= Σ|mods|)≥ 品阶低者。
 *      抓的是「神品比仙品弱一截」这类名头与数值解耦 —— 混沌饕餮曾以总预算 0.24
 *      输给应龙 0.40(比同品鲲鹏 0.45 少近一半),重配后 0.42。
 *   2. 同键跨品不回落:同一词条键,品阶高者数值 ≥ 品阶低者同键数值。
 *      抓的是单轴倒挂 —— 螭龙幼子(天)修速 0.06 输给摇光鹿(玄)0.08;
 *      御雷猴(玄)攻击 0.06 输给赤火雀(精)0.08。
 *
 * 尺子只压「高品不弱于低品」这一个方向。同品内部专精不同(金蟾聚财、摇光鹿
 * 修速),总预算允许拉开 —— 那是取舍,不是失配。
 */
import { describe, expect, it } from 'vitest'
import { PETS } from '@/data/pets'
import { qualityDef } from '@/data/qualities'
import type { AnyStatKey, PetDef } from '@/types'

/** 粗略会计:Σ|词条数值|。不引 ruleBudget —— 那把尺子的 KEY_REFS 只覆盖战斗词条 */
const petBudget = (p: PetDef): number =>
  Object.values(p.mods).reduce((s, v) => s + Math.abs(v ?? 0), 0)

describe('灵兽品质 ↔ 效果匹配(预算)', () => {
  it('每只灵兽都有词条效果,不是纯观赏位', () => {
    for (const p of PETS) {
      expect(Object.keys(p.mods).length, `${p.name} 无效果词条`).toBeGreaterThan(0)
    }
  })

  it('总预算随品阶不回落:高品阶单只 ≥ 任意低品阶单只', () => {
    for (const hi of PETS) {
      for (const lo of PETS) {
        const hr = qualityDef(hi.quality).rank
        const lr = qualityDef(lo.quality).rank
        if (hr <= lr) continue
        expect(petBudget(hi), `${hi.name}(${hi.quality},预算 ${petBudget(hi)}) < ${lo.name}(${lo.quality},预算 ${petBudget(lo)})`).toBeGreaterThanOrEqual(
          petBudget(lo) - 1e-9
        )
      }
    }
  })

  it('同一词条键跨品阶不回落:高品阶数值 ≥ 低品阶同键数值', () => {
    for (const hi of PETS) {
      for (const lo of PETS) {
        const hr = qualityDef(hi.quality).rank
        const lr = qualityDef(lo.quality).rank
        if (hr <= lr) continue
        const shared = Object.keys(lo.mods).filter(k => hi.mods[k as AnyStatKey] !== undefined)
        for (const k of shared) {
          const key = k as AnyStatKey
          expect(hi.mods[key]!, `${hi.name}(${hi.quality}) 的 ${k} ${hi.mods[key]} < ${lo.name}(${lo.quality}) 的 ${lo.mods[key]}`).toBeGreaterThanOrEqual(
            lo.mods[key]! - 1e-9
          )
        }
      }
    }
  })
})
