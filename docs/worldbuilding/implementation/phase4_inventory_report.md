# Phase 4 政治旧数据盘点报告（P4-T12 产出）

> 本文是 `phase4_politics.md` §5 P4-T12 的产出：政治模块的只读盘点口径、现存编码分布、回填映射与「已可识别 / 需回填 / 保留 legacy」三类结论。
> 只读盘点：不写库、不建表、不改代码；迁移脚本为 `backend/migrations/versions/c1f7a4b9e2d3_wbl_p4_01_backfill_politics.py`。
> 口径依据：`politics_ui_design.md` §3.2（kind 与枚举）、§3.3（meta 分 kind 扩展）、§3.6（旧字段迁移映射）、§3.8（政治边落库规则）、§7.6（空白世界声明）；`phase0_decisions_and_migration.md` §5（D3/D4/D5）、§6.1、§8（迁移冻结、兼容窗口与回滚）。

## 1. 执行信息

| 项 | 值 |
|---|---|
| 数据库 | `backend/data/local_scribe.db`（434,176 bytes，文件 mtime 2026-10-06 19:57:30） |
| 连接方式 | SQLite 只读 URI `file:<path>?mode=ro`；盘点脚本未执行任何 DDL/DML（详见 §10 口径说明） |
| SQLite / 运行环境 | Python 3.12（`backend/venv`），Windows 布局 `backend\venv\Scripts\python.exe` |
| 库内 `alembic_version` | `8a5f26a774e3`（= P1-MIG-06，盘点时 head）；**验收后开发库已升级到 `c1f7a4b9e2d3`** |
| 迁移链核对 | 逐条读取 `migrations/versions/*.py` 的 `revision` / `down_revision`：**唯一 head = `8a5f26a774e3`**，线性无分支（`character_system_001` 亦在主链上） |
| 本次新增迁移 | `c1f7a4b9e2d3_wbl_p4_01_backfill_politics.py`，`down_revision = 8a5f26a774e3` |
| 盘点时间 | 2026-10-07 |
| 数据库入库检查 | `backend/data/**` 已在 `.gitignore` 覆盖（Phase 0 §9 已核验 `git ls-files backend/data` 为空），本次盘点同样不落库 |

Schema 核对（迁移前）：`world_submodules` 已含 `kind` / `meta` / `parent_id` 列，`world_modules` 已含 `config`，`world_links` 已存在（16 列）。即本库已完成 Phase 1 地基，Phase 4 只需数据层归一化与回填。

样本说明：本库是开发库（12 世界 / 84 模块 / 14 子模块 / 1 条目 / 7 关联），
政治模块下**没有条目数据**，`treaty_between`、`_char_ref:`、`_char_link:` 三类残留均为 0；
因此「回填正确性」不能靠本库证明，必须由 `backend/tests/test_worldbuilding_politics_backfill.py`
夹具库（覆盖 nation/leader 归一化、三种 scope、orphan 与复制残留）验证，见 §9。

## 2. 数据来源与盘点口径

| 类别 | 盘点对象 | 检查项 |
|---|---|---|
| 1 | `worldview_configs` | 政治预设行数、`is_system` 计数（只统计，不评估内容） |
| 2 | `world_modules`（`module_type = 'politics'`） | 模块数、`config` 是否有政治预设 |
| 3 | `world_submodules`（政治模块下） | `color` / `icon` / `kind` / `meta` 编码分布与样例、`parent_id` |
| 4 | `world_module_items`（政治模块下） | `name` 分布、`content` 键编码（字段组、`_char_ref:`、`_char_link:`） |
| 5 | `world_links` | `link_type` 分布、政治相关边（源或目标为 politics）、`politics.treaty_between` 残留 |
| 附加 | 非政治模块同类编码 | 用于确认迁移的**作用域边界**（只动 politics） |
| 孤儿 | 人物引用键 | 角色不存在、子模块缺失、键写在别的 item 上三类 |

三方对账口径：本报告（真实库） -> 迁移报告（`logger.info` 的 JSON，见 §8） -> 测试夹具断言（§9），三者结论一致。

## 3. `worldview_configs`：政治预设（0 行）

| 指标 | 值 |
|---|---|
| 总行数 | 0 |
| `is_system = 1` | 0 |
| 政治相关预设 | 0 |

