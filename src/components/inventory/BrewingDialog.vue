<template>
  <!-- 开炉炼丹 -->
  <BaseModal :open="open" title="开炉炼丹" wide @close="emit('close')">
    <!--
      灵草五品:方子按品阶耗(见每条方子的 cost.herbGrade),总读数归一堆毫无意义 ——
      逐品列出持有,才看得出这张方子的这一品够不够。灵石仍是单一大数,占同一行右侧。
    -->
    <p class="mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-body tabular">
      <span class="text-ink-faint">灵草</span>
      <template v-for="g in HERB_GRADES" :key="g">
        <span
          class="chip-ink !py-0.5 !px-1.5 !text-note"
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
    <p v-if="studyLine" class="mb-2 t-note text-ink-faint tabular">
      {{ studyLine }}
    </p>
    <!--
      炼丹增益:安神/澄心/定心是服下去的状态丹,「炼丹面」(双成/心得/护料)只在炉前
      有意义 —— 吃没吃、加几成,开着炉就该看得见;没吃则给个引子,不许白吃白扛。
      效果文案走 buff 的 mods → modsText,不在此处另写一份(见 pillBatch.spec 的收口)。
    -->
    <div v-if="alchemyBuffRows.length" class="mb-2 rounded-[2px] bg-paper-deep/60 px-3 py-2">
      <p class="text-note text-ink-faint">炼丹增益 · 此刻在炉前生效</p>
      <div class="mt-1 space-y-0.5">
        <p
          v-for="row in alchemyBuffRows"
          :key="row.buffId"
          class="flex items-baseline gap-1.5 text-body"
        >
          <span class="font-kai shrink-0 text-qing">{{ row.name }}</span>
          <span class="tabular text-ink-soft">{{ row.effect }}</span>
        </p>
      </div>
    </div>
    <p v-else class="mb-2 t-note text-ink-faint">
      炉前还是白身 —— 备一味
      <span class="text-qing">安神 · 澄心 · 定心</span>,双成 / 心得 / 护料即刻各涨一截
    </p>

    <!--
      丹方册 —— 按境界分章。

      ## 为什么换这一种排法

      此前是一个平面清单:现在料够的置顶,其余按丹方阶位置序。那是「我今天能炼哪几炉」
      的排法;而玩家站在丹炉前问的是**另一个问题**:

          我这境界该炼什么 / 下一境还差哪几张方子

      阶位与境界是两个轴。混在一个序列里之后,炼气那几张与混沌海那两张隔着几十行,
      靠的全是「料够不够」这个与境界无关的插队键。分章之后,玩家读到的是
      「这一境一共几张、我得了几张」,那才是他站在炉前要的那句话。

      ## 一章一行、点开才铺方子

      每章章首一行:境名 · 界域(仅跨界那一章)· 已得/共几张。默认只展开玩家此刻这一境
      —— 既不是全合着(那样每次要点一下才看得见自己在哪),也不是全展开(那就是回到
      那个平面长清单)。21 章一共 71 张方,展开一章最多七行。

      ## 折叠钮排在它自己展开的正文之前

      `docs/design.md` 的硬约束:一收一放,钮本身一步不动。故钮在 `[data-recipe-group-body]`
      之前,收放只动它下面那一块。
    -->
    <div
      v-if="recipeMeter.total > 0"
      :data-recipe-total="recipeMeter.total"
      :data-recipe-known="recipeMeter.known"
      :data-recipe-missing="recipeMeter.missing"
      :data-recipe-shown="shownRows"
    >
      <div class="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <p class="text-note text-ink-faint tabular" data-recipe-meter>
          丹方 <span class="text-ink">{{ recipeMeter.known }}</span
          >/{{ recipeMeter.total }} 已得<template v-if="recipeMeter.missing">
            · 缺 {{ recipeMeter.missing }} 张</template
          >
        </p>
        <p class="text-note text-ink-faint">按境界分章 · 点章首展开</p>
      </div>
      <input
        v-model="recipeQuery"
        type="text"
        inputmode="search"
        aria-label="搜方名"
        class="w-full rounded-[2px] border border-ink/15 bg-paper-deep/60 px-2.5 py-1.5 text-[16px] text-ink outline-none placeholder:text-ink-faint"
        placeholder="搜已得方名……"
      />
      <p
        v-if="recipeQuery.trim() !== '' && filteredGroups.length === 0"
        class="mt-1.5 px-0.5 text-note text-ink-faint"
      >
        已得的方子里没有叫「{{ recipeQuery.trim() }}」的 —— 未得的方子要到手之后才认得名字
      </p>
      <div
        v-if="filteredGroups.length"
        class="mt-1.5 divide-y divide-ink/10 border-y border-ink/10"
        data-recipe-ledger
      >
        <section
          v-for="g in filteredGroups"
          :key="g.major"
          :data-recipe-group="g.major"
          :data-recipe-group-known="g.known"
          :data-recipe-group-total="g.total"
        >
          <!--
            章首就是折叠钮:境名 + 界域(仅跨界那一章)+ 这一境的方子账。
            「缺 N」只在真有缺时写,尽得时不写「缺 0」—— 一屏二十一条「缺 0」是噪音。
          -->
          <button
            type="button"
            class="flex min-h-[28px] w-full items-baseline gap-1.5 px-0.5 py-1 text-left active:opacity-60"
            :aria-expanded="isGroupOpen(g)"
            :aria-controls="groupBodyId(g.major)"
            data-recipe-group-toggle
            @click="toggleGroup(g.major)"
          >
            <span class="w-3 shrink-0 text-note text-ink-faint" aria-hidden="true">{{
              isGroupOpen(g) ? "▾" : "▸"
            }}</span>
            <span class="shrink-0 font-kai text-body text-ink">{{ g.realmName }}</span>
            <span v-if="g.worldFirst" class="shrink-0 text-note text-qing">{{ g.worldName }}</span>
            <span class="min-w-0 grow text-note text-ink-faint tabular"
              >{{ g.known }}/{{ g.total
              }}<template v-if="g.missing"> · 缺 {{ g.missing }}</template></span
            >
            <span
              v-if="g.missing === 0"
              class="shrink-0 text-note text-jade"
              data-recipe-group-complete
              >尽得</span
            >
          </button>
          <div v-if="isGroupOpen(g)" :id="groupBodyId(g.major)" data-recipe-group-body>
            <!--
              已得的方子一行一张 —— 这一行是**扫读**用的,不是读账用的。

              只留四段:叫什么(楷体 + 品阶色)、多好(品阶名)、多难(阶位)、几成把握。
              存货、药力状态、欠料与越阶都收进右端那**一格状态**,不各占一段:
              一屏能扫 14 行靠的就是这个 —— 旧版每行 142px、一屏三张,
              正是因为它把代价、成品、双成、存货、短板与两枚动作全摊在行里。

              代价与成品是**点开之后**才逐项读的东西,故它们住在详情浮层。
              整行是一枚按钮:点开就出那一层的账,在那一层里开炉。
            -->
            <button
              v-for="row in g.knownRows"
              :key="row.def.id"
              type="button"
              :data-recipe-row="row.def.id"
              :data-recipe-ready="row.shortText ? undefined : ''"
              class="flex min-h-[28px] w-full items-baseline gap-1.5 border-t border-ink/6 px-0.5 py-1 text-left active:opacity-60 tinylens:flex-wrap tinylens:gap-x-1.5 tinylens:gap-y-0"
              @click="openRecipe(row)"
            >
              <GameIcon
                :name="row.def.icon"
                :size="14"
                class="shrink-0 self-center"
                :style="{ color: qualityDef(row.def.quality).color }"
              />
              <!--
                极窄档(195 CSS px)整行折成两段:方名独占一行,读数续在下一行。
                面板内宽只剩 147px,四段读数(品阶 / 阶位 / 存货 / 把握)加起来已经 134 ——
                方名若还挤在同一行,「聚气散」会被压成四个像素宽(自检量到 4.95px)。
              -->
              <span
                class="min-w-0 truncate font-kai text-body text-ink tinylens:basis-full"
                data-recipe-name
                >{{ row.def.name }}</span
              >
              <!-- 品阶名与「N 阶」并列:前者说这一炉多好,后者说这一方多难,谁也不顶替谁 -->
              <span
                class="shrink-0 font-medium text-note"
                :style="{ color: qualityDef(row.def.quality).color }"
                >{{ qualityDef(row.def.quality).name }}</span
              >
              <span class="shrink-0 text-note text-ink-faint">{{ row.able.rank }} 阶</span>
              <span
                class="shrink-0 text-note tabular"
                :class="row.stock > 0 ? 'text-ink-soft' : 'text-ink-faint'"
                >存 {{ row.stock }}</span
              >
              <!--
                一格状态:**能否立刻开炉**压在最前 —— 那是这一行最要紧的那件事。
                存货紧随其后(「炼了也是白占一格」同样是不该炼的理由,见 useBrewing 的
                buffOverflowOf)。两者共用一格,不各占一列:一屏能扫十几行靠的就是这个。
              -->
              <span v-if="row.shortText" class="shrink-0 text-note text-cinnabar" data-recipe-short
                >欠料</span
              >
              <span v-else-if="row.overflow === 'full'" class="shrink-0 text-note text-cinnabar"
                >已顶</span
              >
              <span v-else-if="row.overflow === 'partial'" class="shrink-0 text-note text-gold-ink"
                >将顶</span
              >
              <!-- 把握:必成窗口期报「必成」而非裸把握(与 engineCraft.rate 同源) -->
              <span
                class="ml-auto shrink-0 text-body tabular"
                :class="row.guaranteeLeft > 0 ? 'text-gold-ink' : rateClass(row.able.successRate)"
                data-recipe-rate
                >{{ row.guaranteeLeft > 0 ? "必成" : formatPercent(row.able.successRate) }}</span
              >
            </button>
            <p
              v-if="!g.knownRows.length"
              class="border-t border-ink/6 px-0.5 py-1.5 text-note text-ink-faint"
            >
              这一境还没得方 —— 去藏经阁翻书,或留意「失传丹方」奇缘
            </p>
            <p
              v-else-if="g.missing > 0"
              class="border-t border-ink/6 px-0.5 py-1.5 text-note text-ink-faint"
            >
              另有 {{ g.missing }} 张未到手 —— 到手之后才认得名字
            </p>
          </div>
        </section>
      </div>
    </div>
    <p v-else class="px-1 py-6 text-center t-body text-ink-faint">
      你还不知道任何丹方。
      <br />
      <span class="text-note">去藏经阁参悟,或留意「失传丹方」奇缘,新方自会翻出</span>
    </p>

    <!--
      百工技艺:做得多就精。技艺一直在影响成丹 —— 境地与进度条都在这,看得见自己在长。

      默认合着,理由与名号谱/秘境名录同一条纪律(docs/design.md:1080 与
      「收的是版面,不是内容」):九项技艺是**额外知识**,不是此刻的决定。
      炉前要决定的是「炼哪一炉、料够不够」;而九行技艺(每行还有一根进度条)
      在窄屏上要占半屏,摊在方子下面等于把方子压到折叠线以下。

      折叠钮排在它自己展开的正文之前 —— 一收一放钮本身一步不动。
    -->
    <div v-if="skillRows.length" class="mb-2 mt-3">
      <button
        type="button"
        class="flex min-h-[28px] w-full items-center justify-center gap-1.5 rounded-[2px] border border-dashed border-ink/15 px-3 py-1 text-note text-ink-faint active:scale-99 active:text-ink-soft"
        :aria-expanded="skillsOpen"
        :aria-controls="SKILLS_BODY_ID"
        data-brew-skills-toggle
        @click="skillsOpen = !skillsOpen"
      >
        <span aria-hidden="true">{{ skillsOpen ? "▾" : "▸" }}</span>
        {{ skillsOpen ? "收起百工技艺" : "看百工技艺" }} · 九项,做得多就精
      </button>
      <div
        v-show="skillsOpen"
        :id="SKILLS_BODY_ID"
        class="mt-1.5 rounded-[2px] bg-paper-deep/60 px-3 py-2"
        data-brew-skills-body
      >
        <div class="space-y-1">
          <div v-for="s in skillRows" :key="s.id">
            <p class="flex items-baseline gap-2 text-body tinylens:flex-wrap tinylens:gap-x-1.5">
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
              <span class="min-w-[9em] flex-1 t-note text-ink-faint tinylens:basis-full">{{
                s.desc
              }}</span>
            </p>
            <!-- 离下一境还差多少:境地内线性进度(见 skillStageProgress),同其余进度条共一根 ProgressBar -->
            <p class="mt-0.5 flex items-center gap-1.5 pl-14">
              <ProgressBar
                :value="s.progress"
                :color="s.stage === '生疏' ? 'var(--color-ink-faint)' : 'var(--color-jade)'"
                :height="4"
                class="flex-1"
              />
              <span class="w-7 shrink-0 text-right text-note tabular text-ink-faint">{{
                s.stage === "大成" ? "已顶" : formatPercent(s.progress, 0)
              }}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <button class="btn-seal w-full" @click="emit('close')">收 炉</button>
    </template>
  </BaseModal>

  <!--
    一炉的账 —— 点开方子才铺开的那一层。

    清单行只留「叫什么、多好、多难、几成把握」;代价(逐品灵草/灵石/炸炉返草)、
    成品(服之如何)、双成率、炉前存货与短板都是**点开之后**要逐项读的东西。
    把它们摊在清单行里,正是这一屏此前「一张方子 142px、一屏只看三张」的来源。

    动作也在这:读完账就地开炉,不必先关浮层再回清单找那一行。
  -->
  <BaseModal :open="detailRow !== null" :title="detailRow?.def.name ?? ''" top @close="closeRecipe">
    <div v-if="detailRow" data-recipe-detail :data-recipe-row-detail="detailRow.def.id">
      <div class="flex items-start gap-2.5">
        <GameIcon
          :name="detailRow.def.icon"
          :size="22"
          class="mt-0.5 shrink-0"
          :style="{ color: qualityDef(detailRow.def.quality).color }"
        />
        <div class="min-w-0 grow">
          <p class="flex flex-wrap items-baseline gap-2">
            <span class="font-kai text-title text-ink">{{ detailRow.def.name }}</span>
            <span
              class="font-medium text-note"
              :style="{ color: qualityDef(detailRow.def.quality).color }"
              >{{ qualityDef(detailRow.def.quality).name }}</span
            >
            <span class="text-note text-ink-faint">{{ detailRow.able.rank }} 阶</span>
            <span v-if="detailRow.able.overReach > 0" class="text-note text-cinnabar"
              >越阶 {{ detailRow.able.overReach }}</span
            >
          </p>
          <!-- 服之如何:方子清单此前只报代价与把握,不报成品 -->
          <p class="mt-0.5 t-note text-qing">{{ pillFuncText(detailRow.def) }}</p>
        </div>
        <!-- 这一炉的来路 —— 一小片,不占整行(理由见 style 里 .brew-scene 那段) -->
        <span class="brew-scene" aria-hidden="true">
          <InkScene
            :terrain="sceneTerrainOfHerbGrade(detailRow.cost.herbGrade)"
            :marks="'ground'"
          />
        </span>
      </div>

      <!-- 代价:五品灵草各自一品,总读数归一堆毫无意义 -->
      <p class="mt-2 text-body text-ink-faint tabular" data-recipe-cost>
        {{ HERB_GRADE_SHORT[detailRow.cost.herbGrade] }}灵草×{{ detailRow.cost.herb }} · 灵石
        {{ formatGN(detailRow.cost.stone) }} ·<template v-if="detailRow.shouzhuoLeft"
          >本世首败(任一炉)灵草全保</template
        ><template v-else>炸炉返草 ~{{ detailRow.keptHerb }} 株</template
        ><template v-if="toNum(detailRow.cost.stone) > 0"> · 灵石不退</template>
      </p>

      <div class="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span class="text-body">
          <span
            class="tabular text-title"
            :class="
              detailRow.guaranteeLeft > 0 ? 'text-gold-ink' : rateClass(detailRow.able.successRate)
            "
            >{{
              detailRow.guaranteeLeft > 0 ? "必成" : formatPercent(detailRow.able.successRate)
            }}</span
          >
          <span class="ml-1 text-note text-ink-faint">把握</span>
        </span>
        <!-- 平均炉数:百分比读数不直观,55% 像是"两炉成一炉",实际期望 1.8 炉 -->
        <span
          v-if="brewTriesText(detailRow)"
          class="whitespace-nowrap tabular text-note text-ink-faint"
          data-recipe-tries
          >{{ brewTriesText(detailRow) }}</span
        >
        <!-- 双成率也亮在炉前:骰子不藏 —— 与掷骰同一口径(alchemyBonusCapped,见行构造器) -->
        <span class="tabular text-note text-ink-soft"
          >{{ formatPercent(detailRow.doubleRate)
          }}<span class="ml-1 text-note text-ink-faint">双成</span></span
        >
        <!-- 炉前存货账:存几枚、药力顶没顶 —— 顶满还炼就是白占一格 -->
        <span class="tabular text-note">
          <span :class="detailRow.stock > 0 ? 'text-ink-soft' : 'text-ink-faint'"
            >存 {{ detailRow.stock }}</span
          >
          <span v-if="detailRow.overflow === 'full'" class="ml-1 text-cinnabar">已顶</span>
          <span v-else-if="detailRow.overflow === 'partial'" class="ml-1 text-gold-ink">将顶</span>
        </span>
      </div>
      <p v-if="detailRow.guaranteeLeft > 0" class="mt-1 text-note text-gold-ink tabular">
        本世前
        {{ craftGuaranteeCrafts(player.reincarnation.heritage) }} 炉保底 · 剩
        {{ detailRow.guaranteeLeft }} 炉
      </p>
      <p v-if="detailRow.shortText" class="mt-1.5 text-note text-cinnabar tabular">
        {{ detailRow.shortText }}
        <button
          v-if="detailRow.shortHerb"
          class="underline active:opacity-60"
          @click="emit('open-herb-shop')"
        >
          · 灵草坊可补 ›
        </button>
      </p>
      <p v-for="w in detailRow.able.weakness" :key="w" class="mt-1 text-note text-ink-faint">
        · {{ w }}
      </p>
    </div>
    <template #footer>
      <div v-if="detailRow" class="flex flex-wrap gap-1.5">
        <button
          class="btn-seal min-w-0 flex-1 whitespace-nowrap !px-3 !py-2"
          :disabled="detailRow.shortHerb || detailRow.shortStone"
          data-recipe-craft
          @click="craftOne(detailRow.def.id)"
        >
          炼制
        </button>
        <!-- 连炼 ×5:材料见底自停,成败与保料合一条提示(见 pillService.craftPillBatch) -->
        <button
          class="btn-ghost min-w-0 flex-1 whitespace-nowrap !px-3 !py-2"
          :disabled="detailRow.shortHerb || detailRow.shortStone"
          data-recipe-batch
          @click="craftMany(detailRow.def.id)"
        >
          连炼 ×{{ PILL_BATCH }}{{ batchGuaranteeText(detailRow.guaranteeLeft) }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { expectedTries } from "@/core/breakthrough";
import { computed, nextTick, ref, watch } from "vue";
import GameIcon from "@/components/common/GameIcon.vue";
import ProgressBar from "@/components/common/ProgressBar.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import InkScene from "@/components/common/InkScene.vue";
import { sceneTerrainOfHerbGrade } from "@/ui/sceneTerrain";
import { HERB_GRADES, HERB_GRADE_SHORT } from "@/data/herbGrades";
import { qualityDef } from "@/data/qualities";
import { PILL_BATCH } from "@/core/pillService";
import { craftGuaranteeCrafts } from "@/core/heritageEffects";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { formatGN, formatPercent } from "@/utils/format";
import { toNum } from "@/utils/gnum";
import { useBrewing, type BrewLedgerGroup, type BrewRecipeRow } from "@/composables/useBrewing";

const props = defineProps<{ open: boolean }>();
// craftOpen(页面状态)留 InventoryView,这里只回传事件:关炉走 close,
// 「灵草坊可补」走 open-herb-shop —— marketOpen 是主文件状态,弹窗不许越手改别人的账。
const emit = defineEmits<{ close: []; "open-herb-shop": [] }>();

const resources = useResourcesStore();
const player = usePlayerStore();

// 炉前的账全在 useBrewing —— 与主文件同源调用,这里不另抄任何一份 computed
const {
  alchemyBuffRows,
  skillRows,
  studyLine,
  herbGradeHeld,
  rateClass,
  craftPill: brewOne,
  craftBatch: brewBatch,
  batchGuaranteeText,
  pillFuncText,
  recipeLedgerGroups,
  recipeMeter,
} = useBrewing();

/**
 * 百工技艺默认合着 —— 它是额外知识,不是此刻的决定。
 * 状态留本组件(那一栏只属于这一扇窗),DOM id 供 aria-controls 指过去。
 */
const SKILLS_BODY_ID = "brew-skills-body";
const skillsOpen = ref(false);

/** 炉前搜已得方名:方子一旦上手得多照单海搜,输入即滤(空白显示全部) */
const recipeQuery = ref("");

/** 点开的是哪一炉 —— 详情浮层的唯一状态 */
const detailRow = ref<BrewRecipeRow | null>(null);

/**
 * 此刻展开的是哪一章 —— **一次只开一章**。
 *
 * 与藏珍的柜屉同一条规矩(「每柜一次只抽开一屉」):二十一境全摊开就是一个平面
 * 长清单 —— 实测 77 行 + 21 条章首全进 DOM,DOM 峰值 1143,越过那一档 1100 的
 * 预算(见 scripts/perf-profile 的数值注释)。而按章展开正是为了不让它长成那样。
 *
 * 默认展开玩家此刻那一境(见 core/pillRecipeLedger.defaultOpenMajor):那一刻他要
 * 决定的是「这一境还差哪几张方、现在能开哪几炉」。不记忆到存档 —— 这是一次开炉
 * 会话的临时视图,关炉即复位。
 *
 * `null` = 一章都不开(再点一次当前章就收回)。
 */
const openMajor = ref<number | null>(null);

function resetGroupState(): void {
  openMajor.value = recipeMeter.value.defaultMajor;
}

function toggleGroup(major: number): void {
  openMajor.value = openMajor.value === major ? null : major;
}

/**
 * 搜索时命中章一律展开 —— 搜出来的方子若还藏在一个合着的章里,
 * 那一次搜索等于没有结果。命中集通常只有一两张方,全展开也不长。
 */
function isGroupOpen(group: BrewLedgerGroup): boolean {
  if (recipeQuery.value.trim() !== "") return true;
  return openMajor.value === group.major;
}

function groupBodyId(major: number): string {
  return `brew-recipe-group-${major}`;
}

/**
 * 按方名过滤 —— 只搜**已得**方子。未得方连名字都还没有(与图鉴的 `???` 同一条纪律),
 * 拿它参与搜索会把「不知道自己缺什么」答成「你缺的那张叫某某」。
 */
const filteredGroups = computed<BrewLedgerGroup[]>(() => {
  const q = recipeQuery.value.trim();
  const groups = recipeLedgerGroups.value;
  if (!q) return groups;
  return groups
    .map((group) => ({
      ...group,
      knownRows: group.knownRows.filter((row) => row.def.name.includes(q)),
    }))
    .filter((group) => group.knownRows.length > 0);
});

/** 这一刻真正铺在册上的方子行数 —— 给运行时门一个可核的读数 */
const shownRows = computed(() =>
  filteredGroups.value
    .filter((group) => isGroupOpen(group))
    .reduce((sum, group) => sum + group.knownRows.length, 0),
);

/**
 * 换搜索词就是换一份清单。
 *
 * 不清窗口、不把焦点从输入框抢走(与全站其它长列表同一条纪律),
 * 但**开合要复位**:搜索期间命中章一律展开,清空之后必须回到「只展开当前境」——
 * 否则一次搜索会把二十一章全留在开着,那正是这一轮要消掉的那个长清单。
 */
watch(recipeQuery, () => {
  resetGroupState();
});

// 开炉即复位:每次都从「玩家此刻那一境」开始看,不继承上一次开合的残态
watch(
  () => props.open,
  (open) => {
    if (!open) {
      detailRow.value = null;
      return;
    }
    skillsOpen.value = false;
    recipeQuery.value = "";
    resetGroupState();
  },
  { immediate: true },
);

function openRecipe(row: BrewRecipeRow): void {
  detailRow.value = row;
}

function closeRecipe(): void {
  detailRow.value = null;
}

/**
 * 炉前动作会耗料,「已得 / 缺几张」与行上的存货读数都会变,但不改册上的章序
 * (序按境界,与料无关)。仍把焦点送回同一张方:浮层收起后焦点不该落回页面顶端。
 */
function craftOne(id: string): void {
  brewOne(id);
  detailRow.value = null;
  focusRecipeRowById(id);
}

function craftMany(id: string): void {
  brewBatch(id);
  detailRow.value = null;
  focusRecipeRowById(id);
}

function focusRecipeRowById(id: string): void {
  void nextTick(() => {
    const selector = `[data-recipe-row="${CSS.escape(id)}"]`;
    const row = document.querySelector<HTMLElement>(selector);
    if (row) {
      row.focus();
      return;
    }
    /*
     * 行不在 DOM:它所在的章合着,或搜索词把它滤掉了。把那一章打开再聚焦 ——
     * 焦点落到已销毁的节点上时,键盘用户会静默回到页面顶端。
     */
    const group = recipeLedgerGroups.value.find((g) =>
      g.knownRows.some((candidate) => candidate.def.id === id),
    );
    if (!group) return;
    openMajor.value = group.major;
    void nextTick(() => document.querySelector<HTMLElement>(selector)?.focus());
  });
}

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

<style scoped>
/*
 * 一炉的来路 —— 详情浮层右上一小片,不占整行。
 *
 * 这一小片与行首那枚图标是同一个意思(这一炉的来路),只是画得出来
 * 「哪一品、哪个境界」。原先它在清单的每一行右侧:一屏几十行就是几十片,
 * 而清单行这一轮已经收成单行 —— 画移到详情里,只画你正在读的这一炉。
 *
 * 定宽定高、绝对定位承在行内:`relative` 的定位盒是这一格自己,
 * `overflow: hidden` 让画只在这一格内画。
 */
.brew-scene {
  --ink-scene-h: 3.4rem;
  --ink-scene-ink: 0.9;
  position: relative;
  display: block;
  width: 3.4rem;
  height: 3.4rem;
  flex: none;
  overflow: hidden;
  pointer-events: none;
}
.brew-scene .ink-scene {
  position: absolute;
  inset: 0;
  height: 100%;
}
</style>
