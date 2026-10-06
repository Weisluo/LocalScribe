# Phase 3 种族与体系轻量模块实施计划

> 依据：races_ui_design.md、systems_ui_design.md、cross_module_link_design.md、worldbuilding_ui_design.md、worldview_configuration_system.md；公共约定：00_overview.md。
> 复用 P1 的 worlds/world_links 与 P2 共用件，不新增表、不新增契约外 link_type；只写计划。

---

## 1. 阶段目标与范围

**做**

- tab 接入：WorldbuildingView 增加 races/systems 分支，模块缺失时按 TAB_CONFIG 创建，空 tab 进入空状态。
- RacesView：图鉴网格、详情、血缘树（race/subrace 用 parent_id，跨族用 races.related_to）。
- SystemsView：三栏阶梯、节点详情、典籍卡片。
- 复用 P1 的 kind/meta/customFields 与 ModuleConfig，层级不落 WorldLink。
- 双向关联：出链接入 LinkPanel，入链只读可跳，计数即时更新。
- 复杂度：sketch 可读写最小路径，structure 完整视图，sandbox 只留接入位。
- 空态与 3 分钟路径；降级阈值为血缘 >80、卡片 >200、阶梯 >300。

**不做**

- 不做 sandbox 统计、世界脉络子图、时间与流量维度。
- 不预置种族/体系/阶位等示例；不做数值、战斗模拟、公式与 AI 生成。
- 不做第三层族裔、多父级血缘、跨体系共享节点池。
- 不改地图/特殊界面；不做政治/经济主视图；不新增后端表或专用路由。

## 2. 前置依赖与进入条件

| 依赖 | 必须已交付 | 用途 |
|------|-----------|------|
| P0 | D3 双读、D4 Character 统一、D7 API 拆分 | kind/meta 兼容与角色引用 |
| P1 | T2 kind/meta/config、T3-T5 WorldLink registry、T6 links API、T7 worlds API、T9 测试 | 全部数据 |
| P2 | T1 类型/hooks、T2 EntityBadge、T3 EntityPicker、T4 LinkPanel、T5 ComplexitySwitcher、T6 tab、T7 导航、T8 行内引用 | 视图与关联 |

上游 P0/P1 见对应计划，P2 编号见 phase2_frontend_history.md。

进入条件：Phase 2 DoD 通过；空世界可建 races/systems；submodules/items 支持 kind、meta、parent_id、config；契约 §4.5/§4.6 可用。

## 3. 指导文档

- 全文：races_ui_design.md 与 systems_ui_design.md（§2 层级、§3 数据映射、§4 视图、§5 交互、§6 关联、§7 自定义、§8 复杂度、§9-§10 空态与路径、§11 性能、§12 边界）。
- 章节：cross_module_link_design.md §2.4-2.7、§3 races/systems、§4.5/4.6/4.7、§5.1-5.5；worldbuilding_ui_design.md §2.3/2.5/2.6、§4.1-4.7、§5、§6.5/6.6、§7、§9；worldview_configuration_system.md §4.1-4.5、§5.2-5.4、§6.1；00_overview.md §3-§9 与 AGENTS.md。
- 冲突先改契约。

## 4. 现状与改动面

- WorldbuildingView：TAB_CONFIG 已有 races=Users、systems=Cpu，内容分支仅 history/economy；P3-T1 增加两分支并复用 P2 模块加载与复杂度上下文。
- 无 RacesView/SystemsView 目录；EconomyView 仅可参考字段渲染。
- worldbuildingApi 的子模块/条目 CRUD 由 P1 扩展 kind/meta/config；types/api 由 gen:types 生成；P2 共用件在 common/。
- 后端无 races/systems 专用 API，复用通用 routes；缺 config/kind 过滤或 meta 增量时回 P1 补，P3 不私建。
- 角色走 characterApi；历史/政治/经济/地图未接入时隐藏入口并文本回退。

新增目录（R=RacesView，Y=SystemsView）：

