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

- [ ] 两 tab 可切换、模块缺失自动创建并进入空态；两模块 3 分钟路径走通。
- [ ] 图鉴网格响应式，卡片含 kind/状态/计数；详情字段顺序、幽灵占位、头像行正确。
- [ ] 血缘树 parent_id 实线、related_to 双线/虚线、对称单条、第三层不出现；>80 节点降级、sketch 不加载布局。
- [ ] 阶梯按 meta.rank 排序、多行录入、拖拽调序、重复 rank 归一化；节点 grants/costs chips 与复用标记正确。
- [ ] 典籍按 rank 一卷一卡、切换保留选中与滚动；advances_to/requires 环路检测并阻止，重复边合并。
- [ ] kind/meta/customFields 读写无损、未知 meta 保留、删除字段或类型提示影响；自定义 kind 的 parentKind 与 races<=2、systems<=3 校验生效。
- [ ] LinkPanel 双向可查、reverseLabel 正确、入链不可删、失效可清理、计数批量；空态覆盖模块空、筛选无结果、局部空与 LinkPanel 空。
- [ ] 虚拟滚动与视口裁剪、头像懒加载、light/dark、键盘、aria、reduced-motion 通过。
- [ ] tsc/eslint/Playwright 通过；link_type 白名单通过；新建世界两个模块为空。

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