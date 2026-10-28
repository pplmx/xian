<template>
  <!-- 开炉炼丹 -->
  <BaseModal :open="open" title="开炉炼丹" wide @close="emit('close')">
    <!--
      灵草五品:方子按品阶耗(见每条方子的 cost.herbGrade),总读数归一堆毫无意义 ——
      逐品列出持有,才看得出这张方子的这一品够不够。灵石仍是单一大数,占同一行右侧。
    -->
    <p class="mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] tabular">
      <span class="text-ink-faint">灵草</span>
      <template v-for="g in HERB_GRADES" :key="g">
        <span
          class="chip-ink !py-0.5 !px-1.5 !text-[10px]"
          :class="herbGradeHeld(g) > 0 ? 'text-jade' : 'text-ink-faint'"
          >{{ HERB_GRADE_SHORT[g] }} {{ herbGradeHeld(g) }}</span
        >
      </template>
      <span class="text-ink-faint">· 灵石 {{ formatGN(resources.spiritStone) }}</span>
    </p>
    <!--
      被动翻检全程无进度条:玩家只知道某天突然翻出一张方子,不知道它快到了。
      这一行把「下一件事」报成时间 —— 读数与 studyTick 同序,见 core/loreService.studyEta
    -->
    <p v-if="studyLine" class="mb-2 text-[10px] leading-relaxed text-ink-faint tabular">
      {{ studyLine }}
    </p>
    <!--
      炼丹增益:安神/澄心/定心是服下去的状态丹,「炼丹面」(双成/心得/护料)只在炉前
      有意义 —— 吃没吃、加几成,开着炉就该看得见;没吃则给个引子,不许白吃白扛。
      效果文案走 buff 的 mods → modsText,不在此处另写一份(见 pillBatch.spec 的收口)。
    -->
    <div v-if="alchemyBuffRows.length" class="mb-2 rounded-md bg-paper-deep/60 px-3 py-2">
      <p class="text-[10px] text-ink-faint">炼丹增益 · 此刻在炉前生效</p>
      <div class="mt-1 space-y-0.5">
        <p
          v-for="row in alchemyBuffRows"
          :key="row.buffId"
          class="flex items-baseline gap-1.5 text-[11px]"
        >
          <span class="font-kai shrink-0 text-qing">{{ row.name }}</span>
          <span class="tabular text-ink-soft">{{ row.effect }}</span>
        </p>
      </div>
    </div>
    <p v-else class="mb-2 text-[10px] leading-relaxed text-ink-faint">
      炉前还是白身 —— 备一味
      <span class="text-qing">安神 · 澄心 · 定心</span>,双成 / 心得 / 护料即刻各涨一截
    </p>
    <div
      v-if="recipes.length"
      class="scroll-pane max-h-64 space-y-2 overflow-y-auto"
      :data-recipe-total="filteredRecipes.length"
      :data-recipe-shown="filteredRecipePage.shown"
      :data-recipe-start="filteredRecipePage.start"
    >
      <input
        v-model="recipeQuery"
        type="text"
        inputmode="search"
        aria-label="搜方名"
        class="w-full rounded-md border border-ink/15 bg-paper-deep/60 px-2.5 py-1.5 text-[16px] text-ink outline-none placeholder:text-ink-faint"
        placeholder="搜方名…"
      />
      <p
        v-if="filteredRecipes.length"
        class="px-0.5 text-center text-[10px] text-ink-faint tabular"
      >
        {{ recipeQuery.trim() ? "搜得" : "丹方共" }} {{ filteredRecipes.length }} 张 · 现看
        {{ filteredRecipePage.start + 1 }}–{{ filteredRecipePage.shown }}
      </p>
      <p
        v-if="recipeQuery.trim() !== '' && !filteredRecipes.length"
        class="px-0.5 text-[10px] text-ink-faint"
      >
        没有叫「{{ recipeQuery.trim() }}」的方子
      </p>
      <div
        v-for="r in filteredRecipePage.visible"
        :key="r.def.id"
        :data-recipe-row="r.def.id"
        tabindex="-1"
        class="card-ink px-3.5 py-2.5"
      >
        <!--
          左图 + 中信息 + 右把握:两个按钮下移到卡底 —— 三列挤在一行时,
          中间的「方名 / 代价 / 成品」只剩一百来像素,「聚气散」被折成「聚气/散」(实测)。
          极窄档(195 CSS px)还要再放开一层:面板 171 宽、卡片内宽 115,减掉图标与间距后
          中间只剩 42px —— 「凡品灵草×8 · 灵石 3.4」折成 132px 高的六行、
          「服之:修为 +80 点」折成 98px 高的四行(自检量到)。故这一档整块竖排:
          图标与名字一行,代价与成品各占整行,把握块改成左对齐另起一段。
        -->
        <div class="flex items-start gap-3 tinylens:flex-col tinylens:gap-1.5">
          <GameIcon
            :name="r.def.icon"
            :size="18"
            class="mt-0.5"
            :style="{ color: qualityDef(r.def.quality).color }"
          />
          <div class="min-w-0 grow">
            <p class="flex items-center gap-2">
              <span class="whitespace-nowrap font-kai text-[14px] text-ink">{{ r.def.name }}</span>
              <span class="whitespace-nowrap text-[10px] text-ink-faint">{{ r.able.rank }} 阶</span>
              <span v-if="r.able.overReach > 0" class="whitespace-nowrap text-[10px] text-cinnabar"
                >越阶 {{ r.able.overReach }}</span
              >
            </p>
            <p class="text-[11px] text-ink-faint tabular">
              {{ HERB_GRADE_SHORT[r.cost.herbGrade] }}灵草×{{ r.cost.herb }} · 灵石
              {{ formatGN(r.cost.stone) }} ·<template v-if="r.shouzhuoLeft"
                >本世首败(任一炉)灵草全保</template
              ><template v-else>炸炉返草 ~{{ r.keptHerb }} 株</template
              ><template v-if="toNum(r.cost.stone) > 0"> · 灵石不退</template>
            </p>
            <!-- 炼出来是什么:方子清单此前只报代价与把握,不报成品 -->
            <p class="text-[10px] leading-relaxed text-qing">{{ pillFuncText(r.def) }}</p>
          </div>
          <div class="shrink-0 text-right">
            <p
              class="tabular text-[14px]"
              :class="r.guaranteeLeft > 0 ? 'text-gold-ink' : rateClass(r.able.successRate)"
            >
              {{ r.guaranteeLeft > 0 ? "必成" : formatPercent(r.able.successRate) }}
              <span v-if="brewTriesText(r)" class="ml-1 text-[10px] text-ink-faint">{{
                brewTriesText(r)
              }}</span>
            </p>
            <p class="text-[10px] text-ink-faint">
              {{
                r.guaranteeLeft > 0
                  ? `本世前 ${craftGuaranteeCrafts(player.reincarnation.heritage)} 炉保底 · 剩 ${r.guaranteeLeft} 炉`
                  : "把握"
              }}
            </p>
            <!-- 双成率也亮在炉前:骰子不藏 —— 与掷骰同一口径(alchemyBonusCapped,见行构造器) -->
            <p class="mt-0.5 tabular text-[10px] text-ink-soft">
              {{ formatPercent(r.doubleRate)
              }}<span class="ml-1 text-[10px] text-ink-faint">双成</span>
            </p>
            <!--
              炉前存货账:存几枚、增益丹药力顶没顶 —— 此前只摊把握与代价,
              行囊里躺着 8 枚顶满丹也照炼不误,炼出来白占一格。
              存货与丹匣同一份账(inventory.pills),药力状态与服用侧同一把尺
              (buffOverflowOf)+ 同一把钟(见 useBrewing 行构造器)。
            -->
            <p class="mt-0.5 tabular text-[10px]">
              <span :class="r.stock > 0 ? 'text-ink-soft' : 'text-ink-faint'"
                >存 {{ r.stock }}</span
              >
              <span v-if="r.overflow === 'full'" class="ml-1 text-cinnabar">已顶</span>
              <span v-else-if="r.overflow === 'partial'" class="ml-1 text-gold-ink">将顶</span>
            </p>
          </div>
        </div>
        <p v-if="r.shortText" class="mt-1 pl-7 text-[10px] text-cinnabar tabular">
          {{ r.shortText }}
          <button
            v-if="r.shortHerb"
            class="underline active:opacity-60"
            @click="emit('open-herb-shop')"
          >
            · 灵草坊可补 ›
          </button>
        </p>
        <template v-if="r.guaranteeLeft === 0">
          <p v-for="w in r.able.weakness" :key="w" class="mt-1 pl-7 text-[10px] text-ink-faint">
            · {{ w }}
          </p>
        </template>
        <!--
          极窄档(195 CSS px)两枚动作键并排只剩 45px / 64px:「炼制」两个字加 px-3 的
          左右内边距正好放不下,当场折成两行(实测 45×47)。这一档收内边距并锁一行 ——
          动作词折行是最该避免的那一类(与全站 tap-row 同一条口径)。
        -->
        <div class="mt-2 flex justify-end gap-1.5">
          <button
            class="btn-seal whitespace-nowrap !px-3 !py-1.5 !text-[11px] tinylens:!px-2"
            :disabled="r.shortHerb || r.shortStone"
            @click="craftPill(r.def.id)"
          >
            炼制
          </button>
          <!-- 连炼 ×5:材料见底自停,成败与保料合一条提示(见 pillService.craftPillBatch) -->
          <button
            class="btn-ghost whitespace-nowrap !px-3 !py-1.5 !text-[11px] tinylens:!px-2"
            :disabled="r.shortHerb || r.shortStone"
            @click="craftBatch(r.def.id)"
          >
            连炼 ×{{ PILL_BATCH }}{{ batchGuaranteeText(r.guaranteeLeft) }}
          </button>
        </div>
      </div>
      <div
        v-if="filteredRecipePage.hidden > 0 || filteredRecipePage.start > 0"
        class="flex flex-wrap gap-2"
      >
        <button
          v-if="filteredRecipePage.start > 0"
          type="button"
          data-recipe-prev
          class="btn-ghost min-w-0 flex-1 !py-2 !text-[11px] tinylens:basis-full tinylens:whitespace-nowrap"
          :aria-label="previousRecipeText"
          @click="showPreviousRecipes"
        >
          {{ previousRecipeText }}
        </button>
        <button
          v-if="filteredRecipePage.hidden > 0"
          type="button"
          data-recipe-more
          class="btn-ghost min-w-0 flex-1 !py-2 !text-[11px] tinylens:basis-full tinylens:whitespace-nowrap"
          :aria-label="moreRecipeText"
          :data-promised="Math.min(RECIPE_RENDER_BATCH, filteredRecipePage.hidden)"
          @click="showMoreRecipes"
        >
          {{ moreRecipeText }}
        </button>
      </div>
    </div>
    <!--
      百工技艺:做得多就精。技艺一直在影响成丹 —— 境地与进度条都在这,看得见自己在长。
      排在方子之后:九项技艺在窄屏上要占半屏,放在前面会把方子压到折叠线以下。
      说明一栏至少留 9 个字宽,不够就整段换到下一行,不再被三列定宽挤成竖排。
    -->
    <div v-if="skillRows.length" class="mb-2 mt-3 rounded-md bg-paper-deep/60 px-3 py-2">
      <p class="text-[10px] text-ink-faint">技艺(按道分,做得多就精)</p>
      <div class="mt-1 space-y-1">
        <div v-for="s in skillRows" :key="s.id">
          <p class="flex items-baseline gap-2 text-[11px] tinylens:flex-wrap tinylens:gap-x-1.5">
            <span class="w-14 shrink-0 text-ink-faint tinylens:w-auto">{{ s.daoName }}</span>
            <span class="w-12 shrink-0 font-kai text-ink-soft tinylens:w-auto">{{ s.name }}</span>
            <span
              class="w-12 shrink-0 tinylens:w-auto"
              :class="s.stage === '生疏' ? 'text-ink-faint' : 'text-jade'"
              >{{ s.stage }}</span
            >
            <!--
              极窄档(195 CSS px)让说明整段落到下一行:三段定宽 56+48+48 加间距是 168px,
              比面板内宽 121 还多 —— 说明那一栏被压到 34px 宽、「凡品灵草×8 · 灵石」
              一字一行(自检量到 34px 宽的三行竖排)。故这一档三段改回自适应宽度
              (挤在一行读得出),说明用 basis-full 独占下一行。
            -->
            <span
              class="min-w-[9em] flex-1 text-[10px] leading-relaxed text-ink-faint tinylens:basis-full"
              >{{ s.desc }}</span
            >
          </p>
          <!-- 离下一境还差多少:境地内线性进度(见 skillStageProgress),同其余进度条共一根 ProgressBar -->
          <p class="mt-0.5 flex items-center gap-1.5 pl-14">
            <ProgressBar
              :value="s.progress"
              :color="s.stage === '生疏' ? 'var(--color-ink-faint)' : 'var(--color-jade)'"
              :height="4"
              class="flex-1"
            />
            <span class="w-7 shrink-0 text-right text-[10px] tabular text-ink-faint">{{
              s.stage === "大成" ? "已顶" : formatPercent(s.progress, 0)
            }}</span>
          </p>
        </div>
      </div>
    </div>
    <p v-else class="px-1 py-6 text-center t-body text-ink-faint">
      你还不知道任何丹方。
      <br />
      <span class="text-[10px]">去藏经阁参悟,或留意「失传丹方」奇缘,新方自会翻出</span>
    </p>
    <template #footer>
      <button class="btn-seal w-full" @click="emit('close')">收 炉</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { expectedTries } from "@/core/breakthrough";
