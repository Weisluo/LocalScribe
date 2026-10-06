# Phase 1 数据地基：World 化与 WorldLink

> 实施计划文档，不写代码。结构、命名与 DoD 遵循 `00_overview.md`；全部关联语义以 `cross_module_link_design.md` §4 为准。
> 本阶段只做数据与服务端地基，UI 切换在 Phase 2。

## 1. 阶段目标与范围

做：worlds 化、World 模型、module.config、kind/meta 回填、world_links 建表、契约 §4 link registry、service/API、旧数据回填、pytest 夹具、类型生成。

不做：不改 WorldbuildingView / HistoryView / EconomyView 等 UI；不迁政治/经济内容；不删旧表；不新增世界观预设；不引入契约 §4 外 link_type。

## 2. 前置依赖与进入条件

- P0-T4 已通过，D1-D7 已采纳，P1-MIG-01..06 冻结；若 `alembic heads` 不是 `a8f3e9c2b1d4`，先对齐线性 head。
- Phase 0 上游产出：P0-T1 ADR 见 Phase 0 §5.1；P0-T2 迁移编号/兼容窗口/回滚见 §6、§8；P0-T3 盘点口径与对账基线见 §4 与 `phase0_inventory_report.md`；P0-T4 退出条件见 §9。
- 设计文档定稿；`AGENTS.md` 迁移规范可执行。

## 3. 指导文档

| 用途 | 来源 |
|---|---|
| 表、字段、EntityRef、索引、删除规则 | `cross_module_link_design` §2.1-2.7 |
| 模块语义与合法 kind/方向 | `cross_module_link_design` §3 |
| link_type 全量清单 | `cross_module_link_design` §4（54 条） |
| 旧到新映射 | `cross_module_link_design` §8 |
| 旧数据盘点、旧编码清单与回填对账基线 | Phase 0 §4；`phase0_inventory_report.md` §3-§7 |
| API 路由与迁移边界 | `worldbuilding_ui_design` §10.2、§10.3 |
| JSON 配置与 schema_version | `worldview_configuration_system` §7 |
| 数据库纪律 | `AGENTS.md` 迁移指南（batch_alter_table/幂等/线性 head） |

## 4. 现状与改动面（真实代码路径）

- 模型：`backend/app/models/worldbuilding.py` 仍是 WorldTemplate/world_templates，WorldModule.template_id 且无 config/kind/meta；`backend/app/models/relation.py` 是 BidirectionalRelation；`backend/app/models/project.py` 有 world_templates/world_instances/relations 关系；`backend/app/models/__init__.py` 待增删导出。
- Schema：`backend/app/schemas/worldbuilding.py` 是 WorldTemplate* 与七模块枚举；`backend/app/schemas/relation.py` 的 ModuleType 无 character、relation_type 为旧六枚举且无 WorldLink/EntityRef schema。
- Service/API：`backend/app/services/relation_service.py` 只按 WorldModuleItem 校验并写 bidirectional_relations；`backend/app/api/v1/worldbuilding.py`（2749 行）含 templates/modules/items/instances/worldviews；`backend/app/api/v1/relations.py` 有 8 个旧路由；`backend/app/api/v1/__init__.py` 注册前缀。
- 迁移与测试：head 为 `a8f3e9c2b1d4`，P1-MIG-01..06 见 Phase 0 §6.1；`backend/tests/conftest.py` 为空，无相关测试。
- 前端：`frontend/src/services/worldbuildingApi.ts` 无 worlds/links 方法；`frontend/src/types/api.ts` 待重生成；本阶段不做 UI。

## 5. 任务分解表

| Task ID | 任务与产出路径 | 上游 Task ID | 规模 | 序 |
|---|---|---|---|---|
| P1-T1 | worlds 化：migrations 01、models/worldbuilding.py、schemas/worldbuilding.py、models/project.py、models/__init__.py | P0-T4 | M | 1 |
| P1-T2 | module.config 与 kind/meta：migrations 02/04、models 与 schemas/worldbuilding.py、api/v1/worldbuilding.py | P1-T1 | M | 2 |
| P1-T3 | world_links 建表/升级与模型：migrations 03、models/relation.py、schemas/relation.py、models/__init__.py | P1-T1 | L | 3 |
| P1-T4 | link registry 全量：services/link_registry.py、schemas/relation.py | P1-T3 | M | 4 |
| P1-T5 | WorldLink service 与旧 service 兼容：services/link_service.py、services/relation_service.py | P1-T3,T4 | L | 5 |
| P1-T6 | links API：api/v1/world_links.py、api/v1/relations.py、api/v1/__init__.py | P1-T5 | M | 6 |
| P1-T7 | worlds API 与兼容转发：api/v1/worlds.py、api/v1/worldbuilding.py、api/v1/__init__.py | P1-T1,T2 | M | 7 |
| P1-T8 | 旧数据回填：migrations 05/06、services/relation_service.py；确定性 UUID 幂等 | P1-T3,T5,T7 | L | 8 |
| P1-T9 | pytest 夹具与测试：tests/conftest.py、tests/test_worldbuilding_*.py、tests/test_link_*.py | P1-T5..T8 | M | 9 |
| P1-T10 | 类型生成与 api client：frontend/src/types/api.ts、frontend/src/services/worldbuildingApi.ts | P1-T6,T7 | S | 10 |
| P1-T11 | 验收审计：勾选本文 §7/§9，PR 引用 P1-T1..T10 | P1-T1..T10 | S | 11 |

