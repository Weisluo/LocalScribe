# Phase 6 · 全局配置与收尾 实施计划

> 上游计划：phase5_economy.md（Phase 5 DoD 通过后进入）。设计依据：worldbuilding_ui_design.md §2/§3/§4/§10；worldview_configuration_system.md 全文；cross_module_link_design.md §5/§6/§8；00_overview.md §3-§6、§8、§10。
> 只写实施计划，不写代码；设计冲突先改契约，再同步本 plan。

---

## 1. 阶段目标与范围

做：世界列表 / 切换 / 空白创建、世界设置（基础、外观、术语、历法、默认复杂度、默认模块）、备份与恢复；子模块管理器、自定义字段编辑器、模块配置面板；全局搜索、返回栈与面包屑、世界脉络（含 800 节点降级）；emoji 与默认图标清理、Lucide 统一；旧接口 / 旧模型 / 旧表退场、最终迁移与 schema_version、发布检查清单。

不做：不新增模块业务能力；不改地图与特殊界面；不做协作、权限、分享、模板与配置市场、版本历史、回收站、AI 生成；不新增契约第 4 节之外的 link_type；不删除用户世界数据，只删被替代的系统旧表与旧接口。

---

## 2. 前置依赖与进入条件

上游：P0 的 D1（world_links 取代旧关系表）、D2（WorldTemplate 到 World）、D5（旧实例 / 旧世界观迁移与删表）、D7（worlds / links 独立 router）定论；P1 数据地基与 links、导出导入、schema_version；P2 容器、onNavigateToEntity、EntityPicker、LinkPanel、ComplexitySwitcher；P3-P5 五模块走新 API 与 LinkPanel，经济旧组件停写。

进入条件（全部满足才开工）：

- [ ] Phase 5 DoD 通过，经济旧组件不再写入。
- [ ] 前端不存在 /templates、/instances、/worldviews 调用。
- [ ] 导出导入完成一次真实数据演练。
- [ ] 关系写入只剩 world_links，bidirectional_relations 已停写。

---

## 3. 指导文档（精确到章节）

| 文档 | 章节 | 用途 |
|---|---|---|
| worldbuilding_ui_design.md | §2.1-§2.6、§3.1-§3.6 | 信息架构、全局搜索与跨模块导航、世界生命周期 |
| 同上 | §4.1-§4.7、§10.1-§10.4 | 子模块 / 字段 / 模块配置框架、前端与 API 结构、迁移边界 |
| worldview_configuration_system.md | 二至七 | 配置层级、世界级与模块级配置、界面与校验、存储备份 |
| cross_module_link_design.md | §5、§6、§8 | LinkPanel 与世界脉络、无 emoji 与 Lucide 规范、旧到新迁移映射 |
| 00_overview.md / AGENTS.md | §3-§6、§8、§10 / 工程纪律 | 命名、10 节模板、DoD、风险、D1-D7；迁移幂等与 lint |

---

## 4. 现状与改动面（真实代码路径）

| 路径 | 本阶段改动 |
|---|---|
| backend/app/models/worldbuilding.py | 删除 WorldTemplate、WorldInstance、CustomWorldviewConfig 与 template_id 残留，保留 World、WorldModule、WorldSubmodule、WorldModuleItem |
| backend/app/api/v1/worldbuilding.py | 删除 templates / instances / worldviews 旧路由与兼容转发；新资源已按 D7 拆至 worlds / links router |
| backend/app/schemas/worldbuilding.py | 删旧模板 / 实例 / 世界观 schema；导出导入增加 schema_version |
| backend/app/models/relation.py、services/relation_service.py、api/v1/relations.py | 按 D1 停写 bidirectional_relations，world_links 成为唯一关系来源，T11 删表 |
| backend/migrations/versions/ | 新增线性迁移删除旧表，不改已发布迁移，配校验脚本 |
| frontend/src/components/Worldbuilding/WorldbuildingView.tsx | 接入世界切换、设置 / 搜索 / 世界脉络入口、返回栈与面包屑、详情抽屉 |
| frontend/src/components/Worldbuilding/WorldSettingsPanel.tsx | 基础 / 外观 / 术语 / 历法 / 模块 / 备份六页 |
| frontend/src/components/Worldbuilding/config/（P6 专用配置组件，区别于 P2 的 components/common/ 跨模块通用件） | SubmoduleManager、FieldSchemaEditor、ModuleConfigPanel、GlobalSearch、WorldWeb |
| frontend/src/services/worldbuildingApi.ts | 删旧方法，接 worlds、links、export / import、search |
| frontend/src/components/Worldbuilding/HistoryView/modals/ConfigModal.tsx、frontend/src/components/Worldbuilding/EconomyView/modals/ConfigModal.tsx 与各模块 config / 空状态 | 收敛为 ModuleConfigPanel 入口；图标统一 Lucide kebab-case，无 emoji；旧弹窗 T9 后删除 |

---

## 5. 任务分解表

> 产出路径前缀：前端省略 frontend/src/components/Worldbuilding/，后端省略 backend/app/，完整路径见 §4。

