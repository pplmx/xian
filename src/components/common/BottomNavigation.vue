<template>
  <!--
    底部留白 = max(CSS 安全区, 原生实测占位):安卓 WebView 不把三键导航栏高度告诉
    env(safe-area-inset-bottom)(恒 0),手势导航那根横杠半透明看不出问题 —— 真实占位
    经 NativeApp 桥量来,桥缺位(网页/iOS/桌面)恒 0,max 退化成 env(),与旧渲染逐位相同。
  -->
  <nav
    class="bottom-dock relative z-20 shrink-0 border-t border-transparent bg-paper-deep/95 backdrop-blur"
    :style="`padding-bottom: max(env(safe-area-inset-bottom), ${navInset}px)`"
  >
    <div class="ink-divider absolute -top-px inset-x-0" />
    <div
      class="bottom-dock-rail mx-2 mt-2 grid grid-cols-5 gap-0.5 border border-ink/10 bg-paper/60 p-0.5"
    >
      <!--
        当前在哪一页交给 RouterLink:它在 exact-active 时自己渲染 aria-current="page"
        (vue-router 的 aria-current-value 默认值就是 page)。这里不再手写一份 ——
        同一个事实两套来源没有好处;哪天换成手写的 <a>,它就会跟着一起丢。
        颜色、位移与那枚朱砂短笔只负责给眼睛看,判据在 layout-check 的逐页巡览里守着。
      -->
      <RouterLink
        v-for="tab in TABS"
        :key="tab.name"
        :to="tab.to"
        class="bottom-dock-tab relative flex min-h-[46px] flex-col items-center justify-center gap-0.5 px-0.5 py-1 transition-colors short:min-h-[40px] short:gap-0 short:py-0.5"
        :class="
          route.name === tab.name
            ? 'text-cinnabar bg-paper-deep/75'
            : 'text-ink-faint active:text-ink-soft'
        "
      >
        <!--
          落笔 —— 当前这栏顶上压一道朱砂短笔,像夹在书页间的那枚书签带。
          图标的位移与变色已经说了「选中的是我」,但那是**脚下**的动静;视线扫过底栏
          找「现在在哪」时,最短的路径是这排边缘 —— 一枚短笔贴着栏口,一眼就到。
          absolute 放置:底栏高度被「两栏钉死」盯着,一分都不许长。
        -->
        <span
          v-if="route.name === tab.name"
          class="absolute inset-x-0 top-0 mx-auto h-0.5 w-3.5 rounded-full bg-cinnabar"
          aria-hidden="true"
        />
        <span
          class="relative grid h-7 w-8 place-items-center transition-transform duration-200"
          :class="route.name === tab.name ? '-translate-y-0.5 scale-105' : ''"
        >
          <span
            v-if="route.name === tab.name"
            class="pointer-events-none absolute inset-0 border border-cinnabar/20 bg-cinnabar/6"
            aria-hidden="true"
          />
          <GameIcon :name="tab.icon" :size="20" class="relative" />
          <!--
            行囊有没看过的新件:从任何页都看得见「有新货」,开包即隐。量价分档 ——
            恰好一件还是原来的小点(轻晃不吵),≥2 件升级成计数徽标「N」(9+ 封顶);
            批量掉落那一刻的份量,单靠「有不有」说不出来。
          -->
          <span
            v-if="tab.name === 'inventory' && bagNewCount >= 2"
            class="absolute -right-1.5 -top-1 grid h-[13px] min-w-[13px] place-items-center rounded-full bg-cinnabar px-[3px] font-kai text-[8px] leading-none text-paper"
            :class="route.name === 'inventory' ? '' : 'animate-breathe'"
            aria-hidden="true"
            >{{ bagNewCount > 9 ? "9+" : bagNewCount }}</span
          >
          <span
            v-else-if="tab.name === 'inventory' && bagNewCount === 1"
            class="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-cinnabar"
            :class="route.name === 'inventory' ? '' : 'animate-breathe'"
          />
          <!--
            修炼点的「此刻可以破境」—— 这是这一作最要紧的一次点击,却只有站在修炼页
            才看得见。玩家在洞府、历练、背包里待着时,修为早就够了、灵气也回满了,
            而底栏一言不发。

            用玉色实心圆点(不是背包那枚朱砂计数徽标):它说的是「一件事在等你」,
            不是一个数。呼吸动画只在**别的页**上跑 —— 站在修炼页时它已经在你眼前,
            再晃就是噪音。
          -->
          <span
            v-if="tab.name === 'cultivation' && canBreakthrough"
            class="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-jade"
            :class="route.name === 'cultivation' ? '' : 'animate-breathe'"
            aria-hidden="true"
          />
        </span>
        <span
          class="relative font-kai text-[11px] tracking-[0.2em] short:text-[10px] tinylens:text-[10px] tinylens:tracking-normal"
          >{{ tab.label }}</span
        >
        <!--
          视觉上说得清、读屏里也要说得出。

          · 背包角标:那枚「3」/「9+」说的是「有几件新货」,不是「第 3 项」——
            数字对读屏是噪音(已 aria-hidden),名称末尾补一句「N 件新物」。
          · 修炼页的玉色圆点:说的是「此刻可以破境」—— 本作最要紧的一次点击提示,
            圆点本身 aria-hidden,不补这一句就等于只给视力好的人看。
          两处都挂在链接内,读出来是「背包(3 件新物) 链接,当前页」。
        -->
        <span v-if="tab.name === 'inventory' && bagNewCount > 0" class="sr-only">
          ({{ bagNewCount }} 件新物)
        </span>
        <span v-if="tab.name === 'cultivation' && canBreakthrough" class="sr-only">(可破境)</span>
      </RouterLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useNativeInsets } from "@/composables/useNativeInsets";
import { useInventoryStore } from "@/stores/inventory";
import { breakthroughInfo } from "@/core/breakthrough";
import GameIcon from "./GameIcon.vue";

const route = useRoute();
/** 安卓三键实测占位(防底栏被系统按钮盖住,见 useNativeInsets) */
const { bottom: navInset } = useNativeInsets();
/** 背包页签的新货量:没开包看过几件报几件(判据在 inventory store 的 newItemCount,见 inventorySeen.spec) */
const bagNewCount = computed(() => useInventoryStore().newItemCount);
/**
 * 此刻能不能破境 —— 与修炼页卡头那一行读的是同一个 breakthroughInfo(),
 * 不另算一套「大概够了吧」。它直接吃 store,故在底栏也能调。
 */
const canBreakthrough = computed(() => breakthroughInfo().ready);

const TABS = [
  { name: "home", label: "洞府", icon: "mountain", to: "/" },
  { name: "cultivation", label: "修炼", icon: "flame", to: "/cultivation" },
  { name: "adventure", label: "历练", icon: "swords", to: "/adventure" },
  { name: "inventory", label: "背包", icon: "backpack", to: "/inventory" },
  { name: "character", label: "人物", icon: "circle-user", to: "/character" },
] as const;
</script>
