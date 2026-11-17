/**
 * 已达成命题的永久战斗词条。
 *
 * ## 为什么单独一个文件（第 525 轮）
 *
 * 它原本写在 `core/reincarnation.ts` 里 —— 而 `stores/player.ts` 要读它，
 * 于是 `player.ts` 与 `reincarnation.ts` 之间多出一个**静态导入环**，
 * 被 `importCycles.spec` 当场抓住。
 *
 * 环的成因是职责放错了地方:`reincarnation.ts` 是**转世流程**（掷天赋、
 * 结算宿慧、给下一世选题），而这一份是**已达成命题的读取**。
 * 两者不是一回事，故拆出来。
 *
 * ## 它补的是什么
 *
 * `contentGateAudit` 的诊断:四类合格深修回报里，丹方 / 功法 / 认知三项同属
 * 「知识」轴 —— 方向差异不足，需要**非知识类**的深修价值。
 * 命题是「这一世活到某个深度」的检验，而它此前只给宿慧（知识轴）。
 * `LifeThemeDef.mods` 补的就是另一半，这里把它取出来给 `finalStats`。
 *
 * ## 从哪取
 *
 * `player.reincarnation.lives` 里每一世的 `themeResult === "done"` 与 `themeId` ——
 * 与转世页「走到底过的题不再重复出现」那个 `done` 集合**同一个字段**，
 * 不另存一份「哪些命题达成过」。另存一份就是两本账。
 *
 * ## 只算一次
 *
 * 同一个命题只给一次（Set 去重）——「看过一回」不会因为看两回而更牢。
 */
import type { StatMods } from "@/types";
import { lifeThemeDef } from "@/data/lifeThemes";

/** 只取这里用得上的两个字段 —— 不把整个 LifeRecord 拖进来 */
export interface LifeThemePick {
  themeId?: string | null;
  themeResult?: string | null;
}

/**
 * 纯函数：**不读 store**。
 *
 * 第一版它自己 `usePlayerStore()` —— 而 `stores/player.ts` 又要调它，
 * 于是多出一个静态导入环，被 `importCycles.spec` 抓住。
 *
 * 环的解法不是加进 BASELINE，而是**把读的那一步挪到调用方**:
 * store 里本来就有那份数据，它知道自己该传什么。
 */
export function themeLegacyMods(lives: readonly LifeThemePick[]): StatMods {
  const seen = new Set<string>();
  for (const life of lives) {
    if (life.themeResult === "done" && life.themeId) seen.add(life.themeId);
  }
  const out: StatMods = {};
  for (const id of seen) {
    const def = lifeThemeDef(id);
    if (!def?.mods) continue;
    for (const [k, v] of Object.entries(def.mods)) {
      if (typeof v !== "number") continue;
      const key = k as keyof StatMods;
      out[key] = ((out[key] as number | undefined) ?? 0) + v;
    }
  }
  return out;
}
