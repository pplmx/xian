<template>
  <!-- 轮回弹窗(自 CharacterView 迁入;逆旅契的「立契」入口在轮回弹窗内,两浮层同宿主不拆散) -->
  <BaseModal :open="open" title="轮回" @close="emit('close')">
    <!--
      道果条:先给「有多少」,再给「这有多少用」。

      此前是一个 justify-between 的两端布局:左边一坨(名号 + 永久积累 + 每枚名义
      + 软上限说明,四行),右边孤零零一个 12。读起来像「一段说明书配了个数字」——
      而这一屏最该先看见的就是那个数。现在改成:数字与「有效收益」并排成一组读数,
      每枚名义那句留作组下的一句注解。
    -->
    <div class="rounded-md bg-violet-ink/[0.05] px-3 py-2.5">
      <div class="flex items-baseline justify-between gap-2">
        <span class="text-body text-ink-soft">
          道果
          <span class="ml-1 text-note text-violet-ink">【永久积累】</span>
        </span>
        <span class="flex items-baseline gap-2">
          <span class="tabular font-kai text-heading leading-none text-cinnabar">{{
            formatNum(player.reincarnation.daoFruit)
          }}</span>
          <span class="text-note text-ink-faint">枚</span>
        </span>
      </div>
      <!-- S3 道果收益:有效值(边际渐减后的真值)紧跟实数,两个数一起读 -->
      <p class="mt-1 flex items-baseline justify-between text-body tabular">
        <span class="text-ink-faint">有效收益</span>
        <span>
          <span class="text-gold-ink">{{ fruitInfo.effectiveText }} 枚</span>
          <span class="ml-1 text-note text-ink-faint"
            >(边际渐减){{
              fruitInfo.total > 0 ? ` · 当前修行 ${fruitInfo.cultBonusText}` : ""
            }}</span
          >
        </span>
      </p>
      <p class="mt-1 text-note leading-relaxed text-ink-faint">
        每枚名义:修行 +{{ formatPercent(DAO_FRUIT_CULT_BONUS, 0) }},道躯 +{{
          formatPercent(DAO_FRUIT_COMBAT_BONUS, 0)
        }};合计受软上限,转世保留
      </p>
      <!--
        软上限到底怎么递减、从多少开始 —— 上一句只说了"受软上限",玩家读完仍不知道
        二十枚是个坎。白话出在 core/resourceGuidance 一处(与有效收益同模块),不在这里另写。
      -->
      <p class="mt-0.5 text-note leading-relaxed text-ink-faint">
        {{ softCapText }}
      </p>
    </div>
    <!-- 逆旅契:道果的第一个消费出口。花道果换一世逆境,回报只有履历 -->
    <div
      class="mt-2 flex items-center justify-between gap-2 rounded-md border border-ink/15 px-3 py-2"
    >
      <span class="min-w-0 text-body text-ink-soft">
        逆旅契
        <span class="ml-1 text-note text-violet-ink">【本世 · 消耗道果】</span>
        <span class="block text-note text-ink-faint">
          {{
            signedTrial
              ? `此生已立「${signedTrial.name}」·${signedTrial.ruleText}`
              : "以道果换一世逆境,所得唯有履历一笔"
          }}
        </span>
      </span>
      <!-- 拇指够得着:纯文字按钮只有 18px 高,补成 30px(弹窗里的可点元素同样受 28px 那条约束) -->
      <button
        v-if="!signedTrial"
        class="shrink-0 px-2 py-1.5 text-body text-gold-ink underline underline-offset-2 active:text-cinnabar"
        @click="trialOpen = true"
      >
        立契
      </button>
      <span v-else class="shrink-0 font-kai text-section text-cinnabar">{{
        signedTrial.seal
      }}</span>
    </div>

    <!--
      先天之姿要有自己的名字。

      截图里这排芯片直接接在逆旅契卡片下方,没有任何标题 —— 读者看到的是
      「一张卡片后面冒出一串彩色词」,像是逆旅契的附录。而它们其实是转世
      带得走的那批东西里最要紧的一样。

      「{n} 项」跟在标题后面:数目本身就是玩家想知道的一半。
    -->
    <div class="mt-3 flex items-baseline justify-between">
      <span class="font-kai text-title tracking-[0.25em] text-ink">先天之姿</span>
      <span v-if="ownedTalents.length" class="text-note text-ink-faint tabular"
        >{{ ownedTalents.length }} 项</span
      >
    </div>
    <div class="mt-1.5">
      <div class="flex flex-wrap gap-1.5">
        <!-- 天赋效果不再只藏 hover:点一下芯片,下面展开一行说明(手机上看得见才算数) -->
        <button
          v-for="t in ownedTalents"
          :key="t!.id"
          class="chip-ink border-current bg-transparent text-left"
          :style="{ color: TALENT_GRADE_COLORS[t!.grade] }"
          :title="t!.desc"
          :aria-expanded="talentTap === t!.id"
          @click="talentTap = talentTap === t!.id ? null : t!.id"
        >
          {{ t!.name }}
        </button>
        <span v-if="!ownedTalents.length" class="text-body text-ink-faint"
          >转世后可觉醒先天之姿</span
        >
      </div>
      <p v-if="talentTap && tappedTalent" class="mt-1.5 text-note leading-relaxed text-ink-faint">
        <span :style="{ color: TALENT_GRADE_COLORS[tappedTalent.grade] }">{{
          tappedTalent.name
        }}</span>
        ：{{ tappedTalent.desc }}
        <span class="mt-0.5 block text-qing">{{ modsText(tappedTalent.mods) }}</span>
      </p>
    </div>
    <p class="mt-3 t-body text-ink-faint">
      兵解转世保留道果 / 先天之姿 /
      称号等随魂之物;功法回一层,法宝归尘,余者随皮囊散去。金丹境方可自行兵解。
    </p>
    <!--
      去留一览:兵解是不可逆的大事,一句「随皮囊散去」盖不住整本账 ——
      哪一样去了哪、留下什么,读的就是 core/samsaraAudit 那份 HERITAGE(同表,不另写)。
      默认收起:不压弹窗高度,按下前点开即可核对。
    -->
    <button
      class="mt-2 flex w-full items-center justify-between px-2 py-2 text-left text-body text-ink-soft active:opacity-60"
      :aria-expanded="heritageOpen"
      @click="heritageOpen = !heritageOpen"
    >
      <span>转世去留一览({{ keepCount }} 留 · {{ resetCount }} 去)</span>
      <span class="text-note text-qing">{{ heritageOpen ? "▾ 收 起" : "▸ 展 开" }}</span>
    </button>
    <!--
      折叠态也要报出「打折的那几条」:光看「16 留 · 20 去」,玩家不知道留下的
      有 4 条其实是折半 —— 「功法回一层」这种损失预期,不该等展开了才看见。
    -->
    <p
      v-if="!heritageOpen && partialKeepRows.length"
      class="mt-1 px-2 text-note leading-relaxed text-ink-faint"
    >
      其中 {{ partialKeepRows.length }} 条折半或部分保留:{{
        partialKeepRows.map((r) => r.name).join(" · ")
      }}
    </p>
    <!--
      列表自带一个滚动区(max-h-64),而不是靠整块面板滚 —— 面板滚的话,列表尾
      会被页脚按钮齐齐切掉,看起来像「列表到此为止」。外圈套 .scroll-fade
      负责在底边淡出一层(见 style.css):还有下文时那一截是虚的。
    -->
    <div v-if="heritageOpen" class="scroll-fade mt-1.5">
      <div class="scroll-pane max-h-64 overflow-y-auto rounded-md bg-paper-deep/60 px-3 py-2">
        <!--
          两组各带一枚色点与自己的小标:一条细线分不开「留下」与「归尘」这两件相反的事。
          上组(随魂)走玉色、下组(归尘)走淡墨 —— 颜色在这一屏就是结论。
        -->
        <p class="flex items-center gap-1.5 text-note text-jade">
          <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-jade" aria-hidden="true" />
          随魂留存
        </p>
        <div class="mt-1 space-y-1">
          <p
            v-for="row in heritageKeepRows"
            :key="row.id"
            class="flex items-baseline justify-between gap-2 text-note"
          >
            <span class="text-ink-soft">{{ row.name }}</span>
            <!--
              右侧只在**有例外**时才写字。
              这一组本来就是「随魂留存」,十六行里十三行右侧印着同一句「随魂留存」——
              重复的组名不提供任何信息,只把真正的例外(折半 / 部分保留)淹掉。
              组名由上面的色点标题负责;这里只报「不是全额留下」的那几条。
            -->
            <span v-if="row.modeLabel !== FULL_KEEP_LABEL" class="shrink-0" :class="row.cls">{{
              row.modeLabel
            }}</span>
          </p>
        </div>
        <p class="mt-2.5 flex items-center gap-1.5 text-note text-ink-faint">
          <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-ink/20" aria-hidden="true" />
          归尘散去
        </p>
        <div class="mt-1 space-y-1">
          <p
            v-for="row in heritageResetRows"
            :key="row.id"
            class="flex items-baseline justify-between gap-2 text-note"
          >
            <span class="text-ink-faint">{{ row.name }}</span>
            <span class="shrink-0" :class="row.cls">{{ row.modeLabel }}</span>
          </p>
        </div>
      </div>
    </div>
    <template #footer>
      <button class="btn-ghost w-full !text-body" :disabled="!canRebirth" @click="rebirth">
        {{
          canRebirth ? "兵解转世" : `${REALMS[MANUAL_REBIRTH_MIN_MAJOR]?.name ?? ""}境方可自行兵解`
        }}
      </button>
    </template>
  </BaseModal>

  <!-- 逆旅契弹窗:一世一份,签下不可解除;只加难度,不给任何属性或资源 -->
  <BaseModal :open="trialOpen" title="逆旅契" @close="trialOpen = false">
    <p class="t-body text-ink-faint">
      道果本是历世所积,却一向只堆在身上。立一份契,把它押在这一世的逆境里——
      契不予你分毫气力,只把路走窄。走完了,它会留在你的履历上。
    </p>
    <div class="mt-3 space-y-2">
      <button
        v-for="t in LIFE_TRIALS"
        :key="t.id"
        class="card-ink w-full px-3 py-2 text-left active:scale-99"
        :class="{ 'border-dashed border-ink/15': !canSignLifeTrial(t.id) }"
        :disabled="!canSignLifeTrial(t.id)"
        @click="signTrial(t.id)"
      >
        <span class="flex items-baseline justify-between">
          <span class="font-kai text-title text-ink">{{ t.seal }} · {{ t.name }}</span>
          <!--
            哑巴灰的补齐:契签不下只有两个理由 —— 本世已签过 / 道果不足。
            已签过整组都灰,报「此生已签」(此时再报尚差会指错方向);
            道果不足照「尚差 N」报差数(与聚气丹/建筑同款纪律),不稳灰到底。
          -->
          <span v-if="signedTrial" class="shrink-0 tabular text-body text-ink-faint">此生已签</span>
          <span v-else class="shrink-0 tabular text-body text-cinnabar">
            {{
              player.reincarnation.daoFruit >= t.cost
                ? `${t.cost} 道果`
                : `尚差 ${t.cost - player.reincarnation.daoFruit} 道果`
            }}
          </span>
        </span>
        <span class="mt-0.5 block t-body text-ink-soft">{{ t.desc }}</span>
        <span class="mt-0.5 block text-note text-ink-faint">{{ t.ruleText }}</span>
      </button>
    </div>
    <p class="mt-3 t-body text-ink-faint">
      一世只可立一契,立下不可解。转世时契随皮囊散去,履历长存。
    </p>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { usePlayerStore } from "@/stores/player";