- R/：index.tsx、types.ts、config.ts、hooks/useRaces.ts、components/{RaceGrid,RaceCard,RaceDetail,LineageTree,LineageFallback,RelationChipRow,Emblem}、modals/{RaceFormModal,SubraceFormModal,EdgeMetaModal}。
- Y/：index.tsx、types.ts、config.ts、hooks/useSystems.ts、components/{SystemList,StairBoard,TierNode,NodeDetail,ChipRow,CodexView,CodexVolume,TierBulkInput}、modals/{SystemFormModal,NodeFormModal,NodeDeleteModal}。
- 共用 P2 的 EntityPicker、LinkPanel、EntityBadge、ComplexitySwitcher、InlineReference；补充 useModuleConfig 与 CustomFieldRenderer（若 P2 未交付）。

## 5. 任务分解表

| Task ID | 任务 | 产出 | 上游 | 规模 |
|---------|------|------|------|------|
| P3-T1 | tab 接入与空态 | WorldbuildingView、R/Y index、EmptyState | P1-T7、P2-T6 | S |
| P3-T2 | Races 数据层 | R/types、R/config、R/hooks/useRaces；kind/meta 映射 | P3-T1、P2-T1 | M |
| P3-T3 | 图鉴网格与详情 | RaceGrid、RaceCard、RaceDetail、Emblem、表单 | P3-T2、P2-T2/T4 | M |
| P3-T4 | 血缘树与降级 | LineageTree、LineageFallback、EdgeMetaModal；>80 降级 | P3-T3、P2-T4 | L |
| P3-T5 | Systems 数据层与阶梯 | Y/types、Y/config、Y/hooks/useSystems、SystemList、StairBoard、TierNode、TierBulkInput | P3-T1、P2-T1 | L |
| P3-T6 | 节点详情与典籍 | NodeDetail、ChipRow、CodexView、CodexVolume、NodeFormModal；grants/costs 入链 | P3-T5 | M |
| P3-T7 | 双向关联落地 | R/Y 关联区、useModuleLinks、RelationChipRow；registry 过滤与反向计数 | P3-T3、P3-T6、P2-T3/T4 | M |
| P3-T8 | kind/字段/等级/状态配置 | ModuleConfig 适配、CustomFieldRenderer、depth 校验、配置入口 | P3-T2、P3-T5、P1-T2、P2-T1 | M |
| P3-T9 | 空态、3 分钟路径与降级 | EmptyState、QuickStart、虚拟滚动、视口裁剪、懒加载 | P3-T3 至 P3-T8 | M |
| P3-T10 | 验收回归 | races_systems.spec.ts；light/dark、键盘、a11y、白名单 | P3-T1 至 P3-T9 | M |

顺序：T1→T2→T3→T4；T1→T5→T6；T2/T3/T5/T6→T7/T8→T9→T10；T3/T4 与 T5/T6 并行，共用件先合并。

## 6. 数据 / API / 组件变更清单

- 数据：Submodule 以 kind+meta+parent_id 承载 races(race/subrace) 与 systems(system/tier/ability/rule/cost)；层级只用 parent_id。
- Meta：RaceMeta 与 System/Tier/NodeMeta 按设计文档 §3 落库，保留 customFields 与未知字段；items 用 atlas.*、codex.*、tier.breakthrough、node.detail，content 不写跨模块引用。
- config 与 API：ModuleConfig 用 entityTypes、fieldSchema、statuses、levels、linkTypes、displayMode、defaultComplexity，races 加 relationKinds/emblemPalette，systems 加 tierTerm/rankStep/nodeStyles；接口复用 P1 通用 API（submodules 过滤/树、items 过滤、meta 增量、config、links/counts），缺字段回 P1 补 OpenAPI。

关联（只用契约 §4 类型）：

- Races 出链：races.inhabits/origin_at/related_to/notable_figure/affinity_with/specialty/prefers；入链：character.belongs_to_race、politics.includes_race、history.involves、history.milestone_of。
- Systems 出链：systems.advances_to/requires/grants/costs/practiced_by/enables/countered_by；入链：character.practices_system/attained、races.affinity_with、history.involves/milestone_of。
- grants/costs 用 WorldLink 表达节点复用，对称单条、计数批量。

