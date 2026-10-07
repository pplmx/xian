<template>
  <div class="stagger-in space-y-4 px-4 pb-6 pt-4">
    <div class="flex items-center gap-2">
      <RouterLink
        to="/character"
        class="-my-1.5 py-1.5 text-[12px] text-ink-faint active:text-ink-soft"
        >← 人物</RouterLink
      >
      <span class="text-[11px] text-ink-faint">·</span>
      <span class="text-[12px] text-ink-soft">界域志</span>
    </div>

    <SectionTitle title="界域志" :hint="`境界名从哪来 · 已至「${realmDef(player.major).name}」`" />
    <!--
      这一册装着两半:界域 / 典籍是「名物的来路」(只读),周易 / 紫微 / 星象 /
      奇门是「术数四门」(有当下)。两半混在一排页签里,若不标出来就看不出后四册是活的 ——
      周易有卦在身时挂一朱点(与图鉴「收藏」、天界「远征」同款)。
    -->
    <InkTabs v-model="codexTab" :tabs="codexTabRows" />

    <template v-if="codexTab === 'realm'">
      <!-- 界域与境界:逐境写明出处与承接 -->
      <!-- 每一界的段名字带它自己的色(人间朱/仙青/神紫/混沌蓝) —— 这条路历过几界,色卡一样摊开;
         此刻所在的格子随你身处之界的信标色亮起(见 .codex-current) -->
      <section
        v-for="row in worldRows"
        :key="row.world.id"
        class="card-ink px-4 py-3"
        :data-world="row.world.id"
      >
        <div class="flex items-baseline gap-2">
          <span class="world-seal font-kai text-[15px] tracking-[0.25em]">{{
            row.world.name
          }}</span>
          <span class="text-[10px] text-ink-faint"
            >第 {{ row.world.start + 1 }}–{{ row.world.end + 1 }} 境</span
          >
        </div>
        <p class="mt-0.5 text-[11px] leading-relaxed text-ink-faint">{{ row.world.desc }}</p>
        <div class="mt-2 space-y-2">
          <div
            v-for="cell in row.realms"
            :id="`realm-${cell.def.id}`"
            :key="cell.def.id"
            class="rounded-md px-2.5 py-2"
            :class="cell.index === player.major ? 'codex-current' : 'bg-paper-deep/50'"
          >
            <p class="flex items-center gap-2">
              <span
                class="font-kai text-[14px] tracking-wider"
                :class="
                  cell.index === player.major
                    ? ''
                    : cell.index < player.major
                      ? 'text-ink-soft'
                      : 'text-ink-faint'
                "
              >
                {{ cell.def.name }}
              </span>
              <span class="chip-ink !text-[9px]">{{ cell.def.basis }}</span>
              <span v-if="cell.index === player.major" class="text-[9px]">此刻在此</span>
            </p>
            <p class="mt-0.5 text-[11px] leading-relaxed text-ink-soft">{{ cell.def.desc }}</p>
            <p class="mt-1 text-[11px] leading-relaxed text-ink-faint">{{ cell.def.lore }}</p>
            <!-- 此境所据何典:把「境界 → 原典」这条来路直接摆在该境底下 -->
            <!-- 所据何典:点一下就跳到「典籍」那一册 —— codex 要能顺着来路追下去 -->
            <p
              v-if="classicsOf(cell.def.id).length"
              class="mt-1 flex flex-wrap items-center gap-x-1.5 text-[10px] text-ink-faint"
            >
              <span>所据:</span>
              <!-- 行内链接给 28px 触达面(inline-flex min-h),与历练页那枚同款 -->
              <button
                v-for="c in classicsOf(cell.def.id)"
                :key="c.id"
                class="inline-flex min-h-[28px] items-center text-qing underline underline-offset-2 active:opacity-60"
                :aria-label="`查看典籍《${c.title}》`"
                @click="gotoClassic(c.id)"
              >
                《{{ c.title }}》
              </button>
            </p>
          </div>
        </div>
      </section>
    </template>

    <template v-if="codexTab === 'classics'">
      <!-- 典籍:境界名背后的原典 -->
      <SectionTitle title="典籍" hint="所述者传统道教、佛教、道家与丹道之书" />
      <section class="space-y-2">
        <article
          v-for="c in CLASSICS"
          :id="`classic-${c.id}`"
          :key="c.id"
          class="card-ink px-4 py-3"
        >
          <p class="flex flex-wrap items-center gap-2">
            <span class="font-kai text-[14px] text-ink">《{{ c.title }}》</span>
            <span class="chip-ink !text-[9px]">{{ c.school }}</span>
            <span class="text-[10px] text-ink-faint">{{ c.source }}</span>
          </p>
          <p class="mt-1 text-[11px] leading-relaxed text-ink-soft">{{ c.gist }}</p>
          <!-- 相涉何境:点一下跳回「界域」那一段 —— 反向也能追 -->
          <p
            v-if="c.realms.length"
            class="mt-1 flex flex-wrap items-center gap-x-1.5 text-[10px] text-ink-faint"
          >
            <span>相涉:</span>
            <button
              v-for="id in c.realms"
              :key="id"
              class="inline-flex min-h-[28px] items-center text-qing underline underline-offset-2 active:opacity-60"
              :aria-label="`查看境界「${realmName(id)}」`"
              @click="gotoRealm(id)"
            >
              {{ realmName(id) }}
            </button>
          </p>
        </article>
      </section>
    </template>

    <template v-if="codexTab === 'yi'">
      <!-- 周易:读过之后可以真的问一卦 -->
      <SectionTitle
        title="周易"
        :hint="`${cnNumber(TRIGRAMS.length)}卦为体,${cnNumber(HEXAGRAMS.length)}卦为用`"
      />
      <section class="card-ink px-4 py-3">
        <p class="text-[11px] leading-relaxed text-ink-faint">
          「易」不是书斋里的摆设:八卦各主一事之势,重卦由上下相叠 ——
          下卦为身,上卦为境,故一卦之力是内外相济的两股。摇得之卦在身,过时自散。
        </p>

        <!-- 在身之卦 -->
        <div v-if="currentReading" class="mt-3 rounded-md bg-paper-deep/50 px-3 py-2.5">
          <p class="flex flex-wrap items-center gap-2">
            <span class="font-kai text-[16px] tracking-widest text-cinnabar"
              >{{ currentReading.hexagram.name }}卦</span
            >
            <span class="text-[10px] text-ink-faint tabular">
              上{{ currentReading.upper.name }}{{ currentReading.upper.symbol }} · 下{{
                currentReading.lower.name
              }}{{ currentReading.lower.symbol }}
            </span>
            <span v-if="currentReading.changed" class="chip-ink !text-[9px]"
              >之{{ currentReading.changed.name }}</span
            >
            <span class="ml-auto text-[10px] tabular text-ink-faint"
              ><span class="countdown-slot">{{ remainText }}</span></span
            >
          </p>
          <div class="mt-1.5 space-y-0.5 font-kai text-[12px] tracking-[0.2em] text-ink-soft">
            <p v-for="(bar, i) in drawnLines" :key="i">{{ bar }}</p>
          </div>
          <p class="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
            {{ currentReading.hexagram.gist }}
          </p>
          <p
            v-for="(line, i) in counsel"
            :key="`c${i}`"
            class="mt-0.5 text-[11px] leading-relaxed text-ink-faint"
          >
            {{ line }}
          </p>
          <p class="mt-1.5 text-[11px] text-qing">在身之力:{{ powerText }}</p>
        </div>

        <!-- 读屏:散卦没有 toast 可依,整块消失的那一瞬必须自报(成卦由 toast 落地即念) -->
        <p aria-live="polite" class="sr-only">{{ readingAnnounce }}</p>

        <div class="mt-2.5 flex items-center gap-2">
          <button class="btn-ghost !py-1.5 !text-[12px]" :disabled="askDisabled" @click="ask">
            {{ askLabel }}
          </button>
          <span class="text-[10px] leading-relaxed text-ink-faint">
            卜以决疑,不疑何卜 —— 一事不二卜,卦力随动爻而盛,亦随时而尽。
          </span>
        </div>
      </section>

      <!-- 八卦 -->
      <section class="card-ink divide-y divide-ink/7 px-4">
        <!-- 320px 窄窗:卦辞挪到自己一行,宜/忌靠右 —— 卦名+象+宜忌一行,卦辞整行不被挤成一根线 -->
        <div v-for="t in TRIGRAMS" :key="t.id" class="py-2.5">
          <p class="flex flex-wrap items-start gap-x-2 gap-y-0.5">
            <span class="w-[52px] shrink-0 font-kai text-[15px] text-ink"
              >{{ t.symbol }} {{ t.name }}</span
            >
            <span class="shrink-0 text-[10px] text-ink-faint"
              >象{{ t.image }} · {{ t.nature }}</span
            >
            <span class="ml-auto shrink-0 text-[10px] text-jade">宜{{ t.good }}</span>
            <span class="shrink-0 text-[10px] text-cinnabar">忌{{ t.bad }}</span>
          </p>
          <p class="mt-0.5 text-[11px] leading-relaxed text-ink-soft">{{ t.gist }}</p>
        </div>
      </section>

      <!-- 六十四卦:全表可查,但不必时时铺开 -->
      <section class="card-ink px-4 py-3">
        <button
          class="flex w-full items-center justify-between text-left active:opacity-60"
          :aria-expanded="showAllHex"
          @click="showAllHex = !showAllHex"
        >
          <span class="font-kai text-[13px] tracking-wider text-ink"
            >{{ cnNumber(HEXAGRAMS.length) }}卦</span
          >
          <span class="text-[10px] text-qing">{{
            showAllHex ? "收起" : `展开查看 ${HEXAGRAMS.length} 卦 →`
          }}</span>
        </button>
        <div v-if="showAllHex" class="mt-2 max-h-72 divide-y divide-ink/6 overflow-y-auto">
          <div v-for="x in HEXAGRAMS" :key="x.order" class="flex items-baseline gap-2 py-2">
            <span class="w-6 shrink-0 tabular text-[10px] text-ink-faint">{{ x.order }}</span>
            <span class="w-14 shrink-0 font-kai text-[13px] text-ink">{{ x.name }}</span>
            <span class="w-16 shrink-0 text-[10px] text-ink-faint tabular">
              {{ trigramDef(x.upper)?.symbol }}{{ trigramDef(x.lower)?.symbol }}
            </span>
            <span class="min-w-0 text-[11px] leading-relaxed text-ink-soft">{{ x.gist }}</span>
          </div>
        </div>
      </section>
    </template>

    <template v-if="codexTab === 'ziwei'">
      <!-- 紫微:一世之格,与周易的「一时之机」分工 -->
      <SectionTitle title="紫微" :hint="`${cnNumber(PALACES.length)}宫定一世之格,与问卦分工`" />
      <section class="card-ink px-4 py-3">
        <p class="text-[11px] leading-relaxed text-ink-faint">
          紫微斗数本当以生辰起五行局再安诸星,游戏内没有生辰 —— 故此门只取**{{
            cnNumber(PALACES.length)
          }}宫所主**与**{{
            cnNumber(STARS.length)
          }}主星的星性**,按灵根与轮回归属安星:是取象义,不是排盘。
          卦是一时之机(可问、有时限),命是一世之格(常驻、转世重算,力薄为底色)。
        </p>
        <p class="mt-2 font-kai text-[13px] leading-relaxed text-ink">{{ fateLordLineText }}</p>
        <p class="mt-1 text-[11px] text-qing">命格之力:{{ fateModsText }}</p>
        <div class="mt-2.5 divide-y divide-ink/6">
          <div
            v-for="row in fateRows"
            :key="row.palace.id"
            class="flex items-baseline gap-2 py-1.5"
          >
            <span class="w-14 shrink-0 font-kai text-[12px] text-ink-soft">{{
              row.palace.name
            }}</span>
            <span class="w-24 shrink-0 text-[11px] text-cinnabar">{{ row.starNames }}</span>
            <span class="min-w-0 text-[11px] leading-relaxed text-ink-faint"
              >{{ row.palace.domain }} · {{ row.palace.use }}</span
            >
          </div>
        </div>
        <div class="mt-2 border-t border-ink/10 pt-2">
          <p class="text-[10px] text-ink-faint">{{ cnNumber(STARS.length) }}主星</p>
          <p v-for="s in STARS" :key="s.id" class="mt-1 text-[11px] leading-relaxed text-ink-soft">
            <span class="font-kai text-ink">{{ s.name }}</span>
            <span class="text-ink-faint"> · {{ s.nature }} · {{ s.gist }}</span>
          </p>
        </div>
      </section>
    </template>

    <template v-if="codexTab === 'xiang'">
      <!-- 星象:二十八宿值日,利一方界域 -->
      <SectionTitle title="星象" :hint="`${cnNumber(MANSIONS.length)}宿值日,分野为读、四象为用`" />
      <section class="card-ink px-4 py-3">
        <p class="font-kai text-[13px] leading-relaxed text-ink">{{ mansionLine }}</p>
        <p class="mt-1 text-[11px] leading-relaxed text-ink-faint">
          分野依《晋书·天文志》(诸家小异)只作来历读 —— 游戏里的地界不是九州。
          管用的是下面这条**游戏约定**:{{ cnNumber(IMAGES.length) }}象配{{
            cnNumber(WORLDS.length)
          }}界({{ imageWorldMap }}), 值日之宿所属之象,所配界域今日际遇更易(乘在际遇概率上 +{{
            formatPercent(MANSION_EVENT_LUCK, 0)
          }}),他处不加。
        </p>
        <p class="mt-1.5 text-[11px] text-qing">
          今日利 <span class="text-gold-ink">{{ favoredWorldName }}</span> ——
          与天时不同:天时是全境之气,星象只利一方。
        </p>
        <button
          class="mt-1.5 inline-flex min-h-[28px] items-center text-[11px] text-qing underline underline-offset-2 active:opacity-60"
          @click="goAdventure"
        >
          去 {{ favoredWorldName }} 历练 →
        </button>
        <button
          class="mt-2 w-full text-left text-[10px] text-qing active:opacity-60"
          :aria-expanded="showAllMansions"
          @click="showAllMansions = !showAllMansions"
        >
          {{
            showAllMansions
              ? `收起${cnNumber(MANSIONS.length)}宿`
              : `展开查看 ${MANSIONS.length} 宿 →`
          }}
        </button>
        <div v-if="showAllMansions" class="mt-2 divide-y divide-ink/6">
          <template v-for="img in IMAGES" :key="img.id">
            <p class="pt-2 text-[10px] text-ink-faint">
              {{ img.direction }}方 {{ img.name }} · 所配{{ worldName(img.world) }}
            </p>
            <div
              v-for="m in mansionsOf(img.id)"
              :key="m.name"
              class="flex items-baseline gap-2 py-1.5"
            >
              <span class="w-12 shrink-0 font-kai text-[13px] text-ink">{{ m.name }}</span>
              <span class="w-20 shrink-0 text-[10px] text-ink-faint">{{ m.fullName }}</span>
              <span class="w-12 shrink-0 text-[10px] text-ink-faint">{{ m.domain }}</span>
              <span class="min-w-0 text-[11px] leading-relaxed text-ink-soft">{{ m.good }}</span>
            </div>
          </template>
        </div>
      </section>
    </template>

    <template v-if="codexTab === 'qimen'">
      <!-- 奇门:九宫八门,择门而入 -->
      <SectionTitle title="奇门" :hint="`九宫${cnNumber(GATES.length)}门,择门而入`" />
      <section class="card-ink px-4 py-3">
        <p class="text-[11px] leading-relaxed text-ink-faint">
          {{ cnNumber(GATES.length) }}门依洛书九宫排布:{{ luoshuGatesText }}。
          远征启程前可择一门入界 —— 不是与天道立契(那换的是道源),
          择门改的是这一趟的**打法**:续航、抢攻、守拙或速决。
        </p>
        <div class="mt-2.5 divide-y divide-ink/6">
          <div v-for="g in GATES" :key="g.id" class="flex items-start gap-2 py-2">
            <span
              class="w-12 shrink-0 font-kai text-[13px]"
              :class="
                g.kind === '凶' ? 'text-cinnabar' : g.kind === '吉' ? 'text-jade' : 'text-ink-soft'
              "
            >
              {{ g.fullName }}
            </span>
            <span class="w-20 shrink-0 text-[10px] text-ink-faint tabular"
              >{{ g.gua }}{{ g.direction }} · {{ g.palace }}宫 · {{ g.kind }}</span
            >
            <span class="min-w-0 text-[11px] leading-relaxed text-ink-soft">{{ g.gist }}</span>
          </div>
        </div>
        <p class="mt-2 text-[10px] leading-relaxed text-ink-faint">
          门的效果全部用既有的战斗规则表达,不另造字段 —— 不择门(走常道)时,规则与从前逐字相同。
        </p>
        <!-- 志 → 行动:门讲得再清楚,也得递出「去哪儿择」这一步 -->
        <button
          class="mt-1.5 inline-flex min-h-[28px] items-center text-[11px] text-qing underline underline-offset-2 active:opacity-60"
          @click="goExped"
        >
          去天道远征 · 择门入界 →
        </button>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useNow } from "@/composables/useNow";
