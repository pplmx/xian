<template>
  <div class="stagger-in flex min-h-full flex-col px-6 py-8">
    <!-- 上一步:未定格前可回欢迎页核隐私(路由守卫允许 create→welcome) -->
    <div class="flex items-center">
      <RouterLink
        to="/welcome"
        class="-my-1.5 py-1.5 text-[11px] text-ink-faint active:text-ink-soft"
        >← 欢迎</RouterLink
      >
    </div>

    <!-- 题字 -->
    <div class="mt-6 text-center">
      <h1 class="font-kai text-[42px] leading-tight tracking-[0.35em] text-ink">玄枢录</h1>
      <p class="mt-2 text-[11px] tracking-[0.5em] text-ink-faint">玄之又玄 · 众妙之门</p>
    </div>

    <!-- 道号 -->
    <div class="card-ink mt-8 px-4 py-3">
      <p class="mb-2 font-kai text-[14px] tracking-[0.3em] text-ink-faint">道 号</p>
      <div class="flex items-center gap-2">
        <input
          v-model="name"
          maxlength="8"
          aria-label="道号"
          class="w-full rounded-md border border-ink/20 bg-paper-deep/60 px-3 py-2 font-kai text-[16px] tracking-widest text-ink outline-none focus:border-cinnabar/50"
          placeholder="取一个道号"
        />
        <button class="btn-ghost shrink-0 !px-3" aria-label="随机取一个道号" @click="randomName">
          <GameIcon name="refresh" :size="15" />
        </button>
      </div>
    </div>

    <!-- 灵根 -->
    <div class="card-ink mt-4 px-4 py-4">
      <div class="flex items-baseline justify-between">
        <p class="font-kai text-[11px] tracking-[0.3em] text-ink-faint">灵 根</p>
        <span class="font-kai text-[15px] tracking-widest text-cinnabar">{{
          profile.gradeName
        }}</span>
      </div>
      <!--
        灵根圆环原是 48px、两枚并排、间距 12px —— 它是这一页的主角,
        却比下面的说明文字还轻。放大到 64px 并拉开间距:重掷时换的是这张牌,
        它得占住这一屏的视觉重心。
      -->
      <div :key="rollSeq" class="stagger-in mt-4 flex flex-wrap justify-center gap-5">
        <div
          v-for="root in profile.roots"
          :key="root.element"
          class="flex flex-col items-center gap-1.5"
        >
          <span
            class="grid h-16 w-16 place-items-center rounded-full border-2 font-kai text-[26px] animate-breathe"
            :style="{
              borderColor: ELEMENTS[root.element].color,
              color: ELEMENTS[root.element].color,
            }"
          >
            {{ ELEMENTS[root.element].char }}
          </span>
          <span class="tabular text-[11px] text-ink-soft">资质 {{ root.aptitude }}</span>
        </div>
      </div>
      <!--
        修行倍率是这一页最该被权衡的数 —— 它原先只是圆环底下一行 12px 的淡字,
        「资质 66 / 53」比它还醒目。改成一个独立读数块:标签 10px、值 18px 楷体,
        与灵根圆环同处一卡而自成一组。
      -->
      <div data-value-row class="mt-4 flex items-baseline justify-center gap-2">
        <span class="text-[10px] tracking-[0.2em] text-ink-faint">修行倍率</span>
        <span
          :key="rollSeq"
          class="font-kai text-[18px] leading-none text-cinnabar tabular animate-ink-pop"
          >×{{ profile.growthMult.toFixed(2) }}</span
        >
      </div>
      <!-- 天然牌面(Phase 32.2):重掷时要权衡的不止倍率,还有这一世哪条路走得顺 -->
      <div
        v-if="tendencies.length"
        :key="`tend-${rollSeq}`"
        class="stagger-in mt-3 space-y-1.5 border-t border-ink/10 pt-3"
      >
        <p v-for="t in tendencies" :key="t.element" class="flex gap-2 t-body text-ink-soft">
          <span class="shrink-0 font-kai" :style="{ color: ELEMENTS[t.element].color }">{{
            ELEMENTS[t.element].char
          }}</span>
          <span>{{ t.text }}</span>
        </p>
      </div>
      <!-- 读屏:重掷结果念出来(最终定格有 SpiritRootReveal 播报,途中逆天改命不许哑) -->
      <p aria-live="polite" class="sr-only">{{ rerollAnnounce }}</p>
      <!--
        「逆天改命」是这一页的核心互动,原是一枚与次要按钮无异的描边钮。
        给它篆书的字距与一行更轻的上分隔 —— 不改色(它不是危险动作),
        只让它读起来像一件「可以反复做的事」而不是一个普通按钮。
      -->
      <div class="mt-4 border-t border-ink/8 pt-3">
        <button
          class="btn-ghost w-full !py-2.5 font-kai text-[14px] tracking-[0.3em]"
          :disabled="starting"
          @click="reroll"
        >
          {{ rerollLabel }}
        </button>
      </div>
      <p v-if="unlimitedReroll" class="mt-2 text-center text-[11px] text-ink-faint">
        不满意就一直改,改到掷中你认的那副牌为止
      </p>
    </div>

    <!--
      底部主钮 —— 原先靠一个 grow 撑开,于是卡片与按钮之间空出一大块白,
      而按钮自己贴着屏幕最底。这里把按钮组压到底部并补一句「按下去会发生什么」:
      那一大片空白原本什么也没说,现在说了一件玩家此刻正想知道的事。
    -->
    <div class="grow" />
    <p class="mb-2 text-center text-[10px] leading-relaxed text-ink-faint">
      按下之后,灵根将就此定格 —— 这一世的修行之路,由它决定
    </p>
    <button class="btn-seal mb-1 w-full !py-3 text-[16px]" :disabled="starting" @click="begin">
      {{ starting ? "灵 根 鉴 定 中……" : "踏 入 仙 途" }}
    </button>

    <!-- 灵根鉴定动画(踏入仙途后播放) -->
    <SpiritRootReveal ref="revealRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue";
