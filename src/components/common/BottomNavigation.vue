<template>
  <!--
    底部留白 = max(CSS 安全区, 原生实测占位):安卓 WebView 不把三键导航栏高度告诉
    env(safe-area-inset-bottom)(恒 0),手势导航那根横杠半透明看不出问题 —— 真实占位
    经 NativeApp 桥量来,桥缺位(网页/iOS/桌面)恒 0,max 退化成 env(),与旧渲染逐位相同。
  -->
  <nav
    class="relative z-20 shrink-0 border-t border-ink/15 bg-paper-deep/95 backdrop-blur"
    :style="`padding-bottom: max(env(safe-area-inset-bottom), ${navInset}px)`"
  >
    <div class="ink-divider absolute -top-px inset-x-0" />
    <div class="grid grid-cols-5">
      <RouterLink
        v-for="tab in TABS"
        :key="tab.name"
        :to="tab.to"
        class="relative flex flex-col items-center gap-0.5 py-2 transition-colors short:gap-0 short:py-1"
        :class="route.name === tab.name ? 'text-cinnabar' : 'text-ink-faint active:text-ink-soft'"
      >
        <span class="relative transition-transform duration-200" :class="route.name === tab.name ? '-translate-y-0.5 scale-110' : ''">
          <GameIcon :name="tab.icon" :size="20" />
          <!--
            行囊有没看过的新件:从任何页都看得见「有新货」,开包即隐。量价分档 ——
            恰好一件还是原来的小点(轻晃不吵),≥2 件升级成计数徽标「N」(9+ 封顶);
            批量掉落那一刻的份量,单靠「有不有」说不出来。
          -->
          <span
            v-if="tab.name === 'inventory' && bagNewCount >= 2"
            class="absolute -right-1.5 -top-1 grid h-[13px] min-w-[13px] place-items-center rounded-full bg-cinnabar px-[3px] font-kai text-[8px] leading-none text-paper"
            :class="route.name === 'inventory' ? '' : 'animate-breathe'"
          >{{ bagNewCount > 9 ? '9+' : bagNewCount }}</span>
          <span
            v-else-if="tab.name === 'inventory' && bagNewCount === 1"
            class="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-cinnabar"
            :class="route.name === 'inventory' ? '' : 'animate-breathe'"
          />
        </span>
        <span class="font-kai text-[11px] tracking-[0.2em] short:text-[10px]">{{ tab.label }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useRoute } from 'vue-router'
  import { useNativeInsets } from '@/composables/useNativeInsets'
  import { useInventoryStore } from '@/stores/inventory'
  import GameIcon from './GameIcon.vue'

  const route = useRoute()
  /** 安卓三键导航实测占位(防底栏被系统按钮盖住,见 useNativeInsets) */
  const { bottom: navInset } = useNativeInsets()
  /** 背包页签的新货量:没开包看过几件报几件(判据在 inventory store 的 newItemCount,见 inventorySeen.spec) */
  const bagNewCount = computed(() => useInventoryStore().newItemCount)

  const TABS = [
    { name: 'home', label: '洞府', icon: 'mountain', to: '/' },
    { name: 'cultivation', label: '修炼', icon: 'flame', to: '/cultivation' },
    { name: 'adventure', label: '历练', icon: 'swords', to: '/adventure' },
    { name: 'inventory', label: '背包', icon: 'backpack', to: '/inventory' },
    { name: 'character', label: '人物', icon: 'circle-user', to: '/character' }
  ] as const
</script>