结论：**本库不存在政治预设数据**，D5「系统预设不迁、只留只读查询、Phase 6 删表」在政治侧零数据损失。
另按 `politics_ui_design.md` §7.6，政治模块**不提供**任何预置政权 / 组织 / 人物 / 条约 / 等级 / 状态 / 政体 / 派系；
本次迁移也不写入任何预设值（只写从既有数据推导出的 `scope` / `characterId`）。

## 4. 政治模块与子模块现状

### 4.1 模块（12 行 politics，`config` 全空）

| 指标 | 值 |
|---|---|
| `world_modules` 总数 / 世界数 | 84 / 12（每世界 7 个模块，`module_type` 分布各 12） |
| `module_type = 'politics'` | 12 |
| 政治模块 `config` 非空 | 0 |

结论：Phase 4 的 `ModuleConfig`（`entityTypes` / `levels` / `statuses` / `fieldSchema` / `linkTypes` / `palette` / `displayMode` / `defaultComplexity`）
在本库尚未落库；按 §3.7 与 §7.6，其默认值由前端常量与空状态承担，**迁移不预置 `config`**。

### 4.2 子模块（14 行；其中 politics 5 行）

| module_type | kind | 行数 | color | icon |
|---|---|---|---|---|
| politics | `polity` | 5 | NULL | NULL |
| history | `era` | 1 | `era:ochre` | NULL |
| history | `event` | 7 | `#64748b` ×1、NULL ×6 | NULL |
| economy | `currency` | 1 | `type:currency:global` | NULL |

政治 5 行的共同特征：

| 指标 | 值 |
|---|---|
| `name` | 全部为「旧政权」 |
| `kind` | 全部 `polity`（已是 §3.2 内置 kind，无需归一化） |
| `color` / `icon` | 全部 NULL（无 `type:` 前缀、无 emoji/前缀编码） |
| `meta` | 全部 `{}`（空对象，无 `scope` / `characterId` / `level` / `status` / `time`） |
| `parent_id` | 全部 NULL |
| 其他 kind（`organization` / `figure` / `treaty` / `custom_*`） | 0 行 |

结论：本库政治侧**没有任何旧 `PoliticalEntityType` 编码**（无 `nation`、无 `leader`），
也没有组织（无 `scope` 可推导）、没有人物（无 `characterId` 可回填）。
5 行均为「已可识别」的 `polity`，迁移对它们是**零写入**（见 §8 报告中的 0 计数）。

### 4.3 非政治模块的同类编码（作用域边界证据）

| module_type | kind | color 前缀编码 | 迁移动作 |
|---|---|---|---|
| history | `era` / `event` | `era:ochre`（E1）、`#64748b` | 不动（由 P1-MIG-04 处理） |
| economy | `currency` | `type:currency:global`（E3） | 不动 |

结论：`derive_kind` 口径在两个模块共用，但 Phase 4 迁移**只作用于 `module_type = 'politics'`** 的行；
上述历史 / 经济编码在迁移后被断言为原值不变（测试 `test_politics_kind_normalized_and_derived` 的 `H_POL1` 分支）。

## 5. items 现状（政治模块 0 行）

| 指标 | 值 |
|---|---|
| `world_module_items` 总数 | 1 |
| 政治模块下的条目 | 0 |
| `name` 分布（全库） | 「除非是」×1（非政治模块） |
| `content` 格式（该行） | JSON 对象，值以 `\uXXXX` 转义存储：`{"\u6d4b\u8bd5": "\u6d4b\u8bd5"}` |
| 字段组名（`government` / `chronicle` / `demographics` / `economy_base` / `org_*` / `figure_identity` / `treaty_*` / `custom`） | 全部 0 |
| `_char_ref:` / `_char_link:` 键 | 全部 0 |

结论：政治 `items` 字段组（§3.4）在本库无样本，迁移不读写任何政治 item 内容；
`_char_ref:` / `_char_link:` 回填路径在本库为真空通过，其正确性由夹具覆盖（§9）。

## 6. 政治关联与 `politics.treaty_between` 残留

`world_links` 共 7 行，`link_type` 分布：

| link_type | 行数 | 是否契约 §4 内 |
|---|---|---|
| `core.related_to` | 4 | 是 |
| `history.involves` | 2 | 是 |
| `core.references` | 1 | 是 |

