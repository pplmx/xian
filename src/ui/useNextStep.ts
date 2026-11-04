/**
 * 卷首眉批那一句话 —— 把世界状态映射成 `nextStep` 的输入。
 *
 * ## 为什么单独成文件
 *
 * 规则(`ui/nextStep`)是纯函数,不碰 store;而「这些字段从哪几个 store 取」
 * 是本作自己的事,与规则无关。两者分开,规则才能直接测
 * (见 nextStep.spec 的「不 import 任何 store」)。
 *
 * ## 为什么在卷首统一推一次
 *
 * 若让每一页自己算,十五个页面就是十五份取数逻辑 —— 总有一页会忘了某个字段,
 * 于是同一份存档在不同页给出不同建议。卷首是**所有页共用的那一层**,
 * 在这里算一次,全站就只有一处。
 *
 * ## 取不到的字段宁可留 false
 *
 * 「有没有未领的赏」「行囊里有没有更合手的一件」在当下的 store 表面上没有
 * 干净的来源。硬凑一份近似值会与那些页面自己的判定分岔 —— 而分叉比缺失更坏:
 * 缺失只是少说一句,分叉是两处互相矛盾。故这几项先按 false 传,
 * 规则层对 false 的处理就是「不提这一条」。
 */
import { computed } from "vue";
import { usePlayerStore } from "@/stores/player";
import { useAdventureStore } from "@/stores/adventure";
import { useDongfuStore } from "@/stores/dongfu";
import { buildingDef, BUILDINGS } from "@/data/buildings";
import { buildingUpgradeInfo } from "@/core/buildingService";
import { breakthroughInfo } from "@/core/breakthrough";
import {
  nextStepForPage,
  nextStepOf,
  type NextStep,
  type NextStepInput,
  type NextStepRoute,
} from "./nextStep";

/** 路由名 → 建议里的去处名。认不得的路由返回 null(那就不说) */
export function nextStepPageOf(routeName: unknown): NextStepRoute | null {
  switch (routeName) {
    case "cultivation":
      return "cultivation";
    case "adventure":
      return "adventure";
    case "dongfu":
      return "dongfu";
    case "inventory":
      return "inventory";
    case "titles":
      return "titles";
    case "legacy":
      return "legacy";
    case "collection":
      return "collection";
    case "souls":
      return "souls";
    default:
      return null;
  }
}

/**
 * 洞府里有没有买得起的一笔。
 *
 * 只看**已建成**的建筑:没建的那些是「可以开工」,不是「可以收账」——
 * 后者是稳赚的,前者要花钱,两者紧迫度不同,这里只认后者。
 */
export function anyDongfuUpgradeAffordable(): boolean {
  const dongfu = useDongfuStore();
  for (const def of BUILDINGS) {
    const id = def.id;
    if ((dongfu.levels[id] ?? 0) <= 0) continue;
    if (!buildingDef(id)) continue;
    if (buildingUpgradeInfo(id).canUpgrade) return true;
  }
  return false;
}

/** 此刻的世界状态 → 规则要的那份离散输入 */
export function currentNextStepInput(): NextStepInput {
  const player = usePlayerStore();
  const adventure = useAdventureStore();
  const bt = breakthroughInfo();

  return {
    major: player.major,
    expFull: player.expFull,
    breakthroughReady: bt.ready,
    breakthroughReason: bt.reason ?? "",
    exploring: !!adventure.session,
    pendingEvent: !!adventure.pendingEventId,
    dongfuAffordable: anyDongfuUpgradeAffordable(),
    // 见文件头:这几项暂时没有干净来源,按 false 传 —— 缺一句好过说岔一句
    betterEquipAvailable: false,
    artifactSeatOpen: false,
    rewardReady: false,
    endgameReached: false,
  };
}

/** 卷首那一句。返回 computed,模板里读 `.value` 才会跟着状态走 */
export function useNextStep(routeName: () => unknown) {
  return computed<NextStep | null>(() => {
    const here = nextStepPageOf(routeName());
    if (!here) return null;
    // 指向本页的建议是废话(玩家已经站在那儿了)—— 那条判定收在 nextStep 里
    return nextStepForPage(nextStepOf(currentNextStepInput()), here);
  });
}
