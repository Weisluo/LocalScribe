# Phase 0 决策与迁移策略

> 实施计划文档，不写代码。命名、Task ID 与 DoD 遵循 `00_overview.md`；契约以 `cross_module_link_design.md` 为准。
> 本文目标：解除 D1-D7 待拍板状态，冻结 Phase 1 迁移入口与兼容窗口。

## 1. 阶段目标与范围

做：把 `00_overview` §10 的 D1-D7 落成可执行 ADR；冻结新迁移编号、线性依赖、兼容窗口与回滚策略；给出旧数据盘点口径、测试矩阵和退出条件。

不做：不写模型/迁移/API 代码；不改设计文档与其它阶段 plan；不新增阶段范围；不引入契约第 4 节之外的 link_type；不新增世界观预设。

## 2. 前置依赖与进入条件

- 前置：设计文档定稿，`00_overview` 与 `cross_module_link_design` 为唯一契约。
- 进入 Phase 1 条件：本文 §5.1 的 D1-D7 全部为已采纳；§6 迁移表冻结；§9 退出条件全部满足。
- 代码基线：`00_overview` §7.1；执行时以 `alembic heads` 核对当前 head 为 `a8f3e9c2b1d4`，若已被其它计划推进则先对齐线性 head。
- 执行核对（2026-10-06）：`alembic heads` 输出唯一 head `a8f3e9c2b1d4`，12 条 revision 线性串联；
  `backend/data/local_scribe.db` 的 `alembic_version` 与之一致；基线 `pytest -q` 为 18 passed，可作为 Phase 1 回归网起点。

## 3. 指导文档

| 用途 | 来源 |
|---|---|
| 决策点、阶段地图、DoD | `00_overview` §1、§5、§7、§8、§10 |
| 数据模型与迁移映射 | `cross_module_link_design` §2、§3、§8 |
| link_type 白名单 | `cross_module_link_design` §4（只引用，不扩展） |
| 世界生命周期与 API 建议 | `worldbuilding_ui_design` §10.2、§10.3 |
| JSON 配置与 schema_version | `worldview_configuration_system` §7 |
| 迁移规范 | `AGENTS.md`「Database Migration Guidelines」：batch_alter_table、幂等、不改已发布迁移、线性历史 |

## 4. 现状与改动面（真实代码路径）

- 模型：`backend/app/models/worldbuilding.py`（六模型）、`backend/app/models/relation.py`（BidirectionalRelation）、`backend/app/models/project.py`。
- Schema：`backend/app/schemas/worldbuilding.py`、`backend/app/schemas/relation.py`。
- Service/API：`backend/app/services/relation_service.py`、`backend/app/api/v1/worldbuilding.py`（2749 行 / 102.7KB）、`backend/app/api/v1/relations.py`、`backend/app/api/v1/__init__.py`。
- 迁移锚点：c92273cf3784、1ab95b05f309、063d2b67b83b、b0ec4e485448、52d22dce2a59、25676bc12c35；当前 head 为 a8f3e9c2b1d4。
- 前端契约面：`frontend/src/services/worldbuildingApi.ts`（仍走 /templates、/instances）、`frontend/src/types/api.ts`（OpenAPI 生成）；`HistoryView` 以 `_char_ref` 写入 item.content。
- 盘点口径与执行结果：见 `phase0_inventory_report.md`（P0-T3 产出）§2-§4；五类分布与孤儿数全部落表，9 类引用扫描孤儿数均为 0。
- 口径补充（本次纳入，此前缺口）：`world_submodules.icon` 的 `era:<start>:<end>` 日期编码；`world_module_items.content` 的 `_char_link:<itemId>:<charId>` 键；`world_module_items(name="relations")` 的值编码 `<relationType>:<targetId>:<volume>:<start>:<end>`。三项一并计入 §6.1 的 P1-MIG-04/05/06。
- 数据事实（2026-10-06 本机开发库）：1 世界 / 7 模块 / 3 子模块（era: 1、type: 1、纯色 1）/ 0 条目 / 0 关联；代码内置系统预设 6 套（`SYSTEM_WORLDVIEW_CONFIGS`），数据库预设 0 行；数据库文件未入库（`.gitignore:14 *.db`）。

## 5. 任务分解表

