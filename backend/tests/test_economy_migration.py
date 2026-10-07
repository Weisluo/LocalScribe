"""经济旧数据回填测试（Phase 5 P5-T4 / P5-T6）

覆盖 wbl_p5_01_backfill_economy：
- kind：六类旧类型语义映射（currency / commodity->good / resource / industry /
  economic_zone->market / trade_route->custom_route），其余 type:* 原值保留
- 等级：color 前缀 -> meta.level；四个已知等级去星级写进 config.levels（无 ★ / ○）
- moduleConfig 条目 -> config（合并，config 已有键优先）
- relations 字符串 -> world_links（命中 registry 用 economy.*，否则按 P1-MIG-05 口径回落
  core.related_to / core.references + label）、volume -> meta.flow、起止 -> time、孤儿与重复边只计数
- customFields 条目 -> meta.customFields；emoji -> Lucide（原值进 meta.legacyIcon）
- kind 词表同步（M7）：P1 写在 world_links 上的旧端点 kind 一并改写；P1 因旧词表降级的
  economy_relations 边在新 kind 下重算 link_type
- 幂等：upgrade 两次数据完全一致（含 world_links 不重复插入）
- downgrade：只撤本次写入；用户后改的值一律保留（label/note/legacyIcon/customFields/levels 形状）；
  meta='{}' 保持 '{}'；旧 item / color 原值不动；world_links.meta 非法 JSON 不导致整体失败
- 空库 upgrade / downgrade / 再 upgrade 不报错

夹具口径：先升级到 P5 之前的 head（P4），写入 P5 盘点到的旧经济编码，再 upgrade 到 head；
报告捕获分两种：fresh（downgrade 回 P4 再 upgrade，等同首次执行）与幂等（stamp(P4) + upgrade(head)）。
"""

from __future__ import annotations

import json
import logging
import sqlite3
import uuid
from pathlib import Path
from typing import Dict

import pytest
from alembic import command

from tests.conftest import (
    _sql,
    alembic_config,
    parse_json,
    read_rows,
    read_scalar,
)

P4_REVISION = "c1f7a4b9e2d3"
P5_REVISION = "d4e8b1c7a206"
P1_NAMESPACE = uuid.UUID("6f1d0f6b-3c2a-4a9e-9c2f-0b7a5d4e8a11")

# (module_id, id, name, color, icon, kind)
LEGACY_SUBMODULES = (
    ("M_E", "E_CUR", "通货", "type:currency:global", None, None),
    ("M_E", "E_GOOD", "铁矿石", "type:commodity:regional", None, "commodity"),
    ("M_E", "E_ROUTE", "商路", "type:trade_route:local", None, None),
    ("M_E", "E_ZONE", "东市", "type:economic_zone:national", None, None),
    ("M_E", "E_IND", "铁矿业", "type:industry:regional", None, None),
    ("M_E", "E_PORT", "港口", "type:port:regional", None, None),
    ("M_E", "E_ICON", "集市", "custom", "💰", None),
    ("M_E", "E_JSON", "空 meta", "type:resource:regional", None, None),
    ("M_E", "E_MAL", "坏 meta", "type:resource:local", None, None),
    # 本次完全不改动的经济行：kind 已有、无旧等级、无图标、meta 是空对象
    ("M_E", "E_EMPTY", "已归一实体", "#64748b", None, "resource"),
    # 非经济模块的同款旧编码：本迁移必须完全不动
    (
        "M_H",
        "H_GOOD",
        "历史里的 commodity",
        "type:commodity:regional",
        None,
        "commodity",
    ),
)

MALFORMED_META = "not-json"
MALFORMED_META_ID = "E_MAL"

LEGACY_CONFIG = {
    "displayMode": "network",
    "entityTypes": [{"id": "good", "label": "货物"}],
    "levels": [{"id": "global", "label": "★★★★ 全球级", "rank": 4}],
    "customKey": 1,
}

# 存量形状非法的 config：levels 不是 list（{"global": 4}）。downgrade 必须原样写回。
LEGACY_SHAPE_CONFIG = {
    "levels": {"global": 4},
    "customKey": 2,
}
LEGACY_SHAPE_MODULE_ID = "M_MAL_CFG"

LEGACY_RELATIONS = {
    # E_IND(industry) -> E_ZONE(market)：命中 economy.supplies
    "r1": "supplier:E_ZONE:100:100:200",
    # 对称旧类型（trade_partner）候选校验不通过：P1-MIG-05 口径 -> core.related_to + label
    "r2": "trade_partner:E_PORT::",
    # 有向旧类型（supplier）候选校验不通过（E_PORT 不是 economy.supplies 的目标）：
    # P1-MIG-05 口径 -> core.references + label（不能像旧实现那样无条件回落 core.related_to）
    "r3": "supplier:E_PORT::",
    # 端点不存在：只计 orphan
    "r4": "supplier:MISSING:5",
}

# 已被 P1-MIG-05 转过的旧关系（用同源确定性 id 预置，P5 不能再转一次）。
# 预置内容 = P1 在旧 kind 词表（target_kind='commodity'）下判 economy.consumes 非法而降级的结果；
# P5 归一化 EN2 的 kind（commodity -> good）后应把它升级成 economy.consumes。
P1_CONVERTED_ITEM = "I_REL_P1"
P1_CONVERTED_KEY = "d1"
P1_CONVERTED_VALUE = "consumer:E_GOOD:7"

