# Phase 0 旧数据盘点报告（P0-T3 产出）

> 本文是 `phase0_decisions_and_migration.md` §5 P0-T3 的产出：旧数据盘点口径、五类分布、孤儿数与回填对账基线。
> 只读盘点：不写库、不建表、不改代码；契约以 `cross_module_link_design.md` 为准，link_type 只引用该文档 §4。
> 数据结论已同步进 `phase0_decisions_and_migration.md` §4、§6.1、§7、§9。

## 1. 执行信息

| 项 | 值 |
|---|---|
| 数据库 | `backend/data/local_scribe.db`（389,120 bytes，文件 mtime 2026-10-06 15:23:34） |
| 连接方式 | SQLite 只读 URI `file:<path>?mode=ro`；未执行任何 DDL/DML |
| SQLite / 运行环境 | SQLite 3.49.1；Python 3.12（`backend/venv`） |
| 迁移版本 | `alembic heads` = `a8f3e9c2b1d4`（唯一 head）；库内 `alembic_version` = `a8f3e9c2b1d4`，一致 |
| 迁移链 | 12 条 revision 线性串联（`<base> -> a72273cf3782 -> b82273cf3783 -> c92273cf3784 -> 1ab95b05f309 -> 063d2b67b83b -> b0ec4e485448 -> 52d22dce2a59 -> 25676bc12c35 -> character_system_001 -> 1c246e47df51 -> 7b738d2863c5 -> a8f3e9c2b1d4`），无分支 head |
| 盘点时间 | 2026-10-06 |
| 数据库入库检查 | `git check-ignore -v backend/data/local_scribe.db` 命中 `.gitignore:14 *.db`；`git ls-files backend/data` 输出为空，数据库文件未入库 |
| 复现方式 | 附录 A 脚本；在仓库根目录执行 `backend\venv\Scripts\python.exe wb_inventory.py`（POSIX：`backend/venv/bin/python wb_inventory.py`），可用 argv[1] 指定其它库副本 |

样本说明：本库是开发库，体量极小（1 世界 / 7 模块 / 3 子模块 / 0 条目 / 0 关联），只能证明口径与结构可执行，
**不能**作为回填验收数据；Phase 1 必须另造夹具旧库样本，并在真实旧库副本上重跑同一脚本。

## 2. 盘点口径

五类主表 + 附加统计 + 旧编码清单；承接 `phase0_decisions_and_migration.md` §4，并补充三项编码缺口（见 §5 的 E2/E6/E7）。

| 类别 | 盘点对象 | 检查项 |
|---|---|---|
| 1 | `world_templates` | 总数；project_id 空/非空；is_system_template；is_public；created_by；tags |
| 2 | `world_modules` | 总数；module_type 分布；每世界模块数是否满 7；重复 module_type；is_required |
| 3 | `world_submodules` | 总数；color 编码分类（era: / type: / hex / NULL）；icon 编码；parent_id 层级 |
| 4 | `world_module_items` | 总数；name 分类（moduleConfig / relations / customFields / specification / `_char_ref_*`）；content 键分类（`_char_ref:*` / `_char_link:*`） |
| 5 | `bidirectional_relations` | 总数；relation_type、bidirectional、strength 分布；对称边重复 |
| 附加 | `world_instances`、`worldview_configs` | 行数与 is_system 计数（仅统计预设数，不评估内容） |
| 孤儿 | 全部外键式引用 | 9 类引用完整性扫描（§4） |

## 3. 五类分布结果（2026-10-06，本机开发库）

### 3.1 world_templates（1 行）

| 指标 | 值 |
|---|---|
| 总数 | 1 |
| project_id 非空 / 空 | 1 / 0 |
| is_system_template = 1 | 0 |
| is_public = 1 | 0 |
| created_by 为 NULL | 1 |
| tags | 1/1 为 JSON `null`（非 SQL NULL），无标签数据 |

即：本库无系统模板、无公开模板，唯一一行的 project_id 指向真实项目，D2 的「rename + 旧字段降级进 settings.legacyTemplate」路径无系统模板负担。

### 3.2 world_modules（7 行）

| module_type | 行数 |
|---|---|
| map | 1 |
| history | 1 |
| politics | 1 |
| economy | 1 |
| races | 1 |
| systems | 1 |
| special | 1 |

| 指标 | 值 |
|---|---|
| 模块数满 7 的世界数 | 1 |
| 重复 (template_id, module_type) 组 | 0 |
| is_required = 1 | 0 |
| 现有列 | 无 `config`（P1-MIG-02 新增） |

### 3.3 world_submodules（3 行）

