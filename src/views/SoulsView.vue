<template>
  <div class="folio-page folio-page--stack stagger-in soul-page">
    <FolioPageHeader
      title="器 魂"
      subtitle="形销意存 · 三席成阵"
      back-to="celestial"
      back-label="天界"
      featured
    >
      <template v-if="unlocked" #visual>
        <SoulForgeMap
          :seats="soulSeats"
          :idle-count="soulPulse.idleSouls.length"
          :refinable-count="soulPulse.refinableCount"
          :affordable-refines="soulPulse.affordableRefines"
        />
      </template>

      <template v-if="unlocked" #action>
        <div class="soul-source">
          <span class="soul-source__label">道源</span>
          <strong class="soul-source__value tabular">{{ formatNum(endgame.daoSource) }}</strong>
          <button type="button" class="soul-source__button" @click="forgeOpen = true">开炉</button>
        </div>
      </template>

      <!-- 卷首先报此刻:下一步、三席、闲置与可凝各有多少当下能动手 -->
      <LedgerPulse
        v-if="unlocked"
        class="soul-pulse"
        data-soul-pulse
        :seal="soulLead.mark"
        eyebrow="此刻器魂"
        :title="soulLead.title"
        :description="soulLead.detail"
        :tally-columns="3"
      >
        <template #actions>
          <button
            v-if="soulLead.label"
            type="button"
            class="folio-ledger-pulse__action"
            @click="runSoulLead"
          >
            {{ soulLead.label }}
          </button>
        </template>

        <template #tallies>
          <LedgerTally
            v-for="row in soulLedgerRows"
            :key="row.id"
            :mark="row.mark"
            :label="row.label"
            :value="row.value"
            :total="row.total"
            :unit="row.unit"
            :detail="row.detail"
            :data-soul-pulse-active="row.id === 'active' ? row.value : undefined"
            :data-soul-pulse-idle="row.id === 'idle' ? row.value : undefined"
            :data-soul-pulse-refine="row.id === 'refine' ? row.value : undefined"
            @select="runSoulLedger(row.id)"
          />
        </template>
      </LedgerPulse>
    </FolioPageHeader>

    <!-- 未至真仙:器魂随天门而启,不在凡境提前占行囊 -->
    <UnopenedFolio
      v-if="!unlocked"
      title="器 魂"
      eyebrow="形意未生"
      lead="凡器未历天道,何来形意。器魂不是另一套背包,而是天门开启后从旧器留下的路数。"
      :hint="`此册与天界同门。修至真仙后,才需要挑法器入炉、取舍 ${SOUL_SLOTS} 枚器魂。`"
      :current-realm="player.realmName"
      :current-major="player.major"
      :gate-realm="realmDef(WORLD_BREAK_MAJOR).name"
      :gate-major="WORLD_BREAK_MAJOR"
    />

    <template v-else>
      <!-- 三席:名字、词条与动作都在同一枚席位里读清 -->
      <section class="soul-seats" data-soul-slots>
        <SectionTitle
          title="三席"
          :hint="
            activeModText
              ? `${soulPulse.activeCount}/${soulPulse.slotTotal} 席`
              : `${soulPulse.activeCount}/${soulPulse.slotTotal} 席 · 尚无形意`
          "
        />
        <div class="mt-2 grid soul-seat-grid grid-cols-3 gap-2 tinylens:grid-cols-2">
          <div
            v-for="i in SOUL_SLOTS"
            :key="i"
            class="card-ink soul-seat flex min-h-[104px] min-w-0 flex-col px-2 py-2"
            :class="soulAt(i) ? 'soul-seat--filled' : 'soul-seat--empty'"
          >
            <template v-if="soulAt(i)">
              <button
                class="soul-seat__detail flex min-w-0 flex-1 flex-col items-center justify-center px-1 text-center active:scale-95"
                :aria-label="detailLabel(soulAt(i)!)"
                @click="openSoulDetail(i)"
              >
                <span
                  class="soul-seat__mark font-kai leading-none"
                  :style="{ color: soulColor(soulAt(i)!) }"
                >
                  {{ soulSeal(soulAt(i)!) }}
                </span>
                <span class="soul-seat__name mt-1 text-note leading-tight text-ink-soft">{{
                  soulLabel(soulAt(i)!)
                }}</span>
                <span
                  class="soul-seat__mods mt-0.5 w-full text-note leading-tight text-ink-faint"
                  >{{ soulModText(soulAt(i)!) }}</span
                >
              </button>
              <button
                class="tap-row soul-seat__remove mt-1 min-w-[28px] px-2 py-1.5 text-note text-ink-faint active:opacity-60"
                :aria-label="`卸下 ${soulLabel(soulAt(i)!)}`"
                @click="removeSoul(soulAt(i)!.uid)"
              >
                卸下
              </button>
            </template>
            <template v-else>
              <span class="soul-seat__empty">空席</span>
              <button
                v-if="soulPulse.idleSouls.length > 0"
                class="tap-row soul-seat__wear mt-1 min-w-[28px] px-2 py-1.5 text-note text-cinnabar active:opacity-60"
                aria-label="空槽 · 挑一缕装配"
                @click="idleOpen = true"
              >
                装配
              </button>
              <span v-else class="soul-seat__hint">待凝形意</span>
            </template>
          </div>
        </div>
        <p v-if="activeModText" class="soul-seat-total"><span>合计</span>{{ activeModText }}</p>
      </section>

      <!-- 两处门径:闲置形意与凝炼台各报自己的真实账 -->
      <section class="soul-gateways" data-soul-gateways>
        <SectionTitle title="两处门径" hint="散置形意 · 凝炼台" />
        <div class="soul-gateway-grid mt-2">
          <button
            type="button"
            class="soul-gateway hoverable:hover:border-cinnabar"
            data-soul-gateway="idle"
            @click="idleOpen = true"
          >
            <span class="soul-gateway__mark" aria-hidden="true">意</span>
            <span class="soul-gateway__copy">
              <span class="soul-gateway__name">散置形意</span>
              <span class="soul-gateway__note">
                {{
                  soulPulse.idleSouls.length > 0
                    ? soulPulse.slotsFull
                      ? `${soulPulse.idleSouls.length} 缕待用 · 三席已满,先散去一缕`
                      : `${soulPulse.idleSouls.length} 缕待用 · 装配或散去`
                    : "暂无闲置器魂"
                }}
              </span>
            </span>
            <span class="soul-gateway__arrow" aria-hidden="true">›</span>
          </button>

          <button
            type="button"
            class="soul-gateway hoverable:hover:border-cinnabar"
            data-soul-gateway="forge"
            @click="forgeOpen = true"
          >
            <span class="soul-gateway__mark is-forge" aria-hidden="true">炼</span>
            <span class="soul-gateway__copy">
              <span class="soul-gateway__name">凝炼台</span>
              <span class="soul-gateway__note">
                {{
                  soulPulse.refinableCount > 0
                    ? soulPulse.affordableRefines > 0
                      ? `${soulPulse.affordableRefines}/${soulPulse.refinableCount} 件此刻可凝 · 每枚 ${SOUL_REFINE_COST} 道源`
                      : `${soulPulse.refinableCount} 件待凝 · 尚差 ${formatGN(soulPulse.shortfall)} 道源开一炉`
                    : "行囊中无可凝之器"
                }}
              </span>
            </span>
            <span class="soul-gateway__arrow" aria-hidden="true">›</span>
          </button>
        </div>
      </section>

      <!-- 章法退成页尾的注:先知道代价,再决定哪件入炉 -->
      <section class="soul-principle">
        <SectionTitle title="器魂章法" hint="先懂代价,再决定入炉" />
        <div class="soul-principle__sheet">
          <div class="soul-principle__lead">
            <span class="soul-principle__seal" aria-hidden="true">魂</span>
            <p>
              凡器入炉,锋芒被天道磨去几分,那份
              <span class="text-gold-ink">路数</span>却留了下来 —— 攻防血照常作数,
              器魂是在其上多给一条路数。
            </p>
          </div>

          <div class="soul-principle__steps">
            <p v-for="step in SOUL_STEPS" :key="step.mark" class="soul-principle__step">
              <span class="soul-principle__step-mark" aria-hidden="true">{{ step.mark }}</span>
              <span>
                <strong>{{ step.title }}</strong>
                <small>{{ step.detail }}</small>
              </span>
            </p>
          </div>

          <button
            class="tap-row soul-principle__toggle -mx-1.5 inline-flex min-h-[28px] min-w-[28px] items-center justify-center px-1.5 text-note text-ink-faint active:opacity-60"
            :aria-expanded="soulIntroOpen"
            @click="soulIntroOpen = !soulIntroOpen"
          >
            {{ soulIntroOpen ? "▾ 收起章法" : "▸ 怎么个章法" }}
          </button>
          <div v-if="soulIntroOpen" class="soul-principle__more">
            <p>以凡器入炉,形销而意存,得器魂一缕。神魂只容 {{ SOUL_SLOTS }} 缕 —— 取舍便是构筑。</p>
            <p>
              至于堆叠本身,天道自有应对:构筑越厚,守关者的道之理解越深;境界未及此界者,
              还会被境界压制。
            </p>
          </div>
        </div>
      </section>
    </template>

    <!-- 已装配器魂详情:槽从"只看印章"升级为可点,全量读数同闲置行 soulModText -->
    <BaseModal
      :open="soulDetail !== null"
      :title="soulDetail ? soulLabel(soulDetail) : ''"
      @close="soulDetail = null"
    >
      <template v-if="soulDetail">
        <div class="flex items-center gap-3">
          <span
            class="grid h-12 w-12 shrink-0 place-items-center rounded-[2px] font-kai text-[24px]"
            :style="{ color: soulColor(soulDetail) }"
          >
            {{ soulSeal(soulDetail) }}
          </span>
          <div class="min-w-0">
            <p class="text-body" :style="{ color: soulColor(soulDetail) }">
              {{ soulGradeDef(soulDetail.grade).name }}·{{
                soulTypeDef(soulDetail.type)?.name ?? "器魂"
              }}
            </p>
            <p class="text-note text-ink-faint">凝自「{{ soulDetail.fromName }}」</p>
          </div>
        </div>
        <p class="mt-3 t-body text-ink-soft">{{ soulModText(soulDetail) }}</p>
      </template>
      <template #footer>
        <div v-if="soulDetail" class="flex w-full gap-2">
          <button class="btn-ghost flex-1" @click="soulDetail = null">收 起</button>
          <button
            class="btn-seal flex-1"
            @click="
              removeSoul(soulDetail.uid);
              soulDetail = null;
            "
          >
            卸 下
          </button>
        </div>
      </template>
    </BaseModal>

    <!-- 散置形意 -->
    <BaseModal :open="idleOpen" title="散置形意" @close="idleOpen = false">
      <div
        v-if="idleSoulRows.length > 0"
        :data-soul-idle-total="idleSoulRows.length"
        :data-soul-idle-shown="idleSoulPage.shown"
        :data-soul-idle-start="idleSoulPage.start"
      >
        <p class="mb-1 flex flex-wrap items-baseline justify-between gap-1 text-note">
          <span class="text-ink-faint">品阶高者在前</span>
          <span class="tabular text-ink-faint">共 {{ idleSoulRows.length }} 缕</span>
        </p>
        <div class="scroll-pane card-ink max-h-64 divide-y divide-ink/7 overflow-y-auto px-4">
          <div
            v-for="soul in idleSoulPage.visible"
            :key="soul.uid"
            :data-soul-idle-row="soul.uid"
            tabindex="-1"
            class="flex items-center justify-between gap-2 py-2.5 tinylens:flex-col tinylens:items-stretch"
          >
            <div class="min-w-0">
              <p class="truncate text-body" :style="{ color: soulColor(soul) }">
                {{ soulLabel(soul) }}
              </p>
              <p class="text-note leading-relaxed text-ink-faint">
                凝自「{{ soul.fromName }}」 · {{ soulModText(soul) }}
              </p>
            </div>
            <div class="flex shrink-0 flex-wrap gap-1 tinylens:justify-end">
              <button
                class="btn-ghost !px-2.5 !py-1 !text-body"
                :disabled="soulPulse.slotsFull"
                @click="wearSoul(soul.uid)"
              >
                {{ soulPulse.slotsFull ? "槽已满" : "装配" }}
              </button>
              <template v-if="pendingDissolveUid !== soul.uid">
                <button
                  class="btn-ghost !px-2 !py-1 !text-body !text-ink-faint"
                  @click="pendingDissolveUid = soul.uid"
                >
                  散去
                </button>
              </template>
              <template v-else>
                <button class="btn-seal !px-2 !py-1 !text-body" @click="doDissolve(soul.uid)">
                  确认散去
                </button>
                <button class="btn-ghost !px-2 !py-1 !text-body" @click="pendingDissolveUid = null">
                  再想想
                </button>
              </template>
            </div>
          </div>
        </div>
        <div
          v-if="idleSoulPage.start > 0 || idleSoulPage.hidden > 0"
          class="mt-1.5 flex flex-wrap gap-1"
        >
          <button
            v-if="idleSoulPage.start > 0"
            type="button"
            data-soul-idle-prev
            class="chip-ink min-h-[28px] !whitespace-normal text-center text-note leading-relaxed text-ink-soft active:scale-95"
            :aria-label="previousListText(idleSoulPage.shown, idleSoulRows.length, '缕')"
            @click="showPreviousIdleSouls"
          >
            {{ previousListText(idleSoulPage.shown, idleSoulRows.length, "缕") }}
          </button>
          <button
            v-if="idleSoulPage.hidden > 0"
            type="button"
            data-soul-idle-more
            class="chip-ink min-h-[28px] !whitespace-normal text-center text-note leading-relaxed text-cinnabar active:scale-95"
            :aria-label="moreListText(idleSoulPage.hidden, '缕')"
            @click="showMoreIdleSouls"
          >
            {{ moreListText(idleSoulPage.hidden, "缕") }}
          </button>
        </div>
      </div>
      <p v-else class="px-4 py-6 text-center t-body text-ink-faint">
        并无闲置形意。
        <br />
        <span class="text-note">凝出的器魂若已尽数装配,此处便空着</span>
      </p>
      <template #footer>
        <button class="btn-seal w-full" @click="idleOpen = false">收 起</button>
      </template>
    </BaseModal>

    <!-- 凝炼台 -->
    <BaseModal :open="forgeOpen" title="凝炼台" @close="forgeOpen = false">
      <p class="mb-2 t-body text-ink-faint">
        入炉即毁原器,耗道源 {{ SOUL_REFINE_COST }}。
        <span v-if="soulPulse.refinableCount > 0"
          >此刻可凝 {{ soulPulse.affordableRefines }}/{{ soulPulse.refinableCount }} 件。</span
        >
        <!-- 付不起置灰+列差(与秘境道源/聚气丹同款):灰按钮不告诉差多少等于没说完 -->
        <span v-if="soulPulse.shortfall > 0" class="text-cinnabar"
          >尚差 {{ formatGN(soulPulse.shortfall) }} 道源可开一炉</span
        >
      </p>
      <div
        v-if="refinableRows.length > 0"
        :data-soul-forge-total="refinableRows.length"
        :data-soul-forge-shown="refinablePage.shown"
        :data-soul-forge-start="refinablePage.start"
      >
        <p class="mb-1 flex flex-wrap items-baseline justify-between gap-1 text-note">
          <span class="text-ink-faint">品质高者在前</span>
          <span class="tabular text-ink-faint">共 {{ refinableRows.length }} 件</span>
        </p>
        <div class="scroll-pane card-ink max-h-64 divide-y divide-ink/7 overflow-y-auto px-4">
          <div
            v-for="row in refinablePage.visible"
            :key="row.inst.uid"
            :data-soul-forge-row="row.inst.uid"
            tabindex="-1"
            class="flex items-center justify-between gap-2 py-2.5 tinylens:flex-col tinylens:items-stretch"
          >
            <div class="min-w-0">
              <p class="truncate text-body text-ink-soft">{{ row.name }}</p>
              <p class="truncate text-note text-ink-faint">
                将凝出
                <span :style="{ color: soulGradeDef(row.gradeRank).color }"
                  >{{ soulGradeDef(row.gradeRank).name }}·{{ row.typeName }}</span
                >
              </p>
              <!-- 给什么要有数:魂效果是确定的,就在入炉前说出来(与闲置形意的读数同款) -->
              <p v-if="modsText(row.mods)" class="truncate text-note text-ink-soft">
                {{ modsText(row.mods) }}
              </p>
              <!--
                同类隐患:自动收纳一律不动"已淬养"的件,而手动入炉会把它连同强化投入一起毁掉。
                手动动作不拦,但必须说清代价 —— 玩家不该在按下确认后才发现自己练过它。
                投入要报数:尘几许、灵石几许(enhanceInvested 同款,不是一句定性)。
              -->
              <p
                v-if="row.invested && row.investedCost"
                class="text-note leading-relaxed text-cinnabar"
              >
                此器已淬养,入炉将连同强化投入一并失去(器灵尘×{{ row.investedCost.dust }} · 灵石
                {{ formatGN(row.investedCost.stone) }})
              </p>
            </div>
            <!-- 入炉二步确认:毁的是原器,不按一个「入 炉」就直接交代了 -->
            <button
              v-if="pendingRefineUid !== row.inst.uid"
              class="btn-ghost !px-3 !py-1 !text-body tinylens:self-end"
              :disabled="!canAffordRefine"
              @click="pendingRefineUid = row.inst.uid"
            >
              入 炉
            </button>
            <div v-else class="flex shrink-0 items-center gap-1.5 tinylens:self-end">
              <button class="btn-seal !px-2.5 !py-1 !text-body" @click="doRefine(row.inst.uid)">
                确认凝炼
              </button>
              <button class="btn-ghost !px-2.5 !py-1 !text-body" @click="pendingRefineUid = null">
                再想想
              </button>
            </div>
          </div>
        </div>
        <div
          v-if="refinablePage.start > 0 || refinablePage.hidden > 0"
          class="mt-1.5 flex flex-wrap gap-1"
        >
          <button
            v-if="refinablePage.start > 0"
            type="button"
            data-soul-forge-prev
            class="chip-ink min-h-[28px] !whitespace-normal text-center text-note leading-relaxed text-ink-soft active:scale-95"
            :aria-label="previousListText(refinablePage.shown, refinableRows.length, '件')"
            @click="showPreviousRefinable"
          >
            {{ previousListText(refinablePage.shown, refinableRows.length, "件") }}
          </button>
          <button
            v-if="refinablePage.hidden > 0"
            type="button"
            data-soul-forge-more
            class="chip-ink min-h-[28px] !whitespace-normal text-center text-note leading-relaxed text-cinnabar active:scale-95"
            :aria-label="moreListText(refinablePage.hidden, '件')"
            @click="showMoreRefinable"
          >
            {{ moreListText(refinablePage.hidden, "件") }}
          </button>
        </div>
      </div>
      <p v-else class="px-4 py-6 text-center t-body text-ink-faint">
        行囊中无可凝之器。
        <br />
        <span class="text-note">已穿戴、已上锁、或无任何词条的法器都入不得炉</span>
      </p>
      <template #footer>
        <button class="btn-seal w-full" @click="forgeOpen = false">收 炉</button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import "@/styles/pages/souls.css";
