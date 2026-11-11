/**
 * 山水景 —— 玩家说「能加一些画面就完美了」,那画面得**每一处都不一样**。
 *
 * ## 缺口
 *
 * 全站原来有四道远山(首页、修行卷首、地界志、行旅图),而那道山**处处一样**:
 * 两道折线、一个 fill、一个透明度,从人间界一路画到混沌海。同一道折线摆在四处,
 * 读起来不是画面,是水印 —— 玩家不会觉得「这游戏有画」,只会觉得「同一张底图重复用了」。
 *
 * ## 这一份守什么
 *
 *   一 **九个地形各不相同**:两两之间不许共用同一对山骨(否则「换了地形」只是换了颜色);
 *   二 **表里不留闲地形**:每个地形都得被一种真实身份选中过 —— 画了没人看得见,
 *      与 `inkIcons` 的「族类表里不留闲族」是同一条纪律;
 *   三 **每个真实身份都有归处**:`REGIONS` 的十八种图标与 `EVENTS` 的全部标签
 *      (路由标签除外),一个都不许静静落回默认地形;
 *   四 **分派是可复现的**:同一处地方两次打开是同一座山 —— 出图脚本与判据都靠这条;
 *   五 **点景分两层且分层正确**:月/日/雀/云/雪/碎晶在天上(画在山前),
 *      松/塔/水纹/舟/火星在地上(压在山骨之上)。两批若不分层,总有一半是错的。
 *
 * ## 为什么从源码里读表
 *
 * 「哪些图标/标签有归处」要对着**表**核,而表本身没有对外的理由(界面只调分派函数)。
 * 为判据加一个 `sceneIdentities()` 导出,正是 `deadExportAudit` 要拦的「只为 spec 存在
 * 的导出」。故这里与 `inkIcons.spec` 的 `inkPathsFromSource` 同一套做法:
 * **读源码文本、抽出表里的键**,不为此多开一个出口。
 */
import { describe, expect, it } from "vite-plus/test";
import { readSource } from "@/test/readSource";
import { EVENTS } from "@/data/events";
import { REGIONS } from "@/data/regions";
import { WORLDS } from "@/data/realms";
import {
  SCENE_TERRAINS,
  sceneAccentInFront,
  sceneOf,
  sceneTerrainOfPlace,
  sceneTerrainOfTags,
  sceneTerrainOfTribulation,
} from "./sceneTerrain";

const SOURCE = readSource("src/ui/sceneTerrain.ts");

/**
 * 从源码里抽一张名为 `name` 的 `Record` 表的键。
 *
 * 三段式:先切出 `const <name> ... = { ... };`(花括号配平),再逐行取
 * `key: "value"` 的键。找不到这张表就当场抛 —— 静默返回空表会让下面每条
 * 「都有归处」的判据在空集上假绿。
 */
function keysOfTable(name: string): string[] {
  const at = SOURCE.indexOf(`const ${name}`);
  if (at < 0) throw new Error(`sceneTerrain.ts 里找不到表 ${name} —— 判据的输入不成立了`);
  const open = SOURCE.indexOf("{", at);
  const close = SOURCE.indexOf("\n};", open);
  if (open < 0 || close < 0) throw new Error(`表 ${name} 的花括号没配平`);
  const body = SOURCE.slice(open + 1, close);
  const keys = [...body.matchAll(/^\s{2}([a-z]+):/gm)].map((m) => m[1]!);
  if (keys.length === 0) throw new Error(`表 ${name} 里一个键都没读到`);
  return keys;
}

/** 路由标签的名单 —— 它们说「怎么被抽到」,不说「长什么样」,不该有地形 */
const ROUTING_TAGS = ["general", "chain"] as const;

