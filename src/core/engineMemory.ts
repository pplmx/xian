/**
 * 世界记忆的档位 —— 本作对库那份"档位机"的定制。
 *
 * 库里给的是规则(多路门槛取先到、没资格停在最低档、不打交道就回落、
 * 钟的起点取最后一次打交道);下面这些是**本作的口径**:
 * 档位叫什么、门槛多少、多久算"很久没来"。改这些数不用碰库。
 */
import { createStageMemory } from 'wanxiang-engine'

/** 累计胜场进入稳定 / 繁盛 */
export const STABLE_WINS = 30
export const FLOURISH_WINS = 80
/** 守土时长进入稳定 / 繁盛(小时) */
export const STABLE_HOURS = 6
export const FLOURISH_HOURS = 24
/** 无活动多久(小时)后回落 */
export const DECAY_HOURS = 48
/** 镇压后无活动多久(小时),妖气复聚 */
export const REVIVE_AFTER_HOURS = 72

/**
 * 区域兴衰:混乱 → 稳定 → 繁盛。
 *
 * 两条路(胜场 / 守着多久)都写进门槛里 —— 镇压之后该地不再产胜场,
 * 只认计数的话"守得住"永远算不出回报。
 */
export const REGION_MEMORY = createStageMemory({
  stages: [
    { id: 'chaos', name: '混乱' },
    { id: 'stable', name: '稳定', at: { count: STABLE_WINS, hours: STABLE_HOURS }, mult: 1.05 },
    { id: 'flourish', name: '繁盛', at: { count: FLOURISH_WINS, hours: FLOURISH_HOURS }, mult: 1.1 }
  ],
  decayAfterHours: DECAY_HOURS
})
