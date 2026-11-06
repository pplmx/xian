<template>
  <div class="folio-page folio-page--stack stagger-in">
    <FolioPageHeader title="洞府营造" back-to="home" back-label="返回" featured compact>
      <template #meta>
        <p class="dongfu-masthead__meta">
          <span
            >已营 <strong class="tabular">{{ dongfu.builtCount }}</strong> /
            {{ BUILDINGS.length }}</span
          >
          <span
            >离线可攒 <strong class="tabular">{{ offlineCapHours }}</strong> 时</span
          >
          <span v-if="apprenticeBusy"
            >弟子在途 <strong class="tabular">{{ apprenticeBusy }}</strong> 人</span
          >
        </p>
      </template>
      <template #visual>
        <DongfuAtlas :nodes="atlasNodes" :built-count="dongfu.builtCount" />
      </template>
    </FolioPageHeader>

    <!-- 总账只摊家底与眼前一锤,续账沿同一条纸线接七作、家业与灵脉。 -->
    <article class="dongfu-ledger-register folio-span-all" data-dongfu-ledger-register>
      <section class="dongfu-ledger-register__chapter" data-dongfu-ledger-chapter="summary">
        <FolioChapterHead
          data-dongfu-chapter-head
          index="壹"
          eyebrow="山门总账"
          title="七作营造"
          hint="家底、眼前一锤与离线存续同读一册"
          :fact="`已营 ${dongfu.builtCount}/${BUILDINGS.length}`"
        />
        <LedgerPulse class="dongfu-ledger" data-dongfu-ledger headless>
          <div class="dongfu-ledger__grid">
            <section class="dongfu-ledger__progress">
              <div class="dongfu-ledger__label-row">
                <span class="dongfu-ledger__label">已 营</span>
                <span class="dongfu-ledger__hint">每座一级便算入册</span>
              </div>
              <p class="dongfu-ledger__value font-kai tabular">
                {{ dongfu.builtCount }}<span>/{{ BUILDINGS.length }}</span>
              </p>
              <div class="dongfu-ledger__bar" role="img" :aria-label="builtProgressLabel">
                <span :style="{ width: builtProgress }" />
              </div>
              <p class="dongfu-ledger__next">
                <template v-if="nextBuild">
                  眼下可动工 · <span class="font-kai">{{ nextBuild.def.name }}</span>
                  <span class="tabular"
                    >（{{ nextBuild.level }} → {{ nextBuild.info.nextLevel }} 级）</span
                  >
                </template>
                <template v-else-if="dongfu.allBuildingsMaxed">七作俱已至顶</template>
                <template v-else>眼下没有料足可动的营造</template>
              </p>
            </section>

            <section class="dongfu-ledger__accounts" data-dongfu-accounts>
              <div class="dongfu-ledger__account">
                <span class="dongfu-ledger__account-name">合府加成</span>
                <span class="dongfu-ledger__account-value">{{
                  buildingModText || "尚未形成合府加成"
                }}</span>
              </div>
              <div class="dongfu-ledger__account">
                <span class="dongfu-ledger__account-name">每时藏收</span>
                <span class="dongfu-ledger__account-value">
                  <template v-if="hourlyLines.length">
                    <span v-for="(part, i) in hourlyLines" :key="part">
                      <span v-if="i" aria-hidden="true"> · </span>{{ part }}
                    </span>
                  </template>
                  <template v-else>尚未形成常产</template>
                </span>
              </div>
              <div class="dongfu-ledger__account">
                <span class="dongfu-ledger__account-name">门庭弟子</span>
                <span class="dongfu-ledger__account-value">{{ apprenticeFact }}</span>
              </div>
            </section>
          </div>

          <button
            v-if="nextBuild"
            type="button"
            class="dongfu-ledger__quick"
            data-dongfu-quick-build
            :aria-label="quickBuildLabel"
            @click="quickBuild"
          >
            <span class="dongfu-ledger__quick-copy">
              <span class="dongfu-ledger__quick-eyebrow">眼前一锤</span>
              <span class="dongfu-ledger__quick-name">
                {{ nextBuild.def.name }} · {{ nextBuild.level > 0 ? "升级" : "建造" }}
              </span>
            </span>
            <span class="dongfu-ledger__quick-cost tabular">
              {{ nextBuild.level }} → {{ nextBuild.info.nextLevel }} 级
              <span aria-hidden="true">·</span>
              {{ formatGN(nextBuild.info.stone) }} 石
              <template v-if="nextBuild.info.ore > 0">
                <span aria-hidden="true">·</span> {{ nextBuild.info.ore }} 玄铁
              </template>
            </span>
          </button>

          <section
            class="dongfu-ledger__offline"
            data-dongfu-offline
            aria-labelledby="dongfu-offline-title"
          >
            <div class="dongfu-ledger__offline-head">
              <span id="dongfu-offline-title" class="dongfu-ledger__label">离线存续</span>
              <span class="dongfu-ledger__offline-current tabular" data-dongfu-offline-current
                >现档 · {{ offlineCapHours }} 时</span
              >
            </div>
            <ol class="dongfu-ledger__ladder" aria-label="离线存续档位">
              <li
                v-for="tier in offlineTiers"
                :key="tier.hours"
                class="dongfu-ledger__step"
                :class="`is-${tier.state}`"
                :data-offline-tier-state="tier.state"
                :aria-current="tier.state === 'current' ? 'step' : undefined"
              >
                <span class="dongfu-ledger__step-hours tabular">{{ tier.hours }} 时</span>
                <span
                  v-if="tier.state === 'current'"
                  class="dongfu-ledger__step-state"
                  aria-hidden="true"
                  >现档</span
                >
                <span class="sr-only">{{ offlineTierStateLabels[tier.state] }}</span>
              </li>
            </ol>
            <p class="dongfu-ledger__offline-note">
              修为与灵气全额计入；材料、钻研与历练按
              <strong class="tabular">{{ OFFLINE_EFFICIENCY * 10 }} 折</strong>挂机。
              <template v-if="offlineNextTier">
                洞府升至 {{ offlineNextTier.level }} 级,可攒至 {{ offlineNextTier.hours }} 时。
              </template>
              <template v-else>离线上限已至最高档。</template>
            </p>
          </section>

          <p v-if="dongfu.allBuildingsMaxed" class="dongfu-ledger__perfect" data-dongfu-perfect>
            <span class="chip-ink border-jade/60 text-note text-jade">营造尽善</span>
            {{ cnNumber(BUILDINGS.length) }} 座建筑俱已至顶 —— 此间经营,已然圆满
          </p>
          <p v-else-if="!nextBuild" class="dongfu-ledger__blocked">
            眼下无可动工 · {{ firstBlockedReason }}
          </p>
        </LedgerPulse>
      </section>

      <section class="dongfu-ledger-register__chapter" data-dongfu-ledger-chapter="register">
        <FolioChapterHead
          data-dongfu-chapter-head
          index="贰"
          eyebrow="营造之后"
          title="山门续账"
          hint="七作、家业与灵脉沿同一条账线续排"
          :fact="'七作 · 家业 · 灵脉'"
        />
        <div class="dongfu-register" data-dongfu-register>
          <div class="dongfu-register__chapters" data-dongfu-chapters>
            <!--
              七作默认收成一枚账行。

              章壹已经报过「已营 7/7」与「眼前一锤」—— 这一章再铺七行逐作,
              玩家一眼看到的仍是同一件事的三份说法。故页上只留这一行:
              报可动工座数与下一座,要逐作比较时再展开(账行本身不删,展开后一项不少)。
            -->
            <button
              type="button"
              class="dongfu-register__chapters-toggle"
              :aria-expanded="chaptersOpen"
              :aria-controls="chaptersBodyId"
              data-dongfu-chapters-toggle
              @click="chaptersOpen = !chaptersOpen"
            >
              <span class="dongfu-register__chapters-mark" aria-hidden="true">营</span>
              <span class="dongfu-register__chapters-copy">
                <strong>七作营造</strong>
                <small>{{ chaptersHint }}</small>
              </span>
              <span class="dongfu-register__chapters-count tabular"
                >{{ dongfu.builtCount }}/{{ BUILDINGS.length }} 已营</span
              >
              <span class="dongfu-register__chapters-action">{{
                chaptersOpen ? "收 起" : "展开七作"
              }}</span>
            </button>
            <div
              v-show="chaptersOpen"
              :id="chaptersBodyId"
              class="dongfu-register__chapters-body"
              data-dongfu-chapters-body
            >
              <section
                v-for="group in buildingChapters"
                :key="group.key"
                class="dongfu-register__chapter"
                :data-dongfu-chapter="group.key"
                :data-dongfu-group="group.key"
              >
                <header class="dongfu-register__chapter-head">
                  <span class="dongfu-register__chapter-index tabular">{{ group.index }}</span>
                  <div class="dongfu-register__chapter-copy">
                    <h3 class="dongfu-register__chapter-title">{{ group.title }}</h3>
                    <p class="dongfu-register__chapter-hint">{{ group.hint }}</p>
                  </div>
                  <span class="dongfu-register__chapter-count tabular">
                    {{ groupBuiltCount(group.ids) }}/{{ group.ids.length }} 已营
                  </span>
                </header>
                <div class="dongfu-register__rows">
                  <BuildingLedgerRow v-for="def in group.defs" :key="def.id" :def="def" />
                </div>
              </section>
            </div>
          </div>

          <section
            class="dongfu-register__chapter dongfu-register__chapter--gateway"
            data-dongfu-chapter="estate"
            data-dongfu-gateways
          >
            <header class="dongfu-register__chapter-head">
              <span class="dongfu-register__chapter-index tabular">伍</span>
              <div class="dongfu-register__chapter-copy">
                <h3 class="dongfu-register__chapter-title">家业</h3>
                <p class="dongfu-register__chapter-hint">灵石周转 · 弟子跑腿</p>
              </div>
              <span class="dongfu-register__chapter-count">两处门径</span>
            </header>
            <div class="dongfu-register__rows dongfu-register__rows--gateway">
              <DongfuGatewayRow
                to="/market"
                icon="gem"
                title="坊 市"
                tone="gold"
                action="往市"
                sub="购丹续料、购兵刃,兼售寄卖"
                :fact="`囊中 ${formatGN(stone)} 灵石`"
              />
              <DongfuGatewayRow
                to="/apprentice"
                icon="circle-user"
                title="门庭有徒"
                tone="jade"
                action="看顾"
                sub="弟子离线跑腿,归来带回资材"
                :fact="apprenticeFact"
              />
            </div>
          </section>

          <section
            v-if="player.major >= VEIN_UNLOCK_MAJOR"
            class="dongfu-register__chapter dongfu-register__chapter--gateway"
            data-dongfu-chapter="vein"
            data-dongfu-vein
          >
            <header class="dongfu-register__chapter-head">
              <span class="dongfu-register__chapter-index tabular">陆</span>
              <div class="dongfu-register__chapter-copy">
                <h3 class="dongfu-register__chapter-title">灵脉</h3>
                <p class="dongfu-register__chapter-hint">炼化灵石,永久强化</p>
              </div>
              <span class="dongfu-register__chapter-count">引脉入府</span>
            </header>
            <div class="dongfu-register__rows dongfu-register__rows--gateway">
              <DongfuGatewayRow
                icon="wind"
                title="灵脉投资"
                tone="qing"
                action="调理"
                sub="择一主脉而修,投点立得全局加成"
                :fact="veinFact"
                @click="veinOpen = true"
              />
            </div>
          </section>
        </div>
      </section>
    </article>

    <BaseModal :open="veinOpen" title="" aria-label="灵脉" wide @close="veinOpen = false">
      <VeinInvestCard />
      <template #footer>
        <button class="btn-seal w-full" @click="veinOpen = false">收 起</button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import "@/styles/pages/dongfu.css";