import { useUiStore } from "@/stores/ui";
import { LIFE_TRIALS } from "@/data/lifeTrials";
import { activeLifeTrial, canSignLifeTrial, signLifeTrial } from "@/core/lifeTrialService";
import { talentDef, TALENT_GRADE_COLORS } from "@/data/talents";
import { REALMS } from "@/data/realms";
import { prepareReincarnation, MANUAL_REBIRTH_MIN_MAJOR } from "@/core/reincarnation";
import { HERITAGE } from "@/core/samsaraAudit";
import { DAO_FRUIT_COMBAT_BONUS, DAO_FRUIT_CULT_BONUS } from "@/data/constants";
import { fruitMarginalInfo, fruitSoftCapText } from "@/core/resourceGuidance";
import { formatNum, formatPercent } from "@/utils/format";
import { modsText } from "@/data/statNames";
import BaseModal from "@/components/common/BaseModal.vue";

/**
 * 轮回弹窗(含逆旅契弹窗,同一宿主)。
 *
 * 自 CharacterView 迁入:轮回弹窗里的「立契」按钮是逆旅契弹窗的唯一出处,
 * 两个浮层拆到两处文件就成了「出处不在一起」—— 沿用 ReincarnationDialog
 * 一个文件宿多个 BaseModal 的先例,弹窗自己的状态(talentTap / heritageOpen /
 * trialOpen)也一并随迁,关弹窗复位的行为不变。
 */
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const player = usePlayerStore();
const ui = useUiStore();