| Task ID | 任务 | 产出 | 上游 | 规模 |
|---|---|---|---|---|
| P0-T1 | D1-D7 ADR 定稿 | 本文 §5.1 | 设计定稿 | S |
| P0-T2 | 迁移编号、顺序、兼容窗口与回滚 | 本文 §6、§8 | P0-T1 | S |
| P0-T3 | 旧数据盘点口径与测试矩阵 | 本文 §4、§7 | P0-T1 | S |
| P0-T4 | 准入评审与退出条件确认 | 本文 §9 | P0-T1..T3 | S |

### 5.1 D1-D7 ADR（结论 / 备选 / 理由 / 影响面 / 回滚）

| 编号 | 结论 | 备选 | 理由 | 影响面 | 回滚 |
|---|---|---|---|---|---|
| D1 WorldLink 存储 | world_links 承接旧表，回填后旧表只读，不双写 | 旧表加列；双写 | 旧字段与契约 §2.5 不符；双写分叉（00_overview §8.1） | models/relation.py、services/relation_service.py、api/v1/relations.py、P1-MIG-03/05 | downgrade 回写旧表（丢 world_id/label/time）；迁移前快照，保留开关 |
| D2 World 取代 WorldTemplate | rename worlds，加 tone/settings，删 4 个模板字段；/templates 兼容一版 | 新建表拷贝；旧表加视图 | 保留 id 不断裂 modules/instances/导出（契约 §8） | P1-MIG-01、models/schemas/worldbuilding.py、models/project.py、api/v1/worldbuilding.py、前端 client | downgrade 改回 world_templates 并补列；旧字段先存 settings.legacyTemplate |
| D3 kind/meta 与旧编码 | 加 kind/meta 与 module.config，一次性回填；后台双读，P2 切 UI | 只改前端；懒回填 | 前缀编码废弃（契约 §2.3/§8）；先数据后 UI（§8.3） | P1-MIG-02/04、models 与 schemas/worldbuilding.py、api/v1/worldbuilding.py、HistoryView/EconomyView | downgrade 只清 kind/meta/config；color 与 moduleConfig 原值保留 |
| D4 人物统一 | characters 为唯一人物源；EntityRef 支持 character；figure 只存 meta.characterId；_char_ref 回填 character.appears_in | 各模块复制人物；新建人物表 | 契约 §3、§4.7；避免重复（§8.6） | P1-MIG-06、schemas/relation.py、services/relation_service.py；政治人物迁移推迟 P4 | 过滤 module='character' 即停用；旧 item 不删 |
| D5 实例与旧世界观 | instances/worldviews 只留只读查询，系统预设不迁，写接口给指引，P6 删表 | 全量迁移；立即删表 | 契约 §0.1 与配置文档 §9 去预设 | api/v1/worldbuilding.py 的 instances/worldviews 路由 | 重开旧写接口，零数据损失 |
| D6 经济切换 | 新 EconomyView 走 economy_v2 开关；P1 只铺数据，P5 切默认，P6 删旧组件 | 大爆炸替换；双 UI | 00_overview §8.4 | Phase 5 EconomyView；P1 只保证可承载 economy.* | 关开关回旧 UI，模型不分叉 |
| D7 API 拆分 | 新增 api/v1/worlds.py、world_links.py 并注册到 /api/v1/worldbuilding；旧 worldbuilding.py 只加兼容转发 | 继续堆 102.7KB 文件；一次性重构 | 00_overview §8.5，资源隔离可回归 | 两个新 router、api/v1/__init__.py | 摘除新 router 注册；旧路由不动 |

采纳记录：

- 状态：D1-D7 全部采纳（7/7），无待拍板项、无备选残留；结论同步至 `00_overview` §10 状态列。
- 评审链：P0-T1 定稿 -> P0-T2 迁移冻结与回滚 -> P0-T3 盘点口径与报告 -> P0-T4 准入与退出条件确认。
- 约束核对：只使用 `cross_module_link_design` §4 的 54 条 link_type；`politics.treaty_between` 保持废弃、不收录；未新增 link_type；未新增世界观预设。
- 证据：`phase0_inventory_report.md`（五类分布、孤儿数、对账基线）、`alembic heads`（唯一 head `a8f3e9c2b1d4`）、基线 `pytest -q` 18 passed。

## 6. 数据 / API / 组件变更清单

### 6.1 新迁移编号与执行顺序