| Task ID | 任务 | 产出 | 上游依赖 | 规模 | 顺序 |
|---|---|---|---|---|---|
| P6-T1 | 世界列表 / 切换 / 空白创建 + 世界设置面板 | WorldbuildingView.tsx、WorldSettingsPanel.tsx | P1 worlds API、P2 容器 | M | 1 |
| P6-T2 | 备份与恢复（导出、校验、两种恢复模式、导入报告） | WorldSettingsPanel 备份页、services/worldbuildingApi.ts | P6-T1、P1 export / import | M | 2 |
| P6-T3 | 子模块管理器（CRUD、拖拽、层级、kind、图标、颜色、删除影响） | common/SubmoduleManager.tsx | P1 submodule API、P2 通用件 | M | 2 |
| P6-T4 | 自定义字段编辑器（类型、属性、复杂度可见性、归档恢复） | common/FieldSchemaEditor.tsx | P6-T3 | M | 3 |
| P6-T5 | 模块配置面板（类型、等级、状态、关联类型、展示、术语） | common/ModuleConfigPanel.tsx | P6-T3、T4、P5 | L | 4 |
| P6-T6 | 全局搜索（Ctrl/Cmd + K、限定符、最近记录、跳详情） | common/GlobalSearch.tsx、services/worldbuildingApi.ts | P1 / P2、P6-T1 | M | 4 |
| P6-T7 | 跨模块返回栈与面包屑 | WorldbuildingView.tsx | P2 onNavigateToEntity | S | 3 |
| P6-T8 | 世界脉络只读图 + 800 节点降级 | common/WorldWeb.tsx | P6-T7、P1 links counts API | M | 5 |
| P6-T9 | emoji 与默认图标清理、Lucide 统一 | 两处 ConfigModal、各模块 config、空状态 | P3-P5、P6-T5 | M | 5 |
| P6-T10 | 旧接口 / 旧模型 / 旧表退场（冻结到删除） | 后端 models / api / schemas、services/worldbuildingApi.ts、新迁移 | 全模块切换、D1 / D2 / D5 / D7 | L | 6 |
| P6-T11 | 最终迁移与数据校验、schema_version | migrations/versions/、校验报告 | P6-T10 | M | 7 |
| P6-T12 | 设计文档一致性 + 发布检查清单 | 本 plan 勾选、契约 §8 对照记录 | P6-T1 至 P6-T11 | S | 8 |

说明：T9 依赖 T5，T10 最后启动。

---

## 6. 数据 / API / 组件变更清单

数据：World.settings 存 palette、accent、texture、radius、terminology、calendar、complexity、defaultModule；WorldModule.config 存 entityTypes、levels、statuses、fieldSchema、linkTypes、terminology、displayMode、defaultComplexity、palette；导出 JSON 增加 schema_version，导入按版本迁移且未知字段保留；T11 删除 world_templates、world_instances、worldview_configs，bidirectional_relations 按 D1 在 T10 停写、T11 删除；旧 emoji 图标映射为 Lucide，无法映射回退 `shapes`。

API：保留 /worlds、/worlds/{world_id}、/worlds/{world_id}/modules、/modules/{module_id}/submodules、/items/{item_id}、/worlds/{world_id}/links、/worlds/{world_id}/links/counts、/worlds/{world_id}/export、/worlds/import；兼容窗口内 /templates、/instances、/worldviews 只读，写请求 410，窗口结束删除；搜索 MVP 客户端过滤，超 5000 实体再评估后端搜索；OpenAPI 变更后执行 npm run gen:types。

组件：WorldbuildingView.tsx 承担头部、世界切换、设置 / 搜索 / 世界脉络入口、返回栈与面包屑、详情抽屉；Worldbuilding/config/ 新增 SubmoduleManager、FieldSchemaEditor、ModuleConfigPanel、GlobalSearch、WorldWeb，复用 EntityPicker、LinkPanel、ComplexitySwitcher；旧 ConfigModal 收敛后删除；跳转统一 onNavigateToEntity(EntityRef)，不新增契约外 link_type。

---

## 7. 测试与验收清单（可勾选）

后端：

- [x] worlds CRUD / 切换 / 删除；导出导入往返、id 映射与失效引用报告正确。
  （`tests/test_p6_contract_smoke.py` 7 例 + `tests/test_worldbuilding_compat.py` 往返用例；
  `WorldImportReport` 断言 id_map 重映射、`dangling_refs`、`unknown_link_types` 回落、409/400 门禁、
  覆盖模式下「旧内容清空 + 新 id 空间重建」、`keep_dangling=false` 丢弃失效关联。）
- [x] 兼容窗口旧接口只读、写 410，下架后 404；grep 无旧模型与旧路由残留。
  （窗口在 Phase 2 已收紧为写 410；Phase 6 直接下架 → 全部 404；`tests/test_worldbuilding_cleanup.py`
  对 `backend/app` 与 `frontend/src` 硬断言 0 命中，`backend/migrations/versions` 除外。）
- [x] 迁移 upgrade / downgrade 幂等、旧表无外键残留；迁移前后实体与关联数对账。
  （`tests/test_worldbuilding_cleanup.py`：head 唯一 = `74bd4aa85478`、空库与旧库 `PRAGMA foreign_key_check` 干净、
  旧库升级前后 6 张表行数逐表一致、重复 upgrade 与 downgrade 一步再 upgrade 幂等；Lead 另用一次性脚本在临时库实测
  「旧库 → head → downgrade -1 → head」往返，旧表在 head 消失、downgrade 后空表重建、user 数据保留。）
