# Phase 2 前端地基与历史纵切实施计划

> 依据：cross_module_link_design.md、history_ui_design.md、worldbuilding_ui_design.md、worldview_configuration_system.md；公共约定：00_overview.md。
> 复用 P1 的 worlds / world_links 等结构，不新增表、不改后端路由；只写计划，不含代码。

---

## 1. 阶段目标与范围

**做**

- 前端地基：gen:types 类型、worldbuildingApi 增加 worlds/modules/links/linkTypes/counts、React Query hooks 与 queryKey 统一。
- 通用件：EntityPicker、LinkPanel、EntityBadge、ComplexitySwitcher 壳。
- 导航：统一 onNavigateToEntity(ref)，WorldbuildingView 维护返回栈与面包屑并恢复滚动、展开、选中项。
- 历史纵切：事件/时代接入 LinkPanel 与关联计数；行内引用 token；人物关联从 _char_ref/_char_link 切到 WorldLink 的 history.involves。
- 回归保护：书卷、时间轴、动画、时间解析、内联编辑、独立时代保持现状。

**不做**

- 不重写 HistoryView 视觉交互；不替换 EraTimeline、EraSwitchContainer、动画配置、timeParser 与内联编辑。
- 不做政治/经济/种族/体系视图、世界脉络、世界设置、模块配置面板（P6）。
- 不新增契约第 4 节之外 link_type；不新增后端表；不删旧兼容层。
- 不手写与 OpenAPI 冲突的类型；地图与特殊界面不动。

## 2. 前置依赖与进入条件

| 依赖 | 必须已交付 | 用途 |
|------|-----------|------|
| P0 | D1 WorldLink 落库、D3 双读、D4 Character 唯一数据源、D7 API 拆分 | 写入路径与兼容窗口 |
| P1 | T1-T8 worlds/world_links 与 registry、links/counts API、回填脚本；T9 测试；T10 类型 | 全部读写与回归网 |

上游见 phase0_decisions_and_migration.md 与 phase1_data_foundation.md。

进入条件：links 与 counts API 可用且 registry 覆盖契约第 4 节；modules/submodules/items 返回 kind、meta、parent_id；gen:types 成功；历史旧数据已回填 history.involves，旧前缀按 P0 只读保留；React Query 5 基线不变。

## 3. 指导文档

- cross_module_link_design.md：§2.4-2.7、§3 history、§4.1/4.2/4.7、§5.1-5.5、§6。
- history_ui_design.md：§6、§12、§14-§18（配置项不改，仅保证不被新写入破坏）。
- worldbuilding_ui_design.md：§2.3-2.6、§4.1-4.3/4.6/4.7、§5、§7。
- worldview_configuration_system.md：§4.1-4.5、§5.2-5.4（只读消费）。
- 00_overview.md §3-§9 与 AGENTS.md；冲突先改契约。

## 4. 现状与改动面

后端只读：models/schemas/api 的 worldbuilding 文件由 P1 扩展，P2 不改路由；relations 旧链路不再新增写入，P6 下线。

前端现状：

- worldbuildingApi（约 7.4KB）仅 templates/modules/submodules/items/instances/import-export，无 worlds/links/counts/hooks。
- WorldbuildingView（约 55.2KB）：七模块 tab 已含 races、systems 但无内容分支；onNavigateToCharacter 由 EditorPage 注入，跳角色即离开世界观页。
- HistoryView（约 32.3KB）直连 getSubmodules/getItems；CharacterReference.tsx 写 _char_ref: item；EventCard.tsx（约 29KB）写 _char_link:{itemId}:{charId}，动画与 forwardRef 集中于此。
- CharacterPickerModal 交互可保留、只换落库动作；types/api.ts 为 gen:types 输出；common/ 仅有 ToastContainer 与 CardCarousel。

改动清单：