- migrations 01..06 指 backend/migrations/versions/ 下 Phase 0 §6.1 文件；其余省略 backend/app/ 或 backend/ 前缀，完整路径见 §4。

## 6. 数据 / API / 组件变更清单

### 6.1 数据表

| 对象 | 关键字段 | 约束与索引 |
|---|---|---|
| worlds | id、project_id、name、description、cover_image、tone/settings JSON、时间戳 | project_id 暂可空兼容旧库；旧字段进 settings.legacyTemplate；统计数查询计算 |
| world_modules | world_id、module_type、name、description、icon、order_index、config JSON、is_collapsible、时间戳 | 每 world 七个 module_type；重复值进回填报告，Phase 6 加唯一约束 |
| world_submodules | module_id、parent_id、kind、meta JSON、name/description/icon/color/order_index | kind 必有回填值；meta 存 legacyColor/legacyType/legacyLevel |
| world_links | id、world_id、source/target 各含 module/kind/id、link_type、directed、label、note、meta/time JSON、时间戳 | 三索引：(world_id,source_module,source_id)、(world_id,target_module,target_id)、(world_id,link_type)；删除由 service 级联 |

### 6.2 link registry（契约 §4 全量，54 条）

落在 backend/app/services/link_registry.py，每条含 id/label/reverseLabel/directed/icon/color/线型/源目标 kind。

- 通用 3：core.references、core.related_to、custom.link
- 历史 5：history.occurs_at、history.involves、history.causes、history.caused_by、history.milestone_of
- 政治 14：politics.controls_region、politics.capital_at、politics.member_of、politics.leads、politics.founded_by、politics.subordinate_to、politics.signatory_of、politics.includes_race、politics.ally_of、politics.at_war_with、politics.vassal_of、politics.trades_with、politics.marriage_tie、politics.succeeds
- 经济 12：economy.produces、economy.consumes、economy.requires、economy.traded_at、economy.flows_to、economy.currency_of、economy.owned_by、economy.regulated_by、economy.taxed_by、economy.located_in、economy.supplies、economy.era_context
- 种族 8：races.inhabits、races.origin_at、races.related_to、races.notable_figure、races.affinity_with、races.specialty、races.prefers、character.belongs_to_race
- 体系 9：systems.advances_to、systems.requires、systems.grants、systems.costs、systems.practiced_by、systems.enables、systems.countered_by、character.practices_system、character.attained
- 角色 3：character.appears_in、character.serves、character.owns

politics.treaty_between 已废弃不收录；kind 不匹配只放行 core.references、core.related_to、custom.link。

### 6.3 API

- worlds：`/worlds`（GET/POST）、`/worlds/{id}`（GET/PUT/DELETE）、`/worlds/{id}/export`、`/worlds/import`，前缀 /api/v1/worldbuilding。
- links：`/worlds/{id}/links`（GET/POST）、`/links/{id}`（GET/PATCH/DELETE）、`/worlds/{id}/links/counts`；辅助只读 `GET /worldbuilding/link-registry`。
- 兼容：`/templates` 转发 worlds；`/relations` 改为 world_links 适配层并标弃用；`/instances`、`/worldviews` 只读，写请求返回迁移指引。

### 6.4 组件与类型

前端只做 gen:types 生成 frontend/src/types/api.ts，并在 frontend/src/services/worldbuildingApi.ts 加 worlds/links 方法；旧方法保留到 Phase 6。

## 7. 测试与验收清单

- [x] P1-T1：迁移 01 空库/旧库 upgrade、downgrade、再 upgrade 幂等；World 含 settings/tone，旧字段进 settings.legacyTemplate。
  证据：migrations/versions/570767e6d582；tests/test_worldbuilding_migrations.py 7 例（含 downgrade 回旧结构并把 legacyTemplate 写回旧列）。
