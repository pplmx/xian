<template>
  <div class="stagger-in px-4 pb-6 pt-4">
    <!-- 页签 -->
    <InkTabs v-model="tab" :tabs="TABS" />

    <!-- 装备:部位槽,点击唤起部位列表 -->
    <template v-if="tab === 'equip'">
      <!-- 装备共鸣:机制是活的,玩家却看不见 —— 同组两件即共鸣,（2/2）亮起 -->
      <div v-if="setRows.length" class="card-ink mt-3 px-4 py-2.5">
        <p class="text-[10px] text-ink-faint">装备共鸣(同组两件即共鸣,机制不叠数值)</p>
        <p v-for="s in setRows" :key="s.def.id" class="mt-1 flex items-baseline gap-2 text-[11px]">
          <span class="font-kai" :class="s.active ? 'text-jade' : 'text-ink-soft'">{{
            s.def.name
          }}</span>
          <span class="tabular" :class="s.active ? 'text-jade' : 'text-ink-faint'"
            >{{ s.count }}/{{ s.def.required }}</span
          >
          <span class="min-w-0 grow text-[10px] leading-relaxed text-ink-faint">{{
            s.def.effectDesc
          }}</span>
          <!-- 穿齐该套:换上已持有里最强的套件,已穿更强者不动(绝不降级) -->
          <button
            type="button"
            class="tap-row shrink-0 -my-1.5 py-1.5 font-kai text-[11px] text-cinnabar active:opacity-60"
            :aria-label="`穿齐${s.def.name}`"
            @click="wearSetOf(s.def.id)"
          >
            穿齐 →
          </button>
        </p>
      </div>
      <!--
        行囊读数与两个动作此前挤在同一行:11px 的三个数 + 11px 的两个按钮,
        320 宽下「行囊 30 · 器灵尘 123,456 收纳·启 分解」几乎要折。
        读数归读数、动作归动作 —— 动作单独一行,并各带自己的语义色。
      -->
      <div class="mt-3 flex items-baseline justify-between px-1">
        <span class="text-[11px] text-ink-faint tabular">行囊</span>
        <!--
          器灵尘走 formatExact 全量展开,不走 formatNum 的缩写 ——
          它是要对账的钱(强化扣多少、分解给多少都按它算),
          缩成「5千」就等于把账本藏起来一半。行囊数是小整数,照旧。
        -->
        <span class="text-[11px] text-ink-soft tabular">
          {{ inventory.bagItems.length }}/{{ BAG_CAPACITY }} ·
          <span class="text-ink-faint">器灵尘</span> {{ formatExact(resources.dust) }}
        </span>
      </div>
      <div class="mt-1.5 flex gap-2">
        <button
          class="chip-ink flex-1 !justify-center !py-1.5 text-[11px]"
          aria-label="智能收纳设置"
          :aria-expanded="smartOpen"
          @click="smartOpen = true"
        >
          收纳{{ settings.smartKeep.enabled ? "·启" : "" }}
        </button>
        <button
          class="chip-ink flex-1 !justify-center !py-1.5 text-[11px]"
          aria-label="批量分解装备"
          :aria-expanded="decomposeOpen"
          @click="decomposeOpen = true"
        >
          分解
        </button>
      </div>
      <div class="mt-2 grid grid-cols-3 gap-2">
        <button
          v-for="row in slotRows"
          :key="row.slot"
          class="card-ink flex flex-col items-center gap-1 px-2 py-2.5 active:scale-95"
          @click="pickerSlot = row.slot"
        >
          <!--
            槽名与下面的装备名同为 10px 时,一格里两层字一样重,读的人得先分辨
            「哪个是我的东西」。槽名走楷体 + 字距:外形一变就认得出是题头而非内容;
            「·N」是候选件数,压到更淡的一档。
          -->
          <span class="font-kai text-[10px] tracking-[0.15em] text-ink-faint">
            {{ row.name }}
            <span v-if="row.stock" class="tracking-normal text-ink-faint/70">·{{ row.stock }}</span>
          </span>
          <template v-if="row.item && row.template">
            <GameIcon
              :name="row.template.icon"
              :size="16"
              :style="{ color: qualityDef(row.item.quality).color }"
            />
            <span
              class="w-full truncate text-center font-kai text-[10px]"
              :style="{ color: qualityDef(row.item.quality).color }"
            >
              {{ row.template.name }}
              <template v-if="row.item.level > 0">+{{ row.item.level }}</template>
              <template v-if="row.item.note">·{{ row.item.note }}</template>
            </span>
          </template>
          <template v-else>
            <span class="grid h-4 w-4 place-items-center text-ink-faint">·</span>
            <span class="text-[10px] text-ink-faint">空悬</span>
          </template>
        </button>
      </div>
      <p class="mt-2 text-center text-[10px] text-ink-faint">
        点击部位查看候选,行囊满时新掉落自动折作器灵尘
      </p>
      <!--
        一键穿最强:纯方便性动作,只改装配,绝不把好换差。
        它是常驻的便利入口 —— 从前藏在「有共鸣套才出现」的卡里,后来塞进「收纳/分解」
        那一排 11px 小字里,两回都没人看得见(两次实测反馈)。故改成整行按钮,写明全称。
      -->
      <button
        class="btn-ghost mt-2 w-full !py-2 !text-[11px]"
        aria-label="一键各部位换最强"
        @click="wearEquipBest"
      >
        一键 · 各部位换最强
      </button>

      <!-- 全部藏品(含佩戴中):部位槽之下的完整清单 -->
      <div v-if="allItems.length" class="mt-4">
        <SectionTitle
          title="全部藏品"
          :hint="`${allItems.length} 件 · 行囊 ${inventory.bagItems.length}/${BAG_CAPACITY}`"
        />
        <!-- 方格背包:五列格子 + 空槽占位,一眼看出还剩多少地方 -->
        <!--
          四列,不是五列 —— 390 宽下五列每格只剩 ~70px,而格子里要装图标、名字、
          强化等级与三枚角标(佩/共/新):名字几乎必被截成两三个字,8px 的角标
          更是认不出的墨点。四列给到 ~88px,名字与角标才都有立足处。
          320 宽下四列仍有 ~66px,比原来的五列 ~50px 宽裕。
        -->
        <div class="mt-2 grid grid-cols-4 gap-2">
          <EquipmentCard
            v-for="row in allItems"
            :key="row.item.uid"
            :item="row.item"
            :equipped="row.equipped"
            @open="openDetail"
          />
        </div>
      </div>
      <p v-else class="empty-note mt-8 text-center text-[11px] text-ink-faint">
        行囊空空,去历练中寻些机缘吧
      </p>
    </template>

    <!-- 丹药 -->
    <template v-else-if="tab === 'pill'">
      <!-- 开炉炼丹:入口置顶,点开弹窗 -->
      <button
        class="card-ink mt-3 flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:scale-99"
        @click="craftOpen = true"
      >
        <span
          class="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-cinnabar/85 font-kai text-[19px] text-paper"
          >炉</span
        >
        <span class="min-w-0 flex-1">
          <span class="block t-card">开炉炼丹</span>
          <span class="block truncate text-[10px] leading-relaxed text-ink-faint">
            {{
              recipes.length > 0
                ? `已知丹方 ${recipes.length} 种 · ${HERB_GRADE_SHORT[herbGradeOfMajor(player.major)]}灵草 ${resources.herbOf(herbGradeOfMajor(player.major))}`
                : "尚不知任何丹方"
            }}
          </span>
        </span>
        <span class="shrink-0 text-[11px] text-ink-faint">›</span>
      </button>

      <!-- 灵草坊(ISS-306):灵石购草 —— 草比石贵,想补哪一品,明码标价(极贵) -->
      <button
        class="card-ink mt-2 flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left active:scale-99"
        @click="marketOpen = true"
      >
        <span
          class="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-jade/85 font-kai text-[15px] text-paper"
          >坊</span
        >
        <span class="min-w-0 flex-1">
          <span class="block t-card">灵草坊</span>
          <span class="block truncate text-[10px] leading-relaxed text-ink-faint">
            灵石买草 · 凡品 {{ formatGN(herbBuyPrice(1)) }} 灵石一株,道品
            {{ formatGN(herbBuyPrice(5)) }} 灵石一株
          </span>
        </span>
        <span class="shrink-0 text-[11px] text-ink-faint">买 ›</span>
      </button>

      <!-- 丹匣:格子只给图标、名号与存量,详情看弹窗 -->
      <div v-if="pillRows.length" class="mt-3 grid grid-cols-4 gap-2">
        <ItemCell
          v-for="row in pillRows"
          :key="row.def!.id"
          :icon="row.def!.icon"
          :name="row.def!.name"
          :tone="qualityDef(row.def!.quality).color"
          :foot="`×${row.count}`"
          :label="`${qualityDef(row.def!.quality).name}·${row.def!.name} · 存 ${row.count}`"
          @open="pillDetail = row.def!.id"
        />
      </div>
      <p v-else class="empty-note mt-10 text-center text-[11px] text-ink-faint">
        丹匣空空,去藏经阁参悟丹方,或去坊市收购几株灵草
      </p>
    </template>

    <!-- 材料 -->
    <template v-else-if="tab === 'material'">
      <!--
        六格材料原先混成一排:灵草/玄铁/残页/器灵尘/悟道点/灵石,彼此的用途
        差得很远(前三样进炉子,后三样进账本)。分两组,各带一行说明 ——
        找「炼丹要什么」与「我还有多少底子」是两件事。
      -->
      <p class="mt-3 px-1 text-[11px] text-ink-faint">炼制之材 · 进炉子</p>
      <div class="mt-1.5 grid grid-cols-4 gap-2">
        <ItemCell
          v-for="m in craftMaterials"
          :key="m.key"
          :icon="m.icon"
          :name="m.name"
          plain
          :icon-class="m.color"
          :foot="m.display"
          :label="`${m.name} ${m.display}`"
          @open="materialDetail = m.key"
        />
      </div>
      <p class="mt-3 px-1 text-[11px] text-ink-faint">修行所积 · 进账本</p>
      <div class="mt-1.5 grid grid-cols-4 gap-2">
        <ItemCell
          v-for="m in stockMaterials"
          :key="m.key"
          :icon="m.icon"
          :name="m.name"
          plain
          :icon-class="m.color"
          :foot="m.display"
          :label="`${m.name} ${m.display}`"
          @open="materialDetail = m.key"
        />
      </div>
    </template>

    <!-- 法宝:面板不是弹窗,整段在 ArtifactPanel(祭炼的账随面板走) -->
    <template v-else>
      <ArtifactPanel />
    </template>

    <!-- 丹药详情 -->
    <BaseModal
      :open="currentPill !== null"
      :title="currentPill?.def?.name ?? ''"
      @close="pillDetail = null"
    >
      <template v-if="currentPill?.def">
        <div class="flex items-center gap-3">
          <span
            class="grid h-12 w-12 shrink-0 place-items-center rounded-md"
            :style="{
              color: qualityDef(currentPill.def.quality).color,
              background: colorWithAlpha(qualityDef(currentPill.def.quality).color, 0.08),
            }"
          >
            <GameIcon :name="currentPill.def.icon" :size="24" />
          </span>
          <div class="min-w-0">
            <p class="text-[11px]" :style="{ color: qualityDef(currentPill.def.quality).color }">
              {{ qualityDef(currentPill.def.quality).name }}
            </p>
            <p class="text-[11px] text-ink-faint tabular">持有 ×{{ currentPill.count }}</p>
          </div>
        </div>
        <p class="mt-3 t-body text-ink-soft">{{ currentPill.def.desc }}</p>
        <!-- 效果与来路:丹药卡片此前只有风味与数量,服下去会怎样一个字都没说 -->
        <p class="mt-2 whitespace-pre-line text-[11px] leading-relaxed text-qing">
          {{ pillFuncText(currentPill.def) }}
        </p>
        <p v-if="pillMasteryText(currentPill.def.id)" class="mt-1 text-[11px] text-ink-faint">
          {{ pillMasteryText(currentPill.def.id) }}
        </p>
        <!--
          服前把叠层/将顶摊明(与修行快捷卡同口径 buffOverflowOf):增益丹顶满再吃 = 白费,
          usePill 在 full 也照吃,不能等服后 toast 才明白 —— 决策就地可见。
        -->
        <p
          v-if="currentPillHint"
          class="mt-1 text-[11px]"
          :class="
            currentPillHint.tone === 'cinnabar'
              ? 'text-cinnabar'
              : currentPillHint.tone === 'amber'
                ? 'text-amber-ink'
                : 'text-ink-faint'
          "
        >
          {{ currentPillHint.text }}
        </p>
      </template>
      <template #footer>
        <div class="flex gap-2">
          <!-- 即时丹才许连服:增益丹药力一顶后面全白吃,不挂批量按钮(涉策 buffOverflowOf) -->
          <button v-if="canBatchPill" class="btn-ghost flex-1" @click="onUsePillBatch()">
            连服 ×{{ PILL_BATCH }}
          </button>
          <button
            class="btn-seal flex-1"
            :disabled="currentPillOverflow === 'full'"
            @click="onUsePill()"
          >
            服 用
          </button>
        </div>
      </template>
    </BaseModal>

    <!-- 材料详情 -->
    <BaseModal
      :open="currentMaterial !== null"
      :title="currentMaterial?.name ?? ''"
      @close="materialDetail = null"
    >
      <template v-if="currentMaterial">
        <div class="flex items-center gap-3">
          <span class="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-ink/5">
            <GameIcon :name="currentMaterial.icon" :size="24" :class="currentMaterial.color" />
          </span>
          <div class="min-w-0">
            <p class="font-kai text-[15px] text-ink tabular">{{ currentMaterial.full }}</p>
            <p class="text-[10px] text-ink-faint">现有</p>
          </div>
        </div>
        <!--
          灵草五品:总读数归一堆,看不出这一品的方子够不够。逐品列出持有 ——
          与炼丹头 / 灵草坊同一套分档读数(herbGradeHeld / herbOf 同源)。
        -->
        <template v-if="currentMaterial.key === RESOURCE_LABELS.herb">
          <p class="mt-3 text-[10px] text-ink-faint">分品持有</p>
          <div class="mt-1 flex flex-wrap gap-1.5">
            <span
              v-for="g in HERB_GRADES"
              :key="g"
              class="chip-ink !py-0.5 !px-2 !text-[10px] tabular"
              :class="herbGradeHeld(g) > 0 ? 'text-jade' : 'text-ink-faint'"
              :title="HERB_GRADE_NAMES[g]"
            >
              {{ HERB_GRADE_SHORT[g] }} {{ herbGradeHeld(g) }}
            </span>
          </div>
        </template>
        <p class="mt-3 t-body text-ink-soft">{{ currentMaterial.desc }}</p>
      </template>
      <template #footer>
        <button class="btn-seal w-full" @click="materialDetail = null">收 起</button>
      </template>
    </BaseModal>

    <!-- 灵草坊:弹窗本体在 HerbShopDialog,坊里的账在 useHerbShop(两处同源) -->
    <HerbShopDialog :open="marketOpen" @close="marketOpen = false" />

    <!-- 开炉炼丹:弹窗本体在 BrewingDialog,炉前的账在 useBrewing(两处同源) -->
    <BrewingDialog
      :open="craftOpen"
      @close="craftOpen = false"
      @open-herb-shop="marketOpen = true"
    />

    <!-- 部位候选列表:弹窗本体在 SlotCandidatesDialog,候选的账(战 ±N)随它走 -->
    <SlotCandidatesDialog :slot-name="pickerSlot" @close="pickerSlot = null" />

    <!-- 一键分解 + 智能收纳:弹窗本体在 DismantleDialog(两扇共用一个容器),开关留本页 -->
    <DismantleDialog
      :decompose-open="decomposeOpen"
      :smart-open="smartOpen"
      @close-decompose="decomposeOpen = false"
      @close-smart="smartOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useInventoryStore } from "@/stores/inventory";
