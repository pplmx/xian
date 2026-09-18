/**
 * 资源账本 —— 本作作为"万象引擎的第一个定制用户",把资源这一层交给库算。
 *
 * 库里没有"灵石""灵草"这些字(它只认结构),本文件就是那份定制:
 * 键名、展示名、上限、整数还是小数,全在这里定;仓库那边只调用这里的几个动作。
 *
 * 两条与既有口径绑在一起的约定:
 *   一 **灵石是大数**:走 GNum 适配器,一笔收入可以超过 double 的整数范围;
 *   二 **材料是整数、灵气可积余**:材料取整(「灵草 ×2.5」没人看得懂),
 *      灵气则允许超过标称容量 —— 标称容量只是"满"的界线,不是硬顶(见 QI_BANK_MULT)。
 */
import { createResourceSystem, type Ledger } from 'wanxiang-engine'
import type { GNum, SmallResourceId } from '@/types'
import { QI_BANK_MULT } from '@/data/constants'
import { gnumNumeric } from './engineNumeric'

/** 灵石单开一本账:它是本作唯一的"大数资源" */
export const STONE_LEDGER = createResourceSystem<GNum>(
  { resources: [{ key: 'stone', name: '灵石', floor: 0 }] },
  gnumNumeric
)

/** 材料与灵气:整数、不可为负;灵气的上限由调用方按标称容量给(见 clampQi) */
export const SMALL_LEDGER = createResourceSystem({
  resources: [
    { key: 'wudao', name: '悟道点', floor: 0, integer: true },
    { key: 'herb', name: '灵草', floor: 0, integer: true },
    { key: 'ore', name: '玄铁', floor: 0, integer: true },
    { key: 'page', name: '功法残页', floor: 0, integer: true },
    { key: 'dust', name: '器灵尘', floor: 0, integer: true },
    { key: 'qi', name: '灵气', floor: 0 }
  ]
})

const stoneBook = (stone: GNum): Ledger<GNum> => ({ stone })

/** 收灵石(不封顶) */
export function gainStone(stone: GNum, amount: GNum): GNum {
  return STONE_LEDGER.grant(stoneBook(stone), [{ key: 'stone', amount, source: '收入' }]).ledger.stone!
}

/** 付灵石:够就扣、不够原样返回(调用方据此给提示) */
export function payStone(stone: GNum, cost: GNum): { ok: boolean; stone: GNum } {
  const paid = STONE_LEDGER.pay(stoneBook(stone), [{ key: 'stone', amount: cost, source: '支出' }])
  return { ok: paid.ok, stone: paid.ledger.stone! }
}

export function hasStone(stone: GNum, cost: GNum): boolean {
  return STONE_LEDGER.canAfford(stoneBook(stone), [{ key: 'stone', amount: cost }])
}

/** 收材料 / 点数(落账时取整,不会为负) */
export function gainSmall(values: Partial<Record<SmallResourceId | 'qi', number>>, id: SmallResourceId, amount: number): number {
  const book: Ledger<number> = { ...values }
  return SMALL_LEDGER.grant(book, [{ key: id, amount, source: '收入' }]).ledger[id] ?? 0
}

/** 付材料 / 点数:够就扣、不够原样返回 */
export function paySmall(
  values: Partial<Record<SmallResourceId | 'qi', number>>,
  id: SmallResourceId,
  amount: number
): { ok: boolean; value: number } {
  const book: Ledger<number> = { ...values }
  const paid = SMALL_LEDGER.pay(book, [{ key: id, amount, source: '支出' }])
  return { ok: paid.ok, value: paid.ledger[id] ?? 0 }
}

export function hasSmall(values: Partial<Record<SmallResourceId | 'qi', number>>, id: SmallResourceId, amount: number): boolean {
  return SMALL_LEDGER.canAfford({ ...values }, [{ key: id, amount }])
}

/** 灵气:可积余到标称容量的 QI_BANK_MULT 倍(标称容量是"满"的界线,不是硬顶) */
export function clampQi(value: number, cap: number): number {
  const book: Ledger<number> = { qi: 0 }
  return SMALL_LEDGER.apply(book, [{ key: 'qi', amount: Math.min(cap * QI_BANK_MULT, value) }]).ledger.qi ?? 0
}
