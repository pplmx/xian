/**
 * 面壁破执 —— 心魔自己的那条路
 *
 * ## 为什么心魔不该和伤势共用一条化解路径
 *
 * `心魔缠身`（`curse_xinmo`）在 `injury` 分类下，与重伤共用 `repairWithQi`。
 * 那条路的提示语是「伤势与心魔尽复」—— 而**伤势是皮囊上的，心魔是道心上的**:
 * 引灵气能把伤口养好，不能把执念养没。
 *
 * 心魔不是渡劫失败给的（那条给 `injury`），它来自**事件**:
 *
 * ```text
 *   data/events.ts   水里那个对你笑 / 棋局心神难拔 / 塔中阴气缠身
 *   data/chains.ts   荒坟前灯灭
 * ```
 *
 * 也就是说:撞见一件邪事、染上心魔，然后付灵气就没了 —— 在玩法上等价于"掉了点血"。
 * 而「心魔」在修仙里是修行的一部分:破执之后道心更坚。那一半此前不存在。
 *
 * ## 两条路的分工
 *
 * ```text
 *   静养（qiRepair）  灵气 35% 容量        心魔没了          快，道心不长
 *   面壁（本文件）    灵气 55% 容量        心魔没了 + 道心通明   贵，但破执有得
 * ```
 *
 * 面壁必须**更贵**:若与静养同价，玩家永远选面壁（它多给一个增益），
 * 那条路就不再是取舍。
 *
 * ## 报酬是复用的，不是新造的
 *
 * `enlighten_cult_strong`（道心通明，修速 +35%、300 秒）本来就是顿悟的选项之一。
 * 给它另立一个新 id，玩家就会在两个名字下看到同一件事 —— 那正是本仓反复修的分叉。
 *
 * ## 既有的契约不动
 *
 * `repairWithQi` 仍然同时清伤势与心魔（`engineBuffsParity.spec` 钉着这一条）。
 * 面壁是**多出来的一条路**，不是替换 —— 玩家赶时间时仍然可以静养了事。
 */
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { useCultivationStore } from "@/stores/cultivation";
import { notify } from "./notify";
import { buffDef } from "@/data/buffs";
import { qiRepairCost } from "./qiRepair";

/** 面壁相对静养的倍数 —— 贵出来的那一份是"道心通明"的价钱 */
export const FACE_WALL_QI_MULT = 1.6;

/**
 * 破执之后得的那一段增益 —— **两档，按执念深浅**。
 *
 * ```text
 *   执念浅（剩余还多）  道心通明  300s × +35%
 *   执念深（快散了）    静心凝神  600s × +20%
 * ```
 *
 * 两档都是 `data/buffs` 里现成的（顿悟的选项），语义分得开（澄澈 / 沉静）。
 * 再造一档就是三个名字说同一件事 —— 那正是本仓反复修的那种分叉。
 *
 * ## 为什么要分早晚（第 374 轮量出来的）
 *
 * 第 373 轮只有强档一档，于是量出来「面壁在任何剩余时长下都是正收益」:
 *
 * ```text
 *   剩 600s  +285    剩 400s  +225    剩 200s  +165    剩 60s  +123
 * ```
 *
 * 每一档都划算 —— 那个按钮没有判断，只有"看到就点"。分成两档之后，
 * 早破得强、晚破得缓，玩家才有"什么时候面壁"这件事要想。
 */
export const FACEWALL_REWARD_BUFF = "enlighten_cult_strong";

/** 执念深了之后得的那一档（比强档长、但缓） */
export const FACEWALL_REWARD_BUFF_LATE = "enlighten_cult";

/**
 * 「执念尚浅」的剩余比例阈值 —— 剩余超过这个比例算浅。
 *
 * 取 0.5:心魔总时长 600s，故剩 300s 以上得强档、以下得缓档。
 * 太靠边（0.2 或 0.8）会让其中一档几乎不出现，那条路又变回单一选项。
 */
export const FACE_WALL_SHALLOW_RATIO = 0.5;

/**
 * 这一次面壁该给哪一档 —— 纯函数，坏输入一律按"执念已深"处理。
 *
 * 坏输入（NaN、剩余比总量还多）现实里不该出现（剩余取自 buff 的 endsAt），
 * 但读数函数若算出 NaN，界面会印出「NaN%」；给缓档是保守方向。
 */
