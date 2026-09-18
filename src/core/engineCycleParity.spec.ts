/**
 * 天时对账 —— "每日天时"交给库的周期层之后,与**迁移前冻结的旧实现**逐日相同。
 *
 * 与 engineParity 同一条纪律。下面 `refTodayWeather` 是从旧 `core/weather.ts`
 * 原样抄下来的那段(种子公式 + 两条抽取规则)。
 *
 * 为什么必须逐日比:天时是**玩家看得见**的东西("今天是仙劫日""还有多久换天时"),
 * 换实现若让某一天的天时变了,玩家会以为游戏在动平衡;而这一层的意义恰恰是
 * "同一个周期永远是同一个结果"。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '@/stores/game'
import { usePlayerStore } from '@/stores/player'
import { REALMS, worldOf } from '@/data/realms'
import { mulberry32, RandomService } from '@/utils/random'
import { WEATHERS, WORLD_WEATHERS, todayWeather, upcomingWeather, weatherRemainingSec, type WeatherDef } from './weather'

// —— 迁移前冻结的旧口径(原 core/weather.ts 的 todayWeather)——
function refTodayWeather(totalPlaySec: number, major: number): WeatherDef {
  const world = worldOf(major)
  if (world.id !== 'mortal') {
    const pool = WORLD_WEATHERS[world.id as Exclude<typeof world.id, 'mortal'>]
    const day = Math.floor(totalPlaySec / 86400)
    const rng = new RandomService(mulberry32(day * 2654435761 + world.start * 131 + 0x51ed))
    return pool[rng.int(0, pool.length - 1)]!
  }
  const day = Math.floor(totalPlaySec / 86400)
  const rng = mulberry32(day * 2654435761 + 0x9e3779b9)
  const roll = rng()
  if (roll < 0.3) return WEATHERS[4]!
  const idx = Math.floor(((roll - 0.3) / 0.7) * 4)
  return WEATHERS[Math.min(3, idx)]!
}

function setProgress(totalPlaySec: number, major: number): void {
  useGameStore().totalPlaySec = totalPlaySec
  usePlayerStore().major = major
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('天时对账 —— 逐日与迁移前相同', () => {
  it('人间界:60 天的天时逐日相同(同一天内任意时刻也相同)', () => {
    for (let day = 0; day < 60; day += 1) {
      setProgress(day * 86400 + 12_345, 0)
      const now = todayWeather()
      expect(now.id, `第 ${day} 天`).toBe(refTodayWeather(day * 86400 + 12_345, 0).id)
      setProgress(day * 86400 + 86_000, 0)
      expect(todayWeather().id, `第 ${day} 天(另一时刻)`).toBe(now.id)
    }
  })

  it('界外各处:各界的专属天象池逐日相同', () => {
    // 境界序号就是它在 REALMS 里的下标 —— 用"每个界域的第一个境界"做代表
    for (let major = 0; major < REALMS.length; major += 1) {
      const world = worldOf(major)
      if (world.id === 'mortal') continue
      for (let day = 0; day < 12; day += 1) {
        setProgress(day * 86400 + 5, major)
        expect(todayWeather().id, `${world.name} 第 ${day} 天`).toBe(refTodayWeather(day * 86400 + 5, major).id)
      }
    }
  })

  it('换界域会换池子(不是沿用上一个界域的天时)', () => {
    setProgress(86400 * 3, 0)
    const mortal = todayWeather().id
    setProgress(86400 * 3, REALMS.length - 1) // 混沌海
    expect(todayWeather().id).not.toBe(mortal)
  })

  it('库里多出来的两样:剩余时间与预告(旧实现没有)', () => {
    setProgress(86400 * 2 + 3600, 0)
    expect(weatherRemainingSec()).toBe(86400 - 3600)
    const ahead = upcomingWeather(3)
    expect(ahead.length).toBe(3)
    expect(ahead[0]!.id).toBe(todayWeather().id) // 预告的第一天就是今天
    expect(ahead[1]!.id).toBe(refTodayWeather(86400 * 3 + 3600, 0).id)
  })
})