组件与复杂度：

- Races 为图鉴网格+详情+血缘树，Systems 为阶梯+节点详情+典籍，复用 P2 的 LinkPanel、EntityBadge、EntityPicker、ComplexitySwitcher、InlineReference。
- sketch：races 只显示名称+一句话+代表色+计数+行内引用，添加关联默认 core.related_to；systems 用名称+一句话+多行阶位，阶梯只读、典籍隐藏。structure 启用完整字段、血缘树、连线与典籍；sandbox 只留挂载点与降级。术语取 ModuleConfig。

## 7. 测试与验收清单

- [x] 两 tab 可切换、模块缺失进入空态并可显式创建；两模块 3 分钟路径可走通。
  证据：WorldbuildingView 增加 races/systems 分支与缺失模块兜底（`MissingModuleState` + `POST /worldbuilding/templates/{world_id}/modules` 兼容转发）；harness3 `testWorldbuildingTabs` 断言切 tab 分别渲染 RacesView/SystemsView、缺模块时出现空态与 `种族模块尚未创建` 文案。
  未覆盖：3 分钟路径的 `QuickStart`（`data-testid="quick-start"`）本身没有断言——**该条勾选指的是「已实现且人工走通」，不是自动化覆盖**。
- [x] 图鉴网格响应式，卡片含 kind/状态/计数；详情字段顺序、幽灵占位、头像行正确。
  证据：`RacesView/components/{RaceGrid,RaceCard,RaceDetail,Emblem}.tsx`；harness3 断言 4 张卡（含支系）、一句话特征、habitatText 回退「北岭」、`data-kind="subrace"`、详情含档案字段组（`生理/外貌`）。
  未覆盖：代表人物区、支系区、幽灵占位、状态徽章、字段顺序、卡片计数徽章均无断言（DOM 断言只到「区块存在」级别）。
- [x] 血缘树 parent_id 实线、related_to 双线/虚线、对称单条、第三层不出现；>80 节点降级、sketch 不加载布局。
  证据：`LineageTree`（边样式取 `relationKindDef`）、`LineageFallback`；harness3 断言 lineage-node=4 / lineage-branch=3（无第三层）、跨族边 `lineage-edge` 数量=2（真实 DOM 计数，替代原先只看文案的恒真断言）、90 节点切换为 `lineage-fallback`、sketch 档「血缘视图开关不存在」（负向对照）。
  去重口径（v1.1 修复）：`buildLineage` 按无序端点对 `${link_type}|min|max` 去重，对称关联落库两行时只画一条。
- [x] 阶梯按 meta.rank 排序、多行录入、拖拽调序、重复 rank 归一化；节点 grants/costs chips 与复用标记正确。
  证据：`SystemsView/types.ts` `normalizeTierRanks/sortTiersByRank/nextRankOf`、`components/{StairBoard,TierNode,TierBulkInput}.tsx`（HTML5 DnD + 上移/下移按钮）；harness3 断言 data-tier-rank 顺序 `10,20,30`、重复 rank 归一化为 10/20、批量录入 rank=序号×step、纳气 chip、external costs 文本回退。
  修复后语义：`moveTier('up')` = 提高 rank（与 `rankDirection` 显示顺序无关）；拖拽 `moveTierTo(targetIndex)` 一次到位，不再只移动一位；步进期间加锁避免同一快照重复写。
- [x] 典籍按 rank 一卷一卡、切换保留选中与滚动；advances_to/requires 环路检测并阻止，重复边合并。
  证据：`components/CodexView.tsx` + `buildCodexVolumes`、`hooks/useSystems.ts#createStairEdge`（先查重复边再 `wouldCreateStairCycle`，失败以 `toast.error` 提示且不写入）；harness3 断言 3 卷且 data-rank `10,20,30`、卷内能力/代价分类（含体系内 cost 节点归入代价的一条）、环路检测（t3→t1 成环、t1→t3 不成环、自指成环）。
  未覆盖：`createStairEdge` 的**写入路径**（重复边拦截、环路阻止后的不写入）没有断言，只有纯函数 `wouldCreateStairCycle`；「切换保留选中与滚动」无断言。
