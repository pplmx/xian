<template>
  <!-- 灵草坊(ISS-306):灵石购草 —— 五品明码标价,只进不出 -->
  <BaseModal :open="open" title="灵草坊" @close="emit('close')">
    <p class="mb-3 t-body leading-relaxed text-ink-faint">
      灵石买草,童叟无欺。<span class="text-ink-soft">草比石贵</span
      >——高一品贵十倍;每品的持有、单价与落处都摊在下面,闲石多时再图一炉高品。
    </p>
    <div class="divide-y divide-ink/10 border-y border-ink/10" data-herb-shop-ledger>
      <div v-for="row in marketRows" :key="row.grade" :data-herb-shop-row="row.grade" class="py-3">
        <div
          class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 tinylens:grid-cols-1 tinylens:gap-y-2"
        >
          <div class="flex min-w-0 items-center gap-2.5">
            <span
              class="grid h-8 w-8 shrink-0 place-items-center rounded-[2px] bg-jade/85 font-kai text-title text-paper"
              >{{ row.grade }}</span
            >
            <p class="min-w-0 whitespace-nowrap font-kai text-title text-ink" data-herb-shop-name>
              {{ row.name }}
            </p>
          </div>
          <div
            class="col-start-2 row-start-1 flex shrink-0 gap-1.5 tinylens:col-start-1 tinylens:row-start-3 tinylens:w-full"
            data-herb-shop-actions
          >
            <button
              class="btn-seal whitespace-nowrap !px-3 !py-1.5 !text-body tinylens:min-w-0 tinylens:flex-1"
              :disabled="!row.affordable"
              @click="buyOne(row.grade)"
            >
              买1
            </button>
            <button
              class="btn-seal whitespace-nowrap !px-3 !py-1.5 !text-body tinylens:min-w-0 tinylens:flex-1"
              :disabled="!row.affordable10"
              @click="buyTen(row.grade)"
            >
              买10
            </button>
          </div>
          <div
            class="col-span-2 row-start-2 min-w-0 space-y-0.5 text-note tabular tinylens:col-span-1"
            data-herb-shop-facts
          >
            <div
              class="flex flex-wrap gap-x-2 gap-y-0.5 text-ink-faint tinylens:flex-col"
              data-herb-shop-figures
            >
              <p class="whitespace-nowrap" data-herb-shop-held>持有 {{ row.held }}</p>
              <p class="whitespace-nowrap" data-herb-shop-price>
                单价 {{ formatGN(row.price) }} 灵石
              </p>
            </div>
            <!-- 落处:买错品=大额沉没。先把这品草喂谁的方子摆出来。 -->
            <p class="text-qing">{{ row.usage }}</p>
          </div>
          <!--
            付不起就把缺摆出来:买十的门槛是十株的价,值与买一口径同源 ——
            一盏灰灯不告诉差多少等于没说完(法宝炼化同款句式)。
          -->
          <p
            v-if="!row.affordable"
            class="col-span-2 row-start-3 text-note text-cinnabar tabular tinylens:col-span-1 tinylens:row-start-4"
          >
            尚差 {{ formatGN(row.short) }} 石
          </p>
          <p
            v-else-if="!row.affordable10"
            class="col-span-2 row-start-3 text-note text-cinnabar tabular tinylens:col-span-1 tinylens:row-start-4"
          >
            尚差 {{ formatGN(row.short10) }} 石 · 买十株
          </p>
        </div>
      </div>
    </div>
    <p class="mt-3 text-note leading-relaxed text-ink-faint">
      灵石不够时,账上会写明尚差多少 —— 那就去历练,别硬买。
    </p>
    <template #footer>
      <button class="btn-seal w-full" @click="emit('close')">收 市</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "@/components/common/BaseModal.vue";
import { formatGN } from "@/utils/format";
import { useHerbShop } from "@/composables/useHerbShop";

defineProps<{ open: boolean }>();
// marketOpen(页面状态)留 InventoryView,这里只回传 close —— 弹窗不许越手改别人的账。
const emit = defineEmits<{ close: [] }>();

// 灵草坊的账全在 useHerbShop —— 页面与弹窗同源调用,这里不另抄任何一份 computed
const { marketRows, buyOne, buyTen } = useHerbShop();
</script>