describe("山水景 · 九个地形各不相同", () => {
  it("地形表正好是九种,一种不多一种不少", () => {
    expect(SCENE_TERRAINS.length).toBe(9);
    expect(new Set(SCENE_TERRAINS).size).toBe(9);
  });

  it("两两之间不许共用同一对山骨 —— 否则「换地形」只是换了个名字", () => {
    const seen = new Map<string, string>();
    for (const terrain of SCENE_TERRAINS) {
      const shape = sceneOf(terrain);
      const key = `${shape.far}|${shape.near}`;
      const other = seen.get(key);
      expect(
        other,
        `${terrain} 与 ${other} 的山骨一模一样 —— 玩家看得出是同一座山`,
      ).toBeUndefined();
      seen.set(key, terrain);
    }
  });

  it("山骨都从左下角起笔、封到右下角、再闭合 —— 未封底会露出硬边切口", () => {
    for (const terrain of SCENE_TERRAINS) {
      const shape = sceneOf(terrain);
      for (const [which, d] of [
        ["far", shape.far],
        ["near", shape.near],
      ] as const) {
        expect(d, `${terrain} 的 ${which} 起点不在左下角`).toMatch(/^M0 160 /);
        expect(d, `${terrain} 的 ${which} 没有封到右下角`).toContain("420 160");
        expect(d, `${terrain} 的 ${which} 没有闭合`).toMatch(/Z$/);
      }
    }
  });

  it("每个地形都带点景,且点景落在画布里", () => {
    for (const terrain of SCENE_TERRAINS) {
      const shape = sceneOf(terrain);
      expect(shape.accents.length, `${terrain} 一笔点景都没有 —— 那只是一条折线`).toBeGreaterThan(
        2,
      );
      for (const accent of shape.accents) {
        // 写成「在画布内」这一个布尔,而不是两条 `>= 0` / `<= 420`:
        // 后者的下界是恒真的形状(见 tautologyGuard),而这里要的正是上下界一起判
        const inCanvas =
          Number.isFinite(accent.x) &&
          Number.isFinite(accent.y) &&
          accent.x >= 0 &&
          accent.x <= 420 &&
          accent.y >= 0 &&
          accent.y <= 160;
        expect(inCanvas, `${terrain} 有一笔点景落到了画布外 (${accent.x}, ${accent.y})`).toBe(true);
        expect(accent.d.length, `${terrain} 有一笔画路是空的`).toBeGreaterThan(0);
        expect(accent.scale, `${terrain} 有一笔点景缩放是 0 或负`).toBeGreaterThan(0);
      }
    }
  });
});

describe("山水景 · 表里不留闲地形,身份不留悬空", () => {
  it("九个地形每一个都被一种真实身份选中过", () => {
    const hit = new Set<string>();
    for (const world of keysOfTable("WORLD_TERRAIN"))
      hit.add(sceneTerrainOfPlace({ worldId: world }));
    for (const icon of keysOfTable("ICON_TERRAIN")) hit.add(sceneTerrainOfPlace({ icon }));
    for (const tag of keysOfTable("TAG_TERRAIN")) hit.add(sceneTerrainOfTags([tag]));
    const idle = SCENE_TERRAINS.filter((terrain) => !hit.has(terrain));
    expect(idle, "这些地形没有任何真实身份会选中 —— 画了没人看得见").toEqual([]);
  });

  it("四界各给一片地 —— 跨界时连山一起换", () => {
    const byWorld = new Map(WORLDS.map((w) => [w.id, sceneTerrainOfPlace({ worldId: w.id })]));
    expect(new Set(byWorld.values()).size, "有两个界共用同一种地形 —— 飞升看起来没换天").toBe(
      WORLDS.length,
    );
  });

  it("地界表的十八种图标,每一个都有归处", () => {
    const icons = [...new Set(REGIONS.map((region) => region.icon))].sort();
    expect(icons.length, "地界图标种类数变了 —— 这条判据要跟着核新图标").toBeGreaterThan(15);
    /*
     * 「落在山岳」不能当成「有归处」的证据:山岳既是兜底,又在图标表里正当地写着
     * (`mountain` / `sunset` / `gem`)。故这里核的是**表里有没有这个名字**,
     * 而不是分派结果的形状 —— 后者会让「所有图标都归山岳」也通过。
     */
    const explicit = keysOfTable("ICON_TERRAIN");
    const missing = icons.filter((icon) => !explicit.includes(icon));
    expect(missing, "这些地界图标没有归处,静默落回默认地形").toEqual([]);
    expect(
      icons.filter((icon) => sceneTerrainOfPlace({ icon }) !== "peaks").length,
      "防空转:图标分派一条都没改变地形",
    ).toBeGreaterThan(6);
  });

  it("事件表的全部标签,除路由标签外每一个都有归处", () => {
    const tags = [...new Set(EVENTS.flatMap((event) => event.tags))].sort();
    expect(tags.length, "事件标签种类数变了 —— 这条判据要跟着核新标签").toBeGreaterThan(8);
    /*
     * `general`(到处都可能)与 `chain`(奇缘阶段事件的路由标签)说的是**这条内容
     * 怎么被抽到**,不是「这地方长什么样」。给它们硬派一座山,等于替内容编一个
     * 它没有的身份 —— 故它们是设计上的豁免,不是漏项。其余标签一个都不许悬空。
     */
    for (const routing of ROUTING_TAGS) {
      expect(tags, `路由标签 ${routing} 不在事件表里了 —— 若改名,这条判据要跟着改`).toContain(
        routing,
      );
    }
    const explicit = keysOfTable("TAG_TERRAIN");
    const missing = tags.filter(
      (tag) => !(ROUTING_TAGS as readonly string[]).includes(tag) && !explicit.includes(tag),
    );
    expect(missing, "这些事件标签没有归处,静默落回默认地形").toEqual([]);
  });

  it("地界标签里的 second tag 也都有归处", () => {
    const tags = new Set(REGIONS.flatMap((region) => region.eventTags));
    const explicit = keysOfTable("TAG_TERRAIN");
    const missing = [...tags].filter(
      (tag) => !(ROUTING_TAGS as readonly string[]).includes(tag) && !explicit.includes(tag),
    );
    expect(missing, "这些地界标签没有归处").toEqual([]);
  });

  it("路由标签被真的跳过 —— 不会因为「都在表外」而落到某座随机山上", () => {
    // general 是「到处都可能」,chain 是奇缘阶段。两者单独出现时该落默认地形,
    // 与「一条标签都不给」同一个答案 —— 而不是被某条分支当成 `dark` / `ruin` 之类
    for (const routing of ROUTING_TAGS) {
      expect(sceneTerrainOfTags([routing]), `${routing} 被当成了某种地形`).toBe("peaks");
    }
    expect(sceneTerrainOfPlace({ tags: ["general"] })).toBe("peaks");
  });
});

