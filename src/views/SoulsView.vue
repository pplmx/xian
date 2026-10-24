<template>
  <div class="stagger-in space-y-4 px-4 pb-6 pt-4">
    <!-- 未至真仙 -->
    <div v-if="!unlocked" class="card-ink px-6 py-16 text-center">
      <p class="font-kai text-[22px] tracking-[0.4em] text-ink">器 魂</p>
      <p class="mt-4 t-body text-ink-faint">
        凡器未历天道,何来形意。
        <br />
        修至
        <span class="text-cinnabar">真仙境</span>
        ,方知此理。
      </p>
    </div>

    <template v-else>
      <!-- 抬头:标题要永远居中 —— 左侧「← 天界」固定、右侧道源数字随位数伸缩,
           justify-between 下标题随右侧宽窄左右游移;改用 1fr_auto_1fr 网格,
           两侧均分,中间的「器 魂」落点锁死,与洞府同型顶栏同款体验 -->
      <div class="card-ink grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3">
        <!-- 同洞府:标签写着「天界」,冷启动时也得真的去天界,而不是退出游戏 -->
        <button
          class="-my-1.5 justify-self-start py-1.5 text-left text-[11px] text-ink-faint active:text-ink-soft"
          @click="goBack(router, { name: 'celestial' })"
        >
          ← 天界
        </button>
        <p class="font-kai text-[15px] tracking-[0.3em] text-ink">器 魂</p>
        <div class="justify-self-end text-right">
          <span class="block text-[10px] leading-tight text-ink-faint">道源</span>
          <span class="block tabular font-kai text-[15px] leading-tight text-cinnabar">{{
            formatNum(endgame.daoSource)
          }}</span>
        </div>
      </div>

      <!-- 何谓器魂 -->
      <section>
        <SectionTitle title="何谓器魂" hint="形销而意存,多一条路数" />
        <div class="card-ink mt-2 px-4 py-3">
          <!--
            这一段原是把两段散文铺满整张大卡 —— 它是这一页里最占地方、信息密度
            最低的一块,而新手每次进来都要先跨过它才看得见自己那三个槽位。
            改法:一句结论常驻(器魂是什么、从哪来),细节收进「怎么个章法」——
            想知道的人点开,不想知道的人不必先读两百字。
          -->
          <p class="t-body text-ink-soft">
            凡器入炉,锋芒被天道磨去几分,那份
            <span class="text-gold-ink">路数</span>却留了下来 —— 这就是器魂:
            攻防血照常作数,它是在其上多给一条路数。
          </p>
          <button
            class="tap-row mt-1.5 -mx-1.5 -my-1 inline-flex min-h-[28px] min-w-[28px] items-center justify-center px-1.5 text-[10px] text-ink-faint active:opacity-60"
            :aria-expanded="soulIntroOpen"
            @click="soulIntroOpen = !soulIntroOpen"
          >
            {{ soulIntroOpen ? "▾ 收起" : "▸ 怎么个章法" }}
          </button>
          <div v-if="soulIntroOpen" class="mt-1 space-y-1.5">
            <p class="t-body text-ink-faint">
              以凡器入炉,形销而意存,得器魂一缕。神魂只容 {{ SOUL_SLOTS }} 缕——取舍便是构筑。
            </p>
            <p class="t-body text-ink-faint">
              至于堆叠本身,天道自有应对:构筑越厚,守关者的道之理解越深;境界未及此界者,还会被境界压制。
            </p>
          </div>
        </div>
      </section>

      <!-- 已凝形意 -->
      <section>
        <SectionTitle title="已凝形意" :hint="`${endgame.activeSouls.length} / ${SOUL_SLOTS} 缕`" />
        <div class="mt-2 grid grid-cols-3 gap-2">
          <!--
            卡壳**不再自称按钮**,里面两个动作各用原生 <button>。

            从前整卡是 role=button 的 div,里面还嵌着「卸下」<button>。CDP 读出的
            无障碍树真把它画成"button 里套着 button":「显形·锋魂 详情」里套着「卸下」。
            ARIA 里 button 带 Children Presentational —— 屏幕阅读器本应把它里面的
            内容压平成一段文字,连带那个「卸下」在部分读屏上根本不可达(VoiceOver /
            TalkBack 正是这类)。而且两个可聚焦控件叠在一处,焦点顺序也说不清。

            空槽另有旧伤:无论有没有器魂都挂着 role=button 与 aria-label「空」,
            读屏念出一个"空 按钮",按下去只把 soulDetail 赋成 null,弹窗连开都不开
            —— 声明了 affordance 却不给操作,比不声明更坏。

            现在:「有没有器魂」仍只有一处出口(soulAt),按钮语义则由真 <button>
            自己带 —— 读屏听到的"是什么"与手上按得动的,是同一个东西。
          -->
          <div
            v-for="i in SOUL_SLOTS"
            :key="i"
            class="card-ink flex min-h-[92px] min-w-0 flex-col items-center justify-center px-2 py-2 text-center"
            :class="soulAt(i) ? '' : 'border-dashed border-ink/15'"
          >
            <template v-if="soulAt(i)">
              <button
                class="flex min-w-0 flex-1 self-stretch flex-col items-center justify-center px-1 text-center active:scale-95"
                :aria-label="detailLabel(soulAt(i)!)"
                @click="openSoulDetail(i)"
              >
                <span
                  class="font-kai text-[22px] leading-none"
                  :style="{ color: soulColor(soulAt(i)!) }"
                >
                  {{ soulSeal(soulAt(i)!) }}
                </span>
                <span class="mt-1 text-[10px] leading-tight text-ink-soft">{{
                  soulLabel(soulAt(i)!)
                }}</span>
                <!--
                  装配了就看不见"给什么" —— 就地摊一行词条短字(全量读数在详情弹窗,
                  同闲置行的 soulModText,不另造第二份文案)。
                -->
                <span class="mt-0.5 w-full truncate text-[10px] leading-tight text-ink-faint">{{
                  soulModText(soulAt(i)!)
                }}</span>
              </button>
              <!-- 纯文字按钮只有字体那 15px 高;补成内联块给拇指一个 32px 的靶面 -->
              <button
                class="tap-row mt-1 min-w-[28px] px-2 py-2 text-[10px] text-ink-faint underline active:opacity-60"
                :aria-label="`卸下 ${soulLabel(soulAt(i)!)}`"
                @click="removeSoul(soulAt(i)!.uid)"
              >
                卸下
              </button>
            </template>
            <span v-else class="text-[10px] text-ink-faint">空</span>
          </div>
        </div>
        <p v-if="activeModText" class="mt-2 px-1 text-[10px] leading-relaxed text-gold-ink">
          合计:{{ activeModText }}
        </p>
      </section>

      <!-- 两处入口 -->
      <section class="space-y-2">
        <button
          class="card-ink flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:scale-99"
          @click="idleOpen = true"
        >
          <span
            class="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-violet-ink/85 font-kai text-[19px] text-paper"
            >意</span
          >
          <span class="min-w-0 flex-1">
            <span class="block t-card">散置形意</span>
            <span class="block truncate text-[10px] leading-relaxed text-ink-faint">
              {{
                idleSouls.length > 0
                  ? slotsFull
                    ? `${idleSouls.length} 缕待用 · 槽位已满,先散去一缕`
                    : `${idleSouls.length} 缕待用 · 装配或散去`
                  : "暂无闲置器魂"
              }}
            </span>
          </span>
          <span class="shrink-0 text-[11px] text-ink-faint">›</span>
        </button>

        <button
          class="card-ink flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:scale-99"
          @click="forgeOpen = true"
        >
          <span
            class="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-cinnabar/85 font-kai text-[19px] text-paper"
            >炼</span
          >
          <span class="min-w-0 flex-1">
            <span class="block t-card">凝炼台</span>
            <span class="block truncate text-[10px] leading-relaxed text-ink-faint">
              {{
                refinable.length > 0
                  ? `${refinable.length} 件可凝 · 道源 ${SOUL_REFINE_COST}/枚`
                  : "行囊中无可凝之器"
              }}
            </span>
          </span>
          <span class="shrink-0 text-[11px] text-ink-faint">›</span>
        </button>
      </section>
    </template>

    <!-- 已装配器魂详情:槽从"只看印章"升级为可点,全量读数同闲置行 soulModText -->
    <BaseModal
      :open="soulDetail !== null"
      :title="soulDetail ? soulLabel(soulDetail) : ''"
      @close="soulDetail = null"
    >
      <template v-if="soulDetail">
        <div class="flex items-center gap-3">
          <span
            class="grid h-12 w-12 shrink-0 place-items-center rounded-md font-kai text-[24px]"
            :style="{ color: soulColor(soulDetail) }"
          >
            {{ soulSeal(soulDetail) }}
          </span>
          <div class="min-w-0">
            <p class="text-[11px]" :style="{ color: soulColor(soulDetail) }">
              {{ soulGradeDef(soulDetail.grade).name }}·{{
                soulTypeDef(soulDetail.type)?.name ?? "器魂"
              }}
            </p>
            <p class="text-[10px] text-ink-faint">凝自「{{ soulDetail.fromName }}」</p>
          </div>
        </div>
        <p class="mt-3 t-body text-ink-soft">{{ soulModText(soulDetail) }}</p>
      </template>
      <template #footer>
        <div v-if="soulDetail" class="flex w-full gap-2">
          <button class="btn-ghost flex-1" @click="soulDetail = null">收 起</button>
          <button
            class="btn-seal flex-1"
            @click="
              removeSoul(soulDetail.uid);
              soulDetail = null;
            "
          >
            卸 下
          </button>
        </div>
      </template>
    </BaseModal>

    <!-- 散置形意 -->
    <BaseModal :open="idleOpen" title="散置形意" @close="idleOpen = false">
      <div
        v-if="idleSouls.length > 0"
        class="scroll-pane card-ink max-h-64 divide-y divide-ink/7 overflow-y-auto px-4"
      >
        <div
          v-for="soul in idleSouls"
          :key="soul.uid"
          class="flex items-center justify-between gap-2 py-2.5"
        >
          <div class="min-w-0">
            <p class="truncate text-[11px]" :style="{ color: soulColor(soul) }">
              {{ soulLabel(soul) }}
            </p>
            <p class="text-[10px] text-ink-faint">
              凝自「{{ soul.fromName }}」 · {{ soulModText(soul) }}
            </p>
          </div>
          <div class="flex shrink-0 gap-1">
            <button
              class="btn-ghost !px-2.5 !py-1 !text-[11px]"
              :disabled="slotsFull"
              @click="wearSoul(soul.uid)"
            >
              {{ slotsFull ? "槽已满" : "装配" }}
            </button>
            <template v-if="pendingDissolveUid !== soul.uid">
              <button
                class="btn-ghost !px-2 !py-1 !text-[11px] !text-ink-faint"
                @click="pendingDissolveUid = soul.uid"
              >
                散去
              </button>
            </template>
            <template v-else>
              <button class="btn-seal !px-2 !py-1 !text-[11px]" @click="doDissolve(soul.uid)">
                确认散去
              </button>
              <button class="btn-ghost !px-2 !py-1 !text-[11px]" @click="pendingDissolveUid = null">
                再想想
              </button>
            </template>
          </div>
        </div>
      </div>
      <p v-else class="px-4 py-6 text-center t-body text-ink-faint">
        并无闲置形意。
        <br />
        <span class="text-[10px]">凝出的器魂若已尽数装配,此处便空着</span>
      </p>
      <template #footer>
        <button class="btn-seal w-full" @click="idleOpen = false">收 起</button>
      </template>
    </BaseModal>

    <!-- 凝炼台 -->
    <BaseModal :open="forgeOpen" title="凝炼台" @close="forgeOpen = false">
      <p class="mb-2 t-body text-ink-faint">
        入炉即毁原器,耗道源 {{ SOUL_REFINE_COST }}。
        <!-- 付不起置灰+列差(与秘境道源/聚气丹同款):灰按钮不告诉差多少等于没说完 -->
        <span v-if="refineShort > 0" class="text-cinnabar"
          >尚差 {{ formatGN(refineShort) }} 道源</span
        >
      </p>
      <div
        v-if="refinable.length > 0"
        class="scroll-pane card-ink max-h-64 divide-y divide-ink/7 overflow-y-auto px-4"
      >
        <div
          v-for="row in refinable"
          :key="row.inst.uid"
          class="flex items-center justify-between gap-2 py-2.5"
        >
          <div class="min-w-0">
            <p class="truncate text-[11px] text-ink-soft">{{ row.name }}</p>
            <p class="truncate text-[10px] text-ink-faint">
              将凝出
              <span :style="{ color: soulGradeDef(row.gradeRank).color }"
                >{{ soulGradeDef(row.gradeRank).name }}·{{ row.typeName }}</span
              >
              <!-- 给什么要有数:魂效果是确定的,就在入炉前说出来(与闲置形意的读数同款) -->
              <span v-if="modsText(row.mods)" class="ml-1 text-ink-soft">{{
                modsText(row.mods)
              }}</span>
            </p>
            <!--
              同类隐患:自动收纳一律不动"已淬养"的件,而手动入炉会把它连同强化投入一起毁掉。
              手动动作不拦,但必须说清代价 —— 玩家不该在按下确认后才发现自己练过它。
              投入要报数:尘几许、灵石几许(enhanceInvested 同款,不是一句定性)。
            -->
            <p
              v-if="row.invested && row.investedCost"
              class="text-[10px] leading-relaxed text-cinnabar"
            >
              此器已淬养,入炉将连同强化投入一并失去(器灵尘×{{ row.investedCost.dust }} · 灵石
              {{ formatGN(row.investedCost.stone) }})
            </p>
          </div>
          <!-- 入炉二步确认:毁的是原器,不按一个「入 炉」就直接交代了 -->
          <button
            v-if="pendingRefineUid !== row.inst.uid"
            class="btn-ghost !px-3 !py-1 !text-[11px]"
            :disabled="!canAffordRefine"
            @click="pendingRefineUid = row.inst.uid"
          >
            入 炉
          </button>
          <div v-else class="flex shrink-0 items-center gap-1.5">
            <button class="btn-seal !px-2.5 !py-1 !text-[11px]" @click="doRefine(row.inst.uid)">
              确认凝炼
            </button>
            <button class="btn-ghost !px-2.5 !py-1 !text-[11px]" @click="pendingRefineUid = null">
              再想想
            </button>
          </div>
        </div>
      </div>
      <p v-else class="px-4 py-6 text-center t-body text-ink-faint">
        行囊中无可凝之器。
        <br />
        <span class="text-[10px]">已穿戴、已上锁、或无任何词条的法器都入不得炉</span>
      </p>
      <template #footer>
        <button class="btn-seal w-full" @click="forgeOpen = false">收 炉</button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { goBack } from "@/router/goBack";