政治相关边（源或目标模块为 `politics`）共 2 行，且**全部是入边（other -> politics.polity）**：

| 源 | 目标 | link_type | 说明 |
|---|---|---|---|
| `history.event` -> | `politics.polity` | `core.related_to`（对称，`directed=0`） | 历史事件与政权的一般关联 |
| `history.event` -> | `politics.polity` | `history.involves`（有向） | meta 记 `reclassifiedFrom` / `reclassifiedAt` |

| `politics.*` 出边（source_module = politics） | 0 行 |
|---|---|
| `politics.subordinate_to` / `politics.member_of`（scope 推导依据） | 0 行 |
| `politics.signatory_of`（缔约唯一规范边） | 0 行 |
| `politics.treaty_between`（**已废弃**）残留 | **0 行** |

结论：
1. 本库**没有 `politics.treaty_between` 残留**，迁移中没有任何针对该类型的处理分支（不创建、不查询、不转换）；
   该 link_type 亦不在 `app.services.link_registry` 中（`backend/tests/test_link_registry.py` 断言）。
2. 没有任何 `politics.*` 出边，因此组织 `scope` 推导在本库无输入：若存在组织行，将落入
   「归属边无法判定 -> 不写猜测值 + `meta.legacy = true`」分支（§3.8.3）。
3. 本迁移**只读** `world_links`，不创建、不修改、不删除任何关联；`world_links` 行数迁移前后恒为 7。

## 7. 三类结论

### 7.1 已可识别（无需回填）

| 对象 | 行数 | 理由 |
|---|---|---|
| politics 子模块 `kind = 'polity'` | 5 | 已是 §3.2 内置 kind；迁移只读，不写 kind / meta |
| history / economy 子模块旧编码 | 9 | 由 P1-MIG-04 处理，Phase 4 作用域外 |
| `world_links` 现有 7 行 | 7 | 全部为契约 §4 内 link_type；本迁移只读 |

### 7.2 需回填（本次迁移覆盖的项）

本库缺口为 **0 行**（政治模块下既无条目、也无旧 kind / 旧引用键）；
迁移覆盖口径如下，逐项由夹具库验证：

| 回填项 | 触发条件 | 落点 | 夹具覆盖 |
|---|---|---|---|
| kind 归一化 | 政治子模块 `kind = 'nation' / 'leader'` | `polity` / `figure` | `test_politics_kind_normalized_and_derived` |
| kind 从 color 推导 | 政治子模块 `kind` 为空且 `color = 'type:<entityType>:…'` | 归一化 kind（含 `nation`/`leader` 重命名） | 同上 |
| 组织 `scope` | `kind = 'organization'` 且 `meta.scope` 缺失 | `intra_polity` / `cross_polity`（依据 `politics.subordinate_to` / `politics.member_of` 出链） | `test_politics_scope_derived_from_links` |
| 人物身份键 | 政治 figure 子模块下存在 `_char_ref:<charId>` / `_char_link:<itemId>:<charId>` | `figure.meta.characterId`（**不落 WorldLink**） | `test_char_refs_backfilled_to_figure_meta` |

### 7.3 保留 legacy（口径与只读理由）

| 对象 | 处理 | 理由 |
|---|---|---|
| `kind` 不属于 `polity/organization/figure/treaty/custom_*` | 保留原值只读 + `meta.legacy = true` | 无法映射到 §3.2 枚举；不猜、不删（Phase 4 §8「旧 generic 数据不可识别时保留只读并标警示」） |
| `kind` 为空且 `color` 无 `type:` 前缀与可用信息 | 保留空缺，不写猜测值、不删原值 | 与 §7.6「空白世界不预置」一致；UI 显示空状态 |
| `kind = 'organization'` 但**无任何政权归属边** | 不写 `scope`（**不写 `independent`**）+ `meta.legacy = true` | §3.8.3 的 `independent` 是用户显式标记的结果；迁移不替用户下结论 |
| `kind = 'organization'` 但归属边端点不是 `politics.polity`（含自环 / 组织互挂） | 同上 | 无政权可归属；避免猜测（组织树可后补边） |
| `kind` 非 `figure` 的子模块上存在 `_char_ref:` / `_char_link:` 键 | 不回填，旧 item 只读 | §3.3：`characterId` 只属 figure；`polity` 等实体的人物引用语义不明确 |
| 同一 figure 上多个**不同** charId | 只回填第一个，其余不落库 | `figure.meta.characterId` 是 1:1 必填身份键；冲突需人工裁决 |
| 已存在的 `meta.scope` / `meta.characterId`（用户或更早写入） | 不覆盖 | 迁移只补缺；用户值优先 |
| 旧 item 本身（含 `_char_ref_*` / `_char_link_*` 键） | **不删除、不改写** | Phase 0 §8 兼容窗口；用户数据不因迁移丢失 |