import { useResourcesStore } from "@/stores/resources";
import { usePlayerStore } from "@/stores/player";
import { useUiStore } from "@/stores/ui";
import { useSettingsStore } from "@/stores/settings";
import { useCultivationStore } from "@/stores/cultivation";
import { qualityDef } from "@/data/qualities";
import { pillDef } from "@/data/pills";
import { activeBuffsOf, buffOverflowOf, buffStackCount } from "@/core/engineBuffs";
import type { BuffOverflow } from "@/core/engineBuffs";
import {
  HERB_GRADES,
  HERB_GRADE_NAMES,
  HERB_GRADE_SHORT,
  herbBuyPrice,
  herbGradeOfMajor,
} from "@/data/herbGrades";
import { EQUIP_SLOT_NAMES, equipmentTemplate } from "@/data/equipment";
import { BAG_CAPACITY } from "@/data/constants";
import { RESOURCE_LABELS } from "@/data/resourceNames";
import { PILL_BATCH, usePill, usePillBatch } from "@/core/pillService";
import { equipAllBest, equipSetCombo } from "@/core/equipBest";
import { equipSetDef, setCounts, type EquipSetDef } from "@/core/equipSet";
import { useLoreStore } from "@/stores/lore";
import { formatGN, formatExact, formatNum, formatPercent } from "@/utils/format";
import { colorWithAlpha } from "@/ui/colorVar";
import type { EquipSlot } from "@/types";
import SectionTitle from "@/components/common/SectionTitle.vue";
import InkTabs from "@/components/common/InkTabs.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import ArtifactPanel from "@/components/inventory/ArtifactPanel.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import EquipmentCard from "@/components/equipment/EquipmentCard.vue";
import ItemCell from "@/components/common/ItemCell.vue";
import BrewingDialog from "@/components/inventory/BrewingDialog.vue";
import HerbShopDialog from "@/components/inventory/HerbShopDialog.vue";
import SlotCandidatesDialog from "@/components/inventory/SlotCandidatesDialog.vue";
import DismantleDialog from "@/components/inventory/DismantleDialog.vue";
import { useBrewing } from "@/composables/useBrewing";