import { formatGN, formatNum } from "@/utils/format";
import { modsText } from "@/data/statNames";
import { equipmentTemplate } from "@/data/equipment";
import {
  SOUL_SLOTS,
  soulGradeDef,
  soulMods,
  soulName,
  soulTypeDef,
  type SoulInstance,
} from "@/data/souls";
import {
  canRefine,
  dissolveSoul,
  previewSoul,
  refineEquipment,
  removeSoul,
  SOUL_REFINE_COST,
  wearSoul,
} from "@/core/soulService";
import { hasInvestment } from "@/core/smartKeep";
import { enhanceInvested } from "@/core/salvage";
import { endgameUnlocked } from "@/core/endgameService";
import { useEndgameStore } from "@/stores/endgame";
import { useInventoryStore } from "@/stores/inventory";
import SectionTitle from "@/components/common/SectionTitle.vue";
import BaseModal from "@/components/common/BaseModal.vue";

const router = useRouter();
const endgame = useEndgameStore();
const inventory = useInventoryStore();

const unlocked = computed(() => endgameUnlocked());
const idleOpen = ref(false);
const forgeOpen = ref(false);
/** 「何谓器魂」的细读段:默认收起,只留一句结论 */
const soulIntroOpen = ref(false);
/** 已装配器魂的详情弹窗对象;非 null 时展示该缕 */
const soulDetail = ref<SoulInstance | null>(null);