describe("山水景 · 分派与兜底", () => {
  it("同一处地方两次问是同一座山 —— 不掷骰,出图与判据才可复现", () => {
    const place = { worldId: "immortal", icon: "droplets", tags: ["water"] as const };
    expect(sceneTerrainOfPlace(place)).toBe(sceneTerrainOfPlace(place));
  });

  it("图标比世界的底子更近 —— 仙界的一处海上地界仍是江海", () => {
    expect(sceneTerrainOfPlace({ worldId: "immortal", icon: "droplets" })).toBe("water");
    expect(sceneTerrainOfPlace({ worldId: "immortal" })).toBe("sky");
  });

  it("认不得的名字落到山岳 —— 不抛、不空白", () => {
    expect(sceneOf("no_such_terrain" as never).terrain).toBe("peaks");
    expect(sceneOf(undefined).terrain).toBe("peaks");
    expect(sceneTerrainOfPlace({ icon: "no_such_icon" })).toBe("peaks");
    expect(sceneTerrainOfTags(["no_such_tag"])).toBe("peaks");
  });

  it("什么都没有时也画得出山", () => {
    expect(sceneOf(sceneTerrainOfPlace({}))).toBeTruthy();
    expect(sceneTerrainOfPlace({})).toBe("peaks");
  });
});

