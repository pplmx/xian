/**
 * statNames —— 词条名 → 人话的单一事实源。
 *
 * modsText 是全库文案的独一份格式器:功法分支、药力、器魂、称号、天时都走它。
 * 这里守的是它「零值词条不显示」的共享行为 —— 低品器魂的模组可能带着 0 值键,
 * 若印出去就是「攻击 +0%」这种噪音;此前 SoulsView 为处理这件事自造过一份本地
 * 实现,与库分叉成两套口径,见 uiLayering「界面不重造 modsText」审计。
 */
import { describe, expect, it } from 'vitest'
import { modsText } from '@/ui/statNames'

describe('statNames · modsText 共享行为', () => {
  it('零值词条不显示 —— 0 值键不许印成「+0%」', () => {
    expect(modsText({ attackPct: 0.15, defensePct: 0 })).toBe('攻击 +15%')
    expect(modsText({ attackPct: 0 })).toBe('')
    expect(modsText({})).toBe('')
  })

  it('非零词条照常摊开、顺序即声明序', () => {
    expect(modsText({ attackPct: 0.5, defensePct: -0.2 })).toBe('攻击 +50% · 防御 -20%')
  })
})
