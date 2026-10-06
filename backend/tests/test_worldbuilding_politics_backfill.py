"""政治旧数据回填测试（Phase 4 P4-T12）

覆盖 wbl_p4_01_backfill_politics：
- 幂等：upgrade 两次 / downgrade 后再 upgrade，数据（含 world_links）不变
- kind 归一化：nation -> polity、leader -> figure、color 前缀推导、无法识别 -> legacy
- scope 推导：intra_polity / cross_polity / 无法判定 -> legacy
- `_char_ref` / `_char_link` -> figure.meta.characterId 与 orphan 计数
- downgrade：只撤销本次写入，用户改过的 kind / scope / characterId / legacy 一律保留；
  `meta = '{}'` 保持 `'{}'`；非法 meta 原文原样还原
- 报告口径：`legacy_flagged` 只数本次置 `meta.legacy = true` 的行，`meta_written` 数 meta 被改写的行
- 空库 upgrade/downgrade 不报错
- 非政治模块不被触碰；本迁移不新增 world_links

夹具口径：先把旧政治编码写进 Phase 1 之前的旧库，再 upgrade 到 head，
使 P1-MIG-04/05/06 与本迁移在同一次线性升级中按真实顺序执行；
之后每个用例用 stamp(P1 head) + upgrade(head) 只重跑本迁移。
"""

from __future__ import annotations

import json
import logging
import sqlite3
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
P1_HEAD = "8a5f26a774e3"

# 政治子模块样本（module_id 用旧库的 M_P / M_H；kind 为 P1 之后、P4 之前的真实存量值）：
# P_POL1：color=type:nation -> P1 推成 kind=nation（本迁移 -> polity）
# P_FIG1：kind=leader 旧枚举 + icon alignment 前缀（本迁移 -> figure）
# P_POL2：kind 空缺 + color=type:nation:warlord（本迁移从 color 推导 polity）
# P_UNK1：无法识别的旧 generic kind（保留只读 + meta.legacy）
LEGACY_SUBMODULES = (
    ("M_P", "P_POL1", "旧政权", "type:nation:superpower:active", None, "nation"),
    ("M_P", "P_FIG1", "旧领袖", "type:leader:head", "alignment:lawful", "leader"),
    ("M_P", "P_POL2", "推导政权", "type:nation:warlord", None, None),
    ("M_P", "P_UNK1", "无法识别", "custom", None, "tetrarchy"),
    ("M_P", "P_POL3", "第二政权", "type:nation", None, "nation"),
    ("M_P", "P_ORG1", "无归属组织", "type:organization", None, "organization"),
    ("M_P", "P_ORG2", "单一政权组织", "custom", None, "organization"),
    ("M_P", "P_ORG3", "跨政权组织", "custom", None, "organization"),
    ("M_P", "P_FIG2", "绑定人物", "type:leader", None, "leader"),
    # meta 保真：空对象 meta（真实开发库 5 行政治子模块的形态）必须保持 '{}' 而非 NULL
    ("M_P", "P_JSON1", "空 meta 政权", "type:nation", None, "polity"),
    # 非法 meta（不是 JSON 对象）：本次整体替换并记账，downgrade 必须原样还原
    ("M_P", "P_MAL", "坏 meta 政权", "type:custom", None, "polity"),
    # 非政治模块的同类旧编码：本迁移必须完全不动
    ("M_H", "H_POL1", "历史里的 nation 编码", "type:nation:superpower", None, "nation"),
)

# 非法 meta 原值（不是合法 JSON 对象）：upgrade 后应落在 `_p4RawMeta`，downgrade 后原样写回
MALFORMED_META = "not-json"
MALFORMED_META_ID = "P_MAL"

# §3.8.3 归属边样本：ORG2 只挂一个政权 -> intra_polity；ORG3 挂两个 -> cross_polity；
# ORG1 无归属边 -> 不写猜测值，标 legacy
LEGACY_LINKS = (
    ("L1", "P_ORG2", "P_POL1", "politics.subordinate_to"),
    ("L2", "P_ORG3", "P_POL1", "politics.member_of"),
    ("L3", "P_ORG3", "P_POL3", "politics.subordinate_to"),
)

