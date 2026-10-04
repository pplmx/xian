<template>
  <div class="card-ink flex flex-col px-3 py-3" :class="flashing ? 'card-flash' : ''" @animationend.self="flashing = false">
    <div class="flex items-start justify-between gap-2">
      <p class="min-w-0 truncate font-kai text-[14px] tracking-wider text-ink">{{ props.def.name }}</p>
      <p :key="level" class="shrink-0 text-[10px] text-ink-faint animate-ink-pop">
        {{ level > 0 ? `${level}/${cap} 级` : '未启用' }}
      </p>
    </div>
    <!-- 每项效果一行一条:320px 双列卡里散文不再堆成 4~5 行高墙,两列高度也齐 -->
    <div class="mt-2 grow space-y-0.5 text-[11px] leading-relaxed text-ink-faint">
      <template v-if="level > 0">
        <p v-for="(line, i) in props.def.effectText(level)" :key="i">{{ line }}</p>
      </template>
      <p v-else>{{ props.def.desc }}</p>
    </div>
    <!-- 灵兽园:把当前相伴的灵兽报在园子里 —— 别的建筑都是数值,这里是活物 -->
    <p v-if="beastCompanionName" class="mt-1 flex items-center gap-1 text-[10px] text-jade">
      <GameIcon name="paw" :size="11" />居园相伴 · {{ beastCompanionName }}
    </p>
    <button class="btn-ghost mt-2 w-full !py-1.5 !text-[12px]" :disabled="!info.canUpgrade" @click="upgradeBuilding(props.def.id)">
      <!--
        数与量词必须黏在一起:窄屏(320)上卡片只有 ~140px,浏览器会在数字与「石」之间断行,
        于是按钮读成「升级 · 2,798 / 石 50铁」—— 单价被拆成两半。
        每个「数 + 量词」各自 nowrap,换行只发生在分隔符处。

        外面这层 span 也是必须的:btn-ghost 是 flex 容器,散落的文本节点会各自成为
        flex item 并**竖着堆**(实测直接把「升 / 级 / · / 317 石」排成一列)。
        收进一个 inline 文本块里,它们才按普通行内规则折行。
      -->
      <template v-if="info.canUpgrade">
        <span class="leading-tight">
          <span class="whitespace-nowrap">{{ level > 0 ? '升级' : '建造' }} ·</span>
          <span class="whitespace-nowrap">{{ formatGN(info.stone) }} 石</span>
          <span v-if="info.ore > 0" class="whitespace-nowrap">· {{ info.ore }} 铁</span>
        </span>
      </template>
      <template v-else><span class="whitespace-nowrap">{{ info.reason }}</span></template>
    </button>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import type { BuildingDef } from '@/types'
  import { useDongfuStore } from '@/stores/dongfu'
  import { usePlayerStore } from '@/stores/player'
  import { petDef } from '@/data/pets'
  import { buildingUpgradeInfo, upgradeBuilding } from '@/core/buildingService'
  import GameIcon from '@/components/common/GameIcon.vue'
  import { formatGN } from '@/utils/format'

  const props = defineProps<{ def: BuildingDef }>()

  const dongfu = useDongfuStore()
  const player = usePlayerStore()

  const level = computed(() => dongfu.levels[props.def.id] ?? 0)
  /** 实际可达上限:洞府全局闸门与自身品类上限取小,洞府卡展现的是"提升到什么档"的依据 */
  const cap = computed(() => dongfu.buildingCap(props.def.id))
  const info = computed(() => buildingUpgradeInfo(props.def.id))
  /** 灵兽园联动:洞府与宠物两系统彼此看见(只对 beast 这一座特例,其余建筑不理会) */
  const beastCompanionName = computed(() =>
    props.def.id === 'beast' && player.petId ? petDef(player.petId)?.name : undefined
  )

  // 升级落成:整卡金光一闪(动画播完自清)
  const flashing = ref(false)
  watch(level, (nv, ov) => {
    if (nv > ov) flashing.value = true
  })
</script>