- [ ] `schema_version` 正确：已随导出写入并在导入侧做版本门禁（见 §9.1），但**未**做「抽样 10 个世界」的批量核对
  （本机开发库只有 1 个世界，批量核对无数据基础）。

前端：

- [x] 世界列表 / 切换 / 空白创建 / 世界设置 / 备份恢复可用。
  （`tests/worldbuilding/phase6.spec.ts` 浏览器侧 173 条断言覆盖世界列表排序、切换、空白创建载荷、
  设置归一/合并、备份文件名/版本校验/导入载荷/报告摘要、搜索索引与限定符、返回栈快照。
  **暗色模式未逐屏截图核对**，只做了 token 级断言，与 P5 §7.2 同口径。）
- [x] 子模块管理器、字段编辑器、模块配置面板与术语替换可用；搜索限定符、返回栈状态恢复、
  世界脉络 800 节点降级到模块矩阵 + 推荐关联且只读。
  （`phase6b.spec.ts` 153 条断言 + `phase6w.spec.ts` 63 条断言；世界脉络含 800/801 边界、
  只读守卫（不出现任何写关联 API）、降级矩阵与推荐关联；返回栈的滚动恢复仅覆盖通用 `ModuleSection` 分支，
  见 §7.2。）
- [x] tsc 与 eslint 通过，无 emoji，图标全为 Lucide kebab-case。
  （`tsc --noEmit` 0 error；`eslint src --ext ts,tsx` 0 error / 29 warning，均为仓库既有类别；
  世界观范围内 `WorldbuildingView` / `WorldSettingsPanel` / `config/**` / `hooks/**` emoji 扫描 0 命中。）

文档与发布：

- [x] 契约 §8 映射核对；发布检查清单归档；schema_version 写入发布说明。
  （见 §9.1 与 §11；契约 §8 的 10 行映射逐条对应到本阶段的删除/保留口径。）

### 7.1 验收实测（原始命令与结果）

环境：本机 Windows，`backend\venv\Scripts\python.exe`，前端 `node` 经 `fnm exec --using default`。

| 命令 | 结果 |
|---|---|
| `cd backend; .\venv\Scripts\python.exe -m pytest -q` | **248 passed**（基线 213 passed；复审修复后新增 2 例：模块/子模块计数、清空世界内容） |
| `cd backend; .\venv\Scripts\python.exe -m alembic heads` | `74bd4aa85478 (head)`，唯一 head |
| `cd backend; .\venv\Scripts\python.exe -m flake8 <本阶段改动文件> tests` | 21 条，逐条与 HEAD 对照**全部为既有问题**（`models/__init__.py` 的 F401/E402、`models/project.py` 的 F821 字符串注解、`schemas/__init__.py` 的 F401 重导出），P6 未新增 |
| `cd frontend; node node_modules\typescript\bin\tsc --noEmit` | **0 error** |
| `cd frontend; node node_modules\eslint\bin\eslint.js src --ext ts,tsx` | **0 error / 29 warning**（`react-refresh/only-export-components`、`no-explicit-any` 等既有类别） |
| `cd frontend; node node_modules\vite\bin\vite.js build` | `✓ built in 1.18s` |
| `cd frontend; node node_modules\@playwright\test\cli.js test` | **40 passed**（export 2 + worldbuilding 38：phase2 6 / phase3 6 / phase4 8 / phase5 8 / phase6 5 / phase6b 3 / phase6w 3 …） |
| 一次性脚本：临时库「旧库 → head → downgrade -1 → head」 | 旧表在 head 消失（`world_instances` / `worldview_configs` / `bidirectional_relations`）、`PRAGMA foreign_key_check` 为空、downgrade 后三张空表重建**且写入探针可用**（见 §12.1）、`worlds` 数据保留、再 upgrade 幂等 |
| 静态守卫（`tests/test_worldbuilding_cleanup.py`） | 旧标识清单含 `world_templates`，对 `backend/app` 与 `frontend/src` 硬断言 0 命中；扫描集合非空断言 + `assert not hits`（不再是「空 == 空」恒真） |
| OpenAPI 重生成 | `frontend/src/types/api.ts` 由 `app.openapi()` 离线重生成（`openapi-typescript` 7.13），`WorldTone` 带 `[key: string]: unknown`，无旧路径 / 旧模型名 |


已知与本阶段无关的偶发失败：`tests/test_pdf_export.py` 的两条真打印用例依赖本机 Edge/Chrome 的 `printToPDF`，
全量并发跑时偶发 `Printing is not available`，**单跑 3 passed**，全量重跑亦通过。该抖动在 P5 §7.2 已登记，
P6 未触碰任何 PDF 代码。

### 7.2 明确未实现 / 偏差登记

1. **T7 未做满**：面包屑任意级跳转、返回时恢复滚动/展开/高亮、失效引用条（查看来源 / 清理引用）已完成；
   但**没有新增全局详情抽屉**——本仓库架构是各模块自带抽屉，容器通过 `highlightRef` 驱动，
   「抽屉内跳转不关闭抽屉」的语义成立但缺端到端浏览器断言。滚动恢复只在通用 `ModuleSection` 分支挂了
   `contentScrollRef`（P2 遗留形态），races / systems / politics / economy / history 分支的滚动位置未接管。