const ownedTalents = computed(() =>
  player.reincarnation.talents.map((id) => talentDef(id)).filter((t) => t !== undefined),
);

/** 天赋芯片点按展开(移动端无 hover,效果说明内联显示);关弹窗复位 */
const talentTap = ref<string | null>(null);
const tappedTalent = computed(() => (talentTap.value ? talentDef(talentTap.value) : undefined));
watch(
  () => props.open,
  (open) => {
    if (!open) {
      talentTap.value = null;
      heritageOpen.value = false;
    }
  },
);
/**
 * 转世去留一览:兵解是不可逆的大事,一句「随皮囊散去」盖不住整本账。
 * 行取自 core/samsaraAudit 的 HERITAGE 同表(审计处核实过,非样设口径),按留/去分组。
 * 默认收起:不压弹窗高度,按下前点开即可核对。
 */
const heritageOpen = ref(false);
const MODE_LABEL: Record<string, string> = {
  full: "随魂留存",
  partial: "折半/部分保留",
  reset: "归尘",
};
/** 「全额留下」的那一档 —— 组标题已说过,行内不必再说 */
const FULL_KEEP_LABEL = MODE_LABEL.full;
const heritageRows = computed(() =>
  HERITAGE.map((r) => ({
    id: r.id,
    name: r.name,
    mode: r.mode,
    modeLabel: MODE_LABEL[r.mode] ?? r.mode,
    /** 留=jade 色、归尘=淡墨 —— 一眼分得清哪些带得走 */
    cls: r.mode === "reset" ? "text-ink-faint" : "text-jade",
    detail: r.detail,
  })),
);
const heritageKeepRows = computed(() => heritageRows.value.filter((r) => r.mode !== "reset"));
const heritageResetRows = computed(() => heritageRows.value.filter((r) => r.mode === "reset"));
const keepCount = computed(() => heritageKeepRows.value.length);
const resetCount = computed(() => heritageResetRows.value.length);
/**
 * 折叠态的例外摘要:「16 留」里有几条其实是折半/部分保留 —— 计数报不出这个打折,
 * 而「功法会掉回一层」恰是按兵解前最该提前知道的一条。展开态不需要(列表里现成)。
 */
const partialKeepRows = computed(() => heritageKeepRows.value.filter((r) => r.mode === "partial"));
/** 本世已立的逆旅契;未立为 null */
const signedTrial = computed(() => activeLifeTrial());
const trialOpen = ref(false);
function signTrial(id: string): void {
  if (signLifeTrial(id)) trialOpen.value = false;
}
const canRebirth = computed(() => player.major >= MANUAL_REBIRTH_MIN_MAJOR);

/** S3 道果链路:有效收益与软上限白话 */
const fruitInfo = computed(() => fruitMarginalInfo());
/** 软上限白话:同一份论断出在 core/resourceGuidance,界面不另写一套 */
const softCapText = computed(() => fruitSoftCapText(fruitInfo.value.total));

function rebirth(): void {
  if (!canRebirth.value) {
    ui.toast(`至少金丹境方可自行兵解`, "warn");
    return;
  }
  emit("close");
  prepareReincarnation();
}
</script>