import { computed, nextTick, ref, watch } from "vue";
import GameIcon from "@/components/common/GameIcon.vue";
import ProgressBar from "@/components/common/ProgressBar.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import { HERB_GRADES, HERB_GRADE_SHORT } from "@/data/herbGrades";
import { qualityDef } from "@/data/qualities";
import { PILL_BATCH } from "@/core/pillService";
import { craftGuaranteeCrafts } from "@/core/heritageEffects";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { formatGN, formatPercent } from "@/utils/format";
import { toNum } from "@/utils/gnum";
import { useBrewing } from "@/composables/useBrewing";
import {
  firstNewVisibleIndex,
  listWindow,
  nextListLimit,
  previousListLimit,
  previousListStep,
} from "@/core/listRender";

defineProps<{ open: boolean }>();
// craftOpen(页面状态)留 InventoryView,这里只回传事件:关炉走 close,
// 「灵草坊可补」走 open-herb-shop —— marketOpen 是主文件状态,弹窗不许越手改别人的账。
const emit = defineEmits<{ close: []; "open-herb-shop": [] }>();

const resources = useResourcesStore();
const player = usePlayerStore();

// 炉前的账全在 useBrewing —— 与主文件同源调用,这里不另抄任何一份 computed
const {
  recipes,
  alchemyBuffRows,
  skillRows,
  studyLine,
  herbGradeHeld,
  rateClass,
  craftPill: brewOne,
  craftBatch: brewBatch,
  batchGuaranteeText,
  pillFuncText,
} = useBrewing();

