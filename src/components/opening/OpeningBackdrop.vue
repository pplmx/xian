<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "gate" | "create";
  }>(),
  { variant: "gate" },
);
</script>

<template>
  <div class="opening-backdrop" :class="`opening-backdrop--${variant}`" aria-hidden="true">
    <span class="opening-backdrop__orb" />
    <span class="opening-backdrop__horizon" />
    <svg class="opening-backdrop__mountains" viewBox="0 0 1200 520" preserveAspectRatio="none">
      <path
        class="opening-backdrop__ridge opening-backdrop__ridge--far"
        d="M0 380 C90 338 146 366 218 302 C292 236 348 312 428 250 C508 188 574 282 652 236 C744 182 814 268 898 218 C986 166 1064 238 1200 190 V520 H0 Z"
      />
      <path
        class="opening-backdrop__ridge opening-backdrop__ridge--near"
        d="M0 448 C92 410 160 430 238 386 C318 342 392 402 474 352 C562 298 638 374 724 330 C806 288 878 344 966 302 C1050 262 1116 310 1200 278 V520 H0 Z"
      />
    </svg>
    <span class="opening-backdrop__thread opening-backdrop__thread--one" />
    <span class="opening-backdrop__thread opening-backdrop__thread--two" />
  </div>
</template>

<style scoped>
.opening-backdrop {
  position: absolute;
  z-index: 0;
  inset: 0;
  overflow: hidden;
  color: var(--color-ink);
  pointer-events: none;
}

.opening-backdrop__orb {
  position: absolute;
  top: 9%;
  right: 8%;
  width: clamp(4.5rem, 16vw, 9rem);
  aspect-ratio: 1;
  border: 1px solid rgb(var(--color-cinnabar-rgb) / 0.16);
  border-radius: 50%;
  background:
    radial-gradient(circle at 42% 38%, rgb(var(--color-paper-rgb) / 0.9), transparent 38%),
    rgb(var(--color-cinnabar-rgb) / 0.055);
  box-shadow:
    0 0 0 0.55rem rgb(var(--color-cinnabar-rgb) / 0.025),
    0 0 4rem rgb(var(--color-cinnabar-rgb) / 0.07);
}

.opening-backdrop__horizon {
  position: absolute;
  right: 0;
  bottom: 18%;
  left: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    rgb(var(--color-ink-rgb) / 0.12) 18%,
    transparent 52%,
    rgb(var(--color-ink-rgb) / 0.08) 82%,
    transparent
  );
}

.opening-backdrop__mountains {
  position: absolute;
  right: -4%;
  bottom: -2%;
  left: -4%;
  width: 108%;
  height: min(58%, 30rem);
}

.opening-backdrop__ridge--far {
  fill: rgb(var(--color-ink-rgb) / 0.045);
}

.opening-backdrop__ridge--near {
  fill: rgb(var(--color-ink-rgb) / 0.075);
}

.opening-backdrop__thread {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: linear-gradient(
    to bottom,
    transparent,
    rgb(var(--color-ink-rgb) / 0.055) 18%,
    transparent 82%
  );
}

.opening-backdrop__thread--one {
  left: 7%;
}

.opening-backdrop__thread--two {
  right: 7%;
}

.opening-backdrop--create .opening-backdrop__orb {
  top: 14%;
  right: auto;
  left: 7%;
  border-color: rgb(var(--color-qing-rgb) / 0.2);
  background:
    radial-gradient(circle at 42% 38%, rgb(var(--color-paper-rgb) / 0.88), transparent 38%),
    rgb(var(--color-qing-rgb) / 0.06);
  box-shadow:
    0 0 0 0.55rem rgb(var(--color-qing-rgb) / 0.025),
    0 0 4rem rgb(var(--color-qing-rgb) / 0.08);
}

@media (max-width: 620px) {
  .opening-backdrop__orb {
    top: 5rem;
    right: -1.25rem;
  }

  .opening-backdrop--create .opening-backdrop__orb {
    top: 8rem;
    right: auto;
    left: -1.5rem;
  }

  .opening-backdrop__mountains {
    height: 42%;
  }
}
</style>
