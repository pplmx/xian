/**
 * 品质读数 · store 接线 —— 把「持有过的最高一档」交给界面。
 *
 * ## 为什么单独一个文件,而不是塞进 core/qualityPeak
 *
 * 本仓的分层是 core 只放纯逻辑、store 管状态、view 只做薄接线
 * (见 core/layeringAudit.spec 的名单制判据)。品质的**折算法**是纯的,
 * 落在 `core/qualityPeak`;而「去哪个 store 取什么」是**编排**,属于这一层。
 *
 * ## 为什么不是现算背包
 *
 * 曾经就是现算的:`inventory.items.reduce(...)`。于是分解掉那一件,进度条立刻倒退,
 * 而成就一旦解锁不掉回 —— 同一屏出现「✓ 已达成」与「0% 尚未达成」并存。
 *
 * 现在读的是 `quests.peakQualityRank`:拾得时由 `noteQualityPeak` 抬升,
 * 分解、转世、清空背包都不让它回落。与 `player.reincarnation.peakMajor`
 * (历世最远那一境)同一条规矩。
 *
 * ## 只算**装备** —— 条件原文就是「获得一件神品装备」
 *
 * 品质不是装备独有(法宝 45 件、灵兽 40 只、功法 66 部各有品阶),
 * 有一版把四类一起算了。但 `a_q8` 的条件原文是「获得一件**神品装备**」,
 * 把法宝/灵兽/功法也算进来,成就就比它自己说的更宽松 ——
 * 玩家拿一只神品灵兽就点亮了「神物自晦」,而它写的是装备。
 *
 * 故这一处**只读装备**。要扩到四类的话,该改的是成就条件原文与被它读的那份口径,
 * 不是悄悄把读数放大。
 *
 * ## 视图只调这一个函数
 *
 * 藏珍与名号两页都要这个读数。两处各写一遍 `reduce` 就是同一件事的第二个副本 ——
 * 改一次要改两处,漏一处就分叉,而本轮修的正是这种分叉。
 */
import { qualityDef } from "@/data/qualities";
import { mergeQualityPeak, highestOf } from "@/core/qualityPeak";
import { useInventoryStore } from "@/stores/inventory";
import { useQuestsStore } from "@/stores/quests";

/** 认不得的内嵌 id(旧档里已下架的内容)按凡品算,不让一个坏键把读数打成 NaN */
function rankOf(quality: string | undefined): number {
  return quality ? qualityDef(quality as never).rank : 0;
}

/** 此刻**装备**里最高的那一档 —— 只用于「抬升」,不作为读数直接给界面 */
export function currentQualityRank(): number {
  const inventory = useInventoryStore();
  return highestOf(inventory.items.map((item) => rankOf(item.quality)));
}

/**
 * 界面读的读数 —— **只增不减**。
 *
 * 落盘的峰值与此刻现量取大:旧档第一次读时峰值还是 0,按现量回填;
 * 之后分解掉那一件,峰值仍记得「曾得过」。
 */
export function peakQualityFromStores(): number {
  const quests = useQuestsStore();
  return mergeQualityPeak(quests.peakQualityRank, currentQualityRank());
}
