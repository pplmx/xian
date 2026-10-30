<template>
  <!-- 灵草坊(ISS-306):灵石购草 —— 五品明码标价,只进不出 -->
  <BaseModal :open="open" title="灵草坊" @close="emit('close')">
    <p class="mb-3 t-body text-ink-faint">
      灵石买草,童叟无欺。<span class="text-ink-soft">草比石贵</span>——凡品
      {{ formatGN(herbBuyPrice(1)) }} 灵石一株, 道品
      {{ formatGN(herbBuyPrice(5)) }}
      灵石一株,越往上是十倍一翻。大把闲石没处去时,这里有一炉高品的念想。
    </p>
    <div class="space-y-1.5">
      <div
        v-for="row in marketRows"
        :key="row.grade"
        class="flex items-center gap-2.5 rounded-[2px] bg-paper-deep/70 px-3 py-2"
      >
        <span
          class="grid h-8 w-8 shrink-0 place-items-center rounded-[2px] bg-jade/85 font-kai text-title text-paper"
          >{{ row.grade }}</span
        >
        <div class="min-w-0 grow">
          <p class="font-kai text-title text-ink">{{ row.name }}</p>
          <p class="text-note text-ink-faint tabular">
            持有 {{ row.held }} · 单价 {{ formatGN(row.price) }} 灵石
          </p>
          <!-- 落处:买错品=大额沉没。「草比石贵」十倍一翻,先把这品草喂谁的方子摆出来 -->
          <p class="text-note text-qing">{{ row.usage }}</p>
          <!--
            付不起就把缺摆出来:买十的门槛是十株的价,值与买一口径同源 ——
            一盏灰灯不告诉差多少等于没说完(法宝炼化同款句式)。
          -->
          <p v-if="!row.affordable" class="mt-0.5 text-note text-cinnabar tabular">
            尚差 {{ formatGN(row.short) }} 石
          </p>
          <p v-else-if="!row.affordable10" class="mt-0.5 text-note text-cinnabar tabular">
            尚差 {{ formatGN(row.short10) }} 石 · 买十株
          </p>
        </div>
        <button
          class="btn-seal shrink-0 !px-3 !py-1.5 !text-body"
          :disabled="!row.affordable"
          @click="buyOne(row.grade)"
        >
          买1
        </button>
        <button
          class="btn-seal shrink-0 !px-3 !py-1.5 !text-body"
          :disabled="!row.affordable10"
          @click="buyTen(row.grade)"
        >
          买10
        </button>
      </div>
    </div>
    <p class="mt-3 text-note leading-relaxed text-ink-faint">
      灵石不够的品阶按钮会沉下去 —— 那就去历练,别硬买。
    </p>
    <template #footer>
      <button class="btn-seal w-full" @click="emit('close')">收 市</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "@/components/common/BaseModal.vue";
import { herbBuyPrice } from "@/data/herbGrades";
import { formatGN } from "@/utils/format";
import { useHerbShop } from "@/composables/useHerbShop";

defineProps<{ open: boolean }>();
// marketOpen(页面状态)留 InventoryView,这里只回传 close —— 弹窗不许越手改别人的账。
const emit = defineEmits<{ close: [] }>();

// 灵草坊的账全在 useHerbShop —— 页面与弹窗同源调用,这里不另抄任何一份 computed
const { marketRows, buyOne, buyTen } = useHerbShop();
</script>
