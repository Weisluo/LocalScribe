# Phase 2 前端地基与历史纵切实施计划

> 依据：cross_module_link_design.md、history_ui_design.md、worldbuilding_ui_design.md、worldview_configuration_system.md；公共约定：00_overview.md。
> 复用 P1 的 worlds / world_links 等结构，不新增表、不改旧路由；后端只新增 P2-T12 的关联归位端点；只写计划，不含代码。

---

## 1. 阶段目标与范围

**做**

- 前端地基：gen:types 类型、worldbuildingApi 增加 worlds/modules/links/linkTypes/counts、React Query hooks 与 queryKey 统一。
- 通用件：EntityPicker、LinkPanel、EntityBadge、ComplexitySwitcher 壳。
- 导航：统一 onNavigateToEntity(ref)，WorldbuildingView 维护返回栈与面包屑并恢复滚动、展开、选中项。
- 历史纵切：事件/时代接入 LinkPanel 与关联计数；行内引用 token；人物关联从 _char_ref/_char_link 切到 WorldLink 的 history.involves。
- 迁移容器收口：识别 `settings.migrationContainer` 世界，提供「重新归类」入口（单个/批量归位到目标世界、空容器删除），兑现 Phase 0 §8 风险 1。
- 回归保护：书卷、时间轴、动画、时间解析、内联编辑、独立时代保持现状。

**不做**

- 不重写 HistoryView 视觉交互；不替换 EraTimeline、EraSwitchContainer、动画配置、timeParser 与内联编辑。
- 不做政治/经济/种族/体系视图、世界脉络、世界设置、模块配置面板（P6）。
- 不新增契约第 4 节之外 link_type；不新增后端表；不删旧兼容层。
- 后端只新增 P2-T12 的关联归位端点（world_links router 扩展）；不改 /templates、/relations、/instances、/worldviews 旧路由的既有行为。
- 不手写与 OpenAPI 冲突的类型；地图与特殊界面不动。

## 2. 前置依赖与进入条件

| 依赖 | 必须已交付 | 用途 |
|------|-----------|------|
| P0 | D1 WorldLink 落库、D3 双读、D4 Character 唯一数据源、D7 API 拆分 | 写入路径与兼容窗口 |
| P1 | T1-T8 worlds/world_links 与 registry、links/counts API、回填脚本；T9 测试；T10 类型 | 全部读写与回归网 |

上游见 phase0_decisions_and_migration.md 与 phase1_data_foundation.md。

进入条件：links 与 counts API 可用且 registry 覆盖契约第 4 节；modules/submodules/items 返回 kind、meta、parent_id；gen:types 成功；历史旧数据已回填 history.involves，旧前缀按 P0 只读保留；React Query 5 基线不变。

迁移容器口径（P1 已实现，P2 直接消费）：

- 归属规则：一个项目下世界数不等于 1 时（0 个或 ≥2 个），旧关联的写入与回填落到 `World.settings.migrationContainer = true` 的容器世界（name = 关联迁移容器，id = `uuid5(6f1d0f6b-3c2a-4a9e-9c2f-0b7a5d4e8a11, "wbl-p1-05:container:<project_id>")`），见 `backend/app/services/link_service.py::resolve_project_world` 与 P1-MIG-05。
- 容器关联可用的上下文：`meta.projectId`、`meta.legacyRelationType`、`meta.strength`、`meta.legacySourceName`、`meta.legacyTargetName`（运行时旧接口写入与迁移回填均写入这些键）。
- 仍需归位的数据：只有 world 归属不确定的旧关联会进容器；`_char_ref/_char_link` 与经济 `relations` 条目按 item 所属模块精确落到具体世界，不产生容器数据。

## 3. 指导文档

- cross_module_link_design.md：§2.4-2.7、§3 history、§4.1/4.2/4.7、§5.1-5.5、§6。
- history_ui_design.md：§6、§12、§14-§18（配置项不改，仅保证不被新写入破坏）。
- worldbuilding_ui_design.md：§2.3-2.6、§4.1-4.3/4.6/4.7、§5、§7、§10.2-10.3（世界生命周期与列表）。
- worldview_configuration_system.md：§4.1-4.5、§5.2-5.4（只读消费）。
- 迁移容器归位：phase0_decisions_and_migration.md §8 风险 1、phase1_data_foundation.md §9.1 偏离 3、cross_module_link_design.md §2.5（删除与失效引用）。
- 00_overview.md §3-§9 与 AGENTS.md；冲突先改契约。

