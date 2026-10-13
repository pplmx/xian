/**
 * 灵脉服务 —— Phase 30.3
 * 投点规则:总容量 100;主脉独占 70;副脉各 ≤30。
 * 主脉可迁移(付费换向),已投点数不回收——方向选择有代价但不锁死。
 *
 * 规则本身已搬进公共库(`core/engineVeins` 是接入层):这里只留"要花多少灵石、
 * 钱够不够、要不要提示"。判定顺序与文案(含"未开放时不吭声")都在接入层里。
 */
import type { GNum } from "@/types";
import type { VeinId } from "@/data/veins";
import { veinDef } from "@/data/veins";
import { VEIN_UNLOCK_MAJOR } from "@/data/constants";
import {
  investVeinIn,
  switchVeinMainIn,
  veinCapOf,
  veinPointCostAt,
  veinStateOf,
  veinSwitchCostAt,
} from "./engineVeins";
import { playerTier } from "./progress";
import { add, gnZero } from "@/utils/gnum";
import { formatGN } from "@/utils/format";
import { usePlayerStore } from "@/stores/player";
import { useDongfuStore } from "@/stores/dongfu";
import { useResourcesStore } from "@/stores/resources";
import { notify } from "./notify";

/** 灵脉是否开放(金丹起) */
export function veinsUnlocked(): boolean {
  return usePlayerStore().major >= VEIN_UNLOCK_MAJOR;
}

/** 某条脉当前可投上限 */
export function veinCap(id: VeinId): number {
  const dongfu = useDongfuStore();
  return veinCapOf(veinStateOf(dongfu.veinPoints, dongfu.veinMain), id);
}

/** 单点投资成本(按玩家当前层级) */
export function veinPointCost(): GNum {
  return veinPointCostAt(playerTier());
}

/** 主脉迁移费 */
export function veinSwitchCost(): GNum {
  return veinSwitchCostAt(playerTier());
}

/**
 * 向某条脉投一点。
 * 未定主脉时,首次投点的脉自动成为主脉。
 */
export function investVein(id: VeinId): boolean {
  const dongfu = useDongfuStore();
  const resources = useResourcesStore();
  const info = investVeinIn(veinStateOf(dongfu.veinPoints, dongfu.veinMain), id, {
    major: usePlayerStore().major,
    tier: playerTier(),
  });
  if (!info.can) {
    // 空字符串 = 这个门槛不该打扰玩家(未开放就是这样)
    if (info.reason !== "") notify(info.reason, "warn");
    return false;
  }
  const cost = info.costs[0]!.amount;
  if (!resources.hasStone(cost)) {
    notify("灵石不足", "warn");
    return false;
  }
  resources.spendStone(cost);
  // 整份写回:点数 + 主脉(首投自动认主由库决定,投成功才认)
  dongfu.setVeinState(info.state);
  return true;
}

export interface VeinInvestBatchResult {
  count: number;
  stone: GNum;
  /** 为什么停:quota 投满 N 点 / cap 触及规则上限 / broke 灵石见底 */
  stopped: "quota" | "cap" | "broke";
}

/**
 * 连投:一条脉一次投多点(主脉 70 点,一次一点要点 70 下)。逐点复用 investVeinIn
 * 的判定与记账 —— 与单点同一条账;合一条总账,不逐点弹提示。
 */
export function investVeinBatch(id: VeinId, maxPoints: number): VeinInvestBatchResult {
  const dongfu = useDongfuStore();
  const resources = useResourcesStore();
  const tier = playerTier();
  let count = 0;
  let stone = gnZero();
  let stopped: VeinInvestBatchResult["stopped"] = "quota";
  for (let i = 0; i < Math.max(1, maxPoints); i += 1) {
    const info = investVeinIn(veinStateOf(dongfu.veinPoints, dongfu.veinMain), id, {
      major: usePlayerStore().major,
      tier,
    });
    if (!info.can) {
      // 触及规则上限(满 / 总量满 / 未开放……)—— 与单点同口径,不惊扰
      stopped = "cap";
      break;
    }
    const cost = info.costs[0]!.amount;
    if (!resources.hasStone(cost)) {
      stopped = "broke";
      break;
    }
    resources.spendStone(cost);
    dongfu.setVeinState(info.state);
    count += 1;
    stone = add(stone, cost);
  }
  if (count > 0) {
    notify(`「${veinDef(id).name}」连投 ${count} 点,耗 ${formatGN(stone)} 灵石`, "success");
  } else if (stopped === "broke") {
    notify("灵石不足,连投戛然而止", "warn");
  }
  return { count, stone, stopped };
}

/** 迁移主脉:付费换向;原主脉点数保留(超出副脉上限的部分不再可投,但效果不失) */
export function switchMainVein(id: VeinId): boolean {
  const dongfu = useDongfuStore();
  const resources = useResourcesStore();
  const info = switchVeinMainIn(veinStateOf(dongfu.veinPoints, dongfu.veinMain), id, {
    major: usePlayerStore().major,
    tier: playerTier(),
  });
  // 未开放 / 已经在主位:静默(迁移前也是不提示)
  if (!info.can) return false;
  const cost = info.costs[0]!.amount;
  if (!resources.hasStone(cost)) {
    notify("灵石不足,迁脉非小事", "warn");
    return false;
  }
  resources.spendStone(cost);
  dongfu.setVeinState(info.state);
  notify(`主脉改走「${veinDef(id).name}」`, "success");
  return true;
}
