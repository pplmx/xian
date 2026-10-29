/* oxlint-disable no-console -- 自检脚本的产出就是给人看的报告 */
/**
 * 排版自检 —— 手机尺寸下逐页量一遍「有没有横向溢出」
 *
 * 用法:
 *   bun run build
 *   bunx playwright install chromium  # playwright 已是 devDependency;浏览器缓存在 ~/.cache/ms-playwright
 *   bun scripts/layout-check.mjs      # 加 --shots 顺带存图到 /tmp/layout-shots
 *   bun scripts/layout-check.mjs --jobs 4   # 并发路数;也可用 LAYOUT_JOBS 环境变量
 *
 * 它是**并发**跑的:下面这批自检任务各自开自己的 context、各带自己的存档,互不等待,
 * 由 runPool 按 --jobs / LAYOUT_JOBS / 核数(上限 8)调度。从前它们是同一层里顺序排队的
 * 代码块,一段段等固定时长,一轮约七分钟;拆成任务后本地实测 ~90 秒,--jobs 1 退化回串行。
 * 任务之间只共享一个浏览器与失败清单(后者按固定任务顺序合并,报告与串行时一致)。
 * (这里刻意不写「N 个任务」:任务数每次加一条判据就变,写进注释就是第二个会漂的数。)
 *
 * 它同时在 CI 里跑(见 .github/workflows/deploy.yml 与 build.yml 的 ui-check job):
 * 每个 main 提交与每个发版 tag 都过这一关 —— 判据红则不发布。
 * playwright 写在 devDependencies 里(锁版本):它没有 postinstall,bun install 只带
 * JS 本体;真正占地的浏览器二进制由上面那句按需下,CI 另给它做缓存。
 *
 * 它做这些事:
 *   一 走完真实建号流程(同意隐私 → 命名 → 踏入仙途),拿到一份真存档;
 *   二 在 390×844 / 375×812 / 320×568 三个宽度下,逐页量 scrollWidth 与越界元素,
 *      并核对**外壳本身**没被滚偏(overflow-hidden 的盒子玩家滚不动,浏览器滚得动);
 *   三 把「底部导航五项」「无 pageerror / 无应用 console.error」「控件都有可访问名」「可点元素不小于 28px」也一并核对;
 *   四 把浏览器存储卡死(令 setItem 抛错),看设置页会不会把「写不进去」说出来 ——
 *      静默丢档是玩家看不见的事故,只能靠这一条端到端核。
 *   五 弹窗的 dialog 语义与焦点(进得去 / 困得住 / 关掉还给触发它的按钮);
 *   六 Tab 焦点看得见(全局 :focus-visible 是否有实际轮廓);
 *   七 浮出来的提示条点得掉 —— 它挂着 @click 关掉自己,不能被外框的
 *      pointer-events:none 继承掉(继承了就永远只能等超时)。
 *   八 引擎按概率触发的两扇弹窗(顿悟 / 洞府巡游):把概率钉成必中再量一遍 ——
 *      它们正常巡页碰不到,正是最容易悄悄退回「自己铺一层浮层」的角落。
 *   九 冷启动落在子页时,「返回」要回父页而不是退出游戏(书签 / deep link /
 *      PWA 恢复上次路由都会走到这个处境)。
 *   十 后期档复核:用夹具存档(神人境 + 装备/法宝/器魂/在途秘境 + 隔夜归来)
 *      再巡一遍 —— 空档量不出长数字与满屏内容,而归来卷轴那屏每几天就见一次。
 *   十一 渡劫突破真打一次:结果弹窗必须写清成败与雷数、成功要与页面境界对得上
 *      (每个玩家反复看的那一屏,此前从没被渲染过)。
 *   十二 走完一次转世(寿元将尽 → 此生已矣 → 轮回 → 新的一世):唯一会把存档
 *      推倒重来的仪式,此前一步都没被真浏览器走过。
 *   十三 挂机玩法真的在挂着跑:顶栏灵气只给 1 点,真等两轮看它自己涨不涨 ——
 *      「应用启动后引擎有没有跑起来」只有真浏览器能答。
 *   十四 存档往返:导出 → 投灵脉花掉灵石 → 导入回来,必须回到导出那一刻
 *      (最后一道保险,此前没人按过这两个按钮)。
 *   十五 后期档再走一遍 320 窄屏:「长数字 + 满屏内容 + 最窄屏」这个组合
 *      此前没量过(主巡页的 320 用的是刚建号的空档)。
 *   十六 坏档开局:坏掉一个分片也要进得去,并且说得出「哪一片坏了、原档在哪」。
 *   十七 导出失败也要说话:把浏览器的下载能力打断再点一次「导出存档」。
 *   十八 切后台/离开页面时,待刷的存档要立刻落盘(visibilitychange / pagehide)。
 *   十九 真打一场历练战斗:战报回放要出内容、结语要写清胜负、战斗分析点得开。
 *   二十 背包里的账目:强化写着扣多少尘就扣多少,分解说给多少尘就给多少。
 *   二十一 闭关期间不许历练:点出发要当场拦下(不开模式窗),换页回来闭关还在。
 *   二十二 减少动效真的减到了(并顺带在音效开着的情况下点一路按钮)。
 *   二十三 洞府营造的账目:卡片写多少石就扣多少石。
 *   二十四 法宝炼化的两笔账:按钮上两种代价都得写全,且两种都按所写扣。
 *   二十五 一键分解要「先勾后点」:勾品质只是标记,行囊里的东西须点「分 解」才化尘。
 *   二十六 智能收纳不替玩家扔「有投入的件」:练过/成套/近满的三件必须留下。
 *   二十七 顶栏底栏钉死:滚一遍窗口,两栏一步都不许动,文档层不许有纵向可滚余量。
 *      外加一条构建产物判据:外壳高度得认 dvh —— 无头浏览器的 100vh 恰好等于可视
 *      高度,把外壳换回 vh 它照样全绿,只有查产物这一条拦得住。
 *   二十八 页签栏吸顶:背包四册、图鉴、名号、界域志、天界、坊市的页签栏,滚过之后要贴在
 *      内容区顶、且铺满内容区宽度(空档滚不动,判据自己往容器里垫占位造余量)。
 *   二十九 不是手机竖屏的两档:横屏 844×390 与桌面 1280×800 也各巡一遍全量路由 ——
 *      自适应断点(高度 short:、大屏的册页留白)就在这两档上现形。
 *   三十 顶栏不许折行:数字断行看着像乱码,顶栏还会从 46px 涨到 58px(320 宽复发过)。
 *   三十一 iOS 存档风险提示:该出现的平台出现(且关掉就真不再出现),不该出现的平台
 *      一个字都不说 —— 桌面/安卓用应用自己的存储,在那儿喊「iOS 会清掉存档」是胡说。
 *   三十二 楷体统一:构建产物里内置字体必须排在字体栈第一位(系统楷体留作兜底),
 *      并且真渲染时楷体文字确实由它画出来(字体文件坏了、404 了都在这儿现形)。
 *   三十三 地界卡不许挤压:名字必须单行,头部与操作块不许相交。夹具里备了镇压中、
 *      临期复聚、已取得资格三态 —— 从前夹具一个镇压区域都没有,于是「自动产出」
 *      把地界名压成竖排的事故全绿通过(横向溢出量不到挤压:卡片没溢出,只是挤)。
 *   三十四 四条通用挤压判据,全页面生效:①文字被挤成竖排(宽 < 40px 且折成 3 行以上);
 *      ②数字与量词被换行拆开(「2,798 石」不许变成「2,798 / 石」);③标点被折成孤字(见三十五);
 *      ④纯文字按钮的标签被折行(见四十四)。它们都是「卡片没溢出、只是挤」这一类,
 *      横向溢出永远查不出来。
 *   三十五 标点不许被折成孤字:模板里把标点另起一行写(HTML 会把换行折成空格),
 *      窄屏上句号就会独自占一行 —— 量的是渲染结果,比在源码里认标点准。
 *   三十六 敌人卡最挤的一档:名字最长 9 字 + 满标签(首领/宿敌/3 特性)+ 星级。
 *      巡页用的档里敌人名字都短、认知层为 0(特性根本不显示),这一档从前没被量过。
 *   三十七 新手第一步卡:刚建号的人落在首页时,这张卡要在、要指向历练、要够高 ——
 *      它把「目标 / 主线 / 每日」三块串成一条线,并递出第一个入口(见 core/firstStep)。
 *   三十八 妖气复聚那一行:旧主归来的旧地界要画出「妖气复聚」、要写清"再历一程即可复靖"、
 *      还要有「出发」(见 core/regionRevival)—— 它是这条世界节律唯一的可见面。
 *   三十九 主值行不许折行:带 `data-value-row` 的「标签 + 值」行,右边那一块必须一行放得下。
 *      起因是一次实测反馈:修炼页的灵气行把「积余 X / Y」这类**次要读数**留在主行里,
 *      窄屏后期档上整块被顶到第二行(卡片没溢出、字也没被挤成竖排,前面所有判据都量不出来)。
 *      次要读数该去哪儿:点开的详情里;主行只留「看得懂的那一位」。
 *   四十 正文字对比度 ≥AA:逐个带文本的元素,把祖先链上的背景层(含压在这块字下面的
 *      绝对定位层,如页签的墨块)按 alpha 合成出真实的底,再算 WCAG 比值 —— 大字 3:1、
 *      其余 4.5:1。**两套主题都量**:夜间主题的卡片比页面底色亮,浅色的字放上去最难。
 *      它与调色板本体那套算法(src/ui/palette.spec.ts)是互补的:那边管色号,这边管
 *      「半透明的字」与「带底色的方块」这两件只有真浏览器算得准的事。
 *   四十一 两百档字号(200% 缩放)不许横向溢出、主值行不许折:390 宽的机型按 200%
 *      放大后,布局视口只剩 195 CSS px —— 与五档视口是两回事(量的是缩放档,不是宽度档)。
 *      起因:此前只守 320 这一档,而 390 的真机放大到 200% 比 320 还窄 125px,修炼页的
 *      修为行就是在那一档被顶成两行的。量法与巡页共用 measurePage(同一把尺子)。
 *      空档之外还有一遍**后期档**(神人境的九位数灵石、成套装备、在途秘境):
 *      195 宽上最容易出事的是「长数字 + 满屏内容」,而主巡页那一遍量的是刚建号的空档。
 *      只在某一步出现的浮层(归来卷轴 / 渡劫结果 / 转世三步 / 引擎掷中的顿悟与巡游)
 *      另走 measureDialogZoom:巡页前的 clearOverlays 会把它们收掉,缩放档那一遍
 *      一页都碰不到 —— 归来卷轴就是这么一路绿着的。
 *   四十二 渐变/图片底上的正文对比度:上面那条只算得到**声明出来的色号** —— 法球、
 *      印章、纸纹、以及半透明的纸叠在深色天幕上,真实像素比色号暗一截,那条量不到。
 *      故这里直接采样屏幕像素:把文字临时藏起来拍一张,逐像素算「这枚字落在这一像素上
 *      读不读得出来」,读不出来的像素超过两成就报红。
 *      滚到中段时,页签栏会按设计盖住已经滚到它下面的标题;采样只取主滚动区里真正露出
 *      的那一截,不把被吸顶栏盖住的文字当成「屏幕上的字」。
 *   四十三 28px 触达下限的量法要确定:1280×800 的 /adventure 上报过一次「28px」的红,
 *      四舍五入后正好等于下限,实际是 27.6px 的子像素抖动,而那个按钮声明的是
 *      min-h-[28px]。一条会自己变红的门比没有门更糟,故四处量 28px 的地方统一:声明的
 *      min-height 到了 28 的给半像素容差,报数带一位小数(不再四舍五入到与下限同值)。
 *   四十四 按钮标签不许被折行:纯文字按钮(无子元素、2~18 字)的文字必须落在一行。
 *      实见界域志「问 卦(悟道点 2)」被右侧长注挤成「问 卦(悟道」/「点 2)」—— 门槛数字
 *      拦腰折断。根因又是一行不换行的 flex,横向溢出与前面几条挤压判据都量不出来。
 *   四十五 秘境卡「在境中」的窄屏一档:320 宽 + 本层预览(本层劫 / 胜算 / 战利)+ 三枚层点。
 *      这一行从前整段 nowrap,320 上必顶出卡片 —— 而巡页用的档里没有在途秘境,
 *      三十三 那份 320 夹具的 adventure 切片也没有 secretRealm,于是这一档从没被量过。
 *      夹具直接摆出「打到第二层」的状态,判据走通用那套(横向溢出 + 挤压)。
 *   四十六 开局前两页(欢迎 / 建号):它们是唯二**没有存档才看得见**的页面 ——
 *      路由守卫见存档已开就把 #/welcome、#/create 重定向回首页,所以巡页 ROUTES
 *      永远巡不到它们(硬塞进 ROUTES 只会把首页重复量一遍)。故另开一个无存档的
 *      context:先量欢迎页,再走「开始游戏 → 同意并开始」落到建号页量一遍。
 *      只查基础档(横向溢出 / 外壳偏移 / 越界元素 / 无名控件 / 可点过小 / 正文对比度),
 *      不查底部导航项数 —— 这两页本来就没有导航(开局前不该有)。
 *      两页也各过一遍 200% 缩放档:实测欢迎页在 195 宽下把「开 始 游 戏」折成两行、
 *      把三枚底链压成 25px 宽的四字竖排 —— 而这是玩家看到的第一屏。
 *   四十七 浮层在 200% 缩放档:页面上点得开的那几扇(装备详情 / 丹房 / 器魂 / 灵脉)
 *      另起一个任务,在 195×422 里逐扇点开量一遍。巡页不会去点它们,缩放档那一遍
 *      自然也碰不到 —— 实测丹房方子卡三列并排时中间只剩 42px(代价折成六行),
 *      器魂详情的「收 起 / 卸 下」各剩 68px、在空格处断成两行。这两类都不是溢出,
 *      横向溢出与越界元素都量不出来。尺子与「只在某一步出现的浮层」共用一份。
 *   四十九 第二个标签页的只读态:多标签共用一份存档时,后来的那页不启引擎、不写盘
 *      (判据在 core/singleWriter 与 utils/storage 的单测里)。但「不写」对玩家是不可见的 ——
 *      数字不动、点了没反应,而解释只有一条三秒就消失的 toast。故这里另开一个 context
 *      开两页:先开的那页不许有横幅,后开的那页**必须有**一条常驻说明。横幅是朱砂 6% 的
 *      自底,故按四档量 —— 390 与 195(200% 缩放)× 日间 / 夜间:不裁字、不撑出横向溢出;
 *      另跑一次像素对比度(measureTextContrast 自己翻两套主题)。这页不巡游(它是另一条
 *      上下文里的第二页),巡页永远碰不到。
 *   四十八 底部导航的「当前位置」也要量:颜色与那枚朱砂短笔只对眼睛说话,读屏拿到的是
 *      RouterLink 按 exact-active 自己渲染的 aria-current=page —— 这一条先把「它真的在、
 *      且指向当前路由」量一遍:换手写 <a>、或哪个页签的 to 写歪,当场就红。
 *      判据逐页点一次 aria-current=page —— 恰有一枚、且指向当前路由;不在五个页签上时
 *      (market / settings 等)一枚都不许有。源码级那条在 uiLayering.spec 里先拦一道。
 *   五十 修行页的丹药速服只铺前四味。第五味起必须报「另有 N 味」,并能一键落到背包的
 *      丹药页签 —— 只截断不交代,玩家会以为丹匣里只剩四味;直达链接若落回装备页,
 *      这条入口也只是换了个地方继续藏。
 *   五十一 构筑对照不许只给最近八则道痕。余量要报数、可续开,续开后的焦点要送到
 *      新露出的第一则;第九则以前的旧构筑还要真能点开对照 —— 只多一行字、点不动
 *      仍是断头路。
 *   五十二 修仙录的历世履历与行迹录都要能回头。履历再长也只铺当前窗,续开与回翻都要
 *      把焦点送到新页首则;行迹录不再用「仅列最近八则」封死旧回响。两处都在 195 宽
 *      下量续开入口与整页排版。
 *   五十三 道侣弹窗的「历世同行」按最近一世在前分批铺开。履历没有上限,不能把整部
 *      旧缘一次塞进固定滚动框;续开、滑窗、回翻与焦点都要真走通,且 195 宽下能读。
 *   五十四 器魂页的两册(散置形意 / 凝炼台)同样没有数量上限。两册都按价值降序先摆
 *      一批,续开、滑窗、回翻与焦点走同一套长列表规则;195 宽下入口与整扇弹窗都要能读。
 *   五十五 名号与灵兽两册共 69 条也要分批回看。当前相伴必须压过品阶排在第一,
 *      不能藏在同品阶之后;续开、滑窗、回翻与焦点同上一套,195 宽下整页仍可读。
 *   五十六 部位候选按 12 件一批、最多留 24 件。300 件后期背包里同槽仍有几十件,
 *      续开与回翻必须真的可达;换装后佩戴件跳到顶部,窗口要回首批并把焦点送过去。
 *      195 宽下另把候选续到第二批,量分页读数、入口与候选行是否被挤坏。
 *   五十七 法宝全册共 45 张密卡,按 6 件一批、最多留 12 件。195 宽下逐批翻到末页
 *      再回翻,随身 / 炼化改序后焦点仍要跟住同一件;整页不许被双按钮或代价行挤坏。
 *   五十八 开炉丹方共 54 张,按 6 张一批、最多留 12 张。搜索换词要重置窗口且不抢
 *      输入焦点;195 宽下逐批翻到末页再回翻,炼制耗料改序后焦点仍要跟住同一张方。
 *   五十九 词条转移的候选是整包装备的横切面:无部位限制的词条能落到全部藏品上。
 *      195 宽下按 12 件一批、最多留 24 件逐批翻到末页再回翻,续开焦点跟住新批;
 *      候选行、件数读数与两枚入口都不许把详情弹窗挤坏。
 *   六十 修行页主 / 辅 / 秘三册终局共 66 部。每门按 12 部一批、最多留 24 部,
 *      195 宽下逐门翻到末页再回翻;换门回首批、焦点留在页签,卸下辅修改序后
 *      详情关闭仍能把焦点还给同一部。
 *   六十一 天界道痕满卷 60 则。道途册与道痕册必须互斥,marks 深链要真的落到履历;
 *      每 12 则一批、最多留 24 则,195 宽下逐批翻到末页再回翻,焦点跟住新批首则。
 *      每行的忆战 / 重写 / 旧纪入口也受 28px 触控下限约束。
 *   六十二 前尘山河三世同册:世界页默认只有当前世界,历史册在空档与后期档里
 *      都不会出现。夹具另造三世旧世界,在 320 与 195(200% 缩放档)下量历史行:
 *      三世都在、顺序由近及远、世界名/段数来自同一份世界视图,标题不截断、行不越界。
 *   六十三 历练首屏的主线优先:未入秘境时整张秘境卡只露一行,「历练」标题先于
 *      支线;390 首屏里第一处地界的「出发」要完整露出,不能被支线卡推到折线以下。
 *   六十四 洞府首屏的营造优先:营造排在家业入口之前,建筑卡默认只露当前效果、
 *      下一级变化与主升级键;390 首屏里第一枚可用的升级/建造键要在底栏以上,
 *      完整效果与连升账由 aria-expanded 详情展开。
 *   六十五 界域志首屏的此刻优先:当前境、全路序号与前后境要先落在折线内;
 *      四界卷目默认只开当前界,其余收口,点开后要真的铺出该界境界。
 *   六十六 成就谱首屏的眼下可追:卷首先列最近三枚并写明条件/进度;方向卷目
 *      默认只开最近一路,点最近一枚或换一路时要真的展开目标卷。
 *   六十七 藏珍谱首屏的新得优先:卷首先报整体收录与新得/将满册目;有新得的册
 *      最多先展开三册,其余收着。点卷首册目或册目题头时,目标册要真的铺出来。
 *   六十八 背包先报新得与可换槽位:整册先列本次新得,「只看新得」只铺新件;
 *      一键按钮报的可动槽数必须与卷首逐槽入口一致,点下去正好全部换完。
 *      195 宽下新得卷首、分页入口与从可动槽打开的候选弹窗都不许被挤坏。
 *   六十九 门庭先报今日:在途 / 闲置 / 最近归期来自同一份弟子汇总;在途差事
 *      要有可见进度与读屏进度值。一键派发后卷首与按钮必须同步换口。
 *
 * 判据是「横向溢出」这一类——它正是窄屏上最常见的排版事故。
 * 说明:这是无头 Chromium 的视口模拟,不是真机;字体渲染与安全区(刘海/手势条)
 * 仍需真机确认,故本脚本过绿不等于真机过绿。
 *
 * 并发不是「把等待摞在一起」:所有量测都把固定 waitForTimeout 换成了确定性等待
 * (等动画收敛 settleVisuals、等弹窗出现/撤下、巡页前 clearOverlays 钉死随机事件),
 * 否则机器一忙,「等了 300ms」就不再等于「已经就位」,门会在真回归之外自己变红。
 */
import { chromium } from "playwright";
import { createServer as createViteServer } from "vite";
import { blockExternal, watchPageErrors } from "./lib/pageErrors.mjs";
import {
  decryptSlice,
  encryptSlice,
  FULL_MARKS_COUNT,
  makeFullMarks,
  seedSave,
  showcaseSlices,
} from "./lib/saveFixture.mjs";
import { TITLES } from "../src/data/titles.ts";
import { PETS } from "../src/data/pets.ts";
import { EQUIPMENT_TEMPLATES } from "../src/data/equipment.ts";
import { EVENTS } from "../src/data/events.ts";
import { GONGFA } from "../src/data/gongfa.ts";
import { qualityDef } from "../src/data/qualities.ts";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { cpus } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = `file://${join(ROOT, "dist/index.html")}`;
const SHOTS_DIR = "/tmp/layout-shots";
const SHOTS = process.argv.includes("--shots");

const VIEWPORTS = [
  // 390×844 = iPhone 12/13/14/15 的标称宽度,当下最常见的一档;
  // 375/320 是旧机型与极窄档。三档一起量,免得只守住了其中一档。
  // dpr 只影响截图栅格化(1px 边框、字体抗锯齿),不影响 CSS 布局与判据 ——
  // 但 --shots 存下来的图因此更接近真机看到的密度,便于人眼复核。
  { width: 390, height: 844, tag: "390", dpr: 3 },
  { width: 375, height: 812, tag: "375", dpr: 3 },
  { width: 320, height: 568, tag: "320", dpr: 2 },
  // 两档「不是手机竖屏」的设备。它们各自暴露过一类毛病,故各占一档:
  //   横屏 844×390 —— 上下两栏吃掉 22% 的高度(改前 26%),而宽度只用掉一半;
  //   桌面 1280×800 —— 窄栏顶天立地;不在大屏上收成一册,它就只是一条带子。
  // 安卓壳与桌面客户端都能转到这两档;PWA manifest 锁了竖屏,浏览器里随意缩窗。
  { width: 844, height: 390, tag: "844x390", dpr: 2 },
  { width: 1280, height: 800, tag: "1280x800", dpr: 1 },
];
/**
 * 全量路由 —— 从前只巡八页,于是设置页与收藏页的排版与选中态从未被量过。
 * 页面各有各的布局风险,漏一页等于那一页没有守卫(加进来只多几秒)。
 *
 * 没有列 /welcome 与 /create:这两页是**开局前**的状态,路由守卫见存档已开就把它们
 * 重定向回首页(router/index.ts 的 beforeEach)—— 巡页带着真存档,导航过去量到的
 * 只会是首页,硬塞进来等于空转。它们由「开局前两页」任务(四十六)守着:
 * 那边开一个无存档的新 context,这两页才真的被渲染出来。
 */
const ROUTES = [
  "/",
  "/cultivation",
  "/adventure",
  "/inventory",
  "/character",
  "/codex",
  "/souls",
  "/titles",
  "/settings",
  "/build",
  "/collection",
  "/legacy",
  "/dongfu",
  "/world",
  "/celestial",
  "/market",
  "/apprentice",
];

const browser = await chromium.launch({
  args: ["--allow-file-access-from-files", "--disable-web-security"],
});

/**
 * 建"我们自己的"上下文 —— **外域请求一律拦掉**。
 *
 * 为什么放在 context 层:逐个建页点去挂是漏得起的活 —— 实测漏一处就够让门在 CI 里红。
 * 那一次红在"坏档也能进游戏"那个场景:它的页面由 `ctx.newPage()` 建出来,没被拦住,
 * 于是 CI 有网时它真的去加载,`goto(waitUntil: 'load')` 等它等到 30 秒超时。
 * 现在那个脚本已经删掉(不接入任何第三方),这条拦截反过来成了「零外部请求」的量尺。
 * 挂在 context 上,该上下文里**所有**页面(含后续新建的)自动覆盖。
 */
const blockedGetters = [];
async function auditContext(options) {
  const ctx = await browser.newContext(options);
  blockedGetters.push(await blockExternal(ctx));
  return ctx;
}
const blockedTotal = () => blockedGetters.reduce((n, get) => n + get(), 0);
/** 全局失败与计数:各任务跑完按固定顺序并进来(每个任务内部另有自己的同名影子变量) */
const failures = [];
let checked = 0;
/** 量到过多少个 data-value-row —— 用来防这条判据"空转"(契约被删掉后依然全绿)。 */
let valueRowsSeen = 0;
/** 「按钮语义宿主」扫到过几枚 —— 控件套控件那条判据的活信号(0 = 空转) */
let controlHostsSeen = 0;
/** 200% 缩放档量过几页、采样像素量过几处字 —— 同样防判据空转 */
let zoomSeen = 0;
let pixelTextsSeen = 0;
/** 拦掉的外域请求数 —— 打印出来,顺带证明这条拦截是活的 */
// 外域请求拦截:计数在 context 层累积,收尾打印(见 auditContext)

/**
 * 弹窗**里面**的控件也要过页面上那两条尺子:有可访问名、不小于 28px。
 *
 * 逐页巡的那一遍只量得到页面上摆着的东西 —— 弹窗没打开就不存在,于是这两条
 * 判据一直没有覆盖弹窗内部。实测漏掉的有:共享的关闭键(一枚图标、无名、
 * 内外边距加起来 26px,每个弹窗都有它)、纯文字按钮「立契」(18px)、
 * 行内链接(命中区只有字体那 14px)。故这里量弹窗自己。
 */
async function auditModalControls(page) {
  return page.evaluate(() => {
    // 测量标准化与 measurePage 同一口径:弹窗的入场过渡(page-fade/modal 过渡)
    // 进行中量几何,量到的是动画中间帧 —— 「进入前请确认」弹窗里的《隐私政策》
    // 按钮(块级 flex + min-h 28px)曾在 1280×800 档被量出 26.3px,三档视口反复
    // 假红;600ms 墙钟等待只压得住 390 档,桌面档的过渡调度仍会撞上中间帧。
    // 注入动画禁令后量的是稳态布局,与截图口径一致。
    const st = document.createElement("style");
    st.textContent = "*,*::before,*::after{animation:none!important;transition:none!important}";
    document.head.appendChild(st);
    const panel = document.querySelector(".modal-panel");
    if (!panel) return null;
    const rows = [...panel.querySelectorAll("button, a, [role=button]")]
      .map((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const num = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);
        const minH = num(cs.minHeight);
        const minW = num(cs.minWidth);
        return {
          name: (el.getAttribute("aria-label") || el.textContent || "")
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, 14),
          w: Math.round(r.width * 10) / 10,
          h: Math.round(r.height * 10) / 10,
          cls: (el.className || "").toString().slice(0, 70),
          // 与巡页那条同一把尺子(28×28 两个轴,声明了 min-* 的给半像素容差)
          ok:
            (r.width >= 28 || (minW >= 28 && r.width >= 27.5)) &&
            (r.height >= 28 || (minH >= 28 && r.height >= 27.5)),
        };
      })
      .filter((r) => r.w > 0 && r.h > 0);
    return {
      count: rows.length,
      // 对话框自己也得有个名字:读屏遇到 role=dialog 要念得出是哪一扇
      label: (
        panel.getAttribute("aria-label") ||
        panel.querySelector("h3")?.textContent ||
        ""
      ).trim(),
      unnamed: rows.filter((r) => !r.name).map((r) => `${r.w}×${r.h}px`),
      small: rows
        .filter((r) => !r.ok)
        .map((r) => `${r.w}×${r.h}px«${r.name || "无名"}» [${r.cls}]`),
    };
  });
}

/**
 * 把取景收拾干净:收掉提示条、钉死随机事件、关掉已经浮上来的弹窗。
 *
 * 由来:弹窗焦点场景三次偶发假红,真凶每次都是引擎随机浮上来的「悟道顿悟」——
 * 它是一整层遮罩,点它盖着的入口自然点不动。只钉 Math.random 不够:
 * 引擎每秒一拍,从「踏入仙途」到这条场景动手之间已经够它掷出一次了。
 */
async function clearOverlays(page) {
  await page.evaluate(() => {
    for (const b of document.querySelectorAll(".pointer-events-none.fixed button")) b.click();
    Math.random = () => 1;
  });
  /*
   * 关掉**已经浮起来**的浮层,并且等够一轮。
   *
   * 坑在这里:引擎掷出顿悟(每秒一拍)与弹窗自己每秒一次的轮询是两个独立定时器,
   * 事件已经产生、窗还没画出来 —— 这时数 .modal-panel 是 0,当场就收工,
   * 一秒后那扇窗才浮上来,正好盖住要点的入口。故这里固定转六圈(≈2.1 秒):
   * 有窗就按 Esc 收掉,没窗就等着 —— 反正随机源已钉死,等到的只会是**之前那一扇**。
   */
  for (let i = 0; i < 6; i += 1) {
    if ((await page.locator(".modal-panel").count()) > 0) await page.keyboard.press("Escape");
    await page.waitForTimeout(350);
  }
  return page.evaluate(() =>
    [...document.querySelectorAll(".modal-panel")].map((p) =>
      (p.querySelector("h3")?.textContent || p.getAttribute("aria-label") || "?").trim(),
    ),
  );
}

/** 把 formatGN 渲染出来的文本还原成数值(万/亿/兆…按 10^4 递进) */
async function readFormatted(page, title) {
  return page.evaluate((t) => {
    const el = document.querySelector(`[title="${t}"]`);
    if (!el) return { text: `(找不到 ${t})`, value: null };
    const text = (el.textContent || "").trim().replace(/,/g, "");
    const UNITS = ["万", "亿", "兆", "京", "垓", "秭", "穰", "沟", "涧", "正", "载", "极"];
    const m = /([\d][\d]*(?:\.\d+)?)\s*(万|亿|兆|京|垓|秭|穰|沟|涧|正|载|极)?/.exec(text);
    if (!m) return { text, value: null };
    const unit = m[2] ? Math.pow(10, 4 * (UNITS.indexOf(m[2]) + 1)) : 1;
    return { text, value: parseFloat(m[1]) * unit };
  }, title);
}

/**
 * 一页一量:横向溢出、外壳偏移、越界元素、无名控件、按不动的假按钮、过小可点元素、选择组选中态、底部导航项数。
 *
 * 抽成函数是为了让**后期档**那一遍复用同一把尺子 —— 空档量不出长数字与满屏内容,
 * 而两遍若各写一份判据,迟早会分叉成两套标准。
 */
/**
 * 等这一页的视觉安定下来:两帧 + 所有「有限」动画/过渡跑到终点。
 *
 * 自检读的是「此刻的渲染」,而页面带入场动画(stagger-in / page-fade)与主题色过渡 ——
 * 从前靠固定的 200~700ms 等待顶着,串行时够用;并发之后机器一忙,那几百毫秒就不再
 * 等于「动画跑完」,量到的是半途的帧:页签吸顶偏 1~2px、夜间对比度量到过渡中的色。
 * 这里不再赌时长,直接等动画本身收敛。只等有限动画 —— 云雾那类 infinite 的永不停,
 * 等它等于挂死(它们的位置由截图时的 animations:"disabled" 冻结,与这里各管一段)。
 */
async function settleVisuals(page) {
  await page.evaluate(async () => {
    // 先让这一帧的样式变更落地,过渡才会被 getAnimations 看见
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const runs = document.getAnimations().filter((a) => {
      const t = a.effect?.getComputedTiming?.();
      return !t || t.iterations !== Infinity;
    });
    await Promise.all(runs.map((a) => a.finished.catch(() => {})));
  });
}

/**
 * 主题探针期间冻结 CSS 过渡。
 *
 * 量对比度要的是「换肤之后」的稳定态,而 transition-colors 会让前景与背景在半途
 * 同时向对方靠拢 —— 中间那几帧两边都灰,量出来必然是假红(实测:并发/截图负载下,
 * 无论固定等 260ms 还是等 settle,夜间导航都读到过 2.5:1)。
 * 冻住之后换肤瞬时完成,读到的一直是端点态。探针跑完即摘,不留痕迹。
 */
const FREEZE_TRANSITION_CSS = "*, *::before, *::after { transition: none !important; }";
async function freezeTransitions(page) {
  await page.evaluate((css) => {
    const s = document.createElement("style");
    s.dataset.lcFreeze = "1";
    s.textContent = css;
    document.head.appendChild(s);
  }, FREEZE_TRANSITION_CSS);
}
async function unfreezeTransitions(page) {
  await page.evaluate(() => {
    for (const s of document.querySelectorAll("style[data-lc-freeze]")) s.remove();
  });
}

/**
 * 量对比度前把浮层清干净。
 *
 * 引擎事件弹窗的遮罩(墨 45%)与成就提示条都压在被量的字上面 —— 遮罩会改写整页的底,
 * 提示条会盖住页眉那一行,量出来全是假红。巡页前虽然钉了随机源(clearOverlays),
 * 但**成就**是按状态判定的:切到某一页正好达成一条,照样弹,与随机无关。
 * 故每次量之前现清一遍:点掉提示条、Esc 收掉弹窗,直到两样都没有(最多转四圈)。
 */
async function quiesceOverlays(page) {
  for (let i = 0; i < 4; i += 1) {
    const left = await page.evaluate(() => {
      const toasts = [...document.querySelectorAll(".pointer-events-none.fixed button")];
      for (const b of toasts) b.click();
      return { toasts: toasts.length, modal: document.querySelectorAll(".modal-panel").length };
    });
    if (left.modal > 0) await page.keyboard.press("Escape");
    if (left.toasts === 0 && left.modal === 0) return;
    await page.waitForTimeout(150);
  }
}

async function measurePage(page) {
  return page.evaluate(() => {
    // 测量标准化:入场动画(stagger-in 的位移、breathe 的缩放)进行中量几何,
    // 量到的是动画中间帧 —— /create 的灵根圆环曾在 stagger 中段被量出左右各越 5px。
    // 截图有 animations:"disabled",测量也必须同一口径:测的是稳态布局,不是中间帧。
    // (减动效自检在独立 ctx 按 duration/iteration 量,不受这条注入影响。)
    const st = document.createElement("style");
    st.textContent = "*,*::before,*::after{animation:none!important;transition:none!important}";
    document.head.appendChild(st);
    const vw = window.innerWidth;
    const overflows = [...document.querySelectorAll("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        // 越界=右缘冲出右界 或 左缘冲出左界(r.left < -1)。之前只查右缘:
        // 一个被推离**左**缘的块(负 left / -mx-*)只要右缘仍落在视口内,
        // scrollWidth 不涨、r.right 也不超,横向溢出判据整条失灵。
        const rightOver = r.right > vw + 2;
        const leftOver = r.left < -1;
        if (r.width <= 0 || (!rightOver && !leftOver)) return false;
        /*
         * 纯装饰层(墨爆 / 传送门 / 法球的三层旋转环)故意越过视口边缘,且不吃事件,不算排版事故。
         *
         * 判据看的是**计算后的 pointer-events**,不是类名 —— 组件里关掉事件用的是自定义类
         * (如 `.ring-layer`),按类名找 `.pointer-events-none` 会漏掉它们;而旋转中的方形盒子
         * 其 `getBoundingClientRect()` 会随动画相位涨到 √2 倍,于是同一处装饰一会儿过、一会儿不过
         * —— 那是量法在抖,不是排版在坏(曾让 v1.34.0 的发版流水线红在 375px 首页上)。
         */
        for (let node = el; node; node = node.parentElement) {
          if (getComputedStyle(node).pointerEvents === "none") return false;
        }
        /*
         * 横向滚动轨里的内容**本来就该**超出取景 —— 容器自己负责滚,玩家滚得到。
         * 320-late 的坊市寄售候选行(overflow-x-auto + shrink-0 的候选牌)第一次把
         * 这一族带进判据:牌在轨内越界是设计,不是排版事故。只豁免 auto/scroll,
         * 不豁免 overflow-hidden(外壳那层 hidden 恰恰是「玩家滚不动」的事故层)。
         */
        for (let node = el.parentElement; node; node = node.parentElement) {
          const s = getComputedStyle(node);
          if (s.overflowX === "auto" || s.overflowX === "scroll") return false;
        }
        return true;
      })
      .slice(0, 4)
      .map((el) => {
        const r = el.getBoundingClientRect();
        const side = r.left < -1 ? "L" : r.right > vw + 2 ? "R" : "?";
        return `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}@${side}${Math.round(r.left)}..${Math.round(r.right)}`;
      });
    return {
      hash: location.hash,
      /** 这一页上有几个"主值行"(显式契约 data-value-row)—— 用于防空转 */
      valueRowCount: document.querySelectorAll("[data-value-row]").length,
      horizontalOverflow: document.documentElement.scrollWidth > vw + 1,
      /**
       * 外壳(#app 的第一层)不能被滚偏,也不该有可滚的横向余量。
       *
       * 它是 overflow-hidden 的:玩家滚不动,但**浏览器滚得动**。
       * 云雾装饰故意越界画出盒子(左上 -64px、右下 -96px),曾把外壳撑到
       * scrollWidth 516 vs clientWidth 390;建号结束时浏览器顺手把 scrollLeft
       * 设成 24,此后整个界面永久左移 24px —— 顶栏名字被切掉左半边、底部
       * 第一栏「洞府」只剩半个字。而「查 documentElement 有没有横向溢出」查不出
       * 这件事:overflow-hidden 把子元素的溢出挡在外壳以内,量在最外层永远是绿的。
       * 故这里直接量外壳自己:scrollLeft 必须为 0,且不该有横向可滚区间。
       */
      shellShift: (() => {
        const shell = document.getElementById("app")?.firstElementChild;
        if (!shell) return null;
        return {
          scrollLeft: Math.round(shell.scrollLeft),
          overflowX: Math.round(shell.scrollWidth - shell.clientWidth),
        };
      })(),
      /**
       * 主内容区自己的横向余量。
       *
       * main 是 overflow-x-hidden:被 nowrap 撑宽的子元素仍可能把滚动区的 scrollWidth
       * 撑大,而它自己的盒子与子元素矩形都还在视口内,横向溢出与越界元素量不出来。
       * 直到 focus() 把 scrollLeft 推走,整页才突然左移。修行页的闭关按钮就是这么
       * 一路绿到功法详情打开:按钮 127px、内容 214px,main.scrollLeft 随即变成 17px。
       */
      contentShift: (() => {
        const main = document.querySelector("main");
        if (!main) return null;
        return {
          scrollLeft: Math.round(main.scrollLeft),
          scrollWidth: Math.round(main.scrollWidth),
          clientWidth: Math.round(main.clientWidth),
          overflowX: Math.round(main.scrollWidth - main.clientWidth),
        };
      })(),
      overflows,
      navItems: document.querySelectorAll("nav button, nav a").length,
      /**
       * 底栏标出来的「当前在哪一页」—— 读屏靠 aria-current,不靠颜色与那枚朱砂短笔。
       * 取的是 href 而不是文字:文字可以重名(以后多一枚「洞府」入口也不会误判)。
       */
      navCurrent: [...document.querySelectorAll("nav [aria-current='page']")].map((el) =>
        String(el.getAttribute("href") || "").replace(/^#/, ""),
      ),
      /**
       * 只有图标的控件必须自带可访问名(aria-label / 可见文字)。
       * 没有名字,读屏只会念「按钮」「链接」,自动化也无从按名字点它。
       */
      unnamed: [...document.querySelectorAll("button, a, [role=button]")]
        .filter((el) => {
          const name = (el.getAttribute("aria-label") || el.textContent || "").trim();
          if (name) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        })
        .slice(0, 3)
        .map((el) => el.outerHTML.slice(0, 80).replace(/\s+/g, " ")),
      /**
       * 声明了按钮语义、却按不动的控件 —— 「念出来是个按钮,按下去没反应」。
       *
       * 由来:器魂页的空槽位无论有没有器魂都挂着 role=button,tabindex 却给到
       * 空槽 -1,aria-label 写着「空」。读屏于是播报一个按钮,而点它只是把
       * soulDetail 赋成 null —— 弹窗连开都不开。声明了 affordance 却不给操作,
       * 比不声明更坏:人会以为自己漏做了什么。
       *
       * 判据(逐条排除误报):
       *   role=tab 不判 —— roving tabindex(选中 0、其余 -1)是规范要求的模式;
       *   原生 <button disabled> / aria-disabled=true 不判 —— 那是「置灰」,
       *     读屏会念出禁用原因,不是假按钮(置灰要列差量另有判据在别处守);
       *   <a href> 只在 tabindex=-1 时判 —— 链接不挂 tabindex 本就可达;
       *   [role=button] 与自绘 <button> 缺 tabindex(=null)或 -1 都判 ——
       *     div 上的 role=button 没有 tabindex 就是键盘进不去、也进不了 Tab 序。
       * 只管**看得见**的(零盒子不算),截图外的东西读屏也念不到。
       */
      deadControls: [...document.querySelectorAll("button, [role=button], a[href]")]
        .filter((el) => {
          if (el.getAttribute("role") === "tab") return false;
          if (el.hasAttribute("disabled")) return false;
          if (el.getAttribute("aria-disabled") === "true") return false;
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) return false;
          const ti = el.getAttribute("tabindex");
          if (el.tagName === "A") return ti === "-1";
          if (el.getAttribute("role") === "button") return ti === null || ti === "-1";
          if (el.tagName === "BUTTON") return ti === "-1";
          return false;
        })
        .slice(0, 3)
        .map(
          (el) =>
            `${el.tagName.toLowerCase()}${el.getAttribute("role") ? `[role=${el.getAttribute("role")}]` : ""}` +
            ` tabindex=${el.getAttribute("tabindex") ?? "—"} ` +
            `«${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 12)}» ` +
            `[${(el.className || "").toString().slice(0, 40)}]`,
        ),
      /**
       * 控件里套控件 —— 读屏听到的「一个按钮」与手上按得动的「两个按钮」对不上。
       *
       * 由来:器魂槽位整卡是 role=button 的 div,里面又嵌着「卸下」<button>。
       * CDP 读出的无障碍树真把它画成 button ⊃ button。ARIA 里 button 带
       * **Children Presentational: True**(WAI-ARIA 1.3 的角色模型;ACT 规则 307n5z
       * 「presentational children 的元件不许有可聚焦内容」)—— 读屏本应把里面的内容
       * 压平成一段文字,那个「卸下」在 VoiceOver / TalkBack 上就可能根本不可达,
       * 而本作是移动端优先的放置游戏。Chrome 肯把它露出来不等于别的读屏也肯。
       *
       * 判据只查**同一条可聚焦链**上的两层:宿主是按钮语义(button / [role=button] /
       * [role=link] / a[href]),里面还有可见的可聚焦件(真按钮、链接、表单件、
       * [role=button|link|checkbox]、非 -1 的 tabindex)。role=tab / checkbox /
       * switch 不判 —— 它们是组合控件,规范本身就允许里面挂子件(本库 InkTabs 的
       * tablist、GongfaSection 的分类签都在这一类,一并被宿主选择器排除在外)。
       *
       * hosts 计数是**活信号**:扫到过几枚按钮语义宿主。0 就等于这条判据空转
       * (与 data-value-row / 200% 档 / 像素采样同一套防法)—— 判据若从没量到过东西,
       * 绿得毫无信息。
       */
      nestedControls: (() => {
        const FOCUSABLE =
          "button, a[href], input, select, textarea, [role=button], [role=link], [role=checkbox], [role=radio], [role=switch], [role=combobox], [tabindex]";
        const hosts = [...document.querySelectorAll("button, [role=button], a[href]")].filter(
          (el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          },
        );
        const bad = [];
        for (const host of hosts) {
          const inner = [...host.querySelectorAll(FOCUSABLE)].filter((el) => {
            if (el === host) return false;
            if (el.getAttribute("tabindex") === "-1") return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          });
          if (!inner.length) continue;
          const label = (el) =>
            `${el.tagName.toLowerCase()}${el.getAttribute("role") ? `[role=${el.getAttribute("role")}]` : ""}`;
          bad.push(
            `${label(host)}«${(host.getAttribute("aria-label") || host.textContent || "").trim().slice(0, 12)}」` +
              ` 里套着 ${inner.length} 个可聚焦件(${inner.slice(0, 2).map(label).join(", ")})`,
          );
        }
        return { items: bad.slice(0, 3), hosts: hosts.length };
      })(),
      /**
       * 可点元素的高度下限 28px —— 拇指点得着的最起码尺寸。
       * 实测(带装备的后期档,375/320 两档):修前有 47 个不足 24px、26 个不足 28px,
       * 大多是把文字行直接当按钮(属性来源行、返回链接、设置里的胶囊按钮)。
       *
       * 量法本身要确定(第四十三条,原 HYP-112):1280×800 的 /adventure 上报过一次
       * 「28px」的红 —— 打印出来四舍五入正好等于下限,实际是 27.6px 的子像素抖动,
       * 而那个按钮自己声明的是 `min-h-[28px]`。一条会自己变红的门比没有门更糟,故:
       *   一 声明的 min-height 到了 28px 的,盒子在 27.5px 以上就不判(那是渲染精度);
       *   二 报数带一位小数,不再四舍五入到与被测下限同值。
       */
      smallTargets: [...document.querySelectorAll("button, a, [role=button]")]
        .map((el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          const num = (v) => {
            const n = parseFloat(v);
            return Number.isFinite(n) ? n : 0;
          };
          return {
            el,
            r,
            minH: num(cs.minHeight),
            minW: num(cs.minWidth),
          };
        })
        .filter(({ r, minH, minW }) => {
          if (r.width <= 0 || r.height <= 0) return false;
          /*
           * 28px 是触控下限的**两个轴**,不是一个。
           *
           * 这条原先只量高度:高度给足了,宽度可以窄到 7px 也算过。实测「修为 5.7」
           * 那枚可点数只有 17.5px 宽、「▸来路」25px —— 拇指按不到这么窄的一条,
           * 而它们的高度都在 30~32px,判据一路绿灯。横向同样按 28 判,容差与高度一致:
           * 自己声明了 min-width ≥28 的,盒子到 27.5 以上就不判(亚像素)。
           */
          const tooNarrow = r.width < 28 && !(minW >= 28 && r.width >= 27.5);
          const tooShort = r.height < 28 && !(minH >= 28 && r.height >= 27.5);
          return tooNarrow || tooShort;
        })
        .slice(0, 4)
        .map(({ el, r, minH, minW }) => {
          /*
           * 报错要带类名 —— 只报「26.3px «《隐私政策》»」时,读者无从知道
           * 量到的是哪一枚(同一个文案可能在弹窗与页面上各有一份)。
           * 类名一摆出来,"量错了元素"与"真没给够高度/宽度"一眼可分。
           */
          const size = `${r.width.toFixed(1)}×${r.height.toFixed(1)}px`;
          const declared = `声明 ${minW || "—"}×${minH || "—"}px`;
          const axis = r.width < 28 ? "宽" : "高";
          return `${size}(${declared},${axis}不足)«${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 12)}» [${(el.className || "").toString().slice(0, 60)}]`;
        }),
      /**
       * 禁用态的字也得读得出来 —— **全库所有 :disabled**,不再只认两个手写类名。
       *
       * 禁用态往往正是「为什么不让我点」那句(「修为未至圆满」「灵石不足」「尚差 N 道源」),
       * 那是玩家最需要读到的一句。此前这条判据只扫 `.btn-seal:disabled, .btn-ghost:disabled`
       * —— 手写清单等于「扫到什么就守什么」:chip-ink、card-ink 当按钮、`aria-disabled`
       * 的自绘行、以及**整块压 opacity** 的那批,一处都没进过门。实测这批逃逸者的读数:
       * 「入 炉」1.76:1、「尚差 3 道源」1.90:1、逆旅契卡 2.31:1 —— 全都低于 3:1。
       *
       * 量的是**合成之后**的前景/背景,两处都不能只看声明的色号:
       *   底 —— 祖先链上层层半透明底色按 alpha 合成(.btn-ghost:disabled 的底是
       *        rgb(ink / 0.04),只看这一层会当成纯黑,算出 2.46:1 的假红);
       *   字 —— 祖先链上的 `opacity` 也要逐层乘进去。整块压透明度正是漏得最狠的那种:
       *        声明里字色明明够深,乘上 0.4 之后只剩 2.31:1,而 `getComputedStyle().color`
       *        读到的仍是压之前的值。
       */
      dimDisabled: (() => {
        const lum = (c) => {
          if (!c) return null;
          const f = (v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
        };
        const parse = (c) => {
          const m = /rgba?\(([^)]+)\)/.exec(c);
          if (!m) return null;
          const p = m[1]
            .split(/[,\s/]+/)
            .filter(Boolean)
            .map(Number);
          if (p.length < 3) return null;
          return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
        };
        /** 祖先链上的背景层 + 累计 opacity(元素自身的 opacity 也乘进去) */
        const paintOf = (start) => {
          const layers = [];
          let cum = 1;
          let n = start;
          while (n) {
            const cs = getComputedStyle(n);
            const c = parse(cs.backgroundColor);
            if (c && c.a > 0) layers.push({ rgb: c.rgb, a: c.a * cum });
            cum *= Number(cs.opacity);
            n = n.parentElement;
          }
          let base = [255, 255, 255];
          for (let i = layers.length - 1; i >= 0; i -= 1) {
            const { rgb, a } = layers[i];
            base = [0, 1, 2].map((k) => rgb[k] * a + base[k] * (1 - a));
          }
          return { base, cum };
        };
        const out = [];
        for (const el of document.querySelectorAll(":disabled, [aria-disabled=true]")) {
          if (!el.offsetParent) continue;
          const text = (el.textContent || "").trim();
          if (!text) continue;
          /** 取第一个真有字的节点的色 —— 按钮里常有一串次级 span,取按钮自己的色会量错 */
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let target = el;
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (node.textContent.trim()) {
              target = node.parentElement ?? el;
              break;
            }
          }
          const { base, cum } = paintOf(el);
          const raw = parse(getComputedStyle(target).color)?.rgb;
          if (!raw) continue;
          // 字也吃祖先链的 opacity:压到 40% 的白字,实际是「40% 的白 + 60% 的底」
          let fgCum = 1;
          for (let n = target; n; n = n.parentElement) fgCum *= Number(getComputedStyle(n).opacity);
          const fg = [0, 1, 2].map((k) => raw[k] * fgCum + base[k] * (1 - fgCum));
          const lf = lum(fg);
          const lb = lum(base);
          if (lf === null || lb === null) continue;
          const ratio = (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05);
          if (ratio < 3)
            out.push({ ratio: Math.round(ratio * 100) / 100, text: text.slice(0, 14), cum });
        }
        return out
          .sort((a, b) => a.ratio - b.ratio)
          .slice(0, 4)
          .map(
            (x) =>
              `${x.ratio}:1 «${x.text}»${x.cum < 0.999 ? `(整块 opacity ${x.cum.toFixed(2)})` : ""}`,
          );
      })(),
      /**
       * 顶栏里的字都只能占一行。
       *
       * 320 宽时曾把「3000/1000 亿载」「9 兆」「25.33 亿」折成两行 —— 数字一断行
       * 看着就像乱码,顶栏还从 46px 涨到 58px。故逐格量高:超过一行(≈24px)就是又折了。
       */
      headerTall: (() => {
        const header = document.querySelector("header");
        if (!header) return [];
        return [...header.querySelectorAll("span, p")]
          .filter((el) => el.getBoundingClientRect().height > 24)
          .slice(0, 3)
          .map(
            (el) =>
              `${Math.round(el.getBoundingClientRect().height)}px «${(el.textContent || "").trim().slice(0, 10)}»`,
          );
      })(),
      /**
       * 第三十九道:**主值行不许折行**(显式契约:`data-value-row`)。
       *
       * 起因是一次实测反馈:修炼页的灵气行把「积余 X / Y」这类**次要读数**留在主行里,
       * 窄屏上右边整块被顶到第二行 —— 卡片没溢出、文字也没被挤成竖排,前面所有判据都量不出来,
       * 可人一眼就看出"排面不齐"。同类的还有修为行的「(积 +X)」。
       *
       * 判据用**显式契约**而不是"所有 flex 行":哪些行是"标签 + 一个值"由模板说了算
       * (与 data-region-card 同一套做法),不然整页散文里的正常换行都会被卷进来。
       * 量法:取这一行**最后一个有文字的块**,数它占了几条行盒(inline 元素按 getClientRects
       * 去重 top;块元素按高 ÷ 行高)—— 超过一行就是"次要读数把主行挤折了"。
       */
      valueRows: (() => {
        const out = [];
        for (const row of document.querySelectorAll("[data-value-row]")) {
          const blocks = [...row.children].filter((el) => (el.textContent || "").trim().length > 0);
          const last = blocks[blocks.length - 1];
          if (!last) continue;
          const style = getComputedStyle(last);
          const lineHeight = parseFloat(style.lineHeight) || 16;
          const rects = [...last.getClientRects()];
          const lines =
            style.display === "inline" || style.display === "inline-block"
              ? new Set(rects.map((r) => Math.round(r.top))).size
              : Math.max(1, Math.round(last.getBoundingClientRect().height / lineHeight));
          if (lines > 1) {
            out.push(`${lines} 行 «${(last.textContent || "").trim().slice(0, 14)}»`);
          }
        }
        return out.slice(0, 3);
      })(),
      /**
       * 地界卡不许把名字挤成竖排,也不许让操作块压到名字那一行。
       *
       * 「横向溢出」量不出这类事故:卡片并没有溢出,只是右侧那一列把左边的名字压到只剩一个字宽,
       * 「青云山麓」当场变成一字一行,标签还会盖到产出字上 —— 玩家先看见,脚本量不到。
       * 故直接量两块元素的位置关系(名字高度 + 头部与操作块是否相交)。
       */
      regionCards: (() => {
        const tall = [];
        const overlap = [];
        for (const card of document.querySelectorAll("[data-region-card]")) {
          const name = card.querySelector("[data-region-name]");
          const label = (name?.textContent || "").trim();
          if (name) {
            const h = Math.round(name.getBoundingClientRect().height);
            // 15px 楷体单行约 22px;超过 30px 就是折行了(竖排四行能到 88px)
            if (h > 30) tall.push(`${h}px «${label}»`);
          }
          const head = card.querySelector("[data-region-head]");
          if (!head) continue;
          const a = head.getBoundingClientRect();
          for (const act of card.querySelectorAll("[data-region-action]")) {
            const b = act.getBoundingClientRect();
            if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) {
              overlap.push(`«${label}» 与操作块重叠`);
            }
          }
        }
        return { tall: tall.slice(0, 3), overlap: overlap.slice(0, 3) };
      })(),
      /**
       * 通用挤压判据之一:**被挤成竖排的文字**。
       *
       * 一行 flex 里塞了「长文字 + shrink-0 的右列」时,左列会被压到只剩一个字宽,
       * 于是「青云山麓」一字一行 —— 卡片并没有溢出,横向溢出查不出来。
       * 判据取「宽度 < 40px 且折成 3 行以上」:正常的排版不会出现这种盒子。
       */
      verticalTexts: [...document.querySelectorAll("span, p, div, h1, h2, h3, button")]
        .filter((el) => {
          const text = (el.textContent || "").trim();
          if (text.length < 3) return false;
          if (el.querySelector("span, p, div, button, a")) return false; // 只看最内层文字
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.width >= 40) return false;
          const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 16;
          return r.height > lineHeight * 2.5;
        })
        .slice(0, 3)
        .map(
          (el) =>
            `${Math.round(el.getBoundingClientRect().width)}px 宽 «${(el.textContent || "").trim().slice(0, 10)}»`,
        ),
      /**
       * 通用挤压判据之二:**数字与量词分家**。
       *
       * 「升级 · 2,798石 50铁」在 320 宽上会断成「升级 · 2,798 / 石 50铁」——
       * 数与单位跨行看着像两个数。用 Range 逐字取矩形,量出「数字|量词」是否被换行拆开。
       */
      unitBreaks: (() => {
        const UNITS = "石铁尘株张载年次件层场阶枚缕时日";
        const rectAt = (node, i) => {
          const r = document.createRange();
          r.setStart(node, i);
          r.setEnd(node, i + 1);
          const box = r.getBoundingClientRect();
          return box.width > 0 || box.height > 0 ? box : null;
        };
        const out = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node && out.length < 3) {
          const t = node.nodeValue || "";
          if (!/[\d,.][\s]*[石铁尘株张载年次件层场阶枚缕]/.test(t)) {
            node = walker.nextNode();
            continue;
          }
          // 只量**标签/代价**这类短文本(≤24 字):长句子里的正常换行不算事故,
          // 否则整页散文都会被卷进来,判据就没人看了
          if (t.trim().length > 24) {
            node = walker.nextNode();
            continue;
          }
          for (let i = 1; i < t.length; i += 1) {
            const ch = t[i];
            if (!UNITS.includes(ch)) continue;
            let j = i - 1;
            while (j >= 0 && /\s/.test(t[j])) j -= 1;
            if (j < 0 || !/[\d,.]/.test(t[j])) continue;
            const a = rectAt(node, j);
            const b = rectAt(node, i);
            if (a && b && Math.abs(a.top - b.top) > 4) {
              out.push(`«${t.trim().slice(0, 14)}»`);
              break;
            }
          }
          node = walker.nextNode();
        }
        return out;
      })(),
      /**
       * 通用挤压判据之三:**孤零零的标点**。
       *
       * 「……仍受益的财富」换行 + 后面单独一个「。」时,句号会被推到下一行独自站着
       * (模板里把标点另起一行写的必然结果)。判据:某段只含标点的文字,
       * 与同一父节点里其余文字不在同一行。
       */
      orphanPunctuation: (() => {
        const out = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node && out.length < 3) {
          const t = node.nodeValue || "";
          const trimmed = t.trim();
          // 只认中文标点:半角「?」这类是占位符(未知装备就写着「?」),不是折行事故
          if (!/^[。、,]{1,2}$/.test(trimmed)) {
            node = walker.nextNode();
            continue;
          }
          const parent = node.parentElement;
          if (!parent) {
            node = walker.nextNode();
            continue;
          }
          // 父节点里必须还有别的文字 —— 整块内容只有标点(装饰)不算孤字
          const siblings = [...parent.childNodes].filter(
            (n) => n !== node && n.nodeType === Node.TEXT_NODE && (n.nodeValue || "").trim(),
          );
          if (siblings.length === 0) {
            node = walker.nextNode();
            continue;
          }
          const r = document.createRange();
          r.setStart(node, 0);
          r.setEnd(node, t.length);
          const box = r.getBoundingClientRect();
          if (box.width <= 0 && box.height <= 0) {
            node = walker.nextNode();
            continue;
          }
          // 同一父节点里,有没有别的文字落在同一行(±4px)
          const alone = siblings.every((sn) => {
            const sr = document.createRange();
            sr.setStart(sn, 0);
            sr.setEnd(sn, (sn.nodeValue || "").length);
            const sb = sr.getBoundingClientRect();
            return Math.abs(sb.top - box.top) > 4;
          });
          if (alone) out.push(`«${(parent.textContent || "").trim().slice(0, 16)}»`);
          node = walker.nextNode();
        }
        return out;
      })(),
      /**
       * 通用挤压判据之四:**按钮标签被折行**。
       *
       * 按钮里的字是动作的名字(「问 卦(悟道点 2)」「升级 · 3,861 石」),它被折成两行
       * 不只是难看 —— 门槛数字会被拦腰折断(实见「问 卦(悟道」/「点 2)」)。根因又是一行
       * 不换行的 flex:按钮自己没设 shrink,被右侧长注挤扁后文字只好折行。卡片没溢出、
       * 字也没被挤成竖排,横向溢出与上面几条都量不出来。
       *
       * 只量**纯文字按钮**(无子元素、文字 2~18 字),图标 + 文字的按钮由子元素自己撑,
       * 不在这里管;超过 18 字的多是整段叙述型按钮(如设置页的说明长句),折行属正常。
       */
      wrappedButtonLabels: (() => {
        const out = [];
        for (const el of document.querySelectorAll("button")) {
          if (el.children.length > 0) continue; // 只看纯文字按钮
          const text = (el.textContent || "").trim();
          if (text.length < 2 || text.length > 18) continue;
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) continue;
          const range = document.createRange();
          range.selectNodeContents(el);
          const lines = new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size;
          if (lines >= 2) out.push(`«${text.slice(0, 16)}»`);
          if (out.length >= 3) break;
        }
        return out;
      })(),
      /**
       * 折行的按钮里哪些是**禁用态的原因句**。
       *
       * 「修为未至圆满」正好 6 字,`btn-seal w-full` 在 195 档折成两行 —— 但它是
       * 「为什么按不得」的说明,不是动作词,折行不影响理解。缩放档那条判据按语义
       * 排除它们(看 disabled),而不是把字数阈值往上抬 —— 抬阈值会连真正的四字
       * 动作词一起放过。
       */
      disabledButtonLabels: [...document.querySelectorAll("button[disabled]")]
        .filter((el) => el.children.length === 0)
        .map((el) => {
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) return null;
          const range = document.createRange();
          range.selectNodeContents(el);
          const lines = new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size;
          return lines >= 2 ? (el.textContent || "").trim().slice(0, 16) : null;
        })
        .filter((x) => x !== null),
      /**
       * 选择型控件的选中态要对机器可读,且**每组恰有一个**。
       *
       * 此前主题/战报速度/页签的选中全靠边色,读屏用户与自动化都看不出选了哪个
       * (上一轮补了 aria-label/aria-pressed,这里把「恰好一个」钉住)。
       */
      badGroups: (() => {
        const out = [];
        for (const attr of ["aria-pressed", "aria-selected"]) {
          const byParent = new Map();
          for (const el of document.querySelectorAll(`[${attr}]`)) {
            const parent = el.parentElement;
            if (!parent) continue;
            byParent.set(parent, [...(byParent.get(parent) ?? []), el]);
          }
          for (const [, els] of byParent) {
            if (els.length < 2) continue;
            const on = els.filter((e) => e.getAttribute(attr) === "true").length;
            if (on !== 1) out.push(`${attr} 组(${els.length} 项)里有 ${on} 个选中`);
          }
        }
        // 页签:每一组(同一父容器下 ≥2 个 role=tab)恰有一个 aria-selected=true
        const tabsByParent = new Map();
        for (const el of document.querySelectorAll("[role=tab]")) {
          const parent = el.parentElement;
          if (!parent) continue;
          tabsByParent.set(parent, [...(tabsByParent.get(parent) ?? []), el]);
        }
        for (const [, els] of tabsByParent) {
          if (els.length < 2) continue;
          const on = els.filter((e) => e.getAttribute("aria-selected") === "true").length;
          if (on !== 1) out.push(`页签组(${els.length} 项)里有 ${on} 个选中`);
        }
        // 设置页的两组选择(主题、战报速度)是明文约定:少了哪一组这里就红
        if (location.hash.startsWith("#/settings")) {
          const pressed = document.querySelectorAll("[aria-pressed]").length;
          if (pressed < 6)
            out.push(`设置页的选择控件只有 ${pressed} 个带 aria-pressed(主题 3 + 速度 3)`);
        }
        return out.slice(0, 3);
      })(),
      /**
       * 顶栏与底栏必须钉死 —— 滚一遍,两栏一步都不许动。
       *
       * 结构上两栏是滚动宿主的**兄弟**(内容在 main 里滚),按理动不了。可一旦
       * **外壳比可视区高**,文档层就攒出纵向可滚余量,玩家一拖窗口两栏就跟着走,
       * 看着就是「没固定」。手机浏览器的 100vh 正是大视口(地址栏收起时的高度),
       * 所以这条 bug 只在手机浏览器里现形 —— 桌面与无头浏览器量不出差值,
       * 只能量它的**机制**:文档层有可滚余量,且滚窗口时两栏真的位移了。
       */
      railDrift: (() => {
        const main = document.querySelector("main");
        const header = document.querySelector("header");
        const nav = document.querySelector("nav");
        if (!main || !header || !nav) return null;
        const doc = document.documentElement;
        const windowOverflow = Math.round(doc.scrollHeight - doc.clientHeight);
        const at = () => ({
          top: Math.round(header.getBoundingClientRect().top),
          bottom: Math.round(nav.getBoundingClientRect().bottom),
        });
        const before = at();
        const back = window.scrollY;
        window.scrollTo(0, windowOverflow + 4000);
        const after = at();
        const moved = Math.round(window.scrollY - back);
        window.scrollTo(0, back);
        return {
          windowOverflow,
          moved,
          drift: Math.max(Math.abs(before.top - after.top), Math.abs(before.bottom - after.bottom)),
        };
      })(),
    };
  });
}

/**
 * 正文对比度 —— 量的是**合成之后**的颜色,不是配置里的色号
 *
 * 调色板本体按「纸 / 纸深 / 卡片」三张底算过一遍(src/ui/palette.spec.ts),但真界面上
 * 还有两件它算不到的事:一是**半透明的字**(text-cinnabar/80 这种,实际颜色是字色与底
 * 混出来的),二是**带底色的方块**(品阶方块是「底色 = 它自己 6% 的墨」)。这一条把这些
 * 一并量掉,顺带守住以后新写的小字。
 *
 * 量法:逐个带直接文本的元素,把祖先链上所有背景层(含同层压在这块字下面的绝对定位层,
 * 比如页签那个滑动的墨块)按 alpha 合成出真实的底,再与字色算 WCAG 比值。
 * 阈值按字号分档:≥24px(或加粗 ≥18.66px)算大字 3:1,其余 4.5:1;
 * 禁用态、aria-hidden、渐变底跳过(禁用态另有专门的 3:1 判据)。
 * 两套主题都量:同一个页面上切 data-theme,不重新导航 —— 夜间主题的卡片比页面底色亮,
 * 浅色的字放上去才是最难的那一档,只量日间会漏。
 */
async function measureTextContrast(page) {
  await freezeTransitions(page);
  const measure = async (theme) => {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    await settleVisuals(page); // 等 transition-colors 走完再量
    return page.evaluate(() => {
      const parse = (c) => {
        const m = /rgba?\(([^)]+)\)/.exec(c);
        if (!m) return null;
        const p = m[1]
          .split(/[,\s/]+/)
          .filter(Boolean)
          .map(Number);
        if (p.length < 3) return null;
        return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
      };
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      const lum = (c) =>
        c === null ? null : 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
      const over = (fg, bg) => [0, 1, 2].map((i) => fg.rgb[i] * fg.a + bg[i] * (1 - fg.a));
      /** 这块字底下真正被涂的是什么颜色:自身向上合成,外加覆盖它的绝对定位层 */
      const paintUnder = (el, rect) => {
        const layers = [];
        let node = el;
        while (node) {
          for (const sib of node.parentElement?.children ?? []) {
            if (sib === node) continue;
            const scs = getComputedStyle(sib);
            if ((scs.position !== "absolute" && scs.position !== "fixed") || scs.display === "none")
              continue;
            const b = parse(scs.backgroundColor);
            if (!b || b.a <= 0) continue;
            const r = sib.getBoundingClientRect();
            if (
              r.left <= rect.left + 1 &&
              r.right >= rect.right - 1 &&
              r.top <= rect.top + 1 &&
              r.bottom >= rect.bottom - 1
            )
              layers.push(b);
          }
          const bg = parse(getComputedStyle(node).backgroundColor);
          if (bg && bg.a > 0) {
            layers.push(bg);
            if (bg.a >= 0.999) break;
          }
          node = node.parentElement;
        }
        let base = [255, 255, 255];
        for (let i = layers.length - 1; i >= 0; i -= 1) {
          const { rgb, a } = layers[i];
          base = [0, 1, 2].map((k) => rgb[k] * a + base[k] * (1 - a));
        }
        return base;
      };
      const out = [];
      for (const el of document.querySelectorAll("body *")) {
        if (el.matches(":disabled") || el.closest('[aria-hidden="true"]')) continue;
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1))
          continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const fgRaw = parse(cs.color);
        if (!fgRaw) continue;
        const base = paintUnder(el, r);
        const fg = over(fgRaw, base);
        const [hi, lo] = [lum(fg), lum(base)].sort((a, b) => b - a);
        const ratio = (hi + 0.05) / (lo + 0.05);
        const size = parseFloat(cs.fontSize);
        const need = size >= 24 || (Number(cs.fontWeight) >= 700 && size >= 18.66) ? 3 : 4.5;
        if (ratio < need) {
          out.push({
            ratio: Math.round(ratio * 100) / 100,
            need,
            size,
            text: (el.textContent || "").trim().slice(0, 14),
            color: cs.color,
            cls: String(el.className).slice(0, 32),
          });
        }
      }
      return out.slice(0, 4);
    });
  };
  const light = await measure("light");
  const dark = await measure("dark");
  await page.evaluate(() => {
    delete document.documentElement.dataset.theme;
  });
  await settleVisuals(page);
  await unfreezeTransitions(page);
  return [
    ...light.map((x) => ({ theme: "日间", ...x })),
    ...dark.map((x) => ({ theme: "夜间", ...x })),
  ];
}

/**
 * 两百档缩放(200%)—— 390 宽的机型放大到 200% 后,布局视口只剩 195 CSS px。
 *
 * 量法与巡页**共用同一把尺子**(measurePage):横向溢出、外壳被滚偏、越界元素、主值行折行。
 * 与那五档视口的区别是「缩放档」不是「宽度档」:320 档量的是小屏真机,这一档量的是
 * 常用机型上把字放大一倍之后的样子 —— 390÷2 = 195,比 320 还窄 125px。
 *
 * 量完把视口还原(后面的巡页与 --shots 都按原尺寸走)。
 */
async function measureZoomScale(page, vp) {
  const width = Math.round(vp.width / 2);
  const height = Math.round(vp.height / 2);
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(420); // 让断点与 transition 走完再量
  const info = await measurePage(page);
  const innerWidth = await page.evaluate(() => window.innerWidth);
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.waitForTimeout(260);
  return { ...info, innerWidth };
}

/** 缩放档的读数 → 失败清单(只判:溢出、外壳被滚偏、越界元素、主值行折行) */
function zoomProblems(info, tag) {
  const problems = [];
  if (info.innerWidth !== undefined && Math.abs(info.innerWidth * 2 - Number(tag)) > 2) {
    problems.push(`缩放档没量在 200% 上(布局视口 ${info.innerWidth}px)`);
  }
  if (info.horizontalOverflow) problems.push(`横向溢出(scrollWidth ${info.hash})`);
  if (info.shellShift && (info.shellShift.scrollLeft !== 0 || info.shellShift.overflowX > 1)) {
    problems.push(
      `外壳被滚偏(scrollLeft ${info.shellShift.scrollLeft} / 横向可滚 ${info.shellShift.overflowX}px)`,
    );
  }
  if (info.contentShift && info.contentShift.scrollLeft !== 0) {
    problems.push(`主内容区被滚偏(scrollLeft ${info.contentShift.scrollLeft}px)`);
  }
  if (info.contentShift && info.contentShift.overflowX > 1) {
    problems.push(
      `主内容区横向可滚(${info.contentShift.scrollWidth}>${info.contentShift.clientWidth},余 ${info.contentShift.overflowX}px)`,
    );
  }
  if (info.overflows.length) problems.push(`越界元素:${info.overflows.join(", ")}`);
  if (info.valueRows?.length) problems.push(`主值行在 200% 下折行:${info.valueRows.join(" | ")}`);
  /*
   * 这一档此前只判上面四条。竖排与按钮折行两条一直没接 —— 195 CSS px 是最容易把
   * 「一行几块横排」挤成一条的档位,而它恰恰是 AGENTS 明写要防的那一档
   * (按 390px 与 200% 缩放防折行)。缺口的代价实测过:14 个页面在这一档把标题、
   * 属性名、动作键压成一字一行,门一路全绿。
   *
   * 先逐页修完再收口(见 TASK-458):一把放开就是十几处同时红,逼人削判据。
   * 现在全库竖排已清零,只剩 4 处「整宽长文案按钮」的合理折行 —— 那些是**读得出来**的
   * 正常换行(一句 12 字的动作说明),故按钮折行这条只报「短标签」:与 problemsOf 里
   * 那条同一把尺子,但只算 6 字以内的动作词。
   */
  if (info.verticalTexts?.length)
    problems.push(`文字被挤成竖排(200%):${info.verticalTexts.join(" | ")}`);
  /*
   * 只算**短动作标签**。两条排除都是踩过的:
   *   一 整宽长文案按钮(「散尽修为,重入轮回(清空存档)」)折行是读得出来的正常换行;
   *   二 禁用态的**原因句**(「修为未至圆满」正好 6 字,`btn-seal w-full` 在 195 档
   *      折成两行)—— 那是「为什么按不得」的说明,不是动作词,折行不影响理解。
   *      排除按语义(看 disabled)而不抬阈值:抬到 5 字会把真正的四字动作词也放过去。
   */
  const shortWrapped = (info.wrappedButtonLabels ?? []).filter((t) => {
    const text = /«([^»]*)»/.exec(t)?.[1] ?? "";
    return Array.from(text).length <= 6;
  });
  const disabledReasons = new Set(info.disabledButtonLabels ?? []);
  const actionableWrapped = shortWrapped.filter(
    (t) => !disabledReasons.has(/«([^»]*)»/.exec(t)?.[1] ?? ""),
  );
  if (actionableWrapped.length)
    problems.push(`短动作标签被折行(200%):${actionableWrapped.join(" | ")}`);
  return problems;
}

/**
 * 弹窗在 200% 缩放档上的读数 —— 越界 / 竖排 / 短标签折行 / 数值被挤折。
 *
 * 与页面上那一套是同一条口径,但**只量弹窗面板里的东西**:遮罩下的页面在弹窗开着时
 * 本来就被压暗、也不该点,量它只会得到假红。这四条此前只对「页面上摆着的东西」生效 ——
 * 而本作有整整一族**只在某个时刻弹一次**的浮层(归来卷轴、渡劫结果、转世三步、
 * 洞府巡游、突破成功):主巡页与缩放档那一遍都碰不到它们,于是它们的 200% 版面
 * 从来没被量过。归来卷轴就是这么被量出来的(见 docs/design.md 第四十一条)。
 */
function dialogZoomProblems(info) {
  const problems = [];
  if (!info) return ["弹窗不见了 —— 判据没量到东西"];
  if (info.wide.length) problems.push(`顶出面板:${info.wide.join(" | ")}`);
  if (info.vertical.length) problems.push(`文字被挤成竖排:${info.vertical.join(" | ")}`);
  if (info.wrapped.length) problems.push(`短动作标签被折行:${info.wrapped.join(" | ")}`);
  if (info.folded.length) problems.push(`数值被标签挤折:${info.folded.join(" | ")}`);
  return problems;
}

/** 把视口压到 195 量一扇正开着的弹窗,量完还原(量法与 dialogZoomProblems 同源) */
async function measureDialogZoom(page, vp) {
  const before = { width: vp.width, height: vp.height };
  await page.setViewportSize({
    width: Math.round(before.width / 2),
    height: Math.round(before.height / 2),
  });
  await page.waitForTimeout(420);
  const info = await page.evaluate(() => {
    const panel = document.querySelector(".modal-panel");
    if (!panel) return null;
    const pr = panel.getBoundingClientRect();
    /** 与 measurePage 的越界口径同源:纯装饰层(不吃事件)不算事故 */
    const wide = [...panel.querySelectorAll("*")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0) return false;
        if (!(r.right > pr.right + 2 || r.left < pr.left - 2)) return false;
        for (let n = el; n; n = n.parentElement) {
          if (getComputedStyle(n).pointerEvents === "none") return false;
        }
        return true;
      })
      .slice(0, 3)
      .map((el) => `«${(el.textContent || "").trim().slice(0, 12)}»`);
    const vertical = [...panel.querySelectorAll("span, p, li, div, button")]
      .filter((el) => {
        const text = (el.textContent || "").trim();
        if (text.length < 3) return false;
        if (el.querySelector("span, p, div, li, button")) return false;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.width >= 40) return false;
        const lh = parseFloat(getComputedStyle(el).lineHeight) || 16;
        return r.height > lh * 2.5;
      })
      .slice(0, 3)
      .map(
        (el) =>
          `${Math.round(el.getBoundingClientRect().width)}px «${(el.textContent || "").trim().slice(0, 10)}»`,
      );
    const wrapped = [];
    for (const el of panel.querySelectorAll("button")) {
      if (el.children.length > 0) continue; // 只看纯文字按钮(与页面上那条同源)
      const text = (el.textContent || "").trim();
      if (text.length < 2 || text.length > 18) continue;
      if (el.hasAttribute("disabled")) continue; // 禁用态是原因句,折行不影响理解
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      const range = document.createRange();
      range.selectNodeContents(el);
      const lines = new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size;
      if (lines >= 2) wrapped.push(`«${text.slice(0, 14)}»`);
    }
    /*
     * 「标签 + 数值」那一类行:数值的自然宽度**放得下**这一行却仍折了,才算被标签挤的
     * (与归来卷轴那条同一把尺子 —— 自然宽度就超出的折行是正常换行)。
     */
    const folded = [];
    for (const li of panel.querySelectorAll("li, [data-value-row]")) {
      const [label, value] = [...li.children];
      if (label?.tagName !== "SPAN" || !value) continue;
      if (!(value.textContent || "").trim()) continue;
      const cs = getComputedStyle(li);
      const avail =
        li.clientWidth - parseFloat(cs.paddingLeft || "0") - parseFloat(cs.paddingRight || "0");
      const prev = value.style.whiteSpace;
      value.style.whiteSpace = "nowrap";
      const need = value.getBoundingClientRect().width;
      value.style.whiteSpace = prev;
      const lh = parseFloat(getComputedStyle(value).lineHeight) || 16;
      const lines = Math.max(1, Math.round(value.getBoundingClientRect().height / lh));
      if (lines > 1 && need <= avail + 1)
        folded.push(`${lines} 行 «${(value.textContent || "").trim().slice(0, 12)}»`);
    }
    return { wide, vertical, wrapped, folded, w: Math.round(pr.width) };
  });
  await page.setViewportSize(before);
  await page.waitForTimeout(300);
  return info;
}

/**
 * 渐变/图片底上的正文对比度 —— 采样真实像素,不看声明出来的色号。
 *
 * measureTextContrast 把祖先链上**声明出来**的背景色按 alpha 合成,那套算法对纯色卡片
 * 是准的;一旦底是渐变、纹理或图片,它要么按最外层的默认白算,要么把半透明的纸当成不透明
 * 的纸 —— 法球、印章、纸纹那几处,以及「半透明的纸叠在深色天幕上」这一整类,都是它量不到的。
 * 这里改用屏幕像素:
 *
 *   一 只挑那些**真实的底沾了渐变/图片**的字(一路向上找不到不透明色层,或中途撞上
 *      background-image):纯色卡片上的字交给上一条,不重复量;
 *   二 把这一屏里这些字的文本节点临时包进 visibility:hidden 的 span,拍一张 ——
 *      画面里剩下的就是「字底下到底是什么颜色」;
 *   三 逐像素算对比度(半透明的字按它自己那一像素的底合成),报**读不出来的像素占多少**。
 *      用比例而不是最差那一像素:一道装饰描边正好压在这块字的框里,不该把整块字判红;
 *      底是渐变的则大片像素读不出来,照样红。
 */
async function measurePixelContrast(page, sampler, dpr) {
  /*
   * 先等「字」与「图」都落定再量 —— 楷体按需分片后走 font-display: swap,
   * 配图各自异步解码,这两样在不同机器上落定时间不同:冷缓存 CI 采样时字体
   * 可能还在交换(量到的 glyph 是兜底字形)、图还没解码(量的底是占位色),
   * 而本地热缓存已经落定。贴着 4.5 阈值的字就被这个采样时机的差值推到两侧
   * —— 就是 CI 连红 6 次(跨 4 个没动渲染的提交)而本地恒绿的原因。
   * 等到字体与图片都 ready 再量,两边量到的都是同一个「安定态」,判据才有
   * 确定性(动画本身由截图的 animations: "disabled" 冻结,不在此列)。
   */
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((img) => !(img.complete && img.naturalWidth > 0))
        .map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())),
    );
  });
  const targets = await page.evaluate(() => {
    const mainBox = document.querySelector("main")?.getBoundingClientRect();
    const rail = document.querySelector(".tab-rail");
    const railBox = rail?.getBoundingClientRect();
    const parse = (c) => {
      const m = /rgba?\(([^)]+)\)/.exec(c);
      if (!m) return null;
      const p = m[1]
        .split(/[,\s/]+/)
        .filter(Boolean)
        .map(Number);
      return p.length < 3 ? null : { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
    };
    /**
     * 这块字的底沾没沾渐变/图片 —— 一路向上,直到撞上不透明的色层。
     *
     * 三种都算:自己或祖先身上有 background-image(渐变、纸纹);
     * 祖先的伪元素上挂了图(`.paper-grain::after` 那层宣纸颗粒就是);
     * 以及压在这块字下面的绝对定位装饰层里有图(与 measureTextContrast 同一套判据)。
     * 只要中途没有一层不透明的**色**把底盖死,声明色那套算法就看不到下面是渐变,
     * 这一条就得靠像素。
     */
    const gradientBase = (el, rect) => {
      for (let node = el; node; node = node.parentElement) {
        const cs = getComputedStyle(node);
        for (const pseudo of ["::before", "::after"]) {
          const ps = getComputedStyle(node, pseudo);
          if (ps.content !== "none" && ps.backgroundImage && ps.backgroundImage !== "none")
            return true;
        }
        if (cs.backgroundImage && cs.backgroundImage !== "none") return true;
        for (const sibling of node.parentElement?.children ?? []) {
          if (sibling === node) continue;
          const scs = getComputedStyle(sibling);
          if (scs.position !== "absolute" && scs.position !== "fixed") continue;
          if (scs.display === "none" || !scs.backgroundImage || scs.backgroundImage === "none")
            continue;
          const box = sibling.getBoundingClientRect();
          if (
            box.left <= rect.left + 1 &&
            box.right >= rect.right - 1 &&
            box.top <= rect.top + 1 &&
            box.bottom >= rect.bottom - 1
          )
            return true;
        }
        const bg = parse(cs.backgroundColor);
        if (bg && bg.a >= 0.999) return false;
      }
      return true; // 一路到根都没有不透明的底 —— 真实的底是天幕那张渐变
    };
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      if (el.matches(":disabled") || el.closest('[aria-hidden="true"]')) continue;
      const texts = [...el.childNodes].filter(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 1,
      );
      if (!texts.length) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.1)
        continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (!gradientBase(el, r)) continue;
      const inMain = Boolean(el.closest("main"));
      const range = document.createRange();
      const rects = [];
      for (const node of texts) {
        range.selectNodeContents(node);
        for (const box of range.getClientRects()) {
          const clip =
            inMain && mainBox
              ? mainBox
              : { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
          const left = Math.max(box.left, clip.left);
          const right = Math.min(box.right, clip.right);
          let top = Math.max(box.top, clip.top);
          const bottom = Math.min(box.bottom, clip.bottom);
          /*
           * 吸顶页签栏是内容滚动时故意压在上面的固定层。页签自己的字仍要量;
           * 正文滚到栏下则只留下栏底以下那截,整块都被盖住时直接跳过。
           */
          if (
            rail &&
            !rail.contains(el) &&
            railBox &&
            left < railBox.right &&
            right > railBox.left &&
            top < railBox.bottom &&
            bottom > railBox.top
          ) {
            top = Math.max(top, railBox.bottom);
          }
          if (
            right - left > 1 &&
            bottom - top > 1 &&
            top >= 0 &&
            bottom <= innerHeight &&
            left >= 0 &&
            right <= innerWidth
          ) {
            rects.push([left, top, right - left, bottom - top]);
          }
        }
      }
      if (!rects.length) continue;
      const size = parseFloat(cs.fontSize);
      out.push({
        rects,
        color: cs.color,
        size,
        need: size >= 24 || (Number(cs.fontWeight) >= 700 && size >= 18.66) ? 3 : 4.5,
        text: (el.textContent || "").trim().slice(0, 14),
        cls: String(el.className).slice(0, 28),
      });
    }
    return out;
  });
  if (!targets.length) return [];
  // 把字藏起来再拍:剩下的像素就是字底下的底色(藏的是文本节点本身,不动盒子)
  const hidden = await page.evaluate(() => {
    let n = 0;
    for (const el of document.querySelectorAll("body *")) {
      const texts = [...el.childNodes].filter(
        (x) => x.nodeType === 3 && x.textContent.trim().length > 1,
      );
      if (!texts.length) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      for (const node of texts) {
        const span = document.createElement("span");
        span.dataset.pixelProbe = "1";
        span.style.visibility = "hidden";
        node.parentNode.replaceChild(span, node);
        span.appendChild(node);
        n += 1;
      }
    }
    return n;
  });
  /*
   * `animations: 'disabled'`:两团云雾是无限循环的 CSS 动画,位置随时相在变 ——
   * 不冻住的话,同一处字这次量到 4.31、下次量到 4.8,判据就成了掷骰子(实测正是
   * 这样在 /inventory 上红过一次)。冻住之后每一次量到的都是同一帧。
   */
  const shot = await page.screenshot({ animations: "disabled", caret: "hide" });
  await page.evaluate(() => {
    for (const span of document.querySelectorAll("[data-pixel-probe]")) {
      const parent = span.parentNode;
      parent.replaceChild(span.firstChild, span);
      parent.normalize();
    }
  });
  if (!hidden) return [];
  const stats = await sampler.evaluate(
    async ({ png, list, scale }) => {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = "data:image/png;base64," + png;
      });
      const canvas = document.getElementById("c");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      const lum = (p) => 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]);
      const out = [];
      for (const t of list) {
        const parts = (t.color.match(/[\d.]+/g) || []).map(Number);
        if (parts.length < 3) {
          out.push(null);
          continue;
        }
        const alpha = parts.length > 3 ? parts[3] : 1;
        const ratios = [];
        for (const [x, y, w, h] of t.rects) {
          const px = Math.max(0, Math.floor(x * scale));
          const py = Math.max(0, Math.floor(y * scale));
          const pw = Math.min(canvas.width - px, Math.max(1, Math.ceil(w * scale)));
          const ph = Math.min(canvas.height - py, Math.max(1, Math.ceil(h * scale)));
          if (pw <= 0 || ph <= 0) continue;
          const data = ctx.getImageData(px, py, pw, ph).data;
          for (let k = 0; k < data.length; k += 4) {
            const bg = [data[k], data[k + 1], data[k + 2]];
            const fg = [0, 1, 2].map((i) => parts[i] * alpha + bg[i] * (1 - alpha));
            const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
            ratios.push((hi + 0.05) / (lo + 0.05));
          }
        }
        if (!ratios.length) {
          out.push(null);
          continue;
        }
        ratios.sort((a, b) => a - b);
        const bad = ratios.filter((r) => r < t.need).length;
        out.push({
          badPct: Math.round((bad / ratios.length) * 100),
          p05: Math.round(ratios[Math.floor(ratios.length * 0.05)] * 100) / 100,
          pixels: ratios.length,
        });
      }
      return out;
    },
    { png: shot.toString("base64"), list: targets, scale: dpr },
  );
  const bad = [];
  targets.forEach((t, i) => {
    const s = stats[i];
    if (!s) return;
    pixelTextsSeen += 1;
    if (s.badPct >= 20) bad.push({ ...t, ...s });
  });
  return bad;
}

/**
 * 像素采样用的那张「画布页」—— 与受测页同一个 context:把截图喂给它解码取值。
 *
 * 每个 context 各一张(WeakMap 记账)。从前是一个全局单例,自检串行时够用;
 * 改成并发后,两个视口同时在它身上 evaluate,一个还在 img.onload 里等着,
 * 另一个已经把 canvas 尺寸改掉了 —— 采样会掷骰子。跟着 context 走最省心:
 * context 关掉,这张页与它的画布一起回收。
 */
const samplers = new WeakMap();
async function pixelSampler(ctx) {
  let smp = samplers.get(ctx);
  if (!smp) {
    smp = await ctx.newPage();
    await smp.setContent('<canvas id="c"></canvas>');
    samplers.set(ctx, smp);
  }
  return smp;
}

/**
 * 一页的像素法对比度:两套主题 × 三档滚动位置(顶 / 中 / 底)。
 *
 * 为什么要滚:一屏只装得下眼前这些字,而渐变底的那几处(法球在首页、印章在结果弹窗上、
 * 纸纹铺满卡片)分布在不同高度;只量首屏等于没量。三档够覆盖一屏多一点的内容,
 * 再多就只是把同一批字量第二遍。
 */
async function pixelContrastOf(page, sampler) {
  await freezeTransitions(page);
  const out = [];
  const dpr = 3;
  for (const theme of ["light", "dark"]) {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    await settleVisuals(page);
    for (const fraction of [0, 0.5, 1]) {
      await page.evaluate((f) => {
        const main = document.querySelector("main");
        if (main) main.scrollTop = Math.max(0, (main.scrollHeight - main.clientHeight) * f);
      }, fraction);
      await settleVisuals(page);
      /*
       * 弹窗盖上来的时候不量:BaseModal 的遮罩是「墨 45% + 2px 模糊」铺满整屏,
       * 那一刻屏幕上的像素全都不是底色的像素 —— 量出来的会把整页报成假红(实测吃过一次)。
       * 引擎每秒掷一次事件,弹窗随时可能出现,故每一步都现查一次。
       */
      for (let i = 0; i < 2 && (await page.locator(".modal-panel").count()) > 0; i += 1) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
      }
      if ((await page.locator(".modal-panel").count()) > 0) continue;
      for (const bad of await measurePixelContrast(page, sampler, dpr))
        out.push({ theme: theme === "dark" ? "夜间" : "日间", ...bad });
    }
    await page.evaluate(() => {
      const main = document.querySelector("main");
      if (main) main.scrollTop = 0;
    });
  }
  await page.evaluate(() => {
    delete document.documentElement.dataset.theme;
  });
  await settleVisuals(page);
  await unfreezeTransitions(page);
  return out;
}

/**
 * 页签栏(InkTabs 的外壳 .tab-rail)要吸顶 —— 内容滚下去,它钉在内容区顶上。
 *
 * 这几册(背包四册、图鉴、名号、界域志、天界、坊市)都是越往下越长的列表,页签跟着滚走
 * 就得先滚回顶才能换一册。判据两条:滚过之后它还贴在内容区顶;盒子铺满内容区宽度
 * (两侧留缝的话,内容会从缝里明晃晃地穿过去)。
 *
 * 造余量那一段是有讲究的:空档的背包只有几件东西,页面根本滚不动,吸顶无从量起。
 * 于是往**视图根节点里**垫一块 1200px 的占位 —— 必须垫在容器里面:吸顶盒的活动
 * 范围是它的容器,容器到底了它就该跟着走;垫在容器外面等于没垫(第一版探针就是
 * 这么把背包页报成假红的)。
 */
async function measureTabRail(page) {
  await settleVisuals(page);
  return page.evaluate(() => {
    const main = document.querySelector("main");
    const rail = document.querySelector(".tab-rail");
    const root = main?.querySelector(".stagger-in") ?? main?.firstElementChild;
    if (!main || !rail || !root) return null;
    const spacer = document.createElement("div");
    spacer.style.height = "1200px";
    root.appendChild(spacer);
    const mainBox = main.getBoundingClientRect();
    main.scrollTop = 600;
    const box = rail.getBoundingClientRect();
    const out = {
      scrolled: Math.round(main.scrollTop),
      drift: Math.round(box.top - main.getBoundingClientRect().top),
      bleed: Math.round(box.left - mainBox.left) + Math.round(mainBox.right - box.right),
    };
    main.scrollTop = 0;
    spacer.remove();
    return out;
  });
}

/** 页签吸顶读数 → 失败清单(null = 这一页没有页签栏,不判) */
function railProblems(rail) {
  const out = [];
  if (!rail) return out;
  if (rail.scrolled < 500)
    out.push(`页签吸顶没量到:内容只滚了 ${rail.scrolled}px(占位没垫进容器?)`);
  if (rail.drift !== 0)
    out.push(`页签栏没吸顶:滚 ${rail.scrolled}px 后偏离内容区顶 ${rail.drift}px`);
  if (rail.bleed > 0)
    out.push(`页签栏没铺满内容区宽度,两侧共留 ${rail.bleed}px 缝(内容会从缝里穿过去)`);
  return out;
}

/** 一页量出来的读数 → 失败清单(两遍巡页共用同一套判据) */
/**
 * 打开一个路由,并等到「这一页真的画出来了」。
 *
 * 路由组件是懒加载分包:固定等 600~700ms 在机器忙时可能读到一张**空 main** ——
 * 那一刻 measurePage / measureZoomScale 的每条判据都在量空页,于是全绿,而玩家
 * 看到的其实还没渲染出来。假绿比假红更坏:它让「巡过这一页」变成一句没有证据的话。
 * 故这里等 main 里真有字再交回去,并把「读到几个字」返回给调用方记失败。
 *
 * 固定等待**保留在**就绪探测之后:有些判据量的是「过了这么久之后的稳定态」
 * (动画收敛、引擎跑过几拍),换成就绪即测会改掉它们量的东西。
 */
async function openRoute(page, route, settleMs) {
  await page.goto(INDEX + "#" + route, { waitUntil: "load" });
  await page
    .waitForFunction(() => (document.querySelector("main")?.innerText ?? "").trim().length > 0, {
      timeout: 15000,
    })
    .catch(() => undefined);
  if (settleMs > 0) await page.waitForTimeout(settleMs);
  /*
   * 量之前等两帧:路由切换的入场过渡是**内联样式**(Vue 的 Transition 直接改
   * style.opacity),而这里注入了 transition:none —— transitionend 因此永远不会来,
   * 视图会停在 opacity:0。禁用态对比度那条判据会把祖先链的 opacity 乘进去,
   * 于是整页的字都被算成「1:1,整块 opacity 0.00」而误红。
   * (真出现这类误红的是一次新增按钮:320-late 的 /world 是巡游里第一个带禁用控件的页。)
   */
  await page.evaluate(
    () =>
      new Promise((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => r(null)));
      }),
  );
  return page.evaluate(() => (document.querySelector("main")?.innerText ?? "").trim().length);
}

function problemsOf(info) {
  const problems = [];
  if (info.horizontalOverflow) problems.push(`横向溢出(scrollWidth ${info.hash})`);
  if (info.shellShift && (info.shellShift.scrollLeft !== 0 || info.shellShift.overflowX > 1)) {
    problems.push(
      `外壳被滚偏(scrollLeft ${info.shellShift.scrollLeft} / 横向可滚 ${info.shellShift.overflowX}px)`,
    );
  }
  if (info.contentShift && info.contentShift.scrollLeft !== 0) {
    problems.push(`主内容区被滚偏(scrollLeft ${info.contentShift.scrollLeft}px)`);
  }
  if (info.contentShift && info.contentShift.overflowX > 1) {
    problems.push(
      `主内容区横向可滚(${info.contentShift.scrollWidth}>${info.contentShift.clientWidth},余 ${info.contentShift.overflowX}px)`,
    );
  }
  if (info.overflows.length) problems.push(`越界元素:${info.overflows.join(", ")}`);
  if (info.unnamed.length) problems.push(`无名控件:${info.unnamed.join(" | ")}`);
  if (info.smallTargets.length)
    problems.push(`可点元素过小(触控下限 28×28):${info.smallTargets.join(" | ")}`);
  if (info.dimDisabled.length)
    problems.push(`禁用态的字读不出来(合成后对比度 <3:1):${info.dimDisabled.join(" | ")}`);
  if (info.deadControls.length)
    problems.push(`念出来是按钮却按不动:${info.deadControls.join(" | ")}`);
  if (info.nestedControls?.items.length)
    problems.push(`控件里套着控件(读屏只念一个按钮):${info.nestedControls.items.join(" | ")}`);
  if (info.badGroups.length) problems.push(`选择组没选中态:${info.badGroups.join(" | ")}`);
  if (info.headerTall?.length)
    problems.push(`顶栏折行(数字断行看着像乱码):${info.headerTall.join(" | ")}`);
  if (info.valueRows?.length) problems.push(`主值行被次要读数挤折行:${info.valueRows.join(" | ")}`);
  if (info.regionCards?.tall.length)
    problems.push(`地界名被挤成竖排:${info.regionCards.tall.join(" | ")}`);
  if (info.regionCards?.overlap.length)
    problems.push(`地界卡文字互相压住:${info.regionCards.overlap.join(" | ")}`);
  if (info.verticalTexts?.length) problems.push(`文字被挤成竖排:${info.verticalTexts.join(" | ")}`);
  if (info.unitBreaks?.length) problems.push(`数字与量词被换行拆开:${info.unitBreaks.join(" | ")}`);
  if (info.orphanPunctuation?.length)
    problems.push(`标点被折成孤字:${info.orphanPunctuation.join(" | ")}`);
  if (info.wrappedButtonLabels?.length)
    problems.push(`按钮标签被折行:${info.wrappedButtonLabels.join(" | ")}`);
  if (info.navItems !== 5) problems.push(`底部导航 ${info.navItems} 项(应为 5)`);
  /*
   * 底部导航的「当前位置」:读屏用户拿到的必须是状态,不是两处视觉提示(变色 + 朱砂短笔)。
   * 五个页签上恰有一枚 aria-current=page 且指向当前路由;不在页签上(market / settings /
   * codex 等)时一枚都不许有 —— 否则读屏会被告知一个并不存在的当前页签。
   */
  if (info.navItems === 5) {
    const TAB_PATHS = ["/", "/cultivation", "/adventure", "/inventory", "/character"];
    const here =
      String(info.hash || "")
        .replace(/^#/, "")
        .split("?")[0] || "/";
    const marked = info.navCurrent || [];
    if (TAB_PATHS.includes(here)) {
      if (marked.length !== 1) {
        problems.push(`底部导航标了 ${marked.length} 个当前项(页签页上应恰为 1):${here}`);
      } else if (marked[0] !== here) {
        problems.push(`底部导航标的当前项是 ${marked[0]},而路由在 ${here}`);
      }
    } else if (marked.length > 0) {
      problems.push(`不在五个页签上,底部导航却标了当前项:${marked.join(", ")}(路由 ${here})`);
    }
  }
  if (info.railDrift && (info.railDrift.windowOverflow > 1 || info.railDrift.drift > 1)) {
    problems.push(
      `文档层可滚 ${info.railDrift.windowOverflow}px、滚窗后两栏位移 ${info.railDrift.drift}px(顶栏底栏没钉住)`,
    );
  }
  return problems;
}

/* ==========================================================================
 * 自检任务 —— 每个任务各攒各的账,由下面的调度池并发跑。
 * 从前它们是同一层里的 25 个顺序代码块,一轮要排七分钟;拆成任务后互不等待,
 * 谁都不再为别人的等待买单(每块用的都是自己的 context 与自己的存档,天然独立)。
 * 合并时按数组固定顺序拼接,输出的失败清单与串行时代完全一致。
 * ========================================================================== */

/** 巡页:一档视口一个任务,五个视口并行(每一档都用独立 context 与自己的存档)。 */
async function taskPageTour(vp) {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  const auditCtx = await auditContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
  });
  const page = await auditCtx.newPage();
  const pageErrors = [];
  watchPageErrors(page, pageErrors);

  await page.goto(INDEX, { waitUntil: "load" });
  // 建号:同意隐私 → 传送门(约 2.5s)→ 命名 → 踏入仙途
  await page
    .getByRole("button", { name: /开\s*始\s*游\s*戏/ })
    .first()
    .click();
  /*
   * 等弹窗动画落定再量 —— 这一处缺了一整个弹窗生命周期:
   * 点完立刻量,量到的是入场动画的中间态(实测这个按钮恒为 26.3px,
   * 而它自己声明了 min-height:28px)。于是它读起来像"按钮没给够高度",
   * 实际是"判据量在了半路上",而且极其稳定(每一档视口都是同一个数),
   * 让人误以为是布局问题、反复去改那个按钮。
   * 反向验证:去掉这一行立刻复现,加回去即绿。
   */
  await page.waitForTimeout(600);
  // 隐私弹窗也是弹窗:它的控件同样要过那两条尺子(页面上巡不到它)
  {
    const audit = await auditModalControls(page);
    checked += 1;
    if (!audit || audit.count === 0)
      failures.push(`[${vp.tag}] 隐私弹窗里一个控件都没数到,判据没跑到东西`);
    if (audit && !audit.label)
      failures.push(`[${vp.tag}] 隐私弹窗没有可访问名(读屏只会念「对话框」)`);
    if (audit?.unnamed.length)
      failures.push(`[${vp.tag}] 隐私弹窗里有 ${audit.unnamed.length} 个无名控件`);
    if (audit?.small.length)
      failures.push(`[${vp.tag}] 隐私弹窗里可点元素过小:${audit.small.join(" | ")}`);
  }
  await page.locator("input[type=checkbox]").first().check();
  await page
    .getByRole("button", { name: /同意并开始/ })
    .first()
    .click();
  await page.waitForTimeout(3200);
  await page.locator("input:not([type=file]):not([type=checkbox])").first().fill("排版自检");
  await page
    .getByRole("button", { name: /踏\s*入\s*仙\s*途/ })
    .first()
    .click();
  await page.waitForTimeout(1200);

  /**
   * 新手第一步卡(见 core/firstStep)——「三块引导并列,却没人说先点哪儿」那个洞的补丁。
   *
   * 只在这一处核:卡由存档推出来(历练过一次 / 第一条主线达成即收卡),那些分支由
   * firstStep.spec 逐条钉死;这里只问真浏览器一句 —— 刚建好号的首页上,它在不在、
   * 指的方向对不对。**故意不点它**:点下去会跳进历练页,把那一页的随机际遇带进
   * 这一轮巡页的取景(从前假红的老路数)。
   *
   * 先整页重载一次:建号结束停在哪个 hash 取决于灵根鉴定动画放完没有,判据不该赌它;
   * 重载后 beforeEach 见存档已开,直接落在首页 —— 这才是"新玩家进游戏第一眼"。
   */
  await page.goto(INDEX, { waitUntil: "load" });
  await page.waitForTimeout(700);
  {
    const step = await page.evaluate(() => {
      const a = [...document.querySelectorAll("a")].find((el) =>
        (el.textContent || "").includes("第一步"),
      );
      if (!a) return null;
      const r = a.getBoundingClientRect();
      const declared = parseFloat(getComputedStyle(a).minHeight);
      return {
        href: a.getAttribute("href") || "",
        height: Math.round(r.height * 10) / 10,
        // 与巡页那条同一把尺子(见第四十三条)
        ok: r.height >= 28 || (declared >= 28 && r.height >= 27.5),
      };
    });
    checked += 1;
    if (!step) {
      failures.push(`[${vp.tag}] 开局首页没有「第一步」卡 —— 新玩家只能自己猜先点哪儿`);
    } else {
      if (step.href !== "#/adventure")
        failures.push(`[${vp.tag}] 「第一步」卡指向 ${step.href},开局该先指历练(#/adventure)`);
      if (!step.ok)
        failures.push(`[${vp.tag}] 「第一步」卡只有 ${step.height}px 高,低于 28px 触达下限`);
    }
  }

  /*
   * 巡页前先把随机源钉死(Math.random = 1)并收掉已经浮上来的浮层。
   *
   * 引擎每秒掷一次事件,中了就弹窗 + 铺一层墨色遮罩 —— 遮罩会用 --color-ink 混一层在
   * 整页之上,压在字底下。对比度探针量到的底就成了遮罩色,前后景一起向对方靠,量出
   * 1.6~2.5:1 的假红。它什么时候弹是随机的:串行时偶发,并发截图负载下几分钟一轮
   * 必中(实测)。后期档那一遍早就这么钉了(见它开头的 clearOverlays),主巡页这一遍
   * 从前没钉,是这一族假红的根。
   */
  await clearOverlays(page);
  for (const route of ROUTES) {
    const rendered = await openRoute(page, route, 700);
    const info = await measurePage(page);
    checked += 1;
    if (rendered === 0) {
      failures.push(`[${vp.tag}] ${route} 页面没渲染出来(分包没就绪)—— 这一页其实没量到`);
    }
    valueRowsSeen += info.valueRowCount ?? 0;
    controlHostsSeen += info.nestedControls?.hosts ?? 0;
    const problems = problemsOf(info);
    if (problems.length) failures.push(`[${vp.tag}] ${route} → ${problems.join(" / ")}`);
    /*
     * 正文对比度只在最常用那一档视口上量(390):它与视口宽度无关,五档各量一遍只是把
     * 巡页时间乘以五。两套主题都量,见 measureTextContrast。
     */
    if (vp.tag === "390") {
      // 先清浮层再量:题条盖住页眉、弹窗遮罩压暗整页,都会把对比度量成假红
      await quiesceOverlays(page);
      await settleVisuals(page);
      for (const bad of await measureTextContrast(page)) {
        contrastFails.push(
          `[${vp.tag}] ${route} ${bad.theme} ${bad.ratio}:1(需 ${bad.need})${bad.size}px «${bad.text}»`,
        );
      }
      /*
       * 渐变/图片底那几处,上一条量不到(它只算得到声明出来的色号),这里采样真实像素。
       * 弹窗盖着页面时不量:遮罩会把整页压暗,量出来的全会是假红(实测 /codex 上吃过一次)。
       */
      for (let i = 0; i < 3 && (await page.locator(".modal-panel").count()) > 0; i += 1) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
      }
      await quiesceOverlays(page);
      if ((await page.locator(".modal-panel").count()) === 0) {
        for (const bad of await pixelContrastOf(page, await pixelSampler(auditCtx))) {
          pixelContrastFails.push(
            `[${vp.tag}] ${route} ${bad.theme} 5% 分位 ${bad.p05}:1 · 读不出来 ${bad.badPct}%(需 ${bad.need})${bad.size}px «${bad.text}» ${bad.cls}`,
          );
        }
      }
    }
    const rail = await measureTabRail(page);
    const railFails = railProblems(rail);
    if (rail) checked += 1;
    if (railFails.length) failures.push(`[${vp.tag}] ${route} → ${railFails.join(" / ")}`);
    /*
     * 两百档字号(200% 缩放)—— 放在这一页的最后:它要改视口,量完再还原,
     * 免得把前面那些按原尺寸量的读数带偏。
     */
    if (vp.tag === "390") {
      const zoom = await measureZoomScale(page, vp);
      zoomSeen += 1;
      const zoomBad = zoomProblems(zoom, vp.tag);
      if (zoomBad.length) zoomFails.push(`[${vp.tag}] ${route} → ${zoomBad.join(" / ")}`);
    }
    if (SHOTS) {
      mkdirSync(SHOTS_DIR, { recursive: true });
      await page.screenshot({
        path: join(SHOTS_DIR, `${vp.tag}${route.replace(/\//g, "_")}.png`),
        fullPage: true,
      });
    }
  }
  if (pageErrors.length)
    failures.push(`[${vp.tag}] 页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  // 外域请求一律拦掉:一是量尺(应当恒为 0),二是别让别人的服务器决定我们的门要不要绿
  await page.close();

  if (contrastFails.length) failures.push(`正文对比度不足 AA:${contrastFails.join(" | ")}`);
  if (pixelContrastFails.length)
    failures.push(`渐变/图片底上的字读不出来(采样真实像素):${pixelContrastFails.join(" | ")}`);
  if (zoomFails.length) failures.push(`200% 缩放档上版面坏了:${zoomFails.join(" | ")}`);
  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 存档写不进去 · 设置页必须说话 */
async function taskSaveUnwritable() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第四件事:存档写不进去时,设置页必须说话 ----
  {
    const auditCtx = await auditContext({ viewport: { width: 375, height: 812 } });
    const page = await auditCtx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX, { waitUntil: "load" });
    await page
      .getByRole("button", { name: /开\s*始\s*游\s*戏/ })
      .first()
      .click();
    await page.locator("input[type=checkbox]").first().check();
    await page
      .getByRole("button", { name: /同意并开始/ })
      .first()
      .click();
    await page.waitForTimeout(3200);
    await page.locator("input:not([type=file]):not([type=checkbox])").first().fill("存档自检");
    await page
      .getByRole("button", { name: /踏\s*入\s*仙\s*途/ })
      .first()
      .click();
    await page.waitForTimeout(1200);

    // 卡死存储:此后任何写盘都抛配额错误(引擎每秒仍在改状态,故几秒内必然撞上一次刷盘)
    await page.evaluate(() => {
      Storage.prototype.setItem = function () {
        throw new DOMException("quota", "QuotaExceededError");
      };
    });
    await page.waitForTimeout(6500);
    await page.evaluate(() => {
      location.hash = "#/settings";
    });
    await page.waitForTimeout(800);
    const warned = await page.evaluate(() => document.body.innerText.includes("上次写入存档失败"));
    checked += 1;
    if (!warned) failures.push("[375] /settings → 存档写失败时设置页没有提示(静默丢档)");
    if (pageErrors.length)
      failures.push(`[375] 存档失败场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await page.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 弹窗的键盘与焦点 */
async function taskModalFocus() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第五件事:弹窗的键盘与焦点 ----
  {
    const auditCtx = await auditContext({ viewport: { width: 375, height: 812 } });
    const page = await auditCtx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX, { waitUntil: "load" });
    await page
      .getByRole("button", { name: /开\s*始\s*游\s*戏/ })
      .first()
      .click();
    await page.locator("input[type=checkbox]").first().check();
    await page
      .getByRole("button", { name: /同意并开始/ })
      .first()
      .click();
    await page.waitForTimeout(3200);
    await page.locator("input:not([type=file]):not([type=checkbox])").first().fill("焦点自检");
    await page
      .getByRole("button", { name: /踏\s*入\s*仙\s*途/ })
      .first()
      .click();
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      location.hash = "#/settings";
    });
    await page.waitForTimeout(700);

    /*
     * 先把浮出来的提示条收掉再点「关于」。
     *
     * 提示条是浮在顶上的一层(而且现在真的可点),建号后的成就提示会停留两三秒;
     * 它与设置页入口若落在同一区域,这条判据就会被一条无干的提示挡住而假红
     * (实测偶发:waitFor 过了、click 超时)。要测的是弹窗焦点,不是提示条 ——
     * 提示条自己那条判据在下面单独跑。
     */
    const stillOpen = await clearOverlays(page);
    if (stillOpen.length)
      failures.push(
        `[375] 弹窗焦点场景:动手前还开着浮层 —— ${stillOpen.join("、")}(取景没收拾干净)`,
      );

    const trigger = page.getByRole("button", { name: /关于/ }).first();
    // 先等它真的画出来:懒加载的分包 + 页面淡入都要时间,直接点会得到
    // 「点了没反应」的假红(实测偶发),而这条判据要抓的是真问题,不是抢跑
    try {
      await trigger.waitFor({ state: "visible", timeout: 10000 });
      await trigger.click({ timeout: 5000 });
    } catch (err) {
      // 把真实原因与**挡路的是谁**一起写进报告 —— 「页面没就绪?」这种猜测曾让人白跑两趟,
      // 第二次才发现挡路的是一层随机浮上来的浮盖。抓不到线索的判据等于没有判据。
      const blocked = await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((x) =>
          (x.textContent || "").includes("关于"),
        );
        if (!b) return "(页面上找不到「关于」)";
        const r = b.getBoundingClientRect();
        const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const modals = [...document.querySelectorAll(".modal-panel")].map((p) =>
          (p.querySelector("h3")?.textContent || "(无标题)").trim(),
        );
        return `挡路:${at ? `${at.tagName.toLowerCase()}.${String(at.className).slice(0, 40)}` : "无"} / 开着的弹窗:${modals.join("、") || "无"}`;
      });
      failures.push(
        `[375] 弹窗焦点场景:「关于」入口点不开(${String(err).split("\n")[0]?.slice(0, 80)};${blocked})`,
      );
    }
    // 等弹窗真画出来再断言:并发之后机器更忙,固定 350ms 不再等于「弹窗已就位」
    await page
      .locator(".modal-panel")
      .first()
      .waitFor({ state: "visible", timeout: 8000 })
      .catch(() => {});
    await settleVisuals(page);
    const opened = await page.evaluate(() => {
      const panel = document.querySelector(".modal-panel");
      const active = document.activeElement;
      return {
        role: panel?.getAttribute("role"),
        modal: panel?.getAttribute("aria-modal"),
        inside: !!(panel && active && panel.contains(active)),
      };
    });
    checked += 1;
    if (opened.role !== "dialog" || opened.modal !== "true")
      failures.push("[375] 弹窗没有 dialog 语义(role/aria-modal)");
    if (!opened.inside) failures.push("[375] 弹窗打开后焦点没进去 —— 键盘用户不知道弹窗开了");

    const inModal = await auditModalControls(page);
    checked += 1;
    if (!inModal || inModal.count === 0)
      failures.push("[375] 弹窗场景:面板里一个控件都没数到,判据没跑到东西");
    if (inModal && !inModal.label)
      failures.push("[375] 弹窗场景:对话框没有可访问名(读屏只会念「对话框」)");
    if (inModal?.unnamed.length)
      failures.push(
        `[375] 弹窗场景:面板里有 ${inModal.unnamed.length} 个无名控件(读屏只会念「按钮」)`,
      );
    if (inModal?.small.length)
      failures.push(`[375] 弹窗场景:面板里可点元素过小:${inModal.small.join(" | ")}`);

    // 连按六次 Tab:焦点必须一直在弹窗里(此前会一路跑到页面与底部导航)
    let escaped = false;
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() => {
        const panel = document.querySelector(".modal-panel");
        const active = document.activeElement;
        return !!(panel && active && panel.contains(active));
      });
      if (!inside) escaped = true;
    }
    if (escaped) failures.push("[375] 弹窗里按 Tab 会跑到背后的页面(焦点没有被困住)");

    await page.keyboard.press("Escape");
    // 关掉是带退场过渡的:等它真的从 DOM 里撤掉,而不是赌 300ms 够不够
    await page
      .locator(".modal-panel")
      .first()
      .waitFor({ state: "detached", timeout: 8000 })
      .catch(() => {});
    await settleVisuals(page);
    const afterEsc = await page.evaluate(() => ({
      stillOpen: !!document.querySelector(".modal-panel"),
      backOnTrigger: (document.activeElement?.textContent || "").includes("关于"),
    }));
    if (afterEsc.stillOpen) failures.push("[375] Esc 没能关掉弹窗");
    if (!afterEsc.backOnTrigger) failures.push("[375] 关掉弹窗后焦点没还给打开它的那个按钮");

    if (pageErrors.length)
      failures.push(`[375] 弹窗焦点场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await page.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** Tab 焦点看得见 */
async function taskTabFocus() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第六件事:Tab 焦点看得见吗 ----
  {
    const auditCtx = await auditContext({ viewport: { width: 375, height: 812 } });
    const page = await auditCtx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX, { waitUntil: "load" });
    await page
      .getByRole("button", { name: /开\s*始\s*游\s*戏/ })
      .first()
      .click();
    await page.locator("input[type=checkbox]").first().check();
    await page
      .getByRole("button", { name: /同意并开始/ })
      .first()
      .click();
    await page.waitForTimeout(3200);
    await page.locator("input:not([type=file]):not([type=checkbox])").first().fill("焦点可见自检");
    await page
      .getByRole("button", { name: /踏\s*入\s*仙\s*途/ })
      .first()
      .click();
    await page.waitForTimeout(1200);
    checked += 1;

    for (const route of ["/cultivation", "/settings"]) {
      await page.evaluate((r) => {
        location.hash = `#${r}`;
      }, route);
      await page.waitForTimeout(650);
      // 从「没有焦点」的干净状态开始数 Tab,免得把上一页残留的焦点算进来
      await page.evaluate(() => document.activeElement?.blur());
      const seen = [];
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press("Tab");
        const info = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body || el === document.documentElement)
            return { blind: null, label: "(body)" };
          const cs = getComputedStyle(el);
          // 透明的轮廓等于没有 —— 只看「有没有一圈线」会把 outline:transparent 也算通过
          const hiddenOutline =
            cs.outlineColor === "transparent" || /rgba\([^)]*,\s*0\)$/.test(cs.outlineColor);
          const ring =
            (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0 && !hiddenOutline) ||
            cs.boxShadow !== "none";
          const label = `${el.tagName.toLowerCase()} «${(el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 12)}»`;
          return { blind: ring ? null : label, label };
        });
        seen.push(info.label);
        if (info.blind)
          failures.push(`[375] ${route} 第 ${i + 1} 个 Tab 落点看不见焦点:${info.blind}`);
      }
      // 落点一个没数到 = 这段判据没跑到东西,也要红
      if (seen.filter((s) => s !== "(body)").length === 0)
        failures.push(`[375] ${route} 的 Tab 落点一个都没数到`);
    }
    if (pageErrors.length)
      failures.push(`[375] 焦点可见场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await page.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 浮出的提示条点得掉 */
async function taskToastDismiss() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第七件事:浮出来的提示条能不能点掉 ----
  {
    const auditCtx = await auditContext({ viewport: { width: 375, height: 812 } });
    const page = await auditCtx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX, { waitUntil: "load" });
    await page
      .getByRole("button", { name: /开\s*始\s*游\s*戏/ })
      .first()
      .click();
    await page.locator("input[type=checkbox]").first().check();
    await page
      .getByRole("button", { name: /同意并开始/ })
      .first()
      .click();
    await page.waitForTimeout(3200);
    await page.locator("input:not([type=file]):not([type=checkbox])").first().fill("浮层自检");
    await page
      .getByRole("button", { name: /踏\s*入\s*仙\s*途/ })
      .first()
      .click();
    await page.waitForTimeout(1200);
    const hostSel = ".pointer-events-none.fixed";
    const before = await page.evaluate((sel) => {
      const buttons = [...document.querySelectorAll(`${sel} button`)];
      return {
        count: buttons.length,
        // 判据是**计算出来的** pointer-events:外框写 none 时按钮会继承成 none,
        // 于是 @click 挂在那儿却永远收不到事件 —— 写了不生效,等于没写
        blocked: buttons.filter((b) => getComputedStyle(b).pointerEvents === "none").length,
      };
    }, hostSel);
    checked += 1;
    if (before.count === 0) failures.push("[375] 浮层场景:一条提示都没浮出来,这条判据没跑到东西");
    if (before.blocked > 0)
      failures.push(
        `[375] 浮层场景:${before.blocked} 条提示条点了没反应(pointer-events 被外框的 none 继承)`,
      );
    if (before.count > 0 && before.blocked === 0) {
      const first = page.locator(`${hostSel} button`).first();
      const text = ((await first.textContent()) ?? "").trim();
      await first.click({ timeout: 3000 });
      /*
       * 「点了要收」还得看它**多快**收:提示条带 glow-pulse 无限动画时,过渡探测
       * 会把 2.4 秒当成离场时长,点掉之后原地杵两秒才没(实测 460ms 仍在原地)。
       * 故给一个 1 秒的窗口 —— 它短于最短的提示寿命(2.6 秒),不会把「自己超时消失」错认成点掉了。
       */
      let gone = false;
      for (let i = 0; i < 20 && !gone; i += 1) {
        await page.waitForTimeout(50);
        gone = (await page.locator(`${hostSel} button`, { hasText: text }).count()) === 0;
      }
      if (!gone)
        failures.push(`[375] 浮层场景:点了「${text.slice(0, 12)}」1 秒内没消失(还挂在屏幕上)`);
    }
    if (pageErrors.length)
      failures.push(`[375] 浮层场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await page.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 引擎概率弹窗 · 顿悟/洞府巡游 */
async function taskEngineModals() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第八件事:引擎按概率触发的两扇弹窗(顿悟 / 洞府巡游) ----
  /*
   * 这两扇由引擎自己掷概率弹出(顿悟 8% × 境界存在感、巡游每日一次),
   * 正常巡页永远碰不到;而它们此前是自己铺的 fixed inset-0,没有 dialog 语义、
   * 没有焦点管理。故这里把 Math.random 钉成 0 让那一掷必中 —— 下一次引擎心跳
   * 就会摆上来,然后按弹窗那套尺子量一遍。夹具只作用于测试页,不动生产代码
   * (注意 RandomService 在构造时就抓住了 Math.random 的函数引用,故引擎其余部分
   * 的随机数不受影响)。
   */
  {
    const auditCtx = await auditContext({ viewport: { width: 375, height: 812 } });
    const page = await auditCtx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX, { waitUntil: "load" });
    await page
      .getByRole("button", { name: /开\s*始\s*游\s*戏/ })
      .first()
      .click();
    await page.locator("input[type=checkbox]").first().check();
    await page
      .getByRole("button", { name: /同意并开始/ })
      .first()
      .click();
    await page.waitForTimeout(3200);
    await page.locator("input:not([type=file]):not([type=checkbox])").first().fill("引擎事件自检");
    await page
      .getByRole("button", { name: /踏\s*入\s*仙\s*途/ })
      .first()
      .click();
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      for (const b of document.querySelectorAll(".pointer-events-none.fixed button")) b.click();
      Math.random = () => 0;
    });
    const seen = new Map();
    for (let i = 0; i < 40 && seen.size < 2; i += 1) {
      await page.waitForTimeout(500);
      const info = await page.evaluate(() => {
        const panel = document.querySelector(".modal-panel");
        if (!panel) return null;
        return {
          title: (panel.querySelector("h3")?.textContent || "").trim() || "(无标题)",
          label: panel.getAttribute("aria-label"),
          role: panel.getAttribute("role"),
          controls: [...panel.querySelectorAll("button, a, [role=button]")]
            .map((el) => {
              const r = el.getBoundingClientRect();
              const declared = parseFloat(getComputedStyle(el).minHeight);
              return {
                name: (el.getAttribute("aria-label") || el.textContent || "")
                  .trim()
                  .replace(/\s+/g, " ")
                  .slice(0, 14),
                h: Math.round(r.height * 10) / 10,
                // 与巡页那条同一把尺子(见第四十三条)
                ok: r.height >= 28 || (declared >= 28 && r.height >= 27.5),
              };
            })
            .filter((c) => c.h > 0),
        };
      });
      if (info && !seen.has(info.title)) {
        seen.set(info.title, info);
        /*
         * 顿悟与洞府巡游也只在概率掷中时出现 —— 巡页与缩放档都碰不到它们。
         * 洞府巡游里那几行选项与代价正是 195 宽上最容易折的,故在按 Esc 之前量一遍。
         */
        zoomSeen += 1;
        const evZoom = dialogZoomProblems(
          await measureDialogZoom(page, { width: 375, height: 812 }),
        );
        if (evZoom.length)
          failures.push(`[375] 「${info.title}」在 200% 下坏了:${evZoom.join(" / ")}`);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(600);
      }
    }
    checked += 1;
    if (seen.size === 0)
      failures.push("[375] 引擎事件场景:概率钉成必中之后,两扇弹窗一扇都没浮出来(触发接线断了?)");
    for (const [title, info] of seen) {
      if (info.role !== "dialog")
        failures.push(`[375] 「${title}」没有 dialog 语义(role=${info.role})`);
      if (!info.label) failures.push(`[375] 「${title}」没有可访问名`);
      const bad = info.controls.filter((c) => !c.name || !c.ok);
      if (bad.length)
        failures.push(
          `[375] 「${title}」里有 ${bad.length} 个控件不合格:${bad.map((c) => `${c.h}px «${c.name || "无名"}»`).join(" | ")}`,
        );
    }
    if (pageErrors.length)
      failures.push(`[375] 引擎事件场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await page.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 冷启动落在子页的返回 */
async function taskColdStartBack() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第九件事:冷启动落在子页时,「返回」不该把人送出游戏 ----
  /*
   * 书签、外部 deep link、PWA 冷启动恢复上次路由,都会让**第一次**导航就落在
   * 子页上;此时站内没有上一页,裸 router.back() 会退到 about:blank ——
   * 实测整个界面连同这一局的上下文一起消失,而玩家只觉得「点了一下返回,游戏没了」。
   * 复现要用同一 context 里新开的一页:它共享存档(localStorage),但历史是全新的。
   */
  {
    const ctx = await auditContext({ viewport: { width: 375, height: 812 } });
    const boot = await ctx.newPage();
    await boot.goto(INDEX, { waitUntil: "load" });
    await boot
      .getByRole("button", { name: /开\s*始\s*游\s*戏/ })
      .first()
      .click();
    await boot.locator("input[type=checkbox]").first().check();
    await boot
      .getByRole("button", { name: /同意并开始/ })
      .first()
      .click();
    await boot.waitForTimeout(3200);
    await boot.locator("input:not([type=file]):not([type=checkbox])").first().fill("返回自检");
    await boot
      .getByRole("button", { name: /踏\s*入\s*仙\s*途/ })
      .first()
      .click();
    await boot.waitForTimeout(1200);
    await boot.close();

    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    // 这一页的第一次导航就是子页 —— 正是冷启动的处境
    await page.goto(INDEX + "#/dongfu", { waitUntil: "load" });
    await page.waitForTimeout(1800);
    // 同上:别让随机浮上来的引擎事件挡住「返回」
    await clearOverlays(page);
    checked += 1;
    const coldBack = await page.evaluate(() => ({
      back: (window.history.state || {}).back ?? null,
      hasBack: !!document.querySelector("main button"),
    }));
    if (coldBack.back)
      failures.push(
        `[375] 冷启动场景:第一次导航就落在子页,history.state.back 竟是 ${coldBack.back}(复现条件没搭对)`,
      );
    const backBtn = page.locator("main button", { hasText: /返\s*回/ }).first();
    if ((await backBtn.count()) === 0) {
      failures.push("[375] 冷启动场景:子页上没有「返回」入口,判据没跑到东西");
    } else {
      await backBtn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(900);
      const after = await page.evaluate(() => ({
        hash: location.hash,
        alive: !!document.querySelector("#app")?.firstElementChild,
      }));
      if (!after.alive) failures.push("[375] 冷启动场景:点「返回」把游戏退出了(界面没了,退到站外)");
      else if (after.hash !== "#/" && after.hash !== "")
        failures.push(`[375] 冷启动场景:点「返回」落在 ${after.hash},父页应是 #/`);
    }
    if (pageErrors.length)
      failures.push(`[375] 冷启动场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 后期档逐页复核 */
async function taskLateTour() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第十件事:后期档的逐页复核(空档量不出长数字与满屏内容) ----
  /*
   * 前面九件事量的是「刚建号」那一份空档。可同一个页面在神人境是另一副样子:
   * 数字长到九位数、法宝两件、器魂、在途秘境、以及隔夜归来时的「归来卷轴」。
   * 那一屏玩家每隔几天就会见一次,却从来没有被无头浏览器画出来过。
   * 故这里用一份自检夹具(存档密钥就写在包里,见 utils/crypto 的注释:并非安全边界),
   * 走一遍后期档:先核归来卷轴,再逐页过同一把尺子。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now() - 86400000 * 30,
        lastActiveAt: Date.now() - 9 * 3600000,
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        major: 14,
        sub: 0,
        exp: gn(3, 9),
        age: 3000,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 2,
          daoFruit: 12,
          talents: [],
          insight: 400,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        /*
         * 五系杂灵根:灵根行最挤的一档(名字 + 五个圆环 + ×倍率)。
         * 空档抽到「双灵根」时不挤,「杂灵根」被压成竖排的事故就靠运气才撞得到 ——
         * 这里钉死最挤的一份,让那个人物页状态每次都被量。
         */
        linggen: {
          roots: [
            { element: "fire", aptitude: 42 },
            { element: "water", aptitude: 38 },
            { element: "wood", aptitude: 51 },
            { element: "metal", aptitude: 33 },
            { element: "earth", aptitude: 29 },
          ],
          gradeName: "杂灵根",
          growthMult: 0.85,
        },
        /*
         * 镇压三态都要在夹具里出现 —— 此前夹具一个镇压区域都没有,
         * 于是「自动产出」那条长信息把地界名挤成竖排的事故,这脚本从来没量过(玩家先看到的)。
         * qingyun 守了 7 小时(稳定)、wanyao 守到 71 小时(倒计时转红)、guzhanchang 守满一日(繁盛)。
         */
        suppressedRegions: ["qingyun", "wanyao", "guzhanchang"],
        suppressQualified: ["qingyun", "wanyao", "guzhanchang", "heifeng"],
        suppressedSince: {
          qingyun: Date.now() - 7 * 3600000,
          wanyao: Date.now() - 71 * 3600000,
          guzhanchang: Date.now() - 30 * 3600000,
        },
        regionStats: {
          qingyun: {
            totalFights: 40,
            avgRounds: 2.1,
            avgDamageTakenPct: 0.05,
            consecutiveWins: 9,
            lastUpdateAt: Date.now() - 3600000,
          },
          wanyao: {
            totalFights: 60,
            avgRounds: 2.4,
            avgDamageTakenPct: 0.06,
            consecutiveWins: 4,
            lastUpdateAt: Date.now() - 3600000,
          },
          guzhanchang: {
            totalFights: 55,
            avgRounds: 2.8,
            avgDamageTakenPct: 0.09,
            consecutiveWins: 3,
            lastUpdateAt: Date.now() - 3600000,
          },
          // 黑风林:已取得镇压资格但当前仍在历练态(「转为镇压收益」那条要画出来)
          heifeng: {
            totalFights: 14,
            avgRounds: 3.9,
            avgDamageTakenPct: 0.18,
            consecutiveWins: 2,
            lastUpdateAt: Date.now() - 600000,
          },
        },
        // 在途秘境:归来卷轴要说「原样留着」,历练页也要画出「在境中」那一版
        secretRealm: {
          realmId: "sr_kurong",
          enteredAt: Date.now() - 600000,
          layer: 2,
          wins: 1,
          losses: 0,
          spoils: ["灵石少许"],
          rules: ["治疗减半"],
          carriedHpPct: 0.7,
          finished: false,
        },
      },
      resources: {
        spiritStone: gn(9, 12),
        qi: 5000,
        wudao: 800,
        herb: 900,
        ore: 900,
        page: 300,
        dust: 500,
      },
      inventory: {
        items: [
          {
            uid: "late_w",
            templateId: "w_zidian",
            quality: "heaven",
            tier: 20,
            level: 0,
            affixes: [{ id: "bs3", roll: 1 }],
          },
          {
            uid: "late_a",
            templateId: "b_xingluo",
            quality: "heaven",
            tier: 20,
            level: 0,
            affixes: [{ id: "low2", roll: 1 }],
          },
        ],
        equipped: { weapon: "late_w", body: "late_a" },
        pills: { p_jvqidan: 5, p_huichun: 3 },
        artifacts: [
          { defId: "af_qinglian", level: 3 },
          { defId: "af_wuxiangzhu", level: 2 },
        ],
        equippedArtifacts: ["af_qinglian", "af_wuxiangzhu"],
      },
      endgame: {
        daoPath: "sword",
        daoSource: 1200,
        /*
         * 两缕只装一缕 —— 空槽那枚「装配」入口要在**有闲置形意**时才画得出来。
         * 夹具若把两缕都装上,它在 188 页 × 视口那一遍里一次都不存在,判据量不到
         * 就等于没量(与 data-value-row 的活信号同一道理)。
         */
        souls: [
          { uid: "late_s1", type: "fengmang", grade: 1, fromName: "旧剑" },
          { uid: "late_s2", type: "beishui", grade: 3, fromName: "残戟" },
        ],
        equippedSouls: ["late_s1"],
        // 在途远征:归来卷轴要说「原样留着」,天界页也要画出「走到第二重」那一版
        worldRun: {
          worldId: "chiyan",
          pactId: null,
          gateId: null,
          layer: 1,
          bonus: 12,
          rows: [{ foeName: "焰魄", win: true, rounds: 7, hpLeftPct: 0.62 }],
          carriedHpPct: 0.62,
          totalRounds: 7,
          winStacks: 1,
        },
      },
      // 地界表:解锁到黑风林一带,好让「镇压中 / 已取得资格」两种卡片都渲染出来
      adventure: {
        unlocked: ["qingyun", "luoxia", "heifeng", "wanyao", "cangwu", "guzhanchang"],
        // luoxia 不在 cleared 里 —— 它已「妖气复聚」,旧主归来(见下一行的 revived)
        cleared: ["qingyun", "heifeng", "wanyao"],
        /*
         * 妖气复聚那一行(见 core/regionRevival):旧主归来、此地处不再「已靖」。
         * 它要进夹具,是因为它是这条设计唯一的可见面 —— 而「名字 + 已靖/复聚标签 +
         * 简介 + 该怎么办」正是这一行最挤的一档,窄屏上最容易把字挤成竖排。
         */
        revived: ["luoxia"],
        mortalCleared: [],
        /*
         * 留一程只有一分钟、且带待决际遇的历练:离线结算会在归零前把它自动收掉，
         * 让归来卷轴真画出新增的「际遇结果」块 —— 只写 session:null 的话，这块永远量不到。
         */
        session: {
          regionId: "qingyun",
          mode: "normal",
          startedAt: Date.now() - 9 * 3600000,
          endsAt: Date.now() - 9 * 3600000 + 60000,
          nextBattleAt: Date.now() - 9 * 3600000 + 12000,
          wins: 0,
          losses: 0,
          events: 0,
          stoneGain: gn(0, 0),
          expGain: gn(0, 0),
          itemGain: 0,
          wudaoGain: 0,
        },
        pendingEventId: "ev_rescue_disciple",
        pendingEventSince: Date.now() - 9 * 3600000,
        seenOnceEvents: [],
        lastBattle: null,
        eventMemories: {},
      },
      /*
       * 洞府等级:升级按钮上的代价是「数 + 量词」(2,798 石 · 50 铁),
       * 空档只有「200 石 20 铁」这种短数字,量不出「数字与量词被换行拆开」那条判据。
       */
      dongfu: {
        levels: { mansion: 4, field: 5, alchemy: 5, forge: 4, library: 4 },
        offlineCapHours: 24,
      },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "dark",
      },
    };
    // 夹具 payload 只做一次,后面 320 那一遍复用;播种加闸(见第十四件事的坑)
    const latePayload = Object.fromEntries(
      Object.entries(slices).map(([k, v]) => [`xuanshu.${k}`, enc(v)]),
    );
    await ctx.addInitScript((decisivePayload) => {
      /*
       * 事件后果也是随机掷的。这里必须赶在应用模块初始化前钉死:
       * RandomService 构造时已经把 Math.random 的函数引用收走,页面起来后再改
       * 不影响它。否则「遇袭的弟子」有 35% 落到重伤分支,丹药回执这条判据会偶发假红。
       */
      Math.random = () => 0;
      if (localStorage.getItem("__layoutSeeded")) return;
      for (const [k, v] of Object.entries(decisivePayload)) localStorage.setItem(k, v);
      localStorage.setItem("__layoutSeeded", "1");
    }, latePayload);
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX, { waitUntil: "load" });
    await page.waitForTimeout(2600);

    // (一)隔夜归来第一眼:数字不许漏 NaN,收下之后要真的关掉
    checked += 1;
    const offline = await page.evaluate(() => {
      const panel = document.querySelector(".modal-panel");
      if (!panel) return null;
      const text = panel.innerText || "";
      return {
        label: panel.getAttribute("aria-label"),
        text: text.slice(0, 200),
        leaks: /NaN|undefined|Infinity/.test(text),
        rows: text.split("\n").filter((l) => l.includes("+")).length,
        hasEventReceipts: text.includes("际遇结果"),
        hasPillReceipt: /丹药「.+」×2/.test(text),
      };
    });
    if (!offline) {
      failures.push("[390] 后期档:隔夜 9 小时开局,「归来卷轴」没有弹出来");
    } else {
      if (!offline.label) failures.push("[390] 后期档:归来卷轴没有可访问名");
      if (offline.leaks)
        failures.push(`[390] 后期档:归来卷轴漏出占位符 —— ${offline.text.slice(0, 60)}`);
      if (offline.rows === 0) failures.push("[390] 后期档:归来卷轴一条收益都没列");
      if (!offline.hasEventReceipts)
        failures.push("[390] 后期档:自动际遇结算了,归来卷轴却没有「际遇结果」");
      if (!offline.hasPillReceipt)
        failures.push("[390] 后期档:际遇给了丹药,归来卷轴却认不出得了什么");
      /*
       * 卷轴本身也要过 200% 那一档。
       *
       * 它是**玩家每几天就见一次**的那一屏,而它只在开局弹一次 —— 主巡页与缩放档
       * 那一遍都碰不到它(巡页前先 clearOverlays 收掉了)。390 上量到的读数一分不代表
       * 195:实测面板内宽只剩 113px,「修为」与「+46.39兆」并排时各自折成两行。
       * 故在收下之前把视口压到 195 量一遍,量完还原。
       */
      zoomSeen += 1;
      const scrollZoom = dialogZoomProblems(
        await measureDialogZoom(page, { width: 390, height: 844 }),
      );
      if (scrollZoom.length)
        failures.push(`[390-late] 归来卷轴在 200% 下坏了:${scrollZoom.join(" / ")}`);
      const take = page.locator(".modal-panel button", { hasText: /收\s*下/ }).first();
      if ((await take.count()) === 0) failures.push("[390] 后期档:归来卷轴没有「收下」");
      else {
        await take.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(700);
        if (await page.locator(".modal-panel").count())
          failures.push("[390] 后期档:点了「收下」归来卷轴没关掉");
      }
    }

    // (二)后期档逐页:与空档同一把尺子
    await page.evaluate(() => {
      for (const b of document.querySelectorAll(".pointer-events-none.fixed button")) b.click();
      Math.random = () => 1;
    });
    await page.waitForTimeout(400);
    for (const route of [
      "/",
      "/cultivation",
      "/adventure",
      "/inventory",
      "/character",
      "/celestial",
      "/souls",
      "/collection",
      "/build",
      "/dongfu",
    ]) {
      const rendered = await openRoute(page, route, 700);
      const info = await measurePage(page);
      checked += 1;
      if (rendered === 0) {
        failures.push(`[390-late] ${route} 页面没渲染出来 —— 这一页其实没量到`);
      }
      const problems = problemsOf(info);
      if (problems.length) failures.push(`[390-late] ${route} → ${problems.join(" / ")}`);
      const rail = await measureTabRail(page);
      const railFails = railProblems(rail);
      if (rail) checked += 1;
      if (railFails.length) failures.push(`[390-late] ${route} → ${railFails.join(" / ")}`);
    }

    /*
     * 妖气复聚那一行得真画出来,而且得说清"该怎么办"。
     *
     * 夹具里备着一处复聚的旧地界(luoxia)。这条判据存在的理由与「已靖」不同:
     * 已靖是安静的状态,复聚是**要玩家动手的状态** —— 只写「妖气复聚」而不写
     * 「再历一程即可复靖」,玩家看到的就是一处忽然变回锁着的地界(实测过同类抱怨)。
     */
    await page.goto(INDEX + "#/adventure", { waitUntil: "load" });
    await page.waitForTimeout(700);
    checked += 1;
    const reviveCard = await page.evaluate(() => {
      const card = [...document.querySelectorAll("[data-region-card]")].find((c) =>
        (c.innerText || "").includes("妖气复聚"),
      );
      return { found: Boolean(card), text: (card?.innerText || "").replace(/\s+/g, " ") };
    });
    if (!reviveCard.found) {
      failures.push("[390-late] 历练页:夹具里那处妖气复聚的旧地界没画出「妖气复聚」");
    } else {
      if (!reviveCard.text.includes("再历一程即可复靖")) {
        failures.push(
          "[390-late] 历练页:复聚那一行只说了「妖气复聚」,没说该怎么办(再历一程即可复靖)",
        );
      }
      if (!/出发/.test(reviveCard.text))
        failures.push("[390-late] 历练页:复聚的地界没有「出发」入口 —— 旧主回来却进不去");
    }

    /*
     * (三)在途秘境要真的推得动。
     *
     * 秘境这一整套此前只在单元用例里跑过 —— 界面上「再入一层」按下去会怎样,
     * 从没有人看过:点了没反应、刷不出战报、数字漏 NaN,都会静静留在这里。
     * 夹具身上带着一趟打到第二层的秘境,故这里真点一次:要么浮出战报,
     * 要么卡片状态前移(层数/败次/探尽),两者必有其一。
     */
    await page.goto(INDEX + "#" + "/adventure", { waitUntil: "load" });
    await page.waitForTimeout(800);
    checked += 1;
    const beforeText = await page.evaluate(() => document.querySelector("main")?.innerText || "");
    const fightAgain = page.locator("main button", { hasText: /再\s*入\s*一\s*层/ }).first();
    if ((await fightAgain.count()) === 0) {
      failures.push("[390-late] 历练页:在途秘境没有「再入一层」入口 —— 夹具的秘境没被读出来?");
    } else {
      await fightAgain.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(900);
      const after = await page.evaluate(() => ({
        text: document.querySelector("main")?.innerText || "",
        toasts: [...document.querySelectorAll(".pointer-events-none.fixed button")].map((b) =>
          (b.textContent || "").trim(),
        ),
      }));
      if (after.toasts.length === 0 && after.text === beforeText) {
        failures.push("[390-late] 历练页:点了「再入一层」既没战报也没变化(点了没反应)");
      }
      if (/NaN|undefined/.test(after.text + after.toasts.join(" ")))
        failures.push("[390-late] 历练页:秘境推进后漏出占位符");
      console.log(
        `  在途秘境推进一步:${after.toasts.length ? `战报「${after.toasts[0]?.slice(0, 26)}」` : "卡片状态前移"}` +
          `${after.toasts.length > 1 ? ` 等 ${after.toasts.length} 条` : ""}`,
      );
    }
    if (pageErrors.length)
      failures.push(`[390] 后期档页面异常:${[...new Set(pageErrors)].join(" | ")}`);

    /*
     * (四)在途远征也要真的走得动。
     *
     * 与秘境同理:远征这一套只在单元用例里跑过,界面上「第 N 重择路」按下去会怎样,
     * 从没有人看过。夹具身上带着一趟打到第二重的赤炎天远征(天界页会直接开在远征册上),
     * 故这里真点一次择路:要么浮出战报、要么行程点列前移,并查占位符与页面异常。
     */
    await page.goto(INDEX + "#" + "/celestial", { waitUntil: "load" });
    await page.waitForTimeout(900);
    checked += 1;
    const runBefore = await page.evaluate(() => document.querySelector("main")?.innerText || "");
    /*
     * 入口怎么认:两条路各自的按钮上写着「道源 +N」(层号那行是独立的文本,不在按钮里);
     * 若这一趟已经走到界主,入口换成「决战」。两者必有其一 —— 都找不到就是真没入口。
     */
    const pickNode = page.locator("main button", { hasText: /道源 \+\d+/ }).first();
    const runEntry =
      (await pickNode.count()) > 0
        ? pickNode
        : page.locator("main button", { hasText: /决\s*战/ }).first();
    if (!/远征 ·/.test(runBefore)) {
      failures.push("[390-late] 天界页:在途远征没有渲染出来(夹具的 worldRun 没被读出来?)");
    } else if ((await runEntry.count()) === 0) {
      failures.push("[390-late] 天界页:在途远征没有可推进一步的入口(既无择路也无决战)");
    } else {
      const clicked = ((await runEntry.textContent()) || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 18);
      await runEntry.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(900);
      const after = await page.evaluate(() => ({
        text: document.querySelector("main")?.innerText || "",
        toasts: [...document.querySelectorAll(".pointer-events-none.fixed button")].map((b) =>
          (b.textContent || "").trim(),
        ),
        // 打输会开战报弹窗(赢了只是行程点列前移,不开弹窗)
        report: (document.querySelector(".modal-panel h3")?.textContent || "").trim(),
      }));
      if (!after.report && after.toasts.length === 0 && after.text === runBefore) {
        failures.push("[390-late] 天界页:点了远征的推进入口既没战报也没变化(点了没反应)");
      }
      /*
       * 开出来的战报必须**叫得出这一界**:标题得在动手前取。
       * 从前先打后读 runWorld,而收尾那一场会把 worldRun 清空,标题就退成「远征」。
       */
      if (after.report && after.report !== "赤炎天") {
        failures.push(
          `[390-late] 天界页:远征战报弹窗标题是「${after.report}」,应为这一界的名字(赤炎天)`,
        );
      }
      if (/NaN|undefined/.test(after.text + after.toasts.join(" ") + after.report))
        failures.push("[390-late] 天界页:远征推进一步后漏出占位符");
      console.log(
        `  在途远征推进一步(点了「${clicked}」):` +
          (after.report
            ? `战报弹窗「${after.report}」`
            : after.toasts.length
              ? `战报「${after.toasts[0]?.slice(0, 24)}」`
              : "行程点列前移"),
      );
    }
    if (pageErrors.length)
      failures.push(`[390] 后期档页面异常(远征):${[...new Set(pageErrors)].join(" | ")}`);

    /*
     * (四续)天道试炼:第三条终局产线,同样只在单元用例里跑过。
     * 切到「试炼」册,真按一次应试,要求开出战报、且写清止步/功成与赏格、不漏占位符。
     */
    await page.goto(INDEX + "#" + "/celestial", { waitUntil: "load" });
    await page.waitForTimeout(900);
    // 上一步的远征战报还开着(它是一层遮罩),先收掉再切册 —— 否则点不动、还查不出原因
    const leftover = await clearOverlays(page);
    if (leftover.length)
      failures.push(`[390-late] 天界页:切试炼册前还开着浮层 —— ${leftover.join("、")}`);
    const trialTab = page.getByRole("tab", { name: /试\s*炼/ }).first();
    if ((await trialTab.count()) === 0) failures.push("[390-late] 天界页:找不到「试炼」册");
    else {
      await trialTab.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
      checked += 1;
      const trialBtn = page.locator("main button", { hasText: /应\s*试/ }).first();
      if ((await trialBtn.count()) === 0)
        failures.push("[390-late] 试炼册里没有「应试」入口(判据没跑到东西)");
      else {
        const trialName = ((await trialBtn.textContent()) || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 20);
        await trialBtn.click({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(2200);
        const after = await page.evaluate(() => {
          const panel = document.querySelector(".modal-panel");
          const text = panel?.innerText || "";
          return {
            title: (panel?.querySelector("h3")?.textContent || "").trim(),
            text: text.replace(/\n+/g, " ").slice(0, 90),
            rows: panel ? panel.querySelectorAll("p, li").length : 0,
            leaks: /NaN|undefined|Infinity/.test(text),
          };
        });
        if (!after.title) failures.push(`[390-late] 试炼:点了「${trialName}」没有开出战报`);
        else {
          // 战报的两种口径:全捷(打通)或止步第 N 战
          if (!/全捷|止步第/.test(after.text))
            failures.push(`[390-late] 试炼:战报没写清结果 —— ${after.text}`);
          if (after.leaks) failures.push("[390-late] 试炼:战报漏出占位符");
          console.log(
            `  天道试炼(点了「${trialName}」):战报「${after.title}」· ${after.text.slice(0, 34)}…`,
          );
          await page.keyboard.press("Escape");
          await page.waitForTimeout(400);
        }
      }
    }
    if (pageErrors.length)
      failures.push(`[390] 后期档页面异常(试炼):${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();

    /*
     * (五)同一份后期档在 320 窄屏再过一遍。
     *
     * 主巡页在 320 量的是刚建号的空档(数字短、内容少);「长数字 + 满屏内容 + 最窄屏」
     * 这个组合此前没量过,而这正是最容易撑破的地方(实测当前全绿,故这一条是防回归)。
     */
    {
      const narrow = await auditContext({
        viewport: { width: 320, height: 568 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      });
      await narrow.addInitScript((decisivePayload) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(decisivePayload)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      }, latePayload);
      const p = await narrow.newPage();
      const errs = [];
      watchPageErrors(p, errs);
      await p.goto(INDEX, { waitUntil: "load" });
      await p.waitForTimeout(2400);
      await clearOverlays(p);
      /*
       * 归来卷轴是 :closable="false" 的 —— clearOverlays 按 Esc 关不掉它。
       *
       * 这份夹具的 lastActiveAt 在 9 小时前,所以**每个**新 context 一开都会弹它。
       * 390 那一遍在开头点了「收下」,320 这一遍从前没点:于是整轮巡页都隔着一层
       * 遮罩在量,量到的是卷轴自己(它的行在 195 宽下把「回收化尘」挤成竖排),
       * 页面本体一次都没被量到。判据绿得毫无信息,比红更糟。
       */
      const dismiss = p.locator(".modal-panel button", { hasText: /收\s*下/ }).first();
      if ((await dismiss.count()) > 0) {
        await dismiss.click({ timeout: 3000 }).catch(() => {});
        await p.waitForTimeout(500);
      }
      if ((await p.locator(".modal-panel").count()) > 0) {
        const title = await p.evaluate(
          () => document.querySelector(".modal-panel")?.getAttribute("aria-label") ?? "?",
        );
        failures.push(`[320-late] 开局浮层没关掉(「${title}」)—— 这一轮量的不是页面本体`);
      }
      for (const route of ROUTES) {
        const rendered = await openRoute(p, route, 600);
        const info = await measurePage(p);
        checked += 1;
        if (rendered === 0) {
          failures.push(`[320-late] ${route} 页面没渲染出来 —— 这一页其实没量到`);
        }
        const problems = problemsOf(info);
        if (problems.length) failures.push(`[320-late] ${route} → ${problems.join(" / ")}`);
      }
      if (errs.length) failures.push(`[320] 后期档页面异常:${[...new Set(errs)].join(" | ")}`);
      /*
       * 同一份后期档再过一遍 200% 缩放档。
       *
       * 主巡页那一遍量的是**空档**:数字短、内容少。而 195 CSS px 上最容易出事的是
       * 「长数字 + 满屏内容」—— 神人境的九位数灵石、成套装备、在途秘境,全挤在
       * 195 宽里。这与 320 那一遍是同一个理由(空档量不出满屏内容),只是那一遍的
       * 视口还没窄到 195。两遍共用同一把尺子(measurePage + zoomProblems)。
       *
       * 放在 320 那一遍之后:这一遍会把视口改成 390 再折半(195),量完 context 即关。
       */
      for (const route of ROUTES) {
        const rendered = await openRoute(p, route, 600);
        const zoom = await measureZoomScale(p, { width: 390, height: 844 });
        zoomSeen += 1;
        if (rendered === 0) {
          zoomFails.push(`[390-late] ${route} → 页面没渲染出来,缩放档其实没量到`);
        }
        const zoomBad = zoomProblems(zoom, "390");
        if (zoomBad.length) zoomFails.push(`[390-late] ${route} → ${zoomBad.join(" / ")}`);
      }
      await narrow.close();
    }
  }

  if (zoomFails.length) failures.push(`200% 缩放档上版面坏了(后期档):${zoomFails.join(" | ")}`);
  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 渡劫突破真打一次 */
async function taskTribulation() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第十一件事:渡劫突破真打一次(一局里最要紧的那一屏,此前没人画过) ----
  /*
   * 突破结果弹窗(成功/失败、渡劫雷数与「寿元增至」那一行)是每个玩家都会反复看的屏,
   * 而它从来没被无头浏览器渲染过 —— 空档修为不满,按钮是灰的;后期档又未必卡在大关上。
   * 故另起一份「炼气圆满」的夹具:修为与灵气给足、寿元留够,点「引 劫 突 破」真打一次。
   * 渡劫成不成是随机的,故判据只看**形状**:必须开出结果弹窗,写清成败与境界去向,
   * 失败不许漏占位符,成功要与页面上的境界对得上。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      // 炼气·圆满(大关)+ 修为灵气给足 + 寿元留够(寿元已尽会被「寿元将尽」截住)
      player: {
        major: 0,
        sub: 9,
        exp: gn(9, 30),
        age: 16,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 30,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "fire", aptitude: 90 }],
          gradeName: "单灵根",
          growthMult: 1.2,
        },
      },
      resources: {
        spiritStone: gn(3, 6),
        qi: 9999999,
        wudao: 300,
        herb: 400,
        ore: 400,
        page: 90,
        dust: 120,
      },
      inventory: { items: [], equipped: {}, pills: {}, artifacts: [], equippedArtifacts: [] },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`xuanshu.${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#" + "/cultivation", { waitUntil: "load" });
    await page.waitForTimeout(2200);
    await clearOverlays(page);
    checked += 1;
    const tribBtn = page.locator("main button", { hasText: /引\s*劫\s*突\s*破/ }).first();
    if ((await tribBtn.count()) === 0) {
      failures.push(
        "[390] 渡劫场景:修为灵气给足、卡在炼气圆满,却没出现「引劫突破」(判据没跑到东西)",
      );
    } else {
      await tribBtn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(1600);
      const view = await page.evaluate(() => {
        // 只认**突破结果**那一扇:屏幕上可能同时浮着别的(顿悟/巡游),拿错扇就诊断错人
        const panels = [...document.querySelectorAll(".modal-panel")];
        const panel = panels.find((p) => /突破成功|突破失败/.test(p.innerText || "")) ?? null;
        const text = panel?.innerText || "";
        return {
          found: !!panel,
          // 没开出来时,把「此刻开着的到底是谁」写进报告 —— 上一次注入就是靠这句才能一眼看懂
          others: panels
            .map((p) =>
              (
                p.querySelector("h3")?.textContent ||
                p.getAttribute("aria-label") ||
                "无标题"
              ).trim(),
            )
            .join("、"),
          text,
          label: panel?.getAttribute("aria-label") ?? null,
          outcome: /突破成功/.test(text) ? "成功" : /突破失败/.test(text) ? "失败" : null,
          hasWave: /共\s*\d+\s*道/.test(text),
          // 页面上当前境界(成功之后应当已经换名)
          realm: (document.body.innerText.match(/炼气|筑基/) || [""])[0],
        };
      });
      if (!view.found)
        failures.push(
          `[390] 渡劫场景:点了「引劫突破」没有开出结果弹窗(此刻开着的是:${view.others || "无"})`,
        );
      if (view.found) {
        if (!view.outcome)
          failures.push(`[390] 渡劫场景:结果弹窗没写清成败 —— ${view.text.slice(0, 40)}`);
        if (!view.hasWave) failures.push("[390] 渡劫场景:渡劫结果里没有雷数(「共 N 道」)");
        if (/NaN|undefined|Infinity/.test(view.text))
          failures.push("[390] 渡劫场景:结果弹窗漏出占位符");
        if (view.outcome === "成功" && view.realm !== "筑基") {
          failures.push(`[390] 渡劫场景:弹窗说成功,页面上的境界却还是「${view.realm}」`);
        }
        /*
         * 这一屏也要过 200% 那一档:它只在渡劫那一刻出现,主巡页与缩放档都碰不到。
         * 突破结果里最长的是「共 N 道」那一段与逐道天雷的记述 —— 正是 195 宽上
         * 最容易折成一字一行的那一类。
         */
        zoomSeen += 1;
        const tribZoom = dialogZoomProblems(
          await measureDialogZoom(page, { width: 390, height: 844 }),
        );
        if (tribZoom.length) failures.push(`[390] 渡劫结果在 200% 下坏了:${tribZoom.join(" / ")}`);
        const close = page.locator(".modal-panel button", { hasText: /继续问道|收拾心情/ }).first();
        if ((await close.count()) === 0) failures.push("[390] 渡劫场景:结果弹窗没有收尾按钮");
        else {
          await close.click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(600);
          if (await page.locator(".modal-panel").count())
            failures.push("[390] 渡劫场景:点了收尾按钮弹窗没关掉");
        }
      }
      console.log(
        `\n渡劫突破:${view.outcome ?? "(没写成败)"} · 雷数${view.hasWave ? "有" : "缺"} · 页面境界 ${view.realm}`,
      );
    }
    if (pageErrors.length)
      failures.push(`[390] 渡劫场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 走完一次转世 */
async function taskReincarnation() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第十二件事:走完一次转世(寿元将尽 → 此生已矣 → 轮回 → 新的一世) ----
  /*
   * 转世是每一世收官的那套仪式,也是**唯一会把存档推倒重来**的流程 ——
   * 三步弹窗 + 择姿立题 + 新的一世,此前一步都没被真浏览器走过。
   * 夹具把寿元写尽(一读档引擎就判定身故),然后一路点下去。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now() - 86400000 * 60,
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        major: 5,
        sub: 3,
        exp: gn(2, 7),
        age: 99999,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 1,
          daoFruit: 9,
          talents: [],
          insight: 120,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "fire", aptitude: 90 }],
          gradeName: "单灵根",
          growthMult: 1.2,
        },
      },
      resources: {
        spiritStone: gn(4, 6),
        qi: 4000,
        wudao: 500,
        herb: 300,
        ore: 300,
        page: 60,
        dust: 80,
      },
      inventory: { items: [], equipped: {}, pills: {}, artifacts: [], equippedArtifacts: [] },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`xuanshu.${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX, { waitUntil: "load" });
    await page.waitForTimeout(2600);
    /*
     * 钉死随机源、收掉提示条 —— 但**不要**去关弹窗:这一屏正开着「寿元将尽」,
     * 它就是本场景的起点(而且它故意不可关)。钉随机的用意是免得引擎在转世途中
     * 掷出一个顿悟/巡游浮层,把「关没关干净」的判据搅红(实测偶发)。
     */
    await page.evaluate(() => {
      for (const b of document.querySelectorAll(".pointer-events-none.fixed button")) b.click();
      Math.random = () => 1;
    });
    await page.waitForTimeout(400);

    /** 读一扇弹窗的形状:标题、正文、按钮、有没有漏占位符 */
    const readPanel = () =>
      page.evaluate(() => {
        const p = document.querySelector(".modal-panel");
        if (!p) return null;
        return {
          title: (p.querySelector("h3")?.textContent || p.getAttribute("aria-label") || "").trim(),
          text: (p.innerText || "").replace(/\n+/g, " "),
          buttons: [...p.querySelectorAll("button")].map((b) => (b.textContent || "").trim()),
        };
      });
    const step = async (label, expect) => {
      checked += 1;
      const p = await readPanel();
      if (!p) {
        failures.push(`[390] 转世场景:${label}没有弹出对应的窗`);
        return null;
      }
      if (!expect.test(p.title))
        failures.push(`[390] 转世场景:${label}的窗标题是「${p.title}」,不是预期的${expect}`);
      if (/NaN|undefined|Infinity/.test(p.text))
        failures.push(`[390] 转世场景:${label}漏出占位符 —— ${p.text.slice(0, 50)}`);
      /*
       * 三步都要过 200% 那一档:转世是**唯一会把存档推倒重来**的仪式,而这三扇窗
       * 只在这条流程里出现 —— 主巡页与缩放档都碰不到,版面坏了也不会有人知道。
       */
      zoomSeen += 1;
      const stepZoom = dialogZoomProblems(
        await measureDialogZoom(page, { width: 390, height: 844 }),
      );
      if (stepZoom.length)
        failures.push(`[390] 转世「${label}」在 200% 下坏了:${stepZoom.join(" / ")}`);
      return p;
    };

    const death = await step("读档后(身故)", /寿元将尽/);
    if (death && !/兵解转世/.test(death.buttons.join(" ")))
      failures.push("[390] 转世场景:身故那屏没有「兵解转世」");
    await page
      .locator(".modal-panel button", { hasText: /兵\s*解\s*转\s*世/ })
      .first()
      .click({ timeout: 3000 })
      .catch(() => {});
    await page.waitForTimeout(900);

    const review = await step("兵解后(回顾)", /此生已矣/);
    if (review && !/宿慧/.test(review.text)) failures.push("[390] 转世场景:回顾那一程没有交代宿慧");
    await page
      .locator(".modal-panel button", { hasText: /往\s*生/ })
      .first()
      .click({ timeout: 3000 })
      .catch(() => {});
    await page.waitForTimeout(800);

    const next = await step("往生后(择姿立题)", /轮回/);
    if (next && !/道果/.test(next.text)) failures.push("[390] 转世场景:轮回那一程没有交代道果");
    // 有先天之姿就先择一个(不择则「踏入轮回」是灰的)。
    // 按「赋」拣天赋卡,别按第一个按钮:轮回页上新晋了「道号重拟」的「换一个」
    // (在天赋区之前),抓第一个按钮会点偏到改名上,天赋没选上、按钮一直是灰的。
    const talent = page.locator(".modal-panel button", { hasText: /天赋|道赋|灵赋|凡赋/ }).first();
    if (next && next.buttons.some((b) => /赋|姿/.test(b)))
      await talent.click({ timeout: 3000 }).catch(() => {});
    const confirm = page.locator(".modal-panel button", { hasText: /踏\s*入\s*轮\s*回/ }).first();
    if ((await confirm.count()) === 0) failures.push("[390] 转世场景:轮回那程没有「踏入轮回」");
    else {
      if (await confirm.isDisabled())
        failures.push("[390] 转世场景:择了先天之姿,「踏入轮回」仍是灰的");
      await confirm.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(1800);
      const after = await page.evaluate(() => ({
        // 判据是「转世那几扇窗关干净了」,不是「一扇窗都没有」——新的一世里
        // 引擎随时可能浮出顿悟/巡游,那是正常玩法,不该被算作转世没走完
        rebirthStillOpen: [...document.querySelectorAll(".modal-panel")]
          .map((p) =>
            (p.querySelector("h3")?.textContent || p.getAttribute("aria-label") || "").trim(),
          )
          .filter((t) => /寿元将尽|此生已矣|轮回/.test(t)),
        text: (document.querySelector("main")?.innerText || "").replace(/\n+/g, " ").slice(0, 200),
      }));
      if (after.rebirthStillOpen.length)
        failures.push(
          `[390] 转世场景:点「踏入轮回」之后还留着转世的窗 —— ${after.rebirthStillOpen.join("、")}`,
        );
      if (/炼虚|99999/.test(after.text))
        failures.push("[390] 转世场景:转世之后页面上还写着上一世的境界/寿数");
      console.log(
        `\n转世:${[death?.title, review?.title, next?.title].filter(Boolean).join(" → ")} → 新的一世(${after.text.slice(0, 24)}…)`,
      );
    }
    if (pageErrors.length)
      failures.push(`[390] 转世场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 挂机真的在挂着跑 */
async function taskIdleTick() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第十三件事:挂机游戏真的在挂着跑(页面上的数自己在涨) ----
  /*
   * 引擎每秒推进修为、灵气与洞府产出 —— 这是放置玩法的根,可此前没有被端到端看过一眼:
   * 单元用例直接调引擎,而「应用启动之后引擎到底跑起来没有」只有真浏览器能答。
   * 若哪天 engine.start() 被条件挡住、或 tick 被谁掐了,界面会安静地冻在那里,
   * 而所有单测照样全绿。故这里真等两轮:灵气只给 1 点,看它自己涨不涨。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: { spiritStone: gn(1, 5), qi: 1, wudao: 10, herb: 5, ore: 5, page: 2, dust: 2 },
      inventory: { items: [], equipped: {}, pills: {}, artifacts: [], equippedArtifacts: [] },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`xuanshu.${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX, { waitUntil: "load" });
    await page.waitForTimeout(2200);
    await clearOverlays(page);
    checked += 1;
    /** 读顶栏灵气:文本按 formatGN 的档位(万/亿/兆…)还原成数值 */
    const readQi = () => readFormatted(page, "灵气");
    const first = await readQi();
    await page.waitForTimeout(3200);
    const second = await readQi();
    await page.waitForTimeout(3200);
    const third = await readQi();
    const nums = [first.value, second.value, third.value];
    if (nums.some((v) => v === null || !Number.isFinite(v))) {
      failures.push(
        `[390] 挂机场景:顶栏灵气读数解析不出来 —— ${[first, second, third].map((x) => x.text).join(" / ")}`,
      );
    } else if (!(nums[2] > nums[0] && nums[0] <= nums[1] && nums[1] <= nums[2])) {
      // 判据是「一直在涨、至少涨了一截」——不要求每步都严格变大:灵气涨到上限会平下来
      failures.push(
        `[390] 挂机场景:灵气没有在涨(页面上的数冻住了 —— 引擎没跑?) ${nums.join(" → ")}`,
      );
    } else {
      console.log(
        `\n挂机 6 秒:灵气 ${first.text} → ${second.text} → ${third.text}(页面上的数自己在涨)`,
      );
    }
    if (pageErrors.length)
      failures.push(`[390] 挂机场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 存档导出/导入往返 */
async function taskSaveRoundTrip() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第十四件事:导出 → 改动 → 导入回来(存档备份这条路真的走得通吗) ----
  /*
   * 「存档只在本地」是这个游戏反复向玩家交代的一条(设置页也这么写),故「导出备份、
   * 事后导入救回来」是最后一道保险。单元用例测过 payload 的形状,却没人真按过这两个按钮:
   * 下载走的是 Blob + a[download],导入走 FileReader + 校验 + 写盘 + 重载,
   * 任何一环断了,玩家都要等到真丢档那天才知道。
   *
   * 判据用**不会自己变的数**(灵石;夹具里没有洞府产出):
   *   导出时的灵石 S0 → 投一点灵脉把灵石花掉(S1 < S0)→ 导入 → 必须回到 S0。
   *
   * 坑记一笔:这种会触发重载的场景,夹具**必须只种一次**
   * (addInitScript 每次导航都会跑,不加闸就会在重载时把刚导入的存档盖回夹具 —— 实测踩过)。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      acceptDownloads: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "存读自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: { spiritStone: gn(1, 6), qi: 1000, wudao: 10, herb: 5, ore: 5, page: 2, dust: 2 },
      inventory: { items: [], equipped: {}, pills: {}, artifacts: [], equippedArtifacts: [] },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`xuanshu.${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const savePath = "/tmp/layout-roundtrip.save";
    /** 磁盘上那一份灵石(解密 resources 分片;GNum 是 m×10^e) */
    const storedStone = async () => {
      const cipher = await page.evaluate(() => localStorage.getItem("xuanshu.resources") || "");
      if (!cipher) return null;
      const plain = decryptSlice(cipher);
      if (!plain) return null;
      const v = JSON.parse(plain).spiritStone;
      return typeof v === "number" ? v : v.m * Math.pow(10, v.e);
    };
    await page.goto(INDEX + "#" + "/settings", { waitUntil: "load" });
    await page.waitForTimeout(2200);
    await clearOverlays(page);
    checked += 1;
    const s0 = await readFormatted(page, "灵石");
    let downloaded = "";
    try {
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 8000 }),
        page
          .getByRole("button", { name: /导出存档/ })
          .first()
          .click(),
      ]);
      downloaded = download.suggestedFilename();
      await download.saveAs(savePath);
    } catch (err) {
      failures.push(
        `[390] 存读场景:点「导出存档」没有拿到下载(${String(err).split("\n")[0]?.slice(0, 60)})`,
      );
    }
    if (downloaded && !downloaded.endsWith(".save"))
      failures.push(`[390] 存读场景:导出的文件名不像存档(${downloaded})`);

    // 动一下不会自己变的数:投一点灵脉,把灵石花掉
    await page.goto(INDEX + "#" + "/dongfu", { waitUntil: "load" });
    await page.waitForTimeout(900);
    await page
      .getByRole("button", { name: /灵脉投资/ })
      .first()
      .click({ timeout: 3000 })
      .catch(() => {});
    await page.waitForTimeout(400);
    const invest = page.locator(".modal-panel button.btn-ghost:not([disabled])").first();
    let spent = null;
    if ((await invest.count()) === 0)
      failures.push("[390] 存读场景:灵脉弹窗里没有可投的脉(判据没跑到东西)");
    else {
      await invest.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(700);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      spent = await readFormatted(page, "灵石");
      if (!(spent.value < s0.value)) {
        failures.push(
          `[390] 存读场景:投了灵脉灵石却没少(${s0.text} → ${spent.text}),后面的导入就证明不了什么`,
        );
      }
      /*
       * 关键一步:等节流把这次改动**真写进磁盘**再导入。
       * 否则「导入后回到 S0」与「压根没写进去」在读数上分不出来 —— 注入验证时正是这么骗过判据的
       * (跳掉导入落盘,状态照样显示 100万,因为那次投入还躺在待刷队列里)。
       */
      await page.waitForTimeout(5600);
      const onDisk = await storedStone();
      if (
        spent.value !== null &&
        (onDisk === null || Math.abs(onDisk - spent.value) > spent.value * 0.01)
      ) {
        failures.push(
          `[390] 存读场景:投入之后磁盘上的灵石是 ${onDisk},页面上是 ${spent.text} —— 改动没落盘,这条判据没搭对`,
        );
      }
    }

    // 导入回来:应当回到导出那一刻(灵石回到 S0)
    await page.goto(INDEX + "#" + "/settings", { waitUntil: "load" });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      window.__beforeImport = "alive";
      window.name = "";
      const captureToasts = () => {
        const text = [...document.querySelectorAll(".pointer-events-none.fixed button")]
          .map((button) => (button.textContent || "").trim())
          .filter(Boolean)
          .join("|");
        if (text) window.name = `__layoutImportToasts:${text}`;
      };
      new MutationObserver(captureToasts).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      captureToasts();
    });
    await page.locator("input[type=file]").first().setInputFiles(savePath);
    await page.waitForTimeout(500);
    // 导入是「整体替换本机进度」的不可逆操作 —— 与重置同纪律,先弹确认,点「用这份替换」才落库。
    // 判据仍盯着原来的事(成功提示 + 重新入定 + 灵石回到导出那一刻),只是要穿过这扇确认门。
    await page.getByRole("button", { name: /用这份替换/ }).click();
    await page.waitForTimeout(3000);
    /*
     * 成功提示只活到 800ms 后的 reload;并发一忙,固定等 700ms 再回读时页面
     * 可能已经重载,提示随旧文档一起没了。导入成功又刚好会调用 sealStorageWrites()
     * 封掉 Storage.prototype.setItem,故记录放 window.name —— 跨导航留得住,
     * 也不受封存影响,验的仍是玩家真看见过的那一句。
     */
    const toast = await page.evaluate(() => {
      const prefix = "__layoutImportToasts:";
      return window.name.startsWith(prefix) ? window.name.slice(prefix.length) : "";
    });
    const after = await readFormatted(page, "灵石");
    const reloaded = await page.evaluate(() => window.__beforeImport === undefined);
    if (!/导入成功/.test(toast))
      failures.push(`[390] 存读场景:导入没有成功提示(${toast || "无提示"})`);
    if (!reloaded)
      failures.push("[390] 存读场景:导入之后没有重新入定(页面没重载,内存里还是旧的一世)");
    if (spent && after.value !== null && Math.abs(after.value - s0.value) > s0.value * 0.001) {
      failures.push(`[390] 存读场景:导入后灵石 ${after.text},导出时是 ${s0.text}(存档没救回来)`);
    }
    const diskAfter = await storedStone();
    if (spent && diskAfter !== null && Math.abs(diskAfter - s0.value) > s0.value * 0.001) {
      failures.push(
        `[390] 存读场景:导入后磁盘上的灵石是 ${diskAfter},导出时是 ${s0.value}(写盘那份没换回来)`,
      );
    }
    if (pageErrors.length)
      failures.push(`[390] 存读场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    console.log(
      `\n存读往返:导出时 ${s0.text} → 投脉后 ${spent?.text ?? "(没投成)"} → 导入后 ${after.text}`,
    );
    rmSync(savePath, { force: true });
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 智能收纳不扔有投入的件 */
async function taskSmartKeep() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第二十六件事:智能收纳不替玩家扔「有投入的件」 ----
  /*
   * 智能收纳卖的是「替你分辨值得留的」,而它此前只认品质/流派核心词条/组合技部件 ——
   * 于是三类明明该留的件会被当垃圾:练过的(+N / 重铸 / 封存)、成套共鸣件、词条近满件。
   * 「一键清理行囊」更狠:一按就把它们全化尘,连一次确认都只报个总数,玩家事后才知道少了什么。
   * 判据按玩家真按的两个按钮核:
   *   一 清理确认框写的件数 = 该清的件数(夹具 5 件里只有 2 件是废物);
   *   二 点下去之后,留下的正好是那 3 件有投入的(行囊 5 → 3),且练过那件的「+3」还在。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "收纳自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: { spiritStone: gn(1, 6), qi: 1000, wudao: 10, herb: 5, ore: 5, page: 2, dust: 0 },
      inventory: {
        items: [
          // 两件该走的:凡品、不带套、没词条 / 或词条拉胯
          { uid: "j1", templateId: "b_qingyun", quality: "mortal", tier: 3, level: 0, affixes: [] },
          {
            uid: "j2",
            templateId: "b_qingyun",
            quality: "mortal",
            tier: 3,
            level: 0,
            affixes: [{ id: "atk1", roll: 0.12 }],
          },
          // 三件该留的:练过(有投入)/ 成套共鸣 / 词条条条近满
          {
            uid: "k_lv",
            templateId: "b_qingyun",
            quality: "mortal",
            tier: 3,
            level: 3,
            affixes: [],
            invested: { dust: 40, stone: gn(2, 3) },
          },
          {
            uid: "k_set",
            templateId: "w_xuantie",
            quality: "mortal",
            tier: 3,
            level: 0,
            affixes: [],
          },
          {
            uid: "k_roll",
            templateId: "h_muzan",
            quality: "mortal",
            tier: 3,
            level: 0,
            affixes: [
              { id: "atk1", roll: 0.95 },
              { id: "def1", roll: 0.9 },
            ],
          },
        ],
        equipped: {},
        pills: {},
        artifacts: [],
        equippedArtifacts: [],
      },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: {
          enabled: true,
          minQuality: 3,
          keepCoreAffix: true,
          keepComboPiece: true,
          keepPerfectRolls: true,
          keepSetPiece: true,
        },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`xuanshu.${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#" + "/inventory", { waitUntil: "load" });
    await page.waitForTimeout(2400);
    await clearOverlays(page);
    checked += 1;
    const bagCount = () =>
      page.evaluate(() => {
        const raw = document
          .querySelector("[data-inventory-bag-count]")
          ?.getAttribute("data-inventory-bag-count");
        return raw === null || raw === undefined ? null : Number(raw);
      });
    const opened = await page
      .locator("main button", { hasText: /收纳/ })
      .first()
      .click({ timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (!opened) failures.push("[390] 收纳场景:行囊页找不到「收纳」入口");
    else {
      await page.waitForTimeout(400);
      const before = await bagCount();
      if (before !== 5) failures.push(`[390] 收纳场景:夹具没铺好 —— 开局行囊 ${before} 件(应为 5)`);
      const armed = await page
        .locator(".modal-panel button", { hasText: /依此规则清理行囊/ })
        .first()
        .click({ timeout: 3000 })
        .then(() => true)
        .catch(() => false);
      if (!armed) failures.push("[390] 收纳场景:找不到「依此规则清理行囊」按钮");
      await page.waitForTimeout(300);
      const warn = await page.evaluate(() =>
        (document.querySelector(".modal-panel")?.innerText || "").replace(/\n+/g, " "),
      );
      const promisedCount = Number((/共\s*(\d+)\s*件/.exec(warn) || [])[1] ?? NaN);
      if (promisedCount !== 2) {
        failures.push(
          `[390] 收纳场景:该清的只有 2 件废物,确认框写的是 ${promisedCount} 件 —— 练过/成套/近满的件被算进了清理名单(${warn.slice(0, 90)})`,
        );
      }
      await page
        .locator(".modal-panel button", { hasText: /清理化尘/ })
        .first()
        .click({ timeout: 3000 })
        .catch(() => {});
      await page.waitForTimeout(900);
      const after = await bagCount();
      const body = await page.evaluate(() =>
        (document.querySelector("main")?.innerText || "").replace(/\n+/g, " "),
      );
      const toast = await page.evaluate(() =>
        [...document.querySelectorAll(".pointer-events-none.fixed button")]
          .map((b) => (b.textContent || "").trim())
          .join("|"),
      );
      if (after !== 3)
        failures.push(`[390] 收纳场景:清理后行囊剩 ${after} 件(应为 3 —— 那 3 件有投入的必须留下)`);
      if (!/收纳毕:2 件/.test(toast))
        failures.push(`[390] 收纳场景:清理后的交代不对(${toast || "无提示"})`);
      for (const [uid, name] of [
        ["k_set", "玄铁重剑"],
        ["k_roll", "桃木簪"],
      ]) {
        if (!body.includes(name)) failures.push(`[390] 收纳场景:${name}(${uid})被自动清理了`);
      }
      if (!/\+3/.test(body)) failures.push("[390] 收纳场景:练过的那件(+3)被自动清理了");
      if (after === 3 && promisedCount === 2) {
        console.log(
          `\n智能收纳:行囊 5 件 → 确认框「共 ${promisedCount} 件」→ 清理后 ${after} 件(练过/成套/近满三件都留下)`,
        );
      }
    }
    if (pageErrors.length)
      failures.push(`[390] 收纳场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 背包先报本次新得与真正会动的换装槽位 */
async function taskInventoryAttention() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const slices = showcaseSlices("light");
    const newUids = ["attention_w", "shot_w", "bag_r", "bag_n", "bag_bo"];
    const items = [
      ...slices.inventory.items,
      {
        uid: "attention_w",
        templateId: "w_xuantie",
        quality: "divine",
        tier: 20,
        level: 0,
        affixes: [],
      },
    ];
    const { head: _emptyHead, ...equipped } = slices.inventory.equipped;
    slices.inventory = {
      ...slices.inventory,
      items,
      equipped,
      // 五件新得压过旧藏;佩戴中的新武器也保留「新」,与底导读数同源。
      seenUids: items.filter((it) => !newUids.includes(it.uid)).map((it) => it.uid),
      seenSeeded: true,
    };
    await seedSave(ctx, slices, "__inventoryAttentionFixture");

    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const textLength = await openRoute(page, "/inventory", 800);
    if (textLength === 0) failures.push("[390] 背包新得场景:页面没有渲染出来");
    await clearOverlays(page);

    const read = () =>
      page.evaluate(() => {
        const overview = document.querySelector("[data-inventory-overview]");
        const list = document.querySelector("[data-inventory-scope]");
        const cards = [...document.querySelectorAll("main button[data-uid]")];
        const oneClick = [...document.querySelectorAll("main button")].find((button) =>
          /一键 ·|已无可换之器/.test(button.textContent || ""),
        );
        const upgradeSlots = [...document.querySelectorAll("[data-inventory-upgrade-slot]")]
          .map((button) => button.getAttribute("data-inventory-upgrade-slot"))
          .filter((slot) => !!slot)
          .sort((a, b) => a.localeCompare(b));
        const markedSlots = [...document.querySelectorAll("[data-equip-upgrade]")]
          .map((button) => button.getAttribute("data-equip-upgrade"))
          .filter((slot) => !!slot)
          .sort((a, b) => a.localeCompare(b));
        return {
          newCount: Number(overview?.getAttribute("data-inventory-new-count")),
          upgradeCount: Number(overview?.getAttribute("data-inventory-upgrade-count")),
          scope: list?.getAttribute("data-inventory-scope") ?? null,
          visibleTotal: Number(list?.getAttribute("data-inventory-total")),
          cards: cards.map((card) => card.getAttribute("data-uid")),
          newCards: cards
            .filter((card) => card.getAttribute("data-equipment-new") === "true")
            .map((card) => card.getAttribute("data-uid")),
          upgradeSlots,
          markedSlots,
          oneClick: {
            disabled: oneClick?.hasAttribute("disabled") ?? true,
            text: (oneClick?.textContent || "").replace(/\s+/g, " ").trim(),
          },
        };
      });

    const initial = await read();
    const expectedFirst = ["attention_w", "shot_w", "bag_r", "bag_n", "bag_bo"];
    checked += 1;
    if (initial.newCount !== newUids.length) {
      failures.push(
        `[390] 背包新得场景:卷首应报 ${newUids.length} 件新得,实见 ${initial.newCount}`,
      );
    }
    if (
      initial.scope !== "all" ||
      initial.visibleTotal !== items.length ||
      initial.cards.length === 0
    ) {
      failures.push(
        `[390] 背包新得场景:全部藏品范围不对(scope ${initial.scope} / ` +
          `total ${initial.visibleTotal} / cards ${initial.cards.length},应 ${items.length})`,
      );
    }
    if (initial.cards.slice(0, expectedFirst.length).join(",") !== expectedFirst.join(",")) {
      failures.push(
        `[390] 背包新得场景:新得没有整体置顶 —— 首批 ${initial.cards
          .slice(0, expectedFirst.length)
          .join(",")}(应 ${expectedFirst.join(",")})`,
      );
    }
    if (initial.newCards.length !== newUids.length) {
      failures.push(
        `[390] 背包新得场景:卡片「新」角标 ${initial.newCards.length} 件,卷首报 ${initial.newCount} 件`,
      );
    }
    if (
      initial.upgradeCount < 2 ||
      initial.upgradeSlots.length !== initial.upgradeCount ||
      initial.markedSlots.join(",") !== initial.upgradeSlots.join(",")
    ) {
      failures.push(
        `[390] 背包换装场景:卷首报价 ${initial.upgradeCount} 槽 / 逐槽入口 ` +
          `${initial.upgradeSlots.join(",") || "无"} / 槽位标记 ${initial.markedSlots.join(",") || "无"}`,
      );
    }
    if (!initial.oneClick.text.includes(`换上 ${initial.upgradeCount} 槽最强`)) {
      failures.push(
        `[390] 背包换装场景:一键按钮没有报出 ${initial.upgradeCount} 槽(«${initial.oneClick.text}»`,
      );
    }

    await page.locator("[data-inventory-new-toggle]").click({ timeout: 3000 });
    await page.waitForFunction(
      () =>
        document.querySelector("[data-inventory-scope]")?.getAttribute("data-inventory-scope") ===
        "new",
      { timeout: 3000 },
    );
    await settleVisuals(page);
    const filtered = await read();
    checked += 1;
    if (
      filtered.visibleTotal !== newUids.length ||
      filtered.cards.length !== newUids.length ||
      filtered.newCards.length !== newUids.length
    ) {
      failures.push(
        `[195] 只看新得应只铺 ${newUids.length} 件,实见 total ${filtered.visibleTotal} / ` +
          `cards ${filtered.cards.length} / 带新角标 ${filtered.newCards.length}`,
      );
    }

    await page.locator("[data-inventory-new-toggle]").click({ timeout: 3000 });
    await page.waitForFunction(
      () =>
        document.querySelector("[data-inventory-scope]")?.getAttribute("data-inventory-scope") ===
        "all",
      { timeout: 3000 },
    );
    await settleVisuals(page);
    zoomSeen += 1;
    const zoom = await measureZoomScale(page, { width: 390, height: 844 });
    const zoomBad = zoomProblems(zoom, "390");
    if (zoomBad.length) failures.push(`[195] 背包新得卷首与藏品册 → ${zoomBad.join(" / ")}`);

    const firstUpgrade = page.locator("[data-inventory-upgrade-slot]").first();
    const firstUpgradeSlot = await firstUpgrade.getAttribute("data-inventory-upgrade-slot");
    if (!firstUpgradeSlot) {
      failures.push("[195] 背包换装场景:卷首没有可动槽入口 —— 判据没量到东西");
    } else {
      await firstUpgrade.click({ timeout: 3000 });
      await page
        .locator("[data-slot-candidate-total]")
        .first()
        .waitFor({ state: "visible", timeout: 3000 });
      checked += 1;
      const dialogBad = dialogZoomProblems(
        await measureDialogZoom(page, { width: 390, height: 844 }),
      );
      if (dialogBad.length) {
        failures.push(`[195] ${firstUpgradeSlot} 候选弹窗 → ${dialogBad.join(" / ")}`);
      }
      await page.keyboard.press("Escape");
      await page
        .locator("[data-slot-candidate-total]")
        .first()
        .waitFor({ state: "detached", timeout: 3000 });
    }

    const beforeApply = await read();
    await page
      .locator("main button", { hasText: /一键 · 换上 \d+ 槽最强/ })
      .first()
      .click({ timeout: 3000 });
    await page.waitForFunction(
      () =>
        document
          .querySelector("[data-inventory-overview]")
          ?.getAttribute("data-inventory-upgrade-count") === "0",
      { timeout: 3000 },
    );
    await settleVisuals(page);
    const applied = await read();
    const toast = await page.evaluate(() =>
      [...document.querySelectorAll(".pointer-events-none.fixed button")]
        .map((button) => (button.textContent || "").replace(/\s+/g, " ").trim())
        .join("|"),
    );
    checked += 1;
    if (
      applied.upgradeCount !== 0 ||
      applied.upgradeSlots.length !== 0 ||
      applied.markedSlots.length !== 0 ||
      !applied.oneClick.disabled ||
      applied.oneClick.text !== "已无可换之器"
    ) {
      failures.push(
        `[390] 一键换装后仍有残留:报价 ${applied.upgradeCount} / 入口 ` +
          `${applied.upgradeSlots.join(",") || "无"} / 标记 ${applied.markedSlots.join(",") || "无"} / ` +
          `按钮«${applied.oneClick.text}»(${applied.oneClick.disabled ? "已禁用" : "仍可点"})`,
      );
    }
    if (!toast.includes(`换上 ${beforeApply.upgradeCount} 件`)) {
      failures.push(
        `[390] 背包换装场景:报价 ${beforeApply.upgradeCount} 槽,落库提示却是 «${toast || "无提示"}»`,
      );
    }

    if (pageErrors.length)
      failures.push(`[390] 背包新得场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    console.log(
      `\n背包新得:${newUids.length} 件先列 · 只看新得 ${filtered.cards.length} 件 · ` +
        `可动 ${beforeApply.upgradeCount} 槽 → 一键换装后 ${applied.upgradeCount} 槽`,
    );
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 门庭先报今日:在途、闲置、最近归期与差事进度 */
async function taskApprenticePulse() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const now = Date.now();
    const slices = showcaseSlices("light");
    slices.apprentice = {
      apprentices: [
        { uid: "pulse_idle", archId: "ap_luanniao", level: 2, bond: 4, task: null },
        {
          uid: "pulse_away",
          archId: "ap_kuangtou",
          level: 3,
          bond: 12,
          task: {
            spec: "herb",
            startAt: now - 15 * 60_000,
            finishAt: now + 15 * 60_000,
            rewardMajor: 9,
          },
        },
      ],
      rebirthKarma: 0,
    };
    await seedSave(ctx, slices, "__apprenticePulseFixture");

    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const textLength = await openRoute(page, "/apprentice", 800);
    if (textLength === 0) failures.push("[390] 门庭场景:页面没有渲染出来");
    await clearOverlays(page);

    const read = () =>
      page.evaluate(() => {
        const pulse = document.querySelector("[data-apprentice-pulse]");
        const dispatch = pulse?.querySelector("button");
        const taskRows = [...document.querySelectorAll("[data-apprentice-task-progress]")];
        const bars = [...document.querySelectorAll('[role="progressbar"]')];
        return {
          total: Number(pulse?.getAttribute("data-apprentice-total")),
          idle: Number(pulse?.getAttribute("data-apprentice-idle")),
          away: Number(pulse?.getAttribute("data-apprentice-away")),
          next: (pulse?.querySelector("[data-apprentice-next-return]")?.textContent || "")
            .replace(/\s+/g, " ")
            .trim(),
          progress: taskRows.map((row) =>
            Number(row.getAttribute("data-apprentice-task-progress")),
          ),
          aria: bars.map((bar) => Number(bar.getAttribute("aria-valuenow"))),
          dispatchDisabled: dispatch?.hasAttribute("disabled") ?? true,
          dispatchText: (dispatch?.textContent || "").replace(/\s+/g, " ").trim(),
        };
      });

    const initial = await read();
    checked += 1;
    if (initial.total !== 2 || initial.idle !== 1 || initial.away !== 1) {
      failures.push(
        `[390] 门庭场景:卷首应为 2 名 / 在途 1 / 闲置 1,实见 ` +
          `${initial.total} / ${initial.away} / ${initial.idle}`,
      );
    }
    if (!initial.next.includes("采灵药")) {
      failures.push(`[390] 门庭场景:最近归期没有指向在途的采灵药(«${initial.next}»)`);
    }
    if (
      initial.progress.length !== 1 ||
      !(initial.progress[0] > 0.35 && initial.progress[0] < 0.65)
    ) {
      failures.push(
        `[390] 门庭场景:在途差事进度应接近一半,实见 ${initial.progress.join(",") || "无"}`,
      );
    }
    if (initial.aria.length !== 1 || Math.abs(initial.aria[0] - initial.progress[0] * 100) > 1) {
      failures.push(
        `[390] 门庭场景:进度条读屏值 ${initial.aria.join(",") || "无"} ` +
          `与可视进度 ${initial.progress.join(",") || "无"} 不同源`,
      );
    }
    if (initial.dispatchDisabled || !initial.dispatchText.includes("派闲置 1 人")) {
      failures.push(`[390] 门庭场景:派发按钮没有报出这次会派走 1 人(«${initial.dispatchText}»)`);
    }

    await page.locator("[data-apprentice-pulse] button").click({ timeout: 3000 });
    await page.waitForFunction(
      () =>
        document.querySelector("[data-apprentice-pulse]")?.getAttribute("data-apprentice-idle") ===
        "0",
      { timeout: 3000 },
    );
    await settleVisuals(page);
    const after = await read();
    checked += 1;
    if (after.total !== 2 || after.idle !== 0 || after.away !== 2) {
      failures.push(
        `[390] 门庭场景:一键派发后应为在途 2 / 闲置 0,实见 ` + `${after.away} / ${after.idle}`,
      );
    }
    if (
      !after.dispatchDisabled ||
      after.dispatchText !== "弟子都在路上" ||
      after.progress.length !== 2 ||
      after.aria.length !== 2
    ) {
      failures.push(
        `[390] 门庭场景:派完后按钮«${after.dispatchText}» / 进度 ${after.progress.length} 条,` +
          `应与卷首一起换口`,
      );
    }

    if (pageErrors.length)
      failures.push(`[390] 门庭场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    console.log(
      `\n门庭今日:在途 ${initial.away} / 闲置 ${initial.idle} · ` +
        `最近 ${initial.next} · 一键派发后 ${after.away} / ${after.idle}`,
    );
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 一键分解先勾后点 */
async function taskDecompose() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第二十五件事:一键分解要「先勾后点」,勾品质不许当场把东西烧了 ----
  /*
   * 勾选框的语义是**标记**,不是**执行** —— 玩家勾「精品」是想说「精品算废料」,
   * 不是想让行囊里的精品立刻消失。此前 toggleRank 在勾上的一瞬间就调了
   * decomposeByRanks,于是「勾一下就没了」,勾错了没得后悔,也看不到会拆掉几件。
   * 判据按玩家的动作顺序核两拍:
   *   一 勾上「精品」之后 —— 行囊件数一件不能少,也不能出现「化作器灵尘」的交代;
   *   二 再点下方「分 解(2 件)」 —— 这才能少,而且要少出个交代来。
   * 顺带核第二笔账:练过的那件拆了要按八成退强化投入。夹具里一件 0 级、一件 +4
   * (记账投入尘 100 / 灵石 8000),故返还 = 底材4 + (底材4 + 八成尘80) = 88 尘 + 灵石 6400,
   * 并且提示里写的数必须与器灵尘那一栏真涨的数对得上(所见即所得)。
   * (勾选仍然会被记住,并继续管着「此后拾取自动回收」;那条是不占行囊的入包裁决,与本题无关。)
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "分解自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: { spiritStone: gn(1, 6), qi: 1000, wudao: 10, herb: 5, ore: 5, page: 2, dust: 0 },
      inventory: {
        items: [
          {
            uid: "b_1",
            templateId: "b_qingyun",
            quality: "excellent",
            tier: 3,
            level: 0,
            affixes: [],
          },
          {
            uid: "b_2",
            templateId: "b_qingyun",
            quality: "excellent",
            tier: 3,
            level: 4,
            affixes: [],
            invested: { dust: 100, stone: gn(8, 3) },
          },
        ],
        equipped: {},
        pills: {},
        artifacts: [],
        equippedArtifacts: [],
      },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`xuanshu.${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#" + "/inventory", { waitUntil: "load" });
    await page.waitForTimeout(2400);
    await clearOverlays(page);
    checked += 1;
    /** 行囊件数(只读 main;弹窗 Teleport 到 body,不在这棵子树里) */
    const bagCount = () =>
      page.evaluate(() => {
        const raw = document
          .querySelector("[data-inventory-bag-count]")
          ?.getAttribute("data-inventory-bag-count");
        return raw === null || raw === undefined ? null : Number(raw);
      });
    /** 背包页顶上那栏「器灵尘 N」 */
    const dustCount = () =>
      page.evaluate(() => {
        const m = /器灵尘\s*([\d,]+)/.exec(document.querySelector("main")?.innerText || "");
        return m ? Number(m[1].replace(/,/g, "")) : null;
      });
    const toasts = () =>
      page.evaluate(() =>
        [...document.querySelectorAll(".pointer-events-none.fixed button")]
          .map((b) => (b.textContent || "").trim())
          .join("|"),
      );
    const opened = await page
      .locator("main")
      .getByRole("button", { name: "批量分解装备" })
      .click({ timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (!opened) failures.push("[390] 分解场景:行囊页找不到「分解」入口");
    else {
      await page.waitForTimeout(400);
      const before = await bagCount();
      if (before !== 2) failures.push(`[390] 分解场景:夹具没铺好 —— 开局行囊 ${before} 件(应为 2)`);
      const box = page
        .locator(".modal-panel label", { hasText: "精品" })
        .locator("input[type=checkbox]")
        .first();
      const ticked = await box
        .click({ timeout: 3000 })
        .then(() => true)
        .catch(() => false);
      if (!ticked) failures.push("[390] 分解场景:弹窗里找不到「精品」的勾选框");
      await page.waitForTimeout(900);
      const marked = await bagCount();
      const markedToast = await toasts();
      if (marked !== 2)
        failures.push(
          `[390] 分解场景:只勾了「精品」,行囊就从 ${before} 件变成 ${marked} 件 —— 勾选把东西当场烧了(应先标记、等「分 解」)`,
        );
      if (/化作器灵尘/.test(markedToast))
        failures.push(
          `[390] 分解场景:勾选品质就弹了销毁交代(${markedToast})—— 玩家还没点「分 解」`,
        );
      const footLabel = (
        (await page
          .locator(".modal-panel footer button")
          .first()
          .textContent()
          .catch(() => "")) || ""
      )
        .replace(/\s+/g, " ")
        .trim();
      if (!/分\s*解\s*\(2\s*件\)/.test(footLabel)) {
        failures.push(`[390] 分解场景:勾选后按钮没写出「会拆几件」——「${footLabel}」`);
      }
      if (marked === 2) {
        const dustBefore = await dustCount();
        await page
          .locator(".modal-panel footer button")
          .first()
          .click({ timeout: 3000 })
          .catch(() => {});
        await page.waitForTimeout(900);
        const after = await bagCount();
        const afterToast = await toasts();
        if (after !== 0)
          failures.push(`[390] 分解场景:点了「分 解」行囊还剩 ${after} 件(两件精品都该拆掉)`);
        if (!/已分解\s*2\s*件/.test(afterToast))
          failures.push(`[390] 分解场景:点「分 解」之后没有交代(${afterToast || "无提示"})`);
        const promised = Number((/得器灵尘×(\d+)/.exec(afterToast) || [])[1] ?? NaN);
        const dustAfter = await dustCount();
        if (promised !== 88) {
          failures.push(
            `[390] 分解场景:两件精品(其中一件 +4,记账投入尘 100)该退 88 尘,提示写的是 ${promised}`,
          );
        }
        if (!/退灵石\s*6,400/.test(afterToast))
          failures.push(`[390] 分解场景:练过的件没退灵石(记了 8000,该退 6400)—— ${afterToast}`);
        if (dustBefore === null || dustAfter === null || dustAfter - dustBefore !== promised) {
          failures.push(
            `[390] 分解场景:提示说给 ${promised} 尘,器灵尘那一栏 ${dustBefore} → ${dustAfter}(所见非所得)`,
          );
        }
        if (promised === 88 && dustAfter - dustBefore === 88) {
          console.log(
            `\n一键分解:勾「精品」行囊仍是 ${marked} 件(未烧) · 「${footLabel}」→ 行囊 ${after} 件 · 得尘 ${promised}(对上,含强化八成)· 退灵石 6,400`,
          );
        }
      }
    }
    if (pageErrors.length)
      failures.push(`[390] 分解场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 法宝炼化的两笔账 */
async function taskArtifactRefine() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第二十四件事:法宝「炼化」的两笔账,一笔都不能少写 ----
  /*
   * 炼化既扣悟道点、也扣灵石(见 forge.artifactUpCost),而按钮此前只写「悟道 N」——
   * 玩家按标签算账,回头发现灵石也少了一大截。判据两件:
   *   一 按钮上必须把两种代价都写出来;
   *   二 两种都按所写扣(读数取磁盘精确值,并等开局奖励落定)。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "炼化自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: {
        spiritStone: gn(1, 7),
        qi: 1000,
        wudao: 5000,
        herb: 5,
        ore: 5,
        page: 2,
        dust: 2,
      },
      inventory: {
        items: [],
        equipped: {},
        pills: {},
        artifacts: [{ defId: "af_lihuo", level: 0 }],
        equippedArtifacts: [],
      },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`xuanshu.${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX, { waitUntil: "load" });
    await page.waitForTimeout(2400);
    await clearOverlays(page);
    checked += 1;
    /** 磁盘上的悟道点/灵石(等节流落盘,取精确值) */
    const readWal = async () => {
      await page.waitForTimeout(5600);
      const cipher = await page.evaluate(() => localStorage.getItem("xuanshu.resources") || "");
      if (!cipher) return null;
      const plain = decryptSlice(cipher);
      if (!plain) return null;
      const r = JSON.parse(plain);
      const num = (v) => (typeof v === "number" ? v : v.m * Math.pow(10, v.e));
      return { wudao: r.wudao, stone: num(r.spiritStone) };
    };
    await page.goto(INDEX + "#" + "/inventory", { waitUntil: "load" });
    await page.waitForTimeout(900);
    await page
      .getByRole("tab", { name: /法\s*宝/ })
      .first()
      .click({ timeout: 3000 })
      .catch(() => {});
    await page.waitForTimeout(400);
    const btn = page.locator("main button", { hasText: /炼\s*化/ }).first();
    if ((await btn.count()) === 0) failures.push("[390] 炼化场景:背包「法宝」页找不到「炼化」入口");
    else {
      const label = ((await btn.textContent()) || "").replace(/\s+/g, " ").trim();
      const wantWudao = Number(
        (/悟道点?\s*([\d,]+)/.exec(label.replace(/,/g, "")) || [])[1] ?? NaN,
      );
      const stoneText = (/灵石\s*([\d,.]+)\s*(万|亿|兆)?/.exec(label) || [])[0] ?? "";
      const sm = /([\d,.]+)\s*(万|亿|兆)?/.exec(stoneText);
      const unit = sm?.[2] === "万" ? 1e4 : sm?.[2] === "亿" ? 1e8 : sm?.[2] === "兆" ? 1e12 : 1;
      const wantStone = sm ? parseFloat(sm[1].replace(/,/g, "")) * unit : NaN;
      if (!/灵石/.test(label)) {
        failures.push(`[390] 炼化场景:按钮只写了悟道、没写灵石 —— 实际两种都要扣(「${label}」)`);
      }
      const before = await readWal();
      await btn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
      const after = await readWal();
      if (before && after) {
        if (before.wudao - after.wudao !== wantWudao) {
          failures.push(
            `[390] 炼化场景:按钮写悟道 ${wantWudao},实际 ${before.wudao} → ${after.wudao}`,
          );
        }
        // 灵石是浮点(stoneByTier 会乘倍率),比较留一点容差
        if (!(Math.abs(before.stone - after.stone - wantStone) < 0.01)) {
          failures.push(
            `[390] 炼化场景:按钮写灵石 ${wantStone},实际 ${before.stone} → ${after.stone}`,
          );
        }
        console.log(
          `\n法宝炼化:「${label}」→ 悟道 ${before.wudao} → ${after.wudao} · 灵石 ${before.stone} → ${after.stone}`,
        );
      } else {
        failures.push("[390] 炼化场景:读不到资源分片(判据没跑到东西)");
      }
    }
    if (pageErrors.length)
      failures.push(`[390] 炼化场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 洞府营造的账目 */
async function taskDongfuBuild() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第二十三件事:洞府营造的账目 —— 卡上写多少料,就扣多少料 ----
  /*
   * 洞府是中期最主要的一处灵石去处,卡上写着「建造 · 60石 6铁」。
   * 判据核的是**玄铁**那一半:灵石同一时间会被任务/成就奖励搅动(实测开局那一下
   * 就发了三十多万,差被冲得看不出来),而玄铁除了营造没人动它,差一分就是错。
   * 读数取自背包「材料」页(界面上的数),不去解密分片 —— 写盘是节流的,磁盘会落后。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "营造自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: {
        spiritStone: gn(1, 7),
        qi: 1000,
        wudao: 10,
        herb: 5,
        ore: 90000,
        page: 2,
        dust: 2,
      },
      inventory: { items: [], equipped: {}, pills: {}, artifacts: [], equippedArtifacts: [] },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      /*
       * 洞府给个≥1 的档位:首级免玄铁(ISS-303)让「建造」(0→1)不涉铁,
       * 测试对象得是「升级」才有铁账可对(第一枚按钮是洞府,优先升它)。
       */
      dongfu: { levels: { mansion: 1 }, offlineCapHours: 8 },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`xuanshu.${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    checked += 1;
    /**
     * 玄铁余额:**磁盘那一份**(精确到个位)。
     *
     * 界面上的分片只有万位三位小数(9万 → 8.998万),一位数的漂移会被四舍五入吃掉 ——
     * 实测把造价 +1 的注入就这样混过去了。故这里等节流落盘后解密比对,不取显示值。
     */
    const readOre = async () => {
      await page.waitForTimeout(5600);
      const cipher = await page.evaluate(() => localStorage.getItem("xuanshu.resources") || "");
      if (!cipher) return { text: "(无分片)", value: null };
      const plain = decryptSlice(cipher);
      if (!plain) return { text: "(解不开)", value: null };
      const v = JSON.parse(plain).ore;
      const n = typeof v === "number" ? v : v.m * Math.pow(10, v.e);
      return { text: String(n), value: n };
    };
    // 先落到页面上:任何 localStorage 读数都要有 document 在(localStorage 才能读)
    await page.goto(INDEX, { waitUntil: "load" });
    await page.waitForTimeout(2400);
    await clearOverlays(page);
    const oreBefore = await readOre();
    await page.goto(INDEX + "#" + "/dongfu", { waitUntil: "load" });
    await page.waitForTimeout(900);
    // 正则留出空白余量:卡片上的代价换行(数 + 量词 nowrap)会在「·」后断行
    const buildBtn = page.locator("main button", { hasText: /建\s*造\s*·|升\s*级\s*·/ }).first();
    if ((await buildBtn.count()) === 0) {
      failures.push("[390] 营造场景:洞府页没有可动工的建筑(判据没跑到东西)");
    } else {
      const label = ((await buildBtn.textContent()) || "").replace(/\s+/g, " ").trim();
      // 资源名 7f91a90 起统一为「玄铁」,卡片代价是「· 40 玄铁」;此前只认「铁」,
      // 读「40 玄铁」解析成 NaN,营造账目判据永远红。给「玄」留可选位,兼容新旧两种写法。
      const oreCost = Number((/([\d,]+)\s*玄?铁/.exec(label.replace(/,/g, "")) || [])[1] ?? NaN);
      await buildBtn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(800);
      const toast = await page.evaluate(() =>
        [...document.querySelectorAll(".pointer-events-none.fixed button")]
          .map((b) => (b.textContent || "").trim())
          .join("|"),
      );
      const oreAfter = await readOre();
      if (!Number.isFinite(oreCost))
        failures.push(`[390] 营造场景:读不出卡片上的玄铁价(「${label}」)`);
      else if (
        oreBefore.value === null ||
        oreAfter.value === null ||
        oreBefore.value - oreAfter.value !== oreCost
      ) {
        failures.push(
          `[390] 营造场景:卡片写「${label}」,玄铁实际 ${oreBefore.text} → ${oreAfter.text}(所见非所付)`,
        );
      }
      if (!/升至|落成|建造/.test(toast))
        failures.push(`[390] 营造场景:动工之后没有任何交代(${toast || "无提示"})`);
      console.log(
        `\n洞府营造:${label} → 玄铁 ${oreBefore.text} → ${oreAfter.text}(应扣 ${Number.isFinite(oreCost) ? oreCost : "?"})`,
      );
    }
    if (pageErrors.length)
      failures.push(`[390] 营造场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 减少动效真的减到了 */
async function taskReduceMotion() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第二十二件事:减少动效真的减到了(顺带在音效开着的情况下点一路按钮) ----
  /*
   * 「减少动效」是个容易摆设的开关:加个类名、忘了写 CSS,界面上谁也看不出来
   * (动效仍然在动,而这条设置一般是给晕动/省电的人用的)。
   * 判据按「还会不会动」来量:animation-name 仍在不算,要看 duration 与 iteration ——
   * 减动效的做法是把时长压到 0.01ms 且只跑一次。
   * 同一场里音效与音乐都开着:每次点击都会走 unlockAudio + playSfx,这条路径
   * 冒烟夹具一律关掉声音,此前没走过。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "音画自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: { spiritStone: gn(1, 6), qi: 1000, wudao: 10, herb: 5, ore: 5, page: 2, dust: 2 },
      inventory: { items: [], equipped: {}, pills: {}, artifacts: [], equippedArtifacts: [] },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: true,
        musicOn: true,
        musicVol: 60,
        sfxVol: 60,
        reduceMotion: false,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`xuanshu.${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX, { waitUntil: "load" });
    await page.waitForTimeout(2400);
    await clearOverlays(page);
    checked += 1;
    /** 还会动的元素:名字在不算,要看时长与次数 */
    const movingCount = () =>
      page.evaluate(
        () =>
          [...document.querySelectorAll("body *")].filter((el) => {
            const cs = getComputedStyle(el);
            if (cs.animationName === "none") return false;
            const dur = cs.animationDuration.split(",").map((d) => parseFloat(d));
            const iter = cs.animationIterationCount.split(",");
            return dur.some((d) => d > 0.05) || iter.some((i) => i === "infinite");
          }).length,
      );
    const before = await movingCount();
    if (before === 0)
      failures.push("[390] 减动效场景:默认设置下界面本来就不动,这条判据证明不了什么");
    // 音效开着,一路点点按钮(每次点击都会走 unlockAudio + playSfx)
    for (const b of [0, 1, 2]) {
      await page
        .locator("main button")
        .nth(b)
        .click({ timeout: 2000 })
        .catch(() => {});
      await page.waitForTimeout(150);
    }
    await page.goto(INDEX + "#" + "/settings", { waitUntil: "load" });
    await page.waitForTimeout(700);
    const box = page
      .locator("label", { hasText: /减少动效/ })
      .locator("input[type=checkbox]")
      .first();
    if ((await box.count()) === 0) failures.push("[390] 减动效场景:设置页找不到「减少动效」开关");
    else {
      await box.check({ timeout: 2500 }).catch(() => {});
      await page.waitForTimeout(400);
      const off = await movingCount();
      if (off !== 0)
        failures.push(`[390] 减动效场景:开了「减少动效」仍有 ${off} 个元素在动(开关是摆设)`);
      await box.uncheck({ timeout: 2500 }).catch(() => {});
      await page.waitForTimeout(400);
      const back = await movingCount();
      if (back === 0)
        failures.push("[390] 减动效场景:关掉「减少动效」之后界面也一动不动(判据两向都得立得住)");
      console.log(
        `\n减动效:默认 ${before} 个在动 → 打开开关 ${off} 个 → 关回 ${back} 个(音效开着点了一路,无异常)`,
      );
    }
    if (pageErrors.length)
      failures.push(`[390] 减动效场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 闭关的跨页承诺 */
async function taskRetreat() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第二十一件事:闭关的跨页承诺 —— 闭关中不许历练,而且当场就说 ----
  /*
   * 「静坐一炷香,修炼速度 +150%;闭关期间无法外出历练」是修行页明写的一条。
   * 这条承诺跨两个页面,此前也没人真走过:去历练页点出发,模式窗照开,三选一之后
   * 才被告知「你正在闭关静修」——话是对的,但让人先白走一步。
   * 判据三件:闭关真的起效(有倒计时)、出发当场被拦且不开模式窗、回修行页闭关还在。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "闭关自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: { spiritStone: gn(1, 6), qi: 1000, wudao: 10, herb: 5, ore: 5, page: 2, dust: 2 },
      inventory: { items: [], equipped: {}, pills: {}, artifacts: [], equippedArtifacts: [] },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`xuanshu.${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#" + "/cultivation", { waitUntil: "load" });
    await page.waitForTimeout(2400);
    await clearOverlays(page);
    checked += 1;
    const retreatBtn = page.locator("main button", { hasText: /闭\s*关/ }).first();
    if ((await retreatBtn.count()) === 0) failures.push("[390] 闭关场景:修行页找不到「闭关」入口");
    else {
      await retreatBtn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(800);
      const started = await page.evaluate(() => ({
        toast: [...document.querySelectorAll(".pointer-events-none.fixed button")]
          .map((b) => (b.textContent || "").trim())
          .join("|"),
        countdown: /闭关中 · /.test(document.querySelector("main")?.innerText || ""),
      }));
      if (!started.countdown)
        failures.push("[390] 闭关场景:点了闭关,修行页没有出现「闭关中」的倒计时");
      if (!/闭关/.test(started.toast))
        failures.push(`[390] 闭关场景:闭关没有任何交代(${started.toast || "无提示"})`);
      // 去历练页点出发:应当当场被拦,且不开模式窗
      await page.goto(INDEX + "#" + "/adventure", { waitUntil: "load" });
      await page.waitForTimeout(900);
      await page
        .locator("main button", { hasText: /出\s*发/ })
        .first()
        .click({ timeout: 3000 })
        .catch(() => {});
      await page.waitForTimeout(600);
      const blocked = await page.evaluate(() => ({
        toast: [...document.querySelectorAll(".pointer-events-none.fixed button")]
          .map((b) => (b.textContent || "").trim())
          .join("|"),
        modal: !!document.querySelector(".modal-panel"),
        running: /余 \d+分\d+秒/.test(document.querySelector("main")?.innerText || ""),
      }));
      if (!/闭关/.test(blocked.toast))
        failures.push(
          `[390] 闭关场景:闭关期间点出发,出面没有说「正在闭关」(${blocked.toast || "无提示"})`,
        );
      if (blocked.modal)
        failures.push("[390] 闭关场景:闭关期间点出发,还开出了模式窗(该当场拦下,不让玩家白走一步)");
      if (blocked.running) failures.push("[390] 闭关场景:闭关期间居然真的出发了");
      // 回修行页:闭关还在
      await page.goto(INDEX + "#" + "/cultivation", { waitUntil: "load" });
      await page.waitForTimeout(800);
      const back = await page.evaluate(() => {
        const text = document.querySelector("main")?.innerText || "";
        return {
          still: /闭关中 · /.test(text),
          line: (text.match(/闭关中 · [^\r\n]*/) || [""])[0],
        };
      });
      if (!back.still) failures.push("[390] 闭关场景:换页回来闭关状态就丢了");
      console.log(`\n闭关:起效「${back.line}」 · 历练当场被拦(未开模式窗) · 换页仍在`);
    }
    if (pageErrors.length)
      failures.push(`[390] 闭关场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 背包里的账目 */
async function taskInventoryAccounting() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第二十件事:背包里的账目 —— 显示多少就扣/给多少 ----
  /*
   * 强化与分解是玩家天天用的两个资源动作,而它们各自都有一处**手写数字**:
   *   强化弹窗写着「器灵尘×N · 灵石 M」;
   *   分解完弹一条「分解得器灵尘×K」。
   * 这些数字若与服务实际扣/给的对不上,玩家不会知道该信哪个。
   * 判据就一件事:拿界面上的数对界面自己的变化(器灵尘那一栏)。
   * 灵石不在判据里 —— 同一段时间里任务/成就也会发灵石,拿它做差会被别处的收益搅乱。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "锻造自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: {
        spiritStone: gn(1, 6),
        qi: 1000,
        wudao: 10,
        herb: 5,
        ore: 5,
        page: 2,
        dust: 5000,
      },
      inventory: {
        items: [
          {
            uid: "p_w",
            templateId: "w_zidian",
            quality: "heaven",
            tier: 20,
            level: 4,
            affixes: [],
          },
          {
            uid: "b_1",
            templateId: "b_qingyun",
            quality: "excellent",
            tier: 3,
            level: 0,
            affixes: [],
          },
        ],
        equipped: { weapon: "p_w" },
        pills: {},
        artifacts: [],
        equippedArtifacts: [],
      },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`xuanshu.${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#" + "/inventory", { waitUntil: "load" });
    await page.waitForTimeout(2400);
    await clearOverlays(page);
    checked += 1;
    /** 背包页顶上那栏「器灵尘 N」 */
    const readDust = () =>
      page.evaluate(() => {
        const m = /器灵尘\s*([\d,]+)/.exec(document.querySelector("main")?.innerText || "");
        return m ? Number(m[1].replace(/,/g, "")) : null;
      });
    /**
     * 打开背包里那件(未装备、未锁定)——按 **uid** 找,不按名字找。
     *
     * 从前这里写死了「青云道袍」:内容一改名(这件后来按地界改成「风林道袍」),
     * 点击就静默落空,场景报的是「判据没跑到东西」,而真相只是名字变了。
     * 装备卡带上 data-uid(见 EquipmentCard),这一处从此与命名无关。
     */
    const BAG_UID = "b_1";
    await page.locator(`main button[data-uid="${BAG_UID}"]`).first().click({ timeout: 3000 });
    await page.waitForTimeout(500);
    const costLine = await page.evaluate(() => {
      const p = document.querySelector(".modal-panel");
      const m = /器灵尘×(\d+)/.exec(p?.innerText || "");
      return m ? Number(m[1]) : null;
    });
    if (costLine === null)
      failures.push("[390] 锻造场景:详情里没写出强化的器灵尘价(判据没跑到东西)");
    else {
      const before = await readDust();
      await page
        .locator(".modal-panel button", { hasText: /强\s*化/ })
        .first()
        .click({ timeout: 3000 })
        .catch(() => {});
      await page.waitForTimeout(600);
      const after = await readDust();
      if (before === null || after === null || before - after !== costLine) {
        failures.push(
          `[390] 锻造场景:强化写着扣 ${costLine} 尘,实际 ${before} → ${after}(所见非所付)`,
        );
      }
      // 接着分解同一件:提示里说给多少尘,就该给多少 —— 而且这件要从包里消失
      const dustBeforeSplit = await readDust();
      // 分解是**二步确认**:先点「分解这件装备」(图标钮,以 aria-label 命名),再点「确认分解」。
      // 这里曾经点「空文本 footer 按钮」+「文本含分解? 的按钮」—— 对应更早的**单步版**;
      // 两步版下那两下都点不中,分解没发生、提示没出来 → 误报「没交代」(实测真流程出「分解得器灵尘×4」)。
      await page
        .locator('.modal-panel button[aria-label="分解这件装备"]')
        .click({ timeout: 3000 })
        .catch(() => {});
      await page.waitForTimeout(300);
      await page
        .locator(".modal-panel button", { hasText: /确认分解/ })
        .first()
        .click({ timeout: 3000 })
        .catch(() => {});
      await page.waitForTimeout(700);
      const toast = await page.evaluate(() =>
        [...document.querySelectorAll(".pointer-events-none.fixed button")]
          .map((b) => (b.textContent || "").trim())
          .join("|"),
      );
      const promised = Number((/分解得器灵尘×(\d+)/.exec(toast) || [])[1] ?? NaN);
      const dustAfterSplit = await readDust();
      const stillInBag = await page.evaluate(
        (uid) => !!document.querySelector(`main button[data-uid="${uid}"]`),
        BAG_UID,
      );
      if (Number.isFinite(promised)) {
        if (
          dustBeforeSplit === null ||
          dustAfterSplit === null ||
          dustAfterSplit - dustBeforeSplit !== promised
        ) {
          failures.push(
            `[390] 锻造场景:分解说给 ${promised} 尘,实际 ${dustBeforeSplit} → ${dustAfterSplit}`,
          );
        }
        if (stillInBag) failures.push("[390] 锻造场景:分解之后那件还留在背包里");
        console.log(
          `\n背包账目:强化扣尘 ${costLine}(对上) · 分解得尘 ${promised}(对上,且件已出包)`,
        );
      } else {
        failures.push(`[390] 锻造场景:分解没有给出「分解得器灵尘×N」的交代(${toast || "无提示"})`);
      }
    }
    if (pageErrors.length)
      failures.push(`[390] 锻造场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 真打一场历练战斗 */
async function taskCombatReplay() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第十九件事:真打一场历练战斗,看战报回放与战斗分析 ----
  /*
   * 战报是这游戏里**看得最多**的一屏:出发 → 模式 → 等一场 → 逐行回放 → 结语,
   * 而这条链只在单元用例里跑过引擎、从没在真浏览器里走完过。
   * 判据只要四件事:探索真的开起来了、战报回放出了行、结语写清回合与胜负、
   * 战斗分析点得开且给得出数据面板(总输出/总承伤那一组)。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "战斗自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: { spiritStone: gn(1, 6), qi: 1000, wudao: 10, herb: 5, ore: 5, page: 2, dust: 2 },
      // 一件高 Tier 的武器:让首战打得赢、回放短,判据才不至于看运气
      inventory: {
        items: [
          {
            uid: "p_w",
            templateId: "w_zidian",
            quality: "heaven",
            tier: 20,
            level: 4,
            affixes: [],
          },
        ],
        equipped: { weapon: "p_w" },
        pills: {},
        artifacts: [],
        equippedArtifacts: [],
      },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`xuanshu.${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#" + "/adventure", { waitUntil: "load" });
    await page.waitForTimeout(2400);
    await clearOverlays(page);
    checked += 1;
    await page
      .locator("main button", { hasText: /出\s*发/ })
      .first()
      .click({ timeout: 3000 })
      .catch(() => {});
    await page.waitForTimeout(600);
    // 「出发」先开模式窗:此行欲作何打算
    await page
      .locator(".modal-panel button", { hasText: /寻常游历/ })
      .first()
      .click({ timeout: 3000 })
      .catch(() => {});
    /*
     * 把这一页拉到前台:后台页面的定时器会被浏览器节流(setInterval 从 1 秒拖到 1 分钟),
     * 而引擎的心跳正是 1 秒一拍 —— 实测不拉前台时,45 秒里一场都没打(「胜 0 场」)。
     */
    await page.bringToFront();
    // 首战间隔 12 秒 ÷ 历练速度,故最多等 30 秒
    let summary = "";
    let logLines = 0;
    let lastTail = "";
    // 停下来的条件要带上「战报有行」:回放是逐行画出来的,结语先出现、行随后才铺满 ——
    // 只看结语就收工,会偶发地在那一瞬数出 0 行(实测撞到过一次),把好代码判成坏代码
    for (let i = 0; i < 60 && !(summary && logLines > 0); i += 1) {
      await page.waitForTimeout(1000);
      /*
       * 历练的第一步未必是战斗:引擎每个战斗槽位都会先掷一次「际遇」,中了就弹事件窗,
       * 而事件窗挡着战斗(超时才会自动按默认选项处理)—— 实测这就是「等了 45 秒 0 场」的原因。
       * 故这里遇到事件窗就当场选第一个选项把它了结,让历练继续往下走。
       */
      const modalChoice = page.locator(".modal-panel button").nth(0);
      if ((await page.locator(".modal-panel").count()) > 0 && (await modalChoice.count()) > 0) {
        const evTitle = await page.evaluate(() =>
          (document.querySelector(".modal-panel h3")?.textContent || "").trim(),
        );
        await modalChoice.click({ timeout: 2000 }).catch(() => {});
        console.log(`  (历练中遇到际遇「${evTitle}」,已按第一个选项了结,继续等战斗)`);
        await page.waitForTimeout(600);
        continue;
      }
      const info = await page.evaluate(() => {
        const text = document.querySelector("main")?.innerText || "";
        return {
          running: /余 \d+分\d+秒/.test(text),
          /*
           * 战报行直接数回放框里的 <p>,不再拿关键词去猜文本。
           * 原来数的是 击中|施展|避开|打断|气血逆涌 五个词 —— 而暴击那行写的是
           * 「会心一击!…受创甚重」,五个词一个不沾;一击暴击定胜负的战斗(实测碰到过,
           * 战后气血 100%)于是被误判成「回放没出内容」,红得毫无道理。
           */
          lines: document.querySelectorAll("[data-battle-log]").length,
          summary: (text.match(/此战 \d+ 回合[^\r\n]*/) || [""])[0],
          tail: text.replace(/\s+/g, " ").slice(-80),
        };
      });
      logLines = Math.max(logLines, info.lines);
      summary = info.summary;
      lastTail = info.tail;
      if (i === 0 && !info.running)
        failures.push("[390] 战斗场景:点了「出发」并择了模式,历练却没跑起来");
    }
    // 兜底再等一拍:真的没有战报行时,这里仍然是 0,断言照旧会红
    if (summary && logLines === 0) {
      await page.waitForTimeout(1500);
      logLines = await page.evaluate(() => document.querySelectorAll("[data-battle-log]").length);
    }
    // 首战间隔 12 秒 ÷ 历练速度;45 秒还没等到,就把当前页面写进报告(「搜寻猎物中」还是「胜 N 场」一看便知)
    if (!summary)
      failures.push(
        `[390] 战斗场景:等了 60 秒也没等到一场的结语(战报回放没走完?) 当前页面:${lastTail}`,
      );
    else {
      if (logLines === 0) failures.push("[390] 战斗场景:有结语却没有战报行(回放没出内容)");
      if (!/胜|负/.test(summary)) failures.push(`[390] 战斗场景:结语没写清胜负 —— ${summary}`);
      // 战斗分析:点开要看得到数据面板
      const analysisBtn = page.locator("main button", { hasText: /战斗分析/ }).first();
      if ((await analysisBtn.count()) === 0) failures.push("[390] 战斗场景:找不到「战斗分析」入口");
      else {
        await analysisBtn.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(400);
        const analysisText = await page.evaluate(
          () => document.querySelector("main")?.innerText || "",
        );
        if (!/总输出|总承伤/.test(analysisText))
          failures.push("[390] 战斗场景:点开战斗分析也没看到数据面板(总输出/总承伤)");
        else console.log(`\n战斗回放:${summary} · 战报 ${logLines} 行 · 分析面板可开`);
      }
    }
    if (
      /NaN|undefined|Infinity/.test(
        await page.evaluate(() => document.querySelector("main")?.innerText || ""),
      )
    ) {
      failures.push("[390] 战斗场景:战报里漏出占位符");
    }
    if (pageErrors.length)
      failures.push(`[390] 战斗场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 敌人卡最挤的一档 */
async function taskEnemyCard() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第三十六件事:敌人卡的最挤一档(长名字 + 满标签) ----
  /*
   * 敌人名字最长 9 字(残魂·堕落冰魄仙子),标签最多 5 枚(首领 / 宿敌 + 3 个路数特性),
   * 再叠上适配星级。从前这些全挤在一行 nowrap 的 flex 里,320 宽下名字被折成两行、
   * 标签压在一起 —— 而巡页用的档里敌人名字都短、认知层也是 0(特性根本不显示),
   * 这一档从来没有被量过:夹具缺什么,判据就瞎什么。
   *
   * 夹具直接摆出这一档:认知层 2(知其路数 → 特性显示)、宿敌记录(→ 宿敌标签)、
   * 首领身份(→ 首领标签)、真仙境的敌人(→ 名字最长的那个)。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 320, height: 568 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const now = Date.now();
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: now - 86400000,
        lastActiveAt: now,
        totalPlaySec: 600,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "战斗卡自检",
        major: 12,
        sub: 3,
        exp: gn(1, 3),
        age: 300,
        dead: false,
        nemeses: [
          {
            enemyId: "e_icefairy",
            enemyName: "堕落冰魄仙子",
            regionId: "leichi",
            lossCount: 3,
            lastLossAt: now,
          },
        ],
        reincarnation: {
          count: 1,
          daoFruit: 3,
          talents: [],
          insight: 50,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "ice", aptitude: 90 }],
          gradeName: "单灵根",
          growthMult: 1.2,
        },
      },
      resources: {
        spiritStone: gn(8, 7),
        qi: 5000,
        wudao: 200,
        herb: 100,
        ore: 100,
        page: 20,
        dust: 40,
      },
      inventory: {
        items: [
          {
            uid: "w1",
            templateId: "w_zidian",
            quality: "heaven",
            tier: 12,
            level: 2,
            affixes: [
              { id: "bs3", roll: 1 },
              { id: "low2", roll: 1 },
            ],
          },
        ],
        equipped: { weapon: "w1" },
        pills: {},
        artifacts: [],
        equippedArtifacts: [],
      },
      cultivation: {
        learned: { g_qingyun: 6 },
        mainGongfa: "g_qingyun",
        subGongfa: [],
        buffs: [],
        gongfaBranch: {},
      },
      lore: {
        materialLore: {},
        materialSeen: {},
        recipeLore: {},
        blueprintLore: {},
        skillExp: {},
        enemyLore: { e_icefairy: 2 }, // 知其路数 → 特性标签会显示
        enemySeen: { e_icefairy: 6 },
        studyFrac: 0,
        seeded: true,
      },
      adventure: {
        unlocked: ["qingyun", "luoxia", "heifeng", "leichi"],
        cleared: ["qingyun", "luoxia"],
        mortalCleared: [],
        session: {
          regionId: "leichi",
          mode: "risky",
          startedAt: now - 60000,
          endsAt: now + 3600000,
          nextBattleAt: now + 12000,
          wins: 4,
          losses: 0,
          events: 1,
          stoneGain: gn(1.2, 6),
          expGain: gn(3.4, 6),
          itemGain: 3,
        },
        pendingEventId: null,
        pendingEventSince: 0,
        seenOnceEvents: [],
        lastBattle: {
          enemyName: "残魂·堕落冰魄仙子",
          enemyIcon: "snowflake",
          enemyId: "e_icefairy",
          isBoss: true,
          result: {
            win: true,
            rounds: 7,
            playerHpPct: 0.62,
            log: [
              { t: "atk", text: "你挥剑直取,", php: 1, ehp: 0.8 },
              { t: "crit", text: "会心一击!", dmg: "12", php: 1, ehp: 0.4 },
              { t: "win", text: "你胜了。", php: 0.62, ehp: 0 },
            ],
          },
          at: now - 3000,
          loot: ["功法残页×2", "玄冰剑"],
        },
        eventMemories: {},
      },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "dark",
      },
    };
    await ctx.addInitScript(
      (data) => {
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`xuanshu.${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/adventure", { waitUntil: "load" });
    /**
     * 等敌人卡出现,而不是固定等 2200ms 再读一次。
     *
     * 装备表涨到 288 件之后,冷启动到首帧的时间开始浮动 —— 单次定时读会偶发读空,
     * 于是这条判据报的是「夹具没读出来」,而真相只是「还没画到」。判据本身不变:
     * 卡必须出现,名字必须单行,标签必须够四枚。只是把「读一次」改成「等到出现为止」。
     */
    await page.waitForSelector("[data-foe-name]", { timeout: 8000 }).catch(() => undefined);
    await page.evaluate(() => {
      Math.random = () => 1;
    });
    const foe = await page.evaluate(() => {
      const name = document.querySelector("[data-foe-name]");
      if (!name) return { found: false };
      const r = name.getBoundingClientRect();
      const chips = [...document.querySelectorAll(".chip-ink")].filter((el) =>
        (el.textContent || "").trim(),
      );
      return {
        found: true,
        label: (name.textContent || "").trim(),
        height: Math.round(r.height),
        lineHeight: parseFloat(getComputedStyle(name).lineHeight) || 16,
        chips: chips.length,
      };
    });
    checked += 1;
    if (!foe.found) {
      failures.push("[320-battle] 敌人卡场景:战斗面板没渲染出来(夹具没被读出来?)");
    } else {
      const lines = Math.round(foe.height / foe.lineHeight);
      if (lines > 1)
        failures.push(`[320-battle] 敌人名字被折成 ${lines} 行:«${foe.label}»(${foe.height}px)`);
      if (foe.chips < 4)
        failures.push(
          `[320-battle] 敌人卡场景:标签只有 ${foe.chips} 枚(夹具该摆出首领+宿敌+3 特性)`,
        );
      const info = await measurePage(page);
      for (const p of problemsOf(info)) failures.push(`[320-battle] /adventure → ${p}`);
    }
    if (pageErrors.length)
      failures.push(`[320-battle] 敌人卡场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 秘境卡「在境中」的最窄一档 */
async function taskSecretRealm320() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第四十五件事:秘境卡「在境中」的窄屏一档 ----
  /*
   * 在境中的秘境卡有一行本层预览：本层劫 / 胜算 · 战利。它从前整段 whitespace-nowrap,
   * 320 宽上必然顶出卡片 —— 但巡页的档里没有在途秘境,三十三那份 320 地界夹具的
   * adventure 切片也没有 secretRealm,于是这一档从来没被量过:夹具缺什么,判据就瞎什么。
   *
   * 夹具摆出「打到第二层、带着战利、付过门票」的那一版,并把敌人名字给到最长的那类,
   * 让两个 nowrap 组都撑到最满。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 320, height: 568 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const now = Date.now();
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: now - 86400000,
        lastActiveAt: now,
        totalPlaySec: 600,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "秘境卡自检",
        major: 12,
        sub: 3,
        exp: gn(1, 3),
        age: 300,
        dead: false,
        reincarnation: {
          count: 1,
          daoFruit: 3,
          talents: [],
          insight: 50,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "ice", aptitude: 90 }],
          gradeName: "单灵根",
          growthMult: 1.2,
        },
        // 在境中:第二层、带着一份战利、已掷定本层敌人(预览与实战同源的那一份)
        secretRealm: {
          realmId: "sr_kurong",
          enteredAt: now - 600000,
          layer: 2,
          wins: 1,
          losses: 1,
          spoils: ["灵石少许", "枯荣草一株"],
          rules: ["治疗减半"],
          carriedHpPct: 0.7,
          finished: false,
          foe: {
            name: "残魂·堕落冰魄仙子",
            icon: "snowflake",
            isPlayer: false,
            attack: gn(2, 5),
            defense: gn(1, 4),
            maxHp: gn(3, 6),
            speed: 1.1,
            mods: {},
            skills: [],
          },
        },
      },
      resources: {
        spiritStone: gn(8, 7),
        qi: 5000,
        wudao: 200,
        herb: 100,
        ore: 100,
        page: 20,
        dust: 40,
      },
      inventory: {
        items: [
          {
            uid: "w1",
            templateId: "w_zidian",
            quality: "heaven",
            tier: 12,
            level: 2,
            affixes: [
              { id: "bs3", roll: 1 },
              { id: "low2", roll: 1 },
            ],
          },
        ],
        equipped: { weapon: "w1" },
        pills: {},
        artifacts: [],
        equippedArtifacts: [],
      },
      cultivation: {
        learned: { g_qingyun: 6 },
        mainGongfa: "g_qingyun",
        subGongfa: [],
        buffs: [],
        gongfaBranch: {},
      },
      lore: {
        materialLore: {},
        materialSeen: {},
        recipeLore: {},
        blueprintLore: {},
        skillExp: {},
        enemyLore: {},
        enemySeen: {},
        studyFrac: 0,
        seeded: true,
      },
      // 没有在途历练:这一屏要画的是择地界 + 秘境卡(在境中那一版),不是战斗面板
      adventure: {
        unlocked: ["qingyun", "luoxia", "heifeng", "leichi"],
        cleared: ["qingyun"],
        mortalCleared: [],
        session: null,
        pendingEventId: null,
        pendingEventSince: 0,
        seenOnceEvents: [],
        lastBattle: null,
        eventMemories: {},
      },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "dark",
      },
    };
    await ctx.addInitScript(
      (data) => {
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`xuanshu.${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/adventure", { waitUntil: "load" });
    // 等秘境卡画出来(「再 入 一 层」是在境中那一版唯一的入口),而不是定时空读
    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll("button")].some((b) =>
            (b.textContent || "").replace(/\s+/g, "").includes("再入一层"),
          ),
        { timeout: 8000 },
      )
      .catch(() => undefined);
    const card = await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) =>
        (b.textContent || "").replace(/\s+/g, "").includes("再入一层"),
      );
      const section = btn?.closest("section") ?? null;
      if (!section) return { found: false };
      const text = (section.textContent || "").replace(/\s+/g, " ").trim();
      // 层点:三枚 6px 的圆点,当前层是朱砂 —— 数字不删,点只是把层数变成可数的
      const dots = [...section.querySelectorAll("span")].filter((el) => {
        const r = el.getBoundingClientRect();
        return Math.round(r.width) === 6 && Math.round(r.height) === 6;
      }).length;
      return {
        found: true,
        text: text.slice(0, 80),
        dots,
        layerText: /第\s*2\s*\/\s*3\s*层/.test(text),
        overflow: section.scrollWidth - section.clientWidth,
      };
    });
    checked += 1;
    if (!card.found) {
      failures.push("[320-secret] 秘境卡在境中场景:卡片没渲染出来(夹具没被读出来?)");
    } else {
      if (!card.layerText)
        failures.push(`[320-secret] 秘境卡没画「第 2/3 层」:«${card.text}»(夹具或模板?)`);
      if (card.dots !== 3)
        failures.push(`[320-secret] 秘境卡的层点有 ${card.dots} 枚(应为 3):«${card.text}»`);
      if (card.overflow > 1)
        failures.push(`[320-secret] 秘境卡横向溢出 ${card.overflow}px:«${card.text}»`);
      const info = await measurePage(page);
      for (const p of problemsOf(info)) failures.push(`[320-secret] /adventure → ${p}`);
    }
    if (pageErrors.length)
      failures.push(
        `[320-secret] 秘境卡在境中场景页面异常:${[...new Set(pageErrors)].join(" | ")}`,
      );
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 历练首屏的主线优先:秘境支线默认收口,首个地界行动要在首屏里看得见 */
async function taskAdventureFold() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    await seedSave(ctx, showcaseSlices("light"), "__adventureFold");
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/adventure", 700);
    checked += 1;
    if (rendered === 0) {
      failures.push("[390-adventure] 历练页没渲染出来,首屏判据没量到东西");
    } else {
      const fold = await page.evaluate(() => {
        const nav = document.querySelector("nav")?.getBoundingClientRect();
        const title = [...document.querySelectorAll("h2")].find(
          (el) => (el.textContent || "").trim() === "历练",
        );
        const secret = document.querySelector("[data-secret-realm-card]");
        const toggle = secret?.querySelector("[data-secret-realm-card-toggle]");
        const action = [
          ...document.querySelectorAll("[data-adventure-regions] [data-region-action]"),
        ].find((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        const titleRect = title?.getBoundingClientRect();
        const secretRect = secret?.getBoundingClientRect();
        const actionRect = action?.getBoundingClientRect();
        return {
          navTop: nav?.top ?? innerHeight,
          titleTop: titleRect?.top ?? null,
          actionTop: actionRect?.top ?? null,
          actionBottom: actionRect?.bottom ?? null,
          secretHeight: secretRect?.height ?? null,
          cardExpanded: toggle?.getAttribute("aria-expanded") ?? null,
          hasBody: Boolean(document.querySelector("#secret-realm-body")),
        };
      });
      checked += 1;
      if (fold.cardExpanded !== "false") {
        failures.push(
          `[390-adventure] 未入秘境时支线卡没有默认收口(aria-expanded=${fold.cardExpanded})`,
        );
      }
      if (fold.secretHeight === null || fold.secretHeight > 80) {
        failures.push(`[390-adventure] 秘境支线收口后仍占 ${fold.secretHeight ?? "?"}px,超过 80px`);
      }
      if (fold.actionTop === null || fold.actionBottom === null) {
        failures.push("[390-adventure] 首屏找不到任何地界行动入口");
      } else {
        if (fold.titleTop === null || fold.titleTop > fold.actionTop) {
          failures.push("[390-adventure] 「历练」标题没有排在地界行动之前");
        }
        if (fold.actionBottom > fold.navTop + 1) {
          failures.push(
            `[390-adventure] 首处地界的行动入口被推到折线以下(action bottom ${Math.round(fold.actionBottom)} / nav top ${Math.round(fold.navTop)})`,
          );
        }
      }
      const toggle = page.locator("[data-secret-realm-card-toggle]").first();
      if ((await toggle.count()) === 0) {
        failures.push("[390-adventure] 收口后的秘境卡没有展开入口");
      } else {
        await toggle.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(120);
        checked += 1;
        const opened = await page.evaluate(() => ({
          expanded:
            document
              .querySelector("[data-secret-realm-card-toggle]")
              ?.getAttribute("aria-expanded") ?? null,
          hasBody: (() => {
            const body = document.querySelector("#secret-realm-body");
            if (!body) return false;
            return (
              getComputedStyle(body).display !== "none" && body.getBoundingClientRect().height > 0
            );
          })(),
        }));
        if (opened.expanded !== "true" || !opened.hasBody) {
          failures.push("[390-adventure] 秘境卡点「展开」后没有真正铺出名录");
        }
      }
    }
    if (pageErrors.length)
      failures.push(`[390-adventure] 历练首屏页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return {
    failures,
    checked,
    contrastFails: [],
    pixelContrastFails: [],
    zoomFails: [],
  };
}

/** 洞府首屏的营造优先:主升级键要在底栏以上,完整账要点得开 */
async function taskDongfuFold() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    await seedSave(ctx, showcaseSlices("light"), "__dongfuFold");
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/dongfu", 700);
    checked += 1;
    if (rendered === 0) {
      failures.push("[390-dongfu] 洞府页没渲染出来,首屏判据没量到东西");
    } else {
      const fold = await page.evaluate(() => {
        const nav = document.querySelector("nav")?.getBoundingClientRect();
        const buildTitle = [...document.querySelectorAll("h2")].find(
          (el) => (el.textContent || "").trim() === "营造",
        );
        const estateTitle = [...document.querySelectorAll("h2")].find(
          (el) => (el.textContent || "").trim() === "家业 · 财与人",
        );
        const action = [
          ...document.querySelectorAll("[data-building-action]:not([disabled])"),
        ].find((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        const card = action?.closest(".card-ink");
        const toggle = card?.querySelector("[data-building-detail-toggle]");
        const detailId = toggle?.getAttribute("aria-controls") || "";
        const detail = detailId ? document.getElementById(detailId) : null;
        const actionRect = action?.getBoundingClientRect();
        return {
          navTop: nav?.top ?? innerHeight,
          buildTitleTop: buildTitle?.getBoundingClientRect().top ?? null,
          estateTitleTop: estateTitle?.getBoundingClientRect().top ?? null,
          actionTop: actionRect?.top ?? null,
          actionBottom: actionRect?.bottom ?? null,
          toggleExpanded: toggle?.getAttribute("aria-expanded") ?? null,
          detailVisible: Boolean(
            detail &&
            getComputedStyle(detail).display !== "none" &&
            detail.getBoundingClientRect().height > 0,
          ),
        };
      });
      checked += 1;
      if (fold.buildTitleTop === null || fold.estateTitleTop === null) {
        failures.push("[390-dongfu] 首屏找不到「营造」或「家业 · 财与人」题头");
      } else if (fold.buildTitleTop >= fold.estateTitleTop) {
        failures.push("[390-dongfu] 「营造」没有排在家业入口之前");
      }
      if (fold.actionTop === null || fold.actionBottom === null) {
        failures.push("[390-dongfu] 首屏找不到任何可用的建筑升级/建造键");
      } else if (fold.actionBottom > fold.navTop + 1) {
        failures.push(
          `[390-dongfu] 首枚可用营造键被推到折线以下(action bottom ${Math.round(fold.actionBottom)} / nav top ${Math.round(fold.navTop)})`,
        );
      }
      if (fold.toggleExpanded !== "false" || fold.detailVisible) {
        failures.push(
          `[390-dongfu] 建筑卡详情没有默认收口(aria-expanded=${fold.toggleExpanded}, visible=${fold.detailVisible})`,
        );
      }

      const toggle = page.locator("[data-building-detail-toggle]").first();
      if ((await toggle.count()) === 0) {
        failures.push("[390-dongfu] 建筑卡没有详情开关");
      } else {
        await toggle.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(120);
        checked += 1;
        const opened = await page.evaluate(() => {
          const toggle = document.querySelector("[data-building-detail-toggle]");
          const detailId = toggle?.getAttribute("aria-controls") || "";
          const detail = detailId ? document.getElementById(detailId) : null;
          return {
            expanded: toggle?.getAttribute("aria-expanded") ?? null,
            visible: Boolean(
              detail &&
              getComputedStyle(detail).display !== "none" &&
              detail.getBoundingClientRect().height > 0,
            ),
            text: (detail?.textContent || "").replace(/\s+/g, " ").trim(),
          };
        });
        if (opened.expanded !== "true" || !opened.visible || !/当前效果/.test(opened.text)) {
          failures.push("[390-dongfu] 建筑卡点开详情后没有铺出完整效果");
        }
      }
    }
    if (pageErrors.length)
      failures.push(`[390-dongfu] 洞府首屏页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return {
    failures,
    checked,
    contrastFails: [],
    pixelContrastFails: [],
    zoomFails: [],
  };
}

/** 界域志首屏的此刻优先:当前境先到眼前,四界卷目按需展开 */
async function taskCodexFold() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    await seedSave(ctx, showcaseSlices("light"), "__codexFold");
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/codex", 700);
    checked += 1;
    if (rendered === 0) {
      failures.push("[390-codex] 界域志没渲染出来,首屏判据没量到东西");
    } else {
      const fold = await page.evaluate(() => {
        const nav = document.querySelector("nav")?.getBoundingClientRect();
        const hero = document.querySelector("[data-realm-current]");
        const heroRect = hero?.getBoundingClientRect();
        const name = (hero?.querySelector("[data-current-realm-name]")?.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        const worldPos = (hero?.querySelector("[data-current-world-position]")?.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        const toggles = [...document.querySelectorAll("[data-world-toggle]")];
        const readToggle = (btn) => {
          const bodyId = btn?.getAttribute("aria-controls") || "";
          const body = bodyId ? document.getElementById(bodyId) : null;
          return {
            state: btn?.getAttribute("data-world-state") ?? null,
            expanded: btn?.getAttribute("aria-expanded") ?? null,
            bodyVisible: Boolean(
              body &&
              getComputedStyle(body).display !== "none" &&
              body.getBoundingClientRect().height > 0,
            ),
            text: (body?.textContent || "").replace(/\s+/g, " ").trim(),
          };
        };
        const current = toggles.find((btn) => btn.getAttribute("data-world-state") === "current");
        const nonCurrent = toggles
          .filter((btn) => btn.getAttribute("data-world-state") !== "current")
          .map(readToggle);
        return {
          navTop: nav?.top ?? innerHeight,
          heroTop: heroRect?.top ?? null,
          heroBottom: heroRect?.bottom ?? null,
          name,
          worldPos,
          current: readToggle(current),
          nonCurrentOpen: nonCurrent.some((row) => row.expanded === "true" || row.bodyVisible),
        };
      });
      checked += 1;
      if (fold.heroTop === null || fold.heroBottom === null) {
        failures.push("[390-codex] 界域志首屏没有当前境卷首");
      } else if (fold.heroBottom > fold.navTop + 1) {
        failures.push(
          `[390-codex] 当前境卷首被推到折线以下(hero bottom ${Math.round(fold.heroBottom)} / nav top ${Math.round(fold.navTop)})`,
        );
      }
      if (!fold.name.includes("真仙") || !fold.worldPos.includes("仙界 1/5")) {
        failures.push(
          `[390-codex] 卷首没有报出当前境与界内序号(境「${fold.name}」/ 位置「${fold.worldPos}」)`,
        );
      }
      if (fold.current.expanded !== "true" || !fold.current.bodyVisible) {
        failures.push(
          `[390-codex] 当前界没有默认展开(aria-expanded=${fold.current.expanded}, visible=${fold.current.bodyVisible})`,
        );
      }
      if (fold.nonCurrentOpen) {
        failures.push("[390-codex] 非当前界默认没有收口,卷首又被长列表顶走");
      }

      const currentToggle = page.locator('[data-world-toggle][data-world-state="current"]').first();
      if ((await currentToggle.count()) === 0) {
        failures.push("[390-codex] 当前界没有卷目开关");
      } else {
        await currentToggle.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(120);
        checked += 1;
        const collapsed = await page.evaluate(() => {
          const btn = document.querySelector('[data-world-toggle][data-world-state="current"]');
          const bodyId = btn?.getAttribute("aria-controls") || "";
          const body = bodyId ? document.getElementById(bodyId) : null;
          return {
            expanded: btn?.getAttribute("aria-expanded") ?? null,
            visible: Boolean(
              body &&
              getComputedStyle(body).display !== "none" &&
              body.getBoundingClientRect().height > 0,
            ),
          };
        });
        if (collapsed.expanded !== "false" || collapsed.visible) {
          failures.push(
            `[390-codex] 点当前界题头没有收卷(aria-expanded=${collapsed.expanded}, visible=${collapsed.visible})`,
          );
        }
      }

      const futureToggle = page.locator('[data-world-toggle][data-world-state="future"]').first();
      if ((await futureToggle.count()) === 0) {
        failures.push("[390-codex] 没有未至界可供展开");
      } else {
        await futureToggle.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(120);
        checked += 1;
        const opened = await page.evaluate(() => {
          const btn = document.querySelector('[data-world-toggle][data-world-state="future"]');
          const bodyId = btn?.getAttribute("aria-controls") || "";
          const body = bodyId ? document.getElementById(bodyId) : null;
          return {
            expanded: btn?.getAttribute("aria-expanded") ?? null,
            visible: Boolean(
              body &&
              getComputedStyle(body).display !== "none" &&
              body.getBoundingClientRect().height > 0,
            ),
            text: (body?.textContent || "").replace(/\s+/g, " ").trim(),
          };
        });
        if (
          opened.expanded !== "true" ||
          !opened.visible ||
          !/神人/.test(opened.text) ||
          !/神帝/.test(opened.text)
        ) {
          failures.push("[390-codex] 未至界点开后没有铺出该界境界");
        }
      }
    }
    if (pageErrors.length)
      failures.push(`[390-codex] 界域志首屏页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return {
    failures,
    checked,
    contrastFails: [],
    pixelContrastFails: [],
    zoomFails: [],
  };
}

/** 成就谱首屏的眼下可追:先列最近三枚,方向卷目按需展开 */
async function taskAchievementFold() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const slices = showcaseSlices("light");
    slices.quests.counters = { kills: 48, explores: 9 };
    slices.quests.achieved = [
      "a_r0",
      "a_r1",
      "a_r2",
      "a_r3",
      "a_r4",
      "a_r5",
      "a_r6",
      "a_r7",
      "a_r8",
      "a_r9",
      "a_q4",
      "a_q6",
      "a_q7",
    ];
    await seedSave(ctx, slices, "__achievementFold");

    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/collection", 700);
    checked += 1;
    if (rendered === 0) {
      failures.push("[390-achievement] 藏珍与成就没渲染出来,首屏判据没量到东西");
    } else {
      const readGroups = () =>
        page.evaluate(() => {
          const nav = document.querySelector("nav")?.getBoundingClientRect();
          const hero = document.querySelector("[data-achievement-hero]");
          const heroRect = hero?.getBoundingClientRect();
          const jumps = [...document.querySelectorAll("[data-achievement-jump]")].map((btn) => ({
            id: btn.getAttribute("data-achievement-jump") ?? "",
            direction: btn.getAttribute("data-achievement-jump-direction") ?? "",
            text: (btn.textContent || "").replace(/\s+/g, " ").trim(),
          }));
          const toggles = [...document.querySelectorAll("[data-achievement-group-toggle]")].map(
            (btn) => {
              const bodyId = btn.getAttribute("aria-controls") || "";
              const body = bodyId ? document.getElementById(bodyId) : null;
              return {
                direction: btn.getAttribute("data-achievement-group-toggle") ?? "",
                expanded: btn.getAttribute("aria-expanded") ?? null,
                bodyVisible: Boolean(
                  body &&
                  getComputedStyle(body).display !== "none" &&
                  body.getBoundingClientRect().height > 0,
                ),
                bodyText: (body?.textContent || "").replace(/\s+/g, " ").trim(),
                bodyIds: [...(body?.querySelectorAll("[data-achievement-id]") ?? [])].map(
                  (row) => row.getAttribute("data-achievement-id") ?? "",
                ),
              };
            },
          );
          const open = toggles.filter((row) => row.expanded === "true");
          return {
            navTop: nav?.top ?? innerHeight,
            heroTop: heroRect?.top ?? null,
            heroBottom: heroRect?.bottom ?? null,
            heroText: (hero?.textContent || "").replace(/\s+/g, " ").trim(),
            jumps,
            toggles,
            open,
          };
        });

      const fold = await readGroups();
      checked += 1;
      if (fold.heroTop === null || fold.heroBottom === null) {
        failures.push("[390-achievement] 首屏没有成就谱卷首");
      } else if (fold.heroBottom > fold.navTop + 1) {
        failures.push(
          `[390-achievement] 成就谱卷首被推到折线以下(hero bottom ${Math.round(fold.heroBottom)} / nav top ${Math.round(fold.navTop)})`,
        );
      }
      if (fold.jumps.length !== 3) {
        failures.push(`[390-achievement] 眼下可追应列 3 枚,实见 ${fold.jumps.length} 枚`);
      }
      if (!fold.heroText.includes("初试锋芒") || !fold.heroText.includes("48 / 50")) {
        failures.push("[390-achievement] 卷首没有把最近成就的名称与真实进度摊开");
      }
      if (fold.open.length !== 1 || !fold.open[0]?.bodyVisible) {
        failures.push(
          `[390-achievement] 方向卷目应默认只开一路(open=${fold.open.length}, visible=${fold.open[0]?.bodyVisible})`,
        );
      }
      if (
        !fold.open[0]?.bodyText.includes("击败 50 个敌人") ||
        fold.open[0]?.bodyText.includes("???")
      ) {
        failures.push("[390-achievement] 默认展开的成就行没有直接写明条件,仍在用「???」遮名");
      }

      const currentDirection = fold.open[0]?.direction ?? "";
      const jump = fold.jumps.find((row) => row.direction && row.direction !== currentDirection);
      if (!jump) {
        failures.push("[390-achievement] 眼下可追没有跨方向的目标可供验证");
      } else {
        await page
          .locator(`[data-achievement-jump="${jump.id}"]`)
          .click({ timeout: 3000 })
          .catch(() => {});
        await page.waitForTimeout(350);
        checked += 1;
        const jumped = await readGroups();
        const open = jumped.open[0];
        if (
          jumped.open.length !== 1 ||
          open?.direction !== jump.direction ||
          !open?.bodyVisible ||
          !open.bodyIds.includes(jump.id)
        ) {
          failures.push(
            `[390-achievement] 点「${jump.id}」没有展开目标方向卷目` +
              `(期望 ${jump.direction},实见 ${open?.direction ?? "无"})`,
          );
        }
      }

      const openToggle = page
        .locator('[data-achievement-group-toggle][aria-expanded="true"]')
        .first();
      if ((await openToggle.count()) === 0) {
        failures.push("[390-achievement] 当前没有可收起的成就卷目");
      } else {
        await openToggle.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(120);
        checked += 1;
        const collapsed = await readGroups();
        if (collapsed.open.length !== 0) {
          failures.push("[390-achievement] 点开着的方向题头没有收卷");
        }
      }

      const closedToggle = page
        .locator('[data-achievement-group-toggle][aria-expanded="false"]')
        .first();
      if ((await closedToggle.count()) === 0) {
        failures.push("[390-achievement] 没有收着的方向卷目可供换开");
      } else {
        await closedToggle.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(120);
        checked += 1;
        const reopened = await readGroups();
        if (reopened.open.length !== 1 || !reopened.open[0]?.bodyVisible) {
          failures.push("[390-achievement] 点收着的方向题头没有铺出该方向成就");
        }
      }
    }
    if (pageErrors.length)
      failures.push(`[390-achievement] 成就谱首屏页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return {
    failures,
    checked,
    contrastFails: [],
    pixelContrastFails: [],
    zoomFails: [],
  };
}

/** 藏珍谱首屏的新得优先:卷首报新得,九册最多先展开三册值得看的 */
async function taskCollectionFold() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const slices = showcaseSlices("light");
    // 展品档丹匣里的药会在启动时补收进丹方录;本判据自己造四册新得,
    // 故清空丹匣并标认知已播种,避免启动自愈再造出第五册。
    slices.inventory.pills = {};
    slices.lore = { seeded: true };
    const now = Date.now();
    const equip = [EQUIPMENT_TEMPLATES[0].id];
    const gongfa = [GONGFA[0].id, GONGFA[1].id];
    const pet = [PETS[0].id];
    const event = [EVENTS[0].id];
    const freshEntryText = new Map([
      ["equip", EQUIPMENT_TEMPLATES[0].name],
      ["gongfa", GONGFA[0].name],
      ["pet", PETS[0].name],
      ["event", EVENTS[0].title],
    ]);
    slices.quests.lastCollectionViewAt = now - 60_000;
    slices.quests.collections = {
      ...slices.quests.collections,
      equip,
      gongfa,
      pet,
      event,
    };
    slices.quests.collectedAt = {
      [`equip:${equip[0]}`]: now,
      [`gongfa:${gongfa[0]}`]: now,
      [`gongfa:${gongfa[1]}`]: now,
      [`pet:${pet[0]}`]: now,
      [`event:${event[0]}`]: now,
    };
    await seedSave(ctx, slices, "__collectionFold");

    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/collection", 700);
    checked += 1;
    if (rendered === 0) {
      failures.push("[390-collection] 藏珍与成就没渲染出来,首屏判据没量到东西");
    } else {
      const tab = page.getByRole("tab", { name: "收藏" });
      if ((await tab.count()) === 0) {
        failures.push("[390-collection] 收藏页签不存在");
      } else {
        await tab.click({ timeout: 3000 });
        await page.waitForTimeout(250);
      }

      const read = () =>
        page.evaluate(() => {
          const nav = document.querySelector("nav")?.getBoundingClientRect();
          const hero = document.querySelector("[data-collection-hero]");
          const heroRect = hero?.getBoundingClientRect();
          const toggles = [...document.querySelectorAll("[data-collection-category-toggle]")].map(
            (btn) => {
              const key = btn.getAttribute("data-collection-category-toggle") ?? "";
              const bodyId = btn.getAttribute("aria-controls") || "";
              const body = bodyId ? document.getElementById(bodyId) : null;
              return {
                key,
                expanded: btn.getAttribute("aria-expanded") ?? null,
                bodyExists: Boolean(body),
                bodyVisible: Boolean(
                  body &&
                  getComputedStyle(body).display !== "none" &&
                  body.getBoundingClientRect().height > 0,
                ),
                bodyText: (body?.textContent || "").replace(/\s+/g, " ").trim(),
              };
            },
          );
          const jumps = [...document.querySelectorAll("[data-collection-jump]")].map((btn) => {
            const rect = btn.getBoundingClientRect();
            return {
              key: btn.getAttribute("data-collection-jump") ?? "",
              text: (btn.textContent || "").replace(/\s+/g, " ").trim(),
              top: Math.round(rect.top),
              left: Math.round(rect.left),
              width: Math.round(rect.width),
            };
          });
          const moreNew = document.querySelector("[data-collection-more-new]");
          return {
            navTop: nav?.top ?? innerHeight,
            heroTop: heroRect?.top ?? null,
            heroBottom: heroRect?.bottom ?? null,
            heroText: (hero?.textContent || "").replace(/\s+/g, " ").trim(),
            toggles,
            jumps,
            moreNewText: (moreNew?.textContent || "").replace(/\s+/g, " ").trim(),
            moreNewExpanded: moreNew?.getAttribute("aria-expanded") ?? null,
          };
        });

      const fold = await read();
      checked += 1;
      if (fold.heroTop === null || fold.heroBottom === null) {
        failures.push("[390-collection] 首屏没有藏珍谱卷首");
      } else if (fold.heroBottom > fold.navTop + 1) {
        failures.push(
          `[390-collection] 藏珍谱卷首被推到折线以下(hero bottom ${Math.round(fold.heroBottom)} / nav top ${Math.round(fold.navTop)})`,
        );
      }
      if (
        !fold.heroText.includes("藏珍谱") ||
        !fold.heroText.includes("眼下新得") ||
        !fold.heroText.includes("4 册有新得") ||
        !fold.heroText.includes("5 枚待看")
      ) {
        failures.push(`[390-collection] 卷首没有把整体进度与新得数摊开(«${fold.heroText}»)`);
      }
      if (fold.toggles.length !== 9) {
        failures.push(`[390-collection] 应列九册,实见 ${fold.toggles.length} 册`);
      }
      if (fold.toggles.some((row) => !row.bodyExists)) {
        failures.push("[390-collection] 册目的 aria-controls 指向了不存在的区域");
      }
      const openKeys = fold.toggles
        .filter((row) => row.expanded === "true")
        .map((row) => row.key)
        .sort();
      const jumpKeys = fold.jumps.map((row) => row.key).sort();
      if (
        openKeys.join(",") !== jumpKeys.join(",") ||
        fold.toggles.filter((row) => row.bodyVisible).length !== 3
      ) {
        failures.push(
          `[390-collection] 新得最多的三册应默认展开(open=${openKeys.join(",") || "无"})`,
        );
      }
      const highlightedWithoutEntry = fold.jumps.filter((row) => {
        const body = fold.toggles.find((toggle) => toggle.key === row.key)?.bodyText ?? "";
        return !body.includes(freshEntryText.get(row.key) ?? "");
      });
      if (highlightedWithoutEntry.length > 0) {
        failures.push("[390-collection] 默认展开的册目没有铺出对应条目");
      }
      if (
        !fold.jumps.some((row) => row.key === "gongfa") ||
        !fold.jumps.some((row) => row.key === "pet")
      ) {
        failures.push("[390-collection] 卷首没有列出有新得的册目入口");
      }
      if (fold.jumps.length !== 3 || new Set(fold.jumps.map((row) => row.top)).size !== 1) {
        failures.push(
          `[390-collection] 三册新得应并排成索引(实见 ${fold.jumps.map((row) => `${row.key}@${row.top}`).join(" / ")})`,
        );
      }
      if (!fold.moreNewText.includes("另有 1 册新得")) {
        failures.push(`[390-collection] 第四册新得没有在卷首报出余量(«${fold.moreNewText}»)`);
      }
      const remainingNewKey =
        [...freshEntryText.keys()].find((key) => !fold.jumps.some((row) => row.key === key)) ?? "";
      await page.locator("[data-collection-more-new]").click({ timeout: 3000 });
      await page.waitForFunction(
        () =>
          document.querySelector("[data-collection-more-new]")?.textContent?.includes("收起余册") ??
          false,
      );
      const expanded = await read();
      const remainingBody =
        expanded.toggles.find((row) => row.key === remainingNewKey)?.bodyText ?? "";
      if (
        expanded.moreNewExpanded !== "true" ||
        !expanded.toggles.find((row) => row.key === remainingNewKey)?.bodyVisible ||
        !remainingBody.includes(freshEntryText.get(remainingNewKey) ?? "") ||
        !expanded.heroText.includes("4 册有新得，已展 4 册")
      ) {
        failures.push(
          `[390-collection] 余册入口没有真正展开第四册新得(«${expanded.heroText}» / «${remainingBody}»)`,
        );
      }
      await page.locator("[data-collection-more-new]").click({ timeout: 3000 });
      await page.waitForFunction(
        () =>
          document.querySelector("[data-collection-more-new]")?.textContent?.includes("展开余册") ??
          false,
      );
      const collapsedAgain = await read();
      if (
        collapsedAgain.moreNewExpanded !== "false" ||
        collapsedAgain.toggles.find((row) => row.key === remainingNewKey)?.bodyVisible ||
        !collapsedAgain.heroText.includes("4 册有新得，已展 3 册")
      ) {
        failures.push(
          `[390-collection] 余册入口没有收回第四册新得(«${collapsedAgain.heroText}» / aria=${collapsedAgain.moreNewExpanded})`,
        );
      }

      await page
        .locator('[data-collection-category-toggle="pet"]')
        .click({ timeout: 3000 })
        .catch(() => {});
      await page.waitForTimeout(120);
      checked += 1;
      const collapsed = await read();
      if (collapsed.toggles.find((row) => row.key === "pet")?.expanded !== "false") {
        failures.push("[390-collection] 点开着的册目题头没有收册");
      }

      await page
        .locator('[data-collection-jump="pet"]')
        .click({ timeout: 3000 })
        .catch(() => {});
      await page.waitForTimeout(350);
      checked += 1;
      const jumped = await read();
      const petToggle = jumped.toggles.find((row) => row.key === "pet");
      if (petToggle?.expanded !== "true" || !petToggle.bodyVisible) {
        failures.push("[390-collection] 点卷首的新得册目没有展开目标册");
      }

      await page
        .locator('[data-collection-category-toggle="equip"]')
        .click({ timeout: 3000 })
        .catch(() => {});
      await page.waitForTimeout(120);
      checked += 1;
      const reopened = await read();
      const equipToggle = reopened.toggles.find((row) => row.key === "equip");
      if (equipToggle?.expanded !== "true" || !equipToggle.bodyVisible) {
        failures.push("[390-collection] 点收着的册目题头没有铺出该册");
      }
    }
    if (pageErrors.length)
      failures.push(`[390-collection] 藏珍谱首屏页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return {
    failures,
    checked,
    contrastFails: [],
    pixelContrastFails: [],
    zoomFails: [],
  };
}

/**
 * 前尘山河 —— 跨世历史在 320 与 195 宽下必须真的画得出来。
 *
 * 空档与后期档都只有当前这一世,`data-world-history` 永远不会出现;历史行里的
 * 世界名、段数、摘要与三条气象又比普通列表长,最容易在 195 宽被挤成竖排或截断。
 * 夹具用真实生成器造三世旧世界,再从近到远核对顺序与字段,最后把整页交给
 * measurePage —— 历史册不许成为一块“只在 390 截图中看过”的孤岛。
 */
async function taskWorldHistory() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  let vite = null;
  try {
    vite = await createViteServer({
      root: ROOT,
      server: { middlewareMode: true },
      appType: "custom",
      logLevel: "silent",
    });
    const fixtureModule = await vite.ssrLoadModule("/scripts/lib/worldHistoryFixture.ts");
    const fixture = fixtureModule.makeWorldHistoryFixture();
    const slices = showcaseSlices("light");
    slices.adventure = {
      mortalWorld: fixture.mortalWorld,
      mortalWorldHistory: fixture.mortalWorldHistory,
      mortalBiasHistory: fixture.mortalBiasHistory,
      // 旧链全开的老存档:世界页的出发钮必须与历练守卫同源,不能把中段只画成锁。
      unlocked: fixture.mortalWorld.chain.map((place) => place.fromId),
    };
    await seedSave(ctx, slices, "__worldHistoryFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    const rendered = await openRoute(page, "/world", 700);
    checked += 1;
    if (rendered === 0) {
      failures.push("[320] 前尘山河场景:世界页没渲染出来");
    }
    const routeAccess = await page.evaluate(() => {
      const rows = [...document.querySelectorAll("[data-stage-can-depart]")];
      return {
        total: rows.length,
        departable: rows.filter((row) => row.getAttribute("data-stage-can-depart") === "true")
          .length,
        oldRoad: rows.some((row) => (row.textContent || "").includes("旧路可往")),
      };
    });
    checked += 1;
    if (routeAccess.total !== fixture.mortalWorld.chain.length) {
      failures.push(
        `[320] 本世地界应有 ${fixture.mortalWorld.chain.length} 段,实见 ${routeAccess.total} 段`,
      );
    }
    if (routeAccess.departable !== fixture.mortalWorld.chain.length) {
      failures.push(
        `[320] 旧链全开时本世地界应有 ${fixture.mortalWorld.chain.length} 段可出发,` +
          `实见 ${routeAccess.departable} 段`,
      );
    }
    if (!routeAccess.oldRoad) {
      failures.push("[320] 旧链已开的中段没有标出「旧路可往」");
    }
    const historyReady = await page
      .locator("[data-world-history]")
      .waitFor({ state: "visible", timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    checked += 1;
    if (!historyReady) {
      failures.push("[320] 前尘山河场景:历史册没出现(夹具的三世旧世界没被读出来?)");
    } else {
      for (const [width, height, tag] of [
        [320, 568, "320"],
        [195, 422, "195·200%"],
      ]) {
        await page.setViewportSize({ width, height });
        await settleVisuals(page);
        const info = await measurePage(page);
        checked += 1;
        const problems = problemsOf(info);
        if (problems.length) failures.push(`[${tag}] /world → ${problems.join(" / ")}`);

        const history = await page.evaluate(() => {
          const box = document.querySelector("[data-world-history]");
          if (!box) return null;
          const rows = [...box.querySelectorAll("[data-world-history-row]")];
          const boxRect = box.getBoundingClientRect();
          return {
            count: rows.length,
            box: {
              left: boxRect.left,
              right: boxRect.right,
              width: boxRect.width,
              scrollWidth: box.scrollWidth,
              clientWidth: box.clientWidth,
            },
            rows: rows.map((row) => {
              const rect = row.getBoundingClientRect();
              const label = row.querySelector("[data-world-history-label]");
              const title = row.querySelector("[data-world-history-title]");
              const stages = row.querySelector("[data-world-history-stages]");
              const titleRect = title?.getBoundingClientRect();
              return {
                label: (label?.textContent || "").trim(),
                title: (title?.textContent || "").trim(),
                stages: (stages?.textContent || "").trim(),
                text: (row.innerText || "").replace(/\s+/g, " ").trim(),
                left: rect.left,
                right: rect.right,
                width: rect.width,
                scrollWidth: row.scrollWidth,
                clientWidth: row.clientWidth,
                titleWidth: titleRect?.width ?? 0,
                titleScrollWidth: title?.scrollWidth ?? 0,
                titleClientWidth: title?.clientWidth ?? 0,
              };
            }),
          };
        });
        checked += 1;
        if (!history) {
          failures.push(`[${tag}] 前尘山河场景:历史册在量测时消失了`);
          continue;
        }
        if (history.count !== fixture.expectedRows.length) {
          failures.push(
            `[${tag}] 前尘山河应有 ${fixture.expectedRows.length} 世,实见 ${history.count} 世`,
          );
        }
        if (history.box.scrollWidth > history.box.clientWidth + 1) {
          failures.push(
            `[${tag}] 前尘山河册横向裁切:${history.box.scrollWidth}>${history.box.clientWidth}`,
          );
        }
        for (let i = 0; i < Math.min(history.rows.length, fixture.expectedRows.length); i += 1) {
          const row = history.rows[i];
          const expected = fixture.expectedRows[i];
          const expectedLabel = `前${["一", "二", "三"][i]}世`;
          if (row.label !== expectedLabel) {
            failures.push(
              `[${tag}] 前尘山河第 ${i + 1} 行世序是「${row.label}」,应为「${expectedLabel}」`,
            );
          }
          if (row.title !== expected.title) {
            failures.push(
              `[${tag}] 前尘山河第 ${i + 1} 行世界名「${row.title}」,应为「${expected.title}」`,
            );
          }
          if (row.stages !== `${expected.stages} 段`) {
            failures.push(
              `[${tag}] 前尘山河第 ${i + 1} 行段数是「${row.stages}」,应为 ${expected.stages} 段`,
            );
          }
          if (
            row.left < history.box.left - 1 ||
            row.right > history.box.right + 1 ||
            row.scrollWidth > row.clientWidth + 1
          ) {
            failures.push(
              `[${tag}] 前尘山河第 ${i + 1} 行越出册面:` +
                `${Math.round(row.left)}..${Math.round(row.right)} / ` +
                `册 ${Math.round(history.box.left)}..${Math.round(history.box.right)} / ` +
                `内容 ${row.scrollWidth}>${row.clientWidth}`,
            );
          }
          if (
            row.titleWidth < 40 ||
            row.titleScrollWidth > row.titleClientWidth + 1 ||
            !row.text ||
            /NaN|undefined/.test(row.text)
          ) {
            failures.push(
              `[${tag}] 前尘山河第 ${i + 1} 行文字被挤坏:` +
                `标题 ${Math.round(row.titleWidth)}px / 内容 ${row.titleScrollWidth}>` +
                `${row.titleClientWidth} / «${row.text.slice(0, 48)}»`,
            );
          }
        }
      }
    }
    if (pageErrors.length)
      failures.push(`[320] 前尘山河场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
    await vite?.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/** 切后台立即落盘 */
async function taskPersistTiming() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第十八件事:切后台/离开页面时,待刷的存档要立刻落盘 ----
  /*
   * 写盘是节流的(省电,见 savePersistence.spec),于是「刚做的改动」可能还躺在队列里;
   * 手机上的保命时机就是切后台/离开页面 —— `visibilitychange → hidden` 与 `pagehide`。
   * 单元用例测过 flushSaveWrites 本身,却没人测过这两个监听究竟接上没有:
   * 接不上,玩家切出去接个电话、回来时这一段时间就没了,而且是无声无息地没。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "落盘自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: { spiritStone: gn(1, 6), qi: 1000, wudao: 10, herb: 5, ore: 5, page: 2, dust: 2 },
      inventory: { items: [], equipped: {}, pills: {}, artifacts: [], equippedArtifacts: [] },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`xuanshu.${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/dongfu", { waitUntil: "load" });
    await page.waitForTimeout(2400);
    await page.evaluate(() => {
      for (const b of document.querySelectorAll(".pointer-events-none.fixed button")) b.click();
      Math.random = () => 1;
    });
    await page.waitForTimeout(500);
    /** 磁盘上那一份灵石(解密 resources 分片) */
    const diskStone = async () => {
      const cipher = await page.evaluate(() => localStorage.getItem("xuanshu.resources") || "");
      if (!cipher) return null;
      const plain = decryptSlice(cipher);
      if (!plain) return null;
      const v = JSON.parse(plain).spiritStone;
      return typeof v === "number" ? v : v.m * Math.pow(10, v.e);
    };
    const investOnce = async () => {
      await page
        .getByRole("button", { name: /灵脉投资/ })
        .first()
        .click({ timeout: 3000 })
        .catch(() => {});
      await page.waitForTimeout(400);
      await page
        .locator(".modal-panel button.btn-ghost:not([disabled])")
        .first()
        .click({ timeout: 3000 })
        .catch(() => {});
      await page.waitForTimeout(500);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      return readFormatted(page, "灵石");
    };
    checked += 1;
    /**
     * 先自己落一次盘,再投入 —— 否则这条判据是在跟别人的定时器赛跑。
     *
     * 引擎每秒都在改状态(修为/灵气),待写队列因此**每 6 秒必刷一次**,
     * 与「什么时候投入」毫无关系(探针实测:25 秒里无人投入也刷 4 次,
     * 时刻 2.0s / 8.1s / 14.1s / 20.0s,间隔 6.0 / 6.1 / 5.9 秒)。
     * 旧写法是等满一个窗口(5800ms)再投入,以为「此刻没有待写的队列了」——
     * 可等待结束后 5 秒内照样有别人的刷新:投入若正好跨在刷新上,磁盘读到的
     * 已经是新值,判据反过来报「节流没起作用」。CI 上偶发红就是这么来的
     * (探针按旧写法跑 8 次,误报 2 次 —— 投入那 1.5 秒落在 6 秒一拍的刷新点上)。
     *
     * 改法:自己派一次 pagehide 把盘落干净(顺带证明这条监听真的接上了),
     * 下一次刷新至少 5 秒之后 —— 投入与读数都在这个安静窗口里,读数才由判据说了算。
     * 顺带补两条前提:盘上得真是投入前的数、这笔投入得真花了钱 —— 少了它们,
     * 读数不成立(比如页面值没读出来)时判据会静默空过,看着绿其实什么都没证。
     */
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await page.waitForTimeout(300);
    const start = await readFormatted(page, "灵石");
    const startDisk = await diskStone();
    // 前提:盘上得真是投入前的数。这一条不成立,后面「没立刻变」什么都证明不了
    if (
      startDisk === null ||
      start.value === null ||
      Math.abs(startDisk - start.value) > start.value * 0.001
    ) {
      failures.push(
        `[390] 落盘场景:派发 pagehide 之后磁盘还是 ${startDisk},页面已是 ${start.text} —— 待刷存档没落盘`,
      );
    }
    const afterInvest = await investOnce();
    const onDiskBefore = await diskStone();
    // 这一笔得真的花掉了钱 —— 否则「盘上没有跟着变」只是因为什么都没发生
    if (
      start.value !== null &&
      afterInvest.value !== null &&
      Math.abs(afterInvest.value - start.value) < start.value * 0.001
    ) {
      failures.push(
        "[390] 落盘场景:投脉之后页面上的灵石没变 —— 这一步没真花掉钱,后面两条判据都不作数",
      );
    }
    // 节流在起作用:投入之后这一瞬,盘上还该停在投入前的数(而不是跟着页面一起变)
    if (
      startDisk === null ||
      onDiskBefore === null ||
      Math.abs(onDiskBefore - startDisk) > startDisk * 0.001
    ) {
      failures.push(
        `[390] 落盘场景:投入之后磁盘立刻从 ${startDisk} 变成 ${onDiskBefore} —— 节流没起作用(这笔投入本该还躺在待刷队列里)`,
      );
    }
    // ① 切后台
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(400);
    const afterHidden = await diskStone();
    if (
      afterInvest.value !== null &&
      (afterHidden === null || Math.abs(afterHidden - afterInvest.value) > afterInvest.value * 0.01)
    ) {
      failures.push(
        `[390] 落盘场景:切后台(visibilitychange→hidden)之后磁盘还是 ${afterHidden},页面已是 ${afterInvest.text} —— 待刷存档没落盘`,
      );
    }
    // ② 离开页面(pagehide)
    const second = await investOnce();
    if (
      afterInvest.value !== null &&
      second.value !== null &&
      Math.abs(second.value - afterInvest.value) < afterInvest.value * 0.001
    ) {
      failures.push("[390] 落盘场景:第二次投脉之后页面上的灵石没变 —— 这一条同样不作数");
    }
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await page.waitForTimeout(400);
    const afterHide = await diskStone();
    if (
      second.value !== null &&
      (afterHide === null || Math.abs(afterHide - second.value) > second.value * 0.01)
    ) {
      failures.push(
        `[390] 落盘场景:pagehide 之后磁盘还是 ${afterHide},页面已是 ${second.text} —— 待刷存档没落盘`,
      );
    }
    if (pageErrors.length)
      failures.push(`[390] 落盘场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    console.log(
      `\n落盘时机:开局 ${start.text}(盘上 ${startDisk})→ 投脉后页面 ${afterInvest.text}` +
        `(盘上仍 ${onDiskBefore},节流中)→ 切后台落盘 ${afterHidden} · 再投一次 ${second.text} → pagehide 落盘 ${afterHide}`,
    );
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 导出失败也说话 */
async function taskExportFailure() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第十七件事:导出失败必须说出来(打断浏览器的下载能力再点一次) ----
  /*
   * 「导出存档」是玩家丢档前唯一的保险。而 Web 这条路靠 `saveAs`(Blob + a[download])——
   * 受限 WebView、部分应用内浏览器里 `URL.createObjectURL` 直接不可用,于是它抛错。
   * 调用方是 `void exportSaveToDevice()`,既不看返回值也不接异常,结果就是:
   * 点下去既没文件、也没提示。故这里把下载能力打断,要求界面**说得出这句话**。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      acceptDownloads: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "导出自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: { spiritStone: gn(1, 6), qi: 1000, wudao: 10, herb: 5, ore: 5, page: 2, dust: 2 },
      inventory: { items: [], equipped: {}, pills: {}, artifacts: [], equippedArtifacts: [] },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`xuanshu.${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#" + "/settings", { waitUntil: "load" });
    await page.waitForTimeout(2200);
    await clearOverlays(page);
    checked += 1;
    // 把下载这条路打断 —— 受限 WebView / 应用内浏览器正是这样
    await page.evaluate(() => {
      URL.createObjectURL = () => {
        throw new Error("createObjectURL is not available");
      };
    });
    await page
      .getByRole("button", { name: /导出存档/ })
      .first()
      .click();
    await page.waitForTimeout(1500);
    const said = await page.evaluate(() =>
      [...document.querySelectorAll(".pointer-events-none.fixed button")]
        .map((b) => (b.textContent || "").trim())
        .join("|"),
    );
    if (!/导出|下载/.test(said))
      failures.push(
        `[390] 导出失败场景:下载能力不可用时点了「导出存档」,界面一声不响(${said || "无提示"})`,
      );
    else console.log(`\n导出失败也说话:「${said.split("|")[0]}」`);
    if (pageErrors.length)
      failures.push(`[390] 导出失败场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 坏档也能进游戏 */
async function taskBadSave() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第十六件事:坏档也能进游戏,而且要说得清哪一片坏了 ----
  /*
   * 分片损坏是最容易变成「白屏」或「我的东西怎么没了」的一种事故:
   * 启动前的 preflightScan 会把读不出来的分片挪到备份键、其余照常开局。
   * 这条判据查三件事:① 照样进得去(不白屏);② 启动时说了话;
   * ③ 设置页常驻一条说得出「哪一片坏了、原档还在哪」——坏档只弹一条两秒的提示是不够的,
   *    玩家多半是先发现「灵石怎么归零了」,再回来找原因。
   */
  {
    const ctx = await auditContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const slices = {
      game: {
        started: true,
        saveVersion: 2,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        totalPlaySec: 0,
        createRerolls: 8,
        createProfile: null,
      },
      player: {
        name: "坏档自检",
        major: 5,
        sub: 3,
        exp: gn(1, 2),
        age: 40,
        lifespanBonusYears: 0,
        dead: false,
        reincarnation: {
          count: 0,
          daoFruit: 0,
          talents: [],
          insight: 0,
          lives: [],
          vow: null,
          trial: null,
          bonds: [],
        },
        linggen: {
          roots: [{ element: "wood", aptitude: 70 }],
          gradeName: "单灵根",
          growthMult: 1.1,
        },
      },
      resources: { spiritStone: gn(1, 6), qi: 1000, wudao: 10, herb: 5, ore: 5, page: 2, dust: 2 },
      inventory: { items: [], equipped: {}, pills: {}, artifacts: [], equippedArtifacts: [] },
      endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
      settings: {
        privacyAccepted: true,
        sfxOn: false,
        musicOn: false,
        musicVol: 0,
        sfxVol: 0,
        reduceMotion: true,
        battleSpeed: 4,
        decomposeRanks: [],
        smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
        theme: "light",
      },
    };
    await ctx.addInitScript(
      (data) => {
        if (localStorage.getItem("__layoutSeeded")) return;
        for (const [k, v] of Object.entries(data)) {
          // 故意写坏一个分片(既不是本游戏密文,也不是合法 JSON)
          localStorage.setItem(k, k.endsWith(".resources") ? "这不是存档" : v);
        }
        localStorage.setItem("__layoutSeeded", "1");
      },
      Object.fromEntries(Object.entries(slices).map(([k, v]) => [`xuanshu.${k}`, enc(v)])),
    );
    const page = await ctx.newPage();
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX, { waitUntil: "load" });
    checked += 1;
    /**
     * 启动提示只活两秒多,而冷启动到首帧的耗时是浮动的 —— 固定读一次会偶发读空
     * (实测同一份产物两次跑,一次读到、一次读到空串)。故轮询到它出现为止:
     * 判据不变(提示文本必须含「损坏/异常/隔离」),只是不再拿运气当判据。
     */
    await page
      .waitForFunction(() => /损坏|异常|隔离/.test(document.body.innerText), { timeout: 20000 })
      .catch(() => undefined);
    const boot = await page.evaluate(() => ({
      alive: !!document.querySelector("#app")?.firstElementChild,
      hash: location.hash,
      toasts: [...document.querySelectorAll(".pointer-events-none.fixed button")]
        .map((b) => (b.textContent || "").trim())
        .join("|"),
      backedUp: Object.keys(localStorage).some((k) => k.startsWith("corrupt.")),
    }));
    if (!boot.alive) failures.push("[390] 坏档场景:坏掉一个分片之后界面都没起来(白屏)");
    if (!/损坏|异常|隔离/.test(boot.toasts))
      failures.push(`[390] 坏档场景:启动时没有交代坏档(${boot.toasts || "无提示"})`);
    if (!boot.backedUp) failures.push("[390] 坏档场景:坏掉的分片没有被隔离备份(原档直接丢了)");
    /*
     * 冷启动时 app.mount 会早于 router 的首轮导航落定。若这时立刻把 hash 改成
     * /settings,首轮导航的尾帧仍可能把它写回 / —— 下面的 20 秒便只是在等一个
     * 已经被覆盖的目标(全量并发跑时实测当前页停在 #/,单跑却过)。
     * 先等首轮导航真的落在 /,再改 hash;这里不碰判据,只消除启动竞态。
     */
    const bootRouteSettled = await page
      .waitForFunction(() => location.hash === "#/", { timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!bootRouteSettled)
      failures.push(
        `[390] 坏档场景:首轮导航未落在首页(当前页:${
          (await page.evaluate(() => location.hash)) || "?"
        })`,
      );
    await page.evaluate(() => {
      location.hash = "#/settings";
    });
    await page
      .waitForFunction(() => location.hash.startsWith("#/settings"), { timeout: 5000 })
      .catch(() => undefined);
    /**
     * 等那张卡真的画出来 —— 不要固定 900ms。
     *
     * 设置页是路由分包,忙时首帧浮动:本轮实测(加了只读页对比度采样之后)同一份产物
     * 偶发三条假红 —— 卡还没渲染,读到的 notice 是空串,于是「没有常驻交代 / 没说出
     * 哪一片 / 没说出备份位置」三条一起亮,而截图里它明明在。判据不变,只把等待换成
     * 确定性:等到含「存档版本」的卡片出现为止(启动提示那条也是这么改的)。
     */
    /**
     * 并发跑到 8 路时,设置页是路由分包里的最后一个冷 chunk —— 实测本机单跑 55ms
     * 就能出卡,但整轮 204 个组合并行时偶发超过 8 秒(本轮 20:xx 那次:三条判据
     * 一起亮,而同一份产物单跑时卡片就在)。故把上限抬到 20 秒,**判据不变**;
     * 超时也不再只是留个空串:把整页正文的头一段带进失败信息,下次能一眼分清
     * 「卡没画出来」与「卡画出来了但没写那三件事」。
     */
    const cardShown = await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll(".card-ink")].some((c) =>
            (c.textContent || "").includes("存档版本"),
          ),
        { timeout: 20000 },
      )
      .then(() => true)
      .catch(() => false);
    const notice = await page.evaluate(() => {
      const card = [...document.querySelectorAll(".card-ink")].find((c) =>
        (c.textContent || "").includes("存档版本"),
      );
      return (card?.innerText || "").replace(/\n+/g, " ");
    });
    if (!cardShown) {
      const where = await page.evaluate(() =>
        document.body.innerText.replace(/\s+/g, " ").slice(0, 120),
      );
      failures.push(
        `[390] 坏档场景:设置页的「存档版本」卡片 20 秒内没画出来(当前页:${
          (await page.evaluate(() => location.hash)) || "?"
        } · 正文:${where || "空"})`,
      );
    } else if (!/分片损坏/.test(notice))
      failures.push("[390] 坏档场景:设置页没有常驻交代(只说一次两秒的提示,玩家回头找不到原因)");
    // 卡片没画出来时只报一条(上一条已经说了)—— 否则同一件事会亮三条假红
    if (cardShown && !/资源/.test(notice))
      failures.push(`[390] 坏档场景:设置页没说出坏的是哪一片 —— ${notice.slice(0, 80)}`);
    if (cardShown && !/corrupt\./.test(notice))
      failures.push("[390] 坏档场景:设置页没说出原档备份在哪(玩家/帮他的人找不回来)");
    if (pageErrors.length)
      failures.push(`[390] 坏档场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
    console.log(`
坏档开局:界面照常起来 · 启动提示「${boot.toasts.split("|")[0] ?? "无"}」 · 设置页「${notice.slice(0, 46)}…」`);
    await ctx.close();
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** iOS 存档风险提示 */
async function taskIosNotice() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第三十一件事:iOS 的存档风险提示,该说的说、不该说的一个字不说 ----
  /*
   * 由来:WebKit 会把**七天没被打开过**的站点的脚本可写存储整个清掉 —— localStorage 里
   * 那份存档与 Service Worker 缓存一起没。而这是个放置游戏,「隔几天回来」正是常态。
   * 唯一真管用的办法是让游戏成为已安装的 Web App(添加到主屏幕),故 iOS 未安装时提示一次。
   *
   * 判据两头都要钉,因为**说错话的代价**比不说更大:
   *   一 iOS 未安装:主页要出现,且「知道了」之后重载不再出现(写盘真落了),设置页常驻一份可回查
   *   二 iOS 已装到主屏幕:不再劝(它已经不吃那条规则了)
   *   三 桌面/安卓:一个字都不许说 —— 它们用应用自己的存储,在那儿喊「iOS 会清存档」是胡说
   */
  {
    const UA_IOS =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
    const UA_DESKTOP =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
    const enc = encryptSlice;
    const gn = (m, e) => ({ m, e });
    const save = Object.fromEntries(
      Object.entries({
        game: {
          started: true,
          saveVersion: 2,
          createdAt: Date.now() - 40 * 86400000,
          lastActiveAt: Date.now(),
          totalPlaySec: 0,
          createRerolls: 8,
          createProfile: null,
        },
        player: {
          name: "iOS 自检",
          major: 5,
          sub: 3,
          exp: gn(1, 2),
          age: 40,
          lifespanBonusYears: 0,
          dead: false,
          reincarnation: {
            count: 0,
            daoFruit: 0,
            talents: [],
            insight: 0,
            lives: [],
            vow: null,
            trial: null,
            bonds: [],
          },
          linggen: {
            roots: [{ element: "wood", aptitude: 70 }],
            gradeName: "单灵根",
            growthMult: 1.1,
          },
        },
        resources: {
          spiritStone: gn(1, 6),
          qi: 1000,
          wudao: 10,
          herb: 5,
          ore: 5,
          page: 2,
          dust: 2,
        },
        inventory: { items: [], equipped: {}, pills: {}, artifacts: [], equippedArtifacts: [] },
        endgame: { daoPath: null, daoSource: 0, souls: [], equippedSouls: [] },
        settings: {
          privacyAccepted: true,
          sfxOn: false,
          musicOn: false,
          musicVol: 0,
          sfxVol: 0,
          reduceMotion: true,
          battleSpeed: 4,
          decomposeRanks: [],
          smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
          theme: "light",
        },
      }).map(([k, v]) => [`xuanshu.${k}`, enc(v)]),
    );
    const openWith = async (userAgent, standalone = false) => {
      const ctx = await auditContext({ viewport: { width: 390, height: 844 }, userAgent });
      await ctx.addInitScript(
        ([data, sa]) => {
          if (!localStorage.getItem("__layoutSeeded")) {
            for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
            localStorage.setItem("__layoutSeeded", "1");
          }
          if (sa) Object.defineProperty(navigator, "standalone", { get: () => true });
        },
        [save, standalone],
      );
      const page = await ctx.newPage();
      return { ctx, page };
    };
    /** 提示卡的标题就是它唯一的文案锚点 */
    const cardCount = (page) => page.locator("text=把游戏「添加到主屏幕」").count();

    {
      const { ctx, page } = await openWith(UA_IOS);
      await page.goto(INDEX, { waitUntil: "load" });
      await page.waitForTimeout(1500);

      /*
       * 同一条已开局的页面,顺手把「楷体由谁画」也量了(再开一套存档不值当)。
       * 查的是运行时那一半:产物里的次序对,不代表字体真加载成功 —— 文件坏了、因 base
       * 变形而 404,都会安静地回退到系统字体,界面看着只是「有点不一样」,没人报错。
       */
      checked += 1;
      const kaiFonts = await (async () => {
        const cdp = await ctx.newCDPSession(page);
        await cdp.send("DOM.enable");
        await cdp.send("CSS.enable");
        const { root } = await cdp.send("DOM.getDocument");
        const { nodeId } = await cdp.send("DOM.querySelector", {
          nodeId: root.nodeId,
          selector: "header .font-kai",
        });
        if (!nodeId) return null;
        const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
        await cdp.detach();
        return fonts.map((f) => f.familyName);
      })();
      if (!kaiFonts) failures.push("[楷体] 顶栏里找不到 font-kai 的元素,判据没量到东西");
      // 只认前缀:字形分支可能换(原版 / GB / 屏幕阅读版),但「用的是我们内置那一支」不许变
      else if (!kaiFonts.some((f) => f.startsWith("LXGW WenKai"))) {
        failures.push(
          `[楷体] 楷体文字不是内置字体画的(实际 ${kaiFonts.join(" + ")})—— 字体没加载成功?`,
        );
      } else {
        console.log(`\n楷体统一:顶栏名字由 ${kaiFonts.join(" + ")} 渲染`);
      }

      checked += 1;
      const onHome = await cardCount(page);
      if (onHome === 0)
        failures.push(
          "[iOS] 未安装时主页没有出现「添加到主屏幕」提示 —— 七天不打开就会被清档,而玩家不会知道",
        );
      const dismiss = page.locator("button", { hasText: "知道了" }).first();
      if ((await dismiss.count()) === 0)
        failures.push("[iOS] 提示卡没有「知道了」—— 劝一次就得能关掉,不能变成常驻横幅");
      else {
        await dismiss.click();
        await page.waitForTimeout(200);
      }
      if ((await cardCount(page)) !== 0) failures.push("[iOS] 点了「知道了」之后提示还在");
      await page.reload({ waitUntil: "load" });
      await page.waitForTimeout(1500);
      if ((await cardCount(page)) !== 0)
        failures.push("[iOS] 关掉之后重载又冒出来了(关掉这个动作没落盘)");
      await page.goto(INDEX + "#/settings", { waitUntil: "load" });
      await page.waitForTimeout(700);
      if ((await cardCount(page)) !== 1)
        failures.push("[iOS] 设置页没有常驻那一份 —— 玩家回头想装时找不到那两步");
      const backup = await page.evaluate(() => {
        const el = [...document.querySelectorAll("p")].find((p) =>
          (p.textContent || "").includes("上次导出备份"),
        );
        return (el?.innerText || "").replace(/\s+/g, " ");
      });
      if (!/上次导出备份/.test(backup)) failures.push("[iOS] 设置页没有「上次导出备份」那一行");
      else if (!/从未导出|天前|今天/.test(backup))
        failures.push(`[iOS] 备份那一行读不出时间:「${backup}」`);
      console.log(
        `\niOS 存档提示:主页出现一次并可关闭、关掉后重载不再出现、设置页常驻 · 备份行「${backup.slice(0, 28)}…」`,
      );
      await ctx.close();
    }
    {
      const { ctx, page } = await openWith(UA_IOS, true);
      await page.goto(INDEX, { waitUntil: "load" });
      await page.waitForTimeout(1500);
      checked += 1;
      if ((await cardCount(page)) !== 0)
        failures.push("[iOS] 已经是主屏幕应用了还在劝安装 —— 它早就不吃那条清存储规则");
      await ctx.close();
    }
    {
      const { ctx, page } = await openWith(UA_DESKTOP);
      await page.goto(INDEX, { waitUntil: "load" });
      await page.waitForTimeout(1500);
      const onHome = await cardCount(page);
      await page.goto(INDEX + "#/settings", { waitUntil: "load" });
      await page.waitForTimeout(700);
      const onSettings = await cardCount(page);
      checked += 1;
      if (onHome + onSettings !== 0) {
        failures.push(
          "[桌面] 非 iOS 上出现了「iOS 会清掉存档」的提示 —— 那是胡说,玩家会当成游戏出错",
        );
      }
      await ctx.close();
    }
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/**
 * 浮层在 200% 缩放档:页面上点得开的那些弹窗(装备详情 / 丹房 / 器魂 / 灵脉 /
 * 人物读数详情 / 一键分解 / 关于此作 / 隐私政策)。
 *
 * 与「只在某一步出现的浮层」不同,这些是**点得开**的 —— 但巡页不会去点它们,
 * 缩放档那一遍自然也碰不到。实测 195 宽下面板只有 171px:丹房的方子卡三列并排
 * 时中间只剩 42px(代价折成六行、成品折成四行),器魂详情的「收 起 / 卸 下」
 * 两枚各剩 68px、在空格处断成两行。这两类都不是「溢出」,横向溢出与越界元素都量不出来。
 *
 * 判据用与浮层那一族同一把尺子(measureDialogZoom + dialogZoomProblems),
 * 每开一扇量一次;开不出来就报红 —— 判据没量到东西时不许静默变绿。
 */
async function taskDialogZoom() {
  const failures = [];
  let checked = 0;
  const enc = encryptSlice;
  const gn = (m, e) => ({ m, e });
  const zoomWeaponTemplates = EQUIPMENT_TEMPLATES.filter(
    (tpl) => tpl.slot === "weapon" && !["w_zidian", "w_hanfeng"].includes(tpl.id),
  );
  if (zoomWeaponTemplates.length < 13) {
    throw new Error("200% 浮层夹具需要至少 13 个真实武器模板");
  }
  const extraWeaponCandidates = zoomWeaponTemplates.slice(0, 13).map((tpl, i) => ({
    uid: `dlg_candidate_${i}`,
    templateId: tpl.id,
    quality: "mortal",
    tier: 20,
    level: 0,
    affixes: [],
  }));
  const slices = {
    game: {
      started: true,
      saveVersion: 2,
      createdAt: Date.now() - 86400000 * 30,
      lastActiveAt: Date.now(),
      totalPlaySec: 0,
      createRerolls: 8,
      createProfile: null,
    },
    player: {
      major: 14,
      sub: 0,
      exp: gn(3, 9),
      age: 3000,
      lifespanBonusYears: 0,
      dead: false,
      reincarnation: {
        count: 2,
        daoFruit: 12,
        talents: [],
        insight: 400,
        lives: [],
        vow: null,
        trial: null,
        bonds: [],
      },
      linggen: {
        roots: [{ element: "fire", aptitude: 42 }],
        gradeName: "杂灵根",
        growthMult: 0.85,
      },
    },
    resources: {
      spiritStone: gn(9, 12),
      qi: 5000,
      wudao: 800,
      herb: 900,
      ore: 900,
      page: 300,
      dust: 500,
    },
    inventory: {
      items: [
        {
          uid: "dlg_w",
          templateId: "w_zidian",
          quality: "heaven",
          tier: 20,
          level: 3,
          affixes: [
            { id: "bs3", roll: 1 },
            { id: "low2", roll: 0.6 },
          ],
        },
        {
          uid: "dlg_w2",
          templateId: "w_hanfeng",
          quality: "immortal",
          tier: 20,
          level: 0,
          affixes: [{ id: "low2", roll: 0.6 }],
        },
        ...extraWeaponCandidates,
      ],
      equipped: { weapon: "dlg_w" },
      pills: { p_jvqidan: 5 },
      artifacts: [{ defId: "af_qinglian", level: 3 }],
      equippedArtifacts: ["af_qinglian"],
    },
    endgame: {
      daoPath: "sword",
      daoSource: 1200,
      souls: [{ uid: "dlg_s1", type: "fengmang", grade: 1, fromName: "旧剑" }],
      equippedSouls: ["dlg_s1"],
    },
    dongfu: {
      levels: { mansion: 4, field: 5, alchemy: 5, forge: 4, library: 4 },
      offlineCapHours: 24,
    },
    settings: {
      privacyAccepted: true,
      sfxOn: false,
      musicOn: false,
      musicVol: 0,
      sfxVol: 0,
      reduceMotion: true,
      battleSpeed: 4,
      decomposeRanks: [],
      smartKeep: { enabled: true, minQuality: 3, keepCoreAffix: true, keepComboPiece: true },
      theme: "dark",
    },
  };
  const ctx = await auditContext({
    viewport: { width: 195, height: 422 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addInitScript(
    (data) => {
      for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
    },
    Object.fromEntries(Object.entries(slices).map(([k, v]) => [`xuanshu.${k}`, enc(v)])),
  );
  const page = await ctx.newPage();
  const pageErrors = [];
  watchPageErrors(page, pageErrors);

  /** 一扇弹窗:点开 → 量 → 关掉。点不开直接报红(判据没量到东西) */
  const probe = async (label, route, click) => {
    await page.goto(INDEX + "#" + route, { waitUntil: "load" });
    await page.waitForTimeout(1100);
    await page.evaluate(() => {
      Math.random = () => 1;
      for (const b of document.querySelectorAll(".pointer-events-none.fixed button")) b.click();
    });
    try {
      await click();
    } catch (e) {
      failures.push(`[195] 浮层「${label}」点不开(${String(e).slice(0, 60)})—— 判据没量到东西`);
      return;
    }
    await page.waitForTimeout(700);
    checked += 1;
    zoomSeen += 1;
    const problems = dialogZoomProblems(await measureDialogZoom(page, { width: 390, height: 844 }));
    if (problems.length)
      failures.push(`[195] 浮层「${label}」在 200% 下坏了:${problems.join(" / ")}`);
    // 新探针会叠开两层装备详情;Escape 只收最上层,故逐层关到没有浮层为止。
    for (let i = 0; i < 3 && (await page.locator(".modal-panel").count()) > 0; i += 1) {
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(200);
  };

  // 点的是槽位行(「武器 雾隐长枪 +3」)—— 装备详情由它打开,不是背包列表
  await probe("装备详情", "/inventory", async () => {
    await page
      .locator("main button", { hasText: /雾隐长枪/ })
      .first()
      .click({ timeout: 3000 });
  });
  /*
   * 部位候选在大行囊里也会长到几十条。195px 下既要能读分页读数与两枚入口,
   * 续到第二批后也不能把候选行、战差与「换上」挤成竖排。
   */
  await probe("部位候选 · 第二批", "/inventory", async () => {
    await page.locator('[data-equip-slot="weapon"]').first().click({ timeout: 3000 });
    await page.locator("[data-slot-candidate-more]").first().click({ timeout: 3000 });
  });
  /*
   * 自动重铸此前只量到装备详情外壳,展开后的阈值滑杆 / 预算行从未进过 200% 档。
   * 195 CSS px 下实测滑杆与「开 洗」会顶出面板右侧;这条把「展开后再量」也钉住。
   */
  await probe("装备详情 · 自动重铸", "/inventory", async () => {
    await page
      .locator("main button", { hasText: /雾隐长枪/ })
      .first()
      .click({ timeout: 3000 });
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /雾隐长枪/ })
      .click({ timeout: 3000 });
    await page.getByRole("button", { name: /自动重铸/ }).click({ timeout: 3000 });
    await page
      .getByRole("button", { name: /约 .* 次/ })
      .first()
      .click({ timeout: 3000 });
  });
  /*
   * 转移面板的标题、长说明与「收起」共享一行;195px 下标题会被挤成 12px 竖排。
   * 一路点到候选与落位,把标题之后的单据行也纳入同一扇弹窗。
   */
  await probe("装备详情 · 词条转移落位", "/inventory", async () => {
    await page
      .locator("main button", { hasText: /雾隐长枪/ })
      .first()
      .click({ timeout: 3000 });
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /雾隐长枪/ })
      .click({ timeout: 3000 });
    await page.getByRole("button", { name: /词条转移/ }).click({ timeout: 3000 });
    const detail = page.locator(".modal-panel").filter({ hasText: /重铸词条|自动重铸/ });
    await detail.getByRole("button", { name: "绝境道心", exact: true }).click({ timeout: 3000 });
    await detail
      .locator("button")
      .filter({ hasText: /→.*仙品/ })
      .first()
      .click({ timeout: 3000 });
    await detail.getByRole("button", { name: /新增一条/ }).click({ timeout: 3000 });
  });
  await probe("开炉炼丹", "/inventory", async () => {
    const tab = page.getByRole("tab", { name: /丹/ }).first();
    if (await tab.count()) await tab.click();
    await page.waitForTimeout(400);
    await page
      .locator("main button", { hasText: /开炉炼丹/ })
      .first()
      .click({ timeout: 3000 });
  });
  await probe("器魂详情", "/souls", async () => {
    await page
      .locator("main button", { hasText: /锋芒|形意/ })
      .first()
      .click({ timeout: 3000 });
  });
  await probe("灵脉投资", "/dongfu", async () => {
    await page
      .locator("main button", { hasText: /灵脉投资/ })
      .first()
      .click({ timeout: 3000 });
  });
  // 人物页的详情浮层(点第一枚读数卡)与设置页的两份长文 —— 长文是 195 宽下最挤的一类
  await probe("人物读数详情", "/character", async () => {
    await page.locator("main button").first().click({ timeout: 3000 });
  });
  await probe("一键分解", "/inventory", async () => {
    await page
      .locator("main button", { hasText: /分\s*解/ })
      .first()
      .click({ timeout: 3000 });
  });
  await probe("关于此作", "/settings", async () => {
    await page
      .locator("main button", { hasText: /关于/ })
      .first()
      .click({ timeout: 3000 });
  });
  await probe("隐私政策", "/settings", async () => {
    await page
      .locator("main button", { hasText: /隐私/ })
      .first()
      .click({ timeout: 3000 });
  });

  if (pageErrors.length)
    failures.push(`[195] 浮层场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  await ctx.close();
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/** 构建产物 · dvh/字体栈 */
async function taskBuildArtifacts() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  // ---- 第二十七件事:外壳高度认 dvh,不认 vh ----
  /*
   * 上面「两栏钉死」那条量的是**机制**,可无头浏览器的 100vh 恰好等于可视高度 ——
   * 把外壳换回 vh,它照样全绿。差别只在手机浏览器里出现:地址栏挂着时 vh 是大视口,
   * 底栏被压在工具栏底下。所以这条退一步查**构建产物**:外壳高度得写成 dvh。
   */
  {
    checked += 1;
    const dir = join(ROOT, "dist/assets");
    const css = readdirSync(dir)
      .filter((f) => f.endsWith(".css"))
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n");
    // 认这个高度的选择器要凑齐四层 —— 少一层,那点差值就成了文档层的可滚余量
    // (压缩器会把连着的选择器并进一条规则,所以这里是按选择器查,不是按声明数数)
    const covered = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, , body]) => body.includes("height:var(--app-shell-height)"))
      .flatMap(([, sel]) => sel.split(",").map((s) => s.trim()));
    const missing = ["html", "body", "#app", ".app-shell"].filter((s) => !covered.includes(s));
    if (missing.length)
      failures.push(`外壳高度没铺满四层,缺 ${missing.join(" / ")}(少一层就攒出可滚余量)`);
    if (!css.includes("100dvh")) {
      failures.push("外壳高度没走 dvh(手机浏览器地址栏挂在外面时,底栏会被压住)");
    }
    /*
     * 楷体栈:内置那份必须**排第一**。
     *
     * 这条只能查产物,查运行时没有意义:无头容器里没有系统楷体,排在第四位也一样会被
     * 选中 —— 绿得毫无信息。而真机上的差别恰恰全在次序里(iOS 会命中华文楷体、Windows
     * 会命中楷体,三端于是三种字形)。谁要是「顺手优化」把次序换回系统优先,只有这条拦得住。
     */
    const kaiRule = /--font-kai:([^;}]*)/.exec(css);
    if (!kaiRule) {
      failures.push("构建产物里找不到 --font-kai(字体栈的唯一事实源在 src/style.css)");
    } else if (!/^\s*"?LXGW WenKai"?/.test(kaiRule[1])) {
      failures.push(
        `楷体栈第一位不是内置字体(现在是${kaiRule[1].slice(0, 40)}…)—— 三端会各用各的系统楷体`,
      );
    } else if (!/Kaiti SC|KaiTi/.test(kaiRule[1])) {
      failures.push("楷体栈里没了系统楷体兜底 —— 子集外的生僻字会直接掉到衬线");
    }

    /*
     * JS 单块上限与加密库分包。
     *
     * 此前 player 组 504KB,构建器每次都在报告末尾发「chunk >500KB」警告,但没有任何
     * 门会因此失败 —— 警告看久了就等同于不存在。crypto-js 稳定、独立,拆成 vendor-crypto
     * 后 player 降到约 486KB、首屏总字节几乎不变;这里把两件事一起钉住:
     *   ① 任一块 JS 超过 500,000 字节即红(与构建器警告同一条线);
     *   ② vendor-crypto 必须真在产物里,否则配置被删了、警告也会悄悄回来。
     */
    checked += 1;
    const jsChunks = readdirSync(dir)
      .filter((f) => f.endsWith(".js"))
      .map((f) => ({ name: f, bytes: statSync(join(dir, f)).size }));
    const oversized = jsChunks.filter((chunk) => chunk.bytes > 500_000);
    if (oversized.length) {
      failures.push(
        `构建产物有 ${oversized.length} 个 JS 块超过 500KB:${oversized
          .sort((a, b) => b.bytes - a.bytes)
          .map((chunk) => `${chunk.name} ${(chunk.bytes / 1024).toFixed(1)}KB`)
          .join(" / ")}`,
      );
    }
    if (!jsChunks.some((chunk) => /^vendor-crypto-.*\.js$/.test(chunk.name))) {
      failures.push("构建产物里没有 vendor-crypto —— crypto-js 又被并回 player,500KB 警告会回来");
    }
  }

  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/**
 * 开局前两页(见第四十六件事)。
 *
 * /welcome 与 /create 是「没有存档才看得见」的页面:路由守卫见存档已开就把它们
 * 重定向回首页,巡页 ROUTES 永远巡不到 —— 此前这两页从未被量过,而它们恰是
 * 每个新玩家的第一屏(字体最大的一屏、表单页)。这里开一个**无存档**的 context:
 * 直接落在欢迎页量一遍,再走「开始游戏 → 同意并开始」落到建号页量一遍。
 *
 * 判据只取基础档,且是 measurePage 的**子集**:底部导航项数、顶栏折行、页签栏
 * 这些判据以「游戏内页面」为前提,开局前两页没有导航与顶栏,硬套只会量出假红。
 */
async function taskPreGameTour() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const ctx = await auditContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const pageErrors = [];
  watchPageErrors(page, pageErrors);

  /** 基础档量尺:measurePage 的开局前子集(排版事故 + 控件名 + 触达下限) */
  const measureBasic = () =>
    page.evaluate(() => {
      // 与 measurePage 同一条口径:测量前禁动画 —— stagger-in 入场位移的
      // 中间帧不该被当成排版事故(开局页的灵根圆环曾在此被量出假越界)。
      const st = document.createElement("style");
      st.textContent = "*,*::before,*::after{animation:none!important;transition:none!important}";
      document.head.appendChild(st);
      const vw = window.innerWidth;
      const overflows = [...document.querySelectorAll("body *")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const rightOver = r.right > vw + 2;
          const leftOver = r.left < -1;
          if (r.width <= 0 || (!rightOver && !leftOver)) return false;
          // 纯装饰层(不吃事件)不算排版事故 —— 与 measurePage 同一条口径
          for (let node = el; node; node = node.parentElement) {
            if (getComputedStyle(node).pointerEvents === "none") return false;
          }
          return true;
        })
        .slice(0, 4)
        .map((el) => {
          const r = el.getBoundingClientRect();
          const side = r.left < -1 ? "L" : r.right > vw + 2 ? "R" : "?";
          return `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}@${side}${Math.round(r.left)}..${Math.round(r.right)}`;
        });
      return {
        hash: location.hash,
        horizontalOverflow: document.documentElement.scrollWidth > vw + 1,
        shellShift: (() => {
          const shell = document.getElementById("app")?.firstElementChild;
          if (!shell) return null;
          return {
            scrollLeft: Math.round(shell.scrollLeft),
            overflowX: Math.round(shell.scrollWidth - shell.clientWidth),
          };
        })(),
        contentShift: (() => {
          const main = document.querySelector("main");
          if (!main) return null;
          return {
            scrollLeft: Math.round(main.scrollLeft),
            scrollWidth: Math.round(main.scrollWidth),
            clientWidth: Math.round(main.clientWidth),
            overflowX: Math.round(main.scrollWidth - main.clientWidth),
          };
        })(),
        overflows,
        unnamed: [...document.querySelectorAll("button, a, [role=button]")]
          .filter((el) => {
            const name = (el.getAttribute("aria-label") || el.textContent || "").trim();
            if (name) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          })
          .slice(0, 3)
          .map((el) => el.outerHTML.slice(0, 80).replace(/\s+/g, " ")),
        smallTargets: [...document.querySelectorAll("button, a, [role=button]")]
          .map((el) => {
            const r = el.getBoundingClientRect();
            const declared = parseFloat(getComputedStyle(el).minHeight);
            return { el, r, declared: Number.isFinite(declared) ? declared : 0 };
          })
          .filter(
            ({ r, declared }) =>
              r.width > 0 && r.height > 0 && r.height < 28 && !(declared >= 28 && r.height >= 27.5),
          )
          .slice(0, 3)
          .map(
            ({ el, r, declared }) =>
              `${r.height.toFixed(1)}px(声明 ${declared || "—"}px)«${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 12)}» [${(el.className || "").toString().slice(0, 60)}]`,
          ),
      };
    });

  const problemsOfBasic = (info) => {
    const problems = [];
    if (info.horizontalOverflow) problems.push(`横向溢出(scrollWidth ${info.hash})`);
    if (info.shellShift && (info.shellShift.scrollLeft !== 0 || info.shellShift.overflowX > 1))
      problems.push(
        `外壳被滚偏(scrollLeft ${info.shellShift.scrollLeft} / 横向可滚 ${info.shellShift.overflowX}px)`,
      );
    if (info.contentShift && info.contentShift.scrollLeft !== 0)
      problems.push(`主内容区被滚偏(scrollLeft ${info.contentShift.scrollLeft}px)`);
    if (info.contentShift && info.contentShift.overflowX > 1)
      problems.push(
        `主内容区横向可滚(${info.contentShift.scrollWidth}>${info.contentShift.clientWidth},余 ${info.contentShift.overflowX}px)`,
      );
    if (info.overflows.length) problems.push(`越界元素:${info.overflows.join(", ")}`);
    if (info.unnamed.length) problems.push(`无名控件:${info.unnamed.join(" | ")}`);
    if (info.smallTargets.length)
      problems.push(`可点元素过小(触控下限 28×28):${info.smallTargets.join(" | ")}`);
    return problems;
  };

  // ---- 欢迎页:无存档冷启动就该落在这里 ----
  await page.goto(INDEX, { waitUntil: "load" });
  await page.waitForTimeout(900);
  await settleVisuals(page);
  {
    const info = await measureBasic();
    checked += 1;
    if (!info.hash.includes("welcome"))
      failures.push(`[开局前] 无存档冷启动落在 ${info.hash},应落在欢迎页`);
    const problems = problemsOfBasic(info);
    if (problems.length) failures.push(`[开局前] /welcome → ${problems.join(" / ")}`);
    await quiesceOverlays(page);
    for (const bad of await measureTextContrast(page)) {
      contrastFails.push(
        `[开局前] /welcome ${bad.theme} ${bad.ratio}:1(需 ${bad.need})${bad.size}px «${bad.text}»`,
      );
    }
    /*
     * 开局前两页也要过 200% 那一档。
     *
     * 它们是唯二**没有存档才看得见**的页面(路由守卫见存档已开就重定向),主巡页
     * 的缩放档那一遍永远巡不到。实测欢迎页在这一档把「开 始 游 戏」折成两行、
     * 把三枚底链各压成 25px 宽的四字竖排 —— 而这是玩家看到的第一屏。
     */
    zoomSeen += 1;
    const welcomeZoom = zoomProblems(
      await measureZoomScale(page, { width: 390, height: 844 }),
      "390",
    );
    if (welcomeZoom.length)
      failures.push(`[开局前] /welcome 在 200% 下坏了:${welcomeZoom.join(" / ")}`);
  }

  // ---- 建号页:同意隐私后由欢迎页进来(传送门约 2.5s) ----
  await page
    .getByRole("button", { name: /开\s*始\s*游\s*戏/ })
    .first()
    .click();
  await page.waitForTimeout(600);
  await page.locator("input[type=checkbox]").first().check();
  await page
    .getByRole("button", { name: /同意并开始/ })
    .first()
    .click();
  await page.waitForTimeout(3200);
  await settleVisuals(page);
  {
    const info = await measureBasic();
    checked += 1;
    if (!info.hash.includes("create"))
      failures.push(`[开局前] 同意隐私后落在 ${info.hash},应落在建号页`);
    const problems = problemsOfBasic(info);
    if (problems.length) failures.push(`[开局前] /create → ${problems.join(" / ")}`);
    await quiesceOverlays(page);
    for (const bad of await measureTextContrast(page)) {
      contrastFails.push(
        `[开局前] /create ${bad.theme} ${bad.ratio}:1(需 ${bad.need})${bad.size}px «${bad.text}»`,
      );
    }
    zoomSeen += 1;
    const createZoom = zoomProblems(
      await measureZoomScale(page, { width: 390, height: 844 }),
      "390",
    );
    if (createZoom.length)
      failures.push(`[开局前] /create 在 200% 下坏了:${createZoom.join(" / ")}`);
  }

  if (pageErrors.length) failures.push(`[开局前] 页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  await page.close();
  return { failures, checked, contrastFails, pixelContrastFails: [], zoomFails: [] };
}

/* ==========================================================================
 * 并发调度 —— 任务之间互不等待,谁都不再替别人的等待买单
 * ========================================================================== */
function makeReport() {
  return { failures: [], checked: 0, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/** 并发路数:`--jobs N` > `LAYOUT_JOBS` > 按核数自适应(CI 少核也不会把内存打爆) */
const JOBS = (() => {
  const i = process.argv.indexOf("--jobs");
  if (i > 0) {
    const n = Number(process.argv[i + 1]);
    if (Number.isFinite(n) && n >= 1) return Math.floor(n);
  }
  const env = Number(process.env.LAYOUT_JOBS);
  if (Number.isFinite(env) && env >= 1) return Math.floor(env);
  return Math.max(2, Math.min(8, (cpus().length || 4) - 1));
})();

/**
 * 修行页只铺四味速服丹;余量要报数,并提供能真正落到丹匣的直达入口。
 *
 * 展品档恰好有五味可速服丹药:前四味进快捷栏,第五味只该在「另有 1 味」里出现。
 * 判据走玩家真实路径:320 窄屏看余量 → 195(200% 档的有效宽度)看入口不挤 →
 * 点进背包后「丹药」页签必须已选中且丹匣内容在场。
 */
async function taskQuickPillOverflow() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  try {
    await seedSave(ctx, showcaseSlices("light"), "__quickPillFixture");
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);

    await page.goto(INDEX + "#/cultivation", { waitUntil: "load" });
    const cards = page.locator("[data-quick-pill]");
    await cards.first().waitFor({ state: "visible", timeout: 10000 });
    const instanceCount = await cards.count();
    const hidden = page.locator("[data-quick-pills-hidden]").first();
    const hiddenCount = await hidden.count();
    const hiddenText = hiddenCount
      ? ((await hidden.textContent()) || "").replace(/\s+/g, " ").trim()
      : "";
    const hiddenLabel = hiddenCount ? ((await hidden.getAttribute("aria-label")) || "").trim() : "";
    checked += 1;
    if (instanceCount !== 4) {
      failures.push(`[320] 修行速服应只铺前四味,实见 ${instanceCount} 味`);
    }
    if (hiddenCount === 0) {
      failures.push("[320] 第五味丹药被静默截掉了 —— 没有「另有 N 味」入口");
    } else {
      if (!/另有\s*1\s*味/.test(hiddenText) || !/去丹匣/.test(hiddenText)) {
        failures.push(`[320] 余量入口没把数与去处说全:«${hiddenText}»`);
      }
      if (!/另有\s*1\s*味可服丹药.*前往丹匣查看/.test(hiddenLabel)) {
        failures.push(`[320] 余量入口的可访问名说不清:«${hiddenLabel}»`);
      }
    }

    if (hiddenCount > 0) {
      await page.setViewportSize({ width: 195, height: 422 });
      await settleVisuals(page);
      const fit = await hidden.evaluate((el) => {
        const row = el.getBoundingClientRect();
        const kids = [...el.querySelectorAll("span")].map((span) => {
          const r = span.getBoundingClientRect();
          return { left: r.left, right: r.right, width: r.width };
        });
        return {
          left: row.left,
          right: row.right,
          width: row.width,
          height: row.height,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          viewport: window.innerWidth,
          kids,
        };
      });
      checked += 1;
      const outside =
        fit.left < -1 ||
        fit.right > fit.viewport + 1 ||
        fit.kids.some((r) => r.right > fit.right + 1);
      const clipped = fit.scrollWidth > fit.clientWidth + 1;
      if (outside || clipped) {
        failures.push(
          `[195] 余量入口被挤坏:盒 ${Math.round(fit.left)}..${Math.round(fit.right)} / ` +
            `内容 ${fit.scrollWidth}>${fit.clientWidth} / 视口 ${fit.viewport}`,
        );
      }
      if (fit.height < 27.5) {
        failures.push(
          `[195] 余量入口只有 ${Math.round(fit.height * 10) / 10}px 高,低于 28px 触达下限`,
        );
      }

      await page.setViewportSize({ width: 320, height: 568 });
      await settleVisuals(page);
      await hidden.click({ timeout: 5000 });
      const arrived = await page
        .waitForFunction(
          () =>
            location.hash === "#/inventory?tab=pill" &&
            document.body.innerText.includes("开炉炼丹"),
          { timeout: 10000 },
        )
        .then(() => true)
        .catch(() => false);
      checked += 1;
      if (!arrived) {
        failures.push("[320] 点「去丹匣」没有落到背包丹药页 —— 余量入口仍是断头路");
      } else {
        const selected = await page
          .getByRole("tab", { name: /丹药/ })
          .first()
          .getAttribute("aria-selected");
        checked += 1;
        if (selected !== "true") {
          failures.push("[320] 已到 /inventory?tab=pill,但「丹药」页签没有选中");
        }
      }
    }

    if (pageErrors.length)
      failures.push(`[320] 速服余量场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 修行页三册功法 —— 终局 66 部,外层 max-h-72 只裁视觉不裁 DOM。
 *
 * 用全习得夹具逐门走完:每门首批 12、最多留 24、末页可回翻;换门回首批且焦点
 * 留在页签。辅修卸下后该部会从置顶落到低品位置,窗口要重开到它所在批,关闭详情
 * 后 BaseModal 仍能把焦点还给同一部 —— 否则玩家刚操作完就被抛回页顶。
 */
async function taskGongfaListOverflow() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const counts = {
      main: GONGFA.filter((gongfa) => gongfa.type === "main").length,
      sub: GONGFA.filter((gongfa) => gongfa.type === "sub").length,
      secret: GONGFA.filter((gongfa) => gongfa.type === "secret").length,
    };
    const seededSub =
      GONGFA.find((gongfa) => gongfa.type === "sub" && gongfa.quality === "mortal") ??
      GONGFA.find((gongfa) => gongfa.type === "sub");
    if (!seededSub || counts.main === 0 || counts.sub === 0 || counts.secret === 0) {
      throw new Error("功法全习得夹具取不到三册内容");
    }

    const slices = showcaseSlices("light");
    slices.cultivation = {
      learned: Object.fromEntries(GONGFA.map((gongfa) => [gongfa.id, gongfa.maxLevel])),
      mainGongfa: null,
      subGongfa: [seededSub.id],
      buffs: [],
      gongfaBranch: {},
    };
    await seedSave(ctx, slices, "__gongfaListFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/cultivation", { waitUntil: "load" });
    await page.locator("[data-gongfa-total]").waitFor({ state: "visible", timeout: 10000 });
    await page.setViewportSize({ width: 195, height: 422 });
    await settleVisuals(page);

    async function readList() {
      return page.evaluate(() => {
        const holder = document.querySelector("[data-gongfa-total]");
        const rows = [...document.querySelectorAll("[data-gongfa-row]")];
        return {
          total: Number(holder?.getAttribute("data-gongfa-total")),
          shown: Number(holder?.getAttribute("data-gongfa-shown")),
          start: Number(holder?.getAttribute("data-gongfa-start")),
          count: rows.length,
          ids: rows.map((row) => row.getAttribute("data-gongfa-row")),
          focusRow: document.activeElement?.getAttribute("data-gongfa-row"),
          focusCat: document.activeElement?.getAttribute("data-gongfa-cat"),
        };
      });
    }

    async function waitForList(total, shown) {
      await page.waitForFunction(
        ({ wantedTotal, wantedShown }) => {
          const holder = document.querySelector("[data-gongfa-total]");
          return (
            holder?.getAttribute("data-gongfa-total") === String(wantedTotal) &&
            holder?.getAttribute("data-gongfa-shown") === String(wantedShown)
          );
        },
        { wantedTotal: total, wantedShown: shown },
        { timeout: 5000 },
      );
    }

    async function waitForFocus(id) {
      await page
        .waitForFunction(
          (rowId) => document.activeElement?.getAttribute("data-gongfa-row") === rowId,
          id,
          { timeout: 3000 },
        )
        .catch(() => {});
    }

    async function checkPagerFit(label) {
      for (const selector of ["[data-gongfa-more]", "[data-gongfa-prev]"]) {
        const control = page.locator(selector).first();
        if ((await control.count()) === 0) continue;
        const fit = await control.evaluate((el) => {
          const box = el.getBoundingClientRect();
          return {
            left: box.left,
            right: box.right,
            height: box.height,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            viewport: window.innerWidth,
          };
        });
        checked += 1;
        if (
          fit.left < -1 ||
          fit.right > fit.viewport + 1 ||
          fit.scrollWidth > fit.clientWidth + 1 ||
          fit.height < 27.5
        ) {
          failures.push(
            `[195] ${label}分页入口被挤坏:` +
              `盒 ${Math.round(fit.left)}..${Math.round(fit.right)} / ` +
              `内容 ${fit.scrollWidth}>${fit.clientWidth} / ` +
              `高 ${Math.round(fit.height * 10) / 10}px`,
          );
        }
      }
    }

    async function exerciseDoor(cat, label, total) {
      await page.locator(`[data-gongfa-cat="${cat}"]`).click({ timeout: 5000 });
      await waitForList(total, 12);
      const initial = await readList();
      const more = page.locator("[data-gongfa-more]").first();
      const moreText = ((await more.textContent()) || "").replace(/\s+/g, " ").trim();
      const morePromised = Math.min(12, total - 12);
      checked += 1;
      if (
        initial.total !== total ||
        initial.shown !== 12 ||
        initial.start !== 0 ||
        initial.count !== 12 ||
        initial.focusCat !== cat ||
        !new RegExp(`再看\\s*${morePromised}\\s*部\\s*·\\s*余\\s*${total - 12}`).test(moreText)
      ) {
        failures.push(
          `[195] ${label}首批应 12/${total} 且焦点留在页签,` +
            `实见 ${initial.count} 行 / start ${initial.start} / ` +
            `焦点 ${initial.focusCat ?? initial.focusRow ?? "无"} «${moreText}»`,
        );
      }
      await checkPagerFit(label);

      await more.click({ timeout: 5000 });
      const secondShown = Math.min(24, total);
      await waitForList(total, secondShown);
      const second = await readList();
      await waitForFocus(second.ids[12]);
      const secondFocused = await readList();
      checked += 1;
      if (
        second.shown !== secondShown ||
        second.start !== 0 ||
        second.count !== secondShown ||
        secondFocused.focusRow !== second.ids[12]
      ) {
        failures.push(
          `[195] ${label}续开首批后应铺 ${secondShown} 部、焦点落第 13 部,` +
            `实见 ${second.count} 部 / start ${second.start} / ` +
            `焦点 ${secondFocused.focusRow ?? "无"}`,
        );
      }

      let current = secondFocused;
      while (current.shown < total) {
        const before = current;
        const shownAfter = Math.min(total, before.shown + 12);
        await page.locator("[data-gongfa-more]").first().click({ timeout: 5000 });
        await waitForList(total, shownAfter);
        const after = await readList();
        const beforeSet = new Set(before.ids);
        const firstFresh = after.ids.find((id) => !beforeSet.has(id));
        await waitForFocus(firstFresh);
        const focused = await readList();
        const expectedStart = Math.max(0, shownAfter - 24);
        checked += 1;
        if (
          after.shown !== shownAfter ||
          after.start !== expectedStart ||
          after.count !== shownAfter - expectedStart ||
          !firstFresh ||
          focused.focusRow !== firstFresh
        ) {
          failures.push(
            `[195] ${label}续开到第 ${shownAfter} 部时窗口不对:` +
              `应 ${shownAfter - expectedStart} 行 / start ${expectedStart} / ` +
              `焦点 ${firstFresh ?? "无"},实见 ${after.count} 行 / start ${after.start} / ` +
              `焦点 ${focused.focusRow ?? "无"}(shown ${after.shown})`,
          );
        }
        current = focused;
      }

      const expectedStart = Math.max(0, total - 24);
      const expectedCount = total - expectedStart;
      const previous = page.locator("[data-gongfa-prev]").first();
      checked += 1;
      if (
        current.start !== expectedStart ||
        current.count !== expectedCount ||
        (await page.locator("[data-gongfa-more]").count()) > 0
      ) {
        failures.push(
          `[195] ${label}末批应铺 ${expectedCount}/${total}、从第 ${expectedStart + 1} 部起,` +
            `实见 ${current.count} 部 / start ${current.start}`,
        );
      }
      if (expectedStart > 0) {
        const before = current;
        await previous.click({ timeout: 5000 });
        await page.waitForFunction(
          (shown) =>
            Number(
              document.querySelector("[data-gongfa-total]")?.getAttribute("data-gongfa-shown"),
            ) < shown,
          before.shown,
          { timeout: 5000 },
        );
        const back = await readList();
        await waitForFocus(back.ids[0]);
        const backFocused = await readList();
        checked += 1;
        if (back.start >= before.start || backFocused.focusRow !== back.ids[0]) {
          failures.push(
            `[195] ${label}回翻没有回到上一页:` +
              `start ${before.start} → ${back.start} / 焦点 ${backFocused.focusRow ?? "无"}`,
          );
        }
      }
    }

    await exerciseDoor("main", "主修册", counts.main);
    await exerciseDoor("sub", "辅修册", counts.sub);
    await exerciseDoor("secret", "秘术册", counts.secret);

    await page.locator('[data-gongfa-cat="main"]').click({ timeout: 5000 });
    await waitForList(counts.main, 12);
    const resetMain = await readList();
    checked += 1;
    if (resetMain.start !== 0 || resetMain.count !== 12 || resetMain.focusCat !== "main") {
      failures.push(
        `[195] 换回主修册没有回首批并守住页签焦点:` +
          `${resetMain.count} 部 / start ${resetMain.start} / 焦点 ${resetMain.focusCat ?? "无"}`,
      );
    }

    await page.locator('[data-gongfa-cat="sub"]').click({ timeout: 5000 });
    await waitForList(counts.sub, 12);
    const beforeRemove = await readList();
    checked += 1;
    if (!beforeRemove.ids.includes(seededSub.id)) {
      failures.push(`[195] 当前辅修 ${seededSub.id} 没有按装配置顶,改序后无法验证焦点`);
    }
    await page.locator(`[data-gongfa-row="${seededSub.id}"]`).click({ timeout: 5000 });
    await page.getByRole("button", { name: "卸下辅修", exact: true }).click({ timeout: 5000 });
    await page.keyboard.press("Escape");
    await waitForFocus(seededSub.id);
    await page
      .locator(".modal-panel")
      .waitFor({ state: "detached", timeout: 3000 })
      .catch(() => {});
    const afterRemove = await readList();
    checked += 1;
    if (
      !afterRemove.ids.includes(seededSub.id) ||
      afterRemove.focusRow !== seededSub.id ||
      afterRemove.shown <= 12
    ) {
      failures.push(
        `[195] 卸下辅修后没有按新位置重开窗口并归还焦点:` +
          `目标${afterRemove.ids.includes(seededSub.id) ? "在" : "不在"}窗内 / ` +
          `shown ${afterRemove.shown} / 焦点 ${afterRemove.focusRow ?? "无"}`,
      );
    }

    checked += 1;
    const layoutProblems = problemsOf(await measurePage(page));
    if (layoutProblems.length) failures.push(`[195] 修行功法三册 → ${layoutProblems.join(" / ")}`);

    if (pageErrors.length)
      failures.push(`[195] 修行功法三册场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 道痕满卷 60 则 —— 整卷每行都带忆战/重写动作,max-h-64 只裁视觉、不裁 DOM。
 *
 * 同时守住页签归属:道途册只答道途,marks 册才挂道痕。此前面板条件写成 dao,
 * 结果是道途页混进整卷履历、点道痕反而空白;这条从深层链接落册开始测。
 */
async function taskMarksListOverflow() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const slices = showcaseSlices("light");
    slices.endgame = {
      ...slices.endgame,
      marks: makeFullMarks(),
      endgameTutorialSeen: true,
      resourceDialogSeen: true,
    };
    await seedSave(ctx, slices, "__marksListFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/celestial?tab=marks", { waitUntil: "load" });
    await page.locator("[data-marks-total]").waitFor({ state: "visible", timeout: 10000 });
    await page.setViewportSize({ width: 195, height: 422 });
    await settleVisuals(page);

    async function readList() {
      return page.evaluate(() => {
        const holder = document.querySelector("[data-marks-total]");
        const rows = [...document.querySelectorAll("[data-mark-row]")];
        return {
          total: Number(holder?.getAttribute("data-marks-total")),
          shown: Number(holder?.getAttribute("data-marks-shown")),
          start: Number(holder?.getAttribute("data-marks-start")),
          count: rows.length,
          ids: rows.map((row) => row.getAttribute("data-mark-row")),
          focusRow: document.activeElement?.getAttribute("data-mark-row"),
          marksTab: document
            .querySelector('[role="tab"][aria-selected="true"]')
            ?.textContent?.replace(/\s+/g, "")
            .trim(),
        };
      });
    }

    async function waitForList(total, shown) {
      await page.waitForFunction(
        ({ wantedTotal, wantedShown }) => {
          const holder = document.querySelector("[data-marks-total]");
          return (
            holder?.getAttribute("data-marks-total") === String(wantedTotal) &&
            holder?.getAttribute("data-marks-shown") === String(wantedShown)
          );
        },
        { wantedTotal: total, wantedShown: shown },
        { timeout: 5000 },
      );
    }

    async function waitForFocus(id) {
      await page
        .waitForFunction(
          (rowId) => document.activeElement?.getAttribute("data-mark-row") === rowId,
          id,
          { timeout: 3000 },
        )
        .catch(() => {});
    }

    async function checkPagerFit(label) {
      for (const selector of ["[data-marks-more]", "[data-marks-prev]"]) {
        const control = page.locator(selector).first();
        if ((await control.count()) === 0) continue;
        const fit = await control.evaluate((el) => {
          const box = el.getBoundingClientRect();
          return {
            left: box.left,
            right: box.right,
            height: box.height,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            viewport: window.innerWidth,
          };
        });
        checked += 1;
        if (
          fit.left < -1 ||
          fit.right > fit.viewport + 1 ||
          fit.scrollWidth > fit.clientWidth + 1 ||
          fit.height < 27.5
        ) {
          failures.push(
            `[195] ${label}分页入口被挤坏:` +
              `盒 ${Math.round(fit.left)}..${Math.round(fit.right)} / ` +
              `内容 ${fit.scrollWidth}>${fit.clientWidth} / ` +
              `高 ${Math.round(fit.height * 10) / 10}px`,
          );
        }
      }
    }

    const initial = await readList();
    const moreText = ((await page.locator("[data-marks-more]").textContent()) || "")
      .replace(/\s+/g, " ")
      .trim();
    checked += 1;
    if (
      initial.total !== FULL_MARKS_COUNT ||
      initial.shown !== 12 ||
      initial.start !== 0 ||
      initial.count !== 12 ||
      initial.marksTab !== "道痕" ||
      !new RegExp(`再看\\s*12\\s*则\\s*·\\s*余\\s*48`).test(moreText)
    ) {
      failures.push(
        `[195] 道痕首批应 12/60 且只落在道痕册,` +
          `实见 ${initial.count} 行 / shown ${initial.shown} / start ${initial.start} / ` +
          `页签 ${initial.marksTab ?? "无"} «${moreText}»`,
      );
    }
    await checkPagerFit("道痕");

    await page.locator("[data-marks-more]").click({ timeout: 5000 });
    await waitForList(FULL_MARKS_COUNT, 24);
    const second = await readList();
    await waitForFocus(second.ids[12]);
    const secondFocused = await readList();
    checked += 1;
    if (second.count !== 24 || second.start !== 0 || secondFocused.focusRow !== second.ids[12]) {
      failures.push(
        `[195] 道痕续开首批后应铺 24 则、焦点落第 13 则,` +
          `实见 ${second.count} 则 / start ${second.start} / ` +
          `焦点 ${secondFocused.focusRow ?? "无"}`,
      );
    }

    const seen = new Set(initial.ids);
    for (const id of second.ids) seen.add(id);
    let current = secondFocused;
    while (current.shown < FULL_MARKS_COUNT) {
      const before = current;
      const shownAfter = Math.min(FULL_MARKS_COUNT, before.shown + 12);
      await page.locator("[data-marks-more]").click({ timeout: 5000 });
      await waitForList(FULL_MARKS_COUNT, shownAfter);
      const after = await readList();
      const beforeSet = new Set(before.ids);
      const firstFresh = after.ids.find((id) => !beforeSet.has(id));
      await waitForFocus(firstFresh);
      const focused = await readList();
      const expectedStart = Math.max(0, shownAfter - 24);
      checked += 1;
      if (
        after.start !== expectedStart ||
        after.count !== Math.min(24, shownAfter) ||
        focused.focusRow !== firstFresh
      ) {
        failures.push(
          `[195] 道痕续开到 ${shownAfter}/${FULL_MARKS_COUNT} 时窗口不对:` +
            `start ${after.start}(应 ${expectedStart}) / ${after.count} 行 / ` +
            `焦点 ${focused.focusRow ?? "无"} / 新首则 ${firstFresh ?? "无"}`,
        );
      }
      for (const id of after.ids) seen.add(id);
      current = focused;
    }

    checked += 1;
    if (seen.size !== FULL_MARKS_COUNT) {
      failures.push(`[195] 道痕只可达 ${seen.size}/${FULL_MARKS_COUNT} 则 —— 后半卷被静默截断`);
    }

    const beforeBack = await readList();
    await page.locator("[data-marks-prev]").click({ timeout: 5000 });
    await page.waitForFunction(
      (shown) =>
        Number(document.querySelector("[data-marks-total]")?.getAttribute("data-marks-shown")) <
        shown,
      beforeBack.shown,
      { timeout: 5000 },
    );
    const back = await readList();
    await waitForFocus(back.ids[0]);
    const backFocused = await readList();
    checked += 1;
    if (
      back.shown !== 48 ||
      back.start !== 24 ||
      back.start >= beforeBack.start ||
      backFocused.focusRow !== back.ids[0]
    ) {
      failures.push(
        `[195] 道痕回翻没有回到上一页:` +
          `shown ${beforeBack.shown}→${back.shown} / ` +
          `start ${beforeBack.start}→${back.start} / 焦点 ${backFocused.focusRow ?? "无"}`,
      );
    }

    await page.getByRole("tab", { name: "道途", exact: true }).click({ timeout: 5000 });
    await page.waitForTimeout(120);
    const dao = await page.evaluate(() => ({
      marks: document.querySelectorAll("[data-marks-total]").length,
      text: document.body.innerText,
    }));
    checked += 1;
    if (dao.marks !== 0 || !dao.text.includes("此生一诺")) {
      failures.push("[195] 道途册仍混入道痕,或道途正文没有出现 —— 页签内容没有互斥");
    }

    await page.getByRole("tab", { name: "道痕", exact: true }).click({ timeout: 5000 });
    await waitForList(FULL_MARKS_COUNT, 12);
    const returned = await readList();
    checked += 1;
    if (returned.count !== 12 || returned.start !== 0 || returned.marksTab !== "道痕") {
      failures.push(
        `[195] 回到道痕册没有重新落首批:` +
          `${returned.count} 行 / start ${returned.start} / 页签 ${returned.marksTab ?? "无"}`,
      );
    }

    checked += 1;
    const layoutProblems = problemsOf(await measurePage(page));
    if (layoutProblems.length) failures.push(`[195] 道痕满卷 → ${layoutProblems.join(" / ")}`);

    if (pageErrors.length)
      failures.push(`[195] 道痕满卷场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 构筑对照的道痕很多时,只摆最近八则就是静默截断。
 *
 * 这里造十则带忆战快照的道痕:首批只该有八则和「再看 2 则 · 余 2」;在 195 宽
 * (200% 缩放档)入口仍要够大、不裁字。续开后十条都在,焦点落到第九则,再真点
 * 这一则旧构筑,对照结果必须出来。
 */
async function taskBuildCompareOverflow() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const now = Date.now();
    const marks = Array.from({ length: 10 }, (_, i) => {
      const life = 12 - i;
      return {
        life,
        daoPathId: "sword",
        targetId: "chiyan",
        targetName: "赤炎天",
        cleared: true,
        rounds: 30 + i,
        buildName: `旧构筑${life}`,
        powerText: "1万",
        at: now - i * 1000,
        replay: {
          mods: {},
          attack: { m: 1200 + i * 80, e: 0 },
          defense: { m: 700 + i * 40, e: 0 },
          maxHp: { m: 22000 + i * 600, e: 0 },
          speed: 2,
          skills: [],
          artifacts: [],
          pactId: null,
        },
      };
    });
    const slices = showcaseSlices("light");
    slices.endgame = { ...slices.endgame, marks };
    await seedSave(ctx, slices, "__buildCompareFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/build", { waitUntil: "load" });

    const candidates = page.locator("[data-compare-candidate]");
    await candidates.first().waitFor({ state: "visible", timeout: 10000 });
    const more = page.locator("[data-compare-more]").first();
    const initial = await page.evaluate(() => {
      const holder = document.querySelector("[data-compare-total]");
      return {
        total: Number(holder?.getAttribute("data-compare-total")),
        shown: Number(holder?.getAttribute("data-compare-shown")),
        count: document.querySelectorAll("[data-compare-candidate]").length,
      };
    });
    const moreCount = await more.count();
    const moreText = moreCount
      ? ((await more.textContent()) || "").replace(/\s+/g, " ").trim()
      : "";
    checked += 1;
    if (initial.total !== 10 || initial.shown !== 8 || initial.count !== 8) {
      failures.push(
        `[320] 构筑对照首批应 8/10 则,实见 ${initial.count}/${initial.total}(shown ${initial.shown})`,
      );
    }
    if (moreCount === 0) {
      failures.push("[320] 后两则道痕被静默截掉了 —— 没有续开入口");
    } else if (!/再看\s*2\s*则\s*·\s*余\s*2/.test(moreText)) {
      failures.push(`[320] 续开入口没报清余量:«${moreText}»`);
    }

    if (moreCount > 0) {
      await page.setViewportSize({ width: 195, height: 422 });
      await settleVisuals(page);
      const fit = await more.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          width: box.width,
          height: box.height,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          viewport: window.innerWidth,
        };
      });
      checked += 1;
      if (fit.left < -1 || fit.right > fit.viewport + 1 || fit.scrollWidth > fit.clientWidth + 1) {
        failures.push(
          `[195] 续开入口被挤坏:盒 ${Math.round(fit.left)}..${Math.round(fit.right)} / ` +
            `内容 ${fit.scrollWidth}>${fit.clientWidth} / 视口 ${fit.viewport}`,
        );
      }
      if (fit.height < 27.5) {
        failures.push(
          `[195] 续开入口只有 ${Math.round(fit.height * 10) / 10}px 高,低于 28px 触达下限`,
        );
      }

      const ninth = marks[8];
      await more.click({ timeout: 5000 });
      const expanded = await page
        .waitForFunction(
          () => {
            const holder = document.querySelector("[data-compare-total]");
            return (
              document.querySelectorAll("[data-compare-candidate]").length === 10 &&
              holder?.getAttribute("data-compare-shown") === "10"
            );
          },
          { timeout: 5000 },
        )
        .then(() => true)
        .catch(() => false);
      checked += 1;
      if (!expanded) {
        failures.push(`[195] 点续开后没有放出全部十则,实见 ${await candidates.count()} 则`);
      } else {
        if ((await page.locator("[data-compare-more]").count()) !== 0) {
          failures.push("[195] 十则已全部展开,续开入口却还在");
        }
        const focused = await page.evaluate(() => ({
          at: document.activeElement?.getAttribute("data-compare-candidate"),
          text: (document.activeElement?.textContent || "").replace(/\s+/g, " ").trim(),
        }));
        checked += 1;
        if (focused.at !== String(ninth.at)) {
          failures.push(
            `[195] 续开后焦点没送到第九则:落在 «${focused.text || "无"}»(${focused.at ?? "非候选"})`,
          );
        }

        const oldCandidate = page.locator(`[data-compare-candidate="${ninth.at}"]`).first();
        await oldCandidate.click({ timeout: 5000 });
        const result = page.locator(`[data-compare-result="${ninth.at}"]`).first();
        const opened = await result
          .waitFor({ state: "visible", timeout: 5000 })
          .then(() => true)
          .catch(() => false);
        checked += 1;
        if (!opened) {
          failures.push(`[195] 第九则旧构筑「${ninth.buildName}」点不开对照`);
        } else {
          const report = await result.evaluate((el) => ({
            text: (el.innerText || "").replace(/\s+/g, " ").trim(),
            pressed: el.parentElement
              ?.querySelector(
                `[data-compare-candidate="${el.getAttribute("data-compare-result")}"]`,
              )
              ?.getAttribute("aria-pressed"),
          }));
          if (!/今\s/.test(report.text) || !/彼\s/.test(report.text)) {
            failures.push(`[195] 旧构筑对照结果没有今昔两列:«${report.text.slice(0, 80)}»`);
          }
          if (report.pressed !== "true") {
            failures.push("[195] 点开旧构筑后,候选没有标成当前对照");
          }
          if (/NaN|undefined|Infinity/.test(report.text)) {
            failures.push(`[195] 旧构筑对照漏出占位符:«${report.text.slice(0, 80)}»`);
          }
        }
      }
    }

    if (pageErrors.length)
      failures.push(`[320] 构筑对照场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 修仙录的两部历史:历世履历与行迹录。
 *
 * 30 世验证履历按 12 世一批、同时只留 24 行 DOM,最后一批会滑窗,回翻能回首批;
 * 12 条旧回响验证行迹录从 8 则起可开完,而不是只剩「仅列最近 8 则」一句。
 * 续开后焦点必须交给新页首则,否则按掉入口的键盘用户会失去落点。
 */
async function taskLegacyHistoryOverflow() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const now = Date.now();
    const lives = Array.from({ length: 30 }, (_, i) => {
      const index = i + 1;
      return {
        index,
        major: 3 + (i % 6),
        realmLabel: `旧境${index}`,
        age: 80 + i,
        themeId: null,
        themeResult: null,
        insight: 17 + i,
        trialId: null,
        bond: null,
        at: now - (30 - i) * 86400000,
      };
    });
    const eventMemories = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => {
        const id = `memory_${String(i + 1).padStart(2, "0")}`;
        return [
          id,
          {
            eventId: id,
            times: 2 + (i % 3),
            lastAt: now - i * 1000,
            lastChoiceIdx: 0,
          },
        ];
      }),
    );
    const slices = showcaseSlices("light");
    slices.player = {
      ...slices.player,
      reincarnation: {
        ...slices.player.reincarnation,
        count: lives.length,
        lives,
      },
    };
    slices.adventure = { ...slices.adventure, eventMemories };
    await seedSave(ctx, slices, "__legacyHistoryFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/legacy", { waitUntil: "load" });

    const lifeRows = page.locator("[data-life-row]");
    await lifeRows.first().waitFor({ state: "visible", timeout: 10000 });
    const lifeInitial = await page.evaluate(() => {
      const holder = document.querySelector("[data-life-total]");
      return {
        total: Number(holder?.getAttribute("data-life-total")),
        shown: Number(holder?.getAttribute("data-life-shown")),
        start: Number(holder?.getAttribute("data-life-start")),
        count: document.querySelectorAll("[data-life-row]").length,
      };
    });
    const lifeMore = page.locator("[data-life-more]").first();
    const lifeMoreCount = await lifeMore.count();
    const lifeMoreText = lifeMoreCount
      ? ((await lifeMore.textContent()) || "").replace(/\s+/g, " ").trim()
      : "";
    checked += 1;
    if (
      lifeInitial.total !== 30 ||
      lifeInitial.shown !== 12 ||
      lifeInitial.start !== 0 ||
      lifeInitial.count !== 12
    ) {
      failures.push(
        `[320] 历世首批应 12/30 世,实见 ${lifeInitial.count}/${lifeInitial.total}(shown ${lifeInitial.shown}/start ${lifeInitial.start})`,
      );
    }
    if (lifeMoreCount === 0) {
      failures.push("[320] 后十八世被一次铺完或藏掉了 —— 没有履历续开入口");
    } else if (!/再看\s*12\s*世\s*·\s*余\s*18/.test(lifeMoreText)) {
      failures.push(`[320] 履历续开入口没报清余量:«${lifeMoreText}»`);
    }

    async function checkZoomControl(label, control) {
      if ((await control.count()) === 0) return;
      const fit = await control.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          height: box.height,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          viewport: window.innerWidth,
        };
      });
      checked += 1;
      if (fit.left < -1 || fit.right > fit.viewport + 1 || fit.scrollWidth > fit.clientWidth + 1) {
        failures.push(
          `[195] ${label}被挤坏:盒 ${Math.round(fit.left)}..${Math.round(fit.right)} / ` +
            `内容 ${fit.scrollWidth}>${fit.clientWidth} / 视口 ${fit.viewport}`,
        );
      }
      if (fit.height < 27.5) {
        failures.push(
          `[195] ${label}只有 ${Math.round(fit.height * 10) / 10}px 高,低于 28px 触达下限`,
        );
      }
    }

    await page.setViewportSize({ width: 195, height: 422 });
    await settleVisuals(page);
    await checkZoomControl("履历续开入口", lifeMore);
    const lifeZoomProblems = problemsOf(await measurePage(page));
    checked += 1;
    if (lifeZoomProblems.length) {
      failures.push(`[195] 轮回页(履历展开前)→ ${lifeZoomProblems.join(" / ")}`);
    }

    if (lifeMoreCount > 0) {
      await lifeMore.click({ timeout: 5000 });
      await page.waitForFunction(
        () => document.querySelector("[data-life-shown]")?.getAttribute("data-life-shown") === "24",
        { timeout: 5000 },
      );
      const second = await page.evaluate(() => ({
        count: document.querySelectorAll("[data-life-row]").length,
        focus: document.activeElement?.getAttribute("data-life-row"),
      }));
      checked += 1;
      if (second.count !== 24 || second.focus !== "18") {
        failures.push(
          `[195] 履历续开第一批后应铺 24 世、焦点落第 18 世,实见 ${second.count} 世 / 焦点 ${second.focus ?? "无"}`,
        );
      }

      await page.locator("[data-life-more]").first().click({ timeout: 5000 });
      await page.waitForFunction(
        () => document.querySelector("[data-life-shown]")?.getAttribute("data-life-shown") === "30",
        { timeout: 5000 },
      );
      const last = await page.evaluate(() => ({
        count: document.querySelectorAll("[data-life-row]").length,
        start: Number(document.querySelector("[data-life-total]")?.getAttribute("data-life-start")),
        focus: document.activeElement?.getAttribute("data-life-row"),
        hasNewest: !!document.querySelector('[data-life-row="30"]'),
        hasOldest: !!document.querySelector('[data-life-row="1"]'),
        hasPrev: !!document.querySelector("[data-life-prev]"),
      }));
      checked += 1;
      if (
        last.count !== 24 ||
        last.start !== 6 ||
        last.focus !== "6" ||
        last.hasNewest ||
        !last.hasOldest ||
        !last.hasPrev
      ) {
        failures.push(
          `[195] 履历末批应滑窗为 24/30、从第 6 行起、焦点第 6 世并可回翻,` +
            `实见 ${last.count} 行 / start ${last.start} / 焦点 ${last.focus ?? "无"} / ` +
            `最新世 ${last.hasNewest ? "仍在" : "已滑走"} / 最旧世 ${last.hasOldest ? "在" : "缺失"} / ` +
            `回翻 ${last.hasPrev ? "在" : "缺失"}`,
        );
      }
      await page.locator("[data-life-prev]").first().click({ timeout: 5000 });
      await page.waitForFunction(
        () => document.querySelector("[data-life-shown]")?.getAttribute("data-life-shown") === "24",
        { timeout: 5000 },
      );
      const back = await page.evaluate(() => ({
        focus: document.activeElement?.getAttribute("data-life-row"),
        hasNewest: !!document.querySelector('[data-life-row="30"]'),
      }));
      checked += 1;
      if (back.focus !== "30" || !back.hasNewest) {
        failures.push(
          `[195] 履历回翻没有回到首批:焦点 ${back.focus ?? "无"} / 最新世 ${back.hasNewest ? "在" : "缺失"}`,
        );
      }
    }

    const fateTab = page.getByRole("tab", { name: /缘\s*迹/ }).first();
    if ((await fateTab.count()) === 0) {
      failures.push("[195] 修仙录找不到「缘迹」页签");
    } else {
      await fateTab.click({ timeout: 5000 });
      const lossRows = page.locator("[data-loss-row]");
      await lossRows.first().waitFor({ state: "visible", timeout: 5000 });
      const lossInitial = await page.evaluate(() => {
        const holder = document.querySelector("[data-loss-total]");
        return {
          total: Number(holder?.getAttribute("data-loss-total")),
          shown: Number(holder?.getAttribute("data-loss-shown")),
          count: document.querySelectorAll("[data-loss-row]").length,
        };
      });
      const lossMore = page.locator("[data-loss-more]").first();
      const lossMoreCount = await lossMore.count();
      const lossMoreText = lossMoreCount
        ? ((await lossMore.textContent()) || "").replace(/\s+/g, " ").trim()
        : "";
      checked += 1;
      if (
        lossInitial.total !== 20 ||
        lossInitial.shown !== 8 ||
        lossInitial.count !== 8 ||
        lossMoreCount === 0 ||
        !/再看\s*8\s*则\s*·\s*余\s*12/.test(lossMoreText)
      ) {
        failures.push(
          `[195] 行迹首批应 8/20 则并可再看 8 则,` +
            `实见 ${lossInitial.count}/${lossInitial.total}(shown ${lossInitial.shown}) «${lossMoreText}»`,
        );
      }
      await checkZoomControl("行迹续开入口", lossMore);

      if (lossMoreCount > 0) {
        await lossMore.click({ timeout: 5000 });
        await page.waitForFunction(
          () =>
            document.querySelector("[data-loss-shown]")?.getAttribute("data-loss-shown") === "16",
          { timeout: 5000 },
        );
        const lossSecond = await page.evaluate(() => ({
          count: document.querySelectorAll("[data-loss-row]").length,
          focus: document.activeElement?.getAttribute("data-loss-row"),
        }));
        checked += 1;
        if (lossSecond.count !== 16 || lossSecond.focus !== "memory_09") {
          failures.push(
            `[195] 行迹续开第一批后应铺 16 则、焦点 memory_09,` +
              `实见 ${lossSecond.count} 则 / 焦点 ${lossSecond.focus ?? "无"}`,
          );
        }
        await page.locator("[data-loss-more]").first().click({ timeout: 5000 });
        await page.waitForFunction(
          () =>
            document.querySelector("[data-loss-shown]")?.getAttribute("data-loss-shown") === "20",
          { timeout: 5000 },
        );
        const lossLast = await page.evaluate(() => ({
          count: document.querySelectorAll("[data-loss-row]").length,
          start: Number(
            document.querySelector("[data-loss-total]")?.getAttribute("data-loss-start"),
          ),
          focus: document.activeElement?.getAttribute("data-loss-row"),
          hasNewest: !!document.querySelector('[data-loss-row="memory_01"]'),
          hasOldest: !!document.querySelector('[data-loss-row="memory_20"]'),
          stillMore: !!document.querySelector("[data-loss-more]"),
          hasPrev: !!document.querySelector("[data-loss-prev]"),
        }));
        checked += 1;
        if (
          lossLast.count !== 16 ||
          lossLast.start !== 4 ||
          lossLast.focus !== "memory_17" ||
          lossLast.hasNewest ||
          !lossLast.hasOldest ||
          lossLast.stillMore ||
          !lossLast.hasPrev
        ) {
          failures.push(
            `[195] 行迹末批应滑窗为 16/20、从第 5 则起、焦点 memory_17 并可回翻,` +
              `实见 ${lossLast.count} 则 / start ${lossLast.start} / 焦点 ${lossLast.focus ?? "无"} / ` +
              `最新迹 ${lossLast.hasNewest ? "仍在" : "已滑走"} / ` +
              `最旧迹 ${lossLast.hasOldest ? "在" : "缺失"} / ` +
              `续开 ${lossLast.stillMore ? "仍在" : "已收"} / 回翻 ${lossLast.hasPrev ? "在" : "缺失"}`,
          );
        }
      }
      const lossZoomProblems = problemsOf(await measurePage(page));
      checked += 1;
      if (lossZoomProblems.length) {
        failures.push(`[195] 缘迹页(行迹展开后)→ ${lossZoomProblems.join(" / ")}`);
      }
    }

    if (pageErrors.length)
      failures.push(`[320] 修仙录历史场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 道侣弹窗的历世同行 —— 每一世追加一笔,没有上限。
 *
 * 30 段旧缘验证:最近一段排在最前,首批 12 段;续开至 24 段后焦点落到新页第一段;
 * 再过一批到 30 段时只保留 24 行 DOM,最早的一批滑出、最旧的一段仍可达;回翻回到
 * 首批并聚焦最近一段。弹窗在 195 宽下另过 dialogZoomProblems,续开入口守住 28px。
 */
async function taskBondHistoryOverflow() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const slices = showcaseSlices("light");
    const bonds = Array.from({ length: 30 }, (_, i) => ({
      daoluId: `history_${i + 1}`,
      name: `旧缘${String(i + 1).padStart(2, "0")}`,
      stage: "pledged",
      ending: i % 2 === 0 ? "accompanied" : "parted",
      shared: i + 1,
    }));
    slices.player = {
      ...slices.player,
      reincarnation: {
        ...slices.player.reincarnation,
        count: bonds.length,
        bonds,
      },
    };
    await seedSave(ctx, slices, "__bondHistoryFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/character", { waitUntil: "load" });

    const bondCard = page
      .locator("main button")
      .filter({ hasText: /道\s*侣/ })
      .first();
    await bondCard.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    checked += 1;
    if ((await bondCard.count()) === 0) {
      failures.push("[320] 人物页找不到「道侣」入口 —— 历世同行没有量到");
    } else {
      await bondCard.click({ timeout: 5000 });
      await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 });
      await page.locator("[data-bond-history-total]").waitFor({ state: "visible", timeout: 5000 });
    }

    const initial = await page.evaluate(() => {
      const holder = document.querySelector("[data-bond-history-total]");
      const rows = [...document.querySelectorAll("[data-bond-history-row]")];
      return {
        total: Number(holder?.getAttribute("data-bond-history-total")),
        shown: Number(holder?.getAttribute("data-bond-history-shown")),
        start: Number(holder?.getAttribute("data-bond-history-start")),
        count: rows.length,
        first: rows[0]?.getAttribute("data-bond-history-row"),
        last: rows.at(-1)?.getAttribute("data-bond-history-row"),
      };
    });
    const historyMore = page.locator("[data-bond-history-more]").first();
    const historyMoreCount = await historyMore.count();
    const historyMoreText = historyMoreCount
      ? ((await historyMore.textContent()) || "").replace(/\s+/g, " ").trim()
      : "";
    checked += 1;
    if (
      initial.total !== 30 ||
      initial.shown !== 12 ||
      initial.start !== 0 ||
      initial.count !== 12 ||
      initial.first !== "旧缘30" ||
      initial.last !== "旧缘19" ||
      historyMoreCount === 0 ||
      !/再看\s*12\s*段\s*·\s*余\s*18/.test(historyMoreText)
    ) {
      failures.push(
        `[320] 历世同行首批应最近 12/30 段(旧缘30 → 旧缘19)并可再看 12 段,` +
          `实见 ${initial.first ?? "无"} → ${initial.last ?? "无"} / ${initial.count} 行` +
          `(shown ${initial.shown} / total ${initial.total}) «${historyMoreText}»`,
      );
    }

    await page.setViewportSize({ width: 195, height: 422 });
    await settleVisuals(page);
    if (historyMoreCount > 0) {
      await historyMore.scrollIntoViewIfNeeded();
      const fit = await historyMore.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          height: box.height,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          viewport: window.innerWidth,
        };
      });
      checked += 1;
      if (
        fit.left < -1 ||
        fit.right > fit.viewport + 1 ||
        fit.scrollWidth > fit.clientWidth + 1 ||
        fit.height < 27.5
      ) {
        failures.push(
          `[195] 历世同行续开入口被挤坏:盒 ${Math.round(fit.left)}..${Math.round(fit.right)} / ` +
            `内容 ${fit.scrollWidth}>${fit.clientWidth} / 高 ${Math.round(fit.height * 10) / 10}px / ` +
            `视口 ${fit.viewport}`,
        );
      }
    }

    checked += 1;
    const dialogProblems = dialogZoomProblems(
      await measureDialogZoom(page, { width: 390, height: 844 }),
    );
    if (dialogProblems.length) {
      failures.push(`[195] 道侣弹窗 · 历世同行 → ${dialogProblems.join(" / ")}`);
    }

    await page.setViewportSize({ width: 195, height: 422 });
    await settleVisuals(page);
    if (historyMoreCount > 0) {
      await page.locator("[data-bond-history-more]").first().click({ timeout: 5000 });
      await page.waitForFunction(
        () =>
          document
            .querySelector("[data-bond-history-shown]")
            ?.getAttribute("data-bond-history-shown") === "24",
        { timeout: 5000 },
      );
      const second = await page.evaluate(() => ({
        count: document.querySelectorAll("[data-bond-history-row]").length,
        focus: document.activeElement?.getAttribute("data-bond-history-row"),
      }));
      checked += 1;
      if (second.count !== 24 || second.focus !== "旧缘18") {
        failures.push(
          `[195] 历世同行续开第一批后应铺 24 段、焦点落旧缘18,` +
            `实见 ${second.count} 段 / 焦点 ${second.focus ?? "无"}`,
        );
      }

      await page.locator("[data-bond-history-more]").first().click({ timeout: 5000 });
      await page.waitForFunction(
        () =>
          document
            .querySelector("[data-bond-history-shown]")
            ?.getAttribute("data-bond-history-shown") === "30",
        { timeout: 5000 },
      );
      const last = await page.evaluate(() => ({
        count: document.querySelectorAll("[data-bond-history-row]").length,
        start: Number(
          document
            .querySelector("[data-bond-history-total]")
            ?.getAttribute("data-bond-history-start"),
        ),
        focus: document.activeElement?.getAttribute("data-bond-history-row"),
        hasNewest: !!document.querySelector('[data-bond-history-row="旧缘30"]'),
        hasOldest: !!document.querySelector('[data-bond-history-row="旧缘01"]'),
        hasPrev: !!document.querySelector("[data-bond-history-prev]"),
      }));
      checked += 1;
      if (
        last.count !== 24 ||
        last.start !== 6 ||
        last.focus !== "旧缘06" ||
        last.hasNewest ||
        !last.hasOldest ||
        !last.hasPrev
      ) {
        failures.push(
          `[195] 历世同行末批应滑窗为 24/30、从第 7 行起、焦点旧缘06 并可回翻,` +
            `实见 ${last.count} 行 / start ${last.start} / 焦点 ${last.focus ?? "无"} / ` +
            `最近段 ${last.hasNewest ? "仍在" : "已滑走"} / ` +
            `最旧段 ${last.hasOldest ? "在" : "缺失"} / 回翻 ${last.hasPrev ? "在" : "缺失"}`,
        );
      }

      await page.locator("[data-bond-history-prev]").first().click({ timeout: 5000 });
      await page.waitForFunction(
        () =>
          document
            .querySelector("[data-bond-history-shown]")
            ?.getAttribute("data-bond-history-shown") === "24",
        { timeout: 5000 },
      );
      const back = await page.evaluate(() => ({
        focus: document.activeElement?.getAttribute("data-bond-history-row"),
        hasNewest: !!document.querySelector('[data-bond-history-row="旧缘30"]'),
      }));
      checked += 1;
      if (back.focus !== "旧缘30" || !back.hasNewest) {
        failures.push(
          `[195] 历世同行回翻没有回到首批:焦点 ${back.focus ?? "无"} / ` +
            `最近段 ${back.hasNewest ? "在" : "缺失"}`,
        );
      }
    }

    if (pageErrors.length)
      failures.push(`[320] 道侣历世同行场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 器魂两册 —— 散置形意与可凝法器都没有数量上限。
 *
 * 30 条夹具分别验证:价值高者先见、首批 12 条、续开至 24 条后焦点落到新页首条;
 * 再续一批只保留 24 行 DOM,旧批滑出、最末一条仍可达;回翻回首批并聚焦首条。
 * 两扇弹窗都要在 195 宽下量续开入口与整扇版面。
 */
async function taskSoulListOverflow() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const pad = (n) => String(n).padStart(2, "0");
    const souls = [
      {
        uid: "soul_high",
        type: "gangdun",
        grade: 5,
        fromName: "化真古盾",
      },
      ...Array.from({ length: 29 }, (_, i) => ({
        uid: `soul_${pad(i + 1)}`,
        type: "fengmang",
        grade: 0,
        fromName: `旧器${pad(i + 1)}`,
      })),
    ];
    const forgeItems = Array.from({ length: 30 }, (_, i) => ({
      uid: `forge_${pad(i + 1)}`,
      templateId: "w_zidian",
      quality: "mortal",
      tier: i + 1,
      level: 0,
      affixes: [{ id: "crit1", roll: 1 }],
    }));
    const slices = showcaseSlices("light");
    slices.endgame = { ...slices.endgame, souls, equippedSouls: [] };
    slices.inventory = { ...slices.inventory, items: forgeItems, equipped: {} };
    await seedSave(ctx, slices, "__soulListFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/souls", { waitUntil: "load" });

    async function readList(kind) {
      return page.evaluate((key) => {
        const holder = document.querySelector(`[data-soul-${key}-total]`);
        const rows = [...document.querySelectorAll(`[data-soul-${key}-row]`)];
        return {
          total: Number(holder?.getAttribute(`data-soul-${key}-total`)),
          shown: Number(holder?.getAttribute(`data-soul-${key}-shown`)),
          start: Number(holder?.getAttribute(`data-soul-${key}-start`)),
          count: rows.length,
          ids: rows.map((row) => row.getAttribute(`data-soul-${key}-row`)),
          focus: document.activeElement?.getAttribute(`data-soul-${key}-row`),
        };
      }, kind);
    }

    async function exerciseList({
      kind,
      unit,
      firstId,
      initialLastId,
      secondFocus,
      finalFocus,
      oldestId,
    }) {
      const more = page.locator(`[data-soul-${kind}-more]`).first();
      const moreCount = await more.count();
      const moreText = moreCount
        ? ((await more.textContent()) || "").replace(/\s+/g, " ").trim()
        : "";
      const initial = await readList(kind);
      checked += 1;
      if (
        initial.total !== 30 ||
        initial.shown !== 12 ||
        initial.start !== 0 ||
        initial.count !== 12 ||
        initial.ids[0] !== firstId ||
        initial.ids.at(-1) !== initialLastId ||
        moreCount === 0 ||
        !new RegExp(`再看\\s*12\\s*${unit}\\s*·\\s*余\\s*18`).test(moreText)
      ) {
        failures.push(
          `[320] 器魂${kind === "idle" ? "散置形意" : "凝炼台"}首批应 12/30 ` +
            `(${firstId} → ${initialLastId})并可再看 12 ${unit},` +
            `实见 ${initial.ids[0] ?? "无"} → ${initial.ids.at(-1) ?? "无"} / ${initial.count} 行` +
            `(shown ${initial.shown} / total ${initial.total}) «${moreText}»`,
        );
      }

      await page.setViewportSize({ width: 195, height: 422 });
      await settleVisuals(page);
      if (moreCount > 0) {
        await more.scrollIntoViewIfNeeded();
        const fit = await more.evaluate((el) => {
          const box = el.getBoundingClientRect();
          return {
            left: box.left,
            right: box.right,
            height: box.height,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            viewport: window.innerWidth,
          };
        });
        checked += 1;
        if (
          fit.left < -1 ||
          fit.right > fit.viewport + 1 ||
          fit.scrollWidth > fit.clientWidth + 1 ||
          fit.height < 27.5
        ) {
          failures.push(
            `[195] 器魂${kind === "idle" ? "散置形意" : "凝炼台"}续开入口被挤坏:` +
              `盒 ${Math.round(fit.left)}..${Math.round(fit.right)} / ` +
              `内容 ${fit.scrollWidth}>${fit.clientWidth} / ` +
              `高 ${Math.round(fit.height * 10) / 10}px / 视口 ${fit.viewport}`,
          );
        }
      }

      checked += 1;
      const dialogProblems = dialogZoomProblems(
        await measureDialogZoom(page, { width: 390, height: 844 }),
      );
      if (dialogProblems.length) {
        failures.push(
          `[195] 器魂${kind === "idle" ? "散置形意" : "凝炼台"} → ${dialogProblems.join(" / ")}`,
        );
      }

      await page.setViewportSize({ width: 195, height: 422 });
      await settleVisuals(page);
      if (moreCount > 0) {
        await page.locator(`[data-soul-${kind}-more]`).first().click({ timeout: 5000 });
        await page.waitForFunction(
          (key) =>
            document
              .querySelector(`[data-soul-${key}-total]`)
              ?.getAttribute(`data-soul-${key}-shown`) === "24",
          kind,
          { timeout: 5000 },
        );
        const second = await readList(kind);
        checked += 1;
        if (second.count !== 24 || second.focus !== secondFocus) {
          failures.push(
            `[195] 器魂${kind === "idle" ? "散置形意" : "凝炼台"}续开第一批后应铺 24 条、` +
              `焦点落 ${secondFocus},实见 ${second.count} 条 / 焦点 ${second.focus ?? "无"}`,
          );
        }

        await page.locator(`[data-soul-${kind}-more]`).first().click({ timeout: 5000 });
        await page.waitForFunction(
          (key) =>
            document
              .querySelector(`[data-soul-${key}-total]`)
              ?.getAttribute(`data-soul-${key}-shown`) === "30",
          kind,
          { timeout: 5000 },
        );
        const last = await readList(kind);
        checked += 1;
        if (
          last.count !== 24 ||
          last.start !== 6 ||
          last.focus !== finalFocus ||
          last.ids.includes(firstId) ||
          !last.ids.includes(oldestId) ||
          (await page.locator(`[data-soul-${kind}-prev]`).count()) === 0
        ) {
          failures.push(
            `[195] 器魂${kind === "idle" ? "散置形意" : "凝炼台"}末批应滑窗为 24/30、` +
              `从第 7 行起、焦点 ${finalFocus} 并可回翻,` +
              `实见 ${last.count} 行 / start ${last.start} / 焦点 ${last.focus ?? "无"} / ` +
              `首批 ${last.ids.includes(firstId) ? "仍在" : "已滑走"} / ` +
              `最末 ${last.ids.includes(oldestId) ? "在" : "缺失"}`,
          );
        }

        await page.locator(`[data-soul-${kind}-prev]`).first().click({ timeout: 5000 });
        await page.waitForFunction(
          (key) =>
            document
              .querySelector(`[data-soul-${key}-total]`)
              ?.getAttribute(`data-soul-${key}-shown`) === "24",
          kind,
          { timeout: 5000 },
        );
        const back = await readList(kind);
        checked += 1;
        if (back.focus !== firstId || !back.ids.includes(firstId)) {
          failures.push(
            `[195] 器魂${kind === "idle" ? "散置形意" : "凝炼台"}回翻没有回到首批:` +
              `焦点 ${back.focus ?? "无"} / 首批 ${back.ids.includes(firstId) ? "在" : "缺失"}`,
          );
        }
      }
    }

    const idleEntry = page
      .locator("main button")
      .filter({ hasText: /散置形意/ })
      .first();
    await idleEntry.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    checked += 1;
    if ((await idleEntry.count()) === 0) {
      failures.push("[320] 器魂页找不到「散置形意」入口 —— 闲置两册没有量到");
    } else {
      await idleEntry.click({ timeout: 5000 });
      await page.locator("[data-soul-idle-total]").waitFor({ state: "visible", timeout: 5000 });
      await exerciseList({
        kind: "idle",
        unit: "缕",
        firstId: "soul_high",
        initialLastId: "soul_11",
        secondFocus: "soul_12",
        finalFocus: "soul_24",
        oldestId: "soul_29",
      });
      await page.keyboard.press("Escape");
      await page.locator("[data-soul-idle-total]").waitFor({ state: "hidden", timeout: 5000 });

      const forgeEntry = page
        .locator("main button")
        .filter({ hasText: /凝炼台/ })
        .first();
      await forgeEntry.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
      checked += 1;
      if ((await forgeEntry.count()) === 0) {
        failures.push("[320] 器魂页找不到「凝炼台」入口 —— 可凝册没有量到");
      } else {
        await forgeEntry.click({ timeout: 5000 });
        await page.locator("[data-soul-forge-total]").waitFor({ state: "visible", timeout: 5000 });
        await exerciseList({
          kind: "forge",
          unit: "件",
          firstId: "forge_30",
          initialLastId: "forge_19",
          secondFocus: "forge_18",
          finalFocus: "forge_06",
          oldestId: "forge_01",
        });
      }
    }

    if (pageErrors.length)
      failures.push(`[320] 器魂两册场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 名号 / 灵兽全册 —— 69 条终局清单的两册回看。
 *
 * 两册此前都整份铺进 DOM,而名号页永远同时拥有全部称号、灵兽页也会随着收集
 * 长到四十只。更隐蔽的一处是「相伴中」只排在品阶之后:低品阶的当前伙伴会被
 * 高品阶旧收藏压到后面。这里用全拥有夹具把两件事一起量到底。
 */
async function taskTitlePetOverflow() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const activePet = PETS[0];
    const wornTitle = TITLES.at(-1);
    if (!activePet || !wornTitle) throw new Error("名号 / 灵兽夹具取不到首尾条目");
    const activePetId = activePet.id;
    const wornTitleId = wornTitle.id;
    const petSorted = [...PETS].sort(
      (a, b) =>
        Number(b.id === activePetId) - Number(a.id === activePetId) ||
        qualityDef(b.quality).rank - qualityDef(a.quality).rank,
    );
    const titleSorted = [wornTitle, ...TITLES.filter((title) => title.id !== wornTitleId)];
    const slices = showcaseSlices("light");
    slices.player = {
      ...slices.player,
      titleId: wornTitleId,
      petId: activePetId,
    };
    slices.quests = {
      ...slices.quests,
      titlesOwned: TITLES.map((title) => title.id),
      collections: {
        ...slices.quests.collections,
        pet: PETS.map((pet) => pet.id),
      },
      petCompanions: PETS.map((pet) => pet.id),
    };
    await seedSave(ctx, slices, "__titlePetFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/titles", { waitUntil: "load" });

    async function readList(kind) {
      return page.evaluate((key) => {
        const holder = document.querySelector(`[data-${key}-total]`);
        const rows = [...document.querySelectorAll(`[data-${key}-row]`)];
        return {
          total: Number(holder?.getAttribute(`data-${key}-total`)),
          shown: Number(holder?.getAttribute(`data-${key}-shown`)),
          start: Number(holder?.getAttribute(`data-${key}-start`)),
          count: rows.length,
          ids: rows.map((row) => row.getAttribute(`data-${key}-row`)),
          focus: document.activeElement?.getAttribute(`data-${key}-row`),
        };
      }, kind);
    }

    async function waitForShown(kind, shown) {
      await page.waitForFunction(
        ({ key, wanted }) =>
          document.querySelector(`[data-${key}-total]`)?.getAttribute(`data-${key}-shown`) ===
          String(wanted),
        { key: kind, wanted: shown },
        { timeout: 5000 },
      );
    }

    async function waitForFocus(kind, id) {
      await page
        .waitForFunction(
          ({ key, rowId }) => document.activeElement?.getAttribute(`data-${key}-row`) === rowId,
          { key: kind, rowId: id },
          { timeout: 2000 },
        )
        .catch(() => {});
    }

    async function checkMoreFit(kind, label) {
      const more = page.locator(`[data-${kind}-more]`).first();
      if ((await more.count()) === 0) return;
      await more.scrollIntoViewIfNeeded();
      const fit = await more.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          height: box.height,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          viewport: window.innerWidth,
        };
      });
      checked += 1;
      if (
        fit.left < -1 ||
        fit.right > fit.viewport + 1 ||
        fit.scrollWidth > fit.clientWidth + 1 ||
        fit.height < 27.5
      ) {
        failures.push(
          `[195] ${label}续开入口被挤坏:` +
            `盒 ${Math.round(fit.left)}..${Math.round(fit.right)} / ` +
            `内容 ${fit.scrollWidth}>${fit.clientWidth} / ` +
            `高 ${Math.round(fit.height * 10) / 10}px / 视口 ${fit.viewport}`,
        );
      }
    }

    async function exerciseList({ kind, label, unit, total, sortedIds }) {
      const initial = await readList(kind);
      const more = page.locator(`[data-${kind}-more]`).first();
      const moreText = ((await more.textContent()) || "").replace(/\s+/g, " ").trim();
      const remaining = total - 12;
      checked += 1;
      if (
        initial.total !== total ||
        initial.shown !== 12 ||
        initial.start !== 0 ||
        initial.count !== 12 ||
        initial.ids[0] !== sortedIds[0] ||
        initial.ids.at(-1) !== sortedIds[11] ||
        !new RegExp(`再看\\s*12\\s*${unit}\\s*·\\s*余\\s*${remaining}`).test(moreText)
      ) {
        failures.push(
          `[320] ${label}首批应 12/${total}(${sortedIds[0]} → ${sortedIds[11]}),` +
            `实见 ${initial.ids[0] ?? "无"} → ${initial.ids.at(-1) ?? "无"} / ${initial.count} 行 ` +
            `(shown ${initial.shown} / total ${initial.total}) «${moreText}»`,
        );
      }

      await checkMoreFit(kind, label);
      checked += 1;
      const zoomProblems = problemsOf(await measurePage(page));
      if (zoomProblems.length) {
        failures.push(`[195] ${label} → ${zoomProblems.join(" / ")}`);
      }

      await page.locator(`[data-${kind}-more]`).first().click({ timeout: 5000 });
      await waitForShown(kind, 24);
      await waitForFocus(kind, sortedIds[12]);
      const second = await readList(kind);
      checked += 1;
      if (
        second.shown !== 24 ||
        second.start !== 0 ||
        second.count !== 24 ||
        second.focus !== sortedIds[12]
      ) {
        failures.push(
          `[195] ${label}续开第一批后应铺 24 条、焦点落 ${sortedIds[12]},` +
            `实见 ${second.count} 条 / start ${second.start} / 焦点 ${second.focus ?? "无"}`,
        );
      }

      let last = second;
      let shownBefore = second.shown;
      let finalFocus = sortedIds[12];
      while (shownBefore < total) {
        const shownAfter = Math.min(total, shownBefore + 12);
        const focusId = sortedIds[shownBefore];
        await page.locator(`[data-${kind}-more]`).first().click({ timeout: 5000 });
        await waitForShown(kind, shownAfter);
        await waitForFocus(kind, focusId);
        last = await readList(kind);
        const expectedStart = Math.max(0, shownAfter - 24);
        const expectedCount = shownAfter - expectedStart;
        checked += 1;
        if (
          last.shown !== shownAfter ||
          last.start !== expectedStart ||
          last.count !== expectedCount ||
          last.focus !== focusId
        ) {
          failures.push(
            `[195] ${label}续开到第 ${shownAfter} 条时窗口不对:` +
              `应 ${expectedCount} 行 / start ${expectedStart} / ` +
              `焦点 ${focusId},实见 ${last.count} 行 / start ${last.start} / ` +
              `焦点 ${last.focus ?? "无"}(shown ${last.shown})`,
          );
        }
        finalFocus = focusId;
        shownBefore = shownAfter;
      }
      const expectedStart = total - 24;
      checked += 1;
      if (
        last.count !== 24 ||
        last.start !== expectedStart ||
        last.focus !== finalFocus ||
        last.ids.includes(sortedIds[0]) ||
        !last.ids.includes(sortedIds.at(-1)) ||
        (await page.locator(`[data-${kind}-more]`).count()) > 0 ||
        (await page.locator(`[data-${kind}-prev]`).count()) === 0
      ) {
        failures.push(
          `[195] ${label}末批应滑窗为 24/${total}、从第 ${expectedStart + 1} 行起、` +
            `焦点 ${finalFocus} 并可回翻,` +
            `实见 ${last.count} 行 / start ${last.start} / 焦点 ${last.focus ?? "无"} / ` +
            `首批 ${last.ids.includes(sortedIds[0]) ? "仍在" : "已滑走"} / ` +
            `末件 ${last.ids.includes(sortedIds.at(-1)) ? "在" : "缺失"}`,
        );
      }

      const backShown = Math.max(12, Math.floor((total - 1) / 12) * 12);
      const backStart = backShown - 24;
      await page.locator(`[data-${kind}-prev]`).first().click({ timeout: 5000 });
      await waitForShown(kind, backShown);
      await waitForFocus(kind, sortedIds[backStart]);
      const back = await readList(kind);
      checked += 1;
      if (
        back.start !== backStart ||
        back.count !== 24 ||
        back.focus !== sortedIds[backStart] ||
        !back.ids.includes(sortedIds[backStart])
      ) {
        failures.push(
          `[195] ${label}回翻没有回到上一页:` +
            `应 start ${backStart} / 24 行 / 焦点 ${sortedIds[backStart]},` +
            `实见 start ${back.start} / ${back.count} 行 / 焦点 ${back.focus ?? "无"}`,
        );
      }

      const selectedId = sortedIds[backStart + 12];
      await page.locator(`[data-${kind}-row="${selectedId}"] button`).first().click({
        timeout: 5000,
      });
      await waitForShown(kind, 12);
      await waitForFocus(kind, selectedId);
      const selected = await readList(kind);
      checked += 1;
      if (
        selected.shown !== 12 ||
        selected.start !== 0 ||
        selected.count !== 12 ||
        selected.ids[0] !== selectedId ||
        selected.focus !== selectedId
      ) {
        failures.push(
          `[195] ${label}换选后没有回到首批并露出新选:` +
            `应 ${selectedId} 在首行 / 12 行 / 焦点同项,` +
            `实见首行 ${selected.ids[0] ?? "无"} / ${selected.count} 行 / ` +
            `焦点 ${selected.focus ?? "无"}(shown ${selected.shown})`,
        );
      }
    }

    await page.locator("[data-title-total]").waitFor({ state: "visible", timeout: 10000 });
    await page.setViewportSize({ width: 195, height: 422 });
    await settleVisuals(page);
    await exerciseList({
      kind: "title",
      label: "名号册",
      unit: "顶",
      total: TITLES.length,
      sortedIds: titleSorted.map((title) => title.id),
    });

    const petTab = page.getByRole("tab", { name: /灵兽/ }).first();
    await petTab.click({ timeout: 5000 });
    await page.locator("[data-pet-total]").waitFor({ state: "visible", timeout: 5000 });
    await settleVisuals(page);
    await exerciseList({
      kind: "pet",
      label: "灵兽册",
      unit: "只",
      total: PETS.length,
      sortedIds: petSorted.map((pet) => pet.id),
    });

    if (pageErrors.length)
      failures.push(`[320] 名号 / 灵兽两册场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 法宝全册 —— 45 张名/描述/被动/神通/代价/双按钮密卡,不许整册铺进页面。
 *
 * 这里补齐三件运行时事实:六件首批、十二件滑窗、195 宽下双按钮与代价行不变形;
 * 逐批翻到末页再回翻,既证全册可达,也证焦点跟着新批走。最后真按「随身」与
 * 「炼化」:前者不改排序但焦点要留在原卡,后者会按祭炼等级改序,卡若越过窗口
 * 必须按新位置所在批次重开窗,仍把焦点送回同一件。
 */
async function taskArtifactListOverflow() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  let vite = null;
  try {
    // 法宝内容表走 Vite 解析 @/ 别名,不手抄 id,也不要求 Bun 直接理解应用别名。
    vite = await createViteServer({
      root: ROOT,
      server: { middlewareMode: true },
      appType: "custom",
      logLevel: "silent",
    });
    const artifactFixture = await vite.ssrLoadModule("/scripts/lib/fullArtifactFixture.ts");
    const artifactRows = artifactFixture.fullArtifactRows();
    const sortedIds = artifactRows.map((artifact) => artifact.defId);
    const total = artifactRows.length;

    const slices = showcaseSlices("light");
    slices.resources = {
      ...slices.resources,
      spiritStone: { m: 9, e: 30 },
      wudao: 500000,
    };
    slices.inventory = {
      ...slices.inventory,
      items: [],
      equipped: {},
      artifacts: artifactRows.map(({ defId, level }) => ({ defId, level })),
      equippedArtifacts: [],
    };
    await seedSave(ctx, slices, "__artifactListFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/inventory", { waitUntil: "load" });
    await page
      .getByRole("tab", { name: /法\s*宝/ })
      .first()
      .click({ timeout: 5000 });
    await page.locator("[data-artifact-total]").waitFor({ state: "visible", timeout: 10000 });
    await page.setViewportSize({ width: 195, height: 422 });
    await settleVisuals(page);

    async function readList() {
      return page.evaluate(() => {
        const holder = document.querySelector("[data-artifact-total]");
        const rows = [...document.querySelectorAll("[data-artifact-row]")];
        return {
          total: Number(holder?.getAttribute("data-artifact-total")),
          shown: Number(holder?.getAttribute("data-artifact-shown")),
          start: Number(holder?.getAttribute("data-artifact-start")),
          count: rows.length,
          ids: rows.map((row) => row.getAttribute("data-artifact-row")),
          focus: document.activeElement?.getAttribute("data-artifact-row"),
        };
      });
    }

    async function waitForShown(shown) {
      await page.waitForFunction(
        (wanted) =>
          document.querySelector("[data-artifact-total]")?.getAttribute("data-artifact-shown") ===
          String(wanted),
        shown,
        { timeout: 5000 },
      );
    }

    async function waitForFocus(id) {
      await page
        .waitForFunction(
          (rowId) => document.activeElement?.getAttribute("data-artifact-row") === rowId,
          id,
          { timeout: 2000 },
        )
        .catch(() => {});
    }

    const initial = await readList();
    const more = page.locator("[data-artifact-more]").first();
    const moreText = ((await more.textContent()) || "").replace(/\s+/g, " ").trim();
    checked += 1;
    if (
      initial.total !== total ||
      initial.shown !== 6 ||
      initial.start !== 0 ||
      initial.count !== 6 ||
      initial.ids[0] !== sortedIds[0] ||
      initial.ids.at(-1) !== sortedIds[5] ||
      !new RegExp(`再看\\s*6\\s*件\\s*·\\s*余\\s*${total - 6}`).test(moreText)
    ) {
      failures.push(
        `[320] 法宝册首批应 6/${total}(${sortedIds[0]} → ${sortedIds[5]}),` +
          `实见 ${initial.ids[0] ?? "无"} → ${initial.ids.at(-1) ?? "无"} / ${initial.count} 行 ` +
          `(shown ${initial.shown} / total ${initial.total}) «${moreText}»`,
      );
    }

    const fit = await more.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        height: box.height,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        viewport: window.innerWidth,
      };
    });
    checked += 1;
    if (
      fit.left < -1 ||
      fit.right > fit.viewport + 1 ||
      fit.scrollWidth > fit.clientWidth + 1 ||
      fit.height < 27.5
    ) {
      failures.push(
        `[195] 法宝册续开入口被挤坏:` +
          `盒 ${Math.round(fit.left)}..${Math.round(fit.right)} / ` +
          `内容 ${fit.scrollWidth}>${fit.clientWidth} / ` +
          `高 ${Math.round(fit.height * 10) / 10}px / 视口 ${fit.viewport}`,
      );
    }
    checked += 1;
    const layoutProblems = problemsOf(await measurePage(page));
    if (layoutProblems.length) failures.push(`[195] 法宝册 → ${layoutProblems.join(" / ")}`);

    await more.click({ timeout: 5000 });
    await waitForShown(12);
    await waitForFocus(sortedIds[6]);
    const second = await readList();
    checked += 1;
    if (
      second.shown !== 12 ||
      second.start !== 0 ||
      second.count !== 12 ||
      second.focus !== sortedIds[6]
    ) {
      failures.push(
        `[195] 法宝册续开首批后应铺 12 件、焦点落 ${sortedIds[6]},` +
          `实见 ${second.count} 件 / start ${second.start} / 焦点 ${second.focus ?? "无"}`,
      );
    }

    let last = second;
    let shownBefore = second.shown;
    let finalFocus = sortedIds[6];
    while (shownBefore < total) {
      const shownAfter = Math.min(total, shownBefore + 6);
      const focusId = sortedIds[shownBefore];
      await page.locator("[data-artifact-more]").first().click({ timeout: 5000 });
      await waitForShown(shownAfter);
      await waitForFocus(focusId);
      last = await readList();
      const expectedStart = Math.max(0, shownAfter - 12);
      const expectedCount = shownAfter - expectedStart;
      checked += 1;
      if (
        last.shown !== shownAfter ||
        last.start !== expectedStart ||
        last.count !== expectedCount ||
        last.focus !== focusId
      ) {
        failures.push(
          `[195] 法宝册续开到第 ${shownAfter} 件时窗口不对:` +
            `应 ${expectedCount} 行 / start ${expectedStart} / 焦点 ${focusId},` +
            `实见 ${last.count} 行 / start ${last.start} / ` +
            `焦点 ${last.focus ?? "无"}(shown ${last.shown})`,
        );
      }
      finalFocus = focusId;
      shownBefore = shownAfter;
    }
    const lastStart = total - 12;
    checked += 1;
    if (
      last.count !== 12 ||
      last.start !== lastStart ||
      last.focus !== finalFocus ||
      last.ids.includes(sortedIds[0]) ||
      !last.ids.includes(sortedIds.at(-1)) ||
      (await page.locator("[data-artifact-more]").count()) > 0 ||
      (await page.locator("[data-artifact-prev]").count()) === 0
    ) {
      failures.push(
        `[195] 法宝册末批应滑窗为 12/${total}、从第 ${lastStart + 1} 件起、` +
          `焦点 ${finalFocus} 并可回翻,` +
          `实见 ${last.count} 件 / start ${last.start} / 焦点 ${last.focus ?? "无"} / ` +
          `首批 ${last.ids.includes(sortedIds[0]) ? "仍在" : "已滑走"} / ` +
          `末件 ${last.ids.includes(sortedIds.at(-1)) ? "在" : "缺失"}`,
      );
    }

    await page.locator("[data-artifact-prev]").first().click({ timeout: 5000 });
    const backShown = Math.floor((total - 1) / 6) * 6;
    const backStart = backShown - 12;
    await waitForShown(backShown);
    await waitForFocus(sortedIds[backStart]);
    const back = await readList();
    checked += 1;
    if (
      back.start !== backStart ||
      back.count !== 12 ||
      back.focus !== sortedIds[backStart] ||
      !back.ids.includes(sortedIds[backStart])
    ) {
      failures.push(
        `[195] 法宝册回翻没有回到上一页:` +
          `应 start ${backStart} / 12 件 / 焦点 ${sortedIds[backStart]},` +
          `实见 start ${back.start} / ${back.count} 件 / 焦点 ${back.focus ?? "无"}`,
      );
    }

    const toggledId = back.ids[0];
    if (toggledId) {
      await page.locator(`[data-artifact-row="${toggledId}"] button`).first().click({
        timeout: 5000,
      });
      await waitForFocus(toggledId);
      const toggled = await readList();
      checked += 1;
      if (toggled.focus !== toggledId || !toggled.ids.includes(toggledId)) {
        failures.push(
          `[195] 法宝随身后焦点没有留在原卡:` +
            `应 ${toggledId},实见焦点 ${toggled.focus ?? "无"} / ` +
            `当前窗口 ${toggled.ids.join(",")}`,
        );
      }
    }

    // 夹具把回翻窗首卡排成「炼化后会越过窗界」的那一件,焦点判据才不是空转。
    const upgradeId = back.ids[0];
    if (!upgradeId) {
      failures.push("[195] 法宝册找不到可炼化的卡 —— 改序焦点判据没有对象");
    } else {
      const row = page.locator(`[data-artifact-row="${upgradeId}"]`);
      const upgrade = row
        .locator("button")
        .filter({ hasText: /炼\s*化/ })
        .first();
      if ((await upgrade.count()) === 0 || !(await upgrade.isEnabled())) {
        failures.push(`[195] 法宝册跨窗焦点判据的 ${upgradeId} 不可炼化 —— 夹具或代价算错了`);
      } else {
        await upgrade.click({ timeout: 5000 });
        await waitForFocus(upgradeId);
        const refined = await readList();
        checked += 1;
        if (
          refined.focus !== upgradeId ||
          !refined.ids.includes(upgradeId) ||
          refined.shown !== backStart ||
          refined.start !== backStart - 12 ||
          refined.count !== 12
        ) {
          failures.push(
            `[195] 法宝炼化越过窗界后没有按新位置重开窗:` +
              `应 12 件 / start ${backStart - 12} / shown ${backStart} / 焦点 ${upgradeId},` +
              `实见焦点 ${refined.focus ?? "无"} / shown ${refined.shown} / ` +
              `start ${refined.start} / ${refined.count} 件`,
          );
        }
      }
    }

    if (pageErrors.length)
      failures.push(`[320] 法宝全册场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
    await vite?.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 开炉丹方 —— 54 张方子每张都摊代价、成品、把握、双成、存货与两枚动作。
 *
 * max-h-64 只限制眼睛看到的滚动框,不限制 DOM;这里验证 6 张一批、12 张滑窗,
 * 搜索换词时窗口回到首批且不抢输入焦点,逐批翻到末页仍覆盖全部方子。最后在
 * 195 宽下真炼一炉,确认耗料改序后焦点仍跟住同一张方,而不是落到被销毁的节点。
 */
async function taskRecipeListOverflow() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  let vite = null;
  try {
    vite = await createViteServer({
      root: ROOT,
      server: { middlewareMode: true },
      appType: "custom",
      logLevel: "silent",
    });
    const recipeFixture = await vite.ssrLoadModule("/scripts/lib/fullRecipeFixture.ts");
    const recipeState = recipeFixture.fullRecipeSlices();
    const total = Number(recipeFixture.FULL_RECIPE_COUNT);
    const searchName = String(recipeFixture.FULL_RECIPE_SEARCH_NAME);
    const slices = showcaseSlices("light");
    slices.lore = { ...slices.lore, ...recipeState.lore };
    slices.resources = { ...slices.resources, ...recipeState.resources };
    await seedSave(ctx, slices, "__recipeListFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/inventory", { waitUntil: "load" });
    await page.getByRole("tab", { name: /丹/ }).first().click({ timeout: 5000 });
    await page
      .locator("main button", { hasText: /开炉炼丹/ })
      .first()
      .click({ timeout: 5000 });
    await page.locator("[data-recipe-total]").first().waitFor({ state: "visible", timeout: 10000 });
    await page.setViewportSize({ width: 195, height: 422 });
    await settleVisuals(page);

    async function readList() {
      return page.evaluate(() => {
        const holder = document.querySelector("[data-recipe-total]");
        const rows = [...document.querySelectorAll("[data-recipe-row]")];
        return {
          total: Number(holder?.getAttribute("data-recipe-total")),
          shown: Number(holder?.getAttribute("data-recipe-shown")),
          start: Number(holder?.getAttribute("data-recipe-start")),
          count: rows.length,
          ids: rows.map((row) => row.getAttribute("data-recipe-row")),
          focus: document.activeElement?.getAttribute("data-recipe-row"),
          searchFocused: document.activeElement?.getAttribute("aria-label") === "搜方名",
        };
      });
    }

    async function waitForShown(shown) {
      await page.waitForFunction(
        (wanted) =>
          document.querySelector("[data-recipe-total]")?.getAttribute("data-recipe-shown") ===
          String(wanted),
        shown,
        { timeout: 5000 },
      );
    }

    async function waitForTotal(count) {
      await page.waitForFunction(
        (wanted) =>
          document.querySelector("[data-recipe-total]")?.getAttribute("data-recipe-total") ===
          String(wanted),
        count,
        { timeout: 5000 },
      );
    }

    async function waitForFocus(id) {
      await page
        .waitForFunction(
          (rowId) => document.activeElement?.getAttribute("data-recipe-row") === rowId,
          id,
          { timeout: 2000 },
        )
        .catch(() => {});
    }

    const initial = await readList();
    const more = page.locator("[data-recipe-more]").first();
    const moreText = ((await more.textContent()) || "").replace(/\s+/g, " ").trim();
    checked += 1;
    if (
      initial.total !== total ||
      initial.shown !== 6 ||
      initial.start !== 0 ||
      initial.count !== 6 ||
      !new RegExp(`再看\\s*6\\s*张\\s*·\\s*余\\s*${total - 6}`).test(moreText)
    ) {
      failures.push(
        `[195] 丹方首批应 6/${total},实见 ${initial.count} 行 ` +
          `(shown ${initial.shown} / total ${initial.total}) «${moreText}»`,
      );
    }

    const fit = await more.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        height: box.height,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        viewport: window.innerWidth,
      };
    });
    checked += 1;
    if (
      fit.left < -1 ||
      fit.right > fit.viewport + 1 ||
      fit.scrollWidth > fit.clientWidth + 1 ||
      fit.height < 27.5
    ) {
      failures.push(
        `[195] 丹方续开入口被挤坏:盒 ${Math.round(fit.left)}..${Math.round(fit.right)} / ` +
          `内容 ${fit.scrollWidth}>${fit.clientWidth} / 高 ${Math.round(fit.height * 10) / 10}px`,
      );
    }
    const panelOverflow = await page.locator(".modal-panel").evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    checked += 1;
    if (panelOverflow.scrollWidth > panelOverflow.clientWidth + 1) {
      failures.push(
        `[195] 丹方弹窗横向溢出:${panelOverflow.scrollWidth}>${panelOverflow.clientWidth}`,
      );
    }
    checked += 1;
    const layoutProblems = problemsOf(await measurePage(page));
    if (layoutProblems.length) failures.push(`[195] 丹方册 → ${layoutProblems.join(" / ")}`);

    await more.click({ timeout: 5000 });
    await waitForShown(12);
    await waitForFocus((await readList()).ids[6]);
    const second = await readList();
    checked += 1;
    if (
      second.shown !== 12 ||
      second.start !== 0 ||
      second.count !== 12 ||
      second.focus !== second.ids[6]
    ) {
      failures.push(
        `[195] 丹方续开首批后应铺 12 张、焦点落第 7 张,` +
          `实见 ${second.count} 张 / start ${second.start} / 焦点 ${second.focus ?? "无"}`,
      );
    }

    let last = second;
    while (last.shown < total) {
      const shownBefore = last.shown;
      const shownAfter = Math.min(total, shownBefore + 6);
      await page.locator("[data-recipe-more]").first().click({ timeout: 5000 });
      await waitForShown(shownAfter);
      last = await readList();
      const expectedStart = Math.max(0, shownAfter - 12);
      const newCount = shownAfter - shownBefore;
      const focusId = last.ids[12 - newCount];
      await waitForFocus(focusId);
      const focused = await readList();
      checked += 1;
      if (
        last.shown !== shownAfter ||
        last.start !== expectedStart ||
        last.count !== shownAfter - expectedStart ||
        focused.focus !== focusId
      ) {
        failures.push(
          `[195] 丹方续开到第 ${shownAfter} 张时窗口不对:` +
            `应 ${shownAfter - expectedStart} 行 / start ${expectedStart} / 焦点 ${focusId},` +
            `实见 ${last.count} 行 / start ${last.start} / ` +
            `焦点 ${focused.focus ?? "无"}(shown ${last.shown})`,
        );
      }
    }
    const lastStart = total - 12;
    checked += 1;
    if (
      last.count !== 12 ||
      last.start !== lastStart ||
      (await page.locator("[data-recipe-more]").count()) > 0 ||
      (await page.locator("[data-recipe-prev]").count()) === 0
    ) {
      failures.push(
        `[195] 丹方末批应滑窗为 12/${total}、从第 ${lastStart + 1} 张起并可回翻,` +
          `实见 ${last.count} 张 / start ${last.start}`,
      );
    }

    await page.locator("[data-recipe-prev]").first().click({ timeout: 5000 });
    const backShown = Math.floor((total - 1) / 6) * 6;
    const backStart = Math.max(0, backShown - 12);
    await waitForShown(backShown);
    const back = await readList();
    await waitForFocus(back.ids[0]);
    const backFocused = await readList();
    checked += 1;
    if (back.start !== backStart || back.count !== 12 || backFocused.focus !== back.ids[0]) {
      failures.push(
        `[195] 丹方回翻没有回到上一页:应 start ${backStart} / 12 张 / 焦点页首,` +
          `实见 start ${back.start} / ${back.count} 张 / 焦点 ${backFocused.focus ?? "无"}`,
      );
    }

    const search = page.locator('input[aria-label="搜方名"]').first();
    await search.fill(searchName);
    await waitForTotal(1);
    await waitForShown(1);
    const searched = await readList();
    checked += 1;
    if (
      searched.total !== 1 ||
      searched.shown !== 1 ||
      searched.start !== 0 ||
      searched.count !== 1 ||
      !searched.searchFocused
    ) {
      failures.push(
        `[195] 搜方名后窗口应重置为 1/1 且焦点留在输入框,` +
          `实见 ${searched.count}/${searched.total} / start ${searched.start} / ` +
          `输入框 ${searched.searchFocused ? "有焦点" : "失焦"}`,
      );
    }

    await search.fill("");
    await waitForTotal(total);
    await waitForShown(6);
    const cleared = await readList();
    checked += 1;
    if (
      cleared.shown !== 6 ||
      cleared.start !== 0 ||
      cleared.count !== 6 ||
      !cleared.searchFocused
    ) {
      failures.push(
        `[195] 清空搜索后应回首批 6 张且焦点仍留输入框,` +
          `实见 ${cleared.count} 张 / start ${cleared.start} / ` +
          `输入框 ${cleared.searchFocused ? "有焦点" : "失焦"}`,
      );
    }

    await page.locator("[data-recipe-more]").first().click({ timeout: 5000 });
    await waitForShown(12);
    const craftList = await readList();
    const craftId = craftList.ids[6];
    const craftRow = page.locator(`[data-recipe-row="${craftId}"]`);
    const craftButton = craftRow.locator("button").first();
    if ((await craftButton.count()) === 0 || !(await craftButton.isEnabled())) {
      failures.push(`[195] 丹方焦点探针的 ${craftId} 不可炼制 —— 夹具算错了`);
    } else {
      await craftButton.click({ timeout: 5000 });
      await waitForFocus(craftId);
      const crafted = await readList();
      checked += 1;
      if (crafted.focus !== craftId || !crafted.ids.includes(craftId)) {
        failures.push(
          `[195] 炼制耗料后焦点没有留在原方:应 ${craftId},` +
            `实见 ${crafted.focus ?? "无"} / 当前窗 ${crafted.ids.join(",")}`,
        );
      }
    }

    if (pageErrors.length)
      failures.push(`[320] 丹方全册场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
    await vite?.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 词条转移候选 —— 无部位限制的词条能落到整包藏品上,max-h-24 只裁视觉不裁 DOM。
 *
 * 夹具用满 120 格行囊,源件是佩戴中的天品武器、挂一条无门槛词条,其余 119 件全是候选。
 * 从天品置顶的全藏品卡直接开详情,避免把部位候选弹窗叠在下面量进无干读数。
 * 195 宽下验证 12 件首批、24 件滑窗、逐批到末页再回翻,焦点跟住新露出第一件;
 * 候选行与件数读数、续开/回翻入口也不许把装备详情弹窗挤坏。
 */
async function taskAffixTransferOverflow() {
  const failures = [];
  let checked = 0;
  const ctx = await auditContext({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  let vite = null;
  try {
    vite = await createViteServer({
      root: ROOT,
      server: { middlewareMode: true },
      appType: "custom",
      logLevel: "silent",
    });
    const fixtureModule = await vite.ssrLoadModule("/scripts/lib/bigBagFixture.ts");
    const fixture = fixtureModule.makeAffixTransferBag(120);
    const total = Number(fixture.candidateCount);
    const slices = showcaseSlices("light");
    slices.inventory = {
      ...slices.inventory,
      items: fixture.items,
      equipped: { [fixture.sourceSlot]: fixture.sourceUid },
      artifacts: [],
      equippedArtifacts: [],
    };
    await seedSave(ctx, slices, "__affixTransferFixture");

    const page = await ctx.newPage();
    await page.addInitScript(() => {
      Math.random = () => 1;
    });
    const pageErrors = [];
    watchPageErrors(page, pageErrors);
    await page.goto(INDEX + "#/inventory", { waitUntil: "load" });
    const sourceCard = page.locator(`main button[data-uid="${fixture.sourceUid}"]`);
    await sourceCard.waitFor({ state: "visible", timeout: 10000 });
    await sourceCard.click({ timeout: 5000 });
    await page
      .getByRole("button", { name: /词条转移 · 移至别件/ })
      .first()
      .click({ timeout: 5000 });
    await page
      .getByRole("button", { name: fixture.affixName, exact: true })
      .first()
      .click({ timeout: 5000 });
    await page
      .locator("[data-affix-candidate-total]")
      .first()
      .waitFor({ state: "visible", timeout: 5000 });
    await page.setViewportSize({ width: 195, height: 422 });
    await settleVisuals(page);

    async function readList() {
      return page.evaluate(() => {
        const holder = document.querySelector("[data-affix-candidate-total]");
        const rows = [...document.querySelectorAll("[data-affix-candidate]")];
        return {
          total: Number(holder?.getAttribute("data-affix-candidate-total")),
          shown: Number(holder?.getAttribute("data-affix-candidate-shown")),
          start: Number(holder?.getAttribute("data-affix-candidate-start")),
          count: rows.length,
          ids: rows.map((row) => row.getAttribute("data-affix-candidate")),
          focus: document.activeElement?.getAttribute("data-affix-candidate"),
        };
      });
    }

    async function waitForShown(shown) {
      await page.waitForFunction(
        (wanted) =>
          document
            .querySelector("[data-affix-candidate-total]")
            ?.getAttribute("data-affix-candidate-shown") === String(wanted),
        shown,
        { timeout: 5000 },
      );
    }

    async function waitForFocus(id) {
      await page
        .waitForFunction(
          (rowId) => document.activeElement?.getAttribute("data-affix-candidate") === rowId,
          id,
          { timeout: 2000 },
        )
        .catch(() => {});
    }

    const initial = await readList();
    const more = page.locator("[data-affix-candidate-more]").first();
    const moreText = ((await more.textContent()) || "").replace(/\s+/g, " ").trim();
    checked += 1;
    if (
      initial.total !== total ||
      initial.shown !== 12 ||
      initial.start !== 0 ||
      initial.count !== 12 ||
      !new RegExp(`再看\\s*12\\s*件\\s*·\\s*余\\s*${total - 12}`).test(moreText)
    ) {
      failures.push(
        `[195] 词条转移候选首批应 12/${total},实见 ${initial.count} 行 ` +
          `(shown ${initial.shown} / total ${initial.total}) «${moreText}»`,
      );
    }

    const fit = await more.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        height: box.height,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        viewport: window.innerWidth,
      };
    });
    checked += 1;
    if (
      fit.left < -1 ||
      fit.right > fit.viewport + 1 ||
      fit.scrollWidth > fit.clientWidth + 1 ||
      fit.height < 27.5
    ) {
      failures.push(
        `[195] 词条转移续开入口被挤坏:盒 ${Math.round(fit.left)}..${Math.round(fit.right)} / ` +
          `内容 ${fit.scrollWidth}>${fit.clientWidth} / 高 ${Math.round(fit.height * 10) / 10}px`,
      );
    }
    const panelOverflow = await page
      .locator("[data-affix-candidate-total]")
      .first()
      .evaluate((el) => {
        const panel = el.closest(".modal-panel");
        return {
          scrollWidth: panel?.scrollWidth ?? 0,
          clientWidth: panel?.clientWidth ?? 0,
        };
      });
    checked += 1;
    if (panelOverflow.scrollWidth > panelOverflow.clientWidth + 1) {
      failures.push(
        `[195] 词条转移弹窗横向溢出:${panelOverflow.scrollWidth}>${panelOverflow.clientWidth}`,
      );
    }
    checked += 1;
    const layoutProblems = problemsOf(await measurePage(page));
    if (layoutProblems.length)
      failures.push(`[195] 词条转移候选册 → ${layoutProblems.join(" / ")}`);

    await more.click({ timeout: 5000 });
    await waitForShown(24);
    const second = await readList();
    await waitForFocus(second.ids[12]);
    const secondFocused = await readList();
    checked += 1;
    if (
      second.shown !== 24 ||
      second.start !== 0 ||
      second.count !== 24 ||
      secondFocused.focus !== second.ids[12]
    ) {
      failures.push(
        `[195] 词条转移续开首批后应铺 24 件、焦点落第 13 件,` +
          `实见 ${second.count} 件 / start ${second.start} / 焦点 ${secondFocused.focus ?? "无"}`,
      );
    }

    let last = secondFocused;
    while (last.shown < total) {
      const shownBefore = last.shown;
      const shownAfter = Math.min(total, shownBefore + 12);
      await page.locator("[data-affix-candidate-more]").first().click({ timeout: 5000 });
      await waitForShown(shownAfter);
      const shown = await readList();
      const expectedStart = Math.max(0, shownAfter - 24);
      const focusIndex = shownBefore - expectedStart;
      await waitForFocus(shown.ids[focusIndex]);
      const focused = await readList();
      checked += 1;
      if (
        shown.shown !== shownAfter ||
        shown.start !== expectedStart ||
        shown.count !== shownAfter - expectedStart ||
        focused.focus !== shown.ids[focusIndex]
      ) {
        failures.push(
          `[195] 词条转移续开到第 ${shownAfter} 件时窗口不对:` +
            `应 ${shownAfter - expectedStart} 行 / start ${expectedStart} / ` +
            `焦点 ${shown.ids[focusIndex]},实见 ${shown.count} 行 / start ${shown.start} / ` +
            `焦点 ${focused.focus ?? "无"}(shown ${shown.shown})`,
        );
      }
      last = shown;
    }

    const lastStart = total - 24;
    const previous = page.locator("[data-affix-candidate-prev]").first();
    const previousText = ((await previous.textContent()) || "").replace(/\s+/g, " ").trim();
    checked += 1;
    if (
      last.count !== 24 ||
      last.start !== lastStart ||
      (await page.locator("[data-affix-candidate-more]").count()) > 0 ||
      !new RegExp(`前一批\\s*11\\s*件`).test(previousText)
    ) {
      failures.push(
        `[195] 词条转移末批应滑窗为 24/${total}、从第 ${lastStart + 1} 件起,` +
          `回翻入口报「前一批 11 件」,实见 ${last.count} 件 / start ${last.start} / «${previousText}»`,
      );
    }

    await previous.click({ timeout: 5000 });
    await waitForShown(108);
    const back = await readList();
    await waitForFocus(back.ids[0]);
    const backFocused = await readList();
    checked += 1;
    if (back.start !== 84 || back.count !== 24 || backFocused.focus !== back.ids[0]) {
      failures.push(
        `[195] 词条转移回翻没有回到上一页:应 start 84 / 24 件 / 焦点页首,` +
          `实见 start ${back.start} / ${back.count} 件 / 焦点 ${backFocused.focus ?? "无"}`,
      );
    }

    if (pageErrors.length)
      failures.push(`[320] 词条转移候选场景页面异常:${[...new Set(pageErrors)].join(" | ")}`);
  } finally {
    await ctx.close();
    await vite?.close();
  }
  return { failures, checked, contrastFails: [], pixelContrastFails: [], zoomFails: [] };
}

/**
 * 只读页(第二个标签页)—— 必须把「为什么不动」常驻说出来。
 *
 * 多标签共用一份存档时,后来的那页由 core/singleWriter 判成只读:不启引擎、存储层合闸。
 * 这套行为有单测,但玩家侧只剩「数字不动」—— 三秒的 toast 消失后就没有任何解释。
 * 判据:同一 context 开两页,先开的那页不许有横幅,后开的那页必须有,且不裁字、不溢出。
 *
 * 四种形态都要量:390 / 195(200% 缩放)× 日间 / 夜间。这一页不巡游,巡页那几遍
 * 永远碰不到它 —— 横幅是朱砂 6% 的自底,正是「窄到只剩 195」与「夜间换肤」最容易
 * 出事的两档。
 */
async function taskReadOnlyTab() {
  const failures = [];
  let checked = 0;
  const contrastFails = [];
  const pixelContrastFails = [];
  const zoomFails = [];
  const ctx = await auditContext({ viewport: { width: 390, height: 844 } });
  try {
    const writer = await ctx.newPage();
    await writer.goto(INDEX + "#/", { waitUntil: "load" });
    await writer.waitForTimeout(900);
    const reader = await ctx.newPage();
    await reader.goto(INDEX + "#/", { waitUntil: "load" });
    await reader.waitForTimeout(900);

    checked += 1;
    const writerHas = await writer.evaluate(() => !!document.querySelector("[data-save-reader]"));
    if (writerHas) failures.push("[390] 写者页不该出现只读横幅");

    /** 量一次当前形态;标签带上视口档与配色,失败时才知道是哪一档 */
    const measure = async (tag) => {
      checked += 1;
      const banner = await reader.evaluate(() => {
        const el = document.querySelector("[data-save-reader]");
        if (!el) return null;
        const shell = document.getElementById("app")?.firstElementChild;
        const r = el.getBoundingClientRect();
        return {
          text: (el.textContent || "").replace(/\s+/g, " ").trim(),
          height: Math.round(r.height),
          // 溢出/裁字:文字自己滚得动或盒子装不下,都算这行没把话说全
          clipped: el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2,
          overflowX: shell ? Math.round(shell.scrollWidth - shell.clientWidth) : 0,
        };
      });
      if (!banner) {
        failures.push(
          `[${tag}] 第二个标签页没有常驻只读说明 —— 只有一次性 toast,玩家会以为游戏坏了`,
        );
        return;
      }
      if (!/只读/.test(banner.text))
        failures.push(`[${tag}] 只读横幅没把话说清楚:«${banner.text}»`);
      if (banner.height < 20)
        failures.push(`[${tag}] 只读横幅只有 ${banner.height}px 高,读不清也点不着`);
      if (banner.clipped) failures.push(`[${tag}] 只读横幅文字被裁掉:«${banner.text}»`);
      if (banner.overflowX > 1)
        failures.push(`[${tag}] 只读横幅撑出横向溢出 ${banner.overflowX}px`);
    };

    for (const scheme of ["light", "dark"]) {
      await reader.emulateMedia({ colorScheme: scheme });
      for (const [width, height, tier] of [
        [390, 844, "390"],
        [195, 422, "195·200%"],
      ]) {
        await reader.setViewportSize({ width, height });
        await reader.waitForTimeout(350);
        await measure(`${tier} ${scheme === "dark" ? "夜间" : "日间"}`);
      }
    }

    /*
     * 横幅的像素对比度也要量:它不是巡游页,`taskPageTour` 那遍永远采不到它。
     * measureTextContrast 自己会把主题翻两遍并逐像素合成,故这里只跑一次。
     */
    await reader.emulateMedia({ colorScheme: "light" });
    await reader.setViewportSize({ width: 390, height: 844 });
    await reader.waitForTimeout(350);
    for (const bad of await measureTextContrast(reader)) {
      contrastFails.push(
        `[只读页] ${bad.theme} ${bad.ratio}:1(需 ${bad.need})${bad.size}px «${bad.text}»`,
      );
    }

    /*
     * 恢复路径:另一处关掉之后,这一页必须自己说出「刷新就能回来」。
     *
     * 只读页的心跳早就不跑了,锁释放这件事**没有任何事件**能推到它 —— 不主动探,
     * 横幅会永远写着「已在另一处打开」,玩家只能猜(或干脆重开浏览器)。
     * 判据走完整条路:关掉写者 → 横幅换成可刷新的形态 → 点它 → 横幅消失且锁回到手里。
     */
    await reader.emulateMedia({ colorScheme: "light" });
    await reader.setViewportSize({ width: 390, height: 844 });
    await reader.waitForTimeout(300);
    await writer.close();
    const freed = await reader
      .waitForFunction(
        () => document.querySelector("[data-save-reader]")?.hasAttribute("data-save-reader-freed"),
        { timeout: 12000 },
      )
      .then(() => true)
      .catch(() => false);
    checked += 1;
    if (!freed) {
      failures.push("[只读页 · 恢复] 另一处关掉之后,横幅没有换成「刷新即可继续」—— 玩家只能猜");
    } else {
      await reader.evaluate(() => {
        document.querySelector("[data-save-reader] button")?.click();
      });
      const recovered = await reader
        .waitForFunction(() => !document.querySelector("[data-save-reader]"), { timeout: 12000 })
        .then(() => true)
        .catch(() => false);
      checked += 1;
      if (!recovered)
        failures.push("[只读页 · 恢复] 按了「刷新本页」之后横幅还在 —— 没真正回到写者态");
      const held = await reader.evaluate(async () => {
        const state = await navigator.locks.query();
        return (state.held || []).filter((l) => l.name === "xuanshu.save-writer").length;
      });
      checked += 1;
      if (held !== 1) {
        failures.push(`[只读页 · 恢复] 刷新后没拿到写权(锁持有者 ${held})—— 刷新也只是白刷`);
      }
    }
  } finally {
    await ctx.close();
  }
  return { failures, checked, contrastFails, pixelContrastFails, zoomFails };
}

/** 任务的顺序就是报告里失败清单的顺序 —— 与串行时代逐块打印的顺序一致 */
const TASKS = [
  ...VIEWPORTS.map((vp) => [`页面巡游[${vp.tag}]`, () => taskPageTour(vp)]),
  ["存档写不进去 · 设置页必须说话", taskSaveUnwritable],
  ["弹窗的键盘与焦点", taskModalFocus],
  ["Tab 焦点看得见", taskTabFocus],
  ["浮出的提示条点得掉", taskToastDismiss],
  ["引擎概率弹窗(顿悟 / 洞府巡游)", taskEngineModals],
  ["冷启动落在子页的返回", taskColdStartBack],
  ["后期档逐页复核", taskLateTour],
  ["渡劫突破真打一次", taskTribulation],
  ["走完一次转世", taskReincarnation],
  ["挂机真的在挂着跑", taskIdleTick],
  ["存档导出 / 导入往返", taskSaveRoundTrip],
  ["智能收纳不扔有投入的件", taskSmartKeep],
  ["背包先报新得与可换槽位", taskInventoryAttention],
  ["门庭先报今日", taskApprenticePulse],
  ["一键分解先勾后点", taskDecompose],
  ["法宝炼化的两笔账", taskArtifactRefine],
  ["洞府营造的账目", taskDongfuBuild],
  ["洞府首屏的营造优先", taskDongfuFold],
  ["界域志首屏的此刻优先", taskCodexFold],
  ["成就谱首屏的眼下可追", taskAchievementFold],
  ["藏珍谱首屏的新得优先", taskCollectionFold],
  ["减少动效真的减到了", taskReduceMotion],
  ["闭关的跨页承诺", taskRetreat],
  ["背包里的账目", taskInventoryAccounting],
  ["真打一场历练战斗", taskCombatReplay],
  ["敌人卡最挤的一档", taskEnemyCard],
  ["秘境卡在境中的窄屏一档", taskSecretRealm320],
  ["历练首屏主线优先", taskAdventureFold],
  ["前尘山河三世同册", taskWorldHistory],
  ["切后台立即落盘", taskPersistTiming],
  ["导出失败也说话", taskExportFailure],
  ["坏档也能进游戏", taskBadSave],
  ["iOS 存档风险提示", taskIosNotice],
  ["修行速服丹药的余量入口", taskQuickPillOverflow],
  ["修行功法三册的分批回看", taskGongfaListOverflow],
  ["天界道痕满卷的分批回看", taskMarksListOverflow],
  ["构筑对照的道痕余量入口", taskBuildCompareOverflow],
  ["修仙录的历世与行迹回看", taskLegacyHistoryOverflow],
  ["道侣的历世同行回看", taskBondHistoryOverflow],
  ["器魂两册的分批回看", taskSoulListOverflow],
  ["名号与灵兽两册的分批回看", taskTitlePetOverflow],
  ["法宝全册的分批回看", taskArtifactListOverflow],
  ["开炉丹方的分批回看", taskRecipeListOverflow],
  ["词条转移候选的分批回看", taskAffixTransferOverflow],
  ["只读页(第二个标签页)的常驻说明", taskReadOnlyTab],
  ["开局前两页(欢迎 / 建号)", taskPreGameTour],
  ["浮层在 200% 缩放档(点得开的那几扇)", taskDialogZoom],
  ["构建产物 · dvh / 字体栈", taskBuildArtifacts],
];

/**
 * 固定上限的并发池:先到先跑,谁空出来谁接下一个。
 * 单个任务抛异常只把这条计入失败,不拖垮整轮 —— 从前一个未捕获的异常会让
 * 后面所有判据连不上、报告里只剩一句堆栈,分不清是环境问题还是真回归。
 */
async function runPool(tasks, limit) {
  const out = Array.from({ length: tasks.length });
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= tasks.length) return;
      try {
        out[i] = await tasks[i][1]();
      } catch (e) {
        out[i] = makeReport();
        out[i].failures.push(`[${tasks[i][0]}] 任务自身抛异常:${e?.stack ?? e}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return out;
}

const results = await runPool(TASKS, JOBS);
await browser.close();
for (const r of results) {
  checked += r.checked;
  for (const f of r.failures) failures.push(f);
}

// 主值行那条判据是"显式契约"式的:契约被删光(没人再写 data-value-row)时它会静默空转
if (valueRowsSeen === 0) {
  failures.push("data-value-row 一个都没量到 —— 主值行折行那条判据空转了(模板里的契约被删了?)");
}
if (controlHostsSeen === 0) {
  failures.push("一枚按钮语义宿主都没扫到 —— 控件套控件那条判据空转了(全库不再有待查形状?)");
}
// 这两条同理:量不到东西时不许静默变绿
if (zoomSeen === 0) {
  failures.push("200% 缩放档一页都没量到 —— 那条判据空转了");
}
if (pixelTextsSeen === 0) {
  failures.push("渐变/图片底上的字一处都没采到 —— 那条判据空转了(采样半径或底色判定写错了?)");
}

/**
 * 产物层静态判据:**首页不许引用任何外链**。
 *
 * 上面那条量的是"跑起来时真的没发外部请求";这条补的是"就算不发,也不许把外链写进产物" ——
 * 例如 `<link rel="preconnect">`、预加载、条件加载的外部脚本,运行时量不到,但它们同样是
 * 对第三方的依赖(隐私声明第六节写着"零外部请求",这条替那句话守门)。
 */
{
  const html = readFileSync(join(ROOT, "dist/index.html"), "utf8");
  const external = [...html.matchAll(/(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["']/g)].map(
    (m) => m[1],
  );
  if (external.length > 0) {
    failures.push(
      `首页引用了 ${external.length} 个外链 —— 本站的决定是"零外部请求":${external.slice(0, 3).join("、")}`,
    );
  }
}

console.log(`\n排版自检:${checked} 个页面 × 视口组合`);
if (blockedTotal() !== 0) {
  failures.push(
    `这 ${checked} 次页面加载里发起了 ${blockedTotal()} 个外域请求 —— 本站的决定是「零外部请求」(见 index.html 与隐私声明第六节)`,
  );
}
if (failures.length === 0) {
  console.log(
    "✓ 无横向溢出、无越界元素、底部导航五项齐全、控件有名且不小于 28px、选择项有选中态、没有「念出来是按钮却按不动」的假控件、没有套在按钮里的控件",
  );
  console.log("✓ 顶栏底栏钉死(文档层没有可滚余量,滚窗两栏不动),外壳高度认 dvh");
  console.log("✓ 六处页签栏吸顶(背包四册 / 图鉴 / 名号 / 界域志 / 天界 / 坊市),且铺满内容区宽度");
  console.log("✓ 顶栏一格一行(320 窄屏与横屏、桌面都不折行)");
  console.log(`✓ 主值行一格一行(${valueRowsSeen} 处带 data-value-row 的行没被次要读数挤折)`);
  console.log(`✓ 两百档字号(${zoomSeen} 页在 200% 缩放下不溢出、主值行不折)`);
  console.log(`✓ 渐变与图片底上的字(${pixelTextsSeen} 处按屏幕像素采过,没有成片读不出来的)`);
  console.log("✓ iOS 存档风险提示只在该出现的平台出现,关一次就不再唠叨");
  console.log("✓ 楷体三端统一(内置排栈首,系统楷体留作兜底),且真由内置字体渲染");
  console.log("✓ 提示条点得掉、弹窗焦点与外壳偏移正常、引擎事件弹窗也过同一套尺子");
  if (SHOTS) console.log(`  截图已存 ${SHOTS_DIR}`);
} else {
  for (const f of failures) console.log(`✗ ${f}`);
  process.exitCode = 1;
}