const inventory = useInventoryStore();
// 「新」角标清账时机 = 离开背包那一刻(路由无 keep-alive,离开即卸载):
// 若在挂载时清,首帧会把刚渲染出来的「新」立刻抹掉,玩家看不见哪个是新入包的。
// 挂着背包的整段看下来,离开时才把这一批记为已见 —— 下次进背包,新角标只归
// 这次离包之后新入的那几件(见 inventorySeen.spec)。
onUnmounted(() => inventory.markInventorySeen());
const resources = useResourcesStore();
const ui = useUiStore();
const player = usePlayerStore();
const settings = useSettingsStore();

// 开炉炼丹:页面只管开关(craftOpen)与跳灵草坊(marketOpen),炉前的账全在 useBrewing
// —— 页面与 BrewingDialog 同源调用,不许另抄一份 computed(两份定义 = 两本账)。
// 页面只解构自己用到的那几样(丹方总数 / 逐品持有 / 效果文案);其余成员弹窗专用。
const { herbGradeHeld, recipes, pillFuncText } = useBrewing();

// 灵草坊(ISS-306):灵石购草 —— 开关(marketOpen)留页面,坊里的账在 useHerbShop
const marketOpen = ref(false);
const lore = useLoreStore();

type Tab = "equip" | "pill" | "material" | "artifact";
const tab = ref<Tab>("equip");

