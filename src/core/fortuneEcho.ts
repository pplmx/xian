/**
 * 遗产回声(Phase 31.3)
 *
 * 历史选择 → 持久记忆 → 再次触发旧内容 → 世界表现出「认识你」。
 *
 * 边界(锁死):
 *   只读 fortuneChoices
 *   不新增资源 / 属性 / 奖励 / 战斗规则 / 独立 UI
 *   回声是叙事,不改变任何数值利益
 *
 * 规则:
 *   - 新玩家(无 leave 记录): 永不回声
 *   - 曾 leave: 原机缘仍正常出现;极低概率(5%)替换为回声叙事;不进入推荐
 *   - 曾 take: 不触发 leave-回声(它已是你的缘)
 *   - 多次 leave: 效果不叠加(布尔判断)
 */
import { rng } from "@/utils/random";

/** 回声触发概率(稀有,5%) */
export const ECHO_CHANCE = 0.05;

/**
 * 三种回声形态(按机缘叙事语境选择):
 *   认出你 —— 世界记得你的脸
 *   缘分已尽 —— 未结之缘无法重续
 *   留下痕迹 —— 你曾在此留下过什么
 */
export type EchoForm = "recognize" | "fate-over" | "traces";

export interface FortuneEcho {
  eventId: string;
  form: EchoForm;
  /** 回声前的导语(显示在抉择文案上方) */
  line: string;
}

const FORTUNE_ECHO_TEXTS: Record<string, { form: EchoForm; line: string }> = {
  ft_reclusive_elder: {
    form: "recognize",
    line: "竹屋前的老人抬眼望来,目光在你面上停了一瞬——「原来是你。」",
  },
  ft_sword_remnant: {
    form: "traces",
    line: "三道剑痕犹在,只是剑气已散。你们曾在此狭路相逢。",
  },
  ft_ancient_elixir: {
    form: "fate-over",
    line: "丹房还在,丹方却已不在原处。那段未曾结下的缘,此刻无法重新拾起。",
  },
  ft_beast_pledge: {
    form: "recognize",
    line: "草丛边窜出一头幼兽,嗅了嗅你的衣角,又退开两步,似是认得你。",
  },
  ft_blood_contract: {
    form: "traces",
    line: "染血的龟甲埋在你亲手挖的土坑里——你曾将它掩埋于此。",
  },
  ft_meteor_iron: {
    form: "traces",
    line: "山巅依旧躺着那块陨铁,边角一道擦痕正是你当年驻足又离去时留下的。",
  },
  ft_xianmen_guqin: {
    form: "traces",
    line: "古琴仍在案上,弦上依旧无尘。你曾在这里坐了一晌,终究没有伸手。",
  },
  ft_yunduan_xianzun: {
    form: "recognize",
    line: "云端那位仙尊又在负手而立,瞥见你时笑了笑:「这回,还是不来?」",
  },
  ft_shenyu_wangzuo: {
    form: "fate-over",
    line: "王座依旧悬在神域中央。你曾绕它而行,如今它认得你的脚步了。",
  },
  ft_faze_zhixin: {
    form: "traces",
    line: "那枚光核还在跳动。你曾只是看着它,没有碰。",
  },
  ft_hundun_zhong: {
    form: "recognize",
    line: "混沌之种回到你眼前,像是认得那个把它埋回去的人。",
  },
  ft_hongmeng_xiantai: {
    form: "fate-over",
    line: "先台无字,那与你有关的一笔,还空着。你曾选择不去看它。",
  },
  ft_hantan_bingxin: {
    form: "traces",
    line: "潭底的冰晶还在,那缕白气依旧流转。你曾俯身看它很久,终究没有伸手。",
  },
  ft_chiyan_huoling: {
    form: "recognize",
    line: "那簇火苗还在半空烧着,见你走近,焰尖轻轻一偏 —— 它记得你绕开它的那个傍晚。",
  },
  ft_leize_leizhu: {
    form: "traces",
    line: "雷竹仍是那株雷竹,只是你曾站过的那块焦土上,草已经长出来了。",
  },
  ft_xingyi_zhujing: {
    form: "traces",
    line: "坑底的星髓结晶还在,映着同一片夜空。你曾在坑边站了很久,最终没有去剖它。",
  },
  ft_tianwai_yin: {
    form: "recognize",
    line: "那段声音又飘来了,比上一世更近些 —— 它记得你曾屏息听过,也记得你没有循它而去。",
  },
  ft_woodcutter: {
    form: "traces",
    line: "那樵夫还在原处歇脚,担子里的书换了一批。你曾替他把柴挑到山下。",
  },
  ft_war_bones: {
    form: "traces",
    line: "风又把那片土吹开了。你曾见过这具骸骨,也曾在它旁边站了很久。",
  },
};

/**
 * 机缘是否有回声资格(曾放弃)。
 *
 * **纯函数**:`choices` 由调用方给(玩家对每个机缘的取舍记录),不自己取 store。
 * 这一层原为读一个字段而 import `usePlayerStore`(`layeringAudit.spec` 的
 * `STATEFUL_CORE` 名单点名要求只许减)—— 一个纯判定不该为它拖进整套 Pinia。
 */
export function echoEligible(
  eventId: string,
  choices: Readonly<Record<string, string | undefined>>,
): boolean {
  return choices[eventId] === "leave";
}

/** 判定本次是否触发回声(纯概率一把 roll,与特定事件无关) */
export function rollEcho(): number {
  return rng.next();
}

/** 组装回声(事件 id 有回声文本时;否则 null) */
export function echoFor(
  eventId: string,
  choices: Readonly<Record<string, string | undefined>>,
): FortuneEcho | null {
  if (!echoEligible(eventId, choices)) return null;
  const data = FORTUNE_ECHO_TEXTS[eventId];
  if (!data) return null;
  return { eventId, form: data.form, line: data.line };
}