import { computed, ref } from "vue";
import type { BuildingId } from "@/types";
import { useDongfuStore } from "@/stores/dongfu";
import { useResourcesStore } from "@/stores/resources";
import { useApprenticeStore } from "@/stores/apprentice";
import { usePlayerStore } from "@/stores/player";
import { OFFLINE_EFFICIENCY, VEIN_UNLOCK_MAJOR } from "@/data/constants";
import { BUILDINGS } from "@/data/buildings";
import { modsText } from "@/data/statNames";
import { veinDef } from "@/data/veins";
import { buildingUpgradeInfo, upgradeBuilding } from "@/core/buildingService";
import { hourlyYieldText } from "@/core/engineFacilities";
import { cnNumber, formatGN } from "@/utils/format";
import { dongfuBuildingChapters, offlineCapTiers, type OfflineCapTierState } from "@/ui/dongfuDesk";
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import LedgerPulse from "@/components/common/LedgerPulse.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import BuildingLedgerRow from "@/components/dongfu/BuildingLedgerRow.vue";
import DongfuAtlas from "@/components/dongfu/DongfuAtlas.vue";
import FolioChapterHead from "@/components/common/FolioChapterHead.vue";
import DongfuGatewayRow from "@/components/dongfu/DongfuGatewayRow.vue";
import VeinInvestCard from "@/components/dongfu/VeinInvestCard.vue";