| color 编码 | 行数 |
|---|---|
| `era:<theme>` | 1 |
| `type:<entityType>:<level>` | 1 |
| `#rrggbb` 纯色值 | 1 |
| NULL | 0 |
| 其它前缀 | 0 |

| 指标 | 值 |
|---|---|
| icon 为 `era:<start>:<end>` | 0（3 行 icon 全为 NULL） |
| parent_id 非空 | 1（era -> event 层级已存在） |
| 现有列 | 无 `kind` / `meta`（P1-MIG-02 新增） |

结论：3 行样本已覆盖 E1/E3 两类 color 前缀编码；`icon` 日期编码本库无样本，但代码路径存在（§5 E2），
Phase 1 夹具必须补造。

### 3.4 world_module_items（0 行）

| 名称/键口径 | 行数 |
|---|---|
| 总数 | 0 |
| name = `moduleConfig` | 0 |
| name = `relations` | 0 |
| name = `customFields` | 0 |
| name = `specification` | 0 |
| name like `_char_ref_%` | 0 |
| content 键 `_char_ref:*` | 0 |
| content 键 `_char_link:*` | 0 |
| content 键合计 | 空 |

结论：本库无任何条目数据，E4-E7 四类条目编码在数据层无样本（真空通过）；回填正确性只能靠 Phase 1 夹具与真实旧库副本验证。

### 3.5 bidirectional_relations（0 行）

| 指标 | 值 |
|---|---|
| 总数 | 0 |
| relation_type 分布 | 空 |
| bidirectional / strength 分布 | 空 |
| 对称边重复组 | 0 |

结论：D1「不回填空关联、旧表只读」在本库上零操作；world_links 建表（P1-MIG-03）后无历史载荷。

### 3.6 附加统计

| 对象 | 值 |
|---|---|
| world_instances | 0 |
| worldview_configs | 0（is_system = 1 的 0 行） |
| 代码内置系统预设 | 6 套 |

代码内置预设说明：`backend/app/api/v1/worldbuilding.py` 的 `SYSTEM_WORLDVIEW_CONFIGS`（第 67-966 行）包含
`xianxia`、`historical`、`western`、`modern`、`scifi`、`apocalypse` 六套，与
`backend/app/schemas/worldbuilding.py` 的 `WorldviewType` 六个系统类型一致；预设为代码常量，数据库无行。
因此 D5「系统预设不迁、只留只读查询」可零数据损失执行。
另注：该常量内含 emoji 图标（如 U+1F9D8、U+1F3EF），与契约 §6.1「禁止 emoji」冲突；
该常量属 Phase 6 下线范围，Phase 0 与本文不改代码。

## 4. 孤儿与完整性扫描

| 引用 | 孤儿数 |
|---|---|
| `world_modules.template_id` -> `world_templates.id` | 0 |
| `world_submodules.module_id` -> `world_modules.id` | 0 |
| `world_submodules.parent_id` -> `world_submodules.id` | 0 |
| `world_module_items.module_id` -> `world_modules.id` | 0 |
| `world_module_items.submodule_id` -> `world_submodules.id` | 0 |
| `world_templates.project_id` -> `projects.id` | 0 |
| `bidirectional_relations.source_entity_id` -> 子模块或条目 | 0 |
| `bidirectional_relations.target_entity_id` -> 子模块或条目 | 0 |
| `world_instances.template_id` -> `world_templates.id` | 0 |

- 引用扫描均按「左连接取空」判定；条目表为空时条目类检查属真空通过。
- 本库存在 1 条 `world_submodules.parent_id` 层级（era -> event），迁移须保留该层级，
  不得把时代与事件的层级关系重复落成 WorldLink（契约 §4.2 补充约定）。

## 5. 旧编码清单与回填映射（代码证据；行号基于 2026-10-06 工作副本）

