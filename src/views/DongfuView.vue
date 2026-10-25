<template>
  <div class="stagger-in space-y-4 px-4 pb-6 pt-4">
    <!--
      卷首 —— 与修炼页/人物页同一套语言:不铺「返回|标题|占位」那种通用三栏(右侧那个
      空 span 是为了让标题视觉居中而塞的假元素),而是书名独立成卷首、返回挂在它左侧。
      洞府这一页回答的是「我这份家业攒到哪一步了」,故书名下面直接接一句家底读数。
    -->
    <div class="pb-1 text-center">
      <!--
        冷启动直接落在这一页时(书签 / deep link / 恢复上次路由),站内没有上一页,
        裸 router.back() 会退到 about:blank 把游戏一起带走 —— 故走 goBack(父页兜底)
      -->
      <div class="relative">
        <button
          class="tap-row absolute left-0 top-1/2 -my-1.5 -translate-y-1/2 py-1.5 text-left text-[11px] text-ink-faint active:text-ink-soft"
          @click="goBack(router, { name: 'home' })"
        >
          ← 返回
        </button>
        <p class="font-kai text-[15px] tracking-[0.3em] text-ink">洞府营造</p>
      </div>
      <!-- 家底一句:座数、离线档、弟子在途 —— 三个数概括这一页,不必翻卡 -->
      <p class="mt-1 text-[11px] text-ink-faint tabular">
        已营 {{ dongfu.builtCount }}/{{ BUILDINGS.length }} 座 · 离线可攒
        {{ offlineCapHours }} 时<template v-if="apprenticeBusy">
          · 弟子在途 {{ apprenticeBusy }} 人</template
        >
      </p>
    </div>
    <div class="ink-divider" aria-hidden="true" />

    <!-- 家业两案入口:坊市(灵石周转)与收徒(弟子跑腿) -->
    <section>
      <SectionTitle title="家业 · 财与人" :hint="`灵石往来 · 弟子跑腿`" />
      <!--
        两案入口此前只有名字 + 一句定性介绍,点进去才知道家底如何。各补一行真读数:
        坊市报手上灵石(它唯一的通用货币),门庭报在途弟子数 —— 都是玩家此刻就能决定的依据。
      -->
      <div class="mt-2 grid grid-cols-2 gap-2.5">
        <RouterLink
          to="/market"
          class="card-ink flex flex-col justify-between gap-2 px-3 py-3 active:scale-99"
        >
          <div>
            <p class="font-kai text-[14px] tracking-[0.2em] text-ink">坊市</p>
            <p class="mt-0.5 text-[11px] text-ink-faint">购丹续料、购兵刃,兼售寄卖</p>
          </div>
          <p class="text-[11px] text-ink-soft tabular">
            囊中 <span class="text-cinnabar">{{ formatGN(stone) }}</span> 灵石
          </p>
        </RouterLink>
        <RouterLink
          to="/apprentice"
          class="card-ink flex flex-col justify-between gap-2 px-3 py-3 active:scale-99"
        >
          <div>
            <p class="font-kai text-[14px] tracking-[0.2em] text-ink">门庭有徒</p>
            <p class="mt-0.5 text-[11px] text-ink-faint">弟子离线跑腿,归来带回资材</p>
          </div>
          <p class="text-[11px] text-ink-soft tabular">
            {{
              apprentices.length
                ? apprenticeBusy
                  ? `在途 ${apprenticeBusy} 人 · 门下 ${apprentices.length} 人`
                  : `门前 ${apprentices.length} 人皆待命`
                : "门下尚无弟子"
            }}
          </p>
        </RouterLink>
      </div>
    </section>

    <!-- 建筑 -->
    <section>
      <!-- 家业总览的一份子:已营几座在首页入口可见,洞府页自己反倒没有 —— 补进营造题头 -->
      <SectionTitle
        title="营造"
        :hint="`已营 ${dongfu.builtCount}/${BUILDINGS.length} · 各司其职,日夜不辍`"
      />
      <!--
        每时藏收:各地产卡的数散在七张卡里,合计得玩家心算 —— 补一行总额。
        读数走 hourlyYieldText(buildingRates 同源):界面上这个数字就是实时/离线结算
        实际发给玩家的那笔,不另写一份。未启(全 0)不上行,藏经阁 1~3 级保底照露。
      -->
      <p
        v-if="hourlyLines.length"
        class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-ink-faint"
      >
        <span class="font-kai tracking-[0.2em] text-ink">每时藏收</span>
        <template v-for="(part, i) in hourlyLines" :key="part">
          <span v-if="i" class="text-ink-faint">·</span>
          <span>{{ part }}</span>
        </template>
      </p>
      <!-- 洞府是其余建筑等级上限的枢纽:提为整宽主卡置顶,其余 6 座排 2 列 3 行 -->
      <!--
        极窄档(195 CSS px)改单列:两列时每卡内宽只剩 ~51px,「连升×5 ·共 31.37万 石
        400 铁」那两段 nowrap 直接顶出卡片左右各 13px(自检在后期档量到)。单列内宽 137px,
        两段各自一行放得下;320 / 390 两档不受影响。
        主卡的 col-span-2 在单列里必须同时收回 col-span-1 —— 否则它会撑出第二条隐式列,
        卡片量到 224px 宽(比整页还宽),越界判据当场红。
      -->
      <div class="mt-2 grid grid-cols-2 gap-2.5 tinylens:grid-cols-1">
        <BuildingCard v-if="mansionDef" :def="mansionDef" class="col-span-2 tinylens:col-span-1" />
        <BuildingCard v-for="def in otherBuildings" :key="def.id" :def="def" />
      </div>
      <!--
        营造尽善的完成感:各卡到了顶只会各自说「已至顶档」,七座全满的圆满
        没有一句话 —— 家业经营到头的这一天,与图鉴「尽收」/名号尽收同族。
        判据读 store 的 allBuildingsMaxed(与卡面的 N/M 同源),不另数一遍。
      -->
      <p
        v-if="dongfu.allBuildingsMaxed"
        class="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-jade"
      >
        <span class="chip-ink border-jade/60 text-[10px] text-jade">营造尽善</span>
        {{ cnNumber(BUILDINGS.length) }} 座建筑俱已至顶 —— 此间经营,已然圆满
      </p>
    </section>

    <!--
      灵脉投资:金丹后开放 —— 从主页归位到洞府页(组件本就在 dongfu/ 域,
      副题自己写着「引灵脉入洞府」,经营类动线该归一处)。主页洞府入口的
      右侧实况仍露灵脉点数,可见性不丢。
    -->
    <section v-if="player.major >= VEIN_UNLOCK_MAJOR">
      <SectionTitle title="灵脉 · 引脉入府" hint="炼化灵石,永久强化" />
      <button
        class="card-ink mt-2 flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:scale-99"
        @click="veinOpen = true"
      >
        <span class="min-w-0 flex-1">
          <span class="block t-card">灵脉投资</span>
          <span class="block truncate text-[10px] leading-relaxed text-ink-faint"
            >择一主脉而修,投点立得全局加成</span
          >
        </span>
        <span class="shrink-0 text-[11px] text-ink-faint">›</span>
      </button>
    </section>
    <BaseModal :open="veinOpen" title="" aria-label="灵脉" wide @close="veinOpen = false">
      <VeinInvestCard />
      <template #footer>
        <button class="btn-seal w-full" @click="veinOpen = false">收 起</button>
      </template>
    </BaseModal>

    <!--
      离线存续阶梯:离线上限按洞府等级分档,从前只活在常数表里
      (OFFLINE_CAP_HOURS 仅结算用),玩家看不出"现在第几档、升洞府能到哪一档"。
      五格一栏,亮到当前档,title 注各档可攒几时。
    -->
    <section>
      <SectionTitle title="离线存续" :hint="`当前 ${offlineCapHours} 时`" />
      <!--
        五格横排在 200% 缩放档(195 CSS px)下每格只剩 28px,「12时」被折成两行(整排 44px)。
        字号不许降(主巡页字阶只有 18/15/14/11/10,私开 9 档会被字阶判据打红),
        故极窄档改成可换行:每格保底 34px,五格排两行,标签各自一行。
      -->
      <div class="mt-2 grid grid-cols-5 items-stretch gap-1.5 tinylens:grid-cols-3">
        <div
          v-for="(h, i) in OFFLINE_CAP_HOURS"
          :key="i"
          class="flex-1 rounded-t-sm border px-0.5 pb-1 pt-2 text-center text-[10px] tabular"
          :class="
            i <= mansionLevel
              ? 'border-cinnabar bg-cinnabar text-paper font-kai'
              : 'border-ink/15 text-ink-faint'
          "
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
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { goBack } from "@/router/goBack";
import { useDongfuStore } from "@/stores/dongfu";
import { useResourcesStore } from "@/stores/resources";
import { useApprenticeStore } from "@/stores/apprentice";
import { usePlayerStore } from "@/stores/player";
import { OFFLINE_CAP_HOURS, VEIN_UNLOCK_MAJOR } from "@/data/constants";
import { BUILDINGS } from "@/data/buildings";
import SectionTitle from "@/components/common/SectionTitle.vue";
import BuildingCard from "@/components/dongfu/BuildingCard.vue";
import VeinInvestCard from "@/components/dongfu/VeinInvestCard.vue";
import BaseModal from "@/components/common/BaseModal.vue";
import { hourlyYieldText } from "@/core/engineFacilities";
import { cnNumber, formatGN } from "@/utils/format";

const router = useRouter();
const dongfu = useDongfuStore();
const resources = useResourcesStore();
const apprentice = useApprenticeStore();
const player = usePlayerStore();
const veinOpen = ref(false);

/** 坊市入口报的那枚数:灵石是全作唯一的通用货币,它决定「现在买不买得起」 */
const stone = computed(() => resources.spiritStone);
const apprentices = computed(() => apprentice.apprentices);
/** 在途弟子数 —— task 非空即已派出去,归来前不接新活 */
const apprenticeBusy = computed(() => apprentice.apprentices.filter((a) => a.task).length);

/** 洞府是其余建筑的等级上限来源:整宽主卡置顶,不与普通建筑同格位 */
const mansionDef = BUILDINGS.find((b) => b.id === "mansion");
const otherBuildings = BUILDINGS.filter((b) => b.id !== "mansion");
const mansionLevel = computed(() => dongfu.levels["mansion"] ?? 0);
const offlineCapHours = computed(() => dongfu.offlineCapHours);
/** 每时藏收:建筑合计的每小时产出(field 灵草/玄铁 + 藏经阁悟道,与 buildingRates / accrue 同源) */
const hourlyLines = computed(() => hourlyYieldText({ ...dongfu.levels } as Record<string, number>));
</script>