const TABS: { id: Tab; label: string }[] = [
  { id: "equip", label: "装备" },
  { id: "pill", label: "丹药" },
  { id: "material", label: "材料" },
  { id: "artifact", label: "法宝" },
];

// ---- 装备:部位槽 + 部位候选列表 ----
const SLOTS: EquipSlot[] = [
  "weapon",
  "head",
  "body",
  "wrist",
  "belt",
  "boots",
  "necklace",
  "ring",
  "talisman",
];
const pickerSlot = ref<EquipSlot | null>(null);

/** 装备共鸣:已装备件里的同组计数(未满也列出来,让玩家知道差几件) */
const setRows = computed(() => {
  const counts = setCounts(inventory.equippedItems);
  return [...counts.entries()]
    .map(([id, count]) => {
      const def = equipSetDef(id);
      return def ? { def, count, active: count >= def.required } : null;
    })
    .filter((row): row is { def: EquipSetDef; count: number; active: boolean } => row !== null)
    .sort((a, b) => Number(b.active) - Number(a.active) || b.count - a.count);
});

/** 一键穿最强:换成几件就报几件,没换就说"已是最佳"(与核心同一套不降级口径) */
function wearEquipBest(): void {
  const n = equipAllBest(inventory);
  ui.toast(n > 0 ? `一键换装:换上 ${n} 件` : "已是最佳,无需更动", n > 0 ? "success" : "info");
}