- [x] P1-T2：moduleConfig 与 color 前缀回填齐全，双读返回旧值与 kind/meta。
  证据：cef4ae3ffe96（moduleConfig -> config、color/icon -> kind/meta、每世界补齐七个模块）；旧 item 与 color 原值保留；tests/test_worldbuilding_backfill.py。
- [x] P1-T3：world_links 表、三索引、默认值符合契约，重复 upgrade 不报错。
  证据：d5a573ce6f22；migrations 测试断言三个索引与列集合。
- [x] P1-T4：registry 54 条与契约 §4 一致；history.era 可作为 occurs_at / involves / milestone_of 的源 kind 通过校验（history.event 亦可）；非法 kind 组合仅放行 core.references、core.related_to、custom.link。
  证据：app/services/link_registry.py；tests/test_link_registry.py 15 例（逐条比对契约文档字段）。
- [x] P1-T5：链接 CRUD、批量、按实体查询、计数均走 world_links，旧表无新增写入。
  证据：app/services/link_service.py、services/relation_service.py（适配层）；tests/test_relations_adapter.py 19 例断言 bidirectional_relations 行数为 0。
- [x] P1-T6：links 三主路由与 counts 的语义、404/409 正确；对称边只落一条。
  证据：app/api/v1/world_links.py；tests/test_worldbuilding_compat.py::test_world_links_crud_and_validation。
- [x] P1-T7：/worlds CRUD、export/import 可用；旧 /templates、/relations 兼容通过。
  证据：app/api/v1/worlds.py（CRUD+export/import）；compat 测试覆盖 /templates 全流程、/instances 与 /worldviews 的 410 指引、/relations 适配。
- [x] P1-T8：两类旧数据回填行数对账；重复执行不新增；孤儿与无法归类有报告，旧 item 不删。
  证据：2160f6984e8a/8a5f26a774e3；回填报告以 logger 输出计数（R3 孤儿 1 例）；重跑幂等测试。
- [x] P1-T9：SQLite/迁移/TestClient 夹具可复用；迁移、兼容、回填、registry、API 测试全绿。
  证据：tests/conftest.py（会话级 app 库 + legacy 旧库夹具）；pytest -q = 77 passed。
- [x] P1-T10：gen:types 后 tsc/build 通过；worldbuildingApi 有 worlds/links 方法且旧方法保留。
  证据：frontend/src/types/api.ts 由当前 OpenAPI 重新生成；worldbuildingApi.ts 新增 worlds/links 方法（类型取自生成的 components）；tsc --noEmit 与 vite build 通过。
- [x] 边界：无契约外 link_type、无世界观预设、无 UI/地图/特殊界面改动、无 emoji。
  证据：回填与 API 均经 registry 校验；未新增 UI 文件；`docs/worldbuilding/**/*.md` emoji 扫描 0 命中；地图与特殊模块端点未改动。

## 8. 风险、兼容与回滚

- 兼容窗口同 Phase 0 §8：/templates、/relations 适配层到 Phase 5-6；world_links 与 legacy 表 Phase 6 前不删；本阶段无 UI 切换。
- 风险：旧关联归属歧义（迁移容器世界）、对称边重复（去重）、kind 不匹配（回退通用类型）、character 缺失、SQLite 外键重建（batch_alter_table）。
- 回滚：逐迁移 downgrade + 上线前快照；只删新增 world_links；旧表与旧 item 只读保留。
- 本阶段实测：旧接口写接口（/instances、/worldviews）改为 410 指引；旧库 `world_templates` 在 downgrade 后完整恢复（含 tags/is_public/created_by 与 7 个模块中的原有 3 个）。

## 9. 完成定义 DoD

- [x] 六个迁移 upgrade/downgrade 幂等，head 线性。
  证据：570767e6d582 -> fa05a62b0da8 -> d5a573ce6f22 -> cef4ae3ffe96 -> 2160f6984e8a -> 8a5f26a774e3；`alembic heads` 单一 head；空库与旧库均 upgrade/downgrade/再 upgrade 通过。
- [x] registry 54 条落库；worlds/links API、新模型、旧数据回填可用。
  证据：/api/v1/worldbuilding/link-registry 返回 54 条；/worlds、/worlds/{id}/links、/links/{id} 实测可用（含 404/409/400 语义）；P1-MIG-04/05/06 回填经夹具旧库验证。