| 编号 | 旧编码 | 证据（文件:行） | 迁移目标 | 归属迁移 |
|---|---|---|---|---|
| E1 | `WorldSubmodule.color = "era:<theme>"` | `frontend/src/components/Worldbuilding/HistoryView.tsx:248,272`（写）、同文件 `:113-114`（读） | `kind = era`，主题进 `meta` | P1-MIG-04 |
| E2 | `WorldSubmodule.icon = "era:<start>:<end>"` | `frontend/src/components/Worldbuilding/HistoryView.tsx:244,268` | 时间区间进 `meta.time.start/end`；`icon` 只留 Lucide 名 | P1-MIG-04（本次补入口径） |
| E3 | `WorldSubmodule.color = "type:<entityType>:<level>"` | `frontend/src/components/Worldbuilding/EconomyView/config.ts:234-251,261-264`（读写） | `kind = <entityType>`，等级进 `meta.level` | P1-MIG-04 |
| E4 | `WorldModuleItem(name="moduleConfig")` | `frontend/src/components/Worldbuilding/HistoryView.tsx:78,440,445`；`frontend/src/components/Worldbuilding/EconomyView.tsx:116,554,559` | `WorldModule.config` | P1-MIG-04 |
| E5 | `WorldModuleItem(name="_char_ref_<charId>").content["_char_ref:<charId>"]` | `frontend/src/components/Worldbuilding/HistoryView/CharacterReference.tsx:11,62-69`；`frontend/src/components/Worldbuilding/HistoryView/EventCard.tsx:82-83` | `character.appears_in`（character -> history.event 子模块） | P1-MIG-06 |
| E6 | `WorldModuleItem.content["_char_link:<itemId>:<charId>"]` | `frontend/src/components/Worldbuilding/HistoryView/EventCard.tsx:12,57-72` | `character.appears_in`（目标为条目所属 event 子模块，`meta.itemId`）；无法归属者进孤儿报告 | P1-MIG-06（本次补入口径） |
| E7 | `WorldModuleItem(name="relations").content[<key>] = "<relationType>:<targetId>:<volume>:<start>:<end>"` | `frontend/src/components/Worldbuilding/EconomyView.tsx:206-232`；`frontend/src/components/Worldbuilding/EconomyView/config.ts:254-258` | `world_links`（`relationType` 映射契约 §4.4；无对应者降级 `core.related_to` 并计入报告；volume/时间进 `meta`/`time`） | P1-MIG-05（本次补入口径） |
| E8 | `WorldModuleItem(name="customFields"/"specification")` | `frontend/src/components/Worldbuilding/EconomyView.tsx:164-181`（`specification['单位']` 即单位） | 不迁移：属长文本/结构化内容，按契约 §2.3 继续留在 `item.content` | 无 |

契约核对：E1-E3 对应契约 §2.3（color 前缀废弃 -> kind/meta）、E4 对应 §2.2（moduleConfig 条目 -> WorldModule.config）、
E5-E7 对应 §2.5 与 §8（散落在 content 的跨模块引用 -> WorldLink 表）。八项均未引入新 link_type，
契约无需修订；仅 E5/E6/E7 需在 Phase 1 明确目标 kind 与孤儿报告口径。

## 6. 结论与 Phase 1 建议

1. 结构与口径可执行，数据不可作验收：本库 0 条目 / 0 关联，P1-T9 必须先建夹具旧库样本（`backend/tests/conftest.py`），
   覆盖 E1-E7 编码、孤儿样本、对称重复样本三类。
2. 口径缺口 3 项（E2 icon 日期编码、E6 `_char_link:`、E7 `relations` 条目）已同步进 Phase 0 §4 与 §6.1，
   P1-MIG-04/05/06 须按 §5 覆盖；缺口说明不改变 Phase 1 任务表与规模。
3. D5 零数据损失：`world_instances`、`worldview_configs` 均 0 行，预设为代码常量，删表/下线无数据影响。
4. D1 无历史包袱：`bidirectional_relations` 0 行，world_links 建表后无需处理存量映射歧义（多世界容器世界逻辑仍须实现以备用）。
5. 对账要求：P1-T8 完成后按 §7 基线逐项比对，允许变化仅为新增 `world_links` 行数与新增 `kind/meta/config` 列值；
   旧表行数与旧 `item` 行数在 Phase 6 前不得减少。
6. 风险复述：`parent_id` 层级（era -> event）必须保留，不得重复落 WorldLink；color 前缀回填需同时兼容
   `era:` 与 `type:` 两套语义，未知前缀进报告而非丢弃。

## 7. 回填对账基线（迁移前，2026-10-06）

| 对象 | 迁移前 | 迁移后判定 |
|---|---|---|
| world_templates / worlds | 1 | 行数不变；id 不变；project_id 不变；旧列内容进 settings.legacyTemplate |
| world_modules | 7 | 行数不变；每世界仍 7 个 module_type；新增 config 列有值（无 moduleConfig 条目则空对象） |
| world_submodules | 3 | 行数不变；kind 全部非空（era 1 / type 前缀 1 / 纯色 1）；meta 保留 legacyColor；parent_id 不变 |
| world_module_items | 0 | 不新增、不删除（回填只读旧 item） |
| bidirectional_relations | 0 | 不新增、不删除（旧表转只读） |
| world_links | 不存在 | 新增行数 = 可映射旧编码数（本库 0） |
| world_instances | 0 | 不迁移；Phase 6 删表 |
| worldview_configs | 0 | 不迁移；Phase 6 删表 |
| characters | 1 | 不新增人物；仅可能新增 character.appears_in 关联（本库 0） |