/**
 * 「这一格有没有器魂」的唯一出口。详情按钮 / 卸下按钮 / 卡壳样式三处都从它取值 ——
 * 各写一份"有没有器魂",漏一处就又是一个"念出来却按不动"的东西。
 *
 * 键盘可达不用自己补:两个动作都是真 <button>,Enter / 空格是浏览器给的
 * (从前整卡是 role=button 的 div,得手写 keydown 才走得动)。
 */
function soulAt(i: number): SoulInstance | null {
  return endgame.activeSouls[i - 1] ?? null;
}

function openSoulDetail(i: number): void {
  soulDetail.value = soulAt(i);
}

/** 详情按钮的读屏名 —— 印章单字与短词条都是图形,念得出的是这一句 */
function detailLabel(soul: SoulInstance): string {
  return `${soulLabel(soul)} 详情`;
}

/**
 * 等待二次确认的行(uid);非 null 表示该行已展开确认态。
 * 凝炼入炉毁的是原器、散去形意毁的是器魂 —— 都属「不可逆失去整件」,
 * 走两步武装确认:确认词「确认+动词」、取消词一律「再想想」
 * (确认模式分级见 EquipDecomposePanel 文件头)。
 */
const pendingRefineUid = ref<string | null>(null);
/** 散去形意同样二步确认:器魂是花道源与一件法器凝出来的,一脚碎掉连个反悔都没有 */
const pendingDissolveUid = ref<string | null>(null);