2. **世界列表不显示每个世界的实体数**：`GET /worlds` 只返回 `module_count` / `link_count`，
   因此切换器里只有当前世界显示真实实体数，其余行显示「N 模块 · M 关联」（与 ui_design §2.1 头部口径一致）。
   要每行显示实体数需给列表接口加字段或 N+1 请求，本阶段未擅自扩面。
3. **未知 `kind` 不降级**：应用计划 §6 的「未知 kind 降级为 custom」时发现与
   `worldbuilding_ui_design` §3.4「恢复时保留 kind」冲突；`kind` 是开放词表（契约 §2.4/§2.7 由用户维护），
   降级会毁数据。最终口径：**未注册的 `link_type` 回落 `core.related_to` 并报告（闭合注册表），
   `kind` 只报告不改写**，`unknown_kinds` 里列出「既未在 `config.entityTypes` 声明、也不在契约 §4 词表」的项。
   复审修复：恢复报告文案已改为「未做降级（按原值保留）」，此前写的「已降级为 custom」与后端行为相反（§12.1）。
4. **世界脉络时间范围筛选按锚点近似**：取字符串里第一个整数比较（与 P5 的 `anchorOf` 同口径），
   无锚点不猜、该边被过滤；不是完整历法解析。
5. **`entity_count` 未加入 `GET /worlds`**（同第 2 条）。
6. **旧发布迁移里冻结的模块默认图标名**（`history=scroll-text` / `politics=crown` / `systems=sparkles` /
   `special=star`）与 `worldbuilding_ui_design` §2.3 建议表（history / landmark / git-branch / sparkles）不同。
   两者都是合法 Lucide 名，且 `DEFAULT_MODULE_SPECS` 已被 P1 迁移冻结，本轮**未改**以避免与迁移历史分叉。
7. **`HistoryView/TimelineTooltip.tsx` 的 `→`**（排版连接符）保留。它不是 emoji；
   世界观范围内其余 emoji 已清零。`frontend/src` 里 Worldbuilding 之外的既有 emoji
   （AIChat / Editor / Outline / export utils）不在本阶段范围。
8. **`docs/cross_module_reference_system.md`** 仍含旧 `bidirectional_relations` / `worldview_configs` DDL。
   它是被取代的旧设计文档，P6 未改（本阶段设计文档改动集中在契约与 implementation/）。
9. **`World.settings.legacyTemplate` 只读访问器保留**：`tags` / `created_by` / `is_public` /
   `is_system_template` 只读 `settings` JSON（P1 降级数据仍在库、D2 回滚口径依赖），已无 API 暴露；
   `WorldTemplate` 别名、`WorldInstance`、`CustomWorldviewConfig`、`BidirectionalRelation` 全部删除。
10. **`DELETE /modules/{module_id}` 与 `POST /batch/*` 删除后**，前者因同路径仍需承载 `PUT` 而返回 405
    （非 404），后者 404；两者都确认过零调用者。复审修复：测试改为按 405 精确断言（此前 `in (404, 405)`）。
11. **组件目录口径**：P6 配置组件落在 `Worldbuilding/config/`（§4 的路径），
   而不是 §5 表格里简写的 `common/`；P2 的跨模块通用件仍在 `components/common/`。
12. **P5 交接的 feature flag 与旧经济视图已删除**，`EconomyViewV2/` 已改名为 `EconomyView/`
   并去掉导出名里的 V2 后缀；`economy_service.py` 的 legacy 读取侧投影（`project_legacy_*`、
   旧 color 前缀解析、emoji 图标表、`moduleConfig` / `relations` / `customFields` 旧条目分支）一并删除。
    唯一保留的旧色处理是「`type:` 前缀不作为颜色返回」的展示过滤（删掉会把旧串当颜色吐给前端）。
13. **本阶段不新增世界观预设**，地图与特殊界面未动。
14. **必填阻断只覆盖有三处显式提交的实体表单**（races / systems / politics）：`field.required` 在
    `CustomFieldRenderer` 里表现为 `*` 标记 + 缺失提示，并在上述三个 modal 的 `handleSubmit` 里用
    `missingRequiredFields` 阻断；经济模块的检查器是**改即写**（没有提交动作），那里只能提示不能阻断。
15. **`keep_dangling` 文案由调用方传参决定**：后端在 `keep_dangling=false` 时仍把解析不到的端点列进
    `dangling_refs`（只是不建这条关联），所以两处恢复入口都显式传 `{ keepDangling }` 给
    `summarizeImportReport`，否则会把「已丢弃」误报成「已保留」。
16. **对象键增量保存依赖调用方传 `rawConfig`**：世界设置 + races / systems / politics 四个入口现在都传
    后端原始 config；漏传时补丁只带改动子键，浅合并会抹掉同级的未编辑子键（`fieldSchema` /
    `terminology` / `nodeStyles`）。该隐患 P3 起就存在，P6 复审一并收口。
17. **`visibleComplexity` 通过 ComplexitySwitcher 上下文生效**：不传 `complexity` prop 时读世界容器的档位；
    无 Provider（SSR / 单测）退化为速写档，因此沙盘专属字段在无 Provider 环境下不渲染。

---

## 8. 风险、兼容与回滚