describe("山水景 · 点景分两层", () => {
  it("月与日画在山脊之前、松与塔压在山骨之上 —— 反过来就看不出来", () => {
    for (const kind of ["moon", "orb", "bird", "cloud"] as const) {
      expect(sceneAccentInFront(kind), `${kind} 该在天上,却压在山骨之上`).toBe(false);
    }
    for (const kind of ["pine", "pagoda", "wave", "boat"] as const) {
      expect(sceneAccentInFront(kind), `${kind} 该在地上,却画到了山后`).toBe(true);
    }
  });

  it("点景按真渲染尺寸放大过 —— 54px 的条里 12 单位的松只有 4px,读出来是一根短线", () => {
    /*
     * 表里的笔路按「一整张画」的原稿尺寸写,而真渲染时这一幅常只有 54~74px 高
     * (卷首底、战局底、际遇帖)。若不放大,点景在那些地方等于不存在 ——
     * 而这一层存在的全部意义就是「看得见」。故钉住一个下限。
     */
    for (const terrain of SCENE_TERRAINS) {
      const scaled = sceneOf(terrain).accents.map((a) => a.scale);
      expect(
        Math.max(...scaled),
        `${terrain} 的点景没放大 —— 窄条里会缩成一根短线`,
      ).toBeGreaterThan(1.5);
    }
  });

  it("松是树不是箭头 —— 针叶树得是一整个三角剪影,不是叠起来的人字", () => {
    /*
     * 原先的松写成「一干三针」(三条人字叠起来),真渲染出来是一支朝上的箭头。
     * 箭镞与针叶树是两套形状语言;这条钉住「闭合的三角形树冠」。
     */
    const pine = sceneOf("forest").accents.find((a) => a.kind === "pine");
    expect(pine, "林麓连一棵松都没有 —— 那它凭什么叫林麓").toBeTruthy();
    expect(pine!.d, "松要闭合成一整个树冠").toMatch(/Z/);
    expect(pine!.d.split("M").length - 1, "松至少要干 + 冠两笔").toBeGreaterThan(1);
  });

  it("遗迹与宫阙一眼分得开 —— 断塔不是完整的塔", () => {
    /*
     * 两处原先都用 `pagoda`:遗迹是一片坡上立着三座**完整**的塔,宫阙也是。
     * 真渲染画廊里两者几乎一模一样 —— 那就等于地形表里只有八种。
     */
    const kindsOf = (terrain: (typeof SCENE_TERRAINS)[number]) =>
      sceneOf(terrain).accents.map((a) => a.kind);
    expect(kindsOf("ruin"), "遗迹要有断塔").toContain("ruinTower");
    expect(kindsOf("ruin"), "遗迹要有断柱").toContain("ruinColumn");
    expect(kindsOf("palace"), "宫阙仍是完整的塔").toContain("pagoda");
    /*
     * 反向:遗迹不许再靠完整的 pagoda 撑场面 —— 否则「断」与「完整」同时出现,
     * 玩家读到的还是「这里也有塔」。
     */
    expect(kindsOf("ruin"), "遗迹不该再摆完整的塔").not.toContain("pagoda");
  });

  it("四界各自最认得出来的那一笔都在(山有月、林有松、海有舟、宫有塔)", () => {
    const kindsOf = (terrain: (typeof SCENE_TERRAINS)[number]) =>
      sceneOf(terrain).accents.map((a) => a.kind);
    expect(kindsOf("peaks")).toContain("moon");
    expect(kindsOf("forest")).toContain("pine");
    expect(kindsOf("water")).toContain("boat");
    expect(kindsOf("palace")).toContain("pagoda");
    expect(kindsOf("frost")).toContain("flake");
    expect(kindsOf("flame")).toContain("ember");
  });

  it("每一笔点景都分得进某一层 —— 没有第三种说不清的", () => {
    for (const terrain of SCENE_TERRAINS) {
      for (const accent of sceneOf(terrain).accents) {
        const side = sceneAccentInFront(accent.kind);
        expect(side === true || side === false, `${accent.kind} 落在哪一层说不清`).toBe(true);
      }
    }
  });
});

