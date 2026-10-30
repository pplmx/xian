<template>
  <!--
    市桥图只报「货 / 赏 / 寄」三摊此刻有没有事可做；精确件数、缺口与价格都在正文。
    故整图不重复进入读屏。
  -->
  <div class="market-arcade" data-market-arcade aria-hidden="true">
    <svg viewBox="0 0 168 146" role="presentation">
      <path
        class="market-arcade__bridge"
        d="M8 117 C36 108 62 124 84 117 C106 110 132 126 160 116"
      />
      <path class="market-arcade__bridge-shadow" d="M12 122 H156" />
      <path class="market-arcade__lane" d="M24 117 V80 H62 V117 M106 117 V80 H144 V117" />

      <g class="market-arcade__stall is-goods" :class="{ 'is-active': active === 'shelf' }">
        <path class="market-arcade__roof" d="M17 80 L43 61 L69 80 Z" />
        <path class="market-arcade__awning" d="M23 80 H63 V85 H23 Z" />
        <path class="market-arcade__counter" d="M25 85 H61 V111 H25 Z" />
        <path
          class="market-arcade__box"
          d="M30 96 H39 V104 H30 Z M42 92 H51 V104 H42 Z M54 99 H59 V104 H54 Z"
        />
        <text class="market-arcade__mark" x="43" y="117" text-anchor="middle">货</text>
        <circle
          v-for="i in 3"
          :key="`goods-${i}`"
          class="market-arcade__ready-dot"
          :class="{ 'is-lit': goods >= i }"
          :cx="31 + (i - 1) * 6"
          cy="88"
          r="1.45"
        />
      </g>

      <g class="market-arcade__stall is-bounty" :class="{ 'is-active': active === 'bounty' }">
        <path class="market-arcade__roof" d="M58 59 L84 40 L110 59 Z" />
        <path class="market-arcade__awning" d="M64 59 H104 V64 H64 Z" />
        <path class="market-arcade__board" d="M67 64 H101 V103 H67 Z" />
        <path class="market-arcade__notice" d="M73 72 H95 M73 78 H92 M73 84 H88 M73 90 H94" />
        <path class="market-arcade__post" d="M75 103 V111 M93 103 V111" />
        <text class="market-arcade__mark" x="84" y="117" text-anchor="middle">赏</text>
        <circle v-if="bounties > 0" class="market-arcade__seal" cx="97" cy="69" r="4.2" />
        <text
          v-if="bounties > 0"
          class="market-arcade__seal-mark"
          x="97"
          y="70.2"
          text-anchor="middle"
        >
          可
        </text>
      </g>

      <g class="market-arcade__stall is-consign" :class="{ 'is-active': active === 'sell' }">
        <path class="market-arcade__roof" d="M99 80 L125 61 L151 80 Z" />
        <path class="market-arcade__awning" d="M105 80 H145 V85 H105 Z" />
        <path class="market-arcade__counter" d="M107 85 H143 V111 H107 Z" />
        <path class="market-arcade__tag" d="M112 91 H124 V99 H112 Z M112 102 H124 V107 H112 Z" />
        <path class="market-arcade__slot-line" d="M130 92 H139 M130 98 H139 M130 104 H139" />
        <text class="market-arcade__mark" x="125" y="117" text-anchor="middle">寄</text>
        <circle
          v-for="i in consignSlots"
          :key="`consign-${i}`"
          class="market-arcade__consign-dot"
          :class="{ 'is-lit': consign >= i }"
          :cx="128 + (i - 1) * 6"
          cy="88"
          r="1.45"
        />
      </g>

      <circle class="market-arcade__coin" cx="84" cy="112" r="4.2" />
      <path class="market-arcade__coin-mark" d="M84 109.5 V114.5 M81.5 112 H86.5" />
    </svg>

    <span class="market-arcade__caption">
      <span class="tabular">货 {{ goods }}/{{ goodsTotal }}</span>
      <span class="tabular">赏 {{ bounties }}/{{ bountiesTotal }}</span>
      <span class="tabular">寄 {{ consign }}/{{ consignSlots }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    goods: number;
    goodsTotal: number;
    bounties: number;
    bountiesTotal: number;
    consign: number;
    consignSlots: number;
    active?: "shelf" | "bounty" | "sell";
  }>(),
  { active: "shelf" },
);
</script>

<style scoped>
.market-arcade {
  position: relative;
  display: grid;
  width: 168px;
  height: 146px;
  place-items: center;
  isolation: isolate;
}

.market-arcade::before {
  position: absolute;
  inset: 11px 7px 18px;
  border: 1px solid rgb(var(--color-ink-rgb) / 0.07);
  border-radius: 42% 42% 8% 8%;
  background:
    radial-gradient(circle at 50% 16%, rgb(var(--color-cinnabar-rgb) / 0.05), transparent 45%),
    linear-gradient(180deg, rgb(var(--color-paper-rgb) / 0.72), transparent 72%),
    rgb(var(--color-paper-deep-rgb) / 0.12);
  box-shadow: inset 0 0 24px rgb(var(--color-ink-rgb) / 0.025);
  content: "";
}