- 删表不可逆：T11 前导出全量世界备份并保留数据库副本；回滚只能从备份恢复，downgrade 仅重建空表。
- 兼容窗口：旧 API 只读保留一个发布周期，以窗口内旧 API 调用为 0 作为下线门槛；/templates 写请求在 P2 完成后关闭，读转发保留至 T11。发现漏迁可继续回填，不提前删表。
- 关系与顺序：严禁同时写 bidirectional_relations 与 world_links，D1 未拍板不启动 T10；先前端 API 清理、后删后端路由，避免 gen:types 编译失败。
- 性能与基线：世界脉络超 800 节点自动降级且不可编辑；术语冲突模块级优先且不改 id；开工前先补冒烟测试再执行 T10/T11。

---

## 9. 完成定义 DoD

- 00_overview §5 通用 DoD 全部满足；P6-T1 至 P6-T12 完成并勾选。
- 旧接口 / 模型 / 表退场，grep 干净，world_links 唯一关系来源；空白创建到备份恢复全链路可重复。
- 无 emoji、图标 Lucide、link_type 不超契约第 4 节；地图与特殊未动；发布检查清单签署，schema_version 归档。

### 9.1 发布检查清单（P6-T12）

上线前逐条确认；带 **[阻塞]** 的项未通过不得发布。

数据与备份

- [ ] **[阻塞]** 发布前对生产/开发库做一次全量文件副本（`backend/data/local_scribe.db`），
      并确认副本可在临时目录打开；删表迁移不可逆，回滚只能从备份或 `downgrade`（只重建空表）恢复。
- [ ] **[阻塞]** 对每个世界执行一次 `GET /worlds/{id}/export` 并把 JSON 归档（发布说明里记录归档位置与数量）。
      本机开发库 1 个世界；若目标环境为空库，此步可记为「无世界可导出」。
- [ ] 备份 JSON 的 `schema_version` 已写入发布说明：**当前为 `1`**（`app/schemas/worldbuilding.py` 的
      `WORLD_SCHEMA_VERSION`）。恢复时 `schema_version > 1` 会被 400 拒绝，升级应用后才能恢复。
- [ ] 对至少一个真实世界演练一次「导出 → `mode=new` 恢复 → 删除演练世界 → `mode=overwrite` 覆盖回原世界」，
      并核对 `WorldImportReport` 的 `entity_count` / `link_count` / `dangling_refs`。
      （CI 侧对应 `tests/test_p6_contract_smoke.py`；本机开发库数据量不足以做「抽样 10 个世界」对账，见 §7.2。）

迁移

- [ ] **[阻塞]** `alembic heads` 唯一且为 `74bd4aa85478`；`alembic upgrade head` 在目标库成功执行。
- [ ] 迁移后核对三张旧表不存在：`world_instances` / `worldview_configs` / `bidirectional_relations`。
- [ ] `PRAGMA foreign_key_check` 返回空。
- [ ] 迁移前后 `worlds` / `world_modules` / `world_submodules` / `world_module_items` / `world_links` 行数逐表一致
      （用户数据零丢失）。
- [ ] 若执行过 `alembic downgrade`：核对重建的三张旧表**外键目标都存在**（`PRAGMA foreign_key_list` 的表名
      能在 `sqlite_master` 里查到）并做一次写入探针——`PRAGMA foreign_key_check` 查不出悬空外键目标，
      只会返回空。CI 侧对应 `tests/test_worldbuilding_cleanup.py` 的 `_missing_fk_targets` + 插入探针。
- [ ] `DELETE /worlds/{id}/content` 演练一次：实体与关联清零、`GET /worlds/{id}` 的七个模块
      `submodule_count` / `item_count` 归零、`module.config` 保留。

接口与前端

- [ ] **[阻塞]** 兼容窗口下线门槛：旧 API 调用数为 0。核对手段：`/templates`、`/instances`、`/worldviews`、
      `/batch/*` 在目标环境访问日志/网关统计中无调用；代码侧由 `tests/test_worldbuilding_cleanup.py` 静态守卫兜底。
- [ ] 旧路由全部 404（`DELETE /modules/{id}` 为 405，因同路径仍承载 `PUT`），无客户端报错上报。
- [ ] **[阻塞]** 前端已按冻结后的 OpenAPI 重跑 `npm run gen:types`（`src/types/api.ts` 不再含
      `WorldTemplate` / `WorldInstance` 或旧 `templates|instances|worldviews` 路径）。
- [ ] `npm run build` 成功；`tsc --noEmit` 0 error；`eslint src --ext ts,tsx` 0 error。
- [ ] `npm test` 全绿（export + worldbuilding 两套）。
- [ ] 人工过一遍 light / dark 下的：世界列表 → 切换 → 空白创建 → 世界设置六页 → 备份/恢复 →
      模块配置（类型/字段/等级/状态/关联类型/展示/术语）→ 全局搜索（Ctrl/Cmd+K）→ 世界脉络（沙盘档 + 手工降级）。
      （本阶段只做了 token 级与 SSR 断言，未逐屏截图核对，见 §7.2 第 1 条与第 6 条。）

契约与文档

- [ ] 关联类型仍为契约 §4 的 54 条（`tests/test_link_registry.py` + `phase6w.spec.ts` 双重断言），
      未新增任何契约外 `link_type`。
