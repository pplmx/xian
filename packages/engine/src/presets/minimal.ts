/**
 * 最小内容包 —— **只装两层**的那种作品长什么样。
 *
 * 前面三份内容包(仙侠 / 星港 / 日常学习)都把四层装满了。可库里真正想说的那句话是:
 * **没有战斗、没有装备的题材,就是这四层里的一两层** —— 这一份就是那句话的样子。
 * 它是一款「手作工坊」:只有等级与属性(手感 / 体力 / 名气),
 * `equipment` 与 `dungeons` 都明写 `null`(这个游戏没有那两层)。
 *
 *   game.realms      铺子里(学徒 → 上手)→ 同业(匠人 → 名师),每境三层手艺
 *   game.attributes  手感 / 体力 / 名气 —— 机制键仍是 attack / defense / maxHp,
 *                    换掉的只是展示名(于是"换皮不改机制"这句话在这份 60 行的文件里看得见)
 *   game.equipment   空系统(0 槽 0 件):这游戏没有装备
 *   game.dungeons    空系统(0 区域 0 敌人):也没有副本
 *
 * 用法:复制这份文件、把名字与数字改成你的题材,就是你的游戏的第 0 版 ——
 * 仍然能拿到等级表、面板结算、成长体检这些通用件,不必为了"没有战斗"去编一堆空内容。
 */
import type { GameConfig } from '../config.js'

export const MINIMAL: GameConfig = {
  name: '手作工坊(最小内容包)',
  version: '0.1.0',
  attributes: {
    defs: [
      { key: 'attack', name: '手感', kind: 'flat', category: '手艺' },
      { key: 'defense', name: '体力', kind: 'flat', category: '手艺' },
      { key: 'maxHp', name: '名气', kind: 'flat', category: '手艺' },
      { key: 'attackPct', name: '手感加成', kind: 'percent', appliesTo: 'attack', noDepth: true, category: '手艺' },
      { key: 'luck', name: '眼力', kind: 'rate', category: '机缘' }
    ]
  },
  realms: {
    worlds: [
      { id: 'shop', name: '铺子里', realms: ['学徒', '上手'] },
      { id: 'trade', name: '同业', realms: ['匠人', '名师'] }
    ],
    layerNames: ['粗活', '细活', '绝活'],
    labelFormat: '{realm}·{layer}',
    exp: { base: 20, layerGrowth: 1.6, realmGrowth: 2.2, worldStepMult: 1.8 },
    // 面板:这一层的手感 / 体力 / 名气(与等级表共用同一条"每层 ×1.35、每境 ×2.1")
    combat: { base: { attack: 8, defense: 4, maxHp: 60 }, layerGrowth: 1.35, realmGrowth: 2.1 },
    // 进阶要过手:引擎只回答"这里要不要试炼",掷骰与判定留给作品
    breakthrough: { layerBase: 0.92, layerDecay: 0.05, majorBase: 0.7, majorDecay: 0.06, min: 0.15, max: 0.97 }
    // 没给 lifespan:一间铺子没有"到点就死"这回事 —— 寿元返回 Infinity
  },
  // 这款游戏没有装备、也没有副本 —— 明写 null(省略会被装配时的校验拦下,见 defineGame 的报错)
  equipment: null,
  dungeons: null
}