describe("山水景 · 只做装饰,不碰玩法", () => {
  it("不 import store 也不 import core —— 与 ui/weatherSky 同一条纪律", () => {
    expect(SOURCE, "装饰层不该认识玩法").not.toMatch(/from ["']@\/stores\//);
    expect(SOURCE, "装饰层不该认识玩法").not.toMatch(/from ["']@\/core\//);
  });
});

describe("山水景 · 真接线", () => {
  it("组件只做绘制:地形与点景的几何都从 ui/sceneTerrain 来", () => {
    const scene = readSource("src/components/common/InkScene.vue");
    expect(scene, "组件要读地形表").toContain("sceneOf(");
    expect(scene, "组件不许自己抄一份山骨路径").not.toMatch(/d="M0 160 L\d/);
    expect(scene, "整幅画对读屏隐藏").toContain('aria-hidden="true"');
  });

  it("画面只铺 fill / stroke,不铺 background —— 背景声明会撞墨浓度上限", () => {
    const scene = readSource("src/components/common/InkScene.vue");
    const style = (scene.match(/<style scoped>([\s\S]*)<\/style>/)?.[1] ?? "").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    expect(style.length, "组件的样式段不见了 —— 这条判据会假绿").toBeGreaterThan(200);
    expect(style, "画面用 background 铺底会正面撞 ornament.spec 的 25% 上限").not.toMatch(
      /^\s*background(-image)?:/m,
    );
    expect(style, "山骨要读世界色一处").toContain("var(--world-mountain");
  });

  it("两页有景的也必须接上,且不许停在同一片地上", () => {
    /*
     * 名号与藏珍本来既没有主视觉也没有卷首底 —— 全靠文字立住。补上之后,
     * 它们**不该都用同一个地形**:两页说的是两件事(身外之名 / 收起来的东西),
     * 若都落回山岳,玩家看到的还是同一张底图,只是挪了位置。
     */
    const titles = readSource("src/views/TitlesView.vue");
    const collection = readSource("src/views/CollectionView.vue");
    expect(titles, "名号页的卷首要接山水").toContain("<InkScene");
    expect(collection, "藏珍页的卷首要接山水").toContain("<InkScene");
    expect(titles, "名号页得自己挑地形,不许靠兜底").toMatch(/terrain="[a-z]+"/);
    expect(collection, "藏珍页得自己挑地形,不许靠兜底").toMatch(/terrain="[a-z]+"/);
    const terrainOf = (src: string) => src.match(/terrain="([a-z]+)"/)?.[1] ?? "";
    expect(terrainOf(titles), "两页用了同一片地 —— 等于只有一张底图").not.toBe(
      terrainOf(collection),
    );
  });

  it("首页、修行卷首、地界志、行旅图都接上了同一幅山水", () => {
    for (const [file, why] of [
      ["src/views/HomeView.vue", "首页那张星空底下"],
      ["src/views/CultivationView.vue", "修行内观台的卷首"],
      ["src/views/MortalWorldView.vue", "地界志的卷首"],
      ["src/components/world/MortalRouteMap.vue", "行旅图的纸下"],
      ["src/views/AdventureView.vue", "历练卷首"],
    ] as const) {
      expect(readSource(file), `${file} 还没接山水(${why})`).toContain("<InkScene");
    }
  });

  it("首页与修行卷首按「此刻所处的界」画 —— 不是写死同一座山", () => {
    for (const file of ["src/views/HomeView.vue", "src/views/CultivationView.vue"]) {
      expect(readSource(file), `${file} 的山不随界变`).toMatch(
        /<InkScene[\s\S]{0,120}:world-id="player\.world\.id"/,
      );
    }
  });

  it("战局那一栏也有这一处地界的山水 —— 停得最久的一屏不该是白纸", () => {
    const panel = readSource("src/components/adventure/CombatPanel.vue");
    expect(panel, "战局要按当前地界画景").toContain("<InkScene");
    /*
     * 战局底图必须读**当前地界**的图标:写死成某个地形就等于每一场战斗都在同一片地里
     * 打 —— 而这一屏正是玩家停留时间最长的地方。
     */
    expect(panel, "底图要由当前地界决定").toMatch(/:icon="region\?\.icon"/);
    expect(panel, "底图不许吃事件").toContain("data-combat-arena");
  });

  it("五种天劫各有一副长相 —— 渡劫那一屏不该五种劫共用一张底", () => {
    /*
     * 渡劫是全作戏眼(跨大境界时的一次生死),而劫势面板原先是一整块 405px 的纯文字。
     * 补画面时最容易走的路是「给它也画一片山」—— 但那样五种劫就是同一张底,
     * 而它们本来是五件不同的事:雷鸣是雷雨天、逆流是灵气倒灌、裂魂是神魂被撼。
     */
    const kinds = ["thunder", "counterflow", "soulrend", "ironbody", "heavyrush"];
    const terrains = kinds.map((k) => sceneTerrainOfTribulation(k));
    expect(new Set(terrains).size, "有两种劫画成了同一片地 —— 那等于只有四种").toBe(kinds.length);
    for (const t of terrains) expect(SCENE_TERRAINS).toContain(t);
    // 认不出的劫名落到虚空(最不像寻常风景的那一种),不抛也不空白
    expect(sceneTerrainOfTribulation("no_such_kind")).toBe("void");
    expect(sceneTerrainOfTribulation(null)).toBe("void");
  });

  it("劫相面板真接上了 —— 且按这一种劫取景,不是按玩家脚下的地界", () => {
    const panel = readSource("src/components/cultivation/TribulationPanel.vue");
    expect(panel, "劫势面板要有画面").toContain("<InkScene");
    /*
     * 渡劫那一刻的戏眼是天上落下的那一道,不是脚下的山。写死成 worldId 会让
     * 「同一种劫在人间界与神界长得一样」变成「同一个界的不同劫长得一样」——
     * 恰好把话反过来说了。
     */
    expect(panel, "劫相要由 plan.kind 决定").toMatch(
      /:terrain="sceneTerrainOfTribulation\(plan\.kind\)"/,
    );
  });

  it("历练页的际遇帖上有这一处地方的画面 —— 光有字不算画面", () => {
    const dialog = readSource("src/components/adventure/EventDialog.vue");
    expect(dialog, "际遇帖要按事件标签画景").toContain("<InkScene");
    /*
     * 景必须读**这一条事件自己的**标签。若写死成某个地形,每一桩际遇都是同一座山 ——
     * 那与抽组件之前的水印是同一个问题,只是换了个位置。
     */
    expect(dialog, "景要由这条事件自己的标签决定").toMatch(/:tags="def\.tags"/);
  });
});