import { usePlayerStore } from "@/stores/player";
import { useGameStore } from "@/stores/game";
import { useUiStore } from "@/stores/ui";
import { useResourcesStore } from "@/stores/resources";
import { REALMS, WORLDS, realmDef } from "@/data/realms";
import { CLASSICS, classicsForRealm } from "@/data/classics";
import { HEXAGRAMS, TRIGRAMS, trigramDef } from "@/data/yijing";
import {
  DIVINATION_COST,
  drawLines,
  readingCounsel,
  readingFromState,
  readingMinutes,
} from "@/core/divination";
import { askDivination } from "@/core/divinationService";
import { PALACES, STARS } from "@/data/ziwei";
import { fateLordLine } from "@/core/fate";
import { IMAGES, MANSIONS, type ImageId } from "@/data/xiangxiu";
import { GATES } from "@/data/qimen";
import { cnNumber, formatCountdown, formatPercent } from "@/utils/format";
import { MANSION_EVENT_LUCK, favoredWorld, todayMansion, todayMansionLine } from "@/core/astronomy";
import { worldDef } from "@/data/realms";
import type { WorldId } from "@/types";
import { modsText } from "@/ui/statNames";
import SectionTitle from "@/components/common/SectionTitle.vue";
import InkTabs from "@/components/common/InkTabs.vue";