import { computed, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { formatGN, formatNum } from "@/utils/format";
import { modsText } from "@/data/statNames";
import { equipmentTemplate } from "@/data/equipment";
import { qualityDef } from "@/data/qualities";
import {
  SOUL_SLOTS,
  soulGradeDef,
  soulMods,
  soulName,
  soulTypeDef,
  type SoulInstance,
} from "@/data/souls";
import { realmDef, WORLD_BREAK_MAJOR } from "@/data/realms";
import {
  dissolveSoul,
  previewSoul,
  refineEquipment,
  removeSoul,
  SOUL_REFINE_COST,
  wearSoul,
} from "@/core/soulService";
import { soulOverview } from "@/core/soulOverview";
import { hasInvestment } from "@/core/smartKeep";
import { enhanceInvested } from "@/core/salvage";
import { endgameUnlocked } from "@/core/endgameService";
import {
  firstNewVisibleIndex,
  listWindow,
  nextListLimit,
  previousListLimit,
  previousListStep,
} from "@/core/listRender";
import { useEndgameStore } from "@/stores/endgame";
import { useInventoryStore } from "@/stores/inventory";
import { usePlayerStore } from "@/stores/player";
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import LedgerPulse from "@/components/common/LedgerPulse.vue";
import LedgerTally from "@/components/common/LedgerTally.vue";
import UnopenedFolio from "@/components/common/UnopenedFolio.vue";
import SectionTitle from "@/components/common/SectionTitle.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import SoulForgeMap from "@/components/celestial/SoulForgeMap.vue";

const endgame = useEndgameStore();
const inventory = useInventoryStore();
const player = usePlayerStore();
const router = useRouter();

const unlocked = computed(() => endgameUnlocked());
const idleOpen = ref(false);
const forgeOpen = ref(false);
/** 「何谓器魂」的细读段:默认收起,只留一句结论 */
const soulIntroOpen = ref(false);
/** 已装配器魂的详情弹窗对象;非 null 时展示该缕 */
const soulDetail = ref<SoulInstance | null>(null);

/**
 * 「这一格有没有器魂」的唯一出口。详情按钮 / 卸下按钮 / 卡壳样式三处都从它取值 ——
 * 各写一份"有没有器魂",漏一处就又是一个"念出来却按不动"的东西。
 *
 * 键盘可达不用自己补:两个动作都是真 <button>,Enter / 空格是浏览器给的
 * (从前整卡是 role=button 的 div,得手写 keydown 才走得动)。
 */
function soulAt(i: number): SoulInstance | null {
  return endgame.activeSouls[i - 1] ?? null;
}

function openSoulDetail(i: number): void {
  soulDetail.value = soulAt(i);
}

/** 详情按钮的读屏名 —— 印章单字与短词条都是图形,念得出的是这一句 */
function detailLabel(soul: SoulInstance): string {
  return `${soulLabel(soul)} 详情`;
}

/**
 * 等待二次确认的行(uid);非 null 表示该行已展开确认态。
 * 凝炼入炉毁的是原器、散去形意毁的是器魂 —— 都属「不可逆失去整件」,
 * 走两步武装确认:确认词「确认+动词」、取消词一律「再想想」
 * (确认模式分级见 EquipDecomposePanel 文件头)。
 */
const pendingRefineUid = ref<string | null>(null);
/** 散去形意同样二步确认:器魂是花道源与一件法器凝出来的,一脚碎掉连个反悔都没有 */
const pendingDissolveUid = ref<string | null>(null);

/** 卷首、入口与凝炼台共用同一份「此刻能做」的账。 */
const soulPulse = computed(() =>
  soulOverview({
    activeSouls: endgame.activeSouls,
    soulList: endgame.soulList,
    items: inventory.items,
    equippedUids: inventory.equippedUids,
    daoSource: endgame.daoSource,
  }),
);

const emptySeats = computed(() =>
  Math.max(0, soulPulse.value.slotTotal - soulPulse.value.activeCount),
);

type SoulLedgerId = "active" | "idle" | "refine";

/** 卷首三枚账格与阵图、先手共读同一份 soulPulse。 */
const soulLedgerRows = computed(() => [
  {
    id: "active" as const,
    mark: "席",
    label: "三席",
    value: soulPulse.value.activeCount,
    total: soulPulse.value.slotTotal,
    unit: "席",
    detail: emptySeats.value > 0 ? `尚空 ${emptySeats.value} 席` : "三席俱满",
  },
  {
    id: "idle" as const,
    mark: "闲",
    label: "闲置",
    value: soulPulse.value.idleSouls.length,
    total: "",
    unit: "缕",
    detail:
      soulPulse.value.idleSouls.length > 0
        ? soulPulse.value.slotsFull
          ? "三席已满,待取舍"
          : "可入空席"
        : "暂无闲置形意",
  },
  {
    id: "refine" as const,
    mark: "凝",
    label: "可凝",
    value: soulPulse.value.affordableRefines,
    total: soulPulse.value.refinableCount,
    unit: "件",
    detail:
      soulPulse.value.refinableCount > 0
        ? soulPulse.value.shortfall > 0
          ? `尚差 ${formatGN(soulPulse.value.shortfall)} 道源`
          : `每枚 ${SOUL_REFINE_COST} 道源`
        : "行囊暂无带形意的法器",
  },
]);

interface SoulLead {
  mark: string;
  title: string;
  detail: string;
  label: string;
  action: "idle" | "forge" | "inventory" | null;
}

const SOUL_SETTLED_LEAD: SoulLead = {
  mark: "定",
  title: "三席俱满，形意已成阵",
  detail: "没有闲置形意，也没有可凝法器；当前构筑已经落定。",
  label: "",
  action: null,
};

/** 把卷首「此刻器魂」收成一句先手:先处理已有形意,再给开炉或回行囊。 */
const soulLead = computed<SoulLead>(() => {
  const pulse = soulPulse.value;
  switch (pulse.nextAction) {
    case "wear":
      return {
        mark: "装",
        title: "先装一缕闲置形意",
        detail: `手上有 ${pulse.idleSouls.length} 缕闲置形意，三席尚空 ${emptySeats.value} 席。`,
        label: "去装配",
        action: "idle",
      };
    case "choose":
      return {
        mark: "择",
        title: "三席已满，先做取舍",
        detail: `另有 ${pulse.idleSouls.length} 缕闲置形意；卸下一席，才装得下新的路数。`,
        label: "去取舍",
        action: "idle",
      };
    case "refine":
      return {
        mark: "炼",
        title: "有一件可入炉",
        detail: `此刻可凝 ${pulse.affordableRefines}/${pulse.refinableCount} 件，每枚耗 ${SOUL_REFINE_COST} 道源。`,
        label: "去开炉",
        action: "forge",
      };
    case "short":
      return {
        mark: "缺",
        title: "有器可凝，道源还差一截",
        detail: `${pulse.refinableCount} 件待凝，尚差 ${formatGN(pulse.shortfall)} 道源可开一炉。`,
        label: "去看凝炼台",
        action: "forge",
      };
    case "inventory":
      return {
        mark: "寻",
        title: "三席未满，行囊里还差一件带形意的法器",
        detail: "凝炼只取未佩戴、未上锁且有词条的法器；先去行囊挑一件。",
        label: "回行囊",
        action: "inventory",
      };
    case "settled":
    default:
      return SOUL_SETTLED_LEAD;
  }
});

function runSoulLead(): void {
  switch (soulLead.value.action) {
    case "idle":
      idleOpen.value = true;
      break;
    case "forge":
      forgeOpen.value = true;
      break;
    case "inventory":
      void router.push("/inventory");
      break;
  }
}

function scrollToSeats(): void {
  document.querySelector<HTMLElement>("[data-soul-slots]")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function runSoulLedger(id: SoulLedgerId): void {
  if (id === "active") scrollToSeats();
  else if (id === "idle") idleOpen.value = true;
  else forgeOpen.value = true;
}

/** 章法里的数字只从机制常量取，避免改 SOUL_SLOTS / 炉费后文案还停在旧值。 */
const SOUL_STEPS = [
  {
    mark: "一",
    title: "入炉",
    detail: `挑一件带词条的法器入炉，耗 ${SOUL_REFINE_COST} 道源，原器即毁。`,
  },
  {
    mark: "二",
    title: "存意",
    detail: "锋、盾、棘、连、泽、背六路形意，按主导词条凝成。",
  },
  {
    mark: "三",
    title: "择席",
    detail: `神魂只容 ${SOUL_SLOTS} 缕，装配就是取舍。`,
  },
] as const;

/** 道源够一枚就允许开确认；短差由 soulPulse 统一报出。 */
const canAffordRefine = computed(() => soulPulse.value.affordableRefines > 0);

/** 二步确认后真正入炉;成功后收拢确认态 */
function doRefine(uid: string): void {
  if (refineEquipment(uid)) pendingRefineUid.value = null;
  else pendingRefineUid.value = null; // 失败(如道源不足)也收起确认态,让玩家重挑
}

/** 二步确认后真正散去形意;散去不可逆,成功后收拢确认态 */
function doDissolve(uid: string): void {
  dissolveSoul(uid);
  pendingDissolveUid.value = null;
}

/** 可入炉的法器已由 core 过滤；这里只把每件摊成卡面要读的预览。 */
const refinableCards = computed(() =>
  soulPulse.value.refinable.map((inst) => {
    const preview = previewSoul(inst);
    const invested = hasInvestment(inst);
    return {
      inst,
      name: equipmentTemplate(inst.templateId)?.name ?? "无名法器",
      typeName: preview.type?.name ?? "器魂",
      gradeRank: preview.gradeRank,
      // 将凝出的器的数值模组 —— 预览即成品(soulForge.previewSoul.mods)
      mods: preview.mods,
      invested,
      // 已淬养者的强化投入:不可逆确认里该有两笔具体的数(尘/灵石),不能只有一句定性
      investedCost: invested ? enhanceInvested(inst) : null,
    };
  }),
);

const SOUL_RENDER_BATCH = 12;
const SOUL_RENDER_WINDOW = SOUL_RENDER_BATCH * 2;
const idleSoulLimit = ref(SOUL_RENDER_BATCH);
const refinableLimit = ref(SOUL_RENDER_BATCH);

/** 闲置形意按品阶降序:槽位只有三处,先让最值得装配的那缕露在首批。 */
const idleSoulRows = computed(() =>
  [...soulPulse.value.idleSouls].sort(
    (a, b) =>
      b.grade - a.grade ||
      soulName(a).localeCompare(soulName(b), "zh-CN") ||
      a.uid.localeCompare(b.uid),
  ),
);
const idleSoulPage = computed(() =>
  listWindow(idleSoulRows.value, idleSoulLimit.value, SOUL_RENDER_WINDOW),
);

/** 可凝法器与行囊同排法:品质降序、层级降序,不让低阶旧件占满首批。 */
const refinableRows = computed(() =>
  [...refinableCards.value].sort(
    (a, b) =>
      qualityDef(b.inst.quality).rank - qualityDef(a.inst.quality).rank ||
      b.inst.tier - a.inst.tier ||
      a.inst.uid.localeCompare(b.inst.uid),
  ),
);
const refinablePage = computed(() =>
  listWindow(refinableRows.value, refinableLimit.value, SOUL_RENDER_WINDOW),
);

function moreListText(hidden: number, unit: string): string {
  const next = Math.min(SOUL_RENDER_BATCH, hidden);
  return `再看 ${next} ${unit} · 余 ${hidden}`;
}

function previousListText(shown: number, total: number, unit: string): string {
  const step = previousListStep(shown, total, SOUL_RENDER_BATCH);
  return `前一批 ${step} ${unit}`;
}

function focusSoulRow(selector: string, index = 0): void {
  void nextTick(() => {
    const rows = document.querySelectorAll<HTMLElement>(selector);
    rows[Math.min(Math.max(0, index), rows.length - 1)]?.focus();
  });
}

function showMoreIdleSouls(): void {
  const shownBefore = idleSoulPage.value.shown;
  const shownAfter = nextListLimit(shownBefore, idleSoulRows.value.length, SOUL_RENDER_BATCH);
  idleSoulLimit.value = shownAfter;
  focusSoulRow(
    "[data-soul-idle-row]",
    firstNewVisibleIndex(shownBefore, shownAfter, SOUL_RENDER_WINDOW),
  );
}

function showPreviousIdleSouls(): void {
  idleSoulLimit.value = previousListLimit(
    idleSoulPage.value.shown,
    idleSoulRows.value.length,
    SOUL_RENDER_BATCH,
  );
  focusSoulRow("[data-soul-idle-row]");
}

function showMoreRefinable(): void {
  const shownBefore = refinablePage.value.shown;
  const shownAfter = nextListLimit(shownBefore, refinableRows.value.length, SOUL_RENDER_BATCH);
  refinableLimit.value = shownAfter;
  focusSoulRow(
    "[data-soul-forge-row]",
    firstNewVisibleIndex(shownBefore, shownAfter, SOUL_RENDER_WINDOW),
  );
}

function showPreviousRefinable(): void {
  refinableLimit.value = previousListLimit(
    refinablePage.value.shown,
    refinableRows.value.length,
    SOUL_RENDER_BATCH,
  );
  focusSoulRow("[data-soul-forge-row]");
}

watch([idleOpen, forgeOpen], ([idle, forge]) => {
  if (idle) idleSoulLimit.value = SOUL_RENDER_BATCH;
  if (forge) refinableLimit.value = SOUL_RENDER_BATCH;
});

function soulLabel(soul: SoulInstance): string {
  return soulName(soul);
}
function soulSeal(soul: SoulInstance): string {
  return soulTypeDef(soul.type)?.seal ?? "魂";
}
function soulColor(soul: SoulInstance): string {
  return soulGradeDef(soul.grade).color;
}
function soulModText(soul: SoulInstance): string {
  return modsText(soulMods(soul));
}

const SOUL_SEAT_POSITIONS = [
  { x: 52, y: 34 },
  { x: 124, y: 34 },
  { x: 88, y: 101 },
] as const;

/** 星图三席与正文共用 soulAt；空席只报序号，不另造一套占位数据。 */
const soulSeats = computed(() =>
  SOUL_SEAT_POSITIONS.map((position, index) => {
    const soul = soulAt(index + 1);
    return {
      ...position,
      filled: soul !== null,
      mark: soul ? soulSeal(soul) : String(index + 1),
      color: soul ? soulColor(soul) : "var(--color-ink-faint)",
    };
  }),
);

/** 已装配器魂的合计词条 */
const activeModText = computed(() => modsText(endgame.soulMods));
</script>
