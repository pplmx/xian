<template>
  <!--
    一幅山水 —— 按一处地方的身份画一道。全站的「地方」都从这里出图。

    玩家反馈「如果能加一些画面就完美了,不仅仅是纯文字」。这一作的信息量已经足够,
    缺的不是字,是**抬头有东西可看**。故这里只做一件事:让「青云山麓」与「幽冥海」
    不共用同一道折线。

    边界:开局那两页(欢迎 / 建号)有自己的 `opening/OpeningBackdrop` —— 它们画的是
    「还没入世」,不属于任何一处地界,故不归这里。除此之外,凡按身份取景的都走这一处。

    画面全部是 `aria-hidden`:文字已经把该说的说全了,读屏念一遍「山、鸟、月」只是噪音
    —— 与全站 far-mountain / brush-bar 同一条纪律。里面也不承载任何数值,故判据不必
    去核它的对比度(它不托字)。

    画法与用色守两条既有纪律:
      一 只走 `fill` / `stroke`,不铺 `background` —— `ornament.spec` 的墨浓度上限
         只管背景声明,把景写成背景就会正面撞上 25% 那条线;
      二 颜色只取调色板 token(不与 `visualRhythm.spec` 的裸 hex 红线冲突),
         山骨读 `--world-mountain`,于是换界那一下连山色一起换。
  -->
  <div
    class="ink-scene"
    :class="[`ink-scene--${variant}`, `ink-scene--${shape.terrain}`]"
    :data-ink-scene="shape.terrain"
    :data-scene-terrain="shape.terrain"
    aria-hidden="true"
  >
    <svg
      class="ink-scene__draw"
      viewBox="0 0 420 160"
      preserveAspectRatio="none"
      role="presentation"
      focusable="false"
    >
      <!-- 天上的几笔先画:月、日、雀、云、雪、碎晶落在山脊之后会被整块盖住 -->
      <g class="ink-scene__sky">
        <path
          v-for="(accent, i) in skyAccents"
          :key="`sky-${i}`"
          class="ink-scene__accent"
          :class="`is-${accent.kind}`"
          :transform="transformOf(accent)"
          :d="accent.d"
        />
      </g>

      <path class="ink-scene__far" :d="shape.far" />
      <path class="ink-scene__near" :d="shape.near" />

      <!-- 地上的几笔压在山骨之上:松、塔、水纹、舟、火星若画在山后,读起来像陷进山里 -->
      <g class="ink-scene__ground">
        <path
          v-for="(accent, i) in groundAccents"
          :key="`ground-${i}`"
          class="ink-scene__accent"
          :class="`is-${accent.kind}`"
          :transform="transformOf(accent)"
          :d="accent.d"
        />
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  sceneAccentInFront,
  sceneOf,
  sceneTerrainOfPlace,
  sceneTerrainOfTags,
  type SceneAccent,
  type SceneTerrain,
} from "@/ui/sceneTerrain";

/**
 * 两种落法。
 *
 *   veil  —— 绝对定位、铺满祖先盒子(`inset: 0`)。它**不占布局**,故往任何一页加画面
 *            都不会把正文挤下去;高度由祖先给(首页主舞台 46%、修行卷首 42%)。
 *   strip —— 在流里的一条,高度读 `--ink-scene-h`(缺省 4.6rem)。给真正需要「一块图」
 *            的空处用,调用方按自己的版面给高度。
 *
 * 做成两种而不是一种,是因为「背景」与「插图」在版式上的要求相反:前者绝不能有高度,
 * 后者必须有。混成一个 prop 之外再靠调用方写 CSS 覆盖,下一个人会分不清它现在是哪种。
 */
const props = withDefaults(
  defineProps<{
    variant?: "veil" | "strip";
    /** 直接指定地形(知道了就用它,省一次分派) */
    terrain?: SceneTerrain;
    /** 或者交身份:世界 id + 地界图标 + 标签,由 sceneTerrain 分派 */
    worldId?: string | null;
    icon?: string | null;
    tags?: readonly string[] | null;
    /**
     * 画不画点景(月、舟、塔、松……)。
     *
     * 默认画。**不讲道理地铺满整块时**才关掉:那一格底下压着别人的字
     * (地界志卷首的换界框、行旅图的路线上方的读数),点景落在字上只会两边都读不清。
     * 山骨本身压不碍事 —— 它是连续的一片,字浮在上面仍分得出笔墨。
     */
    marks?: boolean;
  }>(),
  { variant: "veil", terrain: undefined, worldId: null, icon: null, tags: null, marks: true },
);

const resolved = computed<SceneTerrain>(() => {
  if (props.terrain) return props.terrain;
  /*
   * 地界与事件是两种身份,分派顺序不一样:地界有图标(比标签更近),事件只有标签。
   * 两者都由 sceneTerrain 一处说了算,组件不自己判。
   */
  if (props.icon) return sceneTerrainOfPlace({ worldId: props.worldId, icon: props.icon });
  if (props.tags && props.tags.length > 0) return sceneTerrainOfTags(props.tags);
  return sceneTerrainOfPlace({ worldId: props.worldId });
});

const shape = computed(() => sceneOf(resolved.value));
const skyAccents = computed(() =>
  props.marks ? shape.value.accents.filter((a) => !sceneAccentInFront(a.kind)) : [],
);
const groundAccents = computed(() =>
  props.marks ? shape.value.accents.filter((a) => sceneAccentInFront(a.kind)) : [],
);

function transformOf(accent: SceneAccent): string {
  return `translate(${accent.x} ${accent.y}) scale(${accent.scale})`;
}
</script>

<style scoped>
.ink-scene {
  pointer-events: none;
  user-select: none;
}

