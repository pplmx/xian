/**
 * 收徒 store —— 已收弟子与他们的游历任务(持久化,须带 sanitize)。
 *
 * 任务按墙钟走(不存跑腿时钟,完工只看 finishAt 是否已过),离线归来、或打开界面
 * 一拍 collectFinished 即收割。产出由 core/apprenticeService 纯算,这里只管入账。
 */
import { defineStore } from "pinia";
import { saveReader } from "@/core/singleWriter";
import { ref } from "vue";
import { persistConfig } from "@/utils/storage";
import { rng } from "@/utils/random";
import { useResourcesStore } from "@/stores/resources";
import { usePlayerStore } from "@/stores/player";
import { herbGradeOfMajor } from "@/data/herbGrades";
import { acquirePill } from "@/core/progress";
import {
  APPRENTICE_MAX_LEVEL,
  APPRENTICES,
  BOND_TRUECODE_MIN,
  STARTER_APPRENTICE,
  apprenticeDef,
  apprenticeSlots,
  type ApprenticeSpec,
} from "@/data/apprentices";
import {
  apprenticeRecruitCost,
  apprenticeSpoils,
  apprenticeTaskSeconds,
  taskDone,
  dispatchAllToNeed as planDispatchAll,
  type DispatchNeedStock,
  type OwnedApprentice,
  type TaskSpoils,
} from "@/core/apprenticeService";
import { asArray, asNonNegInt } from "@/utils/saveShape";

/** 一趟归来的尾账:带弟子名,界面据此通报「XX 归来,带回…」 */
export interface ApprenticeReap {
  name: string;
  spec: ApprenticeSpec;
  spoils: TaskSpoils;
}

let seq = 0;
function nextUid(): string {
  seq += 1;
  return `apt_${Date.now().toString(36)}_${seq.toString(36)}`;
}

function isSpec(v: unknown): v is ApprenticeSpec {
  return v === "herb" || v === "ore" || v === "adventure" || v === "seek" || v === "study";
}

function clampLevel(v: unknown): number {
  // 非负整数 → 至少 1 → 封顶(与 asNonNegInt 同面,收徒等级别另写一份取整)
  return Math.min(APPRENTICE_MAX_LEVEL, Math.max(1, asNonNegInt(v, 1)));
}

function clampBond(v: unknown): number {
  return Math.max(0, asNonNegInt(v, 0));
}

/** 跨世之缘只对「真传(最高羁绊位阶)」开放,封顶到其阈值不越界 */
function clampKarma(v: unknown): number {
  return Math.min(BOND_TRUECODE_MIN, Math.max(0, asNonNegInt(v, 0)));
}

/** 把一趟产出入账到资源/背包 */
function applySpoils(spoils: TaskSpoils, originMajor?: number): void {
  const resources = useResourcesStore();
  // 灵草按**出发境界**定品(与 offline 的「按产地定品」同口径):addSmall 会落到当前
  // 境界那档,离线升境再归来时,弟子带回的旧界草会堆进新界档,与原产地账脱节
  if (spoils.herb)
    resources.grantHerbs(
      spoils.herb,
      originMajor != null ? herbGradeOfMajor(originMajor) : undefined,
    );
  if (spoils.ore) resources.addSmall("ore", spoils.ore);
  if (spoils.dust) resources.addSmall("dust", spoils.dust);
  if (spoils.wudao) resources.addSmall("wudao", spoils.wudao);
  if (spoils.stone) resources.addStone(spoils.stone);
  if (spoils.pillId && spoils.pillCount) acquirePill(spoils.pillId, spoils.pillCount);
}

