<template>
  <div class="stagger-in space-y-4 px-4 pb-6 pt-4">
    <!-- 抬头 -->
    <div class="card-ink flex items-center justify-between gap-2 px-4 py-3">
      <!--
        冷启动直接落在这一页时(书签 / deep link / 恢复上次路由),站内没有上一页,
        裸 router.back() 会退到 about:blank 把游戏一起带走 —— 故走 goBack(父页兜底)
      -->
      <button class="-my-1.5 py-1.5 text-left text-[12px] text-ink-faint" @click="goBack(router, { name: 'home' })">← 返回</button>
      <div class="min-w-0 text-center">
        <p class="font-kai text-[15px] tracking-[0.3em] text-ink">洞府营造</p>
        <p class="text-[10px] text-ink-faint">经营家业,道途更稳</p>
      </div>
      <span class="w-10 shrink-0" />
    </div>

    <!-- 建筑 -->
    <section>
      <SectionTitle title="营造" hint="各司其职,日夜不辍" />
      <!-- 洞府是其余建筑等级上限的枢纽:提为整宽主卡置顶,其余 6 座排 2 列 3 行 -->
      <div class="mt-2 grid grid-cols-2 gap-2.5">
        <BuildingCard v-if="mansionDef" :def="mansionDef" class="col-span-2" />
        <BuildingCard v-for="def in otherBuildings" :key="def.id" :def="def" />
      </div>
    </section>

    <!--
      离线存续阶梯:离线上限按洞府等级分档,从前只活在常数表里
      (OFFLINE_CAP_HOURS 仅结算用),玩家看不出"现在第几档、升洞府能到哪一档"。
      五格一栏,亮到当前档,title 注各档可攒几时。
    -->
    <section>
      <SectionTitle title="离线存续" :hint="`当前 ${offlineCapHours} 时`" />
      <div class="mt-2 flex items-stretch gap-1.5">
        <div
          v-for="(h, i) in OFFLINE_CAP_HOURS"
          :key="i"
          class="flex-1 rounded-t-sm border px-0.5 pb-1 pt-2 text-center text-[10px] tabular"
          :class="i <= mansionLevel ? 'border-cinnabar/50 bg-cinnabar/6 text-cinnabar' : 'border-ink/15 text-ink-faint'"
          :title="`洞府 ${i} 级可攒 ${h} 小时`"
        >
          {{ h }}时
        </div>
      </div>
      <p class="mt-1.5 text-[10px] text-ink-faint">
        离线上限随洞府等级抬升
        <template v-if="mansionLevel < OFFLINE_CAP_HOURS.length - 1">
          —— 升到 {{ mansionLevel + 1 }} 级,可攒至 {{ OFFLINE_CAP_HOURS[mansionLevel + 1] }} 时
        </template>
        <template v-else>—— 已至顶档</template>
      </p>
    </section>

  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useRouter } from 'vue-router'
  import { goBack } from '@/router/goBack'
  import { useDongfuStore } from '@/stores/dongfu'
  import { OFFLINE_CAP_HOURS } from '@/data/constants'
  import { BUILDINGS } from '@/data/buildings'
  import SectionTitle from '@/components/common/SectionTitle.vue'
  import BuildingCard from '@/components/dongfu/BuildingCard.vue'

  const router = useRouter()
  const dongfu = useDongfuStore()

  /** 洞府是其余建筑的等级上限来源:整宽主卡置顶,不与普通建筑同格位 */
  const mansionDef = BUILDINGS.find(b => b.id === 'mansion')
  const otherBuildings = BUILDINGS.filter(b => b.id !== 'mansion')
  const mansionLevel = computed(() => dongfu.levels['mansion'] ?? 0)
  const offlineCapHours = computed(() => dongfu.offlineCapHours)
</script>