`meta` 记账键（`_p4LegacyKind` / `_p4KindWritten` / `_p4DerivedScope` / `_p4CharacterId` / `_p4RawMeta`）
为本次写入专用，只服务精确回滚，不参与前端渲染。`downgrade` 只在**现值仍等于本次写入的值**时回滚：
`kind` 列仍等于 `_p4KindWritten` 才还原、`meta.characterId` 仍等于 `_p4CharacterId` 才删除、
`meta.legacy` 仅当本次由非 true 置为 true 时才清（`legacy: false` 等原值写回），
`_p4RawMeta` 把无法解析的 meta 原文原样写回；用户改过的值一律保留
（`test_downgrade_preserves_user_edits`）。`meta = '{}'` 不会在回滚时被写成 NULL
（`test_downgrade_keeps_empty_meta_object`）。

## 8. 迁移前后对照表

| 对象 | 迁移前（本库实测） | 迁移后 | 判定 |
|---|---|---|---|
| `worldview_configs` | 0 行 | 0 行 | 不变（不迁移预设） |
| `worlds` / `world_modules` | 12 世界 / 84 模块 | 12 / 84 | 不变（迁移不建行） |
| 政治模块 `config` | 全空 | 全空 | 不变（不预置 config） |
| `world_submodules`（政治） | 5 行，全部 `kind = polity`、`meta = {}` | 5 行，配置不变 | 零写入（已可识别） |
| `world_submodules`（其他模块） | 9 行 | 9 行 | 不变（作用域外） |
| `world_module_items` | 1 行（非政治） | 1 行 | 不变（不增不删） |
| `world_links` | 7 行 | 7 行 | 不变（本迁移只读） |
| `characters` | 5 行 | 5 行 | 不变（只读校验存在性） |
| 迁移版本 | `8a5f26a774e3` | `c1f7a4b9e2d3` | 线性 +1 |

夹具库（`legacy_db` 基座 + 旧政治编码）上的迁移报告实测（`logger.info` 原样输出）：

```json
{"char_refs_not_on_figure": 1, "character_id_backfilled": 1, "kind_derived": 1,
 "kind_normalized": 4, "legacy_flagged": 3, "malformed_item_content": 1, "malformed_meta": 1,
 "meta_written": 11, "orphan_char_links": 0, "orphan_char_refs": 1,
 "scope_filled": 2, "scope_legacy": 1, "skipped_foreign_char_links": 2, "unknown_kind_prefix": 0}
```

计数口径：`kind_normalized` = `nation -> polity` 与 `leader -> figure` 改写数；
`kind_derived` = kind 空缺时从 `color` 前缀推导数；`unknown_kind_prefix` = `color = type:<无法识别>` 计数；
`legacy_flagged` = **本次把 `meta.legacy` 由非 true 置为 true** 的行数（不是任何 meta 变更都计，
`test_report_legacy_flagged_matches_meta_legacy_true` 断言它与 `json_extract(meta,'$.legacy') IS 1` 的行数一致）；
`meta_written` = 本次 meta 载荷被改写的行数（含只写记账键的行，恒大于 `legacy_flagged`）；
`malformed_meta` / `malformed_item_content` = meta 或 item.content 不是合法 JSON 对象的行数（原值存进
`_p4RawMeta`，downgrade 原样还原）；
`orphan_char_refs` / `orphan_char_links` = 角色不存在或子模块缺失；
`skipped_foreign_char_links` = 键上 itemId 指向别的 item（复制残留）；
`char_refs_not_on_figure` = 键存在但载体不是 figure（或同一 figure 上 charId 冲突）。
（上表数值为修复轮后的实测；权威断言在 `backend/tests/test_worldbuilding_politics_backfill.py`。）