/** 道源不够 20 置灰凝炼入口 —— 正是秘境/聚气丹同款的「付不起要直说」 */
const canAffordRefine = computed(() => endgame.daoSource >= SOUL_REFINE_COST);
/** 凝炼短差(付不起置灰+列差):与 RealmCodexView askShort 同款 —— 裸相减不保底会有负号 */
const refineShort = computed(() => Math.max(0, SOUL_REFINE_COST - endgame.daoSource));

/** 二步确认后真正入炉;成功后收拢确认态 */
function doRefine(uid: string): void {
  if (refineEquipment(uid)) pendingRefineUid.value = null;
  else pendingRefineUid.value = null; // 失败(如道源不足)也收起确认态,让玩家重挑
}

/** 二步确认后真正散去形意;散去不可逆,成功后收拢确认态 */
function doDissolve(uid: string): void {
  dissolveSoul(uid);
  pendingDissolveUid.value = null;
}

/** 未装配的器魂 */
const idleSouls = computed(() =>
  endgame.soulList.filter((s) => !endgame.activeSouls.some((a) => a.uid === s.uid)),
);

/** 神魂槽已满:散置窗里的闲置器魂装不进去,装配须先散去一缕 */
const slotsFull = computed(() => endgame.activeSouls.length >= SOUL_SLOTS);