export const useApprenticeStore = defineStore(
  "apprentice",
  () => {
    const apprentices = ref<OwnedApprentice[]>([]);
    /** 跨世之缘:真传弟子转世后凝成的一丝缘(一次性,新世 starter 携带后清零) */
    const rebirthKarma = ref(0);

    /** 存档修复:弟子逐位修形,坏位整位丢弃;任务形状不对就当作闲置 */
    function sanitize(): void {
      rebirthKarma.value = clampKarma(rebirthKarma.value);
      const clean: OwnedApprentice[] = [];
      for (const raw of asArray<unknown>(apprentices.value)) {
        if (!raw || typeof raw !== "object" || !("archId" in raw)) continue;
        const archId = raw.archId;
        if (typeof archId !== "string" || !apprenticeDef(archId)) continue;
        const uid = "uid" in raw && typeof raw.uid === "string" && raw.uid ? raw.uid : nextUid();
        const level = clampLevel("level" in raw ? raw.level : 1);
        const bond = clampBond("bond" in raw ? raw.bond : 0);
        let task: OwnedApprentice["task"] = null;
        if ("task" in raw && raw.task && typeof raw.task === "object") {
          const t = raw.task as {
            spec?: unknown;
            startAt?: unknown;
            finishAt?: unknown;
            rewardMajor?: unknown;
          };
          if (isSpec(t.spec) && Number.isFinite(t.startAt) && Number.isFinite(t.finishAt)) {
            const rm = "rewardMajor" in t ? t.rewardMajor : undefined;
            task = {
              spec: t.spec,
              startAt: Math.max(0, Math.floor(t.startAt as number)),
              finishAt: Math.max(0, Math.floor(t.finishAt as number)),
              rewardMajor: typeof rm === "number" && Number.isFinite(rm) ? rm : undefined,
            };
          }
        }
        clean.push({ uid, archId, level, bond, task });
      }
      apprentices.value = clean;
    }

    /**
     * 无弟子则白送一名入门弟子(让这功能一开局就看得见摸得着),仅此一次。
     * 若上一世凝有跨世之缘(真传),starter 带着这份羁绊入场,随后清零 —— 一次性携带,不每世重演。
     */
    function sync(): void {
      // 只读页不白送弟子、不消耗跨世之缘 —— 那笔账进不了档,缘却已经扣掉了
      if (saveReader.value) return;
      if (apprentices.value.length === 0) {
        apprentices.value = [
          {
            uid: nextUid(),
            archId: STARTER_APPRENTICE,
            level: 1,
            bond: rebirthKarma.value,
            task: null,
          },
        ];
        rebirthKarma.value = 0;
      }
    }

    /** 收割所有已完工的弟子,return 尾账(带弟子名)供界面报「弟子归来,带回…」 */
    function collectFinished(now: number, major: number): ApprenticeReap[] {
      // 只读页不收割:弟子归来的资材会进内存,但这一页永远不落盘
      if (saveReader.value) return [];
      const reaped: ApprenticeReap[] = [];
      for (const appr of apprentices.value) {
        if (!taskDone(appr, now)) continue;
        const spec = appr.task!.spec;
        // 按**出发档**结算:派出去时锁的境界才这趟的账;老档无 rewardMajor 才退回当前 major
        const rewardMajor = appr.task!.rewardMajor ?? major;
        const spoils = apprenticeSpoils(appr.archId, spec, rewardMajor, appr.level);
        applySpoils(spoils, rewardMajor);
        appr.level = Math.min(APPRENTICE_MAX_LEVEL, appr.level + 1);
        appr.bond += 1;
        appr.task = null;
        reaped.push({ name: apprenticeDef(appr.archId)?.name ?? appr.archId, spec, spoils });
      }
      return reaped;
    }

    /** 派一名闲置弟子去跑一趟;忙着的、找不到的都派不动 */
    function dispatch(uid: string, spec: ApprenticeSpec, now: number): boolean {
      const appr = apprentices.value.find((x) => x.uid === uid);
      if (!appr || appr.task) return false;
      appr.task = {
        spec,
        startAt: now,
        finishAt: now + apprenticeTaskSeconds(spec) * 1000,
        rewardMajor: usePlayerStore().major,
      };
      return true;
    }

    /** 一键「各尽其长」:把所有闲置弟子派到当前最缺的门(目标无差别则各自专职) */
    function dispatchAllToNeed(now: number, stock: DispatchNeedStock): number {
      const idle = apprentices.value
        .filter((x) => !x.task)
        .map((x) => ({ uid: x.uid, talent: apprenticeDef(x.archId)?.talent ?? "adventure" }));
      let n = 0;
      for (const { uid, spec } of planDispatchAll(idle, stock)) {
        if (dispatch(uid, spec, now)) n += 1;
      }
      return n;
    }

    /** 收一名新弟子;槽满或灵石不够则不成 */
    function recruit(major: number): "full" | "poor" | "ok" {
      if (apprentices.value.length >= apprenticeSlots(major)) return "full";
      const owned = new Set(apprentices.value.map((a) => a.archId));
      const pool = APPRENTICES.filter((x) => x.id !== STARTER_APPRENTICE && !owned.has(x.id));
      if (pool.length === 0) return "full";
      const cost = apprenticeRecruitCost(major);
      if (!useResourcesStore().spendStone(cost)) return "poor";
      apprentices.value.push({
        uid: nextUid(),
        archId: rng.pick(pool).id,
        level: 1,
        bond: 0,
        task: null,
      });
      return "ok";
    }

    /**
     * 转世清零:弟子是今生观中家业,随皮囊散去;新世由 sync() 补送 starter。
     * 只取最高那名的羁绊,且仅「真传(满位阶)」凝成跨世之缘(封顶到真传位阶不越界);
     * 弟子本体不复活,只落 rebirthKarma 这一丝「老仆相寻」的缘。
     */
    function resetForRebirth(): void {
      let max = 0;
      for (const appr of apprentices.value) max = Math.max(max, appr.bond);
      rebirthKarma.value = max >= BOND_TRUECODE_MIN ? BOND_TRUECODE_MIN : 0;
      apprentices.value = [];
    }

    return {
      apprentices,
      rebirthKarma,
      sanitize,
      sync,
      collectFinished,
      dispatch,
      dispatchAllToNeed,
      resetForRebirth,
      recruit,
    };
  },
  { persist: persistConfig("apprentice") },
);