/** 炉前动作会耗料并改变「可炼优先」的排序,窗口移动后仍把焦点送回同一张方。 */
function craftPill(id: string): void {
  brewOne(id);
  focusRecipeRowById(id);
}

function craftBatch(id: string): void {
  brewBatch(id);
  focusRecipeRowById(id);
}

/** 炉前搜方名:方子一旦上手得多照单海搜,输入即滤(空白显示全部) */
const recipeQuery = ref("");

/** 炉前按方名过滤:空白显示全部,输入即滤(trim 后空串不拦)。方名是正身,成品贴名不进搜索 */
const filteredRecipes = computed(() => {
  const q = recipeQuery.value.trim();
  if (!q) return recipes.value;
  return recipes.value.filter((r) => r.def.name.includes(q));
});

const RECIPE_RENDER_BATCH = 6;
const RECIPE_RENDER_WINDOW = RECIPE_RENDER_BATCH * 2;
const recipeLimit = ref(RECIPE_RENDER_BATCH);
const filteredRecipePage = computed(() =>
  listWindow(filteredRecipes.value, recipeLimit.value, RECIPE_RENDER_WINDOW),
);
const moreRecipeText = computed(() => {
  const next = Math.min(RECIPE_RENDER_BATCH, filteredRecipePage.value.hidden);
  return `再看 ${next} 张 · 余 ${filteredRecipePage.value.hidden}`;
});
const previousRecipeText = computed(
  () =>
    `前一批 ${previousListStep(
      filteredRecipePage.value.shown,
      filteredRecipes.value.length,
      RECIPE_RENDER_BATCH,
    )} 张`,
);