.market-arcade svg {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.market-arcade__bridge,
.market-arcade__bridge-shadow,
.market-arcade__lane,
.market-arcade__roof,
.market-arcade__awning,
.market-arcade__counter,
.market-arcade__box,
.market-arcade__board,
.market-arcade__notice,
.market-arcade__post,
.market-arcade__tag,
.market-arcade__slot-line,
.market-arcade__coin,
.market-arcade__coin-mark {
  fill: none;
}

.market-arcade__bridge {
  stroke: rgb(var(--color-ink-rgb) / 0.2);
  stroke-width: 1.1;
}

.market-arcade__bridge-shadow {
  stroke: rgb(var(--color-ink-rgb) / 0.06);
  stroke-dasharray: 2 3;
  stroke-width: 5;
}

.market-arcade__lane {
  stroke: rgb(var(--color-ink-rgb) / 0.07);
  stroke-dasharray: 1.5 3;
  stroke-width: 0.8;
}

.market-arcade__roof {
  fill: rgb(var(--color-ink-rgb) / 0.045);
  stroke: rgb(var(--color-ink-rgb) / 0.2);
  stroke-width: 0.9;
}

.market-arcade__awning {
  fill: rgb(var(--color-cinnabar-rgb) / 0.05);
  stroke: rgb(var(--color-cinnabar-rgb) / 0.28);
  stroke-width: 0.8;
}

.market-arcade__counter,
.market-arcade__board {
  fill: rgb(var(--color-paper-lifted-rgb) / 0.9);
  stroke: rgb(var(--color-ink-rgb) / 0.18);
  stroke-width: 0.8;
}

.market-arcade__box {
  stroke: rgb(var(--color-qing-rgb) / 0.38);
  stroke-width: 0.8;
}

.market-arcade__notice {
  stroke: rgb(var(--color-ink-rgb) / 0.18);
  stroke-width: 0.75;
}

.market-arcade__post,
.market-arcade__tag,
.market-arcade__slot-line {
  stroke: rgb(var(--color-ink-rgb) / 0.16);
  stroke-width: 0.75;
}

.market-arcade__mark {
  fill: rgb(var(--color-ink-soft-rgb));
  font-family: var(--font-kai);
  font-size: 8px;
  letter-spacing: 0.08em;
}

.market-arcade__ready-dot,
.market-arcade__consign-dot {
  fill: rgb(var(--color-paper-rgb) / 0.72);
  stroke: rgb(var(--color-ink-rgb) / 0.16);
  stroke-width: 0.65;
}

.market-arcade__ready-dot.is-lit {
  fill: rgb(var(--color-cinnabar-rgb));
  stroke: rgb(var(--color-cinnabar-rgb));
}

.market-arcade__consign-dot.is-lit {
  fill: rgb(var(--color-qing-rgb));
  stroke: rgb(var(--color-qing-rgb));
}

.market-arcade__seal {
  fill: rgb(var(--color-cinnabar-rgb) / 0.08);
  stroke: rgb(var(--color-cinnabar-rgb) / 0.62);
  stroke-width: 0.8;
}

.market-arcade__seal-mark {
  fill: rgb(var(--color-cinnabar-rgb));
  font-family: var(--font-kai);
  font-size: 4.5px;
}

.market-arcade__coin {
  fill: rgb(var(--color-paper-lifted-rgb) / 0.94);
  stroke: rgb(var(--color-cinnabar-rgb) / 0.4);
  stroke-width: 0.8;
}

.market-arcade__coin-mark {
  stroke: rgb(var(--color-cinnabar-rgb) / 0.56);
  stroke-width: 0.7;
}

.market-arcade__stall {
  transition: opacity 0.16s ease;
}

.market-arcade__stall:not(.is-active) {
  opacity: 0.72;
}

.market-arcade__stall.is-active .market-arcade__roof {
  stroke: rgb(var(--color-cinnabar-rgb) / 0.5);
}

.market-arcade__stall.is-active .market-arcade__mark {
  fill: rgb(var(--color-cinnabar-rgb));
}

.market-arcade__caption {
  position: absolute;
  z-index: 2;
  right: 0.08rem;
  bottom: 0.04rem;
  display: flex;
  gap: 0.42rem;
  color: rgb(var(--color-ink-faint-rgb));
  font-family: var(--font-kai);
  font-size: var(--type-note);
  letter-spacing: 0.04em;
}

.market-arcade__caption span:first-child {
  color: rgb(var(--color-cinnabar-rgb));
}

@media (prefers-reduced-motion: no-preference) {
  .market-arcade__coin {
    animation: market-arcade-coin 2.8s ease-in-out infinite;
  }

  .market-arcade__stall {
    animation: market-arcade-arrive 0.4s ease-out both;
  }

  .market-arcade__stall.is-bounty {
    animation-delay: 0.06s;
  }

  .market-arcade__stall.is-consign {
    animation-delay: 0.12s;
  }
}

@keyframes market-arcade-arrive {
  from {
    opacity: 0;
    transform: translateY(2px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes market-arcade-coin {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-1px);
  }
}
</style>
