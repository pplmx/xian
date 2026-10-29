<template>
  <!-- 秘境:一次性内容,出则散。凡境册元婴起(灵石),天界册真仙起(道源) -->
  <!--
    在境中是「印面卡」:左侧一道 qing 竖笔(借用 EventDialog 档位横幅的竖笔 idiom),
    未入态不加这道封条 —— 竖笔的意思是「你正身在其中」,还没进去的人不该也挂一条。
    三态三种形状:在境中 = 竖笔实线,未入 = 素实线,未解锁 = 虚线框。
  -->
  <section
    v-if="unlocked"
    class="card-ink px-4 py-3"
    :class="state ? 'border-l-2 border-l-qing/70' : ''"
  >
    <p class="flex flex-wrap items-center gap-2">
      <span class="font-kai text-[15px] tracking-[0.2em] text-ink">秘境</span>
      <span class="chip-ink !text-[10px]"
        >{{ gate === "celestial" ? "天界秘境" : "凡境秘境" }} · {{ cnNumber(SECRET_LAYERS) }}层 ·
        出则散</span
      >
      <!-- 三枚点:已过 / 当前 / 未至 —— 数字不删,点只是把「走到第几层」变成一眼可数 -->
      <span
        v-if="state"
        class="ml-auto flex items-center gap-1.5 text-[10px] tabular text-gold-ink"
      >
        <span class="flex items-center gap-1" aria-hidden="true">
          <span
            v-for="i in SECRET_LAYERS"
            :key="i"
            class="h-1.5 w-1.5 rounded-full"
            :class="i < state.layer ? 'bg-qing' : i === state.layer ? 'bg-cinnabar' : 'bg-ink/15'"
          />
        </span>
        第 {{ state.layer }}/{{ SECRET_LAYERS }} 层
      </span>
    </p>

    <!-- 在境中 -->
    <template v-if="state">
      <p class="mt-1.5 t-body text-ink-soft">{{ def?.name }} · {{ def?.desc }}</p>
      <p class="mt-1 text-[10px] leading-relaxed text-violet-ink">
        此地规则:{{ state.rules.join(" · ") }}
      </p>
      <p v-if="builtinRulesText" class="mt-0.5 text-[10px] leading-relaxed text-ink-soft">
        本境之则:{{ builtinRulesText }}
      </p>
      <p
        v-if="state.spoils.length"
        class="scroll-pane mt-1 max-h-24 overflow-y-auto text-[10px] leading-relaxed text-ink-faint"
      >
        <span v-for="(s, i) in state.spoils" :key="i" class="block">· {{ s }}</span>
      </p>
      <!-- 战前预览:与实战同源 —— 敌人/胜算(secretLayerPreview)本层即准,「所见即所打」 -->
      <!-- 组内不断、组间可换行:整行 nowrap 在 320 宽上会顶出卡片,全放开又会让「本层劫:xxx」被拆成两截 -->
      <p
        v-if="preview"
        class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] leading-relaxed text-ink-soft"
      >
        <span class="whitespace-nowrap">
          <template v-if="preview.foe">
            本层劫:<span class="text-ink">{{ preview.foe.name }}</span>
            <span :class="preview.rate < 0.35 ? 'text-cinnabar' : 'text-ink'"
              >· {{ preview.winText }}</span
            >
          </template>
          <template v-else>本层劫:<span class="text-ink">莫测</span></template>
        </span>
        <span class="whitespace-nowrap"
          >· 战利:灵石 +{{ formatGN(preview.reward.stone) }} · 灵草 +{{
            preview.reward.material
          }}</span
        >
      </p>
      <!--
        隐性机制随预览披露(同源,不手写):逐出门槛、层间回血/损血、终层宝藏 ——
        这三样按下去决定成败/去留,不许只活到战报/结算才见。
      -->
      <p v-if="preview" class="mt-0.5 text-[10px] leading-relaxed tabular">
        <span :class="preview.lossesLeft <= 1 ? 'text-cinnabar' : 'text-ink-faint'"
          >再败 {{ preview.lossesLeft === 0 ? "即逐出" : `${preview.lossesLeft} 场逐出` }}</span
        ><template v-if="preview.healBetweenPct && preview.healBetweenPct !== 0"
          ><span class="text-ink-faint">
            · 层间{{ preview.healBetweenPct > 0 ? "回血" : "损血" }}
            {{ formatPercent(Math.abs(preview.healBetweenPct), 0) }}</span
          ></template
        ><template v-if="preview.isFinalLayer"
          ><span class="text-gold-ink">
            · 终层通关得随机装备 + 悟道点 {{ SECRET_FINAL_WUDAO }}</span
          ></template
        >
      </p>
      <!--
        极窄档(195 CSS px)上下叠:两枚 flex-1 并排时每枚只剩 61px,「再 入 一 层」
        五个字(带字距)放不下,当场折成三行、按钮涨到 84px 高(自检在后期档量到)。
        叠起来每枚拿到整行 137px,一行放得下;320 / 390 两档不受影响。
      -->
      <div class="mt-2 flex gap-2 tinylens:flex-col">
        <!-- 出秘境是二步确认:整趟是付过门票的独一份内容,误触不该直接清空 —— 与删快照同族 -->
        <template v-if="!confirmAbandon">
          <button class="btn-seal flex-1 !py-1.5 !text-[14px]" @click="fight">再 入 一 层</button>
          <button class="btn-ghost flex-1 !py-1.5 !text-[14px]" @click="confirmAbandon = true">
            出 秘 境
          </button>
        </template>
        <template v-else>
          <button class="btn-seal flex-1 !py-1.5 !text-[14px]" @click="doAbandon()">
            确认弃境
          </button>
          <button class="btn-ghost flex-1 !py-1.5 !text-[14px]" @click="confirmAbandon = false">
            再想想
          </button>
        </template>
      </div>
    </template>

    <!-- 未入:择一处 -->
    <template v-else>
      <!-- 身在另一册的境中:先说明进不去,不摆一列点了才被拒的门 -->
      <p v-if="elsewhere" class="mt-1 text-[10px] leading-relaxed text-ink-faint">
        身在「{{ elsewhere.name }}」秘境之中 —— 出而后再来择境。
      </p>
      <div v-else class="mt-1">
        <!--
          秘境是支线,不该用八张说明卡把历练首屏整页占满。
          先亮当前境界最近的两处,余册由玩家自己展开;名录总数仍直说。
        -->
        <div id="secret-realm-list" class="space-y-1.5">
          <button
            v-for="r in visibleList"
            :key="r.id"
            class="w-full rounded-md bg-paper-deep/30 px-3 py-2 text-left active:scale-99"
            :class="{ 'border border-ink/10': !canPay(r) }"
            :disabled="!canPay(r)"
            @click="enter(r.id)"
          >
            <span class="flex flex-wrap items-baseline gap-2">
              <span class="font-kai text-[14px] text-ink">{{ r.name }}</span>
              <!-- 付不起就报差(与聚气丹/建筑/法宝同款):一盏灰灯不说差多少等于没说完 -->
              <span
                class="text-[10px] tabular"
                :class="canPay(r) ? 'text-ink-faint' : 'text-cinnabar'"
              >
                {{ payText(r) }}
              </span>
              <!-- 入境的箭头跟 canPay 走:付不起时它不该还是一枚亮着的青箭头 -->
              <span class="ml-auto text-[10px]" :class="canPay(r) ? 'text-qing' : 'text-ink-faint'"
                >入 境 →</span
              >
            </span>
            <span class="mt-0.5 block text-[10px] leading-relaxed text-ink-faint">{{
              r.desc
            }}</span>
          </button>
          <p v-if="list.length === 0" class="empty-note text-center text-[11px] text-ink-faint">
            {{
              gate === "celestial"
                ? "尚无天界秘境可探 —— 天界册真仙起,自有去处。"
                : "尚无凡境秘境可探 —— 凡境册元婴起,自有去处。"
            }}
          </p>
        </div>
        <button
          v-if="list.length > SECRET_REALM_PREVIEW"
          class="mt-1.5 flex min-h-[28px] w-full items-center justify-center rounded-md border border-dashed border-ink/15 px-3 py-1 text-[10px] text-ink-faint active:scale-99 active:text-ink-soft"
          :aria-expanded="secretListExpanded"
          aria-controls="secret-realm-list"
          data-secret-realm-toggle
          @click="secretListExpanded = !secretListExpanded"
        >
          {{
            secretListExpanded
              ? `收起秘境名录 · 共 ${list.length} 处`
              : `展开其余 ${list.length - SECRET_REALM_PREVIEW} 处 · 共 ${list.length} 处`
          }}
        </button>
      </div>
    </template>
  </section>

  <!-- 未解锁:inert 占位(仿天界「未至真仙」)—— 灰注开启境界,不可点、不进焦点 -->
  <!--
    三态三种形状:在境中 = 左竖笔实线(印面)、未入 = 无竖笔实线、未解锁 = 虚线框。
    虚线框代替此前的整块 60% 透明 —— 压色不压字:占位里那句「元婴起」是给玩家看的路标。
  -->
  <section
    v-else
    aria-hidden="true"
    class="card-ink border-dashed border-ink/15 pointer-events-none select-none px-4 py-3"
  >
    <p class="flex items-center gap-2">
      <span class="font-kai text-[15px] tracking-[0.2em] text-ink">秘境</span>
      <span class="chip-ink !text-[10px]">{{
        gate === "celestial" ? "天界秘境" : "凡境秘境"
      }}</span>
    </p>
    <p class="mt-1.5 t-body text-ink-faint">
      {{ gate === "celestial" ? "天界册 · 真仙起(道源)" : "凡境册 · 元婴起(灵石)" }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { usePlayerStore } from "@/stores/player";
import { useResourcesStore } from "@/stores/resources";
import { useUiStore } from "@/stores/ui";
import { useEndgameStore } from "@/stores/endgame";
import { SECRET_FINAL_WUDAO, secretRealmDef, type SecretRealmDef } from "@/data/secretRealms";
import { cnNumber, formatGN, formatPercent } from "@/utils/format";
import { toNum } from "@/utils/gnum";
import {
  SECRET_LAYERS,
  abandonRealm,
  availableRealms,
  currentRealm,
  enterSecretRealm,
  entryCostOf,
  entryCostText,
  fightSecretLayer,
  realmUnlock,
  secretLayerPreview,
} from "@/core/secretRealm";
import { gateRuleSummary } from "@/core/gateRuleText";

const player = usePlayerStore();
const resources = useResourcesStore();
const ui = useUiStore();

const props = withDefaults(defineProps<{ gate?: "mortal" | "celestial" }>(), { gate: "mortal" });
const endgame = useEndgameStore();

const unlocked = computed(() => realmUnlock(props.gate));
/** 出秘境二步确认:整趟是付过门票的独一份内容,误触「出」就该血亏(与删快照同族) */
const confirmAbandon = ref(false);
const SECRET_REALM_PREVIEW = 2;
const secretListExpanded = ref(false);
/**
 * 在境中(仅认本册):currentRealm 是全局单份、不分册 —— 不筛的话,身在凡境的境中
 * 时,天界册(试炼域)这张卡也会以「天界秘境」的册头渲染凡境的境况,册头与内容
 * 口径失实。两册互不串门,与 availableRealms 的 gate 过滤同一口径。
 */
const state = computed(() => {
  const s = currentRealm();
  if (!s) return null;
  return secretRealmDef(s.realmId)?.gate === props.gate ? s : null;
});
/**
 * 身在**另一册**的境中:此册哪一处都进不去(引擎会拒「已在秘境之中」)。
 * 与其摆一列点了才被 toast 拒的门,不如就地说明 —— 付不起置灰+列因的同族纪律。
 */
const elsewhere = computed(() => {
  const s = currentRealm();
  if (!s) return null;
  const d = secretRealmDef(s.realmId);
  return d && d.gate !== props.gate ? d : null;
});
const list = computed(() => availableRealms(props.gate));
const visibleList = computed(() =>
  secretListExpanded.value ? list.value : list.value.slice(0, SECRET_REALM_PREVIEW),
);
const def = computed<SecretRealmDef | undefined>(() =>
  state.value ? secretRealmDef(state.value.realmId) : undefined,
);
/** 战前预览:本层敌人/胜算/战利(与实战同源,见 secretLayerPreview) */
const preview = computed(() => (state.value ? secretLayerPreview(state.value) : null));
/** 本境自带规则:并入预览胜算/战利却一字未露,用 gateRuleSummary 摊开(与随机规则并排,免得「胜算在握」不知归因) */
const builtinRulesText = computed(() => (def.value?.rules ? gateRuleSummary(def.value.rules) : ""));

function canPay(r: SecretRealmDef): boolean {
  const c = entryCostOf(r, player.major);
  return c.kind === "stone" ? resources.hasStone(c.stone) : endgame.daoSource >= c.daoSource;
}

/** 行内代价:买得起念全价,付不起换口「尚差 N」(与聚气丹/建筑/法宝同款句式) */
function payText(r: SecretRealmDef): string {
  const c = entryCostOf(r, player.major);
  if (canPay(r)) return entryCostText(r, player.major);
  return c.kind === "stone"
    ? `尚差 ${formatGN(Math.max(0, toNum(c.stone) - toNum(resources.spiritStone)))} 石`
    : `尚差 ${Math.max(0, c.daoSource - endgame.daoSource)} 道源`;
}

function enter(id: string): void {
  // 上一次「确认弃境」的陈态不能带进新境:否则新秘境一进来就又是「确认弃境/再想想」,误触即血亏
  confirmAbandon.value = false;
  const out = enterSecretRealm(id);
  if (!out.ok) {
    ui.toast(out.reason ?? "不得其门而入", "warn");
    return;
  }
  ui.toast("你踏入秘境,身后的路随即合拢", "info");
}

/** 确认弃境后把确认态一并收起,免得带进下一境 */
function doAbandon(): void {
  abandonRealm();
  confirmAbandon.value = false;
}

function fight(): void {
  const r = fightSecretLayer();
  if (!r) {
    // 战况已失(多是坏档:境内状态在但境界定义没了)—— 静默停手等于按钮按了没响
    ui.toast("此境战况已失,请退出重入", "warn");
    return;
  }
  // 战报合并为单条多行 toast:逐条 push 会被 toast 位(上限 5)把自己前面的行挤掉,长战报读不全
  // 胜负两级配色与全库结果播报同口径:胜=success(得了战利)、败=warn(气血折损);
  // 此前胜写 info,与一键换装/重掌之地那批「正结果」不在一个级别上。
  if (r.lines.length) ui.toast(r.lines.join("\n"), r.win ? "success" : "warn");
}
</script>