| 编号 | 目标文件名（rev 为 alembic 生成的 12 位 hash） | 内容 | down_revision |
|---|---|---|---|
| P1-MIG-01 | `<rev>_wbl_p1_01_worlds_rename.py` | world_templates 改名 worlds，加 tone/settings，旧列降级进 settings.legacyTemplate 后删除；world_modules.template_id 改 world_id 并换索引 | a8f3e9c2b1d4 |
| P1-MIG-02 | `<rev>_wbl_p1_02_config_kind_meta.py` | 加 world_modules.config、world_submodules.kind/meta；存在性检查 | P1-MIG-01 |
| P1-MIG-03 | `<rev>_wbl_p1_03_world_links.py` | 建 world_links 与三类索引；含 world_id/link_type/directed/label/note/meta/time | P1-MIG-02 |
| P1-MIG-04 | `<rev>_wbl_p1_04_backfill_modules.py` | moduleConfig 条目回填 config；color 前缀（era:/type:）回填 kind/meta，含 icon 的 era:start:end 日期编码；每世界补齐七个空模块 | P1-MIG-03 |
| P1-MIG-05 | `<rev>_wbl_p1_05_backfill_links.py` | bidirectional_relations 与 item(name="relations") 回填 world_links（relationType 映射契约 §4.4，无映射降级 core.related_to 并计入报告）；按项目映射 world_id，多世界时建迁移容器世界；确定性 UUID 幂等 | P1-MIG-04 |
| P1-MIG-06 | `<rev>_wbl_p1_06_backfill_char_refs.py` | `_char_ref:*` 与 `_char_link:*` 回填 character.appears_in（目标为所属 history.event 子模块，meta 记 itemId）；无法归属者进孤儿报告；不删除旧 item | P1-MIG-05 |

- 新迁移基于当前 head `a8f3e9c2b1d4` 线性串联；已含 c92273cf3784、1ab95b05f309、063d2b67b83b、52d22dce2a59、25676bc12c35 锚点。
- 不修改已发布迁移；upgrade/downgrade 均 batch_alter_table + inspector 存在性检查；数据回填用确定性主键，可重复执行。
- 盘点补充（P0-T3）：P1-MIG-04/05/06 的回填口径须覆盖 `phase0_inventory_report.md` §5 的 E1-E7 编码；本次仅补三项编码口径，六个迁移的编号、顺序与规模不变。

### 6.2 API / 组件

Phase 1 新增 `/worlds*` 与 `/worlds/{world_id}/links*`；旧 `/templates` 转发到 worlds；`/relations` 旧写接口改为 world_links 适配层。前端只生成类型并补 `worldbuildingApi` 的 worlds/links 方法，UI 切换在 Phase 2。

## 7. 测试与验收清单（矩阵）

| 类别 | 场景 | 落点 | 可执行命令 | 通过标准 |
|---|---|---|---|---|
| 迁移 | 空库、旧库、重复 upgrade、逐级 downgrade/upgrade | backend/migrations/versions/；backend/tests/conftest.py（夹具）；backend/tests/test_worldbuilding_migrations.py | `cd backend; .\venv\Scripts\python.exe -m alembic heads; .\venv\Scripts\python.exe -m pytest tests/test_worldbuilding_migrations.py -q` | 六个迁移幂等；无分支 head；SQLite 旧数据可读 |
| 兼容 | 旧 /templates、/instances、/worldviews、/relations | backend/tests/test_worldbuilding_compat.py | `cd backend; .\venv\Scripts\python.exe -m pytest tests/test_worldbuilding_compat.py -q` | 旧路由响应字段不缺失；写请求转发到新结构；410 指引符合 D5 |
| 回填 | moduleConfig、color 前缀与 icon 日期编码、bidirectional_relations、`relations` 条目、`_char_ref`、`_char_link` | backend/tests/test_worldbuilding_backfill.py | `cd backend; .\venv\Scripts\python.exe -m pytest tests/test_worldbuilding_backfill.py -q` | 行数对账（基线见 `phase0_inventory_report.md` §7）；重复执行不新增；孤儿有报告；只用契约 §4 link_type |
| 前端回归 | 生成类型、旧世界页、light/dark | frontend/src/types/api.ts、frontend/src/services/worldbuildingApi.ts；frontend/tests/（Playwright，现有 export 套件） | `cd frontend; npm run gen:types; npx tsc --noEmit; npx eslint src --ext ts,tsx; npm run build; npm test` | tsc 与 eslint 通过；旧页面加载、保存不回归；无 emoji |
| 基线回归 | 既有导出/PDF 用例不被破坏 | backend/tests/（现有 18 例） | `cd backend; .\venv\Scripts\python.exe -m pytest -q` | 18 passed（2026-10-06 实测） |

