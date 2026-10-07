/**
 * 宿命传承的**效果落地**(ISS-302 的后半)。
 *
 * 与 `core/heritageForge`(锻造生命周期)分开:那边回答「这一世锻得哪一个」,
 * 这边回答「**已锻得的传承到底改变什么**」—— 此前这一半是空的:传承只被
 * `player.addHeritage` 记下,效果一个都没接(玩家看到的是一张空头支票)。
 *
 * 全部写成**纯函数**:拿「已持有的传承 id」算开关/加成,不读 store、不读时间。
 * 于是既好测(Pinia 都不用起),也逼着每个效果只能依赖「我是谁」这一件输入。
 *
 * 红线(见 data/heritage):效果必须是**有界、平直的能力位**,不得折算成
 * 攻防 / 修速 / 战力倍率。
 */
import type { HeritageId } from "@/data/heritage";

/**
 * 转世出生时的**起始境界下限**(major)。元婴凝实 → 筑基(1);否则炼气(0)。
 *
 * 出生那一下就在 `player.rebirth` 里把 major 抬到这条下限 —— 玩家睁眼即筑基。
 */
export function birthMajorFloor(owned: readonly HeritageId[]): number {
  return owned.includes("yuanying") ? 1 : 0;
}

/**
 * **额外法宝位**。化神百炼 → +1(平直能力位,不与境界的 1/2 位规则相乘)。
 * 基础位规则仍归 `data/artifacts.artifactSlotsFor`。
 */
export function artifactSlotBonus(owned: readonly HeritageId[]): number {
  return owned.includes("baihuang") ? 1 : 0;
}
