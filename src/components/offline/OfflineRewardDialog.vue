<template>
  <BaseModal :open="summary !== null" :closable="false" aria-label="离线归来结算">
    <div v-if="summary" class="text-center">
      <!-- 归来印信:此行结清盖一枚石绿「归」印 —— 突破是里程碑盖朱砂,归总是完成态盖石绿 -->
      <div class="relative mx-auto mt-1 h-16 w-16" aria-hidden="true">
        <div
          class="grid h-16 w-16 place-items-center rounded-full border-2 border-jade bg-jade/5 font-kai text-3xl text-jade animate-ink-pop animate-seal-breathe"
        >
          归
        </div>
      </div>
      <p class="mt-2 text-[11px] text-ink-faint">
        此去
        <span class="font-kai text-[14px] text-ink">{{ formatDuration(summary.seconds) }}</span>
        <!--
          两条账分开报:被动修行(修为/灵气)不限时、全额;产出与派遣受洞府上限。
          从前只写一句"收益按 X 结算",玩家看到的是"挂了一周没怎么变",却不知道哪一条被砍了。
        -->
        <template v-if="summary.capped"
          >(修为与灵气全额入账;产出与历练按
          {{ formatDuration(summary.cappedSeconds) }} 结算)</template
        >
      </p>
      <!--
        收益分两本账,不再是均质的一张流水:
          入账 —— 带回洞府的资源,数值是这张卡的主角(14px 楷体,与印信同一笔意);
          路上 —— 发生在外面的事(寿元在走、打过架、遇过人、捡过装备),
        它们不是「收获」,排在收获后面另起一段,寿元尤其不该与修为长得一样。
        组标用宽排楷体小字,与页签同款「留白当分隔」的水墨口气。
      -->
      <template v-if="gainRows.length">
        <div class="ink-divider my-3" />
        <SectionMark text="入 账" />
        <ul class="stagger-in space-y-2 text-left">
          <li
            v-for="row in gainRows"
            :key="row.label"
            class="flex items-center justify-between rounded-md bg-paper-deep/70 px-3 py-2 tinylens:flex-col tinylens:items-start tinylens:gap-0.5"
          >
            <span class="flex items-center gap-2 text-[14px] text-ink-soft">
              <GameIcon :name="row.icon" :size="15" class="text-ink-faint" />
              {{ row.label }}
            </span>
            <span class="font-kai tabular text-[14px] text-ink">{{ row.value }}</span>
          </li>
        </ul>
      </template>
      <template v-if="roadRows.length">
        <div class="ink-divider my-3" />
        <SectionMark text="路 上" />
        <ul class="stagger-in space-y-2 text-left">
          <li
            v-for="row in roadRows"
            :key="row.label"
            class="flex items-center justify-between rounded-md bg-paper-deep/70 px-3 py-2 tinylens:flex-col tinylens:items-start tinylens:gap-0.5"
          >
            <span class="flex items-center gap-2 text-[14px]" :class="row.cls">
              <GameIcon :name="row.icon" :size="15" class="text-ink-faint" />
              {{ row.label }}
            </span>
            <span class="tabular text-[14px]" :class="row.cls">{{ row.value }}</span>
          </li>
          <li v-if="savedEquipment.length" class="rounded-md bg-paper-deep/70 px-3 py-2">
            <p class="mb-1 flex items-center gap-2 text-[14px] text-ink-soft">
              <GameIcon name="backpack" :size="15" class="text-ink-faint" />
              拾得装备 ×{{ savedEquipment.length }}
            </p>
            <p class="flex flex-wrap gap-x-3 gap-y-1">
              <span
                v-for="(eq, i) in savedEquipment"
                :key="i"
                class="font-kai text-[11px]"
                :style="{ color: qualityDef(eq.quality).color }"
              >
                {{ qualityDef(eq.quality).name }}·{{ eq.name }}
              </span>
            </p>
          </li>
          <li v-if="eventReceipts.length" class="rounded-md bg-paper-deep/70 px-3 py-2">
            <p class="mb-1.5 flex items-center gap-2 text-[14px] text-ink-soft">
              <GameIcon name="star" :size="15" class="text-ink-faint" />
              际遇结果
            </p>
            <ul class="space-y-2">
              <li v-for="(receipt, i) in eventReceipts" :key="i">
                <p class="flex items-baseline justify-between gap-2 text-[11px]">
                  <span class="font-kai text-ink-soft">{{ receipt.title }}</span>
                  <span v-if="receipt.count > 1" class="tabular text-ink-faint">
                    ×{{ receipt.count }}
                  </span>
                </p>
                <p
                  v-for="(line, j) in receipt.lines"
                  :key="j"
                  class="mt-0.5 text-[11px] leading-relaxed text-ink"
                >
                  {{ line }}
                </p>
              </li>
            </ul>
          </li>
        </ul>
      </template>
      <p v-for="(note, i) in summary.notes" :key="i" class="mt-2 text-[11px] text-ink-faint">
        {{ note }}
      </p>
    </div>
    <template #footer>
      <button class="btn-seal w-full" @click="close">收 下</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { useUiStore } from "@/stores/ui";