import { useRouter } from "vue-router";
import { rng } from "@/utils/random";
import { rollLinggen } from "@/core/linggenGen";
import { rootElements, tendencyLines } from "@/core/linggenAffinity";
import { randomDaoName } from "@/data/names";
import { ELEMENTS } from "@/data/linggen";
import { generateEquipment } from "@/core/equipGen";
import { acquireEquipment } from "@/core/loot";
import { trackRealm } from "@/core/progress";
import { seedLoreIfNeeded } from "@/core/loreService";
import { equipmentTemplate } from "@/data/equipment";
import { useGameStore } from "@/stores/game";
import { usePlayerStore } from "@/stores/player";
import { useCultivationStore } from "@/stores/cultivation";
import { useInventoryStore } from "@/stores/inventory";
import { useUiStore } from "@/stores/ui";
import GameIcon from "@/components/common/GameIcon.vue";
import SpiritRootReveal from "@/components/common/SpiritRootReveal.vue";

const router = useRouter();
const game = useGameStore();
const player = usePlayerStore();
const cultivation = useCultivationStore();
const inventory = useInventoryStore();
const ui = useUiStore();

const name = ref(randomDaoName(rng));
// 建号草稿放在 game store 里持久化:刷新页面既不该白拿一次重掷,也不该洗掉已花掉的次数
if (!game.createProfile) game.setCreateProfile(rollLinggen(rng));
const profile = computed(() => game.createProfile!);
const rerollsLeft = computed(() => game.createRerolls);
/** 不限次建号:按钮不显示余量,也不会有「刷不动了」的一天 */
const unlimitedReroll = computed(() => rerollsLeft.value === null);
const rerollLabel = computed(() =>
  rerollsLeft.value === null ? "逆天改命" : `逆天改命(余 ${rerollsLeft.value} 次)`,
);
/** 重掷序号:额度不再是动画的开关,重放掷牌动画要另有一个只增不减的计数器 */
const rollSeq = ref(0);
/**
 * 重掷播报:「逆天改命」是「灵根鉴定」同族的中间态 —— 最终定格有 SpiritRootReveal
 * 的读屏播报,途中重掷却只换画面、不出一声。rollSeq 只在成功重掷时自增(额度
 * 不足/鉴定动画中都不动),以它为观察对象,每次重掷把新牌念一遍。
 */
const rerollAnnounce = ref("");
watch(rollSeq, () => {
  const p = profile.value;
  const rootsText = p.roots.map((r) => `${ELEMENTS[r.element].name}${r.aptitude}`).join("、");
  // gradeName 恒以「灵根」收尾(杂/伪/真/上/异/变异/天/混沌灵根),句尾再缀一个
  // 「灵根」,读屏便念成「重掷得『天灵根』灵根」—— 疑为两物。去掉句尾那一个。
  rerollAnnounce.value = `重掷得「${p.gradeName}」,${rootsText},修行倍率 ×${p.growthMult.toFixed(2)}`;
});
const revealRef = useTemplateRef<InstanceType<typeof SpiritRootReveal>>("revealRef");
/** 鉴定动画进行中(约 2.6s):防连点导致重复建号、重复发新手馈赠 */
const starting = ref(false);

/** 这一世的天然牌面(倾向文案,不含任何数值) */
const tendencies = computed(() => tendencyLines(rootElements(profile.value.roots)));

function reroll(): void {
  // 鉴定动画进行中禁止重掷:begin 已按当时的 profile 建号,
  // 此刻重掷改不了已成真身的灵根,只会让展出的牌和角色对不上
  if (starting.value) return;
  if (!game.spendCreateReroll()) return;
  game.setCreateProfile(rollLinggen(rng));
  rollSeq.value += 1;
}

function randomName(): void {
  name.value = randomDaoName(rng);
}

function begin(): void {
  if (starting.value) return;
  starting.value = true;
  const finalName = name.value.trim().slice(0, 8) || "无名散修";
  player.initCharacter(finalName, profile.value);
  // 开局馈赠:入门功法 + 一柄竹剑 + 三枚聚气散
  cultivation.learn("m_taixuan");
  cultivation.equipMain("m_taixuan");
  const starter = generateEquipment(1, rng, { slot: "weapon" });
  acquireEquipment(starter, { quiet: true, forceKeep: true }); // forceKeep:开局馈赠不受自动回收规则影响
  const tpl = equipmentTemplate(starter.templateId);
  if (tpl) inventory.equip(starter.uid, tpl.slot);
  inventory.addPill("p_jvqisan", 3);
  // 开局所知:三张入门丹方与方中药材(见 core/loreService.ts)
  seedLoreIfNeeded();
  game.markStarted();
  trackRealm();
  ui.toast("云深不知处,仙路自此始", "rare");
  // 起手句交给首页宣:灵根鉴定的 aria-live 定格播报在路由跳转时会被切断,
  // 首页挂载补念(见 HomeView 的 worldEnter 读屏区),读完即清
  ui.worldEnter = `你已入此世 —— 灵根「${profile.value.gradeName}」,修行倍率 ×${profile.value.growthMult.toFixed(2)}`;
  // 灵根鉴定动画:随机闪现所有灵根品阶,最后定格真实灵根(gradeName)
  revealRef.value?.show(profile.value.gradeName, () => {
    void router.push("/");
  });
}
</script>
