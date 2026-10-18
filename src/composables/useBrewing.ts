import { computed } from "vue";
import { useCultivationStore } from "@/stores/cultivation";
import { useLoreStore } from "@/stores/lore";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { buffDef } from "@/data/buffs";
import { pillDef } from "@/data/pills";
import { HERB_GRADE_NAMES, type HerbGrade } from "@/data/herbGrades";
import { DAO_NAMES, SKILLS, skillStageName, skillStageProgress } from "@/data/crafting";
import { craftGuaranteeCrafts } from "@/core/heritageEffects";
import {
  PILL_BATCH,
  availableRecipes,
  craftPill,
  craftPillBatch,
  pillCraftCost,
  salvageRatio,
} from "@/core/pillService";
import { craftability, type Craftability } from "@/core/craftability";
import { modOf } from "@/core/statsCalc";
import { alchemyBonusCapped } from "@/core/engineCraft";
import { studyEta } from "@/core/loreService";
import { formatDuration, formatGN } from "@/utils/format";
import { toNum } from "@/utils/gnum";
import { modsText } from "@/data/statNames";
import { pillFuncText } from "@/ui/itemText";
import type { GNum, PillDef, StatMods } from "@/types";

/**
 * 开炉炼丹的共用账本 —— InventoryView(页面)与 BrewingDialog(开炉弹窗)同源调用。
 * 拆分纪律:同一逻辑只许一份 —— 页面要用的(丹方总数、逐品持有、效果文案)与
 * 弹窗要用的(方子行、炼丹增益、技艺、把握配色)都从这里拿,谁也不许另抄一份
 * computed(两份定义 = 两本账,见项目「不做两本账」纪律)。
 * 内部读 store 照视图层原样:pinia 单例,与主文件各自实例化拿到的是同一个账。
 */
