<template>
  <div class="folio-page folio-page--stack stagger-in">
    <FolioPageHeader title="洞府营造" back-to="home" back-label="返回" featured>
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

    <!--
      营造总账先把「家底有多少、眼下能做什么、离线能攒多久」摊在同一处。
      旧页把这些数散在题头、七张卡和一条独立阶梯里，玩家要来回心算。
    -->
    <section class="folio-span-all">
      <SectionTitle
        title="营造"
        :hint="`已营 ${dongfu.builtCount}/${BUILDINGS.length} · 各司其职,日夜不辍`"
      />
      <LedgerPulse
        class="dongfu-ledger"
        data-dongfu-ledger
        seal="府"
        eyebrow="山门总账"
        title="七作营造"
        score-label="已营"
        :score-value="dongfu.builtCount"
        :score-suffix="`/ ${BUILDINGS.length}`"
      >
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

        <section class="dongfu-ledger__offline" data-dongfu-offline>
          <div class="dongfu-ledger__offline-head">
            <span class="dongfu-ledger__label">离线存续</span>
            <span class="dongfu-ledger__offline-current tabular"
              >当前 {{ offlineCapHours }} 时</span
            >
          </div>
          <div class="dongfu-ledger__ladder">
            <div
              v-for="(h, i) in OFFLINE_CAP_HOURS"
              :key="i"
              class="dongfu-ledger__step"
              :class="
                i <= mansionLevel
                  ? 'border-cinnabar bg-cinnabar text-paper font-kai'
                  : 'border-ink/15 text-ink-faint'
              "
              :title="`洞府 ${i} 级可攒 ${h} 小时`"
            >
              {{ h }}时
            </div>
          </div>
          <p class="dongfu-ledger__offline-note">
            离线上限随洞府等级抬升
            <template v-if="mansionLevel < OFFLINE_CAP_HOURS.length - 1">
              —— 升到 {{ mansionLevel + 1 }} 级,可攒至 {{ OFFLINE_CAP_HOURS[mansionLevel + 1] }} 时
            </template>
            <template v-else>—— 已至顶档</template>
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

    <!-- 七作按「基业 / 修行 / 丹器 / 生计」分组，不再让七张同形卡平铺成账本。 -->
    <section class="folio-span-all" data-dongfu-workshop>
      <SectionTitle title="七作" hint="点开详情看完整效果与连升总账" />
      <div class="dongfu-workshop">
        <section
          v-for="group in buildingGroups"
          :key="group.key"
          class="dongfu-workshop__group"
          :data-dongfu-group="group.key"
        >
          <header class="dongfu-workshop__group-head">
            <span class="dongfu-workshop__group-index tabular">{{ group.index }}</span>
            <span class="dongfu-workshop__group-title">{{ group.title }}</span>
            <span class="dongfu-workshop__group-hint">{{ group.hint }}</span>
            <span class="dongfu-workshop__group-count tabular">
              {{ groupBuiltCount(group.ids) }}/{{ group.ids.length }} 已营
            </span>
          </header>
          <div class="dongfu-workshop__grid">
            <BuildingCard v-for="def in group.defs" :key="def.id" :def="def" />
          </div>
        </section>
      </div>
    </section>

    <section>
      <SectionTitle title="家业 · 财与人" hint="灵石周转 · 弟子跑腿" />
      <div class="dongfu-gateways" data-dongfu-gateways>
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

    <section v-if="player.major >= VEIN_UNLOCK_MAJOR">
      <SectionTitle title="灵脉 · 引脉入府" hint="炼化灵石,永久强化" />
      <div class="dongfu-gateways" data-dongfu-vein>
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
import type { BuildingDef, BuildingId } from "@/types";
import { useDongfuStore } from "@/stores/dongfu";
import { useResourcesStore } from "@/stores/resources";
import { useApprenticeStore } from "@/stores/apprentice";
import { usePlayerStore } from "@/stores/player";
import { OFFLINE_CAP_HOURS, VEIN_UNLOCK_MAJOR } from "@/data/constants";
import { BUILDINGS } from "@/data/buildings";
import { modsText } from "@/data/statNames";
import { veinDef } from "@/data/veins";
import { buildingUpgradeInfo, upgradeBuilding } from "@/core/buildingService";
import { hourlyYieldText } from "@/core/engineFacilities";
import { cnNumber, formatGN } from "@/utils/format";
import FolioPageHeader from "@/components/common/FolioPageHeader.vue";
import LedgerPulse from "@/components/common/LedgerPulse.vue";
import SectionTitle from "@/components/common/SectionTitle.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import BuildingCard from "@/components/dongfu/BuildingCard.vue";
import DongfuAtlas from "@/components/dongfu/DongfuAtlas.vue";
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

const mansionLevel = computed(() => dongfu.levels.mansion ?? 0);
const offlineCapHours = computed(() => dongfu.offlineCapHours);
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

type BuildingGroup = {
  key: string;
  index: string;
  title: string;
  hint: string;
  ids: BuildingId[];
  defs: BuildingDef[];
};

const GROUP_SPECS = [
  {
    key: "foundation",
    index: "壹",
    title: "基业",
    hint: "洞府为诸作之枢",
    ids: ["mansion"],
  },
  {
    key: "cultivation",
    index: "贰",
    title: "修行",
    hint: "聚气与藏经",
    ids: ["array", "library"],
  },
  {
    key: "craft",
    index: "叁",
    title: "丹器",
    hint: "一炉一台",
    ids: ["alchemy", "forge"],
  },
  {
    key: "livelihood",
    index: "肆",
    title: "生计",
    hint: "田畴与灵兽",
    ids: ["field", "beast"],
  },
] satisfies Array<Omit<BuildingGroup, "defs">>;

const buildingGroups: BuildingGroup[] = GROUP_SPECS.map((group) => ({
  ...group,
  ids: [...group.ids],
  defs: group.ids
    .map((id) => BUILDINGS.find((def) => def.id === id))
    .filter((def): def is BuildingDef => Boolean(def)),
}));

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