function focusRecipeRow(index = 0): void {
  void nextTick(() => {
    const rows = document.querySelectorAll<HTMLElement>("[data-recipe-row]");
    rows[Math.min(Math.max(0, index), rows.length - 1)]?.focus();
  });
}

function focusRecipeRowById(id: string): void {
  void nextTick(() => {
    const selector = `[data-recipe-row="${CSS.escape(id)}"]`;
    const row = document.querySelector<HTMLElement>(selector);
    if (row) {
      row.focus();
      return;
    }
    // 炼制耗料后「可炼优先」会改序。若目标滑出当前窗,按它新位置所在批次的
    // 末尾重开窗;向上越过窗界时同样收口到那一批,焦点都不留在已销毁的节点上。
    const index = filteredRecipes.value.findIndex((candidate) => candidate.def.id === id);
    if (index < 0) return;
    const pageEnd = Math.ceil((index + 1) / RECIPE_RENDER_BATCH) * RECIPE_RENDER_BATCH;
    recipeLimit.value = Math.min(filteredRecipes.value.length, pageEnd);
    void nextTick(() => document.querySelector<HTMLElement>(selector)?.focus());
  });
}

function showMoreRecipes(): void {
  const shownBefore = filteredRecipePage.value.shown;
  const shownAfter = nextListLimit(shownBefore, filteredRecipes.value.length, RECIPE_RENDER_BATCH);
  recipeLimit.value = shownAfter;
  focusRecipeRow(firstNewVisibleIndex(shownBefore, shownAfter, RECIPE_RENDER_WINDOW));
}

function showPreviousRecipes(): void {
  recipeLimit.value = previousListLimit(
    filteredRecipePage.value.shown,
    filteredRecipes.value.length,
    RECIPE_RENDER_BATCH,
  );
  focusRecipeRow();
}

// 换搜索词就是换一份清单。只重置窗口,不把焦点从输入框抢到第一张方子。
watch(recipeQuery, () => {
  recipeLimit.value = RECIPE_RENDER_BATCH;
});

/**
 * 「平均 N 炉成一炉」—— 与突破卡同一口径(1 / 成功率),必成与坏值都不写。
 * 百分比读数不直观:55% 听着像"两炉里成一炉",实际期望是 1.8 炉。
 */
function brewTriesText(r: { guaranteeLeft: number; able: { successRate: number } }): string {
  if (r.guaranteeLeft > 0) return "";
  const n = expectedTries(r.able.successRate);
  return n === null ? "" : `平均 ${n} 炉成一炉`;
}
</script>