export function faceWallRewardFor(input: { remainSec: number; totalSec: number }): string {
  const total = input.totalSec;
  const remain = input.remainSec;
  if (!Number.isFinite(remain) || !Number.isFinite(total) || total <= 0) {
    return FACEWALL_REWARD_BUFF_LATE;
  }
  return remain / total >= FACE_WALL_SHALLOW_RATIO
    ? FACEWALL_REWARD_BUFF
    : FACEWALL_REWARD_BUFF_LATE;
}

/** 心魔的 buff id（与 `data/buffs` 一致；面壁只认这一个） */
const HEART_DEMON_ID = "curse_xinmo";

/** 一次面壁的代价（按静养的同一套口径放大，不另起一套算式） */
export function faceWallCost(): number {
  return Math.ceil(qiRepairCost() * FACE_WALL_QI_MULT);
}

export interface FaceWallView {
  /** 身上有没有心魔 —— 没有就没什么可破的 */
  hasHeartDemon: boolean;
  canFace: boolean;
  cost: number;
  /** 还差多少灵气（付得起时为 0） */
  shortfall: number;
  /** 不能面壁时的原因；能面壁时为 null */
  reason: string | null;
}

/**
 * 界面读数 —— 能不能点、要多少、差多少。
 *
 * **纯函数**:代价由调用方传入，不在这里读 store。
 * 第一版在这里直接调 `faceWallCost()`（内部读 `player.qiCapValue`），
 * 于是判据一 import 它就炸在 `getActivePinia()` —— 那不只是测试不便，
 * 它说明这个"读数"其实偷偷依赖了全局状态。
 */
export function faceWallView(input: {
  hasHeartDemon: boolean;
  qi: number;
  cost: number;
}): FaceWallView {
  const cost = input.cost;
  if (!input.hasHeartDemon) {
    return {
      hasHeartDemon: false,
      canFace: false,
      cost,
      shortfall: 0,
      reason: "心无执念，无须面壁",
    };
  }
  if (input.qi < cost) {
    return {
      hasHeartDemon: true,
      canFace: false,
      cost,
      shortfall: Math.ceil(cost - input.qi),
      reason: `灵气不足，尚差 ${Math.ceil(cost - input.qi)} 缕`,
    };
  }
  return { hasHeartDemon: true, canFace: true, cost, shortfall: 0, reason: null };
}

/** 玩家身上有心魔吗 */
export function hasHeartDemon(): boolean {
  return useCultivationStore().buffs.some((b) => b.defId === HEART_DEMON_ID);
}

/**
 * 身上那道心魔还剩多久 / 总共多久（毫秒）。
 *
 * 没有心魔时返回 null —— 调用方据此决定"那一行出不出现"，
 * 而不是拿 0 去算比例（0/600 会被判成"执念已深"，那是在编一个不存在的状态）。
 */
export function heartDemonSpan(): { remainSec: number; totalSec: number } | null {
  const buff = useCultivationStore().buffs.find((b) => b.defId === HEART_DEMON_ID);
  if (!buff) return null;
  const totalSec = buffDef(HEART_DEMON_ID)?.durationSec ?? 0;
  const remainSec = Math.max(0, (buff.endsAt - Date.now()) / 1000);
  return { remainSec, totalSec };
}

/**
 * 面壁破执 —— 付灵气、清心魔、得一段道心通明。
 *
 * 返回是否真的做了（判据与界面都读它，不必再去问模块态）。
 * 只清**心魔**，不动伤势:面壁破的是执，不是外伤。
 */
export function faceWallWithQi(): boolean {
  const cultivation = useCultivationStore();
  const resources = useResourcesStore();
  const player = usePlayerStore();

  const view = faceWallView({
    hasHeartDemon: hasHeartDemon(),
    qi: resources.qi,
    cost: faceWallCost(),
  });
  if (!view.canFace) {
    notify(view.reason ?? "此时无法面壁", "warn");
    return false;
  }

  resources.setQi(resources.qi - view.cost, player.qiCapValue);
  /*
   * 破得早、所得纯 —— 报酬按**破执那一刻**心魔还剩多少决定。
   * 时点必须在 clearBuff **之前**取:清掉之后就问不到剩余了。
   */
  const span = heartDemonSpan();
  const reward = span ? faceWallRewardFor(span) : FACEWALL_REWARD_BUFF_LATE;

  cultivation.clearBuff(HEART_DEMON_ID);
  cultivation.addBuff(reward, Date.now());
  const rewardName = buffDef(reward)?.name ?? "道心澄澈";
  notify(`你面壁三日，执念渐消（耗灵气 ${view.cost}）—— ${rewardName}`, "success");
  return true;
}