- [x] pytest 覆盖迁移、兼容、回填、registry、API；旧接口兼容通过。
  证据：`pytest -q` = 77 passed = 迁移 7 + 回填 9 + 兼容/API 9 + registry 15 + relations 适配 19 + 既有导出/PDF 18。
- [x] 后端 black/isort/flake8/mypy 与前端 gen:types/tsc/build 通过。
  证据：black/isort 对全部 Phase 1 触碰文件通过（含顺带修正的 models/project.py、models/__init__.py 格式）；flake8 对新增文件 0 违规，遗留文件只剩基线项（worldbuilding.py 9 处 E501、models/__init__.py 8 项、project.py 3 处既有 F821 Folder/Note/WorldInstance，基线分别为 9/10/14 项，无新增）；mypy 由基线 109 errors / 11 files 降至 102 errors / 11 files，Phase 1 新增与改动文件 0 error；前端 `tsc --noEmit`、eslint（0 error，11 项既有 warning）、`vite build` 通过。
  说明：仓库既有导出回归套件（Playwright `npm test`，依赖本机 Edge 与独立 dev server）本阶段未执行，Phase 1 未改动导出/PDF 代码路径。
- [x] 无契约外 link_type、无世界观预设、无 emoji；地图与特殊界面未动。
  证据：所有写入路径经 `validate_link_type`；未新增预设或 UI；前端仅生成类型与 API 客户端。

## 9.1 执行记录（P1-T11 审计）

| 项 | 结果 |
|---|---|
| 迁移文件 | `570767e6d582`(01 worlds rename)、`fa05a62b0da8`(02 config/kind/meta)、`d5a573ce6f22`(03 world_links)、`cef4ae3ffe96`(04 backfill modules)、`2160f6984e8a`(05 backfill links)、`8a5f26a774e3`(06 backfill char refs) |
| 后端新增/改动 | models/worldbuilding.py、models/relation.py、models/project.py、models/__init__.py、schemas/worldbuilding.py、schemas/relation.py、services/link_registry.py、services/link_service.py、services/relation_service.py、api/v1/worlds.py、api/v1/world_links.py、api/v1/worldbuilding.py、api/v1/__init__.py |
| 测试 | tests/conftest.py、test_worldbuilding_migrations.py(7)、test_worldbuilding_backfill.py(9)、test_worldbuilding_compat.py(9)、test_link_registry.py(15)、test_relations_adapter.py(19)；`pytest -q` = 77 passed |
| 前端 | frontend/src/types/api.ts（gen:types 重生成）、frontend/src/services/worldbuildingApi.ts（worlds/links 方法） |
| 开发库落地 | `backend/data/local_scribe.db` 已升级到 head `8a5f26a774e3`；迁移前快照在仓库外（`%TEMP%\p1\local_scribe_pre_phase1.db`）；回填报告：kind 3、meta 3、其余 0 |
| 线上实测 | 运行中的后端（:8000，--reload）读接口回执：`/worlds` 200、`/templates` 200、`/templates/{id}` 200、`/worlds/{id}` 200（7 模块）、`/worlds/{id}/links` 200、`/worlds/{id}/links/counts` 200、`/link-registry` 200、`/templates/{id}/export` 200 |
| 未做/推迟 | 前端 UI 切换、政治/经济内容迁移、legacy 表删除、世界脉络图、自定义 link type 编辑（Phase 2-6） |

已知偏离（需在 Phase 2 前知悉）：

1. 旧 `/relations` 适配层返回 `RelationResponse`（不再返回旧 ORM 对象）；`batch_create_relations` 改为逐条提交，原子性为尽力而为。
2. `bidirectional=True` 的旧关联统一落 `core.related_to`（与 P1-MIG-05 一致），具体旧类型保留在 `meta.legacyRelationType`。
3. 迁移容器世界：一个项目下多于一个世界时，旧关联写入/回填到 `settings.migrationContainer=true` 的容器世界，Phase 2 需提供重新归类入口。
4. `scripts`/`docs` 未记录回填脚本；回填口径以 `phase0_inventory_report.md` §5 与本文 §7 为准。
5. 旧 `/templates` 写路径（`create_world_template`）不补齐七个模块：前端 `WorldbuildingView` 创建模板后自行
   建齐七个模块，服务端补建会产生 7 个重复 `module_type`，故七模块不变式只在 `/worlds`、迁移与回填路径成立。
   收口方案见 `phase2_frontend_history.md` §11.1 L1。

## 10. 明确不在本阶段做的事

不切换前端 UI；不迁移政治/历史/经济内容数据；不删除 legacy 表与旧 item；不做世界脉络图、搜索、备份格式升级；不做自定义 link type 编辑界面。