const player = usePlayerStore();
const game = useGameStore();
const ui = useUiStore();
const resources = useResourcesStore();
const now = useNow();

/** 分册:六门各占一册 —— 页越长越该分,免得一路拉到底找不着北 */
type CodexTab = "realm" | "classics" | "yi" | "ziwei" | "xiang" | "qimen" | "todo";
const CODEX_TABS: { id: CodexTab; label: string }[] = [
  { id: "realm", label: "界域" },
  { id: "classics", label: "典籍" },
  { id: "yi", label: "周易" },
  { id: "ziwei", label: "紫微" },
  { id: "xiang", label: "星象" },
  { id: "qimen", label: "奇门" },
];
const codexTab = ref<CodexTab>("realm");
/** 卦在身:周易那一册挂朱点 —— 时限制的一卦在跑,得让人看得见 */
const codexTabRows = computed(() =>
  CODEX_TABS.map((t) => ({ ...t, dot: t.id === "yi" && !!player.activeDivination })),
);

const showAllHex = ref(false);

/** 在身之卦:读一次心跳,过期的卦才会自己消失(与 player 的判定同一个办法) */
const currentReading = computed(() => {
  void game.totalPlaySec;
  const state = player.activeDivination;
  return state ? readingFromState(state) : null;
});
const drawnLines = computed(() => (currentReading.value ? drawLines(currentReading.value) : []));
const counsel = computed(() => (currentReading.value ? readingCounsel(currentReading.value) : []));
const powerText = computed(() => (currentReading.value ? modsText(player.divinationMods) : ""));
const remainText = computed(() => {
  void game.totalPlaySec;
  const state = player.activeDivination;
  if (!state) return "";
  const sec = Math.max(0, Math.floor((state.expiresAt - now.value) / 1000));
  // 倒计时一律走 formatCountdown(定宽补零)+ .countdown-slot 槽 —— 秒表每秒心跳,
  // 手拼的「尚余 5 分 3 秒 → 5 分 30 秒 → 9 秒」位数不定,行内会跟着跳
  // (全库唯一漏网的手写秒表,其余倒计时都走同一条纪律,见 uiLayering 审计)。
  return `尚余 ${formatCountdown(sec)}`;
});