- [x] kind/meta/customFields 读写无损、未知 meta 保留、删除字段或类型提示影响；自定义 kind 的 parentKind 与 races<=2、systems<=3 校验生效。
  证据：`shared/moduleConfig.ts`（`mergeMeta` 保留未知键、`validateEntityType` + `kindDepth`）、`shared/{ModuleConfigPanel,CustomFieldRenderer}.tsx`（草稿显式保存、校验失败不生效、删除字段/类型给出「数据仍保留」提示）；harness3 断言未知 meta 保留、kindDepth 1/2、内置拒绝覆盖、缺 parentKind/超深拒绝、systems 第三层通过第四层拒绝。
  v1.1 修复：编辑/新建改为**一次 PUT**（原先表单字段与自定义字段分两次写、第二次用旧 meta 做基底会把第一次写入回滚）；配置面板保存改为**只提交与基线有差异的键**，且对象键（`fieldSchema`/`terminology`/`nodeStyles`）基于后端已存值做增量，避免把前端默认值固化或抹掉未编辑的同级子键。
- [x] LinkPanel 双向可查、reverseLabel 正确、入链不可删、失效可清理、计数批量；空态覆盖模块空、筛选无结果、局部空与 LinkPanel 空。
  证据：两视图关联区统一复用 P2 `LinkPanel`（出链可改可删、入链只读可跳、失效 chip 可清理），计数走 `shared/useLinkCountMap.ts` 单次世界级请求；空态由 `shared/EmptyState.tsx`（`empty-state`）统一承担；harness3 断言 module 空态、LinkPanel 出链/入链计数（人类：出链 2 / 入链 1，且不得出现旧的错误值「入链 6」）。
  v1.1 修复：`splitLinks` 原先只判 source，会把整个世界与实体无关的关联都算进入链（计数、chip、删除提示全部串位）；现同时判断对端，见 phase2_interface_freeze.md §7。
  未覆盖：筛选无结果空态与「清空筛选」、reverseLabel、入链不可删、失效清理、局部空均无断言。
- [~] 虚拟滚动与视口裁剪、头像懒加载、light/dark、键盘、aria、reduced-motion。
  证据：`shared/useVirtualList.ts`（`useVirtualGrid` 阈值 200/300，容器不可测量时退化为全量渲染；`useInView` 头像懒加载）；两视图带 `aria-pressed/aria-current/aria-label`、`motion-reduce:*`、键盘 `/ j k Enter`。
  v1.1 新增覆盖：harness3 显式给网格注入容器高度后断言 `data-virtualized="true"` 且只挂载窗口内的卡（<200 时断言 `false`），虚拟滚动不再是「只断言源码里有常量」。
  仍未覆盖（**不算通过**）：light/dark（harness 注入的页面没有 CSS，`dark:` 结构性不可测）、键盘、aria、reduced-motion、头像懒加载。这些属于实现存在但无自动化回归，降级为 `[~]`。
- [x] tsc/eslint/Playwright 通过；link_type 白名单通过；新建世界两个模块为空。
  证据：`tsc --noEmit` 0 error；`eslint`（RacesView/SystemsView/shared/WorldbuildingView/worldbuildingApi/tests）0 error 0 warning（改动前既有的 5 个 warning 落在 EconomyView/HistoryView，未触碰）；`playwright test` 13 passed（export 1 + phase2 6 + phase3 6），phase3 浏览器侧 **158 条断言** 0 失败 0 pageerror，地板为精确值 158；link_type 白名单扫描全 `src` 0 offender。
  「新建世界两个模块为空」由后端 `world_service` 只建骨架保证，本 spec 只做静态黑名单检查（不预置内容字段），两者的差别已在 phase3.spec 注释中写明。