/** 穿齐某套:换成几件报几件;已穿更强的不动,幂等 */
function wearSetOf(setId: string): void {
  const n = equipSetCombo(inventory, setId);
  ui.toast(n > 0 ? `穿齐共鸣:换上 ${n} 件` : "此套已是最佳,无需更动", n > 0 ? "success" : "info");
}

const slotRows = computed(() =>
  SLOTS.map((slot) => {
    const uid = inventory.equipped[slot];
    const item = uid ? inventory.findItem(uid) : undefined;
    return {
      slot,
      name: EQUIP_SLOT_NAMES[slot],
      item,
      template: item ? equipmentTemplate(item.templateId) : undefined,
      stock: inventory.bagItems.filter((it) => equipmentTemplate(it.templateId)?.slot === slot)
        .length,
    };
  }),
);

/** 全部藏品(含佩戴中),按品质/层级降序 */
const allItems = computed(() =>
  inventory.items
    .map((item) => ({ item, equipped: inventory.equippedUids.has(item.uid) }))
    .sort((a, b) => {
      const dq = qualityDef(b.item.quality).rank - qualityDef(a.item.quality).rank;
      return dq !== 0 ? dq : b.item.tier - a.item.tier;
    }),
);

/** 部位候选弹窗(pickerRows / 换装 / 卸下)在 SlotCandidatesDialog —— 候选的账随弹窗走 */