- 修改：worldbuildingApi、types/api、WorldbuildingView、EditorPage（仅透传）、HistoryView 与 EventCard/CharacterReference/EraContentPanel/types、CharacterPickerModal。
- 新增：common/{EntityBadge,EntityPicker,LinkPanel,ComplexitySwitcher,InlineReference}/、Worldbuilding/hooks/*、navigation/backStack.ts。
- 不改：EraTimeline、EraSwitchContainer、config、timeParser 与独立时代判定。

## 5. 任务分解表

路径前缀：S=services，C=components/common，W=components/Worldbuilding，T=tests/worldbuilding。

| Task ID | 任务 | 产出 | 上游 | 规模 |
|---------|------|------|------|------|
| P2-T1 | 类型与 API/hooks 地基 | S/worldbuildingApi.ts、types/api.ts、W/hooks/useWorldData.ts 等 | P1-T6/T7/T10 | M |
| P2-T2 | EntityRef 解析与徽章 | C/EntityBadge/、W/hooks/useEntityRefs.ts | P2-T1 | M |
| P2-T3 | 通用实体选择器 | C/EntityPicker/；模块→搜索/kind→类型→meta→批量 | P2-T2 | L |
| P2-T4 | 通用关联面板 | C/LinkPanel/；出/入链、reverseLabel、增删改、计数 | P2-T3 | L |
| P2-T5 | 复杂度切换壳 | C/ComplexitySwitcher/ 与上下文；三档披露不删数据 | P2-T1 | S |
| P2-T6 | 世界与模块接入 | W/WorldbuildingView.tsx；worlds/modules、tab 徽章、config | P1-T7、P2-T1 | M |
| P2-T7 | 导航与返回栈 | W/WorldbuildingView.tsx、W/navigation/backStack.ts；面包屑、Esc、状态恢复 | P2-T2、P2-T6 | M |
| P2-T8 | 行内引用 | C/InlineReference/；token 渲染、@ 插入、预览、失效 chip | P2-T2、P2-T7 | M |
| P2-T9 | 历史人物关联切换 | CharacterReference、EventCard、CharacterPickerModal；改 history.involves | P2-T3、P2-T4 | L |
| P2-T10 | 历史关联计数与详情 | EventCard、EraContentPanel、HistoryView；徽章与 LinkPanel | P2-T4 | M |
| P2-T11 | 回归与验收 | T/phase2.spec.ts；历史回归、light/dark、a11y、白名单校验 | P2-T1 至 P2-T10 | M |

顺序：T1 → T2/T5/T6 → T3 → T4 → T7/T8/T9/T10 → T11；共用件接口冻结后 P3-P5 才可并行。

## 6. 数据 / API / 组件变更清单

API（以 P1 OpenAPI 为准，前端不自造路由）：

- 世界/模块/条目：GET/PUT /worlds/{id}、GET /worlds/{id}/modules、GET /modules/{id}/submodules、GET /modules/{id}/items 与现有 CRUD。
- 关联与计数：GET/POST /worlds/{id}/links（source/target/link_type/direction，支持批量）、PATCH/DELETE /links/{id}、GET /worlds/{id}/links/counts?scope=entity|module、GET /worldbuilding/link-registry，必须与契约 §4 一致。

类型与 hooks：types/api.ts re-export World、WorldModule、WorldSubmodule、WorldModuleItem、EntityRef、WorldLink、LinkTypeDef、LinkCounts、ComplexityLevel；queryKey 统一为 ['worldbuilding', 资源, 作用域]；mutation 只失效相关 key；计数批量，禁止逐卡请求。

共用件：

- EntityBadge：ref、size、showKind、onClick；样式取 registry；失效态。
- EntityPicker：worldId、source、presetModule、kindFilter、allowCreate、multi；模块→实体→类型→meta→保存；排除自身。
- LinkPanel：worldId、entity、complexity、onNavigate；出链可增删改，入链只读；行显示 reverseLabel、名称、kind 徽章、时间与备注。
- ComplexitySwitcher：value、onChange、capabilities；sketch 添加关联默认 core.related_to，可后改标签。
- InlineReference：token 只存 [[module:kind:id|显示名]]；chip 渲染、预览、导航、失效清理；不占关联类型、不计计数、不进世界脉络。

历史接入：CharacterReference 与 EventCard 停止新写 _char_ref/_char_link，人物条改读 history.involves 出链并保留原布局动画；CharacterPickerModal 保留交互，onSelect 输出角色由父组件批量建链；EventCard 与 EraContentPanel 接入 LinkPanel 与计数；HistoryView 透传 worldId 与 onNavigateToEntity；顺序与备注写 meta。

## 7. 测试与验收清单

- [ ] gen:types、tsc、eslint 通过；hooks queryKey 与参数快照通过。
- [ ] EntityPicker 键盘流程与多选批量、EntityBadge 预览与失效态通过。
- [ ] LinkPanel 出/入链分组、reverseLabel、入链只读、失效清理通过。
- [ ] 行内引用 @ 插入、渲染、预览、跳转、清理通过。
- [ ] 返回栈面包屑、Esc 回退、滚动/展开/选中恢复；角色兼容 EditorPage。
- [ ] 人物关联增删/快速创建/多选全落 WorldLink，角色侧出现被涉及入链，旧前缀不再新写。
- [ ] 事件/时代计数与 /worlds/{id}/links/counts 一致且无逐卡请求。
- [ ] light/dark、键盘、aria、reduced-motion 通过；link_type 白名单通过。

历史回归清单：

- [ ] 书卷展开、时代切换与 AnimatedCard 动画不回归。
- [ ] EraTimeline 刻度、悬浮提示、主题色与纹理不变。
- [ ] timeParser 中文纪年（元/年、数字、区间）行为与快照不变。
- [ ] 事件级别、类型、卡片微交互、forwardRef 与 popLayout 不变。
- [ ] 时代与事件描述的内联编辑行为不变。
- [ ] 独立时代展示与无 eraId 事件归属不变。
- [ ] 搜索、筛选、折叠展开、ConfigModal 读取路径不变。
- [ ] 双读窗口内旧 _char_ref/_char_link 只读展示且顺序不丢。

## 8. 风险、兼容与回滚

- 关系分叉：只写 world_links；旧 bidirectional_relations 不新增写入，双读只读，P6 下线。
- 人物顺序：回填用 meta.order；异常时保留旧键只读回退，不回写旧键。
- 世界重命名：按 P0 结论用 flag 切换 /worlds 与 /templates，P2 不删旧调用。
- 大文件拆分：新方法集中 worlds/links 分区，不重构 102KB 旧 API 文件。
- 导航栈：抽屉内与外部角色跳转共用 EntityRef 抽象，角色仍走 EditorPage 回调；恢复失败退化为默认列表态。
- 性能与回滚：入链懒加载、计数批量、搜索防抖；历史人物数据源可按模块回退，共用件为新增，旧字段保留。

## 9. 完成定义 DoD

满足 00_overview.md §5 通用 DoD：tsc/eslint/Playwright 通过；历史回归清单全绿；四个共用件可被 P3-P5 直接引用；link_type 白名单通过；旧接口兼容窗口不变；无 emoji 且图标为 Lucide 名；冲突先改契约。P2-T1 至 P2-T11 验收勾选，共用件接口冻结记录版本。

## 10. 明确不在本阶段做的事

- 不重写书卷、时间轴、动画、时间解析、内联编辑、独立时代。

- 不做旧接口与旧表下线；不写回填脚本（P1 交付）。
- 不新增世界观预设内容或 AI 生成能力。