const dongfu = useDongfuStore();
const resources = useResourcesStore();
const apprentice = useApprenticeStore();
const player = usePlayerStore();
const veinOpen = ref(false);

const stone = computed(() => resources.spiritStone);
const apprentices = computed(() => apprentice.apprentices);
const apprenticeBusy = computed(() => apprentices.value.filter((a) => a.task).length);
const apprenticeFact = computed(() => {
  if (!apprentices.value.length) return "门下尚无弟子";
  return apprenticeBusy.value
    ? `在途 ${apprenticeBusy.value} · 门下 ${apprentices.value.length}`
    : `门前 ${apprentices.value.length} 人皆待命`;
});

const offlineCapHours = computed(() => dongfu.offlineCapHours);
const offlineTiers = computed(() => offlineCapTiers(offlineCapHours.value));
const offlineNextTier = computed(
  () => offlineTiers.value.find((tier) => tier.state === "future") ?? null,
);
const offlineTierStateLabels: Record<OfflineCapTierState, string> = {
  past: "已过",
  current: "现档",
  future: "未至",
};
const hourlyLines = computed(() => hourlyYieldText({ ...dongfu.levels }));
const buildingModText = computed(() => modsText(dongfu.buildingMods));
const builtProgress = computed(() => `${Math.min(1, dongfu.builtCount / BUILDINGS.length) * 100}%`);
const builtProgressLabel = computed(() => `已营 ${dongfu.builtCount} / ${BUILDINGS.length} 座`);