import { formatDuration, formatGN, formatNum } from "@/utils/format";
import { qualityDef } from "@/data/qualities";
import { playSfx } from "@/core/audio";
import BaseModal from "@/components/common/BaseModal.vue";
import GameIcon from "@/components/common/GameIcon.vue";
import SectionMark from "@/components/common/SectionMark.vue";

const ui = useUiStore();

const summary = computed(() => ui.offlineSummary);

// 归来一声钟磬,与收益清点同起
watch(summary, (nv, ov) => {
  if (nv && !ov) playSfx("success");
});

interface RewardRow {
  icon: string;
  label: string;
  value: string;
  /** true=带回家的资源(入账组) false=发生在外面的事(路上组) */
  gain: boolean;
  /** 路上组的行级色调:寿元在走不是收获,归尘是折算 —— 都不该长得像进账 */
  cls?: string;
}

const rows = computed<RewardRow[]>(() => {
  const s = summary.value;
  if (!s) return [];
  const list: RewardRow[] = [];
  if (s.exp.m > 0)
    list.push({ icon: "flame", label: "修为", value: `+${formatGN(s.exp)}`, gain: true });
  if (s.stone.m > 0)
    list.push({ icon: "gem", label: "灵石", value: `+${formatGN(s.stone)}`, gain: true });
  if (s.qi > 0)
    list.push({ icon: "wind", label: "灵气", value: `+${formatNum(s.qi)}`, gain: true });
  if (s.herb > 0)
    list.push({ icon: "leaf", label: "灵草", value: `+${formatNum(s.herb)}`, gain: true });
  if (s.ore > 0)
    list.push({ icon: "mountain", label: "玄铁", value: `+${formatNum(s.ore)}`, gain: true });
  if (s.page > 0)
    list.push({ icon: "scroll", label: "功法残页", value: `+${formatNum(s.page)}`, gain: true });
  if (s.wudao > 0)
    list.push({ icon: "book", label: "悟道点", value: `+${formatNum(s.wudao)}`, gain: true });
  if (s.dust > 0)
    list.push({ icon: "sparkles", label: "器灵尘", value: `+${formatNum(s.dust)}`, gain: true });
  // 化尘总额已经单列一行动账;这里只交代有多少件没进包,避免把同一笔尘报两遍。
  if (s.recycledDust > 0) {
    const recycled = s.equipment.filter((e) => e.recycled).length;
    list.push({
      icon: "sparkles",
      label: "回收装备",
      value: `${recycled} 件 · 已折入器灵尘`,
      gain: false,
      cls: "text-ink-faint",
    });
  }
  // 寿元在走:不是收获,弱化 —— 从前它与修为同款同色,「你老了」和「你赚了」长得一样
  if (s.ageYears > 0)
    list.push({
      icon: "sunset",
      label: "寿元流逝",
      value: `${s.ageYears} 载`,
      gain: false,
      cls: "text-ink-faint",
    });
  if (s.battles > 0)
    list.push({
      icon: "swords",
      label: "寻常历练",
      value: `${s.wins} 胜 / ${s.battles} 战`,
      gain: false,
    });
  if (s.bossBattles > 0)
    list.push({
      icon: "crown",
      label: "区域之主",
      value: `${s.bossWins} 胜 / ${s.bossBattles} 战`,
      gain: false,
    });
  if (s.events > 0)
    list.push({ icon: "star", label: "路遇际会", value: `${s.events} 次`, gain: false });
  return list;
});

/** 入账组:带回家的资源,这张卡的主角 */
const gainRows = computed(() => rows.value.filter((r) => r.gain));
/** 路上组:发生在外面的事,排在收获后面另起一段 */
const roadRows = computed(() => rows.value.filter((r) => !r.gain));

/** 真正入行囊的装备(回收件已并入"回收化尘"行,不在此重复列出) */
const savedEquipment = computed(() => summary.value?.equipment.filter((e) => !e.recycled) ?? []);
/** 资源总差额看不出的际遇所得:丹药、法宝、功法、丹方、灵兽与增益 */
const eventReceipts = computed(() => summary.value?.eventReceipts ?? []);

function close(): void {
  ui.offlineSummary = null;
}
</script>