/** 可入炉的法器:未锁定、未穿戴、且确有形意可存 */
const refinable = computed(() => {
  const wearing = new Set(
    Object.values(inventory.equipped).filter((v): v is string => typeof v === "string"),
  );
  return inventory.items
    .filter((it) => !it.locked && !wearing.has(it.uid) && canRefine(it))
    .map((inst) => {
      const preview = previewSoul(inst);
      const invested = hasInvestment(inst);
      return {
        inst,
        name: equipmentTemplate(inst.templateId)?.name ?? "无名法器",
        typeName: preview.type?.name ?? "器魂",
        gradeRank: preview.gradeRank,
        // 将凝出的器的数值模组 —— 预览即成品(soulForge.previewSoul.mods)
        mods: preview.mods,
        invested,
        // 已淬养者的强化投入:不可逆确认里该有两笔具体的数(尘/灵石),不能只有一句定性
        investedCost: invested ? enhanceInvested(inst) : null,
      };
    });
});

function soulLabel(soul: SoulInstance): string {
  return soulName(soul);
}
function soulSeal(soul: SoulInstance): string {
  return soulTypeDef(soul.type)?.seal ?? "魂";
}
function soulColor(soul: SoulInstance): string {
  return soulGradeDef(soul.grade).color;
}
function soulModText(soul: SoulInstance): string {
  return modsText(soulMods(soul));
}
/** 已装配器魂的合计词条 */
const activeModText = computed(() => modsText(endgame.soulMods));
</script>