function openDetail(uid: string): void {
  ui.equipDetailUid = uid;
}

const pillRows = computed(() =>
  Object.entries(inventory.pills)
    .map(([id, count]) => ({ def: pillDef(id), count }))
    .filter((x) => x.def !== undefined && x.count > 0)
    .sort((a, b) => qualityDef(b.def!.quality).rank - qualityDef(a.def!.quality).rank),
);

// 修行 store:丹药详情的服前判定(buffOverflowOf)与增益叠数要读当前 buff;
// 开炉幕的炼丹增益(alchemyBuffRows)也用它,如今在 useBrewing 里自取同一单例。
const cult = useCultivationStore();

/**
 * 材料的图标色 —— 一律走色板真类,且各按物性给色:
 * 灵草(木性)、玄铁(金性)、残页与悟道点(文墨)、器灵尘(器)、灵石(金贵)。
 * 曾经六格全是 ink-soft,格子里的图标只剩「黑白剪影」一种身份,
 * 于是四列格子最大的那块面积(图标)不承担任何识别功能。
 */
const materialRows = computed(() => [
  {
    icon: "leaf",
    name: RESOURCE_LABELS.herb,
    desc: "炼丹的根本",
    value: resources.herb,
    color: "text-jade",
  },
  {
    icon: "mountain",
    name: RESOURCE_LABELS.ore,
    desc: "筑造与炼器之材",
    value: resources.ore,
    color: "text-ink-soft",
  },
  {
    icon: "scroll",
    name: RESOURCE_LABELS.page,
    desc: "集残页可参悟功法",
    value: resources.page,
    color: "text-qing",
  },
  {
    icon: "sparkles",
    name: RESOURCE_LABELS.dust,
    desc: "强化装备的灵性之尘",
    value: resources.dust,
    color: "text-violet-ink",
  },
  {
    icon: "book",
    name: RESOURCE_LABELS.wudao,
    desc: "功法进修与法宝炼化所需",
    value: resources.wudao,
    color: "text-cinnabar",
  },
]);

/** 材料格子:含灵石一并展示,数量走 formatNum 免得格子被长数字撑破 */
const materialGrid = computed(() => [
  ...materialRows.value.map((m) => ({
    key: m.name,
    icon: m.icon,
    name: m.name,
    desc: m.desc,
    color: m.color,
    display: formatNum(m.value),
    full: String(m.value),
  })),
  {
    key: "灵石",
    icon: "gem",
    name: "灵石",
    desc: "修行界的通行货币",
    color: "text-gold-ink",
    display: formatGN(resources.spiritStone),
    full: formatGN(resources.spiritStone),
  },
]);

const materialDetail = ref<string | null>(null);
/**
 * 材料页的两组。分组的依据是**用途**而不是数量:前三样投进炼丹炉与炼器,
 * 后三样是账面上的积余(器灵尘/悟道点/灵石)。找「炼丹要什么」与
 * 「我还有多少底子」是两个问题,混成一排时两样都得从头找一遍。
 *
 * 组名一律读 RESOURCE_LABELS —— 手写字符串会在改全称时静默落空
 * (分组悄悄变空,而页面照常渲染,不会有人发现)。
 */