/**
 * 读屏只管「有→无」的散卦:卦是后台随时间自散的,整块 v-if=currentReading
 * 会在某一跳里安静消失、按钮随之复活 —— 无 toast 可依,散的那一瞬不念一句,
 * 读屏玩家就只知道它没了。以「有无」布尔为观察对象:当前卦每秒心跳都在换新
 * 对象,watch 身份只会每秒误触发;`!currentReading` 只在成卦(假→真)与散卦
 * (真→假)两个瞬间翻转。成卦由 toast 落地即念(ToastHost 已全库开口),这里
 * 只报散卦,不重报。
 */
const hasReading = computed(() => !!currentReading.value);
const readingAnnounce = ref("");
watch(hasReading, (nv, ov) => {
  if (nv || !ov) return;
  readingAnnounce.value = "卦力已散,可再问一卦";
});

/** 问卦付不起就置灰+列差:与进修/熔炉同款纪律 —— 按钮上直说差几枚悟道
 * (判据与 core/divinationService 的 hasSmall 同一本账:短额 = 现有 - 需扣) */
const askShort = computed(() => Math.max(0, DIVINATION_COST - resources.wudao));
const askDisabled = computed(() => !!player.activeDivination || askShort.value > 0);
const askLabel = computed(() => {
  if (player.activeDivination) return "卦在身,待其自过";
  if (askShort.value > 0) return `问卦 · 尚差 ${askShort.value} 悟道点`;
  return `问 卦(悟道点 ${DIVINATION_COST})`;
});