# 人物引用样本：T1 回填、T2 同 submodule 的 _char_link 幂等、T3 角色不存在（orphan）、
# T4 键上 itemId 指别人（复制残留）、T5 挂在 polity 上（非 figure，不回填）、
# T6 content 不是合法 JSON 对象（计 malformed_item_content，原值不被改写）
LEGACY_ITEMS = (
    ("T1", "P_FIG2", "人物设定", {"_char_ref:C1": "关羽"}),
    ("T2", "P_FIG2", "复制残留", {"_char_link:T1:C1": "关羽"}),
    ("T3", "P_FIG2", "孤儿人物", {"_char_ref:MISSING": "不存在"}),
    ("T4", "P_FIG2", "复制到别人身上", {"_char_link:T1:C1": "关羽"}),
    ("T5", "P_POL1", "政权上的残留", {"_char_ref:C1": "关羽"}),
)

# 非法 content 原值（不是合法 JSON 对象）
MALFORMED_CONTENT_ITEM = ("T6", "P_FIG2", "坏 content 条目", "not-json")


def _insert_submodules(db_path: Path, rows) -> None:
    """在已升级到 head 的库结构上写入 P1 之后的存量子模块行。"""

    connection = sqlite3.connect(db_path)
    for module_id, submodule_id, name, color, icon, kind in rows:
        connection.execute(
            _sql(
                "INSERT INTO world_submodules",
                "(id, module_id, parent_id, name, description, order_index,",
                " color, icon, kind, meta, created_at, updated_at)",
                "VALUES (?,?,NULL,?,NULL,0,?,?,?,NULL,",
                " CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
            ),
            (submodule_id, module_id, name, color, icon, kind),
        )
    connection.commit()
    connection.close()