export function useBrewing() {
  const resources = useResourcesStore();
  const player = usePlayerStore();
  const cult = useCultivationStore();
  const lore = useLoreStore();

  /** 某品灵草的持有量 —— 炼丹头逐品读数(与灵草坊 held 同源,不走总读数) */
  function herbGradeHeld(g: HerbGrade): number {
    return resources.herbOf(g);
  }

  // ---- 开炉幕 · 炼丹增益(机制可见:三味状态丹的炼丹面只在炉前有意义,不许白吃白扛) ----
  /** 炼丹面三键:双成 / 心得 / 护料。其余(回灵 / 会心 / 破境)是通用面,不进炉前这一格 */
  const ALCHEMY_FACE_KEYS = new Set(["alchemyYield", "craftExpGain", "craftSalvage"]);
  const ALCHEMY_BUFF_PILLS = [
    { buffId: "buff_huohou", name: "安神" },
    { buffId: "buff_chengxin", name: "澄心" },
    { buffId: "buff_dingxin", name: "定心" },
  ] as const;
  const alchemyBuffRows = computed(() =>
    ALCHEMY_BUFF_PILLS.filter(({ buffId }) => cult.hasBuff(buffId)).map(({ buffId, name }) => {
      const mods = buffDef(buffId)?.mods ?? {};
      // 只取炼丹面;文案 = buff 自己的 mods → modsText,不在界面里另写一份
      const face = Object.fromEntries(
        Object.entries(mods).filter(([k]) => ALCHEMY_FACE_KEYS.has(k)),
      );
      return {
        buffId,
        name,
        effect: Object.keys(face).length > 0 ? modsText(face as StatMods) : "",
      };
    }),
  );

  /**
   * 藏经阁翻检的当刻概况(开炉页顶部一行)。
   * 读数在 core/loreService.studyEta —— 与 studyTick 同一优先序,界面不另算。
   */
  const studyLine = computed(() => {
    const eta = studyEta();
    if (!eta) return "";
    if (!eta.readingId && !eta.nextIsNew) return "藏经阁翻检中:够得着的方子都已到手";
    if (eta.readingId) {
      const name = pillDef(eta.readingId)?.name ?? "某方";
      return `藏经阁正研读「${name}」,约 ${formatDuration(Math.round(eta.nextInSec))} 后读通`;
    }
    return `藏经阁翻检中,约 ${formatDuration(Math.round(eta.nextInSec))} 后翻出一张新方`;
  });

  const recipes = computed(() =>
    availableRecipes()
      .map((id) => {
        const def = pillDef(id);
        const cost = pillCraftCost(id);
        const able = craftability(id);
        // 双成率 = 掷骰同一口径(alchemyBonusCapped:炉子份 + 炼丹产出词条,夹 0.8)—— 不许在界面重算一份
        const doubleRate = alchemyBonusCapped(id);
        // 浴火丹心(宿命传承)「本世前 3 炉必成」:余量 = 保底总数 − 已用,与 engineCraft.rate 同源。
        // 界面不报这段时,持传承会在「把握 60%」里看到一个其实必成的炉。
        const guaranteeLeft = Math.max(
          0,
          craftGuaranteeCrafts(player.reincarnation.heritage) -
            (player.reincarnation.heritageUses.danxin ?? 0),
        );
        if (!def || !cost || !able) return null;
        // 失败那面的代价也在炉前摊开:炸炉返草 ≈ salvageRatio(技艺)×(1+稳炉护料),与
        // engineCraft.spentOnFail 同源 —— 只摊成功率等于只让玩家看见赢的那面
        const salvageFraction =
          salvageRatio(able.skill) * (1 + modOf(player.finalStats.mods, "craftSalvage"));
        // 返草实算按整株取整(engineCraft.spentOnFail 对 cost.amount floor,
        // 还原会退回 Math.floor(cost×ratio)),展示不许用浮点比率伪装整株:
        // 4 株 20% 实际一株不退,写「~20%」就是骗。合体守拙本世首败灵草全保,也在炉前亮开。
        const hasShouzhuo = player.reincarnation.heritage.includes("shouzhuo");
        const shouzhuoLeft = hasShouzhuo && (player.reincarnation.heritageUses.shouzhuo ?? 0) === 0;
        const keptHerb = shouzhuoLeft ? cost.herb : Math.floor(cost.herb * salvageFraction);
        // 分级后「灵草不足」太笼统:满兜仙品草也可能缺几株凡品 —— 逐案点名缺什么,
        // 缺草的直接指路灵草坊(那是唯一买草的地方)
        const shortHerb = !resources.hasHerbs(cost.herbGrade, cost.herb);
        const shortStone = !resources.hasStone(cost.stone);
        // 双缺要并列报(「缺凡品,持 a/b · 灵石尚差 c 石」)—— 与同仓其它消费点(GongfaDialog 悟道点·残页)一个口子;
        // 若只报第一个成立的,买齐草后灵石尚差才突然冒出来,等于把决策的一半藏到付款后
        const shortParts: string[] = [];
        if (shortHerb)
          shortParts.push(
            `缺${HERB_GRADE_NAMES[cost.herbGrade]},持 ${resources.herbOf(cost.herbGrade)}/${cost.herb}`,
          );
        if (shortStone)
          shortParts.push(
            `灵石不足,尚差 ${formatGN(Math.max(0, toNum(cost.stone) - toNum(resources.spiritStone)))} 石`,
          );
        const shortText = shortParts.length ? shortParts.join(" · ") : null;
        return {
          def,
          cost,
          able,
          doubleRate,
          guaranteeLeft,
          salvageFraction,
          keptHerb,
          shouzhuoLeft,
          shortHerb,
          shortStone,
          shortText,
        };
      })
      .filter(
        (
          x,
        ): x is {
          def: PillDef;
          cost: { herb: number; herbGrade: HerbGrade; stone: GNum };
          able: Craftability;
          doubleRate: number;
          guaranteeLeft: number;
          salvageFraction: number;
          keptHerb: number;
          shouzhuoLeft: boolean;
          shortHerb: boolean;
          shortStone: boolean;
          shortText: string | null;
        } => x !== null,
      )
      // 现在能开炉的置顶,其余再按阶位 —— 进弹窗一眼看见此刻哪味立刻可炼
      .sort((a, b) => {
        const ca = a.shortHerb || a.shortStone ? 0 : 1;
        const cb = b.shortHerb || b.shortStone ? 0 : 1;
        return cb - ca || a.able.rank - b.able.rank;
      }),
  );

  /**
   * 技艺一览:名(道名 + 技艺名)、境地(skillStageName)、境地内进度(0~1)、这项技艺管什么。
   * lv/progress 喂给丹房的进度条 —— 「做得多就精」不再只是境地两个字,离下一境还差多少看得见。
   */
  const skillRows = computed(() =>
    SKILLS.map((s) => {
      const lv = lore.skillLevel(s.id);
      return {
        id: s.id,
        daoName: DAO_NAMES[s.dao],
        name: s.name,
        stage: skillStageName(lv),
        progress: skillStageProgress(lv),
        desc: s.desc,
      };
    }),
  );

  /**
   * 把握度配色:七成以上放心开炉(石绿)、三成以下是在赌(朱砂)、中间档留意(赭金)。
   * 色类必须是色板真类 —— 曾经写过 text-jade-ink / text-crimson-ink 两个不存在的类,
   * 整条语义色静默落到继承色,「敢不敢开」的绿色信号从界面上消失了(见 uiLayering 审计)。
   */
  function rateClass(rate: number): string {
    if (rate >= 0.7) return "text-jade";
    if (rate >= 0.3) return "text-gold-ink";
    return "text-cinnabar";
  }

  /** 连炼一批 —— 批量开炉,料尽自停(成败与保料合一条提示) */
  function craftBatch(id: string): void {
    craftPillBatch(id, PILL_BATCH);
  }

  /** 连炼按钮披露保底只保前 N 炉(丹心保底是本世全局池,后半批回落到真实把握) */
  function batchGuaranteeText(left: number): string {
    if (left <= 0) return "";
    return left >= PILL_BATCH ? " · 皆必成" : ` · 前 ${left} 炉必成`;
  }

  return {
    // 页面(InventoryView)与弹窗(BrewingDialog)共用:
    herbGradeHeld, // 逐品持有:开炉头与灵草坊两处同源
    recipes, // 丹方总数:页面丹药 tab 副题读 length,弹窗列方子
    pillFuncText, // @/ui/itemText 的纯函数经此转发:丹药详情与方子清单只认一份出处
    // 开炉弹窗专用:
    alchemyBuffRows,
    skillRows,
    studyLine,
    rateClass,
    craftPill,
    craftBatch,
    batchGuaranteeText,
  };
}