function ask(): void {
  const out = askDivination();
  if (!out.ok) {
    ui.toast(out.reason ?? "未成卦", "warn");
    return;
  }
  const r = out.reading!;
  // 播报(toast live 区)附带存续时长:卦是自散的,散之前玩家先得知道它活多久
  ui.toast(
    `得「${r.hexagram.name}」卦${r.changed ? `,之${r.changed.name}` : ""},约 ${readingMinutes(r)} 分自散`,
    "info",
  );
}

// 命格:一世不变的一张盘(转世重算),故不必计时,直接读 player 的派生值
const fateLordLineText = computed(() => fateLordLine(player.fateChart));
const fateModsText = computed(() => modsText(player.fateMods));
const fateRows = computed(() =>
  player.fateChart.palaces.map((p) => ({
    palace: p.palace,
    starNames: p.stars.map((s) => `${s.name}(${s.nature})`).join("、"),
  })),
);

// 星象:值日之宿与所利界域(由游戏日派生,随心跳刷新)
const showAllMansions = ref(false);
const mansionLine = computed(() => todayMansionLine());
const favoredWorldName = computed(() => worldDef(favoredWorld(todayMansion())).name);
function worldName(id: WorldId): string {
  return worldDef(id).name;
}
function mansionsOf(image: ImageId) {
  return MANSIONS.filter((m) => m.image === image);
}