## 8. 风险、兼容与回滚

- kind：自定义 kind 必须有 parentKind 与深度校验；删除时迁移并保留字段值。
- meta：未知字段不丢弃；旧 color/icon 前缀双读；emblem 缺省用字母章。
- 血缘树：拒绝环路与多父级；>80 节点降级列表；布局防抖避免阻塞。
- 阶梯：rank 重复或步长耗尽时归一化；乐观更新失败回滚；拖拽不改变节点归属。
- 关联规模：重复边检测、对称单条、批量 counts。
- 配置与回滚：ModuleConfig 草稿显式保存，校验失败不生效；两视图独立目录，可按 tab 关闭，sandbox 只隐藏不删数据。

## 9. 完成定义 DoD

满足 00_overview.md §5 通用 DoD：tsc/eslint/Playwright 通过；两个模块在 sketch/structure 下可创建、编辑、关联、跳转；3 分钟路径与空状态通过；性能阈值通过；link_type 白名单通过；无 emoji，图标均为 Lucide 名；无预置内容；P3 未新增后端表或专用路由；P3-T1 至 P3-T10 验收勾选。

## 10. 明确不在本阶段做的事

- 不做 sandbox 统计、世界脉络子图、流量与时间维度。
- 不做人口/基因模拟、数值平衡与公式引擎。
- 不做第三层族裔、多父级血缘、跨体系共享节点池。
- 不做地图/特殊界面改造；未接入模块隐藏入口并文本回退。
- 不做政治、经济主视图；不预置种族/体系/阶位等内容。
- 不做 AI 生成、专用导入导出与跨世界关联。

---

## 11. 实施记录（2026-10-06）

### 11.1 落盘路径

- 共用件（plan §4「补充 useModuleConfig 与 CustomFieldRenderer」）落在 `frontend/src/components/Worldbuilding/shared/`：
  `moduleConfig.ts`（解析/合并/kind 校验）、`ModuleConfigPanel.tsx`（草稿显式保存的配置面板）、
  `customFieldModel.ts` + `CustomFieldRenderer.tsx`、`EmptyState.tsx`、`QuickStart.tsx`、
  `useModuleConfig.ts`、`useModuleEntities.ts`、`useLinkCountMap.ts`、`useVirtualList.ts`、`index.ts`。
- `RacesView/` 与 `SystemsView/` 按 plan §4 的目录结构落盘；视图内另加 4 个辅助文件：
  `RacesView/components/toneColor.ts`、`RacesView/modals/{RaceFormFields,raceFormState}.tsx`、
  `SystemsView/components/systemsSupport.ts`。
- 接入点：`WorldbuildingView.tsx`（races/systems 分支 + `MissingModuleState`）、
  `services/worldbuildingApi.ts`、`tests/worldbuilding/{harness3.tsx,phase3.spec.ts,bundle.mjs}`。

### 11.2 与计划的偏差（均不扩大范围）

1. 模块缺失兜底走 P1 兼容转发路由 `POST /worldbuilding/templates/{world_id}/modules`（`WorldModule.world_id` 与 `template_id` 同列）；P1 未提供 `POST /worlds/{id}/modules`，故 P3 不私建后端路由。P6 清理兼容层时一并把入口切到正式路由。
2. `worldbuildingApi` 补齐 P1 遗漏的前端透传：submodule 的 `kind/meta`、`updateModule` 的 `config`、item `content` 放宽为 `Record<string, unknown>`，并新增 `createWorldModule`。仅前端类型/参数补齐，后端本就支持。
3. 血缘树与阶梯均为 CSS 自绘（无图库依赖）；race 详情采用主从双栏（网格 + 右栏详情），导航栈与面包屑仍由 `WorldbuildingView` 维护。
4. sketch 档保留「新建体系 / 新建阶位 / 批量录入 / 调序」，因为 §8 必填含「有序等级列表」、§10 的 3 分钟路径需要多行录入；成员节点、连线、典籍与模块配置仍在 sketch 隐藏。
5. 阶梯视觉为高位在上（DOM 顺序仍是 rank 升序），`上移/下移` 与视觉方向一致的处理在 `StairBoard`/`useSystems` 内注释说明。
6. 内置 kind 不可删除、不可改父级（`validateEntityType`），删除字段/类型只从 schema 移除并提示数据仍在 `meta.customFields` / `item.content` 中。