## 附录 A：盘点脚本（只读）

将以下内容保存为 `wb_inventory.py`，在仓库根目录执行
`backend\venv\Scripts\python.exe wb_inventory.py`（POSIX：`backend/venv/bin/python wb_inventory.py`）。

```python
"""LocalScribe 世界观旧数据只读盘点（Phase 0 / P0-T3）。

只读：以 mode=ro 打开 SQLite，不写库、不建表、不改数据。
用法（Windows）：backend\\venv\\Scripts\\python.exe wb_inventory.py
用法（POSIX）  ：backend/venv/bin/python wb_inventory.py
"""

import json
import sqlite3
import sys
from collections import Counter
from pathlib import Path

# 用法：在仓库根目录执行，默认盘点 backend/data/local_scribe.db；可用 argv[1] 指定其它库。
DB = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("backend/data/local_scribe.db")
if not DB.exists():
    raise SystemExit(f"database not found: {DB}")

TABLES = [
    "world_templates",
    "world_modules",
    "world_submodules",
    "world_module_items",
    "bidirectional_relations",
    "world_instances",
    "worldview_configs",
    "characters",
    "projects",
]

con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
con.row_factory = sqlite3.Row
cur = con.cursor()


def rows(sql, *args):
    return [dict(r) for r in cur.execute(sql, args)]


def one(sql, *args):
    return cur.execute(sql, args).fetchone()[0]


out = []
out.append(f"db={DB}")
out.append(f"sqlite={sqlite3.sqlite_version}")
out.append(f"alembic_version={one('select version_num from alembic_version')}")
out.append("")
out.append("== [0] row counts ==")
for t in TABLES:
    out.append(f"{t}={one(f'select count(*) from {t}')}")

out.append("")
out.append("== [1] world_templates ==")
out.append(
    "total={} project_null={} project_set={} system={} public={} created_by_null={} tags_null={}".format(
        one("select count(*) from world_templates"),
        one("select count(*) from world_templates where project_id is null"),
        one("select count(*) from world_templates where project_id is not null"),
        one("select count(*) from world_templates where is_system_template = 1"),
        one("select count(*) from world_templates where is_public = 1"),
        one("select count(*) from world_templates where created_by is null"),
        one("select count(*) from world_templates where tags is null"),
    )
)
for r in rows("select id, name, project_id, is_public, is_system_template from world_templates"):
    out.append(f"  {r['id']} project={r['project_id']} is_public={r['is_public']} is_system={r['is_system_template']}")

out.append("")
out.append("== [2] world_modules ==")
for r in rows(
    "select module_type, count(*) n from world_modules group by module_type order by module_type"
):
    out.append(f"  {r['module_type']}={r['n']}")
out.append(f"  worlds_with_7_modules={one('select count(*) from (select template_id from world_modules group by template_id having count(*) = 7)')}")
out.append(f"  duplicate_module_type_groups={one('select count(*) from (select template_id, module_type from world_modules group by template_id, module_type having count(*) > 1)')}")
out.append(f"  is_required_true={one('select count(*) from world_modules where is_required = 1')}")

out.append("")
out.append("== [3] world_submodules ==")
cnt = Counter()
for r in rows("select color from world_submodules"):
    c = r["color"]
    if c is None:
        cnt["null"] += 1
    elif c.startswith("era:"):
        cnt["era_prefix"] += 1
    elif c.startswith("type:"):
        cnt["type_prefix"] += 1
    elif c.startswith("#"):
        cnt["hex"] += 1
    else:
        cnt[f"other:{c}"] += 1
out.append(f"  color_encoding={dict(cnt)}")
icnt = Counter()
for r in rows("select icon from world_submodules"):
    i = r["icon"]
    icnt["null" if i is None else ("era_dates" if i.startswith("era:") else "other")] += 1
out.append(f"  icon_encoding={dict(icnt)}")
out.append(f"  parent_set={one('select count(*) from world_submodules where parent_id is not null')} parent_null={one('select count(*) from world_submodules where parent_id is null')}")

out.append("")
out.append("== [4] world_module_items ==")
out.append(f"  total={one('select count(*) from world_module_items')}")
for name in ("moduleConfig", "relations", "customFields", "specification"):
    out.append(f"  name={name} -> {one('select count(*) from world_module_items where name = ?', name)}")
out.append(
    "  name like '_char_ref_%' -> {}".format(
        one("select count(*) from world_module_items where name like ?", "_char_ref_%")
    )
)
keycnt = Counter()
for r in rows("select content from world_module_items"):
    try:
        c = json.loads(r["content"]) if isinstance(r["content"], str) else r["content"]
    except (TypeError, ValueError):
        continue
    if isinstance(c, dict):
        for k in c:
            keycnt[k] += 1
out.append(f"  content_keys={dict(keycnt)}")
out.append(f"  char_ref_keys={sum(v for k, v in keycnt.items() if k.startswith('_char_ref'))}")
out.append(f"  char_link_keys={sum(v for k, v in keycnt.items() if k.startswith('_char_link'))}")

out.append("")
out.append("== [5] bidirectional_relations ==")
out.append(f"  total={one('select count(*) from bidirectional_relations')}")
for r in rows(
    "select relation_type, bidirectional, strength, count(*) n from bidirectional_relations "
    "group by relation_type, bidirectional, strength order by relation_type"
):
    out.append(f"  {r}")

out.append("")
out.append("== [6] instances / worldviews ==")
out.append(f"  world_instances={one('select count(*) from world_instances')}")
out.append(f"  worldview_configs={one('select count(*) from worldview_configs')}")
out.append(f"  worldview_system_rows={one('select count(*) from worldview_configs where is_system = 1')}")

out.append("")
out.append("== [7] orphan scan (expect 0) ==")
checks = [
    ("world_modules.template_id -> world_templates.id",
     "select count(*) from world_modules m left join world_templates t on m.template_id = t.id where t.id is null"),
    ("world_submodules.module_id -> world_modules.id",
     "select count(*) from world_submodules s left join world_modules m on s.module_id = m.id where m.id is null"),
    ("world_submodules.parent_id -> world_submodules.id",
     "select count(*) from world_submodules c left join world_submodules p on c.parent_id = p.id where c.parent_id is not null and p.id is null"),
    ("world_module_items.module_id -> world_modules.id",
     "select count(*) from world_module_items i left join world_modules m on i.module_id = m.id where m.id is null"),
    ("world_module_items.submodule_id -> world_submodules.id",
     "select count(*) from world_module_items i left join world_submodules s on i.submodule_id = s.id where i.submodule_id is not null and s.id is null"),
    ("world_templates.project_id -> projects.id",
     "select count(*) from world_templates t left join projects p on t.project_id = p.id where t.project_id is not null and p.id is null"),
    ("bidirectional_relations.source_entity_id -> submodules|items",
     "select count(*) from bidirectional_relations r where r.source_entity_id not in (select id from world_submodules union select id from world_module_items)"),
    ("bidirectional_relations.target_entity_id -> submodules|items",
     "select count(*) from bidirectional_relations r where r.target_entity_id not in (select id from world_submodules union select id from world_module_items)"),
    ("world_instances.template_id -> world_templates.id",
     "select count(*) from world_instances i left join world_templates t on i.template_id = t.id where t.id is null"),
]
for label, sql in checks:
    out.append(f"  {label}: {one(sql)}")

out.append("")
out.append("== [8] duplicate symmetric relation pairs ==")
out.append(
    "  pairs={}".format(
        one(
            "select count(*) from (select min(source_entity_id, target_entity_id) a, max(source_entity_id, target_entity_id) b, relation_type from bidirectional_relations group by a, b, relation_type having count(*) > 1)"
        )
    )
)

text = "\n".join(str(x) for x in out)
print(text)
```

## 附录 B：本次执行输出（节选）

```
db=backend\data\local_scribe.db
sqlite=3.49.1
alembic_version=a8f3e9c2b1d4

== [0] row counts ==
world_templates=1
world_modules=7
world_submodules=3
world_module_items=0
bidirectional_relations=0
world_instances=0
worldview_configs=0
characters=1
projects=1

== [3] world_submodules ==
  color_encoding={'era_prefix': 1, 'hex': 1, 'type_prefix': 1}
  icon_encoding={'null': 3}
  parent_set=1 parent_null=2

== [7] orphan scan (expect 0) ==
  world_modules.template_id -> world_templates.id: 0
  world_submodules.module_id -> world_modules.id: 0
  world_submodules.parent_id -> world_submodules.id: 0
  world_module_items.module_id -> world_modules.id: 0
  world_module_items.submodule_id -> world_submodules.id: 0
  world_templates.project_id -> projects.id: 0
  bidirectional_relations.source_entity_id -> submodules|items: 0
  bidirectional_relations.target_entity_id -> submodules|items: 0
  world_instances.template_id -> world_templates.id: 0

== [8] duplicate symmetric relation pairs ==
  pairs=0
```