const ATLAS_MARKS: Record<BuildingId, string> = {
  mansion: "府",
  array: "阵",
  alchemy: "炉",
  forge: "台",
  field: "田",
  library: "阁",
  beast: "园",
};

const atlasNodes = computed(() =>
  BUILDINGS.map((def) => {
    const info = buildingUpgradeInfo(def.id);
    return {
      id: def.id,
      mark: ATLAS_MARKS[def.id],
      level: dongfu.levels[def.id] ?? 0,
      cap: dongfu.buildingCap(def.id),
      canUpgrade: info.canUpgrade,
    };
  }),
);

const buildingChapters = dongfuBuildingChapters();

function groupBuiltCount(ids: BuildingId[]): number {
  return ids.filter((id) => (dongfu.levels[id] ?? 0) > 0).length;
}

const nextBuild = computed(() => {
  for (const def of BUILDINGS) {
    const info = buildingUpgradeInfo(def.id);
    if (info.canUpgrade) {
      return {
        def,
        info,
        level: dongfu.levels[def.id] ?? 0,
      };
    }
  }
  return null;
});

/**
 * 七作账行的开合 —— 默认合着。
 *
 * 页上只留「可动工几座 + 下一座」;逐作比较(造价、现/将、连升)展开再看。
 * 收的是版面,不是内容:展开后七行一项不少,连升与详情仍在行内。
 */
const chaptersOpen = ref(false);
const chaptersBodyId = "dongfu-chapters-body";
const affordableCount = computed(
  () => BUILDINGS.filter((def) => buildingUpgradeInfo(def.id).canUpgrade).length,
);
const chaptersHint = computed(() => {
  if (dongfu.allBuildingsMaxed) return "七作俱已至顶";
  if (affordableCount.value === 0) return "眼下没有料足可动的营造";
  const next = nextBuild.value;
  return next
    ? `眼下可动工 ${affordableCount.value} 座 · 下一座 ${next.def.name} ${next.level} → ${next.info.nextLevel} 级`
    : `眼下可动工 ${affordableCount.value} 座`;
});

const firstBlockedReason = computed(() => {
  for (const def of BUILDINGS) {
    if ((dongfu.levels[def.id] ?? 0) >= dongfu.buildingCap(def.id)) continue;
    return `${def.name} · ${buildingUpgradeInfo(def.id).reason || "料未备齐"}`;
  }
  return "料未备齐";
});

const quickBuildLabel = computed(() => {
  const row = nextBuild.value;
  if (!row) return "眼下无可动工";
  const verb = row.level > 0 ? "升级" : "建造";
  const ore = row.info.ore > 0 ? ` · ${row.info.ore} 玄铁` : "";
  return `${row.def.name}${verb}，${formatGN(row.info.stone)} 石${ore}`;
});

function quickBuild(): void {
  const row = nextBuild.value;
  if (row) upgradeBuilding(row.def.id);
}

const veinFact = computed(() => {
  const total = dongfu.veinTotal;
  if (!dongfu.veinMain) return `已投 ${total} 点 · 尚未立主脉`;
  return `已投 ${total} 点 · 主脉 ${veinDef(dongfu.veinMain).name}`;
});
</script>