### 11.3 验证证据（2026-10-06）

| 项 | 命令 | 结果 |
|---|---|---|
| 类型 | `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | 0 error |
| Lint | `node node_modules/eslint/bin/eslint.js <P3 路径> tests/worldbuilding --ext ts,tsx` | 0 error / 0 warning |
| 前端回归 | `node node_modules/@playwright/test/cli.js test` | 13 passed（export 1 + phase2 6 + phase3 6） |
| P3 浏览器侧 | phase3.spec「浏览器侧用例」 | 149 断言 0 失败，0 pageError |
| 后端 | `python -m pytest tests/test_link_registry.py tests/test_worldbuilding_compat.py` | 30 passed（P3 未改后端，仅回归确认） |
| 后端边界 | `git status --porcelain -- backend` | 空（无新增/修改） |

### 11.4 遗留与后续阶段

- P6 需要：把模块创建入口切到正式 `/worlds/{id}/modules`、世界设置/术语全局配置、搜索与世界脉络。
- Phase 4/5 可直接复用 `shared/` 与两视图沉淀的详情抽屉、阶梯/网格与配置面板；`LinkPanel` 仍是关联的唯一读写面。

---

## 12. 审查修复轮（P3-R1）

§11 的产物做了一轮独立审查（契约、数据层、UI、测试四路并行 + 逐条复核），下列缺陷**已修复并纳入回归**；
§7 的证据文字同步改成与实际断言一致，夸大处降级或标注「未覆盖」。

### 12.1 数据丢失类（BLOCKER）

| 缺陷 | 根因 | 修复 |
|---|---|---|
| 编辑种族时，填了自定义字段会让本次改的字段被回滚 | `submitRaceForm` 连写两次 PUT，第二次用同一渲染周期捕获的旧 `meta` 做基底，而后端 PUT 是 `setattr` 整体替换 `meta` | `updateRace(nodeId, values, customFields?)` **合成一次写入** |
| 新建种族/支系的自定义字段被静默丢弃 | 新建后调 `updateRaceMeta`，而 `byId.get(新id)` 恒为 undefined → 直接 return | `createRace/createSubrace` 支持在创建 payload 里直接带 `customFields` |
| 「+ 添加能力」的自动 grants 永远不落库 | `createMember` 建完节点后调 `createStairEdge`，它对刚建节点 `byId.get` 恒失效 → `{ok:false}` 且返回值被丢弃 | `createStairEdge` 接受 `endpointKinds` 覆盖（目标 kind 用创建返回值）；失败按原因 toast，不再静默 |
| 新建/编辑体系的自定义字段同样丢失 | 与种族同源 | `createSystem`/`updateSystem` 接受 `customFields`，一次 PUT |
| 配置面板保存会抹掉未编辑的同级子键 | `mergeModuleConfig` 只做顶层浅合并，而对象键被按子键差分后提交 | `buildPatch` 的对象键改为「以**后端已存值**为底，叠加改动子键、删除显式移除的子键」，既保留同级子键又不固化前端默认值 |

### 12.2 功能/契约类（MAJOR）

- **入链统计错位**：`splitLinks` 只判 source，整个世界与实体无关的关联都被算进入链（计数自相矛盾、chip 渲染别人的关联、删除提示列出无关边）。现同时判对端（新增导出 `linkInvolves`），并同步冻结记录 `phase2_interface_freeze.md §7`。
- **grants 目标越界**：`systems.grants` 只允许指向 `ability`（`link_registry.py:613-623`），UI 却用 grants 挂规则/代价 → 修好自动 grants 后必然 400，且每次重试多一个孤儿节点。现在只对 ability 走自动关联，规则/代价只建节点并明确提示，`createStairEdge` 提前拦截非法目标。
- **图标解析是死代码**：`lucide-react@0.453` 的 5196 个导出里 5195 个是对象（`{$$typeof, render}`），三处 `typeof candidate === 'function'` 判断恒假 → 配置面板图标预览、节点样式图标、**纹章图标**全部静默回退。新增 `shared/lucideIcon.ts` 统一解析（函数或对象皆可）。
- **`normalizeTierRanks` 可能产出重复 rank**：`rank || (index+1)*step` 让 rank=0 被静默改写并与真实 rank 撞车（两个阶位同显示 r10）。改为「先算有效 rank，再在有效值上查重，有重复则整体重排」。
- **脱序语义**：`moveTier('up')` 明确表示「提高 rank」，与 `rankDirection` 显示顺序解耦；新增 `moveTierTo` 让拖拽按落点一次到位（原先只移动一位）；步进期间加锁避免连点在同一快照上重复写。
- **sketch 档泄漏**：阶梯连线与连线标签、节点详情的 赋予/前置/进阶/代价 行与成员字段在 sketch 全部隐藏。
- **典籍「代价」永远为空**：`systems.costs` 的合法目标是经济资源（体系外），体系内 cost 节点却拿 grants 边而被过滤掉。现在两条路径都收，详情页也把 grants→cost kind 归入「代价」，与阶梯/典籍口径一致。
- **血缘 parent_id 成环会让整个模块消失**：环内节点既非 root 也不可达 → 图鉴空、无法删除。现在按「父链可信（无环且深度 ≤2）」判定，不可信即提升为 root；第三层节点同款处理（树永不出现第三层）。
- 其余已修：虚拟滚动定位失效、配置面板与表单对「空字段集」理解不一致、删除自定义 kind 连字段定义一起删、保存失败是 unhandled rejection、虚拟化阶梯会翻视觉顺序与上下移语义、成员 kind 可在编辑态被改坏端点类型、血缘跨族边去重恒真且对称关联重复渲染、表单被后台 refetch 重置、双提交并发建模块、lucide 图标名带箭头字符触发 emoji 规则等。

### 12.3 明确未做（避免 oversell）

- 不新增后端表/路由（DoD 红线），因此阶梯调序仍是 N 次 PUT（无事务、无乐观回滚）。
- 测试仍**没有**覆盖：light/dark、键盘、aria、reduced-motion、头像懒加载、写路径（mutation）本身、`createStairEdge` 的重复边/环路**落库拦截**、切换视图保留滚动、代表人物区/支系区/幽灵占位、筛选空态。§7 对应条目标注为 `[~]` 或写明「未覆盖」。
- 地图模块未接入时 `races.inhabits/origin_at` 没有真实对端，居住地回退链路无端到端验证。

### 12.4 修复轮验证（2026-10-06）

| 项 | 命令 | 结果 |
|---|---|---|
| 类型 | `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | 0 error |
| Lint | `node node_modules/eslint/bin/eslint.js src/components/Worldbuilding src/services/worldbuildingApi.ts tests/worldbuilding --ext ts,tsx` | 0 error；5 warning 全部落在改动前的 EconomyView/HistoryView |
| 前端回归 | `node node_modules/@playwright/test/cli.js test` | 13 passed（export 1 + phase2 6 + phase3 6） |
| P3 浏览器侧 | phase3.spec「浏览器侧用例」 | 158 断言 0 失败 0 pageError，地板为精确值 158 |
| P2 浏览器侧 | phase2.spec「浏览器侧用例」 | 新增 5 条 `splitLinks/linkInvolves` 无关关联用例，地板同步升到 148 |
| 后端 | `python -m pytest tests/test_link_registry.py tests/test_worldbuilding_compat.py` | 30 passed |
| 后端边界 | P3 未新增/修改后端代码；`phase3.spec` 改为静态断言「只调用既有 `worldbuildingApi` 方法」，替换原先易碎的 `git diff <硬编码 SHA>` | 通过 |