/**
 * 洛书九宫的排布句 —— **从 GATES 表推出来,不手写**。
 *
 * 这句话本质是一张地图(哪一门坐哪一宫、朝哪一方),手写一份就等于把
 * 八门的方向抄了第二遍:改门的位置或加一门,句子会开始说假话。
 * 中五无门是九宫的固有事实(不是一张门),故由循环补出。
 */
const luoshuGatesText = computed(() =>
  Array.from({ length: 9 }, (_, i) => {
    const palace = i + 1;
    const gate = GATES.find((g) => g.palace === palace);
    return gate
      ? `${gate.gua}${cnNumber(palace)}${gate.direction}${gate.fullName}`
      : `中${cnNumber(palace)}无门`;
  }).join("、"),
);

/** 四象各配哪一界 —— 游戏约定写在 IMAGES 表里,这句只是把它读出来 */
const imageWorldMap = computed(() =>
  IMAGES.map((i) => `${i.direction}配${worldName(i.world)}`).join("、"),
);

const worldRows = computed(() =>
  WORLDS.map((w) => ({
    world: w,
    realms: REALMS.map((def, index) => ({ def, index })).filter(
      (c) => c.index >= w.start && c.index <= w.end,
    ),
  })),
);

function realmName(id: string): string {
  const idx = REALMS.findIndex((r) => r.id === id);
  return idx >= 0 ? realmDef(idx).name : id;
}

/** 此境所据的原典(来自典籍表,不在视图里手写) */
function classicsOf(realmId: string) {
  return classicsForRealm(realmId);
}

/**
 * 志里两半互指:点「所据」跳到典籍那一册,点「相涉」跳回界域那一段。
 *
 * 一部志若只能从头读到尾、不能顺着线索走,就只是一篇长文;能互指才是「志」。
 * 切完册等一帧再滚 —— 目标要等目标册渲染出来才在 DOM 里。
 */
async function jumpTo(tab: CodexTab, elId: string): Promise<void> {
  codexTab.value = tab;
  await nextTick();
  document.getElementById(elId)?.scrollIntoView({ block: "center" });
}
function gotoClassic(id: string): void {
  void jumpTo("classics", `classic-${id}`);
}
function gotoRealm(id: string): void {
  void jumpTo("realm", `realm-${id}`);
}

// ---- 志 → 行动:把「讲清楚」接回「去哪儿做」 ----
const router = useRouter();
/** 奇门:择门入界在「天道远征」里做 —— 带着 ?tab=exped 直接落到远征册 */
function goExped(): void {
  void router.push({ path: "/celestial", query: { tab: "exped" } });
}
/** 星象:今日利的一方,去历练里兑现 */
function goAdventure(): void {
  void router.push("/adventure");
}
</script>