# 用户自己已建好的等价边（P5 必须识别为重复，不再插一条）：
# I_REL_USER 的 u1 会算出 economy.supplies / E_ZONE -> E_IND，与预置边等价
USER_EDGE_ITEM = "I_REL_USER"
USER_EDGE_ID = "USER_EDGE"


def _snapshot_links(db_path: Path) -> list:
    return read_rows(
        db_path,
        "SELECT id, source_module, source_kind, source_id, target_module, "
        "target_kind, target_id, link_type, directed, label, meta, time "
        "FROM world_links ORDER BY id",
    )


def _items_count(db_path: Path) -> int:
    return read_scalar(db_path, "SELECT count(*) FROM world_module_items")


def _seed_legacy_economy(db_path: Path) -> None:
    """在 P4 head 结构上写入旧经济编码（子模块 / item / 预置边）。"""

    connection = sqlite3.connect(db_path)
    connection.execute(
        "INSERT INTO worlds (id, name, created_at, updated_at) "
        "VALUES ('W1','旧世界',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"
    )
    for module_id, module_type, name in (
        ("M_E", "economy", "经济"),
        ("M_H", "history", "历史"),
    ):
        connection.execute(
            _sql(
                "INSERT INTO world_modules",
                "(id, world_id, module_type, name, description, icon, order_index,",
                " config, is_collapsible, is_required, created_at, updated_at)",
                "VALUES (?, 'W1', ?, ?, NULL, NULL, 0, NULL, 1, 0,",
                " CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            ),
            (module_id, module_type, name),
        )

    for module_id, submodule_id, name, color, icon, kind in LEGACY_SUBMODULES:
        connection.execute(
            _sql(
                "INSERT INTO world_submodules",
                "(id, module_id, parent_id, name, description, order_index,",
                " kind, meta, color, icon, created_at, updated_at)",
                "VALUES (?, ?, NULL, ?, NULL, 0, ?, NULL, ?, ?,",
                " CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            ),
            (submodule_id, module_id, name, kind, color, icon),
        )
    # 存量 meta 形态：空对象与非法 JSON 各一行
    connection.execute("UPDATE world_submodules SET meta = '{}' WHERE id = 'E_JSON'")
    connection.execute("UPDATE world_submodules SET meta = '{}' WHERE id = 'E_EMPTY'")
    connection.execute(
        "UPDATE world_submodules SET meta = ? WHERE id = ?",
        (MALFORMED_META, MALFORMED_META_ID),
    )

    items = (
        ("I_CFG", "M_E", None, "moduleConfig", LEGACY_CONFIG),
        ("I_CF", "M_E", "E_CUR", "customFields", {"seat": "王都", "weight": 3}),
        ("I_REL", "M_E", "E_IND", "relations", LEGACY_RELATIONS),
        (
            P1_CONVERTED_ITEM,
            "M_E",
            "E_IND",
            "relations",
            {P1_CONVERTED_KEY: P1_CONVERTED_VALUE},
        ),
        (
            USER_EDGE_ITEM,
            "M_E",
            "E_ZONE",
            "relations",
            {"u1": "supplier:E_IND:5"},
        ),
    )
    for item_id, module_id, submodule_id, name, content in items:
        connection.execute(
            _sql(
                "INSERT INTO world_module_items",
                "(id, module_id, submodule_id, name, content, order_index,",
                " is_published, created_at, updated_at)",
                "VALUES (?, ?, ?, ?, ?, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            ),
            (
                item_id,
                module_id,
                submodule_id,
                name,
                json.dumps(content, ensure_ascii=False),
            ),
        )

    # P1-MIG-05 的等价产出（确定性 id 同源）：P5 必须认可它已存在。
    # target_kind 写成旧词表 'commodity'，与 P1 当时的校验结果一致。
    p1_link_id = str(
        uuid.uuid5(
            P1_NAMESPACE,
            ":".join(("wbl-p1-05", "econ", P1_CONVERTED_ITEM, P1_CONVERTED_KEY)),
        )
    )
    connection.execute(
        _sql(
            "INSERT INTO world_links",
            "(id, world_id, source_module, source_kind, source_id,",
            " target_module, target_kind, target_id, link_type, directed,",
            " label, note, meta, time, created_at, updated_at)",
            "VALUES (?, 'W1','economy','industry','E_IND',",
            " 'economy','commodity','E_GOOD',",
            " 'core.references', 1, NULL, NULL, ?, NULL,",
            " CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        ),
        (
            p1_link_id,
            json.dumps(
                {"migratedFrom": "economy_relations", "legacyRelationType": "consumer"},
                ensure_ascii=False,
            ),
        ),
    )
    # 用户已建的等价边：与 I_REL_USER.u1 算出的 economy.supplies / E_ZONE -> E_IND 等价
    connection.execute(
        _sql(
            "INSERT INTO world_links",
            "(id, world_id, source_module, source_kind, source_id,",
            " target_module, target_kind, target_id, link_type, directed,",
            " label, note, meta, time, created_at, updated_at)",
            "VALUES (?, 'W1','economy','market','E_ZONE','economy','industry','E_IND',",
            " 'economy.supplies', 1, NULL, NULL, NULL, NULL,",
            " CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        ),
        (USER_EDGE_ID,),
    )
    connection.commit()
    connection.close()


@pytest.fixture()
def economy_p5_db(tmp_path: Path) -> Path:
    """P4 结构 + 旧经济编码，再升级到 head（本迁移执行一次）。"""

    db_path = tmp_path / "economy_legacy.db"
    config = alembic_config(db_path)
    command.upgrade(config, P4_REVISION)
    _seed_legacy_economy(db_path)
    command.upgrade(config, "head")
    return db_path


def _seed_ambiguous_shapes(db_path: Path) -> None:
    """存量形状非法（但必须可逆）的经济数据：levels 不是 list、customFields 不是 dict。"""

    connection = sqlite3.connect(db_path)
    connection.execute(
        _sql(
            "INSERT INTO world_modules",
            "(id, world_id, module_type, name, description, icon, order_index,",
            " config, is_collapsible, is_required, created_at, updated_at)",
            "VALUES (?, 'W1', 'economy', '经济（形状非法）', NULL, NULL, 1, ?, 1, 0,",
            " CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        ),
        (
            LEGACY_SHAPE_MODULE_ID,
            json.dumps(LEGACY_SHAPE_CONFIG, ensure_ascii=False),
        ),
    )
    connection.execute(
        _sql(
            "INSERT INTO world_submodules",
            "(id, module_id, parent_id, name, description, order_index,",
            " kind, meta, color, icon, created_at, updated_at)",
            "VALUES ('E_CF_STR', ?, NULL, '字符串 customFields', NULL, 0,",
            " 'currency', ?, 'type:currency:global', NULL,",
            " CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        ),
        (
            LEGACY_SHAPE_MODULE_ID,
            json.dumps({"customFields": "legacy-string"}, ensure_ascii=False),
        ),
    )
    connection.execute(
        _sql(
            "INSERT INTO world_module_items",
            "(id, module_id, submodule_id, name, content, order_index,",
            " is_published, created_at, updated_at)",
            "VALUES ('I_CF_STR', ?, 'E_CF_STR', 'customFields', ?, 0, 1,",
            " CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        ),
        (
            LEGACY_SHAPE_MODULE_ID,
            json.dumps({"seat": "王都", "weight": 3}, ensure_ascii=False),
        ),
    )
    # 原值本来就是合法 dict：downgrade 后必须回到原值（不能只剩合并进去的新键）
    connection.execute(
        _sql(
            "INSERT INTO world_submodules",
            "(id, module_id, parent_id, name, description, order_index,",
            " kind, meta, color, icon, created_at, updated_at)",
            "VALUES ('E_CF_DICT', ?, NULL, '合法 customFields', NULL, 0,",
            " 'currency', ?, 'type:currency:global', NULL,",
            " CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        ),
        (
            LEGACY_SHAPE_MODULE_ID,
            json.dumps({"customFields": {"seat": "旧座"}}, ensure_ascii=False),
        ),
    )
    connection.execute(
        _sql(
            "INSERT INTO world_module_items",
            "(id, module_id, submodule_id, name, content, order_index,",
            " is_published, created_at, updated_at)",
            "VALUES ('I_CF_DICT', ?, 'E_CF_DICT', 'customFields', ?, 0, 1,",
            " CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        ),
        (
            LEGACY_SHAPE_MODULE_ID,
            json.dumps({"seat": "新座", "weight": 7}, ensure_ascii=False),
        ),
    )
    connection.commit()
    connection.close()


@pytest.fixture()
def legacy_shape_economy_db(tmp_path: Path) -> Path:
    """P4 结构 + 形状非法的存量经济数据（levels 不是 list），再升级到 head。"""

    db_path = tmp_path / "economy_shapes.db"
    config = alembic_config(db_path)
    command.upgrade(config, P4_REVISION)
    _seed_legacy_economy(db_path)
    _seed_ambiguous_shapes(db_path)
    command.upgrade(config, "head")
    return db_path


def _rerun_p5(db_path: Path) -> None:
    config = alembic_config(db_path)
    command.stamp(config, P4_REVISION)
    command.upgrade(config, "head")


def _capture_report(db_path: Path) -> Dict[str, int]:
    target = logging.getLogger("alembic.runtime.migration")
    captured: list = []
    real_info = target.info

    def probe(*args, **kwargs):
        captured.append(args[0] % args[1:] if len(args) > 1 else args[0])
        return real_info(*args, **kwargs)

    target.info = probe
    try:
        command.upgrade(alembic_config(db_path), "head")
    finally:
        target.info = real_info

    prefix = "wbl_p5_01_backfill_economy report: "
    for message in captured:
        if message.startswith(prefix):
            return json.loads(message[len(prefix) :])
    raise AssertionError("迁移未打印报告（logger.info）")


def _p5_report(db_path: Path, *, fresh: bool = True) -> Dict[str, int]:
    """取一次本迁移的报告。

    fresh=True：先 downgrade 回 P4（把库还原成「未回填」状态）再跑，报告与首次执行一致；
    fresh=False：只 stamp 回 P4 再跑，此时数据已被回填过，报告应全为 0（幂等口径）。
    """

    config = alembic_config(db_path)
    if fresh:
        command.downgrade(config, P4_REVISION)
    else:
        command.stamp(config, P4_REVISION)
    return _capture_report(db_path)


def _meta_of(db_path: Path, submodule_id: str) -> Dict:
    return (
        parse_json(
            read_scalar(
                db_path,
                "SELECT meta FROM world_submodules WHERE id = ?",
                (submodule_id,),
            )
        )
        or {}
    )


# ------------------------------------------------------------------ upgrade


def test_kind_level_icon_and_custom_fields_backfilled(economy_p5_db: Path):
    rows = {
        row["id"]: row
        for row in read_rows(
            economy_p5_db,
            "SELECT id, kind, color, icon, meta FROM world_submodules ORDER BY id",
        )
    }

    # 六类旧类型 -> 新 kind；其余 type:* 原值保留
    assert rows["E_CUR"]["kind"] == "currency"
    assert rows["E_GOOD"]["kind"] == "good"  # commodity -> good
    assert rows["E_ROUTE"]["kind"] == "custom_route"
    assert rows["E_ZONE"]["kind"] == "market"
    assert rows["E_IND"]["kind"] == "industry"
    assert rows["E_PORT"]["kind"] == "port"
    assert rows["E_JSON"]["kind"] == "resource"
    assert rows["E_EMPTY"]["kind"] == "resource"

    # color 与 icon 原值不动
    assert rows["E_GOOD"]["color"] == "type:commodity:regional"
    assert rows["E_ICON"]["color"] == "custom"

    # 等级进 meta.level
    assert _meta_of(economy_p5_db, "E_CUR")["level"] == "global"
    assert _meta_of(economy_p5_db, "E_ZONE")["level"] == "national"
    assert _meta_of(economy_p5_db, "E_ROUTE")["level"] == "local"

    # customFields 条目 -> meta.customFields（现值优先）
    assert _meta_of(economy_p5_db, "E_CUR")["customFields"] == {
        "seat": "王都",
        "weight": 3,
    }

    # emoji -> Lucide，原值保留进 meta.legacyIcon
    assert rows["E_ICON"]["icon"] == "coins"
    assert _meta_of(economy_p5_db, "E_ICON")["legacyIcon"] == "💰"

    # 非法 meta 原文保存进记账键，downgrade 才能还原
    assert _meta_of(economy_p5_db, "E_MAL")["_p5RawMeta"] == MALFORMED_META

    # 非经济模块不受影响
    assert rows["H_GOOD"]["kind"] == "commodity"
    assert rows["H_GOOD"]["color"] == "type:commodity:regional"
    assert rows["H_GOOD"]["meta"] is None


def test_config_merged_and_levels_destarred(economy_p5_db: Path):
    config = parse_json(
        read_scalar(economy_p5_db, "SELECT config FROM world_modules WHERE id = 'M_E'")
    )

    assert config["displayMode"] == "network"
    assert config["entityTypes"] == [{"id": "good", "label": "货物"}]
    assert config["customKey"] == 1

    levels = {level["id"]: level for level in config["levels"]}
    assert levels["global"] == {"id": "global", "label": "全球级", "rank": 4}
    assert levels["national"] == {"id": "national", "label": "国家级", "rank": 3}
    assert levels["regional"] == {"id": "regional", "label": "区域级", "rank": 2}
    assert levels["local"] == {"id": "local", "label": "地方级", "rank": 1}
    # 去星级：写进 config.levels 的四个等级不留 ★ / ○ 等拼贴字符
    # （levelsOriginal 里保存的原值属于回滚记账，不在断言范围内）
    assert "★" not in json.dumps(config["levels"], ensure_ascii=False)
    assert "○" not in json.dumps(config["levels"], ensure_ascii=False)
    assert "_p5Legacy" in config

    # 非经济模块 config 不动
    assert (
        read_scalar(economy_p5_db, "SELECT config FROM world_modules WHERE id = 'M_H'")
        is None
    )


def test_relations_backfilled_to_world_links(economy_p5_db: Path):
    supplies = read_rows(
        economy_p5_db,
        "SELECT id, source_id, target_id, link_type, directed, label, meta, time "
        "FROM world_links WHERE json_extract(meta, '$.legacyKey') = 'r1'",
    )
    assert len(supplies) == 1
    mapped = supplies[0]
    assert mapped["link_type"] == "economy.supplies"
    assert mapped["source_id"] == "E_IND"
    assert mapped["target_id"] == "E_ZONE"
    assert mapped["directed"] == 1
    assert mapped["label"] is None
    assert parse_json(mapped["meta"])["flow"] == 100.0
    assert parse_json(mapped["meta"])["legacyRelationType"] == "supplier"
    assert parse_json(mapped["time"]) == {"start": "100", "end": "200"}

    fallback = read_rows(
        economy_p5_db,
        "SELECT label, directed, meta, time FROM world_links "
        "WHERE link_type = 'core.related_to' "
        "AND json_extract(meta, '$.legacyKey') = 'r2'",
    )
    assert len(fallback) == 1
    assert fallback[0]["label"] == "trade_partner"  # 原名保留在 label
    assert fallback[0]["directed"] == 0
    assert "flow" not in parse_json(fallback[0]["meta"])
    assert fallback[0]["time"] is None

    # r1 + r2 + r3 各一条；P1 已转过的那条（未被删）与用户已有的等价边都不重复插
    assert _items_count(economy_p5_db) == 5
    assert read_scalar(economy_p5_db, "SELECT count(*) FROM world_links") == 5


def test_directed_legacy_fallback_uses_core_references(economy_p5_db: Path):
    """M6：P1-MIG-05 口径 —— 校验不通过时，对称旧类型 -> core.related_to，其余有向 -> core.references。"""

    r3 = read_rows(
        economy_p5_db,
        "SELECT source_kind, source_id, target_kind, target_id, link_type, directed, "
        " label, meta FROM world_links "
        "WHERE json_extract(meta, '$.legacyKey') = 'r3'",
    )
    assert len(r3) == 1
    # supplier:<id> 是候选 economy.supplies，但 E_PORT 不在其目标 kind 里 -> 有向回落 core.references
    assert r3[0]["link_type"] == "core.references"
    assert r3[0]["directed"] == 1
    assert r3[0]["label"] == "supplier"
    assert r3[0]["source_kind"] == "industry" and r3[0]["target_kind"] == "port"
    assert parse_json(r3[0]["meta"])["legacyRelationType"] == "supplier"

    # 对称旧类型走 core.related_to / directed=0（trade_partner 的候选是 market -> market）
    r2 = read_rows(
        economy_p5_db,
        "SELECT link_type, directed FROM world_links "
        "WHERE json_extract(meta, '$.legacyKey') = 'r2'",
    )
    assert r2 == [{"link_type": "core.related_to", "directed": 0}]


def test_legacy_links_upgraded_and_kind_vocabulary_synced(economy_p5_db: Path):
    """M7：P1 写的端点 kind 同步成新词表，降级为通用类型的边升为 economy.*（可精确回退）。"""

    # P1-MIG-05 在旧词表下判 economy.consumes 非法而降级的边，P5 归一化 kind 后应升级
    p1 = read_rows(
        economy_p5_db,
        "SELECT source_kind, target_kind, link_type, directed, label, meta "
        "FROM world_links WHERE json_extract(meta, '$.migratedFrom') = "
        "'economy_relations'",
    )
    assert len(p1) == 1
    assert p1[0]["source_kind"] == "industry" and p1[0]["target_kind"] == "good"
    assert p1[0]["link_type"] == "economy.consumes"
    assert p1[0]["directed"] == 1
    assert p1[0]["label"] is None  # 用上契约类型后不再回填原名
    meta = parse_json(p1[0]["meta"])
    # 只有真正被改写的端点才写快照（source_kind 本来就是 industry，没有变化）
    assert "_p5SourceKind" not in meta
    assert meta["_p5TargetKind"] == {"from": "commodity", "to": "good"}
    assert meta["_p5LinkType"] == {
        "linkType": "core.references",
        "directed": 1,
        "label": None,
    }
    # 同库里 kind 与关联端点词表一致（不再出现 kind='good' 而 target_kind='commodity'）
    assert read_rows(
        economy_p5_db,
        "SELECT target_kind FROM world_links WHERE target_id = 'E_GOOD'",
    ) == [{"target_kind": "good"}]

    # 本次新建的边同样是新词表
    new_edge = read_rows(
        economy_p5_db,
        "SELECT target_kind FROM world_links "
        "WHERE json_extract(meta, '$.legacyKey') = 'r1'",
    )
    assert new_edge == [{"target_kind": "market"}]


def test_report_counts(economy_p5_db: Path):
    report = _p5_report(economy_p5_db, fresh=True)

    assert report["modules"] == 1
    assert report["submodules"] == 10
    assert report["kind_backfilled"] == 9
    assert report["level_backfilled"] == 8
    assert report["levels_added"] == 3
    assert report["levels_destarred"] == 1
    assert report["config_keys_written"] == 4
    assert report["custom_fields_backfilled"] == 2
    assert report["icons_mapped"] == 1
    assert report["relations_links_created"] == 3
    # P1 已转过的同源边 + 用户已有等价边
    assert report["relations_duplicates"] == 2
    assert report["relations_orphans"] == 1
    assert report["malformed_meta"] == 1
    # M7：P1 写的 target_kind='commodity' 同步成 'good'，那条降级边升为 economy.consumes
    assert report["link_kind_synced"] == 1
    assert report["link_types_upgraded"] == 1

    # 第二次运行不再产生任何写入（幂等口径）
    second = _p5_report(economy_p5_db, fresh=False)
    assert second["kind_backfilled"] == 0
    assert second["level_backfilled"] == 0
    assert second["levels_added"] == 0
    assert second["levels_destarred"] == 0
    assert second["config_keys_written"] == 0
    assert second["custom_fields_backfilled"] == 0
    assert second["icons_mapped"] == 0
    assert second["relations_links_created"] == 0
    assert second["link_kind_synced"] == 0
    assert second["link_types_upgraded"] == 0
    assert second["meta_written"] == 0
    assert second["modules_written"] == 0


def test_upgrade_twice_is_idempotent(economy_p5_db: Path):
    submodules_before = read_rows(
        economy_p5_db,
        "SELECT id, kind, color, icon, meta FROM world_submodules ORDER BY id",
    )
    items_before = read_rows(
        economy_p5_db, "SELECT id, name, content FROM world_module_items ORDER BY id"
    )
    config_before = read_scalar(
        economy_p5_db, "SELECT config FROM world_modules WHERE id = 'M_E'"
    )
    links_before = _snapshot_links(economy_p5_db)

    _rerun_p5(economy_p5_db)

    assert (
        read_rows(
            economy_p5_db,
            "SELECT id, kind, color, icon, meta FROM world_submodules ORDER BY id",
        )
        == submodules_before
    )
    assert (
        read_rows(
            economy_p5_db,
            "SELECT id, name, content FROM world_module_items ORDER BY id",
        )
        == items_before
    )
    assert (
        read_scalar(economy_p5_db, "SELECT config FROM world_modules WHERE id = 'M_E'")
        == config_before
    )
    assert _snapshot_links(economy_p5_db) == links_before

    # 记账键不被第二次运行覆盖（downgrade 仍能回到升级前的值）
    assert _meta_of(economy_p5_db, "E_GOOD")["_p5LegacyKind"] == "commodity"
    assert _meta_of(economy_p5_db, "E_CUR")["_p5LegacyKind"] == ""
    assert _meta_of(economy_p5_db, "E_CUR")["_p5KindWritten"] == "currency"


# --------------------------------------------------------------- downgrade


def test_downgrade_reverts_only_this_migration(economy_p5_db: Path):
    config = alembic_config(economy_p5_db)
    command.downgrade(config, P4_REVISION)

    rows = {
        row["id"]: row
        for row in read_rows(
            economy_p5_db,
            "SELECT id, kind, color, icon, meta FROM world_submodules ORDER BY id",
        )
    }
    assert rows["E_CUR"]["kind"] is None
    assert rows["E_GOOD"]["kind"] == "commodity"
    assert rows["E_ROUTE"]["kind"] is None
    assert rows["E_ZONE"]["kind"] is None
    assert rows["E_PORT"]["kind"] is None
    assert rows["E_ICON"]["kind"] is None
    assert rows["E_EMPTY"]["kind"] == "resource"
    # color / icon 原值保留
    assert rows["E_GOOD"]["color"] == "type:commodity:regional"
    assert rows["E_ICON"]["icon"] == "💰"

    # 本次写入的 meta 键（level / customFields / legacyIcon / 记账键）全部清除
    assert _meta_of(economy_p5_db, "E_CUR") == {}
    assert _meta_of(economy_p5_db, "E_GOOD") == {}
    for submodule_id in ("E_CUR", "E_GOOD", "E_ICON", "E_MAL"):
        meta = _meta_of(economy_p5_db, submodule_id)
        for marker in (
            "_p5LegacyKind",
            "_p5KindWritten",
            "_p5LevelWritten",
            "_p5CustomFields",
            "_p5IconWritten",
            "_p5RawMeta",
            "legacyIcon",
        ):
            assert marker not in meta, f"{submodule_id}:{marker}"

    # 非法 meta 原样还原
    assert (
        read_scalar(
            economy_p5_db, "SELECT meta FROM world_submodules WHERE id = 'E_MAL'"
        )
        == MALFORMED_META
    )
    # 存量空对象保持 '{}'（不退化成 NULL）
    assert (
        read_scalar(
            economy_p5_db, "SELECT meta FROM world_submodules WHERE id = 'E_EMPTY'"
        )
        == "{}"
    )

    # config 回到 NULL（原值），等级与旧条目不再有本次写入的痕迹
    assert (
        read_scalar(economy_p5_db, "SELECT config FROM world_modules WHERE id = 'M_E'")
        is None
    )

    # 本次新建的边被撤；P1 已转的边与用户已有边保留
    assert read_scalar(economy_p5_db, "SELECT count(*) FROM world_links") == 2
    assert (
        read_scalar(
            economy_p5_db,
            "SELECT count(*) FROM world_links WHERE id = ?",
            (USER_EDGE_ID,),
        )
        == 1
    )
    # 旧 item 全部保留
    assert _items_count(economy_p5_db) == 5

    # 再 upgrade：回填再次成立
    command.upgrade(config, "head")
    assert (
        read_scalar(
            economy_p5_db, "SELECT kind FROM world_submodules WHERE id = 'E_GOOD'"
        )
        == "good"
    )
    assert (
        read_scalar(
            economy_p5_db, "SELECT icon FROM world_submodules WHERE id = 'E_ICON'"
        )
        == "coins"
    )
    assert _meta_of(economy_p5_db, "E_CUR")["level"] == "global"
    assert (
        read_scalar(
            economy_p5_db,
            "SELECT count(*) FROM world_links "
            "WHERE json_extract(meta, '$.legacyKey') = 'r1'",
        )
        == 1
    )
    assert read_scalar(economy_p5_db, "SELECT count(*) FROM world_links") == 5


def test_downgrade_deletes_untouched_edges_and_preserves_user_edited(
    economy_p5_db: Path,
):
    """M1：未改动的新建边被删；用户改过 label 的边与用户值一起保留；改完再 upgrade 幂等。"""

    connection = sqlite3.connect(economy_p5_db)
    # 用户把本次新建的 r2 边改过（label 与 note）
    connection.execute(
        "UPDATE world_links SET label = '用户改过的标签', note = '用户备注' "
        "WHERE json_extract(meta, '$.legacyKey') = 'r2'"
    )
    connection.commit()
    connection.close()

    command.downgrade(alembic_config(economy_p5_db), P4_REVISION)

    # 未改动的 r1 / r3 被删；用户改过的 r2 保留（含记账键，便于再次 upgrade 幂等）
    assert (
        read_scalar(
            economy_p5_db,
            "SELECT count(*) FROM world_links WHERE json_extract(meta, '$.legacyKey') "
            "IN ('r1', 'r3')",
        )
        == 0
    )
    kept = read_rows(
        economy_p5_db,
        "SELECT label, note, link_type FROM world_links "
        "WHERE json_extract(meta, '$.legacyKey') = 'r2'",
    )
    assert kept == [
        {"label": "用户改过的标签", "note": "用户备注", "link_type": "core.related_to"}
    ]

    # 再 upgrade：用户改过的 r2 边不被重复插入（同一确定性 id 只一条），其余键照常补回
    report = _capture_report(economy_p5_db)
    links = read_rows(
        economy_p5_db,
        "SELECT id, label, meta FROM world_links "
        "WHERE json_extract(meta, '$.legacyKey') "
        "IN ('r1', 'r2', 'r3')",
    )
    by_key = {parse_json(row["meta"])["legacyKey"]: row for row in links}
    assert set(by_key) == {"r1", "r2", "r3"}
    assert by_key["r2"]["label"] == "用户改过的标签"  # 用户值保留
    # r1 / r3 只有一条（没有因为 downgrade 而重复插入）
    assert len(links) == 3
    # 本次新建回 r1 / r3 两条；r2（保留的 P1 边）与用户等价边按重复计数
    assert report["relations_links_created"] == 2
    assert report["relations_duplicates"] == 3
    assert report["relations_links_created"] + report["relations_duplicates"] == 5


def test_downgrade_restores_link_type_and_kind_sync(economy_p5_db: Path):
    """M7 回退：P1 边被升级的 link_type / 改写过的端点 kind 精确还原，记账键清干净。"""

    before = read_rows(economy_p5_db, "SELECT id FROM world_links ORDER BY id")

    command.downgrade(alembic_config(economy_p5_db), P4_REVISION)

    p1_rows = read_rows(
        economy_p5_db,
        "SELECT source_kind, target_kind, link_type, directed, label, meta "
        "FROM world_links WHERE json_extract(meta, '$.migratedFrom') = "
        "'economy_relations' OR json_extract(meta, '$._p5LinkType') IS NOT NULL",
    )
    assert len(p1_rows) == 1
    p1 = p1_rows[0]
    assert p1["target_kind"] == "commodity"  # M7 词表同步被回退
    assert p1["link_type"] == "core.references"  # M7 边升级被回退
    assert p1["directed"] == 1
    meta = parse_json(p1["meta"]) or {}
    for marker in ("_p5SourceKind", "_p5TargetKind", "_p5LinkType"):
        assert marker not in meta, marker

    # 用户边与 P1 边都还在（本次新建的 3 条被撤）
    after = read_rows(economy_p5_db, "SELECT id FROM world_links ORDER BY id")
    assert len(after) == 2
    assert {row["id"] for row in before} - {row["id"] for row in after} != set()


def test_downgrade_survives_malformed_link_meta(economy_p5_db: Path):
    """M5：world_links.meta 非法 JSON 时 downgrade 不得整体失败（旧实现用 json_extract 会抛错）。"""

    connection = sqlite3.connect(economy_p5_db)
    connection.execute(
        "UPDATE world_links SET meta = 'oops' "
        "WHERE json_extract(meta, '$.legacyKey') = 'r1'"
    )
    connection.commit()
    connection.close()

    command.downgrade(alembic_config(economy_p5_db), P4_REVISION)

    assert (
        read_scalar(
            economy_p5_db,
            "SELECT count(*) FROM world_links WHERE meta = 'oops'",
        )
        == 1
    )
    # 其余本次新建的边照样被撤（先取 meta 再在 Python 侧判定，避开对 'oops' 调 json_extract）
    metas = [
        row["meta"]
        for row in read_rows(economy_p5_db, "SELECT meta FROM world_links ORDER BY id")
    ]
    assert metas.count("oops") == 1
    assert read_scalar(economy_p5_db, "SELECT count(*) FROM world_links") == 3


def test_downgrade_keeps_user_edited_legacy_icon(economy_p5_db: Path):
    """M4：用户改过 meta.legacyIcon 时不得被无条件弹掉（icon 列照旧精确回滚）。"""

    connection = sqlite3.connect(economy_p5_db)
    meta = json.loads(
        read_scalar(
            economy_p5_db, "SELECT meta FROM world_submodules WHERE id = 'E_ICON'"
        )
    )
    meta["legacyIcon"] = "my-own-icon"
    connection.execute(
        "UPDATE world_submodules SET meta = ? WHERE id = 'E_ICON'",
        (json.dumps(meta, ensure_ascii=False),),
    )
    connection.commit()
    connection.close()

    command.downgrade(alembic_config(economy_p5_db), P4_REVISION)

    meta = _meta_of(economy_p5_db, "E_ICON")
    # 旧实现无条件 meta.pop("legacyIcon")，用户改过的值会被删掉
    assert meta.get("legacyIcon") == "my-own-icon"
    assert "_p5IconWritten" not in meta
    assert (
        read_scalar(
            economy_p5_db, "SELECT icon FROM world_submodules WHERE id = 'E_ICON'"
        )
        == "💰"  # icon 列仍等于本次写入值 -> 精确回滚到原 emoji
    )


def test_downgrade_keeps_user_edited_icon_column(economy_p5_db: Path):
    """M4：用户只改了 icon 列时该列保留，legacyIcon 不被单独弹掉。"""

    connection = sqlite3.connect(economy_p5_db)
    connection.execute(
        "UPDATE world_submodules SET icon = 'my-own-icon' WHERE id = 'E_ICON'"
    )
    connection.commit()
    connection.close()

    command.downgrade(alembic_config(economy_p5_db), P4_REVISION)

    assert (
        read_scalar(
            economy_p5_db, "SELECT icon FROM world_submodules WHERE id = 'E_ICON'"
        )
        == "my-own-icon"
    )
    assert _meta_of(economy_p5_db, "E_ICON").get("legacyIcon") == "💰"


def test_downgrade_reverts_untouched_icon(economy_p5_db: Path):
    """M4 对照：用户没碰过的行，icon 列与 legacyIcon 一起精确回滚。"""

    command.downgrade(alembic_config(economy_p5_db), P4_REVISION)

    assert (
        read_scalar(
            economy_p5_db, "SELECT icon FROM world_submodules WHERE id = 'E_ICON'"
        )
        == "💰"
    )
    assert _meta_of(economy_p5_db, "E_ICON") == {}


def test_downgrade_round_trips_non_dict_custom_fields(legacy_shape_economy_db: Path):
    """M3：存量 meta.customFields 不是 dict 时原样还原，不被本次写入的合并覆盖掉。"""

    # upgrade 后是本次写入的合并结果（旧值不是 dict -> 从空 dict 开始合并）
    assert _meta_of(legacy_shape_economy_db, "E_CF_STR")["customFields"] == {
        "seat": "王都",
        "weight": 3,
    }

    command.downgrade(alembic_config(legacy_shape_economy_db), P4_REVISION)

    meta = _meta_of(legacy_shape_economy_db, "E_CF_STR")
    assert meta.get("customFields") == "legacy-string"
    assert "_p5CustomFields" not in meta

    # 原值本来就合法的行：撤掉本次新建的键后回到原值（原来的键一个不少）
    assert _meta_of(legacy_shape_economy_db, "E_CF_DICT")["customFields"] == {
        "seat": "旧座"
    }


def test_downgrade_round_trips_non_list_levels(legacy_shape_economy_db: Path):
    """M2：config.levels 不是 list 时原样还原（旧实现只剩 []）。"""

    module_config = parse_json(
        read_scalar(
            legacy_shape_economy_db,
            "SELECT config FROM world_modules WHERE id = ?",
            (LEGACY_SHAPE_MODULE_ID,),
        )
    )
    assert {level["id"] for level in module_config["levels"]} == {
        "global",
        "national",
        "regional",
        "local",
    }
    assert "_p5Legacy" in module_config

    command.downgrade(alembic_config(legacy_shape_economy_db), P4_REVISION)

    config = parse_json(
        read_scalar(
            legacy_shape_economy_db,
            "SELECT config FROM world_modules WHERE id = ?",
            (LEGACY_SHAPE_MODULE_ID,),
        )
    )
    assert config == LEGACY_SHAPE_CONFIG
    # 非 list 的原 levels 不能被降级成 []（旧实现的症状）
    assert config["levels"] == {"global": 4}


def test_downgrade_preserves_user_edits(economy_p5_db: Path):
    connection = sqlite3.connect(economy_p5_db)
    # 用户把迁移写入的 kind 改成自己的自定义类型
    connection.execute(
        "UPDATE world_submodules SET kind = 'custom_dynasty' WHERE id = 'E_CUR'"
    )
    # 用户改了等级与 customFields
    connection.execute(
        "UPDATE world_submodules SET meta = ? WHERE id = 'E_GOOD'",
        (
            json.dumps(
                {
                    "level": "regional-user",
                    "_p5LevelWritten": "regional",
                },
                ensure_ascii=False,
            ),
        ),
    )
    # 用户改了 config 的等级 label 与本次写入的键
    connection.execute(
        "UPDATE world_modules SET config = ? WHERE id = 'M_E'",
        (
            json.dumps(
                {
                    "customKey": 99,
                    "levels": [{"id": "global", "label": "用户自定义", "rank": 9}],
                    "_p5Legacy": {
                        "configKeys": {"customKey": 1},
                        "levelsWritten": {
                            "global": {"id": "global", "label": "全球级", "rank": 4}
                        },
                        "levelsOriginal": {},
                        "hadConfig": False,
                    },
                },
                ensure_ascii=False,
            ),
        ),
    )
    connection.commit()
    connection.close()

    command.downgrade(alembic_config(economy_p5_db), P4_REVISION)

    # 用户值一律保留
    assert (
        read_scalar(
            economy_p5_db, "SELECT kind FROM world_submodules WHERE id = 'E_CUR'"
        )
        == "custom_dynasty"
    )
    assert _meta_of(economy_p5_db, "E_GOOD")["level"] == "regional-user"
    assert "_p5LevelWritten" not in _meta_of(economy_p5_db, "E_GOOD")

    config = parse_json(
        read_scalar(economy_p5_db, "SELECT config FROM world_modules WHERE id = 'M_E'")
    )
    assert config["customKey"] == 99  # 现值 != 本次写入值，保留
    assert config["levels"] == [{"id": "global", "label": "用户自定义", "rank": 9}]
    assert "_p5Legacy" not in config

    # 用户没碰过的行仍被精确回滚
    assert (
        read_scalar(
            economy_p5_db, "SELECT kind FROM world_submodules WHERE id = 'E_ZONE'"
        )
        is None
    )
    assert _meta_of(economy_p5_db, "E_ZONE") == {}


def test_empty_db_upgrade_and_downgrade(empty_head_db: Path):
    config = alembic_config(empty_head_db)
    command.downgrade(config, P4_REVISION)
    command.upgrade(config, "head")
    assert read_scalar(empty_head_db, "SELECT count(*) FROM world_submodules") == 0
    assert read_scalar(empty_head_db, "SELECT count(*) FROM world_links") == 0

    command.downgrade(config, P4_REVISION)
    command.upgrade(config, "head")
    assert read_scalar(empty_head_db, "SELECT count(*) FROM world_module_items") == 0


def test_migration_linear_history():
    """revision 基座必须是 P5 之前的当前 head，保持线性历史。"""

    from migrations.versions import (
        d4e8b1c7a206_wbl_p5_01_backfill_economy as migration,
    )

    assert migration.revision == P5_REVISION
    assert migration.down_revision == P4_REVISION