- 环境核对（2026-10-06，本机）：后端 venv 为 Windows 布局 `backend\venv\Scripts\python.exe`（POSIX 等价 `backend/venv/bin/python`，`AGENTS.md` 的 `./venv/bin/...` 仅适用于 POSIX）；
  `alembic heads` 实测唯一 head `a8f3e9c2b1d4`；前端 `node_modules` 就绪，`npm run gen:types` 需后端 :8000 在跑（实测在跑）。
- 迁移类测试先断言单一 head，再在临时库上「upgrade -> 逐级 downgrade -> 再 upgrade」；`backend/tests/conftest.py` 现为空，夹具由 P1-T9 建立。
- 回填类场景的旧编码样本见 `phase0_inventory_report.md` §5（E1-E7）；对账基线见该报告 §7。

## 8. 风险、兼容与回滚

- 兼容窗口：自 P1-T1 合入起至 Phase 6 批量下线。`/templates` 写兼容到 Phase 2 完成；`/relations` 读写适配到 Phase 5；kind/meta 双读到 Phase 2；legacy 表在 Phase 6 删除。
- 主要风险：旧关联归属歧义（迁移容器世界，P2 重新归类）；对称边重复（service 去重）；实体孤儿（报告 + 失效 chip）；SQLite 表重建外键（逐级测试）；旧 102.7KB 路由回归（新 router 隔离 + 兼容测试）。
- 回滚：每个迁移提供 downgrade；上线前保留数据库快照；P1-MIG-05/06 回滚只删新增 world_links；旧表与旧 item 在 Phase 6 前不删除，开关关闭即可回旧读写路径。

## 9. 完成定义 DoD 与退出条件

- [x] D1-D7 全部为已采纳，无待拍板项，且只使用契约第 4 节 link_type。
  证据：§5.1 采纳记录（7/7）；`00_overview` §10 状态列已改为已采纳；本文件与 Phase 1 plan 出现的关联类型均在契约 §4 内（本阶段新增引用仅 `character.appears_in`、`core.related_to`），扫描中出现的 `history.era`/`history.event` 为 kind、`politics.treaty_between` 为已废弃不收录。
- [x] 六个迁移编号、线性依赖、兼容窗口与回滚剧本评审通过。
  证据：§6.1 的 P1-MIG-01..06 以 `a8f3e9c2b1d4` 为基线线性串联，`alembic heads` 实测唯一 head；兼容窗口与回滚见 §8。
- [x] 盘点报告给出五类分布与孤儿数，且不含数据库文件入库。
  证据：`phase0_inventory_report.md` §3-§4（五类分布表格 + 9 类引用孤儿数全为 0）；`git check-ignore -v backend/data/local_scribe.db` 命中 `.gitignore:14 *.db`，`git ls-files backend/data` 为空。
- [x] 测试矩阵四类均有可执行命令与文件落点。
  证据：§7 迁移/兼容/回填/前端回归四类均带命令与落点，另加基线回归行；命令于 2026-10-06 在本机核对（`alembic heads`、`pytest -q` 18 passed 实测）。
- [x] Phase 1 plan 引用 P0-T1..P0-T4，未新增世界观预设，文档无 emoji。
  证据：`phase1_data_foundation.md` §2、§3 引用 P0-T1..P0-T4；本阶段未新增世界观预设（代码内置预设 6 套为存量，见 `phase0_inventory_report.md` §3.6）；`docs/worldbuilding/**/*.md` 共 17 份，emoji 扫描 0 命中。

本阶段产出物：

- `phase0_decisions_and_migration.md`：D1-D7 ADR、P1-MIG-01..06 冻结、兼容窗口与回滚、测试矩阵、退出条件。
- `phase0_inventory_report.md`：盘点口径、五类分布、孤儿数、旧编码清单 E1-E7、回填对账基线、只读盘点脚本。
- `00_overview.md` §10：D1-D7 决策状态由待拍板更新为已采纳。

## 10. 明确不在本阶段做的事

不写代码/迁移；不删旧表；不迁系统预设；不做 WorldLink UI 切换；不迁政治人物与经济内容；不做世界脉络图；不改地图与特殊界面。