const CRAFT_KEYS: string[] = [
  RESOURCE_LABELS.herb,
  RESOURCE_LABELS.ore,
  RESOURCE_LABELS.dust,
  RESOURCE_LABELS.page,
];
const craftMaterials = computed(() =>
  materialGrid.value.filter((m) => CRAFT_KEYS.includes(m.name)),
);
const stockMaterials = computed(() =>
  materialGrid.value.filter((m) => !CRAFT_KEYS.includes(m.name)),
);
const currentMaterial = computed(
  () => materialGrid.value.find((m) => m.key === materialDetail.value) ?? null,
);

const pillDetail = ref<string | null>(null);
const currentPill = computed(() =>
  pillDetail.value ? (pillRows.value.find((r) => r.def?.id === pillDetail.value) ?? null) : null,
);

/**
 * 增益丹服前判定(与修行快捷卡同口径 buffOverflowOf,不另造判据):
 * full=顶满再服即白费,partial=贴着上限只续到顶。
 * 抽成独立 computed,让「服 用」按钮在 full 态一并置灰 —— 灰的同时
 * currentPillHint 已把拦因摊出来,仍走「白费也照吃不误」就说不通了。
 */
const currentPillOverflow = computed<BuffOverflow | null>(() => {
  const def = currentPill.value?.def;
  if (!def || def.kind !== "buff" || !def.buffId) return null;
  return buffOverflowOf(cult.buffs, def.buffId, Date.now());
});

const currentPillHint = computed<{ text: string; tone: "cinnabar" | "amber" | "faint" } | null>(
  () => {
    const def = currentPill.value?.def;
    if (!def || def.kind !== "buff" || !def.buffId) return null;
    const overflow = currentPillOverflow.value;
    if (overflow === "full") return { text: "药力已顶满——这一颗将白费", tone: "cinnabar" };
    if (overflow === "partial") return { text: "药力将触上限——这一颗只续到顶", tone: "amber" };
    const now = Date.now();
    const active = activeBuffsOf(cult.buffs, now).find((b) => b.def.id === def.buffId);
    const stack = active ? buffStackCount(def.buffId, active.remainingSec) : 1;
    if (stack <= 1) return null;
    return { text: `已叠 ${stack} 份,服之续时`, tone: "faint" };
  },
);

const craftOpen = ref(false);

/** 服用后若已吃完最后一枚,顺手关掉详情——否则弹窗会停在一个不存在的丹药上 */
function onUsePill(): void {
  const id = pillDetail.value;
  if (!id) return;
  usePill(id);
  if (!pillRows.value.some((r) => r.def?.id === id)) pillDetail.value = null;
}

/** 即时丹才许连服:增益丹药力一顶后面全白吃,不挂批量按钮(涉策 buffOverflowOf) */
const canBatchPill = computed(() => {
  const def = currentPill.value?.def;
  return def ? !def.buffId : false;
});

function onUsePillBatch(): void {
  const id = pillDetail.value;
  if (!id) return;
  usePillBatch(id, PILL_BATCH);
  if (!pillRows.value.some((r) => r.def?.id === id)) pillDetail.value = null;
}

/** 连炼一批与保底披露(craftBatch / batchGuaranteeText)在 useBrewing —— 开炉弹窗专用 */

/** 法宝面板整段(artifactSlots / artifactRows / 祭炼账)在 ArtifactPanel —— 面板不是弹窗,账随面板走 */

// ---- 一键分解弹窗 + 智能收纳:开关留页面,弹窗的账(档位清单/保留线/体检读数/清理确认)在 DismantleDialog
const decomposeOpen = ref(false);
const smartOpen = ref(false);

/**
 * 丹方读到几分熟 —— 与图鉴的「已得方/通晓」同一份状态(lore.recipeLore)。
 * 无方之丹没有这一行:它本就炼不出来(见 ui/itemText.pillSourceText)。
 */
function pillMasteryText(id: string): string {
  const def = pillDef(id);
  if (!def?.recipe) return "";
  const m = lore.recipeMastery(id);
  if (m <= 0) return "此方尚未到手 —— 去藏经阁翻书,或向师长讨教";
  if (m >= 1) return "此方已通晓:火候节点烂熟于心";
  return `此方已得,熟练 ${formatPercent(m, 0)} —— 多炼几炉便到通晓`;
}
</script>