def _seed_politics_legacy(db_path: Path) -> None:
    """写入 P4 盘点到的旧政治编码：子模块与 item（P1 结构已就位）。"""

    _insert_submodules(
        db_path,
        [
            (module_id, submodule_id, name, color, icon, kind)
            for module_id, submodule_id, name, color, icon, kind in LEGACY_SUBMODULES
        ],
    )

    connection = sqlite3.connect(db_path)
    for item_id, submodule_id, name, content in LEGACY_ITEMS:
        connection.execute(
            _sql(
                "INSERT INTO world_module_items",
                "(id, module_id, submodule_id, name, content, order_index,",
                " is_published, created_at, updated_at)",
                "VALUES (?, 'M_P', ?, ?, ?, 0, 1,",
                " CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            ),
            (item_id, submodule_id, name, json.dumps(content, ensure_ascii=False)),
        )
    # 非法 meta（不是 JSON 对象）：直接写原文本
    connection.execute(
        "UPDATE world_submodules SET meta = ? WHERE id = ?",
        (MALFORMED_META, MALFORMED_META_ID),
    )
    # 空对象 meta：真实开发库政治子模块的形态
    connection.execute("UPDATE world_submodules SET meta = '{}' WHERE id = 'P_JSON1'")
    # 非法 content（不是 JSON 对象）
    item_id, submodule_id, name, content = MALFORMED_CONTENT_ITEM
    connection.execute(
        _sql(
            "INSERT INTO world_module_items",
            "(id, module_id, submodule_id, name, content, order_index,",
            " is_published, created_at, updated_at)",
            "VALUES (?, 'M_P', ?, ?, ?, 0, 1,",
            " CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        ),
        (item_id, submodule_id, name, content),
    )
    connection.commit()
    connection.close()


def _seed_scope_links(db_path: Path) -> None:
    """在 P1 head 结构上写入归属边（world_links 由 P1-MIG-03 建立）。"""

    connection = sqlite3.connect(db_path)
    for link_id, source_id, target_id, link_type in LEGACY_LINKS:
        connection.execute(
            _sql(
                "INSERT INTO world_links",
                "(id, world_id, source_module, source_kind, source_id,",
                " target_module, target_kind, target_id, link_type, directed,",
                " label, note, meta, time, created_at, updated_at)",
                "VALUES (?, 'W1','politics','organization',?,",
                " 'politics','polity',?,?,1,NULL,NULL,NULL,NULL,",
                " CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
            ),
            (link_id, source_id, target_id, link_type),
        )
    connection.commit()
    connection.close()


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


@pytest.fixture()
def politics_legacy_db(legacy_db: Path) -> Path:
    """含旧政治编码的库：P1 已就位后写入存量样本，再由本迁移升级到 head。"""

    config = alembic_config(legacy_db)
    command.upgrade(config, "head")  # P1-MIG-01..06：kind/meta/world_links 就位
    _seed_politics_legacy(legacy_db)  # P1 之后、P4 之前的存量政治数据
    _seed_scope_links(legacy_db)
    command.stamp(config, P1_HEAD)
    command.upgrade(config, "head")  # 只跑本迁移
    return legacy_db


def _rerun_p4(db_path: Path) -> None:
    """只重跑本迁移：stamp 回 P1 head 再 upgrade 到 head。"""

    config = alembic_config(db_path)
    command.stamp(config, P1_HEAD)
    command.upgrade(config, "head")


def _capture_report(db_path: Path) -> Dict[str, int]:
    """只跑一次本迁移（不 stamp/重跑），返回这次 upgrade 的报告。"""

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

    prefix = "wbl_p4_01_backfill_politics report: "
    for message in captured:
        if message.startswith(prefix):
            return json.loads(message[len(prefix) :])
    raise AssertionError("迁移未打印报告（logger.info）")


def _p4_report(db_path: Path) -> Dict[str, int]:
    """stamp 回 P1 head 后重跑本迁移，返回这次 upgrade 的报告。"""

    config = alembic_config(db_path)
    command.stamp(config, P1_HEAD)
    return _capture_report(db_path)


def _write_meta(db_path: Path, submodule_id: str, meta: Dict) -> None:
    """模拟用户在迁移后编辑 meta（走 sqlite 而不是 ORM，测试与实现同层）。"""

    connection = sqlite3.connect(db_path)
    connection.execute(
        "UPDATE world_submodules SET meta = ? WHERE id = ?",
        (json.dumps(meta, ensure_ascii=False, sort_keys=True), submodule_id),
    )
    connection.commit()
    connection.close()


def _write_kind(db_path: Path, submodule_id: str, kind) -> None:
    """模拟用户在迁移后编辑 kind。"""

    connection = sqlite3.connect(db_path)
    connection.execute(
        "UPDATE world_submodules SET kind = ? WHERE id = ?", (kind, submodule_id)
    )
    connection.commit()
    connection.close()


def test_politics_kind_normalized_and_derived(politics_legacy_db: Path):
    """nation -> polity、leader -> figure、color 前缀推导、无法识别保留 legacy。"""

    rows = {
        row["id"]: row
        for row in read_rows(
            politics_legacy_db,
            "SELECT id, kind, color, icon, meta FROM world_submodules "
            "WHERE id LIKE 'P_%' OR id = 'H_POL1'",
        )
    }

    assert rows["P_POL1"]["kind"] == "polity"
    assert rows["P_FIG1"]["kind"] == "figure"
    assert rows["P_POL2"]["kind"] == "polity"

    # color / icon 原值不动
    assert rows["P_POL1"]["color"] == "type:nation:superpower:active"
    assert rows["P_FIG1"]["color"] == "type:leader:head"
    assert rows["P_FIG1"]["icon"] == "alignment:lawful"

    # 无法识别的旧 generic kind：保留只读 + legacy 标记
    assert rows["P_UNK1"]["kind"] == "tetrarchy"
    assert _meta_of(politics_legacy_db, "P_UNK1")["legacy"] is True

    # 非政治模块不得被改动
    assert rows["H_POL1"]["kind"] == "nation"
    assert rows["H_POL1"]["color"] == "type:nation:superpower"
    assert rows["H_POL1"]["meta"] is None


def test_politics_scope_derived_from_links(politics_legacy_db: Path):
    """§3.8.3：单政权 -> intra_polity、多政权 -> cross_polity、无归属边 -> legacy。"""

    assert _meta_of(politics_legacy_db, "P_ORG2")["scope"] == "intra_polity"
    assert _meta_of(politics_legacy_db, "P_ORG3")["scope"] == "cross_polity"
    # 无归属边：不写猜测值（不是 independent），保留只读并标 legacy
    assert "scope" not in _meta_of(politics_legacy_db, "P_ORG1")
    assert _meta_of(politics_legacy_db, "P_ORG1")["legacy"] is True

    # 记账键只用于回滚
    assert _meta_of(politics_legacy_db, "P_ORG2")["_p4DerivedScope"] == "intra_polity"


def test_char_refs_backfilled_to_figure_meta(politics_legacy_db: Path):
    """`_char_ref` / `_char_link` -> figure.meta.characterId；orphan 不回填。"""

    assert _meta_of(politics_legacy_db, "P_FIG2")["characterId"] == "C1"
    # 人物身份不落 WorldLink：本迁移不新增 politics.* 边
    assert (
        read_scalar(
            politics_legacy_db,
            "SELECT count(*) FROM world_links WHERE link_type LIKE 'politics.%'",
        )
        == 3
    )
    # 非 figure 上的残留键不回填
    assert "characterId" not in _meta_of(politics_legacy_db, "P_POL1")

    # 旧 item 全部保留（含 content 非法的 T6：本迁移不改写旧 item）
    names = {
        row["name"]
        for row in read_rows(
            politics_legacy_db, "SELECT name FROM world_module_items WHERE id LIKE 'T%'"
        )
    }
    assert names == {
        "人物设定",
        "复制残留",
        "孤儿人物",
        "复制到别人身上",
        "政权上的残留",
        "坏 content 条目",
    }


def test_upgrade_twice_is_idempotent(politics_legacy_db: Path):
    """upgrade 两次：kind / color / meta / 行数（含 world_links）完全一致，记账键不被改写。"""

    before = read_rows(
        politics_legacy_db,
        "SELECT id, kind, color, icon, meta FROM world_submodules ORDER BY id",
    )
    item_before = read_rows(
        politics_legacy_db,
        "SELECT id, name, content FROM world_module_items ORDER BY id",
    )
    # world_links 也必须快照比对：任何「每次 upgrade 都插一条重复边」的实现都会在这里失败
    link_before = read_rows(
        politics_legacy_db,
        "SELECT id, source_id, target_id, link_type FROM world_links ORDER BY id",
    )

    _rerun_p4(politics_legacy_db)

    assert (
        read_rows(
            politics_legacy_db,
            "SELECT id, kind, color, icon, meta FROM world_submodules ORDER BY id",
        )
        == before
    )
    assert (
        read_rows(
            politics_legacy_db,
            "SELECT id, name, content FROM world_module_items ORDER BY id",
        )
        == item_before
    )
    assert (
        read_rows(
            politics_legacy_db,
            "SELECT id, source_id, target_id, link_type FROM world_links ORDER BY id",
        )
        == link_before
    )

    # 第二次运行不得覆盖第一次的记账值（回滚仍能回到 P1 之后、P4 之前的原值）
    assert _meta_of(politics_legacy_db, "P_POL1")["_p4LegacyKind"] == "nation"
    assert _meta_of(politics_legacy_db, "P_FIG1")["_p4LegacyKind"] == "leader"
    assert _meta_of(politics_legacy_db, "P_POL2")["_p4LegacyKind"] == ""
    assert _meta_of(politics_legacy_db, "P_FIG2")["_p4CharacterId"] == "C1"


def test_downgrade_reverts_only_this_migration(politics_legacy_db: Path):
    """downgrade：kind 归一化回滚、scope/characterId/legacy 标记清除，color 与 item 保留。"""

    assert _meta_of(politics_legacy_db, "P_FIG2")["characterId"] == "C1"
    assert _meta_of(politics_legacy_db, "P_ORG2")["scope"] == "intra_polity"

    config = alembic_config(politics_legacy_db)
    command.downgrade(config, P1_HEAD)

    # kind 回到旧值；color / icon 原值保留
    rows = {
        row["id"]: row
        for row in read_rows(
            politics_legacy_db,
            "SELECT id, kind, color, icon FROM world_submodules WHERE id LIKE 'P_%'",
        )
    }
    assert rows["P_POL1"]["kind"] == "nation"
    assert rows["P_FIG1"]["kind"] == "leader"
    assert rows["P_FIG2"]["kind"] == "leader"
    assert rows["P_POL1"]["color"] == "type:nation:superpower:active"
    assert rows["P_FIG1"]["color"] == "type:leader:head"
    assert rows["P_FIG1"]["icon"] == "alignment:lawful"
    assert rows["P_POL2"]["kind"] is None

    # 本次写入的 scope / characterId / 全部记账键清除
    for submodule_id in ("P_ORG1", "P_ORG2", "P_ORG3", "P_FIG2", "P_UNK1"):
        meta = _meta_of(politics_legacy_db, submodule_id)
        assert "scope" not in meta, submodule_id
        assert "characterId" not in meta, submodule_id
        assert "legacy" not in meta, submodule_id
        assert "_p4DerivedScope" not in meta, submodule_id
        assert "_p4CharacterId" not in meta, submodule_id
        assert "_p4LegacyKind" not in meta, submodule_id

    # 旧 item 与旧 world_links 保留
    assert (
        read_scalar(
            politics_legacy_db,
            "SELECT count(*) FROM world_module_items WHERE id LIKE 'T%'",
        )
        == 6
    )
    assert (
        read_scalar(
            politics_legacy_db,
            "SELECT count(*) FROM world_links WHERE link_type LIKE 'politics.%'",
        )
        == 3
    )

    # 重新 upgrade：归一化与回填再次成立
    command.upgrade(config, "head")
    assert (
        read_scalar(
            politics_legacy_db, "SELECT kind FROM world_submodules WHERE id = 'P_POL1'"
        )
        == "polity"
    )
    assert _meta_of(politics_legacy_db, "P_ORG2")["scope"] == "intra_polity"
    assert _meta_of(politics_legacy_db, "P_FIG2")["characterId"] == "C1"
    assert (
        read_scalar(
            politics_legacy_db,
            "SELECT count(*) FROM world_links WHERE link_type LIKE 'politics.%'",
        )
        == 3
    )


def test_empty_db_upgrade_and_downgrade(empty_head_db: Path):
    """空库：upgrade/downgrade/再 upgrade 均不报错，且不产生任何政治数据。"""

    config = alembic_config(empty_head_db)
    command.downgrade(config, P1_HEAD)
    command.upgrade(config, "head")
    assert read_scalar(empty_head_db, "SELECT count(*) FROM world_submodules") == 0
    assert read_scalar(empty_head_db, "SELECT count(*) FROM world_module_items") == 0

    command.downgrade(config, P1_HEAD)
    command.upgrade(config, "head")
    assert read_scalar(empty_head_db, "SELECT count(*) FROM world_submodules") == 0
    assert read_scalar(empty_head_db, "SELECT count(*) FROM world_links") == 0


def test_downgrade_preserves_user_edits(politics_legacy_db: Path):
    """用户改过 kind / scope / characterId / legacy 时，downgrade 必须保留用户值。"""

    # P_POL1: 迁移写成 polity -> 用户改成 custom_dynasty（记账键保持迁移原值）
    _write_kind(politics_legacy_db, "P_POL1", "custom_dynasty")
    # P_FIG2: 迁移回填 characterId=C1 -> 用户改成 C2
    _write_meta(
        politics_legacy_db,
        "P_FIG2",
        {
            "characterId": "C2",
            "_p4CharacterId": "C1",
            "_p4LegacyKind": "leader",
            "_p4KindWritten": "figure",
        },
    )
    # P_ORG2: 迁移推导 scope=intra_polity -> 用户改成 independent
    _write_meta(
        politics_legacy_db,
        "P_ORG2",
        {"scope": "independent", "_p4DerivedScope": "intra_polity"},
    )
    # P_UNK1: 迁移置 legacy=true -> 用户清掉该标记并留自己的键
    _write_meta(politics_legacy_db, "P_UNK1", {"note": "用户自己的备注"})
    # P_ORG1: 迁移置 legacy=true -> 用户明确标 false
    _write_meta(politics_legacy_db, "P_ORG1", {"legacy": False})

    config = alembic_config(politics_legacy_db)
    command.downgrade(config, P1_HEAD)

    # 用户值全部保留
    assert (
        read_scalar(
            politics_legacy_db, "SELECT kind FROM world_submodules WHERE id = 'P_POL1'"
        )
        == "custom_dynasty"
    )
    assert _meta_of(politics_legacy_db, "P_FIG2")["characterId"] == "C2"
    assert _meta_of(politics_legacy_db, "P_ORG2")["scope"] == "independent"
    assert _meta_of(politics_legacy_db, "P_UNK1")["note"] == "用户自己的备注"
    assert "legacy" not in _meta_of(politics_legacy_db, "P_UNK1")
    assert _meta_of(politics_legacy_db, "P_ORG1")["legacy"] is False

    # 本次写入的记账键一律清除（不残留内部状态；用户值所在行也清）
    for submodule_id in ("P_POL1", "P_FIG2", "P_ORG2", "P_ORG1", "P_UNK1"):
        meta = _meta_of(politics_legacy_db, submodule_id)
        for marker in (
            "_p4DerivedScope",
            "_p4CharacterId",
            "_p4LegacyKind",
            "_p4KindWritten",
            "_p4RawMeta",
        ):
            assert marker not in meta, f"{submodule_id}:{marker}"

    # 用户没碰过的行仍被精确回滚
    assert (
        read_scalar(
            politics_legacy_db, "SELECT kind FROM world_submodules WHERE id = 'P_FIG1'"
        )
        == "leader"
    )
    assert _meta_of(politics_legacy_db, "P_ORG3") == {}
    # P_FIG2 的 characterId 是用户值 -> 保留 C2；P_POL1 从未回填过 -> 仍无该键
    assert _meta_of(politics_legacy_db, "P_POL1") == {}


def test_downgrade_keeps_empty_meta_object(politics_legacy_db: Path):
    """`meta = '{}'` 的存量行：upgrade 不写、downgrade 后仍是 `'{}'`（不能退化成 NULL）。"""

    before = read_scalar(
        politics_legacy_db, "SELECT meta FROM world_submodules WHERE id = 'P_JSON1'"
    )
    assert before == "{}"

    config = alembic_config(politics_legacy_db)
    command.downgrade(config, P1_HEAD)

    after = read_scalar(
        politics_legacy_db, "SELECT meta FROM world_submodules WHERE id = 'P_JSON1'"
    )
    assert after == "{}"
    assert after is not None

    # 再 upgrade：仍保持空对象（不被写成 NULL，也不被塞入记账键）
    command.upgrade(config, "head")
    assert (
        read_scalar(
            politics_legacy_db, "SELECT meta FROM world_submodules WHERE id = 'P_JSON1'"
        )
        == "{}"
    )


def test_malformed_meta_and_content_are_reported_and_restored(politics_legacy_db: Path):
    """非法 meta / 非法 item content：报告有计数，且 downgrade 把原值原样还原。"""

    malformed_meta = read_scalar(
        politics_legacy_db, "SELECT meta FROM world_submodules WHERE id = 'P_MAL'"
    )
    assert json.loads(malformed_meta)["_p4RawMeta"] == MALFORMED_META

    malformed_content = read_scalar(
        politics_legacy_db, "SELECT content FROM world_module_items WHERE id = 'T6'"
    )
    assert malformed_content == "not-json"

    config = alembic_config(politics_legacy_db)
    # 先回滚到 P1 head，再跑一次本迁移：这次 upgrade 的 malformed 计数就是真实首次计入
    command.downgrade(config, P1_HEAD)
    assert (
        read_scalar(
            politics_legacy_db, "SELECT meta FROM world_submodules WHERE id = 'P_MAL'"
        )
        == MALFORMED_META
    )
    report = _capture_report(politics_legacy_db)
    assert report["malformed_meta"] == 1
    assert report["malformed_item_content"] == 1

    # meta 被替换成只含记账键的对象（原值只活在记账键里）
    assert json.loads(
        read_scalar(
            politics_legacy_db,
            "SELECT meta FROM world_submodules WHERE id = 'P_MAL'",
        )
    ) == {"_p4RawMeta": MALFORMED_META}


def test_report_legacy_flagged_matches_meta_legacy_true(politics_legacy_db: Path):
    """`legacy_flagged` = 本次把 `meta.legacy` 置为 true 的行数（不是任何 meta 变更）。

    先回滚回 P1 head 再跑本迁移：这样报告与「本次恰好置 true 的行」在同一状态下可比。
    """

    config = alembic_config(politics_legacy_db)
    command.downgrade(config, P1_HEAD)
    report = _capture_report(politics_legacy_db)

    legacy_true = read_rows(
        politics_legacy_db,
        "SELECT id FROM world_submodules WHERE json_extract(meta, '$.legacy') = 1",
    )
    assert report["legacy_flagged"] == len(legacy_true)
    # 夹具里恰好 3 行：P_UNK1（不可识别 kind）+ P_ORG1（无政权归属边）+ 旧库自带的 POL1
    assert sorted(row["id"] for row in legacy_true) == ["POL1", "P_ORG1", "P_UNK1"]

    # 与「任何 meta 变更」区分开：meta_written 必须更大
    assert report["meta_written"] > report["legacy_flagged"]

    # 第二次重跑不应再计入任何写入（幂等口径）
    second = _p4_report(politics_legacy_db)
    assert second["legacy_flagged"] == 0
    assert second["meta_written"] == 0