- [ ] 无 emoji、图标全为 Lucide kebab-case（世界观范围内静态守卫已覆盖）。
- [ ] 地图与特殊界面未被改动（`git diff` 核对这两个模块的组件与数据面）。
- [ ] 发布说明包含：`schema_version=1`、旧表删除清单、旧路由下线清单、`alembic` 新 head
      `74bd4aa85478`、以及 §7.2 的偏差与未实现项。

---

## 10. 明确不在本阶段做的事

1. 不新增模块业务能力，不重做 Phase 3-5 视图。
2. 不改地图与特殊界面的 UI 与数据。
3. 不做协作、权限、分享、模板 / 配置市场、跨世界配置同步、项目级配置模板与 AI 生成。
4. 不做世界版本历史、回收站与完整回滚（仅保留最近一次配置快照）；不重构应用级 Character。
5. 不新增契约第 4 节之外的 link_type。
6. 不删除用户世界数据，只删被替代的系统旧表与旧接口。

---

## 11. P6 交付面与任务落地

### 11.1 P6-T1 .. T12 落地对照

| Task | 落地情况 | 主要产出 / 证据 |
|---|---|---|
| P6-T1 | 完成 | `WorldbuildingView.tsx`（真实 `currentWorldId` 按项目记忆、世界切换下拉、空白创建、无世界态引导、头部 搜索/世界脉络/设置 入口、复杂度落库到 `settings.complexity`）、`WorldSettingsPanel.tsx`（六页 + 危险操作）、`hooks/worldSettings.ts`、`hooks/moduleBuiltins.ts` |
| P6-T2 | 完成 | `WorldSettingsPanel` 备份页 + 首次导入弹窗；`hooks/worldBackup.ts`（文件名 `世界名-日期.world.json`、版本校验、两种模式载荷、报告摘要、失效引用文案）；`useWorldData.useWorldBackup` |
| P6-T3 | 完成 | `config/SubmoduleManager.tsx`（树形层级、kind/图标/颜色、dnd-kit 排序、删除影响 → 级联或迁移到父级） |
| P6-T4 | 完成 | `config/FieldSchemaEditor.tsx` + `shared/moduleConfig.ts`（8 种字段类型、必填/默认值/占位/选项/可见复杂度/分组/排序、归档与恢复）+ `shared/CustomFieldRenderer.tsx` 补 `multiselect` |
| P6-T5 | 完成 | `shared/ModuleConfigPanel.tsx` 收敛为 类型/字段/等级/状态/关联类型/展示/术语(+模块专属)；关联类型页区分只读核心注册表与自定义类型 |
| P6-T6 | 完成 | `config/GlobalSearch.tsx` + `hooks/globalSearch.ts`（Ctrl/Cmd+K、`模块:`/`kind:`/`关联:`/`标签:` 中英文限定符、按模块分组、最近记录按 项目+世界 隔离、键盘导航） |
| P6-T7 | **部分完成** | 面包屑任意级跳转、返回恢复滚动/展开/高亮、失效引用条（查看来源 / 清理引用）已做；未新增全局详情抽屉、非通用分支的滚动位置未接管 —— 见 §7.2 第 1 条 |
| P6-T8 | 完成 | `config/WorldWeb.tsx` + `config/worldWebGraph.ts`（模块成环 + 网格分桶斥力的确定性布局、模块/kind/关联类型/时间窗筛选、默认隐藏孤立节点、800 节点降级为模块矩阵 + 推荐关联、只读）+ `tests/worldbuilding/harness6w.tsx` / `phase6w.spec.ts`（63 条断言） |
| P6-T9 | 完成 | `HistoryView/config.ts` emoji → Lucide、`EditEventModal` / `AddEventModal` 默认图标与 placeholder、`EventCard` 改为 `lucideIcon()` 渲染、老 `EconomyView` 与两个旧 ConfigModal 随目录删除；世界观范围内 emoji 0 命中 |
| P6-T10 | 完成 | `models/worldbuilding.py`（删 `WorldTemplate` 别名 / `WorldInstance` / `CustomWorldviewConfig` / `template_id` synonym）、`models/relation.py`（删 `BidirectionalRelation`）、`models/project.py`、`models/__init__.py`、`schemas/worldbuilding.py` + `schemas/__init__.py`（删旧 schema）、`api/v1/worldbuilding.py`（2369 行 → 仅结构路由）、`economy_service.py` legacy 投影、`services/worldbuildingApi.ts` 旧方法与旧接口 |
| P6-T11 | 完成 | `migrations/versions/74bd4aa85478_wbl_p6_01_drop_legacy_tables.py`（drop 三张旧表，downgrade 重建空表）、`WORLD_SCHEMA_VERSION`、`WorldImportReport`、`tests/test_worldbuilding_cleanup.py` |
| P6-T12 | 完成 | 本文 §7.1 / §7.2 / §9.1 / §11，`00_overview.md` §10 结论，`backend/docs/worldbuilding_api.md` 重写为下架后的 API 面 |

### 11.2 交付文件清单

后端新增：`migrations/versions/74bd4aa85478_wbl_p6_01_drop_legacy_tables.py`、
`tests/test_p6_contract_smoke.py`、`tests/test_worldbuilding_cleanup.py`。