## 4. 现状与改动面

后端基本只读：worldbuilding / relations 旧路由在 P2 不改；只有 `backend/app/api/v1/world_links.py` 与 `backend/app/services/link_service.py` 为 P2-T12 新增归位能力（复用既有 registry 校验、对称边去重与计数）。relations 旧链路不再新增写入，P6 下线。

前端现状：

- worldbuildingApi（约 7.4KB）仅 templates/modules/submodules/items/instances/import-export，无 worlds/links/counts/hooks。
- WorldbuildingView（约 55.2KB）：七模块 tab 已含 races、systems 但无内容分支；onNavigateToCharacter 由 EditorPage 注入，跳角色即离开世界观页。
- HistoryView（约 32.3KB）直连 getSubmodules/getItems；CharacterReference.tsx 写 _char_ref: item；EventCard.tsx（约 29KB）写 _char_link:{itemId}:{charId}，动画与 forwardRef 集中于此。
- CharacterPickerModal 交互可保留、只换落库动作；types/api.ts 为 gen:types 输出；common/ 仅有 ToastContainer 与 CardCarousel。

改动清单：

- 修改：worldbuildingApi、types/api、WorldbuildingView、EditorPage（仅透传）、HistoryView 与 EventCard/CharacterReference/EraContentPanel/types、CharacterPickerModal。
- 新增：common/{EntityBadge,EntityPicker,LinkPanel,ComplexitySwitcher,InlineReference}/、Worldbuilding/hooks/*、Worldbuilding/MigrationContainerPanel/、navigation/backStack.ts。
- 后端（仅 P2-T12）：B/api/v1/world_links.py、B/services/link_service.py、backend/tests/test_worldbuilding_migration_links.py。
- 不改：EraTimeline、EraSwitchContainer、config、timeParser 与独立时代判定。

## 5. 任务分解表

路径前缀：S=services，C=components/common，W=components/Worldbuilding，T=tests/worldbuilding，B=backend/app（后端改动只限 P2-T12；后端测试直接写 backend/tests/ 路径）。

| Task ID | 任务 | 产出 | 上游 | 规模 |
|---------|------|------|------|------|
| P2-T1 | 类型与 API/hooks 地基 | S/worldbuildingApi.ts、types/api.ts、W/hooks/useWorldData.ts 等 | P1-T6/T7/T10 | M |
| P2-T2 | EntityRef 解析与徽章 | C/EntityBadge/、W/hooks/useEntityRefs.ts | P2-T1 | M |
| P2-T3 | 通用实体选择器 | C/EntityPicker/；模块→搜索/kind→类型→meta→批量 | P2-T2 | L |
| P2-T4 | 通用关联面板 | C/LinkPanel/；出/入链、reverseLabel、增删改、计数 | P2-T3 | L |
| P2-T5 | 复杂度切换壳 | C/ComplexitySwitcher/ 与上下文；三档披露不删数据 | P2-T1 | S |
| P2-T6 | 世界与模块接入 | W/WorldbuildingView.tsx；worlds/modules、tab 徽章、config、容器提示位 | P1-T7、P2-T1 | M |
| P2-T7 | 导航与返回栈 | W/WorldbuildingView.tsx、W/navigation/backStack.ts；面包屑、Esc、状态恢复 | P2-T2、P2-T6 | M |
| P2-T8 | 行内引用 | C/InlineReference/；token 渲染、@ 插入、预览、失效 chip | P2-T2、P2-T7 | M |
| P2-T9 | 历史人物关联切换 | CharacterReference、EventCard、CharacterPickerModal；改 history.involves | P2-T3、P2-T4 | L |
| P2-T10 | 历史关联计数与详情 | EventCard、EraContentPanel、HistoryView；徽章与 LinkPanel | P2-T4 | M |
| P2-T11 | 回归与验收 | T/phase2.spec.ts；历史回归、light/dark、a11y、白名单校验 | P2-T1 至 P2-T10 | M |
| P2-T12 | 关联归位后端支持 | B/api/v1/world_links.py（move 单条/批量）、B/services/link_service.py（端点推导世界、跨项目校验、meta 追加）、backend/tests/test_worldbuilding_migration_links.py | P1-T6 | S |
| P2-T13 | 迁移容器入口与归位面板 | W/MigrationContainerPanel/、W/hooks/useMigrationLinks.ts、W/WorldbuildingView.tsx、S/worldbuildingApi.ts、T/phase2.spec.ts | P2-T12、P2-T6、P2-T4 | M |

顺序：T1 → T2/T5/T6 → T3 → T4 → T7/T8/T9/T10 → T11；T12 可与 T3/T4 并行，T13 依赖 T12 与 T4，最迟在 T11 前完成。共用件接口冻结后 P3-P5 才可并行。

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

迁移容器归位（P2-T12/T13，除以下两项外不新增路由）：

- `POST /links/{link_id}/move`，body `{"world_id": 可选}`：把容器关联归位到目标世界。省略 world_id 时按端点所属世界推导（`source/target_id -> module_id -> world_id`）；目标世界必须与容器世界同项目（否则 400）；端点分属不同世界且未显式指定时 409；目标世界已有等价边时 409 并返回既有 link id；成功时 `world_id` 变更、`meta` 保留并追加 `reclassifiedFrom` / `reclassifiedAt`，response 为 WorldLinkResponse。
- `POST /worlds/{world_id}/links/move`，body `{"link_ids": [...], "target_world_id": 可选}`：单事务批量归位，返回 `{"moved": n, "conflicts": [...], "invalid": [...]}`；冲突项不阻塞其余项。
- 不新增 GET：容器识别用已加载的 `GET /worlds?project_id=` 过滤 `settings.migrationContainer`，容器内列表用 `GET /worlds/{id}/links`（支持 link_type/target_module 过滤），空容器删除复用 `DELETE /worlds/{id}`。
- 两个端点复用 link registry 校验与对称边去重，不接受契约外 link_type，不写旧表。

- MigrationContainerPanel：`worldId`（容器）、`projectId`、`onNavigate`、`onResolved`；按 `meta.legacyRelationType` / `meta.strength` 分组，行内展示 `legacySourceName/legacyTargetName` 与端点解析后的实体名、kind 徽章；目标世界选择默认「按端点自动归位」，支持单选与批量；冲突行给出「改用已有边并删除容器边」动作；归位后 `link_count` 归零时显示「删除空容器」。入口仅当项目存在 `settings.migrationContainer` 且容器 `link_count > 0` 时出现在 WorldbuildingView 头部与项目世界列表，不满足条件时不渲染。
- hooks/useMigrationLinks.ts：queryKey `['worldbuilding','migration-container', projectId]`，容器世界列表与容器 links 由同一 key 派生；移动成功后失效该 key、`['worldbuilding','links',*]`、`['worldbuilding','links','counts',*]` 与 worlds 列表，禁止逐卡请求。

## 7. 测试与验收清单

- [ ] gen:types、tsc、eslint 通过；hooks queryKey 与参数快照通过。
- [ ] EntityPicker 键盘流程与多选批量、EntityBadge 预览与失效态通过。
- [ ] LinkPanel 出/入链分组、reverseLabel、入链只读、失效清理通过。
- [ ] 行内引用 @ 插入、渲染、预览、跳转、清理通过。
- [ ] 返回栈面包屑、Esc 回退、滚动/展开/选中恢复；角色兼容 EditorPage。
- [ ] 人物关联增删/快速创建/多选全落 WorldLink，角色侧出现被涉及入链，旧前缀不再新写。
- [ ] 事件/时代计数与 /worlds/{id}/links/counts 一致且无逐卡请求。
- [ ] light/dark、键盘、aria、reduced-motion 通过；link_type 白名单通过。

迁移容器归位清单：

- [ ] 识别：只有项目存在 `settings.migrationContainer` 且容器 link_count > 0 时出现入口；普通世界不出现入口。
- [ ] 归位：单个与批量移动后 `world_id` 指向目标世界，`meta` 原键保留并追加 `reclassifiedFrom/reclassifiedAt`，容器与目标世界的 links/counts 同步刷新。
- [ ] 默认推导：省略 world_id 时按端点所属世界落位；端点分属不同世界且未显式指定返回 409 且不落库。
- [ ] 冲突与边界：目标世界已有等价边 409（可改用已有边）、跨项目 400、未知 link/world 404、契约外 link_type 400；失败项不影响批量中的其余项。
- [ ] 空容器：归位后容器 link_count = 0 时可删除容器世界，世界列表与项目切换器不再显示。
- [ ] 失效端点：端点已删除的容器关联按失效 chip 展示，不阻塞归位，并提供清理动作。
- [ ] 后端测试：backend/tests/test_worldbuilding_migration_links.py 覆盖以上分支；旧 /relations 与 /templates 行为不变。

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
- 容器归位：归位只改 `world_id`，不改端点与 link_type，因此可逆（把链接移回容器即可），无需数据快照；批量归位用单事务，冲突项只报告不落库；目标世界与容器必须同项目，跨项目拒绝，避免世界归属越界。
- 容器残留：P2 只保证「有空容器即可删除」；仍非空的容器不删除、不隐藏，留给 P6 清理任务处理（P6 需补一条容器收尾项，见 §10）。
- 失效端点：端点已删除的容器关联按失效 chip 展示、不阻塞归位；删除实体时的关联级联由实体删除路径（P2-T9/T10 与 P3-P5 模块）统一接 `LinkService.delete_links_for_entity`，不在 P2-T12 里另写清理逻辑。

## 9. 完成定义 DoD

满足 00_overview.md §5 通用 DoD：tsc/eslint/Playwright 通过；历史回归清单全绿；迁移容器归位清单全绿；四个共用件可被 P3-P5 直接引用；link_type 白名单通过；旧接口兼容窗口不变；无 emoji 且图标为 Lucide 名；冲突先改契约。P2-T1 至 P2-T13 验收勾选，共用件接口冻结记录版本。

## 10. 明确不在本阶段做的事

- 不重写书卷、时间轴、动画、时间解析、内联编辑、独立时代。
- 不做旧接口与旧表下线；不写回填脚本（P1 交付）。
- 不新增世界观预设内容或 AI 生成能力。
- 不做容器的自动合并策略：不自动猜测「哪个世界最合适」，默认只按端点所属世界推导，其余交给用户显式选择。
- 不删除仍有内容的容器世界，也不迁移历史/政治/经济内容数据；P6 需在其任务表中补一条「迁移容器与旧关联残留收尾」，负责删除/回收 Phase 2 之后仍非空的容器。

## 11. 承接 Phase 1 的遗留问题（P2 收口清单）

> 来源：Phase 1 交付后的代码审查（含 4 处已修复缺陷与 10 项回归用例）。§11.1 是必须在本阶段
> 收口的项，§11.2 是已知偏差/设计取舍（不要当缺陷改），§11.3 是 P6 前的技术债。

### 11.1 本阶段必须收口

| 编号 | 遗留项 | 落点与动作 | 归属 |
|---|---|---|---|
| L1 | 旧 `/templates` 写路径不补齐七模块 | `worldbuilding.py` 的 `create_world_template` 仍只建世界不建模块；**不能**在服务端补建——`WorldbuildingView.tsx` 的 `createTemplateMutation` 已经用 `TAB_ORDER.map(createModule)` 自己建齐七个，两端都建会得到 7 个重复 `module_type`。P2-T6 切到 `POST /worlds`（服务端已按 §2.2 补齐）后，必须同时删除前端手工建模块的代码，旧路径才允许下线 | P2-T6、P6 |
| L2 | `POST /links` 不校验端点实体是否存在 | **设计如此**：契约 §5 只要求校验 kind 匹配，§5.2 要求「目标不存在时渲染为失效 chip」。P2-T2/T4 必须实现失效态渲染与一键清理，**不要**在写入侧加存在性校验 | P2-T2、P2-T4 |
| L3 | `LinkTypeDefResponse.source/target` 用 `EntityRef(id="*")` 表达 kind 约束 | `schemas/relation.py` 的 `from_definition` 把 `(module, kind)` 塞进 `EntityRef` 并把 `id` 填 `"*"`。P2-T3 做 kind 过滤前需在 P2-T1 定口径：前端忽略 `id`，或改成专用 `LinkKindRef`（属 OpenAPI 变更，需同步契约并重跑 gen:types） | P2-T1、P2-T3 |
| L4 | `WorldImport.world` 复用响应模型 | `schemas/worldbuilding.py` 的 `WorldImport.world: WorldResponse` 使 `created_at/updated_at` 成为必填，手写或裁剪过的备份文件会 422。P2 若有「导入备份文件」入口，需在 P2-T1 定：拆出只含可写字段的导入 schema，或前端只回传完整导出文件 | P2-T1 |
| L5 | 既有字面量与本地类型不一致 | `CharacterCloudView.tsx` 的关系图例仍用 `'mentor'`，而 `types/character.ts` 已是 `master \| apprentice`；数组先拓宽为 `string[]` 再 `as RelationType[]`，tsc 静默通过，运行期该行 label/color 为 undefined。P2-T9 切换人物关联时顺带修掉 | P2-T9 |
| L6 | 列表查询放大 | 旧 `/templates` 与 `/templates/search` 现在全表加载后在 Python 侧过滤+分页（`worldbuilding.py`），`GET /worlds` 每个世界两次 count（`worlds.py`）。P2-T6 世界列表接 `/worlds` 时按 `project_id` 收敛并复用 `module_count/link_count`，不要逐卡请求 | P2-T6 |

### 11.2 已知偏差与设计取舍（勿当缺陷）

- 旧 `/templates` 系列、`/instances`、`/worldviews` 的响应字段与写接口语义保持 P1 结论；容器世界、旧关联归属、`meta` 记账键口径见 §1「迁移容器口径」与 P1 §9.1。
- 容器世界由 `resolve_project_world` 与 P1-MIG-05 创建，**已保证七个模块**（本次修复）；P2-T13 的「空容器才允许删除」规则不变。
- 旧 `/relations` 的 `batch_create_relations` 逐条提交、非全有全无（P1 §9.1 偏离 1），容器归位的批量语义由 P2-T12 自己定义单事务，不复用旧批量路径。

### 11.3 P6 前的技术债（不阻塞 P2）

- P1-MIG-05 在迁移内 `from app.services.link_registry import get_link_type` 做 kind 校验：冻结迁移的行为会随 registry 变化而变，若后续收紧契约，重跑旧迁移结果可能不同。P6 前应固化规则或记录 registry 版本。
- 迁移产物与 ORM metadata 存在索引漂移（`ix_worlds_project_id`、`ix_world_modules_world_id/world_type` 只在迁移里；`ix_*_id` 只在模型里），`alembic revision --autogenerate` 会误判 drop/create。P6 前对账一次并统一口径。
- `types/api.ts` 为纯 LF 而仓库 `core.autocrlf=true`，重复 gen:types 会产生 EOL 噪声；本次 3567 行改动大部分是补齐历史陈旧生成（含 4 个被删/改名的 schema 键与 `RelationType: mentor → master|apprentice`），建议 P2-T1 把它拆成独立 `chore(types)` 提交并在 PR 说明，避免与 Phase 2 的类型改动混淆。

### 11.4 本次修复后可依赖的保证（P2 直接消费）

- `POST /worlds/import`：先整体校验契约 §4（非法 link_type 整包 400、不产生半成品世界），父级后置的备份不丢 `parent_id`，对称边重复自动合并为一条，`directed` 由 registry 决定。
- `GET /worlds/{id}/links` 与 `/links/counts`：世界不存在返回 404。
- 旧 `/templates`、`/templates/search`：`is_public` / `is_system_template` 过滤与响应字段同为 `settings.legacyTemplate` 旧值（此前过滤恒不命中）。
- 迁移容器世界：运行时与 P1-MIG-05 都补齐七个模块。
- 回填：旧 `metadata_json` 不能覆盖 `meta` 记账键；非 history 目标的 `_char_ref` 降级为 `core.references` 并记 `meta.degradedFrom`，其余无法归类的键计入迁移报告。

验证命令（P2 开工前回归一次）：

```bash
cd backend && ./venv/Scripts/python.exe -m pytest -q            # 87 passed
cd backend && ./venv/Scripts/python.exe -m alembic heads        # 单一 head 8a5f26a774e3
```

已存在迁移容器世界的环境，如需应用本次 MIG-05 修正（幂等）：`alembic stamp cef4ae3ffe96 && alembic upgrade head`。