### 回滚说明

| 层 | 动作 | 边界 |
|---|---|---|
| 迁移 | 新增 `c1f7a4b9e2d3`，`downgrade` 只撤销本次写入 | 不改已发布迁移；线性 head |
| 数据 | 回滚 kind 归一化 / 清本次补的 `scope` 与 `characterId` / 清本次置的 `meta.legacy` 与记账键 | **不改 `color` 原值、不删除旧 item、不触碰 `world_links`**；`meta='{}'` 保持 `{}` |
| 精确性 | 依据 `_p4KindWritten`（本次写进 kind 列的值）/ `_p4LegacyKind`（含 `""` 表示原值为空）/ `_p4DerivedScope` / `_p4CharacterId` / `_p4RawMeta` | 现值不等于本次写入值（用户改过）时保留现值，不强行回滚 |
| 前端 | revert `WorldbuildingView.tsx` 的 politics 渲染分支（可同时删除 `PoliticsView/` 目录） | **没有 feature flag**；回滚 UI 与回滚迁移彼此独立 |
| 数据库 | 上线前保留 `local_scribe.db` 快照 | 数据库文件不入库 |

回滚实测：夹具库 `upgrade -> downgrade(P1 head) -> upgrade` 后 kind / scope / characterId / 旧 item / 旧 `world_links` 全部回到预期值
（`test_downgrade_reverts_only_this_migration`）；**用户改过值的回滚保护**由 `test_downgrade_preserves_user_edits` 覆盖；
空库 `upgrade/downgrade` 各两次不报错（`test_empty_db_upgrade_and_downgrade`）。

## 9. 已知边界（Phase 4 明确不做）

1. **地图未接入**：`politics.controls_region` / `capital_at` 的目标 `map.region` 在本库无数据，政治画布隐藏地图入口（§6.7）；迁移不造 region、不写这两类边。
2. **不迁移旧政治预设（D5 只读）**：`worldview_configs` 0 行；即便有数据也只读不迁，Phase 6 删表。
3. **`figure.meta.characterId` 不落 WorldLink**：人物与全局 `Character` 的 1:1 引用只存 `meta`（§3.1 唯一身份例外）；迁移不创建 `character.*` 边。
4. **`politics.treaty_between` 不写**：已废弃、不在注册表、旧数据由展示层转换为 `signatory_of`（§3.8.1）；本迁移不创建、不查询、不转换该类型边，代码路径不含该字面量（只在文档字符串里说明废弃）。
5. **`independent` 不自动推导**：无政权归属的组织只标 `legacy`，等用户在名录里显式标记（§3.8.3）；读取侧把这类组织放进「未归属」分组而不是静默隐藏。
6. **不顺延组织树推导**：scope 只看组织的**直接**出边；`subordinate_to` 链到上级组织、再由上级组织挂政权的情形不追链推导（宁可留 legacy，不猜）。
7. **迁移不新增表 / 列 / 路由 / 服务**：`backend/app/**` 冻结（Phase 1 已就位），Phase 4 只在数据层归一化。
8. **本库政治条目为 0**：字段组（§3.4）与人物引用键的迁移路径只能由夹具证明，真实旧库副本上线前需重跑同一盘点脚本。

## 10. 复现方式与口径说明

- 盘点脚本为临时只读脚本（`sqlite3` + `mode=ro` URI），**用完即删、未留在仓库**（`backend/` 下无 `_p4*` / `_inspect*` 残留）；本报告 §3-§7 的数值即该次执行输出。
- 迁移报告由临时脚本在夹具库上调用迁移的 `upgrade()` 捕获，输出见 §8；脚本同样用完即删。
- 复现步骤（Windows）：

```powershell
cd E:\code\LocalScribe\backend
.\venv\Scripts\python.exe -m pytest tests/test_worldbuilding_politics_backfill.py -q   # 迁移幂等与回填
.\venv\Scripts\python.exe -m pytest -q                                                # 全量基线
```

- 验收结果（2026-10-07，修复轮后重跑）：`127 passed`（基线 117 + P4 新增 10；本轮新增 5 例覆盖用户改值回滚、`{}` 保真、畸形 meta/item 还原与计数、`legacy_flagged` 口径、`world_links` 幂等快照）。