后端改动：`app/api/v1/worlds.py`（导出带 `schema_version`；导入重写为版本门禁 + `new`/`overwrite`
两模式 + id 映射 + 失效引用 + 未知关联类型回落；新增 `POST /worlds/{world_id}/modules`）、
`app/api/v1/worldbuilding.py`、`app/models/{worldbuilding,relation,project,__init__}.py`、
`app/schemas/{worldbuilding,__init__}.py`、`app/services/{economy_service,relation_service}.py`、
`tests/{test_worldbuilding_compat,test_worldbuilding_migrations,test_worldbuilding_backfill,test_worldbuilding_migration_links,test_relations_adapter,test_economy_graph_api}.py`、
`docs/worldbuilding_api.md`。

前端新增：`Worldbuilding/WorldSettingsPanel.tsx`、`Worldbuilding/config/{SubmoduleManager,FieldSchemaEditor,GlobalSearch,WorldWeb,worldWebGraph,index}.tsx|ts`、
`Worldbuilding/hooks/{worldSettings,worldBackup,globalSearch,moduleBuiltins}.ts`、
`tests/worldbuilding/{harness6,harness6b,harness6w}.tsx`、`tests/worldbuilding/{phase6,phase6b,phase6w}.spec.ts`。

前端改动：`Worldbuilding/WorldbuildingView.tsx`、`Worldbuilding/shared/{ModuleConfigPanel,moduleConfig,CustomFieldRenderer}.tsx|ts`、
`Worldbuilding/HistoryView/{EventCard.tsx,config.ts}` 与 `modals/{AddEventModal,EditEventModal,ConfigModal}.tsx`、`services/worldbuildingApi.ts`、
`hooks/useWorldData.ts`、`src/types/api.ts`（重生成）、`tests/worldbuilding/{bundle.mjs,harness5.tsx,phase5.spec.ts}`。

前端删除：`Worldbuilding/EconomyView.tsx`、旧 `Worldbuilding/EconomyView/`（9 modal + 6 component）、
`utils/featureFlags.ts`；`Worldbuilding/EconomyViewV2/` → `Worldbuilding/EconomyView/`（去掉 V2 命名）。

---

## 12. 复审修复（Phase 6 review fixes）

P6 交付后做了一轮逐行复审（含临时库实测与全量验收复跑），下面每条都已在代码与测试里落地。

### 12.1 缺陷修复