/*
 * 背景层:贴祖先盒子下缘、左右铺满,高度读 `--ink-scene-h`(缺省 = 撑满祖先)。
 *
 * 不占布局,故往任何一页加画面都不会把正文挤下去。
 *
 * 为什么高度要留一个变量出口:首页与修行卷首都先套一个已经定好高度(46% / 42%)的
 * 盒子,那里 100% 正好;而地界志与行旅图是直接放进 `#backdrop` 槽的,高度得由这一处
 * 自己定 —— 若靠 `h-28` 这类工具类,就会与这条 scoped 规则抢同一个属性(组件里
 * 以 `data-v` 结尾的选择器特指度更高,工具类会静默失效)。故统一走变量。
 */
.ink-scene--veil {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  height: var(--ink-scene-h, 100%);
  overflow: hidden;
}

/*
 * 插图层:在流里的一条,高度读 `--ink-scene-h`。
 * 走变量而不是写死像素,是为了让调用方按自己的版面给高度而不必覆盖这一条规则
 * (覆盖就得用更高特指度,下一个人读不出「它现在到底多高」)。
 */
.ink-scene--strip {
  position: relative;
  display: block;
  width: 100%;
  height: var(--ink-scene-h, 4.6rem);
  overflow: hidden;
}

/*
 * 画布**保持自己的比例**(420×160),只贴着容器下缘 —— 不随容器拉伸。
 *
 * 这一条是量出来的:战局那一格是 358×349,若按 100%/100% 铺,山骨会被纵向拉成
 * 一根根尖刺(画好的坡岸成了尖三角)。`preserveAspectRatio="none"` 只是不报错,
 * 它不会替人守住画的比例 —— 那是容器的事。
 *
 * 故用 `aspect-ratio` 定高:容器高多少都行,画只占下缘那一条,与设计稿同一个形状。
 */
.ink-scene__draw {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: auto;
  aspect-ratio: 420 / 160;
  /*
   * 整幅画**共用的一个浓淡闸**。
   *
   * 为什么需要它:同一份山骨铺在 46% 高的主舞台上正好,铺在 6rem 的窄条里就成了
   * 一条实心灰带 —— 山骨占的比例一大,淡墨就叠成了厚墨。渲染尺寸不是画法的一部分,
   * 故让调用方按自己的条高把它调薄,几何与配色一个字不动。
   */
  opacity: var(--ink-scene-ink, 1);
}

/*
 * 两道山骨都读世界色,只差一档浓淡 —— 这本来就是水墨画里远近的写法。
 *
 * 但浓淡**必须收得住**:卷首底部压着 9~10px 的读数(修行页那三格、首页「其后」与
 * 「去修炼 →」),而 `layout-check` 的像素门采样的是真实像素。实测:
 *
 *   远 0.30 / 近 0.26  → 首页与修行页那几行淡墨掉到 4.3:1 / 2.0:1,门当场红
 *   远 0.16 / 近 0.10  → 门全绿,而截图上几乎看不见山(等于没画)
 *   远 0.16 / 近 0.22  → 门全绿(见下),山骨读得出
 *
 * 这一档是**量出来的平衡点**,不是感觉。要更浓,先解决那几行读数的底色
 * (它们落在纸暗渐变上,再叠一层墨就过不了 AA)—— 那是另一件事,不该由装饰层硬闯。
 */
.ink-scene__far {
  fill: var(--world-mountain, currentColor);
  opacity: 0.16;
}

.ink-scene__near {
  fill: var(--world-mountain, currentColor);
  opacity: 0.22;
}

/* 点景走描边不填充:细笔在大片淡山之上才分得清,填空就成了第二座山 */
.ink-scene__accent {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.1;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.ink-scene__sky {
  color: rgb(var(--color-gold-ink-rgb) / 0.62);
}

.ink-scene__ground {
  color: rgb(var(--color-ink-soft-rgb) / 0.5);
}

/* 日与月是这一层唯一的两枚「实心」:它们本来就是一团光,描边反而不像 */
.ink-scene__accent.is-moon,
.ink-scene__accent.is-orb {
  fill: rgb(var(--color-gold-ink-rgb) / 0.3);
  stroke: rgb(var(--color-gold-ink-rgb) / 0.68);
}

/* 雪与碎晶比云更冷、更淡 —— 它们该像浮尘,不该像记号 */
.ink-scene__accent.is-flake {
  stroke: rgb(var(--color-ink-soft-rgb) / 0.42);
  fill: rgb(var(--color-ink-soft-rgb) / 0.34);
}

.ink-scene__accent.is-shard {
  stroke: rgb(var(--color-qing-rgb) / 0.46);
  fill: rgb(var(--color-qing-rgb) / 0.18);
}

/* 火星用朱砂 —— 全站第二个强色只给「要紧处」,火域的火是少数说得通的地方 */
.ink-scene__accent.is-ember {
  stroke: rgb(var(--color-cinnabar-rgb) / 0.52);
  fill: rgb(var(--color-cinnabar-rgb) / 0.4);
}

/*
 * 空间里的雪/碎晶可以比别处稀一点:它们铺满整块时看起来像脏点,而不是落雪。
 * 只调透明度,不动几何 —— 位置与形状仍只在 ui/sceneTerrain 一处。
 */
.ink-scene--strip .ink-scene__accent {
  opacity: 0.86;
}

@media (prefers-reduced-motion: no-preference) {
  /*
   * 极轻的呼吸:整幅山只做透明度的一点点起伏,不做位移。
   * 位移会把「远山」读成「在动的东西」,而这里要的只是「画面是活的」。
   */
  .ink-scene--strip .ink-scene__draw {
    animation: ink-scene-breathe 9s ease-in-out infinite;
  }

  @keyframes ink-scene-breathe {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.86;
    }
  }
}
</style>