| # | 缺陷 | 修法 | 证据 / 回归 |
|---|---|---|---|
| R1 | **迁移 downgrade 重建的 `world_instances` 外键指向 `world_templates`** —— 该表已被 P1-MIG-01 改名，SQLite 建表时不校验父表存在，于是「downgrade 成功」却产出一张写入即 `no such table: main.world_templates` 的坏表 | 重建时写 `worlds.id`（SQLite 在改名时已把该外键改写成 `worlds`，实测 `PRAGMA foreign_key_list` 为 `worlds`） | 临时库实测：降级后 `PRAGMA foreign_key_list` + 写入探针；`test_worldbuilding_cleanup.py` 新增「外键目标必须存在 + 真写得进一行」 |
| R2 | **新建 / 恢复为新世界后不会切过去**：收敛 effect 用陈旧列表把选择覆盖回 `sorted[0]` | 新增 `resolveCurrentWorldId(worlds, currentId, pendingId)` + `pendingWorldIdRef`：创建 / 恢复成功即登记待选中世界，列表回来后清掉 | harness6 新增 5 条收敛断言；phase6 静态护栏改断言 `resolveCurrentWorldId` |
| R3 | **「清理引用」必然 422**：`getWorldLinks` 只传 `entity_id`，后端要求 `module` 与 `entity_id` 同时提供 | 调用点补 `module: brokenRef.ref.module` | 后端 422 分支原本就不可达；失效引用条现在真能清 |
| R4 | **导入报告与后端行为相反**：未知 kind 写「已降级为 custom」；`keep_dangling=false` 仍写「已保留为警示引用」、`keptDangling` 只按计数推导 | 文案改为「未做降级（按原值保留）」/「已按设置丢弃」；`summarizeImportReport(report, { keepDangling })` 由调用方传真实选择 | harness6 新增 4 条文案与 `keptDangling` 断言 |
| R5 | **「清空世界数据」不清关联**：逐条删子模块 / 条目，`WorldLink` 全残留；相关缓存也没失效 | 新增原子端点 `DELETE /worlds/{world_id}/content`（清子模块 + 条目 + 关联，保留模块与 `module.config`），前端一次调用并失效 world / worlds / links / submodules / items | `tests/test_p6_contract_smoke.py::test_clear_world_content_keeps_modules_and_config` |
| R6 | **`module.submodule_count` / `item_count` / 子模块 `item_count` 恒为 0**：schema 默认 0 但 `_module_payload` 从不填，设置面板模块页恒显示 0，地图 / 特殊分支的 `enabled: !!module.submodule_count` 永不发请求 | `_module_payload` 用一次分组查询填真实计数（子模块条目数 + 模块子模块数 / 条目数，`include_items=false` 时另走 count） | `test_worldbuilding_smoke::test_world_detail_fills_module_and_submodule_counts` |
| R7 | **SubmoduleManager 关联计数键错配**：传入按模块聚合的计数，消费端按实体 id 查 → 删除影响面板恒显示「影响 0 条关联」 | 启动器改用世界关联列表本地归并出「实体 id → 关联数」 | 键语义与 `SubmoduleManager` 的 props 文档一致 |
| R8 | **世界设置入口 `maxDepth ?? 1`** 使 politics / economy 等模块无法新增自定义 kind（自定义 kind 必须有 parentKind，深度至少 2） | `MAX_MODULE_DEPTH` 补 politics=3（与 `POLITICS_MAX_ORG_DEPTH` 一致）、economy=2，其余模块用 `DEFAULT_MODULE_DEPTH=2` | 与政治模块自身入口口径一致 |
| R9 | **`visibleComplexity` 只写不读**：7 个 `CustomFieldRenderer` 调用点都不传 `complexity`，过滤从未生效；`required` 也没有任何执行口 | 渲染器改为优先 prop、否则读 ComplexitySwitcher 上下文；新增 `missingRequiredFields` / `isCustomFieldEmpty`，三个有提交动作的表单在 `handleSubmit` 里阻断并给出 `*` 标记 + 缺失提示 | harness6b 断言改为「无 Provider 退化为速写档时沙盘字段隐藏」 |
| R10 | **删除世界后被删世界被重新选中**：`writeCurrentWorldId(null)` 写空串、读回是 `''` 且被当成有效 id | 读回归一为 `null`；删除成功后用 `setQueryData` 把该世界从列表缓存摘掉 | harness6 断言「清空记忆读回 null」 |
| R11 | **对象键保存抹掉同级子键**（P3 起既有）：三个模块面板未传 `rawConfig`，`storedRef` 为空 → 补丁只带改动子键 | races / systems / politics 三个面板补 `rawConfig`（世界设置入口本来就有） | 四个入口现在口头一致 |
| R12 | **`WorldTone` 丢未知键**：`WorldSettings` 有 `extra="allow"`，`tone` 没有，前端 `{...tone.raw}` 的承诺不成立 | 后端 `WorldTone` 补 `extra="allow"` 并重生成 `types/api.ts`（`WorldTone` 现带 `[key: string]: unknown`） | tsc 0 error + phase5 的 gen:types 漂移用例通过 |
| R13 | **世界脉络降级路径 O(n²)**：推荐关联对每个桶内所有不直连节点两两生成候选再排序；降级态还无条件跑 120 轮布局 | 桶内按关联数只取前 30 个节点、候选总数封顶 2000；降级时不再计算布局坐标 | 风险是「大世界打开即卡死」，现由常量封顶 |
| R14 | **交互小项**：Ctrl/Cmd+K 在输入框内抢焦点；欢迎弹窗 `choose` 不关自己（淡出后重现）；设置面板恢复失败弹两条相同 toast；覆盖空世界也要勾「目标世界已有数据」；备份里 `modules` / `links` 类型不对时静默按空导入；逗号列表输入框回写吞逗号；设置面板模块页在速写档仍可编辑；`worldWebGraph` 注释与实现相反；`EconomyView/index.ts` 旧 flag 注释 | 逐项修复（可编辑元素守卫、`onClose()`、去掉重复 toast、`targetNonEmpty` 只按实体/关联且空世界不加确认、键存在但类型非数组即抛错、列表输入保留原文草稿、速写档禁用模块行并给提示、注释对齐） | eslint / tsc / Playwright 全绿；harness6 新增备份数组类型断言 |
| R15 | **静态守卫偏弱**：清单缺 `world_templates`（正是 R1 的关键词）；`template_id` 断言可能退化成「空 == 空」恒真；路由守卫只查字面量 | 清单补 `world_templates`、断言改 `assert not hits` 并断言扫描集合非空、前端 emoji / 图标扫描范围扩到 `config/` 整目录 | `test_worldbuilding_cleanup.py`；phase6 spec 扫描范围注释同步 |
| R16 | **测试口径**：`in (404, 405)` 未锁定 405；回落 `directed=False` 未断言；`PRE_P5_REVISION` 命名与语义相反；harness fixture 还带 `template_id` | 分别精确断言 405、断言回落边 `directed is False`、常量改名 `P5_HEAD_REVISION`、五个 harness 的 fixture 改 `world_id` | 248 passed / 40 Playwright passed |
| R17 | **删掉只被测试使用的死代码**：`entityCountOfDetail` / `webGraphInputs`（生产从不调用，且节点口径与真实降级判定不一致） | 删除并移除对应 harness 断言，节点上限常量仍由 phase6 的静态护栏保证两处一致 | harness6 断言数 173 → 177（新增收敛 / 文案 / 备份类型断言） |

### 12.2 复审后的验收数字

| 项 | 结果 |
|---|---|
| `pytest -q` | **248 passed**（基线 213） |
| Playwright | **40 passed**（phase6 5 / phase6b 3 / phase6w 3 等，断言地板 177 / 153 / 63 精确匹配） |
| `tsc --noEmit` / `eslint src` / `vite build` | 0 error / 0 error 29 warning / 成功 |
| `alembic heads` | `74bd4aa85478` 唯一 |
| 降级库可用性 | 外键目标齐备 + 写入探针通过（R1） |
| 旧标识守卫 | `backend/app`、`frontend/src` 0 命中（含 `world_templates`） |
